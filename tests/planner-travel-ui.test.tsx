import assert from 'node:assert/strict';
import test, { after, afterEach, beforeEach } from 'node:test';
import React from 'react';
import { JSDOM } from 'jsdom';
import type { PlanDetails, Stop } from '../src/lib/planner';
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/plan' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { render, fireEvent, cleanup, act } = await import('@testing-library/react');
const { PlannerTravelCheck } = await import('../src/components/PlannerTravelCheck');
const { isPlannerTravelEstimate } = await import('../src/lib/planner-travel');
const { PLANNER_PLACES } = await import('../src/data/planner-catalog');
const { api } = await import('../src/lib/api');
const { setLocale } = await import('../src/i18n/locale');
const known = PLANNER_PLACES.filter(row => row.location?.precision === 'venue').slice(0, 2);
const stops: Stop[] = known.map(row => ({ kind: 'place', id: row.id }));
const details: PlanDetails = { startTime: '10:00', finishBy: '18:00', partySize: 2, totalBudgetUsd: null, extraCostUsd: 0, travelMode: 'drive', stopSettings: [] };
beforeEach(async () => { localStorage.clear(); await setLocale('zh-Hans'); });
afterEach(cleanup);
after(() => dom.window.close());
const expand = (view: ReturnType<typeof render>) => {
  const panel = view.getByText('这几站来得及吗？核对交通').closest('details')!;
  panel.open = true; fireEvent(panel, new dom.window.Event('toggle'));
};

test('route estimates must match both stops, selected mode and exact Pacific departure time', () => {
  const expected = { from: stops[0], to: stops[1], date: '2026-10-17', time: '12:00', mode: 'drive' as const };
  const estimate = { ok: true, provider: 'google-maps', from: stops[0], to: stops[1], travelMode: 'drive', durationMinutes: 25, distanceMeters: 12000, warnings: [], departureAt: '2026-10-17T19:00:00.000Z', checkedAt: '2026-10-01T19:00:00.000Z' };
  assert.equal(isPlannerTravelEstimate(estimate, expected), true);
  for (const patch of [{ from: stops[1] }, { to: stops[0] }, { travelMode: 'walk' }, { departureAt: '2026-10-17T20:00:00.000Z' }, { departureAt: '2026-10-18T19:00:00.000Z' }, { departureAt: '2026-10-17T19:00:01.000Z' }, { checkedAt: 'invalid' }, { durationMinutes: 2000 }, { warnings: Array(6).fill('extra') }]) assert.equal(isPlannerTravelEstimate({ ...estimate, ...patch }, expected), false, JSON.stringify(patch));
  assert.equal(isPlannerTravelEstimate({ ...estimate, departureAt: '2026-11-08T20:00:00.000Z' }, { ...expected, date: '2026-11-08' }), true, 'winter Pacific offset is not hard-coded');
});

test('disabled or failed route capability hides paid actions and retains working map links', async t => {
  const paths: string[] = [];
  t.mock.method(api, 'request', async (path: string) => { paths.push(path); return { available: false }; });
  const view = render(<PlannerTravelCheck stops={stops} date="2026-10-17" details={details}/>);
  assert.deepEqual(paths, [], 'collapsed travel checks perform no requests'); expand(view);
  await act(async () => {});
  assert.equal(view.queryByRole('button', { name: '核对这段路程' }), null);
  assert.match(view.getByRole('link', { name: /打开地图核对/ }).getAttribute('href')!, /^https:\/\/www.google.com\/maps\/dir\//);
  assert.deepEqual(paths, ['/planner/travel-capabilities']);
  view.unmount();
  t.mock.method(api, 'request', async () => { throw Error('offline'); });
  const failed = render(<PlannerTravelCheck stops={stops} date="2026-10-17" details={details}/>); expand(failed); await act(async () => {});
  assert.equal(failed.queryByRole('button', { name: '核对这段路程' }), null); assert.ok(failed.getByRole('link', { name: /打开地图核对/ }));
});

test('routing only starts after available capability and explicit click; a mismatched leg response is not displayed', async t => {
  const paths: string[] = [];
  t.mock.method(api, 'request', async (path: string) => { paths.push(path); return path.endsWith('capabilities') ? { available: true } : { ok: true, provider: 'google-maps', from: stops[1], to: stops[0], travelMode: 'drive', durationMinutes: 25, distanceMeters: 12000, warnings: [], departureAt: '2026-10-17T19:00:00.000Z', checkedAt: '2026-10-01T19:00:00.000Z' }; });
  const view = render(<PlannerTravelCheck stops={stops} date="2026-10-17" details={details}/>);
  expand(view);
  const button = await view.findByRole('button', { name: '核对这段路程' }); assert.deepEqual(paths, ['/planner/travel-capabilities']);
  fireEvent.click(button); await view.findByRole('status');
  assert.deepEqual(paths, ['/planner/travel-capabilities', '/planner/travel-estimate']); assert.equal(view.queryByText('Google Maps'), null);
});

test('closing travel checks aborts pending availability and a late response cannot reopen the panel', async t => {
  let signal: AbortSignal | undefined, resolve!: (value: unknown) => void;
  t.mock.method(api, 'request', (_path: string, options: RequestInit) => { signal = options.signal as AbortSignal; return new Promise(yes => { resolve = yes; }); });
  const view = render(<PlannerTravelCheck stops={stops} date="2026-10-17" details={details}/>); expand(view);
  assert.ok(signal); assert.equal(signal.aborted, false);
  const panel = view.getByText('这几站来得及吗？核对交通').closest('details')!;
  panel.open = false; fireEvent(panel, new dom.window.Event('toggle'));
  assert.equal(signal.aborted, true);
  await act(async () => resolve({ available: true }));
  assert.equal(view.queryByRole('button', { name: '核对这段路程' }), null);
  assert.equal(view.queryByRole('link', { name: /打开地图核对/ }), null);
});
