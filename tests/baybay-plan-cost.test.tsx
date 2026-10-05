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
  const view = render(<BayBayAssistantPlanCard plan={value} taskState={{ version: 1, revision: 1, partySize: 3, childAges: [5] }} evidence={[{ id: 'official', kind: 'web', title: 'Official admissions', url: value.stops[0].admissionFacts?.sourceUrl || 'https://museum.example/admission' }]} disabled={false} onAsk={noop} onNavigate={noop} />);
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

function pierPlan(): BayBayAssistantPlan {
  return { id: 'pier-only', title: 'PIER 39', date: '2026-11-07', status: 'needs_verification',
    stops: [{ id: 'place:pier39', entityId: 'pier39', kind: 'place', title: 'PIER 39', sourceIds: ['official'], notes: ['仅公共步行区和海狮观景免费；收费游乐项目另算。'],
      admissionFacts: { status: 'partial', basis: 'catalog-snapshot', knownTotalUsd: 0, sourceUrl: 'https://www.pier39.com/frequently-asked-questions/', checkedAt: '2026-10-04', sourceIds: ['official'],
        breakdown: [{ category: 'all-ages', quantity: 3, unitUsd: 0, subtotalUsd: 0 }], applicability: { date: '2026-11-07', dateStatus: 'regular-unconfirmed', feesIncluded: true }, unknowns: ['所选日期是否开放及适用仍待确认。'] } }],
    budget: { knownTotalUsd: 0, unknownItems: ['餐饮和交通未计入。'] }, checks: [], unknowns: [] };
}

test('source-backed PIER39 zero admission stays visible without claiming verified dates or a free trip in all locales', async () => {
  for (const [locale, label, dateNote, costNote] of [
    ['zh-Hans', '全组已知门票小计 $0.00', '所选日期适用性待确认', '小计不代表完整出行总价'],
    ['zh-Hant', '全組已知門票小計 $0.00', '所選日期適用性待確認', '小計不代表完整出行總價'],
    ['en', 'Known group admission subtotal $0.00', 'Eligibility on your chosen date is unconfirmed', 'The subtotal is not the full trip cost'],
  ] as const) {
    await setLocale(locale, false);
    const value = pierPlan(), { view, budget } = show(value);
    assert.equal(budget.querySelector('p')?.textContent, label);
    assert.ok(view.container.textContent?.includes(dateNote));
    assert.ok(budget.textContent?.includes(costNote));
    assert.equal(view.container.querySelector('a[href="https://www.pier39.com/frequently-asked-questions/"]') !== null, true);
    assert.equal(value.stops[0].admissionFacts?.status, 'partial');
    view.unmount();
  }
});

test('zero stays pending without resolvable admission evidence, complete party coverage or a known amount at every stop', () => {
  const missingSource = pierPlan(); missingSource.stops[0].admissionFacts!.sourceIds = ['missing'];
  const childUnpriced = pierPlan(); childUnpriced.stops[0].admissionFacts!.breakdown = [{ category: 'adult', quantity: 2, unitUsd: 0, subtotalUsd: 0 }];
  const unknownStatus = pierPlan(); unknownStatus.stops[0].admissionFacts!.status = 'unknown';
  const invalidDate = pierPlan(); invalidDate.stops[0].admissionFacts!.applicability.dateStatus = 'out-of-range';
  const mismatchedTotal = pierPlan(); mismatchedTotal.stops[0].admissionFacts!.knownTotalUsd = 10;
  const unpricedStop = pierPlan(); unpricedStop.stops.push({ id: 'museum', kind: 'web', title: 'Museum', sourceIds: ['official'], notes: [] });
  for (const value of [missingSource, childUnpriced, unknownStatus, invalidDate, mismatchedTotal, unpricedStop]) {
    const { view, budget } = show(value);
    assert.equal(budget.querySelector('p strong')?.textContent, '费用待核算');
    view.unmount();
  }
});
