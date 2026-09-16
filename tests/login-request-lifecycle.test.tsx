import assert from 'node:assert/strict';
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
  fireEvent.click(first.getByRole('button', { name: '关闭登录注册' }));
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
