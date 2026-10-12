import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test, { afterEach } from 'node:test';
import { JSDOM } from 'jsdom';
import React, { Suspense } from 'react';

/**
 * WEB-DATA-SPLIT, the browser's path through the guide routes (Node reads guide records synchronously; BAYLINK_LAZY_GUIDES=1
 * makes it load them as the browser does): the boot loader waits for the record, the article suspends until it is in, a
 * failed record or search-corpus download shows ErrorState, and its retry works.
 */
process.env.BAYLINK_LAZY_GUIDES = '1';
// The search corpus chunk fails while `corpusOffline` is set (an offline reader, a deploy that swapped files).
let corpusOffline = false;
registerHooks({
  resolve(specifier, context, next) {
    if (corpusOffline && specifier.includes('guide-search-corpus')) throw new TypeError('Failed to fetch dynamically imported module: guide-search-corpus');
    return next(specifier, context);
  },
});
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost', pretendToBeVisual: true });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
Object.assign(globalThis, { getComputedStyle: dom.window.getComputedStyle.bind(dom.window), requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window), cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window) });
const { render, fireEvent, cleanup } = await import('@testing-library/react');
const { MemoryRouter, Routes, Route, Outlet } = await import('react-router-dom');
const { guideLoaders } = await import('../src/data/generated/guide-loaders');
const { peekGuide } = await import('../src/features/guides/guide-store');
const { currentPageLoader, pageLoaders } = await import('../src/route-loaders');
const { default: GuideDetailPage } = await import('../src/pages/GuideDetailPage');
const { GuidesHome } = await import('../src/components/GuidesHome');
afterEach(() => cleanup());

const offline = () => Promise.reject(new TypeError('Failed to fetch dynamically imported module'));
const settle = (ms = 30) => new Promise(resolve => setTimeout(resolve, ms));

test('the boot loader for /guides/:slug resolves only once the guide’s record is in', async () => {
  const slug = 'bay-area-airport-arrival-guide';
  assert.equal(peekGuide(slug), undefined, 'the browser’s path: no record before it loads');
  const original = guideLoaders[slug];
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  guideLoaders[slug] = () => held.then(original);
  try {
    let settled = false;
    const boot = currentPageLoader(`/guides/${slug}`)().then(module => { settled = true; return module; });
    await pageLoaders.guide();
    await settle(50);
    assert.equal(settled, false, 'the page chunk is in, the record is not: the prerender stays');
    release();
    const module = await boot;
    assert.equal(module.default, GuideDetailPage);
    assert.equal(peekGuide(slug)?.guide.slug, slug, 'the page renders in one pass');
    // other routes do not wait for a record
    assert.equal(currentPageLoader('/guides'), pageLoaders.guides);
  } finally { guideLoaders[slug] = original; }
});

test('an article suspends until its record is in; a failed download shows ErrorState and its retry loads the article', async () => {
  const slug = 'bay-area-roommate-guide';
  const original = guideLoaders[slug];
  let failures = 2; // the first download and chunkLoader's own retry
  guideLoaders[slug] = () => failures-- > 0 ? offline() : original();
  try {
    const view = render(<MemoryRouter initialEntries={[`/guides/${slug}`]}><Suspense fallback={<p>loading article</p>}><Routes>
      <Route element={<Outlet context={{ user: null, setShowLogin: () => {}, openCreate: () => {}, openBayBay: () => {} }} />}>
        <Route path="/guides/:slug" element={<GuideDetailPage />} />
      </Route>
    </Routes></Suspense></MemoryRouter>);
    assert.ok(view.getByText('loading article'), 'suspended while the record loads');
    const alert = await view.findByRole('alert', {}, { timeout: 10000 });
    assert.match(alert.textContent ?? '', /这篇指南暂时没能加载/);
    assert.equal(failures, 0);
    fireEvent.click(view.getByRole('button', { name: '重试' }));
    const title = await view.findByRole('heading', { level: 1 }, { timeout: 10000 });
    assert.match(title.textContent ?? '', /室友|合租/);
    assert.equal(view.queryByRole('alert'), null);
  } finally { guideLoaders[slug] = original; }
});

test('/guides search: a corpus that does not load shows ErrorState in place of results, and its retry searches', async () => {
  corpusOffline = true;
  const view = render(<MemoryRouter initialEntries={['/guides?q=公证']}><GuidesHome onOpenGuide={() => {}} /></MemoryRouter>);
  const alert = await view.findByRole('alert', {}, { timeout: 10000 });
  assert.match(alert.textContent ?? '', /搜索暂时没能加载/);
  corpusOffline = false;
  fireEvent.click(view.getByRole('button', { name: '重试' }));
  const results = await view.findByRole('list', { name: '搜索结果' }, { timeout: 10000 });
  assert.ok(results.textContent?.includes('翻译'), 'the matching guide appears once the corpus is in');
  assert.equal(view.queryByRole('alert'), null);
});
