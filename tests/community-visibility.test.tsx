// WEB-COMMUNITY-2 item 7 (H04 fallback): src/data/site-flags.ts COMMUNITY_VISIBLE. Both states in one process: true (the
// default, what ships) keeps every 邻里 entry; false hides them, shows /category/* and post pages as a calm 邻里信息暂停中 page
// with noindex (app, prerender, server post page), and leaves the OPUS-contract links and /messages alone.
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test, { afterEach } from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';
import type { AppContextValue } from '../src/app/context';
import type { PostData } from '../src/lib/types';

const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'https://www.baylink.us/', pretendToBeVisual: true });
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node,
  IS_REACT_ACT_ENVIRONMENT: true, requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window), cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
});
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
dom.window.matchMedia = ((query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} })) as unknown as typeof dom.window.matchMedia;
registerHooks({ load(url, context, next) { return url.endsWith('.css') ? { format: 'module', shortCircuit: true, source: 'export {}' } : next(url, context); } });
const { render, cleanup, screen, fireEvent } = await import('@testing-library/react');
const { MemoryRouter, StaticRouter, Routes, Route, Outlet } = await import('react-router-dom');
const { renderToStaticMarkup } = await import('react-dom/server');
const flags = await import('../src/data/site-flags');
const { SiteNavigation } = await import('../src/components/SiteNavigation');
const { HomeDiscovery } = await import('../src/components/HomeDiscovery');
const { QuickExplore } = await import('../src/components/QuickExplore');
const { default: CommunityBoard } = await import('../src/pages/CommunityBoard');
const { PostDetailModal } = await import('../src/features/posts/PostDetailModal');
const { CategoryHubPrerender } = await import('../src/components/HubPrerender');
const { renderMetadataHtml } = await import('../src/lib/seo');
const { categoryHubMetadata } = await import('../src/lib/hub-metadata');
const { renderPublicPostPage } = await import('../api/post-page');
const { api } = await import('../src/lib/api');
const { setLocale } = await import('../src/i18n/locale');
const originalRequest = api.request;
api.request = (async () => ({ posts: [], ads: [] })) as typeof api.request;
afterEach(async () => { cleanup(); flags.setCommunityVisibleForTests(true); localStorage.clear(); await setLocale('zh-Hans', false); });

const noop = () => {};
const nav = { active: 'home', category: '全部', homeActive: true, user: null, notification: false, notificationCount: 0, onCreate: noop, onAsk: noop, onAccount: noop };
const post = { id: '1781325990346', authorId: 'member-1', author: { id: 'member-1', nickname: '邻居甲' }, type: 'provider', title: 'Daly City 房间出租', city: '中半岛', category: '租屋',
  timeInfo: '', budget: '$1500', description: '近 BART。', contactInfo: null, imageUrls: [], likesCount: 0, hasLiked: false, commentsCount: 0, comments: [], createdAt: Date.now(), status: 'active', confirmedAt: null } as unknown as PostData;
const board = (entry: string, overrides: Partial<AppContextValue> = {}) => {
  const context = {
    user: null, posts: [post], feedType: 'provider', keyword: '', regionFilter: '全部', categoryFilter: '租屋', feedError: false, isInitialLoading: false, isLoadingMore: false, hasMore: false,
    blockedUserIds: [], retryFeed: noop, setKeyword: noop, setRegionFilter: noop, setFeedType: noop, searchPostsNow: noop, handleLoadMore: noop, navigateToPost: noop, openCreate: noop,
    openEditPost: noop, handleDeletePost: noop, handleToggleFeature: noop, handleToggleBlockUser: noop, openReportTarget: noop, openAdDetail: noop, showToast: noop, adsRefreshKey: 0, ...overrides,
  } as unknown as AppContextValue;
  return render(<MemoryRouter initialEntries={[entry]}><Routes><Route element={<Outlet context={context} />}>
    <Route path="/" element={<CommunityBoard onScrollToFeed={noop} scrollRequest={0} />} />
    <Route path="/category/:categorySlug" element={<CommunityBoard onScrollToFeed={noop} scrollRequest={0} />} />
  </Route></Routes></MemoryRouter>);
};
const robots = (html: string) => /<meta name="robots" content="([^"]+)"/.exec(html)?.[1];

test('the switch ships on: every 邻里 entry stays (更多 panel, home line, search categories) and the board renders', async () => {
  assert.equal(flags.COMMUNITY_VISIBLE, true);
  const menu = render(<MemoryRouter><SiteNavigation {...nav} /></MemoryRouter>);
  assert.equal(menu.getByRole('link', { name: '邻里信息（测试中）' }).getAttribute('href'), '/category/rent');
  menu.unmount();
  const home = renderToStaticMarkup(<StaticRouter location="/"><HomeDiscovery onAskBayBay={noop} onBrowseCommunity={noop} /></StaticRouter>);
  assert.match(home, /邻里信息（测试中）· 去看看/);
  const search = render(<QuickExplore onClose={noop} onSearch={noop} onNavigate={noop} onAsk={noop} />);
  assert.ok(await search.findByText('按分类探索'));
  search.unmount();
  board('/category/rent');
  assert.ok(screen.getByRole('heading', { level: 1, name: '租房' }));
  assert.equal(robots(renderMetadataHtml(categoryHubMetadata('rent'))), 'index, follow');
});

test('switched off: no 邻里 entry in 更多, on the home page or in search; the OPUS-contract links stay', async () => {
  flags.setCommunityVisibleForTests(false);
  const menu = render(<MemoryRouter><SiteNavigation {...nav} /></MemoryRouter>);
  assert.equal(menu.queryByRole('link', { name: '邻里信息（测试中）' }), null);
  assert.equal(menu.container.querySelector('a[href^="/category/"]'), null);
  assert.ok(menu.container.querySelector('a[href="/opus-bay?from=nav"]'), 'OPUS contract: the 3D link stays in 更多');
  menu.unmount();
  const home = renderToStaticMarkup(<StaticRouter location="/"><HomeDiscovery onAskBayBay={noop} onBrowseCommunity={noop} /></StaticRouter>);
  assert.doesNotMatch(home, /邻里信息/);
  assert.match(home, /href="\/opus-bay\?from=home"/, 'OPUS contract: the home 3D tile stays');
  assert.match(home, /href="\/calendar"/, 'OPUS contract: 按日历看 stays');
  const search = render(<QuickExplore initialQuery="租房" onClose={noop} onSearch={noop} onNavigate={noop} onAsk={noop} />);
  await search.findByText(/BayBay/);
  assert.equal(search.queryByText(/搜索邻里信息/), null);
  search.unmount();
  const empty = render(<QuickExplore onClose={noop} onSearch={noop} onNavigate={noop} onAsk={noop} />);
  await empty.findByText('活动日历');
  assert.equal(empty.queryByText('按分类探索'), null);
});

test('switched off: a category, a board search and a post show the calm paused page; the home shows no board', async () => {
  flags.setCommunityVisibleForTests(false);
  const category = board('/category/rent');
  assert.equal(category.container.querySelectorAll('h1').length, 1);
  assert.ok(screen.getByRole('heading', { level: 1, name: '邻里信息暂停中' }));
  assert.equal(screen.getByRole('link', { name: '消息' }).getAttribute('href'), '/messages', 'existing conversations are one tap away');
  assert.equal(category.container.querySelector('.cm-card'), null, 'no post is shown');
  category.unmount();
  const search = board('/', { keyword: '租房' });
  assert.ok(screen.getByRole('heading', { level: 1, name: '邻里信息暂停中' }));
  search.unmount();
  const home = board('/');
  assert.equal(home.container.innerHTML, '');
  home.unmount();
  let closed = 0;
  render(<MemoryRouter><PostDetailModal post={post} currentUser={null} onClose={() => { closed++; }} onLoginNeeded={noop} onOpenChat={noop} onDeleted={noop} onImageClick={noop} onShare={noop} showToast={noop} onAskBayBay={noop} /></MemoryRouter>);
  assert.ok(screen.getByRole('heading', { level: 1, name: '邻里信息暂停中' }));
  assert.equal(screen.queryByText('Daly City 房间出租'), null);
  assert.equal(document.querySelector('meta[name="robots"]')?.getAttribute('content'), 'noindex, follow');
  fireEvent.click(screen.getByRole('button', { name: '返回' }));
  assert.equal(closed, 1);
});

test('switched off: the paused page reads in English and Traditional Chinese', async () => {
  flags.setCommunityVisibleForTests(false);
  await setLocale('en', false);
  const english = board('/category/rent');
  assert.ok(screen.getByRole('heading', { level: 1, name: 'The neighborhood board is paused' }));
  assert.doesNotMatch(english.container.textContent!, /[㐀-鿿]/);
  english.unmount();
  await setLocale('zh-Hant', false);
  board('/category/rent');
  assert.ok(screen.getByRole('heading', { level: 1, name: '鄰里資訊暫停中' }));
});

test('switched off: /category/* and post pages are noindex in the prerender and on the server; other pages are not', async () => {
  flags.setCommunityVisibleForTests(false);
  assert.equal(robots(renderMetadataHtml(categoryHubMetadata('rent'))), 'noindex, follow');
  // The tab title says what the H1 says, not the board's name.
  assert.equal(categoryHubMetadata('rent').title, '邻里信息暂停中｜BAYLINK');
  assert.equal(categoryHubMetadata('used').english?.title, 'The neighborhood board is paused | BAYLINK');
  assert.match(renderMetadataHtml(categoryHubMetadata('rent')), /<title>邻里信息暂停中｜BAYLINK<\/title>/);
  assert.equal(robots(renderMetadataHtml({ title: 'x', description: 'x', path: '/posts/123' })), 'noindex, follow');
  assert.equal(robots(renderMetadataHtml({ title: 'x', description: 'x', path: '/en/category/used' })), 'noindex, follow');
  assert.equal(robots(renderMetadataHtml({ title: 'x', description: 'x', path: '/events' })), 'index, follow');
  const prerendered = renderToStaticMarkup(<StaticRouter location="/category/rent"><CategoryHubPrerender slug="rent" /></StaticRouter>);
  assert.match(prerendered, /<h1[^>]*>.*邻里信息.*暂停中.*<\/h1>/);
  assert.doesNotMatch(prerendered, /行动前，先读一份实用指南/);
  let fetched = 0;
  const template = '<!doctype html><html lang="zh-Hans"><head><!--baylink-meta-start--><!--baylink-meta-end--></head><body><!--baylink-app-start--><!--baylink-app-end--></body></html>';
  const response = await renderPublicPostPage(new Request('https://www.baylink.us/posts/1781325990346'), { readTemplate: async () => template, fetch: (async () => { fetched++; return Response.json(post); }) as typeof fetch });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('X-Robots-Tag'), 'noindex, follow');
  const html = await response.text();
  assert.match(html, /邻里信息暂停中/);
  assert.match(html, /<meta name="robots" content="noindex, follow"/);
  assert.doesNotMatch(html, /Daly City/);
  assert.equal(fetched, 0, 'the post is not even read');
});

test.after(() => { api.request = originalRequest; });
