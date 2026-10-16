import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test, { afterEach } from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';
import type { PlanCatalog } from '../src/lib/planner-source';
import type { AppContextValue } from '../src/app/context';

/**
 * WEB-PERF-3 on 行程, the browser's path (BAYLINK_LAZY_PLAN=1, as tests/plan-lazy-path.test.tsx):
 * - H20: a plain visit shows the header, this weekend's picks and the saved days from storage at once, and loads the
 *   planner catalog and the workspace only when the reader acts (or at idle, for saved days), never at boot;
 * - H54: the page opens with this weekend's covers (the home page's snapshot), each opening its event;
 * - H79: a ♡ in the list confirms with the site's SaveToast;
 * - H44: the post and profile sheets are warmed by the community board, not by the app shell on every page.
 */
process.env.BAYLINK_LAZY_PLAN = '1';
const dom = new JSDOM('<!doctype html><html><head></head><body><div id="root"><main data-prerender-path="/plan"><fieldset class="planner-interaction-scope"><div class="planner-data-slot" data-plan-slot=""><section id="plan-days">已排的日子</section><p id="prerendered-workspace">挑地点和活动</p></div></fieldset></main></div></body></html>', { url: 'https://www.baylink.us/', pretendToBeVisual: true });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { render, act, fireEvent, cleanup, waitFor } = await import('@testing-library/react');
const { MemoryRouter, Routes, Route, Outlet } = await import('react-router-dom');
const { arePlanExtrasInstalled, isPlannerCatalogInstalled } = await import('../src/lib/planner-source');
const isPlanCatalogInstalled = () => isPlannerCatalogInstalled() && arePlanExtrasInstalled();
const { GUEST_PLANNER_KEY } = await import('../src/lib/planner-storage-key');
const { todayInBay } = await import('../src/lib/planner-core');
const { getHomeWeekend } = await import('../src/lib/home-weekend');
const { getBayAreaToday } = await import('../src/lib/monthly');
afterEach(() => cleanup());

const catalog = JSON.parse(readFileSync('src/data/generated/plan-catalog.json', 'utf8')) as PlanCatalog;
const addDays = (day: string, days: number) => new Date(Date.parse(`${day}T12:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
const place = catalog.places.find(item => item.id === 'golden-gate')!;
const second = catalog.places.find(item => item.id !== place.id)!;
const day = addDays(todayInBay(), 2);

function open(search = '') {
  return render(<MemoryRouter initialEntries={['/plan' + search]}><Routes><Route element={<Outlet context={{ openBayBay: () => {}, setShowLogin: () => {} } as unknown as AppContextValue} />}>
    <Route path="/plan" element={<PlannerPage />} />
  </Route></Routes></MemoryRouter>);
}
const { default: PlannerPage } = await import('../src/pages/PlannerPage');

test('a plain visit: header, this weekend’s covers and the saved days at once; the catalog only after the reader acts', async () => {
  localStorage.setItem(GUEST_PLANNER_KEY, JSON.stringify({ preferences: {}, favorites: [], plans: [{ id: 'p1', title: '周六金门', date: day, stops: [{ kind: 'place', id: place.id }, { kind: 'place', id: second.id }], version: 1, createdAt: '', updatedAt: '' }] }));
  let view!: ReturnType<typeof open>;
  act(() => { view = open(); });
  assert.ok(view.getByRole('heading', { level: 1, name: '行程' }));
  // H54: the home page's weekend snapshot, picks first, up to four cards, each a link to its event on its day.
  const weekend = getHomeWeekend(getBayAreaToday());
  const expected = [...weekend.picks, ...weekend.feed].slice(0, 4);
  const strip = view.container.querySelector('.plan-weekend');
  if (!expected.length) assert.equal(strip, null, 'no weekend events: no strip');
  else {
    assert.ok(strip, 'the weekend strip renders with the header');
    assert.equal(strip!.compareDocumentPosition(view.container.querySelector('#plan-days')!) & dom.window.Node.DOCUMENT_POSITION_FOLLOWING, dom.window.Node.DOCUMENT_POSITION_FOLLOWING, 'above 已排的日子 and the planner');
    const links = [...strip!.querySelectorAll<HTMLAnchorElement>('.ui-card-link')].map(link => link.getAttribute('href'));
    assert.deepEqual(links, expected.map(entry => `/events/${entry.event.id}?date=${entry.date}`));
    assert.equal(strip!.querySelector('h2')?.textContent?.startsWith('本周末精选'), true);
    assert.ok(strip!.querySelector('a[href="/events"]'), 'and a way to every event');
    const photos = strip!.querySelectorAll('img');
    if (photos.length) assert.equal(photos[0].getAttribute('fetchpriority'), 'high', 'the first cover is the page’s one eager image');
  }
  // H20: 已排的日子 renders from storage before the catalog: the day, its title, one placeholder row per stop.
  const days = view.getByTestId('plan-days');
  assert.ok(days.textContent?.includes('周六金门'), days.textContent ?? '');
  assert.equal(days.querySelectorAll('.plan-days__stops > li').length, 2);
  assert.ok(view.getByRole('link', { name: '打开这一天' }).getAttribute('href')?.endsWith('/plan?edit=p1'));
  // the rest of the slot is still the prerendered workspace, and nothing asked for the catalog yet
  assert.ok(view.container.querySelector('[data-plan-slot][aria-busy="true"] #prerendered-workspace'));
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 300)); });
  assert.equal(isPlanCatalogInstalled(), false, 'no catalog at boot');
  // the reader's first move starts it (saved days would also start it at idle)
  act(() => { window.dispatchEvent(new window.Event('pointerdown')); });
  await waitFor(() => assert.ok(view.container.querySelector('.planner-catalog')), { timeout: 20000 });
  assert.equal(isPlanCatalogInstalled(), true);
  assert.equal(view.container.querySelector('#prerendered-workspace'), null, 'the app’s workspace replaced the prerendered one');
  // the full 已排的日子 now names the stops
  await waitFor(() => assert.ok(view.getByTestId('plan-days').textContent?.includes(place.title)));
});

test('a ♡ in the list confirms with the SaveToast and its link to the saved list (H79)', async () => {
  localStorage.clear();
  let view!: ReturnType<typeof open>;
  act(() => { view = open(); });
  await waitFor(() => assert.ok(view.container.querySelector('.planner-catalog .planner-heart:not([disabled])')), { timeout: 20000 });
  const heart = view.container.querySelector<HTMLButtonElement>('.planner-catalog .planner-heart:not([disabled])')!;
  assert.equal(heart.getAttribute('aria-pressed'), 'false');
  await act(async () => { fireEvent.click(heart); });
  await waitFor(() => assert.equal(heart.getAttribute('aria-pressed'), 'true'));
  const toast = await waitFor(() => { const found = view.getByRole('link', { name: '查看' }); return found; });
  assert.equal(toast.getAttribute('href'), '/my-week#saved');
  assert.ok(document.body.textContent?.includes('已收藏'));
});

test('a link that opens a plan puts 这一天的安排 first: no weekend strip above it (FC3-01)', async () => {
  localStorage.clear();
  let view!: ReturnType<typeof open>;
  act(() => { view = open(`?date=${day}&stops=place:${place.id}`); });
  assert.equal(view.container.querySelector('.plan-weekend'), null);
  await waitFor(() => assert.ok(view.container.querySelector('.planner-plan-overview')), { timeout: 20000 });
  assert.equal(view.container.querySelector('.planner-page section'), view.container.querySelector('.planner-plan-overview'));
  assert.equal(view.container.querySelector('.plan-weekend'), null);
});

test('the post and profile sheets are warmed by the community board, not by the shell on every page (H44)', () => {
  const shell = readFileSync('src/app/AppLayout.tsx', 'utf8').replace(/\/\/.*$/gm, '');
  assert.doesNotMatch(shell, /import\(['"]\.\.\/features\/posts\/PostDetailModal['"]\)/);
  assert.doesNotMatch(shell, /import\(['"]\.\.\/features\/users\/UserProfileModal['"]\)/);
  const board = readFileSync('src/pages/CommunityBoard.tsx', 'utf8');
  assert.match(board, /void import\('\.\.\/features\/posts\/PostDetailModal'\)/);
  assert.match(board, /void import\('\.\.\/features\/users\/UserProfileModal'\)/);
});
