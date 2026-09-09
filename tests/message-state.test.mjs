import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeMessages, messageText, readServerMessage, restoreFailedDraft } from '../src/features/messages/messageState.ts';

const message = (id, content = '你好', createdAt = 1) => ({ id, senderId: 'me', conversationId: 'thread', type: 'text', content, createdAt });

test('POST acknowledgement replaces the optimistic item even when its socket event arrived first', () => {
  const pending = { ...message('local-1'), delivery: 'sending' };
  const acknowledged = message('server-1', '你好', 2);
  const withSocket = mergeMessages([pending], [acknowledged]);
  assert.deepEqual(mergeMessages(withSocket, [acknowledged], pending.id), [acknowledged]);
});

test('repeated socket delivery deduplicates by id but preserves distinct identical messages', () => {
  const first = message('1');
  const second = message('2', '你好', 2);
  assert.deepEqual(mergeMessages([first], [first, second]), [first, second]);
});

test('history loading retains messages received while the request was in flight', () => {
  const realtime = message('2', '刚收到', 2);
  const history = message('1', '历史', 1);
  assert.deepEqual(mergeMessages([history], [realtime]), [history, realtime]);
});

test('failed sends preserve a draft edited after sending, including deliberate clearing', () => {
  assert.equal(restoreFailedDraft('下一条', '上一条', false), '下一条');
  assert.equal(restoreFailedDraft('', '上一条', false), '');
  assert.equal(restoreFailedDraft('', '上一条', true), '上一条');
});

test('contact sharing has readable pending and fallback content, and uses acknowledged server content', () => {
  const pending = { ...message('local'), type: 'contact-share', content: '', delivery: 'sending' };
  assert.equal(messageText(pending), '正在分享联系方式…');
  assert.equal(messageText({ ...pending, delivery: undefined }), '已分享联系方式');
  assert.equal(messageText({ ...pending, delivery: undefined, content: '我的联系方式：微信 example' }), '我的联系方式：微信 example');
});

test('only structured server messages can replace local messages', () => {
  assert.equal(readServerMessage({ message: '发送成功' }), null);
  assert.equal(readServerMessage({ id: '1', senderId: 'me', type: 'unknown' }), null);
  const canonical = message('server');
  assert.deepEqual(readServerMessage(canonical)?.id, 'server');
  assert.deepEqual(readServerMessage({ message: canonical })?.id, 'server');
});
