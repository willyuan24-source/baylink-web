import assert from 'node:assert/strict';
import test, { after, afterEach } from 'node:test';
import React, { Component, Suspense, type ReactNode } from 'react';
import { JSDOM } from 'jsdom';

/**
 * RC-25 on the detail routes: a bucket that does not load shows 这一页没加载完 with 重试, and 重试 really loads the bucket
 * again (it does not re-read the cached failure). A render bug is not a network problem: it goes on to the app's
 * ErrorBoundary (and from there to client-error reporting).
 */
const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'https://www.baylink.us/offers/sfmta-free-muni-seniors' });
const globals = { window: dom.window, document: dom.window.document, navigator: dom.window.navigator, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, localStorage: dom.window.localStorage, IS_REACT_ACT_ENVIRONMENT: true };
const previous = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
const { render, fireEvent, cleanup, waitFor } = await import('@testing-library/react');
const { MemoryRouter, Routes, Route } = await import('react-router-dom');
const { detailLoaders } = await import('../src/data/generated/detail-loaders');
const { detailBucket } = await import('../src/lib/english-loading');
const { resetDetailRecords } = await import('../src/features/detail/load-detail');
const { default: LocalDiscoveryPage } = await import('../src/pages/LocalDiscoveryPage');

const ID = 'sfmta-free-muni-seniors';
const BUCKET = detailBucket('offer', ID);
const original = detailLoaders[BUCKET];
/** The bucket's loader with a switch: `fail` rejects every call; `calls` counts them. */
const loader = { fail: true, calls: 0, module: undefined as unknown };
detailLoaders[BUCKET] = () => {
  loader.calls += 1;
  if (loader.fail) return Promise.reject(new TypeError('Failed to fetch dynamically imported module'));
  return loader.module === undefined ? original() : Promise.resolve(loader.module);
};

// React logs every caught render error; these are the expected ones.
const consoleError = console.error;
console.error = (...args: unknown[]) => {
  if (args.some(arg => /Failed to fetch dynamically imported module|The above error occurred|stored.rail|Cannot read properties of null/.test(String(arg instanceof Error ? arg.message : arg)))) return;
  consoleError(...args);
};

afterEach(() => { cleanup(); resetDetailRecords(); loader.fail = true; loader.calls = 0; loader.module = undefined; });
after(() => {
  console.error = consoleError;
  detailLoaders[BUCKET] = original;
  dom.window.close();
  for (const [key, descriptor] of previous) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
});

class AppBoundary extends Component<{ children: ReactNode; onError: (error: unknown) => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: unknown) { this.props.onError(error); }
  render() { return this.state.failed ? <p>app error page</p> : this.props.children; }
}

const mount = (onError: (error: unknown) => void = () => {}) => render(<AppBoundary onError={onError}><MemoryRouter initialEntries={[`/offers/${ID}`]}>
  <Suspense fallback={<p>loading</p>}><Routes><Route path="/offers/:id" element={<LocalDiscoveryPage kind="offer" />} /></Routes></Suspense>
</MemoryRouter></AppBoundary>);
const WAIT = { timeout: 15_000 };

test('a bucket that does not load shows 这一页没加载完 with 重试; 重试 loads it again and the page renders', async () => {
  resetDetailRecords({ retryMs: 5 });
  const view = mount();
  assert.ok(await view.findByText('这一页没加载完', undefined, WAIT));
  assert.equal(loader.calls, 2, 'the first load and its one quiet retry');
  assert.equal(view.container.querySelector('h1'), null);
  loader.fail = false;
  fireEvent.click(view.getByRole('button', { name: '重试' }));
  assert.ok(await view.findByRole('heading', { level: 1 }, WAIT));
  assert.equal(loader.calls, 3, '重试 asked for the bucket again instead of re-reading the cached failure');
  assert.ok(view.container.querySelector('.site-detail-actions'));
  assert.equal(view.queryByText('这一页没加载完'), null);
});

test('a second failure after 重试 shows the state again, and each 重试 is a new request', async () => {
  resetDetailRecords({ retryMs: 5 });
  const view = mount();
  assert.ok(await view.findByText('这一页没加载完', undefined, WAIT));
  fireEvent.click(view.getByRole('button', { name: '重试' }));
  // The retry shows the Suspense fallback while it loads (React keeps the old state hidden meanwhile), then the state again.
  await waitFor(() => { assert.equal(loader.calls, 4); assert.equal(view.queryByText('loading'), null); }, WAIT);
  loader.fail = false;
  fireEvent.click(await view.findByRole('button', { name: '重试' }, WAIT));
  assert.ok(await view.findByRole('heading', { level: 1 }, WAIT));
});

test('a render bug in the detail is not shown as a network problem: the app boundary gets it', async () => {
  resetDetailRecords({ retryMs: 5 });
  loader.fail = false;
  // A bucket that loads but holds a broken record: the page throws while rendering, not while loading.
  loader.module = { default: { events: {}, records: { [`offer:${ID}`]: { rail: null } } } };
  const errors: unknown[] = [];
  const view = mount(error => errors.push(error));
  assert.ok(await view.findByText('app error page', undefined, WAIT));
  assert.equal(view.queryByText('这一页没加载完'), null);
  assert.equal(errors.length, 1);
  assert.ok(errors[0] instanceof TypeError, String(errors[0]));
});
