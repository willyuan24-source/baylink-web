import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { registerHooks } from 'node:module';
import React from 'react';
import { JSDOM } from 'jsdom';
import { apiNormalizeFeedback } from './api-func-contract';

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
const { MemoryRouter } = await import('react-router-dom');
const { default: FeedbackSheet } = await import('../src/features/feedback/FeedbackSheet');
const { ReportErrorLink, FeedbackLink } = await import('../src/features/feedback/ReportErrorLink');
const { BayBayDownvoteReasons } = await import('../src/features/feedback/BayBayDownvoteReasons');
const { buildFeedbackPayload, submitFeedback } = await import('../src/features/feedback/feedback-api');
const { setLocale } = await import('../src/i18n/locale');
type Payload = Parameters<typeof submitFeedback>[0];

afterEach(async () => { cleanup(); document.getElementById('baylink-feedback-root')?.remove(); await setLocale('zh-Hans', false); });
const request = { kind: 'page' as const, routeTemplate: '/events/:id' };
const fetchBodies = (fetch: { mock: { calls: { arguments: unknown[] }[] } }, suffix: string) => fetch.mock.calls
  .filter(call => String(call.arguments[0]).endsWith(suffix)).map(call => JSON.parse(String((call.arguments[1] as RequestInit).body)));

test('the page sheet asks what the reader was doing and sends only the contract fields', async context => {
  const fetch = context.mock.method(globalThis, 'fetch', async () => new Response('{}'));
  const sent: Payload[] = [];
  let closed = 0;
  const view = render(<FeedbackSheet request={request} onClose={() => { closed++; }} send={async payload => { sent.push(payload); return { ok: true }; }} />);
  const dialog = view.getByRole('dialog', { name: '反馈与报错' });
  const chips = within(dialog).getAllByRole('radio');
  assert.match(dialog.querySelector('.feedback-attached')!.textContent!, /^会一起发送：页面类型、语言、字号和网站版本。不含网址/, 'no item id on a page report');
  assert.equal(dialog.querySelector('.feedback-attached a')!.getAttribute('href'), '/privacy');
  assert.deepEqual(chips.map(chip => chip.closest('label')!.textContent), ['找活动', '办事', '问 BayBay', '计划行程', '其他']);
  fireEvent.click(within(dialog).getByRole('button', { name: '发送反馈' }));
  assert.equal(within(dialog).getByRole('alert').textContent, '请先选一项', 'a reason is required before anything is sent');
  assert.equal(sent.length, 0);
  fireEvent.click(within(dialog).getByRole('radio', { name: '办事' }));
  fireEvent.change(within(dialog).getByLabelText('哪里不对，或者你的建议（选填）'), { target: { value: '  DMV 预约链接打不开  ' } });
  fireEvent.change(within(dialog).getByLabelText('联系方式（选填）'), { target: { value: 'wechat-abc' } });
  await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: '发送反馈' })); });
  assert.deepEqual(sent[0], { kind: 'page', routeTemplate: '/events/:id', reason: 'get-help', text: 'DMV 预约链接打不开', contact: 'wechat-abc', locale: 'zh-Hans', readingSize: 'large', release: 'dev', website: '' });
  assert.doesNotMatch(JSON.stringify(sent[0]), /fleet|email|example|date=/, 'no URL, query or id of the page');
  assert.ok(apiNormalizeFeedback(sent[0]), 'the live API accepts the body');
  assert.equal(view.getByRole('dialog').querySelector('h2')!.textContent, '收到了，谢谢你！');
  assert.deepEqual(fetchBodies(fetch, '/product-events').map(body => [body.event, body.route]), [['feedback_sent', '/events/:id']]);
  fireEvent.click(view.getByRole('button', { name: '关闭' }));
  assert.equal(closed, 1);
});

test('the honeypot is hidden from people and assistive technology and sent as typed', async () => {
  const sent: Payload[] = [];
  const view = render(<FeedbackSheet request={request} onClose={() => {}} send={async payload => { sent.push(payload); return { ok: true }; }} />);
  const trap = view.baseElement.querySelector<HTMLInputElement>('input[name="website"]')!;
  assert.equal(trap.closest('[aria-hidden="true"]') !== null, true);
  assert.equal(trap.tabIndex, -1);
  fireEvent.change(trap, { target: { value: 'http://spam.example' } });
  fireEvent.click(view.getByRole('radio', { name: '其他' }));
  await act(async () => { fireEvent.click(view.getByRole('button', { name: '发送反馈' })); });
  assert.equal(sent[0].website, 'http://spam.example', 'the API answers 202 and stores nothing');
});

test('every API refusal keeps the reader\'s text and explains itself; the daily limits offer email', async () => {
  for (const [code, status, message] of [
    ['FEEDBACK_RATE_LIMIT', 429, '发送太频繁了，请一分钟后再试。'],
    ['FEEDBACK_DAILY_LIMIT', 429, '今天已经发了 10 条，明天再来；着急的话请发邮件给我们。'],
    ['FEEDBACK_GLOBAL_LIMIT', 429, '今天的反馈已满，请明天再试；着急的话请发邮件给我们。'],
    ['FEEDBACK_UNAVAILABLE', 503, '暂时没发出去，你写的内容还在，请稍后再试。'],
    ['FEEDBACK_INVALID', 400, '内容格式有误，请检查后再发。'],
  ] as const) {
    const fetcher = (async () => Response.json({ code }, { status })) as typeof fetch;
    const view = render(<FeedbackSheet request={request} onClose={() => {}} send={payload => submitFeedback(payload, fetcher)} />);
    fireEvent.click(view.getByRole('radio', { name: '找活动' }));
    const text = view.getByLabelText('哪里不对，或者你的建议（选填）') as HTMLTextAreaElement;
    fireEvent.change(text, { target: { value: '本周末的活动太少' } });
    await act(async () => { fireEvent.click(view.getByRole('button', { name: '发送反馈' })); });
    const alert = view.getByRole('alert');
    assert.match(alert.textContent!, new RegExp(`^${message.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
    assert.equal(!!alert.querySelector('a[href="mailto:Baylink.us@gmail.com"]'), code === 'FEEDBACK_DAILY_LIMIT' || code === 'FEEDBACK_GLOBAL_LIMIT');
    assert.equal(text.value, '本周末的活动太少');
    cleanup();
  }
  const offline = await submitFeedback(buildFeedbackPayload({ kind: 'page', routeTemplate: '/', reason: 'other' }), (async () => { throw new TypeError('offline'); }) as typeof fetch);
  assert.deepEqual(offline, { ok: false, failure: 'unavailable' });
});

test('"这条信息有误？" opens the content sheet with the item and its page template, in English too', async context => {
  const fetch = context.mock.method(globalThis, 'fetch', async (url: string) => String(url).endsWith('/feedback') ? new Response('{"ok":true}', { status: 202 }) : new Response('{}'));
  const view = render(<MemoryRouter><ReportErrorLink entity={{ kind: 'event', id: 'san-francisco-fleet-week-2026' }} title="旧金山舰队周" /></MemoryRouter>);
  await act(async () => { fireEvent.click(view.getByRole('button', { name: '这条信息有误？告诉我们' })); await new Promise(resolve => setTimeout(resolve, 50)); });
  const dialog = await waitFor(() => within(document.body).getByRole('dialog', { name: '这条信息有误？' }));
  assert.match(dialog.textContent!, /关于：旧金山舰队周/);
  assert.match(dialog.querySelector('.feedback-attached')!.textContent!, /^会一起发送：页面类型、这条信息的编号、语言、字号和网站版本。/, 'a content report names the item id it sends');
  assert.deepEqual(within(dialog).getAllByRole('radio').map(chip => (chip as HTMLInputElement).value), ['outdated', 'wrong-time', 'wrong-place', 'wrong-price', 'broken-link', 'closed', 'other']);
  fireEvent.click(within(dialog).getByRole('radio', { name: '时间不对' }));
  await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: '发送反馈' })); await new Promise(resolve => setTimeout(resolve, 0)); });
  const [body] = fetchBodies(fetch, '/feedback');
  assert.deepEqual({ kind: body.kind, routeTemplate: body.routeTemplate, reason: body.reason, entity: body.entity }, { kind: 'content', routeTemplate: '/events/:id', reason: 'wrong-time', entity: { kind: 'event', id: 'san-francisco-fleet-week-2026' } });
  assert.ok(apiNormalizeFeedback(body));
  assert.deepEqual(fetchBodies(fetch, '/product-events').map(event => event.event), ['feedback_open', 'feedback_sent']);
  await act(async () => { fireEvent.click(within(document.body).getByRole('button', { name: '关闭' })); });
  await act(async () => { await setLocale('en', false); });
  assert.ok(view.getByRole('button', { name: 'Something wrong here? Tell us' }));
  await act(async () => { fireEvent.click(view.getByRole('button', { name: 'Something wrong here? Tell us' })); await new Promise(resolve => setTimeout(resolve, 50)); });
  const english = await waitFor(() => within(document.body).getByRole('dialog', { name: 'Something wrong here?' }));
  assert.match(english.querySelector('.feedback-attached')!.textContent!, /^Sent along: the page type, this item’s id, the language/);
  await act(async () => { fireEvent.click(within(english).getByRole('button', { name: 'Cancel' })); });
  assert.equal(within(document.body).queryByRole('dialog'), null);
});

test('the site-wide link opens the page sheet and every label is English under /en', async () => {
  await act(async () => { await setLocale('en', false); });
  const view = render(<FeedbackLink />);
  await act(async () => { fireEvent.click(view.getByRole('button', { name: 'Feedback and error reports' })); await new Promise(resolve => setTimeout(resolve, 50)); });
  const dialog = await waitFor(() => within(document.body).getByRole('dialog', { name: 'Feedback' }));
  assert.doesNotMatch(dialog.textContent!, /[㐀-鿿]/);
  assert.deepEqual(within(dialog).getAllByRole('radio').map(chip => chip.closest('label')!.textContent), ['Finding events', 'Getting something done', 'Asking BayBay', 'Planning a day', 'Something else']);
  await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' })); });
  assert.equal(within(document.body).queryByRole('dialog'), null);
});

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

test('text and contact are capped at the API limits by code point', () => {
  const payload = buildFeedbackPayload({ kind: 'page', routeTemplate: '/', reason: 'other', text: '字'.repeat(600), contact: '😀'.repeat(90) });
  assert.equal([...payload.text].length, 500);
  assert.equal([...payload.contact!].length, 80);
  assert.ok(apiNormalizeFeedback(payload));
});
