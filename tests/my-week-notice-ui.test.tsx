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
const { render, fireEvent, cleanup, act, within } = await import('@testing-library/react');
const { MemoryRouter, Routes, Route, Outlet } = await import('react-router-dom');
const { PlannerAccountNotice } = await import('../src/components/PlannerAccountNotice');
const { default: MyWeekPage } = await import('../src/pages/MyWeekPage');
const { EMPTY_LIBRARY } = await import('../src/lib/planner');
const { GUEST_PLANNER_KEY } = await import('../src/lib/planner-library');
const { PLANNER_PLACES } = await import('../src/data/planner-catalog');
const { api } = await import('../src/lib/api');
const { setLocale } = await import('../src/i18n/locale');
const { resetSaveStore } = await import('../src/lib/saves');
const now = Date.parse('2026-10-16T18:00:00Z');
const user = { id: 'week-user', token: 'week-token', nickname: 'User', role: 'user', isBanned: false } as UserData;
const noop = () => {};
const library = (patch: Partial<ReturnType<typeof usePlannerLibrary>> = {}) => ({
  data: structuredClone(EMPTY_LIBRARY), loading: false, busy: false, ready: true, error: '', guestCount: 0,
  refresh: async () => {}, importGuest: async () => true, ...patch,
}) as ReturnType<typeof usePlannerLibrary>;
const notice = (props: Partial<React.ComponentProps<typeof PlannerAccountNotice>> = {}) => <MemoryRouter><PlannerAccountNotice library={library()} signedIn variant="week" {...props}/></MemoryRouter>;
const page = (account: UserData | null = user, login = noop) => <MemoryRouter initialEntries={['/my-week']}><Routes><Route element={<Outlet context={{ user: account, setShowLogin: login } as AppContextValue}/>}><Route path="/my-week" element={<MyWeekPage/>}/></Route></Routes></MemoryRouter>;
beforeEach(async t => { t.mock.timers.enable({ apis: ['Date'], now }); t.mock.method(globalThis, 'fetch', async () => Response.json({})); localStorage.clear(); resetSaveStore(); await setLocale('zh-Hans'); });
afterEach(() => cleanup());
const savedCount = (view: ReturnType<typeof render>) => view.getByTestId('my-week-saved-count').textContent;
const chips = (view: ReturnType<typeof render>) => [...within(view.getByRole('group', { name: '常去的地区' })).getAllByRole('button'), ...within(view.getByRole('group', { name: '兴趣' })).getAllByRole('button')] as HTMLButtonElement[];
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
  const view = render(page()); await view.findByRole('heading', { name: '暂时读不到你的行程' });
  assert.equal(view.queryByText(/还没有安排哪天出门/), null, 'an unread account never claims there are no plans');
  assert.equal(savedCount(view), '—');
  assert.equal((view.getByRole('combobox', { name: '常用出行方式' }) as HTMLSelectElement).disabled, true);
  assert.ok(chips(view).every(button => button.disabled));
  assert.ok(view.getByRole('button', { name: '重新加载记录' }), 'imported-event errors remain independently recoverable');
  fail = false; fireEvent.click(view.getByRole('button', { name: '刷新账号资料' }));
  await view.findByRole('heading', { name: plan.title });
  assert.equal(view.queryByRole('heading', { name: '暂时读不到你的行程' }), null);
  assert.equal(view.container.querySelector('.planner-account-compact'), null, 'healthy account notice no longer uses screen space');
  assert.ok(view.getByRole('button', { name: '重新加载记录' }));
  assert.equal(savedCount(view), '1');
  assert.equal((view.getByRole('combobox', { name: '常用出行方式' }) as HTMLSelectElement).disabled, false);
  fireEvent.change(view.getByRole('combobox', { name: '常用出行方式' }), { target: { value: 'transit' } });
  await view.findByRole('button', { name: '刷新账号资料' });
  assert.equal(savedCount(view), '1', 'a failed mutation keeps the real previously read count');
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
  const optional = view.getByText('账号功能：预约与小队').closest('details')!;
  assert.equal(optional.open, false);
  for (const section of [view.getByTestId('my-week-plans'), view.getByTestId('my-week-saved'), view.getByTestId('my-week-events'), view.container.querySelector('.imported-events-panel')!]) {
    assert.ok(section);
    assert.ok(section.compareDocumentPosition(optional) & Node.DOCUMENT_POSITION_FOLLOWING, section.textContent!.slice(0, 20));
  }
  assert.ok(view.getByRole('link', { name: '继续编辑' }).getAttribute('href')?.includes(plan.id));
  assert.ok(view.getByRole('link', { name: '分享版' }).getAttribute('href')?.includes('/plan'));
  assert.equal(savedCount(view), '1', 'the guest favorite from the older planner list is in the one saved list');
  assert.equal(view.queryByRole('button', { name: '登录查看预约' }), null);
  assert.equal(view.queryByRole('button', { name: '登录查看小队' }), null);
  assert.equal(chips(view).length > 2, true, 'guest preferences remain available below saved content');
  assert.equal(requests, 0); assert.equal(logins, 0);
  fireEvent.click(optional.querySelector('summary')!);
  fireEvent.click(view.getByRole('button', { name: '登录查看预约与小队' }));
  assert.equal(logins, 1); assert.equal(requests, 0);
  assert.deepEqual(JSON.parse(localStorage.getItem(GUEST_PLANNER_KEY)!), data);
});

test('optional guest account features and preferences have English and Traditional Chinese labels', async () => {
  for (const [locale, summary, action, preferences] of [
    ['en', 'Account features: bookings and groups', 'Sign in for bookings and groups', 'Filter by my areas and interests'],
    ['zh-Hant', '帳號功能：預約與小隊', '登入查看預約與小隊', '按我常去的地區和興趣篩選'],
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

test('back online, plans that failed to load are read again by themselves, and loaded plans pick up changes softly', async t => {
  localStorage.setItem('currentUser', JSON.stringify(user));
  const stamp = new Date(now).toISOString();
  const plan = (id: string, title: string) => ({ id, title, date: '2026-10-17', stops: [{ kind: 'place', id: PLANNER_PLACES[0].id }], createdAt: stamp, updatedAt: stamp, version: 1 });
  let fail = true, plans = [plan('first', '离线前保存的计划')], favorites = [{ kind: 'place', id: PLANNER_PLACES[0].id }], hold = false, release = () => {};
  t.mock.method(api, 'request', async (path: string) => {
    if (path === '/outings/me') return { outings: [] };
    if (path === '/service-bookings/me') return { asCustomer: [], asProvider: [], sms: { enabled: false, eligible: false, configured: false } };
    if (path === '/planner/imported-events') return { events: [], revision: 0 };
    if (path === '/planner/me') {
      if (fail) throw { status: 0, error: 'offline' };
      if (hold) await new Promise<void>(resolve => { release = resolve; });
      return { ...structuredClone(EMPTY_LIBRARY), plans: structuredClone(plans), favorites: structuredClone(favorites) };
    }
    throw new Error(`Unexpected request: ${path}`);
  });
  const view = render(page());
  await view.findByRole('heading', { name: '暂时读不到你的行程' });
  fail = false;
  await act(async () => { window.dispatchEvent(new dom.window.Event('online')); });
  await view.findByRole('heading', { name: '离线前保存的计划' });
  assert.equal(view.queryByRole('heading', { name: '暂时读不到你的行程' }), null, 'no tap on 重试 was needed');
  assert.equal(savedCount(view), '1');
  // Another device added a plan and a save meanwhile: the next reconnect shows both without blanking the screen.
  plans = [...plans, plan('second', '另一台设备加的计划')]; favorites = [...favorites, { kind: 'place', id: PLANNER_PLACES[1].id }]; hold = true;
  await act(async () => { window.dispatchEvent(new dom.window.Event('online')); await new Promise(resolve => setTimeout(resolve, 0)); });
  assert.ok(view.getByRole('heading', { name: '离线前保存的计划' }), 'the plans stay while the account is read again');
  assert.equal(view.getByTestId('my-week-plans').querySelector('[aria-busy=true]'), null, 'no skeleton flash');
  await act(async () => { release(); await new Promise(resolve => setTimeout(resolve, 0)); });
  await view.findByRole('heading', { name: '另一台设备加的计划' });
  assert.equal(savedCount(view), '2', 'the same account read refreshes the saved list');
});

test('signed-in My Week puts plans and saved items first, then bookings, groups, this week and imported events', async t => {
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
  await view.findByRole('heading', { name: '预约与待办' });
  const headings = view.getAllByRole('heading', { level: 2 }).map(heading => heading.textContent!.replace(/\d+$/, '').trim());
  const titles = ['行程', '收藏', '预约与待办', '小队安排 · 未来7天', '这周可以去', '我导入的活动'];
  for (let index = 1; index < titles.length; index++) assert.ok(headings.indexOf(titles[index - 1]) >= 0 && headings.indexOf(titles[index]) > headings.indexOf(titles[index - 1]), `${titles[index]} in ${headings.join(' / ')}`);
  assert.equal(view.queryByText('账号功能：预约与小队'), null);
  assert.ok(paths.includes('/outings/me')); assert.ok(paths.includes('/service-bookings/me'));
});

test('signed in: 加入这天计划 on My Week keeps the rows, the preferences and the confirmation while the account is read again', async t => {
  const { MONTHLY_EVENTS } = await import('../src/data/monthly-edition');
  const { nextConfirmedEventDate } = await import('../src/lib/event-occurrences');
  const { ATTRACTION_REGIONS } = await import('../src/data/attractions');
  // The same "这周可以去" list the page builds; pick an area whose list has an event the unfiltered list does not
  // show, so a re-read that dropped the preferences would also drop the tapped row.
  const today = '2026-10-16', weekEnd = '2026-10-22';
  const week = (region?: string) => MONTHLY_EVENTS.filter(event => !region || event.region === region)
    .flatMap(event => { const date = nextConfirmedEventDate(event, today); return date && date <= weekEnd ? [{ event, date }] : []; })
    .sort((a, b) => a.date.localeCompare(b.date) || a.event.id.localeCompare(b.event.id)).slice(0, 6);
  const unfiltered = new Set(week().map(item => item.event.id));
  const regions = ATTRACTION_REGIONS.filter(region => region.id !== 'all').map(region => region.id as string);
  const region = regions.find(id => week(id).some(item => !unfiltered.has(item.event.id))) ?? regions.find(id => week(id).length)!;
  const target = week(region).find(item => !unfiltered.has(item.event.id)) ?? week(region)[0];
  localStorage.setItem('currentUser', JSON.stringify(user));
  const preferences = { regions: [region], interests: [], travelMode: 'any' };
  let posted: Record<string, unknown> | null = null, hold = false, release = () => {};
  t.mock.method(api, 'request', async (path: string, options?: RequestInit) => {
    if (path === '/outings/me') return { outings: [] };
    if (path === '/service-bookings/me') return { asCustomer: [], asProvider: [], sms: { enabled: false, eligible: false, configured: false } };
    if (path === '/planner/imported-events') return { events: [], revision: 0 };
    if (path === '/planner/me') {
      if (hold) await new Promise<void>(resolve => { release = resolve; });
      return { ...structuredClone(EMPTY_LIBRARY), preferences, plans: posted ? [posted] : [] };
    }
    if (path === '/planner/plans' && options?.method === 'POST') {
      posted = { id: 'added', ...JSON.parse(String(options.body)), version: 1, createdAt: new Date(now).toISOString(), updatedAt: new Date(now).toISOString() };
      hold = true;
      return { plan: posted };
    }
    throw new Error(`Unexpected request: ${options?.method ?? 'GET'} ${path}`);
  });
  const view = render(page());
  const name = `加入这天计划：${target.event.title}`;
  const button = await view.findByRole('button', { name });
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
  const ready = () => assert.equal((view.getByRole('button', { name }) as HTMLButtonElement).disabled, false);
  for (let tries = 0; tries < 50; tries++) { try { ready(); break; } catch { await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)); }); } }
  ready();
  await act(async () => { fireEvent.click(view.getByRole('button', { name })); });
  for (let tries = 0; tries < 50 && !view.queryByTestId('save-toast'); tries++) await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)); });
  // The re-read after the add is still running: nothing on screen may fall back to an empty library meanwhile.
  assert.equal(hold, true);
  const day = `${Number(target.date.slice(5, 7))}/${Number(target.date.slice(8, 10))}`;
  assert.equal(view.getByTestId('save-toast').textContent!.includes(`已加入 ${day} 计划`), true);
  const added = within(view.getByTestId('my-week-events')).getByRole('button', { name: `已加入 ${day} 计划：${target.event.title}` });
  assert.ok(added.isConnected && button.isConnected, 'the tapped row stays mounted');
  const label = ATTRACTION_REGIONS.find(item => item.id === region)!.label;
  assert.equal(within(view.getByRole('group', { name: '常去的地区' })).getByRole('button', { name: label }).getAttribute('aria-pressed'), 'true', 'preferences stay applied');
  assert.equal(view.getByTestId('my-week-plans').querySelector('[aria-busy=true]'), null, 'the plans do not flash to a skeleton');
  await act(async () => { release(); await new Promise(resolve => setTimeout(resolve, 0)); });
  await view.findByRole('heading', { name: String(posted!.title) });
  assert.ok(view.getByTestId('save-toast'), 'the confirmation outlives the re-read');
});

test('a plan 加入这天计划 named reads in the page’s language; a title the reader wrote stays as written', async t => {
  const stamp = new Date(now).toISOString();
  const plan = (id: string, title: string, date: string) => ({ id, title, date, stops: [{ kind: 'place', id: PLANNER_PLACES[0].id }], createdAt: stamp, updatedAt: stamp, version: 1 });
  localStorage.setItem(GUEST_PLANNER_KEY, JSON.stringify({ ...structuredClone(EMPTY_LIBRARY), plans: [plan('zh-auto', '10/17 计划', '2026-10-17'), plan('en-auto', 'Plan for 10/18', '2026-10-18'), plan('own', '周六 Santana Row 一日', '2026-10-17')] }));
  t.mock.method(api, 'request', async () => { throw new Error('Guest content must not request private account data'); });
  const { translateText } = await import('../src/i18n/locale');
  for (const [locale, zhAuto, enAuto] of [['en', 'Plan for Oct 17', 'Plan for Oct 18'], ['zh-Hans', '10/17 计划', '10/18 计划'], ['zh-Hant', translateText('10/17 计划', 'zh-Hant'), translateText('10/18 计划', 'zh-Hant')]] as const) {
    await setLocale(locale);
    const view = render(page(null));
    for (const title of [zhAuto, enAuto]) {
      const heading = await view.findByRole('heading', { name: title });
      assert.equal(heading.querySelector('[translate=no]'), null, `${locale}: ${title} is site copy`);
    }
    const own = view.getByRole('heading', { name: '周六 Santana Row 一日' });
    assert.ok(own.querySelector('[translate=no]'), `${locale}: the reader's own title is not translated`);
    cleanup();
  }
});

// UI9-R2-ACCOUNT-UTILITY (R2-15, N06): the picture strip on an empty 行程, rendered. The mocked week (2026-10-16) has far
// more than six listed events, so 这周可以去 has its six rows and the strip its four.
const STRIP = '这周可以先排进去的活动';
const eventHrefs = (root: HTMLElement) => [...root.querySelectorAll<HTMLAnchorElement>('a[href^="/events/"]')].map(link => link.getAttribute('href')!.split('?')[0]);

test('no day planned: 行程 shows four picture cards, none of them a 这周可以去 row', async t => {
  t.mock.method(api, 'request', async () => { throw new Error('Guest content must not request private account data'); });
  const view = render(page(null));
  const strip = await view.findByRole('list', { name: STRIP });
  const cards = eventHrefs(strip), rows = eventHrefs(view.getByTestId('my-week-events'));
  assert.equal(cards.length, 4);
  assert.equal(rows.length, 6);
  assert.deepEqual(cards.filter(href => rows.includes(href)), [], 'no event shows twice');
});

test('a member with a day planned: the same strip is there while the plans load and stays under the timeline (nothing moves)', async t => {
  localStorage.setItem('currentUser', JSON.stringify(user));
  const plan = { id: 'planned', title: '已经排好的一天', date: '2026-10-17', stops: [{ kind: 'place', id: PLANNER_PLACES[0].id }], createdAt: new Date(now).toISOString(), updatedAt: new Date(now).toISOString(), version: 1 };
  let answer: (value: unknown) => void = () => {};
  const planner = new Promise(resolve => { answer = resolve; });
  t.mock.method(api, 'request', async (path: string) => {
    if (path === '/planner/me') return planner;
    if (path === '/outings/me') return { outings: [] };
    if (path === '/service-bookings/me') return { asCustomer: [], asProvider: [], sms: { enabled: false, eligible: false, configured: false } };
    if (path === '/planner/imported-events') return { events: [], revision: 0 };
    throw new Error(`Unexpected request: ${path}`);
  });
  const view = render(page());
  await act(async () => { await Promise.resolve(); });
  const loading = view.getByRole('list', { name: STRIP });
  const before = eventHrefs(loading);
  assert.equal(before.length, 4, 'the strip is on the first frame, while the plans load');
  await act(async () => { answer({ ...structuredClone(EMPTY_LIBRARY), plans: [plan] }); await planner; });
  await view.findByRole('heading', { name: plan.title });
  const strip = view.getByRole('list', { name: STRIP });
  assert.ok(strip === loading && strip.isConnected, 'the same strip node: not removed and drawn again');
  assert.deepEqual(eventHrefs(strip), before);
  const plans = view.getByTestId('my-week-plans');
  assert.ok(plans.contains(strip) && (view.getByRole('heading', { name: plan.title }).compareDocumentPosition(strip) & 4), 'under the timeline (4: following), in 行程');
});

test('N06: a 这周可以去 meta line glues every separator to the word before it, so no wrapped line starts with ·', async t => {
  t.mock.method(api, 'request', async () => { throw new Error('Guest content must not request private account data'); });
  const view = render(page(null));
  await view.findByRole('list', { name: STRIP });
  const metas = [...view.getByTestId('my-week-events').querySelectorAll('.ui-row-card__meta')].map(meta => meta.textContent!);
  assert.equal(metas.length, 6);
  for (const meta of metas) {
    assert.match(meta, /\u00a0· /);
    assert.doesNotMatch(meta, / · /);
  }
});
