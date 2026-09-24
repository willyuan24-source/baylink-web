import assert from 'node:assert/strict';
import test from 'node:test';
import { browserLocale } from '../src/i18n/browser-locale';

test('browser language preferences select the first supported reading language', () => {
  assert.equal(browserLocale(['en-US', 'zh-CN']), 'en');
  assert.equal(browserLocale(['zh-CN', 'en-US']), 'zh-Hans');
  assert.equal(browserLocale(['fr-FR', 'en-GB', 'zh-TW']), 'en');
  assert.equal(browserLocale(['ja-JP', 'zh-TW', 'en-US']), 'zh-Hant');
});

test('Chinese script preferences take priority over regional defaults', () => {
  for (const language of ['zh', 'zh-CN', 'zh-SG', 'zh-Hans', 'zh-Hans-TW']) {
    assert.equal(browserLocale([language]), 'zh-Hans', language);
  }
  for (const language of ['zh-TW', 'zh-HK', 'zh-MO', 'zh-Hant', 'zh-Hant-CN', 'ZH-hk']) {
    assert.equal(browserLocale([language]), 'zh-Hant', language);
  }
});

test('unsupported, missing and malformed language preferences fall back to English', () => {
  assert.equal(browserLocale(['es-MX', 'fr-FR', 'ja-JP']), 'en');
  assert.equal(browserLocale([]), 'en');
  assert.equal(browserLocale(['', 'not_a_locale', 'zh-HK']), 'zh-Hant');
});
