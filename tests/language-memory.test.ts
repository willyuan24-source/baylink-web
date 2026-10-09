// D17 / RC-11(ii): a saved 繁體 / English choice is honoured on neutral URLs before the first paint (public/reading-init.js
// replaces the URL with the language's own one while the page is hidden), so 简体 never flashes. Explicit URLs still win:
// a language prefix or ?lang=. A ?lang= link that the edge 301s to the prefixed URL (query kept) is remembered again.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test, { afterEach } from 'node:test';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';

const SRC = fs.readFileSync('public/reading-init.js', 'utf8');
const LANGUAGE_KEY = 'baylink.reading-language.v1';

type Run = { replaced: string | null; hidden: boolean; reading: string | null };
function run(url: string, saved: Record<string, string> = {}, { blockStorage = false, replaceThrows = false } = {}): Run {
  const { pathname, search, hash } = new URL(url);
  const attributes = new Map<string, string>();
  const style: Record<string, string> = {};
  let replaced: string | null = null;
  const window = {
    location: { pathname, search, hash, replace(target: string) { if (replaceThrows) throw new Error('blocked'); replaced = target; } },
    get localStorage() { if (blockStorage) throw new Error('SecurityError'); return { getItem: (key: string) => saved[key] ?? null }; },
  };
  const document = { documentElement: { style, setAttribute: (name: string, value: string) => attributes.set(name, value) } };
  vm.runInNewContext(SRC, { window, document });
  return { replaced, hidden: style.visibility === 'hidden', reading: attributes.get('data-reading') ?? null };
}

test('a saved 繁體 or English choice opens a neutral URL in that language before anything paints, query and hash kept', () => {
  assert.deepEqual(run('https://www.baylink.us/', { [LANGUAGE_KEY]: 'zh-Hant' }), { replaced: '/zh-Hant/', hidden: true, reading: null });
  assert.deepEqual(run('https://www.baylink.us/guides?q=park#reading', { [LANGUAGE_KEY]: 'en' }), { replaced: '/en/guides?q=park#reading', hidden: true, reading: null });
  assert.equal(run('https://www.baylink.us/events?region=sf&from=card-sf', { [LANGUAGE_KEY]: 'zh-Hant' }).replaced, '/zh-Hant/events?region=sf&from=card-sf');
  assert.equal(run('https://www.baylink.us/posts/123', { [LANGUAGE_KEY]: 'en' }).replaced, '/en/posts/123');
});

test('explicit URLs win: a language prefix or ?lang= is never redirected, and 简体 or nothing saved changes nothing', () => {
  for (const [url, saved] of [
    ['https://www.baylink.us/zh-Hant/guides', 'zh-Hant'], ['https://www.baylink.us/en/guides', 'zh-Hant'], ['https://www.baylink.us/zh-Hant', 'en'],
    ['https://www.baylink.us/?lang=zh-Hans', 'zh-Hant'], ['https://www.baylink.us/guides?q=x&lang=en', 'zh-Hant'],
    ['https://www.baylink.us/guides', 'zh-Hans'], ['https://www.baylink.us/guides', 'fr'], ['https://www.baylink.us/guides', ''],
  ] as const) assert.deepEqual(run(url, { [LANGUAGE_KEY]: saved }), { replaced: null, hidden: false, reading: null }, `${url} with ${saved}`);
  assert.deepEqual(run('https://www.baylink.us/guides'), { replaced: null, hidden: false, reading: null });
});

test('never the 3D world, the email token pages or files; blocked storage or a refused replace leaves the page as it is', () => {
  for (const path of ['/opus-bay?from=nav', '/play', '/verify-email?token=t', '/notifications/unsubscribe?token=t', '/index.html', '/404.html']) {
    assert.equal(run(`https://www.baylink.us${path}`, { [LANGUAGE_KEY]: 'en' }).replaced, null, path);
  }
  assert.deepEqual(run('https://www.baylink.us/guides?reading=large', { [LANGUAGE_KEY]: 'en' }, { blockStorage: true }), { replaced: null, hidden: false, reading: 'large' });
  assert.deepEqual(run('https://www.baylink.us/guides?reading=large', { [LANGUAGE_KEY]: 'en' }, { replaceThrows: true }), { replaced: null, hidden: false, reading: 'large' }, 'the reading size still applies');
});

test('the reading size still applies on the language\'s own URL after the redirect', () => {
  assert.deepEqual(run('https://www.baylink.us/zh-Hant/?reading=extra-large', { [LANGUAGE_KEY]: 'zh-Hant' }), { replaced: null, hidden: false, reading: 'extra-large' });
});

// The app side: what initializeLocale saves.
const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'https://www.baylink.us/' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage });
const { initializeLocale, getLocale, setLocale, LOCALE_KEY } = await import('../src/i18n/locale');
afterEach(async () => { await setLocale('zh-Hans', false); localStorage.clear(); dom.window.history.replaceState(null, '', '/'); });

test('the app saves the key reading-init reads', () => assert.equal(LOCALE_KEY, LANGUAGE_KEY));

test('a ?lang= link that arrives on its language\'s own URL (the edge 301 keeps the query) is remembered; a mismatch is a one-off', async () => {
  dom.window.history.replaceState(null, '', '/en/guides?lang=en');
  await initializeLocale();
  assert.equal(getLocale(), 'en');
  assert.equal(localStorage.getItem(LOCALE_KEY), 'en');
  localStorage.clear();
  dom.window.history.replaceState(null, '', '/zh-Hant?lang=zh-Hant');
  await initializeLocale();
  assert.equal(localStorage.getItem(LOCALE_KEY), 'zh-Hant');
  localStorage.clear();
  dom.window.history.replaceState(null, '', '/en/guides?lang=zh-Hant');
  await initializeLocale();
  assert.equal(getLocale(), 'en', 'the prefix wins');
  assert.equal(localStorage.getItem(LOCALE_KEY), null, 'and the mismatched ?lang= is not saved');
  dom.window.history.replaceState(null, '', '/en/guides');
  await initializeLocale();
  assert.equal(localStorage.getItem(LOCALE_KEY), null, 'opening a shared /en link does not change a reader\'s saved language');
});

test('zh-Hant chosen once is remembered on / at the next visit', async () => {
  dom.window.history.replaceState(null, '', '/guides');
  await setLocale('zh-Hant'); // the language switcher saves the choice
  assert.equal(run('https://www.baylink.us/', { [LANGUAGE_KEY]: localStorage.getItem(LOCALE_KEY)! }).replaced, '/zh-Hant/');
});

test('the host serves reading-init.js with a short cache that revalidates (it is not content-hashed)', () => {
  const { routes } = JSON.parse(fs.readFileSync('vercel.json', 'utf8')) as { routes: { src?: string; handle?: string; continue?: boolean; headers?: Record<string, string> }[] };
  const at = routes.findIndex(route => route.src === '^/reading-init\\.js$');
  assert.ok(at > 0, 'a header route for /reading-init.js');
  assert.ok(at < routes.findIndex(route => route.handle === 'filesystem'), 'before the filesystem handle, so it applies to the file');
  assert.equal(routes[at].continue, true);
  assert.match(routes[at].headers!['Cache-Control'], /^public, max-age=(\d{1,3}), must-revalidate$/);
  assert.ok(Number(/max-age=(\d+)/.exec(routes[at].headers!['Cache-Control'])![1]) <= 900, 'minutes, not days');
});
