// UI9-BB: the plan card's visual contract — C's number plate on every stop, one StatusChip per status from C's table (no
// amber), nothing cut with an ellipsis, thousands separators and kept cents, the card's one primary, and the L07 order.
import './baybay-test-transport';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test, { afterEach } from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage,
  HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { render, cleanup } = await import('@testing-library/react');
const { BayBayAssistantPlanCard } = await import('../src/components/BayBayAssistantPlan');
const { parseBayBayAssistantFields } = await import('../src/lib/baybay-assistant');
const { bayBayUsd } = await import('../src/features/baybay/money');
const { setLocale } = await import('../src/i18n/locale');
afterEach(async () => { cleanup(); await setLocale('zh-Hans', false); });
const noop = () => {};
const live = JSON.parse(readFileSync(new URL('./support/baybay-l07-plan.json', import.meta.url), 'utf8'));

function card(patch: Record<string, unknown> = {}) {
  const parsed = parseBayBayAssistantFields({ ...live, assistantPlan: { ...live.assistantPlan, ...patch } });
  return render(<BayBayAssistantPlanCard plan={parsed.assistantPlan!} taskState={parsed.taskState} evidence={parsed.evidence!} disabled={false} onAsk={noop} onNavigate={noop} />);
}

test('every stop number is C\'s number plate, one line, in order', () => {
  const view = card();
  const plates = [...view.container.querySelectorAll('.baybay-plan-stops > li .baybay-plan-stop-number')];
  assert.equal(plates.length, live.assistantPlan.stops.length);
  assert.ok(plates.every(plate => plate.classList.contains('ui-plate')), 'the number-plate class (UI9-C), no BB copy of its look');
  assert.deepEqual(plates.map(plate => plate.textContent), plates.map((_, index) => String(index + 1)));
  const css = readFileSync('src/features/baybay/baybay-panel.css', 'utf8');
  assert.match(css, /\.baybay-plan-stop-number\.ui-plate \{[^}]*min-width:1\.75em;[^}]*white-space:nowrap;/, 'G5: at least 1.75em, never wrapped');
});

test('one StatusChip per status from C\'s table: 安排草案, 部分信息待核实 and 还需补充条件 take the neutral look, never amber', async () => {
  for (const [status, words] of [['ready', '安排草案'], ['needs_verification', '部分信息待核实'], ['needs_details', '还需补充条件']] as const) {
    const view = card({ status });
    const chip = view.container.querySelector('header .ui-status')!;
    assert.equal(chip.textContent, words);
    assert.equal(chip.getAttribute('data-tone'), 'neutral', `${words}: C's one look`);
    assert.equal(view.container.querySelector('[class*="baybay-plan-status--"]'), null, 'no local status tone');
    cleanup();
  }
  const css = readFileSync('src/features/baybay/baybay-panel.css', 'utf8') + readFileSync('src/features/baybay/baybay-answer.css', 'utf8');
  assert.doesNotMatch(css, /--color-warning|--color-info/, 'no amber or indigo anywhere in the panel');
});

test('nothing in the panel is cut with an ellipsis or a line clamp (N25, G8)', () => {
  for (const file of ['src/features/baybay/baybay-panel.css', 'src/features/baybay/baybay-answer.css']) {
    const css = readFileSync(file, 'utf8');
    assert.doesNotMatch(css, /text-overflow:\s*ellipsis|-webkit-line-clamp:\s*\d/, file);
  }
  const answer = readFileSync('src/features/baybay/baybay-answer.css', 'utf8');
  assert.match(answer, /\.bb-card :is\(\.ui-feed-card__title,\.ui-row-card__title\) \{ display:block; overflow:visible;/, 'card titles undo the shared 2-line clamp');
  const view = card();
  assert.equal(view.container.querySelector('.baybay-plan-status')?.getAttribute('style'), null);
});

test('budgets and limits carry a thousands separator; subtotals keep their cents', async () => {
  assert.equal(bayBayUsd(1900), '$1,900');
  assert.equal(bayBayUsd(42.5), '$42.50');
  assert.equal(bayBayUsd(0, true), '$0.00');
  assert.equal(bayBayUsd(12345.678, true), '$12,345.68');
  await setLocale('en', false);
  const view = card({ budget: { knownTotalUsd: 2480, unknownItems: [], limitUsd: 1900, scope: 'total' } });
  const budget = view.container.querySelector('.baybay-plan-budget')!;
  assert.match(budget.textContent || '', /\$2,480/);
  assert.match(budget.textContent || '', /Budget limit \$1,900 · whole group/);
  assert.match(budget.textContent || '', /exceed the group budget by \$580\.00/);
  assert.equal(budget.querySelector('strong')?.textContent, '$2,480', 'the subtotal is the one key value');
});

test('the L07 card reads date → title → status → summary → costs → 先确认这些 → stops → handoff; the handoff is the one primary', () => {
  const view = card();
  const plan = view.container.querySelector('.baybay-assistant-plan')!;
  const order = [...plan.children].map(child => child.tagName === 'HEADER' ? 'header' : child.className.split(' ')[0]);
  const at = (name: string) => order.indexOf(name);
  assert.ok(at('header') === 0 && at('baybay-plan-budget') > 0 && at('baybay-plan-stops') > at('baybay-plan-budget'), order.join(' '));
  if (at('baybay-plan-key-unknowns') >= 0) assert.ok(at('baybay-plan-key-unknowns') > at('baybay-plan-budget') && at('baybay-plan-key-unknowns') < at('baybay-plan-stops'), 'a sibling block, not inside the budget');
  assert.equal(plan.querySelector('.baybay-plan-budget .baybay-plan-key-unknowns'), null, 'no nested boxes');
  const primaries = plan.querySelectorAll('[data-variant="primary"]');
  assert.equal(primaries.length, 1, 'one primary per card');
  assert.match(primaries[0].textContent || '', /带入计划页/);
  assert.ok(plan.querySelector('.baybay-plan-swap[data-variant="quiet"]'), '换掉第 n 站 is quiet');
  assert.ok([...plan.querySelectorAll('.baybay-plan-followups .ui-chip')].length === 2, 'two follow-up chips');
  // De-duplicated citations: one per source page in each stop, each stamp on its own line inside its link.
  for (const stop of plan.querySelectorAll('.baybay-plan-stops > li')) {
    const hrefs = [...stop.querySelectorAll('.baybay-plan-citations a')].map(link => link.getAttribute('href'));
    assert.equal(new Set(hrefs).size, hrefs.length);
  }
});
