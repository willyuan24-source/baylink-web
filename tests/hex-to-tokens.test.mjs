import assert from 'node:assert/strict';
import test from 'node:test';
import { TEXT_DARK, TEXT_LIGHT, readPalette, remainingHex, rewriteCss } from '../scripts/codemods/hex-to-tokens.mjs';

// The hex → token codemod (TOKENS-B): role-aware snapping onto the palette in src/tokens.css.
const palette = readPalette();
const run = (css, options = {}) => rewriteCss(css, { palette, defined: new Set(['--color-bg', '--color-ink']), ...options });

test('the palette comes from the channel tokens in src/tokens.css, and the codemod text sets are all in it', () => {
  assert.deepEqual(palette.get('brand'), [9, 107, 84]);
  assert.deepEqual(palette.get('ink-3'), [84, 100, 94]);
  for (const name of [...TEXT_DARK, ...TEXT_LIGHT]) assert.ok(palette.has(name), name);
});

test('exact and near colours become the token; alpha survives as rgb(var(--…-rgb) / a)', () => {
  assert.equal(run('.a{border:1px solid #176b52}').css, '.a{border:1px solid var(--color-brand)}');
  assert.equal(run('.a{background:#123c31}').css, '.a{background:var(--color-brand-deep)}');
  assert.equal(run('.a{box-shadow:0 2px 8px #123c3120}').css, '.a{box-shadow:0 2px 8px rgb(var(--color-brand-deep-rgb) / .13)}');
  assert.equal(run('.a{background:#FFF}').css, '.a{background:var(--color-surface)}');
});

test('text snaps to an AA-safe text token: grey-green labels become ink-3, light text on dark stays light', () => {
  // READ-02: #8b937f (3.2:1 on white) and #748064 (4.19:1) are the calendar tag and 活动详情 colours the audit named.
  assert.equal(run('.tag{color:#8b937f}').css, '.tag{color:var(--color-ink-3)}');
  assert.equal(run('.more{color:#748064}').css, '.more{color:var(--color-ink-3)}');
  assert.equal(run('.title{color:#1c3029}').css, '.title{color:var(--color-ink)}');
  assert.equal(run('.hero p{color:#b6cbb9}').css, '.hero p{color:var(--color-on-brand-muted)}');
  assert.equal(run('.dark{background:#123c31;color:#9bb49c}').css, '.dark{background:var(--color-brand-deep);color:var(--color-on-brand-muted)}', 'a dark background in the same rule keeps the text light');
  assert.equal(run('input::placeholder{color:#a0aa99}').css, 'input::placeholder{color:var(--color-ink-3)}', 'placeholders sit on light inputs');
});

test('url() contents, known var() fallbacks and skipped selectors', () => {
  const svg = '.a{background:url("data:image/svg+xml;utf8,<svg fill=\'#123c31\'/>") no-repeat,#f4f7f5}';
  assert.equal(run(svg).css, '.a{background:url("data:image/svg+xml;utf8,<svg fill=\'#123c31\'/>") no-repeat,var(--color-surface-2)}');
  assert.equal(run('.a{background:var(--color-bg, #FFFFFF)}').css, '.a{background:var(--color-bg)}');
  assert.equal(run('.a{color:var(--legacy, #1c3029)}').css, '.a{color:var(--legacy, var(--color-ink))}');
  assert.equal(run('.bay-category-x{color:#1c3029}.b{color:#1c3029}', { skipSelector: /^\.bay-category-/ }).css, '.bay-category-x{color:#1c3029}.b{color:var(--color-ink)}');
});

test('idempotent, minified files stay one line, and --check finds what is left', () => {
  const once = run('.a{color:#66835b}.b{border-color:#e2e7df;background:#eef1e8}').css;
  assert.equal(run(once).css, once);
  assert.doesNotMatch(once, /\n/);
  assert.deepEqual(remainingHex(once), []);
  assert.equal(remainingHex('.a{color:#fff;background:url(#x)}').length, 1);
});
