import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import postcss from 'postcss';

// W5-INT (WEB-LINK-2 × WEB-VISUAL-2): the cover ♡ is styled once, globally (saves.css; reader-library.css until UI9-PREP), and a TypeCover drawing
// starts below the ♡ in both card save slots: FeedCard (VISUAL-2) and HeroCard (the /events and home picks, LINK-2's ♡).
const cssFiles = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
  const path = join(dir, entry.name);
  if (entry.isDirectory()) return entry.name === 'opus-bay' ? [] : cssFiles(path);
  return entry.name.endsWith('.css') ? [path] : [];
});

test('one stylesheet draws the cover ♡ circle: saves.css', () => {
  const owners = cssFiles('src').filter(file => {
    let found = false;
    postcss.parse(readFileSync(file, 'utf8')).walkRules(rule => {
      if (['.ui-feed-card__save', '.ui-hero-card__save', '.saves-toggle'].every(part => rule.selector.includes(part))) found = true;
    });
    return found;
  }).map(file => file.replaceAll('\\', '/'));
  assert.deepEqual(owners, ['src/features/saves/saves.css']);
  // The circle sits at its slot's corner: the compact control's in-flow top margin (8px) is reset inside a card save slot,
  // later in the same file and at the same specificity, so the ♡ is not pushed onto the drawing (measured in Chrome:
  // 1–4 cards per page overlapped at 390 and 1440 before, none after).
  const order: string[] = [];
  const margins = new Map<string, string>();
  postcss.parse(readFileSync('src/features/saves/saves.css', 'utf8')).walkRules(rule => {
    rule.walkDecls('margin', declaration => { order.push(rule.selector); margins.set(rule.selector, declaration.value); });
  });
  const slot = ':is(.ui-feed-card__save,.ui-hero-card__save) .saves-control';
  assert.equal(margins.get('.saves-control[data-compact]'), '8px 0 0');
  assert.equal(margins.get(slot), '0');
  assert.ok(order.indexOf(slot) > order.indexOf('.saves-control[data-compact]'), 'the reset comes after the compact margin');
});

test('the ♡ sits in a cover’s top-right corner, clear of its one bottom-left badge (UI9-IMAGES DECISIONS 23)', () => {
  // A picture carries only the ♡ (top-right, the card's) and its badge (bottom-left): the two never meet.
  assert.match(readFileSync('src/components/ui/covers.css', 'utf8'), /\.ui-cover>\.ui-provenance\[data-chip\] \{ top:auto; right:auto; bottom:var\(--sp-2\); left:var\(--sp-2\);/);
  assert.match(readFileSync('src/components/ui/cards.css', 'utf8'), /\.ui-hero-card__save \{ position:absolute; top:8px; right:8px;/);
  assert.match(readFileSync('src/components/ui/cards.css', 'utf8'), /\.ui-feed-card__save \{ position:absolute; top:var\(--sp-1\); right:var\(--sp-1\);/);
});
