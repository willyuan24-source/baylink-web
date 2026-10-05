import assert from 'node:assert/strict';
import test, { after, afterEach } from 'node:test';
import { registerHooks } from 'node:module';
import { JSDOM } from 'jsdom';
import React from 'react';

const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'http://localhost/', pretendToBeVisual: true });
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage,
  HTMLElement: dom.window.HTMLElement, Node: dom.window.Node,
  requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
  cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
  getComputedStyle: dom.window.getComputedStyle.bind(dom.window), IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
dom.window.scrollTo = () => {};
const styles = registerHooks({ load(url, context, next) {
  if (url.includes('/socket.io-client/')) return { format: 'module', shortCircuit: true, source: 'export const io = () => ({ on() { return this; }, off() { return this; }, emit() {}, disconnect() {} });' };
  return url.endsWith('.css') ? { format: 'module', shortCircuit: true, source: 'export {}' } : next(url, context);
} });
const { render, fireEvent, cleanup, act } = await import('@testing-library/react');
const { MemoryRouter, Routes, Route, useLocation } = await import('react-router-dom');
const { default: AppLayout } = await import('../src/app/AppLayout');
const { useApp } = await import('../src/app/context');
const { api } = await import('../src/lib/api');
// AppLayout can import lazy overlays while the interaction is running.
after(() => { styles.deregister(); dom.window.close(); });

afterEach(() => { cleanup(); localStorage.clear(); dom.window.sessionStorage.clear(); });

let changeAccount: () => void;
let queueQuestion: () => void;
function FixturePage() {
  const { setUser, openBayBay } = useApp();
  React.useEffect(() => {
    // Empty token keeps this UI-only account transition disconnected from sockets.
    changeAccount = () => setUser({ id: 'next-account', nickname: 'Fixture neighbor', token: '', email: '', contactType: 'wechat', contactValue: '' });
    queueQuestion = () => openBayBay('前一个使用者排队的问题');
  }, [setUser, openBayBay]);
  return <button onClick={() => openBayBay()}>fixture open assistant</button>;
}
function Harness() {
  const location = useLocation();
  return <Routes><Route element={<AppLayout realLocation={location} />}><Route path="*" element={<FixturePage />} /></Route></Routes>;
}

test('changing account clears completed history, aborts pending work and discards queued questions', async t => {
  t.mock.method(api, 'request', async (path: string) => {
    if (path.startsWith('/posts?')) return { posts: [], hasMore: false };
    if (path === '/users/me/blocks') return { blocks: [] };
    if (path.startsWith('/contact-requests')) return { requests: [] };
    if (path === '/conversations') return [];
    throw new Error(`Unexpected fixture API: ${path}`);
  });
  const requests: { signal: AbortSignal; body: { message: string; history: unknown[] }; resolve: (response: Response) => void }[] = [];
  t.mock.method(globalThis, 'fetch', (_url: unknown, options: RequestInit) => new Promise<Response>(resolve => {
    requests.push({ signal: options.signal as AbortSignal, body: JSON.parse(String(options.body)), resolve });
  }));
  const view = render(<MemoryRouter><Harness /></MemoryRouter>);
  fireEvent.click(view.getByRole('button', { name: 'fixture open assistant' }));
  const ask = (value: string) => {
    fireEvent.change(view.getByRole('textbox', { name: '向 BayBay 提问' }), { target: { value } });
    fireEvent.click(view.getByRole('button', { name: '问一下' }));
  };
  ask('前一个使用者的租房问题');
  await act(async () => requests[0].resolve(Response.json({ ok: true, answer: '前一个使用者的回答' })));
  ask('前一个使用者还在等待的追问');
  await act(async () => queueQuestion());
  await act(async () => changeAccount());
  assert.equal(requests[1].signal.aborted, true);
  assert.equal(view.queryByRole('textbox', { name: '向 BayBay 提问' }), null);
  fireEvent.click(view.getByRole('button', { name: 'fixture open assistant' }));
  assert.equal(requests.length, 2, 'the previous account queued question must not start under the new account');
  assert.equal(view.queryByText('前一个使用者的回答'), null);
  ask('新账号自己的问题');
  assert.deepEqual(requests[2].body.history, []);
  await act(async () => requests[1].resolve(Response.json({ ok: true, answer: '迟到的旧账号回答' })));
  assert.equal(view.queryByText('迟到的旧账号回答'), null);
  await act(async () => requests[2].resolve(Response.json({ ok: true, answer: '新账号的回答' })));
  assert.ok(view.getByText('新账号的回答'));
});

test('the login modal can be cancelled or completed without losing an explicit guest conversation and draft', async t => {
  t.mock.method(api, 'request', async (path: string) => {
    if (path === '/auth/login') return { id: 'signed-in-member', nickname: 'Fixture neighbor', token: '', email: '', contactType: 'wechat', contactValue: '' };
    if (path.startsWith('/posts?')) return { posts: [], hasMore: false };
    if (path === '/users/me/blocks') return { blocks: [] };
    if (path.startsWith('/contact-requests')) return { requests: [] };
    if (path === '/conversations') return [];
    throw new Error(`Unexpected fixture API: ${path}`);
  });
  t.mock.method(globalThis, 'fetch', async () => Response.json({ ok: true, answer: '已保留访客的行程条件', assistantSessionToken: 'guest.public-context' }));
  const view = render(<MemoryRouter><Harness /></MemoryRouter>);
  fireEvent.click(view.getByRole('button', { name: 'fixture open assistant' }));
  fireEvent.change(view.getByRole('textbox', { name: '向 BayBay 提问' }), { target: { value: '11月7日两大一小去PIER39' } });
  await act(async () => { fireEvent.click(view.getByRole('button', { name: '问一下' })); });
  fireEvent.change(view.getByRole('textbox', { name: '向 BayBay 提问' }), { target: { value: '还没发送的追问' } });
  fireEvent.click(view.getByRole('button', { name: '登录 / 注册，开启联网' }));
  assert.equal(view.queryByRole('textbox', { name: '向 BayBay 提问' }), null);
  fireEvent.keyDown(document, { key: 'Escape' });
  assert.equal((view.getByRole('textbox', { name: '向 BayBay 提问' }) as HTMLInputElement).value, '还没发送的追问');
  assert.ok(view.getByText('已保留访客的行程条件'));
  fireEvent.click(view.getByRole('button', { name: '登录 / 注册，开启联网' }));
  fireEvent.change(view.getByLabelText('邮箱或用户名'), { target: { value: 'fixture@example.com' } });
  fireEvent.change(view.getByLabelText('密码', { exact: true }), { target: { value: 'fixture-password' } });
  await act(async () => { fireEvent.submit(view.getByLabelText('密码', { exact: true }).closest('form')!); });
  assert.ok(view.getByRole('button', { name: '联网查', exact: true }));
  assert.equal((view.getByRole('textbox', { name: '向 BayBay 提问' }) as HTMLInputElement).value, '还没发送的追问');
  assert.ok(view.getByText('已保留访客的行程条件'));
  await act(async () => changeAccount());
  fireEvent.click(view.getByRole('button', { name: 'fixture open assistant' }));
  assert.equal(view.queryByText('已保留访客的行程条件'), null);
  assert.equal((view.getByRole('textbox', { name: '向 BayBay 提问' }) as HTMLInputElement).value, '');
});

test('a cross-tab token replacement for the same account aborts stale work and restores member search modes', async t => {
  t.mock.method(api, 'request', async (path: string) => {
    if (path.startsWith('/posts?')) return { posts: [], hasMore: false };
    if (path === '/users/me/blocks') return { blocks: [] };
    if (path.startsWith('/contact-requests')) return { requests: [] };
    if (path === '/conversations') return [];
    throw new Error(`Unexpected fixture API: ${path}`);
  });
  const session = (token: string) => JSON.stringify({ id: 'same-account', nickname: 'Fixture member', token });
  localStorage.setItem('currentUser', session('old-session'));
  const calls: { signal: AbortSignal; authorization: string | null; body: { searchMode: string; history: unknown[] }; resolve: (response: Response) => void }[] = [];
  t.mock.method(globalThis, 'fetch', (_url: unknown, options: RequestInit) => new Promise<Response>(resolve => {
    calls.push({ signal: options.signal as AbortSignal, authorization: new Headers(options.headers).get('Authorization'), body: JSON.parse(String(options.body)), resolve });
  }));
  const view = render(<MemoryRouter><Harness /></MemoryRouter>);
  fireEvent.click(view.getByRole('button', { name: 'fixture open assistant' }));
  const ask = (value: string) => { fireEvent.change(view.getByRole('textbox', { name: '向 BayBay 提问' }), { target: { value } }); fireEvent.click(view.getByRole('button', { name: '问一下' })); };
  ask('请核实这周末的营业时间');
  await act(async () => calls[0].resolve(Response.json({ ok: true, answer: '这条旧会话未通过登录验证', retrieval: { requestedMode: 'smart', scope: 'site', webStatus: 'auth_required', webAccess: { authenticated: false, allowed: false, reason: 'auth_required' } } })));
  assert.ok(view.getByText('登录需更新 · 仅站内'));
  ask('先用站内资料继续回答');
  assert.equal(calls[1].body.searchMode, 'site');
  localStorage.setItem('currentUser', session('renewed-session'));
  await act(async () => { window.dispatchEvent(new dom.window.StorageEvent('storage', { key: 'currentUser', oldValue: session('old-session'), newValue: session('renewed-session'), storageArea: localStorage })); });
  assert.equal(calls[1].signal.aborted, true);
  assert.equal(view.queryByRole('textbox', { name: '向 BayBay 提问' }), null);
  fireEvent.click(view.getByRole('button', { name: 'fixture open assistant' }));
  assert.ok(view.getByRole('button', { name: '联网查', exact: true }));
  assert.equal(view.queryByText('登录需更新 · 仅站内'), null);
  assert.equal(view.queryByText('这条旧会话未通过登录验证'), null);
  await act(async () => calls[1].resolve(Response.json({ ok: true, answer: '迟到的旧 token 答复' })));
  assert.equal(view.queryByText('迟到的旧 token 答复'), null);
  ask('现在再核实营业时间');
  assert.equal(calls[2].authorization, 'Bearer renewed-session');
  assert.equal(calls[2].body.searchMode, 'smart');
  assert.deepEqual(calls[2].body.history, []);
  await act(async () => calls[2].resolve(Response.json({ ok: true, answer: '新会话已恢复' })));
  assert.ok(view.getByText('新会话已恢复'));
});
