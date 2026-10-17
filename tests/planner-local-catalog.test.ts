import test from 'node:test';
import assert from 'node:assert/strict';
import { PLANNER_EVENTS, PLANNER_PLACES } from '../src/data/planner-catalog';
import { currentOpenings } from '../src/data/local-discoveries';
import { currentFreebies } from '../src/data/october-offers';
import { VERIFIED_EVENT_SCHEDULES, VERIFIED_PLACE_SCHEDULES } from '../src/data/planner-verified-hours';
import { distanceKm, parseSharedPlan, placeFor, stopPath } from '../src/lib/planner';

test('opening stops retain status and detail links without promoting an announcement', () => {
  for (const opening of currentOpenings) {
    const place = placeFor(`opening-${opening.id}`);
    if (opening.status === 'announced') { assert.equal(place, undefined); continue; }
    assert.ok(place, opening.id);
    assert.equal(place.openingStatus, opening.status);
    assert.equal(place.openedOn, opening.openedOn);
    assert.equal(stopPath({ kind: 'place', id: place.id }), `/openings/${opening.id}`);
    assert.deepEqual(parseSharedPlan(`?stops=place:${place.id}`).stops, [{ kind: 'place', id: place.id }]);
  }
  assert.equal(new Set(PLANNER_PLACES.map(place => place.id)).size, PLANNER_PLACES.length);
});

test('dining and retail purchases never become a fabricated zero-dollar outing', () => {
  for (const place of PLANNER_PLACES.filter(place => place.category && place.category !== 'attraction')) {
    assert.equal(place.cost, 'unknown', place.id);
    assert.equal(place.planning?.admissionUsd, null, place.id);
    assert.ok(place.path?.startsWith('/openings/') || place.path?.startsWith('https://'), place.id);
    for (const offerId of place.offerIds || []) assert.ok(currentFreebies.some(offer => offer.id === offerId), offerId);
  }
  assert.deepEqual(placeFor('restaurant-eureka-cupertino')?.offerIds, ['cupertino-eureka-wednesday-burger-ongoing']);
  assert.deepEqual(placeFor('restaurant-pacific-catch-mountain-view')?.offerIds, ['mountain-view-pacific-catch-aloha-hour-ongoing']);
  assert.deepEqual(placeFor('opening-sergeant-ma')?.offerIds, []);
});

test('every time record resolves to a public catalog entry and has finite source evidence', () => {
  for (const [kind, schedules, entries] of [['event', VERIFIED_EVENT_SCHEDULES, PLANNER_EVENTS], ['place', VERIFIED_PLACE_SCHEDULES, PLANNER_PLACES]] as const) {
    for (const [id, schedule] of Object.entries(schedules)) {
      assert.ok(entries.some(entry => entry.id === id), `${kind}:${id}`);
      assert.match(schedule.sourceUrl, /^https:\/\//);
      // Sunnydale was checked against its organizer's event page on 10/2;
      // all other records still retain the original 9/29 review date.
      const verifiedAt = kind === 'event' && id === 'sf-sunnydale-pumpkin-fest-2026' ? '2026-10-02' : '2026-09-29';
      assert.equal(schedule.verifiedAt, verifiedAt, `${kind}:${id}`);
      assert.ok(schedule.validFrom && schedule.validThrough && schedule.validFrom <= schedule.validThrough);
      for (const windows of [...Object.values(schedule.weekly || {}), ...Object.values(schedule.dates || {})]) {
        for (const window of windows || []) {
          assert.match(window.open, /^(?:[01]\d|2[0-3]):[0-5]\d$/);
          assert.match(window.close, /^(?:(?:[01]\d|2[0-3]):[0-5]\d|24:00)$/);
          assert.ok(window.open < window.close, id);
          if (window.lastEntry) assert.ok(window.open <= window.lastEntry && window.lastEntry <= window.close, id);
        }
      }
    }
  }
  assert.deepEqual(new Set(PLANNER_PLACES.filter(place => place.planning?.schedule).map(place => place.region)), new Set(['sf', 'east-bay', 'south-bay', 'peninsula', 'north-bay']));
});

test('uncertain opening hours and activity windows are not mistaken for fixed performances', () => {
  const brokenDreams = placeFor('opening-broken-dreams-oakland')?.planning?.schedule;
  assert.equal(brokenDreams?.weekly?.[1], undefined);
  assert.deepEqual(brokenDreams?.weekly?.[0], []);
  assert.equal(placeFor('opening-alameda-juxi-soft-opening-2026')?.planning?.schedule?.weekly?.[1], undefined);
  const ballet = VERIFIED_EVENT_SCHEDULES['san-jose-first-friday-ballet-2026'];
  assert.equal(PLANNER_EVENTS.find(event => event.id === 'san-jose-first-friday-ballet-2026')?.planning?.programTimeUnconfirmed, true, 'museum opening hours cannot stand in for the unannounced ballet performance time');
  assert.equal(ballet.sessions, undefined);
  assert.match(ballet.note || '', /19:25/);
  assert.deepEqual(ballet.dates?.['2026-10-02'], [{ open: '18:00', close: '21:00' }]);
  assert.equal(VERIFIED_EVENT_SCHEDULES['east-bay-billy-strings-2026'].sessions?.[0].end, undefined);
  assert.equal(placeFor('lake-merritt')?.planning?.schedule, undefined, 'OMCA hours cannot close the whole lake');
});

test('Town Fare keeps its last dine-in order separate from closing and last entry', () => {
  const schedule = placeFor('restaurant-town-fare-omca')?.planning?.schedule;
  assert.ok(schedule?.weekly);
  for (const day of [0, 3, 4, 5, 6]) {
    assert.deepEqual(schedule.weekly[day], [{ open: '11:00', close: '16:00', lastOrder: '15:15' }]);
    assert.equal(schedule.weekly[day]?.[0].lastEntry, undefined);
  }
  assert.deepEqual(schedule.weekly[1], []);
  assert.deepEqual(schedule.weekly[2], []);
});

test('three city anchors have a checked venue and nearby actual dining places', () => {
  for (const [eventId, foodId] of [
    ['ferry-plaza-farmers-market-2026-autumn', 'restaurant-gotts-ferry-building'],
    ['san-jose-first-friday-ballet-2026', 'restaurant-el-cafecito-sjma'],
    ['oakland-omca-friday-finale-2026', 'opening-oakland-delage-reopening-2026'],
  ]) {
    const event = PLANNER_EVENTS.find(event => event.id === eventId);
    const food = placeFor(foodId);
    assert.ok(event?.location && food?.location);
    assert.equal(event.location.precision, 'venue');
    assert.equal(food.location.precision, 'venue');
    assert.ok(distanceKm(event.location, food.location) < 2);
    assert.ok(event.planning?.schedule && food.planning?.schedule);
  }
});

test('individual museum hours retain public-access limits and explicit holiday exceptions', () => {
  const exploratorium = placeFor('venue-exploratorium-daytime');
  assert.equal(exploratorium?.category, 'attraction');
  assert.deepEqual(exploratorium?.planning?.schedule?.weekly?.[0], [{ open: '12:00', close: '17:00' }], 'Sunday member-only morning is not public admission');
  assert.deepEqual(exploratorium?.planning?.schedule?.weekly?.[1], []);
  assert.deepEqual(exploratorium?.planning?.schedule?.dates?.['2026-10-12'], [{ open: '10:00', close: '17:00' }]);
  assert.deepEqual(exploratorium?.planning?.schedule?.weekly?.[4], [{ open: '10:00', close: '17:00' }], '18+ After Dark is a separate ticketed event');
  for (const [id, offerId] of [['venue-exploratorium-daytime', 'exploratorium-for-all-five'], ['venue-sjma', 'sjma-free-oct2'], ['venue-omca', 'omca-free-oct4']]) {
    const venue = placeFor(id);
    assert.equal(venue?.category, 'attraction');
    assert.equal(venue?.location?.precision, 'venue');
    assert.equal(venue?.planning?.admissionUsd, null, 'individual ticket eligibility is not a universal per-person price');
    assert.ok(venue?.offerIds?.includes(offerId));
    assert.ok(currentFreebies.some(offer => offer.id === offerId));
  }
  const ferry = PLANNER_EVENTS.find(event => event.id === 'ferry-plaza-farmers-market-2026-autumn');
  assert.ok(ferry?.location && exploratorium?.location);
  assert.ok(distanceKm(ferry.location, exploratorium.location) < 2);
});
