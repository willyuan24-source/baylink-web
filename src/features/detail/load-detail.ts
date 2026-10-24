import { detailLoaders } from '../../data/generated/detail-loaders';
import { detailBucket } from '../../lib/english-loading';
import { chunkLoader } from '../../lib/chunk-recovery';
import { canonicalEventId } from '../../lib/event-id';
import { detailKey, recordFromBucket, type DetailBucket, type DetailRecord } from './detail-record';
import { shopParts } from './shop-parts';

export type DetailKind = 'event' | 'offer' | 'opening';

/**
 * The detail route's data (ENGSEC-01): the generated bucket its URL hashes to, loaded once per bucket and kept for the
 * visit. `readDetailRecord` follows React's Suspense contract: it throws the pending load, so the layout keeps the
 * prerendered page on screen at boot (app/boot-main.ts) and a client-side visit keeps the previous page until the data is in.
 * The bucket loads through chunkLoader: one quiet retry, the REG-15 guard, and a failure marked as a load failure
 * (isChunkLoadFailure), which is what the page's 重试 state catches; a retry after that asks for the file again.
 */
type BucketState = { promise: Promise<void>; bucket?: DetailBucket; error?: unknown };
const buckets = new Map<string, BucketState>();
/** The pause before the quiet retry (tests shorten it). */
let retryMs = 1000;

const bucketKey = (kind: DetailKind, id: string) => detailBucket(kind, id);
const lookupId = (kind: DetailKind, id: string) => kind === 'event' ? canonicalEventId(id) : id;

/**
 * An offer's or an opening's own parts (ShopFacts.tsx, shop-parts.ts): one chunk, loaded with the first such bucket through
 * the same chunkLoader (a failure is a load failure, so 重试 asks for it again), and kept for the visit once in.
 */
let shopState: BucketState | undefined;
function loadShop(kind: DetailKind): BucketState | undefined {
  if (kind === 'event' || shopParts()) return undefined;
  if (!shopState) {
    const state: BucketState = {
      promise: chunkLoader(() => import('./ShopFacts'), () => undefined, retryMs)().then(() => undefined, error => { state.error = error; }),
    };
    shopState = state;
  }
  return shopState;
}

function loadBucket(name: string): BucketState | undefined {
  const existing = buckets.get(name);
  if (existing) return existing;
  const loader = Object.hasOwn(detailLoaders, name) ? detailLoaders[name] : undefined;
  if (!loader) return undefined;
  const state: BucketState = {
    promise: chunkLoader(loader, module => (module as { default: DetailBucket }).default, retryMs)()
      .then(bucket => { state.bucket = bucket; }, error => { state.error = error; }),
  };
  buckets.set(name, state);
  return state;
}

/** Start loading a detail's bucket (the page module calls it for the URL it boots on, before React renders). */
export function preloadDetailRecord(kind: DetailKind, id: string): void {
  loadBucket(bucketKey(kind, id));
  loadShop(kind);
}

/**
 * The record for a detail URL: the record, null for an unknown id (the page renders 404), or a thrown promise while its
 * bucket loads. A failed load throws its error once (DetailLoadError offers 重试, which calls `retryDetailRecord`).
 */
export function readDetailRecord(kind: DetailKind, id: string): DetailRecord | null {
  // An old event id lives in the bucket of its own URL (generate-detail-records.ts writes aliases there too).
  const state = loadBucket(bucketKey(kind, id));
  if (!state) return null;
  const shop = loadShop(kind);
  if (state.error) throw state.error;
  if (shop?.error) throw shop.error;
  if (!state.bucket) throw state.promise;
  if (shop) throw shop.promise;
  return recordFromBucket(state.bucket, detailKey(kind, id)) ?? recordFromBucket(state.bucket, detailKey(kind, lookupId(kind, id))) ?? null;
}

/** Forget a failed load so the next read tries again. */
export function retryDetailRecord(kind: DetailKind, id: string): void {
  const name = bucketKey(kind, id);
  if (buckets.get(name)?.error) buckets.delete(name);
  if (shopState?.error) shopState = undefined;
}

/**
 * EVENTS' loading rule for an in-app tap (the page's useDetailRecord): nothing for the first 300 ms (the old page and NAV's
 * route bar stay), then the detail skeleton for at least 400 ms, so it never flickers. A hold starts only when the load is
 * still pending at 300 ms: a fast load leaves no hold behind that could put the skeleton over a page already on screen.
 */
const SKELETON_AFTER = 300, SKELETON_FOR = 400;
/** A skeleton on show; `held` settles (and `done` turns true) once it has shown for SKELETON_FOR. */
export type SkeletonHold = { done: boolean; held: Promise<void> };
const holds = new Map<string, SkeletonHold>();
const wait = (ms: number) => new Promise<void>(resolve => { setTimeout(resolve, ms); });

export const skeletonHold = (key: string): SkeletonHold | undefined => holds.get(key);
export const endSkeletonHold = (key: string): void => { holds.delete(key); };

/** What a tap's suspended first render throws: the load, or the 300 ms mark, where the hold starts if the load is still pending. */
export function skeletonDelay(key: string, pending: Promise<unknown>): Promise<unknown> {
  let settled = false;
  const load = pending.then(() => { settled = true; }, () => { settled = true; });
  return Promise.race([load, wait(SKELETON_AFTER).then(() => {
    if (settled || holds.has(key)) return;
    const hold: SkeletonHold = { done: false, held: wait(SKELETON_FOR).then(() => { hold.done = true; }) };
    holds.set(key, hold);
  })]);
}

/** Tests only: start from an empty cache and no skeleton holds (and, optionally, a shorter pause before the quiet retry). */
export function resetDetailRecords(options: { retryMs?: number } = {}): void {
  buckets.clear();
  holds.clear();
  retryMs = options.retryMs ?? 1000;
}
