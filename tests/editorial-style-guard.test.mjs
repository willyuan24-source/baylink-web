import assert from 'node:assert/strict';
import test from 'node:test';
import { checkEditorialStyles, inspectEditorialStyles } from '../scripts/check-editorial-styles.mjs';

const tokens = ':root{--text-caption:.8125rem;--text-fact:.875rem;--text-body:1rem;--reading-scale:1;--fluid-scale:1;--control-height:2.75rem;--color-brand:#176b52;--color-ink:#16352b}';

test('the reviewed guard catches fixed text sizes, stale focus colors, undersized controls and misspelled tokens', () => {
  const issues = checkEditorialStyles([{ file: 'changed.css', text: '.facts{font-size:12px;color:#888}a{min-height:30px}button:focus-visible{outline:2px solid gold}.source{font-size:var(--text-captino)}' }], tokens);
  for (const rule of ['reading-scale', 'text-color', 'touch-target', 'focus', 'token']) assert.ok(issues.some(issue => issue.rule === rule), rule);
  assert.ok(issues.every(issue => issue.file === 'changed.css' && issue.line === 1));
});

test('explicit boundaries exclude older rules and visual geometry without exempting newly revised controls', () => {
  const issues = checkEditorialStyles([
    { file: 'partial.css', after: '/* revised */', text: '.legacy{font-size:9px;color:#888}\n/* revised */\n.thumb{height:32px;background:#eee}\nbutton{min-height:var(--control-height);font-size:var(--text-fact)}\nbutton:focus-visible{outline:2px solid var(--color-brand)}' },
    { file: 'posts.css', selectors: /^\.post-translation(?:\s|$)/, text: '.post-old{font-size:10px}.post-translation{font-size:var(--text-caption);color:var(--color-ink)}.post-translation button{font-size:1rem;min-height:44px}' },
  ], tokens);
  assert.deepEqual(issues, []);
  const missing = checkEditorialStyles([{ file: 'partial.css', after: '/* revised */', text: '.legacy{font-size:9px}' }], tokens);
  assert.equal(missing[0].rule, 'scope', 'a renamed boundary cannot silently remove the guard');
});

test('a decorative glyph exception cannot exempt a label or another font size', () => {
  const exceptions = [{ selector: 'summary::after', property: 'font-size', value: '18px', reason: 'Decorative plus glyph' }];
  assert.deepEqual(checkEditorialStyles([{ file: 'glyph.css', text: 'summary::after{font-size:18px}', exceptions }], tokens), []);
  assert.equal(checkEditorialStyles([{ file: 'glyph.css', text: 'summary{font-size:18px}', exceptions }], tokens)[0].rule, 'reading-scale');
  assert.equal(checkEditorialStyles([{ file: 'glyph.css', text: 'summary::after{font-size:10px}', exceptions }], tokens)[0].rule, 'reading-scale');
});

test('with root Aa, rem / em / % / tokens grow; px, a second --reading-scale and a bare vw term do not', () => {
  const sizes = value => checkEditorialStyles([{ file: 'sizes.css', text: `.x{font-size:${value}}` }], tokens).map(issue => issue.rule);
  for (const value of ['1rem', '.8125rem', '.9em', '90%', 'inherit', 'var(--text-fact)', 'max(1rem,var(--text-body))', 'clamp(1.875rem,calc(4vw * var(--fluid-scale)),2.875rem)']) assert.deepEqual(sizes(value), [], value);
  for (const value of ['13px', 'max(16px,var(--text-body))', 'calc(2rem * var(--reading-scale))', 'clamp(1.875rem,4vw,2.875rem)']) assert.deepEqual(sizes(value), ['reading-scale'], value);
  assert.deepEqual(checkEditorialStyles([{ file: 'font.css', text: '.x{font:600 12px/1.4 sans-serif}.y{font:600 .75rem/1.4 sans-serif}' }], tokens).map(issue => issue.selector), ['.x']);
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
