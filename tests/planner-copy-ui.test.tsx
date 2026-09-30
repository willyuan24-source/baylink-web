import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import React from 'react';
import { JSDOM } from 'jsdom';
import type { PlanDetails } from '../src/lib/planner';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://www.baylink.us/plan' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage,
  HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { render, cleanup, act, fireEvent } = await import('@testing-library/react');
const { MemoryRouter } = await import('react-router-dom');
const { setLocale } = await import('../src/i18n/locale');
const { PlannerSchedule } = await import('../src/components/PlannerSchedule');
const { PlannerOutingOptions } = await import('../src/components/PlannerOutingOptions');
const { defaultPlanDetails } = await import('../src/lib/planner-itinerary');
afterEach(async () => { cleanup(); await setLocale('zh-Hans', false); });

test('English time evidence and outing notices show limitations without untranslated core copy', async context => {
  context.mock.timers.enable({ apis: ['Date'], now: new Date('2026-09-29T19:00:00Z') });
  await act(async () => { await setLocale('en', false); });
  const view = render(<MemoryRouter>
    <PlannerSchedule stops={[{ kind: 'place', id: 'restaurant-town-fare-omca' }]} date="2026-10-03" title="Lunch"
      details={{ ...defaultPlanDetails(), startTime: '12:00' }} onChange={() => {}} onStatus={() => {}} />
    <PlannerOutingOptions suggestion={{ id: 'ferry', eventId: 'ferry-plaza-farmers-market-2026-autumn', date: '2026-10-03', placeIds: [], reason: '', reasons: [], unknowns: [] }}
      filters={{ date: '2026-10-03', city: 'San Francisco', partySize: 2 }} onChoose={() => {}} />
  </MemoryRouter>);
  const time = view.container.querySelector('.planner-time-notices')!.textContent!;
  assert.match(time, /Last dine-in orders are at 15:15/);
  assert.match(time, /does not take reservations/);
  assert.doesNotMatch(time, /[\u3400-\u9fff]/);
  const notices = view.container.querySelector('.planner-outing-notices')!.textContent!;
  assert.match(notices, /not verified routes or actual journey times/);
  assert.match(notices, /0.*placeholder/);
  assert.doesNotMatch(notices, /[\u3400-\u9fff]/);
});

test('cost editing rounds every component before emitting the total used for saving', async () => {
  await act(async () => { await setLocale('en', false); });
  let changed: PlanDetails | undefined;
  const view = render(<MemoryRouter><PlannerSchedule stops={[]} date="2026-10-03" title="Budget"
    details={{ ...defaultPlanDetails(), extraCostUsd: 0.335 }} onChange={details => { changed = details; }} onStatus={() => {}} /></MemoryRouter>);
  fireEvent.change(view.getByLabelText('Food allowance (whole group) $'), { target: { value: '1.005' } });
  assert.ok(changed);
  assert.deepEqual(changed.costBreakdown, { foodUsd: 1.01, transportUsd: 0, otherUsd: 0.34 });
  assert.equal(changed.extraCostUsd, 1.35);
  assert.ok(Math.abs(Object.values(changed.costBreakdown!).reduce((sum, value) => sum + value, 0) - changed.extraCostUsd) <= 0.0000001);
});
