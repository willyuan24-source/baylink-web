// UI9-R1-CATEGORY (cold review round 1): /category boards, post cards and the promotions block.
//   N06 prices with digit groups · N22 on a card's photo only ♡ and one sticker, the price a line under the title
//   N09 the search field's edge is the control line (≥3:1) · N02 every visible h2 on the board is a section heading
//   N10 / N11 the promotions read e1 / e2, --scrim and the --r-* corners · N16 the board on the page gutter
//   N15 the board ends 48px above the footer (+ the footer's 12px step = 60) · J1 one quiet 测试中 chip, not two
import assert from 'node:assert/strict';
import test, { after, afterEach, before } from 'node:test';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { JSDOM } from 'jsdom';
import postcss, { type Rule } from 'postcss';
import React from 'react';
import type { AppContextValue } from '../src/app/context';
import type { PostData } from '../src/lib/types';

const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'https://www.baylink.us/category/rent', pretendToBeVisual: true });
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage,
  HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true,
  requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window), cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
});
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
dom.window.matchMedia = ((query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} })) as unknown as typeof dom.window.matchMedia;
const styles = registerHooks({ load(url, context, next) { return url.endsWith('.css') ? { format: 'module', shortCircuit: true, source: 'export {}' } : next(url, context); } });
const { render, cleanup, waitFor } = await import('@testing-library/react');
const { MemoryRouter, Routes, Route, Outlet } = await import('react-router-dom');
const { api } = await import('../src/lib/api');
const { setLocale } = await import('../src/i18n/locale');
const { default: CommunityBoard } = await import('../src/pages/CommunityBoard');
const { PostCard } = await import('../src/features/posts/PostCard');
const { formatPostPrice } = await import('../src/features/posts/post-price');
const { AdDetailModal } = await import('../src/features/ads/OfficialAds');
const { DEFAULT_COVERS } = await import('../src/lib/constants');

const ADS = [{ id: 'ad-1', title: '房地产经纪-Will Yuan', content: '湾区房地产经纪，房屋买卖，管理，Airbnb经营，长长的介绍文字一直写下去', imageUrl: 'https://example.com/qr.jpg' }];
const originalRequest = api.request;
const boardApi = (async (endpoint: string) => (endpoint === '/ads' ? ADS : { posts: [], hasMore: false })) as typeof api.request;
before(() => { api.request = boardApi; });
afterEach(async () => { cleanup(); localStorage.clear(); await setLocale('zh-Hans', false); });
after(() => { api.request = originalRequest; styles.deregister(); dom.window.close(); });

const css = readFileSync('src/features/posts/community.css', 'utf8');
/** Declarations of the rules whose selector list contains `selector` exactly (outside @media unless `media` is given). */
function declarations(selector: string, media = '') {
  const out: Record<string, string> = {};
  postcss.parse(css).walkRules(rule => {
    const parent = rule.parent as unknown as { type: string; params?: string };
    const inMedia = parent.type === 'atrule' ? parent.params ?? '' : '';
    if (inMedia !== media || !(rule as Rule).selectors.includes(selector)) return;
    rule.walkDecls(declaration => { out[declaration.prop] = declaration.value; });
  });
  return out;
}

const post = (id: string, overrides: Partial<PostData> = {}): PostData => ({
  id, authorId: 'member-1', author: { id: 'member-1', nickname: '邻居甲' }, type: 'provider', title: `Hayward 独立 Studio 出租 ${id}`, city: '东湾',
  category: '租屋', timeInfo: '', budget: '$1900', description: '近 BART。', contactInfo: null, likesCount: 0, hasLiked: false,
  imageUrls: ['https://res.cloudinary.com/demo/a.jpg', 'https://res.cloudinary.com/demo/b.jpg', 'https://res.cloudinary.com/demo/c.jpg'],
  commentsCount: 0, comments: [], createdAt: Date.now(), status: 'active', confirmedAt: null, ...overrides,
});
const noop = () => {};
const board = (posts: PostData[]) => {
  const context = {
    user: null, posts, feedType: 'provider', keyword: '', regionFilter: '全部', categoryFilter: '租屋', feedError: false, isInitialLoading: false,
    isLoadingMore: false, hasMore: false, blockedUserIds: [], retryFeed: noop, setKeyword: noop, setRegionFilter: noop, setFeedType: noop,
    searchPostsNow: noop, handleLoadMore: noop, navigateToPost: noop, openCreate: noop, openEditPost: noop, handleDeletePost: noop,
    handleToggleFeature: noop, handleToggleBlockUser: noop, openReportTarget: noop, openAdDetail: noop, showToast: noop, adsRefreshKey: 0,
  } as unknown as AppContextValue;
  return render(<MemoryRouter initialEntries={['/category/rent']}><Routes><Route element={<Outlet context={context} />}>
    <Route path="/category/:categorySlug" element={<CommunityBoard onScrollToFeed={noop} scrollRequest={0} />} />
  </Route></Routes></MemoryRouter>);
};

test('N06: a post price groups its digits with Intl, and leaves words, small amounts and other numbers as written', () => {
  const cases: [string, string][] = [
    ['$1900', '$1,900'], ['$1900/月', '$1,900/月'], ['$1800-2200', '$1,800-2,200'], ['$900 – $1200 每月', '$900 – $1,200 每月'],
    ['$120/次', '$120/次'], ['$70', '$70'], ['1900', '1,900'], ['月租 3300 元', '月租 3,300 元'], ['3300美元', '3,300美元'],
    ['$12500', '$12,500'], ['$1,900', '$1,900'], ['$1900.50', '$1,900.50'],
    ['议价', '议价'], ['报价待发布者确认', '报价待发布者确认'], ['Negotiable', 'Negotiable'], ['2026年起租，$2000', '2026年起租，$2,000'],
    ['电话 4155551234', '电话 4155551234'], ['', ''],
    // ranges before a unit, a comma that ends the amount, an already-grouped start, 块, a long run (review round 1)
    ['1900-2200元', '1,900-2,200元'], ['1800~2200美元', '1,800~2,200美元'], ['$1900, negotiable', '$1,900, negotiable'],
    ['$1900,可议', '$1,900,可议'], ['$2,000-2500', '$2,000-2,500'], ['$1,900-2200', '$1,900-2,200'], ['1900块', '1,900块'],
    ['$12345678901234567', '$12,345,678,901,234,567'], ['$1900,2200', '$1900,2200'], ['$12,34', '$12,34'], ['$0123', '$0123'],
  ];
  for (const [input, expected] of cases) assert.equal(formatPostPrice(input), expected, input);
  assert.equal(formatPostPrice('$1900', 'en'), '$1,900');
  assert.equal(formatPostPrice('$1900', 'zh-Hant'), '$1,900');
});

test('N22 / N06: a grid card puts the grouped price under the title; on the photo only ♡ and the photo count', () => {
  const view = render(<MemoryRouter><PostCard post={post('a')} layout="grid" /></MemoryRouter>);
  const card = view.container.querySelector('.cm-card')!;
  assert.equal(card.querySelector('.cm-card__price')!.textContent, '$1,900');
  assert.equal(card.querySelector('.ui-sticker[data-tone=price]'), null, 'no price sticker on the photo');
  const media = card.querySelector('.ui-feed-card__media')!;
  const onPhoto = media.querySelectorAll('.ui-sticker, .cm-cover__note').length + card.querySelectorAll('.ui-feed-card__save').length;
  assert.equal(onPhoto, 2, '♡ + the photo count');
  assert.match(media.querySelector('.ui-sticker')!.textContent!, /照片\s*3$/, 'the count is named for a screen reader');
  // the order on the card: title, price, meta (the photo is first by CSS order)
  const order = [...card.children].map(element => element.className.split(' ').find(name => /cm-card__price|ui-feed-card__(title|meta)/.test(name))).filter(Boolean);
  assert.deepEqual(order.slice(0, 3), ['ui-feed-card__title', 'cm-card__price', 'ui-feed-card__meta']);
});

test('N22: an owner\'s or admin\'s card has its ⋯ menu on the photo, so it drops the photo count (⋯ + ♡)', () => {
  const view = render(<MemoryRouter><PostCard post={post('o')} layout="grid" currentUser={{ id: 'member-1' } as never} /></MemoryRouter>);
  const card = view.container.querySelector('.cm-card')!;
  assert.ok(card.querySelector('.cm-card__menu'));
  assert.equal(card.querySelectorAll('.ui-feed-card__media .ui-sticker').length, 0);
  assert.equal(card.querySelector('.cm-card__price')!.textContent, '$1,900');
});

test('N22: a stock cover keeps its 系统封面 note and drops the photo count (still ♡ + one sticker); no budget, no price line', () => {
  const stock = DEFAULT_COVERS[0].url;
  const view = render(<MemoryRouter><PostCard post={post('s', { budget: '', imageUrls: [String(stock), 'https://res.cloudinary.com/demo/x.jpg', 'https://res.cloudinary.com/demo/y.jpg'] })} layout="grid" /></MemoryRouter>);
  const media = view.container.querySelector('.ui-feed-card__media')!;
  assert.ok(media.querySelector('.cm-cover__note'), '系统封面');
  assert.equal(media.querySelectorAll('.ui-sticker').length, 0);
  assert.equal(view.container.querySelector('.cm-card__price'), null);
});

test('J1: the breadcrumb says 邻里信息 and the H1 carries the one quiet (neutral) 测试中 chip', async () => {
  const view = board([post('a')]);
  const header = view.container.querySelector('.cm-board__header')!;
  assert.equal(header.querySelector('.ui-page-header__crumbs')!.textContent, '首页 › 邻里信息');
  assert.equal(header.textContent!.match(/测试中/g)!.length, 1);
  assert.equal(header.querySelector('.ui-status')!.getAttribute('data-tone'), 'neutral');
  await waitFor(() => assert.ok(view.container.querySelector('.cm-ad')));
  cleanup();
  // English says beta, as the home and About links do ("Neighborhood board (beta)").
  await setLocale('en', false);
  const en = board([post('b')]);
  assert.equal(en.container.querySelector('.cm-board__header .ui-page-header__crumbs')!.textContent, 'Home › Neighborhood board');
  assert.equal(en.container.querySelector('.cm-board__header .ui-status')!.textContent, 'Beta');
  await waitFor(() => assert.ok(en.container.querySelector('.cm-ad')));
});

test('N02 / N10 / N11: the promotions are a section with an h2 like the notes, tiles without decoration or Tailwind depth', async () => {
  const view = board([post('a')]);
  await waitFor(() => assert.ok(view.container.querySelector('.cm-ad')));
  const ads = view.container.querySelector('.cm-ads')!;
  const heading = ads.querySelector('h2')!;
  assert.equal(heading.className, 'cm-board__subhead');
  assert.equal(heading.textContent, '推广信息');
  assert.equal(ads.querySelectorAll('.cm-ads__track > .cm-ad').length, 1);
  assert.ok(ads.querySelector('.cm-ad .cm-ad-label'), 'each tile still says it is a promotion');
  assert.ok(![...view.container.querySelectorAll('.cm-board h2')].some(element => element.classList.contains('cm-guides__title') && element.closest('.cm-ads')));
  // every note heading on a category page is inside the scope that gives it the section size (the post sheet's and the
  // home board's are not: they keep the card size)
  const subheads = [...view.container.querySelectorAll('.cm-board__subhead')];
  assert.equal(subheads.length, 3, '联系和付款前, 其他分类, 推广信息');
  for (const element of subheads) assert.ok(element.matches('.cm-board:not([data-mode=home]) .cm-board__notes .cm-board__subhead'), element.textContent!);
  const source = readFileSync('src/features/ads/OfficialAds.tsx', 'utf8');
  for (const pattern of [/shadow-(card|2xl|sm)\b/, /bg-black\//, /backdrop-blur/, /rounded-(bl-full|\[)/, /rounded-(xl|2xl|3xl|lg|md|full)\b/]) assert.doesNotMatch(source, pattern);
});

test('N10 / N11: the promotion dialog is the site scrim (no blur), a --r-xl panel with e2 and the one close button', () => {
  render(<AdDetailModal ad={ADS[0]} onClose={noop} />);
  const dialog = document.querySelector('[role=dialog]')!;
  assert.equal(dialog.className, 'cm-ad-dialog');
  assert.ok(dialog.querySelector('.cm-ad-dialog__panel'));
  assert.ok(dialog.querySelector('button.ui-icon-button.ui-close[aria-label=关闭]'));
  assert.deepEqual(declarations('.cm-ad-dialog').background, 'var(--scrim)');
  assert.equal(declarations('.cm-ad-dialog')['backdrop-filter'], undefined);
  const panel = declarations('.cm-ad-dialog__panel');
  assert.equal(panel['border-radius'], 'var(--r-xl)');
  assert.equal(panel['box-shadow'], 'var(--e2)');
  const tile = declarations('.cm-ad');
  assert.equal(tile['box-shadow'], 'var(--e1)');
  assert.equal(tile['border-radius'], 'var(--r-lg)');
  assert.equal(tile.flex, '0 0 min(100%, 26rem)', 'a tile is never wider than its row (the phone cut its text at the right edge)');
  assert.equal(declarations('.cm-ad__body')['min-width'], '0');
});

test('N09 / N02 / N16 / N15: search edge, section headings, the page gutter and the 48px end in community.css', () => {
  assert.equal(declarations('.cm-search').border, '1px solid var(--color-line-control)');
  // N02: the section size only on a category / search board; the base (post sheet aside, 其他X信息, the home board) is the card size
  assert.equal(declarations('.cm-board__subhead')['font-size'], 'var(--text-card)');
  for (const selector of [':where(.cm-board:not([data-mode=home]) .cm-board__notes) .cm-board__subhead', '.cm-guides__title']) assert.equal(declarations(selector)['font-size'], 'var(--text-section)', selector);
  assert.equal(declarations('.cm-ads__head>.cm-board__subhead').margin, '0', 'the promotions heading keeps its row margin');
  // one rounded ring around the search field on keyboard focus, none on the inner input
  assert.equal(declarations('.site-app .cm-search input').outline, '0');
  assert.equal(declarations('.cm-search:has(input:focus-visible)').outline, 'var(--focus-ring-width) solid var(--color-brand)');
  // the promotions skeleton and the admin's empty box are not pressable; the dialog head leaves room for the close ring
  assert.equal(declarations('.cm-ad:active').scale, undefined);
  assert.equal(declarations('.cm-ad:not(.cm-ad--empty, .cm-ad--loading):active').scale, '.985');
  assert.equal(declarations('.cm-ad.cm-ad--loading').cursor, 'default');
  assert.match(declarations('.cm-ad-dialog__head').padding, /^var\(--sp-2\) var\(--sp-3\) var\(--sp-2\)/);
  assert.equal(declarations('.cm-card .ui-sticker[data-tone=price]')['font-size'], undefined, 'no price sticker rule left');
  const page = declarations('.bay-home:not(.bay-home-editorial)');
  assert.equal(page['padding-inline'], 'var(--page-gutter)');
  assert.equal(page['padding-bottom'], '0');
  assert.match(declarations('.cm-board').padding, /var\(--sp-7\)$/);
  assert.doesNotMatch(css, /data-quiet/, 'the quiet-board line is a plain line like the count, not a tinted box');
  assert.doesNotMatch(readFileSync('src/pages/CommunityBoard.tsx', 'utf8'), /data-quiet/);
  assert.doesNotMatch(css, /text-underline-offset:3px/);
});
