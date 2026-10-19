import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import postcss, { type Rule } from 'postcss';

// UI9-PREP split src/components/ui/ui.css into ui.css (the base controls, UI9-F), covers.css (UI9-C) and cards.css
// (UI9-EVENTS) without changing a rule. The three must keep arriving as the one file did: in one CSS chunk (the same
// importers) and in this order (a cover or card rule still follows the base rule it refines at the same specificity).
const sources = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
  const path = join(dir, entry.name);
  if (entry.isDirectory()) return entry.name === 'opus-bay' ? [] : sources(path);
  return /\.tsx?$/.test(entry.name) ? [path.replaceAll('\\', '/')] : [];
});
const IMPORT = /^import '((?:\.{1,2}\/)+(?:components\/ui\/)?)(ui|covers|cards)\.css';$/;

test('every module that imports ui.css imports covers.css and cards.css right after it, and no module imports them alone', () => {
  const importers: string[] = [];
  for (const file of sources('src')) {
    const lines = readFileSync(file, 'utf8').split(/\r?\n/);
    const sheets = lines.map((line, index) => ({ match: IMPORT.exec(line), index })).filter(item => item.match);
    if (!sheets.length) continue;
    importers.push(file);
    assert.deepEqual(sheets.map(item => item.match![2]), ['ui', 'covers', 'cards'], `${file}: ui, covers, cards`);
    assert.deepEqual(sheets.map(item => item.index - sheets[0].index), [0, 1, 2], `${file}: on consecutive lines`);
    assert.equal(new Set(sheets.map(item => item.match![1])).size, 1, `${file}: from one folder`);
  }
  // The 15 primitives that style themselves, plus the community board files that render ui- markup directly.
  assert.ok(importers.length >= 20, `${importers.length} importers`);
});

const rules = (name: string) => {
  const list: Rule[] = [];
  postcss.parse(readFileSync(`src/components/ui/${name}.css`, 'utf8')).walkRules(rule => { if (rule.parent?.type !== 'atrule' || !/keyframes$/i.test((rule.parent as postcss.AtRule).name)) list.push(rule); });
  return list;
};

test('each sheet holds its own part, and no selector is defined in two of them', () => {
  const owner = new Map<string, string>();
  for (const name of ['ui', 'covers', 'cards']) for (const rule of rules(name)) {
    const media = rule.parent?.type === 'atrule' ? `@${(rule.parent as postcss.AtRule).params} ` : '';
    const key = media + rule.selector.replace(/\s+/g, ' ');
    if (owner.has(key) && owner.get(key) !== name) assert.fail(`${key} is in ${owner.get(key)}.css and ${name}.css`);
    owner.set(key, name);
  }
  const where = (selector: string) => owner.get(selector);
  assert.equal(where('.ui-button'), 'ui');
  assert.equal(where('.ui-sheet'), 'ui');
  assert.equal(where('.ui-skeleton'), 'ui');
  assert.equal(where('.ui-page-header'), 'ui');
  assert.equal(where('.ui-provenance'), 'covers');
  assert.equal(where('.ui-sticker'), 'covers');
  assert.equal(where('.ui-status'), 'covers');
  assert.equal(where('.tc-cal'), 'covers');
  assert.equal(where('.ui-feed-grid'), 'cards');
  assert.equal(where('.ui-meta-price'), 'cards');
  assert.equal(where('.ui-row-card'), 'cards');
  assert.equal(where('.ui-hero-card'), 'cards');
  assert.equal(where('.ui-carousel'), 'cards');
  assert.equal(where('.ui-segmented'), 'cards');
  assert.equal(where('.ui-skeleton-card'), 'cards');
});

test('the order that decides equal-specificity rules is kept', () => {
  const index = (list: Rule[], selector: string, prop?: string) => list.findIndex(rule => rule.selector === selector && (!prop || rule.some(node => node.type === 'decl' && node.prop === prop)));
  const cards = rules('cards');
  // P07: the card titles' 2px room comes after their own margin:0 (same specificity), so margin-inline:-2px wins.
  const room = ':is(.ui-feed-card__title,.ui-row-card__title,.ui-hero-card__title)';
  for (const title of ['.ui-feed-card__title', '.ui-row-card__title', '.ui-hero-card__title']) assert.ok(index(cards, room, 'margin-inline') > index(cards, title, 'margin'), `${title}: the room follows margin:0`);
  // RV-14: under 360px the card titles break anywhere, after their base overflow-wrap:break-word.
  assert.ok(index(cards, ':is(.ui-row-card__title,.ui-feed-card__title)', 'overflow-wrap') > index(cards, '.ui-feed-card__title', 'overflow-wrap'));
  // ♡: .ui-save (position:relative, ui.css) loads before the card save slots that place it (position:absolute, cards.css).
  assert.ok(index(rules('ui'), '.ui-save', 'position') >= 0 && index(cards, '.ui-feed-card__save', 'position') >= 0 && index(cards, '.ui-hero-card__save', 'position') >= 0);
});
