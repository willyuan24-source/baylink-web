import assert from 'node:assert/strict';
import test, { beforeEach, afterEach } from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://www.baylink.us/en/me' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, CustomEvent: dom.window.CustomEvent, IS_REACT_ACT_ENVIRONMENT: true });
dom.window.HTMLElement.prototype.getClientRects = function () { return (this.isConnected && !this.hidden ? [{ width: 1, height: 1 }] : []) as unknown as DOMRectList; };
const { render, fireEvent, cleanup, act, within } = await import('@testing-library/react');
const { MemoryRouter } = await import('react-router-dom');
const { api } = await import('../src/lib/api');
const { setLocale } = await import('../src/i18n/locale');
const { NotificationPreferencesCard } = await import('../src/features/profile/NotificationPreferencesCard');
const { default: NotificationTokenPage } = await import('../src/pages/NotificationTokenPage');
const original = api.request;
const settings = (verified = true) => ({ preferences: { email: { message: false, contact_request: false, outing_request: false }, sms: { message: false, contact_request: false, outing_request: false } }, emailVerified: verified, phoneVerified: false, deliveryEnabled: false, emailDeliveryAvailable: false, smsDeliveryAvailable: false });
beforeEach(async context => { localStorage.setItem('currentUser', JSON.stringify({ id: 'owner', token: 'test-only' })); await setLocale('en', false); context.mock.method(globalThis, 'fetch', async () => new Response('{}')); });
afterEach(() => { cleanup(); api.request = original; localStorage.clear(); });

test('notification settings stay off until an explicit save and unverified phone stays disabled', async () => {
  const writes: any[] = [];
  api.request = async (_path, options) => { if (!options?.method) return settings(); const payload = JSON.parse(String(options.body)); writes.push(payload); return { ...settings(), preferences: payload.preferences }; };
  const view = render(<NotificationPreferencesCard userId="owner" />);
  await view.findByRole('button', { name: 'Save notification preferences' });
  const email = within(view.getByRole('group', { name: 'Email reminders' }));
  const phone = within(view.getByRole('group', { name: 'SMS reminders' }));
  assert.equal(writes.length, 0); assert.ok(view.getAllByRole('checkbox').every(item => !(item as HTMLInputElement).checked));
  assert.ok(phone.getAllByRole('checkbox').every(item => (item as HTMLInputElement).disabled));
  fireEvent.click(email.getByRole('checkbox', { name: 'New private messages' })); assert.equal(writes.length, 0);
  await act(async () => { fireEvent.click(view.getByRole('button', { name: 'Save notification preferences' })); });
  assert.equal(writes.length, 1); assert.equal(writes[0].preferences.email.message, true); assert.equal(writes[0].preferences.sms.message, false);
  assert.equal(writes[0].locale, 'en');
});

test('queued verification with delivery disabled never claims the email was sent', async () => {
  const calls: string[] = []; api.request = async path => { calls.push(path); return settings(false); };
  const view = render(<NotificationPreferencesCard userId="owner" />); const button = await view.findByRole('button', { name: 'Request verification email' });
  await act(async () => { fireEvent.click(button); });
  assert.equal(calls.filter(path => path === '/notifications/email/start').length, 1);
  assert.match(view.getByRole('status').textContent || '', /Email delivery is not enabled/);
  assert.ok(view.getAllByRole('checkbox').every(item => (item as HTMLInputElement).disabled));
});

test('late preference reads from a prior account cannot restore the old account choices', async () => {
  let finish!: (value: unknown) => void, reads = 0;
  api.request = async () => ++reads === 1 ? new Promise(resolve => { finish = resolve; }) : settings();
  const view = render(<NotificationPreferencesCard userId="owner" />);
  localStorage.setItem('currentUser', JSON.stringify({ id: 'other', token: 'other-test' })); view.rerender(<NotificationPreferencesCard userId="other" />);
  await view.findByRole('button', { name: 'Save notification preferences' });
  await act(async () => { const old = settings(); old.preferences.email.message = true; finish(old); });
  assert.ok(view.getAllByRole('checkbox').every(item => !(item as HTMLInputElement).checked));
});

test('verification and opt-out token pages require confirmation before a POST and never auto opt in', async () => {
  for (const purpose of ['verify', 'unsubscribe'] as const) {
    const calls: { path: string; body: unknown }[] = [];
    api.request = async (path, options) => { calls.push({ path, body: JSON.parse(String(options?.body)) }); return { ok: true }; };
    const token = 'A'.repeat(43), view = render(<MemoryRouter initialEntries={[`/verify-email#token=${token}`]}><NotificationTokenPage purpose={purpose} /></MemoryRouter>);
    assert.equal(calls.length, 0);
    await act(async () => { fireEvent.click(view.getByRole('button', { name: 'Confirm' })); });
    assert.deepEqual(calls, [{ path: purpose === 'verify' ? '/notifications/email/verify' : '/notifications/unsubscribe', body: { token } }]);
    assert.ok(view.getByRole('status')); assert.equal(view.queryByRole('button', { name: 'Confirm' }), null);
    cleanup();
  }
});
