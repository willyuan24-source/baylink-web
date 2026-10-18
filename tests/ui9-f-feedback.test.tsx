// UI9-F review: the behaviours this lane added — the never-disabled home search and BayBay send, the sheet's exit, the
// route feedback bar, and quiet chunk warming (a failed warm neither reloads the page nor beacons).
import { mockBayBayFetch } from './baybay-test-transport';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test, { afterEach } from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost/', pretendToBeVisual: true });
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document, location: dom.window.location, localStorage: dom.window.localStorage, sessionStorage: dom.window.sessionStorage,
  HTMLElement: dom.window.HTMLElement, Element: dom.window.Element, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
dom.window.HTMLElement.prototype.getClientRects = function () {
  return (this.isConnected && !this.hidden ? [{ width: 1, height: 1 }] : []) as unknown as DOMRectList;
};
let reducedMotion = false;
dom.window.matchMedia = ((query: string) => ({ matches: /reduce/.test(query) ? reducedMotion : false, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} })) as unknown as typeof dom.window.matchMedia;

const { render, fireEvent, cleanup, act, within } = await import('@testing-library/react');
const { MemoryRouter } = await import('react-router-dom');
const { HomeHead } = await import('../src/features/home/HomeHead');
const { BayBayAssistantEntry } = await import('../src/components/BayBayAssistantEntry');
const { Sheet } = await import('../src/components/ui/Sheet');
const { READING_SIZE_KEY } = await import('../src/lib/reading-preferences');
const { routeActivity, routeKey } = await import('../src/lib/route-activity');
const { warmablePage, warmPage, forgetFailedWarms } = await import('../src/app/route-warm');
const { RouteProgress } = await import('../src/app/RouteProgress');
const { installChunkRecovery } = await import('../src/lib/chunk-recovery');

afterEach(() => { cleanup(); localStorage.clear(); document.documentElement.removeAttribute('data-simple'); reducedMotion = false; routeActivity.reset(); forgetFailedWarms(); });
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

test('home search is never disabled: an empty submit offers the example question and focuses the box, and sends nothing', () => {
  const asked: string[] = []; const searched: string[] = [];
  const props = { today: '2026-10-12', weekendTotal: 60, guideCount: 141, checkedAt: '2026-10-07', onAskBayBay: (q: string) => asked.push(q), onSearch: (q: string) => searched.push(q) };
  const view = render(<MemoryRouter><HomeHead {...props} /></MemoryRouter>);
  const form = view.getByRole('search');
  const box = within(form).getByRole('textbox') as HTMLInputElement;
  const button = within(form).getByRole('button');
  assert.equal(button.hasAttribute('disabled'), false);
  fireEvent.submit(form);
  assert.equal(box.value, '这周末带爸妈去哪？');
  assert.equal(document.activeElement, box);
  assert.deepEqual([asked, searched], [[], []]);
  cleanup();
  // At 大 / 特大 and in 简洁显示 the box holds about eight characters: the short example.
  localStorage.setItem(READING_SIZE_KEY, 'large');
  const large = render(<MemoryRouter><HomeHead {...props} /></MemoryRouter>);
  fireEvent.submit(large.getByRole('search'));
  assert.equal((within(large.getByRole('search')).getByRole('textbox') as HTMLInputElement).value, '周末带爸妈去哪？');
});

test('BayBay 问一下 is never disabled: a one-character question sends nothing, keeps the focus in the box and says why', async (t) => {
  const requests: unknown[] = [];
  mockBayBayFetch(t, async (_url: unknown, init: RequestInit) => { requests.push(init); return Response.json({ ok: true, answer: '模拟建议。' }); });
  const view = render(<BayBayAssistantEntry variant="headless" panelOpen onPanelOpenChange={() => {}} onNavigate={() => {}} onCreatePostClick={() => {}} />);
  const input = view.getByRole('textbox', { name: '向 BayBay 提问' }) as HTMLTextAreaElement;
  const send = view.getByRole('button', { name: /问一下/ });
  assert.equal(send.hasAttribute('disabled'), false);
  fireEvent.change(input, { target: { value: '租' } });
  fireEvent.click(send);
  await sleep(0);
  assert.equal(requests.length, 0);
  assert.equal(document.activeElement, input);
  const hint = view.getByText(/至少输入 2 个字/);
  assert.match(hint.textContent ?? '', /至少输入 2 个字/);
  assert.match(input.getAttribute('aria-describedby') ?? '', /baybay-short-hint/);
  // Read out by a region that was in the page before the hint (the visible hint is not itself a live region).
  const live = document.querySelector('[data-baybay-short-notice]')!;
  assert.equal(live.getAttribute('role'), 'status');
  assert.equal(hint.getAttribute('role'), null);
  await act(() => sleep(200));
  assert.match(live.textContent ?? '', /至少输入 2 个字/);
  fireEvent.change(input, { target: { value: '租房' } });
  assert.equal(view.queryByText(/至少输入 2 个字/), null, 'the hint goes once the question is long enough');
  assert.equal(live.textContent, '');
  // Short again, then a real question goes out without typing (a 找本地服务 starter fills the box): the send empties the
  // box, and the hint must not come back with it (review 10-18: it did, under every later question).
  fireEvent.change(input, { target: { value: '租' } });
  fireEvent.click(send);
  assert.ok(view.getByText(/至少输入 2 个字/));
  fireEvent.click(view.getByRole('button', { name: '找本地服务' }));
  assert.ok(!document.getElementById('baybay-short-hint'), 'a starter that fills the box clears it');
  fireEvent.click(view.getByRole('button', { name: /问一下/ }));
  await act(() => sleep(0));
  assert.equal(requests.length, 1);
  assert.equal(input.value, '');
  assert.ok(!document.getElementById('baybay-short-hint'), 'a sent question clears the hint');
  assert.doesNotMatch(input.getAttribute('aria-describedby') ?? '', /baybay-short-hint/);
  // And a later empty 问一下 still says why (the reset is not a mute).
  await act(() => sleep(20));
  fireEvent.submit(input.closest('form')!);
  assert.ok(view.getByText(/至少输入 2 个字/));
});

test('Sheet plays its exit: open → closed keeps it 200ms with .is-closing, then unmounts; at once with reduced motion or in 简洁显示', async () => {
  const sheet = (open: boolean) => <Sheet open={open} onClose={() => {}} title="筛选"><p>内容</p></Sheet>;
  const view = render(sheet(true));
  assert.ok(document.querySelector('.ui-sheet-backdrop:not(.is-closing)'));
  view.rerender(sheet(false));
  assert.ok(document.querySelector('.ui-sheet-backdrop.is-closing'), 'the closing sheet stays for its exit');
  await act(() => sleep(260));
  assert.equal(document.querySelector('.ui-sheet-backdrop'), null);
  view.unmount();
  for (const setup of [() => { reducedMotion = true; }, () => document.documentElement.setAttribute('data-simple', '')]) {
    setup();
    const quick = render(sheet(true));
    quick.rerender(sheet(false));
    await act(() => sleep(0));
    assert.equal(document.querySelector('.ui-sheet-backdrop'), null);
    quick.unmount();
    reducedMotion = false; document.documentElement.removeAttribute('data-simple');
  }
});

test('warming: only same-tab in-site links that are not the 3D world or a download', () => {
  const link = (attrs: string) => { document.body.innerHTML = `<a ${attrs}><span>x</span></a>`; return document.querySelector('span')!; };
  assert.equal(warmablePage(link('href="/events"')), 'events');
  assert.equal(warmablePage(link('href="/en/guides"')), 'guides');
  assert.equal(warmablePage(link('href="/opus-bay"')), null);
  assert.equal(warmablePage(link('href="/events" target="_blank"')), null);
  assert.equal(warmablePage(link('href="https://example.com/events"')), null);
  assert.equal(warmablePage(link('href="/calendar.ics" download="a.ics"')), null);
  document.body.innerHTML = '';
});

test('a failed warm is quiet: chunk recovery does not reload, no beacon is sent, and that page is not warmed again; a navigation still recovers', async () => {
  installChunkRecovery();
  routeActivity.settle('/', '/');
  const preloadError = () => { const event = new dom.window.Event('vite:preloadError', { cancelable: true }); dom.window.dispatchEvent(event); return event.defaultPrevented; };
  let loads = 0; let prevented: boolean | undefined;
  // Vite's __vitePreload dispatches vite:preloadError before the import's promise rejects.
  const load = () => { loads++; return Promise.resolve().then(() => { prevented = preloadError(); throw new Error('chunk 404'); }); };
  warmPage('tools', load);
  await sleep(0);
  assert.equal(prevented, false, 'no reload for a warm');
  assert.equal(routeActivity.quietFailure(), false, 'the warm has ended');
  warmPage('tools', load);
  assert.equal(loads, 1, 'a page whose warm failed is not warmed again in this tab');
  // The beacon listener asks the same question before it reports.
  assert.match(readFileSync('src/lib/product-observer.ts', 'utf8'), /vite:preloadError', event => \{ if \(!routeActivity\.quietFailure\(\)\) reportClientError\('chunk'/);
  // A programmatic navigate() (a pushState no click, submit or popstate listener saw) waiting for its page is not quiet.
  routeActivity.beginQuietWarm();
  assert.equal(routeActivity.quietFailure(), true, 'a warm in flight on a settled page');
  dom.window.history.pushState(null, '', '/guides');
  assert.equal(routeActivity.quietFailure(), false, 'the address bar asks for another page');
  routeActivity.endQuietWarm();
  // A navigation waiting for its page: the same failure reloads (the recovery prevents Vite's throw and reloads once).
  dom.window.history.pushState(null, '', '/tools');
  routeActivity.request();
  routeActivity.beginQuietWarm();
  assert.equal(routeActivity.quietFailure(), false);
  const consoleError = console.error; console.error = () => {};
  try { assert.equal(preloadError(), true, 'a navigation recovers with a reload'); } finally { console.error = consoleError; routeActivity.endQuietWarm(); }
  dom.window.history.pushState(null, '', '/');
});

test('the route bar shows while the address bar asks for a page that is not on screen yet, and goes when it commits', async () => {
  routeActivity.settle(routeKey('/'), routeKey('/'));
  const view = render(<RouteProgress />);
  assert.equal(view.queryByTestId('route-progress'), null);
  // A click that changes nothing (a button) does not draw the bar.
  fireEvent.click(document.body);
  assert.equal(view.queryByTestId('route-progress'), null);
  // A link click: React Router pushes the URL at once and renders the next page in a transition.
  dom.window.history.pushState(null, '', '/en/events/');
  fireEvent.click(document.body);
  assert.ok(view.getByTestId('route-progress'), 'the bar is drawn (its CSS shows it after 150ms)');
  await act(async () => { routeActivity.settle(routeKey('/events')); });
  assert.equal(view.queryByTestId('route-progress'), null);
  // A history step back.
  dom.window.history.pushState(null, '', '/guides?q=%E7%A7%9F');
  await act(async () => { dom.window.dispatchEvent(new dom.window.PopStateEvent('popstate')); });
  assert.ok(view.getByTestId('route-progress'));
  await act(async () => { routeActivity.settle(routeKey('/guides', '?q=%E7%A7%9F')); });
  assert.equal(view.queryByTestId('route-progress'), null);
  dom.window.history.pushState(null, '', '/');
});
