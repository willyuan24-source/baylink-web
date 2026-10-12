import assert from 'node:assert/strict';
import test from 'node:test';
import { TEXT_DARK, TEXT_LIGHT, isHeadingAccent, readPalette, remainingHex, rewriteCss } from '../scripts/codemods/hex-to-tokens.mjs';

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

test('emphasis inside a heading is an accent: a coloured one stays coloured (brand family), a grey one stays grey', () => {
  // The olive accents of the /about and /plan heroes (#69825a 4.2:1, #6e8862) would otherwise turn ink-3 like a label.
  assert.equal(run('.about-hero h1 em{font-style:normal;color:#69825a}').css, '.about-hero h1 em{font-style:normal;color:var(--color-brand)}');
  assert.equal(run('.planner-hero h1 em{color:#6e8862}').css, '.planner-hero h1 em{color:var(--color-brand)}');
  assert.equal(run('.x-title strong{color:#a0562e}').css, '.x-title strong{color:var(--color-warm)}');
  assert.equal(run('.t h2 em{color:#8b937f}').css, '.t h2 em{color:var(--color-ink-3)}', 'a grey accent stays a grey');
  assert.equal(run('.lead em{color:#69825a}').css, '.lead em{color:var(--color-ink-3)}', 'emphasis outside a heading is running text');
  for (const selector of ['.about-hero h1 em', 'h3 mark:hover', '.gd-title__head em', '.a,.b h2>strong']) assert.ok(isHeadingAccent(selector), selector);
  for (const selector of ['.about-hero h1', '.a em', '.card h2 + p em', '.card h2 ~ p strong']) assert.ok(!isHeadingAccent(selector), selector);
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
