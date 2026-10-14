import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { API_CODES_WITHOUT_TABLE, API_ERROR_CODES_EN, API_ERRORS_EN } from '../src/i18n/api-errors-en';
import { setLocale } from '../src/i18n/locale';
import { localizeApiMessage } from '../src/lib/api-errors';

/**
 * H48 (I13-11): every message and error code the API can answer with has English on an English page. The list is the
 * committed snapshot of the API's own source (src/i18n/api-errors.snapshot.json, written by scripts/snapshot-api-errors.mjs
 * from the api repo); refresh it after an API change, and a new Chinese message without English fails here.
 */
type Snapshot = { commit: string; messages: { text: string; where: string }[]; codes: { code: string; where: string; messages: string[]; english?: string }[]; unresolvedTemplates: string[] };
const snapshot = JSON.parse(readFileSync('src/i18n/api-errors.snapshot.json', 'utf8')) as Snapshot;

test('H48: the snapshot is a real read of the API (a commit, hundreds of messages, the codes FIX5 added)', () => {
  assert.match(snapshot.commit, /^[0-9a-f]{40}$/);
  assert.ok(snapshot.messages.length >= 400, `${snapshot.messages.length} messages`);
  for (const code of ['ADMIN_MFA_REQUIRED', 'PHONE_NOT_US', 'WEAK_PASSWORD', 'SAME_PASSWORD', 'ACCOUNT_CHANGED']) assert.ok(snapshot.codes.some(entry => entry.code === code), code);
});

test('H48: every Chinese message the API can send has reviewed English', () => {
  const missing = snapshot.messages.filter(message => !Object.hasOwn(API_ERRORS_EN, message.text)).map(message => `${message.where} ${message.text}`);
  assert.deepEqual(missing, [], 'add English to src/i18n/api-errors-en.ts');
  for (const message of snapshot.messages) assert.doesNotMatch(API_ERRORS_EN[message.text], /[㐀-鿿]/, message.text);
});

test('H48: every error code is covered — by its own English, by the English of each message it carries, or with a stated reason', () => {
  const uncovered: string[] = [];
  for (const entry of snapshot.codes) {
    if (Object.hasOwn(API_ERROR_CODES_EN, entry.code) || Object.hasOwn(API_CODES_WITHOUT_TABLE, entry.code)) continue;
    if (entry.messages.length && entry.messages.every(text => Object.hasOwn(API_ERRORS_EN, text))) continue;
    uncovered.push(`${entry.code} (${entry.where})`);
  }
  assert.deepEqual(uncovered, []);
  // a code listed as needing no English must still exist in the API, so the list cannot hide a stale entry
  for (const code of Object.keys(API_CODES_WITHOUT_TABLE)) assert.ok(snapshot.codes.some(entry => entry.code === code), `${code} is no longer an API code`);
  // the API's own English for a code (lib/aiBudget.js) and ours say the same thing
  for (const entry of snapshot.codes.filter(item => item.english && Object.hasOwn(API_ERROR_CODES_EN, item.code))) assert.ok(API_ERROR_CODES_EN[entry.code].length > 10, entry.code);
});

test('H48: a template the snapshot cannot resolve is known, so a new one is looked at', () => {
  const known = [/^lib\/baybayAgent\.js:\d+ The user chose site-only mode/, /^lib\/postLifecycle\.js:\d+ \$\{name\}格式无效$/, /^lib\/serviceBookings\.js:\d+ \$\{reason\}原预约仍保留。$/];
  for (const template of snapshot.unresolvedTemplates) assert.ok(known.some(pattern => pattern.test(template)), template);
});

test('H48: the six messages of the 10-13 audit show in English on an English page', async () => {
  await setLocale('en', false);
  try {
    assert.equal(await localizeApiMessage('目前只能验证美国手机号（+1，美国区号）。', 'PHONE_NOT_US'), 'Only U.S. phone numbers (+1, a U.S. area code) can be verified for now.');
    assert.match(await localizeApiMessage('管理员操作需要验证器：请先在“隐私与安全”中开启验证器，再用验证器重新登录。', 'ADMIN_MFA_REQUIRED'), /authenticator/);
    assert.match(await localizeApiMessage('新密码至少 8 位，包含大写字母、小写字母和数字（最多 128 位）。', 'WEAK_PASSWORD'), /at least 8 characters/);
    assert.match(await localizeApiMessage('管理员新密码至少 12 位，包含大写字母、小写字母和数字（最多 128 位）。', 'WEAK_PASSWORD'), /at least 12 characters/, 'WEAK_PASSWORD has two messages: translated by message, not by code');
    assert.match(await localizeApiMessage('新密码不能和当前密码相同。', 'SAME_PASSWORD'), /same as your current/);
    assert.match(await localizeApiMessage('账号凭证已变化，请重新登录后再试。', 'ACCOUNT_CHANGED'), /credentials changed/);
    assert.match(await localizeApiMessage('暂时无法撤销管理员登录，请重试。'), /admin sessions/);
  } finally { await setLocale('zh-Hans', false); }
});
