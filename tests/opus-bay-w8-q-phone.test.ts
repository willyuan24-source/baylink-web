import assert from 'node:assert/strict';
import fs from 'node:fs';
import { registerHooks } from 'node:module';
import test, { after, afterEach } from 'node:test';
import { JSDOM } from 'jsdom';

/**
 * W8-Q · phone UI. (W8-Q5) An underground Muni Metro ride shows the subway layer (ui/SubwayOverlay.tsx, z 40, the whole
 * screen) over the HUD: its Settings button and the phone bar's 更多 → 设置 were covered, and a phone has no Esc — so the
 * layer's card carries its own 设置; the album, a resident's letter and the goals step (lazy overlays at z 34–36)
 * opened during the ride went under the tunnel.
 */

const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'http://localhost/opus-bay?world=city', pretendToBeVisual: true });
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node,
  KeyboardEvent: dom.window.KeyboardEvent, Image: dom.window.Image, localStorage: dom.window.localStorage, performance: globalThis.performance, IS_REACT_ACT_ENVIRONMENT: true,
  requestAnimationFrame: (cb: (t: number) => void) => setTimeout(() => cb(performance.now()), 0), cancelAnimationFrame: (id: number) => clearTimeout(id),
});
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
Object.defineProperty(dom.window, 'matchMedia', { value: (query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }) });
registerHooks({ load(url, context, next) { return url.endsWith('.css') ? { format: 'module', shortCircuit: true, source: 'export {}' } : next(url, context); } });

const L = await import('../src/i18n/locale');
const { createElement: h } = await import('react');
const { render, cleanup, act } = await import('@testing-library/react');
const read = (p: string) => fs.readFileSync(new URL(`../src/opus-bay/${p}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
afterEach(() => { cleanup(); });
after(async () => { await L.setLocale('zh-Hans', false); dom.window.close(); });

test('W8-Q5: the subway layer\'s card has a 44 px 设置 button when the ride gives it one (and none without)', async () => {
  const { SubwayOverlay } = await import('../src/opus-bay/ui/SubwayOverlay');
  const base = {
    visible: true, line: { short: 'M', name: { zh: 'M 线', en: 'M Ocean View' }, color: '#2f8f63' }, destination: { zh: '卡斯特罗站', en: 'Castro' },
    tunnel: { fromAt: 0, toAt: 100 }, stations: [{ id: 'a', name: { zh: '内河码头站', en: 'Embarcadero' }, at: 10 }, { id: 'b', name: { zh: '卡斯特罗站', en: 'Castro' }, at: 90 }],
    at: 10, dir: 1 as const, moving: false, stopped: 'a', next: null,
  };
  let opened = 0;
  const c = render(h(SubwayOverlay, { ...base, onSettings: () => { opened++; } })).container;
  const gear = c.querySelector<HTMLButtonElement>('.ob-subway-card .ob-subway-line .ob-subway-settings');
  assert.ok(gear, 'the 设置 button on the card\'s line row');
  assert.equal(gear!.getAttribute('aria-label'), '设置');
  await act(async () => { gear!.click(); });
  assert.equal(opened, 1);
  cleanup();
  const none = render(h(SubwayOverlay, base)).container;
  assert.equal(none.querySelector('.ob-subway-settings'), null);
  cleanup();
  await act(async () => { await L.setLocale('en', false); });
  const en = render(h(SubwayOverlay, { ...base, onSettings: () => undefined })).container;
  assert.equal(en.querySelector('.ob-subway-settings')!.getAttribute('aria-label'), 'Settings');
  await act(async () => { await L.setLocale('zh-Hans', false); });
});

test('W8-Q5: the ride layer wires 设置 to the Settings panel; the CSS: a 44 × 44 button, and the album / letter / goals step above the tunnel', () => {
  const layer = read('ui/LineRideLayer.tsx');
  assert.match(layer, /const openSettings = \(\) => openPanel\('settings'\);/);
  assert.match(layer, /<SubwayOverlay [^>]*onSettings=\{openSettings\}/);
  const css = read('ui/transit-ui.css');
  const tunnel = Number(/\.ob-subway \{[^}]*z-index: (\d+)/.exec(css)![1]);
  const lifted = /\.ob-overlay:has\(\.ob-subway\.is-on\) :is\(([^)]*)\) \{ z-index: (\d+); \}/.exec(css);
  assert.ok(lifted, 'the :has rule for the lazy overlays');
  assert.deepEqual(lifted![1].split(',').map(s => s.trim()).sort(), ['.ob-album-wrap', '.ob-gstep-wrap', '.ob-letter-wrap']);
  assert.ok(Number(lifted![2]) > tunnel, `${lifted![2]} > ${tunnel}`);
  // each overlay's own rule is lower than the tunnel (why the lift is needed) and less specific than the lift
  for (const [file, cls] of [['ui/album.css', 'ob-album-wrap'], ['ui/letter.css', 'ob-letter-wrap'], ['ui/goals-step.css', 'ob-gstep-wrap']]) {
    const own = new RegExp(String.raw`\.ob-overlay \.${cls} \{[^}]*z-index: (\d+)`).exec(read(file));
    assert.ok(own && Number(own[1]) < tunnel, `${cls} sits under the tunnel on its own (${own?.[1]})`);
  }
  const btn = /\.ob-subway-settings \{([^}]*)\}/.exec(css)![1];
  assert.match(btn, /width: 44px; height: 44px;/);
});
