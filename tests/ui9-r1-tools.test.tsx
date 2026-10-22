// UI9-R1-TOOLS (/tools, cold-review round 1: J1 P22, N04, N08, N09, N10, N12, N13, N23): the hub at rest selects no tile
// and hides the workspace on a phone; the forms use the shared Select and Button / IconButton; the tool stylesheets keep
// hover behind a pointer query, never fade a disabled control, draw no shadow and write no font-size literal.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import test, { afterEach } from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';
import postcss, { type AtRule, type Rule } from 'postcss';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, sessionStorage: dom.window.sessionStorage,
  HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { render, cleanup } = await import('@testing-library/react');
const { MemoryRouter } = await import('react-router-dom');
const { ToolsHub } = await import('../src/components/tools/ToolsHub');
const { LIFE_TOOLS } = await import('../src/data/tool-catalog');
afterEach(() => { cleanup(); dom.window.localStorage.clear(); });

const hub = (entry: string) => render(<MemoryRouter initialEntries={[entry]}><ToolsHub storageScope="guest:ui9-r1-tools" onToast={() => {}} /></MemoryRouter>);
const tiles = (view: ReturnType<typeof hub>) => [...view.container.querySelectorAll<HTMLAnchorElement>('.tools-picker-item')];

test('at rest (no or unknown ?tool=) no tile is the current page; the first tool is only marked open for the desktop list', () => {
  for (const entry of ['/tools', '/tools?tool=nope']) {
    const view = hub(entry);
    const layout = view.container.querySelector('.tools-layout')!;
    assert.equal(layout.getAttribute('data-rest'), '', entry);
    assert.equal(tiles(view).length, LIFE_TOOLS.length);
    assert.deepEqual(tiles(view).filter(tile => tile.hasAttribute('aria-current')), [], entry);
    assert.deepEqual(tiles(view).filter(tile => tile.hasAttribute('data-open')).map(tile => tile.getAttribute('href')), ['/tools?tool=communication#tool-workspace']);
    // The workspace stays mounted (drafts survive switching tools); CSS hides it below 1024px at rest.
    assert.ok(view.container.querySelector('#tool-workspace'));
    cleanup();
  }
});

test('a chosen tool is the current page and its tile the only open one; the hub is no longer at rest', () => {
  const view = hub('/tools?tool=loan');
  assert.equal(view.container.querySelector('.tools-layout')!.hasAttribute('data-rest'), false);
  const current = tiles(view).filter(tile => tile.getAttribute('aria-current') === 'page');
  assert.deepEqual(current.map(tile => tile.getAttribute('href')), ['/tools?tool=loan#tool-workspace']);
  assert.deepEqual(tiles(view).filter(tile => tile.hasAttribute('data-open')), current);
});

test('every tool form uses the shared Select and Button / IconButton looks, never a native select or a tool-* button', () => {
  const view = hub('/tools?tool=communication');
  const root = view.container;
  // All eight tools are mounted (hidden ones too), so this covers every form.
  const selects = [...root.querySelectorAll('select')];
  assert.ok(selects.length >= 5, 'AI scenario / language / tone, the loan unit and the unit-price units');
  assert.deepEqual(selects.filter(select => !select.classList.contains('ui-select__field')).map(select => select.outerHTML.slice(0, 60)), []);
  assert.equal(root.querySelectorAll('.tool-button, .tool-button-secondary, .tool-text-button, .tool-icon-button, .unit-price-remove').length, 0);
  const buttons = [...root.querySelectorAll('button')];
  const own = buttons.filter(button => !button.closest('.tool-choice-row, .dining-tip-presets, .loan-term-shortcuts'));
  assert.deepEqual(own.filter(button => !button.matches('.ui-button[data-variant], .ui-icon-button')).map(button => button.outerHTML.slice(0, 80)), []);
  for (const button of buttons.filter(item => item.classList.contains('ui-icon-button'))) assert.ok(button.getAttribute('aria-label'), 'icon buttons are named');
  const generate = [...root.querySelectorAll<HTMLButtonElement>('.ui-button')].find(button => button.textContent === '生成消息草稿')!;
  assert.equal(generate.getAttribute('data-variant'), 'primary');
  for (const label of ['沟通场景', '输出语言', '表达语气']) assert.ok(view.getByRole('combobox', { name: label }).classList.contains('ui-select__field'), label);
});

// ---- the four tool stylesheets ----
const SHEETS = readdirSync('src/components/tools').filter(file => file.endsWith('.css')).map(file => `src/components/tools/${file}`);
const parsed = SHEETS.map(file => ({ file, root: postcss.parse(readFileSync(file, 'utf8'), { from: file }) }));
const inHoverMedia = (rule: Rule) => { for (let node = rule.parent; node; node = node.parent) if (node.type === 'atrule' && (node as AtRule).name === 'media' && /hover\s*:\s*hover/.test((node as AtRule).params)) return true; return false; };

test('tool stylesheets: hover only for a hovering pointer, no faded disabled state, no shadow, no font-size literal, no outline:none', () => {
  assert.deepEqual(SHEETS.sort(), ['dining-calculator.css', 'loan-calculator.css', 'tools.css', 'unit-price.css'].map(file => `src/components/tools/${file}`));
  const problems: string[] = [];
  for (const { file, root } of parsed) root.walkRules(rule => {
    const at = `${file}:${rule.source?.start?.line} ${rule.selector}`;
    if (/:hover/.test(rule.selector) && !inHoverMedia(rule)) problems.push(`ungated hover ${at}`);
    rule.walkDecls(decl => {
      if (/:disabled/.test(rule.selector) && decl.prop === 'opacity') problems.push(`opacity disabled ${at}`);
      if (decl.prop === 'box-shadow') problems.push(`shadow ${at}: ${decl.value}`);
      if (decl.prop === 'font-size' && /\d(?:px|rem|em)\b/.test(decl.value) && !decl.value.includes('var(')) problems.push(`font-size literal ${at}: ${decl.value}`);
      if (decl.prop === 'outline' && /^(?:none|0)$/.test(decl.value.trim())) problems.push(`outline none ${at}`);
      if (decl.prop === 'text-underline-offset' && !decl.value.includes('--underline-offset')) problems.push(`underline offset ${at}: ${decl.value}`);
    });
  });
  assert.deepEqual(problems, []);
});

test('tools.css: one selected look (the --selected-* pair), the tag at 14px, no textarea grip, and the phone workspace waits at rest', () => {
  const tools = parsed.find(sheet => sheet.file.endsWith('/tools.css'))!.root;
  const rules: { selector: string; media: string; decls: Record<string, string> }[] = [];
  tools.walkRules(rule => {
    const media = rule.parent?.type === 'atrule' ? (rule.parent as AtRule).params : '';
    const decls: Record<string, string> = {};
    rule.walkDecls(decl => { decls[decl.prop] = decl.value; });
    rules.push({ selector: rule.selector, media, decls });
  });
  const selected = rules.filter(rule => /\.tools-picker-item(?:\[aria-current=page\]|\[data-open\])$/.test(rule.selector.split(',').pop()!.trim()));
  assert.equal(selected.length, 2, 'aria-current everywhere + the desktop rest rule');
  for (const rule of selected) assert.deepEqual(rule.decls, { 'border-color': 'var(--selected-line)', background: 'var(--selected-bg)', color: 'var(--selected-fg)' });
  assert.equal(rules.find(rule => rule.selector === '.tools-layout[data-rest] .tools-picker-item[data-open]')!.media, '(min-width:1024px)');
  assert.ok(!rules.some(rule => /brand-tint/.test(rule.decls.background ?? '') && /aria-current|data-open/.test(rule.selector)), 'no brand-tint selected variant');
  assert.equal(rules.find(rule => rule.selector === '.tools-picker-tag')!.decls['font-size'], 'var(--text-fact)');
  assert.equal(rules.find(rule => rule.selector === '.tool-field textarea,.tool-output textarea')!.decls.resize, 'none');
  const rest = rules.find(rule => rule.selector === '.tools-layout[data-rest] .tool-workspace')!;
  assert.deepEqual([rest.media, rest.decls.display], ['(max-width:1023px)', 'none']);
});
