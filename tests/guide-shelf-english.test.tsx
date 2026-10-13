import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import React from 'react';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://www.baylink.us/en/guides?view=saved' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { render, fireEvent, cleanup } = await import('@testing-library/react');
const { MemoryRouter } = await import('react-router-dom');
const { ReadingShelfView } = await import('../src/components/ReaderLibrary');
const { guides } = await import('../src/data/guides');
const { isLocaleReadyForFeature, normalizeText, setLocale } = await import('../src/i18n/locale');

/**
 * /en/guides loads the cards' English pack ('guide-list') and not the catalog-wide 'guide-index' (WEB-DATA-SPLIT). The saved
 * shelf (?view=saved) renders over that page with the same packs, so everything it shows for any guide must be in them.
 */
const pack = (name: string) => JSON.parse(readFileSync(new URL(`../src/data/generated/english-scopes/${name}.json`, import.meta.url), 'utf8')) as Record<string, string>;
const full = pack('../english') as Record<string, string>;
const han = /[㐀-鿿]/u;

test('the /guides packs carry the reviewed English of every guide title and category label the saved shelf shows', () => {
  const scoped = { ...pack('ui'), ...pack('guide-list') };
  const missing: string[] = [];
  for (const guide of guides) {
    for (const text of [guide.title, guide.categoryLabel]) {
      const key = normalizeText(text);
      if (full[key] && scoped[key] !== full[key]) missing.push(`${guide.slug}: ${text}`);
    }
  }
  assert.deepEqual(missing, []);
});

test('/en/guides?view=saved shows every saved guide in English with only the page’s own packs loaded', async () => {
  assert.equal(await setLocale('en', false, '/guides'), true);
  // the page's packs only: the guides' full text ('guide-search', the search feature) is not loaded
  assert.equal(isLocaleReadyForFeature('en', 'guide-search'), false);
  // the expanded shelf lists 80 guides: every guide, in two shelves
  const items: Element[] = [];
  for (let at = 0; at < guides.length; at += 80) {
    const saved = { ids: guides.slice(at, at + 80).map(guide => guide.slug), known: true, busy: () => false, remove: () => {} };
    const view = render(<MemoryRouter initialEntries={['/guides?view=saved']}><ReadingShelfView saved={saved} /></MemoryRouter>);
    fireEvent.click(view.container.querySelector('.reader-more')!);
    items.push(...[...view.container.querySelectorAll('.reader-shelf-item')].map(item => item.cloneNode(true) as Element));
    cleanup();
  }
  assert.equal(items.length, guides.length);
  const chinese = items.map(item => item.textContent ?? '').filter(text => han.test(text));
  assert.deepEqual(chinese, [], 'no saved guide shows Chinese on the English shelf');
  // e.g. the senior guide: "Senior services · 5 min" (the label was "长辈服务 · 5 min" before the label joined the pack)
  const senior = guides.find(guide => guide.slug === 'bay-area-chinese-senior-services-referral-guide')!;
  assert.ok(items.some(item => item.textContent?.includes(full[normalizeText(senior.categoryLabel)])), senior.categoryLabel);
});
