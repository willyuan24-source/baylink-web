// UI9-F2: the hover underline is for inline text links only (UI9-F, N23). A link that wraps a block (a card, a postcard, a
// tile, a nav item, the logo, the 3D entry, the outing invite, a /me row) is never underlined as a whole; its own rule
// underlines its title. #50 checked this on the built pages only (lanes' scan of 2734 anchors), so a later CSS edit could
// regress it silently. These tests read every site stylesheet (src/**/*.css, the 3D worlds and generated data excluded)
// and find the rules by selector, not by file, so moving a rule between sheets (UI9-PREP splits ui.css) keeps them green.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import postcss, { type AtRule, type Container, type Rule } from 'postcss';

const excluded = /^src\/(?:opus-bay\/|features\/little-bay\/|data\/generated\/)|little-bay\.css$/;

function cssFiles(directory: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name).replaceAll('\\', '/');
    if (excluded.test(path) || excluded.test(`${path}/`)) continue;
    if (entry.isDirectory()) files.push(...cssFiles(path));
    else if (entry.name.endsWith('.css')) files.push(path);
  }
  return files;
}

type HoverRule = { file: string; selector: string; media: string; decls: Record<string, string> };

/** One spelling per selector: single spaces, none around commas, `>`, `+`, `~` or just inside parentheses, single quotes. */
const squash = (value: string) => value.replace(/\s+/g, ' ').replace(/\s*([>+~,])\s*/g, '$1').replace(/\(\s+/g, '(').replace(/\s+\)/g, ')').replace(/"/g, "'").trim();

/** Every rule of the site CSS, one entry per comma-separated selector, with its enclosing @media text. */
const rules: HoverRule[] = [];
for (const file of cssFiles('src')) {
  postcss.parse(readFileSync(file, 'utf8'), { from: file }).walkRules((rule: Rule) => {
    if (rule.parent?.type === 'atrule' && /keyframes$/i.test((rule.parent as AtRule).name)) return;
    const media: string[] = [];
    for (let parent: Container | undefined = rule.parent as Container | undefined; parent && parent.type === 'atrule'; parent = parent.parent as Container | undefined) {
      media.unshift(squash((parent as AtRule).params));
    }
    const decls: Record<string, string> = {};
    rule.each(node => { if (node.type === 'decl') decls[node.prop.toLowerCase()] = node.value.trim(); });
    for (const selector of rule.selectors) rules.push({ file, selector: squash(selector), media: media.join(' & '), decls });
  });
}

const underlines = (rule: HoverRule) => /\bunderline\b/.test(rule.decls['text-decoration'] ?? '') || /\bunderline\b/.test(rule.decls['text-decoration-line'] ?? '');
const removesUnderline = (rule: HoverRule) => /^none\b/.test(rule.decls['text-decoration-line'] ?? '') || /^none\b/.test(rule.decls['text-decoration'] ?? '');
const hoverUnderlines = rules.filter(rule => rule.selector.includes(':hover') && underlines(rule));
const find = (selector: string) => rules.filter(rule => rule.selector === squash(selector));

/** Split on top-level commas (not inside parentheses). */
function topLevel(list: string): string[] {
  const parts: string[] = []; let depth = 0; let start = 0;
  for (let i = 0; i < list.length; i++) {
    const c = list[i];
    if (c === '(') depth++; else if (c === ')') depth--; else if (c === ',' && depth === 0) { parts.push(list.slice(start, i)); start = i + 1; }
  }
  parts.push(list.slice(start));
  return parts.map(part => part.trim()).filter(Boolean);
}

/** The argument of the first `name(` … `)` after `from`, parentheses balanced. */
function argumentOf(selector: string, name: string, from = 0): string | undefined {
  const at = selector.indexOf(`${name}(`, from);
  if (at < 0) return undefined;
  let depth = 0;
  for (let i = at + name.length; i < selector.length; i++) {
    if (selector[i] === '(') depth++;
    else if (selector[i] === ')' && --depth === 0) return selector.slice(at + name.length + 1, i);
  }
  return undefined;
}

/** [ids, classes/attributes/pseudo-classes, types]; :where() counts 0, :is() / :not() / :has() their most specific argument. */
function specificity(selector: string): [number, number, number] {
  const total: [number, number, number] = [0, 0, 0];
  const add = (s: [number, number, number]) => { total[0] += s[0]; total[1] += s[1]; total[2] += s[2]; };
  const max = (list: string) => topLevel(list).map(specificity).sort((a, b) => b[0] - a[0] || b[1] - a[1] || b[2] - a[2])[0] ?? [0, 0, 0];
  let i = 0;
  while (i < selector.length) {
    const c = selector[i];
    if (c === '#') { total[0]++; i++; while (i < selector.length && /[\w-]/.test(selector[i])) i++; }
    else if (c === '.') { total[1]++; i++; while (i < selector.length && /[\w-]/.test(selector[i])) i++; }
    else if (c === '[') { total[1]++; i = selector.indexOf(']', i) + 1; }
    else if (c === ':') {
      const element = selector[i + 1] === ':'; i += element ? 2 : 1;
      const name = /^[\w-]+/.exec(selector.slice(i))?.[0] ?? ''; i += name.length;
      if (selector[i] === '(') {
        let depth = 1; const open = i; i++;
        while (i < selector.length && depth) { if (selector[i] === '(') depth++; else if (selector[i] === ')') depth--; i++; }
        if (name === 'where') continue;
        if (['is', 'not', 'has', 'matches'].includes(name)) add(max(selector.slice(open + 1, i - 1))); else total[1]++;
      } else if (element) total[2]++; else total[1]++;
    } else if (/[a-zA-Z*]/.test(c)) { const name = /^[\w*-]+/.exec(selector.slice(i))![0]; if (name !== '*') total[2]++; i += name.length; }
    else i++;
  }
  return total;
}
const outranks = (a: [number, number, number], b: [number, number, number]) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

/** The site-wide inline-link rule: `.site-app :where(a[href]:not(<block markers>)):hover`. */
const generic = hoverUnderlines.filter(rule => rule.selector.includes('a[href]:not('));
const markers = generic.length === 1 ? topLevel(argumentOf(generic[0].selector, ':not') ?? '') : [];

/** Whether an anchor with these classes is kept out of the generic underline by the :not() markers. */
function excludedFromGeneric(classes: string): boolean {
  const list = classes.split(/\s+/);
  return markers.some(marker => {
    const exact = /^\.([\w-]+)$/.exec(marker);
    if (exact) return list.includes(exact[1]);
    const contains = /^\[class\*=(['"]?)([^'"\]]+)\1\]$/.exec(marker);
    return contains ? classes.includes(contains[2]) : false;
  });
}

test('one site-wide hover underline, for inline text links only, on pointer devices', () => {
  assert.equal(generic.length, 1, `expected exactly one a[href]:not(…):hover underline rule, found ${generic.map(rule => `${rule.file}: ${rule.selector}`).join(' | ') || 'none'}`);
  const [rule] = generic;
  assert.match(rule.media, /\(hover:hover\)/, 'the inline-link underline only applies where a pointer can hover');
  assert.match(rule.selector, /^\.site-app :where\(a\[href\]:not\(.+\)\):hover$/, 'the link part sits in :where() so a block link\'s own :hover rule outranks it');
  for (const marker of ['.ui-button', '.ui-chip', "[class*=button]", "[class*=btn]", "[class*=tab]", "[class*=card]", "[class*=item]", "[class*=tile]", "[class*=slide]", "[class*=option]", "[class*=nav]", "[class*=brand]", "[class*='3d']", "[class*=opus]", "[class*=inspiration]", "[class*='-row']"]) {
    assert.ok(markers.includes(marker), `the inline-link underline must exclude ${marker} (block links underline only their title)`);
  }
  // Unquoted, an attribute value cannot start with a digit and the browser drops the whole selector list.
  assert.ok(!/\[class\*=3d\]/.test(rule.selector), "[class*='3d'] must stay quoted");
});

test('no other rule underlines every link on hover', () => {
  const global = /^(?:(?:\.site-app|html(?:\[[^\]]*\])*|body|:root|\*)\s+|(?:\.site-app|html|body|:root|\*)>)*/;
  for (const rule of hoverUnderlines) {
    if (rule === generic[0]) continue;
    let subject = rule.selector.replace(global, '');
    subject = subject.replace(/^:(?:where|is)\((.*)\)(:hover.*)$/, '$1$2');
    assert.ok(!/^(?:a(?:\[href\])?|:any-link|a:any-link|a:link)(?::(?:hover|focus-visible|visited|link))*$/.test(subject),
      `${rule.file}: "${rule.selector}" underlines every link, block links included`);
  }
});

// Each block link, its classes as rendered, and the rule that underlines only its title.
const BLOCK_LINKS: { name: string; classes: string; title: string }[] = [
  { name: 'home 3D tile (AI postcard)', classes: 'home-3d', title: '.home-3d:hover strong' },
  { name: 'home 3D strip (AI postcard)', classes: 'home-3d-strip', title: '.home-3d-strip:hover strong' },
  { name: '/explore 3D rail item (AI postcard)', classes: 'xp-3d__item', title: '.xp-3d__item:hover .xp-3d__name' },
  { name: 'guide 3D entry (GuideOpusEntry)', classes: 'gd-opus', title: '.gd-opus:hover .gd-opus__text strong' },
  { name: 'outing invite', classes: 'outing-inspiration-link', title: '.outing-inspiration-link:hover strong' },
];

test('block links are excluded from the inline underline and underline only their title', () => {
  for (const link of BLOCK_LINKS) {
    assert.ok(excludedFromGeneric(link.classes), `${link.name} (.${link.classes}) must not match the inline-link underline`);
    const title = find(link.title);
    assert.ok(title.length && title.every(underlines), `${link.name}: "${link.title}" must underline the title`);
    for (const rule of hoverUnderlines) {
      const last = rule.selector.split(/[\s>+~]+/).at(-1) ?? '';
      assert.ok(!(last.includes(`.${link.classes}:`) || last === `.${link.classes}`), `${rule.file}: "${rule.selector}" underlines the whole ${link.name}`);
    }
  }
});

test('class-less block links switch the underline off in a rule that outranks the inline one', () => {
  const inline = specificity(generic[0]?.selector ?? '');
  for (const [block, title] of [['.nf-links a:hover', '.nf-links a:hover strong'], ['.bl-guide-toc a:hover', undefined]] as const) {
    const off = find(block);
    assert.ok(off.length && off.some(removesUnderline), `"${block}" must set text-decoration-line:none`);
    assert.ok(off.every(rule => outranks(specificity(rule.selector), inline) > 0), `"${block}" must outrank the inline-link rule`);
    if (title) assert.ok(find(title).some(underlines), `"${title}" must underline the title`);
  }
});

test('cards underline their title, never the whole card', () => {
  const cardTitles = hoverUnderlines.filter(rule => rule.selector.includes(':has(.ui-card-link:hover)'));
  assert.ok(cardTitles.length, 'a card underlines its title while its link is hovered');
  for (const rule of cardTitles) {
    assert.match(rule.selector, /:has\(\.ui-card-link:hover\) :is\(\.ui-feed-card__title,\.ui-row-card__title,\.ui-hero-card__title\)$/, `${rule.file}: "${rule.selector}" must target the titles only`);
  }
  assert.ok(excludedFromGeneric('ui-card-link'), 'the card link is kept out of the generic rule and has its own');
  assert.ok(hoverUnderlines.some(rule => rule.selector === '.site-app .ui-card-link:hover'), 'the card\'s title link underlines as an inline link');
  for (const rule of hoverUnderlines) {
    assert.ok(!/(?:^|[\s>+~])\.ui-(?:feed|row|hero)-card(?::[\w-]+)*:hover$/.test(rule.selector), `${rule.file}: "${rule.selector}" underlines a whole card`);
  }
});
