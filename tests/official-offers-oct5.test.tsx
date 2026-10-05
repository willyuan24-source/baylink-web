import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import test, { afterEach } from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';
import type { FreebieOffer } from '../src/components/FreebieBoard';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://www.baylink.us/', pretendToBeVisual: true });
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement,
  Node: dom.window.Node, localStorage: dom.window.localStorage, IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });

const { render, fireEvent, cleanup, within } = await import('@testing-library/react');
const { FreebieBoard } = await import('../src/components/FreebieBoard');
const { currentFreebies } = await import('../src/data/october-offers');
const { verifiedOffers20261005 } = await import('../src/data/verified-offers-2026-10-05');
const { guides, getGuideBySlug } = await import('../src/data/guides');
const { GUIDE_IMAGES } = await import('../src/data/guide-media');
const { getOfferImage } = await import('../src/lib/offer-media');
const { searchQuickDestinations } = await import('../src/lib/quick-search');
const { loadLocale, setLocale, translateText } = await import('../src/i18n/locale');

const reviewed = verifiedOffers20261005.map(offer => {
  const published = currentFreebies.find(candidate => candidate.id === offer.id);
  assert.ok(published, offer.id);
  return published;
});
const moneyId = 'lowes-money-days-prizes-oct10-11-2026';
const planeId = 'lowes-firefighting-plane-oct17';
const today = '2026-10-05';
const stringsIn = (value: unknown): string[] => typeof value === 'string' ? [value]
  : value && typeof value === 'object' ? Object.values(value).flatMap(stringsIn) : [];

afterEach(async () => { cleanup(); await setLocale('zh-Hans', false); });

test('all 12 additions publish once without dropping any of the 194 previously released offer IDs', () => {
  assert.equal(verifiedOffers20261005.length, 12);
  assert.equal(new Set(currentFreebies.map(offer => offer.id)).size, currentFreebies.length);
  assert.equal(releasedOfferIds.length, 194);
  for (const id of releasedOfferIds) assert.ok(currentFreebies.some(offer => offer.id === id), 'released URL lost: ' + id);
  for (const offer of verifiedOffers20261005) {
    assert.equal(currentFreebies.filter(candidate => candidate.id === offer.id).length, 1, offer.id);
    assert.ok(!releasedOfferIds.includes(offer.id), 'addition duplicates the released baseline: ' + offer.id);
    assert.equal(offer.verifiedAt, today);
    if (offer.availability === 'dated') {
      assert.match(offer.startDate || '', /^\d{4}-\d{2}-\d{2}$/);
      assert.match(offer.endDate || '', /^\d{4}-\d{2}-\d{2}$/);
      assert.ok(offer.startDate! <= offer.endDate!, offer.id);
    }
  }
});

test('retail and both monthly guides receive additions, and all guide boards resolve the corrected Lowe’s photo', () => {
  for (const slug of ['bay-area-retail-freebies-family-deals', 'bay-area-freebies-deals-2026-10', 'bay-area-freebies-deals-2026-11']) {
    const guide = getGuideBySlug(slug);
    assert.ok(guide, slug);
    const offers = guide.blocks.flatMap(block => block.type === 'freebies' ? block.offers : []);
    for (const added of reviewed) assert.equal(offers.filter(offer => offer.id === added.id).length, 1, slug + ': ' + added.id);
  }
  const boards = guides.flatMap(guide => guide.blocks.filter(block => block.type === 'freebies'));
  assert.ok(boards.length >= 3, 'the retail and October/November boards remain present');
  for (const board of boards) {
    for (const offer of board.offers.filter(offer => offer.id === planeId)) {
      assert.equal(offer.imageKey, 'official-lowes-firefighting-plane-2026');
      assert.equal(getOfferImage(offer)?.kind, 'photo');
    }
  }
});

test('reviewed offers retain primary sources, explicit costs and the exact official project photograph', () => {
  const allowedHosts = new Set(['www.lowes.com', 'shakeshack.com', 'www.wendys.com', 'smashburger.com', 'modpizza.com', 'www.prnewswire.com', 'news.dunkindonuts.com']);
  for (const offer of reviewed) {
    assert.equal(new URL(offer.sourceUrl).protocol, 'https:');
    assert.ok(allowedHosts.has(new URL(offer.sourceUrl).hostname), offer.id);
    assert.ok(offer.requirement && offer.description && offer.storeUrl, offer.id);
    const image = getOfferImage(offer);
    if (image) {
      assert.notEqual(image.kind, 'illustration', offer.id);
      assert.ok(existsSync('public' + image.src), offer.id + ': missing image');
      assert.ok(image.creditUrl && image.caption, offer.id + ': image provenance');
    }
  }
  assert.equal(reviewed.find(offer => offer.id === 'wendys-boo-books-2026')?.kind, 'purchase', 'buying the coupon book is a purchase');
  assert.match(reviewed.find(offer => offer.id === 'shake-shack-scarygood-oct2026')!.requirement, /\$10/);
  assert.equal(reviewed.find(offer => offer.id === 'dunkin-six-dollar-meal-fall-2026')?.endDate, undefined, 'do not invent an undisclosed expiry');
  const plane = currentFreebies.find(offer => offer.id === planeId)!;
  assert.equal(plane.imageKey, 'official-lowes-firefighting-plane-2026');
  const image = getOfferImage(plane)!;
  assert.equal(image.kind, 'photo');
  assert.equal(image.creditUrl, 'https://www.lowes.com/events/register/firefighting-plane');
  assert.match(image.alt, /消防飞机/);
  assert.ok(existsSync('public' + image.src));
  const view = render(<FreebieBoard offers={[plane]} today={today} />);
  assert.equal(within(view.getByRole('article', { name: plane.title })).getByRole('img').getAttribute('src'), image.src);
  assert.match(view.container.querySelector('figcaption')?.textContent || '', /官方宣传照片/);
  assert.equal(view.queryByText(/AI 原创插图/), null);
});

test('unconfirmed prize conditions cannot enter no-purchase filters or free-only discovery', () => {
  const money = reviewed.find(offer => offer.id === moneyId)!;
  assert.equal(money.kind, 'check-terms');
  assert.match(money.requirement, /购买条件.*尚未公开核实/);
  const view = render(<FreebieBoard offers={reviewed} today={today} />);
  assert.ok(view.getByRole('article', { name: money.title }), 'the confirmed dated event remains discoverable');
  const filters = within(view.getByRole('group', { name: '按领取条件筛选' }));
  fireEvent.click(filters.getByRole('button', { name: '无需购物', exact: true }));
  assert.equal(view.queryByRole('article', { name: money.title }), null);
  assert.equal(view.getAllByRole('article').length, 3, 'the three PetSmart sessions remain genuinely free');
  fireEvent.click(filters.getByRole('button', { name: '条件待核对', exact: true }));
  assert.deepEqual(view.getAllByRole('article').map(card => card.id), ['offer-' + moneyId]);

  assert.ok(searchQuickDestinations('Money Days', 'zh-Hans', today).offers.some(offer => offer.id === moneyId));
  for (const query of ['免费', 'free', '免费 Lowe', 'free Money Days']) {
    const results = searchQuickDestinations(query, 'zh-Hans', today);
    assert.equal(results.queryInfo.freeOnly, true, query);
    assert.ok(!results.offers.some(offer => offer.id === moneyId), query);
  }
  assert.ok(searchQuickDestinations('免费 PetSmart', 'zh-Hans', today).offers.some(offer => offer.id === 'petsmart-tricks-treats-oct17-2026'));
});

test('new offer text, image notes and the new condition label have loaded English translations', async () => {
  await loadLocale('en');
  for (const value of stringsIn(reviewed).concat('条件待核对').filter(value => /\p{Script=Han}/u.test(value))) {
    assert.doesNotMatch(translateText(value, 'en'), /\p{Script=Han}/u, 'missing translation: ' + value);
  }
});

test('missing media and rejected AI artwork keep cards usable without an unrelated fallback', () => {
  assert.equal(GUIDE_IMAGES['family-workshop'].kind, 'illustration');
  const fixtures: FreebieOffer[] = [
    { ...reviewed[0], id: 'missing-official-image-fixture', title: 'Missing official image fixture', imageKey: 'missing-official-image-key' },
    { ...reviewed[0], id: 'rejected-ai-image-fixture', title: 'Rejected AI image fixture', imageKey: 'family-workshop' },
  ];
  const view = render(<FreebieBoard offers={fixtures} today={today} />);
  for (const offer of fixtures) {
    assert.equal(getOfferImage(offer), undefined);
    const card = within(view.getByRole('article', { name: offer.title }));
    assert.equal(card.queryByRole('img'), null);
    assert.equal(card.queryByRole('button', { name: /放大/ }), null);
    assert.ok(card.getByText(offer.requirement));
    assert.equal(card.getByRole('link', { name: offer.brand + '：' + offer.sourceLabel }).getAttribute('href'), offer.sourceUrl);
  }
});

// Frozen production baseline from 9d675d12acb4961272b9dff2f25f2df5a62ce677,
// public/discovery-context.json (194 kind=offer records). No Git/network dependency at test time.
const releasedOfferIds = [
  "target-beauty-sep26",
  "michaels-ghosts-sep26",
  "lowes-kids-lollipop",
  "ikea-family-hot-drink",
  "sephora-birthday",
  "85c-september-cake",
  "homedepot-october-preview",
  "peets-orange-friday-sep25",
  "peets-cold-brew-pass-september",
  "starbucks-cafe-refills",
  "bampfa-free-oct1",
  "sjma-free-oct2",
  "chm-museums-on-us-oct3-4",
  "omca-free-oct4",
  "asian-art-free-oct4",
  "conservatory-free-oct6",
  "botanical-free-oct13",
  "lowes-firefighting-plane-oct17",
  "yogurtland-anniversary-oct20",
  "svma-free-wednesdays-october",
  "japanese-tea-garden-free-hour",
  "sfpl-discover-go",
  "smcl-discover-go",
  "alameda-county-discover-go",
  "santa-clara-library-parks-pass",
  "sonoma-county-museum-family-oct10",
  "sfmoma-family-oct25",
  "cantor-stanford-free",
  "sfpl-radon-detector-loan",
  "berkeley-tool-lending",
  "ikea-emeryville-as-is-wednesdays",
  "poppy-claro-doggie-dinners-fall",
  "peets-coffee-day-sep29",
  "happy-hollow-senior-safari-oct22",
  "muir-woods-fee-free-oct27",
  "chabot-free-telescopes",
  "randall-museum-free",
  "triton-museum-free",
  "anderson-stanford-free",
  "curiodyssey-museums-for-all",
  "exploratorium-for-all-five",
  "lawrence-museums-for-all",
  "sonoma-library-regional-parks",
  "sonoma-library-discover-go",
  "muni-youth-free",
  "clipper-start-half-fares",
  "sfmoma-museums-for-all",
  "cable-car-museum-free",
  "oakland-tool-library",
  "rosie-riveter-richmond-free",
  "chicha-berkeley-bogo-sep25",
  "onigilly-valley-fair-anniversary-sep26-27",
  "chicha-norcal-birthday-bogo",
  "chicha-cupertino-free-tea-tasting",
  "amc-stubs-tuesday-wednesday-base-ticket",
  "museo-italo-free-days",
  "history-smc-free-oct2",
  "sjpl-booktacular-oct24-31",
  "oakland-zoo-resident-discount",
  "marin-transit-clean-air-oct7-2026",
  "napa-costume-exchange-oct3-2026",
  "sf-zoo-resident-free-oct7-2026",
  "hayward-compost-giveaway-oct24-2026",
  "woodside-compost-workshop-gift-oct12-2026",
  "ikea-family-heritage-meal-oct15-2026",
  "ikea-kustfyr-halloween-oct12-2026",
  "smart-youth-senior-fare-free",
  "tech-teachers-tacos-oct23-2026",
  "concord-taco-trail-challenge-2026",
  "san-jose-airport-coffee-day-2026",
  "sf-opera-dolby-figaro-offer-2026",
  "emeryville-restaurant-week-2026",
  "pixels-thirsty-thursday-20261001",
  "sf-moad-free-thursday-oct1-2026",
  "san-leandro-fall-book-sale-2026",
  "station-house-happy-hour-20261002",
  "newark-free-shredding-2026",
  "pacific-catch-aloha-corte-madera-20261005",
  "berkeley-cal-golden-bear-oct-sale-2026",
  "sf-moad-thrive-second-saturday-oct2026",
  "san-leandro-costume-swap-2026",
  "sf-greyhound-trivia-happy-hour-2026",
  "union-city-kennedy-youth-free-dropin",
  "el-cerrito-rialto-monday-offer",
  "r2-santarosa-capriciano-corkage-policy-2026",
  "r2-kenwood-stella-weekly-offers-2026",
  "san-mateo-curiodyssey-teacher-military-ongoing",
  "san-mateo-jacks-happy-hour-ongoing",
  "cupertino-eureka-wednesday-burger-ongoing",
  "mountain-view-pacific-catch-aloha-hour-ongoing",
  "sunnyvale-st-johns-happy-hour-ongoing",
  "san-jose-tech-military-admission-ongoing",
  "san-jose-tech-second-half-off-ongoing",
  "noahs-rewards-order-ahead-coffee",
  "ikes-love-welcome-sandwich",
  "nothing-bundt-cakes-birthday-bundtlet",
  "jamba-welcome-half-price",
  "caltrain-youth-dollar-fare",
  "sfmta-free-muni-seniors",
  "chase-center-ticket-muni-included",
  "south-novato-the-shop-free-makerspace",
  "marin-city-the-lab-free-makerspace",
  "ybca-free-wednesdays",
  "presidio-field-station-free",
  "sf-city-guides-free-walks",
  "sfmoma-free-public-art-spaces",
  "gggp-sf-resident-free-admission",
  "famsf-bay-area-free-saturdays",
  "roundup-starbucks-birthday-2026",
  "roundup-starbucks-free-mod-2026",
  "roundup-mcdonalds-medium-fries-oct4-2026",
  "roundup-krispy-kreme-welcome-2026",
  "roundup-jersey-mikes-birthday-points-2026",
  "roundup-wendys-weekly-app-offers-2026",
  "roundup-ulta-birthday-gift-2026",
  "roundup-ihop-birthday-pancoins-2026",
  "roundup-red-robin-kids-birthday-2026",
  "dutch-bros-birthday-2026",
  "chick-fil-a-birthday-2026",
  "panera-birthday-2026",
  "amc-birthday-popcorn-2026",
  "sfpl-kanopy-streaming",
  "sfpl-linkedin-learning",
  "ac-library-free-printing",
  "tilden-little-farm-free",
  "richmond-art-center-free",
  "smcl-free-printing",
  "palo-alto-art-center-free",
  "sjpl-free-seed-library",
  "intel-museum-free",
  "marin-library-parking-passes",
  "marine-mammal-center-free",
  "target-eos-pouch-oct10-2026",
  "target-acotar-keychain-oct26-2026",
  "target-circle-deal-days-oct6-7-2026",
  "target-circle-new-member-oct5-2026",
  "target-baby-welcome-kit-2026",
  "target-circle-birthday-discount-2026",
  "target-registry-completion-discount-2026",
  "lowes-mrbeast-swarms-oct24-2026",
  "lowes-holiday-engine-nov14-2026",
  "lowes-holiday-trolley-dec12-2026",
  "lowes-winter-play-lodge-jan16-2027",
  "lowes-senior-builder-toolbag-2026",
  "lowes-member-gifts-check-local-2026",
  "michaels-yarn-frame-oct10-2026",
  "michaels-ghost-jar-oct11-2026",
  "michaels-halloween-fest-oct17-2026",
  "michaels-halloween-lantern-oct18-2026",
  "michaels-chenille-ghost-oct24-2026",
  "michaels-costume-demo-oct25-2026",
  "lakeshore-castle-oct10-2026",
  "lakeshore-stained-glass-oct24-2026",
  "lakeshore-mosaic-nov7-2026",
  "lakeshore-cube-buddies-nov21-2026",
  "lakeshore-keepsakes-dec5-2026",
  "ikea-kids-eat-free-wednesdays-oct2026",
  "ikea-cinnamon-buns-oct9-2026",
  "ikea-soup-addon-nov11-2026",
  "ikea-kids-beds-oct12-2026",
  "lego-hillsdale-little-builders",
  "lego-free-kids-magazine",
  "apple-kids-earth-comics",
  "apple-kids-kindness-story",
  "homedepot-monthly-kids-workshops",
  "world-market-zombie-reward-oct31-2026",
  "taco-bell-welcome-reward-2026",
  "mcdonalds-new-app-nuggets-2026",
  "peets-welcome-125-points-2026",
  "peets-birthday-drink-2026",
  "habit-charclub-welcome-burger-2026",
  "habit-charclub-registration-sundae-2026",
  "chipotle-welcome-chips-guac-2026",
  "crumbl-silver-birthday-2026",
  "dunkin-survey-donut-2026",
  "world-market-welcome-15-percent-2026",
  "petsmart-first-autoship-2026",
  "petco-first-autoship-2026",
  "cold-stone-welcome-bogo-2026",
  "cinnabon-welcome-bonbites-2026",
  "auntie-annes-welcome-pretzel-2026",
  "auntie-annes-birthday-pretzel-2026",
  "bampfa-free-nov5-2026",
  "omca-free-nov1-2026",
  "asian-art-free-nov1-2026",
  "conservatory-free-nov3-2026",
  "sjma-free-nov6-2026",
  "chm-museums-on-us-nov7-8-2026",
  "botanical-free-nov10-2026",
  "moad-free-nov14-2026",
  "muir-woods-veterans-day-nov11-2026",
  "chilis-veterans-day-nov11-2026",
  "winchester-santa-clara-locals-2026",
  "lakeshore-halloween-craft-oct25-31-2026"
];
