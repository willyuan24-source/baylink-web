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
import { isApprovedEventContextPhoto } from '../src/data/event-image-usage';
import { filterMonthlyEvents } from '../src/lib/monthly';
import { eventsOnCalendarDay, groupCalendarMapEvents } from '../src/lib/event-calendar';
import { loadLocale, translateText } from '../src/i18n/locale';
import { searchQuickDestinations } from '../src/lib/quick-search';

const refreshEvents = [...regional, ...sfEast];
test('September refresh is discoverable once per canonical event or benefit, with complete local media and city mapping', () => {
  assert.equal(refreshEvents.length, 28);
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

test('Water Lantern is searchable as a Foster City evening event without claiming a free lantern experience', async () => {
  const id = 'foster-city-water-lantern-festival-2026';
  const event = MONTHLY_EVENTS.find(row => row.id === id)!;
  assert.ok(event);
  assert.equal(event.city, 'Foster City');
  assert.equal(event.region, 'peninsula');
  assert.equal(event.cost, 'mixed');
  assert.equal(PLANNER_EVENTS.find(row => row.id === id)?.planning?.admissionUsd, null);
  assert.equal(filterMonthlyEvents([event], { cost: 'free' }, '2026-09-29').length, 0);
  for (const date of ['2026-10-03', '2026-10-04']) assert.equal(eventsOnCalendarDay([event], date).length, 1);
  assert.equal(eventsOnCalendarDay([event], '2026-10-05').length, 0);
  assert.ok(searchQuickDestinations('Foster City 水灯 夜间', 'zh-Hans', '2026-09-29').events.some(row => row.id === id));
  assert.ok(!searchQuickDestinations('Foster City 水灯 免费', 'zh-Hans', '2026-09-29').events.some(row => row.id === id));
  await loadLocale('en');
  assert.ok(searchQuickDestinations('Foster City water lantern evening', 'en', '2026-09-29').events.some(row => row.id === id));
});

test('Foodwise Latine Makers keeps its one-day free entry, separately purchased food and disclosed venue photograph', () => {
  const id = 'sf-foodwise-latine-makers-oct3-2026';
  const event = MONTHLY_EVENTS.find(row => row.id === id)!;
  assert.ok(event);
  assert.equal(filterMonthlyEvents([event], { cost: 'free' }, '2026-09-29').length, 1);
  assert.equal(PLANNER_EVENTS.find(row => row.id === id)?.planning?.admissionUsd, 0);
  assert.match(event.costLabel, /餐饮及商品另购/);
  assert.equal(eventsOnCalendarDay([event], '2026-10-03').length, 1);
  assert.equal(eventsOnCalendarDay([event], '2026-10-04').length, 0);
  assert.ok(searchQuickDestinations('Latine Makers', 'en', '2026-09-29').events.some(row => row.id === id));
  const image = GUIDE_IMAGES[event.imageKey];
  assert.equal(image.kind, 'photo');
  assert.ok(isApprovedEventContextPhoto(event.imageKey, id));
  assert.equal(image.src, GUIDE_IMAGES['ferry-market'].src, 'uses the actual Ferry Building market setting');
  assert.equal(image.creditUrl, GUIDE_IMAGES['ferry-market'].creditUrl, 'retains the original photograph source');
  assert.match(image.caption, /2022 年 5 月资料照片/);
  assert.match(image.caption, /不是 2026 年.*Latine Makers Market/);
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
