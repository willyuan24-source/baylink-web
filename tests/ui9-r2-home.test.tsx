import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import postcss from 'postcss';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { HOME_WEEKENDS } from '../src/lib/home-catalog';
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://www.baylink.us/' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { StaticRouter } = await import('react-router-dom');
const { HomeDiscovery } = await import('../src/components/HomeDiscovery');
const { ShareStrip } = await import('../src/features/home/ShareStrip');

/** UI9-R2-HOME (round-2 cold review fix list): the home's tiles, desktop top grid, share strip, 3D tile, heading order,
 * tablet lead, phone first screen, 大 / 特大 row ♡ (DECISIONS 44) and its text colours. The pixel and layout measures are in the lane's PR. */
const snapshots = HOME_WEEKENDS as Record<string, { ids: string[]; feed: string[] }>;
const today = Object.keys(snapshots).sort().find(day => snapshots[day].ids.length === 3 && snapshots[day].feed.length >= 4)!;
const home = () => new JSDOM(renderToStaticMarkup(<StaticRouter location="/"><HomeDiscovery today={today} onAskBayBay={() => {}} onBrowseCommunity={() => {}} /></StaticRouter>)).window.document;
const CSS = fs.readFileSync('src/components/home-discovery.css', 'utf8').replace(/\r\n/g, '\n');
/** Declarations of one exact selector, optionally inside one @media query. */
function decls(selector: string, media?: string): Record<string, string> {
  const out: Record<string, string> = {};
  postcss.parse(CSS).walkRules(rule => {
    const parent = rule.parent as postcss.AtRule;
    const at = parent.type === 'atrule' ? parent.params : undefined;
    if (rule.selector === selector && at === media) rule.walkDecls(decl => { out[decl.prop] = decl.value; });
  });
  return out;
}

test('N02 / N15: the share card\'s heading is an h3 under the picks\' h2, at the card size; every home h2 is a section heading', () => {
  for (const cardHref of ['/weekly/all-2026-10-24.png', null]) {
    const doc = new JSDOM(renderToStaticMarkup(<StaticRouter location="/"><ShareStrip count={3} cardHref={cardHref} total={79} /></StaticRouter>)).window.document;
    assert.equal(doc.querySelectorAll('.home-share h2').length, 0);
  }
  const doc = home();
  const share = doc.querySelector('.home-share[data-card]');
  if (share) assert.equal(share.querySelector('h3#home-share-title')?.textContent, '这周末 3 件事，发到家庭群');
  // Every h2 is a section heading (24 px from 1024, --text-section), so the lead's 24 px h3 title is never above an h2.
  for (const h2 of doc.querySelectorAll('.home-discovery h2')) assert.ok(h2.closest('.home-section-head, .home-baybay__head'), h2.textContent!);
  assert.equal(decls('.home-share h3')['font-size'], 'var(--text-card)');
  assert.equal(decls('.home-section-head h2')['font-size'], 'var(--text-section)');
  assert.equal(decls('.home-picks li:first-child .ui-feed-card__title', '(min-width:1024px)')['font-size'], 'var(--text-section)');
  assert.doesNotMatch(CSS, /\.home-share h2/);
});

test('R2-06: on a desktop the share strip sits under the lead at its own height; the tiles span all twelve columns', () => {
  const at = (selector: string) => decls(selector, '(min-width:1024px)');
  assert.equal(at('.home-top')['grid-template'], 'repeat(4, auto) 1fr auto / repeat(12, minmax(0, 1fr))');
  assert.deepEqual(at('.home-top>.home-share'), { 'grid-area': '5 / 7 / 6 / -1', 'align-self': 'start', margin: '0' });
  assert.equal(at('.home-top>.home-moods')['grid-area'], '6 / 1 / 7 / -1');
  assert.equal(at('.home-picks__list>li:first-child,.home-empty')['grid-area'], '2 / 7 / 5 / -1');
  // From 1280 the strip is one row: the preview, the heading over its balanced line, the two buttons at the end (English: the
  // buttons stay under the words, the 768 layout).
  const wide = '(min-width:1280px)';
  assert.equal(decls('.home-share[data-card]', wide)['grid-template-columns'], '3.5rem minmax(0, 1fr) auto');
  // Its Chinese line breaks only at the comma: 「存成一张图， / 微信里长按就能转发。」, never 「微信 / 里」 or a lone 「转发。」.
  const card = new JSDOM(renderToStaticMarkup(<StaticRouter location="/"><ShareStrip count={3} cardHref="/weekly/all-2026-10-24.png" total={79} /></StaticRouter>)).window.document;
  assert.deepEqual([...card.querySelectorAll('.home-share p>.home-share__keep')].map(span => span.textContent), ['存成一张图，', '微信里长按就能转发。']);
  assert.equal(decls('.home-head__keep,.home-share__keep')['white-space'], 'nowrap');
  assert.equal(decls('.home-share[data-card]:not(:lang(en))>.home-share__actions', wide)['grid-area'], '1 / 3 / 3 / 4');
  assert.equal(decls('.home-share[data-card]>:not(.home-share__card)', '(min-width:768px)')['grid-column'], '2');
  assert.doesNotMatch(CSS, /:lang\(en\)>/, 'English has no overrides of its own');
});

test('R2-04 / N16: the tiles\' scrim is the words\' own box (the photo clear above it), on the grid gutter, 16:9 on a desktop', () => {
  assert.doesNotMatch(CSS, /\.home-mood::before/);
  const text = decls('.home-mood__text');
  assert.match(text.background, /^linear-gradient\(0deg, rgb\(var\(--color-scrim-rgb\) \/ \.84\) 0%, rgb\(var\(--color-scrim-rgb\) \/ \.76\) calc\(100% - var\(--sp-6\)\), rgb\(var\(--color-scrim-rgb\) \/ 0\) 100%\)$/);
  assert.equal(text.width, '100%');
  assert.equal(decls('.home-moods ul').gap, 'var(--grid-gutter)');
  assert.equal(decls('.home-moods ul', '(min-width:768px)')['grid-template-columns'], 'repeat(4, minmax(0, 1fr))');
  assert.equal(decls('html:not([data-reading$=large]) .home-mood', '(min-width:1024px)')['aspect-ratio'], '16 / 9');
  assert.equal(decls('.home-mood')['aspect-ratio'], '3 / 2');
  assert.equal(decls('.home-mood__label')['font-size'], 'var(--fs-body)');
  // Follow-up 11: a Chinese line keeps its phrase (「带孩子的好去处」 is never cut as 「带孩子的好 / 去处」).
  assert.equal(decls('.home-mood__blurb')['word-break'], 'keep-all');
});

test('R2-06 A P8: from 1024 the 3D strip is one framed tile of the feed grid, its 15rem postcard untouched', () => {
  const tile = decls('html:not([data-reading$=large],[data-simple]) .home-3d-strip', '(min-width:1024px)');
  assert.equal(tile['--home-3d-inset'], 'calc((100% - 15rem) / 2 - 1px)', 'the cell less the 15rem postcard and the frame\'s border, split evenly');
  assert.equal(tile.padding, 'var(--home-3d-inset)');
  assert.equal(tile['flex-direction'], 'column');
  assert.equal(decls('html:not([data-reading$=large],[data-simple]) .home-feed .ui-feed-grid>.ui-feed-grid__wide', '(min-width:1024px)')['grid-column'], 'auto');
  assert.equal(decls('html:not([data-reading$=large],[data-simple]) .home-feed .ui-feed-grid', '(min-width:1024px) and (max-width:1199px)')['--ui-feed-cols'], '3');
  assert.equal(decls('html:not([data-reading$=large],[data-simple]) .home-feed:has(>.home-feed__all) .ui-feed-grid:has(>li:last-child:nth-child(4n+1))>li:last-child:not(.ui-feed-grid__wide)', '(min-width:1200px)').display, 'none',
    'a card alone in the last row gives way, never the strip, and only when 看本周末全部 N 场 follows the grid');
  assert.equal(CSS.match(/nth-child\(4n\+1\)/g)?.length, 1, 'no other rule hides a feed card');
  // The art keeps its width and corners (the same lines as before; tests/ui9-home-layout pins them byte for byte).
  assert.equal(decls('.home-3d-strip .home-3d-strip__art').width, '9.5rem');
  assert.match(CSS, /@media \(min-width:768px\) \{ \.home-3d-strip \.home-3d-strip__art \{ width:15rem; \}/);
  // N04 / N13: the size line at 14 px on the 14 px line height (its sibling's 1.571); the hover underlines on the tokens.
  assert.deepEqual(decls('.home-3d-strip__text small'), { color: 'var(--color-ink-3)', 'font-size': 'var(--text-fact)', 'line-height': '1.571' });
  assert.equal(decls('.home-3d-strip__text>span')['line-height'], '1.571');
  for (const selector of ['.home-mood:hover .home-mood__label', '.home-3d-strip:hover strong', '.home-3d:hover strong']) {
    assert.equal(decls(selector, '(hover:hover) and (pointer:fine)')['text-underline-offset'], 'var(--underline-offset)', selector);
  }
});

test('N07 / N08: the BayBay band\'s words are white, its AI 助手 tag an outline (not the lime 免费 chip)', () => {
  const doc = home();
  const tag = doc.querySelector('.home-baybay__head .home-baybay__tag')!;
  assert.equal(tag.textContent, 'AI 助手');
  assert.equal(doc.querySelectorAll('.home-baybay .ui-status').length, 0);
  assert.equal(decls('.home-baybay').color, 'var(--color-surface)');
  assert.equal(decls('.home-baybay__tag').border, '1px solid var(--color-on-brand-muted)');
});

test('A P11: 「免费 · 不用登录」 wraps as one piece', () => {
  const doc = home();
  assert.equal(doc.querySelector('.home-head__identity .home-head__keep')!.textContent, '免费 · 不用登录');
  assert.equal(decls('.home-head__keep,.home-share__keep')['white-space'], 'nowrap');
});

test('N18 / R2-06 A P3: the phone lead\'s place and ✓ share a line; a portrait tablet\'s lead is picture left, words right', () => {
  const phone = '(max-width:767px)';
  const lead = 'html:not([data-reading$=large],[data-simple]) .home-picks__list>li:first-child';
  assert.equal(decls(`${lead} .ui-feed-card`, phone)['flex-flow'], 'row wrap');
  // Every other line is a full line; the place and the ✓ keep the initial flex (0 1 auto) and share one.
  assert.equal(decls(`${lead} .ui-feed-card>:not(.ui-feed-card__meta,.ui-feed-card__trust)`, phone).flex, '0 0 100%');
  assert.deepEqual(decls(`${lead} .ui-feed-card>.ui-feed-card__meta`, phone), { 'max-width': 'calc(100% - 11rem)' });
  assert.equal(decls(`${lead} .ui-feed-card>.ui-feed-card__media`, phone)['flex-basis'], 'calc(100% + 32px)', 'the lead stays full-bleed');
  const tablet = '(min-width:768px) and (max-width:1023px)';
  assert.equal(decls(`${lead} .ui-feed-card`, tablet)['grid-template-columns'], 'minmax(0, 7fr) minmax(0, 5fr)');
  assert.equal(decls(`${lead} .ui-feed-card__media`, tablet)['grid-area'], '1 / 1 / -1 / 2');
  assert.equal(decls(`${lead} .ui-feed-card__save`, tablet)['grid-area'], '1 / 1 / 2 / 2', 'the ♡ stays on the picture\'s corner');
});

test('DECISIONS 44: at 大 / 特大 a home row\'s ♡ leaves the 112 px thumbnail for the row\'s edge under it; standard keeps A1, 简洁 none', () => {
  const rows = 'html[data-reading$=large]:not([data-simple]) :is(.home-picks li+li,.home-feed,.home-offers,.home-guides)';
  // Under the thumbnail: in the flow (not absolute over the picture), the picture's column, the row after the picture's five.
  assert.deepEqual(decls(`${rows} .ui-feed-card__save`), { position: 'static', 'grid-area': '6 / 1 / 7 / 2', 'justify-self': 'start', 'margin-top': 'var(--sp-1)' });
  assert.equal(decls(':is(html[data-simple] .home-picks,html[data-reading$=large] .home-discovery) .ui-feed-card__media')['grid-area'], '1 / 1 / span 5', 'the picture spans rows 1-5 only, so row 6 is clear of it (0% covered)');
  assert.equal(decls(':is(html[data-simple] .home-picks,html[data-reading$=large] :is(.home-picks li+li,.home-feed,.home-offers,.home-guides)) .ui-feed-card')['grid-template-columns'], '112px minmax(0, 1fr)', 'the ♡\'s column is the 112 px thumbnail\'s: the words keep the row\'s width');
  // No top / right offsets left at 大 / 特大 (they would only apply to an absolute ♡ on the picture).
  postcss.parse(CSS).walkRules(rule => {
    if (/data-reading\$=large/.test(rule.selector) && /\.ui-feed-card__save/.test(rule.selector)) rule.walkDecls(d => assert.ok(!['top', 'right'].includes(d.prop), `${rule.selector} sets ${d.prop}`));
  });
  // Standard size: the A1 corner of cards.css (absolute, top-right of the picture); 简洁: no ♡ on the home picks.
  const cards = fs.readFileSync('src/components/ui/cards.css', 'utf8');
  assert.match(cards, /\.ui-feed-card__save \{ position:absolute; top:var\(--sp-1\); right:var\(--sp-1\); z-index:3; \}/);
  assert.equal(decls('html[data-simple] .home-picks .ui-feed-card__save').display, 'none');
  // The target is FOUNDATION's one circle: --control-height, ≥ 44 px at every size (55 at 特大).
  assert.match(fs.readFileSync('src/features/saves/saves.css', 'utf8'), /\.ui-row-card__save\) \.saves-control \.saves-toggle \{[^}]*width:var\(--control-height\)!important;/);
});

test('A1 / DECISIONS 20, 32: the home rows\' ♡ is FOUNDATION\'s one circle (no home size)', () => {
  assert.deepEqual(decls(':is(html[data-simple] .home-picks,html[data-reading$=large] .home-discovery) .ui-feed-card__media'), { 'grid-area': '1 / 1 / span 5', margin: '0' });
  // No home size, ring or row height for it: the circle is saves.css's (--control-height: 44 px, 55 at 特大), the row as tall as its words or its picture.
  assert.doesNotMatch(CSS, /saves-toggle|min-height:calc\(112px/);
  const saves = fs.readFileSync('src/features/saves/saves.css', 'utf8');
  assert.match(saves, /\.ui-feed-card__save,[^{]*\) \.saves-control \.saves-toggle \{[^}]*width:var\(--control-height\)!important; height:var\(--control-height\)!important;/);
});

test('the desktop feed hides its lone last card only beside the 看本周末全部 N 场 button, which counts more than the cards', () => {
  const doc = home();
  const feed = doc.querySelector('section.home-feed')!;
  const cards = feed.querySelectorAll('.ui-feed-grid>li:not(.ui-feed-grid__wide)').length;
  const more = feed.querySelector(':scope>a.home-feed__all');
  assert.ok(more, 'the button follows the grid');
  const n = Number(/(\d+)/.exec(more!.textContent!)?.[1]);
  assert.ok(n > cards, `看本周末全部 ${n} 场 > ${cards} cards shown`);
  assert.equal(feed.querySelectorAll('.ui-feed-grid>li.ui-feed-grid__wide').length, 1, 'the 3D tile is in the grid');
});
