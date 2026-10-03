import assert from 'node:assert/strict';
import test from 'node:test';
import { PLANNER_PLACES } from '../src/data/planner-catalog';
import { cleanStops, parseSharedPlan, sharePlanUrl, type PlanDetails, type PlannerPlace, type Stop } from '../src/lib/planner';
import { buildItinerary, defaultPlanDetails, factsForStop, itineraryIcs, nearbyPlaces, normalizePlanDetails, planBudget, planDetailsError, placeMatchesFilters, timeEvidence } from '../src/lib/planner-itinerary';

const stops: Stop[] = PLANNER_PLACES.slice(0, 6).map(place => ({ kind: 'place', id: place.id }));
test('a merged event keeps its saved settings, public facts and date conflicts under the original ID', () => {
  const legacy: Stop = { kind: 'event', id: 'alameda-point-antiques-october-2026' };
  const canonical: Stop = { kind: 'event', id: 'alameda-point-antiques-oct-2026' };
  const setting = { ...legacy, durationMinutes: 45, travelMinutes: 15, fixedStartTime: '11:00', breakBeforeMinutes: 10, breakLabel: 'rest' as const };
  const details = { ...defaultPlanDetails(), stopSettings: [setting] };
  assert.deepEqual(cleanStops([legacy, canonical]), [legacy]);
  assert.equal(factsForStop(legacy), factsForStop(canonical));
  assert.ok(factsForStop(legacy));
  const normalized = normalizePlanDetails(details, [legacy]);
  assert.deepEqual(normalized.stopSettings, [setting]);
  assert.deepEqual(normalizePlanDetails(details, [canonical]).stopSettings, [{ ...setting, ...canonical }]);
  const scheduled = buildItinerary([legacy], normalized, '2026-10-04', '2026-10-02');
  assert.deepEqual(scheduled.rows[0].settings, setting);
  assert.equal(scheduled.rows[0].stop.id, legacy.id);
  assert.ok(!scheduled.rows[0].conflicts.some(item => item.code === 'event-date-mismatch'));
  const wrongDay = buildItinerary([legacy], normalized, '2026-10-05', '2026-10-02');
  assert.ok(wrongDay.rows[0].conflicts.some(item => item.code === 'event-date-mismatch'));
  assert.throws(() => itineraryIcs('Old saved plan', '2026-10-05', [legacy], normalized, new Date('2026-10-02T19:00:00Z')), /冲突/);
});
test('an empty editor does not show a date conflict before the user has chosen any stops', () => {
  assert.deepEqual(buildItinerary([], defaultPlanDetails(), '').issues, []);
  assert.ok(buildItinerary(stops.slice(0, 1), defaultPlanDetails(), '').issues.some(issue => issue.includes('日期')));
});

test('Sunnydale Pumpkin Fest waits for its published noon opening and enforces the event date and closing time', () => {
  const stop: Stop = { kind: 'event', id: 'sf-sunnydale-pumpkin-fest-2026' };
  const details: PlanDetails = { ...defaultPlanDetails(), partySize: 2, travelMode: 'transit' };
  const asOf = '2026-10-02';
  const early = buildItinerary([stop], details, '2026-10-17', asOf).rows[0];
  assert.equal(early.evidence.status, 'confirmed');
  assert.equal(early.evidence.sourceUrl, 'https://thehubinsf.org/event/sunnydale-pumpkin-fest-2/');
  assert.equal(early.evidence.verifiedAt, asOf);
  assert.deepEqual(early.evidence.windows, [{ open: '12:00', close: '15:00' }]);
  assert.deepEqual([early.arrival, early.start, early.end, early.wait], [600, 720, 810, 120]);
  assert.equal(early.conflicts.length, 0);
  assert.ok(early.notices.some(issue => issue.code === 'wait-for-opening'));
  const late = buildItinerary([stop], { ...details, startTime: '14:30' }, '2026-10-17', asOf).rows[0];
  assert.ok(late.conflicts.some(issue => issue.code === 'closing-overrun'));
  const otherDay = buildItinerary([stop], details, '2026-10-18', asOf).rows[0];
  assert.equal(otherDay.evidence.status, 'out-of-range');
  assert.deepEqual(otherDay.evidence.windows, []);
  assert.ok(otherDay.conflicts.some(issue => issue.code === 'event-date-mismatch'));
});

test('Town Fare 15:30 arrival misses 15:15 last order, while a timely calendar export preserves official caveats', () => {
  const stop: Stop = { kind: 'place', id: 'restaurant-town-fare-omca' };
  const now = new Date('2026-09-29T20:00:00Z');
  const details: PlanDetails = { ...defaultPlanDetails(), startTime: '15:30', stopSettings: [{ ...stop, durationMinutes: 30, travelMinutes: 0 }] };
  const late = buildItinerary([stop], details, '2026-10-03', '2026-09-29');
  assert.ok(late.rows[0].conflicts.some(item => item.code === 'last-order-missed'));
  assert.throws(() => itineraryIcs('Lunch', '2026-10-03', [stop], details, now), /冲突/);
  const calendar = itineraryIcs('Lunch', '2026-10-03', [stop], { ...details, startTime: '15:00' }, now).replace(/\r\n /g, '');
  assert.match(calendar, /最后点单 15:15/);
  assert.match(calendar, /堂食最晚 15:15 点单/);
  assert.match(calendar, /不接受预约/);
  assert.match(calendar, /museumca.org\/visit/);
});
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
  assert.equal(placeMatchesFilters(unknown, { budget: 10 }), true, 'an unpriced alternative is not a confirmed budget fit');
  const paid: PlannerPlace = { ...known, planning: { admissionUsd: 15, minAge: 8 } };
  assert.equal(placeMatchesFilters(paid, { budget: 40, budgetScope: 'total', partySize: 4 }), false);
  assert.equal(placeMatchesFilters(paid, { childAges: [12, 5] }), false);
});
test('admission caps and trip allowances are separate, with unknown prices preserved in both summaries', () => {
  const selected: Stop[] = [{ kind: 'place', id: 'ticketed' }, { kind: 'place', id: 'restaurant' }];
  const lookup = (stop: Stop) => ({ planning: { admissionUsd: stop.id === 'ticketed' ? 20 : null } });
  const details: PlanDetails = { ...defaultPlanDetails(), partySize: 2, extraCostUsd: 55, costBreakdown: { foodUsd: 40, transportUsd: 10, otherUsd: 5 }, constraints: { budget: 40, budgetScope: 'total', partySize: 2 } };
  const budget = planBudget(selected, details, lookup);
  assert.equal(budget.admissionPerPerson, 20);
  assert.equal(budget.admissionFloor, 40);
  assert.equal(budget.admissionOverBy, 0, 'meal and transport allowances do not consume the ticket cap');
  assert.equal(budget.subtotal, 95);
  assert.equal(budget.overBy, 0, 'there is no all-in cap until the user sets one');
  assert.deepEqual(budget.unknown, [selected[1]]);
  assert.equal(planBudget(selected, { ...details, totalBudgetUsd: 90 }, lookup).overBy, 5);
  assert.equal(planBudget(selected, { ...details, constraints: { budget: 30, budgetScope: 'total' } }, lookup).admissionOverBy, 10);
  assert.equal(planBudget(selected, { ...details, constraints: { budget: 15, budgetScope: 'person' } }, lookup).admissionOverBy, 5);
  const cents = planBudget(selected, details, () => ({ planning: { admissionUsd: 0.1 } }));
  assert.equal(cents.admissionFloor, 0.4);
  assert.equal(cents.subtotal, 55.4);
});

test('invalid or absent admission evidence stays unknown and cannot establish free entry', () => {
  for (const admissionUsd of [null, undefined, -1, NaN, Infinity]) {
    const place = { ...PLANNER_PLACES[0], cost: 'free', planning: { admissionUsd } };
    assert.equal(placeMatchesFilters(place, { budget: 100 }), true);
    assert.equal(placeMatchesFilters(place, { freeOnly: true }), false);
    assert.equal(planBudget(stops.slice(0, 1), defaultPlanDetails(), () => place).unknown.length, 1);
  }
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

test('meal/rest buffers and cost breakdown survive normalization without altering old plan shapes', () => {
  const old = { ...defaultPlanDetails(), extraCostUsd: 75, stopSettings: [{ ...stops[0], durationMinutes: 60, travelMinutes: 0 }] };
  assert.deepEqual(normalizePlanDetails(old, stops), old);
  assert.deepEqual(planBudget([], old).breakdown, { foodUsd: 0, transportUsd: 0, otherUsd: 75 });
  const details = normalizePlanDetails({ ...old, costBreakdown: { foodUsd: 30.25, transportUsd: 14.5, otherUsd: 5 }, stopSettings: [{ ...old.stopSettings[0], breakBeforeMinutes: 45, breakLabel: 'meal' }] }, stops);
  assert.equal(details.extraCostUsd, 49.75);
  assert.equal(details.stopSettings[0].breakBeforeMinutes, 45);
  assert.equal(details.stopSettings[0].breakLabel, 'meal');
  assert.equal(planBudget([], details).subtotal, 49.75);
  const malformed = normalizePlanDetails({ ...old, stopSettings: [{ ...old.stopSettings[0], breakBeforeMinutes: 181, breakLabel: 'private' }] }, stops);
  assert.equal(malformed.stopSettings[0].breakBeforeMinutes, 0);
  assert.equal(malformed.stopSettings[0].breakLabel, undefined);
  assert.throws(() => itineraryIcs('Invalid break', '2026-10-03', stops.slice(0, 1), { ...old, stopSettings: [{ ...old.stopSettings[0], breakBeforeMinutes: 181 }] }));
});

test('save normalization rounds each cost component to cents before deriving a backend-compatible total', () => {
  const raw = { ...defaultPlanDetails(), extraCostUsd: 4, costBreakdown: { foodUsd: 1.005, transportUsd: 2.675, otherUsd: 0.335 } };
  assert.ok(planDetailsError(raw), 'an inconsistent sum must not pass frontend validation');
  const details = normalizePlanDetails(raw, []);
  assert.deepEqual(details.costBreakdown, { foodUsd: 1.01, transportUsd: 2.68, otherUsd: 0.34 });
  assert.equal(details.extraCostUsd, 4.03);
  assert.equal(planDetailsError(details), null);
  const sum = Object.values(details.costBreakdown!).reduce((total, value) => total + value, 0);
  assert.ok(Math.abs(sum - details.extraCostUsd) <= 0.0000001, 'must satisfy the backend sum tolerance');
  assert.deepEqual(normalizePlanDetails(details, []), details, 'a saved and reopened plan keeps the same amounts');
  assert.equal(planBudget([], details).subtotal, 4.03);
  const legacy = { ...defaultPlanDetails(), extraCostUsd: 1.005 };
  assert.deepEqual(normalizePlanDetails(legacy, []), legacy, 'legacy plans without breakdown remain unchanged');
});

test('source evidence, reservation reminders and breaks reach the timeline and calendar; only conflicts prevent export', () => {
  const place = PLANNER_PLACES[0];
  const original = place.planning;
  const selected = [stops[0]];
  const now = new Date('2026-09-29T20:00:00Z');
  const details: PlanDetails = { ...defaultPlanDetails(), stopSettings: [{ ...selected[0], durationMinutes: 60, travelMinutes: 15, breakBeforeMinutes: 30, breakLabel: 'meal' }] };
  try {
    place.planning = { ...original, programTimeUnconfirmed: true, reservation: 'required', schedule: { sourceUrl: 'https://example.com/verified-hours', verifiedAt: '2026-09-29', dates: { '2026-10-03': [{ open: '11:00', close: '15:00', lastEntry: '14:00' }] } } };
    const plan = buildItinerary(selected, details, '2026-10-03', '2026-09-29');
    assert.deepEqual([plan.rows[0].breakStart, plan.rows[0].breakMinutes, plan.rows[0].arrival, plan.rows[0].start, plan.rows[0].wait], [600, 30, 645, 660, 15]);
    assert.equal(plan.rows[0].evidence.sourceUrl, 'https://example.com/verified-hours');
    assert.equal(timeEvidence(selected[0], '2026-10-03', '2026-09-29').status, 'confirmed');
    assert.equal(plan.issues.length, 0);
    assert.ok(plan.rows[0].notices.some(notice => notice.code === 'reservation-required'));
    const calendar = itineraryIcs('With lunch', '2026-10-03', selected, details, now).replace(/\r\n /g, '');
    assert.equal(calendar.split('BEGIN:VEVENT').length, 3);
    assert.match(calendar, /预留餐饮时间/);
    assert.match(calendar, /官方营业时间/);
    assert.match(calendar, /尚未确认你的预约与余票/);
    assert.match(calendar, /verified-hours/);
    assert.match(calendar, /主节目场次未确认；这里只核对场地开放时段/);
    place.planning.schedule.dates!['2026-10-03'] = [];
    assert.throws(() => itineraryIcs('Closed', '2026-10-03', selected, details, now), /冲突/);
    place.planning.schedule.verifiedAt = '2026-08-01';
    const stale = buildItinerary(selected, details, '2026-10-03', '2026-09-29');
    assert.equal(stale.issues.length, 0);
    assert.ok(stale.notices.some(notice => notice.includes('未核对')));
    assert.doesNotThrow(() => itineraryIcs('Stale reminder', '2026-10-03', selected, details, now));
    place.planning.schedule = undefined;
    assert.doesNotThrow(() => itineraryIcs('Unknown hours', '2026-10-03', selected, details, now));
  } finally { place.planning = original; }
});

test('a missed official start stays official while later travel never runs backwards', () => {
  const first = PLANNER_PLACES[0];
  const second = PLANNER_PLACES[1];
  const original = first.planning;
  const originalSecond = second.planning;
  try {
    first.planning = { ...original, schedule: { sourceUrl: 'https://example.com/sessions', verifiedAt: '2026-09-29', sessions: [{ date: '2026-10-03', start: '11:00', end: '12:00' }] } };
    second.planning = { ...originalSecond, schedule: undefined };
    const details: PlanDetails = { ...defaultPlanDetails(), startTime: '12:00', stopSettings: [{ ...stops[0], durationMinutes: 60, travelMinutes: 15 }, { ...stops[1], durationMinutes: 30, travelMinutes: 10 }] };
    const result = buildItinerary(stops.slice(0, 2), details, '2026-10-03', '2026-09-29');
    assert.equal(result.rows[0].start, 660);
    assert.equal(result.rows[0].arrival, 735);
    assert.equal(result.rows[0].lateByMinutes, 75);
    assert.equal(result.rows[1].arrival, 805, 'later travel includes the intended stay from the actual late arrival');
    assert.ok(result.issues.some(issue => issue.includes('不能把场次顺延')));
  } finally { first.planning = original; second.planning = originalSecond; }
});
