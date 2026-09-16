import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
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
  return url.endsWith('.css') ? { format: 'module', shortCircuit: true, source: 'export {}' } : next(url, context);
} });
const { render, fireEvent, cleanup, act } = await import('@testing-library/react');
const { MemoryRouter, Routes, Route, useLocation } = await import('react-router-dom');
const { default: AppLayout } = await import('../src/app/AppLayout');
const { useApp } = await import('../src/app/context');
const { api } = await import('../src/lib/api');
styles.deregister();

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
