// WEB-COMMUNITY-2 item 1 (H14 web part, api #44 contract): every sentence about email reminders is true whether the server's
// preset is on or off (defaultsActive / defaultsApplied / customized), the two verification calls send the page language,
// the verify page says what it turned on, the unsubscribe page names the kind it turns off and keeps the confirm tap, and the
// person who receives a first message gets the same reminder offer as the sender.
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test, { afterEach } from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://www.baylink.us/me', pretendToBeVisual: true });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
dom.window.HTMLElement.prototype.getClientRects = function () { return (this.isConnected && !this.hidden ? [{ width: 1, height: 1 }] : []) as unknown as DOMRectList; };
registerHooks({ load(url, context, next) { return url.endsWith('.css') ? { format: 'module', shortCircuit: true, source: 'export {}' } : next(url, context); } });
const { render, fireEvent, cleanup, act, within, screen, waitFor } = await import('@testing-library/react');
const { MemoryRouter } = await import('react-router-dom');
const { api } = await import('../src/lib/api');
const { setLocale } = await import('../src/i18n/locale');
const { normalize, defaultsState } = await import('../src/features/profile/notification-settings');
const { NotificationPreferencesCard } = await import('../src/features/profile/NotificationPreferencesCard');
const { NoticeOptIn } = await import('../src/features/posts/NoticeOptIn');
const { default: NotificationTokenPage } = await import('../src/pages/NotificationTokenPage');
const original = api.request;
afterEach(async () => { cleanup(); api.request = original; localStorage.clear(); await setLocale('zh-Hans', false); });

const off = { message: false, contact_request: false, outing_request: false, comment: false };
const preset = { email: { message: true, contact_request: true, outing_request: false, comment: false }, sms: off };
/** The api #44 DTO. `active` is the server's preset switch (false until the captain's flip PR). */
const dto = ({ active = true, verified = true, applied = false, customized = false, email = off } = {}) => ({
  preferences: { email, sms: off }, emailVerified: verified, phoneVerified: false, deliveryEnabled: true, emailDeliveryAvailable: true, smsDeliveryAvailable: true,
  topics: ['message', 'contact_request', 'outing_request', 'comment'], defaults: preset, defaultsActive: active, defaultsApplied: applied, customized,
});
const member = () => localStorage.setItem('currentUser', JSON.stringify({ id: 'owner', token: 'test-only', email: 'owner@example.test' }));
const token = 'A'.repeat(43);
const tokenPage = (purpose: 'verify' | 'unsubscribe', hash: string) => render(<MemoryRouter initialEntries={[{ pathname: purpose === 'verify' ? '/verify-email' : '/notifications/unsubscribe', hash }]}><NotificationTokenPage purpose={purpose} /></MemoryRouter>);

test('an older server without the H14 fields reads as "preset off": no default is ever claimed', () => {
  const legacy = normalize({ preferences: { email: { message: false } }, emailVerified: true });
  assert.equal(legacy.defaultsActive, false); assert.equal(legacy.defaultsApplied, false); assert.equal(legacy.customized, false);
  assert.equal(defaultsState(legacy), 'off');
  assert.equal(defaultsState(normalize(dto({ verified: false }))), 'pending');
  assert.equal(defaultsState(normalize(dto({ applied: true, email: preset.email }))), 'applied');
  assert.equal(defaultsState(normalize(dto({ applied: true, customized: true }))), 'chosen', 'turned off since: their choice');
  assert.equal(defaultsState(normalize(dto({ active: false, verified: false }))), 'off');
});

test('the settings card says what is true in each state and marks the preset on the email switches only while it is on', async () => {
  member();
  const cases = [
    { answer: dto({ active: false }), lead: /^由你主动选择接收。/, tag: false },
    { answer: dto({ verified: false }), lead: /^验证邮箱后，「新的私信」「新的联系请求」会默认用邮件提醒你，可随时关闭。/, tag: true },
    { answer: dto({ applied: true, email: preset.email }), lead: /^验证邮箱后，已按默认为你开启「新的私信」「新的联系请求」邮件提醒，可随时关闭。/, tag: true },
    { answer: dto({ customized: true }), lead: /^按你保存的选择接收，可随时更改。/, tag: true },
  ];
  for (const { answer, lead, tag } of cases) {
    api.request = (async () => answer) as typeof api.request;
    const view = render(<NotificationPreferencesCard userId="owner" />);
    await view.findByRole('button', { name: '保存通知偏好' });
    const intro = view.getByRole('heading', { name: '站外通知' }).nextElementSibling!.textContent!;
    assert.match(intro, lead);
    assert.doesNotMatch(intro, answer.defaultsActive ? /由你主动选择接收/ : /默认/);
    const email = within(view.getByRole('group', { name: '邮件提醒' }));
    assert.equal(email.queryAllByText('验证后默认开启').length, tag ? 2 : 0);
    assert.equal(within(view.getByRole('group', { name: '短信提醒' })).queryAllByText('验证后默认开启').length, 0, 'SMS stays opt-in');
    assert.match(view.container.querySelector('.me-notify__hint')!.textContent!, /每封提醒邮件里也有「关闭这类邮件」链接，只关闭那一类提醒/);
    cleanup();
  }
});

test('requesting the verification email sends the page language and says what confirming will turn on', async () => {
  member();
  await setLocale('en', false);
  const bodies: unknown[] = [];
  api.request = (async (path: string, options?: RequestInit) => {
    if (path === '/notifications/email/start') { bodies.push(JSON.parse(String(options!.body))); return { ...dto({ verified: false }), queued: true }; }
    return dto({ verified: false });
  }) as typeof api.request;
  const view = render(<NotificationPreferencesCard userId="owner" />);
  const request = await view.findByRole('button', { name: 'Request verification email' });
  await act(async () => { fireEvent.click(request); });
  assert.deepEqual(bodies, [{ locale: 'en' }]);
  assert.match(view.getByRole('status').textContent!, /Once you confirm, new private messages and new contact requests are emailed to you by default\./);
});

test('the reminder offer: a first message received gets it too; with the preset on, confirming the email is what turns it on', async () => {
  member();
  const starts: unknown[] = [];
  api.request = (async (path: string, options?: RequestInit) => {
    if (path === '/notifications/email/start') { starts.push(JSON.parse(String(options!.body))); return { ...dto({ verified: false }), queued: true }; }
    return dto({ verified: false });
  }) as typeof api.request;
  render(<MemoryRouter><NoticeOptIn userId="owner" context="received" /></MemoryRouter>);
  const offer = await screen.findByRole('region', { name: '站外提醒' });
  assert.match(offer.textContent!, /下次有人私信你、或请求你的联系方式时，要不要用邮件提醒你？/);
  assert.match(offer.textContent!, /确认后这两类提醒就会开启，可随时关闭/);
  await act(async () => { fireEvent.click(within(offer).getByRole('button', { name: '先验证邮箱' })); });
  assert.deepEqual(starts, [{ locale: 'zh-Hans' }]);
  assert.match(screen.getByRole('status').textContent!, /^验证邮件已发送。点开邮件里的链接确认后，新的私信和联系请求就会用邮件提醒你；可在「我的 › 通知」关闭。$/);
  cleanup();
  // Preset off: the old sentence, which is true then.
  api.request = (async (path: string) => path === '/notifications/email/start' ? { ...dto({ active: false, verified: false }), queued: true } : dto({ active: false, verified: false })) as typeof api.request;
  render(<MemoryRouter><NoticeOptIn userId="owner" context="post" /></MemoryRouter>);
  const plain = await screen.findByRole('region', { name: '站外提醒' });
  assert.match(plain.textContent!, /确认后再开启提醒/);
  await act(async () => { fireEvent.click(within(plain).getByRole('button', { name: '先验证邮箱' })); });
  assert.match(screen.getByRole('status').textContent!, /到「我的 › 通知」开启提醒/);
});

test('verify page: nothing happens before the tap; it sends the language and says what this verification turned on', async () => {
  const calls: { path: string; body: Record<string, unknown> }[] = [];
  for (const applied of [true, false]) {
    api.request = (async (path: string, options?: RequestInit) => { calls.push({ path, body: JSON.parse(String(options!.body)) }); return { ok: true, emailVerified: true, defaultsApplied: applied }; }) as typeof api.request;
    const view = tokenPage('verify', `#token=${token}`);
    assert.match(view.getByRole('main').textContent!, /确认后，这里会告诉你哪些邮件提醒已开启/);
    assert.doesNotMatch(view.getByRole('main').textContent!, /不会自动开启/);
    assert.equal(calls.length, applied ? 0 : 1, 'the confirm tap stays');
    await act(async () => { fireEvent.click(view.getByRole('button', { name: '确认' })); });
    assert.deepEqual(calls.at(-1), { path: '/notifications/email/verify', body: { token, locale: 'zh-Hans' } });
    assert.equal(view.getByRole('status').textContent, applied
      ? '邮箱已验证。已按默认开启「新的私信」「新的联系请求」两类邮件提醒，可在「我的 › 通知」关闭。'
      : '邮箱已验证。可在「我的 › 通知」查看和更改邮件提醒。');
    assert.equal(view.getByRole('link', { name: '打开通知设置' }).getAttribute('href'), '/me?view=notifications');
    cleanup();
  }
});

test('unsubscribe page: the link names its kind before the tap; the answer names the kind and channel it turned off', async () => {
  const sent: unknown[] = [];
  api.request = (async (_path: string, options?: RequestInit) => { sent.push(JSON.parse(String(options!.body))); return { ok: true, channel: 'email', topic: 'contact_request' }; }) as typeof api.request;
  let view = tokenPage('unsubscribe', `#token=${token}&kind=contact_request`);
  assert.equal(view.getByRole('main').querySelector('p')!.textContent, '确认后，将关闭这条链接对应的「新的联系请求」提醒；其他提醒不变。');
  assert.equal(sent.length, 0, 'opening the link changes nothing (mail scanners)');
  assert.equal(dom.window.location.hash, '', 'the token leaves the address bar');
  await act(async () => { fireEvent.click(view.getByRole('button', { name: '确认' })); });
  assert.deepEqual(sent, [{ token }]);
  assert.equal(view.getByRole('status').textContent, '已关闭「新的联系请求」邮件提醒。其他提醒不变，可在「我的 › 通知」重新开启。');
  cleanup();
  // An older email's link (no kind) turned off the whole channel, and the page says so.
  api.request = (async () => ({ ok: true, channel: 'sms', topic: null })) as typeof api.request;
  view = tokenPage('unsubscribe', `#token=${token}`);
  assert.equal(view.getByRole('main').querySelector('p')!.textContent, '确认后将关闭此链接对应的邮件或短信提醒。');
  await act(async () => { fireEvent.click(view.getByRole('button', { name: '确认' })); });
  assert.equal(view.getByRole('status').textContent, '已关闭全部短信提醒。可在「我的 › 通知」重新开启。');
  cleanup();
  await setLocale('en', false);
  api.request = (async () => ({ ok: true, channel: 'email', topic: 'message' })) as typeof api.request;
  view = tokenPage('unsubscribe', `#token=${token}&kind=message`);
  assert.match(view.getByRole('main').textContent!, /Confirm to turn off reminders for new private messages from this link\./);
  await act(async () => { fireEvent.click(view.getByRole('button', { name: 'Confirm' })); });
  assert.equal(view.getByRole('status').textContent, 'Email reminders for new private messages are off. Other reminders are unchanged; you can turn them back on in Me › Notifications.');
  cleanup();
  await setLocale('zh-Hant', false);
  api.request = (async () => ({ ok: true, channel: 'email', topic: 'message' })) as typeof api.request;
  view = tokenPage('unsubscribe', `#token=${token}&kind=message`);
  await act(async () => { fireEvent.click(view.getByRole('button', { name: '確認' })); });
  assert.equal(view.getByRole('status').textContent, '已關閉「新的私訊」郵件提醒。其他提醒不變，可在「我的 › 通知」重新開啟。');
});

test('an invalid kind in the link is ignored; an unknown or used token keeps the server message', async () => {
  api.request = (async () => { throw { status: 400, error: '链接无效、已使用或已过期。' }; }) as typeof api.request;
  const view = tokenPage('unsubscribe', `#token=${token}&kind=everything`);
  assert.equal(view.getByRole('main').querySelector('p')!.textContent, '确认后将关闭此链接对应的邮件或短信提醒。');
  await act(async () => { fireEvent.click(view.getByRole('button', { name: '确认' })); });
  await waitFor(() => assert.equal(view.getByRole('alert').textContent, '链接无效、已使用或已过期。'));
});
