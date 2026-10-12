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

test('error and warning rules keep their status family instead of the nearest neutral or warm colour', () => {
  // The import dialog's error box (event-import.css): a pink border, a pink-white ground and red-brown text.
  assert.equal(run('.event-error{background:#fff1ed;border:1px solid #e8c4b9;color:#923e2c}').css,
    '.event-error{background:var(--color-danger-tint);border:1px solid rgb(var(--color-danger-rgb) / .3);color:var(--color-danger)}');
  // The delete-account zone keeps a red border; a cream ground in an error rule is the danger tint, not surface-2.
  assert.equal(run('.account-privacy .account-privacy-danger{border-color:#e2b4ad}').css, '.account-privacy .account-privacy-danger{border-color:rgb(var(--color-danger-rgb) / .35)}');
  assert.equal(run('.bookmark-error{border:1px solid #ecd2c5;background:#fff9f2;color:#813f27}').css,
    '.bookmark-error{border:1px solid rgb(var(--color-danger-rgb) / .2);background:var(--color-danger-tint);color:var(--color-danger)}');
  assert.equal(run('.chat-ai-error{color:#95563e}').css, '.chat-ai-error{color:var(--color-danger)}');
  assert.equal(run('input:invalid{border-color:#c0392b}').css, 'input:invalid{border-color:var(--color-danger)}');
  // Light text in a failed state on a dark bubble stays light and warm (the tint), not brand-tint green.
  assert.equal(run('.modern-chat-delivery.is-failed{border-top:1px solid #ffffff35;color:#fff2d8}').css,
    '.modern-chat-delivery.is-failed{border-top:1px solid rgb(var(--color-surface-rgb) / .21);color:var(--color-warning-tint)}');
  // Warnings and notices: the warning family; an "error" rule drawn in amber is a soft notice and takes it too.
  assert.equal(run('.booking-notification-warning{background:#fff4dc;border:1px solid #e8d8b7;color:#775f30}').css,
    '.booking-notification-warning{background:var(--color-warning-tint);border:1px solid rgb(var(--color-warning-rgb) / .25);color:var(--color-warning)}');
  assert.equal(run('.member-baybay-error{border:1px solid #efdcbf;color:#805f2e}').css, '.member-baybay-error{border:1px solid rgb(var(--color-warning-rgb) / .2);color:var(--color-warning)}');
  // A rule that already paints a status token is a status rule whatever its name.
  assert.equal(run('.booking-alert{background:#fff1ea;color:var(--color-danger);border:1px solid #efd1c5}').css,
    '.booking-alert{background:var(--color-danger-tint);color:var(--color-danger);border:1px solid rgb(var(--color-danger-rgb) / .2)}');
  // Only warm colours change family: white, greys and a green retry link inside an error box snap as usual.
  assert.equal(run('.baybay-request-error button{color:#496140;background:#fff}').css, '.baybay-request-error button{color:var(--color-ink-2);background:var(--color-surface)}');
  assert.equal(run('.form-error:focus-visible{outline:2px solid #c0392b}').css, '.form-error:focus-visible{outline:2px solid var(--color-brand)}', 'focus stays the brand ring');
  // Ordinary rules are unchanged: a warm label is still warm, a pale warm border still a neutral line.
  assert.equal(run('.offer{color:#923e2c;border:1px solid #e8c4b9}').css, '.offer{color:var(--color-warm);border:1px solid var(--color-line-strong)}');
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
