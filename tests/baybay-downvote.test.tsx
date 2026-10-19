import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { registerHooks } from 'node:module';
import React from 'react';
import { JSDOM } from 'jsdom';
import { apiNormalizeFeedback } from './api-func-contract';
import type { submitFeedback } from '../src/features/feedback/feedback-api';

// BayBay 👎 reasons (UI9-BB). UI9-PREP moved this case here from tests/feedback-sheet.test.tsx (UI9-NAV) with its assertions
// unchanged; the page, reading size and 其他 sheet are the same as there.
const dom = new JSDOM('<!doctype html><html data-reading="large"><body><div id="root"></div></body></html>', { url: 'https://www.baylink.us/events/san-francisco-fleet-week-2026?date=2026-10-11&email=me@example.test', pretendToBeVisual: true });
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, HTMLElement: dom.window.HTMLElement,
  HTMLInputElement: dom.window.HTMLInputElement, Element: dom.window.Element, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true,
  requestAnimationFrame: (callback: FrameRequestCallback) => setTimeout(() => callback(0), 0),
});
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
// The sheet's stylesheet: an empty module here (kept for the whole file: the sheet loads lazily, mid-test).
registerHooks({ load(url, context, nextLoad) { return url.endsWith('.css') ? { format: 'module', shortCircuit: true, source: 'export {};' } : nextLoad(url, context); } });
const { render, fireEvent, cleanup, act, within, waitFor } = await import('@testing-library/react');
const { BayBayDownvoteReasons } = await import('../src/features/feedback/BayBayDownvoteReasons');
const { setLocale } = await import('../src/i18n/locale');
type Payload = Parameters<typeof submitFeedback>[0];

afterEach(async () => { cleanup(); document.getElementById('baylink-feedback-root')?.remove(); await setLocale('zh-Hans', false); });
const fetchBodies = (fetch: { mock: { calls: { arguments: unknown[] }[] } }, suffix: string) => fetch.mock.calls
  .filter(call => String(call.arguments[0]).endsWith(suffix)).map(call => JSON.parse(String((call.arguments[1] as RequestInit).body)));

test('BayBay 👎: one tap sends the reason with the page template only; 其他 opens the sheet', async context => {
  const fetch = context.mock.method(globalThis, 'fetch', async () => new Response('{}'));
  const sent: Payload[] = [];
  const view = render(<BayBayDownvoteReasons send={async payload => { sent.push(payload); return { ok: true }; }} />);
  assert.deepEqual(within(view.getByRole('group', { name: '哪里没答好？' })).getAllByRole('button').map(button => button.textContent), ['答错了', '太慢', '没答到点上', '其他']);
  await act(async () => { fireEvent.click(view.getByRole('button', { name: '答错了' })); });
  assert.deepEqual(sent[0], { kind: 'baybay', routeTemplate: '/events/:id', reason: 'wrong-answer', text: '', locale: 'zh-Hans', readingSize: 'large', release: 'dev', website: '' });
  assert.ok(apiNormalizeFeedback(sent[0]));
  assert.equal(view.getByRole('status').textContent, '已记下原因，谢谢！');
  assert.deepEqual(fetchBodies(fetch, '/product-events').map(event => event.event), ['feedback_sent']);
  cleanup();
  const again = render(<BayBayDownvoteReasons send={async () => ({ ok: true })} />);
  await act(async () => { fireEvent.click(again.getByRole('button', { name: '其他' })); await new Promise(resolve => setTimeout(resolve, 50)); });
  const dialog = await waitFor(() => within(document.body).getByRole('dialog', { name: 'BayBay 哪里没答好？' }));
  assert.equal((within(dialog).getByRole('radio', { name: '其他' }) as HTMLInputElement).checked, true);
});
