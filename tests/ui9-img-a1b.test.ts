import assert from 'node:assert/strict';
import test from 'node:test';
import { localDiscoveries } from '../src/data/local-discoveries';
import { buildDetailRecord } from '../src/features/detail/build-detail';
import { heroCover, railCovers } from '../src/features/detail/hero-cover';
import { createCoverPage } from '../src/lib/cover';
import { getBayAreaToday } from '../src/lib/monthly';

// UI9-IMG-A1b (UI9-IMAGES DECISIONS 21/22): a detail page's hero and its rail cards are pictures — the listing's own, else its
// next candidate the build chose (② venue → ③ stock → ④ approved AI) — never an information card.
test('every detail hero and rail card is a picture (0 information cards)', () => {
  const today = getBayAreaToday();
  const typed: string[] = [];
  // Live listings (an event that has not ended; every offer and opening the site lists), as report:covers' inventory.
  for (const item of localDiscoveries.filter(row => row.kind !== 'event' || row.event.endDate >= today)) {
    const record = buildDetailRecord(item);
    const id = item.kind === 'event' ? item.event.id : item.kind === 'offer' ? item.offer.id : item.shop.id;
    if (heroCover(record, today).tier === 'type') typed.push(`${item.kind}:${id} hero`);
    const page = createCoverPage();
    const rail = record.rail.filter(event => event.endDate >= today);
    railCovers(rail.map(event => ({ event, date: event.startDate })), today, page)
      .forEach((cover, index) => { if (cover.tier === 'type') typed.push(`${item.kind}:${id} rail ${rail[index].id}`); });
  }
  assert.deepEqual(typed, []);
});

// /plan (UI9-IMG-A1b): every live event stop resolves to a picture with the plan extras' candidates and images.
test('every live /plan event stop is a picture (plan extras coverKeys)', async () => {
  const { buildPlanCatalog } = await import('../scripts/generate-plan-catalog');
  const { getCover } = await import('../src/lib/cover');
  const catalog = buildPlanCatalog();
  const today = getBayAreaToday();
  const typed = catalog.events.filter(event => event.endDate >= today).filter(event => getCover(
    { kind: 'event', id: event.id, imageKey: event.imageKey, ...(catalog.coverKeys?.[event.id] ? { imageKeys: catalog.coverKeys[event.id] } : {}) },
    { images: key => catalog.images[key], today }).tier === 'type').map(event => event.id);
  assert.deepEqual(typed, []);
  // Places: a place with no picture and no postcard shows a ③ picture of its kind; a landmark without either is listed here.
  const { installPlanExtras } = await import('../src/lib/planner-source');
  const { stopCoverItem } = await import('../src/lib/plan-stop-cover');
  installPlanExtras(catalog);
  const places = catalog.places.filter(place => getCover(stopCoverItem({ kind: 'place', id: place.id }), { images: key => catalog.images[key], today }).tier === 'type').map(place => place.id);
  assert.deepEqual(places, [], 'every planner place shows a picture');
});
