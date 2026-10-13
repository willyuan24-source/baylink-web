import { mkdir, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { PLANNER_EVENTS, PLANNER_PLACES } from '../src/data/planner-catalog';
import { ATTRACTION_REGIONS } from '../src/data/attractions';
import { currentFreebies } from '../src/data/october-offers';
import { getGuideBySlug } from '../src/data/guides';
import { getGuideMedia, GUIDE_IMAGES, type GuideImage } from '../src/data/guide-media';
import { SCENE3D_POSTCARD_FOR } from '../src/data/scene3d-postcards';
import { stopCoverItem } from '../src/lib/plan-stop-cover';
import type { Stop } from '../src/lib/planner-core';
import type { PlanCatalog } from '../src/lib/planner-source';

/**
 * 行程's catalog (WEB-PLAN-DATA): /plan loads this file after its first paint instead of importing the planner catalog's
 * sources (every event record, every guide, the whole image registry, the offers), and lib/planner-source.ts installs it.
 * Everything here is what the page read from those modules, computed by the same code: the planner's events and places
 * (data/planner-catalog.ts), the image record behind every cover key a planner stop can ask for, the live offers linked to
 * a planner place and the region list. tests/plan-catalog-split.test.ts keeps the file equal to this build.
 */
export const PLAN_CATALOG_FILE = 'src/data/generated/plan-catalog.json';

/** The image a stop cover key names in the full registries (what plan-stop-cover.ts read before WEB-PLAN-DATA). */
export function fullStopCoverImage(key: string): GuideImage | undefined {
  const guideCover = 'guide-cover:';
  if (key.startsWith(guideCover)) {
    const guide = getGuideBySlug(key.slice(guideCover.length));
    return guide ? getGuideMedia(guide).cover : undefined;
  }
  return Object.hasOwn(GUIDE_IMAGES, key) ? GUIDE_IMAGES[key] : undefined;
}

export function buildPlanCatalog(): PlanCatalog {
  const stops: Stop[] = [...PLANNER_EVENTS.map(event => ({ kind: 'event' as const, id: event.id })), ...PLANNER_PLACES.map(place => ({ kind: 'place' as const, id: place.id }))];
  const keys = new Set<string>(Object.values(SCENE3D_POSTCARD_FOR));
  for (const stop of stops) {
    const item = stopCoverItem(stop);
    if (item.imageKey) keys.add(item.imageKey);
    if (item.postcardKey) keys.add(item.postcardKey);
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
  };
}

export async function writePlanCatalog(catalog: PlanCatalog = buildPlanCatalog()): Promise<void> {
  await mkdir('src/data/generated', { recursive: true });
  const json = JSON.stringify(catalog);
  await writeFile(PLAN_CATALOG_FILE, json);
  console.log(`Plan catalog: ${catalog.events.length} events, ${catalog.places.length} places, ${Object.keys(catalog.images).length} cover images, ${catalog.offers.length} offers; ${(gzipSync(json).length / 1024).toFixed(1)} KiB gzip.`);
}
