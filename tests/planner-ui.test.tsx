import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import React from 'react';
import { JSDOM } from 'jsdom';
import type { Recommendations } from '../src/lib/planner';

const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'https://www.baylink.us/plan' });
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage,
  HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { render, cleanup, fireEvent, act, within } = await import('@testing-library/react');
const { MemoryRouter, Routes, Route } = await import('react-router-dom');
const { default: PlannerPage } = await import('../src/pages/PlannerPage');
const { default: MyWeekPage } = await import('../src/pages/MyWeekPage');
const { api } = await import('../src/lib/api');
const { PLANNER_EVENTS, PLANNER_PLACES } = await import('../src/data/planner-catalog');
const { GUEST_PLANNER_KEY } = await import('../src/lib/planner-library');
const originalRequest = api.request;

// This published event spans three days: the requested day is deliberately not its first day.
const event = PLANNER_EVENTS.find(row => row.id === 'ai-conference-sf-2026')!;
const requestedDate = '2026-09-30';
const response = (): Recommendations => ({
  ok: true, responseMode: 'rules', filters: { date: requestedDate, region: 'sf' },
  checkedAt: '2026-09-23', notices: [],
  suggestions: [{
    id: 'ai-conference-second-day', date: requestedDate, eventId: event.id,
    placeIds: ['chinatown'], reason: '所选日期在大会期间，之后可以到唐人街散步。',
    reasons: ['所选日期在大会期间，之后可以到唐人街散步。'], unknowns: ['请先核对票种。'],
  }],
});
type View = ReturnType<typeof render>;
const editor = (view: View) => within(view.getByRole('complementary'));
const mapCount = (view: View) => Number(view.container.querySelector('.planner-workspace .planner-section-head > span')?.textContent?.trim());
const eventCard = (view: View) => view.container.querySelector(`[id="catalog-event:${event.id}"]`);

async function openPlanner(search = '') {
  let view!: View;
  await act(async () => {
    view = render(<MemoryRouter initialEntries={['/plan' + search]}><Routes>
      <Route path="/plan" element={<PlannerPage />} />
      <Route path="/my-week" element={<MyWeekPage />} />
    </Routes></MemoryRouter>);
  });
  return view;
}
async function ask(view: View) {
  await act(async () => { fireEvent.click(view.getByRole('button', { name: '帮我挑选方案' })); });
  assert.ok(view.getByRole('heading', { name: '有依据的出游建议' }));
}

beforeEach(context => {
  context.mock.method(globalThis, 'fetch', async () => new Response('{}'));
  context.mock.timers.enable({ apis: ['Date'], now: new Date('2026-09-23T19:00:00Z') });
  localStorage.clear();
  api.request = async () => { throw new Error('Unexpected API call in guest planner test'); };
});
afterEach(() => { cleanup(); api.request = originalRequest; localStorage.clear(); });

test('starting a text-parsed suggestion keeps its requested day inside a multi-day event', async () => {
  assert.notEqual(event.startDate, requestedDate);
  assert.ok(event.startDate < requestedDate && requestedDate <= event.endDate);
  const requests: { endpoint: string; body: Record<string, unknown> }[] = [];
  api.request = async (endpoint, options) => {
    requests.push({ endpoint, body: JSON.parse(String(options?.body)) });
    assert.equal(endpoint, '/planner/recommend');
    return response();
  };
  const view = await openPlanner();
  fireEvent.change(view.getByLabelText('这次想怎么过？'), { target: { value: '9 月 30 日在旧金山参加 AI 大会，再逛一个地方。' } });
  assert.equal((view.getByLabelText('出游日期') as HTMLInputElement).value, '', 'the date initially exists only in the natural-language request');
  await ask(view);
  fireEvent.click(view.getByRole('button', { name: '用这个方案开始' }));
  assert.equal((view.getByLabelText('出游日期') as HTMLInputElement).value, requestedDate);
  assert.equal((editor(view).getByLabelText('日期') as HTMLInputElement).value, requestedDate);
  assert.equal(editor(view).getAllByRole('listitem').length, 2);
  await act(async () => { fireEvent.click(editor(view).getByRole('button', { name: '保存这份计划' })); });
  const stored = JSON.parse(localStorage.getItem(GUEST_PLANNER_KEY)!);
  assert.equal(stored.plans[0].date, requestedDate, 'saving must preserve the suggested day, not the conference opening day');
  assert.equal(stored.plans[0].stops[0].id, event.id);
  assert.equal(requests.length, 1, 'a guest save must not write to account APIs');
  assert.match(String(requests[0].body.message), /9 月 30 日/);
});

test('changing region or date clears previous suggestions and removes their event from map/list results', async () => {
  let recommendations = 0;
  api.request = async endpoint => {
    assert.equal(endpoint, '/planner/recommend');
    recommendations++;
    return response();
  };
  const view = await openPlanner();
  await ask(view);
  assert.ok(eventCard(view));
  assert.ok(event.location, 'the old suggestion must have a real map point to exercise this regression');

  fireEvent.change(view.getByLabelText('地区'), { target: { value: 'north-bay' } });
  assert.equal(view.queryByRole('heading', { name: '有依据的出游建议' }), null);
  assert.equal(view.queryByRole('button', { name: '用这个方案开始' }), null);
  assert.equal(eventCard(view), null, 'an SF suggestion must no longer drive the North Bay catalog');
  assert.equal(mapCount(view), PLANNER_PLACES.filter(place => place.region === 'north-bay' && place.location).length,
    'the North Bay map must contain its verified places, without the stale SF event pin');
  assert.equal(recommendations, 1, 'editing a filter does not silently issue another recommendation request');

  fireEvent.change(view.getByLabelText('地区'), { target: { value: 'sf' } });
  await ask(view);
  assert.ok(eventCard(view));
  fireEvent.change(view.getByLabelText('出游日期'), { target: { value: '2026-10-02' } });
  assert.equal(view.queryByRole('heading', { name: '有依据的出游建议' }), null);
  assert.equal(eventCard(view), null, 'the old conference ended before the new date');
  assert.equal(mapCount(view), PLANNER_PLACES.filter(place => place.region === 'sf' && place.location).length,
    'the date change must also remove the old conference map point');
  assert.equal(recommendations, 2);
});

test('a shared query restores at most three public stops and a guest can save and reopen them in My Week', async () => {
  const query = new URLSearchParams({
    date: requestedDate,
    stops: `event:${event.id},place:golden-gate,place:pier39,place:chinatown,event:${event.id}`,
  });
  const view = await openPlanner('?' + query.toString());
  const stopLinks = () => editor(view).getAllByRole('listitem').map(item => within(item).getByRole('link').getAttribute('href'));
  assert.deepEqual(stopLinks(), [`/events/${event.id}`, '/guides/sf-golden-gate-bridge-fort-point-guide', '/guides/sf-fishermans-wharf-pier39-guide']);
  assert.equal((editor(view).getByLabelText('日期') as HTMLInputElement).value, requestedDate);
  const publicLink = new URL(editor(view).getByRole('link', { name: '打开公开分享链接 ↗' }).getAttribute('href')!);
  assert.equal(publicLink.searchParams.get('stops')!.split(',').length, 3);
  assert.ok(!publicLink.searchParams.get('stops')!.includes('chinatown'));
  fireEvent.change(editor(view).getByLabelText('计划名称'), { target: { value: '我的 AI 与海滨一天' } });
  await act(async () => { fireEvent.click(editor(view).getByRole('button', { name: '保存这份计划' })); });
  assert.match(editor(view).getByRole('status').textContent || '', /已保存到这个浏览器/);
  const raw = localStorage.getItem(GUEST_PLANNER_KEY);
  assert.ok(raw, 'the actual browser storage must contain the saved guest plan');
  const stored = JSON.parse(raw);
  assert.equal(stored.plans.length, 1);
  assert.equal(stored.plans[0].title, '我的 AI 与海滨一天');
  assert.equal(stored.plans[0].date, requestedDate);
  assert.deepEqual(stored.plans[0].stops, [
    { kind: 'event', id: event.id }, { kind: 'place', id: 'golden-gate' }, { kind: 'place', id: 'pier39' },
  ]);
  await act(async () => { fireEvent.click(view.getByRole('link', { name: '我的这周' })); });
  const card = view.getByRole('heading', { name: '我的 AI 与海滨一天' }).closest('article')!;
  assert.equal(within(card).getAllByRole('listitem').length, 3);
  assert.equal(card.querySelector('time')?.getAttribute('datetime'), requestedDate);
  assert.ok(within(card).getByRole('link', { name: '继续编辑' }));
});

test('a shared event cannot be saved on an unconfirmed day inside its date range', async () => {
  const fleet = PLANNER_EVENTS.find(row => row.id === 'san-francisco-fleet-week-2026')!;
  const query = new URLSearchParams({ date: '2026-10-05', stops: `event:${fleet.id}` });
  const view = await openPlanner('?' + query.toString());
  assert.equal(view.container.querySelector(`[id="catalog-event:${fleet.id}"]`), null);
  await act(async () => { fireEvent.click(editor(view).getByRole('button', { name: '保存这份计划' })); });
  assert.match(editor(view).getByRole('status').textContent || '', /计划日期与所选活动不一致/);
  assert.equal(JSON.parse(localStorage.getItem(GUEST_PLANNER_KEY) || '{"plans":[]}').plans.length, 0);
  fireEvent.change(editor(view).getByLabelText('日期'), { target: { value: '2026-10-06' } });
  await act(async () => { fireEvent.click(editor(view).getByRole('button', { name: '保存这份计划' })); });
  assert.equal(JSON.parse(localStorage.getItem(GUEST_PLANNER_KEY)!).plans[0].date, '2026-10-06');
});
