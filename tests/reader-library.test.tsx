import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
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
const { parseReaderLibrary, READER_LIBRARY_KEY, rememberGuide, clearReadingHistory } = await import('../src/lib/reader-library');
const { resetSaveStore, savesKey } = await import('../src/lib/saves');
const savedSlugs = () => JSON.parse(dom.window.localStorage.getItem(savesKey()) || '{"items":[]}').items.map((item: { id: string }) => item.id);
const guide = getGuideBySlug('bay-area-freebies-deals-2026-09')!;
const second = getGuideBySlug('bay-area-roommate-guide')!;
// Product counters must never leave a test.
beforeEach(t => { t.mock.method(globalThis, 'fetch', async () => Response.json({})); });
afterEach(() => { cleanup(); dom.window.localStorage.clear(); resetSaveStore(); dom.window.dispatchEvent(new dom.window.StorageEvent('storage', { key: null })); });

test('reader data tolerates broken storage and bounds/deduplicates safe slugs', () => {
  assert.deepEqual(parseReaderLibrary('{broken'), { saved: [], recent: [] });
  assert.deepEqual(parseReaderLibrary('null'), { saved: [], recent: [] });
  assert.deepEqual(parseReaderLibrary(JSON.stringify({ saved: ['one', 'one', '../other', 2], recent: 'invalid' })), { saved: ['one'], recent: [] });
  const parsed = parseReaderLibrary(JSON.stringify({ saved: Array.from({ length: 100 }, (_, i) => `guide-${i}`), recent: Array.from({ length: 100 }, (_, i) => `guide-${i}`) }));
  assert.equal(parsed.saved.length, 80);
  assert.equal(parsed.recent.length, 12);
});

test('the guide ♡ is the one save list: it survives remount, recent is unique, clearing recent retains saved articles', async () => {
  const view = render(<MemoryRouter><GuideReaderActions guide={guide} /><ReadingShelf /></MemoryRouter>);
  await act(async () => { fireEvent.click(view.getByRole('button', { name: '收藏' })); });
  assert.deepEqual(savedSlugs(), [guide.slug]);
  assert.match(view.getByRole('status').textContent!, /我的这周/);
  assert.equal(view.getByRole('button', { name: '已收藏' }).getAttribute('aria-pressed'), 'true');
  assert.ok(view.getByRole('link', { name: name => name.includes(guide.title) }));
  act(() => { rememberGuide(second.slug); rememberGuide(guide.slug); });
  assert.deepEqual(parseReaderLibrary(dom.window.localStorage.getItem(READER_LIBRARY_KEY)).recent, [guide.slug, second.slug]);
  cleanup();
  const again = render(<MemoryRouter><GuideReaderActions guide={guide} /><ReadingShelf /></MemoryRouter>);
  assert.equal(again.getByRole('button', { name: '已收藏' }).getAttribute('aria-pressed'), 'true');
  fireEvent.click(again.getByRole('button', { name: '最近读过' }));
  fireEvent.click(again.getByRole('button', { name: '清除阅读记录' }));
  assert.deepEqual(parseReaderLibrary(dom.window.localStorage.getItem(READER_LIBRARY_KEY)).recent, []);
  assert.deepEqual(savedSlugs(), [guide.slug], 'clearing the history keeps the saved guide');
});

test('empty saved shelf can be opened directly and a save in another tab updates mounted views', async () => {
  const view = render(<MemoryRouter initialEntries={['/guides?view=saved']}><ReadingShelf /></MemoryRouter>);
  assert.match(view.container.textContent!, /遇到喜欢的攻略/);
  act(() => { dom.window.localStorage.setItem(savesKey(), JSON.stringify({ v: 1, items: [{ kind: 'guide', id: second.slug, savedAt: 1 }] })); dom.window.dispatchEvent(new dom.window.StorageEvent('storage', { key: savesKey() })); });
  assert.ok(view.getByRole('link', { name: new RegExp(second.title) }));
  await act(async () => { fireEvent.click(view.getByRole('button', { name: `取消收藏：${second.title}` })); });
  assert.match(view.container.textContent!, /遇到喜欢的攻略/);
  assert.deepEqual(savedSlugs(), []);
});

test('saved guides from before the one save model appear once in the shelf', () => {
  dom.window.localStorage.setItem(READER_LIBRARY_KEY, JSON.stringify({ saved: [second.slug], recent: [] }));
  const view = render(<MemoryRouter initialEntries={['/guides?view=saved']}><ReadingShelf /></MemoryRouter>);
  assert.equal(view.getAllByRole('link', { name: new RegExp(second.title) }).length, 1);
  assert.deepEqual(savedSlugs(), [second.slug]);
});

test('article AI carries its title and sharing copies branded text with a direct article link', async () => {
  let copied = '';
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (text: string) => { copied = text; } } });
  const questions: string[] = [];
  const view = render(<MemoryRouter><GuideReaderActions guide={guide} onAsk={question => questions.push(question)} /></MemoryRouter>);
  fireEvent.click(view.getByRole('button', { name: '让 BayBay 帮我整理' }));
  assert.ok(questions[0].includes(guide.title));
  await act(async () => { fireEvent.click(view.getByRole('button', { name: `分享：${guide.title}`, exact: true })); });
  assert.ok(copied.includes(`https://www.baylink.us/guides/${guide.slug}?from=share`));
  assert.ok(copied.includes(guide.title));
  assert.match(copied, /BAYLINK/);
  assert.match(view.getByRole('status').textContent!, /分享文案已复制/);
});

test('failed storage stays usable in this session and explains the persistence limit', async () => {
  const view = render(<MemoryRouter><GuideReaderActions guide={guide} /></MemoryRouter>);
  const original = dom.window.Storage.prototype.setItem;
  dom.window.Storage.prototype.setItem = () => { throw new Error('Quota exceeded'); };
  try {
    await act(async () => { fireEvent.click(view.getByRole('button', { name: '收藏' })); });
    assert.equal(view.getByRole('button', { name: '已收藏' }).getAttribute('aria-pressed'), 'true');
    assert.match(view.getByRole('status').textContent!, /刷新后可能丢失/);
  } finally { dom.window.Storage.prototype.setItem = original; }
});

test('SSR never serializes the browser reading library', () => {
  dom.window.localStorage.setItem(savesKey(), JSON.stringify({ v: 1, items: [{ kind: 'guide', id: guide.slug, savedAt: 1 }] }));
  rememberGuide(guide.slug); clearReadingHistory();
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
