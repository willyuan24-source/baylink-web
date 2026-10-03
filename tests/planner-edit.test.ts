import assert from 'node:assert/strict';
import test from 'node:test';
import { PLANNER_EVENTS } from '../src/data/planner-catalog';
import { proposePlanEdit, type EditablePlan, type PlanEditResult } from '../src/lib/planner-edit';
import { parsePlanEditCommand } from '../src/lib/planner-edit-command';
import { defaultPlanDetails } from '../src/lib/planner-itinerary';
import type { OutingCatalog } from '../src/lib/planner-outings';
import type { PlannerPlace, PlanningSchedule } from '../src/lib/planner';

const date = '2026-10-03', asOf = '2026-09-29';
const point = { lat: 37.79, lng: -122.4, precision: 'venue' as const, label: 'Verified venue', sourceUrl: 'https://example.com/venue' };
const schedule = (patch: Partial<PlanningSchedule> = {}): PlanningSchedule => ({ sourceUrl: 'https://example.com/hours', verifiedAt: asOf, weekly: Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map(day => [day, [{ open: '09:00', close: '21:00' }]])), ...patch });
const place = (id: string, category: PlannerPlace['category'] = 'attraction', patch: Partial<PlannerPlace> = {}): PlannerPlace => ({ id, title: id, region: 'sf', city: 'San Francisco', category, summary: 'Published place', guideSlug: id, officialUrl: 'https://example.com/place', cost: 'paid', location: { ...point, lat: point.lat + (id === 'Art Museum' ? 0.003 : 0) }, planning: { admissionUsd: 20, schedule: schedule() }, ...patch });
const catalog = (): OutingCatalog => ({ events: [], places: [place('Art Museum'), place('Lunch A', 'restaurant', { planning: { admissionUsd: null, schedule: schedule() } }), place('Coffee B', 'cafe', { planning: { admissionUsd: null, schedule: schedule() } }), place('Lunch B', 'restaurant'), place('Cheap Museum', 'attraction', { location: { ...point, lat: point.lat + 0.006 }, planning: { admissionUsd: 10, schedule: schedule() } })] });
const plan = (): EditablePlan => ({ title: 'Our outing', date, stops: [{ kind: 'place', id: 'Art Museum' }, { kind: 'place', id: 'Lunch A' }, { kind: 'place', id: 'Coffee B' }], details: { ...defaultPlanDetails(), finishBy: '17:00', partySize: 2, extraCostUsd: 55, costBreakdown: { foodUsd: 40, transportUsd: 10, otherUsd: 5 }, constraints: { date, city: 'San Francisco', partySize: 2, childAges: [8], travelMode: 'walk' }, stopSettings: [
  { kind: 'place', id: 'Art Museum', durationMinutes: 60, travelMinutes: 0 },
  { kind: 'place', id: 'Lunch A', durationMinutes: 60, travelMinutes: 20 },
  { kind: 'place', id: 'Coffee B', durationMinutes: 30, travelMinutes: 15 },
] } });
const proposal = (result: PlanEditResult) => { assert.equal(result.status, 'proposal', JSON.stringify(result)); return result as Extract<PlanEditResult, { status: 'proposal' }>; };
const edit = (message: string, current = plan(), source = catalog()) => proposePlanEdit({ current, message, asOf }, source);

test('merged event plans remain editable without changing IDs or settings, and aliases cannot evade duplicate or locked-stop checks', () => {
  const legacy = { kind: 'event' as const, id: 'alameda-point-antiques-october-2026' };
  const canonical = { kind: 'event' as const, id: 'alameda-point-antiques-oct-2026' };
  const current: EditablePlan = { title: 'Saved fair visit', date: '2026-10-04', stops: [legacy], details: {
    ...defaultPlanDetails(), stopSettings: [{ ...legacy, durationMinutes: 45, travelMinutes: 15, breakBeforeMinutes: 10, breakLabel: 'rest' }],
  } };
  const before = structuredClone(current);
  const next = proposal(proposePlanEdit({ current, message: '1 hour later', asOf }));
  assert.equal(next.canApply, true);
  assert.equal(next.nextPlan.details.startTime, '11:00');
  assert.deepEqual(next.nextPlan.stops, [legacy]);
  assert.deepEqual(next.nextPlan.details.stopSettings, current.details.stopSettings);
  assert.deepEqual(current, before);
  const wrongDate = proposal(proposePlanEdit({ current, message: 'change date to 2026-10-05', asOf }));
  assert.equal(wrongDate.canApply, false);
  assert.match(wrongDate.issues.join(' '), /no recorded event/);
  assert.equal(proposePlanEdit({ current: { ...current, stops: [legacy, canonical] }, message: '1 hour later', asOf }).status, 'unsupported');
  assert.equal(proposePlanEdit({ current, lockedStops: [canonical], message: '1 hour later', asOf }).status, 'unsupported');
});

test('whole-message parser handles clear Chinese and English edits and rejects compound or ambiguous requests', () => {
  for (const [message, expected] of [
    ['晚一小时', { kind: 'shift', minutes: 60 }], ['提前半小时', { kind: 'shift', minutes: -30 }], ['start 1 hour later', { kind: 'shift', minutes: 60 }],
    ['晚一小时出发', { kind: 'shift', minutes: 60 }], ['Start one hour later', { kind: 'shift', minutes: 60 }], ['移除博物馆', { kind: 'remove', museums: true }],
    ['把第二站换成餐厅', { kind: 'replace', index: 1, category: 'restaurant', cheaper: false }],
    ['move the whole plan 30 minutes earlier', { kind: 'shift', minutes: -30 }], ['开始改到下午两点半', { kind: 'time', field: 'startTime', value: '14:30' }],
    ['finish by 6 pm', { kind: 'time', field: 'finishBy', value: '18:00' }], ['日期改到明天', { kind: 'date', value: '2026-09-30' }],
    ['change date to 10/4', { kind: 'date', value: '2026-10-04' }], ['删除第2站', { kind: 'remove', index: 1 }],
    ['replace the second stop with a restaurant', { kind: 'replace', index: 1, category: 'restaurant', cheaper: false }],
  ] as const) assert.deepEqual(parsePlanEditCommand(message, asOf), expected, message);
  for (const message of ['晚一小时，再删除第二站', 'remove stop 2 and start at 14:00', 'start at 2', '日期改到2026-02-30', 'start at 25:00', '晚0小时', 'earlier', '去哪里都行', '推迟一周', '不要博物馆和咖啡店']) assert.equal(edit(message).status, 'unsupported', message);
});

test('later and earlier proposals preserve source plan, all costs and constraints, and move explicit user times', () => {
  const current = plan(); current.details.stopSettings[2].fixedStartTime = '14:00';
  const before = structuredClone(current);
  const next = proposal(edit('晚一小时', current));
  assert.equal(next.canApply, true);
  assert.equal(next.nextPlan.details.startTime, '11:00'); assert.equal(next.nextPlan.details.finishBy, '18:00');
  assert.equal(next.nextPlan.details.stopSettings[2].fixedStartTime, '15:00');
  assert.deepEqual(next.nextPlan.details.costBreakdown, current.details.costBreakdown);
  assert.deepEqual(next.nextPlan.details.constraints, current.details.constraints);
  assert.deepEqual(current, before);
  assert.notEqual(next.nextPlan.details.constraints, current.details.constraints);
  const earlier = proposal(edit('30 minutes earlier'));
  assert.equal(earlier.nextPlan.details.startTime, '09:30');
  assert.equal(edit('晚10小时').status, 'unsupported');
});

test('an official session is never shifted to satisfy a later departure', () => {
  const source = catalog(); source.events.push({ ...PLANNER_EVENTS[0], id: 'show', title: 'Show', startDate: date, endDate: date, occurrenceDates: [date], city: 'San Francisco', region: 'sf', planning: { admissionUsd: 0, schedule: schedule({ weekly: undefined, sessions: [{ date, start: '10:00', end: '11:00' }] }) } });
  const current = plan(); current.stops[0] = { kind: 'event', id: 'show' }; current.details.stopSettings[0] = { ...current.details.stopSettings[0], kind: 'event', id: 'show', fixedStartTime: '10:00' };
  const next = proposal(edit('1 hour later', current, source));
  assert.equal(next.canApply, false);
  assert.equal(next.nextPlan.details.stopSettings[0].fixedStartTime, '10:00');
  assert.match(next.issues.join(' '), /after the official 10:00 start/);
  assert.match(next.warnings.join(' '), /Official sessions keep/);
  source.events[0].planning!.schedule!.verifiedAt = '2026-07-01';
  const stale = proposal(edit('1 hour later', current, source));
  assert.equal(stale.nextPlan.details.stopSettings[0].fixedStartTime, '10:00', 'stale evidence does not authorize moving a recorded session');
  assert.match(stale.warnings.join(' '), /not been checked/);
});

test('locked stop identity, settings and computed arrival are protected from direct and indirect edits', () => {
  const current = plan(); const lockedStops = [current.stops[1]];
  for (const message of ['晚一小时', '删除第1站', '删除第2站', '第二站换成餐厅', '日期改到明天', '开始改到11:00']) assert.equal(proposePlanEdit({ current, message, lockedStops, asOf }, catalog()).status, 'unsupported', message);
  const allowed = proposal(proposePlanEdit({ current, message: '删除第3站', lockedStops, asOf }, catalog()));
  assert.equal(allowed.canApply, true); assert.deepEqual(allowed.nextPlan.details.stopSettings[1], current.details.stopSettings[1]);
});

test('date and finish changes recheck closures and event dates instead of claiming availability', () => {
  const source = catalog(); source.places[0].planning!.schedule!.dates = { '2026-10-04': [] };
  const changed = proposal(edit('日期改到10月4日', plan(), source));
  assert.equal(changed.canApply, false); assert.match(changed.issues.join(' '), /不开放/);
  assert.equal(changed.nextPlan.details.constraints?.date, '2026-10-04');
  assert.equal(proposal(edit('结束改到11:00')).canApply, false);
  assert.equal(proposal(edit('change date to 2026-09-01')).canApply, false);
});

test('deleting a numbered, unique named or museum stop preserves remaining stop settings and budgets', () => {
  for (const message of ['删除第1站', 'remove Art Museum', '不要博物馆', 'no museums']) {
    const current = plan(), next = proposal(edit(message, current));
    assert.equal(next.canApply, true);
    assert.deepEqual(next.nextPlan.stops, current.stops.slice(1));
    assert.deepEqual(next.nextPlan.details.stopSettings, current.details.stopSettings.slice(1));
    assert.equal(next.nextPlan.details.extraCostUsd, 55);
  }
  const only = plan(); only.stops = only.stops.slice(0, 1); only.details.stopSettings = only.details.stopSettings.slice(0, 1);
  assert.equal(edit('remove stop 1', only).status, 'unsupported');
  assert.equal(edit('remove stop 0').status, 'unsupported'); assert.equal(edit('删除第9站').status, 'unsupported');
  const current = plan(), source = catalog(); source.places[1].title = 'Art Museum Cafe';
  assert.equal(edit('remove Art', current, source).status, 'unsupported');
});

test('restaurant replacement keeps every other stop and estimate, using a real same-city open venue', () => {
  const current = plan(), before = structuredClone(current), next = proposal(edit('第二站换成餐厅', current));
  assert.equal(next.canApply, true); assert.equal(next.nextPlan.stops[1].id, 'Lunch B');
  assert.deepEqual(next.nextPlan.stops[0], current.stops[0]); assert.deepEqual(next.nextPlan.stops[2], current.stops[2]);
  assert.deepEqual(next.nextPlan.details.stopSettings.find(item => item.id === 'Coffee B'), current.details.stopSettings[2]);
  assert.equal(next.nextPlan.details.extraCostUsd, 55); assert.deepEqual(current, before);
});

test('budgeted edits accept a truly unpriced restaurant with warnings while enforcing separate ticket and trip caps', () => {
  const current = plan(), source = catalog();
  current.details.constraints = { ...current.details.constraints, budget: 40, budgetScope: 'total' };
  source.places.find(place => place.id === 'Lunch B')!.planning!.admissionUsd = null;
  const next = proposal(edit('replace stop 2 with a restaurant', current, source));
  assert.equal(next.canApply, true);
  assert.equal(next.nextPlan.stops[1].id, 'Lunch B');
  assert.equal(next.nextPlan.details.extraCostUsd, 55);
  assert.equal(next.nextPlan.details.totalBudgetUsd, null);
  assert.match(next.warnings.join(' '), /whole outing cannot be confirmed within budget/);
  const overAdmission = structuredClone(current);
  overAdmission.details.constraints!.budget = 30;
  const ticketResult = proposal(edit('1 hour later', overAdmission, source));
  assert.equal(ticketResult.canApply, false);
  assert.match(ticketResult.issues.join(' '), /original admission budget/);
  const overTrip = structuredClone(current);
  overTrip.details.totalBudgetUsd = 90;
  const tripResult = proposal(edit('1 hour later', overTrip, source));
  assert.equal(tripResult.canApply, false);
  assert.match(tripResult.issues.join(' '), /\$95\.00.*trip budget/);
});

test('replacements reject other cities, approximate coordinates, closed or unverified hours, late orders and age conflicts', () => {
  for (const patch of [
    { city: 'South San Francisco' }, { location: { ...point, precision: 'area' as const } }, { openingStatus: 'announced' as const },
    { planning: { admissionUsd: 0 } }, { planning: { admissionUsd: 0, schedule: schedule({ verifiedAt: '2026-07-01' }) } },
    { planning: { admissionUsd: 0, schedule: schedule({ dates: { [date]: [] } }) } },
    { planning: { admissionUsd: 0, schedule: schedule({ dates: { [date]: [{ open: '09:00', close: '21:00', lastOrder: '10:00' }] } }) } },
    { planning: { admissionUsd: 0, minAge: 18, schedule: schedule() } },
  ]) {
    const source = catalog(); Object.assign(source.places[3], patch);
    assert.equal(edit('replace stop 2 with a restaurant', plan(), source).status, 'unsupported', JSON.stringify(patch));
  }
});

test('cheaper compares known admission prices only and never guesses meal spending or reduces allowances', () => {
  const current = plan(), result = proposal(edit('make stop 1 cheaper', current));
  assert.equal(result.nextPlan.stops[0].id, 'Cheap Museum'); assert.equal(result.nextPlan.details.extraCostUsd, 55);
  assert.match(result.warnings.join(' '), /starting admission prices only/);
  assert.equal(edit('make stop 2 cheaper').status, 'unsupported');
  assert.equal(edit('replace stop 1 with a cheaper restaurant').status, 'unsupported');
  const source = catalog(); source.places[1].planning!.admissionUsd = 20;
  assert.match((edit('第二站换成更便宜的餐厅', current, source) as Extract<PlanEditResult, { status: 'unsupported' }>).reason, /不代表实际餐饮消费/);
  source.places[4].planning!.admissionUsd = null;
  assert.equal(edit('make stop 1 cheaper', current, source).status, 'unsupported');
});

test('known over-budget edits cannot apply and unknown costs remain explicit in both languages', () => {
  const current = plan(); current.details.totalBudgetUsd = 90;
  assert.equal(proposal(edit('开始改到11:00', current)).canApply, false);
  for (const message of ['start at 11:00', '开始改到11:00']) {
    const next = proposal(edit(message)); assert.equal(next.canApply, true);
    assert.match(next.warnings.join(' '), message.startsWith('start') ? /unknown.*not treated as free/ : /费用未知，不按免费/);
  }
  const corrupt = plan(); corrupt.details.stopSettings[0].durationMinutes = -3;
  assert.equal(edit('start at 11:00', corrupt).status, 'unsupported');
});
