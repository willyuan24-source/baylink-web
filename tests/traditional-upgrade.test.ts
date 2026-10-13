import assert from 'node:assert/strict';
import test from 'node:test';
import * as OpenCC from 'opencc-js';

/**
 * WEB-DATA-SPLIT: in the browser 繁體 converts with the phrases the site ships (i18n/traditional.ts) and loads opencc's full
 * phrase table only once text the site does not ship is shown: an API response with Chinese (lib/api.ts) or BayBay's panel
 * (tests/locale-feature-gate.test.tsx). BAYLINK_SITE_TRADITIONAL=1 makes Node take that path; idle slices run at once.
 */
process.env.BAYLINK_SITE_TRADITIONAL = '1';
const { noteDynamicChinese, setLocale, subscribeLocale, taiwanConverter, translateText } = await import('../src/i18n/locale');
const { siteTraditional, SITE_LOCALE, Trie } = await import('../src/i18n/traditional');
const { fullPhrases } = await import('../src/i18n/traditional-full');
const { api } = await import('../src/lib/api');

const full = taiwanConverter(OpenCC);
const pruned = taiwanConverter({ Trie, Locale: SITE_LOCALE } as unknown as Parameters<typeof taiwanConverter>[0]);
// A phrase the site does not ship that converts differently without the full table (like 头发: 頭髮, not 頭發).
const dynamic = fullPhrases.split('|').map(entry => entry.slice(0, entry.indexOf(' '))).find(key => pruned(key, true) !== full(key, true))!;
const siteText = ['湾区去哪、怎么办 · 有来源的中文答案', '先打 800-510-2020', '长辈与家属先看', '本周末免费活动'];
const turn = () => new Promise<void>(resolve => setImmediate(resolve));
const until = async (done: () => boolean, label: string) => {
  for (let at = 0; at < 2000 && !done(); at++) await new Promise(resolve => setTimeout(resolve, 5));
  assert.ok(done(), label);
};

test('the site converter asks for nothing by itself; upgrade() loads the full table once, in slices, and new text is exact at once', async () => {
  assert.ok(dynamic, 'some phrase needs the full table');
  let idles = 0;
  const idle = () => { idles++; return turn(); };
  const upgrades: boolean[] = [];
  const traditional = siteTraditional(taiwanConverter, (_full, changed) => { upgrades.push(changed); }, idle);
  for (const text of siteText) assert.equal(traditional.convert(text, true), full(text, true), text);
  await new Promise(resolve => setTimeout(resolve, 50));
  assert.equal(idles, 0, 'no download without dynamic text');
  traditional.upgrade();
  traditional.upgrade();
  await until(() => upgrades.length > 0, 'the upgrade finishes');
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.deepEqual(upgrades, [false], 'once; the site’s own text converts the same, so nothing re-renders');
  // the table is built in slices of 2,000 phrases, never in one long task
  assert.ok(idles > fullPhrases.split('|').length / 2000, `${idles} idle slices`);
  assert.equal(traditional.convert(dynamic, true), full(dynamic, true), 'text after the upgrade converts with the full table');
});

test('after the upgrade, text converted earlier is checked in slices of 250 and only a difference re-renders', async () => {
  const run = async (before: string[]) => {
    let idles = 0;
    let result: boolean | undefined;
    const traditional = siteTraditional(taiwanConverter, (_full, changed) => { result = changed; }, () => { idles++; return turn(); });
    for (const text of before) traditional.convert(text, true);
    traditional.upgrade();
    await until(() => result !== undefined, 'the upgrade finishes');
    return { changed: result, idles };
  };
  const many = Array.from({ length: 1000 }, (_, index) => `${siteText[index % siteText.length]} ${index}`);
  const quiet = await run([]);
  const checked = await run(many);
  assert.equal(checked.changed, false);
  assert.ok(checked.idles - quiet.idles >= 1000 / 250 - 1, `1,000 strings take ${checked.idles - quiet.idles} more idle slices`);
  assert.equal((await run([...siteText, dynamic])).changed, true, 'dynamic text shown with the site table is re-rendered');
});

test('a 繁體 page loads the full table only when an API response carries Chinese, then re-renders the text that changed', async t => {
  const responses: unknown[] = [{ ok: true, items: [{ id: 'a1', status: 'open' }] }, { ok: true, items: [{ id: 'p1', title: `${dynamic}的帖子` }] }];
  t.mock.method(globalThis, 'fetch', async () => Response.json(responses.shift()));
  assert.equal(await setLocale('zh-Hant', false, '/'), true);
  for (const text of siteText) assert.equal(translateText(text), full(text, true), text);
  const shown = translateText(dynamic);
  assert.notEqual(shown, full(dynamic, true), 'before the upgrade the site table converts it by character');
  let renders = 0;
  const stop = subscribeLocale(() => { renders++; });
  noteDynamicChinese('only Latin text: no upgrade');
  await api.request('/statuses');
  await new Promise(resolve => setTimeout(resolve, 100));
  assert.equal(translateText(dynamic), shown, 'a response without Chinese loads nothing');
  assert.equal(renders, 0);
  await api.request('/posts');
  await until(() => translateText(dynamic) === full(dynamic, true), 'the full table converts the post');
  assert.ok(renders >= 1, 'text shown before the upgrade changed, so the page re-renders');
  stop();
  await setLocale('zh-Hans', false);
});
