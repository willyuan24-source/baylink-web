#!/usr/bin/env node
// Codemod: English all-caps eyebrows ("MAKE YOURSELF AT HOME", "BAYLINK · SAVE & SHARE") appear only under /en (SYS-09).
//
//   node scripts/codemods/eyebrows.mjs           wrap them in <EnglishOnly> and print what changed
//   node scripts/codemods/eyebrows.mjs --check   exit 1 if a Chinese edition still renders one
//
// Re-runnable and idempotent. Scope: TSX under src/, except the Opus Bay game and Little Bay.
// An eyebrow is a non-interactive element (span, p, div, small, strong, b, em, i) whose own text is a literal
// English all-caps phrase of two or more words — the same test the SYS audit probe applies to rendered text —
// optionally next to self-closing decorations such as an icon. Text that goes through t(zh, en) already shows
// Chinese in the Chinese editions and is left alone. The element is wrapped, not deleted, so the English
// edition is unchanged: <EnglishOnly> (src/components/EnglishOnly.tsx) renders nothing in zh-Hans and zh-Hant.
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = fileURLToPath(new URL('../..', import.meta.url));
// Designed objects, not eyebrows: the outing cover art, the profile identity stamp and the dining receipt
// print their wordmark as part of the graphic (tests/outings-ui.test.tsx checks the cover's). Their own lanes
// redesign them.
const DESIGNED_OBJECTS = ['src/features/outings/OutingCover.tsx', 'src/features/profile/ProfileIdentity.tsx', 'src/components/tools/DiningCalculator.tsx'];
const excluded = path => path.split(sep).join('/').startsWith('src/opus-bay/') || /little-?bay/i.test(path) || path.endsWith('EnglishOnly.tsx')
  || DESIGNED_OBJECTS.includes(path.split(sep).join('/'));
const TAGS = new Set(['span', 'p', 'div', 'small', 'strong', 'b', 'em', 'i']);

/** Mirrors the SYS probe (site-audit-1007 work/SYS/probe-page.js): Latin only, all caps, two capitalised words. */
export const isAllCapsPhrase = text => {
  const shown = text.replace(/\s+/g, ' ').trim();
  return !/[㐀-鿿]/u.test(shown) && /[A-Z]{2,}/.test(shown) && shown === shown.toUpperCase()
    && /[A-Z]{2,}[ ·,.'&/-]+[A-Z]{2,}/.test(shown) && shown.length >= 6;
};

const walk = dir => readdirSync(dir).flatMap(name => {
  const path = join(dir, name);
  return statSync(path).isDirectory() ? walk(path) : [path];
});

const eyebrowText = element => {
  let text = '';
  for (const child of element.children) {
    if (ts.isJsxText(child)) text += child.text;
    else if (ts.isJsxSelfClosingElement(child)) continue; // icon or decorative <span />
    else return null; // expressions or nested elements: not a plain literal eyebrow
  }
  return text.trim() ? text : null;
};

const insideEnglishOnly = node => {
  for (let parent = node.parent; parent; parent = parent.parent) if (ts.isJsxElement(parent) && parent.openingElement.tagName.getText() === 'EnglishOnly') return true;
  return false;
};

export function rewrite(source, fileName) {
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const edits = []; const found = [];
  const visit = node => {
    if (ts.isJsxElement(node) && TAGS.has(node.openingElement.tagName.getText()) && !insideEnglishOnly(node)) {
      const text = eyebrowText(node);
      if (text && isAllCapsPhrase(text)) {
        found.push(`${fileName}:${file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1} ${text.trim()}`);
        edits.push({ at: node.getEnd(), text: '</EnglishOnly>', rank: 1 }, { at: node.getStart(file), text: '<EnglishOnly>', rank: 0 });
        return;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  if (!edits.length) return { text: source, found };
  const imported = file.statements.some(statement => ts.isImportDeclaration(statement) && statement.importClause?.namedBindings
    && ts.isNamedImports(statement.importClause.namedBindings) && statement.importClause.namedBindings.elements.some(element => element.name.text === 'EnglishOnly'));
  if (!imported) {
    const imports = file.statements.filter(ts.isImportDeclaration);
    const last = imports.at(-1);
    let specifier = relative(dirname(fileName), 'src/components/EnglishOnly').split(sep).join('/');
    if (!specifier.startsWith('.')) specifier = `./${specifier}`;
    const quote = last ? source[last.moduleSpecifier.getStart(file)] : "'";
    const eol = source.includes('\r\n') ? '\r\n' : '\n';
    const line = `import { EnglishOnly } from ${quote}${specifier}${quote};`;
    if (last) edits.push({ at: last.getEnd(), text: `${eol}${line}` });
    else edits.push({ at: 0, text: `${line}${eol}` });
  }
  let text = source;
  // Same position: insert the opening tag first so an adjacent closing tag lands before it.
  for (const edit of edits.sort((a, b) => b.at - a.at || (a.rank ?? 0) - (b.rank ?? 0))) text = text.slice(0, edit.at) + edit.text + text.slice(edit.at);
  return { text, found };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const check = process.argv.includes('--check');
  let total = 0;
  for (const path of walk(join(root, 'src')).filter(path => path.endsWith('.tsx'))) {
    const file = relative(root, path).split(sep).join('/');
    if (excluded(file)) continue;
    const source = readFileSync(path, 'utf8');
    const result = rewrite(source, file);
    if (!result.found.length) continue;
    total += result.found.length;
    for (const entry of result.found) console.log(entry);
    if (!check) writeFileSync(path, result.text);
  }
  console.log(check ? `${total} English all-caps eyebrow(s) still shown in Chinese` : `wrapped ${total} eyebrow(s) in <EnglishOnly>`);
  if (check && total) process.exitCode = 1;
}
