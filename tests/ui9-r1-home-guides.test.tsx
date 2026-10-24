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
  // Review r1: 简洁 keeps no BayBay control in the hero (D6, as before: the submit turns into 问 BayBay), and the otter is
  // sized in px, so at 大 / 特大 it never takes the example question's room.
  assert.equal(otter.getAttribute('data-simple'), 'hide');
  assert.match(HOME_CSS, /\.home-ask__otter \{[^}]*width:44px; height:44px; margin-inline-end:calc\(var\(--sp-1\) \* -1\);/);
  assert.match(HOME_CSS, /\.home-ask__otter>img \{ width:28px; height:28px; \}/);
  assert.match(HOME_CSS, /html\[data-simple\] \.home-ask \{ padding-inline-start:var\(--sp-3\); \}/);
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
  // UI9-R2-HOME: picks 2–3 under the masthead (1–3, 4–6), the share strip under the lead (7–12), the tiles on all 12.
  assert.match(HOME_CSS, /\.home-picks__list>li:nth-child\(2\) \{ grid-area:4 \/ 1 \/ 6 \/ 4; \}/);
  assert.match(HOME_CSS, /\.home-picks__list>li:nth-child\(3\) \{ grid-area:4 \/ 4 \/ 6 \/ 7; \}/);
  assert.match(HOME_CSS, /\.home-top>\.home-share \{ grid-area:5 \/ 7 \/ 6 \/ -1; align-self:start;/);
  assert.match(HOME_CSS, /\.home-top>\.home-moods \{ grid-area:6 \/ 1 \/ 7 \/ -1;/);
  // /guides: the elder band's panel reaches past the column edges by its own padding in every desktop mode but 简洁, so its
  // cards start on the columns of the topic sections under it: at 标准 the four (rows in 2–4); at 大 / 特大 (review r2) the
  // three of the base band, under its heading — the four-column placement is 标准's only.
  assert.match(LIBRARY_CSS, /html:not\(\[data-simple\]\) \.gl-band \{ --gl-band-bleed:var\(--sp-4\); margin-inline:calc\(var\(--gl-band-bleed\) \* -1\); padding:var\(--inset-panel\) var\(--gl-band-bleed\); \}/);
  assert.match(LIBRARY_CSS, /html:not\(\[data-reading\$=large\],\[data-simple\]\) \.gl-band \{ display:grid; grid-template-columns:repeat\(4, minmax\(0, 1fr\)\);/);
  assert.match(LIBRARY_CSS, /html:not\(\[data-reading\$=large\],\[data-simple\]\) \.gl-band>\.gl-band__rows \{ grid-area:1 \/ 2 \/ 3 \/ -1; \}/);
  assert.doesNotMatch(LIBRARY_CSS, /html:not\(\[data-reading=extra-large\],\[data-simple\]\) \.gl-band(>[^{]*)? \{[^}]*grid-(template-columns:repeat\(4|area)/, '大 keeps the three columns of its topic sections');
  assert.match(LIBRARY_CSS, /\.gl-band \.gl-band__rows \{ display:grid; grid-template-columns:repeat\(3, minmax\(0, 1fr\)\); gap:var\(--grid-gutter\); \}/);
  // Review r1: in one column each band guide is a card (the 3:2 picture over the whole title), not a squeezed row, and its
  // ③④ chip is one line. The pictures keep the short English label ('Stock photo', `mini`); UI9-R1-BUTTONS (follow-up 27)
  // gave them their own `sizes`, so the 365 px cards at 大 / 特大 no longer ask for the 88 px thumbnail's file.
  // Review r2: at 特大 too (rows a third of the page wide broke words in two), so in every desktop mode but 简洁.
  assert.match(LIBRARY_CSS, /html:not\(\[data-simple\]\) \.gl-band \.ui-row-card \{ grid-template-columns:minmax\(0, 1fr\); grid-template-areas:"thumb" "body";/);
  assert.match(LIBRARY_CSS, /\.gl-band \.ui-row-card__thumb \{ --ui-feed-ratio:3 \/ 2; width:auto; height:auto; \}/);
  // UI9-R2-GUIDE: the chip is FOUNDATION's one label (covers.css), with no rule of this page's own; the pictures ask for
  // their laid-out width (sizes=auto first).
  assert.doesNotMatch(LIBRARY_CSS, /ui-provenance/);
  assert.match(read('src/components/GuidesHome.tsx'), /<GuideCover guide=\{guide\} cover=\{cover\} ratio="1:1" mini sizes=\{options\.sizes \?\? ROW_SIZES\} \/>/);
  assert.match(read('src/components/GuidesHome.tsx'), /const BAND_SIZES = laidOut\('\(max-width: 1023px\) 112px, 365px'\);/);
  // /my-week starts on the site frame (x=112), as /me.
  assert.match(read('src/pages/MyWeekPage.tsx'), /<PageContainer size="wide" className="my-week">/);
});

test('N02: a guide page has no heading that outranks a smaller H2 — slide titles and 目录 are styled lines', () => {
  const carousel = read('src/features/guides/GuideCarousel.tsx');
  assert.doesNotMatch(carousel, /<h3/);
  assert.match(carousel, /<p className="gd-slide__title" id=\{`\$\{id\}-slide-\$\{index \+ 2\}`\}>/);
  // Each slide keeps a name without a heading level: its title line labels it.
  assert.match(carousel, /data-cover="slide" aria-labelledby=\{`\$\{id\}-slide-\$\{index \+ 2\}`\}>/);
  assert.match(carousel, /data-cover="slide" aria-labelledby=\{`\$\{id\}-slide-1`\}>/);
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
  // 4: the desktop cover reads top-down; the spare height goes above the source line.
  assert.match(ARTICLE_CSS, /\.gd-lead__story \.gd-slide--cover \.gd-slide__question \{ margin-top:var\(--sp-5\); \}/);
  // 7: a row thumbnail's label is FOUNDATION's chip on the picture (bottom-left, covers.css); no local label rule here.
  assert.doesNotMatch(LIBRARY_CSS, /\.ui-provenance/);
  // 10: no --gl-rest span: the cell is one column.
  assert.doesNotMatch(read('src/components/GuidesHome.tsx'), /--gl-rest|--gl-ratio/);
  assert.doesNotMatch(LIBRARY_CSS, /--gl-rest|--gl-ratio/);
});
