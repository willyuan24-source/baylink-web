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
const { MemoryRouter, Routes, Route, Outlet, useLocation } = await import('react-router-dom');
const { api } = await import('../src/lib/api');
const { setLocale } = await import('../src/i18n/locale');
const { default: CommunityBoard } = await import('../src/pages/CommunityBoard');
const { NoticeOptIn } = await import('../src/features/posts/NoticeOptIn');
const { isFounderPost, postDate, postedOn, publishLabel, showCount } = await import('../src/features/posts/community-copy');
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
/** The router's current path and query, for the board's URL changes. */
function LocationProbe() { const location = useLocation(); return <output data-testid="location">{location.pathname + location.search}</output>; }
const board = (posts: PostData[], entry = '/category/rent', overrides: Partial<AppContextValue> = {}) => {
  const context = {
    user: null, posts, feedType: 'provider', keyword: '', regionFilter: '全部', categoryFilter: '租屋', feedError: false, isInitialLoading: false,
    isLoadingMore: false, hasMore: false, blockedUserIds: [], retryFeed: noop, setKeyword: noop, setRegionFilter: noop, setFeedType: noop,
    searchPostsNow: noop, handleLoadMore: noop, navigateToPost: noop, openCreate: noop, openEditPost: noop, handleDeletePost: noop,
    handleToggleFeature: noop, handleToggleBlockUser: noop, openReportTarget: noop, openAdDetail: noop, showToast: noop, adsRefreshKey: 0, ...overrides,
  } as unknown as AppContextValue;
  return render(<MemoryRouter initialEntries={[entry]}><Routes><Route element={<Outlet context={context} />}>
    <Route path="/category/:categorySlug" element={<CommunityBoard onScrollToFeed={noop} scrollRequest={0} />} />
  </Route></Routes><LocationProbe /></MemoryRouter>);
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
  assert.match(view.container.querySelector('.cm-card__meta')!.textContent!, /半岛 · \d+\/\d+ 发布/);
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

test('?recent=1 with nothing recent offers 查看较早信息 (the WEB-UI EmptyState)', async () => {
  const view = board([], '/category/rent?recent=1');
  // 求租 is empty too (the quiet api), so the state may speak for the whole board.
  assert.ok(await screen.findByRole('heading', { name: '近 30 天 0 条新信息' }));
  assert.ok(screen.getByRole('button', { name: '查看较早信息' }));
  assert.ok(view.container.querySelector('.ui-state[data-kind=empty]'));
});

/** The api with posts of one kind only: `/posts?type=<kind>` returns them, the other kind nothing. */
const onlyKind = (kind: 'provider' | 'client', posts: PostData[], calls: string[] = []) => (async (path: string) => {
  calls.push(path);
  return path.startsWith('/posts?') && path.includes(`type=${kind}`) ? { posts, hasMore: false } : { posts: [], ads: [] };
}) as typeof api.request;

test('FC3-04: the service board’s default 提供 view with only 需要 posts names the kind and offers 需要, never “本地服务还没有信息”', async () => {
  const calls: string[] = [];
  api.request = onlyKind('client', [post('c', { type: 'client', category: '清洁', title: '找清洁阿姨' })], calls);
  const switched: unknown[] = [];
  const view = board([], '/category/service', { categoryFilter: '本地服务', setFeedType: ((type: unknown) => { switched.push(type); }) as AppContextValue['setFeedType'] });
  assert.ok(screen.getByRole('heading', { level: 3, name: '还没有「提供」的本地服务信息' }), 'the claim is about the kind on screen from the first frame');
  const see = await screen.findByRole('button', { name: '看看「需要」' });
  assert.ok(screen.getByText('「需要」里有信息，可以先看看。'));
  assert.doesNotMatch(view.container.textContent!, /本地服务还没有信息|还没有资源/);
  fireEvent.click(see);
  assert.deepEqual(switched, ['client']);
  // The check asks for the other kind under the same board and filters.
  assert.ok(calls.some(path => path.includes('type=client') && path.includes(`category=${encodeURIComponent('本地服务')}`) && path.includes('availability=all')), calls.join('\n'));
});

test('FC3-04: 求租 on a board whose posts are all 出租 says so and offers 出租', async () => {
  api.request = onlyKind('provider', [post('a')]);
  const view = board([], '/category/rent?type=client', { feedType: 'client' });
  assert.ok(screen.getByRole('heading', { level: 3, name: '还没有「求租」的租房信息' }));
  assert.ok(await screen.findByRole('button', { name: '看看「出租」' }));
  assert.doesNotMatch(view.container.textContent!, /租房还没有信息/);
});

test('FC3-04: a board with neither kind says the board itself is empty (both kinds checked)', async () => {
  const view = board([], '/category/rent');
  assert.ok(await screen.findByRole('heading', { level: 3, name: '租房还没有信息' }));
  assert.equal(screen.queryByRole('button', { name: /^看看/ }), null);
  assert.ok(view.container.querySelector('.ui-state[data-kind=empty]'));
});

test('RC-25: a keyword with no match inside a category is a search miss with 清除筛选, never “还没有信息”', async () => {
  const calls: string[] = [];
  api.request = (async (path: string) => { calls.push(path); return { posts: [], ads: [] }; }) as typeof api.request;
  const view = board([], '/category/rent?q=zzz', { keyword: 'zzz' });
  assert.ok(await screen.findByRole('heading', { level: 3, name: '没有找到相关的租房信息' }));
  assert.doesNotMatch(view.container.textContent!, /还没有信息/);
  assert.ok(calls.some(path => path.includes('type=client') && path.includes('keyword=zzz')), 'the other kind is checked with the same keyword');
  const clear = screen.getAllByRole('button', { name: '清除筛选' });
  assert.equal(clear.length, 2, 'one in the results bar, one in the empty state');
  fireEvent.click(clear[1]);
  assert.equal(screen.getByTestId('location').textContent, '/category/rent');
});

test('RC-25: a keyword miss under 出租 that 求租 matches offers 求租 first', async () => {
  api.request = onlyKind('client', [post('c', { type: 'client', title: '求租 zzz' })]);
  board([], '/category/rent?q=zzz', { keyword: 'zzz' });
  assert.ok(screen.getByRole('heading', { level: 3, name: '「出租」里没有找到相关信息' }));
  assert.ok(await screen.findByRole('button', { name: '看看「求租」' }));
  assert.ok(screen.getAllByRole('button', { name: '清除筛选' }).length >= 1);
});

test('the board’s filters survive a browser without URLSearchParams.size (Safari before 17: iOS 15/16)', async () => {
  const prototypes = [URLSearchParams.prototype, dom.window.URLSearchParams.prototype];
  const saved = prototypes.map(proto => Object.getOwnPropertyDescriptor(proto, 'size'));
  for (const proto of prototypes) Object.defineProperty(proto, 'size', { configurable: true, get: () => undefined });
  try {
    assert.equal(new URLSearchParams('a=1').size, undefined, 'the stub is in place');
    const { feedSearch } = await import('../src/app/useFeedFilters');
    assert.equal(feedSearch({ keyword: '', regionFilter: '东湾', feedType: 'client' }), `?region=${encodeURIComponent('东湾')}&type=client`);
    assert.equal(feedSearch({ keyword: '', regionFilter: '全部', feedType: 'provider' }, '?region=东湾'), '');
    board([post('a')]);
    fireEvent.click(screen.getByRole('button', { name: '近期确认' }));
    assert.equal(screen.getByTestId('location').textContent, '/category/rent?recent=1');
  } finally {
    prototypes.forEach((proto, index) => { const descriptor = saved[index]; if (descriptor) Object.defineProperty(proto, 'size', descriptor); else delete (proto as { size?: number }).size; });
  }
});

test('category boards have an h2 between the board’s H1 and the card titles', () => {
  const view = board([post('a')]);
  const headings = [...view.container.querySelectorAll('h1, h2, h3')].map(element => element.tagName);
  assert.deepEqual(headings.slice(0, 3), ['H1', 'H2', 'H3']);
  assert.equal(view.container.querySelector('h2.sr-only')!.textContent, '租房信息');
});

test('the founder’s two accounts’ posts say 站长发布; other members’ and other admins’ do not', () => {
  const view = board([post('f', { authorId: '1779316048437', author: { id: '1779316048437', nickname: 'Will Yuan' } }), post('m'),
    post('moderator', { authorId: 'moderator-1', author: { id: 'moderator-1', nickname: '版主', isAdmin: true } as PostData['author'] })]);
  const cards = [...view.container.querySelectorAll('.cm-card')];
  assert.ok(cards[0].textContent!.includes('站长发布'));
  assert.ok(!cards[1].textContent!.includes('站长发布'));
  assert.ok(!cards[2].textContent!.includes('站长发布'), 'a moderator is not the site owner');
  assert.equal(isFounderPost({ authorId: 'admin' }), true);
  assert.equal(isFounderPost({ authorId: 'moderator-1' }), false);
});

test('board cards are grid cards; a card outside a feed grid (我的发布) is a row by default', async () => {
  const view = board([post('a')]);
  assert.equal(view.container.querySelector('.cm-card')!.getAttribute('data-layout'), 'grid');
  // UI9-R1 N22 / N06: the price is a line under the title on every card (not a sticker on the photo), with digit groups.
  assert.equal(view.container.querySelector('.cm-card__price')!.textContent, '$1,500');
  assert.equal(view.container.querySelector('.ui-sticker[data-tone=price]'), null);
  cleanup();
  const { PostCard } = await import('../src/features/posts/PostCard');
  const list = render(<MemoryRouter><PostCard post={post('mine')} /></MemoryRouter>);
  assert.equal(list.container.querySelector('.cm-card')!.getAttribute('data-layout'), 'list');
  assert.equal(list.container.querySelector('.cm-card__price')!.textContent, '$1,500');
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
  // English reads "Posted Jun 13" (never "Jun 13 posted").
  assert.equal(postedOn(Date.UTC(2026, 5, 13, 19), true, Date.UTC(2026, 9, 12)), 'Posted Jun 13');
  assert.equal(postedOn(Date.UTC(2026, 5, 13, 19), false, Date.UTC(2026, 9, 12)), '6/13 发布');
  assert.match(view.container.querySelector('.cm-card__meta')!.textContent!, /^Peninsula · Posted [A-Z][a-z]{2} \d+/);
  // 出租 / 求租 is a radio group of chips (the area chips' two styles).
  const types = screen.getByRole('radiogroup', { name: 'Type of post' });
  assert.deepEqual([...types.querySelectorAll('[role=radio]')].map(item => [item.className, item.getAttribute('aria-checked')]), [['ui-chip', 'true'], ['ui-chip', 'false']]);
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
  localStorage.setItem('currentUser', JSON.stringify({ id: 'member-1', token: 't', email: 'member@example.com' }));
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
  // Unverified: the button says what the tap does (the API turns email on only for a verified address).
  assert.ok(await screen.findByRole('button', { name: '先验证邮箱' }));
  fireEvent.click(screen.getByRole('button', { name: '以后再说' }));
  assert.equal(view.container.querySelector('.cm-optin'), null);
  cleanup();
  view = render(<MemoryRouter><NoticeOptIn userId="member-1" context="post" /></MemoryRouter>);
  await wait();
  assert.equal(view.container.querySelector('.cm-optin'), null, '以后再说 is remembered for this account');
});

test('FC3-05: an unverified account without a usable email is offered nothing; a stale address gets a plain note', async () => {
  const wait = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); });
  localStorage.setItem('currentUser', JSON.stringify({ id: 'member-2', token: 't', email: '' }));
  api.request = (async () => settings({ emailVerified: false })) as typeof api.request;
  let view = render(<MemoryRouter><NoticeOptIn userId="member-2" context="dm" /></MemoryRouter>);
  await wait();
  assert.equal(view.container.querySelector('.cm-optin'), null);
  cleanup();
  localStorage.setItem('currentUser', JSON.stringify({ id: 'member-2', token: 't', email: 'old@example.com' }));
  api.request = (async (path: string) => {
    if (path === '/notifications/email/start') throw { status: 403, error: '当前账号邮箱不可用。' };
    return settings({ emailVerified: false });
  }) as typeof api.request;
  let shown = 0;
  view = render(<MemoryRouter><NoticeOptIn userId="member-2" context="dm" onShown={() => { shown += 1; }} /></MemoryRouter>);
  const verify = await screen.findByRole('button', { name: '先验证邮箱' });
  await act(async () => { fireEvent.click(verify); });
  await waitFor(() => assert.match(screen.getByRole('status').textContent!, /还没有可用的邮箱/));
  assert.equal(shown, 1, 'onShown runs once, when the offer appears');
  assert.equal(view.container.querySelector('[role=alert]'), null);
});
