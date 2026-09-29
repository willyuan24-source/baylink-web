import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import React from 'react';
import { JSDOM } from 'jsdom';
import type { Recommendations, SavedPlan } from '../src/lib/planner';

const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'https://www.baylink.us/plan' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage,
  HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { render, cleanup, fireEvent, act, within } = await import('@testing-library/react');
const { MemoryRouter, Routes, Route } = await import('react-router-dom');
const { default: PlannerPage } = await import('../src/pages/PlannerPage');
const { api } = await import('../src/lib/api');
const { PLANNER_PLACES } = await import('../src/data/planner-catalog');
const { buildItinerary } = await import('../src/lib/planner-itinerary');
const { GUEST_PLANNER_KEY } = await import('../src/lib/planner-library');
const originalRequest = api.request;
async function open(search = '') {
  let view!: ReturnType<typeof render>;
  await act(async () => { view = render(<MemoryRouter initialEntries={['/plan' + search]}><Routes><Route path="/plan" element={<PlannerPage />} /></Routes></MemoryRouter>); });
  return view;
}
beforeEach(context => {
  context.mock.method(globalThis, 'fetch', async () => new Response('{}'));
  context.mock.timers.enable({ apis: ['Date'], now: new Date('2026-09-29T19:00:00Z') });
  localStorage.clear();
  api.request = async endpoint => { throw new Error(`Unexpected API call: ${endpoint}`); };
});
afterEach(() => { cleanup(); localStorage.clear(); api.request = originalRequest; });

test('a complete outing can be selected, edited, saved and reopened with its meal and transport allowances', async () => {
  const response: Recommendations = { ok: true, responseMode: 'rules', checkedAt: '2026-09-29', filters: { date: '2026-10-03', city: 'San Francisco', partySize: 2 }, notices: [],
    suggestions: [{ id: 'ferry-oct3', eventId: 'ferry-plaza-farmers-market-2026-autumn', date: '2026-10-03', placeIds: [], reason: 'Official market date', reasons: [], unknowns: [] }] };
  const requests: Record<string, unknown>[] = [];
  api.request = async (endpoint, options) => { assert.equal(endpoint, '/planner/recommend'); requests.push(JSON.parse(String(options?.body))); return response; };
  let view = await open('?date=2026-10-03&stops=place:golden-gate');
  await act(async () => { fireEvent.click(view.getByRole('button', { name: '帮我挑选方案' })); });
  const preview = view.getByRole('region', { name: '搭配完整出行' });
  assert.ok(within(preview).getByText(/餐饮、交通另行预留/));
  fireEvent.click(within(preview).getByRole('button', { name: '采用这个完整方案' }));
  let editor = within(view.getByRole('complementary'));
  assert.ok(within(editor.getByRole('list', { name: '所选地点' })).getAllByRole('listitem').length >= 2);
  assert.equal((editor.getByLabelText('日期') as HTMLInputElement).value, '2026-10-03');
  fireEvent.click(editor.getByRole('button', { name: '撤销上次调整' }));
  assert.equal(within(editor.getByRole('list', { name: '所选地点' })).getAllByRole('listitem').length, 1);
  assert.equal((editor.getByLabelText('同行总人数') as HTMLInputElement).value, '1');
  await act(async () => { fireEvent.click(view.getByRole('button', { name: '帮我挑选方案' })); });
  assert.equal((requests[1].filters as Record<string, unknown>).city, undefined, 'undo must not retain the undone outing city');
  fireEvent.click(view.getByRole('button', { name: '采用这个完整方案' }));
  fireEvent.change(editor.getByLabelText('餐饮预留（整组）$'), { target: { value: '40' } });
  fireEvent.change(editor.getByLabelText('交通与停车预留（整组）$'), { target: { value: '12' } });
  await act(async () => { fireEvent.click(editor.getByRole('button', { name: '保存这份计划' })); });
  const stored: SavedPlan = JSON.parse(localStorage.getItem(GUEST_PLANNER_KEY)!).plans[0];
  assert.equal(stored.details?.partySize, 2);
  assert.deepEqual(stored.details?.costBreakdown, { foodUsd: 40, transportUsd: 12, otherUsd: 0 });
  assert.equal(stored.details?.extraCostUsd, 52);
  assert.deepEqual(buildItinerary(stored.stops, stored.details!, stored.date).issues, []);
  assert.ok(stored.details?.stopSettings.length === stored.stops.length);
  view.unmount(); view = await open(`?edit=${stored.id}`); editor = within(view.getByRole('complementary'));
  assert.equal((editor.getByLabelText('餐饮预留（整组）$') as HTMLInputElement).value, '40');
  assert.equal((editor.getByLabelText('交通与停车预留（整组）$') as HTMLInputElement).value, '12');
  const shared = editor.getByRole('link', { name: '打开公开分享链接 ↗' }).getAttribute('href')!;
  assert.deepEqual([...new URL(shared).searchParams.keys()].sort(), ['date', 'stops']);
});

test('published new shops remain valid plan stops through public links and guest storage', async () => {
  const shop = PLANNER_PLACES.find(place => place.id.startsWith('opening-') && place.openingStatus === 'open');
  assert.ok(shop, 'published open shops must be available to plan');
  const view = await open(`?date=2026-10-03&stops=place:${shop.id}`);
  const editor = within(view.getByRole('complementary'));
  const link = within(editor.getByRole('list', { name: '所选地点' })).getByRole('link', { name: shop.title });
  assert.equal(link.getAttribute('href'), shop.path);
  await act(async () => { fireEvent.click(editor.getByRole('button', { name: '保存这份计划' })); });
  const stored: SavedPlan = JSON.parse(localStorage.getItem(GUEST_PLANNER_KEY)!).plans[0];
  assert.deepEqual(stored.stops, [{ kind: 'place', id: shop.id }]);
});
