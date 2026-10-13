import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test, { afterEach } from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';
import type { AppContextValue } from '../src/app/context';

/**
 * WEB-PLAN-DATA, RC-25 on 行程's browser path (BAYLINK_LAZY_PLAN=1): when the planner catalog does not load (offline
 * without it in the cache, a deploy that swapped files), the header still works, the workspace shows ErrorState with 重试
 * and the offline line says the plans need a connection; 问 BayBay opens with the general draft; 重试 loads the workspace.
 */
process.env.BAYLINK_LAZY_PLAN = '1';
let catalogOffline = true;
registerHooks({
  resolve(specifier, context, next) {
    if (catalogOffline && specifier.includes('plan-catalog.json')) throw new TypeError('Failed to fetch dynamically imported module: plan-catalog.json');
    return next(specifier, context);
  },
});
const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'https://www.baylink.us/', pretendToBeVisual: true });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
Object.defineProperty(dom.window.navigator, 'onLine', { configurable: true, get: () => !catalogOffline });
const { render, act, fireEvent, cleanup, waitFor } = await import('@testing-library/react');
const { MemoryRouter, Routes, Route, Outlet } = await import('react-router-dom');
const { default: PlannerPage } = await import('../src/pages/PlannerPage');
const { isPlanCatalogInstalled } = await import('../src/lib/planner-source');
afterEach(() => cleanup());

test('without the catalog the header works, the workspace shows ErrorState and its retry loads the plan', async () => {
  const calls: Parameters<AppContextValue['openBayBay']>[] = [];
  let view!: ReturnType<typeof render>;
  act(() => {
    view = render(<MemoryRouter initialEntries={['/plan?stops=place:golden-gate']}><Routes><Route element={<Outlet context={{ openBayBay: (...args: Parameters<AppContextValue['openBayBay']>) => { calls.push(args); }, setShowLogin: () => {} } as unknown as AppContextValue} />}>
      <Route path="/plan" element={<PlannerPage />} />
    </Route></Routes></MemoryRouter>);
  });
  // no prerendered page (an in-app visit): skeleton rows while it loads
  assert.ok(view.getByRole('status').textContent?.includes('正在加载'));
  assert.equal(!!view.container.querySelector('[data-plan-slot] [aria-busy="true"]'), true);
  // a tap while it loads waits; the load fails (once more after a second: chunkLoader), so BayBay opens with the general draft
  fireEvent.click(view.getByRole('button', { name: '问 BayBay 排一天' }));
  await waitFor(() => assert.ok(!!view.queryByRole('heading', { name: '行程暂时没能加载' })), { timeout: 20000 });
  assert.equal(isPlanCatalogInstalled(), false);
  assert.deepEqual(calls, [['帮我排一天湾区出游：', { mode: 'draft' }]]);
  assert.match(view.container.querySelector('.planner-offline')?.textContent ?? '', /你现在离线：行程要联网后才能打开/);
  assert.ok(view.getByRole('heading', { level: 1, name: '行程' }), 'the header stays');
  // a tap on the error state's page opens BayBay at once
  fireEvent.click(view.getByRole('button', { name: '问 BayBay 排一天' }));
  assert.equal(calls.length, 2);
  catalogOffline = false;
  await act(async () => { fireEvent.click(view.getByRole('button', { name: '重试' })); });
  await waitFor(() => assert.ok(!!view.container.querySelector('.planner-plan-overview')), { timeout: 20000 });
  assert.equal(isPlanCatalogInstalled(), true);
  assert.equal(view.queryByRole('heading', { name: '行程暂时没能加载' }), null);
  assert.equal(!!view.container.querySelector('.planner-offline'), false, 'back online');
  assert.ok(view.container.querySelector('.planner-plan-overview')?.textContent?.includes('金门大桥'));
  fireEvent.click(view.getByRole('button', { name: '问 BayBay 排一天' }));
  assert.equal(calls.length, 3);
  assert.match(calls[2][0] ?? '', /金门大桥/, 'with the workspace in, BayBay gets the plan');
});
