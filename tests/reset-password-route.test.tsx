import assert from 'node:assert/strict';
import test, { after, afterEach, type TestContext } from 'node:test';
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
const { render, fireEvent, cleanup, act, within, waitFor } = await import('@testing-library/react');
const { MemoryRouter, Routes, Route, useLocation, useNavigate } = await import('react-router-dom');
const { default: AppLayout } = await import('../src/app/AppLayout');
const { api } = await import('../src/lib/api');
// AppLayout preloads detail dialogs after mounting; those lazy modules import
// CSS too. Keep the Node-only style loader for the entire mounted test lifetime.
after(() => { styles.deregister(); });

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

function fixture(t: TestContext, resetPath = '/reset-password?token=fixture-reset-token') {
  const calls: { path: string; options?: RequestInit }[] = [];
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('Network forbidden in route regression'); });
  t.mock.method(api, 'request', async (path: string, options?: RequestInit) => {
    calls.push({ path, options });
    if (path.startsWith('/posts?')) return { posts: [], hasMore: false };
    if (path === '/auth/reset-password') return { message: '密码已更新，请重新登录。' };
    throw new Error(`Unexpected API call: ${path}`);
  });
  const view = render(<MemoryRouter initialEntries={['/guides', resetPath]} initialIndex={1}><Harness /></MemoryRouter>);
  return { view, calls };
}

/**
 * The reset dialog loads on first use (WEB-SHELL2), so it commits outside the render's act() and can be in the DOM a
 * moment before ModalShell's mount effect moves focus in and starts listening for Esc. Wait for that effect.
 */
async function resetDialog(view: ReturnType<typeof render>) {
  const dialog = await view.findByRole('dialog', { name: '重设密码', exact: true });
  await waitFor(() => assert.ok(dialog.contains(document.activeElement), 'focus is inside the dialog'));
  return dialog;
}

test('a password reset URL with a trailing slash still opens its token dialog', async t => {
  const { view } = fixture(t, '/reset-password/?token=fixture-reset-token');
  const dialog = await resetDialog(view);
  await act(async () => { fireEvent.keyDown(dialog, { key: 'Escape' }); });
  assert.equal(view.getByTestId('router-location').textContent, '/');
});

test('closing password reset replaces the router entry so Back and Forward cannot restore its token', async t => {
  const { view, calls } = fixture(t);
  // Exercise and await the same lazy modules as AppLayout's idle preload while
  // mounted, rather than letting CPU load decide whether their CSS loads in time.
  await act(async () => { await Promise.all([import('../src/features/posts/PostDetailModal'), import('../src/features/users/UserProfileModal')]); });
  const dialog = await resetDialog(view);
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
  const dialog = within(await resetDialog(view));
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
  const login = await view.findByRole('dialog');
  await waitFor(() => assert.ok(login.contains(document.activeElement), 'focus is inside the sign-in dialog (loaded on first use)'));
  await act(async () => { fireEvent.keyDown(login, { key: 'Escape' }); });
  assert.equal(view.queryByRole('dialog'), null);
  await act(async () => { fireEvent.click(view.getByRole('button', { name: 'fixture back' })); });
  assert.equal(view.getByTestId('router-location').textContent, '/guides');
  await act(async () => { fireEvent.click(view.getByRole('button', { name: 'fixture forward' })); });
  assert.equal(view.getByTestId('router-location').textContent, '/');
  assert.equal(view.queryByRole('dialog', { name: '重设密码', exact: true }), null);
});

// G78 (api #38): the e-mail link carries its token in the fragment; the dialog reads it, posts it unchanged, and the
// token leaves the address bar and the history entry at once. The old ?token= form still works for links already sent.
test('a reset link with #token= opens the dialog, leaves no token in the URL or history, and posts the token unchanged', async t => {
  const token = 'a'.repeat(64);
  const { view, calls } = fixture(t, `/reset-password#token=${token}`);
  const dialog = within(await resetDialog(view));
  assert.equal(view.getByTestId('router-location').textContent, '/reset-password', 'no token in the address bar');
  fireEvent.change(dialog.getByPlaceholderText('新密码', { exact: true }), { target: { value: 'FixturePassword8' } });
  fireEvent.change(dialog.getByPlaceholderText('确认新密码', { exact: true }), { target: { value: 'FixturePassword8' } });
  await act(async () => { fireEvent.click(dialog.getByRole('button', { name: '更新密码', exact: true })); });
  assert.deepEqual(JSON.parse(calls.find(call => call.path === '/auth/reset-password')!.options!.body as string), { token, newPassword: 'FixturePassword8' });
  // Back from the reset entry goes to the page before it; Forward returns to /reset-password without a token.
  await act(async () => { fireEvent.click(dialog.getByRole('button', { name: '去登录', exact: true })); });
  await act(async () => { fireEvent.click(view.getByRole('button', { name: 'fixture back' })); });
  assert.equal(view.getByTestId('router-location').textContent, '/guides');
});

test('the old ?token= link still opens the dialog, and the token is stripped from the address bar at once (other parameters kept)', async t => {
  const { view } = fixture(t, '/reset-password?token=legacy-query-token&lang=en');
  await resetDialog(view);
  assert.equal(view.getByTestId('router-location').textContent, '/reset-password?lang=en');
});

test('the forgot-password request asks for the fragment link style', async t => {
  const bodies: unknown[] = [];
  t.mock.method(api, 'request', async (path: string, options?: RequestInit) => { if (path === '/auth/forgot-password') bodies.push(JSON.parse(String(options?.body))); return { message: 'ok' }; });
  await api.forgotPassword('reader@example.com');
  assert.deepEqual(bodies, [{ email: 'reader@example.com', resetLinkStyle: 'fragment' }]);
});
