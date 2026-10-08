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
const page = (account: UserData | null = user, login = noop) => <MemoryRouter initialEntries={['/my-week']}><Routes><Route element={<Outlet context={{ user: account, setShowLogin: login } as AppContextValue}/>}><Route path="/my-week" element={<MyWeekPage/>}/></Route></Routes></MemoryRouter>;
beforeEach(async t => { t.mock.timers.enable({ apis: ['Date'], now }); localStorage.clear(); await setLocale('zh-Hans'); });
afterEach(() => cleanup());
after(() => dom.window.close());

test('healthy signed-in My Week has no self-link notice while the planner still has its useful library link', () => {
  const view = render(notice()); assert.equal(view.container.textContent, '');
  view.rerender(notice({ variant: 'default' }));
  assert.equal(view.getByRole('link', { name: '我的这周' }).getAttribute('href'), '/my-week');
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
  assert.ok(view.getByRole('button', { name: '登入後選擇同步' }));
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

test('guests can use saved plans and favorites before optional account features without private requests', async t => {
  const plan = { id: 'browser-plan', title: '本机周末计划', date: '2026-10-17', stops: [{ kind: 'place', id: PLANNER_PLACES[0].id }], createdAt: new Date(now).toISOString(), updatedAt: new Date(now).toISOString(), version: 1 };
  const data = { ...structuredClone(EMPTY_LIBRARY), plans: [plan], favorites: [{ kind: 'place', id: PLANNER_PLACES[0].id }] };
  localStorage.setItem(GUEST_PLANNER_KEY, JSON.stringify(data));
  let requests = 0, logins = 0;
  t.mock.method(api, 'request', async () => { requests++; throw new Error('Guest content must not request private account data'); });
  const view = render(page(null, () => { logins++; }));
  await view.findByRole('heading', { name: plan.title });
  const optional = view.container.querySelector<HTMLDetailsElement>('.week-account-features')!;
  assert.equal(optional.open, false);
  for (const selector of ['.imported-events-panel', '.week-plans', '.week-events', '.week-favorites']) {
    const section = view.container.querySelector(selector)!;
    assert.ok(section, selector);
    assert.ok(section.compareDocumentPosition(optional) & Node.DOCUMENT_POSITION_FOLLOWING, selector);
  }
  assert.ok(view.getByRole('link', { name: '继续编辑' }).getAttribute('href')?.includes(plan.id));
  assert.ok(view.getByRole('link', { name: '公开分享版 ↗' }).getAttribute('href')?.includes('/plan'));
  assert.equal(view.queryByRole('button', { name: '登录查看预约' }), null);
  assert.equal(view.queryByRole('button', { name: '登录查看小队' }), null);
  assert.equal(view.container.querySelectorAll('.week-chips').length, 2, 'guest preferences remain available below saved content');
  assert.equal(requests, 0); assert.equal(logins, 0);
  fireEvent.click(optional.querySelector('summary')!);
  fireEvent.click(view.getByRole('button', { name: '登录查看预约与小队' }));
  assert.equal(logins, 1); assert.equal(requests, 0);
  assert.deepEqual(JSON.parse(localStorage.getItem(GUEST_PLANNER_KEY)!), data);
});

test('optional guest account features and preferences have English and Traditional Chinese labels', async () => {
  for (const [locale, summary, action, preferences] of [
    ['en', 'Account features: bookings and groups', 'Sign in for bookings and groups', 'Adjust areas, interests and outing preferences'],
    ['zh-Hant', '帳號功能：預約與小隊', '登入查看預約與小隊', '調整地區、興趣和出遊偏好'],
  ] as const) {
    await setLocale(locale);
    const view = render(page(null));
    await act(async () => {});
    fireEvent.click(view.getByText(summary));
    assert.ok(view.getByRole('button', { name: action }));
    assert.ok(view.getByText(preferences));
    cleanup();
  }
});

test('signed-in My Week keeps bookings, groups and imported events ahead of preferences and plans', async t => {
  localStorage.setItem('currentUser', JSON.stringify(user));
  const paths: string[] = [];
  t.mock.method(api, 'request', async (path: string) => {
    paths.push(path);
    if (path === '/outings/me') return { outings: [] };
    if (path === '/service-bookings/me') return { asCustomer: [], asProvider: [], sms: { enabled: false, eligible: false, configured: false } };
    if (path === '/planner/imported-events') return { events: [], revision: 0 };
    if (path === '/planner/me') return structuredClone(EMPTY_LIBRARY);
    throw new Error(`Unexpected request: ${path}`);
  });
  const view = render(page());
  await view.findByRole('heading', { name: '我常去的地方' });
  const text = view.container.textContent!;
  const titles = ['预约与待办', '小队安排 · 未来7天', '我导入的活动', '我常去的地方', '已经排好的期待'];
  for (let index = 1; index < titles.length; index++) assert.ok(text.indexOf(titles[index - 1]) >= 0 && text.indexOf(titles[index]) > text.indexOf(titles[index - 1]), titles[index]);
  assert.equal(view.container.querySelector('.week-account-features'), null);
  assert.ok(paths.includes('/outings/me')); assert.ok(paths.includes('/service-bookings/me'));
});
