// WEB-HOMEPREP review: when the community board's chunk does not load. On the discovery view the homepage stays as it
// is until the reader asks for the board; 浏览邻里信息 asks for the chunk again and then shows the board's own "could not
// load" state, whose 重新加载 reloads the page at the neighborhood anchor (a browser keeps a failed chunk request for the
// life of the page) or, offline, tries in place. A direct load of a page that is the board (a category, a search) fails
// with the page module, as a page chunk that does not load, so main.tsx keeps the prerendered page instead of the error
// page. This file runs in its own process: the board starts out not loaded and its chunk is blocked until a test lets it
// through.
import assert from 'node:assert/strict';
import test, { after, afterEach } from 'node:test';
import { registerHooks } from 'node:module';
import { JSDOM, VirtualConsole } from 'jsdom';
import React, { Suspense } from 'react';

/** Page loads the app asked jsdom for (jsdom reports a reload as a navigation it does not implement). */
const navigations: string[] = [];
const virtualConsole = new VirtualConsole();
virtualConsole.on('jsdomError', error => { navigations.push(error.message); });
const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'https://www.baylink.us/', pretendToBeVisual: true, virtualConsole });
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage,
  HTMLElement: dom.window.HTMLElement, Node: dom.window.Node,
  requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
  cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
  getComputedStyle: dom.window.getComputedStyle.bind(dom.window), IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
dom.window.matchMedia = ((query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} })) as unknown as typeof dom.window.matchMedia;
const scrolled: string[] = [];
dom.window.HTMLElement.prototype.scrollIntoView = function scrollIntoView(this: HTMLElement) { scrolled.push(this.id); };

/** The board's chunk, as the browser would see it offline: every request for it fails while `boardBlocked`. */
let boardBlocked = true;
let boardRequests = 0;
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (specifier === './CommunityBoard' && context.parentURL?.includes('community-board-loader')) {
      boardRequests += 1;
      if (boardBlocked) throw new Error('board chunk blocked');
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    return url.endsWith('.css') ? { format: 'module', shortCircuit: true, source: 'export {}' } : next(url, context);
  },
});
const { render, fireEvent, cleanup, screen, waitFor } = await import('@testing-library/react');
const { MemoryRouter, Routes, Route, Outlet } = await import('react-router-dom');
const { api } = await import('../src/lib/api');
const { default: HomePage } = await import('../src/pages/HomePage');
const loader = await import('../src/pages/community-board-loader');
after(() => { hooks.deregister(); });
afterEach(() => { cleanup(); scrolled.length = 0; });
api.request = (async (endpoint: string) => endpoint.startsWith('/posts/featured') ? { posts: [] } : []) as typeof api.request;

const noop = () => {};
const context = (overrides: Record<string, unknown> = {}) => ({
  user: null, posts: [], feedType: 'provider', keyword: '', regionFilter: '全部', categoryFilter: '全部', feedError: false,
  isInitialLoading: false, isLoadingMore: false, hasMore: false, blockedUserIds: [], retryFeed: noop, setKeyword: noop,
  setRegionFilter: noop, setFeedType: noop, searchPostsNow: noop, handleLoadMore: noop, navigateToPost: noop, navigateToCategory: noop,
  openCreate: noop, openEditPost: noop, handleDeletePost: noop, handleToggleFeature: noop, handleToggleLike: noop,
  handleToggleBlockUser: noop, openReportTarget: noop, requestPostContact: noop, openUserProfile: noop, setViewingImage: noop,
  setSharingPost: noop, openBayBay: noop, openSearch: noop, showToast: noop, openAdDetail: noop, featuredRefreshKey: 0, adsRefreshKey: 0,
  ...overrides,
});
const app = (entry: string, overrides: Record<string, unknown> = {}) => (
  <MemoryRouter initialEntries={[entry]}>
    <Suspense fallback={<p>page loading</p>}>
      <Routes>
        <Route element={<Outlet context={context(overrides)} />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/category/:categorySlug" element={<HomePage />} />
        </Route>
      </Routes>
    </Suspense>
  </MemoryRouter>
);
/** Recent enough that the discovery view shows the board without being asked. */
const recentPosts = Array.from({ length: 4 }, (_, index) => ({ id: `recent-${index}`, title: `近期帖子 ${index}`, createdAt: Date.now() }));
const settled = () => waitFor(() => assert.notEqual(loader.communityBoardFailure(), undefined), { timeout: 5000 });

test('a board shown on its own (≥4 recent posts) that does not load leaves the discovery view as it is', async () => {
  const view = render(app('/', { posts: recentPosts }));
  await settled();
  assert.equal(boardRequests, 2, 'one request and one retry, as the app\'s other lazy chunks');
  assert.ok(screen.getByRole('heading', { name: '邻里信息' }));
  assert.ok(view.container.querySelector('.bay-home-footer'));
  assert.equal(screen.queryByText('连接暂时慢了一点'), null, 'no error the reader did not ask for');
});

test('a direct load of a category page whose board does not load fails with the page module (main.tsx keeps the prerender)', async () => {
  // a fresh copy of the page module, evaluated at /category/rent while the board's chunk is still blocked
  assert.equal(loader.LoadedCommunityBoard, undefined);
  const before = boardRequests;
  dom.reconfigure({ url: 'https://www.baylink.us/category/rent' });
  try {
    await assert.rejects(import('../src/pages/HomePage.tsx?direct-category'), /board chunk blocked/);
  } finally {
    dom.reconfigure({ url: 'https://www.baylink.us/' });
  }
  assert.equal(boardRequests, before + 2, 'the page load asked for the board again (and retried once)');
});

test('浏览邻里信息 after a failed load asks for the board again, then shows its "could not load" state; online, 重新加载 reloads the page at the anchor', async () => {
  const view = render(app('/'));
  const before = boardRequests;
  fireEvent.click(screen.getByRole('button', { name: '浏览邻里信息' }));
  assert.equal(boardRequests, before + 1, 'tapping 浏览邻里信息 requests the board again');
  assert.ok(await screen.findByText('连接暂时慢了一点', undefined, { timeout: 5000 }));
  assert.equal(boardRequests, before + 2);
  const order = [...view.container.querySelectorAll('.bay-community-intro, .bay-feed-empty, .bay-home-footer')].map(element => element.className);
  assert.deepEqual(order, ['bay-community-intro', 'bay-feed-empty', 'bay-home-footer']);
  assert.equal(view.container.querySelector('.bay-feed-empty')?.id, 'home-feed-section', 'the neighborhood anchor still lands');

  // a browser answers a repeated request for a chunk that failed in this page from its module map (Chrome does), so
  // online the reliable retry is a new page, opened at the board, which loads it before its first render
  navigations.length = 0;
  fireEvent.click(screen.getByRole('button', { name: '重新加载' }));
  assert.equal(dom.window.location.href, 'https://www.baylink.us/#home-feed-section');
  assert.deepEqual(navigations, ['Not implemented: navigation to another Document'], 'the page reloads');
  assert.equal(boardRequests, before + 2, 'no in-place request');
  dom.reconfigure({ url: 'https://www.baylink.us/' });
});

test("offline, 重新加载 tries in place (a reload would show the browser's offline page), and the board appears once it loads", async () => {
  Object.defineProperty(dom.window.navigator, 'onLine', { configurable: true, get: () => false });
  try {
    render(app('/'));
    fireEvent.click(screen.getByRole('button', { name: '浏览邻里信息' }));
    assert.ok(await screen.findByRole('button', { name: '重新加载' }, { timeout: 5000 }));
    const before = boardRequests;
    navigations.length = 0;
    fireEvent.click(screen.getByRole('button', { name: '重新加载' }));
    assert.equal(boardRequests, before + 1, '重新加载 requests the board again');
    // while the new load is under way React hides the notice (display: none); it is back, usable, when that load fails
    assert.equal(screen.queryByRole('button', { name: '重新加载' }), null);
    assert.ok(await screen.findByRole('button', { name: '重新加载' }, { timeout: 5000 }));
    assert.equal(boardRequests, before + 2);
    assert.deepEqual(navigations, [], 'no reload offline');

    boardBlocked = false;
    fireEvent.click(screen.getByRole('button', { name: '重新加载' }));
    await waitFor(() => assert.ok(screen.getByRole('heading', { name: '发现身边的好信息' })), { timeout: 5000 });
    assert.equal(screen.queryByText('连接暂时慢了一点'), null);
    await waitFor(() => assert.deepEqual(scrolled, ['home-feed-section']));
  } finally {
    Reflect.deleteProperty(dom.window.navigator, 'onLine');
  }
});
