import { mockBayBayFetch } from './baybay-test-transport';
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import React from 'react';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost/' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage,
  HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
dom.window.HTMLElement.prototype.getClientRects = function () { return (this.isConnected && !this.hidden ? [{ width: 1, height: 1 }] : []) as unknown as DOMRectList; };
const { render, fireEvent, cleanup, act } = await import('@testing-library/react');
const { BayBayAssistantEntry } = await import('../src/components/BayBayAssistantEntry');
const { fetchBayBayReply } = await import('../src/lib/baybay-conversation');
const { setLocale } = await import('../src/i18n/locale');
afterEach(async () => { cleanup(); await setLocale('zh-Hans', false); });
const noop = () => {};
const props = { variant: 'headless' as const, panelOpen: true, onPanelOpenChange: noop, onNavigate: noop, onCreatePostClick: noop };
const frame = (event: string, data: unknown) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

test('requests advertise the draft-capable stream dialect and keep the assistant route version', async t => {
  let body: Record<string, unknown> = {};
  mockBayBayFetch(t, async (_url: unknown, init: RequestInit) => { body = JSON.parse(String(init.body)); return Response.json({ ok: true, answer: '好的。' }); });
  await fetchBayBayReply('这周末去哪', { currentPath: '/' }, [], new AbortController().signal);
  // The API routes to the assistant only when assistantVersion === 2, so the capability is a separate field (RC-21).
  assert.equal(body.assistantVersion, 2);
  assert.equal(body.stream, true);
  assert.equal(body.streamVersion, 3);
});

test('a streamed lead previews in the pending bubble outside live regions; validated text and the result replace it', async t => {
  let channel!: ReadableStreamDefaultController<Uint8Array>;
  const encoder = new TextEncoder();
  const send = (text: string) => act(async () => { channel.enqueue(encoder.encode(text)); });
  mockBayBayFetch(t, async () => new Response(new ReadableStream<Uint8Array>({ start(controller) { channel = controller; } }), { headers: { 'Content-Type': 'text/event-stream' } }));
  const view = render(<BayBayAssistantEntry {...props} />);
  const input = view.getByRole('textbox', { name: '向 BayBay 提问' });
  fireEvent.change(input, { target: { value: '这周末带孩子去哪里？' } });
  await act(async () => { fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' }); });
  await send(frame('draft', { seq: 1, field: 'lead', text: '这个周末' }) + frame('draft', { seq: 2, field: 'point', index: 0, text: '要点草稿' }));
  await send(frame('draft', { seq: 3, field: 'lead', text: '去金门公园。' }));
  const preview = view.getByText('这个周末去金门公园。');
  assert.equal(preview.closest('[aria-live]'), null, 'draft text never enters a live region');
  assert.equal(preview.closest('[role="status"]'), null);
  assert.equal(view.queryByText(/要点草稿/), null, 'only the lead is previewed');
  assert.equal(view.getAllByRole('status').filter(status => /正在等待答复/.test(status.textContent || '')).length, 1, 'the pending status still says the answer is not ready');
  await send(frame('delta', { validated: true, text: '已核实的答复。' }));
  assert.equal(view.getByText('已核实的答复。') === preview, true, 'validated text replaces the draft in the same bubble');
  assert.equal(view.queryByText('这个周末去金门公园。'), null);
  await send(frame('result', { ok: true, answer: '完整回答：金门公园。' }));
  assert.ok(view.getByText(/完整回答：金门公园。/));
  assert.equal(view.queryByText('已核实的答复。'), null, 'the result replaces the streamed text');
});
