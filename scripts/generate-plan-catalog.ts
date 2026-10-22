import { mkdir, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { PLANNER_EVENTS, PLANNER_PLACES } from '../src/data/planner-catalog';
import { ATTRACTION_REGIONS } from '../src/data/attractions';
import { currentFreebies } from '../src/data/october-offers';
import { getGuideBySlug } from '../src/data/guides';
import { getGuideMedia, GUIDE_IMAGES, type GuideImage } from '../src/data/guide-media';
import { SCENE3D_POSTCARD_FOR } from '../src/data/scene3d-postcards';
import { stopCoverItem } from '../src/lib/plan-stop-cover';
import { getCover } from '../src/lib/cover';
import { coverCandidates } from '../src/lib/cover-candidates';
import { getBayAreaToday } from '../src/lib/monthly';
import type { Stop } from '../src/lib/planner-core';
import type { PlanCatalog, PlanExtras } from '../src/lib/planner-source';

/**
 * 行程's catalog (WEB-PLAN-DATA): /plan loads these files after its first paint instead of importing the planner catalog's
 * sources (every event record, every guide, the whole image registry, the offers), and lib/planner-source.ts installs them.
 * Everything here is what the page read from those modules, computed by the same code: plan-catalog.json holds the
 * planner's events and places (data/planner-catalog.ts; skipped when a page already loaded the full catalog), and
 * plan-extras.json the image record behind every cover key a planner stop can ask for, the live offers linked to a planner
 * place and the region list. tests/plan-catalog-split.test.ts keeps the files equal to this build.
 */
export const PLAN_CATALOG_FILE = 'src/data/generated/plan-catalog.json';
export const PLAN_EXTRAS_FILE = 'src/data/generated/plan-extras.json';

/** The image a stop cover key names in the full registries (what plan-stop-cover.ts read before WEB-PLAN-DATA). */
export function fullStopCoverImage(key: string): GuideImage | undefined {
  const guideCover = 'guide-cover:';
  if (key.startsWith(guideCover)) {
    const guide = getGuideBySlug(key.slice(guideCover.length));
    return guide ? getGuideMedia(guide).cover : undefined;
  }
  return Object.hasOwn(GUIDE_IMAGES, key) ? GUIDE_IMAGES[key] : undefined;
}

export function buildPlanCatalog(): PlanCatalog & PlanExtras {
  const stops: Stop[] = [...PLANNER_EVENTS.map(event => ({ kind: 'event' as const, id: event.id })), ...PLANNER_PLACES.map(place => ({ kind: 'place' as const, id: place.id }))];
  const keys = new Set<string>(Object.values(SCENE3D_POSTCARD_FOR));
  for (const stop of stops) {
    const item = stopCoverItem(stop);
    if (item.imageKey) keys.add(item.imageKey);
    if (item.postcardKey) keys.add(item.postcardKey);
  }
  // UI9-IMG-A1b: an event whose own image cannot be its cover (or is ④ AI) carries its candidates in the owner's order, and
  // their pictures ship with the extras, so its stop shows a picture, never an information card.
  const today = getBayAreaToday();
  const coverKeys: Record<string, string[]> = {};
  for (const event of PLANNER_EVENTS) {
    const own = getCover({ kind: 'event', id: event.id, imageKey: event.imageKey }, { images: GUIDE_IMAGES, today }).tier;
    if (own !== 'type' && own !== 'ai') continue;
    const candidates = coverCandidates('event', event).filter(key => Object.hasOwn(GUIDE_IMAGES, key)
      && getCover({ kind: 'event', id: event.id, imageKey: key }, { images: GUIDE_IMAGES, today }).tier !== 'type');
    if (!candidates.length) continue;
    coverKeys[event.id] = candidates;
    candidates.forEach(key => keys.add(key));
  }
  const images: Record<string, GuideImage> = {};
  for (const key of [...keys].sort()) {
    const image = fullStopCoverImage(key);
    if (image) images[key] = image;
  }
  const linked = new Set(PLANNER_PLACES.flatMap(place => place.offerIds || []));
  return {
    events: PLANNER_EVENTS,
    places: PLANNER_PLACES,
    images,
    offers: currentFreebies.filter(offer => linked.has(offer.id)),
    regions: ATTRACTION_REGIONS.map(({ id, label }) => ({ id, label })),
    coverKeys,
  };
}

export async function writePlanCatalog(catalog: PlanCatalog & PlanExtras = buildPlanCatalog()): Promise<void> {
  await mkdir('src/data/generated', { recursive: true });
  const { events, places, images, offers, regions, coverKeys } = catalog;
  const main = JSON.stringify({ events, places } satisfies PlanCatalog), extras = JSON.stringify({ images, offers, regions, coverKeys } satisfies PlanExtras);
  await writeFile(PLAN_CATALOG_FILE, main);
  await writeFile(PLAN_EXTRAS_FILE, extras);
  const kib = (json: string) => (gzipSync(json).length / 1024).toFixed(1);
  console.log(`Plan catalog: ${events.length} events, ${places.length} places (${kib(main)} KiB gzip); extras: ${Object.keys(images).length} cover images, ${offers.length} offers (${kib(extras)} KiB gzip).`);
}
