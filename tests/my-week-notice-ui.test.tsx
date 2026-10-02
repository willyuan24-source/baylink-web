import assert from 'node:assert/strict';
import test, { after, afterEach, beforeEach } from 'node:test';
import React from 'react';
import { JSDOM } from 'jsdom';
import type { AppContextValue } from '../src/app/context';
import type { UserData } from '../src/lib/types';
import type { usePlannerLibrary } from '../src/lib/planner-library';

const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'https://www.baylink.us/my-week' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { render, fireEvent, cleanup, act } = await import('@testing-library/react');
const { MemoryRouter, Routes, Route, Outlet } = await import('react-router-dom');
const { PlannerAccountNotice } = await import('../src/components/PlannerAccountNotice');
const { default: MyWeekPage } = await import('../src/pages/MyWeekPage');
const { EMPTY_LIBRARY } = await import('../src/lib/planner');
const { GUEST_PLANNER_KEY } = await import('../src/lib/planner-library');
const { PLANNER_PLACES } = await import('../src/data/planner-catalog');
const { api } = await import('../src/lib/api');
const { setLocale } = await import('../src/i18n/locale');
const now = Date.parse('2026-10-16T18:00:00Z');
const user = { id: 'week-user', token: 'week-token', nickname: 'User', role: 'user', isBanned: false } as UserData;
const noop = () => {};
const library = (patch: Partial<ReturnType<typeof usePlannerLibrary>> = {}) => ({
  data: structuredClone(EMPTY_LIBRARY), loading: false, busy: false, ready: true, error: '', guestCount: 0,
  refresh: async () => {}, importGuest: async () => true, ...patch,
}) as ReturnType<typeof usePlannerLibrary>;
const notice = (props: Partial<React.ComponentProps<typeof PlannerAccountNotice>> = {}) => <MemoryRouter><PlannerAccountNotice library={library()} signedIn variant="week" {...props}/></MemoryRouter>;
const page = () => <MemoryRouter initialEntries={['/my-week']}><Routes><Route element={<Outlet context={{ user, setShowLogin: noop } as AppContextValue}/>}><Route path="/my-week" element={<MyWeekPage/>}/></Route></Routes></MemoryRouter>;
beforeEach(async t => { t.mock.timers.enable({ apis: ['Date'], now }); localStorage.clear(); await setLocale('zh-Hans'); });
afterEach(() => cleanup());
after(() => dom.window.close());

test('healthy signed-in My Week has no self-link notice while the planner still has its useful library link', () => {
  const view = render(notice()); assert.equal(view.container.textContent, '');
  view.rerender(notice({ variant: 'default' }));
  assert.equal(view.getByRole('link', { name: '我的这周 ↗' }).getAttribute('href'), '/my-week');
});

test('the compact guest notice explains browser storage without triggering login or import', () => {
  let logins = 0, imports = 0;
  const view = render(notice({ signedIn: false, login: () => logins++, library: library({ guestCount: 2, importGuest: async () => { imports++; return true; } }) }));
  assert.ok(view.getByText('访客计划只保存在这个浏览器。登录后可选择导入账号。'));
  assert.equal(logins, 0); assert.equal(imports, 0);
  assert.equal(view.queryByRole('link', { name: /我的这周/ }), null);
  fireEvent.click(view.getByRole('button', { name: '登录后选择同步' })); assert.equal(logins, 1); assert.equal(imports, 0);
});

test('guest import remains explicit, busy-safe, and retryable after an error in compact mode', async () => {
  let imports = 0, reads = 0;
  const data = library({ guestCount: 2, importGuest: async () => { imports++; return true; }, refresh: async () => { reads++; } });
  const view = render(notice({ library: data }));
  assert.ok(view.getByText(/导入后才会加入当前账号/));
  assert.equal(view.queryByRole('link'), null); assert.equal(imports, 0);
  await act(async () => { fireEvent.click(view.getByRole('button', { name: '导入本机访客计划与收藏' })); }); assert.equal(imports, 1);
  view.rerender(notice({ library: { ...data, busy: true } }));
  assert.equal((view.getByRole('button', { name: '导入本机访客计划与收藏' }) as HTMLButtonElement).disabled, true);
  view.rerender(notice({ library: { ...data, ready: false, error: '账号资料暂时无法读取。' } }));
  assert.equal((view.getByRole('button', { name: '导入本机访客计划与收藏' }) as HTMLButtonElement).disabled, true);
  assert.equal((view.getByRole('button', { name: '刷新账号资料' }) as HTMLButtonElement).disabled, false);
  view.rerender(notice({ library: { ...data, error: '导入未能完成，请重试。' } }));
  assert.match(view.getByRole('alert').textContent!, /导入未能完成/);
  await act(async () => { fireEvent.click(view.getByRole('button', { name: '刷新账号资料' })); }); assert.equal(reads, 1);
  assert.ok(view.getByRole('button', { name: '导入本机访客计划与收藏' }));
});

test('compact error and login actions remain understandable in English and Traditional Chinese', async () => {
  await setLocale('en'); const view = render(notice({ signedIn: false }));
  assert.ok(view.getByRole('button', { name: 'Sign in to choose sync' }));
  assert.ok(view.getByText(/Guest plans stay in this browser/));
  await act(async () => { await setLocale('zh-Hant'); });
  assert.ok(view.getByRole('button', { name: '登錄後選擇同步' }));
  assert.ok(view.getByText(/訪客計劃只保存在這個瀏覽器|訪客計畫只保存在這個瀏覽器/));
});

test('failed account reads do not claim saved plans disappeared and retain imported-event recovery', async t => {
  localStorage.setItem('currentUser', JSON.stringify(user));
  let fail = true;
  const plan = { id: 'saved-fixture', title: '服务端仍保存的计划', date: '2026-10-17', stops: [{ kind: 'place', id: PLANNER_PLACES[0].id }], createdAt: new Date(now).toISOString(), updatedAt: new Date(now).toISOString(), version: 1 };
  t.mock.method(api, 'request', async (path: string) => {
    if (path === '/outings/me') return { outings: [] };
    if (path === '/service-bookings/me') return { asCustomer: [], asProvider: [], sms: { enabled: false, eligible: false, configured: false } };
    if (path === '/planner/imported-events') throw { status: 503 };
    if (path === '/planner/me') { if (fail) throw { status: 503 }; return { ...structuredClone(EMPTY_LIBRARY), plans: [plan], favorites: [{ kind: 'place', id: PLANNER_PLACES[0].id }] }; }
    if (path === '/planner/preferences') throw { status: 503 };
    throw new Error(`Unexpected request: ${path}`);
  });
  const view = render(page()); await view.findByText('暂时不能确认已保存的计划。请使用上方的重试入口。');
  assert.equal(view.queryByText('第一份计划，从一站开始。'), null);
  assert.equal(view.container.querySelector('.week-favorites .planner-section-head > span')?.textContent, '—');
  assert.equal((view.getByRole('combobox', { name: '常用出行方式' }) as HTMLSelectElement).disabled, true);
  assert.ok([...view.container.querySelectorAll<HTMLButtonElement>('.week-chips button')].every(button => button.disabled));
  assert.equal(view.queryByText('在出游地图中收藏活动和景点，也可以把本机已收藏攻略加入这里。'), null);
  assert.ok(view.getByRole('button', { name: '重新加载记录' }), 'imported-event errors remain independently recoverable');
  fail = false; fireEvent.click(view.getByRole('button', { name: '刷新账号资料' }));
  await view.findByRole('heading', { name: plan.title });
  assert.equal(view.queryByText('暂时不能确认已保存的计划。请使用上方的重试入口。'), null);
  assert.equal(view.container.querySelector('.planner-account-compact'), null, 'healthy account notice no longer uses screen space');
  assert.ok(view.getByRole('button', { name: '重新加载记录' }));
  assert.equal(view.container.querySelector('.week-favorites .planner-section-head > span')?.textContent, '1');
  assert.equal((view.getByRole('combobox', { name: '常用出行方式' }) as HTMLSelectElement).disabled, false);
  fireEvent.change(view.getByRole('combobox', { name: '常用出行方式' }), { target: { value: 'transit' } });
  await view.findByRole('button', { name: '刷新账号资料' });
  assert.equal(view.container.querySelector('.week-favorites .planner-section-head > span')?.textContent, '1', 'a failed mutation keeps the real previously read count');
  assert.equal((view.getByRole('combobox', { name: '常用出行方式' }) as HTMLSelectElement).disabled, false, 'a failed write after a successful read remains retryable');
  assert.ok(view.getByRole('heading', { name: plan.title }));
});

test('a real failed guest import keeps browser data and its visible import action for retry', async t => {
  localStorage.setItem('currentUser', JSON.stringify(user));
  const guest = { ...structuredClone(EMPTY_LIBRARY), favorites: [{ kind: 'place', id: PLANNER_PLACES[0].id }] };
  localStorage.setItem(GUEST_PLANNER_KEY, JSON.stringify(guest));
  let fail = true, writes = 0;
  t.mock.method(api, 'request', async (path: string) => {
    if (path === '/outings/me') return { outings: [] };
    if (path === '/service-bookings/me') return { asCustomer: [], asProvider: [], sms: { enabled: false, eligible: false, configured: false } };
    if (path === '/planner/imported-events') return { events: [], revision: 0 };
    if (path === '/planner/me') return structuredClone(EMPTY_LIBRARY);
    if (path.startsWith('/planner/favorites/')) { writes++; if (fail) throw { status: 503 }; return { favorites: guest.favorites }; }
    throw new Error(`Unexpected request: ${path}`);
  });
  const view = render(page()); const button = await view.findByRole('button', { name: '导入本机访客计划与收藏' });
  await act(async () => {}); assert.equal(writes, 0);
  fireEvent.click(button); await view.findByRole('alert');
  assert.ok(localStorage.getItem(GUEST_PLANNER_KEY)); assert.equal(writes, 1);
  fail = false; fireEvent.click(view.getByRole('button', { name: '导入本机访客计划与收藏' }));
  await act(async () => {}); assert.equal(writes, 2); assert.equal(localStorage.getItem(GUEST_PLANNER_KEY), null);
  assert.equal(view.queryByRole('button', { name: '导入本机访客计划与收藏' }), null);
});
