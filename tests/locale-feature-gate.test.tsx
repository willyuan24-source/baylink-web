import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import { JSDOM } from 'jsdom';
import React, { Suspense } from 'react';
import * as OpenCC from 'opencc-js';

/**
 * WEB-DATA-SPLIT: /guides, /events and /calendar load only the English packs they display; the search dialog and BayBay,
 * which show content from every route, wait for their own packs (LocaleFeatureGate), and BayBay's panel in 繁體 starts
 * opencc's full phrase table for its answers (text the site does not ship). BAYLINK_SITE_TRADITIONAL=1: the browser's 繁體.
 */
process.env.BAYLINK_SITE_TRADITIONAL = '1';
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://www.baylink.us/en/guides', pretendToBeVisual: true });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { render, cleanup } = await import('@testing-library/react');
const { englishScopeLoaders } = await import('../src/data/generated/english-scope-loaders');
// Record every English pack the app downloads (the language module reads this registry when it first loads a pack).
const requested: string[] = [];
const loaders = englishScopeLoaders as Record<string, () => Promise<unknown>>;
for (const [scope, load] of Object.entries(loaders)) loaders[scope] = () => { requested.push(scope); return load(); };
const take = () => requested.splice(0).sort();
const { QuickExplore } = await import('../src/components/QuickExplore');
const { LocaleFeatureGate } = await import('../src/components/LocaleContentGate');
const { setLocale, taiwanConverter, translateText } = await import('../src/i18n/locale');
const { SITE_LOCALE, Trie } = await import('../src/i18n/traditional');
const { fullPhrases } = await import('../src/i18n/traditional-full');
afterEach(() => cleanup());

const noop = () => {};
const search = () => <Suspense fallback={<p>loading</p>}><QuickExplore initialQuery="Medicare" onClose={noop} onSearch={noop} onNavigate={noop} onAsk={noop} /></Suspense>;
const baybay = () => <Suspense fallback={<p>loading</p>}><LocaleFeatureGate feature="baybay"><p>BayBay ready</p></LocaleFeatureGate></Suspense>;

test('over /en/guides, BayBay and the search dialog each download their own packs, nothing more', async () => {
  assert.equal(await setLocale('en', false, '/guides'), true);
  assert.deepEqual(take(), ['guide-list', 'ui'], '/guides: the cards’ pack');
  const panel = render(baybay());
  await panel.findByText('BayBay ready', {}, { timeout: 20000 });
  assert.deepEqual(take(), ['discovery', 'guide-index'], 'BayBay’s cards show any event, offer, opening or guide');
  cleanup();
  const dialog = render(search());
  const box = await dialog.findByRole('combobox', {}, { timeout: 20000 });
  assert.equal(box.getAttribute('aria-label'), 'Quick search');
  assert.deepEqual(take(), ['explore', 'guide-search'], 'the search dialog adds the guides’ full text and the places');
  assert.ok(dialog.getAllByRole('option').length > 0);
  await setLocale('zh-Hans', false);
});

test('in 繁體, BayBay’s panel starts opencc’s full phrase table for its answers; the search dialog does not', async () => {
  const full = taiwanConverter(OpenCC);
  const pruned = taiwanConverter({ Trie, Locale: SITE_LOCALE } as unknown as Parameters<typeof taiwanConverter>[0]);
  const dynamic = fullPhrases.split('|').map(entry => entry.slice(0, entry.indexOf(' '))).find(key => pruned(key, true) !== full(key, true))!;
  assert.equal(await setLocale('zh-Hant', false, '/guides'), true);
  const before = translateText(dynamic);
  assert.notEqual(before, full(dynamic, true));
  const dialog = render(search());
  await dialog.findByRole('combobox', {}, { timeout: 20000 });
  await new Promise(resolve => setTimeout(resolve, 300));
  assert.equal(translateText(dynamic), before, 'search shows the site’s own text: no download');
  cleanup();
  const panel = render(baybay());
  await panel.findByText('BayBay ready', {}, { timeout: 20000 });
  for (let at = 0; at < 2000 && translateText(dynamic) === before; at++) await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(translateText(dynamic), full(dynamic, true), 'BayBay’s answers convert with the full table');
  await setLocale('zh-Hans', false);
});
