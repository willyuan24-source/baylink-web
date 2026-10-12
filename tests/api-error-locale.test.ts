import assert from 'node:assert/strict';
import test from 'node:test';
import { setLocale } from '../src/i18n/locale';
import { API_ERRORS_EN, API_ERROR_CODES_EN } from '../src/i18n/api-errors-en';
import { localizeApiError, localizeApiMessage } from '../src/lib/api-errors';
import { api } from '../src/lib/api';

test('I18N-SEO-06: every API error message has reviewed English without Chinese', () => {
  assert.ok(Object.keys(API_ERRORS_EN).length >= 163, 'the 163 strings of the 10-11 scan, plus the AI quota notice');
  for (const [zh, en] of [...Object.entries(API_ERRORS_EN), ...Object.entries(API_ERROR_CODES_EN)]) {
    assert.doesNotMatch(en, /[㐀-鿿]/, zh);
    assert.ok(en.trim().length > 3, zh);
  }
});

test('I18N-SEO-06: English pages show API errors in English, by code first; other languages keep the message', async () => {
  await setLocale('en', false);
  assert.equal(await localizeApiMessage('内容不存在或已被移除。'), 'This content does not exist or has been removed.');
  assert.equal(await localizeApiMessage('任何新的说法', 'AI_DAILY_LIMIT'), API_ERROR_CODES_EN.AI_DAILY_LIMIT);
  assert.equal(await localizeApiMessage('没见过的错误'), '没见过的错误', 'an unknown message stays as it is');
  assert.deepEqual(await localizeApiError({ error: '用户不存在', status: 404 }), { error: 'This user does not exist.', status: 404 });
  const original = globalThis.fetch;
  globalThis.fetch = (async () => new Response(JSON.stringify({ error: '搜索关键词过长' }), { status: 400, headers: { 'content-type': 'application/json' } })) as typeof fetch;
  try {
    await assert.rejects(api.request('/posts?keyword=x'), (error: { error: string; status: number }) => error.error === 'That search term is too long.' && error.status === 400);
    await setLocale('zh-Hans', false);
    await assert.rejects(api.request('/posts?keyword=x'), (error: { error: string }) => error.error === '搜索关键词过长');
  } finally { globalThis.fetch = original; await setLocale('zh-Hans', false); }
});
