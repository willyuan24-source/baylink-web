// D5 / READ-05: public/reading-init.js applies the saved Aa size and 简洁显示 before the first paint. It is a classic ES5
// script that index.html loads synchronously in <head>, ahead of every stylesheet and the module (CSP: no inline script).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { READING_SIZE_KEY, SIMPLE_DISPLAY_KEY } from '../src/lib/reading-preferences';

const SRC = fs.readFileSync('public/reading-init.js', 'utf8');

function run(url: string, saved: Record<string, string> = {}, { blockStorage = false } = {}) {
  const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { runScripts: 'outside-only', url });
  for (const [key, value] of Object.entries(saved)) dom.window.localStorage.setItem(key, value);
  if (blockStorage) Object.defineProperty(dom.window, 'localStorage', { configurable: true, get() { throw new Error('SecurityError'); } });
  dom.window.eval(SRC);
  const root = dom.window.document.documentElement;
  return { reading: root.getAttribute('data-reading'), simple: root.hasAttribute('data-simple') };
}

test('a family link opens at 特大 in 简洁显示 before anything paints', () => {
  assert.deepEqual(run('https://www.baylink.us/guides/bay-area-chinese-senior-services-referral-guide?reading=extra-large&simple=1'), { reading: 'extra-large', simple: true });
  assert.deepEqual(run('https://www.baylink.us/zh-Hant/?simple=1&reading=large#top'), { reading: 'large', simple: true });
});

test('the saved choice applies on every later visit, and a link can switch 简洁显示 off', () => {
  assert.deepEqual(run('https://www.baylink.us/', { [READING_SIZE_KEY]: 'extra-large', [SIMPLE_DISPLAY_KEY]: '1' }), { reading: 'extra-large', simple: true });
  assert.deepEqual(run('https://www.baylink.us/events/x?simple=0', { [READING_SIZE_KEY]: 'large', [SIMPLE_DISPLAY_KEY]: '1' }), { reading: 'large', simple: false });
  assert.deepEqual(run('https://www.baylink.us/', { [READING_SIZE_KEY]: 'standard', [SIMPLE_DISPLAY_KEY]: '0' }), { reading: null, simple: false });
});

test('unknown values and blocked storage leave the standard page; a shared link still works without storage', () => {
  assert.deepEqual(run('https://www.baylink.us/?reading=huge&simple=yes', { [READING_SIZE_KEY]: 'giant' }), { reading: null, simple: false });
  assert.deepEqual(run('https://www.baylink.us/?xreading=large'), { reading: null, simple: false });
  assert.deepEqual(run('https://www.baylink.us/?reading=extra-large&simple=1', {}, { blockStorage: true }), { reading: 'extra-large', simple: true });
  assert.deepEqual(run('https://www.baylink.us/', {}, { blockStorage: true }), { reading: null, simple: false });
});

test('the 3D world keeps its own HUD sizes: /opus-bay and /play are never scaled', () => {
  for (const path of ['/opus-bay', '/opus-bay/', '/opus-bay.html', '/en/opus-bay', '/zh-Hant/opus-bay?from=nav', '/play', '/en/play']) {
    assert.deepEqual(run(`https://www.baylink.us${path}${path.includes('?') ? '&' : '?'}reading=extra-large&simple=1`, { [READING_SIZE_KEY]: 'extra-large' }), { reading: null, simple: false }, path);
  }
  assert.deepEqual(run('https://www.baylink.us/playground?reading=large'), { reading: 'large', simple: false }, 'only the game paths are skipped');
});

test('reading-init is ES5, tiny, and loads synchronously in <head> before every stylesheet and the app module', async () => {
  for (const [what, pattern] of [['arrow', /=>/], ['let / const', /\b(?:let|const)\s/], ['template literal', /`/], ['class', /\bclass\s+\w/], ['spread', /\.\.\./]] as const) assert.doesNotMatch(SRC, pattern, what);
  const acorn = await import('acorn').catch(() => null);
  if (acorn) acorn.parse(SRC, { ecmaVersion: 5 });
  const code = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ');
  assert.ok(code.length < 900, `reading-init stays small on the critical path (${code.length} chars without comments)`);
  const html = fs.readFileSync('index.html', 'utf8');
  const head = html.slice(0, html.indexOf('</head>'));
  const tag = '<script src="/reading-init.js"></script>';
  assert.ok(head.includes(tag), 'a plain blocking script: no defer, async or module, so it runs before the first paint');
  for (const later of ['rel="stylesheet"', 'type="module"', '/boot-check.js', '<!--baylink-meta-start-->']) {
    const at = html.indexOf(later);
    if (at >= 0) assert.ok(html.indexOf(tag) < at, `reading-init comes before ${later}`);
  }
  for (const key of [READING_SIZE_KEY, SIMPLE_DISPLAY_KEY]) assert.ok(SRC.includes(`'${key}'`), `reading-init reads ${key}, the key the app saves`);
});
