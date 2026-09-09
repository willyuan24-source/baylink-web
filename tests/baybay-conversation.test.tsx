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
const { QuickExplore } = await import('../src/components/QuickExplore');
const { fetchBayBayReply, conversationHistory, safeBayBayPath, bayBayErrorMessage } = await import('../src/lib/baybay-conversation');
const { guides } = await import('../src/data/guides');
afterEach(cleanup);
const noop = () => {};
const answer = (text: string) => Response.json({ ok: true, answer: text });

test('completed conversations send bounded history and retain earlier answers', async t => {
  const bodies: { message: string; history: unknown[] }[] = [];
  t.mock.method(globalThis, 'fetch', async (_url: unknown, options: RequestInit) => {
    const body = JSON.parse(String(options.body)); bodies.push(body);
    return answer(`这是第 ${bodies.length} 条根据上下文整理的回答。`);
  });
  const view = render(<BayBayAssistantEntry variant="headless" panelOpen onPanelOpenChange={noop} onNavigate={noop} onCreatePostClick={noop} />);
  const input = view.getByRole('textbox', { name: '向 BayBay 提问' });
  for (const message of ['带六岁孩子，周末去哪里', '如果不开车呢']) {
    fireEvent.change(input, { target: { value: message } });
    fireEvent.click(view.getByRole('button', { name: '问一下' }));
    await view.findByText(`这是第 ${bodies.length} 条根据上下文整理的回答。`);
  }
  assert.deepEqual(bodies[0].history, []);
  assert.deepEqual(bodies[1].history, [{ role: 'user', content: '带六岁孩子，周末去哪里' }, { role: 'assistant', content: '这是第 1 条根据上下文整理的回答。' }]);
  assert.ok(view.getByText('这是第 1 条根据上下文整理的回答。'));
  assert.ok(view.getByText('这是第 2 条根据上下文整理的回答。'));
  fireEvent.click(view.getByRole('button', { name: '新对话' }));
  assert.equal(view.queryByText('这是第 1 条根据上下文整理的回答。'), null);
});

test('a preset arriving while busy waits, is consumed once when started, and can repeat under a new ID', async t => {
  const resolvers: ((response: Response) => void)[] = [];
  const bodies: { message: string }[] = [];
  const consumed: (number | undefined)[] = [];
  t.mock.method(globalThis, 'fetch', (_url: unknown, options: RequestInit) => {
    bodies.push(JSON.parse(String(options.body)));
    return new Promise<Response>(resolve => resolvers.push(resolve));
  });
  const props = { variant: 'headless' as const, panelOpen: true, onPanelOpenChange: noop, onNavigate: noop, onCreatePostClick: noop, onPendingQuestionConsumed: (id?: number) => consumed.push(id) };
  const view = render(<BayBayAssistantEntry {...props} pendingQuestion="第一个预置问题" pendingQuestionId={1} />);
  assert.deepEqual(consumed, [1]);
  view.rerender(<BayBayAssistantEntry {...props} pendingQuestion="新的预置问题" pendingQuestionId={2} />);
  assert.deepEqual(consumed, [1]);
  assert.equal(bodies.length, 1);
  await act(async () => resolvers[0](answer('第一个预置问题的完整答案。')));
  assert.equal(bodies.length, 2);
  assert.deepEqual(consumed, [1, 2]);
  await act(async () => resolvers[1](answer('新的预置问题的完整答案。')));
  assert.equal(bodies.length, 2, 'an unchanged preset must not send again on a completed render');
  view.rerender(<BayBayAssistantEntry {...props} pendingQuestion="新的预置问题" pendingQuestionId={3} />);
  assert.equal(bodies.length, 3);
  assert.deepEqual(consumed, [1, 2, 3]);
  await act(async () => resolvers[2](answer('再次提问的完整答案。')));
});

test('closing aborts, and late cancelled responses cannot overwrite a reopened conversation', async t => {
  const requests: { signal: AbortSignal; resolve: (response: Response) => void; body: { history: unknown[] } }[] = [];
  t.mock.method(globalThis, 'fetch', (_url: unknown, options: RequestInit) => new Promise<Response>(resolve => requests.push({ signal: options.signal as AbortSignal, resolve, body: JSON.parse(String(options.body)) })));
  const props = { variant: 'headless' as const, onPanelOpenChange: noop, onNavigate: noop, onCreatePostClick: noop };
  const view = render(<BayBayAssistantEntry {...props} panelOpen pendingQuestion="一个很慢的问题" pendingQuestionId={1} />);
  view.rerender(<BayBayAssistantEntry {...props} panelOpen={false} />);
  assert.equal(requests[0].signal.aborted, true);
  view.rerender(<BayBayAssistantEntry {...props} panelOpen pendingQuestion="重新打开的新问题" pendingQuestionId={2} />);
  assert.deepEqual(requests[1].body.history, [], 'cancelled messages never enter model history');
  await act(async () => requests[1].resolve(answer('这是重新打开后的新答案。')));
  await act(async () => requests[0].resolve(answer('这个旧答案不应出现。')));
  assert.ok(view.getByText('这是重新打开后的新答案。'));
  assert.equal(view.queryByText('这个旧答案不应出现。'), null);
});

test('stalled fetch and stalled response bodies have a bounded timeout', async t => {
  let signal: AbortSignal | undefined;
  t.mock.method(globalThis, 'fetch', async (_url: unknown, options: RequestInit) => {
    signal = options.signal as AbortSignal;
    return { ok: true, json: () => new Promise(() => {}) } as Response;
  });
  await assert.rejects(fetchBayBayReply('超时测试问题', { currentPath: '/' }, [], new AbortController().signal, 15), /等待时间较长/);
  assert.equal(signal?.aborted, true);
});

test('history only includes four complete pairs; AI navigation is restricted to published internal guides', () => {
  const turns = Array.from({ length: 7 }, (_, id) => ({ id, question: `问题 ${id}`, state: 'complete' as const, response: { ok: true, answer: `答案 ${id}` } }));
  const history = conversationHistory([...turns, { id: 8, question: '未完成', state: 'pending' }]);
  assert.equal(history.length, 8);
  assert.equal(history[0].content, '问题 3');
  assert.equal(safeBayBayPath(`/guides/${guides[0].slug}`), true);
  for (const path of ['https://evil.test', '//evil.test', '/guides/made-up-article', '/category/rent\\evil']) assert.equal(safeBayBayPath(path), false);
});

test('network and parsing errors show usable Chinese messages while explicit service guidance is preserved', () => {
  for (const error of [new TypeError('Failed to fetch'), new SyntaxError('Unexpected token < in JSON'), null]) {
    assert.equal(bayBayErrorMessage(error), '暂时连接不上 BayBay，请检查网络后重试。问题已保留。');
  }
  assert.equal(bayBayErrorMessage(new Error('提问过于频繁，请 60 秒后再试')), '提问过于频繁，请 60 秒后再试');
});

test('quick search finds exact guide titles and keyboard Enter opens the published route, preserving IME', () => {
  const opened: string[] = [];
  const searches: string[] = [];
  const view = render(<QuickExplore onClose={noop} onNavigate={path => opened.push(path)} onSearch={query => searches.push(query)} onAsk={noop} />);
  const input = view.getByRole('combobox', { name: '快速搜索' });
  const guide = guides.find(item => item.title.includes('免费')) || guides[0];
  fireEvent.change(input, { target: { value: guide.title } });
  assert.ok(view.getByRole('option', { selected: true }).textContent?.startsWith(guide.title));
  assert.equal(fireEvent.keyDown(input, { key: 'Enter', isComposing: true }), false);
  assert.equal(fireEvent.keyDown(input, { key: 'Enter', keyCode: 229 }), false);
  assert.deepEqual(opened, []);
  fireEvent.submit(input.closest('form')!);
  assert.deepEqual(opened, [`/guides/${guide.slug}`]);
  assert.deepEqual(searches, []);
});

test('quick search searches summary text, supports arrows, and passes a query to BayBay', () => {
  const asked: (string | undefined)[] = [];
  const view = render(<QuickExplore onClose={noop} onNavigate={noop} onSearch={noop} onAsk={query => asked.push(query)} />);
  const input = view.getByRole('combobox', { name: '快速搜索' });
  fireEvent.change(input, { target: { value: guides[0].summary.slice(0, 12) } });
  assert.ok(view.getByRole('option', { selected: true }).textContent?.startsWith(guides[0].title));
  fireEvent.change(input, { target: { value: '不存在的问句xyz' } });
  assert.equal(view.getAllByRole('option').length, 2);
  fireEvent.keyDown(input, { key: 'ArrowDown' });
  assert.equal(input.getAttribute('aria-activedescendant'), 'quick-result-1');
  fireEvent.submit(input.closest('form')!);
  assert.deepEqual(asked, ['不存在的问句xyz']);
});
