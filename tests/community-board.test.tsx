// WEB-COMMUNITY (T15, FC3-04, FC3-05, D20): the 邻里信息 board says honestly how current it is, labels the founder's posts,
// hides counts under 3, never presets 提供 / 需求, and offers the email reminder once, through the existing preferences API.
import assert from 'node:assert/strict';
import test, { after, afterEach, before } from 'node:test';
import { registerHooks } from 'node:module';
import { JSDOM } from 'jsdom';
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
const { render, fireEvent, cleanup, screen, waitFor, act } = await import('@testing-library/react');
const { MemoryRouter, Routes, Route, Outlet } = await import('react-router-dom');
const { api } = await import('../src/lib/api');
const { setLocale } = await import('../src/i18n/locale');
const { default: CommunityBoard } = await import('../src/pages/CommunityBoard');
const { NoticeOptIn } = await import('../src/features/posts/NoticeOptIn');
const { isFounderPost, postDate, publishLabel, showCount } = await import('../src/features/posts/community-copy');
const originalRequest = api.request;
const quietApi = (async () => ({ posts: [], ads: [] })) as typeof api.request;
before(() => { api.request = quietApi; });
afterEach(async () => { cleanup(); api.request = quietApi; localStorage.clear(); await setLocale('zh-Hans', false); });
after(() => { api.request = originalRequest; styles.deregister(); dom.window.close(); });

const DAY = 86_400_000;
const post = (id: string, overrides: Partial<PostData> = {}): PostData => ({
  id, authorId: 'member-1', author: { id: 'member-1', nickname: '邻居甲' }, type: 'provider', title: `Daly City 房间出租 ${id}`, city: '中半岛',
  category: '租屋', timeInfo: '', budget: '$1500', description: '近 BART，可短租。', contactInfo: null, imageUrls: [], likesCount: 1, hasLiked: false,
  commentsCount: 0, comments: [], createdAt: Date.now() - 120 * DAY, status: 'active', confirmedAt: null, ...overrides,
});
const noop = () => {};
const board = (posts: PostData[], entry = '/category/rent', overrides: Partial<AppContextValue> = {}) => {
  const context = {
    user: null, posts, feedType: 'provider', keyword: '', regionFilter: '全部', categoryFilter: '租屋', feedError: false, isInitialLoading: false,
    isLoadingMore: false, hasMore: false, blockedUserIds: [], retryFeed: noop, setKeyword: noop, setRegionFilter: noop, setFeedType: noop,
    searchPostsNow: noop, handleLoadMore: noop, navigateToPost: noop, openCreate: noop, openEditPost: noop, handleDeletePost: noop,
    handleToggleFeature: noop, handleToggleBlockUser: noop, openReportTarget: noop, openAdDetail: noop, showToast: noop, adsRefreshKey: 0, ...overrides,
  } as unknown as AppContextValue;
  return render(<MemoryRouter initialEntries={[entry]}><Routes><Route element={<Outlet context={context} />}>
    <Route path="/category/:categorySlug" element={<CommunityBoard onScrollToFeed={noop} scrollRequest={0} />} />
  </Route></Routes></MemoryRouter>);
};

test('a board whose newest post is over 30 days old shows every post and says 近 30 天 0 条新信息 instead of "empty"', () => {
  const view = board([post('a'), post('b', { createdAt: Date.now() - 200 * DAY })]);
  assert.ok(screen.getByRole('heading', { level: 1, name: '租房' }));
  assert.ok(screen.getByText('测试中'));
  assert.match(view.container.querySelector('.cm-board__count')!.textContent!, /^近 30 天 0 条新信息/);
  assert.equal(view.container.querySelectorAll('.cm-card').length, 2);
  assert.equal(view.container.querySelectorAll('h1').length, 1);
  assert.doesNotMatch(view.container.textContent!, /还没有资源|共 2 条/);
  // Each card carries its posted date and its confirmation status.
  assert.match(view.container.querySelector('.cm-card__meta')!.textContent!, /中半岛 · \d+\/\d+ 发布/);
  assert.ok(view.container.querySelector('.cm-card .ui-status')!.textContent!.includes('待确认有效'));
});

test('counts under 3 are hidden; 3 or more new posts are counted', () => {
  let view = board([post('a', { createdAt: Date.now() - DAY }), post('b', { createdAt: Date.now() - 2 * DAY })]);
  assert.doesNotMatch(view.container.querySelector('.cm-board__count')!.textContent!, /\d+ 条/);
  cleanup();
  view = board([post('a', { createdAt: Date.now() - DAY }), post('b', { createdAt: Date.now() - 2 * DAY }), post('c', { createdAt: Date.now() - 3 * DAY })]);
  assert.match(view.container.querySelector('.cm-board__count')!.textContent!, /近 30 天 3 条新信息/);
  assert.equal(showCount(2), false);
  assert.equal(showCount(3), true);
});

test('?recent=1 with nothing recent offers 查看较早信息 (the WEB-UI EmptyState)', () => {
  const view = board([], '/category/rent?recent=1');
  assert.ok(screen.getByRole('heading', { name: '近 30 天 0 条新信息' }));
  assert.ok(screen.getByRole('button', { name: '查看较早信息' }));
  assert.ok(view.container.querySelector('.ui-state[data-kind=empty]'));
});

test('the founder and admin accounts’ posts say 站长发布; other members’ do not', () => {
  const view = board([post('f', { authorId: '1779316048437', author: { id: '1779316048437', nickname: 'Will Yuan' } }), post('m')]);
  const cards = [...view.container.querySelectorAll('.cm-card')];
  assert.ok(cards[0].textContent!.includes('站长发布'));
  assert.ok(!cards[1].textContent!.includes('站长发布'));
  assert.equal(isFounderPost({ authorId: 'admin' }), true);
  assert.equal(isFounderPost({ authorId: 'someone', author: { isAdmin: true } }), true);
  assert.equal(isFounderPost({ authorId: 'someone', author: {} }), false);
});

test('English boards use English names, dates and the publish label; the composer is never preset to 提供 / 需求', async () => {
  await setLocale('en', false);
  const calls: unknown[][] = [];
  const view = board([post('a')], '/category/rent', { openCreate: ((...args: unknown[]) => { calls.push(args); }) as AppContextValue['openCreate'] });
  assert.ok(screen.getByRole('heading', { level: 1, name: 'Housing' }));
  fireEvent.click(screen.getAllByRole('button', { name: publishLabel('租屋').en })[0]);
  assert.deepEqual(calls, [[undefined, '租屋']]);
  const chrome = [...view.container.querySelectorAll('.cm-board__header, .cm-board__filters, .cm-board__notes nav')].map(element => element.textContent).join(' ');
  assert.doesNotMatch(chrome, /\p{Script=Han}/u);
  assert.match(postDate(Date.UTC(2026, 5, 13, 19), true, Date.UTC(2026, 9, 12)), /^Jun 13$/);
  assert.equal(postDate(Date.UTC(2026, 5, 13, 19), false, Date.UTC(2026, 9, 12)), '6/13');
});

const settings = (overrides: Record<string, unknown> = {}) => ({
  preferences: { email: { message: false, contact_request: false, outing_request: false, comment: false }, sms: { message: false, contact_request: false, outing_request: false, comment: false } },
  topics: ['message', 'contact_request', 'outing_request', 'comment'], emailVerified: true, phoneVerified: false, deliveryEnabled: true, ...overrides,
});

test('FC3-05: with every reminder off, one tap turns on email for messages and contact requests only', async () => {
  localStorage.setItem('currentUser', JSON.stringify({ id: 'member-1', token: 't' }));
  const calls: { path: string; method?: string; body?: unknown }[] = [];
  api.request = (async (path: string, options?: RequestInit) => {
    calls.push({ path, method: options?.method, body: options?.body ? JSON.parse(String(options.body)) : undefined });
    return options?.method === 'PATCH' ? settings({ preferences: { email: { message: true, contact_request: true, outing_request: false, comment: false }, sms: settings().preferences.sms } }) : settings();
  }) as typeof api.request;
  render(<MemoryRouter><NoticeOptIn userId="member-1" context="post" /></MemoryRouter>);
  const button = await screen.findByRole('button', { name: '用邮件提醒我' });
  await act(async () => { fireEvent.click(button); });
  await waitFor(() => assert.ok(screen.getByRole('status').textContent!.includes('已开启邮件提醒')));
  const patch = calls.find(call => call.method === 'PATCH')!;
  assert.equal(patch.path, '/notifications/preferences');
  assert.deepEqual((patch.body as { preferences: unknown }).preferences, {
    email: { message: true, contact_request: true, outing_request: false, comment: false },
    sms: { message: false, contact_request: false, outing_request: false, comment: false },
  });
});

test('FC3-05: nothing is offered when a reminder is already on, when the settings cannot be read, or after 以后再说', async () => {
  localStorage.setItem('currentUser', JSON.stringify({ id: 'member-1', token: 't' }));
  const wait = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); });
  api.request = (async () => settings({ preferences: { email: { message: true, contact_request: false }, sms: {} } })) as typeof api.request;
  let view = render(<MemoryRouter><NoticeOptIn userId="member-1" context="dm" /></MemoryRouter>);
  await wait();
  assert.equal(view.container.querySelector('.cm-optin'), null);
  cleanup();
  api.request = (async () => { throw new Error('offline'); }) as typeof api.request;
  view = render(<MemoryRouter><NoticeOptIn userId="member-1" context="dm" /></MemoryRouter>);
  await wait();
  assert.equal(view.container.querySelector('.cm-optin'), null);
  cleanup();
  api.request = (async () => settings({ emailVerified: false })) as typeof api.request;
  view = render(<MemoryRouter><NoticeOptIn userId="member-1" context="post" /></MemoryRouter>);
  assert.ok(await screen.findByRole('button', { name: '验证邮箱并开启' }));
  fireEvent.click(screen.getByRole('button', { name: '以后再说' }));
  assert.equal(view.container.querySelector('.cm-optin'), null);
  cleanup();
  view = render(<MemoryRouter><NoticeOptIn userId="member-1" context="post" /></MemoryRouter>);
  await wait();
  assert.equal(view.container.querySelector('.cm-optin'), null, '以后再说 is remembered for this account');
});
