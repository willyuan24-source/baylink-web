import assert from 'node:assert/strict';
import test from 'node:test';
import { currentFreebies } from '../src/data/october-offers';
import { offerMatchesDateRange } from '../src/lib/offer-calendar';
import { searchQuickDestinations } from '../src/lib/quick-search';

test('today searches enforce the published Monday, Wednesday and Sunday offer schedules', () => {
  for (const [id, brand, expectedDay, verified] of [
    ['dunkin-monday-beverage-points-oct26-2026', 'Dunkin', 1, true],
    ['smashburger-kids-wednesdays-2026', 'Smashburger', 3, true],
    ['mod-pizza-kids-sundays-2026', 'MOD PIZZA', 0, false],
  ] as const) {
    const offer = currentFreebies.find(item => item.id === id)!;
    assert.deepEqual(offer.weekdays, [expectedDay], id);
    for (let day = 5; day <= 11; day++) {
      const today = `2026-10-${String(day).padStart(2, '0')}`;
      const shouldMatch = new Date(`${today}T12:00:00Z`).getUTCDay() === expectedDay;
      const result = searchQuickDestinations(`今天 ${brand}`, 'zh-Hans', today);
      assert.equal(result.offers.some(item => item.id === id), shouldMatch && verified, `${id} on ${today}`);
      assert.equal(result.unverified.offers.some(item => item.id === id), shouldMatch && !verified, `${id} must preserve its verification status on ${today}`);
    }
    assert.ok(searchQuickDestinations(brand, 'zh-Hans', '2026-10-06').offers.some(item => item.id === id), 'a general search still explains upcoming or ongoing weekly deals');
  }
});

test('weekly offer ranges intersect actual dates and never promote out-of-range or malformed dates', () => {
  const monday = currentFreebies.find(item => item.id === 'dunkin-monday-beverage-points-oct26-2026')!;
  assert.equal(offerMatchesDateRange(monday, '2026-10-06', '2026-10-11'), false);
  assert.equal(offerMatchesDateRange(monday, '2026-10-06', '2026-10-12'), true);
  assert.equal(offerMatchesDateRange(monday, '2026-10-26', '2026-11-02'), true);
  assert.equal(offerMatchesDateRange(monday, '2026-10-27', '2026-11-02'), false);
  assert.equal(offerMatchesDateRange(monday, '2026-09-28', '2026-10-04'), false);
  assert.equal(offerMatchesDateRange(monday, '2026-10-12', '2026-10-06'), false);
  assert.equal(offerMatchesDateRange(monday, '2026-02-30', '2026-10-12'), false);
  assert.equal(offerMatchesDateRange({ ...monday, weekdays: [] }, '2026-10-05', '2026-10-26'), false);
  const once = currentFreebies.find(item => item.id === 'petsmart-tricks-treats-oct17-2026')!;
  assert.equal(offerMatchesDateRange(once, '2026-10-17', '2026-10-17'), true);
  assert.equal(offerMatchesDateRange(once, '2026-10-18', '2026-10-18'), false);
});
