import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import React from 'react';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://www.baylink.us/calendar' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { render, renderHook, fireEvent, cleanup, act, within, waitFor } = await import('@testing-library/react');
const { MemoryRouter, Routes, Route, Outlet } = await import('react-router-dom');
const { AddToDayPlan } = await import('../src/components/AddToDayPlan');
const { appendToDay, loadGuestLibrary, usePlannerLibrary } = await import('../src/lib/planner-library');
const { api } = await import('../src/lib/api');
const { EMPTY_LIBRARY, MAX_PLAN_STOPS } = await import('../src/lib/planner');
const { PLANNER_PLACES } = await import('../src/data/planner-catalog');
const { MONTHLY_EVENTS } = await import('../src/data/monthly-edition');
const { resetSaveStore } = await import('../src/lib/saves');
const { setLocale } = await import('../src/i18n/locale');
type Stop = import('../src/lib/planner').Stop;
type SavedPlan = import('../src/lib/planner').SavedPlan;

const DAY = '2026-12-12', TODAY = '2026-10-09';
const places: Stop[] = PLANNER_PLACES.slice(0, MAX_PLAN_STOPS + 1).map(place => ({ kind: 'place', id: place.id }));
const event: Stop = { kind: 'event', id: MONTHLY_EVENTS[0].id };
const session = (id?: string) => id ? localStorage.setItem('currentUser', JSON.stringify({ id, token: `${id}-test-token` })) : localStorage.removeItem('currentUser');
beforeEach(t => { t.mock.method(globalThis, 'fetch', async () => Response.json({})); });
afterEach(async () => { cleanup(); localStorage.clear(); resetSaveStore(); await setLocale('zh-Hans', false); });

test('guests: the first add creates that day’s plan, later adds append, repeats are no-ops, a full plan starts a second one', async () => {
  const first = await appendToDay(undefined, DAY, places[0], '12/12 计划', TODAY);
  assert.equal(first.created, true);
  const second = await appendToDay(undefined, DAY, places[1], 'ignored', TODAY);
  assert.equal(second.created, false); assert.equal(second.plan.id, first.plan.id);
  assert.deepEqual(second.plan.stops, places.slice(0, 2));
  assert.equal((await appendToDay(undefined, DAY, places[1], 'ignored', TODAY)).alreadyThere, true);
  for (const stop of places.slice(2, MAX_PLAN_STOPS)) await appendToDay(undefined, DAY, stop, 'ignored', TODAY);
  const overflow = await appendToDay(undefined, DAY, places[MAX_PLAN_STOPS], '12/12 计划', TODAY);
  assert.equal(overflow.created, true);
  // Persisted: a reload reads both plans from this browser.
  const stored = loadGuestLibrary().plans;
  assert.equal(stored.length, 2);
  assert.equal(stored.find(plan => plan.id === first.plan.id)!.stops.length, MAX_PLAN_STOPS);
  await assert.rejects(appendToDay(undefined, '2026-10-01', event, 'past', TODAY), (error: { code: string }) => error.code === 'date');
});

test('signed in: a new day posts a plan, an existing day puts the appended stop with its version, and a 409 rereads once', async t => {
  session('alice');
  const existing: SavedPlan = { id: 'p1', title: '周六', date: DAY, stops: [places[0]], version: 3, createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z' };
  const calls: { method?: string; path: string; body?: unknown }[] = [];
  let plans: SavedPlan[] = [], conflict = true;
  t.mock.method(api, 'request', async (path: string, options?: RequestInit) => {
    calls.push({ method: options?.method, path, body: options?.body ? JSON.parse(String(options.body)) : undefined });
    if (!options?.method) return { ...structuredClone(EMPTY_LIBRARY), plans };
    if (options.method === 'POST') return { plan: { ...existing, id: 'new', stops: [event], version: 1 } };
    if (conflict) { conflict = false; plans = [{ ...existing, version: 4 }]; throw { status: 409, error: 'stale' }; }
    return { plan: { ...existing, stops: [places[0], event], version: 5 } };
  });
  const created = await appendToDay('alice', DAY, event, '12/12 计划', TODAY);
  assert.equal(created.created, true);
  assert.deepEqual(calls.at(-1), { method: 'POST', path: '/planner/plans', body: { title: '12/12 计划', date: DAY, stops: [event] } });
  plans = [existing]; calls.length = 0;
  const appended = await appendToDay('alice', DAY, event, 'ignored', TODAY);
  assert.equal(appended.created, false);
  assert.deepEqual(calls.map(call => `${call.method ?? 'GET'} ${call.path}`), ['GET /planner/me', 'PUT /planner/plans/p1', 'GET /planner/me', 'PUT /planner/plans/p1']);
  assert.deepEqual(calls[3].body, { title: '周六', date: DAY, stops: [places[0], event], version: 4 });
  assert.equal(localStorage.getItem('baylink.planner.guest.v1'), null, 'signed-in plans never land in browser storage');
});

test('the button saves at once, confirms with “已加入 12/12 计划 · 查看”, and an open plan list reads the new plan', async () => {
  const { result } = renderHook(() => usePlannerLibrary());
  await act(async () => {});
  assert.equal(result.current.data.plans.length, 0);
  const view = render(<MemoryRouter><Routes><Route element={<Outlet context={{ user: null }} />}><Route path="/" element={<AddToDayPlan stop={event} date={DAY} title={MONTHLY_EVENTS[0].title} today={TODAY} compact />} /></Route></Routes></MemoryRouter>);
  // The control loads on its own; until then a disabled copy of the button holds its place (and is what prerendered pages show).
  const button = () => view.getByRole('button', { name: `加入这天计划：${MONTHLY_EVENTS[0].title}` });
  assert.equal(button().hasAttribute('disabled'), true);
  await waitFor(() => assert.equal(button().hasAttribute('disabled'), false));
  await act(async () => { fireEvent.click(button()); });
  const toast = view.getByTestId('save-toast');
  assert.match(toast.textContent!, /已加入 12\/12 计划/);
  // Screen readers hear it from one polite region that was in the page, empty, before the message arrived.
  const announcer = view.getByTestId('save-announcer');
  assert.equal(announcer.getAttribute('role'), 'status');
  assert.equal(toast.getAttribute('role'), null, 'the toast itself is not a second live region');
  await waitFor(() => assert.equal(announcer.textContent, '已加入 12/12 计划'));
  assert.equal(within(toast).getByRole('link', { name: '查看' }).getAttribute('href'), `/my-week#plan-${DAY}`);
  // Once the stop is in, the accessible name starts with the visible text again (WCAG 2.5.3).
  assert.equal(view.queryByRole('button', { name: `加入这天计划：${MONTHLY_EVENTS[0].title}` }), null);
  assert.ok(view.getByRole('button', { name: `已加入 12/12 计划：${MONTHLY_EVENTS[0].title}` }).textContent!.includes('已加入 12/12'));
  await act(async () => {});
  assert.deepEqual(result.current.data.plans.map(plan => plan.stops), [[event]], 'the mounted planner library reread after the change');
  await act(async () => { fireEvent.click(within(toast).getByRole('button', { name: '关闭提示' })); });
  assert.equal(view.queryByTestId('save-toast'), null);
  assert.equal(announcer.textContent, '', 'a closed confirmation is not read again');
});

test('signed in: two quick adds for the same day make one plan (the second add reads the plan the first created)', async t => {
  session('alice');
  const second: Stop = { kind: 'event', id: MONTHLY_EVENTS[1].id };
  let plans: SavedPlan[] = [];
  const calls: string[] = [];
  t.mock.method(api, 'request', async (path: string, options?: RequestInit) => {
    calls.push(`${options?.method ?? 'GET'} ${path}`);
    if (!options?.method) return { ...structuredClone(EMPTY_LIBRARY), plans: structuredClone(plans) };
    await new Promise(resolve => setTimeout(resolve, 5));
    const body = JSON.parse(String(options.body));
    const plan: SavedPlan = { id: options.method === 'POST' ? 'day-plan' : path.split('/').at(-1)!, title: body.title, date: body.date, stops: body.stops, version: (body.version ?? 0) + 1, createdAt: '2026-10-09T00:00:00Z', updatedAt: `2026-10-09T00:00:0${calls.length}Z` };
    plans = [plan, ...plans.filter(item => item.id !== plan.id)];
    return { plan };
  });
  const [one, two] = await Promise.all([appendToDay('alice', DAY, event, '12/12 计划', TODAY), appendToDay('alice', DAY, second, '12/12 计划', TODAY)]);
  assert.equal(one.created, true);
  assert.equal(two.created, false);
  assert.deepEqual(calls, ['GET /planner/me', 'POST /planner/plans', 'GET /planner/me', 'PUT /planner/plans/day-plan']);
  assert.equal(plans.length, 1);
  assert.deepEqual(plans[0].stops, [event, second]);
});

test('English copy for the button and the confirmation', async () => {
  await setLocale('en', false);
  const view = render(<MemoryRouter><AddToDayPlan stop={event} date={DAY} today={TODAY} title={MONTHLY_EVENTS[0].title} /></MemoryRouter>);
  await waitFor(() => assert.equal(view.getByRole('button', { name: /^Add to this day’s plan: / }).hasAttribute('disabled'), false));
  await act(async () => { fireEvent.click(view.getByRole('button', { name: /^Add to this day’s plan: / })); });
  // US English on /en (WEB-FIX6): "Dec 12"; the new plan's stored title keeps its numeric day (plan-title.ts reads it back).
  assert.match(view.getByTestId('save-toast').textContent!, /Added to your Dec 12 plan/);
  assert.ok(within(view.getByTestId('save-toast')).getByRole('link', { name: 'View' }));
  assert.match(view.getByRole('button', { name: /^In your Dec 12 plan: / }).textContent!, /In your Dec 12 plan/);
  assert.deepEqual(loadGuestLibrary().plans.map(plan => plan.title), ['Plan for 12/12']);
});

test('a stop already in an older plan for the same day is not added again', async () => {
  const older: SavedPlan = { id: 'older', title: '上午', date: DAY, stops: [event], version: 1, createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z' };
  const newer: SavedPlan = { id: 'newer', title: '下午', date: DAY, stops: [places[0]], version: 1, createdAt: '2026-10-02T00:00:00Z', updatedAt: '2026-10-02T00:00:00Z' };
  localStorage.setItem('baylink.planner.guest.v1', JSON.stringify({ ...structuredClone(EMPTY_LIBRARY), plans: [newer, older] }));
  const result = await appendToDay(undefined, DAY, event, 'ignored', TODAY);
  assert.equal(result.alreadyThere, true);
  assert.equal(result.plan.id, 'older');
  assert.deepEqual(loadGuestLibrary().plans.find(plan => plan.id === 'newer')!.stops, [places[0]], 'the newest plan is left as it was');
});
