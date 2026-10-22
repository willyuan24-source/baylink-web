// UI9-R1-AFTER-A1-HOME-GUIDES (cold review round 1): the home hero's one BayBay entry, the home and /guides grids on the
// feeds' four columns (N16), the guide pages' heading ladder (N02), the shared chevron (J3 P26), gated hover rules (N23),
// the guide bar's one cell height (follow-up 1), the desktop cover slide (follow-up 4), the ③④ label on row thumbnails
// (follow-up 7), the one-column 看全部 cell (follow-up 10) and the my-week frame.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test, { afterEach } from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://www.baylink.us/' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { render, fireEvent, cleanup, within } = await import('@testing-library/react');
const { MemoryRouter } = await import('react-router-dom');
const { HomeDiscovery } = await import('../src/components/HomeDiscovery');
afterEach(() => { cleanup(); dom.window.localStorage.clear(); });

const read = (file: string) => readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
const HOME_CSS = read('src/components/home-discovery.css');
const LIBRARY_CSS = read('src/features/guides/guide-library.css');
const ARTICLE_CSS = read('src/features/guides/guide-article.css');

test('J3 P12: the hero has one BayBay entry, the ask box; its otter opens BayBay with what is typed', () => {
  const asked: (string | undefined)[] = [];
  const view = render(<MemoryRouter><HomeDiscovery today="2026-10-22" onAskBayBay={question => asked.push(question)} onBrowseCommunity={() => {}} /></MemoryRouter>);
  const head = view.container.querySelector('.home-head')!;
  const entries = [...head.querySelectorAll('button, a')].filter(node => /BayBay/.test(`${node.textContent} ${node.getAttribute('aria-label') ?? ''}`));
  assert.deepEqual(entries.map(node => node.className), ['home-ask__otter'], 'one BayBay control in the masthead, inside the ask box');
  const otter = within(view.getByRole('search')).getByRole('button', { name: '问 BayBay（AI 助手）' });
  fireEvent.click(otter);
  fireEvent.change(view.getByRole('textbox', { name: '搜索活动、指南，或问 BayBay' }), { target: { value: '  带爸妈去哪  ' } });
  fireEvent.click(otter);
  assert.deepEqual(asked, [undefined, '带爸妈去哪']);
});

test('N11 + N23: the ask box takes the input radius, and every home hover rule sits behind a hover-capable pointer', () => {
  assert.match(HOME_CSS, /\.home-ask \{[^}]*border-radius:var\(--r-md\);/);
  assert.doesNotMatch(HOME_CSS, /home-ask-baybay/);
  // Outside @media (hover:hover) and (pointer:fine) blocks no rule names :hover.
  const ungated = HOME_CSS.replace(/@media \(hover:hover\) and \(pointer:fine\) \{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '');
  assert.doesNotMatch(ungated, /:hover/);
  assert.match(HOME_CSS, /\.home-mood__blurb \{[^}]*text-wrap:balance;/, 'follow-up 11: a blurb wraps balanced, never one or two characters alone');
});

test('N16: on a desktop the masthead fills columns 1–6 and the lead 7–12, so every home card starts on the feed\'s four columns', () => {
  assert.match(HOME_CSS, /\.home-head \{ grid-area:1 \/ 1 \/ 3 \/ 7; \}/);
  assert.match(HOME_CSS, /\.home-picks>\.home-section-head,\.home-picks__all \{ grid-area:1 \/ 7 \/ 2 \/ -1; \}/);
  assert.match(HOME_CSS, /\.home-picks__list>li:first-child,\.home-empty \{ grid-area:2 \/ 7 \/ 5 \/ -1; \}/);
  assert.match(HOME_CSS, /\.home-top>\.home-share \{ grid-column:7 \/ -1;/);
  // /guides: the elder band on four columns, its rows in 2–4, the panel reaching past the column edges by its own padding.
  assert.match(LIBRARY_CSS, /\.gl-band \{ --gl-band-bleed:var\(--sp-4\); display:grid; grid-template-columns:repeat\(4, minmax\(0, 1fr\)\);[^}]*margin-inline:calc\(var\(--gl-band-bleed\) \* -1\); padding:var\(--sp-5\) var\(--gl-band-bleed\); \}/);
  assert.match(LIBRARY_CSS, /\.gl-band>\.gl-band__rows \{ grid-area:1 \/ 2 \/ 3 \/ -1; \}/);
  // /my-week starts on the site frame (x=112), as /me.
  assert.match(read('src/pages/MyWeekPage.tsx'), /<PageContainer size="wide" className="my-week">/);
});

test('N02: a guide page has no heading that outranks a smaller H2 — slide titles and 目录 are styled lines', () => {
  const carousel = read('src/features/guides/GuideCarousel.tsx');
  assert.doesNotMatch(carousel, /<h3/);
  assert.match(carousel, /<p className="gd-slide__title">/);
  const detail = read('src/components/GuideDetail.tsx');
  assert.doesNotMatch(detail, /<h2>\{t\('目录', 'Contents'\)\}<\/h2>/);
  assert.match(detail, /<p className="gd-toc__label">\{t\('目录', 'Contents'\)\}<\/p>/);
  assert.match(ARTICLE_CSS, /\.gd-toc__desk \.gd-toc__label \{/);
});

test('J3 P26: /guides draws the shared chevron, never the ▾ glyph', () => {
  const guides = read('src/components/GuidesHome.tsx');
  assert.doesNotMatch(guides, /▾/);
  assert.doesNotMatch(LIBRARY_CSS, /[▾▴]/);
  assert.match(guides, /<ChevronDown className="gl-region-chip__caret" aria-hidden="true" strokeWidth=\{1\.75\} \/>/);
  assert.match(guides, /<ChevronDown className="gl-directory__chevron" aria-hidden="true" strokeWidth=\{1\.75\} \/>/);
});

test('follow-ups 1, 4, 7, 10: guide bar cells, the desktop cover, row labels on the picture, the one-column 看全部 cell', () => {
  // 1: at 大 / 特大 / 简洁 the bar stretches its cells and stacks them from the top (one height, one icon line).
  assert.match(ARTICLE_CSS, /html:is\(\[data-reading=large\],\[data-reading=extra-large\],\[data-simple\]\) \.site-detail-actions\.detail-actions\.gd-bar \{ align-items:stretch; \}/);
  assert.match(ARTICLE_CSS, /\.gd-bar :is\(\.detail-actions__cell:is\(button,a\),\.detail-actions__cell \.saves-toggle\) \{ justify-content:flex-start; \}/);
  // 4: the stretched desktop cover reads top-down; the spare height goes above the source line.
  assert.match(ARTICLE_CSS, /\.gd-page\[data-pilot\] \.gd-slide--cover \.gd-slide__question \{ margin-top:var\(--sp-6\); \}/);
  // 7: a row thumbnail's label is the chip on the picture (bottom-left), not a full-width strip.
  assert.match(LIBRARY_CSS, /\.gl-page \.ui-row-card__thumb \.ui-provenance\[data-chip\]:is\(\[data-tier=stock\],\[data-tier=ai\]\) \{ right:auto; bottom:var\(--sp-1\); left:var\(--sp-1\);[^}]*border-radius:var\(--r-sm\);/);
  // 10: no --gl-rest span: the cell is one column.
  assert.doesNotMatch(read('src/components/GuidesHome.tsx'), /--gl-rest|--gl-ratio/);
  assert.doesNotMatch(LIBRARY_CSS, /--gl-rest|--gl-ratio/);
});
