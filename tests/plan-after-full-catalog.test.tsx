import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test, { afterEach } from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';
import type { AppContextValue } from '../src/app/context';

/**
 * WEB-PLAN-DATA, the browser's path (BAYLINK_LAZY_PLAN=1) for a reader who comes to 行程 from a page that already holds the
 * full planner catalog and the planning, discovery and guide-index packs (My Week, /together, /me): 行程 loads only its
 * extras (cover records, linked offers, regions), not the generated events and places again, and no English pack.
 */
process.env.BAYLINK_LAZY_PLAN = '1';
const loaded: string[] = [];
registerHooks({
  resolve(specifier, context, next) {
    if (/plan-(?:catalog|extras)\.json$/.test(specifier)) loaded.push(specifier.split('/').pop()!);
    return next(specifier, context);
  },
});
const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'https://www.baylink.us/', pretendToBeVisual: true });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { render, act, cleanup, waitFor } = await import('@testing-library/react');
const { MemoryRouter, Routes, Route, Outlet } = await import('react-router-dom');
const { englishScopeLoaders } = await import('../src/data/generated/english-scope-loaders');
const requested: string[] = [];
const loaders = englishScopeLoaders as Record<string, () => Promise<unknown>>;
for (const [scope, load] of Object.entries(loaders)) loaders[scope] = () => { requested.push(scope); return load(); };
const { setLocale } = await import('../src/i18n/locale');
// What My Week holds: its English packs, and lib/planner with the full catalog.
assert.equal(await setLocale('en', false, '/my-week'), true);
assert.deepEqual(requested.splice(0).sort(), ['discovery', 'guide-index', 'planning', 'ui']);
await import('../src/lib/planner');
const { PLANNER_EVENTS: FULL_EVENTS } = await import('../src/data/planner-catalog');
const { arePlanExtrasInstalled, PLANNER_EVENTS } = await import('../src/lib/planner-source');
const { default: PlannerPage } = await import('../src/pages/PlannerPage');
afterEach(() => cleanup());

test('from a page with the full catalog and the planning packs, 行程 loads only its extras and no English pack', async () => {
  assert.equal(arePlanExtrasInstalled(), false);
  let view!: ReturnType<typeof render>;
  act(() => {
    view = render(<MemoryRouter initialEntries={['/plan?stops=place:golden-gate']}><Routes><Route element={<Outlet context={{ openBayBay: () => {}, setShowLogin: () => {} } as unknown as AppContextValue} />}>
      <Route path="/plan" element={<PlannerPage />} />
    </Route></Routes></MemoryRouter>);
  });
  await waitFor(() => assert.ok(!!view.container.querySelector('.planner-plan-overview')), { timeout: 20000 });
  assert.deepEqual(loaded, ['plan-extras.json'], 'the generated events and places are not loaded again');
  assert.deepEqual(requested, [], 'the planning, discovery and guide-index packs cover the workspace');
  assert.equal(PLANNER_EVENTS, FULL_EVENTS, 'the page reads the full catalog’s own records');
  assert.match(view.container.querySelector('.planner-plan-overview')?.textContent ?? '', /Golden Gate/);
  assert.doesNotMatch(view.container.querySelector('.planner-catalog')?.textContent ?? '', /\p{Script=Han}/u, 'the list is in English');
  await setLocale('zh-Hans', false);
});
