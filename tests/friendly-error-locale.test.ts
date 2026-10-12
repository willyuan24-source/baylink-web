import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import { friendlyErrorMessage } from '../src/lib/format';
import { setLocale } from '../src/i18n/locale';

const han = /\p{Script=Han}/u;
afterEach(async () => { await setLocale('zh-Hans', false); });

// WEB-SHELL2: friendlyErrorMessage answers in the reader's language, so the messages pages no longer need their own
// readerError wrapper (deleted) and an English page never shows a Chinese error line.
test('a network failure reads in every edition', async () => {
  assert.equal(friendlyErrorMessage(new TypeError('Failed to fetch')), '网络连接异常，请稍后再试。');
  await setLocale('zh-Hant', false);
  const traditional = friendlyErrorMessage(new TypeError('Failed to fetch'));
  assert.match(traditional, /網/);
  assert.doesNotMatch(traditional, /网络|异常|请/);
  await setLocale('en', false);
  assert.equal(friendlyErrorMessage(new TypeError('NetworkError when attempting to fetch resource.')), 'Network connection problem. Please try again later.');
  assert.equal(friendlyErrorMessage({ error: 'Load failed' }, '加载失败'), 'Network connection problem. Please try again later.');
});

test('sign-in and permission errors are localized', async () => {
  assert.equal(friendlyErrorMessage({ error: 'Unauthorized' }), '请先登录');
  await setLocale('zh-Hant', false);
  assert.equal(friendlyErrorMessage({ error: 'Forbidden' }), '暫無權限執行此操作');
  await setLocale('en', false);
  assert.equal(friendlyErrorMessage({ error: 'Unauthorized' }), 'Please sign in first.');
  assert.equal(friendlyErrorMessage({ error: 'forbidden' }), 'You do not have permission to do this.');
});

test('English pages never show Chinese error text', async () => {
  await setLocale('en', false);
  // Chinese server wording the dictionary does not know gives way to the caller's English fallback.
  assert.equal(friendlyErrorMessage({ error: '这条私信暂时无法发送给对方（测试）' }, 'Your message was not sent.'), 'Your message was not sent.');
  // A Chinese fallback with no dictionary entry falls back to a generic English line.
  const generic = friendlyErrorMessage({}, '一个字典里没有的失败提示（测试）');
  assert.doesNotMatch(generic, han);
  assert.equal(generic, 'Something went wrong. Please try again later.');
  assert.doesNotMatch(friendlyErrorMessage(undefined), han);
  // Unknown English server details still never reach the reader.
  assert.equal(friendlyErrorMessage({ error: 'MongoServerError: E11000 duplicate key' }, 'Could not save.'), 'Could not save.');
});

test('Chinese server wording converts for 繁體 and stays as written in 简体', async () => {
  assert.equal(friendlyErrorMessage({ error: '标题不能为空' }), '标题不能为空');
  await setLocale('zh-Hant', false);
  const converted = friendlyErrorMessage({ error: '标题不能为空' });
  assert.match(converted, /標題/);
  assert.equal(friendlyErrorMessage({}, '删除失败，请稍后再试'), '刪除失敗，請稍後再試');
});
