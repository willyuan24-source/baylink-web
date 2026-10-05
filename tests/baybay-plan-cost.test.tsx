import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import React from 'react';
import type { BayBayAssistantPlan } from '../src/lib/baybay-assistant';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage,
  HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { render, cleanup } = await import('@testing-library/react');
const { BayBayAssistantPlanCard } = await import('../src/components/BayBayAssistantPlan');
const { setLocale } = await import('../src/i18n/locale');
afterEach(async () => { cleanup(); localStorage.clear(); await setLocale('zh-Hans', false); });

const noop = () => {};
function plan(admissionUsd: number | undefined, knownTotalUsd: number | undefined, unknownItems: string[]): BayBayAssistantPlan {
  return { id: 'cost-check', title: 'Museum day', date: '2026-10-10', status: 'needs_verification',
    stops: [{ id: 'museum', kind: 'web', title: 'City museum', city: 'San Jose', admissionUsd, sourceIds: ['official'], notes: [] }],
    budget: { knownTotalUsd, unknownItems }, checks: [], unknowns: [] };
}
function show(value: BayBayAssistantPlan) {
  const view = render(<BayBayAssistantPlanCard plan={value} evidence={[{ id: 'official', kind: 'web', title: 'Official admissions', url: 'https://museum.example/admission' }]} disabled={false} onAsk={noop} onNavigate={noop} />);
  return { view, budget: view.container.querySelector('.baybay-plan-budget')! };
}

test('unpriced admissions show pending cost instead of a prominent zero subtotal in Chinese', () => {
  const { budget } = show(plan(undefined, 0, ['门票价格待核实。']));
  assert.equal(budget.querySelector('p strong')?.textContent, '费用待核算');
  assert.doesNotMatch(budget.textContent || '', /\$0/);
  assert.match(budget.textContent || '', /门票价格待核实/);
});

test('missing admission or other unpriced costs cannot imply a free trip', async () => {
  await setLocale('en', false);
  for (const value of [plan(undefined, 0, []), plan(0, 0, ['Transit fare remains unknown.']), plan(undefined, undefined, [])]) {
    const { view, budget } = show(value);
    assert.equal(budget.querySelector('p strong')?.textContent, 'Cost not yet calculated');
    assert.doesNotMatch(budget.textContent || '', /\$0/);
    view.unmount();
  }
});

test('a complete zero cost remains visible even if a non-cost detail needs verification', async () => {
  await setLocale('en', false);
  const value = plan(0, 0, []);
  value.unknowns = ['Opening hours need checking.'];
  const { budget } = show(value);
  assert.equal(budget.querySelector('p')?.textContent, 'Known costs subtotal for the whole group $0');
  assert.doesNotMatch(budget.textContent || '', /Cost not yet calculated/);
});

test('positive known costs retain their subtotal and outstanding costs', async () => {
  await setLocale('en', false);
  const { budget } = show(plan(20, 40, ['Transit fare remains unknown.']));
  assert.equal(budget.querySelector('p')?.textContent, 'Known costs subtotal for the whole group $40');
  assert.match(budget.textContent || '', /Transit fare remains unknown/);
});
