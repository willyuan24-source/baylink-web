// UI9-R1-POLISH-1 (the #63 live check's minor findings): 搬家清单's 新待办 row, the footer tagline on a Chinese phone, the
// two Select shapes and the post-build pin of the account shell's height (verify-release). CSS facts come from the sheets.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test, { afterEach } from 'node:test';
import React from 'react';
import { JSDOM } from 'jsdom';
import postcss, { type AtRule } from 'postcss';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://www.baylink.us/tools?tool=moving', pretendToBeVisual: true });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { render, cleanup } = await import('@testing-library/react');
const { MemoryRouter } = await import('react-router-dom');
const { MovingChecklistTool } = await import('../src/components/tools/MovingChecklistTool');
afterEach(() => { cleanup(); localStorage.clear(); });

const rules = (file: string, selector: string, media = '') => {
  const found: Record<string, string>[] = [];
  postcss.parse(readFileSync(file, 'utf8')).walkRules(rule => {
    const at = rule.parent?.type === 'atrule' ? (rule.parent as AtRule).params : '';
    if (rule.selector === selector && at === media) { const props: Record<string, string> = {}; rule.walkDecls(d => { props[d.prop] = d.value; }); found.push(props); }
  });
  assert.equal(found.length, 1, `${file}: ${selector} ${media}`);
  return found[0];
};

test('新待办: the field and its button in one row (one height), the hint under the row, a whole short example', () => {
  const view = render(<MemoryRouter><MovingChecklistTool storageScope="guest" onToast={() => {}} /></MemoryRouter>);
  const field = view.getByRole('textbox', { name: '新待办' }) as HTMLInputElement;
  const button = view.getByRole('button', { name: '添加待办' });
  assert.equal(button.textContent, '添加', 'one word beside the field (named 添加待办)');
  assert.equal(field.parentElement, button.parentElement, 'same row');
  assert.ok(field.parentElement!.classList.contains('tool-checklist-add-row'));
  const form = field.closest('form')!;
  assert.ok(form.classList.contains('tool-field') && form.classList.contains('tool-checklist-add'));
  assert.equal(form.lastElementChild!.tagName, 'SMALL', 'the hint sits under the row, not beside the button');
  assert.equal(field.placeholder, '例如：第一晚用品');
  const sheet = 'src/components/tools/tools.css';
  assert.deepEqual(rules(sheet, '.tool-checklist-add-row'), { display: 'flex', 'align-items': 'stretch', gap: 'var(--sp-2)' }, 'stretch: one height');
  assert.deepEqual(rules(sheet, '.tool-checklist-add-row>input'), { flex: '1 1 0', 'min-width': '0' });
  assert.deepEqual(rules(sheet, '.tool-checklist-add-row>.ui-button'), { flex: 'none' });
  assert.doesNotMatch(readFileSync(sheet, 'utf8'), /\.tool-checklist-custom\{display:flex/, 'the custom tasks stack (no row beside the form on a desktop)');
  const en = JSON.parse(readFileSync('src/i18n/en.json', 'utf8')) as Record<string, string>;
  assert.equal(en['例如：第一晚用品'], 'e.g. First-night box');
  assert.equal(en['添加'], 'Add');
  assert.equal(en['添加待办'], 'Add task');
});

test('footer tagline: a Chinese phone line breaks between words at a 17.5em measure; English keeps its rule', () => {
  const sheet = 'src/components/site-chrome.css';
  assert.deepEqual(rules(sheet, '.site-app .site-footer-line:lang(zh)', '(max-width:599px)'), { 'max-width': '17.5em', 'word-break': 'keep-all', 'overflow-wrap': 'anywhere' });
  assert.deepEqual(rules(sheet, '.site-app .site-footer-line:lang(zh) .site-footer-claim', '(max-width:599px)'), { 'white-space': 'normal' });
  assert.deepEqual(rules(sheet, '.site-app .site-footer-claim'), { 'white-space': 'nowrap' });
  // The route wait keeps a full screen (100vh: below the fold in every phone toolbar state).
  assert.equal(rules(sheet, '.site-route-wait')['min-height'], '100vh');
});

test('Select: a form Select takes the text field corner; the chip variant keeps the pill', () => {
  const sheet = 'src/components/ui/select.css';
  assert.equal(rules(sheet, '.ui-select>.ui-select__field')['border-radius'], 'var(--r-pill)');
  assert.deepEqual(rules(sheet, '.ui-select>.ui-select__field:not(.ui-select__field--chip)'), { 'border-radius': 'var(--r-md)' });
  assert.equal(rules('src/components/tools/tools.css', '.tool-field input,.tool-field textarea,.tool-output textarea')['border-radius'], 'var(--r-md)', 'the corner the form Select now shares');
  // Only /together's language filter is a chip Select.
  const users = ['src/features/outings/OutingsHub.tsx', 'src/features/outings/OutingForm.tsx', 'src/features/outings/OutingDiscussion.tsx', 'src/features/outings/OutingTimePoll.tsx', 'src/components/tools/LoanCalculatorTool.tsx', 'src/components/tools/AiCommunicationTool.tsx', 'src/components/tools/UnitPriceTool.tsx'];
  const chips = users.flatMap(file => [...readFileSync(file, 'utf8').matchAll(/<Select\b[^>]*ui-select__field--chip[^>]*>/g)].map(match => `${file}: ${/name="(\w+)"/.exec(match[0])?.[1]}`));
  assert.deepEqual(chips, ['src/features/outings/OutingsHub.tsx: language']);
});

test('verify-release pins the account shell\'s full-screen height in the built document\'s stylesheets', () => {
  const script = readFileSync('scripts/verify-release.mjs', 'utf8');
  assert.match(script, /dist\/\$\{locale\}account-shell\.html/);
  assert.match(script, /css\.includes\('\.account-shell\{min-height:100svh'\)/);
});

test('/together text links: the edge margin is given back only on a content edge, never between neighbours', () => {
  const css = 'src/features/outings/outings.css';
  assert.equal(rules(css, '.together-page .outing-link-button')['margin-inline'], 'calc(-1 * var(--sp-2))');
  assert.equal(rules(css, '.together-page :is(.outing-primary,.outing-secondary)+.outing-link-button')['margin-inline-start'], '0');
  assert.equal(rules(css, '.together-page .outing-link-button+:is(.outing-primary,.outing-secondary,.outing-link-button)')['margin-inline-start'], 'var(--sp-2)');
  // The host's member row (接受 + 婉拒, 婉拒 / 移除成员 + 屏蔽) is an 8px-gap flex row: with the rules above the 44px targets
  // keep 8px apart (8 gap - 8 + 8) and never overlap.
  assert.equal(rules(css, '.together-page .outing-member-actions').gap, 'var(--sp-2)');
});
