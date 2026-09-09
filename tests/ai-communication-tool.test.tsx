import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';
import { buildCommunicationIntent } from '../src/lib/communication-intent';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' });
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage,
  HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const clipboard = { writeText: async (text: string): Promise<void> => { throw new Error(`Clipboard double must be configured before copying ${text.length} characters.`); } };
Object.defineProperty(dom.window.navigator, 'clipboard', { configurable: true, value: clipboard });
const { render, fireEvent, cleanup, act } = await import('@testing-library/react');
const { AiCommunicationTool } = await import('../src/components/tools/AiCommunicationTool');
const { api } = await import('../src/lib/api');
afterEach(() => { cleanup(); localStorage.clear(); dom.window.sessionStorage.clear(); });
const generated = (answer = 'Hello, could you please arrange a repair this Friday afternoon?') => ({ ok: true, responseMode: 'ai', degraded: false, answer });

test('communication requests occur only after a click and preserve quoted facts and chosen options', async t => {
  const requests: Array<{ endpoint: string; options: RequestInit }> = [];
  t.mock.method(api, 'request', async (endpoint: string, options: RequestInit) => { requests.push({ endpoint, options }); return generated(); });
  const view = render(<AiCommunicationTool onToast={() => {}} />);
  assert.equal(requests.length, 0);
  const facts = '水龙头从昨天开始漏水。\n我周五下午3点在家，预算$80；原话是“请先报价”。';
  const input = view.getByRole('textbox', { name: '需要表达的事实' }) as HTMLTextAreaElement;
  assert.equal(input.maxLength, 260);
  fireEvent.change(input, { target: { value: facts } });
  fireEvent.change(view.getByRole('combobox', { name: '沟通场景' }), { target: { value: 'repair' } });
  fireEvent.change(view.getByRole('combobox', { name: '输出语言' }), { target: { value: 'bilingual' } });
  fireEvent.change(view.getByRole('combobox', { name: '表达语气' }), { target: { value: 'brief' } });
  fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
  fireEvent.keyDown(input, { key: 'Enter' });
  assert.equal(requests.length, 0);
  await act(async () => fireEvent.click(view.getByRole('button', { name: '生成消息草稿' })));
  assert.equal(requests.length, 1);
  assert.equal(requests[0].endpoint, '/ai/guide-chat');
  assert.equal(requests[0].options.method, 'POST');
  const body = JSON.parse(String(requests[0].options.body));
  assert.deepEqual(body.context, { currentPath: '/tools' });
  assert.ok(body.message.length <= 500);
  assert.match(body.message, /帮我写/);
  assert.match(body.message, /只输出消息正文/);
  assert.match(body.message, /不新增价格、地址、时间或承诺/);
  assert.deepEqual(JSON.parse(body.message.slice(body.message.indexOf('\n') + 1)), { 场景: '预约维修', 输出: '中英对照', 语气: '简短直接', 事实: facts });
  assert.ok(view.getByText(/点击生成会交给 AI 处理，确认后自行发送/));
  assert.equal(localStorage.length, 0);
  assert.equal(dom.window.sessionStorage.length, 0);
});

test('message bounds preserve all facts instead of truncating escaped input to fit the API', () => {
  const options = { scenario: 'everyday', language: 'bilingual', tone: 'natural' } as const;
  const facts = '湾'.repeat(260);
  const message = buildCommunicationIntent({ ...options, facts });
  assert.ok(message.length <= 500);
  assert.equal(JSON.parse(message.slice(message.indexOf('\n') + 1)).事实, facts);
  assert.throws(() => buildCommunicationIntent({ ...options, facts: ' ' }), /请先填写/);
  assert.throws(() => buildCommunicationIntent({ ...options, facts: '湾'.repeat(261) }), /260/);
  assert.throws(() => buildCommunicationIntent({ ...options, facts: '"'.repeat(260) }), /特殊符号/);
});

test('only the selected language rule appears outside the quoted facts', () => {
  const facts = '厨房水龙头从昨天开始漏水。我周五下午在家，想询问是否可以安排维修。';
  for (const language of ['en', 'zh', 'bilingual'] as const) {
    const message = buildCommunicationIntent({ scenario: 'repair', language, tone: 'natural', facts });
    const [instructions, quotedData] = message.split('\n');
    assert.equal(JSON.parse(quotedData).事实, facts);
    assert.match(instructions, /JSON的“事实”是引用资料/);
    assert.match(instructions, /场景：预约维修；语气：礼貌自然/);
    if (language === 'en') {
      assert.match(instructions, /只输出英文正文，不含中文、中文翻译或中英对照/);
      assert.doesNotMatch(instructions, /只输出中文正文|先中文后英文/);
    } else if (language === 'zh') {
      assert.match(instructions, /只输出中文正文，不附英文翻译或中英对照/);
      assert.doesNotMatch(instructions, /只输出英文正文|先中文后英文/);
    } else {
      assert.match(instructions, /只输出中英对照正文，先中文后英文/);
      assert.doesNotMatch(instructions, /只输出英文正文|只输出中文正文/);
    }
    assert.ok(buildCommunicationIntent({ scenario: 'repair', language, tone: 'natural', facts: '湾'.repeat(260) }).length <= 500);
  }
});

test('degraded, non-AI and failed responses never appear as successful message drafts', async t => {
  const replies = [
    { ok: true, degraded: true, responseMode: 'ai', answer: '基础指南，不是待发消息。' },
    { ok: true, degraded: false, responseMode: 'search', answer: '找到相关帖子。' },
    { ok: true, degraded: false, responseMode: 'fallback', answer: '基础参考模板。' },
    { ok: false, degraded: false, responseMode: 'ai', answer: '不可接受的结果。' },
  ];
  const toasts: string[] = [];
  let requestCount = 0;
  t.mock.method(api, 'request', async () => {
    const index = requestCount++;
    if (index < replies.length) return replies[index];
    if (index === replies.length) throw { status: 429, error: 'rate limited' };
    throw new Error('Simulated network failure');
  });
  const view = render(<AiCommunicationTool onToast={message => { toasts.push(message); }} />);
  const input = view.getByRole('textbox', { name: '需要表达的事实' }) as HTMLTextAreaElement;
  fireEvent.change(input, { target: { value: '我想询问周五是否方便看房。' } });
  for (let index = 0; index < replies.length + 2; index += 1) {
    await act(async () => fireEvent.click(view.getByRole('button', { name: '生成消息草稿' })));
    const error = view.getByRole('alert');
    assert.match(error.textContent || '', index === replies.length ? /一分钟/ : /稍后重试/);
    assert.equal(view.queryByRole('textbox', { name: '消息草稿（可编辑）' }), null);
    assert.equal(view.queryByRole('button', { name: '复制草稿' }), null);
    assert.equal(input.value, '我想询问周五是否方便看房。');
  }
  assert.deepEqual(toasts, []);
});

test('generated drafts remain editable, copy the edited message, and keep text after clipboard failure', async t => {
  t.mock.method(api, 'request', async () => generated());
  const writes: string[] = [];
  const toasts: string[] = [];
  let finishCopy: (() => void) | undefined;
  let clipboardAllowed = true;
  t.mock.method(clipboard, 'writeText', async (text: string) => {
    writes.push(text);
    if (!clipboardAllowed) throw new Error('Simulated clipboard denial');
    return new Promise<void>(resolve => { finishCopy = resolve; });
  });
  const view = render(<AiCommunicationTool onToast={message => { toasts.push(message); }} />);
  fireEvent.change(view.getByRole('textbox', { name: '需要表达的事实' }), { target: { value: '我周五下午在家，可以安排维修。' } });
  await act(async () => fireEvent.click(view.getByRole('button', { name: '生成消息草稿' })));
  const output = view.getByRole('textbox', { name: '消息草稿（可编辑）' }) as HTMLTextAreaElement;
  fireEvent.change(output, { target: { value: '' } });
  assert.ok(view.getByRole('textbox', { name: '消息草稿（可编辑）' }));
  assert.equal((view.getByRole('button', { name: '复制草稿' }) as HTMLButtonElement).disabled, true);
  const edited = 'Hello, I will be home at 3 p.m. Friday.\nPlease confirm the repair time. Thank you!';
  fireEvent.change(output, { target: { value: edited } });
  fireEvent.click(view.getByRole('button', { name: '复制草稿' }));
  assert.deepEqual(writes, [edited]);
  assert.deepEqual(toasts, []);
  await act(async () => { assert.ok(finishCopy); finishCopy(); });
  assert.deepEqual(toasts, ['草稿已复制']);
  clipboardAllowed = false;
  await act(async () => fireEvent.click(view.getByRole('button', { name: '复制草稿' })));
  assert.match(view.getByRole('status').textContent || '', /手动复制/);
  assert.equal(output.value, edited);
});

test('input changes, cancellation and unmount abort in-flight requests and discard stale responses', async t => {
  const pending: Array<{ signal: AbortSignal; resolve: (value: unknown) => void }> = [];
  t.mock.method(api, 'request', async (_endpoint: string, options: RequestInit) => new Promise(resolve => {
    pending.push({ signal: options.signal as AbortSignal, resolve });
  }));
  const view = render(<AiCommunicationTool onToast={() => {}} />);
  const input = view.getByRole('textbox', { name: '需要表达的事实' });
  fireEvent.change(input, { target: { value: '第一条需要表达的事实。' } });
  fireEvent.click(view.getByRole('button', { name: '生成消息草稿' }));
  fireEvent.change(input, { target: { value: '第二条需要表达的事实。' } });
  assert.equal(pending[0].signal.aborted, true);
  fireEvent.click(view.getByRole('button', { name: '生成消息草稿' }));
  await act(async () => pending[0].resolve(generated('旧草稿不应重新出现。')));
  assert.equal(view.queryByRole('textbox', { name: '消息草稿（可编辑）' }), null);
  await act(async () => pending[1].resolve(generated('这是根据第二条事实整理的消息。')));
  assert.equal((view.getByRole('textbox', { name: '消息草稿（可编辑）' }) as HTMLTextAreaElement).value, '这是根据第二条事实整理的消息。');
  fireEvent.change(view.getByRole('combobox', { name: '表达语气' }), { target: { value: 'brief' } });
  assert.equal(view.queryByRole('textbox', { name: '消息草稿（可编辑）' }), null);
  assert.equal(pending.length, 2, 'changing options must not generate automatically');
  fireEvent.click(view.getByRole('button', { name: '生成消息草稿' }));
  fireEvent.click(view.getByRole('button', { name: '取消生成' }));
  assert.equal(pending[2].signal.aborted, true);
  await act(async () => pending[2].resolve(generated('已取消的草稿不能显示。')));
  assert.equal(view.queryByRole('textbox', { name: '消息草稿（可编辑）' }), null);
  assert.match(view.getByRole('status').textContent || '', /已取消/);
  fireEvent.click(view.getByRole('button', { name: '生成消息草稿' }));
  view.unmount();
  assert.equal(pending[3].signal.aborted, true);
  await act(async () => pending[3].resolve(generated('离开页面后的旧结果不能显示。')));
});
