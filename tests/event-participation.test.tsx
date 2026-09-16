import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import React from 'react';
import type { AppContextValue } from '../src/app/context';
import type { MonthlyEvent } from '../src/data/monthly-types';
import type { EventEngagement, EventInterest } from '../src/lib/event-engagement';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/this-month' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage,
  HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
dom.window.HTMLElement.prototype.getClientRects = function () { return (this.isConnected && !this.hidden ? [{ width: 1, height: 1 }] : []) as unknown as DOMRectList; };
const { render, fireEvent, cleanup, act, waitFor, within } = await import('@testing-library/react');
const { MemoryRouter, Routes, Route, Outlet } = await import('react-router-dom');
const { EventParticipationProvider, EventParticipationActions } = await import('../src/components/EventParticipation');
const { api } = await import('../src/lib/api');
const { getEventEngagement, getEventBuddies, setEventInterest, parseEventEngagement } = await import('../src/lib/event-engagement');
afterEach(() => { cleanup(); localStorage.clear(); });

const EVENT: MonthlyEvent = {
  id: 'future-festival', title: '邻里秋日活动', startDate: '2026-10-17', endDate: '2026-10-18', dateLabel: '10 月 17–18 日',
  region: 'east-bay', city: 'Oakland', venue: 'Community Park', category: 'family', cost: 'free', costLabel: '免费入场',
  summary: 'A fictional event used only in isolated UI tests.', plan: [], audience: [], officialUrl: 'https://example.test/event', sourceLabel: 'Official organizer', verifiedAt: '2026-09-15', imageKey: '',
};
const state = (me: EventInterest | null = { interested: false, lookingForBuddy: false }, count = 7, buddyCount = 2): EventEngagement => ({ eventId: EVENT.id, interestedCount: count, buddyCount, me });
const list = (entry = state()) => ({ events: [entry] });
const buddy = { id: 'neighbor', nickname: 'Harbor Neighbor', avatar: '', city: 'Oakland' };
const buddyList = { eventId: EVENT.id, buddies: [buddy], nextCursor: null };
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
function controls() {
  const logins: boolean[] = [], toasts: { message: string; kind?: string }[] = [], chats: unknown[][] = [], profiles: string[] = [];
  const app = (id: string | null) => ({
    user: id ? { id, nickname: id } : null,
    setShowLogin: (value: boolean) => { logins.push(value); },
    showToast: (message: string, kind?: string) => { toasts.push({ message, kind }); },
    openChat: (...args: unknown[]) => { chats.push(args); },
    openUserProfile: (value: string) => { profiles.push(value); },
  }) as unknown as AppContextValue;
  return { app, logins, toasts, chats, profiles };
}
function fixture(app?: AppContextValue, today = '2026-10-15') {
  const contents = <EventParticipationProvider events={[EVENT]}><EventParticipationActions event={EVENT} today={today} /></EventParticipationProvider>;
  return <MemoryRouter><Routes><Route element={<Outlet context={app} />}><Route index element={contents} /></Route></Routes></MemoryRouter>;
}
const interestedButton = (view: ReturnType<typeof render>, selected = false) => view.getByRole('button', { name: `${selected ? '取消想去' : '我想去'}：${EVENT.title}`, exact: true });
const getNote = (count: number) => `${count} 人想去 · 意向不等于报名或购票。`;

test('renders server counts and makes one idempotent private-interest set while a click is pending', async t => {
  const actions = controls();
  const save = deferred<EventEngagement>();
  const mutations: EventInterest[] = [];
  t.mock.method(api, 'request', async (path: string, options: RequestInit = {}) => {
    if (options.method === 'PUT') { mutations.push(JSON.parse(String(options.body))); return save.promise; }
    assert.match(path, /^\/events\/engagement\?ids=/);
    return list();
  });
  const view = render(fixture(actions.app('owner')));
  await view.findByText(getNote(7));
  const button = interestedButton(view);
  fireEvent.click(button); fireEvent.click(button);
  assert.equal((button as HTMLButtonElement).disabled, true);
  assert.deepEqual(mutations, [{ interested: true, lookingForBuddy: false }]);
  assert.equal(actions.toasts.length, 0);
  assert.ok(view.getByText(getNote(7)), 'a pending write must not invent a higher count');
  await act(async () => save.resolve(state({ interested: true, lookingForBuddy: false }, 8)));
  assert.ok(view.getByText(getNote(8)));
  assert.equal(interestedButton(view, true).getAttribute('aria-pressed'), 'true');
  assert.deepEqual(actions.toasts.map(item => item.kind), ['success']);
  assert.deepEqual(actions.chats, []);
});

test('guest browsing stays public; interest and buddy signup request login only when explicitly clicked', async t => {
  const actions = controls(), writes: unknown[] = [];
  t.mock.method(api, 'request', async (path: string, options: RequestInit = {}) => {
    if (options.method) writes.push(options);
    return path.includes('/buddies?') ? buddyList : list(state(null));
  });
  const view = render(fixture(actions.app(null)));
  await view.findByText(getNote(7));
  assert.deepEqual(actions.logins, []);
  fireEvent.click(interestedButton(view));
  assert.deepEqual(actions.logins, [true]);
  assert.deepEqual(writes, []);
  fireEvent.click(view.getByRole('button', { name: /^一起去/ }));
  const dialog = await view.findByRole('dialog', { name: '一起去 · 活动搭子' });
  assert.ok(within(dialog).getByText('由你决定是否公开加入'));
  assert.deepEqual(actions.logins, [true], 'opening the public list must not prompt login');
  await within(dialog).findByText(buddy.nickname);
  fireEvent.click(within(dialog).getByRole('button', { name: '登录后加入一起去' }));
  assert.deepEqual(actions.logins, [true, true]);
  assert.deepEqual(writes, []);
  assert.deepEqual(actions.chats, []);
});

test('failed counts and malformed count payloads display unavailable rather than zero participants', async t => {
  const actions = controls();
  let count = 0;
  t.mock.method(api, 'request', async () => {
    count++;
    if (count === 1) throw new Error('network unavailable');
    if (count === 2) return list({ ...state(), interestedCount: -1 });
    return list(state(null, 0, 0));
  });
  const view = render(fixture(actions.app(null)));
  await view.findByText('人数暂时无法加载');
  assert.equal(view.queryByText(getNote(0)), null);
  assert.match(interestedButton(view).textContent || '', /—/);
  fireEvent.click(view.getByRole('button', { name: '重试' }));
  await waitFor(() => assert.equal(count, 2));
  await view.findByText('人数暂时无法加载');
  assert.equal(view.queryByText(getNote(0)), null);
  fireEvent.click(view.getByRole('button', { name: '重试' }));
  await view.findByText(getNote(0));
  assert.deepEqual(actions.toasts, []);
});

test('a failed mutation shows no success or optimistic membership and refetches the actual saved state', async t => {
  const actions = controls();
  const refresh = deferred<ReturnType<typeof list>>();
  let reads = 0;
  t.mock.method(api, 'request', async (_path: string, options: RequestInit = {}) => {
    if (options.method === 'PUT') throw new Error('write acknowledgement unavailable');
    return ++reads === 1 ? list() : refresh.promise;
  });
  const view = render(fixture(actions.app('owner')));
  await view.findByText(getNote(7));
  fireEvent.click(interestedButton(view));
  await waitFor(() => assert.equal(actions.toasts.length, 1));
  assert.equal(actions.toasts[0].kind, 'error');
  assert.equal(interestedButton(view).getAttribute('aria-pressed'), 'false');
  assert.equal(view.queryByText(getNote(8)), null);
  assert.equal(reads, 2);
  // A lost acknowledgement may follow a completed server write. The read,
  // rather than the rejected promise or a local increment, decides what won.
  await act(async () => refresh.resolve(list(state({ interested: true, lookingForBuddy: false }, 8))));
  assert.equal(interestedButton(view, true).getAttribute('aria-pressed'), 'true');
  assert.deepEqual(actions.toasts.map(item => item.kind), ['error']);
});

test('public buddy membership needs the disclosed CTA, exits retain private interest, and joins never send a message', async t => {
  const actions = controls(), writes: EventInterest[] = [];
  let current = state({ interested: true, lookingForBuddy: false });
  t.mock.method(api, 'request', async (path: string, options: RequestInit = {}) => {
    if (options.method === 'PUT') {
      const value = JSON.parse(String(options.body)); writes.push(value);
      current = state(value, 7, value.lookingForBuddy ? 3 : 2);
      return current;
    }
    return path.includes('/buddies?') ? buddyList : list(current);
  });
  const view = render(fixture(actions.app('owner')));
  await view.findByText(getNote(7));
  fireEvent.click(view.getByRole('button', { name: /^一起去/ }));
  const dialog = await view.findByRole('dialog', { name: '一起去 · 活动搭子' });
  await within(dialog).findByText(buddy.nickname);
  assert.match(dialog.textContent || '', /昵称、头像与城市/);
  assert.deepEqual(writes, []);
  fireEvent.click(within(dialog).getByRole('button', { name: '公开加入一起去' }));
  await within(dialog).findByRole('button', { name: '退出一起去' });
  assert.deepEqual(writes, [{ interested: true, lookingForBuddy: true }]);
  assert.deepEqual(actions.chats, []);
  fireEvent.click(within(dialog).getByRole('button', { name: '退出一起去' }));
  await within(dialog).findByRole('button', { name: '公开加入一起去' });
  assert.deepEqual(writes[1], { interested: true, lookingForBuddy: false });
  assert.equal(interestedButton(view, true).getAttribute('aria-pressed'), 'true');
  assert.deepEqual(actions.chats, []);
});

test('opening profiles or reading the buddy list never sends a DM; only the message button opens chat', async t => {
  const actions = controls();
  const requests: { path: string; method?: string }[] = [];
  t.mock.method(api, 'request', async (path: string, options: RequestInit = {}) => {
    requests.push({ path, method: options.method });
    return path.includes('/buddies?') ? buddyList : list();
  });
  const view = render(fixture(actions.app('owner')));
  await view.findByText(getNote(7));
  fireEvent.click(view.getByRole('button', { name: /^一起去/ }));
  const dialog = await view.findByRole('dialog', { name: '一起去 · 活动搭子' });
  fireEvent.click(await within(dialog).findByText(buddy.nickname));
  assert.deepEqual(actions.chats, []);
  assert.deepEqual(actions.profiles, [buddy.id]);
  fireEvent.click(view.getByRole('button', { name: /^一起去/ }));
  const reopened = await view.findByRole('dialog', { name: '一起去 · 活动搭子' });
  fireEvent.click(await within(reopened).findByRole('button', { name: '私信聊聊' }));
  assert.deepEqual(actions.chats, [[buddy.id, buddy.nickname, EVENT.title]]);
  assert.ok(requests.every(request => !request.method), 'this UI delegates chat opening; it never posts a message');
  assert.equal(view.queryByRole('dialog', { name: '一起去 · 活动搭子' }), null);
});

test('a guest buddy message delegates the target to the resumable chat flow', async t => {
  const actions = controls();
  t.mock.method(api, 'request', async (path: string) => path.includes('/buddies?') ? buddyList : list(state(null)));
  const view = render(fixture(actions.app(null)));
  await view.findByText(getNote(7));
  fireEvent.click(view.getByRole('button', { name: /^一起去/ }));
  const dialog = await view.findByRole('dialog', { name: '一起去 · 活动搭子' });
  fireEvent.click(await within(dialog).findByRole('button', { name: '私信聊聊' }));
  assert.deepEqual(actions.chats, [[buddy.id, buddy.nickname, EVENT.title]]);
  assert.deepEqual(actions.logins, [], 'openChat owns the login continuation and must receive the target first');
  assert.equal(view.queryByRole('dialog'), null);
});

test('a late initial buddy response cannot replace the list refreshed after joining', async t => {
  const actions = controls();
  const initial = deferred<typeof buddyList>();
  const freshBuddy = { ...buddy, id: 'new-neighbor', nickname: 'New Neighbor' };
  let buddyReads = 0;
  let initialSignal: AbortSignal | null | undefined;
  t.mock.method(api, 'request', async (path: string, options: RequestInit = {}) => {
    if (options.method === 'PUT') return state({ interested: true, lookingForBuddy: true });
    if (!path.includes('/buddies?')) return list();
    if (++buddyReads === 1) { initialSignal = options.signal; return initial.promise; }
    return { ...buddyList, buddies: [freshBuddy] };
  });
  const view = render(fixture(actions.app('owner')));
  await view.findByText(getNote(7));
  fireEvent.click(view.getByRole('button', { name: /^一起去/ }));
  const dialog = await view.findByRole('dialog', { name: '一起去 · 活动搭子' });
  fireEvent.click(within(dialog).getByRole('button', { name: '公开加入一起去' }));
  await within(dialog).findByText(freshBuddy.nickname);
  assert.equal(initialSignal?.aborted, true);
  await act(async () => initial.resolve(buddyList));
  assert.ok(within(dialog).getByText(freshBuddy.nickname));
  assert.equal(within(dialog).queryByText(buddy.nickname), null);
});

test('duplicate pagination is locked and stale pages cannot append after a membership refresh', async t => {
  const actions = controls();
  const page = deferred<typeof buddyList>();
  const lateBuddy = { ...buddy, id: 'late-neighbor', nickname: 'Late Neighbor' };
  const freshBuddy = { ...buddy, id: 'fresh-neighbor', nickname: 'Fresh Neighbor' };
  let initialReads = 0, pageReads = 0;
  t.mock.method(api, 'request', async (path: string, options: RequestInit = {}) => {
    if (options.method === 'PUT') return state({ interested: true, lookingForBuddy: true });
    if (!path.includes('/buddies?')) return list();
    if (path.includes('&cursor=')) { pageReads++; return page.promise; }
    return ++initialReads === 1 ? { ...buddyList, nextCursor: 'page-2' } : { ...buddyList, buddies: [freshBuddy] };
  });
  const view = render(fixture(actions.app('owner')));
  await view.findByText(getNote(7));
  fireEvent.click(view.getByRole('button', { name: /^一起去/ }));
  const dialog = await view.findByRole('dialog');
  const more = await within(dialog).findByRole('button', { name: '查看更多搭子' });
  fireEvent.click(more); fireEvent.click(more);
  assert.equal(pageReads, 1);
  fireEvent.click(within(dialog).getByRole('button', { name: '公开加入一起去' }));
  await within(dialog).findByText(freshBuddy.nickname);
  await act(async () => page.resolve({ ...buddyList, buddies: [lateBuddy] }));
  assert.ok(within(dialog).getByText(freshBuddy.nickname));
  assert.equal(within(dialog).queryByText(lateBuddy.nickname), null);
  assert.equal(within(dialog).queryByRole('button', { name: '查看更多搭子' }), null);
});

test('closing the buddy sheet aborts its read and a pending join does not reopen or fetch the closed list', async t => {
  const actions = controls(), save = deferred<EventEngagement>(), initial = deferred<typeof buddyList>();
  let buddyReads = 0;
  let signal: AbortSignal | null | undefined;
  t.mock.method(api, 'request', async (path: string, options: RequestInit = {}) => {
    if (options.method === 'PUT') return save.promise;
    if (!path.includes('/buddies?')) return list();
    buddyReads++; signal = options.signal; return initial.promise;
  });
  const view = render(fixture(actions.app('owner')));
  await view.findByText(getNote(7));
  fireEvent.click(view.getByRole('button', { name: /^一起去/ }));
  const dialog = await view.findByRole('dialog');
  fireEvent.click(within(dialog).getByRole('button', { name: '公开加入一起去' }));
  fireEvent.click(within(dialog).getByRole('button', { name: '关闭一起去' }));
  assert.equal(signal?.aborted, true);
  await act(async () => {
    save.resolve(state({ interested: true, lookingForBuddy: true }));
    initial.resolve(buddyList);
  });
  assert.equal(buddyReads, 1);
  assert.equal(view.queryByRole('dialog'), null);
});

test('same-account token rotation clears membership and ignores old reads and writes', async t => {
  const actions = controls(), oldRead = deferred<ReturnType<typeof list>>(), oldWrite = deferred<EventEngagement>();
  let reads = 0;
  t.mock.method(api, 'request', async (_path: string, options: RequestInit = {}) => {
    if (options.method === 'PUT') return oldWrite.promise;
    if (++reads === 1) return list();
    if (reads === 2) return oldRead.promise;
    return list(state({ interested: false, lookingForBuddy: false }, 11));
  });
  const first = actions.app('owner'); first.user!.token = 'first-session';
  const second = actions.app('owner'); second.user!.token = 'second-session';
  const view = render(fixture(first));
  await view.findByText(getNote(7));
  fireEvent(window, new dom.window.Event('focus'));
  fireEvent.click(interestedButton(view));
  view.rerender(fixture(second));
  await view.findByText(getNote(11));
  await act(async () => {
    oldRead.resolve(list(state({ interested: true, lookingForBuddy: true }, 98)));
    oldWrite.resolve(state({ interested: true, lookingForBuddy: false }, 99));
  });
  assert.ok(view.getByText(getNote(11)));
  assert.equal(interestedButton(view).getAttribute('aria-pressed'), 'false');
  assert.deepEqual(actions.toasts, []);
});

test('an ended public membership retains a pending-disabled exit and one cancellation request', async t => {
  const actions = controls(), save = deferred<EventEngagement>();
  let writes = 0;
  t.mock.method(api, 'request', async (path: string, options: RequestInit = {}) => {
    if (options.method === 'PUT') { writes++; return save.promise; }
    return path.includes('/buddies?') ? buddyList : list(state({ interested: true, lookingForBuddy: true }));
  });
  const view = render(fixture(actions.app('owner'), '2026-10-19'));
  await view.findByText(getNote(7));
  fireEvent.click(view.getByRole('button', { name: /^一起去/ }));
  const dialog = await view.findByRole('dialog');
  const exit = within(dialog).getByRole('button', { name: '退出已结束活动' }) as HTMLButtonElement;
  fireEvent.click(exit); fireEvent.click(exit);
  assert.equal(exit.disabled, true);
  assert.equal(writes, 1);
  await act(async () => save.resolve(state({ interested: false, lookingForBuddy: false }, 6)));
  assert.equal(within(dialog).queryByRole('button', { name: '退出已结束活动' }), null);
  assert.ok(within(dialog).getByText('活动已结束，不再接受新的出行意向。'));
});

test('buddy transport rejects another event, malformed profile fields and repeated pagination cursors', async t => {
  const invalid = [
    { ...buddyList, eventId: 'another-event' },
    { ...buddyList, buddies: [{ ...buddy, city: { private: true } }] },
    { ...buddyList, buddies: [{ ...buddy, avatar: 42 }] },
    { ...buddyList, nextCursor: 'page-2' },
  ];
  t.mock.method(api, 'request', async () => invalid.shift());
  for (let index = 0; index < 3; index++) await assert.rejects(getEventBuddies(EVENT.id), /Invalid buddy/);
  await assert.rejects(getEventBuddies(EVENT.id, 'page-2'), /Invalid buddy/);
});

test('authentication changes clear private state and ignore both an old read and a pending old-user write', async t => {
  const actions = controls();
  const oldRead = deferred<ReturnType<typeof list>>(), newRead = deferred<ReturnType<typeof list>>(), oldWrite = deferred<EventEngagement>();
  let reads = 0;
  t.mock.method(api, 'request', async (_path: string, options: RequestInit = {}) => {
    if (options.method === 'PUT') return oldWrite.promise;
    if (++reads === 1) return oldRead.promise;
    if (reads === 2) return newRead.promise;
    return list(state(null, 9));
  });
  const view = render(fixture(actions.app('first-user')));
  view.rerender(fixture(actions.app('second-user')));
  assert.equal(interestedButton(view).getAttribute('aria-pressed'), 'false');
  assert.equal((interestedButton(view) as HTMLButtonElement).disabled, true);
  await act(async () => newRead.resolve(list(state({ interested: false, lookingForBuddy: false }, 11))));
  await act(async () => oldRead.resolve(list(state({ interested: true, lookingForBuddy: true }, 99, 90))));
  assert.ok(view.getByText(getNote(11)));
  assert.equal(interestedButton(view).getAttribute('aria-pressed'), 'false');
  fireEvent.click(interestedButton(view));
  view.rerender(fixture(actions.app(null)));
  await view.findByText(getNote(9));
  await act(async () => oldWrite.resolve(state({ interested: true, lookingForBuddy: true }, 12, 3)));
  assert.ok(view.getByText(getNote(9)));
  assert.equal(interestedButton(view).getAttribute('aria-pressed'), 'false');
  assert.deepEqual(actions.toasts, [], 'a completed old-user request must not toast into a new session');
});

test('a focus refresh started during a save cannot overwrite a later confirmed mutation', async t => {
  const actions = controls();
  const background = deferred<ReturnType<typeof list>>(), save = deferred<EventEngagement>();
  let reads = 0;
  t.mock.method(api, 'request', async (_path: string, options: RequestInit = {}) => {
    if (options.method === 'PUT') return save.promise;
    return ++reads === 1 ? list() : background.promise;
  });
  const view = render(fixture(actions.app('owner')));
  await view.findByText(getNote(7));
  fireEvent.click(interestedButton(view));
  fireEvent(window, new dom.window.Event('focus'));
  assert.equal(reads, 2);
  await act(async () => save.resolve(state({ interested: true, lookingForBuddy: false }, 8)));
  assert.ok(view.getByText(getNote(8)));
  await act(async () => background.resolve(list()));
  assert.ok(view.getByText(getNote(8)), 'late pre-save data must not roll back the confirmed interest');
  assert.equal(interestedButton(view, true).getAttribute('aria-pressed'), 'true');
});

test('ended events refuse a new interest but retain the cancellation path for existing members', async t => {
  const actions = controls(), writes: EventInterest[] = [];
  let current = state({ interested: false, lookingForBuddy: false });
  t.mock.method(api, 'request', async (_path: string, options: RequestInit = {}) => {
    if (options.method === 'PUT') { const value = JSON.parse(String(options.body)); writes.push(value); current = state(value, 6); return current; }
    return list(current);
  });
  const view = render(fixture(actions.app('owner'), '2026-10-19'));
  await view.findByText(getNote(7));
  assert.equal((interestedButton(view) as HTMLButtonElement).disabled, true);
  fireEvent.click(interestedButton(view));
  assert.deepEqual(writes, []);
  current = state({ interested: true, lookingForBuddy: true });
  fireEvent(window, new dom.window.Event('focus'));
  await view.findByRole('button', { name: `取消想去：${EVENT.title}` });
  fireEvent.click(interestedButton(view, true));
  await view.findByText(getNote(6));
  assert.deepEqual(writes, [{ interested: false, lookingForBuddy: false }]);
});

test('provider without an AppLayout context makes no public or authenticated requests', async t => {
  let calls = 0;
  t.mock.method(api, 'request', async () => { calls++; throw new Error('standalone views must not fetch'); });
  render(fixture());
  await act(async () => {});
  fireEvent(window, new dom.window.Event('focus'));
  assert.equal(calls, 0);
});

test('transport validation rejects impossible counts, partial batches and a write response for another event', async t => {
  for (const candidate of [{ ...state(), interestedCount: -1 }, { ...state(), interestedCount: 1.5 }, { ...state(), buddyCount: 8 }, { ...state(), me: { interested: false, lookingForBuddy: true } }]) assert.throws(() => parseEventEngagement(candidate));
  const responses = [{ events: [] }, { events: [state({ interested: false, lookingForBuddy: false })] }, { events: [state(), state()] }, { ...state(), eventId: 'wrong-event' }];
  t.mock.method(api, 'request', async () => responses.shift());
  await assert.rejects(getEventEngagement([EVENT.id]));
  await assert.rejects(getEventEngagement([EVENT.id, 'another-event']));
  await assert.rejects(getEventEngagement([EVENT.id]), /Incomplete/);
  await assert.rejects(setEventInterest(EVENT.id, { interested: true, lookingForBuddy: false }), /event|participation|response/i);
});
