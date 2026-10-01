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

test('W8-Q6: on a coarse pointer the map\'s tools and compass are 44 px circles and the column the labels keep off fits them; the waypoint × gets a 44 px touch area', () => {
  const css = read('ui/map-w4.css');
  const coarse = css.slice(css.indexOf('W8-Q6'));
  const block = /@media \(pointer: coarse\) \{([\s\S]*?)\n\}/.exec(coarse)![1];
  assert.match(block, /\.ob-overlay \.ob-citymap-tools \.ob-icon-btn, \.ob-overlay \.mw-compass \{ width: 44px; height: 44px; \}/);
  assert.match(block, /::before, \.ob-overlay \.mw-compass::before \{ inset: 0; \}/);
  // the desktop rules stay 36 px (fine pointers: unchanged)
  assert.match(read('ui/city-ui.css'), /\.ob-citymap-tools \.ob-icon-btn \{ position: relative; width: 36px; height: 36px;/);
  // CityMap.tsx: one column from TALL_TOOLS_H_TOUCH (6 buttons + 5 gaps + the 30 px credit fit), 56 / 106 px reserved
  const gap = Number(/\.ob-citymap-tools \{[^}]*gap: (\d+)px/.exec(read('ui/city-ui.css'))![1]);
  const map = read('ui/CityMap.tsx');
  const tall = Number(/const TALL_TOOLS_H_TOUCH = (\d+);/.exec(map)![1]);
  assert.ok(6 * 44 + 5 * gap + 30 <= tall, `one column of six fits from ${tall} px`);
  const right = /const toolRight = tallTools \? \(coarse \? (\d+) : 48\) : \(coarse \? (\d+) : 90\);/.exec(map);
  assert.ok(right, 'toolRight for a coarse pointer');
  const [one, two2] = [Number(right![1]), Number(right![2])];
  assert.ok(8 + 44 + 4 <= one, `one column: ${one}`);
  assert.ok(8 + 44 + gap + 44 + 2 <= two2, `two columns: ${two2}`);
  // is-two: three rows of 44 fit its max-height
  const two = Number(/\.ob-citymap-tools\.is-two \{ max-height: (\d+)px; \}/.exec(css)![1]);
  assert.ok(3 * 44 + 2 * gap <= two, `${3 * 44 + 2 * gap} <= ${two}`);
  // the waypoint's × : wave 7's 44 × 44 touch area (verify-phone m2: 24 + 4 + 16 wide, 24 + 10 + 10 tall) on every pointer;
  // W8-Q-review (Q-RC-2) removed W8-Q6's smaller coarse-pointer circle (tests/opus-bay-w8-q-review.test.ts)
  const guide = read('ui/guide-ui.css');
  assert.match(read('opus-bay.css'), /\.ob-waypoint-dismiss \{[^}]*width: 24px; height: 24px;/);
  assert.match(read('opus-bay.css'), /\.ob-waypoint-dismiss::before \{ content: ''; position: absolute; inset: -10px -4px -10px -16px; border-radius: 12px; \}/);
  assert.doesNotMatch(guide, /\.ob-waypoint-dismiss::before/);
});

test('W8-Q8: the goals step in short landscape (≤ 460 px tall, ≥ 560 px wide) is two columns: the list scrolls above the buttons, the note goes', () => {
  const css = read('ui/goals-step.css');
  const at = css.indexOf('W8-Q8');
  assert.ok(at > 0, 'the W8-Q8 block');
  const block = /@media \(max-height: 460px\) and \(min-width: 560px\) \{([\s\S]*?)\n\}/.exec(css.slice(at))![1];
  assert.match(block, /\.ob-gstep \{[^}]*display: grid; grid-template-columns: minmax\(0, 1fr\) minmax\(0, 1fr\); grid-template-rows: auto minmax\(0, 1fr\) auto;/);
  assert.match(block, /\.ob-gstep > \.ob-gstep-list \{ grid-column: 2; grid-row: 1 \/ 3;[^}]*min-height: 0; overflow-y: auto;/);
  assert.match(block, /\.ob-gstep-actions \{ grid-column: 2; grid-row: 3;/);
  assert.match(block, /\.ob-gstep-hero \{ grid-column: 1; grid-row: 2 \/ 4;/);
  assert.match(block, /\.ob-gstep-note \{ display: none; \}/);
  // it comes after the W7-I max-height rule (same specificity for the list: later wins) and keeps its card height cap
  assert.ok(css.indexOf('@media (max-height: 700px)') < at);
  assert.match(css, /@media \(max-height: 700px\) \{\n {2}\.ob-gstep \{ max-height: calc\(100vh - 32px/);
});

test('W8-Q9: while the skyline quiz shows its three names, the right-hand touch column steps aside (the names covered it on a phone)', () => {
  const css = read('opus-bay.css');
  // (W8-Q11) and the arrival card (a quiz started within its 6 s at a lookout showed it between the names)
  assert.match(css.slice(css.indexOf('W8-Q9')), /\.ob-overlay:has\(\.ob-play-sky\) :is\(\.ob-move-buttons, \.ob-touch-action, \.ob-arrival-card\) \{ visibility: hidden; \}/);
  // the card and the column it covers are what this rule names
  const sky = fs.readFileSync(new URL('../src/opus-bay/play/skyline.ts', import.meta.url), 'utf8');
  assert.match(sky, /className: 'ob-play-sky'/);
  assert.match(sky, /cancelOnMove: true/, 'a hop or a step ends the quiz: nothing is lost by hiding the column');
  const touch = fs.readFileSync(new URL('../src/opus-bay/actors/TouchControls.tsx', import.meta.url), 'utf8');
  assert.match(touch, /className="ob-move-buttons"/);
});

test('W8-Q12: between 601 and 1080 px wide the play chip drops under the top pills; in short landscape the skyline names sit low enough to clear it', () => {
  const css = read('opus-bay.css');
  const at = css.indexOf('W8-Q12');
  assert.ok(at > 0);
  const block = css.slice(at);
  const chipTop = Number(/@media \(min-width: 601px\) and \(max-width: 1080px\) \{\n {2}\.ob-overlay \.ob-play-flight \{ top: calc\((\d+)px \+ var\(--ob-st\)\); \}/.exec(block)![1]);
  // the pills: the HUD's top row is 12–16 px from the top and ≤ 48 px tall (W7-G1 / Hud.tsx); the chip starts under them
  assert.ok(chipTop >= 60, `chip top ${chipTop}`);
  // the play chip's own rule is less specific (one class) and puts it at 16 px over 600 px
  assert.match(read('play/play.css'), /\.ob-play-flight \{\n {2}position: absolute; left: 50%; top: calc\(16px \+ var\(--ob-st\)\);/);
  const names = Number(/@media \(max-height: 460px\) and \(min-width: 560px\) \{\n {2}\.ob-overlay \.ob-play-sky \{ bottom: calc\((\d+)px \+ env\(safe-area-inset-bottom, 0px\)\) !important; \}/.exec(block)![1]);
  // 320 px tall (667 × 320): three names of 48 + 2 gaps of 8 = 160 px from `names` over the bottom; the chip ends ≈ chipTop + 52
  assert.ok(320 - names - 160 >= chipTop + 52, `names top ${320 - names - 160} vs chip bottom ${chipTop + 52}`);
});
