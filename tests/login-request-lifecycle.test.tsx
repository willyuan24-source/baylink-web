import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test, { afterEach } from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';
import type { UserData } from '../src/lib/types';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://www.baylink.us/' });
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage,
  HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
// The sheet dialogs import their stylesheets (WEB-SHELL2, RC-24); node only needs them to resolve.
registerHooks({ load(url, context, next) { return url.endsWith('.css') ? { format: 'module', shortCircuit: true, source: 'export {}' } : next(url, context); } });
const { render, fireEvent, cleanup, act } = await import('@testing-library/react');
const { LoginModal } = await import('../src/features/auth/LoginModal');
const { api } = await import('../src/lib/api');
afterEach(() => { cleanup(); localStorage.clear(); });

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const oldUser = { id: 'old-user', nickname: 'Old User', token: 'old-fixture-token' } as UserData;
const newUser = { id: 'new-user', nickname: 'New User', token: 'new-fixture-token' } as UserData;
function submit(view: ReturnType<typeof render>) {
  fireEvent.change(view.getByLabelText('邮箱或用户名'), { target: { value: 'fixture@example.test' } });
  fireEvent.change(view.getByLabelText('密码'), { target: { value: 'FixturePassword8' } });
  fireEvent.submit(view.getByLabelText('密码').closest('form')!);
}

test('closing a pending login prevents its late success from replacing a newer login', async t => {
  const pending = deferred<UserData>();
  let oldSignal: AbortSignal | null | undefined;
  let requests = 0;
  t.mock.method(api, 'request', async (_path: string, options?: RequestInit) => {
    requests += 1;
    if (requests === 1) { oldSignal = options?.signal; return pending.promise; }
    return newUser;
  });
  const loggedIn: string[] = [];
  const notices: string[] = [];
  const first = render(<LoginModal onClose={() => first.unmount()} onLogin={user => loggedIn.push(user.id)}
    showToast={message => notices.push(message)} onForgotPassword={() => {}} />);
  submit(first);
  fireEvent.click(first.getByRole('button', { name: '关闭' }));
  assert.equal(oldSignal?.aborted, true);
  const second = render(<LoginModal onClose={() => second.unmount()} onLogin={user => loggedIn.push(user.id)}
    showToast={message => notices.push(message)} onForgotPassword={() => {}} />);
  await act(async () => submit(second));
  assert.equal(JSON.parse(localStorage.getItem('currentUser')!).id, newUser.id);
  const noticeCount = notices.length;
  await act(async () => pending.resolve(oldUser));
  assert.deepEqual(loggedIn, [newUser.id]);
  assert.equal(JSON.parse(localStorage.getItem('currentUser')!).id, newUser.id);
  assert.equal(notices.length, noticeCount);
});

test('unmounting login aborts its request and ignores late failure', async t => {
  const pending = deferred<UserData>();
  let signal: AbortSignal | null | undefined;
  let logins = 0;
  t.mock.method(api, 'request', async (_path: string, options?: RequestInit) => { signal = options?.signal; return pending.promise; });
  const view = render(<LoginModal onClose={() => {}} onLogin={() => { logins += 1; }}
    showToast={() => assert.fail('Unmounted login must not show a toast')} onForgotPassword={() => {}} />);
  submit(view);
  view.unmount();
  assert.equal(signal?.aborted, true);
  await act(async () => pending.reject(new Error('Fixture failure')));
  assert.equal(logins, 0);
  assert.equal(localStorage.getItem('currentUser'), null);
});

test('opening password recovery cancels a pending login before switching dialogs', async t => {
  const pending = deferred<UserData>();
  let signal: AbortSignal | null | undefined;
  let recoveries = 0;
  let logins = 0;
  t.mock.method(api, 'request', async (_path: string, options?: RequestInit) => { signal = options?.signal; return pending.promise; });
  const view = render(<LoginModal onClose={() => {}} onLogin={() => { logins += 1; }}
    showToast={() => {}} onForgotPassword={() => { recoveries += 1; }} />);
  submit(view);
  fireEvent.click(view.getByRole('button', { name: '忘记密码?' }));
  assert.equal(recoveries, 1);
  assert.equal(signal?.aborted, true);
  await act(async () => pending.resolve(oldUser));
  assert.equal(logins, 0);
  assert.equal(localStorage.getItem('currentUser'), null);
});

// H34 (HOMEIA13-06): the sign-in / sign-up dialog says the site's one positioning line (as the footer and /me do), not the
// old 连接湾区真实生活信息 / 你的湾区生活，从这里开始, in all three languages.
test('the sign-in and sign-up dialog carries the current positioning line in zh-Hans, zh-Hant and en', async () => {
  const { setLocale } = await import('../src/i18n/locale');
  const expected = { 'zh-Hans': ['湾区去哪、怎么办 · 有来源的中文答案', '注册后，BayBay 能帮你更多'], 'zh-Hant': ['灣區去哪、怎麼辦 · 有來源的中文答案', '註冊後，BayBay 能幫你更多'], en: ['Where to go and how to get it done in the Bay, with sources', 'Create an account and BayBay can do more for you'] } as const;
  try {
    for (const locale of ['zh-Hans', 'zh-Hant', 'en'] as const) {
      await setLocale(locale, false);
      const view = render(<LoginModal onClose={() => {}} onLogin={() => {}} showToast={() => {}} onForgotPassword={() => {}} />);
      const tagline = view.baseElement.querySelector('.member-auth-tagline')!;
      assert.equal(tagline.textContent, expected[locale][0], locale);
      fireEvent.click(view.baseElement.querySelector('.member-auth-switch')!);
      assert.equal(view.baseElement.querySelector('.member-auth-heading h2')!.textContent, expected[locale][1], `${locale}: the register headline`);
      assert.doesNotMatch(view.baseElement.textContent || '', /连接湾区真实生活信息|你的湾区生活|發現身邊的好生活|发现身边的好生活/);
      if (locale === 'en') assert.doesNotMatch(view.baseElement.querySelector('.member-auth-brand')!.textContent || '', /[㐀-鿿]/);
      cleanup();
    }
  } finally { await setLocale('zh-Hans', false); }
});
