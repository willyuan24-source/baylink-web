import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';
import type { PostData, UserData } from '../src/lib/types';

const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', {
  url: 'https://www.baylink.us/posts/translation-detail?lang=en', pretendToBeVisual: true,
});
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage,
  HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
dom.window.HTMLElement.prototype.getClientRects = function () {
  return (this.isConnected && !this.hidden ? [{ width: 1, height: 1 }] : []) as unknown as DOMRectList;
};
const { render, fireEvent, cleanup, act, waitFor } = await import('@testing-library/react');
const { MemoryRouter } = await import('react-router-dom');
const { api } = await import('../src/lib/api');
const { setLocale, translateText } = await import('../src/i18n/locale');
await import('../src/i18n/metadata');
const { PostCard } = await import('../src/features/posts/PostCard');
const { PostDetailModal } = await import('../src/features/posts/PostDetailModal');

const originalRequest = api.request;
const originalObserver = Object.getOwnPropertyDescriptor(globalThis, 'IntersectionObserver');
const source = {
  title: '周日帮邻居修复蓝色书架',
  description: '带上工具帮忙修理松动的书架。请先确认木板尺寸，再安排上门。',
  budget: '材料费二十美元，人工面议',
  timeInfo: '本周日下午两点后',
};
const translation = {
  title: 'Help a neighbor repair a blue bookshelf on Sunday',
  description: 'Bring tools to repair a loose bookshelf. Please confirm the board dimensions before arranging a visit.',
  budget: 'Twenty US dollars for materials; labor negotiable',
  timeInfo: 'After two pm this Sunday',
};
const makePost = (id: string): PostData => ({
  id, authorId: 'translation-author', author: { id: 'translation-author', nickname: '书架邻居甲' },
  ...source, type: 'provider', city: 'San Mateo', category: '维修', contactInfo: null,
  imageUrls: [], likesCount: 0, hasLiked: false, commentsCount: 0, comments: [],
  createdAt: Date.now(), status: 'active',
});
const response = () => ({ ok: true, target: 'en', source: { ...source }, translation: { ...translation } });
const detailProps = {
  currentUser: null, onClose: () => {}, onLoginNeeded: () => {}, onOpenChat: () => {},
  onDeleted: () => {}, onImageClick: () => {}, onShare: () => {}, showToast: () => {}, onAskBayBay: () => {},
};

afterEach(async () => {
  cleanup();
  api.request = originalRequest;
  if (originalObserver) Object.defineProperty(globalThis, 'IntersectionObserver', originalObserver);
  else Reflect.deleteProperty(globalThis, 'IntersectionObserver');
  await setLocale('zh-Hans', false);
  localStorage.clear();
});

test('English cards translate visible post text while editing and sharing keep the author’s original post', async () => {
  const post = makePost('translation-card');
  const savedOriginal = structuredClone(post);
  const actions: PostData[] = [];
  let requests = 0;
  let cardOpens = 0;
  api.request = async (endpoint, options) => {
    assert.equal(endpoint, `/posts/${post.id}/translation`);
    assert.equal(options?.method, 'POST');
    requests++;
    return response();
  };
  await setLocale('en', false);
  const view = render(<MemoryRouter><PostCard post={post} currentUser={{ id: post.authorId, role: 'user' } as UserData}
    onEdit={value => actions.push(value)} onShare={value => actions.push(value)} onClick={() => { cardOpens++; }} /></MemoryRouter>);

  await waitFor(() => assert.equal(view.getByRole('heading', { level: 3 }).textContent, translation.title));
  assert.equal(requests, 1);
  assert.equal(view.container.querySelector('.post-card__description')!.textContent, translation.description);
  assert.equal(view.container.querySelector('.post-card__price')!.textContent, translation.budget);
  assert.equal(view.container.querySelector('.post-card__time')!.textContent, translation.timeInfo);
  assert.equal(view.container.querySelector('.post-card__author-name')!.textContent, post.author.nickname);
  assert.ok(view.getByText('Automatically translated'));

  fireEvent.click(view.getByRole('button', { name: translateText('分享'), exact: true }));
  fireEvent.click(view.getByRole('button', { name: translateText('帖子操作'), exact: true }));
  fireEvent.click(view.getByRole('button', { name: translateText('编辑'), exact: true }));
  assert.equal(actions.length, 2);
  assert.ok(actions.every(value => value === post));
  assert.deepEqual(post, savedOriginal);

  fireEvent.click(view.getByRole('button', { name: 'Show original', exact: true }));
  assert.equal(view.getByRole('heading', { level: 3 }).textContent, source.title);
  assert.equal(view.container.querySelector('.post-card__description')!.textContent, source.description);
  fireEvent.click(view.getByRole('button', { name: 'Show translation', exact: true }));
  assert.equal(view.getByRole('heading', { level: 3 }).textContent, translation.title);
  assert.equal(requests, 1);
  assert.equal(cardOpens, 0, 'translation controls must not open the card');
});

test('offscreen cards wait until approaching the viewport before requesting a translation', async () => {
  const post = makePost('translation-visible-card');
  let reveal!: () => void;
  Object.defineProperty(globalThis, 'IntersectionObserver', { configurable: true, value: class {
    constructor(callback: IntersectionObserverCallback) {
      reveal = () => callback([{ isIntersecting: true } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
    }
    observe() {}
    disconnect() {}
  } });
  let requests = 0;
  api.request = async () => { requests++; return response(); };
  await setLocale('en', false);
  const view = render(<MemoryRouter><PostCard post={post} /></MemoryRouter>);
  assert.equal(view.getByRole('heading', { level: 3 }).textContent, source.title);
  assert.equal(requests, 0);
  await act(async () => { reveal(); });
  await waitFor(() => assert.equal(view.getByRole('heading', { level: 3 }).textContent, translation.title));
  assert.equal(requests, 1);
});

test('Simplified and Traditional readers see untouched author content without translation requests', async () => {
  const post = makePost('translation-chinese-card');
  let requests = 0;
  api.request = async () => { requests++; throw new Error('Chinese reading must not request an English translation'); };
  await setLocale('zh-Hans', false);
  const view = render(<MemoryRouter><PostCard post={post} /></MemoryRouter>);
  assert.equal(view.getByRole('heading', { level: 3 }).textContent, source.title);
  await act(async () => { await setLocale('zh-Hant', false); });
  assert.equal(view.getByRole('heading', { level: 3 }).textContent, source.title);
  assert.equal(view.container.querySelector('.post-card__description')!.textContent, source.description);
  assert.equal(view.container.querySelector('.post-card__author-name')!.textContent, post.author.nickname);
  assert.equal(requests, 0);
  assert.equal(view.queryByRole('button', { name: 'Show original' }), null);
});

test('post details translate all reading fields and metadata together and can return to the original', async () => {
  const post = makePost('translation-detail');
  let complete!: (value: ReturnType<typeof response>) => void;
  let requests = 0;
  api.request = async (endpoint, options) => {
    assert.equal(endpoint, `/posts/${post.id}/translation`);
    assert.equal(options?.method, 'POST');
    requests++;
    return new Promise<ReturnType<typeof response>>(resolve => { complete = resolve; });
  };
  await setLocale('en', false);
  const view = render(<MemoryRouter><PostDetailModal {...detailProps} post={post} /></MemoryRouter>);
  assert.ok(view.getByText('Translating…'));
  assert.equal(view.getByRole('heading', { level: 1 }).textContent, source.title);
  await act(async () => { complete(response()); });

  const checkContent = (expected: typeof source) => {
    assert.equal(view.getByRole('heading', { level: 1 }).textContent, expected.title);
    assert.equal(document.querySelector('.post-detail__description')!.textContent, expected.description);
    assert.equal(document.querySelector('.post-detail__budget strong')!.textContent, expected.budget);
    assert.ok(view.getByText(expected.timeInfo, { exact: true }));
    assert.equal(document.title, `${expected.title}｜BAYLINK`);
    assert.equal(document.querySelector('meta[name="description"]')?.getAttribute('content'), expected.description);
    assert.equal(document.querySelector('meta[property="og:title"]')?.getAttribute('content'), `${expected.title}｜BAYLINK`);
    assert.equal(document.querySelector('meta[name="twitter:title"]')?.getAttribute('content'), `${expected.title}｜BAYLINK`);
  };
  await waitFor(() => checkContent(translation));
  assert.ok(view.getByText(post.author.nickname, { exact: true }));
  fireEvent.click(view.getByRole('button', { name: 'Show original', exact: true }));
  checkContent(source);
  fireEvent.click(view.getByRole('button', { name: 'Show translation', exact: true }));
  checkContent(translation);
  await act(async () => { await setLocale('zh-Hans', false); });
  checkContent(source);
  await act(async () => { await setLocale('en', false); });
  await waitFor(() => checkContent(translation));
  assert.equal(requests, 1);
  assert.equal(post.title, source.title);
  assert.equal(post.description, source.description);
});

test('a translation outage leaves the original readable and an explicit retry can recover', async () => {
  const post = makePost('translation-retry');
  let requests = 0;
  api.request = async (endpoint) => {
    assert.equal(endpoint, `/posts/${post.id}/translation`);
    requests++;
    if (requests === 1) throw { status: 503, error: 'Temporarily unavailable' };
    return response();
  };
  await setLocale('en', false);
  const view = render(<MemoryRouter><PostDetailModal {...detailProps} post={post} /></MemoryRouter>);
  await waitFor(() => assert.ok(view.getByText('Translation unavailable · Showing original')));
  assert.equal(view.getByRole('heading', { level: 1 }).textContent, source.title);
  assert.equal(document.querySelector('.post-detail__description')!.textContent, source.description);
  assert.equal(document.title, `${source.title}｜BAYLINK`);
  assert.equal(requests, 1);
  await act(async () => { fireEvent.click(view.getByRole('button', { name: 'Retry translation', exact: true })); });
  await waitFor(() => assert.equal(view.getByRole('heading', { level: 1 }).textContent, translation.title));
  assert.equal(document.title, `${translation.title}｜BAYLINK`);
  assert.equal(requests, 2);
});
