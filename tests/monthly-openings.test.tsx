import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import test, { after, afterEach, beforeEach } from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { additionalOctoberOpenings } from '../src/data/october-openings-extra';
import { lateSeptemberSfEastOpenings } from '../src/data/late-september-sf-east';
import { lateSeptemberPeninsulaSouthOpenings } from '../src/data/late-september-peninsula-south';
import { lateSeptemberNorthOpenings } from '../src/data/late-september-north';
import { currentOpenings } from '../src/data/local-discoveries';
import { guides, getGuideBySlug } from '../src/data/guides';
import { GUIDE_IMAGES } from '../src/data/guide-media';

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'https://www.baylink.us/events?view=openings', pretendToBeVisual: true,
});
const browserGlobals = {
  window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage,
  HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, MutationObserver: dom.window.MutationObserver,
  getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
  requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
  cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
  navigator: dom.window.navigator, IS_REACT_ACT_ENVIRONMENT: true,
};
const previousGlobals = new Map(Object.keys(browserGlobals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
for (const [key, value] of Object.entries(browserGlobals)) {
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
}
// The board imports its stylesheets; here CSS loads as an empty module (the prerender does the same).
registerHooks({ load: (url, context, nextLoad) => url.endsWith('.css') ? { format: 'module', shortCircuit: true, source: 'export {};' } : nextLoad(url, context) });
const { render, fireEvent, within, cleanup } = await import('@testing-library/react');
const { MemoryRouter, StaticRouter } = await import('react-router-dom');
const { default: OpeningsView } = await import('../src/features/events/OpeningsView');
const { INDEX_OPENINGS, coverContext, filterOpenings } = await import('../src/features/events/events-model');
const { getCover } = await import('../src/lib/cover');
const { openingChip } = await import('../src/lib/event-facts');
const { GuideDetail } = await import('../src/components/GuideDetail');
const { setLocale } = await import('../src/i18n/locale');

beforeEach(async () => { await setLocale('zh-Hans', false); });
afterEach(async () => {
  cleanup();
  await setLocale('zh-Hans', false);
  dom.window.localStorage.clear();
});
after(() => {
  dom.window.close();
  for (const [key, descriptor] of previousGlobals) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
});

/** 新店 (the events column's openings board, WEB-EVENTS): the merchant, map and source links live on /openings/{id}. */
const OPENINGS_GUIDE_SLUG = 'bay-area-new-openings-2026-09';
const TODAY = '2026-10-09';
type Region = Parameters<typeof filterOpenings>[2];
const board = (today = TODAY, region: Region = 'all') => <MemoryRouter><OpeningsView today={today} region={region} /></MemoryRouter>;
type View = ReturnType<typeof render>;
const names = (view: View) => [...view.container.querySelectorAll('.ui-feed-card .ui-feed-card__title a')].map(link => link.textContent);
const card = (view: View, name: string) => {
  const article = view.getByRole('link', { name, exact: true }).closest('article');
  assert.ok(article, `${name} has a card`);
  return article as HTMLElement;
};
const statusFilters = (view: View) => within(view.getByRole('group', { name: '按开业状态筛选' }));
const showAll = (view: View) => { for (let more = view.queryByRole('button', { name: /^再看 \d+ 家$/ }); more; more = view.queryByRole('button', { name: /^再看 \d+ 家$/ })) fireEvent.click(more); };
const lateSeptemberOpenings = [...lateSeptemberSfEastOpenings, ...lateSeptemberPeninsulaSouthOpenings, ...lateSeptemberNorthOpenings];
const openShops = currentOpenings.filter(shop => shop.status === 'open');
const announcedShops = currentOpenings.filter(shop => shop.status === 'announced');
const softOpenShops = currentOpenings.filter(shop => shop.status === 'soft_open');
const canonicalOpening = (id: string) => {
  const shop = currentOpenings.find(item => item.id === id);
  assert.ok(shop, `${id} remains in the canonical catalog`);
  return shop;
};

test('the board reads the whole canonical catalog: each shop once, every status counted on its chip', () => {
  assert.deepEqual(INDEX_OPENINGS.map(shop => shop.id), currentOpenings.map(shop => shop.id), 'the slim index keeps the catalog order');
  assert.equal(new Set(currentOpenings.map(shop => shop.id)).size, currentOpenings.length);
  for (const shop of lateSeptemberOpenings) assert.equal(currentOpenings.filter(item => item.id === shop.id).length, 1, `${shop.id} is registered once`);
  assert.equal(openShops.length + softOpenShops.length + announcedShops.length, currentOpenings.length);
  const view = render(board());
  assert.equal(statusFilters(view).getByRole('button', { name: /^全部/ }).textContent, `全部 ${currentOpenings.length}`);
  assert.equal(statusFilters(view).getByRole('button', { name: /^已开业/ }).textContent, `已开业 ${openShops.length}`);
  assert.equal(statusFilters(view).getByRole('button', { name: /^试营业/ }).textContent, `试营业 ${softOpenShops.length}`);
  assert.equal(statusFilters(view).getByRole('button', { name: /^预告与庆典/ }).textContent, `预告与庆典 ${announcedShops.length}`);
  assert.match(view.container.querySelector('.ev-count')!.textContent!, new RegExp(`^${currentOpenings.length} 家 · .*未实地探店`));
  assert.deepEqual(names(view), currentOpenings.slice(0, 12).map(shop => shop.name));
  showAll(view);
  assert.deepEqual(names(view), currentOpenings.map(shop => shop.name));
  assert.deepEqual(names(view).slice(-announcedShops.length), announcedShops.map(shop => shop.name), 'confirmed full and trial operation precede announcements');
  for (const shop of currentOpenings) assert.equal(view.getByRole('link', { name: shop.name, exact: true }).getAttribute('href'), `/openings/${shop.id}`);
});

test('soft openings have their own filter and never inherit an open or announced label', () => {
  assert.ok(softOpenShops.length > 0);
  const view = render(board());
  fireEvent.click(statusFilters(view).getByRole('button', { name: /^试营业/ }));
  assert.deepEqual(names(view), softOpenShops.map(shop => shop.name));
  for (const shop of softOpenShops) {
    const meta = card(view, shop.name).querySelector('.ui-feed-card__meta')!.textContent!;
    if (!shop.openedOn) assert.match(meta, /试营业$/, shop.id);
    assert.doesNotMatch(meta, /即将开业/, shop.id);
  }
  const fixture = { status: 'soft_open' as const, openedOn: undefined };
  assert.deepEqual(openingChip(fixture, '2026-11-01'), { zh: '试营业', en: 'Soft opening' }, 'time passing does not make a soft opening open');
});

test('status and region narrow the board, and an empty combination offers a reset to every opening in the region', () => {
  const emptyRegion = (['sf', 'peninsula', 'north-bay'] as const).find(region => !softOpenShops.some(shop => shop.region === region))!;
  assert.ok(emptyRegion, 'the catalog has a region without confirmed trial operation');
  const view = render(board(TODAY, emptyRegion));
  const inRegion = currentOpenings.filter(shop => shop.region === emptyRegion);
  showAll(view);
  assert.deepEqual(names(view), inRegion.map(shop => shop.name));
  assert.equal(statusFilters(view).getByRole('button', { name: /^试营业/ }).textContent, '试营业 0');
  fireEvent.click(statusFilters(view).getByRole('button', { name: /^试营业/ }));
  assert.deepEqual(names(view), []);
  assert.ok(view.getByRole('heading', { name: '这个地区暂时没有符合条件的新店' }));
  fireEvent.click(view.getByRole('button', { name: '看全部新店' }));
  assert.equal(statusFilters(view).getByRole('button', { name: /^全部/ }).getAttribute('aria-pressed'), 'true');
  showAll(view);
  assert.deepEqual(names(view), inRegion.map(shop => shop.name));
  cleanup();
  const announcedSf = render(board(TODAY, 'sf'));
  fireEvent.click(statusFilters(announcedSf).getByRole('button', { name: /^预告与庆典/ }));
  assert.deepEqual(names(announcedSf), announcedShops.filter(shop => shop.region === 'sf').map(shop => shop.name));
});

test('passing an announced date or month never silently promotes a forecast to open', () => {
  for (const today of ['2026-10-09', '2026-10-31', '2026-11-15', '2027-01-05']) {
    const view = render(board(today));
    fireEvent.click(statusFilters(view).getByRole('button', { name: /^预告与庆典/ }));
    showAll(view);
    assert.deepEqual(names(view), announcedShops.map(shop => shop.name), today);
    for (const shop of announcedShops) {
      assert.equal(shop.openedOn, undefined, 'an announcement cannot claim a first-service date');
      assert.match(card(view, shop.name).querySelector('.ui-feed-card__meta')!.textContent!, /即将开业$/, `${today}: ${shop.id}`);
    }
    cleanup();
  }
  // A confirmed first day reads as the month it opened; a future one as the expected day.
  assert.deepEqual(openingChip({ status: 'open', openedOn: '2026-08-10' }, TODAY), { zh: '8 月开业', en: 'Opened Aug' });
  assert.deepEqual(openingChip({ status: 'open', openedOn: '2026-10-20' }, TODAY), { zh: '预计 10/20 开业', en: 'Opening 10/20' });
  assert.deepEqual(openingChip({ status: 'open', openedOn: undefined }, TODAY), { zh: '即将开业', en: 'Opening soon' });
  const bakery = canonicalOpening('boulangerie-eria-celebration');
  assert.equal(bakery.status, 'open');
  assert.equal(bakery.openedOn, undefined, 'verified operation does not invent a first-service date');
});

test('opening cards show only attributable photos or posters; synthetic shop artwork becomes the information card', () => {
  const view = render(board());
  showAll(view);
  for (const previous of [...additionalOctoberOpenings, ...lateSeptemberOpenings]) {
    const shop = canonicalOpening(previous.id);
    assert.ok(shop.imageKey, `${shop.id} has an editorially selected picture`);
    assert.match(shop.verifiedAt, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(shop.verifiedAt >= previous.verifiedAt, `${shop.id} does not discard newer verification`);
    assert.equal(new URL(shop.sourceUrl).protocol, 'https:');
    assert.ok(shop.sourceLabel.trim());
  }
  const reviewed = new Set([...additionalOctoberOpenings, ...lateSeptemberOpenings].map(shop => shop.id));
  for (const shop of currentOpenings) {
    const article = card(view, shop.name);
    const registered = Object.hasOwn(GUIDE_IMAGES, shop.imageKey) ? GUIDE_IMAGES[shop.imageKey] : undefined;
    const image = registered?.kind === 'illustration' ? undefined : registered;
    const img = article.querySelector('img.ui-cover__img');
    // The cover ladder decides which factual images an opening may use (official images and own shots, WEB-UI).
    if (image && getCover({ kind: 'opening', id: shop.id, imageKey: shop.imageKey }, coverContext(TODAY)).tier !== 'type') {
      assert.ok(image.kind === 'photo' || image.kind === 'poster', `${shop.id} uses factual media`);
      assert.ok(readFileSync(new URL(`../public${image.src}`, import.meta.url)).length > 0, `${shop.id} image file exists`);
      assert.ok(img, `${shop.id} shows its own image`);
      assert.match(img.getAttribute('src')!, new RegExp(image.src.replace(/\.webp$/, '').replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')));
      assert.ok(image.caption.trim() && image.credit.trim());
      if (reviewed.has(shop.id)) assert.equal(new URL(image.creditUrl!).hostname, new URL(shop.officialUrl).hostname, `${shop.id} image is attributed to this merchant`);
      const fit = article.querySelector('[data-cover="image"]')!.getAttribute('data-fit');
      assert.equal(fit, image.kind === 'poster' || image.fullFrame ? 'contain' : 'cover', `${shop.id}: posters and full-frame photos are never cropped`);
    } else {
      assert.equal(img, null, `${shop.id} has no unrelated, synthetic or unlicensed picture`);
      assert.ok(article.querySelector('[data-cover="type"]'), `${shop.id} gets the information card`);
      if (registered?.kind === 'illustration') assert.equal(article.textContent!.includes(registered.caption), false, 'hidden synthetic artwork leaves no picture caption');
    }
    assert.match(article.querySelector('.ui-feed-card__trust')!.textContent!, /^官网核对 \d+\/\d+$/);
  }
  for (const id of ['kaiyo-handroll-union', 'marufuku-burlingame-announced', 'broken-dreams-oakland']) {
    const image = GUIDE_IMAGES[canonicalOpening(id).imageKey];
    assert.ok(image.kind === 'poster' || image.fullFrame, `${id} requires its complete artwork or photo`);
  }
  for (const id of ['mess-hall-presidio-breadwinner', 'hijau-san-jose-storefront']) assert.equal(GUIDE_IMAGES[canonicalOpening(id).imageKey].kind, 'illustration');
  const brokenDreams = canonicalOpening('broken-dreams-oakland');
  assert.equal(brokenDreams.openedOn, '2026-08-10');
  assert.match(brokenDreams.editorTip, /周末暂休/);
  const marufuku = canonicalOpening('marufuku-burlingame-announced');
  assert.equal(marufuku.status, 'announced');
  assert.match(marufuku.dateLabel, /预告.*10\/11.*Grand Opening.*11:00.*14:00.*17:00.*21:00/);
  assert.equal(marufuku.openedOn, undefined, 'a grand-opening announcement does not establish first service');
  assert.equal(marufuku.sourceUrl, 'https://www.marufukuramen.com/burlingame');
  assert.equal(marufuku.address, '225 Lorton Ave, Burlingame, CA 94010');
  assert.match(GUIDE_IMAGES[marufuku.imageKey].caption, /Coming Soon|尚未开业|不代表已开业/);
});

test('unavailable and inherited opening image keys safely fall back to the information card', () => {
  const shop = INDEX_OPENINGS[0];
  for (const imageKey of ['unregistered-opening-test-image', '__proto__', 'constructor', 'family-workshop']) {
    const cover = getCover({ kind: 'opening', id: shop.id, imageKey }, coverContext(TODAY));
    assert.equal(cover.tier, 'type', imageKey);
  }
});

test('the board links the new-shop handbook, which resolves to the full catalog with clickable primary sources in server HTML', () => {
  const view = render(board());
  assert.equal(view.getByRole('link', { name: '新店手册：去之前先确认开门' }).getAttribute('href'), `/guides/${OPENINGS_GUIDE_SLUG}`);
  const guide = getGuideBySlug(OPENINGS_GUIDE_SLUG);
  assert.ok(guide, 'the link must point to a registered guide');
  assert.equal(guides.filter(item => item.slug === OPENINGS_GUIDE_SLUG).length, 1);
  assert.equal(guide.editionMonth, '2026-09');
  assert.match(guide.sourceNote || '', /未实地探店/);
  const server = new JSDOM(renderToStaticMarkup(<StaticRouter location={`/guides/${OPENINGS_GUIDE_SLUG}`}>
    <GuideDetail slug={OPENINGS_GUIDE_SLUG} today="2026-10-01" onBack={() => {}} onOpenGuide={() => {}} onNavigate={() => {}} onOpenPost={() => {}} />
  </StaticRouter>));
  try {
    const document = server.window.document;
    assert.equal(document.querySelector('h1')?.textContent, guide.title);
    assert.match(document.querySelector('.bl-guide-edition-notice')?.textContent || '', /往期攻略 · 2026 年 9 月/);
    const links = [...document.querySelectorAll('a')];
    for (const shop of currentOpenings) {
      assert.ok(document.body.textContent?.includes(shop.name));
      assert.ok(document.body.textContent?.includes(shop.dateLabel));
      for (const url of [shop.officialUrl, shop.sourceUrl]) {
        assert.ok(links.some(link => link.getAttribute('href') === url), `${shop.name} needs ${url}`);
      }
    }
  } finally { server.window.close(); }
});
