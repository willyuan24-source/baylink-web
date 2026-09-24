import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';
import type { Conversation, Message, UserData } from '../src/lib/types';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://www.baylink.us/', pretendToBeVisual: true });
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage,
  sessionStorage: dom.window.sessionStorage, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node,
  Event: dom.window.Event, requestAnimationFrame: (callback: FrameRequestCallback) => setTimeout(callback, 0),
  IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const scrolledResults: HTMLElement[] = [];
Object.defineProperty(dom.window.HTMLElement.prototype, 'scrollIntoView', { configurable: true, value(this: HTMLElement) { scrolledResults.push(this); } });
const { render, fireEvent, cleanup, act } = await import('@testing-library/react');
const { MemoryRouter } = await import('react-router-dom');
const { ChatView } = await import('../src/features/messages/ChatView');
const { api } = await import('../src/lib/api');
const { setLocale } = await import('../src/i18n/locale');
const originalRequest = api.request;
const currentUser = (id = 'alice'): UserData => ({ id, token: `fixture-${id}`, nickname: id, email: `${id}@example.test`, role: 'user', isBanned: false, contactType: 'email', contactValue: '' });
const conversation = (id = 'thread'): Conversation => ({ id, otherUser: { id: 'bob', nickname: '邻居 Bob' }, updatedAt: Date.UTC(2026, 8, 23), unreadCount: 0 });
const message = (id = 'one', content = '明天下午可以取货。', extra: Partial<Message> = {}): Message => ({ id, content, type: 'text', conversationId: 'thread', senderId: 'bob', createdAt: Date.UTC(2026, 8, 23), ...extra });
const viewChat = (props: Partial<React.ComponentProps<typeof ChatView>> = {}) => <MemoryRouter><ChatView currentUser={currentUser()} conversation={conversation()} socket={null} onClose={() => {}} {...props} /></MemoryRouter>;
const deferred = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(yes => { resolve = yes; }); return { promise, resolve }; };
type Call = { path: string; body: Record<string, unknown>; signal?: AbortSignal | null };
function mockRequests(ai: (call: Call) => Promise<unknown>, history = [message()]) {
  const calls: Call[] = [];
  api.request = async (path, options) => {
    if (path.endsWith('/read')) return {};
    if (options?.method === 'POST') {
      const call = { path, body: JSON.parse(String(options.body)), signal: options.signal };
      calls.push(call);
      if (path.endsWith('/ai')) return ai(call);
      return message('sent', String(call.body.content), { senderId: 'alice' });
    }
    return history;
  };
  return calls;
}
afterEach(async () => { cleanup(); api.request = originalRequest; sessionStorage.clear(); localStorage.clear(); scrolledResults.length = 0; await setLocale('zh-Hans', false); });

test('translation is requested for one normal message only, clearly labeled, and original stays available', async () => {
  await setLocale('en', false);
  const calls = mockRequests(async () => ({ ok: true, text: 'You can pick it up tomorrow afternoon.' }), [message(), message('contact', 'contact payload', { type: 'contact-share' })]);
  const view = render(viewChat());
  await act(async () => {});
  assert.equal(calls.length, 0);
  assert.equal(view.getAllByRole('button', { name: 'Translate', exact: true }).length, 1);
  await act(async () => fireEvent.click(view.getByRole('button', { name: 'Translate', exact: true })));
  assert.deepEqual(calls[0].body, { mode: 'translate', messageId: 'one', targetLocale: 'en' });
  assert.equal(calls[0].path, '/conversations/thread/ai');
  assert.ok(view.getByText('AI translation'));
  assert.equal(view.getByText('You can pick it up tomorrow afternoon.').closest('[translate="no"]')?.className, 'chat-ai-message');
  assert.equal(view.queryByText('明天下午可以取货。'), null);
  fireEvent.click(view.getByRole('button', { name: 'Show original', exact: true }));
  assert.ok(view.getByText('明天下午可以取货。'));
  fireEvent.click(view.getByRole('button', { name: 'Show translation', exact: true }));
  assert.equal(calls.length, 1);
});

test('changing reading language discards an old translation and aborts its request', async () => {
  const first = deferred<unknown>();
  const calls = mockRequests(async () => calls.length === 1 ? first.promise : { ok: true, text: 'A fresh English translation.' });
  const view = render(viewChat()); await act(async () => {});
  fireEvent.click(view.getByRole('button', { name: '翻译', exact: true }));
  await act(async () => { await setLocale('en', false); });
  assert.equal(calls[0].signal?.aborted, true);
  await act(async () => first.resolve({ ok: true, text: '不能出现的旧译文' }));
  assert.equal(view.queryByText('不能出现的旧译文'), null);
  await act(async () => fireEvent.click(view.getByRole('button', { name: 'Translate', exact: true })));
  assert.equal(calls[1].body.targetLocale, 'en');
  assert.ok(view.getByText('A fresh English translation.'));
});

test('reply drafts require review and explicit placement and sending, and edited draft can be cleared', async () => {
  const calls = mockRequests(async () => ({ ok: true, text: '可以，周六下午见。' }));
  const view = render(viewChat()); await act(async () => {});
  const composer = view.getByRole('textbox', { name: '消息内容' }) as HTMLTextAreaElement;
  fireEvent.change(composer, { target: { value: '我已经写的消息' } });
  fireEvent.click(view.getByRole('button', { name: 'AI 帮我回复' }));
  fireEvent.change(view.getByRole('textbox', { name: '你想怎么回复？' }), { target: { value: '确认周六取货' } });
  await act(async () => fireEvent.click(view.getByRole('button', { name: '生成回复草稿' })));
  assert.equal(composer.value, '我已经写的消息');
  assert.deepEqual(calls[0].body, { mode: 'draft', intent: '确认周六取货', targetLocale: 'zh-Hans' });
  const draft = view.getByRole('textbox', { name: '检查并修改草稿' }) as HTMLTextAreaElement;
  fireEvent.change(draft, { target: { value: '' } });
  assert.ok(view.getByRole('textbox', { name: '检查并修改草稿' }));
  assert.equal((view.getByRole('button', { name: '替换输入框内容' }) as HTMLButtonElement).disabled, true);
  fireEvent.change(draft, { target: { value: '我改成周日下午，可以吗？' } });
  fireEvent.click(view.getByRole('button', { name: '替换输入框内容' }));
  assert.equal(composer.value, '我改成周日下午，可以吗？');
  assert.equal(calls.length, 1);
  assert.equal(sessionStorage.getItem('baylink.message-draft.v1:alice:thread'), composer.value);
  await act(async () => fireEvent.click(view.getByRole('button', { name: '发送消息' })));
  assert.equal(calls.length, 2);
  assert.equal(calls[1].path, '/conversations/thread/messages');
  assert.equal(calls[1].body.content, '我改成周日下午，可以吗？');
});

test('a newly generated reply reveals and focuses its result once without scrolling again while editing', async () => {
  mockRequests(async () => ({ ok: true, text: '可以，周六下午见。' }));
  const view = render(viewChat()); await act(async () => {});
  fireEvent.click(view.getByRole('button', { name: 'AI 帮我回复' }));
  assert.ok(view.getByText('只根据你填写的意思和引用的消息拟稿，不会自动发送。'));
  fireEvent.change(view.getByRole('textbox', { name: '你想怎么回复？' }), { target: { value: '确认周六取货' } });
  await act(async () => fireEvent.click(view.getByRole('button', { name: '生成回复草稿' })));
  const draft = view.getByRole('textbox', { name: '检查并修改草稿' });
  assert.equal(document.activeElement, draft);
  assert.equal(view.getByText('草稿已生成').getAttribute('role'), 'status');
  assert.equal(scrolledResults.length, 1);
  assert.equal(scrolledResults[0], draft.closest('.chat-ai-result'));
  fireEvent.change(draft, { target: { value: '' } });
  fireEvent.change(draft, { target: { value: '我把时间改成下午四点' } });
  assert.equal(scrolledResults.length, 1);
  await act(async () => fireEvent.click(view.getByRole('button', { name: '生成回复草稿' })));
  assert.equal(scrolledResults.length, 2);
  assert.equal(document.activeElement, view.getByRole('textbox', { name: '检查并修改草稿' }));
});

test('only a visibly selected quote is used as reply context and no whole conversation is submitted', async () => {
  const calls = mockRequests(async () => ({ ok: true, text: 'See you Saturday.' }));
  const view = render(viewChat()); await act(async () => {});
  fireEvent.click(view.getByRole('button', { name: '引用回复' }));
  fireEvent.click(view.getByRole('button', { name: 'AI 帮我回复' }));
  assert.ok(view.getByText('参考这条消息'));
  fireEvent.change(view.getByRole('textbox', { name: '你想怎么回复？' }), { target: { value: '确认周六取货' } });
  fireEvent.change(view.getByRole('combobox', { name: '回复语言' }), { target: { value: 'en' } });
  await act(async () => fireEvent.click(view.getByRole('button', { name: '生成回复草稿' })));
  assert.deepEqual(calls[0].body, { mode: 'draft', intent: '确认周六取货', targetLocale: 'en', messageId: 'one' });
  fireEvent.click(view.getByRole('button', { name: '取消引用回复' }));
  assert.equal(view.queryByRole('textbox', { name: '检查并修改草稿' }), null);
  assert.equal(view.queryByText('参考这条消息'), null);
});

test('editing the message box or AI intent invalidates a late draft without overwriting new text', async () => {
  const pending = deferred<unknown>();
  const calls = mockRequests(async () => pending.promise);
  const view = render(viewChat()); await act(async () => {});
  fireEvent.click(view.getByRole('button', { name: 'AI 帮我回复' }));
  const intent = view.getByRole('textbox', { name: '你想怎么回复？' });
  fireEvent.change(intent, { target: { value: '确认周六取货' } });
  fireEvent.click(view.getByRole('button', { name: '生成回复草稿' }));
  const composer = view.getByRole('textbox', { name: '消息内容' }) as HTMLTextAreaElement;
  fireEvent.change(composer, { target: { value: '我自己写的新消息' } });
  assert.equal(calls[0].signal?.aborted, true);
  await act(async () => pending.resolve({ ok: true, text: '迟到的回复' }));
  assert.equal(view.queryByRole('textbox', { name: '检查并修改草稿' }), null);
  assert.equal(composer.value, '我自己写的新消息');
  fireEvent.click(view.getByRole('button', { name: '生成回复草稿' }));
  fireEvent.change(intent, { target: { value: '换一个新的意思' } });
  await act(async () => {});
  assert.equal(calls[1].signal?.aborted, true);
  assert.equal(view.queryByRole('textbox', { name: '检查并修改草稿' }), null);
});

test('closing, switching accounts, or blocking hides AI results and cancels active private requests', async () => {
  const pending = deferred<unknown>();
  const calls = mockRequests(async () => pending.promise);
  const view = render(viewChat()); await act(async () => {});
  fireEvent.click(view.getByRole('button', { name: 'AI 帮我回复' }));
  fireEvent.change(view.getByRole('textbox', { name: '你想怎么回复？' }), { target: { value: '确认取货' } });
  fireEvent.click(view.getByRole('button', { name: '生成回复草稿' }));
  fireEvent.click(view.getByRole('button', { name: '关闭回复助手' }));
  assert.equal(calls[0].signal?.aborted, true);
  fireEvent.click(view.getByRole('button', { name: '翻译', exact: true }));
  view.rerender(viewChat({ currentUser: currentUser('charlie'), conversation: conversation('new-thread') }));
  assert.equal(calls[1].signal?.aborted, true);
  await act(async () => pending.resolve({ ok: true, text: '上一位用户的私信' }));
  assert.equal(view.queryByText('上一位用户的私信'), null);
  view.rerender(viewChat({ blockedUserIds: ['bob'] })); await act(async () => {});
  assert.equal(view.queryByRole('button', { name: '翻译', exact: true }), null);
  assert.equal((view.getByRole('button', { name: 'AI 帮我回复' }) as HTMLButtonElement).disabled, true);
});

test('invalid or failed AI responses show retryable feedback and cannot populate the composer', async () => {
  let bad = true;
  const calls = mockRequests(async () => bad ? { ok: true, text: 'x'.repeat(2100) } : { ok: true, text: '确认后的新回复' });
  const view = render(viewChat()); await act(async () => {});
  fireEvent.click(view.getByRole('button', { name: 'AI 帮我回复' }));
  fireEvent.change(view.getByRole('textbox', { name: '你想怎么回复？' }), { target: { value: '确认取货' } });
  await act(async () => fireEvent.click(view.getByRole('button', { name: '生成回复草稿' })));
  assert.ok(view.getByRole('alert'));
  assert.equal(view.queryByRole('textbox', { name: '检查并修改草稿' }), null);
  assert.equal((view.getByRole('textbox', { name: '消息内容' }) as HTMLTextAreaElement).value, '');
  bad = false;
  await act(async () => fireEvent.click(view.getByRole('button', { name: '生成回复草稿' })));
  assert.equal(calls.length, 2);
  assert.equal((view.getByRole('textbox', { name: '检查并修改草稿' }) as HTMLTextAreaElement).value, '确认后的新回复');
});
