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
const { MemoryRouter, Routes, Route, Outlet, useLocation, useNavigate } = await import('react-router-dom');
const { default: PlannerPage } = await import('../src/pages/PlannerPage');
const { api } = await import('../src/lib/api');
const { EMPTY_LIBRARY, stopTitle, stopPath } = await import('../src/lib/planner');
const { PLANNER_PLACES } = await import('../src/data/planner-catalog');
const { buildItinerary, defaultPlanDetails } = await import('../src/lib/planner-itinerary');
const { GUEST_PLANNER_KEY } = await import('../src/lib/planner-library');
const { setLocale } = await import('../src/i18n/locale');
const originalRequest = api.request;
const date = '2026-10-03';
const gotts = PLANNER_PLACES.find(place => place.id === 'restaurant-gotts-ferry-building')!;
const stops: Stop[] = [{ kind: 'place', id: 'golden-gate' }, { kind: 'place', id: 'chinatown' }];
const constraints: PlanFilters = { date, region: 'sf', city: 'San Francisco', budget: 80, budgetScope: 'total', partySize: 4,
  childAge: 5, childAges: [5, 12], setting: 'any', travelMode: 'transit', freeOnly: true, topic: 'arts' };
const savedDetails = (): PlanDetails => ({ ...defaultPlanDetails(), startTime: '10:00', finishBy: '18:00', partySize: 4,
  totalBudgetUsd: 180, extraCostUsd: 52.5, costBreakdown: { foodUsd: 35, transportUsd: 12, otherUsd: 5.5 },
  travelMode: 'transit', constraints: structuredClone(constraints),
  stopSettings: [{ ...stops[0], durationMinutes: 45, travelMinutes: 10, fixedStartTime: '11:00' },
    { ...stops[1], durationMinutes: 30, travelMinutes: 20, breakBeforeMinutes: 15, breakLabel: 'rest' }],
});
const savedPlan = (): SavedPlan => ({ id: 'round3-existing-plan', title: 'Our private family afternoon', date,
  stops: structuredClone(stops), details: savedDetails(), version: 1, createdAt: '2026-09-29T19:00:00Z', updatedAt: '2026-09-29T19:00:00Z' });
function seed(plan = savedPlan()) { localStorage.setItem(GUEST_PLANNER_KEY, JSON.stringify({ ...structuredClone(EMPTY_LIBRARY), plans: [plan] })); }
const stored = (): Library => JSON.parse(localStorage.getItem(GUEST_PLANNER_KEY)!);
const recommendations = (placeId = gotts.id): Recommendations => ({ ok: true, responseMode: 'rules', checkedAt: '2026-09-29',
  filters: { date, region: 'sf', city: 'San Francisco', partySize: 2, travelMode: 'walk' }, suggestions: [], notices: [],
  placeSuggestions: [{ id: `${placeId}-suggestion`, date, placeId, reason: '官方地点资料与所选地区匹配。', reasons: ['官方地点资料与所选地区匹配。'], unknowns: ['实际消费待确认。'], budgetStatus: 'unknown' }],
});

type View = ReturnType<typeof render>;
const editor = (view: View) => within(view.getByRole('complementary'));
const field = (view: View, label: string) => editor(view).getByLabelText(label) as HTMLInputElement;
const selectedLinks = (view: View) => Array.from(view.container.querySelectorAll('.planner-stops > li > a')).map(link => link.getAttribute('href'));
const editPanel = (view: View) => within(editor(view).getByRole('region', { name: '一句话修改计划' }));
const snapshot = (view: View) => ({ links: selectedLinks(view), inputs: Array.from(view.container.querySelectorAll('.planner-editor input, .planner-schedule select')).map(element => {
  const input = element as HTMLInputElement; return [input.type, input.value, input.type === 'checkbox' ? input.checked : null];
}) });
function LocationProbe() {
  const location = useLocation();
  const navigate = useNavigate();
  const changeQuery = (patch: Record<string, string | null>) => {
    const params = new URLSearchParams(location.search);
    for (const [key, value] of Object.entries(patch)) { if (value === null) params.delete(key); else params.set(key, value); }
    navigate({ pathname: location.pathname, search: params.toString(), hash: location.hash });
  };
  return <div hidden><output data-testid="round3-location">{location.pathname + location.search + location.hash}</output>
    <button type="button" data-testid="round3-lang-en" onClick={() => changeQuery({ lang: 'en' })}>Navigate to English URL</button>
    <button type="button" data-testid="round3-lang-hant" onClick={() => changeQuery({ lang: 'zh-Hant' })}>Navigate to Traditional Chinese URL</button>
    <button type="button" data-testid="round3-remove-auto" onClick={() => changeQuery({ auto: null })}>Remove auto query parameter</button>
    <button type="button" data-testid="round3-public-date" onClick={() => changeQuery({ edit: null, date: '2026-10-04' })}>Open another public date</button>
    <button type="button" data-testid="round3-public-stops" onClick={() => changeQuery({ edit: null, stops: 'place:chinatown,place:palace' })}>Open other public stops</button>
  </div>;
}
async function open(search = '') {
  let view!: View;
  await act(async () => { view = render(<MemoryRouter initialEntries={['/plan' + search]}><LocationProbe /><Routes><Route path="/plan" element={<PlannerPage />} /></Routes></MemoryRouter>); });
  return view;
}
async function ask(view: View, replace = false) {
  await act(async () => { fireEvent.click(view.getByRole('button', { name: replace ? '换一批' : '帮我挑选方案' })); });
}
function preview(view: View, message = '晚一小时出发') {
  fireEvent.change(editPanel(view).getByLabelText('想怎样修改？'), { target: { value: message } });
  fireEvent.click(editPanel(view).getByRole('button', { name: '预览修改' }));
}
beforeEach(async context => {
  context.mock.method(globalThis, 'fetch', async () => new Response('{}'));
  context.mock.timers.enable({ apis: ['Date'], now: new Date('2026-09-29T19:00:00Z') });
  localStorage.clear();
  await setLocale('zh-Hans', false);
  api.request = async endpoint => { throw new Error(`Unexpected API call: ${endpoint}`); };
});
afterEach(() => { cleanup(); localStorage.clear(); api.request = originalRequest; });

test('place-only restaurant recommendations can start and adopt an outing without showing a no-match message', async () => {
  assert.ok(gotts);
  api.request = async endpoint => { assert.equal(endpoint, '/planner/recommend'); return recommendations(); };
  const view = await open(`?date=${date}&stops=place:golden-gate`);
  await ask(view);
  assert.equal(view.queryByText(/没有完全符合条件的活动或地点/), null);
  const recommendation = view.container.querySelector('.planner-place-options .planner-option') as HTMLElement;
  assert.ok(recommendation);
  assert.ok(within(recommendation).getByRole('heading', { name: gotts.title }));
  assert.ok(within(recommendation).getByText('费用待核实 · 备选'));
  fireEvent.click(within(recommendation).getByRole('button', { name: '以这里为起点' }));
  assert.deepEqual(selectedLinks(view), [stopPath({ kind: 'place', id: gotts.id })]);
  assert.equal(field(view, '日期').value, date);
  assert.equal(field(view, '同行总人数').value, '2');
  assert.equal((editor(view).getByLabelText('这份计划的交通方式') as HTMLSelectElement).value, 'walk');
  fireEvent.click(editor(view).getByRole('button', { name: '撤销上次调整' }));
  assert.deepEqual(selectedLinks(view), [stopPath(stops[0])]);
  await ask(view);
  const card = view.container.querySelector('.planner-place-options .planner-option') as HTMLElement;
  const outing = within(card).getByRole('region', { name: '搭配完整出行' });
  fireEvent.click(within(outing).getByRole('button', { name: '采用这个完整方案' }));
  assert.ok(selectedLinks(view).length >= 2);
  assert.ok(selectedLinks(view).includes(gotts.officialUrl));
  assert.ok(selectedLinks(view).every(path => !path?.startsWith('/events/')), 'a place anchor must never become a fabricated event');
  fireEvent.change(field(view, '餐饮预留（整组）$'), { target: { value: '44' } });
  await act(async () => { fireEvent.click(editor(view).getByRole('button', { name: '保存这份计划' })); });
  const plan = stored().plans[0];
  assert.ok(plan.stops.some(stop => stop.kind === 'place' && stop.id === gotts.id));
  assert.equal(plan.details?.partySize, 2);
  assert.equal(plan.details?.costBreakdown?.foodUsd, 44);
  assert.deepEqual(buildItinerary(plan.stops, plan.details!, date).issues, []);
});

test('another batch sends cumulative place exclusions and a fresh search resets them', async () => {
  const calls: { excludePlaceIds: string[]; excludeEventIds: string[] }[] = [];
  api.request = async (endpoint, options) => {
    assert.equal(endpoint, '/planner/recommend');
    calls.push(JSON.parse(String(options?.body)));
    return recommendations(calls.length === 1 ? gotts.id : 'venue-exploratorium-daytime');
  };
  const view = await open(`?date=${date}`);
  await ask(view); await ask(view, true); await ask(view, true); await ask(view);
  assert.deepEqual(calls.map(call => call.excludePlaceIds), [[], [gotts.id], [gotts.id, 'venue-exploratorium-daytime'], []]);
  assert.ok(calls.every(call => call.excludeEventIds.length === 0), 'place-only recommendations do not turn place IDs into event exclusions');
});

test('editing an existing plan previews without mutation, applies, undoes, and saves every unrelated detail', async () => {
  const original = savedPlan(); seed(original);
  let view = await open(`?edit=${original.id}`);
  const before = snapshot(view);
  preview(view);
  const proposal = editPanel(view).getByRole('region', { name: '修改预览' });
  assert.match(proposal.textContent!, /11:00/);
  assert.deepEqual(snapshot(view), before, 'preview does not change the live schedule or stops');
  assert.deepEqual(stored().plans[0], original, 'preview does not save or mutate browser data');
  assert.equal((within(proposal).getByRole('button', { name: '采用修改' }) as HTMLButtonElement).disabled, false);
  fireEvent.click(within(proposal).getByRole('button', { name: '采用修改' }));
  assert.equal(field(view, '开始时间').value, '11:00');
  assert.equal(field(view, '希望几点结束').value, '19:00');
  assert.deepEqual(stored().plans[0], original, 'applying changes only edits the draft until the user saves');
  assert.equal(field(view, '计划名称').value, original.title);
  fireEvent.click(editor(view).getByRole('button', { name: '撤销上次调整' }));
  assert.deepEqual(snapshot(view), before);
  preview(view);
  fireEvent.click(editPanel(view).getByRole('button', { name: '采用修改' }));
  await act(async () => { fireEvent.click(editor(view).getByRole('button', { name: '更新这份计划' })); });
  const plan = stored().plans[0];
  assert.equal(stored().plans.length, 1);
  assert.equal(plan.id, original.id);
  assert.equal(plan.version, 2);
  assert.equal(plan.title, original.title);
  assert.equal(plan.date, original.date);
  assert.deepEqual(plan.stops, original.stops);
  assert.deepEqual(plan.details, { ...savedDetails(), startTime: '11:00', finishBy: '19:00',
    stopSettings: [{ ...savedDetails().stopSettings[0], fixedStartTime: '12:00' }, savedDetails().stopSettings[1]] });
  view.unmount(); view = await open(`?edit=${plan.id}`);
  assert.equal(field(view, '开始时间').value, '11:00');
  assert.equal(field(view, '同行总人数').value, '4');
  assert.equal(field(view, '整趟总预算 $').value, '180');
  assert.equal(field(view, '餐饮预留（整组）$').value, '35');
  assert.equal(field(view, '交通与停车预留（整组）$').value, '12');
  assert.equal(field(view, '其他预留（整组）$').value, '5.5');
});

test('manual date and time changes invalidate an existing proposal so it cannot apply to a different draft', async () => {
  seed(); const view = await open('?edit=round3-existing-plan');
  preview(view);
  assert.ok(editPanel(view).getByRole('region', { name: '修改预览' }));
  fireEvent.change(field(view, '日期'), { target: { value: '2026-10-04' } });
  assert.equal(editPanel(view).queryByRole('region', { name: '修改预览' }), null);
  assert.equal(editPanel(view).queryByRole('button', { name: '采用修改' }), null);
  assert.equal(field(view, '开始时间').value, '10:00');
  preview(view);
  assert.ok(editPanel(view).getByRole('region', { name: '修改预览' }));
  fireEvent.change(field(view, '开始时间'), { target: { value: '10:30' } });
  assert.equal(editPanel(view).queryByRole('region', { name: '修改预览' }), null);
  assert.equal(editPanel(view).queryByRole('button', { name: '采用修改' }), null);
  assert.equal(field(view, '日期').value, '2026-10-04');
  assert.equal(field(view, '开始时间').value, '10:30');
  assert.deepEqual(stored().plans[0], savedPlan(), 'manual draft edits and expired proposals do not silently save');
});

test('locking a later stop blocks deleting an earlier stop when that would indirectly change its arrival time', async () => {
  seed(); const view = await open('?edit=round3-existing-plan');
  const before = snapshot(view);
  const lock = editPanel(view).getByLabelText(stopTitle(stops[1])) as HTMLInputElement;
  fireEvent.click(lock);
  assert.equal(lock.checked, true);
  preview(view, '删除第1站');
  assert.match(editPanel(view).getByRole('status').textContent!, /会改变锁定站/);
  assert.equal(editPanel(view).queryByRole('button', { name: '采用修改' }), null);
  assert.deepEqual(selectedLinks(view), before.links);
  assert.equal(field(view, '开始时间').value, '10:00');
  assert.deepEqual(stored().plans[0], savedPlan());
  fireEvent.click(lock);
  preview(view, '删除第1站');
  const proposal = editPanel(view).getByRole('region', { name: '修改预览' });
  assert.equal((within(proposal).getByRole('button', { name: '采用修改' }) as HTMLButtonElement).disabled, false);
  fireEvent.click(within(proposal).getByRole('button', { name: '采用修改' }));
  assert.deepEqual(selectedLinks(view), [stopPath(stops[1])]);
  fireEvent.click(editor(view).getByRole('button', { name: '撤销上次调整' }));
  assert.deepEqual(snapshot(view), before);
});

test('search examples, clearing saved filters and changing the search date leave an existing draft intact', async () => {
  for (const action of ['example', 'clear', 'search-date']) {
    const plan = savedPlan(); seed(plan);
    const view = await open(`?edit=${plan.id}`);
    const before = snapshot(view);
    if (action === 'example') fireEvent.click(view.getByRole('button', { name: '明天在旧金山找家餐厅，再去附近逛逛' }));
    else if (action === 'clear') fireEvent.click(view.getByRole('button', { name: '清除沿用条件' }));
    else fireEvent.change(view.getByLabelText('出游日期'), { target: { value: '2026-10-04' } });
    assert.deepEqual(snapshot(view), before, `${action} only changes the search, not the plan date, stops, title or details`);
    assert.equal(field(view, '日期').value, date);
    assert.deepEqual(stored().plans[0], plan);
    view.unmount();
  }
});

test('adopting a new starting point or complete outing aborts older recommendations and ignores late responses', async () => {
  for (const action of ['start', 'outing']) {
    let resolve!: (value: Recommendations) => void;
    const pending = new Promise<Recommendations>(done => { resolve = done; });
    let signal!: AbortSignal; let calls = 0;
    api.request = async (endpoint, options) => {
      assert.equal(endpoint, '/planner/recommend');
      calls++;
      if (calls === 1) return recommendations();
      signal = options!.signal as AbortSignal;
      return pending;
    };
    const view = await open(`?date=${date}&stops=place:golden-gate`);
    await ask(view);
    act(() => { fireEvent.click(view.getByRole('button', { name: '换一批' })); });
    assert.equal(signal.aborted, false);
    const card = view.container.querySelector('.planner-place-options .planner-option') as HTMLElement;
    fireEvent.click(within(card).getByRole('button', { name: action === 'start' ? '以这里为起点' : '采用这个完整方案' }));
    assert.equal(signal.aborted, true, `${action} cancels the in-flight recommendation`);
    const adopted = snapshot(view);
    assert.ok(adopted.links.includes(gotts.officialUrl));
    if (action === 'start') assert.equal(adopted.links.length, 1);
    else assert.ok(adopted.links.length >= 2);
    const late = recommendations('venue-exploratorium-daytime');
    late.placeSuggestions![0].reasons = ['Late result that must never appear'];
    await act(async () => { resolve(late); });
    assert.equal(view.queryByText('Late result that must never appear'), null);
    assert.deepEqual(snapshot(view), adopted, 'the late response cannot replace the selected draft');
    assert.equal(calls, 2);
    view.unmount();
  }
});

test('leaving an account aborts its request and clears its search, budget and age for guests or another account', async () => {
  for (const nextOwner of [undefined, 'account-b']) {
    let resolve!: (value: Recommendations) => void;
    const pending = new Promise<Recommendations>(done => { resolve = done; });
    let signal!: AbortSignal; let requests = 0;
    api.request = async (endpoint, options) => {
      if (endpoint === '/planner/me') return structuredClone(EMPTY_LIBRARY);
      assert.equal(endpoint, '/planner/recommend');
      requests++;
      if (requests === 1) return recommendations();
      signal = options!.signal as AbortSignal;
      return pending;
    };
    const tree = (owner?: string) => {
      const app = { user: owner ? { id: owner, token: `test-token-${owner}` } : undefined,
        setShowLogin: () => {}, showToast: () => {} } as unknown as AppContextValue;
      return <MemoryRouter initialEntries={[`/plan?date=${date}&stops=place:golden-gate`]}><Routes>
        <Route element={<Outlet context={app} />}><Route path="/plan" element={<PlannerPage />} /></Route>
      </Routes></MemoryRouter>;
    };
    localStorage.setItem('currentUser', JSON.stringify({ id: 'account-a', token: 'test-token-account-a' }));
    let view!: View;
    await act(async () => { view = render(tree('account-a')); });
    fireEvent.change(view.getByLabelText('这次想怎么过？'), { target: { value: 'Account A private search request' } });
    fireEvent.change(view.getByLabelText('每人门票预算 $'), { target: { value: '25' } });
    fireEvent.change(view.getByLabelText('同行孩子年龄'), { target: { value: '5' } });
    fireEvent.change(field(view, '计划名称'), { target: { value: 'Account A private draft' } });
    await ask(view);
    assert.ok(view.getByRole('heading', { name: '有依据的出游建议' }));
    act(() => { fireEvent.click(view.getByRole('button', { name: '换一批' })); });
    assert.equal(signal.aborted, false);
    if (nextOwner) localStorage.setItem('currentUser', JSON.stringify({ id: nextOwner, token: `test-token-${nextOwner}` }));
    else localStorage.removeItem('currentUser');
    await act(async () => { view.rerender(tree(nextOwner)); });
    assert.equal(signal.aborted, true);
    assert.equal(view.queryByRole('heading', { name: '有依据的出游建议' }), null);
    assert.equal((view.getByLabelText('每人门票预算 $') as HTMLInputElement).value, '');
    assert.equal((view.getByLabelText('同行孩子年龄') as HTMLInputElement).value, '');
    assert.equal((view.getByLabelText('这次想怎么过？') as HTMLTextAreaElement).value, '');
    assert.notEqual(field(view, '计划名称').value, 'Account A private draft');
    const late = recommendations(); late.placeSuggestions![0].reasons = ['Account A stale private recommendation'];
    await act(async () => { resolve(late); });
    assert.equal(view.queryByText('Account A stale private recommendation'), null);
    assert.equal(view.queryByRole('heading', { name: '有依据的出游建议' }), null);
    assert.equal(requests, 2);
    view.unmount();
  }
});

test('the overview opens the editor by scrolling without changing the URL or rebuilding an unsaved draft', async () => {
  const plan = savedPlan(); seed(plan);
  const view = await open(`?edit=${plan.id}`);
  fireEvent.change(field(view, '计划名称'), { target: { value: 'Unsaved family outing' } });
  fireEvent.change(field(view, '开始时间'), { target: { value: '10:30' } });
  fireEvent.change(field(view, '餐饮预留（整组）$'), { target: { value: '48.25' } });
  const before = snapshot(view);
  const location = view.getByTestId('round3-location').textContent;
  const scrolls: unknown[] = [];
  const target = view.getByRole('complementary');
  Object.defineProperty(target, 'scrollIntoView', { configurable: true, value: (options: unknown) => { scrolls.push(options); } });
  const overview = view.getByRole('region', { name: '当前计划概览' });
  const button = within(overview).getByRole('button', { name: '查看与修改计划 ↓' });
  assert.equal(button.tagName, 'BUTTON', 'an anchor would allow a real browser hash navigation to recreate the draft');
  assert.equal(button.getAttribute('type'), 'button');
  assert.equal(button.getAttribute('href'), null);
  fireEvent.click(button);
  assert.deepEqual(scrolls, [{ behavior: 'smooth', block: 'start' }]);
  assert.equal(view.getByTestId('round3-location').textContent, location);
  assert.deepEqual(snapshot(view), before);
  assert.deepEqual(stored().plans[0], plan, 'scrolling neither saves nor resets the unsaved changes');
});

test('clearing inherited conditions aborts an in-flight recommendation and prevents its late result from returning', async () => {
  const plan = savedPlan(); seed(plan);
  let resolve!: (value: Recommendations) => void;
  const pending = new Promise<Recommendations>(done => { resolve = done; });
  let signal!: AbortSignal; let requests = 0;
  api.request = async (endpoint, options) => {
    assert.equal(endpoint, '/planner/recommend');
    requests++;
    if (requests === 1) return recommendations();
    signal = options!.signal as AbortSignal;
    return pending;
  };
  const view = await open(`?edit=${plan.id}`);
  const before = snapshot(view);
  await ask(view);
  assert.ok(view.getByRole('heading', { name: '有依据的出游建议' }));
  act(() => { fireEvent.click(view.getByRole('button', { name: '换一批' })); });
  assert.equal(signal.aborted, false);
  fireEvent.click(view.getByRole('button', { name: '清除沿用条件' }));
  assert.equal(signal.aborted, true);
  assert.equal(view.queryByRole('heading', { name: '有依据的出游建议' }), null);
  assert.equal((view.getByLabelText('出游日期') as HTMLInputElement).value, '');
  assert.equal((view.getByLabelText('每人门票预算 $') as HTMLInputElement).value, '');
  assert.equal((view.getByLabelText('同行孩子年龄') as HTMLInputElement).value, '');
  assert.equal((view.getByRole('button', { name: '帮我挑选方案' }) as HTMLButtonElement).disabled, false);
  const late = recommendations(); late.placeSuggestions![0].reasons = ['Late cleared recommendation'];
  await act(async () => { resolve(late); });
  assert.equal(view.queryByRole('heading', { name: '有依据的出游建议' }), null);
  assert.equal(view.queryByText('Late cleared recommendation'), null);
  assert.deepEqual(snapshot(view), before);
  assert.deepEqual(stored().plans[0], plan);
  assert.equal(requests, 2);
});

test('URL language switches and removing auto preserve an unsaved plan and its edit message', async () => {
  const plan = savedPlan(); seed(plan);
  const view = await open(`?edit=${plan.id}&lang=zh-Hans&auto=1`);
  fireEvent.change(field(view, '计划名称'), { target: { value: 'Unsaved plan after language navigation' } });
  fireEvent.change(field(view, '日期'), { target: { value: '2026-10-04' } });
  fireEvent.change(field(view, '开始时间'), { target: { value: '10:30' } });
  fireEvent.change(field(view, '餐饮预留（整组）$'), { target: { value: '48.25' } });
  fireEvent.click(editor(view).getAllByRole('button', { name: '移除此站' })[0]);
  fireEvent.change(editPanel(view).getByLabelText('想怎样修改？'), { target: { value: '晚一小时出发' } });
  const before = snapshot(view);
  assert.deepEqual(before.links, [stopPath(stops[1])]);
  for (const [action, expectedLocale] of [['round3-lang-en', 'en'], ['round3-lang-hant', 'zh-Hant'], ['round3-remove-auto', 'zh-Hant']]) {
    await act(async () => { fireEvent.click(view.getByTestId(action)); });
    const location = new URL(view.getByTestId('round3-location').textContent!, 'https://www.baylink.us');
    assert.equal(location.searchParams.get('lang'), expectedLocale);
    if (action === 'round3-remove-auto') assert.equal(location.searchParams.has('auto'), false);
    assert.deepEqual(snapshot(view), before, `${action} must not reload the saved plan or reset the draft`);
    assert.equal((editPanel(view).getByLabelText('想怎样修改？') as HTMLTextAreaElement).value, '晚一小时出发');
    assert.deepEqual(stored().plans[0], plan);
  }
});

test('explicit public date and stop navigation still loads the linked plan instead of retaining an unrelated draft', async () => {
  const view = await open(`?date=${date}&stops=place:golden-gate&lang=en`);
  fireEvent.change(field(view, '计划名称'), { target: { value: 'First unsaved draft' } });
  fireEvent.change(field(view, '同行总人数'), { target: { value: '4' } });
  fireEvent.change(field(view, '餐饮预留（整组）$'), { target: { value: '40' } });
  await act(async () => { fireEvent.click(view.getByTestId('round3-public-date')); });
  assert.equal(field(view, '日期').value, '2026-10-04');
  assert.deepEqual(selectedLinks(view), [stopPath(stops[0])]);
  assert.notEqual(field(view, '计划名称').value, 'First unsaved draft');
  assert.equal(field(view, '同行总人数').value, '1');
  assert.equal(field(view, '餐饮预留（整组）$').value, '0');
  fireEvent.change(field(view, '计划名称'), { target: { value: 'Second unsaved draft' } });
  fireEvent.change(field(view, '开始时间'), { target: { value: '13:00' } });
  fireEvent.change(field(view, '交通与停车预留（整组）$'), { target: { value: '18' } });
  await act(async () => { fireEvent.click(view.getByTestId('round3-public-stops')); });
  assert.equal(field(view, '日期').value, '2026-10-04');
  assert.deepEqual(selectedLinks(view), [stopPath(stops[1]), stopPath({ kind: 'place', id: 'palace' })]);
  assert.notEqual(field(view, '计划名称').value, 'Second unsaved draft');
  assert.equal(field(view, '开始时间').value, defaultPlanDetails().startTime);
  assert.equal(field(view, '交通与停车预留（整组）$').value, '0');
});
