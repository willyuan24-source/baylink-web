import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { JSDOM } from 'jsdom';
import { recordProductEvent } from '../src/lib/product-events';

const dom = new JSDOM('', { url: 'https://www.baylink.us/plan?q=private-question' });
Object.assign(globalThis, { window: dom.window });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
afterEach(() => {
  Object.defineProperty(navigator, 'doNotTrack', { configurable: true, value: undefined });
  Object.defineProperty(navigator, 'globalPrivacyControl', { configurable: true, value: undefined });
});

test('aggregate requests contain no identity, content or referrer, even with an account in browser storage', context => {
  dom.window.localStorage.setItem('currentUser', JSON.stringify({ id: 'private-user', token: 'private-token' }));
  const fetch = context.mock.method(globalThis, 'fetch', async () => new Response('{}'));
  recordProductEvent('plan_saved');
  assert.equal(fetch.mock.calls.length, 1);
  const [url, options] = fetch.mock.calls[0].arguments;
  assert.ok(String(url).endsWith('/api/product-events'));
  assert.deepEqual(JSON.parse(options!.body as string), { event: 'plan_saved', locale: 'zh-Hans' });
  assert.deepEqual(options!.headers, { 'Content-Type': 'application/json' });
  assert.equal(options!.credentials, 'omit');
  assert.equal(options!.referrerPolicy, 'no-referrer');
});

test('Do Not Track and Global Privacy Control suppress all counter requests', context => {
  const fetch = context.mock.method(globalThis, 'fetch', async () => new Response('{}'));
  Object.defineProperty(navigator, 'doNotTrack', { configurable: true, value: '1' });
  recordProductEvent('planner_recommendation');
  Object.defineProperty(navigator, 'doNotTrack', { configurable: true, value: undefined });
  Object.defineProperty(navigator, 'globalPrivacyControl', { configurable: true, value: true });
  recordProductEvent('official_source_click');
  assert.equal(fetch.mock.calls.length, 0);
});

test('counter network failure never rejects the user action', async context => {
  context.mock.method(globalThis, 'fetch', async () => { throw new Error('offline'); });
  assert.equal(recordProductEvent('plan_shared'), undefined);
  await new Promise(resolve => setImmediate(resolve));
});
