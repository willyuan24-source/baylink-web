import assert from 'node:assert/strict';
import test, { afterEach, type TestContext } from 'node:test';
import { registerHooks } from 'node:module';
import { JSDOM } from 'jsdom';
import React from 'react';

const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', {
  url: 'https://www.baylink.us/reset-password?token=fixture-reset-token', pretendToBeVisual: true,
});
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
const { render, fireEvent, cleanup, act, within } = await import('@testing-library/react');
const { MemoryRouter, Routes, Route, useLocation, useNavigate } = await import('react-router-dom');
const { default: AppLayout } = await import('../src/app/AppLayout');
const { api } = await import('../src/lib/api');
styles.deregister();

afterEach(() => { cleanup(); localStorage.clear(); dom.window.sessionStorage.clear(); });

function Harness() {
  const location = useLocation();
  const navigate = useNavigate();
  return <><output data-testid="router-location">{location.pathname}{location.search}{location.hash}</output>
    <button onClick={() => navigate(-1)}>fixture back</button>
    <button onClick={() => navigate(1)}>fixture forward</button>
    <Routes><Route element={<AppLayout realLocation={location} />}><Route path="*" element={<div>fixture page</div>} /></Route></Routes>
  </>;
}

function fixture(t: TestContext) {
  const calls: { path: string; options?: RequestInit }[] = [];
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('Network forbidden in route regression'); });
  t.mock.method(api, 'request', async (path: string, options?: RequestInit) => {
    calls.push({ path, options });
    if (path.startsWith('/posts?')) return { posts: [], hasMore: false };
    if (path === '/auth/reset-password') return { message: '密码已更新，请重新登录。' };
    throw new Error(`Unexpected API call: ${path}`);
  });
  const view = render(<MemoryRouter initialEntries={['/guides', '/reset-password?token=fixture-reset-token']} initialIndex={1}><Harness /></MemoryRouter>);
  return { view, calls };
}

test('closing password reset replaces the router entry so Back and Forward cannot restore its token', async t => {
  const { view, calls } = fixture(t);
  const dialog = await view.findByRole('dialog', { name: '重设密码', exact: true });
  await act(async () => { fireEvent.keyDown(dialog, { key: 'Escape' }); });
  assert.equal(view.getByTestId('router-location').textContent, '/');
  assert.equal(view.queryByRole('dialog', { name: '重设密码', exact: true }), null);
  await act(async () => { fireEvent.click(view.getByRole('button', { name: 'fixture back' })); });
  assert.equal(view.getByTestId('router-location').textContent, '/guides');
  await act(async () => { fireEvent.click(view.getByRole('button', { name: 'fixture forward' })); });
  assert.equal(view.getByTestId('router-location').textContent, '/');
  assert.equal(view.queryByRole('dialog', { name: '重设密码', exact: true }), null);
  assert.ok(!calls.some(call => call.path === '/auth/reset-password'));
});

test('successful password reset clears the router token before opening login', async t => {
  const { view, calls } = fixture(t);
  const dialog = within(await view.findByRole('dialog', { name: '重设密码', exact: true }));
  fireEvent.change(dialog.getByPlaceholderText('新密码', { exact: true }), { target: { value: 'FixturePassword8' } });
  fireEvent.change(dialog.getByPlaceholderText('确认新密码', { exact: true }), { target: { value: 'FixturePassword8' } });
  await act(async () => { fireEvent.click(dialog.getByRole('button', { name: '更新密码', exact: true })); });
  assert.equal(calls.filter(call => call.path === '/auth/reset-password').length, 1);
  assert.deepEqual(JSON.parse(calls.find(call => call.path === '/auth/reset-password')!.options!.body as string), {
    token: 'fixture-reset-token', newPassword: 'FixturePassword8',
  });
  await act(async () => { fireEvent.click(dialog.getByRole('button', { name: '去登录', exact: true })); });
  assert.equal(view.getByTestId('router-location').textContent, '/');
  assert.equal(view.queryByRole('dialog', { name: '重设密码', exact: true }), null);
  // Close login before testing ordinary history navigation.
  const login = view.getByRole('dialog');
  await act(async () => { fireEvent.keyDown(login, { key: 'Escape' }); });
  await act(async () => { fireEvent.click(view.getByRole('button', { name: 'fixture back' })); });
  assert.equal(view.getByTestId('router-location').textContent, '/guides');
  await act(async () => { fireEvent.click(view.getByRole('button', { name: 'fixture forward' })); });
  assert.equal(view.getByTestId('router-location').textContent, '/');
  assert.equal(view.queryByRole('dialog', { name: '重设密码', exact: true }), null);
});
