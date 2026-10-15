// WEB-COMMUNITY-2 item 2 (H76, FCC-08): a guest's 私信 / 请求联系方式 tap opens the sign-in sheet on that scene — the poster's
// name, one line on what an account gives here (only what the product does: replies show in 消息 with an unread count) —
// with 注册 as the primary button, unless this browser has signed in before. Any other way in keeps the generic sheet.
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test, { afterEach } from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://www.baylink.us/posts/1' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
registerHooks({ load(url, context, next) { return url.endsWith('.css') ? { format: 'module', shortCircuit: true, source: 'export {}' } : next(url, context); } });
const { render, cleanup, screen, fireEvent } = await import('@testing-library/react');
const { LoginModal } = await import('../src/features/auth/LoginModal');
const { loginIntent, setLoginIntent, rememberSignedIn } = await import('../src/features/auth/login-intent');
const { useContactIntent } = await import('../src/app/useContactIntent');
const { setLocale } = await import('../src/i18n/locale');
afterEach(async () => { cleanup(); setLoginIntent(null); localStorage.clear(); await setLocale('zh-Hans', false); });
const sheet = () => render(<LoginModal onClose={() => {}} onLogin={() => {}} showToast={() => {}} onForgotPassword={() => {}} />);
const dialogTitle = () => screen.getByRole('dialog').getAttribute('aria-labelledby') && document.getElementById(screen.getByRole('dialog').getAttribute('aria-labelledby')!)!.textContent;

test('a guest who taps 私信 sees that scene and 注册 first; replies are promised only where they really appear', () => {
  setLoginIntent({ kind: 'message', name: 'Will Yuan' });
  sheet();
  assert.equal(dialogTitle(), '注册后私信 Will Yuan');
  assert.equal(screen.getByText(/发私信需要账号/).textContent, '发私信需要账号，注册约 1 分钟。对方回复会出现在「消息」里，并显示未读数。');
  assert.match(screen.getByRole('button', { name: /注册账号/ }).className, /member-auth-submit/);
  fireEvent.click(screen.getByRole('button', { name: '已有账号？去登录' }));
  assert.equal(dialogTitle(), '登录后私信 Will Yuan');
  assert.ok(screen.getByText('登录后就能发私信。对方回复会出现在「消息」里，并显示未读数。'));
});

test('a browser that signed in before opens the same scene on 登录; English reads English with the name kept as written', async () => {
  rememberSignedIn();
  setLoginIntent({ kind: 'message', name: '王小明' });
  sheet();
  assert.equal(dialogTitle(), '登录后私信 王小明');
  assert.ok(screen.getByRole('button', { name: /立即登录/ }));
  cleanup();
  await setLocale('en', false);
  localStorage.clear();
  sheet();
  assert.equal(dialogTitle(), 'Sign up to message 王小明');
  assert.ok(screen.getByText('Messaging needs an account, and signing up takes about a minute. Replies appear in Messages with an unread count.'));
  cleanup();
  // A member who signed out before the known-browser key shipped: a per-account key they left behind counts too.
  localStorage.setItem('baylink.notice-optin.dismissed.v1.member-1', '1');
  sheet();
  assert.equal(dialogTitle(), 'Sign in to message 王小明');
});

test('any other way in keeps the generic sheet on 登录', () => {
  sheet();
  assert.equal(dialogTitle(), '登录');
  assert.equal(document.querySelector('.member-auth-intent'), null);
});

test('the contact intent records the scene for guests only and clears it when cancelled', () => {
  let api: ReturnType<typeof useContactIntent> | null = null;
  let asked = 0;
  function Probe({ user }: { user: { id: string } | null }) { api = useContactIntent({ user: user as never, onLoginNeeded: () => { asked++; }, onOpen: () => {} }); return null; }
  const view = render(<Probe user={null} />);
  api!.openChat('author-1', 'Will Yuan', '出租', 'p1');
  assert.equal(asked, 1);
  assert.deepEqual(loginIntent(), { kind: 'message', name: 'Will Yuan' });
  api!.cancelPendingContact();
  assert.equal(loginIntent(), null);
  view.rerender(<Probe user={{ id: 'member' }} />);
  api!.openChat('author-1', 'Will Yuan');
  assert.equal(loginIntent(), null, 'a member never sees the wall');
});
