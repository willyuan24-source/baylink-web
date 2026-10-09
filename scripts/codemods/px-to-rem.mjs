#!/usr/bin/env node
// Codemod: text sizes px → rem, so the root Aa setting (html[data-reading]) scales every line of site text (D5, RC-26).
//
//   node scripts/codemods/px-to-rem.mjs          rewrite in place, print a per-file summary
//   node scripts/codemods/px-to-rem.mjs --check  exit 1 if a site file still sets text in px or multiplies by --reading-scale
//
// Re-runnable and idempotent: after a rebase, run it again instead of resolving text-size conflicts by hand.
//
// What changes (1rem = 16px at the standard size, so the standard page is pixel-identical):
//   CSS   font-size / line-height / font shorthand: every px term → rem (`13px` → `.8125rem`, `max(16px,…)` → `max(1rem,…)`)
//         `calc(X * var(--reading-scale))` → `X`: the root now scales X, and multiplying again would give 125% × 1.25 = 156%
//         viewport terms in a font-size (`clamp(30px,4vw,46px)`) → `calc(4vw * var(--fluid-scale))`, so a heading that sits
//         in the fluid middle of its clamp grows with Aa like everything else (--fluid-scale is 1 / 1.125 / 1.25)
//         `@apply text-[13px]` / `leading-[20px]` → rem, like the TSX classes
//   TSX   Tailwind arbitrary `text-[11px]` → `text-[0.6875rem]` (any variant prefix), `leading-[Npx]` → rem
//         inline React `fontSize: 13` / `fontSize: '13px'` / `lineHeight: '20px'` → `'0.8125rem'`
// Out of scope: the Opus Bay game (src/opus-bay/**, its static first paint OpusBayShell.tsx) and Little Bay (any path
// containing "little-bay"), which keep their own px HUD geometry; Avatar.tsx sizes the initials to a px circle.
// Spacing, borders, radii and icon sizes stay px on purpose: gutters do not grow with Aa (design.md §4.2).
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';

const root = fileURLToPath(new URL('../..', import.meta.url));
const EXCLUDED_FILES = new Set(['src/components/OpusBayShell.tsx', 'src/components/Avatar.tsx']);
const excluded = path => {
  const posix = path.split(sep).join('/');
  return posix.startsWith('src/opus-bay/') || /little-bay/i.test(posix) || EXCLUDED_FILES.has(posix);
};

/** 13 → ".8125" (CSS style, no leading zero) or "0.8125" (Tailwind/React style). */
export function remNumber(px, leadingZero = false) {
  const value = Number((Number(px) / 16).toFixed(6));
  const text = String(value);
  if (leadingZero) return text;
  return text.replace(/^(-?)0\./, '$1.');
}

const PX = /(-?(?:\d+\.?\d*|\.\d+))px\b/g;
const pxToRem = (value, leadingZero) => value.replace(PX, (whole, number) => Number(number) === 0 ? whole : `${remNumber(number, leadingZero)}rem`);

/** Index of the parenthesis that closes the one at `open`. */
function closing(text, open) {
  let depth = 0;
  for (let index = open; index < text.length; index++) {
    if (text[index] === '(') depth++;
    else if (text[index] === ')' && --depth === 0) return index;
  }
  return -1;
}

/** `calc(X * var(--reading-scale))` → `X` (X keeps its own parentheses); other calc() forms are left for a hand edit. */
export function stripReadingScale(value) {
  let result = value;
  for (let guard = 0; guard < 50; guard++) {
    const marker = /\*\s*var\(--reading-scale\)\s*\)/.exec(result);
    if (!marker) break;
    // walk back to the calc( that this `* var(--reading-scale))` closes
    let start = -1;
    for (let index = result.lastIndexOf('calc(', marker.index); index >= 0; index = result.lastIndexOf('calc(', index - 1)) {
      if (closing(result, index + 4) === marker.index + marker[0].length - 1) { start = index; break; }
      if (index === 0) break;
    }
    if (start < 0) break;
    const inner = result.slice(start + 5, marker.index).trim();
    // a sum inside needs its calc(); a single term or function does not
    let depth = 0, topLevelSum = false;
    for (let index = 0; index < inner.length; index++) {
      const char = inner[index];
      if (char === '(') depth++; else if (char === ')') depth--;
      else if (depth === 0 && (char === '+' || char === '-') && index > 0 && /\s/.test(inner[index - 1])) topLevelSum = true;
    }
    result = result.slice(0, start) + (topLevelSum ? `calc(${inner})` : inner) + result.slice(marker.index + marker[0].length);
  }
  return result;
}

const VIEWPORT = /(?<![\w.(-])(\d+\.?\d*|\.\d+)(vw|vh|vmin|vmax|svw|svh|dvw|dvh|lvw|lvh|cqw|cqi)\b/g;
/** `4vw` → `calc(4vw * var(--fluid-scale))` inside a font-size; already wrapped terms are left alone. */
export function scaleViewportTerms(value) {
  if (value.includes('--fluid-scale')) return value;
  return value.replace(VIEWPORT, (whole, number, unit) => `calc(${number}${unit} * var(--fluid-scale))`);
}

const TAILWIND_TEXT = /((?:^|[\s"'`{:])(?:[\w-]+:)*(?:text|leading))-\[(-?(?:\d+\.?\d*|\.\d+))px\]/g;
const rewriteTailwind = (text, changes) => text.replace(TAILWIND_TEXT, (whole, prefix, number) => {
  const next = `${prefix}-[${remNumber(number, true)}rem]`;
  changes.push(`${whole.trim()}→${next.trim()}`);
  return next;
});

/** Rewrites one stylesheet; formatting (including minified one-line files) is preserved outside the changed values. */
export function rewriteCss(text) {
  const tree = postcss.parse(text);
  const changes = [];
  tree.walkAtRules('apply', rule => {
    rule.params = rewriteTailwind(rule.params, changes);
  });
  // a selector that targets a converted utility (`[class*="text-[11px]"]`, `.text-\[11px\]`) follows it to rem
  tree.walkRules(rule => {
    const selector = rule.selector
      .replace(/(\[class[*^$~|]?=["'][^"']*?\b(?:text|leading)-\[)(\d+\.?\d*)px\]/g, (whole, prefix, px) => `${prefix}${remNumber(px, true)}rem]`)
      .replace(/(\.(?:[\w-]+\\:)*(?:text|leading)-\\\[)(\d+\.?\d*)px\\\]/g, (whole, prefix, px) => `${prefix}${remNumber(px, true).replace('.', '\\.')}rem\\]`);
    if (selector === rule.selector) return;
    changes.push(`selector ${rule.selector} → ${selector}`);
    rule.selector = selector;
  });
  tree.walkDecls(declaration => {
    const { prop } = declaration;
    if (prop !== 'font-size' && prop !== 'line-height' && prop !== 'font') return;
    const before = declaration.value;
    let value = stripReadingScale(before);
    value = pxToRem(value, false);
    if (prop === 'font-size') value = scaleViewportTerms(value);
    if (value === before) return;
    changes.push(`${declaration.parent?.selector || ''} ${prop}: ${before} → ${value}`);
    declaration.value = value;
  });
  return { text: changes.length ? tree.toString() : text, changes };
}

/** Rewrites Tailwind arbitrary text sizes (TSX and TS) and inline React fontSize / lineHeight values (TSX only: a .ts
 *  fontSize is usually SVG or canvas geometry, such as the share-card renderer). */
export function rewriteTsx(text, { inlineStyles = true } = {}) {
  const changes = [];
  let next = rewriteTailwind(text, changes);
  if (!inlineStyles) return { text: next, changes };
  next = next.replace(/(\bfontSize:\s*)(?:(\d+\.?\d*)(?![\w.%])|(['"])(\d+\.?\d*)px\3)/g, (whole, prefix, bare, quote, quoted) => {
    const px = bare ?? quoted;
    const value = `${prefix}${quote || "'"}${remNumber(px, true)}rem${quote || "'"}`;
    changes.push(`${whole}→${value.slice(prefix.length)}`);
    return value;
  });
  next = next.replace(/(\blineHeight:\s*)(['"])(\d+\.?\d*)px\2/g, (whole, prefix, quote, px) => {
    const value = `${prefix}${quote}${remNumber(px, true)}rem${quote}`;
    changes.push(`${whole}→${value.slice(prefix.length)}`);
    return value;
  });
  return { text: next, changes };
}

const walk = dir => readdirSync(dir).flatMap(name => {
  const path = join(dir, name);
  return statSync(path).isDirectory() ? walk(path) : [path];
});

export function siteFiles() {
  return walk(join(root, 'src'))
    .map(path => relative(root, path))
    .filter(path => !excluded(path) && /\.(css|tsx|ts)$/.test(path) && !/\.d\.ts$/.test(path));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const check = process.argv.includes('--check');
  let total = 0;
  for (const file of siteFiles()) {
    const path = join(root, file);
    const source = readFileSync(path, 'utf8');
    const { text, changes } = file.endsWith('.css') ? rewriteCss(source) : rewriteTsx(source, { inlineStyles: file.endsWith('.tsx') });
    if (!changes.length) continue;
    total += changes.length;
    console.log(`${file}: ${changes.length}`);
    if (!check) writeFileSync(path, text);
  }
  console.log(check ? `${total} px text size(s) or --reading-scale multiplier(s) left` : `rewrote ${total} text size(s)`);
  if (check && total) process.exitCode = 1;
}
