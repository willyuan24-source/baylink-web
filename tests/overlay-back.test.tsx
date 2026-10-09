// G4 / N3: closing a post or profile overlay never leaves BAYLINK and never loses the editor. History −1 is used only when
// this document pushed the overlay; a shared link, a reload or WeChat land on the background page or a fallback instead.
import assert from 'node:assert/strict';
import test, { after, afterEach, before, type TestContext } from 'node:test';
import { registerHooks } from 'node:module';
import { JSDOM } from 'jsdom';
import React from 'react';

const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'https://www.baylink.us/', pretendToBeVisual: true });
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage,
  HTMLElement: dom.window.HTMLElement, Node: dom.window.Node,
  requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
  cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
  getComputedStyle: dom.window.getComputedStyle.bind(dom.window), IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
dom.window.scrollTo = () => {};
const hooks = registerHooks({ load(url, context, next) {
  if (url.includes('/socket.io-client/')) return { format: 'module', shortCircuit: true, source: 'export const io = () => ({ on() { return this; }, off() { return this; }, emit() {}, disconnect() {} });' };
  return url.endsWith('.css') ? { format: 'module', shortCircuit: true, source: 'export {}' } : next(url, context);
} });
const { render, fireEvent, cleanup, act, within } = await import('@testing-library/react');
const { MemoryRouter, Routes, Route, useLocation, useNavigate } = await import('react-router-dom');
const { default: AppLayout } = await import('../src/app/AppLayout');
const { api } = await import('../src/lib/api');
const { SESSION_KEY } = await import('../src/lib/session');
after(() => { hooks.deregister(); });
// Lazy overlay chunks load once up front, so each assertion is about routing rather than chunk timing.
before(async () => { await Promise.all([import('../src/features/posts/PostDetailModal'), import('../src/features/users/UserProfileModal'), import('../src/features/posts/CreatePostModal')]); });
afterEach(() => { cleanup(); localStorage.clear(); });

const author = { id: 'author-1', nickname: '邻居甲', token: 'fixture-token' };
const post = {
  id: 'p1', authorId: author.id, author: { id: author.id, nickname: author.nickname }, title: '出一张二手书桌', description: '九成新，自取。',
  type: 'provider', city: 'San Mateo', category: '闲置', contactInfo: null, imageUrls: [], likesCount: 0, hasLiked: false,
  commentsCount: 0, comments: [], createdAt: Date.now(), status: 'active',
};

type Entry = string | { pathname: string; search?: string; state?: unknown };
function Harness({ pushTo }: { pushTo?: string }) {
  const location = useLocation();
  const navigate = useNavigate();
  const background = (location.state as { backgroundLocation?: typeof location } | null)?.backgroundLocation;
  return <>
    <output data-testid="where">{location.pathname}{location.search}</output>
    <button type="button" onClick={() => navigate(-1)}>fixture back</button>
    <button type="button" onClick={() => navigate(1)}>fixture forward</button>
    {pushTo && <button type="button" onClick={() => navigate(pushTo, { state: { backgroundLocation: location } })}>fixture open overlay</button>}
    <Routes location={background || location}><Route element={<AppLayout realLocation={location} />}><Route path="*" element={<div>fixture page</div>} /></Route></Routes>
  </>;
}

function mount(t: TestContext, entries: Entry[], { index = entries.length - 1, signedIn = false, pushTo }: { index?: number; signedIn?: boolean; pushTo?: string } = {}) {
  if (signedIn) localStorage.setItem(SESSION_KEY, JSON.stringify(author));
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('Network forbidden in overlay tests'); });
  t.mock.method(api, 'request', async (path: string) => {
    if (path.startsWith('/posts?')) return { posts: [], hasMore: false };
    if (path === '/posts/p1') return post;
    if (path === '/posts/gone') throw Object.assign(new Error('not found'), { status: 404 });
    if (path === '/users/u9/public') return { id: 'u9', nickname: '邻居乙', recentPosts: [] };
    if (path === '/conversations') return [];
    if (path.startsWith('/contact-requests')) return { requests: [] };
    if (path === '/users/me/blocks') return { blocks: [] };
    throw new Error(`Unexpected API call: ${path}`);
  });
  return render(<MemoryRouter initialEntries={entries} initialIndex={index}><Harness pushTo={pushTo} /></MemoryRouter>);
}
const where = (view: ReturnType<typeof render>) => view.getByTestId('where').textContent;
/** Let the layout's own requests (feed, post, unread counts) resolve, so a dialog found next is the one that stays. */
const settle = () => act(async () => { for (let i = 0; i < 5; i++) await new Promise(resolve => setTimeout(resolve, 10)); });
const dialogNamed = async (view: ReturnType<typeof render>, name: string) => { await view.findByRole('dialog', { name }); await settle(); return within(view.getByRole('dialog', { name })); };
const closePost = async (view: ReturnType<typeof render>) => {
  const dialog = await dialogNamed(view, post.title);
  await act(async () => { fireEvent.click(dialog.getByRole('button', { name: '关闭' })); });
};

test('a shared post link (another site before it) closes onto its 邻里 board, not back out of BAYLINK', async t => {
  const view = mount(t, ['/elsewhere-before-baylink', '/posts/p1']);
  await closePost(view);
  assert.equal(where(view), '/category/used');
  await act(async () => { fireEvent.click(view.getByRole('button', { name: 'fixture back' })); });
  assert.equal(where(view), '/elsewhere-before-baylink', 'the overlay entry was replaced, so Back leaves as the reader expects');
});

test('in the app, closing a post opened from a board pops back to it (Forward reopens it)', async t => {
  const view = mount(t, ['/category/rent'], { pushTo: '/posts/p1' });
  await act(async () => { fireEvent.click(view.getByRole('button', { name: 'fixture open overlay' })); });
  assert.equal(where(view), '/posts/p1');
  await closePost(view);
  assert.equal(where(view), '/category/rent');
  await act(async () => { fireEvent.click(view.getByRole('button', { name: 'fixture forward' })); });
  assert.equal(where(view), '/posts/p1', 'closing was a history pop');
});

test('after a reload the saved background page replaces the overlay (its history state survives, the document does not)', async t => {
  const view = mount(t, ['/somewhere-in-the-old-document', { pathname: '/posts/p1', state: { backgroundLocation: { pathname: '/guides', search: '?q=desk', hash: '', state: null, key: 'old' } } }]);
  await closePost(view);
  assert.equal(where(view), '/guides?q=desk');
});

test('编辑 from a shared link opens the editor and keeps it open on the board (it no longer depends on history)', async t => {
  const view = mount(t, ['/elsewhere-before-baylink', '/posts/p1'], { signedIn: true });
  const dialog = await dialogNamed(view, post.title);
  await act(async () => { fireEvent.click(dialog.getByRole('button', { name: '更多' })); });
  await act(async () => { fireEvent.click(dialog.getByRole('button', { name: '编辑' })); });
  assert.ok(await view.findByRole('dialog', { name: '编辑信息' }), 'the editor is open');
  assert.equal(where(view), '/category/used');
  assert.equal(view.queryByRole('dialog', { name: post.title }), null);
});

test('a dead shared link\'s 返回 stays on the site', async t => {
  const view = mount(t, ['/elsewhere-before-baylink', '/posts/gone']);
  const dialog = await dialogNamed(view, '内容不可访问');
  await act(async () => { fireEvent.click(dialog.getByRole('button', { name: '返回' })); });
  assert.equal(where(view), '/category/rent');
});

test('a shared profile card (/users/:id) closes to the home page; opened in the app it pops back', async t => {
  const shared = mount(t, ['/elsewhere-before-baylink', '/users/u9']);
  const card = await dialogNamed(shared, '湾区生活名片');
  await act(async () => { fireEvent.click(card.getByRole('button', { name: '关闭用户名片' })); });
  assert.equal(where(shared), '/');
  shared.unmount();
  const inApp = mount(t, ['/guides'], { pushTo: '/users/u9' });
  await act(async () => { fireEvent.click(inApp.getByRole('button', { name: 'fixture open overlay' })); });
  const again = await dialogNamed(inApp, '湾区生活名片');
  await act(async () => { fireEvent.click(again.getByRole('button', { name: '关闭用户名片' })); });
  assert.equal(where(inApp), '/guides');
});
