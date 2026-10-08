import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, posix, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import postcss from 'postcss';
import ts from 'typescript';

// Ratchets: counts that may stay the same or go down, never up. The committed
// baseline is a generated file (`npm run ratchet:update`); CI fails only when
// a current count is above the committed one. Three ratchets share it:
//   style      legacy styling the token system replaces (plan §3.0 rule 5)
//   englishUi  Chinese UI literals with no English (frontend lens FA-09)
//   lazyCss    selectors defined in two lazily loaded CSS files (FA-04)
// The 3D worlds (src/opus-bay, Little Bay) are owned elsewhere and excluded.

export const BASELINE_FILE = 'scripts/style-ratchet.baseline.json';
const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const excluded = /^src\/(?:opus-bay\/|features\/little-bay\/|data\/generated\/)|little-bay\.css$/;
const han = /[\u3400-\u9fff]/;

export const STYLE_METRICS = {
  hexOccurrences: 'hex colour literals outside src/tokens.css',
  hexDistinct: 'distinct hex colours outside src/tokens.css',
  fontSizePx: 'px font sizes (CSS font-size/font, inline fontSize)',
  fontSizePxUnder13: 'px font sizes below 13px',
  radiusKinds: 'distinct border-radius values and Tailwind rounded-* sizes',
  shadowKinds: 'distinct box-shadow values and Tailwind shadow-* sizes',
  fontWeightOutsideSet: 'font weights outside 400/600/700',
  textArbitraryUnder13: 'Tailwind text-[…] sizes below 13px',
  baylinkClasses: 'Tailwind *-baylink-* colour classes',
  arrowUpRight: 'ArrowUpRight icon uses (↗ belongs to external links only)',
};

const toPosix = path => path.split('\\').join('/');
const normalizeValue = value => value.toLowerCase().replace(/\s*!important\s*$/, '').replace(/\s+/g, ' ').replace(/\s*,\s*/g, ',').trim();
const pxNumbers = value => [...value.matchAll(/(-?\d*\.?\d+)px\b/g)].map(match => Number(match[1]));
const HEX = /#(?:[\da-f]{8}|[\da-f]{6}|[\da-f]{3,4})(?![\w-])/gi;
const allowedWeights = new Set(['400', '600', '700', 'normal', 'bold', 'inherit', 'initial', 'unset', 'revert']);
const prefix = '(?<![\\w-])(?:[a-z0-9-]+:)*!?';
const twTextSize = new RegExp(`${prefix}text-\\[(\\d*\\.?\\d+)(px|rem|em)\\]`, 'g');
const twRounded = new RegExp(`${prefix}rounded(?:-(?:t|r|b|l|tl|tr|br|bl|s|e|ss|se|es|ee))?(?:-(none|sm|md|lg|xl|2xl|3xl|full|card|card-lg|\\[[^\\]\\s]+\\]))?(?![\\w-])`, 'g');
const twShadow = new RegExp(`${prefix}shadow(?:-(sm|md|lg|xl|2xl|inner|none|soft|card|card-hover|search|nav|rest|elevated|\\[[^\\]\\s]+\\]))?(?![\\w/-])`, 'g');
const twWeight = new RegExp(`${prefix}font-(thin|extralight|light|medium|extrabold|black|\\[\\d+\\])(?![\\w-])`, 'g');
const twBaylink = new RegExp(`${prefix}(?:text|bg|border(?:-[trblxy])?|ring(?:-offset)?|accent|from|via|to|fill|stroke|outline|divide|placeholder|decoration|caret|shadow)-baylink-[a-z-]+(?:\\/\\d+)?(?![\\w-])`, 'g');

/** Every site source under src/, as repo-relative posix paths, sorted. */
export function listSources(root = repoRoot, { extensions = /\.(?:css|tsx?)$/, directories = ['src'] } = {}) {
  const files = [];
  const walk = directory => {
    for (const entry of readdirSync(join(root, directory), { withFileTypes: true })) {
      const path = posix.join(directory, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (extensions.test(entry.name) && !excluded.test(path)) files.push(path);
    }
  };
  for (const directory of directories) walk(directory);
  return files.sort();
}

const readSources = (root, files) => files.map(file => ({ file, text: readFileSync(join(root, file), 'utf8') }));

const parseTs = ({ file, text }) => ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
const isTextNode = node => ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || node.kind === ts.SyntaxKind.TemplateHead || node.kind === ts.SyntaxKind.TemplateMiddle || node.kind === ts.SyntaxKind.TemplateTail;
const isModuleSpecifier = node => node.parent && (ts.isImportDeclaration(node.parent) || ts.isExportDeclaration(node.parent)) && node.parent.moduleSpecifier === node;
const propertyName = node => node && (ts.isIdentifier(node) || ts.isStringLiteral(node)) ? node.text : undefined;

/** Style counts for in-memory sources ({ file, text }); values carry their first locations for messages. */
export function measureStyle(sources) {
  const counts = Object.fromEntries(Object.keys(STYLE_METRICS).map(metric => [metric, 0]));
  const kinds = { hex: new Map(), radius: new Map(), shadow: new Map() };
  const files = {};
  const at = (file, line) => `${file}:${line}`;
  const add = (file, metric, amount = 1) => {
    counts[metric] += amount;
    (files[file] ||= {})[metric] = (files[file][metric] || 0) + amount;
  };
  const kind = (map, value, where) => { if (!map.has(value)) map.set(value, where); };
  const fontSize = (file, values) => {
    if (!values.length) return;
    add(file, 'fontSizePx');
    if (Math.min(...values) < 13) add(file, 'fontSizePxUnder13');
  };
  const weight = (file, value) => { if (!allowedWeights.has(value) && !value.startsWith('var(')) add(file, 'fontWeightOutsideSet'); };
  const strings = (file, text, line) => {
    if (file !== 'src/tokens.css') for (const match of text.matchAll(HEX)) { add(file, 'hexOccurrences'); kind(kinds.hex, match[0].toLowerCase(), at(file, line)); }
    for (const match of text.matchAll(twTextSize)) if (Number(match[1]) * (match[2] === 'px' ? 1 : 16) < 13) add(file, 'textArbitraryUnder13');
    for (const match of text.matchAll(twRounded)) kind(kinds.radius, `tw:rounded-${match[1] || 'DEFAULT'}`, at(file, line));
    for (const match of text.matchAll(twShadow)) kind(kinds.shadow, `tw:shadow-${match[1] || 'DEFAULT'}`, at(file, line));
    for (const match of text.matchAll(twWeight)) {
      const value = /^\[(\d+)\]$/.exec(match[1])?.[1];
      if (!value || !allowedWeights.has(value)) add(file, 'fontWeightOutsideSet');
    }
    const baylink = [...text.matchAll(twBaylink)].length;
    if (baylink) add(file, 'baylinkClasses', baylink);
  };
  for (const { file, text } of sources) {
    if (file.endsWith('.css')) {
      postcss.parse(text, { from: file }).walkDecls(declaration => {
        const prop = declaration.prop.toLowerCase();
        const value = declaration.value;
        const line = declaration.source?.start?.line ?? 1;
        if (file !== 'src/tokens.css') for (const match of value.matchAll(HEX)) { add(file, 'hexOccurrences'); kind(kinds.hex, match[0].toLowerCase(), at(file, line)); }
        if (prop === 'font-size') fontSize(file, pxNumbers(value));
        if (prop === 'font') {
          const size = /(?:^|\s)(\d*\.?\d+)px\b/.exec(value);
          if (size) fontSize(file, [Number(size[1])]);
          for (const token of value.split(/\s+/)) if (/^(?:[1-9]00|bolder|lighter)$/.test(token)) weight(file, token);
        }
        if (prop === 'font-weight') weight(file, normalizeValue(value));
        if (/^border(?:-[a-z]+)*-radius$/.test(prop)) kind(kinds.radius, normalizeValue(value), at(file, line));
        if (prop === 'box-shadow') kind(kinds.shadow, normalizeValue(value), at(file, line));
      });
      continue;
    }
    const source = parseTs({ file, text });
    const lineOf = node => source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
    const visit = node => {
      if (isTextNode(node) && !isModuleSpecifier(node)) strings(file, node.text, lineOf(node));
      if (ts.isPropertyAssignment(node)) {
        const name = propertyName(node.name);
        const init = node.initializer;
        if (name === 'fontSize' && (ts.isNumericLiteral(init) || (ts.isStringLiteralLike(init) && /^\d*\.?\d+px$/.test(init.text)))) fontSize(file, [Number.parseFloat(init.text)]);
        if (name === 'fontWeight' && (ts.isNumericLiteral(init) || ts.isStringLiteralLike(init))) weight(file, normalizeValue(init.text));
      }
      if (ts.isIdentifier(node) && node.text === 'ArrowUpRight' && !ts.isImportSpecifier(node.parent) && !ts.isJsxClosingElement(node.parent)) add(file, 'arrowUpRight');
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  counts.hexDistinct = kinds.hex.size;
  counts.radiusKinds = kinds.radius.size;
  counts.shadowKinds = kinds.shadow.size;
  return { counts, kinds, files };
}

/** Translation dictionary as the runtime keys it: whitespace-normalized Chinese. */
const normalizeText = text => text.trim().replace(/\s+/g, ' ');
const englishOnly = node => node && (ts.isStringLiteralLike(node) || ts.isTemplateExpression(node)) && !han.test(node.getText()) && /[A-Za-z]/.test(node.getText());
const unwrap = node => { let current = node; while (current.parent && (ts.isParenthesizedExpression(current.parent) || ts.isAsExpression(current.parent))) current = current.parent; return current; };

/** True when the literal is shipped with its English next to it: t(zh, en), {zh, en} or locale === 'en' ? en : zh. */
function hasColocatedEnglish(node) {
  const self = unwrap(node);
  const parent = self.parent;
  if (parent && (ts.isCallExpression(parent) || ts.isNewExpression(parent)) && parent.arguments) {
    const index = parent.arguments.indexOf(self);
    if (index >= 0 && [parent.arguments[index - 1], parent.arguments[index + 1]].some(englishOnly)) return true;
  }
  if (parent && ts.isPropertyAssignment(parent) && parent.initializer === self && ts.isObjectLiteralExpression(parent.parent)) {
    if (parent.parent.properties.some(property => ts.isPropertyAssignment(property) && ['en', 'english', 'En'].includes(propertyName(property.name)) && englishOnly(property.initializer))) return true;
  }
  let branch = self;
  while (branch.parent && ts.isConditionalExpression(branch.parent) && branch.parent.condition !== branch) {
    const conditional = branch.parent;
    if ([conditional.whenTrue, conditional.whenFalse].some(candidate => candidate !== branch && englishOnly(unwrapInner(candidate)))) return true;
    branch = unwrap(conditional);
  }
  return false;
}
const unwrapInner = node => { let current = node; while (ts.isParenthesizedExpression(current)) current = current.expression; return current; };

/**
 * Chinese literals in app/, components/, features/ and pages/ that have neither a
 * dictionary entry (src/data/generated/english.json, en-patterns) nor an English
 * counterpart in the same expression. Node selection mirrors uiStrings() in
 * scripts/generate-english-scopes.ts.
 */
export function measureEnglishUi(sources, dictionary, patterns = {}) {
  const has = text => Object.hasOwn(dictionary, normalizeText(text)) || Object.hasOwn(patterns, normalizeText(text));
  const missing = [];
  for (const entry of sources) {
    const source = parseTs(entry);
    const report = (text, node) => missing.push({ text: normalizeText(text), file: entry.file, line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1 });
    const visit = node => {
      if (ts.isTemplateExpression(node)) {
        // A template is translated as a whole: `${n} 场活动` is the "{0} 场活动" pattern.
        const parts = [node.head, ...node.templateSpans.map(span => span.literal)];
        if (parts.some(part => han.test(part.text))) {
          const whole = node.head.text + node.templateSpans.map((span, index) => `{${index}}${span.literal.text}`).join('');
          const covered = has(whole) || hasColocatedEnglish(node) || parts.every(part => !han.test(part.text) || has(part.text));
          if (!covered) report(whole, node);
        }
        for (const span of node.templateSpans) visit(span.expression);
        return;
      }
      if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isJsxText(node)) && !isModuleSpecifier(node) && han.test(node.text)) {
        if (!has(node.text) && !hasColocatedEnglish(node)) report(node.text, node);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  const strings = [...new Set(missing.map(item => item.text))].sort();
  return { count: strings.length, strings, occurrences: missing };
}

const cssImport = /(?:^|\n)\s*@import\s+(?:url\()?['"]([^'"]+\.css)['"]/g;
const resolveModule = (root, from, specifier) => {
  if (!specifier.startsWith('.')) return undefined;
  const base = posix.normalize(posix.join(posix.dirname(from), specifier));
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`]) if (/\.(?:css|tsx?)$/.test(candidate) && existsSync(join(root, candidate))) return candidate;
  return undefined;
};

/** CSS reached at boot (static imports from src/main.tsx) versus CSS that arrives with a lazy chunk. */
export function cssLoadGraph(root = repoRoot, entry = 'src/main.tsx') {
  const staticImports = new Map();
  const imported = new Set();
  const modules = (file) => {
    if (staticImports.has(file)) return staticImports.get(file);
    const text = readFileSync(join(root, file), 'utf8');
    const found = { static: [], dynamic: [] };
    if (file.endsWith('.css')) {
      for (const match of text.matchAll(cssImport)) { const target = resolveModule(root, file, match[1]); if (target) found.static.push(target); }
    } else {
      const source = parseTs({ file, text });
      const visit = node => {
        if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier) && !node.importClause?.isTypeOnly && !node.isTypeOnly) {
          const target = resolveModule(root, file, node.moduleSpecifier.text); if (target) found.static.push(target);
        }
        if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && node.arguments[0] && ts.isStringLiteralLike(node.arguments[0])) {
          const target = resolveModule(root, file, node.arguments[0].text); if (target) found.dynamic.push(target);
        }
        ts.forEachChild(node, visit);
      };
      visit(source);
    }
    staticImports.set(file, found);
    return found;
  };
  const global = new Set();
  const seen = new Set();
  const walk = file => {
    if (seen.has(file)) return; seen.add(file);
    if (file.endsWith('.css')) global.add(file);
    for (const target of modules(file).static) walk(target);
  };
  walk(entry);
  for (const file of listSources(root, { extensions: /\.(?:css|tsx?)$/ })) {
    const found = modules(file);
    for (const target of [...found.static, ...found.dynamic]) if (target.endsWith('.css')) imported.add(target);
  }
  const lazy = new Set();
  const lazyWalk = file => { if (lazy.has(file) || global.has(file) || excluded.test(file)) return; lazy.add(file); for (const target of modules(file).static) lazyWalk(target); };
  for (const file of imported) lazyWalk(file);
  // Files imported by one module (and their @imports) always arrive together, in
  // import order, so a later file may deliberately refine an earlier one.
  const parent = new Map([...lazy].map(file => [file, file]));
  const find = file => { while (parent.get(file) !== file) file = parent.get(file); return file; };
  const join_ = (a, b) => { const [x, y] = [find(a), find(b)].sort(); if (x !== y) parent.set(y, x); };
  for (const [file, found] of staticImports) {
    const together = [...found.static, ...found.dynamic].filter(target => lazy.has(target));
    if (file.endsWith('.css') && lazy.has(file)) together.push(file);
    for (const target of together.slice(1)) join_(together[0], target);
  }
  return { global: [...global].sort(), lazy: [...lazy].sort(), unitOf: file => find(file) };
}

const selectorKey = selector => selector.replace(/\s+/g, ' ').replace(/\s*([>+~])\s*/g, '$1').trim();

/** Selectors (containing a class) defined in lazily loaded CSS files that arrive separately. */
export function lazyCssDuplicates(sources, unitOf = file => file) {
  const owners = new Map();
  for (const { file, text } of sources) {
    postcss.parse(text, { from: file }).walkRules(rule => {
      if (rule.parent?.type === 'atrule' && /keyframes$/i.test(rule.parent.name)) return;
      for (const selector of rule.selectors) {
        const key = selectorKey(selector);
        if (!key.includes('.')) continue;
        if (!owners.has(key)) owners.set(key, new Map());
        owners.get(key).set(file, unitOf(file));
      }
    });
  }
  return [...owners].filter(([, files]) => new Set(files.values()).size > 1).map(([selector, files]) => ({ selector, files: [...files.keys()].sort() })).sort((a, b) => a.selector.localeCompare(b.selector));
}

/** Measure the repository now. */
export function measureRepository(root = repoRoot) {
  const all = listSources(root);
  const style = measureStyle(readSources(root, all));
  const uiDirectories = ['src/app', 'src/components', 'src/features', 'src/pages'];
  const uiFiles = all.filter(file => /\.tsx?$/.test(file) && uiDirectories.some(directory => file.startsWith(`${directory}/`)));
  const englishUi = measureEnglishUi(readSources(root, uiFiles), englishDictionaryKeys(root), JSON.parse(readFileSync(join(root, 'src/i18n/en-patterns.json'), 'utf8')));
  const graph = cssLoadGraph(root);
  const duplicates = lazyCssDuplicates(readSources(root, graph.lazy), graph.unitOf);
  return { style, englishUi, lazyCss: { files: graph.lazy, duplicates } };
}

/** The keys of src/data/generated/english.json, read from its sources so a stale generated copy cannot skew the count. */
export function englishDictionaryKeys(root = repoRoot) {
  const keys = {};
  for (const file of JSON.parse(readFileSync(join(root, 'scripts/english-sources.json'), 'utf8'))) {
    for (const key of Object.keys(JSON.parse(readFileSync(join(root, file), 'utf8')))) keys[key] = true;
  }
  return keys;
}

/** The committed shape: gated counts first, then the values that explain them. */
export function baselineFrom(measured) {
  const sorted = object => Object.fromEntries(Object.entries(object).sort(([a], [b]) => a.localeCompare(b)));
  return {
    $comment: 'Generated by `npm run ratchet:update`; never edit by hand. `npm run verify:ratchet` fails when a count goes above this file. Lower counts are locked in by the next ratchet:update.',
    counts: { ...measured.style.counts, englishUiUntranslated: measured.englishUi.count, lazyCssDuplicateSelectors: measured.lazyCss.duplicates.length },
    lazyCssDuplicates: measured.lazyCss.duplicates,
    englishUiUntranslated: measured.englishUi.strings,
    styleValues: { hex: [...measured.style.kinds.hex.keys()].sort(), radius: [...measured.style.kinds.radius.keys()].sort(), shadow: [...measured.style.kinds.shadow.keys()].sort() },
    styleFiles: sorted(Object.fromEntries(Object.entries(measured.style.files).map(([file, counts]) => [file, sorted(counts)]))),
  };
}

/** Human-readable reasons each increased count went up; empty when the ratchet holds. */
export function compareWithBaseline(measured, baseline) {
  const current = baselineFrom(measured);
  const problems = [];
  for (const [metric, value] of Object.entries(current.counts)) {
    const allowed = baseline.counts?.[metric];
    if (allowed === undefined) { problems.push(`${metric}: no committed baseline (run npm run ratchet:update)`); continue; }
    if (value <= allowed) continue;
    const details = [];
    if (metric === 'hexDistinct' || metric === 'radiusKinds' || metric === 'shadowKinds') {
      const key = metric === 'hexDistinct' ? 'hex' : metric === 'radiusKinds' ? 'radius' : 'shadow';
      const known = new Set(baseline.styleValues?.[key] || []);
      for (const [kind, where] of measured.style.kinds[key]) if (!known.has(kind)) details.push(`new ${key} value ${kind} at ${where}`);
    } else if (metric === 'englishUiUntranslated') {
      const known = new Set(baseline.englishUiUntranslated || []);
      for (const item of measured.englishUi.occurrences) if (!known.has(item.text)) details.push(`no English for "${item.text}" at ${item.file}:${item.line} (use t(zh, en) or add a dictionary entry)`);
    } else if (metric === 'lazyCssDuplicateSelectors') {
      const known = new Set((baseline.lazyCssDuplicates || []).map(item => item.selector));
      for (const item of measured.lazyCss.duplicates) if (!known.has(item.selector)) details.push(`${item.selector} is defined in ${item.files.join(' and ')}; rename one or namespace it`);
    } else {
      for (const [file, counts] of Object.entries(current.styleFiles)) {
        const before = baseline.styleFiles?.[file]?.[metric] || 0;
        if ((counts[metric] || 0) > before) details.push(`${file}: ${before} → ${counts[metric]}`);
      }
    }
    problems.push(`${metric} rose from ${allowed} to ${value}${STYLE_METRICS[metric] ? ` (${STYLE_METRICS[metric]})` : ''}${details.length ? `\n    ${details.slice(0, 20).join('\n    ')}${details.length > 20 ? `\n    …and ${details.length - 20} more` : ''}` : ''}`);
  }
  return problems;
}

export function readBaseline(root = repoRoot) {
  const path = join(root, BASELINE_FILE);
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : undefined;
}

/** Lowering-only update. Raising a count needs --allow-increase and a reason in the PR. */
export function updateBaseline(root = repoRoot, { allowIncrease = false } = {}) {
  const measured = measureRepository(root);
  const baseline = readBaseline(root);
  if (baseline && !allowIncrease) {
    // A metric the committed file does not have yet starts at today's count.
    const problems = compareWithBaseline(measured, baseline).filter(problem => !problem.includes('no committed baseline'));
    if (problems.length) return { written: false, problems };
  }
  writeFileSync(join(root, BASELINE_FILE), `${JSON.stringify(baselineFrom(measured), null, 2)}\n`);
  return { written: true, problems: [], counts: baselineFrom(measured).counts, previous: baseline?.counts };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const root = repoRoot;
  const args = new Set(process.argv.slice(2));
  if (args.has('--update')) {
    const result = updateBaseline(root, { allowIncrease: args.has('--allow-increase') });
    if (!result.written) {
      console.error(`Ratchet baseline not updated: these counts went up. Fix them, or rerun with --allow-increase and explain why in the PR.\n  ${result.problems.join('\n  ')}`);
      process.exitCode = 1;
    } else {
      for (const [metric, value] of Object.entries(result.counts)) console.log(`${metric.padEnd(28)} ${String(result.previous?.[metric] ?? '—').padStart(6)} → ${value}`);
      console.log(`Wrote ${toPosix(relative(process.cwd(), join(root, BASELINE_FILE)))}.`);
    }
  } else {
    const baseline = readBaseline(root);
    if (!baseline) { console.error(`Missing ${BASELINE_FILE}; run npm run ratchet:update.`); process.exitCode = 1; }
    else {
      const measured = measureRepository(root);
      const problems = compareWithBaseline(measured, baseline);
      const counts = baselineFrom(measured).counts;
      const lower = Object.entries(counts).filter(([metric, value]) => value < baseline.counts[metric]);
      if (problems.length) {
        console.error(`Style/English/CSS ratchet failed; counts may only go down:\n  ${problems.join('\n  ')}`);
        process.exitCode = 1;
      } else {
        console.log(`Ratchet holds for ${Object.keys(counts).length} counts${lower.length ? `; lower now (lock in with npm run ratchet:update): ${lower.map(([metric, value]) => `${metric} ${baseline.counts[metric]}→${value}`).join(', ')}` : ''}.`);
      }
    }
  }
}
