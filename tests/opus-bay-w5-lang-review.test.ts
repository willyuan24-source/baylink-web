import assert from 'node:assert/strict';
import fs from 'node:fs';
import { registerHooks } from 'node:module';
import path from 'node:path';
import test, { after, afterEach } from 'node:test';
import { JSDOM } from 'jsdom';

/**
 * lang-review (the adversarial review of the W5 language switch, 2026-09-28). Two defects found by playing it:
 *   1. the city map's canvas drew the station discs' 观光 / 叮当 in Simplified for a 繁體 reader (canvas text never passes
 *      the site's conversion layer) and a 简体 ↔ 繁體 switch did not redraw them (the marks' key only knows zh from en);
 *   2. the desktop title centres its card: a switch to English (a two-line title, one more line of subtitle and greeting)
 *      moved the pills just clicked ≈ 60 px from under the pointer. They now stay where they were clicked.
 */

const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'http://localhost/opus-bay?world=city', pretendToBeVisual: true });
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node,
  KeyboardEvent: dom.window.KeyboardEvent, Image: dom.window.Image, localStorage: dom.window.localStorage, performance: globalThis.performance, IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
Object.defineProperty(dom.window, 'matchMedia', { value: (query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }) });
registerHooks({ load(url, context, next) { return url.endsWith('.css') ? { format: 'module', shortCircuit: true, source: 'export {}' } : next(url, context); } });

const L = await import('../src/i18n/locale');
const { pick } = await import('../src/opus-bay/i18n');
const { createElement: h } = await import('react');
const { render, cleanup, act, fireEvent, waitFor } = await import('@testing-library/react');
afterEach(() => { cleanup(); });
after(() => { dom.window.close(); });

/** a canvas recorder: the text each fillText drew */
function textCtx() {
  const texts: string[] = [];
  const ctx = {
    fillStyle: '', strokeStyle: '', lineWidth: 1, lineJoin: 'round', lineCap: 'round', globalAlpha: 1, font: '', textAlign: 'start', textBaseline: 'alphabetic',
    save() {}, restore() {}, beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, setLineDash() {}, fillRect() {}, arc() {}, fill() {}, stroke() {},
    fillText(text: string) { texts.push(text); },
  };
  return { ctx, texts };
}

test('lang-review: the map canvas draws the station discs in the reader\'s script — 繁體 gets 觀光 · 叮噹, English Tour · Cable', async () => {
  const { stationSymbol, drawStationMarks } = await import('../src/opus-bay/ui/mapLines');
  const { drawMapExtras } = await import('../src/opus-bay/ui/cityMapModel');
  type Ctx = import('../src/opus-bay/ui/mapLines').StationCtx;
  // a transfer at the Ferry Building: the tour loop, a cable car and the N (a pill of three discs)
  const st = { lines: ['sf-loop', 'powell-hyde', 'n-judah'], underground: false, major: true };
  const zh = stationSymbol(st, 0.7, { locale: 'zh' })!, en = stationSymbol(st, 0.7, { locale: 'en' })!;
  assert.equal(zh.kind, 'pill');
  try {
    // as before without `words` (the authored Simplified): what a 简体 reader sees
    let r = textCtx();
    drawStationMarks(r.ctx as unknown as Ctx, [{ sym: zh, x: 100, y: 50 }]);
    assert.deepEqual(r.texts, ['观光', '叮当', 'N']);
    // 繁體: the site's conversion layer, through the words the map hands in (its t)
    await L.setLocale('zh-Hant', false);
    r = textCtx();
    drawStationMarks(r.ctx as unknown as Ctx, [{ sym: zh, x: 100, y: 50 }], { words: text => pick(text, L.getLocale()) });
    assert.deepEqual(r.texts, ['觀光', '叮噹', 'N']);
    // the map's canvas pass hands them on
    r = textCtx();
    drawMapExtras(r.ctx as unknown as Ctx, { cx: 0, cz: 0, scale: 1, w: 400, h: 400 }, { stations: [{ st: null as never, sym: zh, x: 100, y: 50 }], words: text => pick(text, L.getLocale()) });
    assert.deepEqual(r.texts, ['觀光', '叮噹', 'N']);
    // English: the symbol's English words, untouched
    await L.setLocale('en', false);
    r = textCtx();
    drawStationMarks(r.ctx as unknown as Ctx, [{ sym: en, x: 100, y: 50 }], { words: text => pick(text, L.getLocale()) });
    assert.deepEqual(r.texts, ['Tour', 'Cable', 'N']);
  } finally {
    await L.setLocale('zh-Hans', false);
  }
});

test('lang-review: ui/CityMap hands its t to the canvas pass and redraws when t changes (a 简体 ↔ 繁體 switch keeps the marks\' key)', () => {
  const src = fs.readFileSync(path.resolve('src/opus-bay/ui/CityMap.tsx'), 'utf8');
  const effect = /useEffect\(\(\) => \{\s*const cv = canvasRef\.current;[\s\S]*?\n {2}\}, \[([^\]]*)\]\);/.exec(src);
  assert.ok(effect, 'the canvas effect');
  assert.match(effect[0], /drawMapExtras\([^;]*words: text => t\(text\)/, 'the discs\' words in the reader\'s script');
  assert.ok(effect[1].split(',').map(s => s.trim()).includes('t'), `t among the canvas effect's deps (${effect[1]})`);
});

test('lang-review: the title keeps the pills where they were clicked — the card moves by the difference, within the title, and settles on a resize', async () => {
  const { game, initialGameState } = await import('../src/opus-bay/core/store');
  const { TitleScreen } = await import('../src/opus-bay/ui/TitleScreen');
  // JSDOM lays nothing out: a desktop's centred card, as measured at 1440 × 900 (zh: card at 159, pills 310 into it;
  // English: the card 118 px taller, centred 59 px higher, pills 428 into it)
  let cardBase = 159;
  const proto = dom.window.HTMLElement.prototype;
  const saved = (['offsetTop', 'offsetHeight', 'offsetParent'] as const).map(k => [k, Object.getOwnPropertyDescriptor(proto, k)] as const);
  const en = () => dom.window.document.documentElement.lang === 'en';
  Object.defineProperty(proto, 'offsetTop', { configurable: true, get(this: HTMLElement) {
    if (this.classList.contains('ob-title-card')) return (en() ? cardBase - 59 : cardBase) + (parseFloat(this.style.top) || 0);
    if (this.classList.contains('ob-lang')) return en() ? 428 : 310;
    return 0;
  } });
  Object.defineProperty(proto, 'offsetHeight', { configurable: true, get(this: HTMLElement) { return this.classList.contains('ob-title-card') ? (en() ? 673 : 555) : 0; } });
  Object.defineProperty(proto, 'offsetParent', { configurable: true, get(this: HTMLElement) { return this.classList.contains('ob-title-card') ? this.parentElement : null; } });
  Object.defineProperty(proto, 'clientHeight', { configurable: true, get(this: HTMLElement) { return this.classList.contains('ob-title') ? 900 : 0; } });
  try {
    await act(async () => { await L.setLocale('zh-Hans', false); game.set({ ...initialGameState(), phase: 'title', worldMode: 'city' }); });
    const c = render(h(TitleScreen, { onStart: () => undefined })).container;
    const card = c.querySelector<HTMLElement>('.ob-title-card')!;
    const pillsAt = () => card.offsetTop + c.querySelector<HTMLElement>('.ob-lang')!.offsetTop;
    const pill = (lang: string) => c.querySelector<HTMLElement>(`[role="radio"][lang="${lang}"]`)!;
    assert.equal(pillsAt(), 469);
    assert.equal(card.style.top, '', 'no offset before a switch');
    // English: the layout would put the pills at 528; the card moves up 59 px and they stay at 469
    fireEvent.click(pill('en'));
    await waitFor(() => assert.equal(c.querySelector('.ob-title-h1')!.textContent, 'Little Bay Trip'));
    assert.equal(card.style.top, '-59px');
    assert.equal(pillsAt(), 469, 'the pills under the pointer');
    // back to 简体 (and 繁體, the same length): the card returns to where the layout puts it
    fireEvent.click(pill('zh-Hans'));
    await waitFor(() => assert.equal(c.querySelector('.ob-title-h1')!.textContent, '湾区小旅'));
    assert.equal(parseFloat(card.style.top), 0);
    assert.equal(pillsAt(), 469);
    // a short title: the card never leaves it — the move stops at the top edge (here 30 px of room)
    act(() => { dom.window.dispatchEvent(new dom.window.Event('resize')); });
    assert.equal(card.style.top, '', 'a resize lets the card settle');
    cardBase = 89;
    fireEvent.click(pill('en'));
    await waitFor(() => assert.equal(c.querySelector('.ob-title-h1')!.textContent, 'Little Bay Trip'));
    assert.equal(card.style.top, '-30px', 'clamped to the title\'s top edge');
    assert.equal(card.offsetTop, 0);
    // a switch that did not come from the pills (another tab of the site, say) moves nothing
    await act(async () => { await L.setLocale('zh-Hans', false); });
    assert.equal(card.style.top, '-30px');
  } finally {
    for (const [k, d] of saved) { if (d) Object.defineProperty(proto, k, d); else delete (proto as unknown as Record<string, unknown>)[k]; }
    delete (proto as unknown as Record<string, unknown>).clientHeight;
    await act(async () => { await L.setLocale('zh-Hans', false); game.set({ ...initialGameState() }); });
  }
});
