// W9-E · public/boot-check.js (review 2026-10-01 R§5 #2, suggestion 3): a classic ES5 script that index.html loads with
// `defer` before the site's module. It shows one plain notice + the guides link when the site's script cannot run (no ES
// modules; a SyntaxError — e.g. a regex look-behind on iOS < 16.4; the module failing to load) and does nothing once
// App.tsx has marked <html data-app="ready">. Run here in jsdom; the browser proof is in docs/opus-bay/sf-w9-E.md.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { JSDOM } from 'jsdom';

const SRC = fs.readFileSync('public/boot-check.js', 'utf8');

function page(opts: { noModule?: boolean; ready?: boolean; shell?: boolean } = {}) {
  const dom = new JSDOM(`<!doctype html><html><head></head><body>${opts.shell ? '<div id="opus-bay-shell"><p class="obs-wait"><span class="obs-wait-text">准备中…</span></p></div>' : '<div id="root"><h1>BAYLINK</h1></div>'}</body></html>`, { runScripts: 'outside-only', url: 'https://www.baylink.us/' });
  const w = dom.window;
  if (opts.ready) w.document.documentElement.setAttribute('data-app', 'ready');
  // an engine with ES modules has `noModule` on script elements; without (opts.noModule === false) it has not
  const proto = w.HTMLScriptElement.prototype as { noModule?: boolean };
  if (opts.noModule === false) delete proto.noModule;
  else if (!('noModule' in proto)) Object.defineProperty(proto, 'noModule', { value: false, configurable: true });
  w.eval(SRC);
  const notice = () => w.document.querySelector('.baylink-oldbrowser');
  const syntaxError = () => w.dispatchEvent(new w.ErrorEvent('error', { message: 'SyntaxError: Invalid regular expression: invalid group specifier name', error: new w.SyntaxError('Invalid regular expression: invalid group specifier name') }));
  return { w, notice, syntaxError };
}

test('W9-E boot-check: ES5 only (it must run where the site cannot), no inline-script needs (CSP script-src \'self\')', async () => {
  for (const [what, re] of [['arrow', /=>/], ['let / const', /\b(?:let|const)\s/], ['template literal', /`/], ['class', /\bclass\s+\w/], ['spread', /\.\.\./], ['for…of', /\bfor\s*\([^)]*\bof\b/]] as const) assert.doesNotMatch(SRC, re, what);
  try {
    const acorn = await import('acorn');
    acorn.parse(SRC, { ecmaVersion: 5 });
  } catch (e) {
    if ((e as { code?: string }).code !== 'ERR_MODULE_NOT_FOUND') throw e;
  }
  const html = fs.readFileSync('index.html', 'utf8');
  assert.ok(html.includes('<script defer src="/boot-check.js"></script>'));
  assert.ok(html.indexOf('/boot-check.js') < html.indexOf('type="module"'), 'before the module: deferred scripts run in document order');
  assert.ok(fs.readFileSync('src/App.tsx', 'utf8').includes(`document.documentElement.setAttribute('data-app', 'ready')`), 'the app tells it to stand down');
});

test('W9-E boot-check: silent on a working page; a SyntaxError before the app starts shows the notice with the guides link', () => {
  const ok = page();
  assert.equal(ok.notice(), null);
  const bad = page();
  bad.syntaxError();
  const n = bad.notice()!;
  assert.ok(n, 'shown');
  assert.equal(n.getAttribute('role'), 'alert');
  assert.match(n.textContent!, /浏览器版本较旧/);
  assert.match(n.textContent!, /too old/);
  assert.equal(n.querySelector('a')!.getAttribute('href'), '/guides');
  bad.syntaxError();
  assert.equal(bad.w.document.querySelectorAll('.baylink-oldbrowser').length, 1, 'once');
});

test('W9-E boot-check: on /opus-bay the shell\'s 准备中 line says what happened; the module failing to load is a load problem, not an old browser', () => {
  const p = page({ shell: true });
  const s = p.w.document.createElement('script');
  s.setAttribute('type', 'module');
  p.w.document.head.appendChild(s);
  s.dispatchEvent(new p.w.Event('error'));
  assert.ok(p.notice());
  assert.match(p.notice()!.textContent!, /没能加载完/);
  assert.doesNotMatch(p.notice()!.textContent!, /版本较旧/);
  assert.match(p.w.document.querySelector('.obs-wait-text')!.textContent!, /没能加载完/);
  const q = page({ shell: true });
  q.syntaxError();
  assert.match(q.w.document.querySelector('.obs-wait-text')!.textContent!, /打不开游戏/);
});

test('W9-E boot-check: after the app has started nothing shows; an early notice goes away when the app starts; no ES modules → shown at once', async () => {
  const ready = page({ ready: true });
  ready.syntaxError();
  assert.equal(ready.notice(), null);
  const early = page();
  early.syntaxError();
  assert.ok(early.notice());
  early.w.document.documentElement.setAttribute('data-app', 'ready');
  await new Promise(r => setTimeout(r, 0));
  assert.equal(early.notice(), null, 'taken away');
  const old = page({ noModule: false });
  assert.ok(old.notice(), 'no modules: shown without waiting for an error');
  // an unrelated runtime error is not a reason
  const other = page();
  other.w.dispatchEvent(new other.w.ErrorEvent('error', { message: 'TypeError: x is undefined', error: new other.w.TypeError('x is undefined') }));
  assert.equal(other.notice(), null);
});
