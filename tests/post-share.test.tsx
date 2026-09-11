import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://www.baylink.us/posts/fixture?lang=en', pretendToBeVisual: true });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { render, fireEvent, cleanup, act } = await import('@testing-library/react');
const { setLocale } = await import('../src/i18n/locale');
const { buildPostShareText, buildPostShareUrl, copyPostShareUrl, sharePost } = await import('../src/utils/postShare');
const { PostShareSheet } = await import('../src/components/PostShareSheet');
const post = { id: 'fixture', title: '图书馆', city: '旧金山', category: '租房', budget: '$2,500', timeInfo: '周末' };

afterEach(async () => { cleanup(); await setLocale('zh-Hans', false); delete (navigator as unknown as Record<string, unknown>).share; delete (document as unknown as Record<string, unknown>).execCommand; });

test('post sharing preserves the selected language and only localizes labels, never author content', async () => {
  await setLocale('en', false);
  const url = new URL(buildPostShareUrl(post));
  assert.equal(url.searchParams.get('lang'), 'en');
  assert.equal(url.pathname, '/posts/fixture');
  const text = buildPostShareText(post);
  assert.match(text, /I found a Bay Area housing post on BAYLINK:/);
  assert.match(text, /【图书馆】/);
  assert.match(text, /旧金山/);
  assert.match(text, /周末/);
  assert.match(text, /Budget \/ price/);
  const view = render(<PostShareSheet post={post} onClose={() => {}} showToast={() => {}} />);
  assert.equal(view.getByRole('heading', { level: 4 }).textContent, post.title);
  assert.match(view.baseElement.textContent!, /旧金山/);
  await act(async () => { await setLocale('zh-Hant', false); });
  assert.equal(view.getByRole('heading', { level: 4 }).textContent, post.title);
  assert.equal(new URL(buildPostShareUrl(post)).searchParams.get('lang'), 'zh-Hant');
});

test('clipboard fallback cleans up its textarea even when legacy copying throws', async () => {
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('Denied'); } } });
  Object.defineProperty(document, 'execCommand', { configurable: true, value: () => { throw new Error('Unsupported'); } });
  assert.equal(await copyPostShareUrl(post), false);
  assert.equal(document.querySelector('textarea'), null);
});

test('a browser that denies all copying leaves a manual share link available', async () => {
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('Denied'); } } });
  Object.defineProperty(document, 'execCommand', { configurable: true, value: () => false });
  const view = render(<PostShareSheet post={post} onClose={() => {}} showToast={() => {}} />);
  await act(async () => { fireEvent.click(view.getByRole('button', { name: '复制链接', exact: true })); });
  const fallback = view.getByRole('textbox', { name: '手动复制链接' }) as HTMLInputElement;
  assert.equal(fallback.value, buildPostShareUrl(post));
  assert.equal(fallback.readOnly, true);
});

test('cancelling native sharing does not copy content behind the user', async () => {
  let copies = 0;
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { copies++; } } });
  Object.defineProperty(navigator, 'share', { configurable: true, value: async () => { throw new DOMException('Cancelled', 'AbortError'); } });
  assert.deepEqual(await sharePost(post), { method: 'cancelled' });
  assert.equal(copies, 0);
});
