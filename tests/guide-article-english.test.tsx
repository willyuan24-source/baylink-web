import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';

/**
 * WEB-DATA-SPLIT: an /en article loads only its own English pack (plus the UI pack), not the whole dictionary. What it shows
 * must be as English as with the whole dictionary: here for the guides with the most runtime-assembled text (the deals
 * board and the posters' share captions, the city directory) and two pilots. Text the whole dictionary does not translate
 * either is a translation gap, not a loading one, and is not counted against the pack.
 */
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://www.baylink.us/en/guides', pretendToBeVisual: true });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { renderToStaticMarkup } = await import('react-dom/server');
const { StaticRouter } = await import('react-router');
const { GuideDetail } = await import('../src/components/GuideDetail');
const { preloadAllGuideBlocks } = await import('../src/features/guides/guide-blocks');
const { loadLocale, setLocale } = await import('../src/i18n/locale');
await preloadAllGuideBlocks();

const SLUGS = ['bay-area-freebies-deals-2026-10', 'bay-area-birthday-perks', 'bay-area-everyday-free-perks', 'bay-area-retail-freebies-family-deals',
  'bay-area-chinese-senior-services-referral-guide', 'bay-area-medicare-hicap-medi-cal-guide'];
const noop = () => {};
const chinese = (slug: string) => {
  const html = renderToStaticMarkup(<StaticRouter location={`/guides/${slug}`}><GuideDetail slug={slug} onBack={noop} onOpenGuide={noop} onNavigate={noop} onOpenPost={noop} /></StaticRouter>);
  return (new JSDOM(html).window.document.body.textContent ?? '').match(/[㐀-鿿]+/gu) ?? [];
};

test('an /en article with only its own pack shows the same English as with the whole dictionary', async () => {
  const scoped = new Map<string, string[]>();
  for (const slug of SLUGS) {
    assert.equal(await setLocale('en', false, `/guides/${slug}`), true);
    scoped.set(slug, chinese(slug));
  }
  await loadLocale('en');
  for (const slug of SLUGS) assert.deepEqual(scoped.get(slug), chinese(slug), slug);
});
