// UI9-R1-FOUNDATION: the tokens, base CSS, Tailwind theme and form primitives every later R1 lane consumes. The public names
// pinned here (--role-*, --selected-*, --free-*, --underline-*, --focus-ring-*, Select, DateChips) are a contract with
// those lanes: rename one only together with its readers.
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import test, { afterEach } from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';
import postcss, { type Rule } from 'postcss';
import tailwindcss from 'tailwindcss';
import config from '../tailwind.config.js';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, sessionStorage: dom.window.sessionStorage,
  HTMLElement: dom.window.HTMLElement, Element: dom.window.Element, Node: dom.window.Node, MutationObserver: dom.window.MutationObserver, IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
dom.window.matchMedia = ((query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} })) as unknown as typeof dom.window.matchMedia;
const { render, cleanup, fireEvent, act, within } = await import('@testing-library/react');
const { Select } = await import('../src/components/ui/Select');
const { DateChips } = await import('../src/components/ui/DateChips');
const { monthGrid, dateWords } = await import('../src/components/ui/date-words');
const { setLocale } = await import('../src/i18n/locale');
afterEach(async () => { cleanup(); document.body.innerHTML = ''; await setLocale('zh-Hans', false); });

const tokensCss = readFileSync('src/tokens.css', 'utf8');
const tokens = postcss.parse(tokensCss);

// ---- resolving the --fs-* steps on <html>, as the browser does (specificity, then order; width media only) ----
function specificity(selector: string): [number, number, number] {
  const total: [number, number, number] = [0, 0, 0];
  let i = 0;
  while (i < selector.length) {
    const c = selector[i];
    if (c === '#') { total[0]++; i++; while (/[\w-]/.test(selector[i] ?? '')) i++; }
    else if (c === '.') { total[1]++; i++; while (/[\w-]/.test(selector[i] ?? '')) i++; }
    else if (c === '[') { total[1]++; i = selector.indexOf(']', i) + 1; }
    else if (c === ':') {
      const element = selector[i + 1] === ':'; i += element ? 2 : 1;
      const name = /^[\w-]+/.exec(selector.slice(i))?.[0] ?? ''; i += name.length;
      if (selector[i] === '(') {
        let depth = 1; const open = i; i++;
        while (i < selector.length && depth) { if (selector[i] === '(') depth++; else if (selector[i] === ')') depth--; i++; }
        if (name === 'where') continue;
        if (['is', 'not'].includes(name)) { const inner = selector.slice(open + 1, i - 1).split(',').map(specificity).sort((a, b) => b[0] - a[0] || b[1] - a[1] || b[2] - a[2])[0]; total[0] += inner[0]; total[1] += inner[1]; total[2] += inner[2]; }
        else total[1]++;
      } else if (element) total[2]++; else total[1]++;
    } else if (/[a-zA-Z]/.test(c)) { total[2]++; i += /^[\w-]+/.exec(selector.slice(i))![0].length; }
    else i++;
  }
  return total;
}
type Case = { width: number; reading?: 'large' | 'extra-large'; simple?: boolean };
const rootPx = (c: Case) => 16 * (c.reading === 'extra-large' ? 1.25 : c.reading === 'large' ? 1.125 : 1);
const mediaMatches = (params: string, width: number) => params.split(/\band\b/).every(part => {
  const min = /min-width:\s*(\d+)px/.exec(part); if (min) return width >= Number(min[1]);
  const max = /max-width:\s*(\d+)px/.exec(part); if (max) return width <= Number(max[1]);
  return false;
});
/** Every custom property set on <html> for one case, resolved through var() aliases, in px where it is a size. */
function rootTokens(c: Case) {
  const { document: doc } = new JSDOM('<!doctype html><html lang="zh-Hans"><body></body></html>').window;
  const html = doc.documentElement;
  if (c.reading) html.setAttribute('data-reading', c.reading);
  if (c.simple) html.setAttribute('data-simple', '');
  const winners = new Map<string, { spec: [number, number, number]; value: string }>();
  tokens.walkRules((rule: Rule) => {
    const parent = rule.parent;
    if (parent && parent.type === 'atrule') { const at = parent as unknown as { name: string; params: string }; if (at.name !== 'media' || !mediaMatches(at.params, c.width)) return; }
    else if (parent && parent.type !== 'root') return;
    const matching = rule.selectors.filter(selector => { try { return html.matches(selector); } catch { return false; } });
    if (!matching.length) return;
    const spec = matching.map(specificity).sort((a, b) => b[0] - a[0] || b[1] - a[1] || b[2] - a[2])[0];
    for (const node of rule.nodes) {
      if (node.type !== 'decl' || !node.prop.startsWith('--')) continue;
      const current = winners.get(node.prop);
      if (!current || (spec[0] - current.spec[0] || spec[1] - current.spec[1] || spec[2] - current.spec[2]) >= 0) winners.set(node.prop, { spec, value: node.value.trim() });
    }
  });
  const value = (token: string): string => { const raw = winners.get(token)?.value ?? ''; const alias = /^var\((--[\w-]+)\)$/.exec(raw)?.[1]; return alias ? value(alias) : raw; };
  const px = (token: string) => { const rem = /^(\d*\.?\d+)rem$/.exec(value(token)); assert.ok(rem, `${token} is a plain rem at ${JSON.stringify(c)} (${value(token)})`); return Math.round(Number(rem![1]) * rootPx(c) * 1000) / 1000; };
  return { value, px, names: [...winners.keys()] };
}
const SIZE_TOKENS = ['--fs-badge', '--fs-meta', '--fs-body', '--fs-reading', '--fs-card', '--fs-card-lg', '--fs-section', '--fs-title', '--fs-display',
  '--fs-keep-13', '--fs-keep-14', '--fs-keep-18', '--fs-keep-20', '--fs-keep-24', '--fs-keep-28', '--fs-keep-32'];

test('N01: 特大 renders every type step as a whole pixel, at least 17px, on one short ladder', () => {
  const ladder = new Set<number>();
  for (const width of [390, 768, 1023, 1024, 1440]) for (const simple of [false, true]) {
    const c: Case = { width, reading: 'extra-large', simple };
    const { px } = rootTokens(c);
    for (const token of SIZE_TOKENS) {
      const size = px(token);
      assert.equal(size, Math.round(size), `${token} = ${size}px at ${JSON.stringify(c)}: not a whole pixel`);
      assert.ok(size >= 17, `${token} = ${size}px at ${JSON.stringify(c)}: below the 17px 特大 floor`);
      if (!simple) ladder.add(size);
    }
  }
  // 13 → 17, 14 → 18, 16 → 20, 17 → 22, 18 → 23, 20 → 25, 24 → 30, 28 → 35, 32 → 40, 44 → 55 (+ the one kept 34px step, 43).
  assert.deepEqual([...ladder].sort((a, b) => a - b), [17, 18, 20, 22, 23, 25, 30, 35, 40, 43, 55]);
  const phone = rootTokens({ width: 390, reading: 'extra-large' });
  assert.deepEqual(['--fs-badge', '--fs-meta', '--fs-body', '--fs-reading', '--fs-card', '--fs-section', '--fs-title', '--fs-display'].map(phone.px), [17, 18, 20, 22, 23, 30, 35, 35]);
  const desktop = rootTokens({ width: 1440, reading: 'extra-large' });
  assert.deepEqual(['--fs-card-lg', '--fs-section', '--fs-title', '--fs-display'].map(desktop.px), [25, 30, 40, 55]);
  // 标准 and 大 are untouched by this lane.
  const standard = rootTokens({ width: 390 });
  assert.deepEqual(['--fs-badge', '--fs-meta', '--fs-body', '--fs-card', '--fs-title'].map(standard.px), [13, 14, 16, 18, 24]);
  assert.equal(rootTokens({ width: 390, reading: 'large' }).px('--fs-title'), 29.25);
});

test('N04 / J1 P18 / followup 14: captions are 14px on phones and desktops; provenance badges, cover credits and the 3D blocks keep 13px', () => {
  assert.equal(rootTokens({ width: 390 }).px('--text-caption'), 14);
  assert.equal(rootTokens({ width: 1440 }).px('--text-caption'), 14);
  assert.equal(rootTokens({ width: 1440, reading: 'extra-large' }).px('--text-caption'), 18);
  const keep = tokens.nodes.find(node => node.type === 'rule' && (node as Rule).selector === ':where(.ui-provenance,.ui-cover-credit,.home-3d,.home-3d-strip,.xp-3d,.gd-opus)') as Rule | undefined;
  assert.ok(keep, 'the badge / credit rule exists');
  assert.equal(keep!.nodes.find(node => node.type === 'decl' && node.prop === '--text-caption')?.toString(), '--text-caption:var(--fs-badge)');
});

test('N05: one line-height ladder in tokens.css (no 1.8 / 1.5 literals), Latin steps on English pages', () => {
  const literals: string[] = [];
  tokens.walkDecls('line-height', declaration => { if (!/var\(--lh-/.test(declaration.value)) literals.push(`${(declaration.parent as Rule).selector}: ${declaration.value}`); });
  assert.deepEqual(literals, []);
  const cjk = rootTokens({ width: 390 });
  assert.deepEqual([cjk.value('--lh-read'), cjk.value('--lh-ui')], ['1.75', '1.6']);
  let latin: Record<string, string> = {};
  tokens.walkRules(':root:lang(en)', rule => { rule.walkDecls(declaration => { latin[declaration.prop] = declaration.value; }); });
  assert.deepEqual([latin['--lh-read'], latin['--lh-ui']], ['1.55', '1.45']);
  latin = {};
});

// WCAG relative luminance of an "R G B" channel token.
const channel = (name: string) => { let value = ''; tokens.walkDecls(`--color-${name}-rgb`, declaration => { value = declaration.value; }); return value.split(/\s+/).map(Number); };
const luminance = ([r, g, b]: number[]) => { const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const contrast = (a: number[], b: number[]) => { const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

test('N09 / J1 P19: the home BayBay card is a deep surface (lime ring ≥3:1); one ring spec; placeholders in ink-3 (≥4.5:1)', () => {
  const lime = tokens.nodes.find(node => node.type === 'rule' && /\.home-baybay/.test((node as Rule).selector) && /:focus-visible/.test((node as Rule).selector)) as Rule | undefined;
  assert.ok(lime, 'the deep-surface focus rule names .home-baybay');
  assert.match(lime!.toString(), /outline-color:var\(--color-highlight\)/);
  assert.match(readFileSync('src/components/home-discovery.css', 'utf8'), /\.home-baybay \{[^}]*background:var\(--color-brand-deep\)/, 'the card is brand-deep');
  assert.ok(contrast(channel('highlight'), channel('brand-deep')) >= 3, 'lime on brand-deep');
  for (const file of ['src/tokens.css', 'src/design.css', 'src/components/ui/links.css']) {
    const css = readFileSync(file, 'utf8');
    assert.match(css, /:focus-visible \{ outline:var\(--focus-ring-width\) solid var\(--color-brand\); outline-offset:var\(--focus-ring-offset\); \}/, `${file} uses the one ring`);
  }
  // The header's square nav tabs round their ring while focused, above site-chrome.css's border-radius:0.
  assert.ok(tokens.nodes.some(node => node.type === 'rule' && (node as Rule).selector === '.site-header-primary :is(.site-nav-link,.site-navigation-more>summary):focus-visible' && /border-radius:var\(--r-sm\)/.test(node.toString())));
  assert.match(readFileSync('src/components/site-chrome.css', 'utf8'), /\.site-app \.site-header-primary \.site-nav-link,\.site-app \.site-navigation-more>summary \{[^}]*border-radius:0/);
  const index = postcss.parse(readFileSync('src/index.css', 'utf8'));
  let placeholder = '';
  index.walkAtRules('layer', layer => { if (layer.params === 'base') layer.walkRules(rule => { if (/input::placeholder/.test(rule.selector) && /textarea::placeholder/.test(rule.selector)) rule.walkDecls('color', declaration => { placeholder = declaration.value; }); }); });
  assert.equal(placeholder, 'var(--color-ink-3)');
  for (const surface of ['surface', 'bg', 'surface-2']) assert.ok(contrast(channel('ink-3'), channel(surface)) >= 4.5, `ink-3 placeholder on ${surface}`);
});

test('J1 P7 / N13: one underline (.2em, 1px) and no skip-ink on the hover underline and both link looks', () => {
  const root = rootTokens({ width: 390 });
  assert.deepEqual([root.value('--underline-offset'), root.value('--underline-thickness')], ['.2em', '1px']);
  let hover = '';
  tokens.walkRules(rule => { if (rule.selector.includes('.site-app .ui-card-link:hover')) hover = rule.toString(); });
  assert.match(hover, /text-decoration-skip-ink:none/);
  assert.match(hover, /text-underline-offset:var\(--underline-offset\)/);
  // A Chinese card title's phrase units are inline blocks (ui.css .title-keep), which an underline does not reach into:
  // they underline themselves while the card link is hovered, on the same offset, so the line is continuous.
  let units = '';
  tokens.walkRules(rule => { if (rule.selectors.includes('.site-app .ui-card-link:hover .title-keep:not([data-latin])')) units = rule.toString(); });
  assert.match(units, /text-decoration-line:underline;[^}]*text-underline-offset:var\(--underline-offset\);[^}]*text-decoration-skip-ink:none/);
  assert.match((tokens.nodes.find(node => node.type === 'atrule' && node.toString().includes('.title-keep:not([data-latin])')) as postcss.AtRule | undefined)?.params ?? '', /\(hover:hover\)/);
  const links = readFileSync('src/components/ui/links.css', 'utf8');
  assert.match(links, /\.ui-link \{[^}]*text-underline-offset:var\(--underline-offset\);[^}]*text-decoration-skip-ink:none/);
  assert.match(links, /\.ui-more \{[^}]*text-underline-offset:var\(--underline-offset\);[^}]*text-decoration-skip-ink:none/);
});

test('N07 / N08: colour roles, one selected pair and lime for 免费 only, all from the palette', () => {
  const root = rootTokens({ width: 390 });
  const roles = root.names.filter(name => name.startsWith('--role-'));
  assert.ok(roles.length <= 7, `${roles.length} text roles`);
  for (const name of [...roles, '--selected-bg', '--selected-fg', '--selected-line', '--free-bg', '--free-fg']) assert.match(root.value(name), /^rgb\(var\(--color-[a-z0-9-]+-rgb\)\)$/, `${name} is a palette colour`);
  assert.equal(root.value('--free-bg'), root.value('--color-highlight'));
  assert.ok(contrast(channel('surface'), channel('ink')) >= 4.5, 'selected text on the selected fill');
  // Lime appears in tokens.css only as the 免费 role and the deep-surface focus ring.
  const lime: string[] = [];
  tokens.walkDecls(declaration => { if (/var\(--color-highlight\)/.test(declaration.value) && declaration.prop !== '--color-highlight') lime.push(declaration.prop); });
  assert.deepEqual(lime.sort(), ['--free-bg', 'outline-color']);
});

test('N06 / N05: every page inherits text-wrap-style:pretty (UI9-R2-FOUNDATION: English too)', () => {
  let pretty = '';
  tokens.walkRules(':root', rule => rule.walkDecls('text-wrap-style', declaration => { pretty = declaration.value; }));
  assert.equal(pretty, 'pretty');
});

test('N23 / N10 / N11 / N24: Tailwind hover is gated and its radii, shadows and motion are the tokens', async () => {
  const css = (await postcss([tailwindcss({ ...config, content: [{ raw: '<div class="hover:bg-baylink-green hover:shadow-card-hover rounded rounded-lg rounded-xl rounded-2xl rounded-3xl rounded-full rounded-card shadow shadow-sm shadow-lg shadow-2xl shadow-rest shadow-elevated transition duration-200 ease-out"></div>', extension: 'html' }] })])
    .process('@tailwind utilities;', { from: undefined })).css;
  const root = postcss.parse(css);
  root.walkRules(/:hover/, rule => {
    const media = rule.parent?.type === 'atrule' ? (rule.parent as unknown as { params: string }).params : '';
    assert.match(media, /\(hover: hover\) and \(pointer: fine\)/, `${rule.selector} is gated`);
  });
  const decl = (selector: string, prop: string) => { let value = ''; root.walkRules(rule => { if (rule.selector === selector) rule.walkDecls(prop, declaration => { value = declaration.value; }); }); return value; };
  assert.equal(decl('.rounded', 'border-radius'), 'var(--r-sm)');
  assert.equal(decl('.rounded-lg', 'border-radius'), 'var(--r-md)');
  assert.equal(decl('.rounded-xl', 'border-radius'), 'var(--r-md)');
  assert.equal(decl('.rounded-2xl', 'border-radius'), 'var(--r-lg)');
  assert.equal(decl('.rounded-3xl', 'border-radius'), 'var(--r-xl)');
  assert.equal(decl('.rounded-card', 'border-radius'), 'var(--r-xl)');
  assert.equal(decl('.rounded-full', 'border-radius'), 'var(--r-pill)');
  for (const [cls, token] of [['.shadow', '--e1'], ['.shadow-sm', '--e1'], ['.shadow-rest', '--e1'], ['.shadow-lg', '--e2'], ['.shadow-2xl', '--e2'], ['.shadow-elevated', '--e2']]) assert.equal(decl(cls, '--tw-shadow'), `var(${token})`, cls);
  assert.equal(decl('.duration-200', 'transition-duration'), 'var(--dur-3)');
  assert.equal(decl('.ease-out', 'transition-timing-function'), 'var(--ease-out)');
  assert.equal(decl('.transition', 'transition-duration'), 'var(--dur-2)');
  // Every theme value is a token.
  for (const [scale, values] of Object.entries({ borderRadius: config.theme?.borderRadius, boxShadow: config.theme?.boxShadow, transitionDuration: config.theme?.transitionDuration, transitionTimingFunction: config.theme?.transitionTimingFunction }) as [string, Record<string, string>][]) {
    for (const [name, value] of Object.entries(values)) assert.match(value, /^(?:var\(--(?:r-|dur-|ease-|e\d)[\w-]*\)|0|0ms|none|linear)$/, `${scale}.${name} = ${value}`);
  }
});

test('Select: a native select in the chip look with the one chevron', () => {
  const view = render(React.createElement('label', null, '排序', React.createElement(Select, { defaultValue: 'b', onChange: () => {} },
    React.createElement('option', { value: 'a' }, 'A'), React.createElement('option', { value: 'b' }, 'B'))));
  const select = view.getByRole('combobox', { name: '排序' }) as HTMLSelectElement;
  assert.equal(select.className, 'ui-select__field');
  assert.equal(select.value, 'b');
  assert.ok(select.parentElement?.classList.contains('ui-select'));
  assert.ok(select.parentElement?.querySelector('svg.ui-select__icon[aria-hidden=true]'));
  const css = readFileSync('src/components/ui/select.css', 'utf8');
  // The field outranks the page-scoped control rules (0,1,1) on the pages the form lanes mount it on, so the phone keeps
  // its 16px guard (no iOS focus zoom) and the chip padding / corners there.
  const selectSheet = postcss.parse(css);
  const pageRules = ['src/tokens.css', 'src/styles/planner.css'].flatMap(file => { const found: string[] = []; postcss.parse(readFileSync(file, 'utf8')).walkRules(rule => { if (/:is\([^)]*\bselect\b[^)]*\)/.test(rule.selector) && /^(?::is\([^)]*\)|\.planner-page) :is\(/.test(rule.selector)) found.push(rule.selector); }); return found; });
  assert.ok(pageRules.length >= 2, `page-scoped control rules found: ${pageRules.join(' | ')}`);
  let guard: Rule | undefined;
  selectSheet.walkAtRules('media', media => { if (media.params === '(max-width:767px)') media.walkRules(rule => { guard = rule; }); });
  assert.equal(guard?.selector, '.ui-select>.ui-select__field', 'two classes (0,2,0) beat (0,1,1)');
  assert.match(guard!.toString(), /font-size:max\(1rem, var\(--text-body\)\)/);
  // followup 39: a select reads at the text fields' size (16px at 标准), not a step smaller.
  assert.match(css, /\.ui-select>\.ui-select__field \{[^}]*font:inherit; font-size:var\(--text-body\);/);
  selectSheet.walkRules(rule => { if (/__field/.test(rule.selector)) assert.match(rule.selector, /^\.ui-select>\.ui-select__field/, rule.selector); });
  // The month sheet's day buttons are sized from their cell and kept square, so they stay circles at 特大 / 简洁.
  assert.match(css, /\.ui-date-grid__day \{[^}]*width:min\(var\(--control-height\),100%\); height:auto; aspect-ratio:1;/);
  assert.match(css, /\.ui-select__field \{[^}]*appearance:none;[^}]*border-radius:var\(--r-pill\);[^}]*min-height:var\(--control-height\)|\.ui-select__field \{[^}]*appearance:none;[^}]*min-height:var\(--control-height\);[^}]*border-radius:var\(--r-pill\)/);
});

test('DateChips: 今天 · 本周末 · 未来 7 天 and a localized month sheet, never mm/dd/yyyy', async () => {
  const changes: unknown[] = [];
  const view = render(React.createElement(DateChips, { value: { kind: 'weekend' }, onChange: (value: unknown) => changes.push(value), today: '2026-10-21', label: '什么时候' }));
  const group = view.getByRole('group', { name: '什么时候' });
  const chips = within(group).getAllByRole('button');
  assert.deepEqual(chips.map(chip => chip.textContent), ['今天', '本周末', '未来 7 天', '选日期']);
  assert.deepEqual(chips.map(chip => chip.getAttribute('aria-pressed')), ['false', 'true', 'false', 'false']);
  fireEvent.click(chips[2]);
  assert.deepEqual(changes.at(-1), { kind: 'next7' });
  await act(async () => { fireEvent.click(chips[3]); });
  const dialog = await view.findByRole('dialog');
  assert.match(dialog.textContent ?? '', /2026年10月/);
  assert.doesNotMatch(dialog.textContent ?? '', /\d{1,2}\/\d{1,2}\/\d{4}/);
  const day = within(dialog).getByRole('button', { name: /10月24日/ });
  assert.equal((within(dialog).getByRole('button', { name: /10月20日/ }) as HTMLButtonElement).disabled, true, 'past days are not offered');
  assert.equal(within(dialog).getByRole('button', { name: /10月21日/ }).getAttribute('aria-current'), 'date');
  await act(async () => { fireEvent.click(day); });
  assert.deepEqual(changes.at(-1), { kind: 'date', date: '2026-10-24' });
  cleanup();
  const chosen = render(React.createElement(DateChips, { value: { kind: 'date', date: '2026-10-24' }, onChange: () => {}, today: '2026-10-21', label: '什么时候' }));
  assert.equal(within(chosen.getByRole('group')).getAllByRole('button')[3].textContent, '10月24日周六');
});

test('DateChips: English and Traditional words, and a Sunday-first month grid', async () => {
  assert.equal(dateWords('en').day('2026-10-24'), 'Sat, Oct 24');
  assert.equal(dateWords('en').month(2026, 9), 'October 2026');
  assert.match(dateWords('zh-Hant').day('2026-10-24'), /^10月24日 ?週六$/);
  const october = monthGrid(2026, 9);
  assert.deepEqual(october[0], [null, null, null, null, '2026-10-01', '2026-10-02', '2026-10-03']);
  assert.equal(october.flat().filter(Boolean).length, 31);
  await setLocale('en', false);
  const view = render(React.createElement(DateChips, { value: null, onChange: () => {}, today: '2026-10-21', label: 'When' }));
  assert.deepEqual(within(view.getByRole('group', { name: 'When' })).getAllByRole('button').map(chip => chip.textContent), ['Today', 'This weekend', 'Next 7 days', 'Pick a date']);
  assert.deepEqual(dateWords('en').weekdays('long').slice(0, 2), ['Sunday', 'Monday']);
  assert.equal(dateWords('zh-Hans').weekdays('long')[0], '星期日');
  await act(async () => { fireEvent.click(within(view.getByRole('group', { name: 'When' })).getAllByRole('button')[3]); });
  const heads = within(await view.findByRole('dialog')).getAllByRole('columnheader');
  assert.deepEqual(heads.map(head => [head.textContent, head.getAttribute('abbr')]).slice(0, 2), [['S', 'Sunday'], ['M', 'Monday']], 'the narrow head carries the full day name');
});

test('Select and DateChips stay out of the entry: nothing src/main.tsx loads statically imports them', () => {
  const seen = new Set<string>();
  const resolve = (from: string, spec: string) => {
    const base = normalize(join(dirname(from), spec));
    for (const candidate of [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')]) if (existsSync(candidate) && !candidate.endsWith('/') && /\.(?:tsx?|css)$/.test(candidate)) return candidate;
    return undefined;
  };
  const walk = (file: string) => {
    if (seen.has(file)) return; seen.add(file);
    if (!/\.tsx?$/.test(file)) return;
    const source = readFileSync(file, 'utf8').replace(/import\(\s*['"][^'"]+['"]\s*\)/g, '');
    for (const match of source.matchAll(/(?:^|\n)\s*(?:import|export)\s[^'"]*?from\s*['"](\.[^'"]+)['"]|(?:^|\n)\s*import\s*['"](\.[^'"]+)['"]/g)) {
      const target = resolve(file, match[1] ?? match[2]);
      if (target) walk(target);
    }
  };
  walk('src/main.tsx');
  assert.ok(seen.size > 20, `${seen.size} modules in the static entry graph`);
  for (const file of ['src/components/ui/Select.tsx', 'src/components/ui/DateChips.tsx', 'src/components/ui/date-words.ts', 'src/components/ui/select.css']) assert.ok(!seen.has(file), `${file} is in the entry graph`);
});
