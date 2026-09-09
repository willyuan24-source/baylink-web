import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';
import { guides, getGuideBySlug, getRelatedGuides } from '../src/data/guides';
import { searchGuides } from '../src/lib/guide-search';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost', pretendToBeVisual: true });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
Object.assign(globalThis, { getComputedStyle: dom.window.getComputedStyle.bind(dom.window), requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window), cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window) });
const { render, fireEvent, cleanup } = await import('@testing-library/react');
const { MemoryRouter, Routes, Route, Outlet, useLocation } = await import('react-router-dom');
const { default: GuidesPage } = await import('../src/pages/GuidesPage');
const { default: GuideDetailPage } = await import('../src/pages/GuideDetailPage');
afterEach(() => cleanup());

test('full-text search finds practical body and template content with readable matching passages', () => {
  const print = searchGuides(guides, { query: '打印' });
  assert.equal(print[0].guide.slug, 'bay-area-library-starter-guide');
  assert.match(print[0].snippet!, /打印/);
  assert.ok(print[0].section);
  assert.ok(searchGuides(guides, { query: '公证' }).some(({ guide }) => guide.slug === 'bay-area-translation-service-guide'));
  assert.ok(searchGuides(guides, { query: '儿童座椅' }).some(({ guide }) => guide.slug === 'north-bay-car-free-day-guide'));
  assert.ok(searchGuides(guides, { query: 'Gabrielson' }).some(({ guide }) => guide.slug === 'north-bay-car-free-day-guide'));
});

test('aliases, multi-term queries and category restrictions cooperate without broadening unrelated results', () => {
  const slugs = (query: string) => searchGuides(guides, { query }).map(({ guide }) => guide.slug);
  assert.deepEqual(slugs('租屋'), slugs('租房'));
  assert.deepEqual(slugs('列印'), slugs('打印'));
  assert.deepEqual(slugs('駕照'), slugs('驾驶证'));
  assert.deepEqual(slugs('公证 交付'), ['bay-area-translation-service-guide']);
  assert.deepEqual(searchGuides(guides, { query: '公证', category: 'rent' }), []);
  assert.equal(searchGuides(guides).length, guides.length);
});

test('related reading prioritizes existing editorial topics over incidental category overlap', () => {
  const eastBay = getGuideBySlug('east-bay-first-weekend-guide')!;
  const related = getRelatedGuides(eastBay);
  assert.ok(related.slice(0, 2).some((guide) => guide.slug === 'north-bay-car-free-day-guide'));
  assert.equal(related.some((guide) => guide.slug === eastBay.slug), false);
  assert.equal(new Set(related.map((guide) => guide.slug)).size, related.length);
  const translation = getRelatedGuides(getGuideBySlug('bay-area-translation-service-guide')!);
  assert.ok(translation.slice(0, 2).every((guide) => ['bay-area-cleaning-quote-checklist', 'bay-area-repair-request-guide'].includes(guide.slug)));
});

function GuideSearchHarness() {
  const location = useLocation();
  return <><output data-testid="location">{location.pathname}{location.search}</output><Routes>
    <Route element={<Outlet context={{ user: null, setShowLogin: () => {}, openCreate: () => {} }} />}>
      <Route path="/guides" element={<GuidesPage />} />
      <Route path="/guides/:slug" element={<GuideDetailPage />} />
    </Route>
  </Routes></>;
}

test('a shared search URL restores query/category, shows the body match and survives article navigation', () => {
  const view = render(<MemoryRouter initialEntries={['/guides?q=公证&category=service']}><GuideSearchHarness /></MemoryRouter>);
  assert.equal((view.getByRole('searchbox', { name: '搜索生活指南' }) as HTMLInputElement).value, '公证');
  assert.equal(view.getByRole('button', { name: '本地服务' }).getAttribute('aria-pressed'), 'true');
  assert.match(view.getByText(/联系学校、法院或其他接收机构/).textContent || '', /公证/);
  const result = view.getByRole('link', { name: /在湾区找翻译：先确认用途/ });
  fireEvent.click(result);
  assert.match(view.getByTestId('location').textContent || '', /\/guides\/bay-area-translation-service-guide/);
  fireEvent.click(view.getByRole('link', { name: '返回湾区指南', exact: true }));
  assert.equal((view.getByRole('searchbox') as HTMLInputElement).value, '公证');
  assert.equal(view.getByRole('button', { name: '本地服务' }).getAttribute('aria-pressed'), 'true');
  fireEvent.change(view.getByRole('searchbox'), { target: { value: '打印' } });
  fireEvent.click(view.getByRole('button', { name: '新手' }));
  const url = new URL(view.getByTestId('location').textContent || '', 'http://localhost');
  assert.equal(url.searchParams.get('q'), '打印');
  assert.equal(url.searchParams.get('category'), 'newcomer');
  assert.ok(view.getByRole('link', { name: /湾区图书馆不只借书/ }));
});
