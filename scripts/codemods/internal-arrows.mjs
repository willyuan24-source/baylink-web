#!/usr/bin/env node
// Codemod: the up-right arrow (↗, lucide ArrowUpRight) means "opens an external site" (SYS-11).
//
//   node scripts/codemods/internal-arrows.mjs           rewrite in place and print what changed
//   node scripts/codemods/internal-arrows.mjs --check   exit 1 if an internal link or button still shows ↗
//   node scripts/codemods/internal-arrows.mjs --report  also list every arrow that was left alone, and why
//
// Re-runnable and idempotent. Scope: TSX under src/, except the Opus Bay game and Little Bay.
// For each ArrowUpRight icon and each "↗" text, the nearest enclosing <a>, <Link>, <NavLink> or <button> decides:
//   internal  <Link>/<NavLink> (not target="_blank"), <a href="/…" | "#…"> without target="_blank", or <button>
//             → the icon becomes ChevronRight (same size); the "↗" text is dropped
//   external  target="_blank", or an absolute http(s)/mailto/tel/webcal href → kept
//   unknown   no enclosing link, or an <a> with a computed href and no target → kept and reported
// Text is only rewritten when the English edition still translates it: strings passed with their English
// counterpart (t('…↗', '…↗')) lose the arrow in both; a dictionary-translated Chinese string is rewritten
// only when src/data/generated/english.json already has the arrow-free key. Anything else is reported.
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = fileURLToPath(new URL('../..', import.meta.url));
const excluded = path => path.split(sep).join('/').startsWith('src/opus-bay/') || /little-?bay/i.test(path);
const chinese = /[㐀-鿿]/u;
const normalize = text => text.trim().replace(/\s+/gu, ' ');
const LINKS = new Set(['a', 'Link', 'NavLink', 'button']);
const BILINGUAL_HELPERS = new Set(['t', 'text', 'copy', 'tr', 'label']);

const walk = dir => readdirSync(dir).flatMap(name => {
  const path = join(dir, name);
  return statSync(path).isDirectory() ? walk(path) : [path];
});

const attribute = (opening, name) => opening.attributes.properties.find(property => ts.isJsxAttribute(property) && property.name.getText() === name);
const constantValue = expression => {
  if (!expression) return null;
  if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) return expression.text;
  if (ts.isTemplateExpression(expression)) return { templateHead: expression.head.text };
  if (ts.isIdentifier(expression)) {
    // `const path = \`/posts/${id}\`; <a href={path}>`: follow a local constant declared in an enclosing scope.
    for (let scope = expression.parent; scope; scope = scope.parent) {
      let found;
      const find = node => {
        if (found || (node !== scope && ts.isFunctionLike(node))) return;
        if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === expression.text && node.initializer
          && (node.parent.flags & ts.NodeFlags.Const)) found = node.initializer;
        else ts.forEachChild(node, find);
      };
      ts.forEachChild(scope, find);
      if (found) return ts.isIdentifier(found) ? null : constantValue(found);
    }
  }
  return null; // computed
};
const literalValue = attr => {
  if (!attr) return undefined;
  if (!attr.initializer) return true;
  if (ts.isStringLiteral(attr.initializer)) return attr.initializer.text;
  return constantValue(ts.isJsxExpression(attr.initializer) ? attr.initializer.expression : undefined);
};

/** Classify the nearest enclosing link-like element of a node. */
export function classify(node) {
  for (let parent = node.parent; parent; parent = parent.parent) {
    const opening = ts.isJsxElement(parent) ? parent.openingElement : undefined;
    if (!opening) continue;
    const tag = opening.tagName.getText();
    if (!LINKS.has(tag)) continue;
    if (tag === 'button') return { kind: 'internal', tag };
    const target = literalValue(attribute(opening, 'target'));
    if (target === '_blank') return { kind: 'external', tag };
    if (target === null) return { kind: 'unknown', tag, why: 'computed target' };
    const href = literalValue(attribute(opening, tag === 'a' ? 'href' : 'to'));
    const start = typeof href === 'string' ? href : href && typeof href === 'object' ? href.templateHead : undefined;
    if (start !== undefined && /^(https?:|mailto:|tel:|webcal:|\/\/)/i.test(start)) return { kind: 'external', tag };
    if (tag !== 'a') return { kind: 'internal', tag };
    if (start !== undefined && /^[/#?]/.test(start)) return { kind: 'internal', tag };
    return { kind: 'unknown', tag, why: 'computed href' };
  }
  return { kind: 'unknown', tag: null, why: 'not inside a link or button' };
}

export function rewrite(source, fileName, dictionary) {
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const edits = []; const kept = []; const manual = [];
  const line = node => file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1;
  const stripArrow = text => text.replace(/\s*↗/gu, '');
  const translatable = (before, after) => !chinese.test(after) || !Object.hasOwn(dictionary, normalize(before)) || Object.hasOwn(dictionary, normalize(after));
  let replacedIcons = 0, textArrows = 0;
  const visit = node => {
    if ((ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node) || ts.isJsxClosingElement(node)) && node.tagName.getText() === 'ArrowUpRight') {
      const where = classify(ts.isJsxClosingElement(node) ? node.parent.openingElement : node);
      if (where.kind === 'internal') {
        edits.push({ start: node.tagName.getStart(file), end: node.tagName.getEnd(), text: 'ChevronRight' });
        if (!ts.isJsxClosingElement(node)) replacedIcons++;
      } else if (!ts.isJsxClosingElement(node)) kept.push(`${fileName}:${line(node)} ArrowUpRight ${where.kind}${where.why ? ` (${where.why})` : ''}`);
    }
    if (ts.isJsxText(node) && node.text.includes('↗')) {
      const where = classify(node);
      const next = stripArrow(node.text);
      if (where.kind !== 'internal') kept.push(`${fileName}:${line(node)} "↗" text ${where.kind}${where.why ? ` (${where.why})` : ''}`);
      else if (translatable(node.text, next)) {
        // Replace the whole JsxText from its full start: getStart() skips leading whitespace, which would leave
        // `{label} </Link>` behind. A remainder that is only whitespace is dropped at the start or end of the element
        // (it would render as a space inside the link) and kept between two children, where it separates them.
        const siblings = ts.isJsxElement(node.parent) ? node.parent.children : [];
        const edge = siblings[0] === node || siblings[siblings.length - 1] === node;
        textArrows++;
        edits.push({ start: node.pos, end: node.getEnd(), text: next.trim() || !edge ? next : '' });
      }
      else manual.push(`${fileName}:${line(node)} "${normalize(node.text)}" (no English entry for the arrow-free text)`);
    }
    if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && node.text.includes('↗') && !ts.isImportDeclaration(node.parent)) {
      const where = classify(node);
      const call = ts.isCallExpression(node.parent) ? node.parent : undefined;
      const bilingual = call && ts.isIdentifier(call.expression) && BILINGUAL_HELPERS.has(call.expression.text) && call.arguments.length >= 2;
      const next = stripArrow(node.text);
      if (where.kind !== 'internal') kept.push(`${fileName}:${line(node)} "↗" string ${where.kind}${where.why ? ` (${where.why})` : ''}`);
      else if (bilingual || translatable(node.text, next)) {
        const quote = source[node.getStart(file)];
        textArrows++;
        edits.push({ start: node.getStart(file), end: node.getEnd(), text: `${quote}${next.replaceAll('\\', '\\\\').replaceAll(quote, `\\${quote}`)}${quote}` });
      } else manual.push(`${fileName}:${line(node)} '${node.text}' (no English entry for the arrow-free text)`);
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  if (!edits.length) return { text: source, replacedIcons, textArrows, kept, manual };

  // lucide-react import: add ChevronRight when an icon was swapped; drop ArrowUpRight when nothing uses it any more.
  const lucide = file.statements.find(statement => ts.isImportDeclaration(statement) && statement.moduleSpecifier.text === 'lucide-react' && statement.importClause?.namedBindings && ts.isNamedImports(statement.importClause.namedBindings));
  if (replacedIcons && lucide) {
    const bindings = lucide.importClause.namedBindings;
    const names = bindings.elements.map(element => element.getText(file));
    if (names.some(name => / as /.test(name) && /ArrowUpRight|ChevronRight/.test(name))) throw new Error(`${fileName}: aliased lucide import, edit by hand`);
    const remaining = (() => {
      let count = 0;
      const scan = node => { if (ts.isIdentifier(node) && node.text === 'ArrowUpRight' && !ts.isImportSpecifier(node.parent)) count++; ts.forEachChild(node, scan); };
      scan(file);
      const swapped = edits.filter(edit => edit.text === 'ChevronRight').length;
      return count - swapped;
    })();
    // Minimal edits keep the import's layout (one line or one name per line): the swapped name takes ArrowUpRight's
    // place, or is added in alphabetical position (not at the end, where other lanes add their icons).
    const arrow = bindings.elements.find(element => element.getText(file) === 'ArrowUpRight');
    const hasChevron = names.includes('ChevronRight');
    if (arrow && remaining <= 0 && !hasChevron) edits.push({ start: arrow.getStart(file), end: arrow.getEnd(), text: 'ChevronRight' });
    else {
      if (arrow && remaining <= 0) {
        const index = bindings.elements.indexOf(arrow);
        const next = bindings.elements[index + 1];
        const lineStart = source.lastIndexOf('\n', arrow.getStart(file)) + 1;
        const lineEnd = source.indexOf('\n', arrow.getEnd()) + 1;
        if (lineEnd > 0 && /^\s*ArrowUpRight,?\s*$/.test(source.slice(lineStart, lineEnd))) edits.push({ start: lineStart, end: lineEnd, text: '' });
        else if (next && !/\n/.test(source.slice(arrow.getEnd(), next.getStart(file)))) edits.push({ start: arrow.getStart(file), end: next.getStart(file), text: '' });
        else edits.push({ start: bindings.elements[index - 1].getEnd(), end: arrow.getEnd(), text: '' });
      }
      if (!hasChevron) {
        const eol = source.includes('\r\n') ? '\r\n' : '\n';
        const elements = bindings.elements.filter(element => element !== arrow || remaining > 0);
        const anchor = elements.filter(element => element.getText(file) < 'ChevronRight').at(-1);
        const alone = element => {
          const start = source.lastIndexOf('\n', element.getStart(file)) + 1; const end = source.indexOf('\n', element.getEnd()) + 1;
          return end > 0 && /^\s*[A-Za-z0-9_$]+,?\s*$/.test(source.slice(start, end)) ? { start, end, indent: /^[ \t]*/.exec(source.slice(start, end))[0] } : null;
        };
        if (!anchor) {
          const first = elements[0]; const line = alone(first);
          if (line) edits.push({ start: line.start, end: line.start, text: `${line.indent}ChevronRight,${eol}` });
          else edits.push({ start: first.getStart(file), end: first.getStart(file), text: 'ChevronRight, ' });
        } else {
          const line = alone(anchor);
          const lastWithoutComma = anchor === bindings.elements.at(-1) && !bindings.elements.hasTrailingComma;
          if (line && !lastWithoutComma) edits.push({ start: line.end, end: line.end, text: `${line.indent}ChevronRight,${eol}` });
          else if (line) edits.push({ start: anchor.getEnd(), end: anchor.getEnd(), text: `,${eol}${line.indent}ChevronRight` });
          else edits.push({ start: anchor.getEnd(), end: anchor.getEnd(), text: ', ChevronRight' });
        }
      }
    }
  }
  let text = source;
  for (const edit of edits.sort((a, b) => b.start - a.start)) text = text.slice(0, edit.start) + edit.text + text.slice(edit.end);
  return { text, replacedIcons, textArrows, kept, manual };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const check = process.argv.includes('--check'); const report = process.argv.includes('--report');
  const dictionary = JSON.parse(readFileSync(join(root, 'src/data/generated/english.json'), 'utf8'));
  let icons = 0, texts = 0; const kept = []; const manual = [];
  for (const path of walk(join(root, 'src')).filter(path => path.endsWith('.tsx'))) {
    const file = relative(root, path);
    if (excluded(file)) continue;
    const source = readFileSync(path, 'utf8');
    const result = rewrite(source, file.split(sep).join('/'), dictionary);
    kept.push(...result.kept); manual.push(...result.manual);
    if (result.text === source) continue;
    icons += result.replacedIcons; texts += result.textArrows;
    console.log(`${file}: ${result.replacedIcons} icon(s), ${result.textArrows} text arrow(s)`);
    if (!check) writeFileSync(path, result.text);
  }
  if (report) for (const entry of kept) console.log(`kept   ${entry}`);
  for (const entry of manual) console.log(`manual ${entry}`);
  const summary = `${icons} internal icon(s) and ${texts} internal text arrow(s) ${check ? 'to rewrite' : 'rewritten'}; ${manual.length} need a hand edit; ${kept.length} kept (external or unknown)`;
  console.log(summary);
  if (check && (icons || texts || manual.length)) process.exitCode = 1;
}
