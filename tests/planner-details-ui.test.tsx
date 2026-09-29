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
afterEach(() => { cleanup(); api.request = originalRequest; localStorage.clear(); });

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
