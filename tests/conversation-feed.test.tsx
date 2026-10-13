// G91 (CW-08): the unread badge and the inbox share one /conversations poll, and a failed refresh over a list that
// already loaded is a quiet line, not a full-page error.
import assert from 'node:assert/strict';
import test, { after, afterEach, type TestContext } from 'node:test';
import { JSDOM } from 'jsdom';
import { registerHooks } from 'node:module';
import React from 'react';
import type { Conversation, UserData } from '../src/lib/types';

const styles = registerHooks({ load(url, context, next) { return url.endsWith('.css') ? { format: 'module', shortCircuit: true, source: 'export {}' } : next(url, context); } });
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://www.baylink.us/', pretendToBeVisual: true });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, Event: dom.window.Event, IS_REACT_ACT_ENVIRONMENT: true });
let online = true;
Object.defineProperty(dom.window.navigator, 'onLine', { configurable: true, get: () => online });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { render, cleanup, act, fireEvent, within } = await import('@testing-library/react');
const { MemoryRouter } = await import('react-router-dom');
await import('../src/routing');
const { MessagesList } = await import('../src/features/messages/MessagesList');
const { useUnreadMessages } = await import('../src/app/useUnreadMessages');
const { api } = await import('../src/lib/api');
after(() => { styles.deregister(); });
afterEach(() => { cleanup(); online = true; });

const me = { id: 'me', token: 'session-1', email: 'me@example.test', nickname: '我', role: 'user', contactType: 'email', contactValue: '', isBanned: false } as UserData;
const conversation = (id: string, unreadCount = 0): Conversation => ({ id, otherUser: { id: `other-${id}`, nickname: `邻居 ${id}`, city: 'San Francisco', profileTheme: 'bay' }, updatedAt: Date.UTC(2026, 9, 12, 12), unreadCount, lastMessage: `来自 ${id} 的消息` });
function Badge() { return <output aria-label="unread">{useUnreadMessages(me, null)}</output>; }
/** api.request answers from a queue of results (an Error rejects); every call is counted. */
function server(t: TestContext, results: (unknown[] | Error)[]) {
  const calls: string[] = [];
  t.mock.method(api, 'request', async (path: string) => {
    calls.push(path);
    const next = results.length > 1 ? results.shift()! : results[0];
    if (next instanceof Error) throw next;
    return next;
  });
  return calls;
}
const settle = () => act(async () => { for (let index = 0; index < 5; index += 1) await Promise.resolve(); });

test('the badge and the open inbox share one poll: one request per resume and one every 15 s, not one each', async t => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  const calls = server(t, [[conversation('a', 2), conversation('b', 1)]]);
  const view = render(<MemoryRouter><Badge /><MessagesList currentUser={me} /></MemoryRouter>);
  await settle();
  assert.equal(view.getByLabelText('unread').textContent, '3');
  assert.ok(view.getByRole('link', { name: '邻居 a' }));
  const opened = calls.length;
  assert.ok(opened <= 2, `opening the inbox beside the badge asks at most twice (${opened})`);
  // 30 s with the inbox open: every 15 s, one request (the old pair polled 2 + 1 times).
  for (let tick = 0; tick < 2; tick += 1) { act(() => { t.mock.timers.tick(15_000); }); await settle(); }
  assert.equal(calls.length - opened, 2);
  // A resume (tab shown again) refreshes once for both.
  const before = calls.length;
  await act(async () => { document.dispatchEvent(new dom.window.Event('visibilitychange')); });
  await settle();
  assert.equal(calls.length - before, 1);
  assert.ok(calls.every(path => path === '/conversations'));
});

test('one failed refresh keeps the conversations on screen with a quiet line; the next success clears it', async t => {
  const calls = server(t, [[conversation('a', 1)], new Error('network'), [conversation('a', 0), conversation('b')]]);
  const view = render(<MemoryRouter><MessagesList currentUser={me} /></MemoryRouter>);
  await settle();
  assert.ok(view.getByRole('link', { name: '邻居 a' }));
  await act(async () => { window.dispatchEvent(new dom.window.Event('focus')); });
  await settle();
  assert.ok(view.getByRole('link', { name: '邻居 a' }), 'the list stays');
  assert.equal(view.getByRole('status').textContent, '刷新失败，稍后会自动重试。');
  assert.equal(view.queryByRole('heading', { name: '对话暂时没能加载' }), null, 'no full-page error over a working list');
  await act(async () => { window.dispatchEvent(new dom.window.Event('focus')); });
  await settle();
  assert.equal(calls.length, 3);
  assert.ok(view.getByRole('link', { name: '邻居 b' }));
  assert.equal(view.queryByText('刷新失败，稍后会自动重试。'), null);
});

test('an inbox with nothing loaded shows the error state with 重试; offline it waits instead of asking', async t => {
  const calls = server(t, [new Error('down'), [conversation('a')]]);
  const view = render(<MemoryRouter><MessagesList currentUser={me} /></MemoryRouter>);
  await settle();
  const error = view.getByRole('heading', { name: '对话暂时没能加载' }).closest('section')!;
  await act(async () => { fireEvent.click(within(error).getByRole('button', { name: /重试/ })); });
  await settle();
  assert.ok(view.getByRole('link', { name: '邻居 a' }));
  // Offline: a resume does not send a request; the list stays with an offline line.
  online = false;
  const before = calls.length;
  await act(async () => { document.dispatchEvent(new dom.window.Event('visibilitychange')); });
  await settle();
  assert.equal(calls.length, before, 'no request while the browser says it is offline');
  assert.equal(view.getByRole('status').textContent, '网络已断开，连上网络后会自动刷新。');
  online = true;
  await act(async () => { window.dispatchEvent(new dom.window.Event('online')); });
  await settle();
  assert.equal(calls.length, before + 1);
  assert.equal(view.queryByRole('status'), null);
});
