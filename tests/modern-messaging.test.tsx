import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';
import type { Conversation, Message, UserData } from '../src/lib/types';
import type { Socket } from 'socket.io-client';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://www.baylink.us/', pretendToBeVisual: true });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, sessionStorage: dom.window.sessionStorage, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, Event: dom.window.Event, requestAnimationFrame: (callback: FrameRequestCallback) => setTimeout(callback, 0), IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { render, fireEvent, cleanup, waitFor, act } = await import('@testing-library/react');
const { MemoryRouter } = await import('react-router-dom');
await import('../src/routing');
const { ChatView } = await import('../src/features/messages/ChatView');
const { MessagesList } = await import('../src/features/messages/MessagesList');
const { api } = await import('../src/lib/api');
const { mergeMessages, readServerMessage, messageDraftKey, messagePinsKey, saveMessageDraft, readMessageDraft, saveMessagePins, readMessagePins, readPendingMessages, clearMessageDrafts, messageReadBatches } = await import('../src/features/messages/messageState');
const { setLocale } = await import('../src/i18n/locale');
const originalRequest = api.request;
const user = (id = 'me'): UserData => ({ id, email: `${id}@example.test`, nickname: id === 'me' ? '我的中文昵称' : '第二个账号', role: 'user', contactType: 'email', contactValue: '', isBanned: false });
const conversation = (id = 'thread', unreadCount = 0): Conversation => ({ id, otherUser: { id: `other-${id}`, nickname: `邻居 ${id}`, city: 'San Francisco', statusText: '周末一起喝咖啡 ☕', profileTheme: 'sunset' }, updatedAt: Date.UTC(2026, 8, 9, 12), unreadCount });
const message = (id = 'one', content = '你好，明天可以吗？', extra: Partial<Message> = {}): Message => ({ id, conversationId: 'thread', senderId: 'other-thread', type: 'text', content, createdAt: Date.UTC(2026, 8, 9, 12), ...extra });
const defer = <T,>() => { let resolve!: (value: T) => void; let reject!: (reason: unknown) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const socketStub = () => {
  const handlers = new Map<string, Set<(value: unknown) => void>>();
  const socket = { on(name: string, handler: (value: unknown) => void) { if (!handlers.has(name)) handlers.set(name, new Set()); handlers.get(name)!.add(handler); }, off(name: string, handler: (value: unknown) => void) { handlers.get(name)?.delete(handler); } };
  return { socket: socket as unknown as Socket, emit(name: string, value: unknown) { handlers.get(name)?.forEach(handler => handler(value)); } };
};
const viewChat = (options: Partial<React.ComponentProps<typeof ChatView>> = {}) => <MemoryRouter><ChatView currentUser={user()} conversation={conversation()} socket={null} onClose={() => {}} {...options} /></MemoryRouter>;
const visible = (state: 'hidden' | 'visible') => { Object.defineProperty(document, 'visibilityState', { configurable: true, value: state }); };
const dimensions = (element: HTMLElement) => {
  let top = 0;
  let height = 1000;
  Object.defineProperties(element, { clientHeight: { configurable: true, get: () => 200 }, scrollHeight: { configurable: true, get: () => height }, scrollTop: { configurable: true, get: () => top, set: value => { top = Math.max(0, Math.min(height - 200, value)); } } });
  return { grow: () => { height += 100; } };
};
afterEach(async () => { cleanup(); clearMessageDrafts(); api.request = originalRequest; localStorage.clear(); sessionStorage.clear(); visible('visible'); await setLocale('zh-Hans', false); });

test('message parser blocks contact-card quotes and merges monotonically versioned reactions', () => {
  const v3 = message('one', '你好', { reactionVersion: 3, reactions: [{ emoji: '❤️', userIds: ['me'] }] });
  const v1 = message('one', '你好', { reactionVersion: 1, reactions: [{ emoji: '👍', userIds: ['me'] }] });
  assert.deepEqual(mergeMessages([v3], [v1])[0].reactions, v3.reactions);
  assert.deepEqual(mergeMessages([v1], [v3])[0].reactions, v3.reactions);
  assert.equal(readServerMessage({ ...v3, type: 'contact_card', replyTo: { id: 'contact', senderId: 'me', content: 'private phone' } })?.replyTo, undefined);
  assert.deepEqual(readServerMessage({ ...v3, reactions: [{ emoji: 'bad', userIds: ['x'] }, { emoji: '👍', userIds: ['me', 'me', 7] }] })?.reactions, [{ emoji: '👍', userIds: ['me'] }]);
});

test('drafts and at most 20 distinct pins are isolated by account and conversation', () => {
  saveMessageDraft('me', 'thread', '自己的草稿'); saveMessageDraft('someone-else', 'thread', '另一个账号');
  assert.equal(readMessageDraft('me', 'thread'), '自己的草稿'); assert.equal(readMessageDraft('me', 'another'), '');
  assert.equal(readMessageDraft('someone-else', 'thread'), '另一个账号');
  saveMessagePins('me', Array.from({ length: 25 }, (_, index) => `thread-${index}`));
  assert.equal(readMessagePins('me').length, 20); assert.deepEqual(readMessagePins('someone-else'), []);
  saveMessageDraft('me', 'thread', ''); assert.equal(sessionStorage.getItem(messageDraftKey('me', 'thread')), null);
  const setItem = Object.getOwnPropertyDescriptor(dom.window.Storage.prototype, 'setItem')!;
  Object.defineProperty(dom.window.Storage.prototype, 'setItem', { configurable: true, value: () => { throw new Error('quota'); } });
  try { assert.equal(saveMessageDraft('me', 'thread', 'unsaved'), false); assert.equal(saveMessagePins('me', ['thread']), false); }
  finally { Object.defineProperty(dom.window.Storage.prototype, 'setItem', setItem); }
});

test('textarea preserves Shift+Enter and IME; plain Enter sends, then clears only its own session draft', async () => {
  const posts: { endpoint: string; body: Record<string, unknown> }[] = [];
  api.request = async (endpoint, options) => {
    if (endpoint.endsWith('/read')) return {};
    if (options?.method === 'POST') { const body = JSON.parse(String(options.body)); posts.push({ endpoint, body }); return message('saved', body.content, { senderId: 'me' }); }
    return [];
  };
  saveMessageDraft('other-account', 'thread', '别人的草稿');
  const view = render(viewChat());
  await waitFor(() => assert.ok(!view.queryByText('正在加载消息…')));
  const input = view.getByRole('textbox', { name: '消息内容' });
  fireEvent.change(input, { target: { value: '第一行\n第二行' } });
  fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
  fireEvent.compositionStart(input); fireEvent.keyDown(input, { key: 'Enter' }); fireEvent.compositionEnd(input);
  fireEvent.keyDown(input, { key: 'Enter', isComposing: true }); fireEvent.keyDown(input, { key: 'Enter', keyCode: 229 });
  assert.equal(posts.length, 0); assert.equal(readMessageDraft('me', 'thread'), '第一行\n第二行');
  fireEvent.keyDown(input, { key: 'Enter' });
  await waitFor(() => assert.equal(posts.length, 1));
  assert.equal(posts[0].body.content, '第一行\n第二行'); assert.equal(readMessageDraft('me', 'thread'), ''); assert.equal(readMessageDraft('other-account', 'thread'), '别人的草稿');
});

test('failed send restores the submitted draft, but never overwrites a subsequently edited draft', async () => {
  let pending = defer<unknown>();
  api.request = async (endpoint, options) => endpoint.endsWith('/read') ? {} : options?.method === 'POST' ? pending.promise : [];
  const view = render(viewChat()); await waitFor(() => assert.ok(!view.queryByText('正在加载消息…')));
  const input = view.getByRole('textbox', { name: '消息内容' });
  fireEvent.change(input, { target: { value: '第一条' } }); fireEvent.click(view.getByRole('button', { name: '发送消息' }));
  await act(async () => { pending.reject(new Error('network')); });
  assert.equal((input as HTMLTextAreaElement).value, '第一条'); assert.equal(readMessageDraft('me', 'thread'), '第一条');
  pending = defer<unknown>(); fireEvent.click(view.getByRole('button', { name: '发送消息' }));
  fireEvent.change(input, { target: { value: '我继续写的下一条' } });
  await act(async () => { pending.reject(new Error('network')); });
  assert.equal((input as HTMLTextAreaElement).value, '我继续写的下一条'); assert.equal(readMessageDraft('me', 'thread'), '我继续写的下一条');
});

test('late send and history responses cannot modify another account or conversation', async () => {
  const oldSend = defer<unknown>(); const oldHistory = defer<unknown>();
  api.request = async (endpoint, options) => endpoint.endsWith('/read') ? {} : options?.method === 'POST' ? oldSend.promise : endpoint.includes('late-history') ? oldHistory.promise : [];
  const view = render(viewChat()); await waitFor(() => assert.ok(!view.queryByText('正在加载消息…')));
  fireEvent.change(view.getByRole('textbox', { name: '消息内容' }), { target: { value: '旧账号私信' } }); fireEvent.click(view.getByRole('button', { name: '发送消息' }));
  view.rerender(viewChat({ currentUser: user('second'), conversation: conversation('second-thread') }));
  fireEvent.change(view.getByRole('textbox', { name: '消息内容' }), { target: { value: '新账号草稿' } });
  await act(async () => { oldSend.reject(new Error('late failure')); });
  assert.equal((view.getByRole('textbox', { name: '消息内容' }) as HTMLTextAreaElement).value, '新账号草稿'); assert.equal(view.queryByText('旧账号私信'), null);
  view.rerender(viewChat({ conversation: conversation('late-history') }));
  view.rerender(viewChat({ currentUser: user('second'), conversation: conversation('second-thread') }));
  await act(async () => { oldHistory.resolve([message('secret', '不能出现在其他账号')]); });
  assert.equal(view.queryByText('不能出现在其他账号'), null); assert.equal(readMessageDraft('second', 'second-thread'), '新账号草稿');
});

test('read boundary requires visibility and bottom; incoming messages preserve older scroll position', async () => {
  visible('hidden'); const history = defer<unknown>(); const reads: string[] = []; const wire = socketStub();
  api.request = async (endpoint, options) => { if (endpoint.endsWith('/read')) { reads.push(JSON.parse(String(options?.body)).messageId); return {}; } return history.promise; };
  const view = render(viewChat({ socket: wire.socket })); const region = view.getByRole('region', { name: '聊天记录' }); const layout = dimensions(region);
  await act(async () => { history.resolve([message()]); }); assert.deepEqual(reads, []);
  visible('visible'); await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
  await waitFor(() => assert.deepEqual(reads, ['one']));
  region.scrollTop = 120; fireEvent.scroll(region); layout.grow();
  await act(async () => { wire.emit('new_message', message('two', '刚到的新消息', { createdAt: Date.UTC(2026, 8, 9, 13) })); wire.emit('new_message', message('two', '刚到的新消息', { createdAt: Date.UTC(2026, 8, 9, 13) })); });
  assert.equal(region.scrollTop, 120); assert.deepEqual(reads, ['one']);
  assert.equal(view.getByRole('button', { name: /新消息/ }).textContent, '新消息1');
  fireEvent.click(view.getByRole('button', { name: /新消息/ })); await waitFor(() => assert.deepEqual(reads, ['one', 'two'])); assert.equal(region.scrollTop, 900);
});

test('a stale history response cannot overwrite a newer socket reaction', async () => {
  const history = defer<unknown>(); const wire = socketStub();
  api.request = async endpoint => endpoint.endsWith('/read') ? {} : history.promise;
  const view = render(viewChat({ socket: wire.socket }));
  await act(async () => { wire.emit('new_message', message()); wire.emit('message_updated', message('one', '你好，明天可以吗？', { reactionVersion: 3, reactions: [{ emoji: '❤️', userIds: ['me'] }] })); history.resolve([message('one', '你好，明天可以吗？', { reactionVersion: 1, reactions: [{ emoji: '👍', userIds: ['me'] }] })]); });
  assert.ok(view.getByRole('button', { name: '❤️ · 1' })); assert.equal(view.queryByRole('button', { name: '👍 · 1' }), null);
});

test('text replies send the real message id; contact cards cannot be quoted or reacted to', async () => {
  const posts: Record<string, unknown>[] = [];
  api.request = async (endpoint, options) => {
    if (endpoint.endsWith('/read')) return {};
    if (options?.method === 'POST') { const body = JSON.parse(String(options.body)); posts.push(body); return message('reply', body.content, { senderId: 'me', replyTo: { id: 'one', senderId: 'other-thread', content: '你好，明天可以吗？' } }); }
    return [message(), message('contact', '', { type: 'contact_card', contactCard: { methods: [{ type: 'phone', value: '555-0100' }] } })];
  };
  const view = render(viewChat()); await waitFor(() => assert.equal(view.getAllByRole('button', { name: '引用回复' }).length, 1));
  fireEvent.click(view.getByRole('button', { name: '引用回复' })); assert.ok(view.getByRole('button', { name: '取消引用回复' }));
  fireEvent.change(view.getByRole('textbox', { name: '消息内容' }), { target: { value: '明天可以' } }); fireEvent.click(view.getByRole('button', { name: '发送消息' }));
  await waitFor(() => assert.equal(posts.length, 1)); assert.equal(posts[0].replyToId, 'one'); assert.equal(JSON.stringify(posts[0]).includes('555-0100'), false);
  assert.equal(view.getAllByRole('button', { name: '添加回应' }).length, 2);
});

test('reaction picker updates only on server success and selected reaction toggles off', async () => {
  const changes: unknown[] = [];
  api.request = async (endpoint, options) => {
    if (endpoint.endsWith('/read')) return {};
    if (endpoint.endsWith('/reaction')) { const body = JSON.parse(String(options?.body)); changes.push(body.emoji); return message('one', '你好，明天可以吗？', { reactionVersion: changes.length, reactions: body.emoji ? [{ emoji: body.emoji, userIds: ['me'] }] : [] }); }
    return [message()];
  };
  const view = render(viewChat()); await waitFor(() => assert.ok(view.getByRole('button', { name: '添加回应' })));
  fireEvent.click(view.getByRole('button', { name: '添加回应' })); fireEvent.click(view.getByRole('button', { name: '🎉', exact: true }));
  await waitFor(() => assert.ok(view.getByRole('button', { name: '🎉 · 1' }))); fireEvent.click(view.getByRole('button', { name: '🎉 · 1' }));
  await waitFor(() => assert.ok(!view.queryByRole('button', { name: '🎉 · 1' }))); assert.deepEqual(changes, ['🎉', null]);
});

test('emoji insertion uses the selection and storage failure is visible without losing typed text', async () => {
  api.request = async () => [];
  const view = render(viewChat()); await waitFor(() => assert.ok(!view.queryByText('正在加载消息…')));
  const input = view.getByRole('textbox', { name: '消息内容' }) as HTMLTextAreaElement;
  fireEvent.change(input, { target: { value: 'Hello world' } }); input.setSelectionRange(6, 11);
  fireEvent.click(view.getByRole('button', { name: '插入表情' })); fireEvent.click(view.getByRole('button', { name: '👋', exact: true })); assert.equal(input.value, 'Hello 👋');
  const descriptor = Object.getOwnPropertyDescriptor(dom.window.Storage.prototype, 'setItem')!;
  Object.defineProperty(dom.window.Storage.prototype, 'setItem', { configurable: true, value: () => { throw new Error('quota'); } });
  try { fireEvent.change(input, { target: { value: '未能写入存储的草稿' } }); assert.equal(input.value, '未能写入存储的草稿'); assert.ok(view.getByText('浏览器未能保存草稿，关闭前请先复制。')); }
  finally { Object.defineProperty(dom.window.Storage.prototype, 'setItem', descriptor); }
});

test('inbox searches recent messages and statuses, filters unread, and persists account-local pins', async () => {
  api.request = async () => [{ ...conversation('alpha', 2), lastMessage: '周末爬山吧' }, { ...conversation('beta', 0), lastMessage: '二手咖啡机', updatedAt: Date.UTC(2026, 8, 9, 15) }];
  const view = render(<MemoryRouter><MessagesList currentUser={user()} onOpenChat={() => {}} /></MemoryRouter>);
  await waitFor(() => assert.ok(view.getByText('二手咖啡机')));
  fireEvent.click(view.getByRole('button', { name: /未读0|未读1/ })); assert.equal(view.queryByText('二手咖啡机'), null);
  fireEvent.click(view.getByRole('button', { name: /全部2/ }));
  fireEvent.change(view.getByRole('searchbox', { name: '搜索对话' }), { target: { value: '爬山' } }); assert.equal(view.queryByText('二手咖啡机'), null);
  fireEvent.click(view.getByRole('button', { name: '清除搜索' })); fireEvent.click(view.getByRole('button', { name: '置顶对话 · 邻居 alpha' }));
  assert.deepEqual(JSON.parse(localStorage.getItem(messagePinsKey('me'))!), ['alpha']); assert.deepEqual(readMessagePins('other'), []);
  assert.equal(view.container.querySelector('.modern-inbox-row')?.textContent?.includes('邻居 alpha'), true);
});

test('inbox discards late responses after switching accounts', async () => {
  const old = defer<unknown>(); let calls = 0;
  api.request = async () => ++calls === 1 ? old.promise : [conversation('new-account')];
  const view = render(<MemoryRouter><MessagesList currentUser={user()} onOpenChat={() => {}} /></MemoryRouter>);
  view.rerender(<MemoryRouter><MessagesList currentUser={user('second')} onOpenChat={() => {}} /></MemoryRouter>);
  await waitFor(() => assert.ok(view.getByText('邻居 new-account')));
  await act(async () => { old.resolve([conversation('old-account')]); });
  assert.equal(view.queryByText('邻居 old-account'), null);
});

test('rotating a session token discards old chat history even when the account and conversation stay the same', async () => {
  const old = defer<unknown>(); let histories = 0;
  api.request = async endpoint => endpoint.endsWith('/read') ? {} : ++histories === 1 ? old.promise : [message('current', '重新登录后的消息')];
  const view = render(viewChat({ currentUser: { ...user(), token: 'first-token' } }));
  view.rerender(viewChat({ currentUser: { ...user(), token: 'rotated-token' } }));
  await act(async () => { old.resolve([message('stale', '已撤销会话的旧响应')]); });
  assert.equal(histories, 2);
  assert.ok(view.getByText('重新登录后的消息'));
  assert.ok(!view.queryByText('已撤销会话的旧响应'));
});

test('rotating a session token reloads the inbox and ignores old responses', async () => {
  const old = defer<unknown>(); let loads = 0;
  api.request = async () => ++loads === 1 ? old.promise : [conversation('new-session')];
  const view = render(<MemoryRouter><MessagesList currentUser={{ ...user(), token: 'first-token' }} onOpenChat={() => {}} /></MemoryRouter>);
  view.rerender(<MemoryRouter><MessagesList currentUser={{ ...user(), token: 'rotated-token' }} onOpenChat={() => {}} /></MemoryRouter>);
  await act(async () => { old.resolve([conversation('stale-session')]); });
  assert.equal(loads, 2);
  assert.ok(view.getByText('邻居 new-session'));
  assert.ok(!view.queryByText('邻居 stale-session'));
});






test('unconfirmed send backups survive closing, preserve a new draft, and clear on a late acknowledgement', async () => {
  const pending = defer<unknown>();
  api.request = async (endpoint, options) => endpoint.endsWith('/read') ? {} : options?.method === 'POST' ? pending.promise : [];
  let view = render(viewChat()); await waitFor(() => assert.ok(!view.queryByText('正在加载消息…')));
  fireEvent.change(view.getByRole('textbox', { name: '消息内容' }), { target: { value: '跨关闭保留的原文' } }); fireEvent.click(view.getByRole('button', { name: '发送消息' }));
  assert.equal(readPendingMessages('me', 'thread')[0]?.content, '跨关闭保留的原文');
  view.unmount(); saveMessageDraft('me', 'thread', '新稿不要覆盖');
  view = render(viewChat()); await waitFor(() => assert.ok(view.getByText('还有一条发送结果未确认的消息。先刷新核实，避免重复发送。')));
  assert.equal((view.getByRole('button', { name: '恢复未确认消息' }) as HTMLButtonElement).disabled, true);
  assert.equal((view.getByRole('textbox', { name: '消息内容' }) as HTMLTextAreaElement).value, '新稿不要覆盖');
  await act(async () => { pending.resolve(message('ack', '跨关闭保留的原文', { senderId: 'me' })); });
  assert.deepEqual(readPendingMessages('me', 'thread'), []); assert.ok(!view.queryByText('还有一条发送结果未确认的消息。先刷新核实，避免重复发送。'));
  assert.equal(readMessageDraft('me', 'thread'), '新稿不要覆盖');
});

test('a closed view whose send fails offers the original text when reopened and logout clears only that account', async () => {
  const pending = defer<unknown>();
  api.request = async (endpoint, options) => endpoint.endsWith('/read') ? {} : options?.method === 'POST' ? pending.promise : [];
  let view = render(viewChat()); await waitFor(() => assert.ok(!view.queryByText('正在加载消息…')));
  fireEvent.change(view.getByRole('textbox', { name: '消息内容' }), { target: { value: '离开之后失败的消息' } }); fireEvent.click(view.getByRole('button', { name: '发送消息' })); view.unmount();
  await act(async () => { pending.reject(new Error('late failure')); });
  view = render(viewChat()); await waitFor(() => assert.ok(view.getByRole('button', { name: '恢复未确认消息' })));
  fireEvent.click(view.getByRole('button', { name: '恢复未确认消息' }));
  assert.equal((view.getByRole('textbox', { name: '消息内容' }) as HTMLTextAreaElement).value, '离开之后失败的消息');
  saveMessageDraft('other-account', 'thread', '保留其他账号'); clearMessageDrafts('me');
  assert.equal(readMessageDraft('me', 'thread'), ''); assert.deepEqual(readPendingMessages('me', 'thread'), []); assert.equal(readMessageDraft('other-account', 'thread'), '保留其他账号');
});

test('background refresh retains failed original text when a newer draft exists', async () => {
  const pending = defer<unknown>(); const wire = socketStub(); let loads = 0;
  api.request = async (endpoint, options) => { if (endpoint.endsWith('/read')) return {}; if (options?.method === 'POST') return pending.promise; loads += 1; return []; };
  const view = render(viewChat({ socket: wire.socket })); await waitFor(() => assert.ok(!view.queryByText('正在加载消息…')));
  const input = view.getByRole('textbox', { name: '消息内容' });
  fireEvent.change(input, { target: { value: '失败A，仍要能找回来' } }); fireEvent.click(view.getByRole('button', { name: '发送消息' })); fireEvent.change(input, { target: { value: '新的草稿B' } });
  await act(async () => { pending.reject(new Error('offline')); });
  await act(async () => { wire.emit('connect', null); });
  assert.ok(loads >= 2); assert.ok(view.getByText('失败A，仍要能找回来')); assert.equal((input as HTMLTextAreaElement).value, '新的草稿B');
  fireEvent.change(input, { target: { value: '' } }); fireEvent.click(view.getByRole('button', { name: '放回输入框' })); assert.equal((input as HTMLTextAreaElement).value, '失败A，仍要能找回来');
});

test('read batches contain only observed server ids and include a late older-timestamp arrival', async () => {
  const many = Array.from({ length: 1002 }, (_, index) => message(`server-${index}`));
  const batches = messageReadBatches([...many, { ...message('local:pending'), delivery: 'sending' }, many[0]], new Set(['server-0']));
  assert.deepEqual(batches.map(batch => batch.length), [500, 500, 1]); assert.equal(batches[0][0], 'server-1');
  const wire = socketStub(); const bodies: { messageId: string; messageIds: string[] }[] = [];
  api.request = async (endpoint, options) => { if (endpoint.endsWith('/read')) { bodies.push(JSON.parse(String(options?.body))); return {}; } return [message('newer', '先到', { createdAt: Date.UTC(2026, 8, 9, 14) })]; };
  const view = render(viewChat({ socket: wire.socket })); await waitFor(() => assert.equal(bodies.length, 1));
  await act(async () => { wire.emit('new_message', message('older-late', '后到但时间较早', { createdAt: Date.UTC(2026, 8, 9, 13) })); });
  await waitFor(() => assert.equal(bodies.length, 2));
  assert.deepEqual(bodies, [{ messageId: 'newer', messageIds: ['newer'] }, { messageId: 'older-late', messageIds: ['older-late'] }]);
  assert.ok(view.getByText('后到但时间较早'));
});


test('storage denial does not block sending; memory backup survives closing until a real acknowledgement', async () => {
  const pending = defer<unknown>(); let sent = 0;
  api.request = async (endpoint, options) => { if (endpoint.endsWith('/read')) return {}; if (options?.method === 'POST') { sent += 1; return pending.promise; } return []; };
  const descriptor = Object.getOwnPropertyDescriptor(dom.window.Storage.prototype, 'setItem')!;
  Object.defineProperty(dom.window.Storage.prototype, 'setItem', { configurable: true, value: () => { throw new Error('quota'); } });
  try {
    let view = render(viewChat()); await waitFor(() => assert.ok(!view.queryByText('正在加载消息…')));
    fireEvent.change(view.getByRole('textbox', { name: '消息内容' }), { target: { value: '存储被拒绝也能发送' } }); fireEvent.click(view.getByRole('button', { name: '发送消息' }));
    assert.equal(sent, 1); assert.equal(readPendingMessages('me', 'thread')[0]?.content, '存储被拒绝也能发送');
    view.unmount(); view = render(viewChat()); assert.ok(view.getByRole('button', { name: '恢复未确认消息' }));
    await act(async () => { pending.resolve(message('ack', '存储被拒绝也能发送', { senderId: 'me' })); });
    assert.deepEqual(readPendingMessages('me', 'thread'), []); assert.ok(!view.queryByRole('button', { name: '恢复未确认消息' }));
  } finally { Object.defineProperty(dom.window.Storage.prototype, 'setItem', descriptor); }
});
