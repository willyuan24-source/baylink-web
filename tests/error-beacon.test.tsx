import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import React from 'react';
import { JSDOM } from 'jsdom';
import { apiAcceptsClientError } from './api-func-contract';

const dom = new JSDOM('<!doctype html><body><div id="root"></div></body>', { url: 'https://www.baylink.us/guides/bay-area-medicare-hicap-medi-cal-guide?q=private' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, HTMLElement: dom.window.HTMLElement, Element: dom.window.Element, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { render, cleanup, act } = await import('@testing-library/react');
const { reportClientError, errorFingerprint, fingerprintText, classifyClientError, resetClientErrorBeacons } = await import('../src/lib/client-errors');
const { default: ErrorBoundary } = await import('../src/components/ErrorBoundary');
const { setLocale } = await import('../src/i18n/locale');

const beacons = (fetch: { mock: { calls: { arguments: unknown[] }[] } }) => fetch.mock.calls
  .filter(call => String(call.arguments[0]).endsWith('/client-errors'))
  .map(call => ({ body: JSON.parse(String((call.arguments[1] as RequestInit).body)), options: call.arguments[1] as RequestInit }));
afterEach(async () => {
  cleanup(); resetClientErrorBeacons(); await setLocale('zh-Hans', false);
  Object.defineProperty(navigator, 'doNotTrack', { configurable: true, value: undefined });
});

test('the fingerprint drops URLs, file names and digits and never carries the message', () => {
  const a = errorFingerprint('TypeError', 'Cannot read properties of undefined (reading \'title\') at https://www.baylink.us/assets/GuideDetail-AbC123.js:12:5');
  const b = errorFingerprint('TypeError', 'Cannot read properties of undefined (reading \'title\') at https://www.baylink.us/assets/GuideDetail-Zz9.js:98:1');
  assert.equal(a, b, 'a new build hash or line number is the same error');
  assert.match(a, /^[0-9a-f]{8}$/);
  assert.notEqual(errorFingerprint('TypeError', 'x is not a function'), errorFingerprint('TypeError', 'y is not a function'));
  assert.equal(fingerprintText('Error', 'user 12345 at https://x.test/a?email=me@x.test failed'), 'Error:user at failed');
  assert.equal(fingerprintText('Error', 'a'.repeat(200)).length, 'Error:'.length + 60);
});

test('a beacon carries exactly kind, route template, release and fingerprint, privately and once per fingerprint', context => {
  const fetch = context.mock.method(globalThis, 'fetch', async () => new Response('{}'));
  const error = new TypeError('Cannot read properties of null (reading \'phone\') for 650-555-0100');
  reportClientError('error', error);
  reportClientError('error', error);
  const sent = beacons(fetch);
  assert.equal(sent.length, 1, 'the same failure is reported once per page load');
  const [{ body, options }] = sent;
  assert.deepEqual(Object.keys(body).sort(), ['fp', 'kind', 'release', 'route']);
  assert.deepEqual({ kind: body.kind, route: body.route, release: body.release }, { kind: 'error', route: '/guides/:slug', release: 'dev' });
  assert.ok(apiAcceptsClientError(body), 'the live API accepts it');
  assert.doesNotMatch(JSON.stringify(body), /phone|650|medicare|private|null/);
  assert.equal(options.credentials, 'omit');
  assert.equal(options.referrerPolicy, 'no-referrer');
  assert.equal(options.keepalive, true);
});

test('chunk failures are classified, noise is dropped and a page sends at most 8 beacons', context => {
  const fetch = context.mock.method(globalThis, 'fetch', async () => new Response('{}'));
  assert.equal(classifyClientError('error', new TypeError('Failed to fetch dynamically imported module: https://www.baylink.us/assets/x.js')), 'chunk');
  assert.equal(classifyClientError('rejection', Object.assign(new Error('aborted'), { name: 'AbortError' })), null);
  assert.equal(classifyClientError('error', 'Script error.'), null);
  assert.equal(classifyClientError('error', 'ResizeObserver loop completed with undelivered notifications.'), null);
  reportClientError('error', 'Script error.');
  for (let index = 0; index < 20; index++) reportClientError('rejection', new Error(`failure kind ${String.fromCharCode(97 + index)}`));
  assert.equal(beacons(fetch).length, 8);
});

test('Do Not Track sends nothing', context => {
  const fetch = context.mock.method(globalThis, 'fetch', async () => new Response('{}'));
  Object.defineProperty(navigator, 'doNotTrack', { configurable: true, value: '1' });
  reportClientError('error', new Error('anything'));
  assert.equal(beacons(fetch).length, 0);
});

function Broken(): React.ReactElement { throw new Error('render failed for event fleet-week-2026'); }

test('the error page reports a render beacon and speaks the reader\'s language at 16px with a feedback action', async context => {
  const fetch = context.mock.method(globalThis, 'fetch', async () => new Response('{}'));
  context.mock.method(console, 'error', () => {});
  const view = render(<ErrorBoundary><Broken /></ErrorBoundary>);
  assert.equal(view.getByRole('heading', { level: 1 }).textContent, '页面出了点小问题');
  const [{ body }] = beacons(fetch);
  assert.equal(body.kind, 'render');
  assert.doesNotMatch(JSON.stringify(body), /fleet/);
  const reload = view.getByRole('button', { name: '刷新页面' });
  const tell = view.getByRole('button', { name: '告诉我们' });
  for (const button of [reload, tell]) assert.equal(button.style.fontSize, '1rem');
  assert.equal(button(view, '告诉我们').style.minHeight, '3rem');
  assert.doesNotMatch(view.container.innerHTML, /#[0-9a-f]{3,8}\b/i, 'colours come from tokens');
  await act(async () => { await setLocale('en', false); });
  view.rerender(<ErrorBoundary><Broken /></ErrorBoundary>);
  assert.equal(view.getByRole('heading', { level: 1 }).textContent, 'Something went wrong on this page');
  assert.ok(view.getByRole('button', { name: 'Tell us' }));
  assert.doesNotMatch(view.container.textContent!, /[㐀-鿿]/);
  await act(async () => { await setLocale('zh-Hant', false); });
  view.rerender(<ErrorBoundary><Broken /></ErrorBoundary>);
  assert.equal(view.getByRole('heading', { level: 1 }).textContent, '頁面出了點小問題');
});

const button = (view: ReturnType<typeof render>, name: string) => view.getByRole('button', { name }) as HTMLButtonElement;
