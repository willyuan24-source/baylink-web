import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import postcss from 'postcss';

/** DECISIONS 44 / 45 (f): at 大 / 特大 the home rows (UI9-R2-HOME, INT12) and the /events rows (UI9-R2-EVENTS-CAL) put the ♡ in
 * one place — right under the row's thumbnail, at the row's start edge, --sp-2 below the picture (0% of it covered) — as one
 * size, FOUNDATION's circle (saves.css, --control-height: ≥ 44 px). Standard keeps the A1 corner; 简洁 / 家人版 rows have none. */
const read = (file: string) => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
const HOME = read('src/components/home-discovery.css');
const EVENTS = read('src/features/events/events.css');
const SAVES = read('src/features/saves/saves.css');
const CARDS = read('src/components/ui/cards.css');
function decls(css: string, selector: string): Record<string, string> {
  const out: Record<string, string> = {};
  postcss.parse(css).walkRules(rule => { if (rule.selector === selector && rule.parent?.type === 'root') rule.walkDecls(decl => { out[decl.prop] = decl.value; }); });
  return out;
}
const homeRows = 'html[data-reading$=large]:not([data-simple]) :is(.home-picks li+li,.home-feed,.home-offers,.home-guides)';
const eventsRows = 'html:is([data-reading=large],[data-reading=extra-large]) .ev-page';

test('DECISIONS 44 / 45 f: home and /events rows put the ♡ under the thumbnail at the start edge, --sp-2 below, at 大 / 特大', () => {
  // Home: the absolute ♡ in the thumbnail's column, 112 px (the picture) + --sp-2 down, at the column's start (left:0).
  const home = decls(HOME, `${homeRows} .ui-feed-card__save`);
  assert.equal(home.top, 'calc(112px + var(--sp-2))');
  assert.equal(home.left, '0');
  assert.equal(home.right, 'auto');
  // /events: the save area right under the thumb area, a --sp-2 row gap, at the column's start.
  assert.match(decls(EVENTS, `${eventsRows} .ui-row-card:has(>.ui-row-card__save)`)['grid-template-areas'], /^"thumb body" "save body"$/);
  assert.equal(decls(EVENTS, `${eventsRows} .ui-row-card:has(>.ui-row-card__save)`)['row-gap'], 'var(--sp-2)');
  assert.deepEqual(decls(EVENTS, `${eventsRows} .ui-row-card__save`), { 'grid-area': 'save', 'justify-self': 'start', margin: '0' });
  // Nothing adds to the --sp-2 on either page: the compact control's own 8 px top margin is off in both slots.
  assert.equal(decls(SAVES, ':is(.ui-feed-card__save,.ui-hero-card__save) .saves-control').margin, '0');
  assert.equal(decls(EVENTS, '.ev-page .ui-row-card__save .saves-control').margin, '0');
  // The same reading sizes on both pages: 大 and 特大 (DECISIONS 45 f), not 简洁 / 家人版.
  assert.match(homeRows, /\[data-reading\$=large\]:not\(\[data-simple\]\)/);
  assert.match(eventsRows, /\[data-reading=large\],\[data-reading=extra-large\]/);
});

test('DECISIONS 44: one ♡ size on both pages (FOUNDATION\'s circle), standard keeps A1, 简洁 / 家人版 rows have none', () => {
  const circle = decls(SAVES, ':is(.ui-feed-card__save,.ui-hero-card__save,.ui-row-card__trailing,.ui-row-card__save) .saves-control .saves-toggle');
  assert.equal(circle.width, 'var(--control-height)');
  assert.equal(circle.height, 'var(--control-height)');
  for (const css of [HOME, EVENTS]) assert.doesNotMatch(css, /(width|height):36px|\.saves-toggle \{[^}]*(width|height):/, 'no page size for the ♡');
  // Standard: on the thumbnail's top-right corner, 4 px in (A1) on both.
  assert.match(CARDS, /\.ui-feed-card__save \{ position:absolute; top:var\(--sp-1\); right:var\(--sp-1\); z-index:3; \}/);
  assert.deepEqual(decls(EVENTS, '.ev-page .ui-row-card__save'), { 'grid-area': 'thumb', 'align-self': 'start', 'justify-self': 'end', margin: 'var(--sp-1)' });
  // 简洁 / 家人版 (简洁 at 特大): no ♡ on the home picks or on a list row (decision 16).
  assert.match(HOME, /html\[data-simple\] \.home-picks \.ui-feed-card__save \{ display:none; \}/);
  assert.match(CARDS, /\nhtml\[data-simple\] \.ui-row-card__save:not\(#saved \*\) \{ display:none; \}/, 'on html only: a data-simple=hide section (the /events picks) is not 简洁');
});
