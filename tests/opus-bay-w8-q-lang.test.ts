import assert from 'node:assert/strict';
import fs from 'node:fs';
import { registerHooks } from 'node:module';
import test, { after, afterEach } from 'node:test';
import { JSDOM } from 'jsdom';

/**
 * W8-Q1 · English never shows Chinese. The BAYLINK catalog (`/planner-catalog.json`) is Simplified Chinese only; the
 * site runtime translates a lone JSX text child through its editorial dictionary, but a title joined into an English
 * sentence stayed Chinese — the 旅行本's hand-off line said "Take Ferry Plaza 农夫市集：海边逛一圈 … to BAYLINK as a
 * plan" (filmed in the English promo). `catalogText` / `planStopTitles(…, locale)` name the stops in the reader's
 * language.
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
const { createElement: h } = await import('react');
const { render, cleanup, act } = await import('@testing-library/react');
const { __setBayNowForTests } = await import('../src/opus-bay/game/bayNow');
const { sanitizeCatalog, setCatalogForTests } = await import('../src/opus-bay/data/catalog');
const { game, initialGameState } = await import('../src/opus-bay/core/store');
const REAL = sanitizeCatalog(JSON.parse(fs.readFileSync(new URL('../public/planner-catalog.json', import.meta.url), 'utf8')))!;
const HAN = /\p{Script=Han}/u;
afterEach(() => { cleanup(); });
after(async () => { __setBayNowForTests(null); await L.setLocale('zh-Hans', false); dom.window.close(); });

test('W8-Q1: catalogText — the site dictionary in English, 繁體 converted, 简体 untouched; a title the dictionary lacks keeps its Latin part', async () => {
  const { catalogText } = await import('../src/opus-bay/i18n');
  const title = REAL.events.find(e => e.id === 'ferry-plaza-farmers-market-2026-autumn')!.title;
  assert.match(title, HAN);
  assert.equal(catalogText(title, 'zh-Hans'), title);
  await L.setLocale('en', false);
  try {
    const en = catalogText(title, 'en');
    assert.doesNotMatch(en, HAN, en);
    assert.match(en, /Ferry Plaza/);
    // not in the dictionary: the Latin parts ("X · 中文" and "Latin 中文" titles), never an empty name
    assert.equal(catalogText('Exploratorium · 日间科学探索馆', 'en'), 'Exploratorium');
    assert.equal(catalogText('Zzyzx Plaza 周日小市集', 'en'), 'Zzyzx Plaza');
    assert.equal(catalogText('无名小市集', 'en'), '无名小市集', 'nothing Latin to keep: the title as it is');
    // every SF title of the catalog reads without Han in English
    const left = [...REAL.events, ...REAL.places].filter(item => item.region === 'sf').map(item => catalogText(item.title, 'en')).filter(text => HAN.test(text));
    assert.deepEqual(left, []);
    await L.setLocale('zh-Hant', false);
    assert.equal(catalogText('渔人码头与 PIER 39', 'zh-Hant'), '漁人碼頭與 PIER 39');
  } finally { await L.setLocale('zh-Hans', false); }
});

test('W8-Q1: planStopTitles(…, locale) names a plan\'s stops in the reader\'s language (without a locale: the catalog\'s titles)', async () => {
  const { planStopTitles } = await import('../src/opus-bay/data/links');
  const stops = [{ kind: 'event' as const, id: 'ferry-plaza-farmers-market-2026-autumn' }, { kind: 'place' as const, id: 'pier39' }];
  assert.deepEqual(planStopTitles(stops, REAL), [REAL.events.find(e => e.id === stops[0].id)!.title, REAL.places.find(p => p.id === 'pier39')!.title]);
  await L.setLocale('en', false);
  try {
    const en = planStopTitles(stops, REAL, 'en');
    assert.equal(en.length, 2);
    for (const name of en) assert.doesNotMatch(name, HAN, name);
  } finally { await L.setLocale('zh-Hans', false); }
});

test('W8-Q1: the 旅行本 想去 page in English — the 带去 BAYLINK line, "on other days" and "can’t go into a plan" carry no Chinese', async () => {
  __setBayNowForTests('2026-10-03T10:00');
  setCatalogForTests(REAL);
  const { Journal } = await import('../src/opus-bay/ui/Journal');
  const at = '2026-10-01T10:00:00.000Z';
  const wish = (kind: 'event' | 'place' | 'poi', id: string) => ({ kind, id, title: kind === 'poi' ? id : (kind === 'event' ? REAL.events.find(e => e.id === id)!.title : REAL.places.find(p => p.id === id)!.title), addedAt: at });
  try {
    await act(async () => {
      await L.setLocale('en', false);
      game.set({
        ...initialGameState(), phase: 'playing', worldMode: 'city', panel: { kind: 'journal', id: 'wish' },
        // two events on different days (one goes to "On other days"), a planner place, and an ended event
        wishlist: [wish('event', 'ferry-plaza-farmers-market-2026-autumn'), wish('event', 'sf-castro-street-fair-2026'), wish('place', 'pier39'), wish('event', 'sf-opera-mary-queen-scots-2026')],
      });
    });
    const c = render(h(Journal)).container;
    const handoff = c.querySelector('.ob-handoff');
    assert.ok(handoff, 'the hand-off block');
    const text = handoff!.textContent ?? '';
    assert.match(text, /Take .* to BAYLINK as a plan/);
    assert.doesNotMatch(text, HAN, text);
    // the list itself (lone text children: the site runtime's own translation)
    const titles = [...c.querySelectorAll('.ob-wish-title')].map(el => el.textContent ?? '');
    assert.equal(titles.length, 4);
    for (const name of titles) assert.doesNotMatch(name, HAN, name);
  } finally {
    await act(async () => { await L.setLocale('zh-Hans', false); game.set({ ...initialGameState() }); });
    setCatalogForTests(null);
    __setBayNowForTests(null);
  }
});
