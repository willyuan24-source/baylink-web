import assert from 'node:assert/strict';
import fs from 'node:fs';
import { registerHooks } from 'node:module';
import test, { after, afterEach } from 'node:test';
import { JSDOM } from 'jsdom';

/**
 * W8-Q3 · English never shows Chinese on a BAYLINK card. The catalog (`/planner-catalog.json`) is Simplified Chinese;
 * the site runtime translates a text node through its editorial dictionary, and a joined line part by part (" · ") —
 * so a catalog field that is itself "中文（…） · English" translates alone but leaks once joined into a longer line
 * (the event card's Where row: venue · city · region). Every San Francisco event card and every catalog place card the
 * game can open is rendered here in English; no Han may remain in its text or its labels.
 */

const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'http://localhost/opus-bay?world=city', pretendToBeVisual: true });
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node,
  KeyboardEvent: dom.window.KeyboardEvent, Image: dom.window.Image, localStorage: dom.window.localStorage, performance: globalThis.performance, IS_REACT_ACT_ENVIRONMENT: true,
  requestAnimationFrame: (cb: (t: number) => void) => setTimeout(() => cb(performance.now()), 0), cancelAnimationFrame: (id: number) => clearTimeout(id),
});
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
dom.window.HTMLElement.prototype.scrollIntoView = function scrollIntoView() { /* JSDOM has none */ };
Object.defineProperty(dom.window, 'matchMedia', { value: (query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }) });
registerHooks({ load(url, context, next) { return url.endsWith('.css') ? { format: 'module', shortCircuit: true, source: 'export {}' } : next(url, context); } });

const L = await import('../src/i18n/locale');
const { createElement: h } = await import('react');
const { render, cleanup, act } = await import('@testing-library/react');
const { __setBayNowForTests } = await import('../src/opus-bay/game/bayNow');
const { sanitizeCatalog, setCatalogForTests } = await import('../src/opus-bay/data/catalog');
const { game, initialGameState } = await import('../src/opus-bay/core/store');
const REAL = sanitizeCatalog(JSON.parse(fs.readFileSync(new URL('../public/planner-catalog.json', import.meta.url), 'utf8')))!;
const HAN = /\p{Script=Han}/u;
const leaksOf = (root: Element): string[] => {
  const out: string[] = [];
  const walk = root.ownerDocument.createTreeWalker(root, 4 /* SHOW_TEXT */);
  for (let n = walk.nextNode(); n; n = walk.nextNode()) if (HAN.test(n.nodeValue ?? '')) out.push((n.nodeValue ?? '').trim());
  for (const el of root.querySelectorAll('[aria-label],[title],[alt],[placeholder]')) for (const a of ['aria-label', 'title', 'alt', 'placeholder']) { const v = el.getAttribute(a); if (v && HAN.test(v)) out.push(`${a}=${v}`); }
  return out;
};
afterEach(() => { cleanup(); });
after(async () => { __setBayNowForTests(null); setCatalogForTests(null); await L.setLocale('zh-Hans', false); dom.window.close(); });

test('W8-Q3: every San Francisco event card in English carries no Chinese (the Where row joins the venue after translating it)', async () => {
  __setBayNowForTests('2026-09-30T10:00');
  setCatalogForTests(REAL);
  const { default: EventCardBody } = await import('../src/opus-bay/ui/EventCardBody');
  const bad: string[] = [];
  try {
    await act(async () => { await L.setLocale('en', false); game.set({ ...initialGameState(), phase: 'playing', worldMode: 'city' }); });
    const sf = REAL.events.filter(e => e.region === 'sf');
    assert.ok(sf.length > 20, `SF events: ${sf.length}`);
    for (const e of sf) {
      const c = render(h(EventCardBody, { id: e.id })).container;
      for (const leak of leaksOf(c)) bad.push(`${e.id}: ${leak}`);
      cleanup();
    }
  } finally {
    await act(async () => { await L.setLocale('zh-Hans', false); game.set({ ...initialGameState() }); });
    setCatalogForTests(null); __setBayNowForTests(null);
  }
  assert.deepEqual(bad, []);
});

test('W8-Q3: every city place card in English carries no Chinese (its facts, tips, plan button, guide row and nearby events)', async () => {
  setCatalogForTests(REAL);
  const { default: PoiCardBody } = await import('../src/opus-bay/ui/PoiCardBody');
  const { CITY_POIS } = await import('../src/opus-bay/data/sf/cityPois');
  assert.ok(CITY_POIS.length >= 20, `city POIs: ${CITY_POIS.length}`);
  const bad: string[] = [];
  try {
    await act(async () => { await L.setLocale('en', false); game.set({ ...initialGameState(), phase: 'playing', worldMode: 'city' }); });
    // two Bay days: a busy weekend (the nearby-events block) and a quiet weekday
    for (const day of ['2026-10-03T10:00', '2026-10-06T10:00']) {
      __setBayNowForTests(day);
      for (const poi of CITY_POIS) {
        const c = render(h(PoiCardBody, { poi })).container;
        for (const leak of leaksOf(c)) bad.push(`${day} ${poi.id}: ${leak}`);
        cleanup();
      }
    }
  } finally {
    await act(async () => { await L.setLocale('zh-Hans', false); game.set({ ...initialGameState() }); });
    setCatalogForTests(null); __setBayNowForTests(null);
  }
  assert.deepEqual([...new Set(bad)], []);
});
