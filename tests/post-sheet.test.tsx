// WEB-COMMUNITY (T20): the post sheet — one visible H1 (the page under it is hidden while it is open), the sticky contact
// bar for a guest, a member, the owner and an ended post, 邻里聊聊 counts from 3, and 同区同类 filled to three cards.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, afterEach, test } from 'node:test';
import { registerHooks } from 'node:module';
import { JSDOM } from 'jsdom';
import React from 'react';
import type { PostComment } from '../src/components/CommentItem';
import type { PostData, UserData } from '../src/lib/types';

const dom = new JSDOM('<!doctype html><html><head></head><body><div id="root"><main><h1>首页</h1></main></div></body></html>', {
  url: 'https://www.baylink.us/posts/sheet-1', pretendToBeVisual: true,
});
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage,
  HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
dom.window.HTMLElement.prototype.getClientRects = function () {
  return (this.isConnected && !this.hidden ? [{ width: 1, height: 1 }] : []) as unknown as DOMRectList;
};
const styles = registerHooks({ load(url, context, next) { return url.endsWith('.css') ? { format: 'module', shortCircuit: true, source: 'export {}' } : next(url, context); } });
const { render, fireEvent, cleanup, act, screen, waitFor, within } = await import('@testing-library/react');
const { MemoryRouter } = await import('react-router-dom');
const { api } = await import('../src/lib/api');
const { setLocale } = await import('../src/i18n/locale');
const { PostDetailModal } = await import('../src/features/posts/PostDetailModal');

const originalRequest = api.request;
afterEach(async () => { cleanup(); api.request = originalRequest; localStorage.clear(); await setLocale('zh-Hans', false); });
after(() => { styles.deregister(); dom.window.close(); });

const DAY = 86_400_000;
const post = (id: string, overrides: Partial<PostData> = {}): PostData => ({
  id, authorId: 'poster-1', author: { id: 'poster-1', nickname: '邻居甲' }, type: 'provider', title: `Fremont 主卧出租 ${id}`, city: '东湾',
  category: '租屋', timeInfo: '', budget: '$1500/月', description: '近 BART，可短租。', contactInfo: null, imageUrls: [], likesCount: 0, hasLiked: false,
  commentsCount: 0, comments: [], createdAt: Date.now() - 120 * DAY, status: 'active', confirmedAt: null, ...overrides,
});
const comment = (id: string): PostComment => ({ id, authorId: `c-${id}`, authorName: `评论者${id}`, content: `问一下 ${id}`, createdAt: Date.now() - DAY });
const member = (id: string) => ({ id, nickname: '邻居乙', role: 'user' }) as UserData;

/** The api as the sheet sees it: /posts?… answers from `lists` (by query), everything else `{}`; every path is kept. */
const stubApi = (lists: Record<string, PostData[]> = {}) => {
  const calls: string[] = [];
  api.request = (async (path: string) => {
    calls.push(path);
    if (path.startsWith('/posts?')) {
      const query = new URLSearchParams(path.slice('/posts?'.length));
      return { posts: lists[query.get('city') ? 'area' : 'category'] || [] };
    }
    return {};
  }) as typeof api.request;
  return calls;
};

type SheetProps = Parameters<typeof PostDetailModal>[0];
const sheet = (value: PostData, overrides: Partial<SheetProps> = {}) => {
  const noop = () => {};
  const props: SheetProps = {
    post: value, currentUser: null, onClose: noop, onLoginNeeded: noop, onOpenChat: noop, onDeleted: noop, onImageClick: noop,
    onShare: noop, showToast: noop, onAskBayBay: noop, ...overrides,
  };
  return render(<MemoryRouter><PostDetailModal {...props} /></MemoryRouter>);
};
const bar = () => document.querySelector<HTMLElement>('.cm-sheet__bar')!;
const settle = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); });

test('one visible H1: the sheet has its own, and hides the page under it until it closes', async () => {
  stubApi();
  const view = sheet(post('sheet-1'));
  await settle();
  const dialog = screen.getByRole('dialog');
  assert.equal(within(dialog).getAllByRole('heading', { level: 1 }).length, 1);
  assert.equal(within(dialog).getByRole('heading', { level: 1 }).textContent, 'Fremont 主卧出租 sheet-1');
  // The page's own H1 (#root main) is hidden by community.css while html[data-post-sheet] is set.
  assert.ok(document.documentElement.hasAttribute('data-post-sheet'));
  assert.match(readFileSync(new URL('../src/features/posts/community.css', import.meta.url), 'utf8'), /html\[data-post-sheet\] #root main \{ visibility:hidden; \}/);
  view.unmount();
  assert.equal(document.documentElement.hasAttribute('data-post-sheet'), false, 'the page is shown again on close');
});

test('a guest’s contact bar asks to sign in through onContactLoginNeeded; a member’s opens the chat', async () => {
  stubApi();
  let contactLogins = 0, logins = 0;
  const value = post('sheet-guest');
  const view = sheet(value, { onContactLoginNeeded: () => { contactLogins += 1; }, onLoginNeeded: () => { logins += 1; } });
  await settle();
  const guestButton = within(bar()).getByRole('button', { name: '登录后私信发布者' });
  assert.ok(guestButton.hasAttribute('data-contact-action'), 'the contact_click metric still finds the bar button');
  assert.ok(within(bar()).getByText('$1500/月'));
  fireEvent.click(guestButton);
  assert.equal(contactLogins, 1);
  assert.equal(logins, 0);
  view.unmount();

  const opened: unknown[][] = [];
  sheet(value, { currentUser: member('reader-1'), onOpenChat: (...args) => { opened.push(args); } });
  await settle();
  fireEvent.click(within(bar()).getByRole('button', { name: '私信发布者' }));
  assert.deepEqual(opened, [['poster-1', '邻居甲', value.title]]);
});

test('the owner’s bar says it is their post and offers 编辑; an ended post takes no new contact', async () => {
  stubApi();
  const edits: PostData[] = [];
  const value = post('sheet-own');
  const view = sheet(value, { currentUser: member('poster-1'), onEdit: item => { edits.push(item); } });
  await settle();
  assert.match(bar().textContent!, /这是你发布的信息/);
  assert.equal(within(bar()).queryByRole('button', { name: /私信/ }), null);
  fireEvent.click(within(bar()).getByRole('button', { name: '编辑' }));
  assert.deepEqual(edits.map(item => item.id), ['sheet-own']);
  view.unmount();

  sheet(post('sheet-ended', { status: 'closed' }), { currentUser: member('reader-1') });
  await settle();
  assert.match(bar().textContent!, /这条信息已结束，不再接受新的联系/);
  assert.equal(within(bar()).queryAllByRole('button').length, 0);
});

test('邻里聊聊 shows its count from 3 comments; 发送 with nothing typed puts the cursor in the box', async () => {
  const calls = stubApi();
  const view = sheet(post('sheet-quiet', { comments: [comment('1'), comment('2')] }), { currentUser: member('reader-1') });
  await settle();
  assert.equal(screen.getByRole('heading', { level: 2, name: '邻里聊聊' }).textContent, '邻里聊聊');
  const send = screen.getByRole('button', { name: '发送评论' });
  assert.equal(send.hasAttribute('disabled'), false, 'no greyed-out button state');
  fireEvent.click(send);
  assert.equal(document.activeElement, screen.getByRole('textbox', { name: '评论内容' }));
  assert.equal(calls.some(path => path.includes('/comments')), false);
  view.unmount();

  sheet(post('sheet-busy', { comments: [comment('1'), comment('2'), comment('3')] }));
  await settle();
  assert.equal(screen.getByRole('heading', { level: 2, name: /邻里聊聊/ }).textContent, '邻里聊聊3');
});

test('同区同类 fills to three from the category when the area has fewer, without closed, blocked or repeated posts', async () => {
  const current = post('sheet-rel');
  const area = post('east-1');
  const calls = stubApi({
    area: [current, area],
    category: [current, area, post('closed-1', { status: 'closed' }), post('blocked-1', { authorId: 'blocked' }),
      post('south-1', { city: '南湾' }), post('sf-1', { city: '旧金山' }), post('north-1', { city: '北湾' })],
  });
  sheet(current, { blockedUserIds: ['blocked'] });
  const related = await screen.findByRole('region', { name: '其他租房信息' });
  await waitFor(() => assert.equal(related.querySelectorAll('.cm-card').length, 3));
  assert.deepEqual([...related.querySelectorAll('.cm-card h3')].map(title => title.textContent), ['Fremont 主卧出租 east-1', 'Fremont 主卧出租 south-1', 'Fremont 主卧出租 sf-1']);
  assert.ok([...related.querySelectorAll('.cm-card')].every(card => card.getAttribute('data-layout') === 'grid'));
  assert.ok(calls.some(path => /city=/.test(path)) && calls.some(path => path.startsWith('/posts?') && !/city=/.test(path)));
});

test('同区同类 names the area when all three are from it, and asks the category only when it must', async () => {
  const current = post('sheet-area');
  const calls = stubApi({ area: [post('east-1'), post('east-2'), current, post('east-3')], category: [post('south-1', { city: '南湾' })] });
  sheet(current);
  const related = await screen.findByRole('region', { name: '东湾的其他租房信息' });
  await waitFor(() => assert.equal(related.querySelectorAll('.cm-card').length, 3));
  assert.equal(calls.filter(path => path.startsWith('/posts?')).length, 1);
});

test('H32: 问问 BayBay on a post sends the post with the question (BayBay has no page record for a post)', async () => {
  stubApi();
  const asked: string[] = [];
  sheet(post('ask-1', { createdAt: Date.UTC(2026, 9, 1, 19) }), { onAskBayBay: question => { asked.push(question); } });
  await settle();
  fireEvent.click(screen.getByRole('button', { name: '帮我整理一段私信开场白' }));
  assert.equal(asked.length, 1);
  assert.match(asked[0], /^关于这条邻里信息「Fremont 主卧出租 ask-1」（租房，东湾，\$1500\/月，[^）]*发布）：帮我整理一段私信开场白$/);
});
