import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import React from 'react';
import { JSDOM } from 'jsdom';
import type { UserData } from '../src/lib/types';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://www.baylink.us/me', pretendToBeVisual: true });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { render, fireEvent, cleanup, waitFor, act } = await import('@testing-library/react');
const { PrivacySecurity } = await import('../src/features/profile/PrivacySecurity');
const { MfaLoginChallenge } = await import('../src/features/auth/MfaLoginChallenge');
const { LoginModal } = await import('../src/features/auth/LoginModal');
const { api } = await import('../src/lib/api');
const { setLocale } = await import('../src/i18n/locale');
const originalRequest = api.request;
const user: UserData = { id: 'u1', email: 'me@fixture.invalid', nickname: 'Test', role: 'user', contactType: 'email', contactValue: 'me@fixture.invalid', isBanned: false, token: 'fixture-token' };
afterEach(async () => { cleanup(); api.request = originalRequest; localStorage.clear(); await setLocale('zh-Hans', false); });
const signedIn = () => localStorage.setItem('currentUser', JSON.stringify(user));

test('account deletion requires the explicit phrase and calls local session cleanup only after success', async () => {
  signedIn(); const calls: { endpoint: string; body?: Record<string, unknown> }[] = []; let cleared = 0;
  api.request = async (endpoint, options) => {
    calls.push({ endpoint, body: options?.body ? JSON.parse(String(options.body)) : undefined });
    return endpoint === '/users/me/security' ? { totpEnabled: false, setupAvailable: false, recoveryCodesRemaining: 0 } : { success: true };
  };
  const view = render(<PrivacySecurity user={user} onBack={() => {}} onUpdateUser={() => {}} onSessionEnded={() => { cleared++; }} />);
  await waitFor(() => assert.equal((view.getByRole('button', { name: '查看注销确认' }) as HTMLButtonElement).disabled, false));
  fireEvent.change(view.getByLabelText('当前密码'), { target: { value: 'current-password' } });
  fireEvent.click(view.getByRole('button', { name: '查看注销确认' }));
  const submit = view.getByRole('button', { name: '确认密码并永久注销' });
  assert.equal((submit as HTMLButtonElement).disabled, true);
  fireEvent.change(view.getByLabelText('输入 DELETE MY ACCOUNT 确认不可恢复的注销'), { target: { value: 'DELETE MY ACCOUNT' } });
  fireEvent.click(submit);
  await waitFor(() => assert.equal(cleared, 1));
  assert.equal(calls.filter(call => call.endpoint.includes('/privacy/account')).length, 1);
  assert.deepEqual(calls.at(-1)?.body, { password: 'current-password', totpCode: '', confirmation: 'DELETE MY ACCOUNT' });
  assert.ok(!calls.some(call => call.endpoint === '/auth/logout'));
});

test('privacy controls are complete English and disable unavailable admin MFA setup honestly', async () => {
  const admin = { ...user, role: 'admin' as const }; localStorage.setItem('currentUser', JSON.stringify(admin)); await setLocale('en', false);
  api.request = async () => ({ totpEnabled: false, setupAvailable: false, recoveryCodesRemaining: 0 });
  const view = render(<PrivacySecurity user={admin} onBack={() => {}} onUpdateUser={() => {}} onSessionEnded={() => {}} />);
  await waitFor(() => assert.ok(view.getByText(/The server has not configured a separate encryption key/)));
  assert.equal((view.getByRole('button', { name: 'Set up an authenticator' }) as HTMLButtonElement).disabled, true);
  assert.ok(view.getByRole('heading', { name: 'Account privacy and security' }));
  assert.ok(!/[\u3400-\u9fff]/.test(view.container.textContent || ''));
});

test('late deletion completion after leaving the profile cannot clear a newer session', async () => {
  signedIn(); let resolveDelete!: (value: unknown) => void; let cleared = 0;
  api.request = async endpoint => endpoint === '/users/me/security' ? { totpEnabled: false, setupAvailable: false, recoveryCodesRemaining: 0 } : new Promise(resolve => { resolveDelete = resolve; });
  const view = render(<PrivacySecurity user={user} onBack={() => {}} onUpdateUser={() => {}} onSessionEnded={() => { cleared++; }} />);
  await waitFor(() => assert.equal((view.getByRole('button', { name: '查看注销确认' }) as HTMLButtonElement).disabled, false));
  fireEvent.change(view.getByLabelText('当前密码'), { target: { value: 'current-password' } }); fireEvent.click(view.getByRole('button', { name: '查看注销确认' }));
  fireEvent.change(view.getByLabelText('输入 DELETE MY ACCOUNT 确认不可恢复的注销'), { target: { value: 'DELETE MY ACCOUNT' } }); fireEvent.click(view.getByRole('button', { name: '确认密码并永久注销' }));
  await waitFor(() => assert.ok(resolveDelete)); view.unmount(); localStorage.setItem('currentUser', JSON.stringify({ ...user, id: 'another', token: 'another-token' }));
  await act(async () => resolveDelete({ success: true })); assert.equal(cleared, 0);
});

test('login password response with MFA challenge does not store a user or complete login', async () => {
  let loggedIn = 0;
  api.request = async () => ({ mfaRequired: true, challengeToken: 'challenge-only' });
  const view = render(<LoginModal onClose={() => {}} onLogin={() => { loggedIn++; }} showToast={() => {}} onForgotPassword={() => {}} />);
  fireEvent.change(view.getByLabelText('邮箱或用户名'), { target: { value: 'admin' } }); fireEvent.change(view.getByLabelText('密码'), { target: { value: 'test-password' } });
  fireEvent.submit(view.getByRole('button', { name: /立即登录/ }).closest('form')!);
  await waitFor(() => assert.ok(view.getByRole('heading', { name: '确认两步验证' })));
  assert.equal(loggedIn, 0); assert.equal(localStorage.getItem('currentUser'), null);
  assert.equal(view.queryByLabelText('密码'), null);
});

test('MFA English challenge submits only code and challenge, never the account password', async () => {
  await setLocale('en', false); let payload: Record<string, unknown> | undefined, completed = 0;
  api.request = async (endpoint, options) => { assert.equal(endpoint, '/auth/login/totp'); payload = JSON.parse(String(options?.body)); return user; };
  const view = render(<MfaLoginChallenge challengeToken="challenge-only" onComplete={() => { completed++; }} onRestart={() => {}} onClose={() => {}} />);
  fireEvent.change(view.getByLabelText('Six-digit authenticator code'), { target: { value: '123456' } }); fireEvent.submit(view.getByRole('button', { name: 'Verify and sign in' }).closest('form')!);
  await waitFor(() => assert.equal(completed, 1)); assert.deepEqual(payload, { challengeToken: 'challenge-only', totpCode: '123456' });
  assert.ok(!/[\u3400-\u9fff]/.test(view.container.textContent || ''));
});
