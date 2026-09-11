import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { JSDOM } from 'jsdom';
import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://www.baylink.us/guides' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { render, fireEvent, cleanup, act } = await import('@testing-library/react');
const { MemoryRouter } = await import('react-router-dom');
const { StaticRouter } = await import('react-router');
const { GuideReaderActions, ReadingShelf } = await import('../src/components/ReaderLibrary');
const { getGuideBySlug } = await import('../src/data/guides');
const { discoverRelatedGuides } = await import('../src/lib/guide-discovery');
const { parseReaderLibrary, READER_LIBRARY_KEY, rememberGuide, toggleSavedGuide, clearReadingHistory } = await import('../src/lib/reader-library');
const guide = getGuideBySlug('bay-area-freebies-deals-2026-09')!;
const second = getGuideBySlug('bay-area-roommate-guide')!;
afterEach(() => { cleanup(); dom.window.localStorage.clear(); dom.window.dispatchEvent(new dom.window.StorageEvent('storage', { key: null })); });

test('reader data tolerates broken storage and bounds/deduplicates safe slugs', () => {
  assert.deepEqual(parseReaderLibrary('{broken'), { saved: [], recent: [] });
  assert.deepEqual(parseReaderLibrary('null'), { saved: [], recent: [] });
  assert.deepEqual(parseReaderLibrary(JSON.stringify({ saved: ['one', 'one', '../other', 2], recent: 'invalid' })), { saved: ['one'], recent: [] });
  const parsed = parseReaderLibrary(JSON.stringify({ saved: Array.from({ length: 100 }, (_, i) => `guide-${i}`), recent: Array.from({ length: 100 }, (_, i) => `guide-${i}`) }));
  assert.equal(parsed.saved.length, 80);
  assert.equal(parsed.recent.length, 12);
});

test('save survives remount, recent is unique, clearing recent retains saved articles', () => {
  const view = render(<MemoryRouter><GuideReaderActions guide={guide} /><ReadingShelf /></MemoryRouter>);
  fireEvent.click(view.getByRole('button', { name: '收藏 · 稍后读' }));
  assert.equal(view.getByRole('button', { name: '已收藏' }).getAttribute('aria-pressed'), 'true');
  assert.ok(view.getByRole('link', { name: name => name.includes(guide.title) }));
  act(() => { rememberGuide(second.slug); rememberGuide(guide.slug); });
  assert.deepEqual(parseReaderLibrary(dom.window.localStorage.getItem(READER_LIBRARY_KEY)).recent, [guide.slug, second.slug]);
  cleanup();
  const again = render(<MemoryRouter><GuideReaderActions guide={guide} /><ReadingShelf /></MemoryRouter>);
  assert.equal(again.getByRole('button', { name: '已收藏' }).getAttribute('aria-pressed'), 'true');
  fireEvent.click(again.getByRole('button', { name: '最近读过' }));
  fireEvent.click(again.getByRole('button', { name: '清除阅读记录' }));
  const stored = parseReaderLibrary(dom.window.localStorage.getItem(READER_LIBRARY_KEY));
  assert.deepEqual(stored.saved, [guide.slug]);
  assert.deepEqual(stored.recent, []);
});

test('empty saved shelf can be opened directly and storage events update mounted views', () => {
  const view = render(<MemoryRouter initialEntries={['/guides?view=saved']}><ReadingShelf /></MemoryRouter>);
  assert.match(view.container.textContent!, /遇到喜欢的攻略/);
  act(() => { dom.window.localStorage.setItem(READER_LIBRARY_KEY, JSON.stringify({ saved: [second.slug], recent: [] })); dom.window.dispatchEvent(new dom.window.StorageEvent('storage', { key: READER_LIBRARY_KEY })); });
  assert.ok(view.getByRole('link', { name: new RegExp(second.title) }));
  fireEvent.click(view.getByRole('button', { name: `取消收藏：${second.title}` }));
  assert.match(view.container.textContent!, /遇到喜欢的攻略/);
});

test('article AI action carries its title and sharing copies canonical URL', async () => {
  let copied = '';
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (text: string) => { copied = text; } } });
  const questions: string[] = [];
  const view = render(<MemoryRouter><GuideReaderActions guide={guide} onAsk={question => questions.push(question)} /></MemoryRouter>);
  fireEvent.click(view.getByRole('button', { name: '让 BayBay 帮我整理' }));
  assert.ok(questions[0].includes(guide.title));
  await act(async () => { fireEvent.click(view.getByRole('button', { name: '分享给朋友' })); });
  assert.equal(copied, `https://www.baylink.us/guides/${guide.slug}`);
  assert.match(view.getByRole('status').textContent!, /链接已复制/);
});

test('failed storage stays usable in this session and explains the persistence limit', () => {
  const original = dom.window.Storage.prototype.setItem;
  dom.window.Storage.prototype.setItem = () => { throw new Error('Quota exceeded'); };
  try {
    const view = render(<MemoryRouter><GuideReaderActions guide={guide} /></MemoryRouter>);
    fireEvent.click(view.getByRole('button', { name: '收藏 · 稍后读' }));
    assert.equal(view.getByRole('button', { name: '已收藏' }).getAttribute('aria-pressed'), 'true');
    assert.match(view.getByRole('status').textContent!, /刷新后可能丢失/);
  } finally { dom.window.Storage.prototype.setItem = original; }
});

test('SSR never serializes the browser reading library', () => {
  toggleSavedGuide(guide.slug); rememberGuide(guide.slug); clearReadingHistory();
  const html = renderToStaticMarkup(createElement(StaticRouter, { location: '/guides' }, createElement(ReadingShelf)));
  assert.equal(html, '');
});

test('reading suggestions fill three slots, preserve curated topics, and exclude expired editions', () => {
  const picks = discoverRelatedGuides(guide, 3, '2026-09-09');
  assert.equal(picks.length, 3);
  assert.equal(new Set(picks.map(item => item.slug)).size, 3);
  assert.ok(picks.every(item => item.slug !== guide.slug));
  const translation = discoverRelatedGuides(getGuideBySlug('bay-area-translation-service-guide')!);
  assert.ok(translation.slice(0, 2).every(item => ['bay-area-cleaning-quote-checklist', 'bay-area-repair-request-guide'].includes(item.slug)));
  const later = discoverRelatedGuides(second, 80, '2026-10-01');
  assert.equal(later.some(item => item.editionMonth === '2026-09'), false);
});
