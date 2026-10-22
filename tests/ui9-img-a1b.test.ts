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
