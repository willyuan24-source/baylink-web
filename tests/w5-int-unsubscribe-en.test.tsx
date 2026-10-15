// W5-INT (WEB-COMMUNITY-2 × WEB-SEO-3): /en/notifications/unsubscribe with a used or unknown token. The API answers 400 in
// Chinese ('链接无效、已使用或已过期。', api lib/notifications.js, no code); through the real api.request, SEO-3's English
// table (src/i18n/api-errors-en.ts) gives the English page an English alert. Chinese pages keep the server's sentence.
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test, { afterEach } from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://www.baylink.us/en/notifications/unsubscribe', pretendToBeVisual: true });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
registerHooks({ load(url, context, next) { return url.endsWith('.css') ? { format: 'module', shortCircuit: true, source: 'export {}' } : next(url, context); } });
const { render, fireEvent, cleanup, act, waitFor } = await import('@testing-library/react');
const { MemoryRouter } = await import('react-router-dom');
const { setLocale } = await import('../src/i18n/locale');
const { default: NotificationTokenPage } = await import('../src/pages/NotificationTokenPage');
const originalFetch = globalThis.fetch;
const requests: string[] = [];
afterEach(async () => { cleanup(); globalThis.fetch = originalFetch; requests.length = 0; await setLocale('zh-Hans', false); });
const usedToken = () => {
  globalThis.fetch = (async (url: string | URL) => {
    requests.push(String(url));
    return new Response(JSON.stringify({ error: '链接无效、已使用或已过期。' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
};
const page = () => render(<MemoryRouter initialEntries={[{ pathname: '/notifications/unsubscribe', hash: `#token=${'A'.repeat(43)}&kind=message` }]}><NotificationTokenPage purpose="unsubscribe" /></MemoryRouter>);

test('English page, used token: the alert is the English sentence, not the server Chinese', async () => {
  await setLocale('en', false);
  usedToken();
  const view = page();
  await act(async () => { fireEvent.click(view.getByRole('button', { name: 'Confirm' })); });
  await waitFor(() => assert.equal(view.getByRole('alert').textContent, 'This link is invalid, already used or expired.'));
  assert.equal(requests.length, 1);
  assert.match(requests[0], /\/notifications\/unsubscribe$/);
});

test('Chinese page, used token: the server sentence as sent', async () => {
  usedToken();
  const view = page();
  await act(async () => { fireEvent.click(view.getByRole('button', { name: '确认' })); });
  await waitFor(() => assert.equal(view.getByRole('alert').textContent, '链接无效、已使用或已过期。'));
});
