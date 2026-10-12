import { guideLoaders } from '../../data/generated/guide-loaders';
import { chunkLoader } from '../../lib/chunk-recovery';
import type { GuideRecord } from './guide-records';
import { guideBlocksReady, preloadGuideBlocks } from './guide-blocks';

/**
 * One guide's record for /guides/:slug (WEB-DATA-SPLIT): a chunk of its own per guide, generated at build time
 * (scripts/generate-guide-data.ts). The boot loader (route-loaders.ts) and in-app navigation load it before the page renders;
 * the page reads it synchronously with `peekGuide`. The record also names the heavy block renderers the article needs
 * (deals board, city directories …), which load with it.
 *
 * Node (tests, prerender, scripts) reads a record synchronously from the generated JSON, as the language module does with
 * its search dictionaries, so a guide renders in one pass there; BAYLINK_LAZY_GUIDES=1 makes Node take the browser's path.
 */
const records = new Map<string, GuideRecord>();
const pending = new Map<string, Promise<GuideRecord | undefined>>();

type NodeProcess = { env?: Record<string, string | undefined>; getBuiltinModule?: (id: string) => unknown };
const nodeProcess = (globalThis as { process?: NodeProcess }).process;
let readNode: ((slug: string) => GuideRecord) | undefined;
if (nodeProcess?.getBuiltinModule && nodeProcess.env?.BAYLINK_LAZY_GUIDES !== '1') {
  const { createRequire } = nodeProcess.getBuiltinModule('node:module') as { createRequire: (from: string) => (id: string) => unknown };
  const require = createRequire(import.meta.url);
  readNode = slug => require(`../../data/generated/guides/${slug}.json`) as GuideRecord;
}

/** Whether a published guide has this slug (no download). */
export const isGuideSlug = (slug: string): boolean => Object.hasOwn(guideLoaders, slug);

/** The record when it is loaded (always, in Node); undefined while it loads or for an unknown slug. */
export function peekGuide(slug: string): GuideRecord | undefined {
  const loaded = records.get(slug);
  if (loaded || !readNode || !isGuideSlug(slug)) return loaded;
  const record = readNode(slug);
  records.set(slug, record);
  return record;
}

/** Whether the record and the article's block renderers are in, so the page renders in one pass. */
export function isGuideReady(slug: string): boolean {
  const record = peekGuide(slug);
  return !!record && guideBlocksReady(record.guide);
}

/**
 * Load a guide's record and the block renderers its article uses; resolves undefined for an unknown slug (the page shows
 * its not-found state). A failed download rejects and is retried by the next call.
 */
export function loadGuide(slug: string): Promise<GuideRecord | undefined> {
  if (!isGuideSlug(slug)) return Promise.resolve(undefined);
  const known = peekGuide(slug);
  if (known && guideBlocksReady(known.guide)) return Promise.resolve(known);
  let promise = pending.get(slug);
  if (!promise) {
    // chunkLoader: one retry (a deploy swapping files, a brief network drop), then the failure is marked for the beacon.
    promise = (known ? Promise.resolve(known) : chunkLoader(guideLoaders[slug], module => module.default as GuideRecord)())
      .then(async record => {
        await preloadGuideBlocks(record.guide);
        records.set(slug, record);
        return record;
      })
      .finally(() => { pending.delete(slug); });
    pending.set(slug, promise);
  }
  return promise;
}

const failures = new Set<string>();

/**
 * The page's read: the record when the guide is ready; while it loads, the thrown promise suspends the route (the layout's
 * Suspense keeps the prerendered article on screen at boot, else its spinner). A failed load (offline, a lost chunk) is
 * returned as `failed` with a retry, never thrown again in a loop.
 */
export function readGuide(slug: string | undefined): { record?: GuideRecord; missing?: true; failed?: true } {
  if (!slug || !isGuideSlug(slug)) return { missing: true };
  if (isGuideReady(slug)) return { record: peekGuide(slug) };
  if (failures.has(slug)) return { failed: true };
  throw loadGuide(slug).then(() => undefined, () => { failures.add(slug); });
}

/** Forget a failed load so the next read tries again. */
export const retryGuide = (slug: string): void => { failures.delete(slug); };
