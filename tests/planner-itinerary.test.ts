import assert from 'node:assert/strict';
import test from 'node:test';
import { PLANNER_PLACES } from '../src/data/planner-catalog';
import { cleanStops, parseSharedPlan, sharePlanUrl, type PlanDetails, type PlannerPlace, type Stop } from '../src/lib/planner';
import { buildItinerary, defaultPlanDetails, itineraryIcs, nearbyPlaces, normalizePlanDetails, planBudget, placeMatchesFilters } from '../src/lib/planner-itinerary';

const stops: Stop[] = PLANNER_PLACES.slice(0, 6).map(place => ({ kind: 'place', id: place.id }));
test('six public stops survive save normalization and share while private settings never enter URLs', () => {
  const input = [...stops, stops[0], { kind: 'place', id: 'private-event' }];
  assert.deepEqual(cleanStops(input), stops);
  const plan = { date: '2026-10-03', stops, details: { ...defaultPlanDetails(), totalBudgetUsd: 200 }, title: 'Private group' };
  const url = new URL(sharePlanUrl(plan));
  assert.deepEqual(parseSharedPlan(url.search).stops, stops);
  assert.deepEqual([...url.searchParams.keys()].sort(), ['date', 'stops']);
  assert.ok(!url.href.includes('200') && !url.href.includes('Private'));
});
test('timeline accounts for user travel buffers, waiting and a missed confirmed session', () => {
  const details: PlanDetails = { ...defaultPlanDetails(), startTime: '10:00', finishBy: '14:00', stopSettings: [
    { ...stops[0], durationMinutes: 60, travelMinutes: 20, fixedStartTime: '11:00' },
    { ...stops[1], durationMinutes: 90, travelMinutes: 30, fixedStartTime: '12:00' },
  ] };
  const result = buildItinerary(stops.slice(0, 2), details, '2026-10-03');
  assert.deepEqual(result.rows.map(row => [row.arrival, row.start, row.end, row.wait, row.late]), [[620, 660, 720, 40, false], [750, 750, 840, 0, true]]);
  assert.equal(result.issues.length, 1);
  assert.match(result.issues[0], /晚于.*12:00/);
  const short = buildItinerary(stops.slice(0, 2), { ...details, finishBy: '13:00' }, '2026-10-03');
  assert.match(short.issues.join(' '), /超过结束时间 60 分钟/);
});
test('unknown admissions never become free or a complete estimated total', () => {
  const known = PLANNER_PLACES.find(place => place.planning?.admissionUsd === 0)!;
  const unknown = PLANNER_PLACES.find(place => place.planning?.admissionUsd == null)!;
  assert.ok(known && unknown);
  const pair: Stop[] = [{ kind: 'place', id: known.id }, { kind: 'place', id: unknown.id }];
  const budget = planBudget(pair, { ...defaultPlanDetails(), partySize: 4, extraCostUsd: 80, totalBudgetUsd: 50 });
  assert.equal(budget.subtotal, 80);
  assert.deepEqual(budget.unknown, [pair[1]]);
  assert.equal(budget.overBy, 30);
  assert.equal(placeMatchesFilters(unknown, { freeOnly: true }), false);
  assert.equal(placeMatchesFilters(unknown, { budget: 10 }), false);
  const paid: PlannerPlace = { ...known, planning: { admissionUsd: 15, minAge: 8 } };
  assert.equal(placeMatchesFilters(paid, { budget: 40, budgetScope: 'total', partySize: 4 }), false);
  assert.equal(placeMatchesFilters(paid, { childAges: [12, 5] }), false);
});
test('nearby requires venue coordinates and same city rather than suggesting a ferry crossing', () => {
  const point = { lat: 37.8, lng: -122.4, label: 'Test venue', sourceUrl: 'https://example.com', precision: 'venue' as const };
  const base = { ...PLANNER_PLACES[0], id: 'base', city: 'San Francisco', location: point };
  const same = { ...base, id: 'same', location: { ...point, lat: 37.805 } };
  const area = { ...base, id: 'island-landing', location: { ...point, precision: 'area' as const } };
  const otherCity = { ...same, id: 'cross-city', city: 'Alameda' };
  assert.deepEqual(nearbyPlaces(base, [base, same, area, otherCity], { travelMode: 'walk' }).map(item => item.place.id), ['same']);
  assert.deepEqual(nearbyPlaces(area, [base, same], {}), []);
});
test('calendar export uses Pacific time, escapes text and rejects conflicts and invalid dates', () => {
  const details = defaultPlanDetails();
  const ics = itineraryIcs('My, trip\nBEGIN:VEVENT', '2026-10-03', stops.slice(0, 1), details, new Date('2026-09-29T12:00:00Z'));
  assert.match(ics, /DTSTART;TZID=America\/Los_Angeles:20261003T100000/);
  assert.match(ics, /DTEND;TZID=America\/Los_Angeles:20261003T113000/);
  assert.match(ics, /STATUS:TENTATIVE/);
  assert.match(ics.replace(/\r\n /g, ''), /My\\, trip\\nBEGIN:VEVENT/);
  assert.equal(ics.split('\r\nBEGIN:VEVENT\r\n').length, 2);
  assert.ok(ics.split('\r\n').every(line => Buffer.byteLength(line, 'utf8') <= 75));
  assert.throws(() => itineraryIcs('x', '2026-02-30', stops, details));
  assert.throws(() => itineraryIcs('x', '2026-10-03', stops, { ...details, finishBy: '10:30' }));
});

test('invalid numeric estimates block timeline export instead of producing reversed or malformed calendar times', () => {
  const selected = stops.slice(0, 1);
  for (const patch of [
    ...[0, -5, 5.5, 721, NaN, Infinity].map(durationMinutes => ({ durationMinutes })),
    ...[-1, 2.5, 361, NaN, Infinity].map(travelMinutes => ({ travelMinutes })),
  ]) {
    const details: PlanDetails = { ...defaultPlanDetails(), stopSettings: [{ ...selected[0], durationMinutes: 30, travelMinutes: 0, ...patch }] };
    assert.ok(buildItinerary(selected, details, '2026-10-03').issues.length, `must flag ${String(Object.values(patch)[0])}`);
    assert.throws(() => itineraryIcs('Invalid estimate', '2026-10-03', selected, details), /冲突|分钟|调整/);
  }
  for (const patch of [{ partySize: 0 }, { partySize: 1.5 }, { extraCostUsd: -1 }, { extraCostUsd: Infinity }, { totalBudgetUsd: NaN }]) {
    assert.throws(() => itineraryIcs('Invalid estimate', '2026-10-03', selected, { ...defaultPlanDetails(), ...patch }));
  }
});
test('old and malformed browser settings are bounded; foreign settings are dropped', () => {
  assert.deepEqual(normalizePlanDetails(undefined, stops), defaultPlanDetails());
  const result = normalizePlanDetails({ partySize: -5, extraCostUsd: Infinity, travelMode: 'teleport', stopSettings: [{ kind: 'place', id: 'private', durationMinutes: 10, travelMinutes: 0 }, { ...stops[0], durationMinutes: -10, travelMinutes: 900 }] }, stops);
  assert.equal(result.partySize, 1); assert.equal(result.extraCostUsd, 0); assert.equal(result.travelMode, 'any');
  assert.deepEqual(result.stopSettings, [{ ...stops[0], durationMinutes: 90, travelMinutes: 30 }]);
});
