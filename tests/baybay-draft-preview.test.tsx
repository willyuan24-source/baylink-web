import { mockBayBayFetch } from './baybay-test-transport';
import test, { afterEach, type TestContext } from 'node:test';
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
const { setLocale, translateText } = await import('../src/i18n/locale');
afterEach(async () => { cleanup(); await setLocale('zh-Hans', false); });
const noop = () => {};
const props = { variant: 'headless' as const, panelOpen: true, onPanelOpenChange: noop, onNavigate: noop, onCreatePostClick: noop };
const frame = (event: string, data: unknown) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

/** Asks one question against a server stream the test writes to frame by frame. */
async function askWithStream(t: TestContext, textbox: string, question: string) {
  let channel!: ReadableStreamDefaultController<Uint8Array>;
  const encoder = new TextEncoder();
  const send = (text: string) => act(async () => { channel.enqueue(encoder.encode(text)); });
  mockBayBayFetch(t, async () => new Response(new ReadableStream<Uint8Array>({ start(controller) { channel = controller; } }), { headers: { 'Content-Type': 'text/event-stream' } }));
  const view = render(<BayBayAssistantEntry {...props} />);
  const input = view.getByRole('textbox', { name: textbox });
  fireEvent.change(input, { target: { value: question } });
  await act(async () => { fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' }); });
  return { view, send };
}

test('requests advertise the draft-capable stream dialect and keep the assistant route version', async t => {
  let body: Record<string, unknown> = {};
  mockBayBayFetch(t, async (_url: unknown, init: RequestInit) => { body = JSON.parse(String(init.body)); return Response.json({ ok: true, answer: '好的。' }); });
  await fetchBayBayReply('这周末去哪', { currentPath: '/' }, [], new AbortController().signal);
  // The API routes to the assistant only when assistantVersion === 2, so the capability is a separate field (RC-21).
  assert.equal(body.assistantVersion, 2);
  assert.equal(body.stream, true);
  assert.equal(body.streamVersion, 3);
});

test('a streamed lead and its points preview progressively outside live regions; validated text and the result replace them', async t => {
  const { view, send } = await askWithStream(t, '向 BayBay 提问', '这周末带孩子去哪里？');
  await send(frame('draft', { seq: 1, field: 'lead', text: '这个周末' }));
  assert.ok(view.getByText('这个周末'), 'the lead shows as soon as its first words arrive');
  assert.equal(view.baseElement.querySelectorAll('[data-draft] li').length, 0);
  await send(frame('draft', { seq: 2, field: 'point', index: 0, text: '要点草稿' }));
  await send(frame('draft', { seq: 3, field: 'lead', text: '去金门公园。' }));
  const preview = view.getByText('这个周末去金门公园。');
  assert.equal(preview.closest('[aria-live]'), null, 'draft text never enters a live region');
  assert.equal(preview.closest('[role="status"]'), null);
  const point = view.getByText('要点草稿');
  assert.equal(point.closest('[data-draft]') === preview.closest('[data-draft]'), true, 'each point appears under the lead as it streams');
  assert.equal(point.closest('[aria-live]'), null);
  assert.equal(view.getAllByRole('status').filter(status => /正在等待答复/.test(status.textContent || '')).length, 1, 'the pending status still says the answer is not ready');
  await send(frame('delta', { validated: true, text: '已核实的答复。' }));
  assert.equal(view.getByText('已核实的答复。') === preview, true, 'validated text replaces the draft in the same bubble');
  assert.equal(view.queryByText('这个周末去金门公园。'), null);
  assert.equal(view.queryByText('要点草稿') === null, true, 'validated text replaces the point drafts too');
  await send(frame('result', { ok: true, answer: '完整回答：金门公园。' }));
  assert.ok(view.getByText(/完整回答：金门公园。/));
  assert.equal(view.queryByText('已核实的答复。'), null, 'the result replaces the streamed text');
});

test('on /en the preview is the English lead without source markers or links, and the pending turn has no Chinese', async t => {
  await setLocale('en', false);
  const { view, send } = await askWithStream(t, translateText('向 BayBay 提问', 'en'), 'Where can we go with kids this weekend?');
  await send(frame('draft', { seq: 1, field: 'lead', text: 'This weekend, Golden Gate Park [[ev' }));
  assert.ok(view.getByText('This weekend, Golden Gate Park'), 'a marker that is still streaming is not shown');
  await send(frame('draft', { seq: 2, field: 'lead', text: 'ent-fleet-week]] suits a family outing (https://example.org).' }));
  const preview = view.getByText('This weekend, Golden Gate Park suits a family outing.');
  assert.equal(preview.closest('[aria-live]'), null);
  assert.doesNotMatch(preview.closest('[data-turn-id]')?.textContent || '', /\p{Script=Han}/u);
});

test('on zh-Hant a Simplified draft previews in Traditional Chinese, like the final answer', async t => {
  await setLocale('zh-Hant', false);
  const { view, send } = await askWithStream(t, translateText('向 BayBay 提问', 'zh-Hant'), '這個週末帶孩子去哪裡？');
  await send(frame('draft', { seq: 1, field: 'lead', text: '这个周末去金门公园 [[page]]' }) + frame('draft', { seq: 2, field: 'lead', text: '，下午人少一些。' }));
  const expected = translateText('这个周末去金门公园，下午人少一些。', 'zh-Hant');
  assert.notEqual(expected, '这个周末去金门公园，下午人少一些。');
  assert.ok(view.getByText(expected));
});

test('the pending bubble keeps the final order (lead, cards, points) and streams legacy text in the plain answer style', async t => {
  const { view, send } = await askWithStream(t, '向 BayBay 提问', '这周末带孩子去哪里？');
  const card = { kind: 'event', id: 'santa-clara-library-comic-con-2026', title: 'Santa Clara 图书馆免费 Comic Con', url: '/events/santa-clara-library-comic-con-2026', summary: '' };
  // Verified cards usually arrive before the drafted text.
  await send(frame('quick_card', { verified: true, cards: [card] }));
  await send(frame('draft', { seq: 1, field: 'lead', text: '周六去 Santa Clara 图书馆。' }) + frame('draft', { seq: 2, field: 'point', index: 0, text: '10:00 开门，免费。' }));
  const bubble = view.baseElement.querySelector('[data-draft]')!;
  const order = [...bubble.children].map(child => child.classList.contains('bb-lead') ? 'lead' : child.classList.contains('bb-cards') ? 'cards' : child.classList.contains('bb-points') ? 'points' : child.className);
  assert.deepEqual(order, ['lead', 'cards', 'points'], 'the lead does not jump above the cards when the result arrives');
  // A legacy (v1) answer streams validated text: it reads like the final legacy answer, not as a bold lead.
  await send(frame('delta', { validated: true, text: '已核实的答复。' }));
  const legacy = view.getByText('已核实的答复。');
  assert.ok(legacy.classList.contains('member-baybay-answer-text'));
  assert.equal(legacy.classList.contains('bb-lead'), false);
  assert.ok(legacy.compareDocumentPosition(bubble.querySelector('.bb-cards')!) & Node.DOCUMENT_POSITION_FOLLOWING, 'legacy text first, then its cards, as in the final v1 answer');
  await send(frame('result', { ok: true, answer: '完整回答。' }));
});
