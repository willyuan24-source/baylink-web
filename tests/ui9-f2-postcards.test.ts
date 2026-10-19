// UI9-F2: the AI 3D postcards (home ⑨ tile and 3D strip, the /explore rail) stay exactly as they were before tokens v2
// (captain decision 1: untouched in every mode, no lane hides, relabels, recrops or credits them). #50's radius codemod
// had rounded them to 16 / 10 and the badge weight codemod thinned their 3D 场景插图 badge to 400; UI9-F2 restored the
// 20 / 12 corners through two postcard-only tokens and the 600 badge. The rules are found by selector in every site
// stylesheet (src/**/*.css, the 3D worlds and generated data excluded), so moving them between sheets keeps this green.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import postcss, { type Rule } from 'postcss';

const excluded = /^src\/(?:opus-bay\/|features\/little-bay\/|data\/generated\/)|little-bay\.css$/;
function cssFiles(directory: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name).replaceAll('\\', '/');
    if (excluded.test(path) || excluded.test(`${path}/`)) continue;
    if (entry.isDirectory()) files.push(...cssFiles(path));
    else if (entry.name.endsWith('.css')) files.push(path);
  }
  return files;
}
const squash = (value: string) => value.replace(/\s+/g, ' ').replace(/\s*([>+~,])\s*/g, '$1').replace(/\(\s+/g, '(').replace(/\s+\)/g, ')').trim();

type Decl = { file: string; selector: string; prop: string; value: string };
const decls: Decl[] = [];
for (const file of cssFiles('src')) {
  postcss.parse(readFileSync(file, 'utf8'), { from: file }).walkDecls(decl => {
    const rule = decl.parent as Rule;
    if (rule?.type !== 'rule') return;
    for (const selector of rule.selectors) decls.push({ file, selector: squash(selector), prop: decl.prop.toLowerCase(), value: decl.value.trim() });
  });
}
const valueOf = (selector: string, prop: string) => decls.filter(d => d.selector === squash(selector) && d.prop === prop).map(d => d.value);

const POSTCARD_SCOPES = /\.home-3d(?![\w-])|\.home-3d-strip(?![\w-])|\.xp-3d__item(?![\w-])/;

test('the postcard corner tokens keep the pre-v2 values', () => {
  const root = decls.filter(d => d.file === 'src/tokens.css' && d.selector === ':root');
  assert.deepEqual(root.filter(d => d.prop === '--r-postcard').map(d => d.value), ['20px']);
  assert.deepEqual(root.filter(d => d.prop === '--r-postcard-sm').map(d => d.value), ['12px']);
});

test('the home 3D tile and strip and the /explore rail draw their postcards with the postcard corners', () => {
  assert.deepEqual(valueOf('.home-3d .ui-cover', 'border-radius'), ['var(--r-postcard)'], 'home ⑨ tile: 20');
  assert.deepEqual(valueOf('.home-3d-strip', 'border-radius'), ['var(--r-postcard)'], 'home 3D strip frame: 20');
  assert.deepEqual(valueOf('.home-3d-strip .home-3d-strip__art', 'border-radius'), ['var(--r-postcard-sm)'], 'home 3D strip art: 12');
  assert.deepEqual(valueOf('.xp-3d__item .ui-cover', 'border-radius'), ['var(--r-postcard-sm)'], '/explore 3D rail: 12');
  for (const d of decls.filter(d => /radius/.test(d.prop) && POSTCARD_SCOPES.test(d.selector) && /ui-cover|__art|^\.home-3d-strip$/.test(d.selector))) {
    assert.match(d.value, /^var\(--r-postcard(?:-sm)?\)$/, `${d.file}: "${d.selector}" changes a postcard's corners (${d.value})`);
  }
  const users = decls.filter(d => d.value.includes('--r-postcard') && !(d.file === 'src/tokens.css' && d.selector === ':root'));
  assert.equal(users.length, 4);
  for (const d of users) assert.ok(POSTCARD_SCOPES.test(d.selector), `${d.file}: "${d.selector}" uses a postcard-only radius token`);
});

test('the postcards keep their 600 provenance badge, above the 400 badge everywhere else', () => {
  const badge = decls.filter(d => d.prop === 'font-weight' && /\.ui-provenance$/.test(d.selector));
  assert.deepEqual(badge.filter(d => d.selector === '.ui-provenance').map(d => d.value), ['400']);
  const postcards = badge.filter(d => POSTCARD_SCOPES.test(d.selector));
  for (const scope of ['.home-3d', '.home-3d-strip', '.xp-3d__item']) {
    assert.ok(postcards.some(d => d.value === '600' && new RegExp(`${scope.replace('.', '\\.')}(?![\\w-])`).test(d.selector)), `${scope} badge stays 600`);
  }
});

test('no rule hides, recrops or relabels the postcards in any mode', () => {
  for (const d of decls.filter(d => POSTCARD_SCOPES.test(d.selector))) {
    const what = `${d.file}: "${d.selector}" { ${d.prop}:${d.value} }`;
    const subject = d.selector.split(/[\s>+~]+/).at(-1) ?? '';
    const postcard = /ui-cover|__art|ui-provenance|^\.home-3d(?:-strip)?(?![\w-])|^\.xp-3d__item(?![\w-])/.test(subject);
    if (/^(?:display|visibility)$/.test(d.prop) && /^(?:none|hidden)$/.test(d.value)) assert.ok(!postcard, `${what}: a postcard is hidden`);
    if (/ui-cover|__art|ui-cover__img/.test(d.selector)) assert.ok(!/^(?:object-fit|object-position|aspect-ratio|clip-path|filter)$/.test(d.prop), `${what}: the postcard crop is fixed by the cover component`);
    if (/ui-provenance/.test(d.selector)) assert.ok(!/^(?:display|visibility|content|clip)$/.test(d.prop), `${what}: the 3D 场景插图 badge stays visible`);
  }
});
