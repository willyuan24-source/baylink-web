import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import React from 'react';
import { JSDOM } from 'jsdom';
import { api } from '../src/lib/api';
import { setLocale } from '../src/i18n/locale';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://www.baylink.us/me' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { render, cleanup, fireEvent, act } = await import('@testing-library/react');
const { MfaLoginChallenge } = await import('../src/features/auth/MfaLoginChallenge');
const originalRequest = api.request;
afterEach(async () => { cleanup(); api.request = originalRequest; localStorage.clear(); await setLocale('zh-Hans', false); });

test('an MFA challenge never becomes a session before valid verification; recovery is an explicit choice', async () => {
  await setLocale('en', false);
  let completed = 0, attempts = 0;
  api.request = async (endpoint, options) => {
    assert.equal(endpoint, '/auth/login/totp');
    const body = JSON.parse(String(options?.body));
    assert.equal(body.challengeToken, 'test-only-challenge');
    if (++attempts === 1) { assert.equal(body.totpCode, '123456'); throw { code: 'MFA_INVALID', status: 401 }; }
    assert.equal(body.recoveryCode, 'test-recovery-code');
    assert.equal(body.totpCode, undefined);
    return { id: 'test-account', token: 'test-session' };
  };
  const view = render(<MfaLoginChallenge challengeToken="test-only-challenge" onComplete={() => { completed++; }} onRestart={() => {}} onClose={() => {}} />);
  fireEvent.change(view.getByLabelText('Six-digit authenticator code'), { target: { value: '123456' } });
  await act(async () => { fireEvent.submit(view.container.querySelector('form')!); });
  assert.equal(completed, 0);
  assert.equal(localStorage.getItem('currentUser'), null);
  assert.match(view.getByRole('alert').textContent || '', /invalid or already used/);
  assert.equal((view.getByLabelText('Six-digit authenticator code') as HTMLInputElement).value, '');
  fireEvent.click(view.getByLabelText('Use a recovery code'));
  fireEvent.change(view.getByLabelText('Recovery code', { exact: true }), { target: { value: 'test-recovery-code' } });
  await act(async () => { fireEvent.submit(view.container.querySelector('form')!); });
  assert.equal(completed, 1);
});

test('closing a pending verification aborts it and ignores a late response', async () => {
  await setLocale('en', false);
  let resolve!: (value: unknown) => void;
  let signal: AbortSignal | undefined;
  api.request = async (_endpoint, options) => { signal = options?.signal as AbortSignal; return new Promise(yes => { resolve = yes; }); };
  let completed = 0, closed = 0;
  const view = render(<MfaLoginChallenge challengeToken="test-only-challenge" onComplete={() => { completed++; }} onRestart={() => {}} onClose={() => { closed++; }} />);
  fireEvent.change(view.getByLabelText('Six-digit authenticator code'), { target: { value: '123456' } });
  await act(async () => { fireEvent.submit(view.container.querySelector('form')!); });
  fireEvent.click(view.getByRole('button', { name: 'Close', exact: true }));
  assert.equal(closed, 1);
  assert.equal(signal?.aborted, true);
  await act(async () => { resolve({ id: 'test-account', token: 'late-session' }); });
  assert.equal(completed, 0);
});
