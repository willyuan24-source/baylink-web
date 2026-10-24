import assert from 'node:assert/strict';
import test, { after, afterEach } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import { StaticRouter } from 'react-router-dom';
import '../src/i18n/router';
import { localDiscoveries, type LocalDiscovery } from '../src/data/local-discoveries';
import { LocalDiscoveryDetail } from '../src/components/LocalDiscoveryDetail';
import { buildDetailRecord } from '../src/features/detail/build-detail';
import { setLocale } from '../src/i18n/locale';
import { getListingImage } from '../src/lib/offer-media';
import { brandCase } from '../src/lib/event-facts';

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
const page = (item: LocalDiscovery, today = '2026-10-01') => JSDOM.fragment(renderToStaticMarkup(<StaticRouter><LocalDiscoveryDetail record={buildDetailRecord(item)} today={today} /></StaticRouter>));
const FOLLOWING = 4;

test('offer and opening pages open on the hero; the official page is on the first screen and sharing is not hidden', () => {
  for (const item of [offer, opening]) {
    const doc = page(item);
    const main = doc.querySelector('.detail-main')!;
    assert.ok(main.firstElementChild?.classList.contains('detail-hero'), 'the hero is the first thing in the column (EVT11-03, SV-05)');
    assert.equal(doc.querySelector('.discovery-detail-brand'), null, 'no BAYLINK masthead');
    // The official page: the bar's primary (an offer), or the 开业 line's 商家官网 ↗ when the primary is 加入计划 (UI9-DETAIL).
    const official = doc.querySelector<HTMLAnchorElement>('.site-detail-actions a[target="_blank"], [data-fact="when"] dt a[target="_blank"]')!;
    assert.equal(official.getAttribute('href'), item.kind === 'offer' ? item.offer.sourceUrl : item.shop.officialUrl);
    assert.match(official.rel, /noopener/);
    assert.equal(doc.querySelector('details:not(#page-credits)'), null, 'no action is tucked into a disclosure (本页图片来源 is the one list)');
    assert.ok(doc.querySelector('.detail-share .editorial-share-actions button'), 'the listing can be shared');
    assert.ok(doc.querySelector('.detail-hero')!.compareDocumentPosition(doc.querySelector('h1')!) & FOLLOWING);
  }
  const shopPage = page(opening);
  assert.ok(shopPage.querySelector('.detail-hero [data-cover="image"] .ui-provenance'), 'the photo carries its provenance badge');
  assert.ok(shopPage.querySelector('.detail-hero .ui-cover > .detail-photo-credit'), 'the credit stays on the picture');
});

test('offer conditions read as a checklist, the steps as 1-2-3, and the real store lookup stays', () => {
  const doc = page(offer);
  assert.equal(doc.querySelector('h1')?.textContent, offer.offer.title, 'the headline does not repeat the uppercase brand prefix');
  assert.equal(doc.querySelector('.detail-brand')?.textContent, brandCase(offer.offer.brand), 'the brand stays visible under the title');
  const conditions = doc.querySelector('section[aria-labelledby="offer-conditions-title"]')!;
  assert.equal(conditions.querySelector('h2')?.textContent, '先看领取条件');
  assert.equal([...conditions.querySelectorAll('li')].map(li => li.textContent).join('').replace(/\s+/g, ''), offer.offer.requirement.replace(/\s+/g, ''), 'every condition, once, in order');
  assert.equal(doc.querySelectorAll('section[aria-labelledby="offer-conditions-title"]').length, 1);
  assert.equal(doc.querySelector('.detail-fact[data-fact="where"] a')?.getAttribute('href'), offer.offer.storeUrl);
  assert.ok(doc.querySelectorAll('.detail-steps li').length >= 1);
  assert.ok(!doc.textContent?.includes('以官方入口的最新说明为准'), 'no generic "check the official site" line (CNT-1011-06)');
});

test('directory regions never become a claim that an offer is available at a specific Bay Area location', async () => {
  const locales = [['zh-Hans', '参与门店 · 先查本地地址'], ['zh-Hant', '參與門店 · 先查本地地址'], ['en', 'Participating locations · check local addresses']] as const;
  for (const [locale, withStore] of locales) {
    await setLocale(locale, false);
    const withLookup = page({ ...offer, offer: { ...offer.offer, region: 'south-bay' } });
    assert.ok(withLookup.querySelector('.detail-fact[data-fact="where"] dd')?.textContent?.startsWith(withStore));
    const single = page({ ...offer, offer: { ...offer.offer, region: 'south-bay', storeUrl: undefined } });
    assert.equal(single.querySelector('.detail-fact[data-fact="where"]'), null, 'no store list, so no "where" cell and no invented address');
    assert.ok(!/适用地点请查官方说明|適用地點請查官方說明|Check the official terms for applicable locations/.test(single.textContent || ''));
  }
});

test('expired or unconfirmed offers keep official access and their conditions without inviting a new outing or a save', () => {
  for (const item of [
    { ...offer, offer: { ...offer.offer, endDate: '2026-09-30' } },
    { ...offer, offer: { ...offer.offer, endDate: '2026-10-31', verificationStatus: 'needs-confirmation' as const } },
  ]) {
    const doc = page(item);
    assert.equal(doc.querySelector('.outing-inspiration-link, .detail-together__go'), null, 'no 一起去');
    assert.equal(doc.querySelector('.site-detail-actions a[target="_blank"]')?.getAttribute('href'), item.offer.sourceUrl);
    assert.ok(doc.querySelector('section[aria-labelledby="offer-conditions-title"] li'));
    assert.ok(doc.querySelector('.detail-note, .content-review-ended'), 'the ended notice or the 待确认 note');
  }
  assert.equal(page({ ...offer, offer: { ...offer.offer, endDate: '2026-09-30' } }).querySelector('.saves-toggle'), null);
  assert.ok(page(offer, offer.offer.endDate).querySelector('.site-detail-actions .saves-toggle'), 'a live offer has the ♡ (FC3-03)');
});

test('English detail chrome, plan action and related guide link have no untranslated interface labels', async () => {
  await setLocale('en', false);
  const shop = localDiscoveries.find(item => item.kind === 'opening' && item.shop.id === 'sergeant-ma');
  assert.ok(shop?.kind === 'opening');
  const doc = page(shop);
  assert.equal(doc.querySelector('.detail-back a')?.textContent, 'New shops');
  assert.equal(doc.querySelector('.site-detail-actions')?.getAttribute('aria-label'), 'Actions for this page');
  const event = localDiscoveries.find(item => item.kind === 'event' && item.event.relatedGuideSlug);
  assert.ok(event?.kind === 'event');
  const eventPage = page(event, event.event.startDate);
  assert.equal(eventPage.querySelector('.detail-back a')?.textContent, 'Events');
  assert.equal(eventPage.querySelector('.discovery-related')?.textContent, 'Read a related local guide');
  for (const node of eventPage.querySelectorAll('.detail-facts dt, .site-detail-actions, .detail-body h2, .discovery-return')) assert.ok(!/[㐀-鿿]/.test(node.textContent || ''), node.textContent || '');
});
