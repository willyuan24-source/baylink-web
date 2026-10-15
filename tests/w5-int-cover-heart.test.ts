import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import postcss from 'postcss';

// W5-INT (WEB-LINK-2 × WEB-VISUAL-2): the cover ♡ is styled once, globally (reader-library.css), and a TypeCover drawing
// starts below the ♡ in both card save slots: FeedCard (VISUAL-2) and HeroCard (the /events and home picks, LINK-2's ♡).
const cssFiles = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
  const path = join(dir, entry.name);
  if (entry.isDirectory()) return entry.name === 'opus-bay' ? [] : cssFiles(path);
  return entry.name.endsWith('.css') ? [path] : [];
});

test('one stylesheet draws the cover ♡ circle: reader-library.css', () => {
  const owners = cssFiles('src').filter(file => {
    let found = false;
    postcss.parse(readFileSync(file, 'utf8')).walkRules(rule => {
      if (['.ui-feed-card__save', '.ui-hero-card__save', '.saves-toggle'].every(part => rule.selector.includes(part))) found = true;
    });
    return found;
  }).map(file => file.replaceAll('\\', '/'));
  assert.deepEqual(owners, ['src/components/reader-library.css']);
});

test('a TypeCover drawing starts below the ♡ on FeedCard and HeroCard covers', () => {
  const shifts = new Map<string, string>();
  postcss.parse(readFileSync('src/components/ui/ui.css', 'utf8')).walkRules(rule => {
    if (!rule.selector.endsWith('.ui-type-cover')) return;
    rule.walkDecls('--tc-art-shift', declaration => { shifts.set(rule.selector, declaration.value); });
  });
  assert.equal(shifts.get('.ui-feed-card:has(>.ui-feed-card__save) .ui-type-cover'), '2.75rem', 'FeedCard: ♡ at 4px, 44px');
  // HeroCard's ♡ sits at 8px; the drawing's top is 3cqw + this shift, so the shift covers the ♡'s full height plus its inset.
  assert.equal(shifts.get('.ui-hero-card__media:has(>.ui-hero-card__save) .ui-type-cover'), 'calc(var(--control-height) + .5rem)');
  assert.match(readFileSync('src/components/ui/ui.css', 'utf8'), /\.ui-hero-card__save \{ position:absolute; top:8px; right:8px;/);
});
