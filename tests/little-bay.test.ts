import assert from 'node:assert/strict';
import test from 'node:test';
import { ATTRACTION_REGIONS } from '../src/data/attractions';
import { PLANNER_EVENTS, PLANNER_PLACES } from '../src/data/planner-catalog';
import { cleanLittleBayPlanStops, getLittleBayStops, getNextSaturday, pickLittleBayOuting, resolveLittleBayStop } from '../src/features/little-bay/catalog';
import { addCalendarDays, eventOccursOn } from '../src/lib/event-calendar';
import { todayInBay, validStop } from '../src/lib/planner';

test('Little Bay cards preserve region, real dates and valid planner references across the edition', () => {
  for (let date = '2026-09-23'; date <= '2026-10-31'; date = addCalendarDays(date, 1)) {
    for (const { id: region } of ATTRACTION_REGIONS) {
      const stops = getLittleBayStops({ date, region });
      const events = PLANNER_EVENTS.filter(event => (region === 'all' || event.region === region) && eventOccursOn(event, date));
      const places = PLANNER_PLACES.filter(place => region === 'all' || place.region === region);
      assert.equal(stops.length, Math.min(6, events.length + places.length), `${date}: ${region}`);
      assert.equal(new Set(stops.map(stop => stop.key)).size, stops.length);
      if (events.length && places.length) {
        assert.ok(stops.some(stop => stop.kind === 'event'));
        assert.ok(stops.some(stop => stop.kind === 'place'));
      }
      for (const item of stops) {
        assert.ok(validStop(item.stop));
        const original = item.kind === 'event' ? events.find(event => event.id === item.stop.id) : places.find(place => place.id === item.stop.id);
        assert.ok(original, `${item.key} must match ${date} and ${region}`);
        assert.equal(item.free, original.cost === 'free');
        assert.equal(item.title, original.title);
        assert.equal(item.region, original.region);
        assert.ok(item.href.startsWith(item.kind === 'event' ? '/events/' : '/guides/'));
        // Preserve precise catalog coordinates; never fabricate a venue from a city pin.
        assert.deepEqual(item.location, original.location);
        if (item.image) assert.equal(item.imageMeta?.src, item.image);
      }
    }
  }
});

test('saved selections remain resolvable independently of visible region and cost filters', () => {
  const sfPlace = resolveLittleBayStop({ kind: 'place', id: 'alcatraz' });
  assert.ok(sfPlace);
  assert.equal(sfPlace.region, 'sf');
  assert.equal(sfPlace.free, false);
  assert.equal(getLittleBayStops({ date: '2026-10-03', region: 'east-bay', freeOnly: true }).some(stop => stop.key === sfPlace.key), false);
  assert.deepEqual(resolveLittleBayStop(sfPlace.stop), sfPlace);
  assert.equal(resolveLittleBayStop({ kind: 'place', id: 'unknown' }), undefined);
});

test('free-only excludes mixed admission and never substitutes another region', () => {
  for (const { id: region } of ATTRACTION_REGIONS) {
    const stops = getLittleBayStops({ date: '2026-10-03', region, freeOnly: true });
    assert.ok(stops.every(stop => stop.free));
    for (const stop of stops) {
      const source = stop.kind === 'event' ? PLANNER_EVENTS.find(event => event.id === stop.stop.id) : PLANNER_PLACES.find(place => place.id === stop.stop.id);
      assert.equal(source?.cost, 'free');
      if (region !== 'all') assert.equal(source?.region, region);
    }
  }
  assert.deepEqual(getLittleBayStops({ date: '2026-10-03', region: 'unknown' }), []);
  assert.deepEqual(getLittleBayStops({ date: '2026-10-03', region: '' }), []);
});

test('invalid dates return no cards and dates outside the edition offer places only', () => {
  for (const date of ['', '2026-02-30', '2026-10-32', '2026-1-3', '2026-10-03T00:00:00Z']) {
    assert.deepEqual(getLittleBayStops({ date, region: 'sf' }), []);
  }
  for (const date of ['2026-01-01', '2027-01-01']) {
    const stops = getLittleBayStops({ date, region: 'sf' });
    assert.equal(stops.length, 6);
    assert.ok(stops.every(stop => stop.kind === 'place'));
  }
});

test('changing a plan day removes non-occurring events before applying the three-stop limit', () => {
  const fleet = { kind: 'event' as const, id: 'san-francisco-fleet-week-2026' };
  const places = PLANNER_PLACES.slice(0, 4).map(place => ({ kind: 'place' as const, id: place.id }));
  assert.deepEqual(cleanLittleBayPlanStops([fleet], '2026-10-04'), []);
  assert.deepEqual(cleanLittleBayPlanStops([fleet], '2026-10-10'), [fleet]);
  assert.deepEqual(cleanLittleBayPlanStops([fleet], '2026-10-13'), []);
  assert.deepEqual(cleanLittleBayPlanStops([fleet, ...places], '2026-10-04'), places.slice(0, 3));
  assert.deepEqual(cleanLittleBayPlanStops([null, {}, { kind: 'place', id: 'invented' }, places[0], places[0]], '2026-10-04'), [places[0]]);
  assert.deepEqual(cleanLittleBayPlanStops(places, '2026-02-30'), []);
  assert.deepEqual(cleanLittleBayPlanStops(null, '2026-10-04'), []);
});

test('next Saturday follows Pacific calendar dates through timezone and DST boundaries', () => {
  for (const [day, expected] of [
    ['2026-09-24', '2026-09-26'], ['2026-09-26', '2026-09-26'],
    ['2026-09-27', '2026-10-03'], ['2026-12-31', '2027-01-02'],
    ['2026-03-08', '2026-03-14'], ['2026-11-01', '2026-11-07'],
  ]) assert.equal(getNextSaturday(day), expected);
  assert.equal(getNextSaturday(todayInBay(new Date('2026-09-27T06:59:59Z'))), '2026-09-26');
  assert.equal(getNextSaturday(todayInBay(new Date('2026-09-27T07:00:00Z'))), '2026-10-03');
  assert.throws(() => getNextSaturday('2026-02-30'), RangeError);
});

test('a Golden Gate outing pairs nearby free places instead of unrelated festivals', () => {
  const bridge = resolveLittleBayStop({ kind: 'place', id: 'golden-gate' })!;
  const expected = [bridge.stop, { kind: 'place', id: 'presidio' }, { kind: 'place', id: 'palace' }];
  assert.deepEqual(pickLittleBayOuting(bridge, '2026-09-26'), expected);
  assert.deepEqual(pickLittleBayOuting(bridge, '2026-09-26', true), expected);
  assert.ok(expected.every(stop => PLANNER_PLACES.some(place => place.id === stop.id && place.cost === 'free' && place.city === 'San Francisco')));
});

test('an event anchor keeps only that event, honors its date and adds free same-city places', () => {
  const portola = resolveLittleBayStop({ kind: 'event', id: 'portola-2026' })!;
  const outing = pickLittleBayOuting(portola, '2026-09-26');
  assert.deepEqual(outing[0], portola.stop);
  assert.equal(outing.length, 3);
  assert.equal(outing.filter(stop => stop.kind === 'event').length, 1);
  for (const stop of outing.slice(1)) {
    const place = PLANNER_PLACES.find(item => item.id === stop.id)!;
    assert.equal(place.city, portola.city);
    assert.equal(place.cost, 'free');
  }
  assert.deepEqual(pickLittleBayOuting(portola, '2026-09-28'), []);
  assert.deepEqual(pickLittleBayOuting(portola, '2026-09-26', true), []);
});

test('automatic outings keep a lone local anchor rather than adding places from another city', () => {
  const filoli = resolveLittleBayStop({ kind: 'place', id: 'filoli' })!;
  assert.deepEqual(pickLittleBayOuting(filoli, '2026-10-03'), [filoli.stop]);
  assert.deepEqual(pickLittleBayOuting(filoli, '2026-10-03', true), []);
  assert.deepEqual(pickLittleBayOuting(filoli, ''), []);
  const lake = resolveLittleBayStop({ kind: 'place', id: 'lake-merritt' })!;
  assert.deepEqual(pickLittleBayOuting(lake, '2026-10-03'), [lake.stop, { kind: 'place', id: 'redwood' }]);
});
