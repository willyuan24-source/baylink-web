// WEB-HOMEPREP: the community board is its own chunk. The homepage renders without it and shows it when it is asked
// for; a category page or a search waits for it at the page level (never a page without its board); the board's
// 编辑精选「更多」 opens /events directly (no hop through the retired /recommend). This file runs in its own process, so
// the board starts out not loaded.
import assert from 'node:assert/strict';
import test, { after, afterEach } from 'node:test';
import { registerHooks } from 'node:module';
import { JSDOM } from 'jsdom';
import React, { Suspense } from 'react';

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
const scrolled: string[] = [];
dom.window.HTMLElement.prototype.scrollIntoView = function scrollIntoView(this: HTMLElement) { scrolled.push(this.id); };
const hooks = registerHooks({ load(url, context, next) {
  return url.endsWith('.css') ? { format: 'module', shortCircuit: true, source: 'export {}' } : next(url, context);
} });
const { render, fireEvent, cleanup, screen, waitFor } = await import('@testing-library/react');
const { MemoryRouter, Routes, Route, Outlet, useLocation } = await import('react-router-dom');
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
const Where = () => <output data-testid="where">{useLocation().pathname}</output>;
const app = (entry: string, overrides: Record<string, unknown> = {}) => (
  <MemoryRouter initialEntries={[entry]}>
    <Suspense fallback={<p>page loading</p>}>
      <Routes>
        <Route element={<><Outlet context={context(overrides)} /><Where /></>}>
          <Route path="/" element={<HomePage />} />
          <Route path="/category/:categorySlug" element={<HomePage />} />
          <Route path="/events" element={<h1>活动</h1>} />
        </Route>
      </Routes>
    </Suspense>
  </MemoryRouter>
);

test('the homepage renders without the board chunk and does not fetch it until the board is asked for', async () => {
  assert.equal(loader.LoadedCommunityBoard, undefined, 'this process starts with the board not loaded');
  const view = render(app('/'));
  assert.ok(screen.getByRole('button', { name: '邻里信息（测试中）· 去看看' }));
  assert.equal(view.container.querySelector('#home-feed-section'), null);
  assert.equal(view.container.querySelector('.bay-home-footer'), null, 'the site footer closes the home (WEB-HOME)');
  await new Promise(resolve => setTimeout(resolve, 50));
  assert.equal(loader.LoadedCommunityBoard, undefined, 'the folded board is not downloaded');
});

test('a category page waits for the board at the page level (never a page without its board), then shows both', async () => {
  const view = render(app('/category/rent', { categoryFilter: '租房' }));
  assert.ok(screen.getByText('page loading'), 'the route-level fallback, as while a page chunk loads');
  assert.equal(view.container.querySelector('.bay-home-footer'), null, 'no half-rendered page');
  assert.ok(await screen.findByRole('heading', { level: 1, name: /租房，就在你身边。/ }));
  assert.ok(view.container.querySelector('#home-feed-section'));
  assert.equal(view.container.querySelector('.bay-community-intro'), null);
});

test('邻里信息（测试中）· 去看看 opens the board and scrolls to its heading; the board sits after the home sections', async () => {
  const view = render(app('/'));
  fireEvent.click(screen.getByRole('button', { name: '邻里信息（测试中）· 去看看' }));
  await waitFor(() => assert.ok(view.container.querySelector('#home-feed-section')));
  await waitFor(() => assert.deepEqual(scrolled, ['home-feed-section']));
  const order = [...view.container.querySelectorAll('.home-discovery, .bay-home-columns')].map(element => element.className);
  assert.deepEqual(order, ['home-discovery', 'bay-home-columns']);
});

test('the board views keep their footer, with the positioning line in the reader’s language (rule 4: t(zh, en))', async () => {
  const view = render(app('/category/rent', { categoryFilter: '租房' }));
  await screen.findByRole('heading', { level: 1, name: /租房，就在你身边。/ });
  assert.match(view.container.querySelector('.bay-home-footer')!.textContent!, /湾区去哪、怎么办 · 有来源的中文答案/);
  view.unmount();
  const { setLocale } = await import('../src/i18n/locale');
  try {
    await setLocale('en', false);
    const english = render(app('/category/rent', { categoryFilter: '租房' }));
    await waitFor(() => assert.ok(english.container.querySelector('.bay-home-footer')));
    const footer = english.container.querySelector('.bay-home-footer')!.textContent!;
    assert.match(footer, /Where to go and how to get it done in the Bay, with sources/);
    assert.doesNotMatch(footer, /湾区去哪/);
  } finally {
    await setLocale('zh-Hans', false);
  }
});

test('a search keeps its heading and the feed, and the rail shows the newcomer help', async () => {
  const view = render(app('/?q=%E7%A7%9F%E6%88%BF', { keyword: '租房' }));
  assert.ok(screen.getByRole('heading', { level: 1, name: /找到你需要的/ }));
  assert.ok(screen.getByRole('heading', { name: '搜索本地信息' }));
  assert.ok(view.container.querySelector('.bay-assistant-card'));
});

test('编辑精选「更多」 opens /events, not the retired /recommend', async () => {
  render(app('/', { feedError: true }));
  fireEvent.click(screen.getByRole('button', { name: '邻里信息（测试中）· 去看看' }));
  fireEvent.click(await screen.findByRole('button', { name: '更多' }));
  await waitFor(() => assert.equal(screen.getByTestId('where').textContent, '/events'));
});
