import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { GUIDE_IMAGES } from '../src/data/guide-media';
import { getCover, type CoverItem } from '../src/lib/cover';
import type { EventsIndex, IndexEvent, IndexImage } from '../src/features/events/events-index-types';
import { INDEX_IMAGE_DROPPED_FIELDS, INDEX_IMAGE_FIELDS } from '../scripts/events-index-images';

// Every listed event and image record the index generator writes: the route's events-index.json, plus events-later.json
// when the index is split (WEB-PERF-2 moves far-off events and their images there), so the checks cover both files.
const route = JSON.parse(readFileSync('src/data/generated/events-index.json', 'utf8')) as EventsIndex;
const laterFile = 'src/data/generated/events-later.json';
const later = existsSync(laterFile)
  ? JSON.parse(readFileSync(laterFile, 'utf8')) as { events: IndexEvent[]; images: Record<string, IndexImage> }
  : { events: [], images: {} };
const events = [...route.events, ...later.events];
const images: Record<string, IndexImage> = { ...route.images, ...later.images };

// Image records: the index keeps only the fields listings read (scripts/events-index-images.ts) and cuts a structured
// rights record to its basis, so each new image costs /events and /calendar as little as possible. A registry field in
// neither list fails here before it can reach those chunks. Covers must resolve exactly as with the full registry.
test('index images carry only the fields listings read and resolve every listing cover exactly like the full registry', () => {
  assert.ok(Object.keys(images).length > 50, `${Object.keys(images).length} index images`);
  for (const [key, image] of Object.entries(images)) {
    for (const field of Object.keys(image)) assert.ok(INDEX_IMAGE_FIELDS.includes(field), `${key}: ${field} is not a field listings read (scripts/events-index-images.ts)`);
    if (typeof image.rights === 'object' && image.rights) assert.deepEqual(Object.keys(image.rights).filter(field => field !== 'basis' && field !== 'promoAllowed'), [], `${key}: rights keeps its basis`);
    const full = GUIDE_IMAGES[key] as Record<string, unknown>;
    for (const field of INDEX_IMAGE_FIELDS) if (field !== 'rights') assert.deepEqual((image as Record<string, unknown>)[field], full[field], `${key}: ${field}`);
    for (const field of Object.keys(full)) assert.ok(INDEX_IMAGE_FIELDS.includes(field) || INDEX_IMAGE_DROPPED_FIELDS.includes(field), `${key}: registry field ${field} is in neither INDEX_IMAGE_FIELDS nor INDEX_IMAGE_DROPPED_FIELDS`);
  }
  const items: CoverItem[] = [
    ...events.map(event => ({ kind: 'event' as const, id: event.id, imageKey: event.imageKey })),
    ...route.offers.map(offer => ({ kind: 'offer' as const, id: offer.id, imageKey: offer.imageKey })),
    ...route.openings.map(shop => ({ kind: 'opening' as const, id: shop.id, imageKey: shop.imageKey })),
  ];
  // A TypeCover is a TypeCover: AI illustrations are left out of the index on purpose (reason missing-image, not ai-illustration).
  const summary = (cover: ReturnType<typeof getCover>) => cover.tier === 'type' ? { tier: cover.tier } : { tier: cover.tier, key: cover.key, label: cover.label, fit: cover.fit, focal: cover.focal, year: cover.year };
  for (const today of ['2026-10-14', '2026-11-20']) for (const item of items) {
    assert.deepEqual(summary(getCover(item, { images, today })), summary(getCover(item, { images: GUIDE_IMAGES, today })), `${item.kind} ${item.id}`);
  }
});
