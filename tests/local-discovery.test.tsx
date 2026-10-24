import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test, { after, afterEach, beforeEach } from 'node:test';
import { JSDOM } from 'jsdom';
import React, { Suspense } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { LocalDiscovery } from '../src/data/local-discoveries';
import { MONTHLY_EVENTS } from '../src/data/monthly-edition';
import { currentFreebies } from '../src/data/october-offers';

const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'https://www.baylink.us/this-month' });
const globals = {
  window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
  HTMLElement: dom.window.HTMLElement, Node: dom.window.Node,
  localStorage: dom.window.localStorage, IS_REACT_ACT_ENVIRONMENT: true,
};
const previousGlobals = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
const { render, fireEvent, cleanup, waitFor } = await import('@testing-library/react');
const { MemoryRouter, StaticRouter, Routes, Route, Link } = await import('react-router-dom');
const { localDiscoveries, currentOpenings, getLocalDiscovery, discoveryShare } = await import('../src/data/local-discoveries');
const { getDiscoveryMetadata } = await import('../src/lib/discovery-metadata');
const { eventOffers, eventTimes } = await import('../src/lib/schema-org');
const { listingEndedDaysAgo } = await import('../src/lib/listing-lifecycle');
const { getBayAreaToday } = await import('../src/lib/monthly');
const { renderMetadataHtml, SITE_URL, DEFAULT_SOCIAL_IMAGE, configureMetadataLanguage } = await import('../src/lib/seo');
const { shareCardPath } = await import('../src/lib/editorial-share');
const { brandCase } = await import('../src/lib/event-facts');
const { LocalDiscoveryDetail } = await import('../src/components/LocalDiscoveryDetail');
// An offer's and an opening's facts are their own chunk (shop-parts.ts); importing it registers them.
await import('../src/features/detail/ShopFacts');
const { buildDetailRecord } = await import('../src/features/detail/build-detail');
const { nextEventDay, unconfirmedEvent } = await import('../src/features/detail/detail-record');
const { heroCover } = await import('../src/features/detail/hero-cover');
const { hasEditorNote, readerCost, readerPlanLines, readerProse, readerSentences } = await import('../src/features/detail/reader-text');
const { GUIDE_IMAGES } = await import('../src/data/guide-media');
const { default: LocalDiscoveryPage } = await import('../src/pages/LocalDiscoveryPage');
const { api } = await import('../src/lib/api');
const { setLocale, translateText } = await import('../src/i18n/locale');
const { isKnownAppPath, tabFromPathname } = await import('../src/routing');

const folders = { event: 'events', offer: 'offers', opening: 'openings' } as const;
const find = <K extends LocalDiscovery['kind']>(kind: K, predicate: (item: Extract<LocalDiscovery, { kind: K }>) => boolean = () => true) => {
  const found = localDiscoveries.find(item => item.kind === kind && predicate(item as Extract<LocalDiscovery, { kind: K }>));
  assert.ok(found, 'published ' + kind + ' fixture exists');
  return found as Extract<LocalDiscovery, { kind: K }>;
};
const eventItem = find('event', item => item.event.id === 'san-jose-avenida-altares-2026');
const offerItem = find('offer', item => !!item.offer.endDate && !!item.offer.storeUrl);
const openShop = find('opening', item => item.shop.status === 'open' && item.shop.officialUrl !== item.shop.sourceUrl);
const announcedShop = find('opening', item => item.shop.status === 'announced');
const nextDay = (value: string) => {
  const date = new Date(value + 'T12:00:00Z');
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
};
const detail = (item: LocalDiscovery, today = '2026-09-15') =>
  <MemoryRouter><LocalDiscoveryDetail record={buildDetailRecord(item)} today={today} /></MemoryRouter>;

test('soft opening details and share metadata preserve trial operation without claiming a grand opening', () => {
  const item: LocalDiscovery = { kind: 'opening', shop: { ...openShop.shop, status: 'soft_open', openedOn: undefined, dateLabel: '试营业 · 正式开业日未确认' } };
  assert.equal(discoveryShare(item).label, '新店 · 试营业');
  const view = render(detail(item, '2026-10-15'));
  // C P16 (UI9-R2-DETAIL): the status is the chip's; the 开业 note keeps its advice without the status word.
  assert.ok(view.getByText('营业时段与菜单可能调整，出发前请查商家公告。'));
  assert.equal(Boolean(view.queryByText(/当天营业与订位请查商家入口/)), false);
  assert.equal(Boolean(view.queryByText(/尚未确认正式营业/)), false);
});
const canonical = (doc: Document | DocumentFragment) => doc.querySelector('link[rel="canonical"]')?.getAttribute('href');
const meta = (doc: Document | DocumentFragment, name: string) => doc.querySelector('meta[property="' + name + '"],meta[name="' + name + '"]')?.getAttribute('content');
/** The official link: the bar's primary when it is the official page, else the facts card's 何时 / 开业 slot (UI9-DETAIL). */
const officialLink = (root: ParentNode) => root.querySelector('.site-detail-actions a[target="_blank"], [data-fact="when"] dt a[target="_blank"]') as HTMLAnchorElement;
/** An opening's H1 drops a " · City" tail that is the shop's own city (P26: the city is the sub line). */
const openingHeading = (name: string, city: string) => name.endsWith(` · ${city}`) ? name.slice(0, -(city.length + 3)) : name;
const assertExternal = (link: HTMLElement, href: string) => {
  assert.equal(link.getAttribute('href'), href);
  assert.equal(link.getAttribute('target'), '_blank');
  assert.match(link.getAttribute('rel')!, /\bnoopener\b/);
  assert.match(link.getAttribute('rel')!, /\bnoreferrer\b/);
};

beforeEach(async () => {
  await setLocale('zh-Hans', false);
  configureMetadataLanguage('zh_CN', text => text, data => data);
  document.head.innerHTML = '';
});
afterEach(() => { cleanup(); document.head.innerHTML = ''; });
after(() => {
  dom.window.close();
  for (const [key, descriptor] of previousGlobals) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
});

test('all published discoveries have unique IDs and category-specific routes that resolve back to the same record', () => {
  assert.ok(localDiscoveries.length >= 99);
  assert.deepEqual(localDiscoveries.reduce<Record<string, number>>((counts, item) => {
    counts[item.kind] = (counts[item.kind] || 0) + 1;
    return counts;
  }, {}), { event: MONTHLY_EVENTS.length, offer: currentFreebies.length, opening: currentOpenings.length });
  const ids = new Set<string>(), paths = new Set<string>();
  for (const item of localDiscoveries) {
    const share = discoveryShare(item);
    assert.match(share.id, /^[a-z0-9-]+$/);
    assert.equal(ids.has(share.id), false, share.id + ' is not reused by another discovery');
    ids.add(share.id);
    const expectedPath = '/' + folders[item.kind] + '/' + share.id;
    assert.equal(share.path, expectedPath);
    assert.equal(paths.has(share.path), false, 'unique recipient page');
    paths.add(share.path);
    assert.equal(getLocalDiscovery(item.kind, share.id), item);
    for (const otherKind of Object.keys(folders).filter(kind => kind !== item.kind)) {
      assert.equal(getLocalDiscovery(otherKind, share.id), undefined, 'a valid ID cannot resolve under a different content kind');
    }
  }
  for (const id of ['unknown', '../' + eventItem.event.id, eventItem.event.id + '/other', eventItem.event.id.toUpperCase()]) {
    assert.equal(getLocalDiscovery('event', id), undefined);
  }
});

test('hosting rules resolve every detail and optional trailing slash without accepting unknown or nested paths', () => {
  const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8')) as { routes: { src?: string; dest?: string }[] };
  for (const [kind, folder] of Object.entries(folders)) {
    const rules = config.routes.filter(route => route.dest === '/' + folder + '/$1.html');
    assert.ok(rules.length >= 1, 'static hosting groups exist for ' + folder);
    const patterns = rules.map(rule => {
      assert.ok(rule.src!.length <= 4096, 'each route satisfies the Vercel schema limit');
      return new RegExp(rule.src!);
    });
    for (const item of localDiscoveries.filter(item => item.kind === kind)) {
      const share = discoveryShare(item);
      for (const path of [share.path, share.path + '/']) {
        const matches = patterns.map((pattern, index) => ({ match: pattern.exec(path), index })).filter(result => result.match);
        assert.equal(matches.length, 1, path + ' reaches exactly one static page');
        const { match, index } = matches[0];
        assert.ok(match);
        assert.equal(match[1], share.id);
        assert.equal(path.replace(patterns[index], rules[index].dest!), share.path + '.html');
      }
      assert.equal(patterns.some(pattern => pattern.test(share.path + '/nested')), false);
      assert.equal(patterns.some(pattern => pattern.test(share.path + '.html')), false, 'the application route is extensionless');
    }
    for (const path of ['/' + folder + '/unknown-discovery', '/' + folder + '/../this-month', '/' + folder + '/', '/other/' + discoveryShare(eventItem).id]) {
      assert.equal(patterns.some(pattern => pattern.test(path)), false, path + ' must not match a discovery rewrite');
    }
  }
});

test('all recipient paths are known app routes and select the guide navigation without accepting invalid roots', () => {
  for (const item of localDiscoveries) {
    const path = discoveryShare(item).path;
    for (const candidate of [path, path + '/']) {
      assert.equal(isKnownAppPath(candidate), true, candidate + ' is recognized by the app layout');
      assert.equal(tabFromPathname(candidate), 'guides', candidate + ' keeps local discovery in guide navigation');
    }
    assert.equal(isKnownAppPath(path + '/nested'), false, 'detail routes accept exactly one ID segment');
  }
  // /events is the 活动 column (WEB-ROUTES); offers and openings have no root listing page yet
  assert.equal(isKnownAppPath('/events'), true);
  assert.equal(isKnownAppPath('/events/'), true);
  assert.equal(isKnownAppPath('/events//'), false);
  for (const root of ['/offers', '/openings']) {
    assert.equal(isKnownAppPath(root), false, root + ' has no root listing page');
    assert.equal(isKnownAppPath(root + '/'), false);
    assert.equal(isKnownAppPath(root + '//'), false);
    assert.equal(tabFromPathname(root), 'home', 'a bare unsupported root is not a detail page');
  }
  for (const path of ['/event/example', '/offer/example', '/opening/example', '/events-archive/example', '/unknown/events/example']) {
    assert.equal(isKnownAppPath(path), false, path);
    assert.equal(tabFromPathname(path), 'home', path + ' cannot match a discovery prefix accidentally');
  }
});

test('every public discovery has a unique same-site PNG share URL without requiring generated build assets', () => {
  const paths = new Set<string>(), urls = new Set<string>();
  for (const item of localDiscoveries) {
    const share = discoveryShare(item);
    const path = shareCardPath(share);
    assert.equal(path, '/share-cards/' + item.kind + '-' + share.id + '.png');
    assert.equal(paths.has(path), false, 'different recipient pages cannot share one image path');
    paths.add(path);
    assert.equal(getDiscoveryMetadata(item).image, path, 'metadata selects the matching content card');
    const url = new URL(path, SITE_URL);
    assert.equal(url.origin, SITE_URL);
    assert.equal(url.search, '');
    assert.equal(url.hash, '');
    assert.equal(url.href, SITE_URL + path);
    assert.notEqual(url.href, DEFAULT_SOCIAL_IMAGE);
    assert.equal(urls.has(url.href), false);
    urls.add(url.href);
  }
  assert.equal(paths.size, localDiscoveries.length);
  assert.equal(urls.size, localDiscoveries.length);
});

test('all detail pages server-render full content with matching canonical, OG, Twitter and factual Event or Article metadata', async t => {
  const request = t.mock.method(api, 'request', async () => { throw new Error('Prerender cannot request engagement'); });
  const fetch = t.mock.method(globalThis, 'fetch', async () => { throw new Error('Prerender cannot use the network'); });
  const today = '2026-09-15';
  const squash = (text: string) => text.replace(/\s+/g, '');
  for (const item of localDiscoveries) {
    const share = discoveryShare(item);
    const record = buildDetailRecord(item);
    const metadata = record.metadata;
    assert.deepEqual(metadata, getDiscoveryMetadata(item), 'the generated record carries the same page head as the catalog');
    const expectedUrl = SITE_URL + '/' + folders[item.kind] + '/' + share.id;
    const expectedImage = SITE_URL + '/share-cards/' + item.kind + '-' + share.id + '.png';
    const body = renderToStaticMarkup(<StaticRouter location={share.path}><LocalDiscoveryDetail record={record} today={today} /></StaticRouter>);
    // One shared fragment parser covers every page without allocating hundreds of browser windows.
    const page = JSDOM.fragment(renderMetadataHtml(metadata) + body);
    try {
    const doc = page;
    assert.equal(doc.querySelectorAll('h1').length, 1, share.id);
    // H57: an event's H1 drops the age prefix its age chip already shows ("21+ · …").
    const ageChip = item.kind === 'event' ? item.event.ageChip : undefined;
    const heading = ageChip && share.title.startsWith(ageChip) ? share.title.slice(ageChip.length).replace(/^\s*[·•:：|｜–—-]\s*/u, '') || share.title : share.title;
    assert.equal(doc.querySelector('h1')?.textContent, item.kind === 'offer' ? item.offer.title : item.kind === 'opening' ? openingHeading(heading, item.shop.city) : heading);
    // An offer's page name shows its brand as the page does ("SFMTA · San Francisco"), not the catalog's capitals (PROD-W3).
    const pageName = item.kind === 'offer' ? `${brandCase(item.offer.brand)} · ${item.offer.title}` : share.title;
    // The <title> is the full page name, or for one wider than a search result shows (38 display units with the brand) the
    // reviewed short title + brand (I18N-SEO-11, seo.ts); the share titles keep the full one.
    const width = [...pageName + '｜BAYLINK'].reduce((sum, character) => sum + (/[\u2e80-\uffff]/.test(character) ? 1 : 0.5), 0);
    const short = item.kind === 'event' && item.event.shortTitle && width > 38 ? item.event.shortTitle : undefined;
    assert.equal(doc.querySelector('title')?.textContent, (short ?? pageName) + '｜BAYLINK', share.id);
    assert.equal(canonical(doc), expectedUrl);
    assert.equal(meta(doc, 'og:url'), expectedUrl);
    assert.equal(meta(doc, 'og:type'), 'article');
    assert.equal(meta(doc, 'og:image'), expectedImage);
    assert.equal(meta(doc, 'twitter:image'), expectedImage);
    assert.equal(meta(doc, 'twitter:card'), 'summary_large_image');
    // ended listings stay readable but ask not to be indexed a month after their last day (I18N-SEO-10)
    assert.equal(meta(doc, 'robots'), (listingEndedDaysAgo(item, getBayAreaToday()) ?? -1) > 30 ? 'noindex, follow' : 'index, follow');
    // the share description is complete; the search snippet is its first ~90 characters (I18N-SEO-11)
    assert.ok(meta(doc, 'og:description')!.includes(share.date));
    assert.ok(meta(doc, 'og:description')!.includes(share.area));
    assert.ok(meta(doc, 'og:description')!.includes(share.summary));
    assert.ok(meta(doc, 'og:description')!.startsWith(meta(doc, 'description')!.replace(/…$/, '')));
    const jsonLd = doc.querySelectorAll('script[type="application/ld+json"]');
    assert.equal(jsonLd.length, 1);
    const [entity, breadcrumb] = JSON.parse(jsonLd[0].textContent!);
    if (item.kind === 'event') {
      assert.equal(entity['@type'], 'Event');
      assert.equal(entity.name, share.title);
      assert.equal(entity.url, expectedUrl);
      // the sessions' first start and last end with the Bay Area offset when the overlay states times (schema-org.ts)
      assert.equal(entity.startDate, eventTimes(item.event).startDate);
      assert.equal(entity.endDate, eventTimes(item.event).endDate);
      assert.ok(entity.startDate.startsWith(item.event.sessions?.length && !['postponed', 'cancelled'].includes(item.event.status || '') ? [...item.event.sessions].sort((a, b) => a.date.localeCompare(b.date))[0].date : item.event.startDate));
      assert.equal(entity.location.name, item.event.venue);
      assert.equal(entity.location.address.addressLocality, item.event.city);
      assert.equal(entity.location.address.addressRegion, 'CA');
      assert.equal(entity.location.address.addressCountry, 'US');
      // offers only from a stated price or a free listing: unconfirmed ticket prices are not invented
      assert.deepEqual(entity.offers, eventOffers(item.event));
      if (!item.event.price && item.event.cost !== 'free') assert.equal(Object.hasOwn(entity, 'offers'), false, 'unconfirmed ticket prices are not invented');
      assert.equal(entity.isAccessibleForFree, item.event.cost === 'free' || item.event.price?.free ? true : undefined);
      if (item.event.occurrenceDates?.length && !eventTimes(item.event).sessions.length) assert.deepEqual(entity.subEvent.map((event: { startDate: string }) => event.startDate), item.event.occurrenceDates);
    } else {
      assert.equal(entity['@type'], 'Article');
      assert.equal(entity.headline, pageName);
      assert.equal(entity.mainEntityOfPage, expectedUrl);
      assert.equal(entity.publisher.name, 'BAYLINK');
      assert.equal(entity.publisher.url, SITE_URL);
      assert.equal(entity.author['@type'], 'Organization', 'the editorial desk, never an invented person');
      if (share.checkedAt) assert.ok(entity.dateModified >= share.checkedAt);
      else if (!entity.datePublished) assert.equal(Object.hasOwn(entity, 'dateModified'), false, 'offers without a checked date do not invent one');
    }
    assert.equal(breadcrumb['@type'], 'BreadcrumbList');
    assert.equal(breadcrumb.itemListElement.at(-1).item, expectedUrl);

    const content = doc.querySelector('.local-discovery-detail')!;
    // The hero opens the page: the listing's picture (UI9-IMAGES DECISIONS 21: its next candidate when its own cannot be the cover).
    const main = content.querySelector('.detail-main')!;
    assert.ok(main.firstElementChild?.classList.contains('detail-hero'), share.id + ' opens on its hero');
    const cover = heroCover(record, today);
    const img = content.querySelector('.detail-hero [data-cover="image"] img.ui-cover__img');
    if (cover.tier !== 'type') {
      assert.equal(img?.getAttribute('src'), cover.image.src, share.id);
      assert.equal(img?.getAttribute('alt'), cover.image.alt);
      assert.equal(img?.getAttribute('loading'), 'eager');
      assert.equal(img?.getAttribute('fetchpriority'), 'high');
      // C P08 / N25 (UI9-R2-DETAIL): the credit is plain text on the picture; its links are in 本页图片来源. A ③ credit that
      // repeats its badge ("示意图 · 摄影 …") prints after the badge without the repeat (creditAfterLabel).
      const credit = content.querySelector('.detail-hero .ui-cover > .detail-photo-credit')!;
      assert.ok(squash(credit.textContent!).includes(squash(cover.image.credit.replace(/^示意图 · /, ''))), share.id + ' keeps its photo credit');
      assert.equal(credit.querySelector('a'), null, share.id + ' the credit on the picture is not a link');
      const credits = content.querySelector('#page-credits')!;
      if (cover.image.licenseUrl?.startsWith('https://')) assert.ok([...credits.querySelectorAll('a')].some(a => a.getAttribute('href') === cover.image.licenseUrl));
    } else {
      assert.equal(img, null);
      assert.ok(content.querySelector('.detail-hero [data-cover="type"]'), share.id + ' shows a TypeCover rather than inventing an image');
    }
    assert.equal(content.querySelector('.discovery-detail-brand'), null, 'no masthead');
    if (item.kind === 'event') {
      const over = nextEventDay(record.item.kind === 'event' ? record.item.event : item.event, today) === null && !unconfirmedEvent(record.item.kind === 'event' ? record.item.event : item.event);
      const expected = over ? [] : readerPlanLines(item.event).map(line => readerProse(line, 'zh-Hans')).filter(Boolean);
      assert.deepEqual([...content.querySelectorAll('.detail-plan li p')].map(node => node.textContent), expected, share.id + ': every reader planning line, indexable; none on an ended event');
      const cost = readerCost(item.event.costLabel, item.event.cost, 'zh-Hans');
      // Under the value 费用待确认 the sentence starts at its reason ("费用待核：" is not repeated).
      if (cost) assert.ok(content.querySelector('[data-fact="cost"]')!.textContent!.includes(cost.replace(/^费用待[核定确认]+[：:]\s*/, '')), share.id + ' states its cost');
      const place = item.event.venueShort || item.event.venue;
      assert.ok(typeof place === 'string' && place.trim(), share.id + ' has a venue or explicit location guidance');
      assert.ok(content.textContent!.includes(place), share.id + ' preserves location guidance');
      assert.equal(Boolean(content.querySelector('.event-interest span')), false, 'server HTML does not invent a participant count');
    } else if (item.kind === 'offer') {
      assert.ok(squash(content.textContent!).includes(squash(readerSentences(item.offer.requirement, 'zh-Hans').join(''))), 'redemption conditions are visible before following the offer');
      // The description in order; a line about how current the listing is ("截至…官网可见") follows the list as its note.
      const steps = readerSentences(item.offer.description, 'zh-Hans');
      const note = content.querySelector('.detail-steps__note')?.textContent ?? '';
      const listed = [...content.querySelectorAll('.detail-steps li p')].map(node => node.textContent).join('');
      assert.equal(squash(listed), squash(steps.filter(line => !note.includes(line)).join('')), share.id + ': every step, in order');
      assert.equal(squash(listed + note).length, squash(steps.join('')).length, share.id + ': no sentence lost');
      assert.equal(Boolean(content.querySelector('.event-participation')), false);
    } else {
      assert.ok(squash(content.textContent!).includes(squash(readerProse(item.shop.editorTip, 'zh-Hans'))));
      assert.ok(content.textContent!.includes(item.shop.address));
      // C P16 (UI9-R2-DETAIL): the date line keeps every word except a day's or a time's status the chip already says.
      const dateLine = readerProse(item.shop.dateLabel, 'zh-Hans').replace(/^\s*(?:\d{1,2}\s*月\s*\d{1,2}\s*日|\d{1,2}\/\d{1,2})\s*已开业\s*(?:·\s*|$)/, '')
        .replace(/^(\d{4}\s*年[^·；;，,]*?)\s*已[开营]业(?=\s*(?:·|$))/, '$1').trim();
      assert.ok(content.textContent!.includes(dateLine), share.id);
      assert.equal(Boolean(content.querySelector('.event-participation')), false);
    }
    // Catalog text only (the interface's own loading lines are not editor notes).
    for (const node of content.querySelectorAll('.detail-head, .detail-facts, .detail-summary, .detail-plan li, .detail-conditions li, .detail-steps li, .detail-body section > p')) assert.ok(!hasEditorNote(node.textContent || ''), share.id + ': ' + node.textContent);
    assert.equal(doc.querySelector('link[rel="canonical"]')!.getAttribute('href')!.includes('?'), false);
    } finally { page.replaceChildren(); }
    // Let JSDOM finish detached-document cleanup between catalog entries.
    await new Promise<void>(resolve => setImmediate(resolve));
  }
  assert.equal(request.mock.callCount(), 0);
  assert.equal(fetch.mock.callCount(), 0);
});

test('missing, unknown and inherited image keys leave event, offer and opening details readable', () => {
  for (const item of [eventItem, offerItem, openShop]) {
    for (const imageKey of ['', 'unknown-editorial-image', '__proto__', 'constructor']) {
      const fixture: LocalDiscovery = item.kind === 'event' ? { ...item, event: { ...item.event, imageKey } }
        : item.kind === 'offer' ? { ...item, offer: { ...item.offer, imageKey } }
        : { ...item, shop: { ...item.shop, imageKey } };
      const body = renderToStaticMarkup(<StaticRouter><LocalDiscoveryDetail record={buildDetailRecord(fixture)} today="2026-09-15" /></StaticRouter>);
      const page = new JSDOM(body);
      assert.equal(page.window.document.querySelector('h1')?.textContent, item.kind === 'offer' ? item.offer.title : item.kind === 'opening' ? openingHeading(discoveryShare(item).title, item.shop.city) : discoveryShare(item).title);
      // UI9-IMAGES DECISIONS 21/22: the hero is the record's next candidate (a ③ 示意图 of its kind), never an information card.
      assert.equal(page.window.document.querySelector('.detail-hero [data-cover="type"]'), null);
      assert.ok(page.window.document.querySelector('.detail-hero [data-cover="image"] img'), 'a picture stands in');
      assert.ok(officialLink(page.window.document));
      page.window.close();
    }
  }
});

test('detail H1 wraps between whole words and reads exactly like the translated page title', async () => {
  const marinwood = find('event', item => item.event.id === 'marinwood-halloween-harvest-2026');
  const heading = render(detail(marinwood)).getByRole('heading', { level: 1 });
  assert.equal(heading.textContent, discoveryShare(marinwood).title);
  assert.ok([...heading.querySelectorAll('span.title-keep')].some(span => span.textContent === '万圣节'), 'text-wrap:balance cannot split 万|圣节');
  cleanup();
  await setLocale('zh-Hant', false);
  configureMetadataLanguage('zh_TW', translateText, data => data);
  // Converting each word on its own differs from the whole title here (了解 → 瞭解, 游戲 → 遊戲); the H1 must not.
  for (const id of ['union-city-cert-shakealert-october-2026', 'san-leandro-family-not-spooky-2026']) {
    const share = discoveryShare(find('event', item => item.event.id === id));
    const view = render(<MemoryRouter initialEntries={['/zh-Hant' + share.path]}><Suspense fallback={null}><Routes><Route path="/zh-Hant/events/:id" element={<LocalDiscoveryPage kind="event" />} /></Routes></Suspense></MemoryRouter>);
    const title = await view.findByRole('heading', { level: 1 });
    assert.ok(title.querySelector('span.title-keep'), id);
    assert.equal(title.textContent, translateText(share.title, 'zh-Hant'));
    await waitFor(() => assert.equal(document.title, title.textContent + '｜BAYLINK'));
    view.unmount();
  }
});

test('discovery posters and full-frame photos stay whole on their board in the hero (never cropped, never blurred)', () => {
  const poster = find('event', item => GUIDE_IMAGES[item.event.imageKey]?.kind === 'poster' && heroCover(buildDetailRecord(item), '2026-09-15').tier !== 'type');
  const view = render(detail(poster));
  const cover = view.container.querySelector('.detail-hero [data-cover="image"]')!;
  assert.equal(cover.getAttribute('data-fit'), 'contain', 'posters are shown whole (D25)');
  assert.equal(cover.getAttribute('data-family'), 'poster', 'on a solid board with a white mat (UI9-C, N22)');
  assert.equal(cover.querySelector('img.ui-cover__backdrop'), null, 'no blurred copy');
  assert.equal(cover.querySelector('img.ui-cover__img')?.getAttribute('src'), GUIDE_IMAGES[poster.event.imageKey].src);
  view.unmount();
});

test('event recipients see the facts, the planning lines and the source; the page ends with evergreen links', () => {
  const view = render(detail(eventItem, eventItem.event.endDate));
  assert.equal(view.getByRole('heading', { level: 1 }).textContent, eventItem.event.title);
  const facts = view.container.querySelector('.detail-facts')!;
  assert.deepEqual([...facts.querySelectorAll('dt > span')].map(node => node.textContent), ['何时', '在哪', '多少钱', '适合']);
  assert.ok(facts.textContent!.includes(eventItem.event.venueShort || eventItem.event.venue));
  assert.ok(facts.textContent!.includes(eventItem.event.audience.join(' / ')));
  const lines = readerPlanLines(eventItem.event);
  if (lines.length) {
    assert.ok(view.getByRole('heading', { name: '出发前，做好这些安排' }));
    assert.equal(view.container.querySelectorAll('.detail-plan li').length, lines.length);
  }
  assertExternal(officialLink(view.container), eventItem.event.officialUrl);
  assertExternal(view.getByRole('link', { name: eventItem.event.sourceLabel, exact: true }), eventItem.event.officialUrl);
  assert.ok(view.getByRole('button', { name: '存入日历', exact: true }), 'the final event day is still valid');
  assert.equal(view.getByRole('link', { name: '本周末活动' }).getAttribute('href'), '/events');
  assert.equal(view.getByRole('link', { name: '我的收藏' }).getAttribute('href'), '/my-week#saved');
  assert.equal(view.container.querySelector('.detail-back a')?.getAttribute('href'), '/events');
  assert.equal(view.container.querySelector('.content-review-ended'), null);
});

test('preparation lines drop editor notes and raw URLs but keep every reader fact', () => {
  const selected = find('event', row => row.event.id === 'woodside-djerassi-free-art-hike-oct5-2026');
  const view = render(detail(selected, '2026-09-30'));
  const lines = [...view.container.querySelectorAll('.detail-plan li p')].map(step => step.textContent!);
  assert.equal(lines.length, 4, 'all four notes stay: the last keeps its reader part');
  assert.ok(!lines.some(line => /https?:\/\/|本条/.test(line)), lines.join('\n'));
  assert.ok(lines[3].includes('最低年龄、无障碍条件和剩余名额未确认'));
  view.unmount();
});

test('expired event links stay readable and shareable but cannot be saved, planned or put in a calendar', () => {
  const view = render(detail(eventItem, nextDay(eventItem.event.endDate)));
  assert.match(view.container.querySelector('.content-review-notice')?.textContent || '', /^已结束（/);
  assert.equal(view.getByRole('heading', { level: 1 }).textContent, eventItem.event.title);
  assert.equal(Boolean(view.queryByRole('button', { name: '存入日历', exact: true })), false);
  assert.equal(view.container.querySelector('.site-detail-actions .saves-toggle'), null);
  assert.equal(view.container.querySelector('.event-participation'), null, 'no new interest on an ended event');
  assert.ok(view.getByRole('button', { name: '分享：' + eventItem.event.title, exact: true }));
  assertExternal(view.container.querySelector('.site-detail-actions a[target="_blank"]') as HTMLAnchorElement, eventItem.event.officialUrl);
  assert.equal(view.container.querySelector('.detail-plan'), null, 'the departure checklist is hidden (EVT-11)');
});

test('offer details preserve eligibility and local-store links, while expiry begins after the final redemption day', () => {
  const view = render(detail(offerItem, offerItem.offer.endDate));
  assert.ok(view.getByRole('heading', { name: '先看领取条件' }));
  assert.ok(view.getByRole('heading', { name: '怎么领 · 怎么用' }));
  assertExternal(view.container.querySelector('.site-detail-actions a[target="_blank"]') as HTMLAnchorElement, offerItem.offer.sourceUrl);
  assertExternal(view.getByRole('link', { name: /^查询本地门店/ }), offerItem.offer.storeUrl!);
  assert.equal(view.container.querySelector('.detail-back a')?.getAttribute('href'), '/events?view=perks');
  assert.equal(Boolean(view.queryByText(/已过期/)), false);
  assert.equal(Boolean(view.queryByRole('button', { name: '存入日历', exact: true })), false);
  assert.equal(Boolean(view.container.querySelector('.event-participation')), false);
  assert.ok(view.container.querySelector('.site-detail-actions .saves-toggle'), '♡ on a live offer (FC3-03)');
  view.rerender(detail(offerItem, nextDay(offerItem.offer.endDate!)));
  assert.match(view.container.querySelector('.content-review-notice')?.textContent || '', /^已结束（/);
  assert.ok(view.container.querySelector('section[aria-labelledby="offer-conditions-title"] li'));
  assertExternal(view.container.querySelector('.site-detail-actions a[target="_blank"]') as HTMLAnchorElement, offerItem.offer.sourceUrl);
});

test('offers without end dates retain their actual conditions instead of acquiring an invented expiry', () => {
  for (const availability of ['ongoing', 'check-local'] as const) {
    const item = find('offer', value => value.offer.availability === availability && !value.offer.endDate);
    const view = render(detail(item, '2027-01-01'));
    assert.equal(Boolean(view.queryByText(/已过期/)), false);
    const conditions = [...view.container.querySelectorAll('section[aria-labelledby="offer-conditions-title"] li')].map(li => li.textContent).join('');
    assert.equal(conditions.replace(/\s+/g, ''), readerSentences(item.offer.requirement, 'zh-Hans').join('').replace(/\s+/g, ''), 'every condition, one sentence per item');
    assert.ok(view.container.querySelector('.detail-fact[data-fact="when"]')?.textContent?.includes(readerProse(item.offer.dateLabel, 'zh-Hans')));
    view.unmount();
  }
});

test('opening recipients can distinguish an operating shop from an unconfirmed announcement and inspect both sources', () => {
  for (const item of [openShop, announcedShop]) {
    const view = render(detail(item, '2027-01-01'));
    assert.ok(view.getByRole('heading', { name: '这一趟怎么安排' }));
    assert.ok(view.container.textContent!.includes(item.shop.address));
    assertExternal(officialLink(view.container), item.shop.officialUrl);
    assertExternal(view.getByRole('link', { name: item.shop.sourceLabel, exact: true }), item.shop.sourceUrl);
    // The status note is the 开业 fact's note (UI9-DETAIL), not a box of its own.
    const notice = view.container.querySelector('[data-fact="when"] dd small')?.textContent || '';
    // C P16 (UI9-R2-DETAIL): the chip above the H1 says the status once; the note keeps the advice only.
    assert.doesNotMatch(notice, /已开业|开业预告/);
    if (item.shop.status === 'open') assert.match(notice, /当天营业与订位/);
    else {
      assert.match(notice, /尚未确认正式营业/);
      assert.doesNotMatch(view.container.textContent || '', /已开业/, 'an expected opening date does not automatically confirm operation');
    }
    assert.equal(Boolean(view.queryByText(/已结束|已过期/)), false, 'an opening report is not an expiring event');
    assert.equal(Boolean(view.queryByRole('button', { name: '存入日历', exact: true })), false);
    assert.equal(Boolean(view.container.querySelector('.event-participation')), false);
    assert.equal(view.container.querySelector('.detail-back a')?.getAttribute('href'), '/events?view=openings');
    assert.ok(view.container.querySelector('.site-detail-actions .saves-toggle'), '♡ 收藏 on a new shop (FC3-03)');
    const trust = view.getByRole('note', { name: '来源与核对' });
    assert.equal(trust.querySelector('time')?.getAttribute('datetime'), item.shop.verifiedAt);
    assert.match(trust.textContent || '', item.shop.sourceUrl === item.shop.officialUrl ? /^官方来源/ : /^来源 /, 'a press report is not presented as the official source');
    view.unmount();
  }
});

const RouteHarness = () => <>
  <nav aria-label="fixture navigation">
    <Link to={discoveryShare(eventItem).path + '?from=share&lang=en#planning'}>fixture event</Link>
    <Link to={discoveryShare(offerItem).path + '?from=share'}>fixture offer</Link>
    <Link to={discoveryShare(announcedShop).path}>fixture opening</Link>
    <Link to={'/events/' + discoveryShare(offerItem).id}>fixture wrong kind</Link>
  </nav>
  <Suspense fallback={null}><Routes>
    <Route path="/events/:id" element={<LocalDiscoveryPage kind="event" />} />
    <Route path="/offers/:id" element={<LocalDiscoveryPage kind="offer" />} />
    <Route path="/openings/:id" element={<LocalDiscoveryPage kind="opening" />} />
  </Routes></Suspense>
</>;

test('client recipient navigation replaces category content and metadata, and wrong-kind URLs clear stale article metadata', async () => {
  const view = render(<MemoryRouter initialEntries={[discoveryShare(eventItem).path + '?from=share&lang=en#planning']}><RouteHarness /></MemoryRouter>);
  for (const [label, item] of [['fixture event', eventItem], ['fixture offer', offerItem], ['fixture opening', announcedShop]] as const) {
    fireEvent.click(await view.findByRole('link', { name: label, exact: true }));
    const share = discoveryShare(item);
    // The page shows once its generated record is in (features/detail/load-detail.ts).
    await waitFor(() => assert.equal(view.getByRole('heading', { level: 1 }).textContent, item.kind === 'offer' ? item.offer.title : share.title));
    await waitFor(() => assert.equal(canonical(document), SITE_URL + share.path));
    assert.equal(canonical(document), SITE_URL + share.path, 'attribution, locale query and fragments do not alter canonical URLs');
    assert.equal(meta(document, 'og:url'), SITE_URL + share.path);
    assert.equal(meta(document, 'og:image'), SITE_URL + shareCardPath(share));
    assert.equal(meta(document, 'twitter:card'), 'summary_large_image');
    assert.equal(meta(document, 'robots'), 'index, follow');
    assert.equal(document.querySelectorAll('script[data-baylink-structured-data]').length, 1);
    const [entity] = JSON.parse(document.querySelector('script[data-baylink-structured-data]')!.textContent!);
    assert.equal(entity['@type'], item.kind === 'event' ? 'Event' : 'Article');
    assert.equal(item.kind === 'event' ? entity.url : entity.mainEntityOfPage, SITE_URL + share.path);
  }
  fireEvent.click(view.getByRole('link', { name: 'fixture wrong kind', exact: true }));
  assert.ok(await view.findByRole('heading', { name: '没有找到这个页面' }));
  await waitFor(() => assert.equal(meta(document, 'robots'), 'noindex, follow'));
  assert.equal(meta(document, 'og:type'), 'website');
  assert.equal(meta(document, 'og:image'), DEFAULT_SOCIAL_IMAGE, '404 must not advertise the previously viewed shop');
  assert.equal(document.querySelectorAll('script[data-baylink-structured-data]').length, 0);
  assert.equal(Boolean(view.container.querySelector('.local-discovery-detail')), false);
});

test('detail pages keep their facts and trust row and raise no source prompt when the freshness API is unreachable', async t => {
  const { act } = await import('@testing-library/react');
  const { resetSourceFreshnessCache } = await import('../src/features/source-monitor/content-review-runtime');
  t.mock.method(api, 'request', async () => { throw { error: '网络连接异常，请稍后再试。' }; });
  resetSourceFreshnessCache();
  for (const item of [eventItem, offerItem, openShop]) {
    let view!: ReturnType<typeof render>;
    await act(async () => { view = render(detail(item, '2026-10-08')); });
    await act(async () => {});
    assert.ok(view.getByRole('heading', { level: 1 }), discoveryShare(item).id);
    assert.ok(view.getByRole('note', { name: '来源与核对' }), discoveryShare(item).id);
    assert.equal(view.queryByRole('note', { name: '官方页面提示' }), null, discoveryShare(item).id);
    assert.doesNotMatch(view.container.textContent || '', /内容待复核|来源需人工确认|日期待确认|抓取|多来源取最早/u, discoveryShare(item).id);
    view.unmount();
  }
  resetSourceFreshnessCache();
});
