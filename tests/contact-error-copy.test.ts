import assert from 'node:assert/strict';
import test from 'node:test';
import { contactQuotaErrorMessage } from '../src/lib/contact-error-copy';
import { friendlyErrorMessage } from '../src/lib/format';
import { setLocale } from '../src/i18n/locale';

test('known contact quota codes override raw server details and use the selected reading language', async () => {
  for (const locale of ['zh-Hans', 'zh-Hant', 'en'] as const) {
    await setLocale(locale, false);
    for (const code of ['CONTACT_DAILY_LIMIT', 'CONTACT_QUOTA_UNAVAILABLE'] as const) {
      const expected = contactQuotaErrorMessage({ code }, locale);
      assert.ok(expected);
      assert.equal(friendlyErrorMessage({ code, error: 'SQL quota lookup unavailable: private-debug-string' }), expected);
      assert.equal(friendlyErrorMessage({ code }), expected);
      if (locale === 'en') assert.doesNotMatch(expected, /\p{Script=Han}/u);
      else assert.match(expected, /請|请/);
    }
  }
  await setLocale('zh-Hans', false);
});

test('legacy contact messages and public English messages map safely without exposing unknown English errors', () => {
  assert.equal(contactQuotaErrorMessage({ error: '今日联系方式请求次数已达上限。' }, 'en'), contactQuotaErrorMessage({ code: 'CONTACT_DAILY_LIMIT' }, 'en'));
  assert.equal(contactQuotaErrorMessage({ error: '暂时无法确认联系请求额度，请稍后重试。' }, 'zh-Hant'), '暫時無法確認聯絡請求額度，請稍後重試。');
  const english = contactQuotaErrorMessage({ code: 'CONTACT_DAILY_LIMIT' }, 'en')!;
  assert.equal(contactQuotaErrorMessage(new Error(english), 'zh-Hans'), contactQuotaErrorMessage({ code: 'CONTACT_DAILY_LIMIT' }, 'zh-Hans'));
  assert.equal(friendlyErrorMessage({ code: 'CONTACT_NEW_UNKNOWN', error: 'Internal database error' }, 'Safe fallback'), 'Safe fallback');
  assert.equal(friendlyErrorMessage(new Error('Failed to fetch'), 'Safe fallback'), '网络连接异常，请稍后再试。');
  assert.equal(contactQuotaErrorMessage({ code: '__proto__', error: 'constructor' }, 'en'), undefined);
  assert.equal(friendlyErrorMessage({ error: '普通中文提示' }, 'Safe fallback'), '普通中文提示');
});
