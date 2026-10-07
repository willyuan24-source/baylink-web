import assert from 'node:assert/strict';
import test, { after, afterEach } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import { StaticRouter } from 'react-router-dom';
import { localDiscoveries } from '../src/data/local-discoveries';
import { LocalDiscoveryDetail } from '../src/components/LocalDiscoveryDetail';
import { setLocale } from '../src/i18n/locale';
import { getListingImage } from '../src/lib/offer-media';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://www.baylink.us/' });
const globals = { window: dom.window, document: dom.window.document, navigator: dom.window.navigator };
const previous = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
afterEach(async () => { await setLocale('zh-Hans', false); });
after(() => {
  dom.window.close();
  for (const [key, descriptor] of previous) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
});

const offer = localDiscoveries.find(item => item.kind === 'offer' && !!item.offer.storeUrl && !!item.offer.endDate && !!item.offer.imageKey);
const opening = localDiscoveries.find(item => item.kind === 'opening' && item.shop.status === 'open' && !!getListingImage(item.shop.imageKey));
assert.ok(offer?.kind === 'offer');
assert.ok(opening?.kind === 'opening');
const page = (item: Parameters<typeof LocalDiscoveryDetail>[0]['item'], today = '2026-10-01') => JSDOM.fragment(renderToStaticMarkup(<StaticRouter><LocalDiscoveryDetail item={item} today={today} /></StaticRouter>));

test('offer and opening official actions precede media while sharing remains available in a closed disclosure', () => {
  for (const item of [offer, opening]) {
    const doc = page(item);
    const official = doc.querySelector<HTMLAnchorElement>('.discovery-detail-main-actions .discovery-primary')!;
    const media = doc.querySelector('.discovery-detail-media')!;
    assert.equal(official.getAttribute('href'), item.kind === 'offer' ? item.offer.sourceUrl : item.shop.officialUrl);
    assert.match(official.rel, /noopener/);
    assert.equal(official.closest('details'), null);
    assert.ok(official.compareDocumentPosition(media) & dom.window.Node.DOCUMENT_POSITION_FOLLOWING);
    const secondary = doc.querySelector<HTMLDetailsElement>('.discovery-detail-more-actions')!;
    assert.equal(secondary.open, false);
    assert.ok(secondary.querySelector('summary')?.textContent);
    assert.ok(secondary.querySelector('.editorial-share-actions button'), 'the source can still be shared when requested');
    assert.equal(doc.querySelector('.discovery-detail-header>.editorial-share-actions'), null);
    assert.ok(doc.querySelector('.guide-image-caption'), 'editorial image provenance remains visible');
  }
});

test('offer conditions appear once, before media, and preserve the real store lookup', () => {
  const doc = page(offer);
  assert.equal(doc.querySelector('h1')?.textContent, offer.offer.title, 'the headline does not repeat the uppercase brand prefix');
  assert.ok(doc.querySelector('.discovery-eyebrow')?.textContent?.includes(offer.offer.brand), 'the brand stays visible beside the category');
  const paragraphs = [...doc.querySelectorAll('p')].filter(node => node.textContent === offer.offer.requirement);
  assert.equal(paragraphs.length, 1);
  assert.equal(paragraphs[0].closest('section')?.getAttribute('aria-labelledby'), 'offer-conditions-title');
  assert.ok(paragraphs[0].compareDocumentPosition(doc.querySelector('.discovery-detail-media')!) & dom.window.Node.DOCUMENT_POSITION_FOLLOWING);
  assert.equal(doc.querySelector('.discovery-detail-header a.discovery-secondary')?.getAttribute('href'), offer.offer.storeUrl);
  assert.ok(doc.querySelector('.discovery-detail-body')?.textContent?.includes(offer.offer.description));
});

test('directory regions never become a claim that an offer is available at a specific Bay Area location', async () => {
  const locales = [
    ['zh-Hans', '参与门店 · 先查本地地址', '适用地点请查官方说明'],
    ['zh-Hant', '參與門店 · 先查本地地址', '適用地點請查官方說明'],
    ['en', 'Participating locations · check local addresses', 'Check the official terms for applicable locations'],
  ] as const;
  for (const [locale, withStore, withoutStore] of locales) {
    await setLocale(locale, false);
    for (const [storeUrl, expected] of [[offer.offer.storeUrl, withStore], [undefined, withoutStore]] as const) {
      const doc = page({ ...offer, offer: { ...offer.offer, region: 'south-bay', storeUrl } });
      assert.equal(doc.querySelector('.discovery-detail-facts>span:nth-child(2)')?.textContent, expected);
      assert.equal(doc.querySelectorAll('.discovery-detail-facts>span').length, 2, 'no invented address, event venue or additional eligibility fact');
    }
  }
});

test('expired or unconfirmed offers retain official reference access without inviting a new outing', () => {
  for (const item of [
    { ...offer, offer: { ...offer.offer, endDate: '2026-09-30' } },
    { ...offer, offer: { ...offer.offer, endDate: '2026-10-31', verificationStatus: 'needs-confirmation' as const } },
  ]) {
    const doc = page(item);
    assert.equal(doc.querySelector('.outing-inspiration-link'), null);
    assert.equal(doc.querySelector('.discovery-detail-main-actions .discovery-primary')?.getAttribute('href'), item.offer.sourceUrl);
    assert.equal(doc.querySelector('.discovery-important')?.textContent, item.offer.requirement);
  }
});
