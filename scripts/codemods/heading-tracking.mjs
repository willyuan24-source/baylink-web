#!/usr/bin/env node
// Codemod: no negative letter-spacing on headings (SV-06; design.md §4.2 "every heading is 600 with letter-spacing 0").
// Chinese titles set with -0.02…-0.05em (or -0.5…-1.5px) squeeze the Han characters together; the shared type scale in
// src/tokens.css (.type-display / .type-title / .type-section) has none.
//
//   node scripts/codemods/heading-tracking.mjs [file.css …]          rewrite in place (default: every site CSS file)
//   node scripts/codemods/heading-tracking.mjs --check [file.css …]  exit 1 if a heading rule still tracks negative
//   --skip-selector=<regex>  leave rules whose selector matches
//
// A rule counts as a heading when its selector targets h1–h3 or a class ending in "title" / "title__head" (`.bay-hero h1`,
// `.gd-title__head`, `.baylink-hero-title`); wordmarks and names stay as they are. Idempotent; re-run after a rebase.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import postcss from 'postcss';
import { siteStylesheets } from './hex-to-tokens.mjs';

const root = fileURLToPath(new URL('../..', import.meta.url));
const HEADING = /(?:^|[\s>+~,(])h[1-3](?![\w-])|[.-]title(?:__head)?(?![\w-])/i;
const negative = value => /^-\s*(?:\d*\.?\d+)(?:em|px|rem)?$/.test(value.trim()) && Number.parseFloat(value.replace(/\s/g, '')) < 0;

/** Rewrite one stylesheet; returns { css, changes: [{selector, from}] }. */
export function rewriteTracking(css, { skipSelector } = {}) {
  const ast = postcss.parse(css);
  const changes = [];
  ast.walkDecls('letter-spacing', declaration => {
    const rule = declaration.parent;
    if (rule?.type !== 'rule' || !HEADING.test(rule.selector) || !negative(declaration.value)) return;
    if (skipSelector?.test(rule.selector)) return;
    changes.push({ selector: rule.selector, from: declaration.value });
    declaration.value = '0';
  });
  return { css: ast.toString(), changes };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const check = args.includes('--check');
  const skip = args.find(arg => arg.startsWith('--skip-selector='))?.slice('--skip-selector='.length);
  const listed = args.filter(arg => !arg.startsWith('--')).map(path => path.replaceAll('\\', '/'));
  const files = listed.length ? listed : siteStylesheets();
  let failures = 0;
  for (const file of files) {
    const css = readFileSync(join(root, file), 'utf8');
    const { css: next, changes } = rewriteTracking(css, { skipSelector: skip ? new RegExp(skip) : undefined });
    if (!changes.length) continue;
    if (check) { failures++; console.error(`${file}: ${changes.map(change => `${change.selector} ${change.from}`).join('; ')}`); continue; }
    writeFileSync(join(root, file), next);
    console.log(`${file}: ${changes.length} heading(s) → letter-spacing 0`);
  }
  if (check && failures) process.exitCode = 1;
}
