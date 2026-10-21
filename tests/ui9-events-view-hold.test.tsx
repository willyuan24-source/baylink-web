import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { afterEach, test } from 'node:test';
import React, { useRef } from 'react';
import { JSDOM } from 'jsdom';

// UI9-EVENTS (P28 / N24): a view switch keeps the previous body dimmed with its height, shows a skeleton only after 300 ms and
// holds it at least 400 ms — and a click that does not switch (a new-tab click, a tap on the view already shown) never holds.
const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'https://www.baylink.us/events' });
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, HTMLElement: dom.window.HTMLElement,
  Node: dom.window.Node, MutationObserver: dom.window.MutationObserver, IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
registerHooks({ load: (url, context, nextLoad) => url.endsWith('.css') ? { format: 'module', shortCircuit: true, source: 'export {};' } : nextLoad(url, context) });
const { render, cleanup, fireEvent, act, waitFor, within } = await import('@testing-library/react');
const { MemoryRouter, useLocation } = await import('react-router-dom');
const { EventsView } = await import('../src/components/EventsView');
const { useViewHold, DIM_MS, SKELETON_MIN_MS } = await import('../src/features/events/view-hold');

afterEach(() => { cleanup(); localStorage.clear(); });
const sleep = (ms: number) => act(() => new Promise<void>(resolve => setTimeout(resolve, ms)));

function Probe({ stale }: { stale: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const hold = useViewHold(stale, ref);
  return <div ref={ref} data-phase={hold.phase} />;
}
const phase = (view: ReturnType<typeof render>) => view.container.querySelector('[data-phase]')!.getAttribute('data-phase');

test('useViewHold: dim at once, the skeleton after 300 ms, held at least 400 ms once shown', async () => {
  assert.equal(DIM_MS, 300);
  assert.equal(SKELETON_MIN_MS, 400);
  const view = render(<Probe stale={false} />);
  assert.equal(phase(view), 'idle');
  view.rerender(<Probe stale />);
  assert.equal(phase(view), 'dim');
  await sleep(DIM_MS + 60);
  assert.equal(phase(view), 'skeleton');
  // The view arrives 100 ms into the skeleton: it stays until 400 ms have passed, then the hold ends.
  await sleep(100);
  view.rerender(<Probe stale={false} />);
  assert.equal(phase(view), 'skeleton', 'no flash: the skeleton stays its 400 ms');
  await sleep(SKELETON_MIN_MS);
  assert.equal(phase(view), 'idle');
});

test('useViewHold: a view that arrives within 300 ms never shows the skeleton', async () => {
  const view = render(<Probe stale />);
  assert.equal(phase(view), 'dim');
  await sleep(100);
  view.rerender(<Probe stale={false} />);
  assert.equal(phase(view), 'idle');
  await sleep(DIM_MS + 100);
  assert.equal(phase(view), 'idle');
});

function Where() {
  const { pathname, search } = useLocation();
  return <output data-where={`${pathname}${search}`} />;
}
const events = () => render(<MemoryRouter initialEntries={['/events']}><EventsView today="2026-10-19" /><Where /></MemoryRouter>);
const hold = (view: ReturnType<typeof render>) => view.container.querySelector('.ev-view')!.getAttribute('data-hold');
const where = (view: ReturnType<typeof render>) => view.container.querySelector('[data-where]')!.getAttribute('data-where');
const tab = (view: ReturnType<typeof render>, name: string) => within(view.container.querySelector('.ev-tabs') as HTMLElement).getByRole('link', { name });

test('a new-tab click on a view (⌘ / Ctrl / Shift) neither switches nor holds this page', async () => {
  const view = events();
  for (const modifier of [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }]) {
    fireEvent.click(tab(view, '免费与优惠'), modifier);
    assert.equal(hold(view), null, JSON.stringify(modifier));
    await sleep(DIM_MS + 100);
    assert.equal(hold(view), null, `${JSON.stringify(modifier)}: still not held`);
    assert.equal(where(view), '/events');
    assert.equal(view.container.querySelector('.ev-page')!.getAttribute('data-view'), 'list');
  }
});

test('a tap on the view already shown never holds; tapping it while another view loads ends that hold', async () => {
  const view = events();
  fireEvent.click(tab(view, '本周末'));
  assert.equal(hold(view), null, 'the current view');
  fireEvent.click(tab(view, '免费与优惠'));
  fireEvent.click(tab(view, '本周末'));
  await sleep(900);
  assert.equal(hold(view), null, 'not held 900 ms later');
  assert.equal(view.container.querySelector('.ev-view')!.getAttribute('aria-busy'), null);
  assert.equal(where(view), '/events');
});

test('a switch dims the previous view at once, then the next view lands and the hold ends', async () => {
  const view = events();
  fireEvent.click(tab(view, '免费与优惠'));
  // The board's chunk loads on demand: until it is in, the 本周末 body stays (dimmed, its height held).
  if (view.container.querySelector('.ev-page')!.getAttribute('data-view') === 'list') assert.equal(hold(view), 'dim');
  await waitFor(() => assert.equal(view.container.querySelector('.ev-page')!.getAttribute('data-view'), 'perks'), { timeout: 5000 });
  await waitFor(() => assert.equal(hold(view), null), { timeout: 2000 });
  assert.equal(where(view), '/events?view=perks');
});
