import assert from 'node:assert/strict';
import test from 'node:test';
import { MONTHLY_EVENTS } from '../src/data/monthly-edition';
import { currentFreebies } from '../src/data/october-offers';
import { currentOpenings } from '../src/data/local-discoveries';
import { PLANNER_EVENTS } from '../src/data/planner-catalog';
import { filterMonthlyEvents } from '../src/lib/monthly';
import { eventsOnCalendarDay } from '../src/lib/event-calendar';

test('unconfirmed leads, ended one-day popups and undated programs do not become bookable events', () => {
  for (const id of ['newark-fear-overload-2026', 'mountain-view-theatreworks-dracula-2026', 'sf-conservatory-photosynthesis-current', 'r2-napa-costume-exchange-2026']) {
    assert.ok(!MONTHLY_EVENTS.some(event => event.id === id), id);
  }
  for (const id of ['salt-straw-larkspur-coming', 'berkeley-kash-cafe-pop-up-2026']) assert.ok(!currentOpenings.some(shop => shop.id === id), id);
  const history = MONTHLY_EVENTS.find(event => event.id === 'san-jose-cdm-mid-autumn-2026')!;
  assert.deepEqual(history.occurrenceDates, []);
  assert.deepEqual(filterMonthlyEvents([history], {}, '2026-09-01'), []);
  assert.deepEqual(eventsOnCalendarDay([history], '2026-09-26'), []);
});

test('canonical links and truthful opening status survive the research merge', () => {
  for (const [id, alias] of [['peets-coffee-day-sep29', 'palo-alto-peets-coffee-day-2026'], ['sfmoma-family-oct25', 'sf-sfmoma-free-family-day-oct25-2026']]) {
    assert.equal(currentFreebies.filter(offer => offer.id === id).length, 1);
    assert.ok(!currentFreebies.some(offer => offer.id === alias));
  }
  for (const id of ['kaiyo-handroll-union', 'hijau-san-jose-storefront']) assert.equal(currentOpenings.find(shop => shop.id === id)?.openedOn, undefined, 'a celebration is not the first service date');
  assert.equal(currentOpenings.find(shop => shop.id === 'game-parlour-oakland')?.status, 'soft_open');
  assert.ok(currentOpenings.filter(shop => shop.status === 'announced').every(shop => !shop.openedOn));
});

test('open-ended ticket releases and walk-in benefits do not promise permanent access or appointments', () => {
  for (const id of ['sf-opera-dolby-figaro-offer-2026', 'berkeley-cal-golden-bear-oct-sale-2026']) {
    const offer = currentFreebies.find(offer => offer.id === id)!;
    assert.equal(offer.availability, 'check-local');
    assert.equal(offer.endDate, undefined);
  }
  assert.equal(currentFreebies.find(offer => offer.id === 'newark-free-shredding-2026')?.kind, 'no-purchase');
  assert.ok(currentFreebies.filter(offer => offer.availability === 'ongoing').every(offer => !offer.endDate), 'an announced policy start does not invent an expiry date');
});

test('adult-only source rules and unknown admission reach the planner catalog', () => {
  for (const [id, age] of [['sf-exploratorium-after-dark-01-oct2026', 18], ['r2-vallejo-wonder-after-dark-2026', 18], ['tiburon-wine-festival-2026', 21], ['napa-harvest-after-dark-2026', 21], ['vacaville-boo-bash-20261030', 21]] as const) {
    assert.equal(PLANNER_EVENTS.find(event => event.id === id)?.planning?.minAge, age, id);
  }
  assert.equal(PLANNER_EVENTS.find(event => event.id === 'fremont-trick-or-treat-2026')?.planning?.maxAge, 10);
  const unknown = PLANNER_EVENTS.filter(event => event.cost === 'unknown');
  assert.ok(unknown.length > 0);
  assert.ok(unknown.every(event => event.planning?.admissionUsd === null));
});
