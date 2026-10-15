import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import postcss from 'postcss';
import { rewriteTracking } from '../scripts/codemods/heading-tracking.mjs';
import { siteStylesheets } from '../scripts/codemods/hex-to-tokens.mjs';

// SV-06 / SV-09 (VISUAL-SYS): one type scale for H1/H2/H3 and one page frame, as tokens in src/tokens.css.
const tokens = postcss.parse(readFileSync('src/tokens.css', 'utf8'));
const declared = (selector: string, media?: string) => {
  const found = new Map<string, string>();
  tokens.walkRules(rule => {
    const parent = rule.parent as postcss.AtRule | postcss.Root;
    const inMedia = parent.type === 'atrule' ? parent.params.replace(/\s+/g, '') : undefined;
    if (rule.selector === selector && inMedia === media) rule.walkDecls(declaration => { found.set(declaration.prop, declaration.value); });
  });
  return found;
};

test('the scale: phone values in :root, desktop at 1024px; display grows with Aa through --fluid-scale', () => {
  const phone = declared(':root');
  assert.equal(phone.get('--text-display'), '1.75rem'); assert.equal(phone.get('--lh-display'), '1.286');   // 28/36
  assert.equal(phone.get('--text-title'), '1.625rem'); assert.equal(phone.get('--lh-title'), '1.308');       // 26/34
  assert.equal(phone.get('--text-section'), '1.375rem'); assert.equal(phone.get('--lh-section'), '1.364');   // 22/30
  const desktop = declared(':root', '(min-width:1024px)');
  assert.equal(desktop.get('--text-title'), '2rem'); assert.equal(desktop.get('--lh-title'), '1.3125');      // 32/42
  assert.equal(desktop.get('--text-section'), '1.5rem'); assert.equal(desktop.get('--lh-section'), '1.333'); // 24/32
  assert.match(desktop.get('--text-display') ?? '', /^clamp\(2\.5rem, calc\(1\.6rem \+ 1\.25vw \* var\(--fluid-scale\)\), 3\.25rem\)$/); // 40–52, ≈44 at 1440
  const at1440 = 1.6 * 16 + 1.25 * 14.4;
  assert.ok(at1440 > 43 && at1440 < 45, `${at1440}px at 1440`);
});

test('the heading classes: 600, letter-spacing 0, the scale tokens', () => {
  const shared = declared('.type-display,.type-title,.type-section');
  assert.equal(shared.get('font-weight'), '600');
  assert.equal(shared.get('letter-spacing'), '0');
  for (const level of ['display', 'title', 'section']) {
    const rule = declared(`.type-${level}`);
    assert.equal(rule.get('font-size'), `var(--text-${level})`);
    assert.equal(rule.get('line-height'), `var(--lh-${level})`);
  }
});

test('one page frame: .site-container and the WEB-UI PageContainer read the same tokens (112–1328 at 1440)', () => {
  const root = declared(':root');
  assert.equal(root.get('--container-wide'), '1216px');
  assert.equal(root.get('--container-content'), '960px');
  assert.equal(root.get('--container-reading'), '720px');
  assert.equal(declared(':root', '(min-width:1024px)').get('--page-gutter'), '32px');
  const site = declared('.site-container');
  assert.equal(site.get('max-width'), 'var(--container-wide)');
  assert.equal(site.get('padding-inline'), 'var(--page-gutter)');
  // In the 1280px .site-main of a 1440 window: (1280 − 1216) / 2 = 32 = the gutter, so content starts at 80 + 32 = 112.
  assert.equal((1440 - 1280) / 2 + 32, 112);
  const ui = readFileSync('src/components/ui/ui.css', 'utf8');
  assert.match(ui, /\.ui-container \{[^}]*max-width:var\(--container-wide\);[^}]*padding-inline:var\(--page-gutter\)/);
  // H30: the page title reads the H1 token, which is the title tier (one H1 spec on every page but the display tier).
  assert.match(ui, /\.ui-page-header__title \{[^}]*font-size:var\(--text-h1\); line-height:var\(--lh-h1\)/);
  assert.equal(root.get('--text-h1'), 'var(--text-title)');
  assert.equal(root.get('--lh-h1'), 'var(--lh-title)');
});

test('no negative letter-spacing on headings, except in the files of lanes still in flight', () => {
  // These files belong to lanes that were running when the scale landed (docs/design-tokens.md); each lane adopts the
  // scale in its own template and removes its file here. Nothing may be added to the list.
  // W3 integration: WEB-HOME, WEB-DETAIL, WEB-SECONDARY and WEB-PLAN landed with the scale; languages.css went through the codemod.
  // W4 integration: WEB-COMMUNITY deleted the .bay-category-* rules and its files went through both codemods; the list is empty.
  const pending = new Set<string>([]);
  const offenders: string[] = [];
  for (const file of siteStylesheets() as string[]) {
    const { changes } = rewriteTracking(readFileSync(file, 'utf8'));
    if (changes.length && !pending.has(file)) offenders.push(`${file}: ${changes.map(change => `${change.selector} ${change.from}`).join('; ')}`);
  }
  assert.deepEqual(offenders, []);
  assert.equal(rewriteTracking('.a h2{letter-spacing:-.03em}.b strong{letter-spacing:-.02em}.c-title{letter-spacing:-1px}.card h2 + p{letter-spacing:-.01em}').css, '.a h2{letter-spacing:0}.b strong{letter-spacing:-.02em}.c-title{letter-spacing:0}.card h2 + p{letter-spacing:-.01em}', 'a heading is the selector subject, as in the hex codemod');
});
