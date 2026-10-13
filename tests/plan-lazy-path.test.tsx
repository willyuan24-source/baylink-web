import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test, { afterEach } from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';
import type { PlanCatalog } from '../src/lib/planner-source';
import type { AppContextValue } from '../src/app/context';

/**
 * WEB-PLAN-DATA, the browser's path through 行程 (Node installs the generated planner catalog synchronously;
 * BAYLINK_LAZY_PLAN=1 makes it load the catalog as the browser does): the header renders at once, the workspace once the
 * catalog is in, a tap on 问 BayBay meanwhile opens BayBay with the plan, and /en loads only the UI pack with the route and
 * the catalog's own pack with the workspace — which shows the same English as with the planning, discovery and guide-index
 * packs /plan loaded before. This file never imports lib/planner.ts or data/planner-catalog.ts (they install the full one).
 */
process.env.BAYLINK_LAZY_PLAN = '1';
// Not /plan at import: the route chunk's boot start would race this file's own imports (the page is opened in a router below).
// The prerendered page is on screen, as at boot: the slot keeps its workspace until the app's own is in.
const dom = new JSDOM('<!doctype html><html><head></head><body><div id="root"><main data-prerender-path="/plan"><fieldset class="planner-interaction-scope"><div class="planner-data-slot" data-plan-slot=""><p id="prerendered-workspace">已排的日子</p></div></fieldset></main></div></body></html>', { url: 'https://www.baylink.us/', pretendToBeVisual: true });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { render, act, fireEvent, cleanup, waitFor } = await import('@testing-library/react');
const { MemoryRouter, Routes, Route, Outlet } = await import('react-router-dom');
const { englishScopeLoaders } = await import('../src/data/generated/english-scope-loaders');
// Every English pack the app downloads (the language module reads this registry when it first loads a pack).
const requested: string[] = [];
const loaders = englishScopeLoaders as Record<string, () => Promise<unknown>>;
for (const [scope, load] of Object.entries(loaders)) loaders[scope] = () => { requested.push(scope); return load(); };
const take = () => requested.splice(0).sort();
const { isPlanCatalogInstalled } = await import('../src/lib/planner-source');
assert.equal(isPlanCatalogInstalled(), false, 'the browser’s path: no catalog before the page asks for it');
const { default: PlannerPage } = await import('../src/pages/PlannerPage');
const { todayInBay } = await import('../src/lib/planner-core');
const { eventOccursOn } = await import('../src/lib/event-calendar');
const { GUEST_PLANNER_KEY } = await import('../src/lib/planner-library');
const { loadLocaleForPath, setLocale } = await import('../src/i18n/locale');
afterEach(() => cleanup());

// The fixtures come from the generated file itself (importing the catalog's sources would install the full catalog).
const catalog = JSON.parse(readFileSync('src/data/generated/plan-catalog.json', 'utf8')) as PlanCatalog;
const addDays = (day: string, days: number) => new Date(Date.parse(`${day}T12:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
const today = todayInBay();
const [date, event] = Array.from({ length: 30 }, (_, index) => addDays(today, index + 2)).flatMap(day => {
  const found = catalog.events.find(item => item.endDate >= day && eventOccursOn(item, day) && !!item.imageKey);
  return found ? [[day, found] as const] : [];
})[0];
const place = catalog.places.find(item => item.id === 'golden-gate')!;
const draft = `?date=${date}&stops=event:${event.id},place:${place.id}`;

function open(search: string, openBayBay: AppContextValue['openBayBay'] = () => {}) {
  return render(<MemoryRouter initialEntries={['/plan' + search]}><Routes><Route element={<Outlet context={{ openBayBay, setShowLogin: () => {} } as unknown as AppContextValue} />}>
    <Route path="/plan" element={<PlannerPage />} />
  </Route></Routes></MemoryRouter>);
}

test('the header renders at once and the workspace once the catalog is in; 问 BayBay tapped meanwhile opens BayBay with the plan', async () => {
  const calls: Parameters<AppContextValue['openBayBay']>[] = [];
  let view!: ReturnType<typeof open>;
  act(() => { view = open(draft, (...args) => { calls.push(args); }); });
  assert.ok(view.getByRole('heading', { level: 1, name: '行程' }));
  assert.equal(isPlanCatalogInstalled(), false);
  assert.equal(!!view.container.querySelector('.planner-plan-overview'), false, 'the workspace waits for the catalog');
  // at boot the slot shows the prerendered workspace (no skeleton over content already on screen)
  assert.equal(view.container.querySelector('[data-plan-slot][aria-busy="true"] #prerendered-workspace')?.textContent, '已排的日子');
  assert.equal(view.queryByRole('status'), null);
  fireEvent.click(view.getByRole('button', { name: '问 BayBay 排一天' }));
  assert.equal(calls.length, 0, 'the plan is not known yet');
  await waitFor(() => assert.ok(!!view.container.querySelector('.planner-plan-overview')), { timeout: 20000 });
  assert.equal(isPlanCatalogInstalled(), true);
  assert.equal(!!view.container.querySelector('#prerendered-workspace'), false, 'the app’s workspace replaced it');
  assert.equal(view.container.querySelector('.planner-plan-overview')?.getAttribute('data-state'), 'unsaved');
  assert.equal(calls.length, 1, 'the waiting tap opens BayBay once the workspace is in');
  assert.equal(calls[0][1]?.mode, 'draft');
  assert.ok(calls[0][0]?.includes(event.title) && calls[0][0]?.includes(place.title), calls[0][0]);
  // the list renders from the generated catalog
  assert.ok(!!view.container.querySelector(`[id="catalog-place:${place.id}"]`));
  // one fieldset holds the header and the workspace, which adds no box of its own
  assert.ok(!!view.container.querySelector('fieldset.planner-interaction-scope .ui-page-header'));
  assert.ok(!!view.container.querySelector('fieldset.planner-interaction-scope > .planner-data-slot > .planner-plan-overview'));
});

test('/en loads the UI pack with the route and the catalog’s pack with the workspace, and shows the same English as before', async () => {
  const days = [addDays(today, 3), addDays(today, 4)];
  localStorage.setItem(GUEST_PLANNER_KEY, JSON.stringify({ plans: [
    { id: 'p1', title: '周六一日', date: days[0], stops: [{ kind: 'place', id: 'golden-gate' }, { kind: 'place', id: 'chinatown' }], version: 1, createdAt: '2026-10-09T10:00:00Z', updatedAt: '2026-10-09T10:00:00Z' },
    { id: 'p2', title: '周日一日', date: days[1], stops: [{ kind: 'event', id: event.id }], version: 1, createdAt: '2026-10-09T10:00:00Z', updatedAt: '2026-10-09T10:00:00Z' },
  ], favorites: [], preferences: { regions: [], interests: [], travelMode: 'any' } }));
  take();
  assert.equal(await setLocale('en', false, '/plan'), true);
  assert.deepEqual(take(), ['ui'], '/plan: the header needs only the UI pack');
  const chinese = async () => {
    let view!: ReturnType<typeof open>;
    act(() => { view = open(draft); });
    await waitFor(() => assert.ok(!!view.container.querySelector('.planner-plan-overview') && !!view.container.querySelector('[data-testid="plan-days"] .ui-row-card')), { timeout: 20000 });
    // every place and event in the list
    for (let more = view.container.querySelector<HTMLButtonElement>('.planner-catalog-more'); more; more = view.container.querySelector<HTMLButtonElement>('.planner-catalog-more')) act(() => { fireEvent.click(more!); });
    assert.ok(view.container.querySelectorAll('.planner-catalog > *').length > catalog.places.length, 'the whole list is on screen');
    const text = [view.container.textContent ?? '', ...[...view.container.querySelectorAll('[aria-label],[placeholder],[alt]')].flatMap(element => ['aria-label', 'placeholder', 'alt'].map(name => element.getAttribute(name) ?? ''))].join('\n');
    cleanup();
    return [...new Set(text.match(/[㐀-鿿]+/gu) ?? [])].sort();
  };
  const scoped = await chinese();
  console.log(`Chinese runs left on /en/plan: ${scoped.length} (${scoped.slice(0, 12).join(' ')})`);
  assert.deepEqual(take(), ['plan-catalog'], 'the workspace: the catalog’s own pack');
  await loadLocaleForPath('en', '/my-week');
  assert.deepEqual(take(), ['discovery', 'guide-index', 'planning'], 'the packs /plan loaded before');
  const before = await chinese();
  assert.deepEqual(scoped, before, 'Chinese left on /en/plan with the catalog’s pack vs with the planning, discovery and guide-index packs');
  await setLocale('zh-Hans', false);
});
