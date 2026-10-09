import assert from 'node:assert/strict';
import test, { after, afterEach, beforeEach } from 'node:test';
import { registerHooks } from 'node:module';
import { JSDOM } from 'jsdom';
import React from 'react';
import type { UserData } from '../src/lib/types';
import type { AppContextValue } from '../src/app/context';

// The hub and the messages page import their own stylesheets; node only needs them to resolve.
const styles = registerHooks({ load(url, context, next) { return url.endsWith('.css') ? { format: 'module', shortCircuit: true, source: 'export {}' } : next(url, context); } });
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://www.baylink.us/me', pretendToBeVisual: true });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, sessionStorage: dom.window.sessionStorage, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, Event: dom.window.Event, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { render, fireEvent, cleanup, act, waitFor, within } = await import('@testing-library/react');
const { MemoryRouter, Routes, Route, Outlet, useLocation } = await import('react-router-dom');
await import('../src/i18n/router');
const { default: ProfilePage } = await import('../src/pages/ProfilePage');
const { default: MessagesPage } = await import('../src/pages/MessagesPage');
const { NotificationPreferencesCard } = await import('../src/features/profile/NotificationPreferencesCard');
const { parseSystemNotice, previewText, noticeLine } = await import('../src/features/messages/system-notice');
const { api } = await import('../src/lib/api');
const { EMPTY_LIBRARY } = await import('../src/lib/planner');
const { setLocale } = await import('../src/i18n/locale');

const original = api.request;
const user: UserData = { id: 'hub-user', token: 'hub-token', email: 'hub@example.test', nickname: '湾区邻居', role: 'user', contactType: 'wechat', contactValue: '', isBanned: false };
const offPreferences = (extra: Record<string, unknown> = {}) => ({ preferences: { email: { message: false, contact_request: false, outing_request: false }, sms: { message: false, contact_request: false, outing_request: false } }, emailVerified: true, phoneVerified: false, deliveryEnabled: true, emailDeliveryAvailable: true, smsDeliveryAvailable: false, ...extra });
const context = (overrides: Partial<AppContextValue> = {}) => ({
  user, messagesBadgeCount: 3, setUser() {}, setShowLogin() {}, handleLogout() {}, clearAccountSession() {}, navigateToPost() {}, showToast() {}, openBlockedUsersModal() {},
  openChat() {}, openPostById() {}, contactRequestRefreshKey: 0, setContactRequestRefreshKey() {}, setPendingContactRequestCount() {},
  chatRouteStatus: 'idle', chatRouteError: null, retryChatRoute() {}, ...overrides,
}) as unknown as AppContextValue;
const Where = () => <output data-testid="where">{useLocation().pathname}{useLocation().search}</output>;
const app = (value: AppContextValue, entry = '/me') => <MemoryRouter initialEntries={[entry]}><Routes>
  <Route element={<><Outlet context={value} /><Where /></>}>
    <Route path="/me" element={<ProfilePage />} />
    <Route path="/messages" element={<MessagesPage />} />
    <Route path="/my-week" element={<h1>我的这周页</h1>} />
  </Route>
</Routes></MemoryRouter>;
const reads: string[] = [];
const mockApi = (handler?: (path: string, options?: RequestInit) => unknown) => {
  api.request = (async (path: string, options?: RequestInit) => {
    reads.push(path);
    const handled = handler?.(path, options);
    if (handled !== undefined) return handled;
    if (path === '/planner/me') return { ...structuredClone(EMPTY_LIBRARY), favorites: [{ kind: 'event', id: 'e1' }, { kind: 'offer', id: 'o1' }] };
    if (path === '/notifications/preferences') return offPreferences();
    if (path === '/conversations') return [];
    if (path.startsWith('/contact-requests')) return { requests: [] };
    return {};
  }) as typeof api.request;
};
beforeEach(async () => { reads.length = 0; localStorage.clear(); await setLocale('zh-Hans', false); });
afterEach(() => { cleanup(); api.request = original; localStorage.clear(); });
after(() => { styles.deregister(); dom.window.close(); });

test('/me opens on the hub: 消息 is the first tile, carries the header count and reaches /messages in one more tap', async () => {
  localStorage.setItem('currentUser', JSON.stringify(user));
  localStorage.setItem('baylink.saved-posts.v1.user:hub-user', JSON.stringify([{ id: 'p1', title: '二手书桌', savedAt: 1 }]));
  mockApi();
  const view = render(app(context()));
  const tiles = within(view.getByRole('list', { name: '我的常用' }));
  const links = tiles.getAllByRole('link');
  assert.equal(links[0].getAttribute('href'), '/messages');
  assert.equal(links[0].getAttribute('aria-label'), '消息，3 条未读');
  assert.equal(tiles.getByLabelText('3 条未读').textContent, '3');
  assert.deepEqual(links.map(link => link.getAttribute('href')), ['/messages', '/my-week', '/together?view=mine', '/me/bookings']);
  // The reading-size card is a settings row now, not the first screen.
  assert.equal(view.queryByRole('region', { name: '阅读字号' }), null);
  await waitFor(() => assert.match(tiles.getAllByRole('link')[1].textContent || '', /收藏 3 项/));
  assert.ok(view.getByText('湾区去哪、怎么办——有来源的中文答案'));
  fireEvent.click(links[0]);
  assert.equal(view.getByTestId('where').textContent, '/messages');
  assert.ok(view.getByRole('heading', { level: 1, name: '消息' }));
  assert.equal(reads.filter(path => path === '/planner/me').length, 1, 'the hub reads the account library once');
});

test('settings rows open the reading sheet and deep-linkable sub-views that return to the hub', async () => {
  localStorage.setItem('currentUser', JSON.stringify(user));
  mockApi();
  const view = render(app(context()));
  const settings = within(view.getByRole('list', { name: '设置' }));
  fireEvent.click(settings.getByRole('button', { name: /字号与简洁显示/ }));
  const sheet = view.getByRole('dialog', { name: '字号与简洁显示' });
  assert.ok(within(sheet).getByRole('switch', { name: '简洁显示（适合长辈）' }));
  fireEvent.click(within(sheet).getByRole('button', { name: '关闭' }));
  fireEvent.click(settings.getByRole('button', { name: /通知/ }));
  assert.equal(view.getByTestId('where').textContent, '/me?view=notifications');
  assert.ok(view.getByRole('heading', { level: 1, name: '通知' }));
  assert.ok(await view.findByRole('button', { name: '开启全部提醒' }));
  fireEvent.click(view.getByRole('button', { name: '返回我的' }));
  assert.equal(view.getByTestId('where').textContent, '/me');
  cleanup();
  const direct = render(app(context(), '/me?view=privacy'));
  assert.ok(await direct.findByRole('heading', { level: 1, name: '账号隐私与安全' }));
  fireEvent.click(direct.getByRole('button', { name: '返回我的' }));
  assert.equal(direct.getByTestId('where').textContent, '/me');
});

test('signed out: one invitation, tiles that still work, and no account reads', async () => {
  mockApi();
  let logins = 0;
  const view = render(app(context({ user: null, messagesBadgeCount: 0, setShowLogin: () => { logins++; } })));
  assert.ok(view.getByRole('heading', { name: '登录后，BayBay 能帮你更多' }));
  fireEvent.click(view.getByRole('button', { name: '登录 / 注册' }));
  assert.equal(logins, 1);
  const tiles = within(view.getByRole('list', { name: '我的常用' }));
  assert.equal(tiles.getAllByRole('link')[0].getAttribute('href'), '/messages');
  assert.match(tiles.getAllByRole('link')[1].textContent || '', /收藏 0 项/);
  assert.ok(view.getByRole('link', { name: '关于与核验方法' }));
  assert.deepEqual(reads, []);
});

test('the hub reads in English and Traditional Chinese without leftover strings', async () => {
  localStorage.setItem('currentUser', JSON.stringify(user));
  mockApi();
  await setLocale('en', false);
  const view = render(app(context()));
  const tiles = view.getByRole('list', { name: 'My shortcuts' });
  assert.ok(!/[㐀-鿿]/.test(tiles.textContent || ''), tiles.textContent || '');
  assert.ok(!/[㐀-鿿]/.test(view.getByRole('list', { name: 'Settings' }).textContent || ''));
  assert.ok(view.getByText('Bay Area plans and practical answers, with sources'));
  await act(async () => { await setLocale('zh-Hant', false); });
  assert.ok(view.getByRole('list', { name: '我的常用' }));
  assert.ok(view.getByRole('link', { name: '消息，3 條未讀' }));
});

test('开启全部提醒 turns on every reported topic for verified channels only, through the existing PATCH', async () => {
  localStorage.setItem('currentUser', JSON.stringify(user));
  for (const topics of [undefined, ['message', 'contact_request', 'outing_request', 'comment']]) {
    const writes: Record<string, unknown>[] = [];
    mockApi((path, options) => {
      if (path !== '/notifications/preferences') return undefined;
      if (!options?.method) return offPreferences(topics ? { topics } : {});
      const body = JSON.parse(String(options.body)); writes.push(body);
      return offPreferences({ ...(topics ? { topics } : {}), preferences: { ...offPreferences().preferences, ...body.preferences } });
    });
    const view = render(<NotificationPreferencesCard userId={user.id} />);
    const enableAll = await view.findByRole('button', { name: '开启全部提醒' });
    await act(async () => { fireEvent.click(enableAll); });
    assert.equal(writes.length, 1);
    const expected = Object.fromEntries((topics || ['message', 'contact_request', 'outing_request']).map(topic => [topic, true]));
    assert.deepEqual((writes[0].preferences as Record<string, unknown>).email, expected);
    assert.ok(Object.values((writes[0].preferences as Record<string, Record<string, boolean>>).sms).every(value => value === false));
    assert.ok(!('enableAll' in writes[0]), 'the request works on the API before and after enableAll ships');
    assert.equal(view.queryByRole('button', { name: '开启全部提醒' }), null);
    assert.match(view.getByRole('status').textContent || '', /已开启全部提醒/);
    cleanup();
  }
});

test('/messages: three round entries, the reminders prompt and the contact requests opened from the first entry', async () => {
  localStorage.setItem('currentUser', JSON.stringify(user));
  mockApi(path => path.startsWith('/contact-requests') ? { requests: [{ id: 'r1', postId: 'p1', postTitle: '旧金山一房出租', status: 'pending', requester: { id: 'u2', nickname: '小王' } }] } : undefined);
  let pending = -1;
  const view = render(app(context({ setPendingContactRequestCount: ((count: number) => { pending = count; }) as AppContextValue['setPendingContactRequestCount'] }), '/messages'));
  const rounds = within(view.getByRole('list', { name: '消息分类' }));
  assert.deepEqual(rounds.getAllByRole('link').map(link => link.getAttribute('href')), ['/together?view=mine', '/me/bookings']);
  const prompt = await view.findByRole('note');
  assert.equal(within(prompt).getByRole('link', { name: '去开启' }).getAttribute('href'), '/me?view=notifications');
  await waitFor(() => assert.equal(pending, 1));
  assert.equal(rounds.getByLabelText('1 个待处理').textContent, '1');
  fireEvent.click(rounds.getByRole('button', { name: /联系请求/ }));
  assert.ok(view.getByRole('button', { name: '同意并发送' }));
  assert.ok(await view.findByRole('heading', { name: '还没有消息' }));
});

test('no reminders prompt when a reminder is on or the setting cannot be read', async () => {
  localStorage.setItem('currentUser', JSON.stringify(user));
  for (const answer of [offPreferences({ preferences: { email: { message: true, contact_request: false, outing_request: false }, sms: {} } }), 'fail']) {
    mockApi(path => path === '/notifications/preferences' ? answer === 'fail' ? Promise.reject({ status: 503 }) : answer : undefined);
    const view = render(app(context(), '/messages'));
    await view.findByRole('heading', { name: '还没有消息' });
    await act(async () => {});
    assert.equal(view.queryByRole('note'), null);
    cleanup();
  }
});

test('system notices lose their URL and record id but keep one in-app link', () => {
  const booking = 'BAYLINK 服务预约 · 已确认\n周末上门理发\n2026-10-17 10:00–11:00（洛杉矶时间）\n预约编号：6f1c2b7e-1a2b-4c3d-8e9f-0123456789ab\nhttps://www.baylink.us/me/bookings\n这是时间安排记录，不含支付；价格、地点和服务范围请双方另行确认。';
  const notice = parseSystemNotice(booking, 'booking_abc');
  assert.equal(notice.kind, 'booking');
  assert.equal(notice.status, '已确认');
  assert.equal(notice.to, '/me/bookings#booking-6f1c2b7e-1a2b-4c3d-8e9f-0123456789ab');
  assert.ok(notice.lines.every(line => !/https?:|[0-9a-f]{8}-[0-9a-f]{4}/.test(line)), notice.lines.join(' | '));
  assert.equal(notice.lines[0], '周末上门理发');
  const outing = parseSystemNotice('BAYLINK 小队 · 收到新的加入申请\n金门公园野餐\nhttps://www.baylink.us/together?outing=abc123\n组队不等于活动购票或主办方报名。', 'outing_9f8e7d6c5b4a39281706f5e4d3c2b1a0f9e8d7c6');
  assert.equal(outing.to, '/together?outing=abc123');
  assert.ok(!outing.lines.join('').includes('http'));
  assert.equal(parseSystemNotice('提醒：https://www.baylink.us/me/bookings', 'system_other').to, undefined);
  assert.equal(previewText(booking), '服务预约 · 已确认');
  assert.equal(previewText(booking, true), 'Service booking · Confirmed');
  assert.equal(previewText('看这里 https://example.test/x 谢谢'), '看这里 谢谢');
  assert.equal(noticeLine(notice.lines[1], false), '10 月 17 日（周六）10:00–11:00（洛杉矶时间）');
  assert.equal(noticeLine(notice.lines[1], true), 'Sat, Oct 17 · 10:00–11:00 (Pacific time)');
  assert.equal(noticeLine('提议时间：2026-10-18 09:00–10:00', false), '提议时间：10 月 18 日（周日）09:00–10:00');
  assert.equal(noticeLine('周末上门理发', true), '周末上门理发');
});
