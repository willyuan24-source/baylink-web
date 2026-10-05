import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import React from 'react';
import { JSDOM } from 'jsdom';
import type { AppContextValue } from '../src/app/context';
import type { Library, PlanDetails, PlanFilters, Recommendations, SavedPlan, Stop } from '../src/lib/planner';

const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'https://www.baylink.us/plan' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage,
  HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { render, cleanup, fireEvent, act, within } = await import('@testing-library/react');
const { MemoryRouter, Routes, Route, Outlet } = await import('react-router-dom');
const { default: PlannerPage } = await import('../src/pages/PlannerPage');
const { api } = await import('../src/lib/api');
const { GUEST_PLANNER_KEY } = await import('../src/lib/planner-library');
const { defaultPlanDetails } = await import('../src/lib/planner-itinerary');
const { EMPTY_LIBRARY } = await import('../src/lib/planner');
const { stageBayBayPlanDraft, readBayBayPlanDraft, bayBayAdmissionOverride } = await import('../src/lib/baybay-plan-handoff');
const { parseBayBayAssistantFields } = await import('../src/lib/baybay-assistant');
const { setLocale } = await import('../src/i18n/locale');
const { PlannerSchedule } = await import('../src/components/PlannerSchedule');
const { PlannerPlanOverview } = await import('../src/components/PlannerPlanOverview');
const originalRequest = api.request;
const date = '2026-09-30';
const stops: Stop[] = [{ kind: 'place', id: 'golden-gate' }, { kind: 'place', id: 'chinatown' }];
const constraints: PlanFilters = { date, region: 'sf', city: 'San Francisco', budget: 100, budgetScope: 'total',
  partySize: 4, childAge: 5, childAges: [5, 12], setting: 'any', travelMode: 'transit', freeOnly: true, topic: 'arts' };
const savedDetails = (): PlanDetails => ({ ...defaultPlanDetails(), startTime: '12:00', finishBy: '18:00', partySize: 4,
  totalBudgetUsd: 180, extraCostUsd: 35.5, travelMode: 'transit', constraints: structuredClone(constraints),
  stopSettings: [{ ...stops[0], durationMinutes: 45, travelMinutes: 10, fixedStartTime: '12:30' },
    { ...stops[1], durationMinutes: 30, travelMinutes: 20 }],
});
const savedPlan = (): SavedPlan => ({ id: 'details-plan', title: 'Our private afternoon', date, stops: structuredClone(stops),
  details: savedDetails(), version: 1, createdAt: '2026-09-29T19:00:00Z', updatedAt: '2026-09-29T19:00:00Z' });
const library = (plans: SavedPlan[] = []): Library => ({ ...structuredClone(EMPTY_LIBRARY), plans });
const response = (filters: PlanFilters): Recommendations => ({ ok: true, responseMode: 'rules', filters, suggestions: [], notices: [], checkedAt: '2026-09-29' });
type View = ReturnType<typeof render>;
const editor = (view: View) => within(view.getByRole('complementary'));
const input = (view: View, label: string) => editor(view).getByLabelText(label) as HTMLInputElement;
const selectedLinks = (view: View) => Array.from(view.container.querySelectorAll('.planner-stops > li > a')).map(link => link.getAttribute('href'));
const timingInputs = (view: View, label: string) => editor(view).getAllByLabelText(label) as HTMLInputElement[];
function seed(plan = savedPlan()) { localStorage.setItem(GUEST_PLANNER_KEY, JSON.stringify(library([plan]))); }
async function openPlanner(search = '?edit=details-plan', signedIn = false) {
  const app = signedIn ? { user: { id: 'owner', token: 'private-test-token' }, setShowLogin: () => {}, showToast: () => {} } as unknown as AppContextValue : undefined;
  if (signedIn) localStorage.setItem('currentUser', JSON.stringify(app!.user));
  let view!: View;
  await act(async () => { view = render(<MemoryRouter initialEntries={['/plan' + search]}><Routes>
    <Route element={<Outlet context={app} />}><Route path="/plan" element={<PlannerPage />} /></Route>
  </Routes></MemoryRouter>); });
  return view;
}
beforeEach(context => {
  context.mock.method(globalThis, 'fetch', async () => new Response('{}'));
  context.mock.timers.enable({ apis: ['Date'], now: new Date('2026-09-29T19:00:00Z') });
  localStorage.clear();
  api.request = async endpoint => { throw new Error(`Unexpected API call: ${endpoint}`); };
});
afterEach(async () => { cleanup(); api.request = originalRequest; localStorage.clear(); await setLocale('zh-Hans', false); });

test('BayBay transfer applies supported requirements and explicitly retains unsupported ones only for current-tab review', async () => {
  const fields = parseBayBayAssistantFields({ taskState: { version: 1, revision: 1, date: '2026-10-10', city: 'San Francisco', region: 'sf', partySize: 3, childAges: [5], budget: 40, budgetScope: 'person', origin: 'PRIVATE ORIGIN FOR REVIEW', startTime: '10:00', finishBy: '17:00', travelMode: 'transit', returnToOrigin: false, maxStops: 2, excludedCities: ['Oakland'], freeOnly: true, setting: 'outdoor' }, assistantPlan: { id: 'baybay-transfer', title: 'Original plan', date: '2026-10-10', status: 'needs_verification', stops: stops.map(stop => ({ id: stop.id, kind: stop.kind, entityId: stop.id, title: stop.id })), budget: { unknownItems: [] } } });
  const path = stageBayBayPlanDraft(fields.assistantPlan!, fields.taskState)!;
  assert.doesNotMatch(path, /PRIVATE|origin|budget|childAges|partySize/);
  const id = new URL(path, 'https://www.baylink.us').searchParams.get('baybayDraft');
  const draft = readBayBayPlanDraft(id)!;
  assert.equal(draft.details.totalBudgetUsd, 120); assert.equal(draft.details.partySize, 3);
  assert.equal(draft.details.startTime, '10:00'); assert.equal(draft.details.finishBy, '17:00'); assert.equal(draft.details.travelMode, 'transit');
  assert.deepEqual(draft.details.constraints?.childAges, [5]); assert.equal(draft.details.constraints?.freeOnly, true); assert.equal(draft.details.constraints?.setting, 'outdoor');
  assert.equal(draft.details.constraints?.budget, undefined); assert.equal(draft.requirements.returnToOrigin, false); assert.equal(draft.requirements.maxStops, 2);
  draft.requirements.origin = 'MUTATED'; assert.equal(readBayBayPlanDraft(id)!.requirements.origin, 'PRIVATE ORIGIN FOR REVIEW');
  assert.equal(readBayBayPlanDraft(id, 'other-account'), null);
  assert.equal(readBayBayPlanDraft(id, undefined, Date.now() + 30 * 60 * 1000 + 1), null);
  const view = await openPlanner(new URL(path, 'https://www.baylink.us').search);
  const summary = view.getByRole('region', { name: 'BayBay 原对话条件' });
  assert.match(summary.textContent || '', /PRIVATE ORIGIN FOR REVIEW/); assert.match(summary.textContent || '', /不返回起点/); assert.match(summary.textContent || '', /不参与计划页路线计算/); assert.match(summary.textContent || '', /尚未保存或预订/);
  assert.match(summary.textContent || '', /5 岁/); assert.match(summary.textContent || '', /每人/); assert.match(summary.textContent || '', /Oakland/);
  const disclosure = summary.querySelector('details')!;
  assert.equal(disclosure.open, false);
  assert.equal(within(summary).getByText(/起点、返程、站数上限和排除城市/).closest('details'), null);
  assert.equal(within(summary).getByText(/仅供核对的条件及原票价参考/).closest('details'), null);
  fireEvent.click(within(summary).getByText('查看全部原始条件'));
  assert.equal(disclosure.open, true);
  assert.equal(input(view, '日期').value, '2026-10-10'); assert.equal(input(view, '计划名称').value, 'Original plan');
  assert.equal((view.getByLabelText('同行总人数') as HTMLInputElement).value, '3');
  assert.equal((view.getByLabelText('整趟总预算 $') as HTMLInputElement).value, '120');
  assert.equal((view.getByLabelText('开始时间') as HTMLInputElement).value, '10:00');
  assert.equal((view.getByLabelText('希望几点结束') as HTMLInputElement).value, '17:00');
  assert.equal((view.getByLabelText('这份计划的交通方式') as HTMLSelectElement).value, 'transit');
  const overview = view.getByRole('region', { name: '当前计划概览' });
  assert.ok(within(overview).getByText('时间草稿'));
  assert.match(overview.textContent || '', /实际路程未核对/);
  assert.match(overview.textContent || '', /最晚结束目标：17:00。这只是目标/);
  fireEvent.change(view.getByLabelText('同行总人数'), { target: { value: '4' } });
  assert.match(summary.textContent || '', /表单里的后续修改不会更新这里/);
  assert.equal(within(summary).getByText('同行人数').nextElementSibling?.textContent, '3');
  assert.equal(localStorage.getItem(GUEST_PLANNER_KEY), null);
});

test('missing or another-account BayBay draft clearly restores only public date and stops without private requirements', async () => {
  const view = await openPlanner('?date=2026-10-10&places=golden-gate&baybayDraft=00000000-0000-0000-0000-000000000000');
  assert.match(view.getByRole('status').textContent || '', /其他条件未恢复/);
  assert.equal(view.queryByRole('region', { name: 'BayBay 原对话条件' }), null);
  assert.equal(input(view, '日期').value, '2026-10-10'); assert.deepEqual(selectedLinks(view), ['/guides/sf-golden-gate-bridge-fort-point-guide']);
});

test('default timing remains an unverified draft and the finish-by target is separate in English', async () => {
  await setLocale('en', false);
  const fields = parseBayBayAssistantFields({ taskState: { version: 1, revision: 1, date: '2026-10-10', partySize: 3, origin: 'A long original starting point kept only for review', returnToOrigin: true }, assistantPlan: { id: 'defaults', title: 'Original outing', status: 'needs_verification', date: '2026-10-10', stops: stops.map(stop => ({ id: stop.id, kind: stop.kind, entityId: stop.id, title: stop.id })), budget: {} } });
  const path = stageBayBayPlanDraft(fields.assistantPlan!, fields.taskState)!;
  const view = await openPlanner(new URL(path, 'https://www.baylink.us').search);
  const overview = view.getByRole('region', { name: 'Current plan overview' });
  assert.ok(within(overview).getByText('Draft schedule'));
  assert.match(overview.textContent || '', /actual routes have not been checked/);
  assert.match(overview.textContent || '', /Finish-by target: 18:00\. This is a target, not confirmation/);
  fireEvent.change(view.getByLabelText('Finish by'), { target: { value: '17:00' } });
  assert.match(overview.textContent || '', /Finish-by target: 17:00/);
  const original = view.getByRole('region', { name: 'Original BayBay requirements' });
  assert.equal(original.querySelector('details')!.open, false);
  assert.equal(within(original).getByText(/The origin, return requirement/).closest('details'), null);
  assert.match(original.textContent || '', /defaults are not confirmed requirements/);
  assert.match(original.textContent || '', /Reloading or opening another tab loses the original draft/);
});

test('cost notes deduplicate only exact text and preserve a different eligibility condition', () => {
  const generic = '当日适用票价、税费、餐饮与交通仍需核实；不是完整出行总价。';
  const qualified = generic + '儿童必须由成人陪同。';
  const view = render(<PlannerSchedule stops={stops.slice(0, 1)} date="2026-10-10" title="Cost notes" details={defaultPlanDetails()} admissionOverride={{ active: true, knownTotalUsd: 20, unknownStops: stops.slice(0, 1), unknowns: [generic, generic, qualified] }} onChange={() => {}} onStatus={() => {}} />);
  assert.equal(view.getAllByText(generic, { exact: true }).length, 1);
  assert.equal(view.getAllByText(qualified, { exact: true }).length, 1);
  assert.match(view.container.textContent || '', /费用待确认/);
});

test('a transferred family price remains 109.85 until pricing inputs change and never enters saved account details', async () => {
  const fields = parseBayBayAssistantFields({ evidence: [{ id: 'official', title: 'Official ticket reference', kind: 'web', url: 'https://www.exploratorium.edu/visit' }],
    taskState: { version: 1, revision: 1, date: '2026-10-10', partySize: 3, childAges: [5], budget: 120, budgetScope: 'total' },
    assistantPlan: { id: 'group-price', title: 'Family reference', date: '2026-10-10', status: 'needs_verification', stops: [{ id: 'golden-gate', entityId: 'golden-gate', kind: 'place', title: 'Synthetic test location', admissionFacts: { status: 'partial', basis: 'catalog-snapshot', knownTotalUsd: 109.85, breakdown: [{ category: 'adult', quantity: 2, unitUsd: 39.95, subtotalUsd: 79.90 }, { category: 'child', quantity: 1, age: 5, unitUsd: 29.95, subtotalUsd: 29.95 }], sourceIds: ['official'], applicability: { date: '2026-10-10', dateStatus: 'regular-unconfirmed', feesIncluded: null }, unknowns: ['Date-specific prices and fees are unconfirmed.'] } }], budget: { knownTotalUsd: 109.85, unknownItems: ['Transit and food remain unknown.'] } } });
  const path = stageBayBayPlanDraft(fields.assistantPlan!, fields.taskState)!, url = new URL(path, 'https://www.baylink.us');
  const draft = readBayBayPlanDraft(url.searchParams.get('baybayDraft'))!;
  assert.equal(bayBayAdmissionOverride(draft, draft.date, draft.stops, draft.details)?.knownTotalUsd, 109.85);
  for (const [nextDate, nextStops, nextDetails] of [[draft.date, draft.stops, { ...draft.details, partySize: 4 }], ['2026-10-11', draft.stops, draft.details], [draft.date, [], draft.details], [draft.date, draft.stops, { ...draft.details, constraints: { ...draft.details.constraints, childAges: [6], childAge: 6 } }]] as const) assert.equal(bayBayAdmissionOverride(draft, nextDate, [...nextStops], nextDetails)?.active, false);
  const view = await openPlanner(url.search);
  const schedule = view.getByRole('region', { name: '时间与预算' });
  assert.match(schedule.textContent || '', /原来源已知门票小计（全组）(?:US)?\$109.85/);
  assert.match(schedule.textContent || '', /保存与分享不会保留此报价/); assert.match(schedule.textContent || '', /Transit and food remain unknown/);
  assert.doesNotMatch(JSON.stringify(draft.details), /admissionFacts|costReference|109.85/);
  fireEvent.change(view.getByLabelText('同行总人数'), { target: { value: '4' } });
  assert.match(schedule.textContent || '', /原 BayBay 票价快照已停用/);
  assert.doesNotMatch(schedule.textContent || '', /原来源已知门票小计/);
});

test('the actual two-stop BayBay handoff keeps top overview and schedule costs synchronized through allowances and party changes', async () => {
  const fields = parseBayBayAssistantFields({
    evidence: [{ id: 'exploratorium', title: 'Exploratorium admission', kind: 'place', url: 'https://www.exploratorium.edu/visit', checkedAt: '2026-10-02', verification: 'catalog' }, { id: 'pier', title: 'PIER 39 FAQ', kind: 'place', url: 'https://www.pier39.com/frequently-asked-questions', checkedAt: '2026-10-02', verification: 'catalog' }],
    taskState: { version: 1, revision: 1, date: '2026-10-10', origin: 'Ferry Building · One Ferry Building', startTime: '10:00', finishBy: '17:00', partySize: 3, childAges: [5], budget: 120, budgetScope: 'total', travelMode: 'transit', returnToOrigin: false },
    assistantPlan: { id: 'strict-two-stops', title: 'San Francisco一日安排', date: '2026-10-10', status: 'needs_verification', stops: [
      { id: 'place:venue-exploratorium-daytime', entityId: 'venue-exploratorium-daytime', kind: 'place', title: 'Exploratorium', sourceIds: ['exploratorium'], admissionFacts: { status: 'partial', basis: 'catalog-snapshot', knownTotalUsd: 109.85, sourceUrl: 'https://www.exploratorium.edu/visit', checkedAt: '2026-10-02', sourceIds: ['exploratorium'], breakdown: [{ category: 'adult', quantity: 2, unitUsd: 39.95, subtotalUsd: 79.90 }, { category: 'child', quantity: 1, age: 5, unitUsd: 29.95, subtotalUsd: 29.95 }], applicability: { date: '2026-10-10', dateStatus: 'regular-unconfirmed', feesIncluded: null }, unknowns: ['所选日期及必要附加费仍待确认。'] } },
      { id: 'place:pier39', entityId: 'pier39', kind: 'place', title: 'PIER 39', sourceIds: ['pier'], admissionFacts: { status: 'partial', basis: 'catalog-snapshot', knownTotalUsd: 0, sourceUrl: 'https://www.pier39.com/frequently-asked-questions/', checkedAt: '2026-10-04', sourceIds: ['pier'], breakdown: [{ category: 'group', quantity: 1, unitUsd: 0, subtotalUsd: 0 }], applicability: { date: '2026-10-10', dateStatus: 'regular-unconfirmed', feesIncluded: true }, unknowns: ['仅公共区免费，当日开放仍待确认。'] } },
    ], budget: { knownTotalUsd: 109.85, limitUsd: 120, scope: 'total', unknownItems: ['餐饮和交通未计入。'] } },
  });
  const path = stageBayBayPlanDraft(fields.assistantPlan!, fields.taskState)!;
  const view = await openPlanner(new URL(path, 'https://www.baylink.us').search);
  const overview = view.getByRole('region', { name: '当前计划概览' }), schedule = view.getByRole('region', { name: '时间与预算' });
  const subtotal = (section: HTMLElement, label: string) => within(section).getByText(label).nextElementSibling?.textContent?.replace(/^US/, '');
  assert.equal(subtotal(overview, '已知金额与预留小计'), '$109.85');
  assert.equal(subtotal(schedule, '目前可计入的小计'), '$109.85');
  assert.match(overview.textContent || '', /门票沿用原 BayBay 来源快照/);
  assert.equal(within(overview).getByText('费用待确认').nextElementSibling?.textContent, '2 站');
  fireEvent.change(view.getByLabelText('餐饮预留（整组）$'), { target: { value: '20' } });
  assert.equal(subtotal(overview, '已知金额与预留小计'), '$129.85');
  assert.equal(subtotal(schedule, '目前可计入的小计'), '$129.85');
  assert.match(overview.textContent || '', /超预算 \$9.85/);
  assert.match(schedule.textContent || '', /已超预算 (?:US)?\$9.85/);
  fireEvent.change(view.getByLabelText('同行总人数'), { target: { value: '4' } });
  assert.equal(subtotal(overview, '已知金额与预留小计'), subtotal(schedule, '目前可计入的小计'));
  assert.notEqual(subtotal(overview, '已知金额与预留小计'), '$129.85');
  assert.doesNotMatch(overview.textContent || '', /门票沿用原 BayBay 来源快照/);
  assert.match(schedule.textContent || '', /原 BayBay 票价快照已停用/);
});

test('the PIER39 partial zero reference survives handoff in both cost summaries while date and trip costs remain uncertain', async () => {
  const fields = parseBayBayAssistantFields({
    evidence: [{ id: 'pier', title: 'PIER 39 FAQ', kind: 'place', url: 'https://www.pier39.com/frequently-asked-questions/', checkedAt: '2026-10-04', verification: 'catalog' }],
    taskState: { version: 1, revision: 1, date: '2026-11-07', startTime: '10:00', finishBy: '15:00', partySize: 3, childAges: [5], budget: 120, budgetScope: 'total', travelMode: 'transit', returnToOrigin: false },
    assistantPlan: { id: 'pier-only', title: '只看海狮', date: '2026-11-07', status: 'needs_verification', stops: [
      { id: 'place:pier39', entityId: 'pier39', kind: 'place', title: 'PIER 39', sourceIds: ['pier'], admissionFacts: { status: 'partial', basis: 'catalog-snapshot', knownTotalUsd: 0, sourceUrl: 'https://www.pier39.com/frequently-asked-questions/', checkedAt: '2026-10-04', sourceIds: ['pier'], breakdown: [{ category: 'all-ages', quantity: 3, unitUsd: 0, subtotalUsd: 0 }], applicability: { date: '2026-11-07', dateStatus: 'regular-unconfirmed', feesIncluded: true }, unknowns: ['仅公共区和海狮观景免费，收费项目另算；所选日期开放仍待确认。'] } },
    ], budget: { knownTotalUsd: 0, limitUsd: 120, scope: 'total', unknownItems: ['餐饮和交通未计入。'] } },
  });
  const path = stageBayBayPlanDraft(fields.assistantPlan!, fields.taskState)!, url = new URL(path, 'https://www.baylink.us');
  const draft = readBayBayPlanDraft(url.searchParams.get('baybayDraft'))!;
  const reference = bayBayAdmissionOverride(draft, draft.date, draft.stops, draft.details)!;
  assert.equal(reference.knownTotalUsd, 0); assert.equal(reference.allAdmissionAmountsKnown, true);
  assert.equal(reference.unknownStops.length, 1, 'partial applicability remains a pending check');
  const view = await openPlanner(url.search);
  const overview = view.getByRole('region', { name: '当前计划概览' }), schedule = view.getByRole('region', { name: '时间与预算' });
  const subtotal = (section: HTMLElement, label: string) => within(section).getByText(label).nextElementSibling?.textContent?.replace(/^US/, '');
  assert.equal(subtotal(overview, '已知金额与预留小计'), '$0.00');
  assert.equal(subtotal(schedule, 'BayBay 原来源已知门票小计（全组）'), '$0.00');
  assert.equal(subtotal(schedule, '目前可计入的小计'), '$0.00');
  assert.match(schedule.textContent || '', /仅公共区和海狮观景免费，收费项目另算/);
  assert.match(schedule.textContent || '', /所选日期开放仍待确认/);
  assert.match(schedule.textContent || '', /餐饮和交通未计入/);
  assert.match(schedule.textContent || '', /不是完整出行总价/);
  assert.match(overview.textContent || '', /费用不是完整报价/);
  fireEvent.change(view.getByLabelText('餐饮预留（整组）$'), { target: { value: '20' } });
  assert.equal(subtotal(overview, '已知金额与预留小计'), '$20.00');
  assert.equal(subtotal(schedule, '目前可计入的小计'), '$20.00');
  assert.equal(subtotal(schedule, 'BayBay 原来源已知门票小计（全组）'), '$0.00');
  assert.equal(bayBayAdmissionOverride(draft, '2026-11-08', draft.stops, draft.details)?.active, false);
  for (const sourceIds of [[], ['pier']]) {
    const incomplete = structuredClone(draft);
    incomplete.admissions[0].facts.sourceIds = sourceIds;
    if (sourceIds.length) incomplete.admissions[0].facts.breakdown[0].quantity = 2;
    assert.equal(bayBayAdmissionOverride(incomplete, incomplete.date, incomplete.stops, incomplete.details)?.allAdmissionAmountsKnown, false);
  }
});

test('both planner cost summaries keep legacy or incomplete zero references pending in English', async () => {
  await setLocale('en', false);
  for (const allAdmissionAmountsKnown of [undefined, false]) {
    const reference = { active: true, knownTotalUsd: 0, allAdmissionAmountsKnown, unknownStops: stops.slice(0, 1), unknowns: ['Child admission remains unknown.'] };
    const view = render(<><PlannerPlanOverview stops={stops.slice(0, 1)} date="2026-11-07" details={defaultPlanDetails()} admissionOverride={reference} />
      <PlannerSchedule stops={stops.slice(0, 1)} date="2026-11-07" title="Incomplete" details={defaultPlanDetails()} admissionOverride={reference} onChange={() => {}} onStatus={() => {}} /></>);
    const overview = view.getByRole('region', { name: 'Current plan overview' }), schedule = view.getByRole('region', { name: 'Time and budget' });
    for (const [section, label] of [[overview, 'Known costs + allowances'], [schedule, 'Original BayBay sourced admission subtotal (group)'], [schedule, 'Partial subtotal']] as const) {
      assert.equal(within(section).getByText(label).nextElementSibling?.textContent, 'Cost not yet calculated');
    }
    assert.match(schedule.textContent || '', /Child admission remains unknown/);
    view.unmount();
  }
});

test('an old saved event cannot be added twice through its merged catalog card and retains its settings when saved', async () => {
  const legacy: Stop = { kind: 'event', id: 'alameda-point-antiques-october-2026' };
  const canonical = 'alameda-point-antiques-oct-2026';
  const original = savedPlan();
  original.date = '2026-10-04';
  original.stops = [legacy];
  original.details = { ...defaultPlanDetails(), constraints: { region: 'east-bay' }, stopSettings: [
    { ...legacy, durationMinutes: 45, travelMinutes: 15, breakBeforeMinutes: 10, breakLabel: 'rest' },
  ] };
  seed(original);
  const view = await openPlanner();
  assert.equal(timingInputs(view, '停留（分钟）')[0].value, '45');
  const card = view.container.querySelector(`[id="catalog-event:${canonical}"]`) as HTMLElement;
  assert.ok(card, 'the canonical catalog event is available alongside the old saved reference');
  fireEvent.click(within(card).getByRole('button', { name: '加入计划' }));
  assert.deepEqual(selectedLinks(view), [`/events/${legacy.id}`]);
  await act(async () => { fireEvent.click(editor(view).getByRole('button', { name: '更新这份计划' })); });
  const saved: SavedPlan = JSON.parse(localStorage.getItem(GUEST_PLANNER_KEY)!).plans[0];
  assert.equal(saved.version, 2);
  assert.deepEqual(saved.stops, [legacy]);
  assert.deepEqual(saved.details!.stopSettings, original.details.stopSettings);
});

test('edited schedule and costs save locally, reopen faithfully and retain all query constraints on another request', async () => {
  seed();
  let view = await openPlanner();
  assert.equal(input(view, '开始时间').value, '12:00');
  assert.equal(input(view, '整趟总预算 $').value, '180');
  fireEvent.change(input(view, '开始时间'), { target: { value: '11:30' } });
  fireEvent.change(input(view, '整趟总预算 $'), { target: { value: '220.25' } });
  fireEvent.change(timingInputs(view, '停留（分钟）')[1], { target: { value: '40' } });
  await act(async () => { fireEvent.click(editor(view).getByRole('button', { name: '更新这份计划' })); });
  const stored: SavedPlan = JSON.parse(localStorage.getItem(GUEST_PLANNER_KEY)!).plans[0];
  assert.equal(stored.version, 2);
  assert.deepEqual(stored.details, { ...savedDetails(), startTime: '11:30', totalBudgetUsd: 220.25,
    stopSettings: [savedDetails().stopSettings[0], { ...savedDetails().stopSettings[1], durationMinutes: 40 }] });
  view.unmount();
  view = await openPlanner();
  assert.equal(input(view, '开始时间').value, '11:30');
  assert.equal(input(view, '整趟总预算 $').value, '220.25');
  assert.deepEqual(timingInputs(view, '停留（分钟）').map(field => field.value), ['45', '40']);
  const bodies: { filters: PlanFilters }[] = [];
  api.request = async (endpoint, options) => { assert.equal(endpoint, '/planner/recommend'); const body = JSON.parse(String(options?.body)); bodies.push(body); return response(body.filters); };
  await act(async () => { fireEvent.click(view.getByRole('button', { name: '帮我挑选方案' })); });
  assert.deepEqual(bodies[0].filters, constraints);
  fireEvent.change(view.getByLabelText('每人门票预算 $'), { target: { value: '25' } });
  await act(async () => { fireEvent.click(view.getByRole('button', { name: '帮我挑选方案' })); });
  const changedFilters: PlanFilters = { ...constraints, budget: 25, budgetScope: 'person' }; delete changedFilters.freeOnly;
  assert.deepEqual(bodies[1].filters, changedFilters);
});

test('replacing one stop keeps other stops and estimates, undo restores it and later edits invalidate undo', async () => {
  const plan = savedPlan(); delete plan.details!.constraints; seed(plan);
  const view = await openPlanner();
  const original = selectedLinks(view);
  fireEvent.click(editor(view).getAllByRole('button', { name: '替换此站' })[1]);
  const replacement = view.container.querySelector('[id="catalog-place:palace"]')!;
  assert.ok(replacement);
  fireEvent.click(within(replacement as HTMLElement).getByRole('button', { name: '替换选中站点' }));
  assert.equal(selectedLinks(view)[0], original[0]);
  assert.notEqual(selectedLinks(view)[1], original[1]);
  assert.equal(input(view, '开始时间').value, '12:00');
  assert.equal(input(view, '同行总人数').value, '4');
  assert.equal(input(view, '整趟总预算 $').value, '180');
  assert.equal(timingInputs(view, '停留（分钟）')[0].value, '45');
  fireEvent.click(editor(view).getByRole('button', { name: '撤销上次调整' }));
  assert.deepEqual(selectedLinks(view), original);
  assert.deepEqual(timingInputs(view, '停留（分钟）').map(field => field.value), ['45', '30']);
  fireEvent.click(editor(view).getAllByRole('button', { name: '移除此站' })[1]);
  assert.ok(editor(view).getByRole('button', { name: '撤销上次调整' }));
  fireEvent.change(input(view, '整趟总预算 $'), { target: { value: '210' } });
  assert.equal(editor(view).queryByRole('button', { name: '撤销上次调整' }), null);
  assert.equal(input(view, '整趟总预算 $').value, '210');
});

test('invalid stop minutes block calendar export and remain editable so the user can recover', async () => {
  const plan = savedPlan(); delete plan.details!.constraints; seed(plan);
  const view = await openPlanner();
  for (const invalid of ['-5', '5.5', '0']) {
    fireEvent.change(timingInputs(view, '停留（分钟）')[0], { target: { value: invalid } });
    assert.equal((editor(view).getByRole('button', { name: '导出计划到日历' }) as HTMLButtonElement).disabled, true);
    assert.match(view.container.querySelector('.planner-conflicts')?.textContent || '', /整数分钟/);
    const field = timingInputs(view, '停留（分钟）')[0];
    assert.equal(field.value, invalid, 'invalid input must remain visible and correctable');
    fireEvent.change(field, { target: { value: '45' } });
    assert.equal((editor(view).getByRole('button', { name: '导出计划到日历' }) as HTMLButtonElement).disabled, false);
  }
});

test('changing the party and transport keeps saved constraints and later recommendations in sync', async () => {
  seed();
  let view = await openPlanner();
  fireEvent.change(input(view, '同行总人数'), { target: { value: '6' } });
  fireEvent.change(editor(view).getByLabelText('这份计划的交通方式'), { target: { value: 'walk' } });
  fireEvent.change(input(view, '整趟总预算 $'), { target: { value: '240' } });
  assert.equal((view.getByLabelText('出行方式') as HTMLSelectElement).value, 'walk');
  await act(async () => { fireEvent.click(editor(view).getByRole('button', { name: '更新这份计划' })); });
  const stored: SavedPlan = JSON.parse(localStorage.getItem(GUEST_PLANNER_KEY)!).plans[0];
  assert.equal(stored.details?.partySize, 6);
  assert.equal(stored.details?.travelMode, 'walk');
  assert.deepEqual(stored.details?.constraints, { ...constraints, partySize: 6, travelMode: 'walk' });
  assert.equal(stored.details?.constraints?.budget, 100, 'trip spending must not replace the admission filter');
  view.unmount(); view = await openPlanner();
  assert.equal(input(view, '同行总人数').value, '6');
  assert.equal((view.getByLabelText('出行方式') as HTMLSelectElement).value, 'walk');
  assert.equal((editor(view).getByLabelText('这份计划的交通方式') as HTMLSelectElement).value, 'walk');
  let requested: PlanFilters | undefined;
  api.request = async (endpoint, options) => {
    assert.equal(endpoint, '/planner/recommend');
    requested = JSON.parse(String(options?.body)).filters;
    return response(requested!);
  };
  await act(async () => { fireEvent.click(view.getByRole('button', { name: '帮我挑选方案' })); });
  assert.deepEqual(requested, { ...constraints, partySize: 6, travelMode: 'walk' });
});

test('removing a stop also removes its invalid timing so the remaining plan can be saved', async () => {
  const plan = savedPlan(); delete plan.details!.constraints; seed(plan);
  const view = await openPlanner();
  fireEvent.change(timingInputs(view, '停留（分钟）')[0], { target: { value: '-5' } });
  assert.equal((editor(view).getByRole('button', { name: '导出计划到日历' }) as HTMLButtonElement).disabled, true);
  fireEvent.click(editor(view).getAllByRole('button', { name: '移除此站' })[0]);
  assert.equal(timingInputs(view, '停留（分钟）').length, 1);
  assert.equal(timingInputs(view, '停留（分钟）')[0].value, '30');
  assert.equal((editor(view).getByRole('button', { name: '导出计划到日历' }) as HTMLButtonElement).disabled, false);
  await act(async () => { fireEvent.click(editor(view).getByRole('button', { name: '更新这份计划' })); });
  const stored: SavedPlan = JSON.parse(localStorage.getItem(GUEST_PLANNER_KEY)!).plans[0];
  assert.deepEqual(stored.stops, [stops[1]]);
  assert.deepEqual(stored.details?.stopSettings, [savedDetails().stopSettings[1]]);
});

test('account save sends compatible details and blocks editor mutations until the response arrives', async () => {
  const plan = savedPlan();
  let resolve!: (value: { plan: SavedPlan }) => void;
  const pending = new Promise<{ plan: SavedPlan }>(done => { resolve = done; });
  const writes: { endpoint: string; method: string; body: Record<string, unknown> }[] = [];
  api.request = async (endpoint, options) => {
    if (endpoint === '/planner/me') return library([plan]);
    writes.push({ endpoint, method: String(options?.method), body: JSON.parse(String(options?.body)) });
    return pending;
  };
  const view = await openPlanner('?edit=details-plan', true);
  fireEvent.change(input(view, '整趟总预算 $'), { target: { value: '240' } });
  await act(async () => { fireEvent.click(editor(view).getByRole('button', { name: '更新这份计划' })); });
  assert.equal(writes.length, 1);
  assert.equal(writes[0].endpoint, '/planner/plans/details-plan');
  assert.equal(writes[0].method, 'PUT');
  assert.deepEqual(writes[0].body, { title: plan.title, date, stops, version: 1, details: { ...savedDetails(), totalBudgetUsd: 240 } });
  for (const label of ['计划名称', '日期', '开始时间', '整趟总预算 $']) assert.equal(input(view, label).matches(':disabled'), true, label);
  assert.equal(view.getByLabelText('这次想怎么过？').matches(':disabled'), true);
  assert.ok(Array.from(view.container.querySelectorAll('.planner-stops button')).every(button => button.matches(':disabled')));
  await act(async () => { resolve({ plan: { ...plan, details: { ...savedDetails(), totalBudgetUsd: 240 }, version: 2 } }); });
  assert.equal(input(view, '整趟总预算 $').matches(':disabled'), false);
  assert.equal(input(view, '整趟总预算 $').value, '240');
  assert.equal(localStorage.getItem(GUEST_PLANNER_KEY), null, 'account details must not enter guest storage');
});
