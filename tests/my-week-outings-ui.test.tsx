import assert from 'node:assert/strict';
import test, { after, afterEach, beforeEach, type TestContext } from 'node:test';
import React from 'react';
import { JSDOM } from 'jsdom';
import type { Outing } from '../src/lib/outings';
import type { UserData } from '../src/lib/types';

const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'https://www.baylink.us/my-week' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { render, fireEvent, cleanup, act, within } = await import('@testing-library/react');
const { MemoryRouter } = await import('react-router-dom');
const { MyWeekOutings } = await import('../src/features/outings/MyWeekOutings');
const { default: MyWeekPage } = await import('../src/pages/MyWeekPage');
const { api } = await import('../src/lib/api');
const { setLocale } = await import('../src/i18n/locale');
const { MONTHLY_EVENTS } = await import('../src/data/monthly-edition');
const originalEvents = [...MONTHLY_EVENTS];
const now = Date.parse('2026-10-16T18:00:00Z');
const account = { id: 'member', token: 'member-token', nickname: 'Neighbour', email: 'member@example.test', role: 'user', contactType: 'email', contactValue: 'member@example.test', isBanned: false } as UserData;
const fixture = (patch: Partial<Outing> = {}): Outing => ({
  id: 'calendar-fixture', title: '已约好的公园散步', description: 'Only a local test.', eventId: null,
  date: '2026-10-17', startTime: '14:00', endTime: '16:00', city: 'Fremont', venue: 'Public entrance', capacity: 3,
  costNote: 'Own costs', transport: 'transit', language: 'any', startAt: Date.parse('2026-10-17T21:00:00Z'), endAt: Date.parse('2026-10-17T23:00:00Z'), timezone: 'America/Los_Angeles',
  status: 'open', revision: 4, planVersion: 2, host: { id: 'host', nickname: 'Host', verified: true }, confirmedCount: 2,
  me: { userId: account.id, role: 'member', status: 'confirmed', confirmedVersion: 2 }, createdAt: now, updatedAt: now, ...patch,
});
const noop = () => {};
const signIn = (user: UserData | null) => user ? localStorage.setItem('currentUser', JSON.stringify(user)) : localStorage.removeItem('currentUser');
const page = (user: UserData | null = account, onLoginNeeded = noop) => <MemoryRouter><MyWeekOutings user={user} onLoginNeeded={onLoginNeeded}/></MemoryRouter>;
const deferred = <T,>() => { let resolve!: (value: T) => void; let reject!: (reason: unknown) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const capture = (t: TestContext) => {
  const blobs: Blob[] = [];
  t.mock.method(URL, 'createObjectURL', (blob: Blob) => { blobs.push(blob); return 'blob:test-calendar'; });
  t.mock.method(URL, 'revokeObjectURL', noop);
  t.mock.method(dom.window.HTMLAnchorElement.prototype, 'click', noop);
  return blobs;
};
beforeEach(async t => { t.mock.timers.enable({ apis: ['Date'], now }); localStorage.clear(); signIn(account); await setLocale('zh-Hans'); });
afterEach(() => { cleanup(); MONTHLY_EVENTS.splice(0, MONTHLY_EVENTS.length, ...originalEvents); });
after(() => dom.window.close());

test('guest My Week never calls private APIs and asks for login only after an explicit click', async t => {
  signIn(null); let logins = 0, reads = 0;
  t.mock.method(api, 'request', async () => { reads++; throw new Error('Unexpected account API'); });
  const view = render(page(null, () => logins++)); await act(async () => {});
  assert.equal(reads, 0); assert.equal(logins, 0); assert.ok(view.getByText(/收藏活动不会自动报名/));
  fireEvent.click(view.getByRole('button', { name: '登录查看小队' })); assert.equal(logins, 1);
});

test('StrictMode loads sorted real plans, marks reconfirmation, and keeps requests/waitlists outside confirmed cards', async t => {
  const member = fixture().me!;
  const rows = [fixture({ id: 'pending', title: '待审核', me: { ...member, status: 'requested' } }),
    fixture({ id: 'reconfirm', title: '已改安排', me: { ...member, confirmedVersion: 1 } }),
    fixture({ id: 'waitlisted', title: '候补申请', me: { ...member, status: 'requested', waitlisted: true } }),
    fixture({ id: 'hosted', title: '我发起的早场', startTime: '09:00', endTime: '10:00', startAt: Date.parse('2026-10-17T16:00:00Z'), endAt: Date.parse('2026-10-17T17:00:00Z'), host: { id: account.id, nickname: 'Me', verified: true }, me: { ...member, role: 'host' } }),
    fixture(), fixture({ id: 'cancelled', title: '已经取消', status: 'cancelled' })];
  t.mock.method(api, 'request', async (path: string) => { assert.equal(path, '/outings/me'); return { outings: rows }; });
  const view = render(<React.StrictMode>{page()}</React.StrictMode>);
  await view.findByRole('heading', { name: '我发起的早场' });
  const cards = [...view.container.querySelectorAll('.week-outing-card')];
  assert.deepEqual(cards.map(card => card.querySelector('h3')?.textContent), ['我发起的早场', '已约好的公园散步', '已改安排']);
  assert.equal((within(cards[2] as HTMLElement).getByRole('button', { name: '存入日历' }) as HTMLButtonElement).disabled, true);
  assert.ok(view.getByText('安排已变，待重新确认'));
  assert.ok(view.getByRole('heading', { name: '待处理申请 · 尚未加入' }));
  assert.ok(view.getByText('申请待确认，尚未加入')); assert.ok(view.getByText('候补中，尚未加入'));
  assert.equal(view.queryByText('已经取消'), null);
  assert.equal(view.container.querySelector('.week-outing-requests button'), null, 'pending requests cannot be exported');
  assert.equal(view.getByRole('link', { name: '已约好的公园散步' }).getAttribute('href'), '/together?view=mine&outing=calendar-fixture');
  assert.equal(view.getByRole('link', { name: '找同行 ↗' }).getAttribute('href'), '/together');
});

test('account switching and logout discard old rows and late results immediately', async t => {
  const pending = deferred<unknown>(); let firstSignal: AbortSignal | null | undefined;
  t.mock.method(api, 'request', async (_path: string, options: RequestInit) => { firstSignal ||= options.signal; return pending.promise; });
  const view = render(page());
  const next = { ...account, id: 'other', token: 'other-token' }; signIn(next); view.rerender(page(next));
  assert.equal(firstSignal?.aborted, true);
  await act(async () => pending.resolve({ outings: [fixture()] }));
  assert.equal(view.queryByText('已约好的公园散步'), null);
  await view.findByRole('alert');
  signIn(null); view.rerender(page(null)); assert.equal(view.queryByRole('alert'), null);
  assert.ok(view.getByRole('button', { name: '登录查看小队' }));
});

test('rotating a token for the same account remounts and ignores the previous session response', async t => {
  const pending = deferred<unknown>(); let reads = 0, oldSignal: AbortSignal | null | undefined;
  t.mock.method(api, 'request', async (_path: string, options: RequestInit) => {
    if (++reads === 1) { oldSignal = options.signal; return pending.promise; }
    return { outings: [fixture({ title: '新会话记录' })] };
  });
  const view = render(page());
  const fresh = { ...account, token: 'rotated-token' }; signIn(fresh); view.rerender(page(fresh));
  await view.findByText('新会话记录'); assert.equal(oldSignal?.aborted, true);
  await act(async () => pending.resolve({ outings: [fixture({ title: '旧会话记录' })] }));
  assert.equal(view.queryByText('旧会话记录'), null);
  signIn(null); view.rerender(page(null)); assert.equal(view.queryByText('新会话记录'), null);
});

test('refresh failures hide old private results and can retry instead of claiming no outings', async t => {
  let fail = false;
  t.mock.method(api, 'request', async () => { if (fail) throw { status: 503 }; return { outings: [fixture()] }; });
  const view = render(page()); await view.findByText('已约好的公园散步');
  fail = true; fireEvent.click(view.getByRole('button', { name: '刷新小队安排' })); await view.findByRole('alert');
  assert.equal(view.queryByText('已约好的公园散步'), null); assert.equal(view.queryByText(/未来7天还没有/), null);
  fail = false; fireEvent.click(view.getByRole('button', { name: '重新读取小队' })); await view.findByText('已约好的公园散步');
});

test('calendar export revalidates the account and latest plan before producing exact timestamps', async t => {
  const blobs = capture(t), reads: string[] = [], pending = deferred<unknown>();
  t.mock.method(api, 'request', async (path: string) => { reads.push(path); return path === '/outings/me' ? { outings: [fixture()] } : pending.promise; });
  const view = render(page()); await view.findByText('已约好的公园散步');
  fireEvent.click(view.getByRole('button', { name: '存入日历' })); fireEvent.click(view.getByRole('button', { name: '正在核对…' }));
  assert.equal(blobs.length, 0); assert.deepEqual(reads, ['/outings/me', '/outings/calendar-fixture']);
  await act(async () => pending.resolve({ outing: fixture() })); assert.equal(blobs.length, 1);
  const file = (await blobs[0].text()).replace(/\r\n /g, '');
  assert.match(file, /DTSTART:20261017T210000Z\r\nDTEND:20261017T230000Z/);
  assert.ok(view.getByText(/日历文件已生成，请按浏览器提示保存/));
});

test('changed or cancelled arrangements never silently export the stale card', async t => {
  const blobs = capture(t); let latest = fixture({ planVersion: 3, title: '更新后的安排' });
  t.mock.method(api, 'request', async (path: string) => path === '/outings/me' ? { outings: [fixture()] } : { outing: latest });
  const view = render(page()); await view.findByText('已约好的公园散步');
  fireEvent.click(view.getByRole('button', { name: '存入日历' })); await view.findByText('更新后的安排');
  assert.equal(blobs.length, 0); assert.ok(view.getByText(/安排或你的参加状态已变化/));
  assert.equal((view.getByRole('button', { name: '存入日历' }) as HTMLButtonElement).disabled, true);
  latest = fixture({ status: 'cancelled' }); fireEvent.click(view.getByRole('button', { name: '刷新小队安排' })); await view.findByText('已约好的公园散步');
  fireEvent.click(view.getByRole('button', { name: '存入日历' })); await act(async () => {});
  assert.equal(blobs.length, 0); assert.equal(view.queryByText('已约好的公园散步'), null);
});

test('changing language during calendar validation clears the old busy state and ignores its late export', async t => {
  const pending = deferred<unknown>(), blobs = capture(t);
  t.mock.method(api, 'request', async (path: string) => path === '/outings/me' ? { outings: [fixture()] } : pending.promise);
  const view = render(page()); await view.findByText('已约好的公园散步');
  fireEvent.click(view.getByRole('button', { name: '存入日历' }));
  await act(async () => { await setLocale('en'); });
  await view.findByRole('button', { name: 'Save to calendar' });
  assert.equal((view.getByRole('button', { name: 'Refresh group plans' }) as HTMLButtonElement).disabled, false);
  assert.equal((view.getByRole('button', { name: 'Save to calendar' }) as HTMLButtonElement).disabled, false);
  await act(async () => pending.resolve({ outing: fixture() })); assert.equal(blobs.length, 0);
});

test('even the host reviews a changed plan first, and export failure or a late prior-session reply cannot download', async t => {
  const host = { ...account, id: 'host', token: 'host-token' }; signIn(host);
  const hosted = fixture({ me: null }); const blobs = capture(t); let latest: unknown = { outing: { ...hosted, planVersion: 3, title: '最新名称' } };
  let fail = false;
  t.mock.method(api, 'request', async (path: string) => { if (path === '/outings/me') return { outings: [hosted] }; if (fail) throw { status: 503 }; return latest; });
  const view = render(page(host)); await view.findByText(hosted.title);
  fireEvent.click(view.getByRole('button', { name: '存入日历' })); await view.findByText('最新名称');
  assert.equal(blobs.length, 0); assert.ok(view.getByText(/安排已更新，已刷新卡片/));
  fail = true; fireEvent.click(view.getByRole('button', { name: '存入日历' })); await view.findByRole('alert'); assert.equal(blobs.length, 0);
  const pending = deferred<unknown>(); latest = pending.promise; fail = false;
  fireEvent.click(view.getByRole('button', { name: '重新读取小队' })); await view.findByText(hosted.title);
  fireEvent.click(view.getByRole('button', { name: '存入日历' }));
  signIn(account); view.rerender(page());
  await act(async () => pending.resolve({ outing: hosted })); assert.equal(blobs.length, 0);
});

test('My Week event card downloads only its displayed confirmed day rather than all future sessions', async t => {
  signIn(null); const blobs = capture(t);
  const event = { ...originalEvents[0], id: 'my-week-session-fixture', title: '本周活动日期', startDate: '2026-10-01', endDate: '2026-10-31', occurrenceDates: ['2026-10-03', '2026-10-17', '2026-10-31'] };
  MONTHLY_EVENTS.splice(0, MONTHLY_EVENTS.length, event);
  t.mock.method(api, 'request', async () => { throw new Error('Guest page does not use private API'); });
  const view = render(<MemoryRouter><MyWeekPage/></MemoryRouter>);
  await view.findByRole('link', { name: event.title });
  const card = view.getByRole('link', { name: event.title }).closest('article')!;
  assert.equal(card.querySelector('.week-event-date time')?.getAttribute('datetime'), '2026-10-17');
  assert.match(card.querySelector('.week-event-date')!.textContent!, /本次日期.*2026-10-17/);
  assert.match(card.querySelector('.week-event-range')!.textContent!, /活动完整日期/);
  assert.match(card.querySelector('a[href^="/plan?"]')!.getAttribute('href')!, /date=2026-10-17/);
  fireEvent.click(within(card).getByRole('button', { name: '提醒这一天' })); assert.equal(blobs.length, 1);
  const file = (await blobs[0].text()).replace(/\r\n /g, '');
  assert.equal((file.match(/BEGIN:VEVENT/g) || []).length, 1); assert.match(file, /DTSTART;VALUE=DATE:20261017/);
  assert.equal(file.includes('DTSTART;VALUE=DATE:20261031'), false);
});
