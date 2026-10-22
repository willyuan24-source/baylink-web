import React from 'react';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import postcss from 'postcss';
import { JSDOM } from 'jsdom';
import { renderToStaticMarkup } from 'react-dom/server';
import { ProvenanceBadge } from '../src/components/ui/Badges';

// UI9-R1-AFTER-A1-CARD-SYSTEM (cold review round 1: N02, N08, N12, N13, N24, D1, D3, D7, D9; #60 / #62 follow-ups 2, 3, 8).
const read = (file: string) => readFileSync(file, 'utf8');
const decls = (file: string, selector: string, media = '') => {
  const found: Record<string, string> = {};
  postcss.parse(read(file)).walkRules(rule => {
    const at = rule.parent?.type === 'atrule' ? (rule.parent as postcss.AtRule).params : '';
    if (rule.selector === selector && at === media) rule.walkDecls(declaration => { found[declaration.prop] = declaration.value; });
  });
  return found;
};
const CARDS = 'src/components/ui/cards.css', UI = 'src/components/ui/ui.css', COVERS = 'src/components/ui/covers.css';

test('D1 / D3: card titles are never cut with "…", and feed and row titles are medium (500)', () => {
  const cards = read(CARDS);
  for (const title of ['.ui-feed-card__title', '.ui-hero-card__title']) {
    assert.doesNotMatch(cards.match(new RegExp(`\\${title} \\{[^}]*\\}`))![0], /line-clamp|text-overflow/, title);
  }
  assert.equal(decls(CARDS, '.ui-feed-card__title')['font-weight'], 'var(--fw-medium)');
  assert.equal(decls(CARDS, '.ui-row-card__title')['font-weight'], 'var(--fw-medium)');
  assert.match(read('src/tokens.css'), /--fw-medium:500;/);
});

test('D9: a feed grid has 3 columns from 700px', () => {
  assert.equal(decls(CARDS, '.ui-feed-grid', '(min-width:700px)')['--ui-feed-cols'], '3');
});

test('N24 / J3 P25: one card press, drawn from [data-press] that a pointerdown sets', async () => {
  const cards = read(CARDS);
  assert.match(cards, /:is\(\.ui-feed-card,\.ui-row-card,\.ui-hero-card\):is\(\[data-press\],:has\(\.ui-card-link:active\)\) \{ scale:\.985; \}/);
  assert.doesNotMatch(cards, /filter:brightness/, 'one hover token: the ink tint, not a second photo filter');
  const dom = new JSDOM('<article class="ui-feed-card"><h3><a class="ui-card-link" href="/x">Title</a></h3></article><button id="other">x</button>');
  const globals = globalThis as unknown as Record<string, unknown>;
  const saved = { document: globals.document, window: globals.window };
  globals.document = dom.window.document; globals.window = dom.window;
  try {
    await import('../src/components/ui/card-press');
    const card = dom.window.document.querySelector('.ui-feed-card')!;
    const link = dom.window.document.querySelector('.ui-card-link')!;
    const fire = (target: Element, type: string) => {
      const event = new dom.window.Event(type, { bubbles: true }) as Event & { pointerType: string; button: number };
      Object.assign(event, { pointerType: 'mouse', button: 0 });
      target.dispatchEvent(event);
    };
    fire(link, 'pointerdown');
    assert.equal(card.hasAttribute('data-press'), true, 'pressed at pointerdown');
    fire(link, 'pointerup');
    assert.equal(card.hasAttribute('data-press'), false, 'released at pointerup');
    fire(dom.window.document.getElementById('other')!, 'pointerdown');
    assert.equal(card.hasAttribute('data-press'), false, 'a press elsewhere leaves the card alone');
  } finally {
    globals.document = saved.document; globals.window = saved.window;
  }
});

test('N12 / follow-up 2: a two-line pill keeps 8px above and below its label; secondary is the icon button\'s look', () => {
  assert.match(decls(UI, '.ui-button').padding, /^var\(--sp-2\) /);
  assert.match(decls(UI, '.ui-button[data-variant=quiet]').padding, /^var\(--sp-2\) /);
  assert.equal(decls(UI, '.ui-button[data-variant=secondary]').border, decls(UI, '.ui-icon-button').border);
  assert.match(decls('src/features/saves/saves.css', '.saves-control .saves-toggle,.saves-day .saves-add-day').padding, /^var\(--sp-2\) /);
  // The detail action bar's primary (家人版 / 特大 at 360 and 390 px wraps 加入这天计划, How to claim, Add to a plan): the
  // narrow-cell rule only changes the sides, and two wrapped lines at a 1.1 pitch keep the pill inside the 64 / 76 px bar.
  const DETAIL = 'src/components/local-discovery-detail.css', PRIMARY = ':is(.detail-action--primary,.detail-actions__primary .saves-add-day)';
  assert.match(decls(DETAIL, `.site-detail-actions.detail-actions ${PRIMARY}`).padding, /^var\(--sp-2\) /);
  const narrow = decls(DETAIL, '.site-detail-actions.detail-actions .detail-actions__primary .saves-add-day', 'detail-primary (max-width:9.5em)');
  assert.equal(narrow.padding, undefined);
  assert.equal(narrow['padding-inline'], 'var(--sp-2)');
  assert.equal(decls(DETAIL, `html[data-reading=extra-large] .local-discovery-detail .site-detail-actions.detail-actions ${PRIMARY}`, '(max-width:1023px)')['line-height'], '1.1');
  assert.equal(decls(DETAIL, `.site-detail-actions.detail-actions ${PRIMARY}`, '(max-width:359px)')['line-height'], '1.1');
});

test('N13: one ♡ on a picture (a 44px white circle with e1), on a row\'s thumbnail at 36px', () => {
  const save = decls(UI, '.ui-save');
  assert.equal(save.width, 'var(--control-height)');
  assert.equal(save.background, 'var(--color-surface)');
  assert.equal(decls(CARDS, '.ui-row-card__save')['grid-area'], 'thumb');
  assert.equal(decls(CARDS, '.ui-row-card__save .ui-save').width, '2.25rem');
  assert.equal(decls('src/features/saves/saves.css', '.saves-control .saves-toggle[data-compact]')['box-shadow'], 'var(--e1)');
  const card = read('src/components/PlannerCatalogCard.tsx');
  assert.match(card, /save=\{<button type="button" className="ui-save planner-heart"/, '/plan: the ♡ is on the thumbnail');
  assert.match(card, /trailing=\{<Button className="planner-add" aria-label=\{addLabel\}/, 'D7: 加入计划 is the row\'s compact trailing button');
});

test('N08: one selected look (ink fill) for chips and segments; the open status has no brand-tint fill', () => {
  assert.equal(decls(CARDS, '.ui-segmented__item[aria-checked=true]').background, 'var(--color-ink)');
  assert.equal(decls(COVERS, '.ui-status[data-tone=open]').background, 'transparent');
});

test('N02: a state title inside a section is body size; N24: no motion literal in ui.css', () => {
  assert.equal(decls(UI, ':is(h3,h4).ui-state__title')['font-size'], 'var(--text-body)');
  const ui = read(UI).replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(ui, /(?:animation|transition)[^;{}]*\b\d*\.?\d+m?s\b/, 'durations are --dur-* tokens');
});

test('follow-up 8: a dated ①② chip keeps its edition alone on a cover ≤ 120px', () => {
  const html = renderToStaticMarkup(<ProvenanceBadge label="官方图 · 2025 往届" tier="official" />);
  assert.match(html, /<span class="ui-provenance__lead">官方图 · <\/span>2025 往届/);
  assert.doesNotMatch(renderToStaticMarkup(<ProvenanceBadge label="官方图 · 2025 往届" plain />), /lead/, 'the 3D postcard badge stays as it was');
  assert.doesNotMatch(renderToStaticMarkup(<ProvenanceBadge label="场馆照 · 2024" tier="venue" />), /lead/);
  assert.match(renderToStaticMarkup(<ProvenanceBadge label="Official image · 2025 edition" tier="official" />), /lead">Official image · <\/span>2025 edition/);
  assert.equal(decls(COVERS, '.ui-provenance[data-chip] .ui-provenance__lead', 'ui-cover (max-width:120px)').display, 'none');
});

test('follow-up 3: /plan head copy and empty state balance their lines and keep phrases from 768px', () => {
  const rule = decls('src/styles/plan-page.css', '.planner-page :is(.ui-page-header__lede,.plan-days .ui-state__title,.plan-days .ui-state__body)', '(min-width:768px)');
  assert.equal(rule['text-wrap'], 'balance');
  assert.equal(rule['word-break'], 'keep-all');
});
