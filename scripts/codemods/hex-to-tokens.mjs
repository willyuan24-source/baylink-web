#!/usr/bin/env node
// Codemod: hex colour literals in site CSS → the palette tokens of src/tokens.css (TOKENS-B; RC-9, SV-07, READ-02).
//
//   node scripts/codemods/hex-to-tokens.mjs [file.css …]          rewrite in place (default: every site CSS file)
//   node scripts/codemods/hex-to-tokens.mjs --check [file.css …]  exit 1 if a file still holds a hex colour
//   node scripts/codemods/hex-to-tokens.mjs --dry [file.css …]    print the mapping table, write nothing
//   --skip-selector=<regex>  leave rules whose selector matches (e.g. rules another lane is deleting)
//
// Re-runnable and idempotent: after a rebase, run it again instead of resolving colour conflicts by hand, then
// `npm run ratchet:update`. The palette is read from the `--color-<name>-rgb` channel tokens in src/tokens.css, so the
// codemod and the stylesheet can never disagree.
//
// How a colour is chosen (nearest in OKLab, https://bottosson.github.io/posts/oklab/):
//   color (text)    dark text → the nearest of the text tokens that pass WCAG AA (≥4.5:1) on every light surface
//                   (ink, ink-2, ink-3, brand, brand-hover, brand-deep, the status colours); light text (OKLab L ≥ .72,
//                   or any text in a rule that paints a dark background) → white, on-brand-muted, highlight or brand-tint,
//                   which pass on brand-deep. A grey-green #8b937f label (3.2:1) therefore becomes ink-3 (6.25:1).
//                   Emphasis inside a heading (`h1 em`, `.x-title strong`, `mark`) is an accent, not a label: a coloured
//                   one keeps its hue and snaps to the nearest of the coloured text tokens, so the olive `.about-hero h1
//                   em` (#69825a, 4.2:1) becomes brand (6.4:1) instead of turning grey.
//   anything else   backgrounds, borders, shadows, gradients, fills: the nearest palette colour, hue weighted over
//                   lightness so a tinted border keeps its family. Greens land on the brand family (success and its
//                   tint are left to status chips); keyboard-focus outlines become the brand ring.
//   status rules    a rule whose selector names an error (error|danger|invalid|fail|destructive) or a warning
//                   (warn|notice|caution), or that already paints var(--color-danger…) / var(--color-warning…), keeps
//                   that meaning: its warm colours (reds, browns, ambers; greys, greens and blues follow the rules above)
//                   take the status family instead of the nearest neutral. Text → danger / warning (the tint when the
//                   text is light, on a dark bubble); a near-white background → danger-tint / warning-tint; a pale border
//                   or tint → the status colour, translucent to the old lightness (`rgb(var(--color-danger-rgb) / .35)`);
//                   anything darker → the status colour. An "error" rule drawn in amber (its strongest warm colour has
//                   OKLab hue ≥ 70°, like `.member-baybay-error`) is a soft notice and takes the warning family.
//   alpha          #RRGGBBAA / #RGBA keep their alpha: `rgb(var(--color-brand-deep-rgb) / .13)`.
//   var() fallbacks `var(--color-bg, #fff)` drops the fallback when tokens.css defines the variable.
// Out of scope: url(…) contents (an SVG data URI cannot read a CSS variable), TS/TSX (runtime colours for maps, canvas
// and the resvg share cards need literal values), the 3D worlds (src/opus-bay/**, Little Bay) and src/tokens.css itself.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, posix } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import postcss from 'postcss';

const root = fileURLToPath(new URL('../..', import.meta.url));
export const HEX = /#(?:[\da-f]{8}|[\da-f]{6}|[\da-f]{3,4})(?![\w-])/gi;
const excluded = path => /^src\/(?:opus-bay\/|features\/little-bay\/|data\/generated\/)|little-bay\.css$|^src\/tokens\.css$/.test(path);

/** Text tokens that pass AA on every light surface token, and the light ones that pass on brand-deep. */
export const TEXT_DARK = ['ink', 'ink-2', 'ink-3', 'brand', 'brand-hover', 'brand-deep', 'warm', 'success', 'warning', 'danger', 'info', 'plum'];
export const TEXT_LIGHT = ['surface', 'on-brand-muted', 'highlight', 'brand-tint'];
const TEXT_NEUTRAL = ['ink', 'ink-2', 'ink-3'];
/** Emphasis inside a heading: the last compound of the selector is em / strong / mark under an h1–h3 or a *-title. */
const HEADING_ACCENT = /(?:^|[\s>+~(])(?:h[1-3]|[^\s>+~,()]*[.-]title(?:__head)?)(?![\w-])[^,+~]*[\s>]\s*(?:em|strong|mark)(?![\w-])[^\s>+~,]*$/i;
export const isHeadingAccent = selector => selector.split(',').some(part => HEADING_ACCENT.test(part.trim()));
/** Snapping targets. Success and its tint sit next to brand and brand-tint, so a legacy olive becomes the brand colour
 *  (one green family on a page, SV-07); success stays for status chips that ask for it by name. on-brand-muted is text
 *  on brand-deep, never a border. bg and selected share their values with surface and brand-tint. */
const TEXT_SNAP = TEXT_DARK.filter(name => name !== 'success');
/** Coloured text tokens: where a coloured accent snaps (never a grey). */
const TEXT_ACCENT = TEXT_SNAP.filter(name => !TEXT_NEUTRAL.includes(name));
const NOT_FOR_ANY = new Set(['bg', 'selected', 'success', 'success-tint', 'on-brand-muted']);

export const hexToRgb = hex => {
  let h = hex.replace('#', '');
  if (h.length <= 4) h = [...h].map(c => c + c).join('');
  const rgb = [0, 2, 4].map(i => Number.parseInt(h.slice(i, i + 2), 16));
  const alpha = h.length === 8 ? Number.parseInt(h.slice(6, 8), 16) / 255 : 1;
  return { rgb, alpha };
};
const linear = c => { const v = c / 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; };
export const oklab = ([r, g, b]) => {
  const [lr, lg, lb] = [r, g, b].map(linear);
  const l = Math.cbrt(.4122214708 * lr + .5363325363 * lg + .0514459929 * lb);
  const m = Math.cbrt(.2119034982 * lr + .6806995451 * lg + .1073969566 * lb);
  const s = Math.cbrt(.0883024619 * lr + .2817188376 * lg + .6299787005 * lb);
  return [.2104542553 * l + .793617785 * m - .0040720468 * s, 1.9779984951 * l - 2.428592205 * m + .4505937099 * s, .0259040371 * l + .7827717662 * m - .808675766 * s];
};
/** OKLab distance × 100; `lightness` < 1 lets hue and chroma count for more than lightness. */
const distance = (a, b, lightness = 1) => Math.hypot((a[0] - b[0]) * lightness, a[1] - b[1], a[2] - b[2]) * 100;
const hueOf = lab => Math.atan2(lab[2], lab[1]) * 180 / Math.PI;
const chromaOf = lab => Math.hypot(lab[1], lab[2]);

/** Status families (see "status rules" above): the selector words, and the tokens a warm colour in such a rule becomes. */
const DANGER_WORDS = /error|danger|invalid|fail|destructive/i;
const WARNING_WORDS = /warn|notice|caution/i;
export const STATUS_FAMILIES = { danger: { text: 'danger', tint: 'danger-tint' }, warning: { text: 'warning', tint: 'warning-tint' } };
/** A red, brown, orange or amber (not a grey, green, blue or plum): the colours a status rule draws its state with. */
const isWarm = lab => chromaOf(lab) >= .008 && hueOf(lab) >= -40 && hueOf(lab) <= 115;

/** The status family of a rule, or null. Read before any of its declarations is rewritten. */
export function statusFamily(rule) {
  if (rule?.type !== 'rule') return null;
  let token = null; let strongest = null;
  rule.each(node => {
    if (node.type !== 'decl') return;
    token ??= /var\(--color-(danger|warning)\b/.exec(node.value)?.[1] ?? null;
    const spans = urlSpans(node.value);
    for (const match of node.value.matchAll(HEX)) {
      if (spans.some(([start, end]) => match.index >= start && match.index < end)) continue;
      const lab = oklab(hexToRgb(match[0]).rgb);
      if (isWarm(lab) && (!strongest || chromaOf(lab) > chromaOf(strongest))) strongest = lab;
    }
  });
  if (DANGER_WORDS.test(rule.selector)) return strongest && hueOf(strongest) >= 70 ? 'warning' : 'danger';
  if (WARNING_WORDS.test(rule.selector)) return 'warning';
  return token;
}

/** The alpha (.15–.9 in .05 steps) at which `rgb` over white comes closest to the OKLab lightness `target`. */
const alphaForLightness = (rgb, target) => {
  let best = { alpha: 1, gap: Infinity };
  for (let step = 3; step <= 18; step++) {
    const alpha = step / 20;
    const gap = Math.abs(oklab(rgb.map(channel => channel * alpha + 255 * (1 - alpha)))[0] - target);
    if (gap < best.gap) best = { alpha, gap };
  }
  return best.alpha;
};

/** A warm colour in a status rule → { name, alpha } in its family; null leaves the colour to the ordinary snapping. */
export function statusToken(rgb, alpha, { role, prop = '', family, palette, forceDark = false, forceLight = false }) {
  const lab = oklab(rgb);
  const names = STATUS_FAMILIES[family];
  if (!names || role === 'focus' || !isWarm(lab) || !palette.has(names.text) || !palette.has(names.tint)) return null;
  const pick = name => ({ name, distance: distance(lab, oklab(palette.get(name))) });
  if (role === 'text') return { ...pick(!forceDark && (forceLight || lab[0] >= .72) ? names.tint : names.text), alpha };
  if (/^background/i.test(prop) && lab[0] >= .9) return { ...pick(names.tint), alpha };
  if (lab[0] < .7) return { ...pick(names.text), alpha };
  return { ...pick(names.text), alpha: Number((alpha * alphaForLightness(palette.get(names.text), lab[0])).toFixed(2)) };
}

/** The palette from tokens.css: every `--color-<name>-rgb: R G B` channel token. */
export function readPalette(tokensCss = readFileSync(join(root, 'src/tokens.css'), 'utf8')) {
  const palette = new Map();
  postcss.parse(tokensCss).walkDecls(/^--color-[a-z0-9-]+-rgb$/, declaration => {
    if (declaration.parent?.type !== 'rule' || declaration.parent.selector !== ':root') return;
    const channels = declaration.value.trim().split(/\s+/).map(Number);
    if (channels.length === 3 && channels.every(Number.isFinite)) palette.set(declaration.prop.slice('--color-'.length, -'-rgb'.length), channels);
  });
  return palette;
}

/** Every token name defined in tokens.css (for var() fallbacks). */
const definedNames = tokensCss => { const names = new Set(); postcss.parse(tokensCss).walkDecls(/^--/, declaration => names.add(declaration.prop)); return names; };

const roleOf = (declaration) => {
  const prop = declaration.prop.toLowerCase();
  // Keyboard focus is the shared brand ring (scripts/check-editorial-styles.mjs), whatever colour the old rule picked.
  if (/^outline(?:-color)?$/.test(prop) && declaration.parent?.type === 'rule' && /:focus/.test(declaration.parent.selector)) return 'focus';
  if (prop === 'color' || prop === '-webkit-text-fill-color' || prop === 'caret-color') return 'text';
  if (prop.startsWith('--')) return /(?:^--|-)(?:text|ink|fg|muted|title|label|copy)(?:-|$)/.test(prop) ? 'text' : 'any';
  return 'any';
};

/** The palette name closest to a colour for a role, with its distance. */
export function nearestToken(rgb, role, palette, context = {}) {
  const lab = oklab(rgb);
  let candidates = [...palette.keys()].filter(name => !NOT_FOR_ANY.has(name));
  let lightness = .6;
  if (role === 'focus') return { name: 'brand', distance: distance(lab, oklab(palette.get('brand'))) };
  if (role === 'text') {
    const light = context.forceDark ? false : context.forceLight ? true : lab[0] >= .72;
    // A grey stays a grey: low-chroma text never turns into a status colour, only into ink / ink-2 / ink-3.
    const grey = Math.hypot(lab[1], lab[2]) < .035;
    candidates = (light ? TEXT_LIGHT : grey ? TEXT_NEUTRAL : context.accent ? TEXT_ACCENT : TEXT_SNAP).filter(name => palette.has(name));
    lightness = .5;
  }
  let best = null;
  for (const name of candidates) {
    const d = distance(lab, oklab(palette.get(name)), lightness);
    if (!best || d < best.distance) best = { name, distance: d };
  }
  return best;
}

const alphaText = alpha => { const fixed = Number(alpha.toFixed(2)); return String(fixed).replace(/^0\./, '.'); };
export const tokenColor = (name, alpha) => alpha >= .995 ? `var(--color-${name})` : `rgb(var(--color-${name}-rgb) / ${alphaText(alpha)})`;

/** [start, end) spans of url(…) in a value: their contents are never rewritten. */
const urlSpans = value => {
  const spans = [];
  for (const match of value.matchAll(/url\(/gi)) {
    let depth = 0; let end = match.index;
    for (let i = match.index + 3; i < value.length; i++) { if (value[i] === '(') depth++; else if (value[i] === ')' && --depth === 0) { end = i + 1; break; } }
    spans.push([match.index, end]);
  }
  return spans;
};
const backgroundLightness = rule => {
  let lightness = null;
  rule.each(node => {
    if (node.type !== 'decl' || !/^background(?:-color)?$/i.test(node.prop)) return;
    const hex = node.value.match(HEX)?.[0];
    const variable = /var\(--color-([a-z0-9-]+?)\)/.exec(node.value)?.[1];
    if (hex) lightness = oklab(hexToRgb(hex).rgb)[0];
    else if (variable === 'brand' || variable === 'brand-hover' || variable === 'brand-deep' || variable === 'ink') lightness = .3;
  });
  return lightness;
};

/** Rewrite one stylesheet; returns { css, changes: [{hex, token, role, distance, selector}] }. */
export function rewriteCss(css, { palette, defined = new Set(), skipSelector } = {}) {
  const ast = postcss.parse(css);
  const changes = [];
  // A rule's status family is read on its first declaration, before any of them is rewritten.
  const families = new Map();
  ast.walkDecls(declaration => {
    const rule = declaration.parent;
    if (skipSelector && rule?.type === 'rule' && skipSelector.test(rule.selector)) return;
    if (!families.has(rule)) families.set(rule, statusFamily(rule));
    const family = families.get(rule);
    let value = declaration.value;
    // `var(--known-token, #hex)` → `var(--known-token)`.
    value = value.replace(/var\(\s*(--[a-z0-9-]+)\s*,\s*(#[\da-f]{3,8})\s*\)/gi, (whole, name) => defined.has(name) ? `var(${name})` : whole);
    if (!HEX.test(value)) { HEX.lastIndex = 0; if (value !== declaration.value) declaration.value = value; return; }
    HEX.lastIndex = 0;
    const role = roleOf(declaration);
    const spans = urlSpans(value);
    const background = role === 'text' && rule?.type === 'rule' ? backgroundLightness(rule) : null;
    const placeholder = rule?.type === 'rule' && /placeholder/.test(rule.selector);
    value = value.replace(HEX, (hex, offset) => {
      if (spans.some(([start, end]) => offset >= start && offset < end)) return hex;
      const { rgb, alpha } = hexToRgb(hex);
      const context = { forceDark: placeholder || (background !== null && background > .85), forceLight: background !== null && background < .5, accent: role === 'text' && rule?.type === 'rule' && isHeadingAccent(rule.selector) };
      const status = family ? statusToken(rgb, alpha, { role, prop: declaration.prop, family, palette, ...context }) : null;
      const best = status ?? { ...nearestToken(rgb, role, palette, context), alpha };
      changes.push({ hex: hex.toLowerCase(), token: best.name, alpha: Number(best.alpha.toFixed(2)), role, distance: Number(best.distance.toFixed(1)), selector: rule?.selector ?? declaration.prop, ...(status ? { status: family } : {}) });
      return tokenColor(best.name, best.alpha);
    });
    declaration.value = value;
  });
  return { css: ast.toString(), changes };
}

/** Hex colours left in a stylesheet outside url(…). */
export function remainingHex(css) {
  const left = [];
  postcss.parse(css).walkDecls(declaration => {
    const spans = urlSpans(declaration.value);
    for (const match of declaration.value.matchAll(HEX)) if (!spans.some(([start, end]) => match.index >= start && match.index < end)) left.push(`${declaration.parent?.selector ?? ''} ${declaration.prop}: ${match[0]}`);
  });
  return left;
}

export function siteStylesheets(base = root) {
  const files = [];
  const walk = directory => {
    for (const entry of readdirSync(join(base, directory), { withFileTypes: true })) {
      const path = posix.join(directory, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.name.endsWith('.css') && !excluded(path)) files.push(path);
    }
  };
  walk('src');
  return files.sort();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const check = args.includes('--check');
  const dry = args.includes('--dry');
  const skip = args.find(arg => arg.startsWith('--skip-selector='))?.slice('--skip-selector='.length);
  const listed = args.filter(arg => !arg.startsWith('--')).map(path => path.replaceAll('\\', '/'));
  const files = listed.length ? listed.filter(path => !excluded(path)) : siteStylesheets();
  const tokensCss = readFileSync(join(root, 'src/tokens.css'), 'utf8');
  const palette = readPalette(tokensCss);
  if (!palette.size) throw new Error('src/tokens.css defines no --color-<name>-rgb channel tokens');
  const defined = definedNames(tokensCss);
  let failures = 0; const all = [];
  for (const file of files) {
    const css = readFileSync(join(root, file), 'utf8');
    if (check) {
      const left = remainingHex(css);
      if (left.length) { failures++; console.error(`${file}: ${left.length} hex colour(s), e.g. ${left.slice(0, 3).join('; ')}`); }
      continue;
    }
    const { css: next, changes } = rewriteCss(css, { palette, defined, skipSelector: skip ? new RegExp(skip) : undefined });
    all.push(...changes.map(change => ({ ...change, file })));
    if (changes.length) console.log(`${file}: ${changes.length} colour(s)`);
    if (!dry && next !== css) writeFileSync(join(root, file), next);
  }
  if (check) { if (failures) process.exitCode = 1; else console.log(`No hex colours in ${files.length} stylesheet(s).`); }
  else {
    const byPair = new Map();
    for (const change of all) { const key = `${change.hex} → ${change.token} (${change.role})`; const entry = byPair.get(key) || { ...change, count: 0 }; entry.count++; byPair.set(key, entry); }
    const rows = [...byPair.entries()].sort((a, b) => b[1].distance - a[1].distance);
    console.log(`\n${all.length} colours in ${new Set(all.map(change => change.file)).size} files → ${new Set(all.map(change => change.token)).size} tokens. Largest moves (OKLab ×100):`);
    for (const [key, entry] of rows.slice(0, 40)) console.log(`  ${String(entry.distance).padStart(5)}  ${key} ×${entry.count}  e.g. ${entry.file} ${String(entry.selector).slice(0, 60)}`);
  }
}
