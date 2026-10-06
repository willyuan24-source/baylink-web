import assert from 'node:assert/strict';
import test from 'node:test';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router';
import { JSDOM } from 'jsdom';
import '../src/i18n/router';
import '../src/i18n/metadata';
import { PublicContentDirectory } from '../src/components/PublicContentDirectory';
import ArchivePage from '../src/pages/ArchivePage';
import { localDiscoveries, discoveryShare, type LocalDiscovery } from '../src/data/local-discoveries';
import { setLocale, type Locale } from '../src/i18n/locale';
import { languagePath, languagePrefix } from '../src/lib/language-path';
import { SLUG_TO_CATEGORY } from '../src/routing';
import { ARCHIVE_METADATA } from '../src/lib/archive-metadata';
import { setPageMetadata } from '../src/lib/seo';
import { inspectStaticLinkCoverage } from '../scripts/verify-static-links.mjs';

const renderDirectory = (locale: Locale, items: readonly LocalDiscovery[] = localDiscoveries, today = '2026-10-06') => new JSDOM(renderToStaticMarkup(createElement(StaticRouter, { basename: languagePrefix(locale) || undefined, location: languagePath('/archive', locale) }, createElement(PublicContentDirectory, { today, items }))));

test('direct English archive entry loads the discovery dictionary through its route scope', async () => {
  try {
    await setLocale('en', false, '/archive');
    const dom = renderDirectory('en');
    const untranslated = [...dom.window.document.querySelectorAll('a')].filter(anchor => /[\u3400-\u9fff]/.test(anchor.textContent || '')).map(anchor => anchor.getAttribute('href'));
    assert.deepEqual(untranslated, [], 'every directory title and category is translated before the first English render');
    dom.window.close();
  } finally { await setLocale('zh-Hans', false); }
});

test('the first HTML retains one canonical anchor for every discovery in each language, including collapsed archives', async () => {
  try {
    for (const locale of ['zh-Hans', 'zh-Hant', 'en'] as const) {
      await setLocale(locale, false);
      const dom = renderDirectory(locale);
      const document = dom.window.document;
      for (const item of localDiscoveries) {
        const path = languagePath(discoveryShare(item).path, locale);
        const anchors = [...document.querySelectorAll('a')].filter(anchor => anchor.getAttribute('href') === path);
        assert.equal(anchors.length, 1, path);
        assert.ok(anchors[0].closest('details'), `${path} remains in a native, expandable directory`);
        assert.equal(anchors[0].closest('details')?.hasAttribute('open'), false);
      }
      for (const slug of Object.keys(SLUG_TO_CATEGORY)) assert.ok([...document.querySelectorAll('a')].some(anchor => anchor.getAttribute('href') === languagePath(`/category/${slug}`, locale)), slug);
      assert.ok([...document.querySelectorAll('a')].some(anchor => anchor.getAttribute('href') === languagePath('/recommend', locale)));
      if (locale === 'en') {
        assert.equal(document.querySelector('h1')?.textContent, 'Content directory and archives');
        const fleetWeek = [...document.querySelectorAll('a')].find(anchor => anchor.getAttribute('href') === '/en/events/san-francisco-fleet-week-2026');
        assert.ok(fleetWeek && !/[\u3400-\u9fff]/.test(fleetWeek.textContent || ''), 'catalog titles load their English dictionary');
      }
      dom.window.close();
    }
  } finally { await setLocale('zh-Hans', false); }
});

test('ended and unconfirmed records remain readable without inventing current availability or a check date', async () => {
  await setLocale('en', false);
  try {
    const event = localDiscoveries.find((item): item is Extract<LocalDiscovery, { kind: 'event' }> => item.kind === 'event')!;
    const offer = localDiscoveries.find((item): item is Extract<LocalDiscovery, { kind: 'offer' }> => item.kind === 'offer')!;
    const opening = localDiscoveries.find((item): item is Extract<LocalDiscovery, { kind: 'opening' }> => item.kind === 'opening')!;
    const fixtures: LocalDiscovery[] = [
      { kind: 'event', event: { ...event.event, id: 'past-fixture', startDate: '2026-10-01', endDate: '2026-10-02', occurrenceDates: undefined, verifiedAt: '2026-10-01' } },
      { kind: 'offer', offer: { ...offer.offer, id: 'expired-fixture', availability: 'dated', startDate: '2026-10-01', endDate: '2026-10-05', verifiedAt: '2026-10-01' } },
      { kind: 'offer', offer: { ...offer.offer, id: 'recurring-fixture', availability: 'ongoing', startDate: undefined, endDate: undefined, verifiedAt: undefined } },
      { kind: 'offer', offer: { ...offer.offer, id: 'unconfirmed-fixture', verificationStatus: 'needs-confirmation', startDate: '2026-10-07', endDate: '2026-10-08', verifiedAt: '2026-10-07' } },
      { kind: 'opening', shop: { ...opening.shop, id: 'announcement-fixture', status: 'announced', openedOn: undefined, verifiedAt: '2026-10-01' } },
    ];
    const dom = renderDirectory('en', fixtures);
    const row = (path: string) => [...dom.window.document.querySelectorAll('a')].find(anchor => anchor.getAttribute('href') === `/en/${path}`)!.closest('li')!;
    assert.match(row('events/past-fixture').textContent!, /Ended · past record/);
    assert.match(row('offers/expired-fixture').textContent!, /Ended · past record/);
    assert.match(row('offers/recurring-fixture').textContent!, /Recurring offer · check conditions/);
    assert.match(row('offers/unconfirmed-fixture').textContent!, /Current offer unconfirmed/);
    assert.match(row('offers/unconfirmed-fixture').textContent!, /Source check date unconfirmed/);
    assert.equal([...row('offers/unconfirmed-fixture').querySelectorAll('time')].some(time => time.parentElement?.textContent?.includes('Source checked:')), false);
    assert.match(row('openings/announcement-fixture').textContent!, /Announcement or celebration record/);
    assert.equal(row('openings/announcement-fixture').querySelectorAll('time').length, 1, 'an announcement has only its actual check date, no manufactured first-service date');
    dom.window.close();
    const finalDay = renderDirectory('en', [fixtures[1]], '2026-10-05');
    assert.match(finalDay.window.document.body.textContent!, /Within listed dates/);
    assert.doesNotMatch(finalDay.window.document.body.textContent!, /Ended · past record/);
    finalDay.window.close();
  } finally { await setLocale('zh-Hans', false); }
});

test('static coverage rejects head-only, self-only and unreachable inbound links', () => {
  const origin = 'https://www.baylink.us';
  const urls = ['/', '/archive', '/events/past', '/offers/later', '/en/', '/en/archive'].map(path => origin + path);
  const pages = [
    { path: '/index.html', html: '<a href="/archive">Directory</a><link rel="alternate" href="/offers/later" />' },
    { path: '/archive.html', html: '<a href="/">Home</a><details><summary>Past</summary><a href="/events/past?from=archive&amp;lang=zh-Hans">Past event</a></details>' },
    { path: '/events/past.html', html: '<a href="/events/past">Self</a><a href="/archive">Directory</a>' },
    { path: '/offers/later.html', html: '<a href="/offers/later">Self</a>' },
    { path: '/unlinked.html', html: '<a href="/offers/later">Isolated inbound</a>' },
    { path: '/en/index.html', html: '<a href="/en/archive">Directory</a>' },
    { path: '/en/archive.html', html: '<a href="/en/">Home</a>' },
  ];
  const failed = inspectStaticLinkCoverage(pages, urls);
  assert.deepEqual(failed.missingHtml, []);
  assert.deepEqual(failed.noInbound, [], 'an isolated source can give a URL an inbound link');
  assert.deepEqual(failed.unreachable, ['/offers/later'], 'but it cannot make the page reachable from its language homepage');
  const noIsolatedSource = inspectStaticLinkCoverage(pages.filter(page => page.path !== '/unlinked.html'), urls);
  assert.deepEqual(noIsolatedSource.noInbound, ['/offers/later'], 'canonical/hreflang/self links do not count');
  const fixed = inspectStaticLinkCoverage(pages.map(page => page.path === '/archive.html' ? { ...page, html: page.html + '<a href="/offers/later">Offer</a>' } : page), urls);
  assert.deepEqual(fixed.unreachable, []);
  assert.deepEqual(fixed.noInbound, []);
  const missing = inspectStaticLinkCoverage(pages.filter(page => page.path !== '/events/past.html'), urls);
  assert.deepEqual(missing.missingHtml, ['/events/past']);
});

test('the archive resets stale client metadata on entry, language changes and return navigation', async () => {
  const dom = new JSDOM('<!doctype html><html><head></head><body><div id="app"></div></body></html>', { url: 'https://www.baylink.us/archive' });
  const globals = { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true };
  const previous = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { value, writable: true, configurable: true });
  const root = createRoot(dom.window.document.getElementById('app')!);
  const view = () => createElement(StaticRouter, { location: '/archive' }, createElement(ArchivePage));
  try {
    await setLocale('zh-Hans', false);
    setPageMetadata({ title: 'Missing page', description: 'Old content', path: '/missing', noindex: true });
    await act(async () => { root.render(view()); });
    assert.equal(dom.window.document.title, ARCHIVE_METADATA.title);
    assert.equal(dom.window.document.querySelector('meta[name="robots"]')?.getAttribute('content'), 'index, follow');
    assert.equal(dom.window.document.querySelector('link[rel="canonical"]')?.getAttribute('href'), 'https://www.baylink.us/archive');
    await act(async () => { await setLocale('en', false); });
    assert.equal(dom.window.document.querySelector('link[rel="canonical"]')?.getAttribute('href'), 'https://www.baylink.us/en/archive');
    await act(async () => { root.render(createElement('p', null, 'Another route')); });
    setPageMetadata({ title: 'Another route', description: 'Another route', path: '/other', noindex: true });
    await act(async () => { root.render(view()); });
    assert.equal(dom.window.document.querySelector('meta[name="robots"]')?.getAttribute('content'), 'index, follow');
    assert.equal(dom.window.document.querySelector('link[rel="canonical"]')?.getAttribute('href'), 'https://www.baylink.us/en/archive');
  } finally {
    await act(async () => { root.unmount(); });
    await setLocale('zh-Hans', false);
    for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
    dom.window.close();
  }
});
