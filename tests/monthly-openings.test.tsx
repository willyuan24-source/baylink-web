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
const { render, fireEvent, cleanup } = await import('@testing-library/react');
const { MemoryRouter, StaticRouter } = await import('react-router-dom');
const { default: OpeningsView } = await import('../src/features/events/OpeningsView');
const { INDEX_OPENINGS, coverContext } = await import('../src/features/events/events-model');
const { getCover } = await import('../src/lib/cover');
const { openingChip } = await import('../src/lib/event-facts');
const { openingSections, pressSourced } = await import('../src/features/events/board-status');
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
type Region = import('../src/features/events/events-index-types').MonthlyRegion | 'all';
const board = (today = TODAY, region: Region = 'all') => <MemoryRouter><OpeningsView today={today} region={region} /></MemoryRouter>;
type View = ReturnType<typeof render>;
/** A card title as written in the catalog: the card glues the name's own " · " with a no-break space (UI9-FREE, N06). */
const named = (link: Element) => link.textContent!.replace(/\u00a0/g, ' ');
const names = (view: View) => [...view.container.querySelectorAll('.ui-feed-card .ui-feed-card__title a')].map(named);
const card = (view: View, name: string) => {
  const article = view.getByRole('link', { name: accessible => accessible.replace(/\u00a0/g, ' ') === name }).closest('article');
  assert.ok(article, `${name} has a card`);
  return article as HTMLElement;
};
/** UI9-FREE: the two sections (已开业, 即将开业) replace the status chips; each has its own 再看 N 家. */
const heads = (view: View) => [...view.container.querySelectorAll('h2.fb-section__head')].map(head => head.textContent);
const section = (view: View, label: string) => [...view.container.querySelectorAll('section.fb-section')].find(item => item.querySelector('h2')!.textContent!.startsWith(label)) as HTMLElement;
const showAll = (view: View) => { for (let more = view.queryAllByRole('button', { name: /^再看 \d+ 家$/ })[0]; more; more = view.queryAllByRole('button', { name: /^再看 \d+ 家$/ })[0]) fireEvent.click(more); };
const lateSeptemberOpenings = [...lateSeptemberSfEastOpenings, ...lateSeptemberPeninsulaSouthOpenings, ...lateSeptemberNorthOpenings];
const openShops = currentOpenings.filter(shop => shop.status === 'open');
const announcedShops = currentOpenings.filter(shop => shop.status === 'announced');
const softOpenShops = currentOpenings.filter(shop => shop.status === 'soft_open');
/** 即将开业 on `today`: announcements, and an open shop whose recorded first day is still ahead (Marufuku before 10/11). */
const comingOn = (today: string) => currentOpenings.filter(shop => shop.status === 'announced' || (shop.openedOn ?? '') > today);
const canonicalOpening = (id: string) => {
  const shop = currentOpenings.find(item => item.id === id);
  assert.ok(shop, `${id} remains in the canonical catalog`);
  return shop;
};

test('the board reads the whole canonical catalog: each shop once, every status in its section (已开业 · 即将开业)', () => {
  assert.deepEqual(INDEX_OPENINGS.map(shop => shop.id), currentOpenings.map(shop => shop.id), 'the slim index keeps the catalog order');
  assert.equal(new Set(currentOpenings.map(shop => shop.id)).size, currentOpenings.length);
  for (const shop of lateSeptemberOpenings) assert.equal(currentOpenings.filter(item => item.id === shop.id).length, 1, `${shop.id} is registered once`);
  assert.equal(openShops.length + softOpenShops.length + announcedShops.length, currentOpenings.length);
  const view = render(board());
  const coming = comingOn(TODAY);
  assert.deepEqual(heads(view), [`已开业 · ${currentOpenings.length - coming.length} 家`, `即将开业 · ${coming.length} 家`]);
  assert.equal(view.container.querySelector('.fb-note')!.textContent, '整理自公开资料，未实地探店');
  assert.equal(view.queryByRole('group', { name: '按开业状态筛选' }), null, 'no status chips');
  const sections = openingSections(INDEX_OPENINGS, TODAY);
  // jsdom has no matchMedia: the phone layout, 6 open shops and 4 coming soon.
  assert.deepEqual(names(view), sections.flatMap(item => item.openings.slice(0, item.id === 'open' ? 6 : 4).map(shop => shop.name)));
  showAll(view);
  assert.deepEqual(names(view), sections.flatMap(item => item.openings.map(shop => shop.name)));
  assert.deepEqual([...names(view)].sort(), currentOpenings.map(shop => shop.name).sort(), 'every shop once');
  assert.deepEqual(new Set(names(view).slice(-coming.length)), new Set(coming.map(shop => shop.name)), 'confirmed full and trial operation precede announcements');
  for (const shop of currentOpenings) assert.equal(card(view, shop.name).querySelector('.ui-feed-card__title a')!.getAttribute('href'), `/openings/${shop.id}`);
  cleanup();
  assert.equal(render(board('2026-10-19')).container.querySelector('.ui-feed-card__title a')!.textContent, 'Marufuku Ramen\u00a0· Burlingame', 'from 10/11 the newest dated first day leads');
});

test('an open shop never says 即将开业 / Opening soon on its chip, its card or in English (EVT13-02 / H09)', () => {
  for (const today of [TODAY, '2026-10-13', '2026-11-20']) {
    for (const shop of openShops) {
      const chip = openingChip(shop, today);
      assert.doesNotMatch(chip.zh, /即将/, `${today}: ${shop.id}`);
      assert.doesNotMatch(chip.en, /soon/i, `${today}: ${shop.id}`);
    }
  }
  const view = render(board());
  showAll(view);
  const open = section(view, '已开业');
  for (const shop of openShops) {
    const article = card(view, shop.name);
    if (!comingOn(TODAY).includes(shop)) assert.ok(open.contains(article), `${shop.id} is under 已开业`);
    assert.doesNotMatch(article.textContent!, /即将开业/, shop.id);
  }
  const marufuku = canonicalOpening('marufuku-burlingame-announced');
  assert.equal(marufuku.status, 'open');
  assert.equal(marufuku.openedOn, '2026-10-11', 'the store page names 10/11 as the grand opening with service hours');
  assert.equal(marufuku.category, '博多豚骨拉面', 'the sign says what it sells (CNT-SIGNBOARD: "authentic Hakata-style Tonkotsu ramen")');
  assert.deepEqual(openingChip(marufuku, '2026-10-13'), { zh: '10/11 已开业', en: 'Opened Oct 11' }, 'opened, with the day: a month alone read as a forecast');
});

test('soft openings sit under 已开业 with their own words and never inherit an open or announced label', () => {
  assert.ok(softOpenShops.length > 0);
  const view = render(board());
  showAll(view);
  const open = section(view, '已开业');
  for (const shop of softOpenShops) {
    const article = card(view, shop.name);
    assert.ok(open.contains(article), shop.id);
    const when = article.querySelector('.ui-feed-card__when')!;
    assert.match(when.textContent!, shop.openedOn ? /^\d+\/\d+ 起试营业$/ : /^试营业$/, shop.id);
    assert.equal(when.querySelector('.ui-status')!.getAttribute('data-tone'), 'neutral', `${shop.id}: not the 已开业 look`);
    assert.doesNotMatch(article.textContent!, /即将开业/, shop.id);
  }
  const fixture = { status: 'soft_open' as const, openedOn: undefined };
  assert.deepEqual(openingChip(fixture, '2026-11-01'), { zh: '试营业', en: 'Soft opening' }, 'time passing does not make a soft opening open');
  assert.deepEqual(openingChip({ status: 'soft_open', openedOn: '2026-09-04' }, '2026-10-14'), { zh: '9/4 起试营业', en: 'Soft open 9/4' }, 'a dated soft opening is not 已开业');
});

test('the region narrows both sections; a region is never empty here, and 即将开业 lists that region\'s announcements', () => {
  for (const region of ['sf', 'peninsula', 'north-bay', 'east-bay', 'south-bay'] as const) {
    const view = render(board(TODAY, region));
    showAll(view);
    const inRegion = currentOpenings.filter(shop => shop.region === region);
    assert.deepEqual([...names(view)].sort(), inRegion.map(shop => shop.name).sort(), region);
    const soon = section(view, '即将开业');
    const announced = comingOn(TODAY).filter(shop => shop.region === region).map(shop => shop.name);
    assert.deepEqual(soon ? [...soon.querySelectorAll('.ui-feed-card__title a')].map(named).sort() : [], [...announced].sort(), region);
    cleanup();
  }
});

test('passing an announced date or month never silently promotes a forecast to open', () => {
  for (const today of ['2026-10-09', '2026-10-31', '2026-11-15', '2027-01-05']) {
    const view = render(board(today));
    showAll(view);
    const soon = section(view, '即将开业');
    assert.deepEqual([...soon.querySelectorAll('.ui-feed-card__title a')].map(named).sort(), comingOn(today).map(shop => shop.name).sort(), today);
    for (const shop of announcedShops) {
      assert.equal(shop.openedOn, undefined, 'an announcement cannot claim a first-service date');
      assert.match(card(view, shop.name).querySelector('.ui-feed-card__when')!.textContent!, /即将开业$/, `${today}: ${shop.id}`);
    }
    cleanup();
  }
  // A confirmed first day reads as the day it opened; a future one as the expected day.
  assert.deepEqual(openingChip({ status: 'open', openedOn: '2026-08-10' }, TODAY), { zh: '8/10 已开业', en: 'Opened Aug 10' });
  assert.deepEqual(openingChip({ status: 'open', openedOn: '2026-10-20' }, TODAY), { zh: '预计 10/20 开业', en: 'Opening 10/20' });
  // An open shop whose source names no first day is open, not coming (EVT13-02 / H09); only an announcement is 即将开业.
  assert.deepEqual(openingChip({ status: 'open', openedOn: undefined }, TODAY), { zh: '已开业', en: 'Open now' });
  const bakery = canonicalOpening('boulangerie-eria-celebration');
  assert.equal(bakery.status, 'open');
  assert.equal(bakery.openedOn, undefined, 'verified operation does not invent a first-service date');
});

// An approved image published by the venue's operator rather than the merchant's own site (CNT-MEDIA-5): the Presidio Trust runs
// The Mess Hall and credits Erin Ng's photo of Breadwinner's food on its page.
const VENUE_OPERATOR_IMAGES: Readonly<Record<string, string>> = { 'mess-hall-presidio-breadwinner': 'presidio.gov' };

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
    const tier = getCover({ kind: 'opening', id: shop.id, imageKey: shop.imageKey }, coverContext(TODAY)).tier;
    if (registered?.kind === 'illustration' && tier === 'ai') {
      // An AI illustration the owner approved as a ④ cover in chat on 2026-10-21 shows, badged AI 示意图 (or, when the board
      // already shows it within 6 cards, the information card).
      assert.ok(registered.aiCoverApproved, `${shop.id}: only an approved AI illustration`);
      if (img) assert.match(article.querySelector('[data-cover="image"] .ui-provenance')?.textContent ?? '', /^AI 示意图$/, shop.id);
      else assert.ok(article.querySelector('[data-cover="type"]'), `${shop.id} gets the information card`);
    } else if (image && tier !== 'type') {
      assert.ok(image.kind === 'photo' || image.kind === 'poster', `${shop.id} uses factual media`);
      assert.ok(readFileSync(new URL(`../public${image.src}`, import.meta.url)).length > 0, `${shop.id} image file exists`);
      assert.ok(img, `${shop.id} shows its own image`);
      assert.match(img.getAttribute('src')!, new RegExp(image.src.replace(/\.webp$/, '').replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')));
      assert.ok(image.caption.trim() && image.credit.trim());
      if (reviewed.has(shop.id)) assert.equal(new URL(image.creditUrl!).hostname, VENUE_OPERATOR_IMAGES[shop.id] ?? new URL(shop.officialUrl).hostname, `${shop.id} image is attributed to this merchant`);
      const fit = article.querySelector('[data-cover="image"]')!.getAttribute('data-fit');
      assert.equal(fit, image.kind === 'poster' || image.fullFrame ? 'contain' : 'cover', `${shop.id}: posters and full-frame photos are never cropped`);
    } else {
      assert.ok(img === null, `${shop.id} has no unrelated, synthetic or unlicensed picture`);
      assert.ok(article.querySelector('[data-cover="type"]'), `${shop.id} gets the information card`);
      if (registered?.kind === 'illustration') assert.equal(article.textContent!.includes(registered.caption), false, 'hidden synthetic artwork leaves no picture caption');
    }
    // DECISIONS 17: a press source reads 媒体报道 · M/D 核对, never 官网核对.
    assert.match(article.querySelector('.ui-feed-card__trust')!.textContent!, pressSourced(shop.sourceLabel) ? /^媒体报道\u00a0· \d+\/\d+ 核对$/ : /^官网核对 \d+\/\d+$/, shop.id);
  }
  for (const id of ['kaiyo-handroll-union', 'marufuku-burlingame-announced', 'broken-dreams-oakland']) {
    const image = GUIDE_IMAGES[canonicalOpening(id).imageKey];
    assert.ok(image.kind === 'poster' || image.fullFrame, `${id} requires its complete artwork or photo`);
  }
  // CNT-MEDIA-5 (owner approval 2026-10-19): these two now show official images, the Presidio Trust's photo of Breadwinner's food
  // and Hijau Coffee's opening graphic from the page of the group that played its opening; both are labelled 官方图.
  assert.equal(GUIDE_IMAGES[canonicalOpening('mess-hall-presidio-breadwinner').imageKey].kind, 'photo');
  assert.equal(GUIDE_IMAGES[canonicalOpening('hijau-san-jose-storefront').imageKey].kind, 'poster');
  const brokenDreams = canonicalOpening('broken-dreams-oakland');
  assert.equal(brokenDreams.openedOn, '2026-08-10');
  assert.match(brokenDreams.editorTip, /周末暂休/);
  const marufuku = canonicalOpening('marufuku-burlingame-announced');
  // 2026-10-12 (CNT-HOTFIX): open after the 10/11 grand opening, with the regular hours the store page lists from 10/12.
  assert.equal(marufuku.status, 'open');
  assert.match(marufuku.dateLabel, /10\/11.*Grand Opening.*10\/12.*11:00.*14:00.*17:00.*21:00/);
  // 2026-10-13 (WEB-FIX5, H09): the store page lists the 10/11 grand opening with its service hours, so 10/11 is the first
  // day of public service (the location list still says Coming Soon; the store page is the more specific source).
  assert.equal(marufuku.openedOn, '2026-10-11');
  assert.equal(marufuku.sourceUrl, 'https://www.marufukuramen.com/burlingame');
  assert.equal(marufuku.address, '225 Lorton Ave, Burlingame, CA 94010');
  assert.match(GUIDE_IMAGES[marufuku.imageKey].caption, /宣传图.*不是开业当天/);
});

test('unavailable and inherited opening image keys safely fall back to the information card', () => {
  const shop = INDEX_OPENINGS[0];
  // 'settling' is an AI illustration the owner has not approved as a cover ('family-workshop' was approved on 2026-10-21).
  for (const imageKey of ['unregistered-opening-test-image', '__proto__', 'constructor', 'settling']) {
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
