// G1: "收到新私信 · 查看" opens the thread in one tap; with unread messages the desktop avatar opens the inbox; the header
// has no 发布 (G16); a toast's action is a real 44 px button; errors close after 8 s instead of sticking (E2E-08).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test, { after, afterEach, type TestContext } from 'node:test';
import { registerHooks } from 'node:module';
import { JSDOM } from 'jsdom';
import postcss from 'postcss';
import React from 'react';

const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'https://www.baylink.us/', pretendToBeVisual: true });
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage,
  HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, Event: dom.window.Event,
  requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
  cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
  getComputedStyle: dom.window.getComputedStyle.bind(dom.window), IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
dom.window.scrollTo = () => {};
// A socket the test can drive: every io() call is recorded with its handlers.
const sockets: { handlers: Record<string, ((payload?: unknown) => void)[]> }[] = [];
Object.assign(globalThis, { __shellSockets: sockets });
const hooks = registerHooks({ load(url, context, next) {
  if (url.includes('/socket.io-client/')) return { format: 'module', shortCircuit: true, source: `export const io = () => { const entry = { handlers: {} }; globalThis.__shellSockets.push(entry);
    const socket = { on(event, handler) { (entry.handlers[event] ||= []).push(handler); return socket; }, off() { return socket; }, emit() {}, disconnect() {} }; return socket; };` };
  return url.endsWith('.css') ? { format: 'module', shortCircuit: true, source: 'export {}' } : next(url, context);
} });
const { render, fireEvent, cleanup, act, within } = await import('@testing-library/react');
const { MemoryRouter, Routes, Route, useLocation } = await import('react-router-dom');
const { default: AppLayout } = await import('../src/app/AppLayout');
const { useApp } = await import('../src/app/context');
const { Toast } = await import('../src/components/Toast');
const { api } = await import('../src/lib/api');
const { SESSION_KEY } = await import('../src/lib/session');
after(() => { hooks.deregister(); });
afterEach(() => { cleanup(); localStorage.clear(); sockets.length = 0; });

test('a toast action is a labelled button: it runs once and closes the toast', () => {
  let opened = 0, closed = 0;
  const view = render(<Toast type="info" message="收到新私信" action={{ label: '查看', onClick: () => opened++ }} onClose={() => closed++} />);
  const button = within(view.getByRole('status')).getByRole('button', { name: '查看' });
  assert.ok(button.classList.contains('site-toast-action'));
  fireEvent.click(button);
  assert.deepEqual([opened, closed], [1, 1]);
});

test('the action button is at least 44 px (48 in 简洁显示) through the shared control height', () => {
  const css = postcss.parse(readFileSync('src/editorial-refinement.css', 'utf8'));
  const declared: Record<string, string> = {};
  css.walkRules('.site-toast-action', rule => rule.walkDecls(declaration => { declared[declaration.prop] = declaration.value; }));
  assert.equal(declared['min-height'], 'var(--control-height)');
  assert.equal(declared['min-width'], 'var(--control-height)');
  const tokens = readFileSync('src/tokens.css', 'utf8');
  assert.match(tokens, /--control-height:2\.75rem/, '44 px at the standard size');
  assert.match(tokens, /--control-height:3rem/, '48 px in 简洁显示');
});

test('errors close after 8 seconds (no longer stuck after a later success); notices after 6; hovering or focusing holds it', context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  let closed = 0;
  const view = render(<Toast type="error" message="照片上传失败" action={{ label: '重试', onClick() {} }} onClose={() => closed++} />);
  act(() => context.mock.timers.tick(7999));
  assert.equal(closed, 0);
  act(() => context.mock.timers.tick(1));
  assert.equal(closed, 1);
  view.unmount();
  closed = 0;
  const held = render(<Toast type="info" message="已保存" onClose={() => closed++} />);
  const box = held.getByRole('status');
  fireEvent.pointerEnter(box);
  act(() => context.mock.timers.tick(60000));
  assert.equal(closed, 0, 'held while the pointer is over it');
  fireEvent.pointerLeave(box);
  act(() => context.mock.timers.tick(6000));
  assert.equal(closed, 1);
});

const member = { id: 'member-1', nickname: '邻居甲', token: 'fixture-token' };
function Harness() {
  const location = useLocation();
  return <><output data-testid="where">{location.pathname}</output>
    <Routes><Route element={<AppLayout realLocation={location} />}><Route path="*" element={<BadgeProbe />} /></Route></Routes></>;
}
function BadgeProbe() { return <output data-testid="badge">{useApp().messagesBadgeCount}</output>; }
function mount(t: TestContext, path: string, unread: number) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(member));
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('Network forbidden in toast tests'); });
  t.mock.method(api, 'request', async (endpoint: string) => {
    if (endpoint.startsWith('/posts?')) return { posts: [], hasMore: false };
    if (endpoint === '/conversations') return unread ? [{ id: 'thread_1', unreadCount: unread }] : [];
    if (endpoint.startsWith('/contact-requests')) return { requests: [] };
    if (endpoint === '/users/me/blocks') return { blocks: [] };
    throw new Error(`Unexpected API call: ${endpoint}`);
  });
  return render(<MemoryRouter initialEntries={[path]}><Harness /></MemoryRouter>);
}
const settle = () => act(async () => { for (let i = 0; i < 5; i++) await new Promise(resolve => setTimeout(resolve, 10)); });
const emit = (event: string, payload: unknown) => act(() => { for (const handler of sockets.at(-1)?.handlers[event] || []) handler(payload); });

test('G1: a new message toast opens its thread in one tap', async t => {
  const view = mount(t, '/guides', 0);
  await settle();
  assert.equal(sockets.length, 1, 'a signed-in reader has a socket');
  emit('new_message', { id: 'm1', conversationId: 'thread_1', senderId: 'other', content: '你好' });
  const toast = view.getByText('收到新私信').closest<HTMLElement>('[role=status]')!;
  await act(async () => { fireEvent.click(within(toast).getByRole('button', { name: '查看' })); });
  assert.equal(view.getByTestId('where').textContent, '/messages/thread_1');
  assert.equal(view.queryByText('收到新私信'), null, 'the toast closes with the tap');
  // on the inbox itself no toast interrupts
  emit('new_message', { id: 'm2', conversationId: 'thread_2' });
  assert.equal(view.queryByText('收到新私信'), null);
  view.unmount();
  sockets.length = 0;
  // a payload without a usable id still leads to the inbox, never to a broken URL
  const other = mount(t, '/events', 0);
  await settle();
  emit('new_message', { conversationId: '../admin' });
  await act(async () => { fireEvent.click(other.getByRole('button', { name: '查看' })); });
  assert.equal(other.getByTestId('where').textContent, '/messages');
});

test('G1: with unread messages the header avatar opens the inbox (the count is in its name); without, it opens 我的', async t => {
  const view = mount(t, '/guides', 2);
  await settle();
  assert.equal(view.getByTestId('badge').textContent, '2', 'messagesBadgeCount is on the app context');
  await act(async () => { fireEvent.click(view.getByRole('button', { name: '消息，2 条未读' })); });
  assert.equal(view.getByTestId('where').textContent, '/messages');
  view.unmount();
  sockets.length = 0;
  const quiet = mount(t, '/guides', 0);
  await settle();
  await act(async () => { fireEvent.click(quiet.getByRole('button', { name: '查看我的资料' })); });
  assert.equal(quiet.getByTestId('where').textContent, '/me');
});

test('G16: the header carries no 发布 button', async t => {
  const view = mount(t, '/', 0);
  await settle();
  assert.equal(view.queryByRole('button', { name: /发布/ }), null);
  assert.equal(document.querySelector('.site-topbar-publish'), null);
});
