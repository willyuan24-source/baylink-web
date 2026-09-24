import assert from 'node:assert/strict';
import test from 'node:test';
import { MONTHLY_EVENTS } from '../src/data/monthly-edition';
import { ATTRACTIONS } from '../src/data/attractions';
import { cleanStops, distanceKm, parseSharedPlan, sharePlanUrl, todayInBay, validDay, type GeoPoint, type Stop } from '../src/lib/planner';

const event: Stop = { kind: 'event', id: MONTHLY_EVENTS[0].id };
const place: Stop = { kind: 'place', id: ATTRACTIONS[0].id };

test('plan share links round trip only published references and a real date', () => {
  const raw = sharePlanUrl({ date: '2026-10-03', stops: [event, place, event] });
  const url = new URL(raw);
  assert.equal(url.origin, 'https://www.baylink.us');
  assert.equal(url.pathname, '/plan');
  assert.deepEqual([...url.searchParams.keys()].sort(), ['date', 'stops']);
  assert.deepEqual(parseSharedPlan(url.search), { date: '2026-10-03', stops: [event, place] });
  const legacy = parseSharedPlan(`?places=${encodeURIComponent(place.id)},${encodeURIComponent(place.id)},invented`);
  assert.deepEqual(legacy.stops, [place]);
});

test('malicious, unknown, repeated and oversized shared references cannot become executable routes', () => {
  const poisoned = '?date=2026-02-30&stops=javascript%3Aalert(1),event%3A..%2F..%2Fadmin,guide%3Aprivate,place%3A%3Cscript%3E,event%3Aunknown&userId=private&token=secret';
  assert.deepEqual(parseSharedPlan(poisoned), { date: '', stops: [] });
  const mixed = parseSharedPlan(`?stops=${encodeURIComponent(`event:${event.id},event:${event.id},javascript:alert(1),place:${place.id}`)}`);
  assert.deepEqual(mixed.stops, [event, place]);
  assert.deepEqual(cleanStops([null, {}, { kind: 'event', id: { $ne: '' } }, event, event, place]), [event, place]);
  const many = parseSharedPlan(`?stops=${Array(1000).fill(`event:${event.id}`).join(',')}`);
  assert.deepEqual(many.stops, [event]);
});

test('calendar validation rejects normalized impossible days and Pacific date uses its local boundary', () => {
  for (const date of ['2026-02-29', '2026-02-30', '2026-13-01', '2026-00-01', '2026-10-32', '10/3/2026', '2026-1-1', '2026-10-03T00:00:00Z', '']) assert.equal(validDay(date), false, date);
  assert.equal(validDay('2028-02-29'), true);
  assert.equal(validDay('2026-10-31'), true);
  assert.equal(todayInBay(new Date('2026-10-04T06:59:59Z')), '2026-10-03');
  assert.equal(todayInBay(new Date('2026-10-04T07:00:00Z')), '2026-10-04');
});

test('nearby distance is symmetric straight-line geography and zero at the same point', () => {
  const sf: GeoPoint = { lat: 37.7749, lng: -122.4194, label: 'SF', sourceUrl: 'https://sf.gov', precision: 'area' };
  const oakland: GeoPoint = { lat: 37.8044, lng: -122.2711, label: 'Oakland', sourceUrl: 'https://oaklandca.gov', precision: 'area' };
  assert.equal(distanceKm(sf, sf), 0);
  assert.equal(distanceKm(sf, oakland), distanceKm(oakland, sf));
  assert.ok(distanceKm(sf, oakland) > 13 && distanceKm(sf, oakland) < 14);
});
