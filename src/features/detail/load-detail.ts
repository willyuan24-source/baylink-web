import { detailLoaders } from '../../data/generated/detail-loaders';
import { detailBucket } from '../../lib/english-loading';
import { settleChunk } from '../../lib/chunk-recovery';
import { canonicalEventId } from '../../lib/event-id';
import { detailKey, recordFromBucket, type DetailBucket, type DetailRecord } from './detail-record';

export type DetailKind = 'event' | 'offer' | 'opening';

/**
 * The detail route's data (ENGSEC-01): the generated bucket its URL hashes to, loaded once per bucket and kept for the
 * visit. `readDetailRecord` follows React's Suspense contract: it throws the pending load, so the layout keeps the
 * prerendered page on screen at boot (app/boot-main.ts) and a client-side visit keeps the previous page until the data is in.
 */
type BucketState = { promise: Promise<void>; bucket?: DetailBucket; error?: unknown };
const buckets = new Map<string, BucketState>();

const bucketKey = (kind: DetailKind, id: string) => detailBucket(kind, id);
const lookupId = (kind: DetailKind, id: string) => kind === 'event' ? canonicalEventId(id) : id;

function loadBucket(name: string): BucketState | undefined {
  const existing = buckets.get(name);
  if (existing) return existing;
  const loader = Object.hasOwn(detailLoaders, name) ? detailLoaders[name] : undefined;
  if (!loader) return undefined;
  const state: BucketState = {
    promise: loader().then(settleChunk).then(module => { state.bucket = (module as { default: DetailBucket }).default; },
      error => { state.error = error; }),
  };
  buckets.set(name, state);
  return state;
}

/** Start loading a detail's bucket (the page module calls it for the URL it boots on, before React renders). */
export function preloadDetailRecord(kind: DetailKind, id: string): void {
  loadBucket(bucketKey(kind, id));
}

/**
 * The record for a detail URL: the record, null for an unknown id (the page renders 404), or a thrown promise while its
 * bucket loads. A failed load throws its error once (DetailLoadError offers 重试, which calls `retryDetailRecord`).
 */
export function readDetailRecord(kind: DetailKind, id: string): DetailRecord | null {
  // An old event id lives in the bucket of its own URL (generate-detail-records.ts writes aliases there too).
  const state = loadBucket(bucketKey(kind, id));
  if (!state) return null;
  if (state.error) throw state.error;
  if (!state.bucket) throw state.promise;
  return recordFromBucket(state.bucket, detailKey(kind, id)) ?? recordFromBucket(state.bucket, detailKey(kind, lookupId(kind, id))) ?? null;
}

/** Forget a failed load so the next read tries again. */
export function retryDetailRecord(kind: DetailKind, id: string): void {
  const name = bucketKey(kind, id);
  if (buckets.get(name)?.error) buckets.delete(name);
}

/** Tests only: start from an empty cache. */
export function resetDetailRecords(): void {
  buckets.clear();
}
