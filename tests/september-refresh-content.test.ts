import assert from 'node:assert/strict';
import test from 'node:test';
import regional from '../src/data/september-refresh-regional-events.json';
import sfEast from '../src/data/september-refresh-sf-east-events.json';
import offers from '../src/data/september-refresh-offers.json';
import media from '../src/data/september-refresh-media.json';
import { MONTHLY_EVENTS } from '../src/data/monthly-edition';
import { currentFreebies } from '../src/data/october-offers';
import { PLANNER_EVENTS } from '../src/data/planner-catalog';
import { GUIDE_IMAGES } from '../src/data/guide-media';
import { filterMonthlyEvents } from '../src/lib/monthly';
import { eventsOnCalendarDay, groupCalendarMapEvents } from '../src/lib/event-calendar';
import { loadLocale, translateText } from '../src/i18n/locale';

const refreshEvents = [...regional, ...sfEast];
test('September refresh is discoverable once per canonical event or benefit, with complete local media and city mapping', () => {
  assert.equal(refreshEvents.length, 26);
  assert.equal(offers.length, 9);
  for (const row of refreshEvents) {
    assert.equal(MONTHLY_EVENTS.filter(event => event.id === row.id).length, 1, row.id);
    assert.ok(GUIDE_IMAGES[row.imageKey], row.imageKey);
  }
  for (const row of offers) {
    assert.equal(currentFreebies.filter(offer => offer.id === row.id).length, 1, row.id);
    assert.ok(GUIDE_IMAGES[row.imageKey], row.imageKey);
  }
  const selected = PLANNER_EVENTS.filter(event => refreshEvents.some(row => row.id === event.id));
  assert.deepEqual(groupCalendarMapEvents(selected).unmapped.map(event => event.id), []);
});

test('unknown entry costs and student-only admission do not appear as universally free', () => {
  const unknown = sfEast.filter(event => event.cost === 'unknown');
  assert.equal(unknown.length, 5);
  const freeIds = new Set(filterMonthlyEvents(MONTHLY_EVENTS, { cost: 'free' }, '2026-09-29').map(event => event.id));
  for (const event of unknown) {
    assert.ok(!freeIds.has(event.id), event.id);
    assert.equal(PLANNER_EVENTS.find(row => row.id === event.id)?.planning?.admissionUsd, null);
  }
  assert.ok(!freeIds.has('stanford-halloween-concert-2026'));
  assert.ok(!freeIds.has('santa-rosa-big-book-sale-discount-days-2026'));
  assert.equal(currentFreebies.find(offer => offer.id === 'ikes-love-welcome-sandwich')?.kind, 'purchase');
  assert.equal(currentFreebies.find(offer => offer.id === 'noahs-rewards-order-ahead-coffee')?.kind, 'purchase');
  assert.ok(offers.every(offer => offer.availability === 'ongoing' && !('endDate' in offer) && !('startDate' in offer)));
});

test('multi-day promotions appear only on confirmed days and expire after the last occurrence', () => {
  const sonoma = MONTHLY_EVENTS.find(event => event.id === 'sonoma-valley-book-sale-free-child-book-2026')!;
  assert.equal(eventsOnCalendarDay([sonoma], '2026-10-03').length, 1);
  assert.equal(eventsOnCalendarDay([sonoma], '2026-10-04').length, 1);
  assert.equal(eventsOnCalendarDay([sonoma], '2026-10-05').length, 0);
  const sale = MONTHLY_EVENTS.find(event => event.id === 'santa-rosa-big-book-sale-discount-days-2026')!;
  assert.equal(eventsOnCalendarDay([sale], '2026-10-03').length, 0);
  assert.equal(eventsOnCalendarDay([sale], '2026-10-05').length, 1);
  assert.deepEqual(filterMonthlyEvents([sonoma, sale], {}, '2026-10-06'), []);
});

test('new conditions and illustration disclosures stay readable in English', async () => {
  await loadLocale('en');
  const visit = (value: unknown) => {
    if (typeof value === 'string' && /[\u3400-\u9fff]/.test(value)) {
      assert.doesNotMatch(translateText(value, 'en'), /[\u3400-\u9fff]/, value);
    } else if (value && typeof value === 'object') Object.values(value).forEach(visit);
  };
  [refreshEvents, offers, media].forEach(visit);
});
