import assert from 'node:assert/strict';
import test from 'node:test';
import { checkEditorialStyles, inspectEditorialStyles } from '../scripts/check-editorial-styles.mjs';

const tokens = ':root{--text-caption:calc(.8125rem * var(--reading-scale));--text-fact:calc(.875rem * var(--reading-scale));--reading-scale:1;--control-height:2.75rem;--color-brand:#176b52;--color-ink:#16352b}';

test('the reviewed guard catches fixed text sizes, stale focus colors, undersized controls and misspelled tokens', () => {
  const issues = checkEditorialStyles([{ file: 'changed.css', text: '.facts{font-size:12px;color:#888}a{min-height:30px}button:focus-visible{outline:2px solid gold}.source{font-size:var(--text-captino)}' }], tokens);
  for (const rule of ['reading-scale', 'text-color', 'touch-target', 'focus', 'token']) assert.ok(issues.some(issue => issue.rule === rule), rule);
  assert.ok(issues.every(issue => issue.file === 'changed.css' && issue.line === 1));
});

test('explicit boundaries exclude older rules and visual geometry without exempting newly revised controls', () => {
  const issues = checkEditorialStyles([
    { file: 'partial.css', after: '/* revised */', text: '.legacy{font-size:9px;color:#888}\n/* revised */\n.thumb{height:32px;background:#eee}\nbutton{min-height:var(--control-height);font-size:var(--text-fact)}\nbutton:focus-visible{outline:2px solid var(--color-brand)}' },
    { file: 'posts.css', selectors: /^\.post-translation(?:\s|$)/, text: '.post-old{font-size:10px}.post-translation{font-size:var(--text-caption);color:var(--color-ink)}.post-translation button{font-size:calc(1rem * var(--reading-scale));min-height:44px}' },
  ], tokens);
  assert.deepEqual(issues, []);
  const missing = checkEditorialStyles([{ file: 'partial.css', after: '/* revised */', text: '.legacy{font-size:9px}' }], tokens);
  assert.equal(missing[0].rule, 'scope', 'a renamed boundary cannot silently remove the guard');
});

test('a decorative glyph exception cannot exempt a label or another font size', () => {
  const exceptions = [{ selector: 'summary::after', property: 'font-size', value: '1rem', reason: 'Decorative plus glyph' }];
  assert.deepEqual(checkEditorialStyles([{ file: 'glyph.css', text: 'summary::after{font-size:1rem}', exceptions }], tokens), []);
  assert.equal(checkEditorialStyles([{ file: 'glyph.css', text: 'summary{font-size:1rem}', exceptions }], tokens)[0].rule, 'reading-scale');
  assert.equal(checkEditorialStyles([{ file: 'glyph.css', text: 'summary::after{font-size:10px}', exceptions }], tokens)[0].rule, 'reading-scale');
});

test('palette contrast checks catch a muted source color that is too faint even when it uses a token', () => {
  const palette = ':root{--color-bg:#ffffff;--color-surface:#ffffff;--color-ink:#16352b;--color-ink-2:#3f5247;--color-ink-3:#aaaaaa;--color-brand:#176b52;--color-on-brand-muted:#b6cbb9;--color-brand-deep:#123c31}';
  const issues = checkEditorialStyles([], palette, { contrast: true });
  assert.equal(issues.length, 2);
  assert.ok(issues.every(issue => issue.rule === 'contrast' && issue.message.startsWith('--color-ink-3')));
});

test('the reviewed site styles meet their scoped reading and shared palette guard', () => {
  assert.deepEqual(inspectEditorialStyles(), []);
});
