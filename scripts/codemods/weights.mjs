#!/usr/bin/env node
// Codemod: font weights → 400 / 600 / 700 only (design system v2, SYS-08).
//
//   node scripts/codemods/weights.mjs          rewrite in place, print a per-file summary
//   node scripts/codemods/weights.mjs --check  exit 1 if any site file still uses another weight
//
// Re-runnable and idempotent: after a rebase, run it again instead of resolving weight conflicts by hand.
// Scope: every CSS file under src/ plus inline `fontWeight` numbers in TSX, except the Opus Bay game
// (src/opus-bay/**) and Little Bay (any path containing "little-bay"), which keep their own type.
//
// Mapping. Windows renders 650 as Bold and 750 as Black in Segoe UI (1005 VIS-03); on Apple and in the CJK
// fonts the retired values already snap to the nearest real face, so most CJK text does not move.
//   100–300 → 400   500 → 400   550 → 600   650 → 600   750 / 760 / 800 / 900 → 700
// 500 becomes 400 because it renders as Regular on Windows today; a rule listed in EMPHASIS uses 500 to set
// itself apart from a 400 sibling, so it becomes 600 instead.
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';

const root = fileURLToPath(new URL('../..', import.meta.url));
const ALLOWED = new Set([400, 600, 700]);
const EMPHASIS = [/\.has-unread\b/];
const excluded = path => path.split(sep).join('/').startsWith('src/opus-bay/') || /little-bay/i.test(path);

export function mapWeight(weight, selector = '') {
  if (ALLOWED.has(weight)) return weight;
  if (weight === 500) return EMPHASIS.some(pattern => pattern.test(selector)) ? 600 : 400;
  if (weight < 500) return 400;
  if (weight < 700) return 600;
  return 700;
}

const walk = dir => readdirSync(dir).flatMap(name => {
  const path = join(dir, name);
  return statSync(path).isDirectory() ? walk(path) : [path];
});

const selectorOf = node => {
  for (let parent = node.parent; parent; parent = parent.parent) if (parent.type === 'rule') return parent.selector;
  return '';
};

/** Rewrites numeric weights in one stylesheet; formatting (including minified one-line files) is preserved. */
export function rewriteCss(text) {
  const tree = postcss.parse(text);
  const changes = [];
  tree.walkDecls(declaration => {
    const selector = selectorOf(declaration);
    if (declaration.prop === 'font-weight') {
      const match = /^(\d{3})(\s*!important)?$/.exec(declaration.value.trim());
      if (!match) return;
      const next = mapWeight(Number(match[1]), selector);
      if (next === Number(match[1])) return;
      changes.push(`${selector} ${match[1]}→${next}`);
      declaration.value = `${next}${match[2] || ''}`;
    } else if (declaration.prop === 'font') {
      const match = /^(?:(italic|oblique|normal)\s+)?(\d{3})(\s)/.exec(declaration.value);
      if (!match) return;
      const next = mapWeight(Number(match[2]), selector);
      if (next === Number(match[2])) return;
      changes.push(`${selector} font ${match[2]}→${next}`);
      declaration.value = declaration.value.replace(/\b\d{3}(?=\s)/, String(next));
    }
  });
  return { text: changes.length ? tree.toString() : text, changes };
}

/** Rewrites inline React style weights: `fontWeight: 650` / `fontWeight: '650'`. */
export function rewriteTsx(text) {
  const changes = [];
  const next = text.replace(/(fontWeight:\s*)(['"]?)(\d{3})\2/g, (whole, prefix, quote, value) => {
    const mapped = mapWeight(Number(value));
    if (mapped === Number(value)) return whole;
    changes.push(`fontWeight ${value}→${mapped}`);
    return `${prefix}${quote}${mapped}${quote}`;
  });
  return { text: next, changes };
}

export function siteFiles() {
  return walk(join(root, 'src'))
    .map(path => relative(root, path))
    .filter(path => !excluded(path) && /\.(css|tsx)$/.test(path));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const check = process.argv.includes('--check');
  let total = 0;
  for (const file of siteFiles()) {
    const path = join(root, file);
    const source = readFileSync(path, 'utf8');
    const { text, changes } = file.endsWith('.css') ? rewriteCss(source) : rewriteTsx(source);
    if (!changes.length) continue;
    total += changes.length;
    console.log(`${file}: ${changes.length}`);
    if (!check) writeFileSync(path, text);
  }
  console.log(check ? `${total} weight(s) outside 400/600/700` : `rewrote ${total} weight(s)`);
  if (check && total) process.exitCode = 1;
}
