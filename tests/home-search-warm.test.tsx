// WEB-HOMEPREP review round 3: the 繁→简 search dictionaries stay off the homepage's load, but the homepage fetches them
// once it has loaded (or 2 s after it rendered) and the browser is idle, so the next page that searches, the search
// dialog and BayBay do not wait for them. Not with Save-Data, not offline (a failed chunk request stays failed for the life of the page). This file
// runs in its own process and takes the browser's path (the dictionaries start out not loaded).
import assert from 'node:assert/strict';
import test, { after, afterEach, mock } from 'node:test';
import { registerHooks } from 'node:module';
import { JSDOM } from 'jsdom';
import React, { Suspense } from 'react';

process.env.BAYLINK_LAZY_SEARCH = '1';
const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'https://www.baylink.us/', pretendToBeVisual: true });
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage,
  HTMLElement: dom.window.HTMLElement, Node: dom.window.Node,
  requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
  cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
  getComputedStyle: dom.window.getComputedStyle.bind(dom.window), IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
dom.window.matchMedia = ((query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} })) as unknown as typeof dom.window.matchMedia;
dom.window.HTMLElement.prototype.scrollIntoView = function scrollIntoView() {};
/** The browser's idle queue: the test decides when the browser is idle. */
const idle = new Map<number, () => void>();
let idleIds = 0;
const cancelled: number[] = [];
Object.assign(dom.window, {
  requestIdleCallback: (callback: () => void) => { idle.set(++idleIds, callback); return idleIds; },
  cancelIdleCallback: (id: number) => { cancelled.push(id); idle.delete(id); },
});
const runIdle = () => { const callbacks = [...idle.values()]; idle.clear(); callbacks.forEach(callback => callback()); };
/** Requests for the dictionaries' chunk (locale.ts imports it). */
let dictionaryRequests = 0;
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (specifier === './search-dictionaries' && context.parentURL?.includes('/i18n/locale')) dictionaryRequests += 1;
    return next(specifier, context);
  },
  load(url, context, next) {
    return url.endsWith('.css') ? { format: 'module', shortCircuit: true, source: 'export {}' } : next(url, context);
  },
});
const { render, cleanup, screen } = await import('@testing-library/react');
const { MemoryRouter, Routes, Route, Outlet } = await import('react-router-dom');
const { api } = await import('../src/lib/api');
const { isSearchConversionReady, loadSearchConversion, simplifySearch } = await import('../src/i18n/locale');
const { default: HomePage } = await import('../src/pages/HomePage');
after(() => { hooks.deregister(); });
afterEach(() => { cleanup(); idle.clear(); cancelled.length = 0; });
api.request = (async (endpoint: string) => endpoint.startsWith('/posts/featured') ? { posts: [] } : []) as typeof api.request;

const noop = () => {};
const context = {
  user: null, posts: [], feedType: 'provider', keyword: '', regionFilter: '全部', categoryFilter: '全部', feedError: false,
  isInitialLoading: false, isLoadingMore: false, hasMore: false, blockedUserIds: [], retryFeed: noop, setKeyword: noop,
  setRegionFilter: noop, setFeedType: noop, searchPostsNow: noop, handleLoadMore: noop, navigateToPost: noop, navigateToCategory: noop,
  openCreate: noop, openEditPost: noop, handleDeletePost: noop, handleToggleFeature: noop, handleToggleLike: noop,
  handleToggleBlockUser: noop, openReportTarget: noop, requestPostContact: noop, openUserProfile: noop, setViewingImage: noop,
  setSharingPost: noop, openBayBay: noop, openSearch: noop, showToast: noop, openAdDetail: noop, featuredRefreshKey: 0, adsRefreshKey: 0,
};
const home = () => (
  <MemoryRouter initialEntries={['/']}>
    <Suspense fallback={<p>page loading</p>}>
      <Routes><Route element={<Outlet context={context} />}><Route path="/" element={<HomePage />} /></Route></Routes>
    </Suspense>
  </MemoryRouter>
);
const settle = () => new Promise(resolve => setTimeout(resolve, 20));

test('with Save-Data on, the homepage does not fetch the dictionaries', async () => {
  Object.defineProperty(dom.window.navigator, 'connection', { configurable: true, value: { saveData: true } });
  try {
    render(home());
    assert.ok(screen.getByRole('button', { name: '邻里信息（测试中）· 去看看' }));
    assert.equal(idle.size, 0, 'nothing scheduled');
    await settle();
    assert.equal(dictionaryRequests, 0);
  } finally {
    Reflect.deleteProperty(dom.window.navigator, 'connection');
  }
});

test('offline, the homepage does not try (a failed chunk request would stay failed for the life of the page)', async () => {
  Object.defineProperty(dom.window.navigator, 'onLine', { configurable: true, get: () => false });
  try {
    render(home());
    assert.equal(idle.size, 1);
    runIdle();
    await settle();
    assert.equal(dictionaryRequests, 0);
  } finally {
    Reflect.deleteProperty(dom.window.navigator, 'onLine');
  }
});

test('leaving the homepage before the browser is idle cancels the fetch', async () => {
  const view = render(home());
  assert.equal(idle.size, 1);
  const [id] = idle.keys();
  view.unmount();
  assert.deepEqual(cancelled, [id]);
  await settle();
  assert.equal(dictionaryRequests, 0);
});

test('the homepage renders without the dictionaries and fetches them once it has loaded and the browser is idle', async () => {
  render(home());
  await settle();
  assert.equal(dictionaryRequests, 0, 'not part of the first render');
  assert.equal(isSearchConversionReady(), false);
  assert.equal(idle.size, 1, 'scheduled for when the browser is idle');
  runIdle();
  assert.equal(dictionaryRequests, 1);
  await loadSearchConversion();
  assert.equal(dictionaryRequests, 1, 'one request: a later load uses it');
  assert.equal(simplifySearch('金門大橋'), '金门大桥');
});

test('a page still loading waits for its load event, or 2 s at most (photos can hold the load event back for long)', async () => {
  Object.defineProperty(dom.window.document, 'readyState', { configurable: true, get: () => 'interactive' });
  try {
    render(home());
    assert.equal(idle.size, 0);
    dom.window.dispatchEvent(new dom.window.Event('load'));
    assert.equal(idle.size, 1, 'the load event');
    dom.window.dispatchEvent(new dom.window.Event('load'));
    assert.equal(idle.size, 1, 'once');
    cleanup();
    idle.clear();

    mock.timers.enable({ apis: ['setTimeout'] });
    try {
      render(home());
      mock.timers.tick(1999);
      assert.equal(idle.size, 0);
      mock.timers.tick(1);
      assert.equal(idle.size, 1, '2 s after the page rendered, with no load event');
      dom.window.dispatchEvent(new dom.window.Event('load'));
      assert.equal(idle.size, 1, 'the later load event does not schedule it again');
    } finally {
      mock.timers.reset();
    }
  } finally {
    Reflect.deleteProperty(dom.window.document, 'readyState');
  }
});
