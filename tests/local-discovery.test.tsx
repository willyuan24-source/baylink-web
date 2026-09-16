import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test, { after, afterEach, beforeEach } from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { LocalDiscovery } from '../src/data/local-discoveries';

const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'https://www.baylink.us/this-month' });
const globals = {
  window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
  HTMLElement: dom.window.HTMLElement, Node: dom.window.Node,
  localStorage: dom.window.localStorage, IS_REACT_ACT_ENVIRONMENT: true,
};
const previousGlobals = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
const { render, fireEvent, cleanup, within } = await import('@testing-library/react');
const { MemoryRouter, StaticRouter, Routes, Route, Link } = await import('react-router-dom');
const { localDiscoveries, getLocalDiscovery, discoveryShare } = await import('../src/data/local-discoveries');
const { getDiscoveryMetadata } = await import('../src/lib/discovery-metadata');
const { renderMetadataHtml, SITE_URL, DEFAULT_SOCIAL_IMAGE, configureMetadataLanguage } = await import('../src/lib/seo');
const { shareCardPath } = await import('../src/lib/editorial-share');
const { LocalDiscoveryDetail } = await import('../src/components/LocalDiscoveryDetail');
const { GUIDE_IMAGES } = await import('../src/data/guide-media');
const { default: LocalDiscoveryPage } = await import('../src/pages/LocalDiscoveryPage');
const { api } = await import('../src/lib/api');
const { setLocale } = await import('../src/i18n/locale');
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
  <MemoryRouter><LocalDiscoveryDetail item={item} today={today} /></MemoryRouter>;
const canonical = (doc: Document) => doc.querySelector('link[rel="canonical"]')?.getAttribute('href');
const meta = (doc: Document, name: string) => doc.querySelector('meta[property="' + name + '"],meta[name="' + name + '"]')?.getAttribute('content');
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

test('all 99 discoveries have unique IDs and category-specific routes that resolve back to the same record', () => {
  assert.equal(localDiscoveries.length, 99);
  assert.deepEqual(localDiscoveries.reduce<Record<string, number>>((counts, item) => {
    counts[item.kind] = (counts[item.kind] || 0) + 1;
    return counts;
  }, {}), { event: 55, offer: 33, opening: 11 });
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
    assert.equal(rules.length, 1, 'one static hosting rule for ' + folder);
    const pattern = new RegExp(rules[0].src!);
    for (const item of localDiscoveries.filter(item => item.kind === kind)) {
      const share = discoveryShare(item);
      for (const path of [share.path, share.path + '/']) {
        const match = pattern.exec(path);
        assert.ok(match, path + ' reaches a static page');
        assert.equal(match[1], share.id);
        assert.equal(path.replace(pattern, rules[0].dest!), share.path + '.html');
      }
      assert.equal(pattern.test(share.path + '/nested'), false);
      assert.equal(pattern.test(share.path + '.html'), false, 'the application route is extensionless');
    }
    for (const path of ['/' + folder + '/unknown-discovery', '/' + folder + '/../this-month', '/' + folder + '/', '/other/' + discoveryShare(eventItem).id]) {
      assert.equal(pattern.test(path), false, path + ' must not match a discovery rewrite');
    }
  }
});

test('all 99 recipient paths are known app routes and select the guide navigation without accepting invalid roots', () => {
  for (const item of localDiscoveries) {
    const path = discoveryShare(item).path;
    for (const candidate of [path, path + '/']) {
      assert.equal(isKnownAppPath(candidate), true, candidate + ' is recognized by the app layout');
      assert.equal(tabFromPathname(candidate), 'guides', candidate + ' keeps local discovery in guide navigation');
    }
    assert.equal(isKnownAppPath(path + '/nested'), false, 'detail routes accept exactly one ID segment');
  }
  for (const root of ['/events', '/offers', '/openings']) {
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
  assert.equal(paths.size, 99);
  assert.equal(urls.size, 99);
});

test('all detail pages server-render full content with matching canonical, OG, Twitter and Article metadata', t => {
  const request = t.mock.method(api, 'request', async () => { throw new Error('Prerender cannot request engagement'); });
  const fetch = t.mock.method(globalThis, 'fetch', async () => { throw new Error('Prerender cannot use the network'); });
  for (const item of localDiscoveries) {
    const share = discoveryShare(item);
    const metadata = getDiscoveryMetadata(item);
    const expectedUrl = SITE_URL + '/' + folders[item.kind] + '/' + share.id;
    const expectedImage = SITE_URL + '/share-cards/' + item.kind + '-' + share.id + '.png';
    const body = renderToStaticMarkup(<StaticRouter location={share.path}><LocalDiscoveryDetail item={item} today="2026-09-15" /></StaticRouter>);
    const page = new JSDOM('<!doctype html><html><head>' + renderMetadataHtml(metadata) + '</head><body>' + body + '</body></html>');
    const doc = page.window.document;
    assert.equal(doc.querySelectorAll('h1').length, 1, share.id);
    assert.equal(doc.querySelector('h1')?.textContent, share.title);
    assert.equal(doc.querySelector('title')?.textContent, share.title + '｜BAYLINK');
    assert.equal(canonical(doc), expectedUrl);
    assert.equal(meta(doc, 'og:url'), expectedUrl);
    assert.equal(meta(doc, 'og:type'), 'article');
    assert.equal(meta(doc, 'og:image'), expectedImage);
    assert.equal(meta(doc, 'twitter:image'), expectedImage);
    assert.equal(meta(doc, 'twitter:card'), 'summary_large_image');
    assert.equal(meta(doc, 'robots'), 'index, follow');
    assert.ok(meta(doc, 'description')!.includes(share.date));
    assert.ok(meta(doc, 'description')!.includes(share.area));
    assert.ok(meta(doc, 'description')!.includes(share.summary));
    const jsonLd = doc.querySelectorAll('script[type="application/ld+json"]');
    assert.equal(jsonLd.length, 1);
    const [article] = JSON.parse(jsonLd[0].textContent!);
    assert.equal(article['@type'], 'Article');
    assert.equal(article.headline, share.title);
    assert.equal(article.mainEntityOfPage, expectedUrl);
    assert.equal(article.publisher.name, 'BAYLINK');
    assert.equal(article.publisher.url, SITE_URL);
    if (share.checkedAt) assert.equal(article.dateModified, share.checkedAt);
    else assert.equal(Object.hasOwn(article, 'dateModified'), false, 'offers without a checked date do not invent one');

    const content = doc.querySelector('.local-discovery-detail')!;
    const imageKey = item.kind === 'event' ? item.event.imageKey : item.kind === 'offer' ? item.offer.imageKey : item.shop.imageKey;
    const expectedMedia = GUIDE_IMAGES[imageKey];
    const figure = content.querySelector('.discovery-detail-media');
    if (expectedMedia) {
      assert.ok(figure, share.id + ' displays its registered editorial image');
      const img = figure.querySelector('img')!;
      assert.equal(img.getAttribute('src'), expectedMedia.src);
      assert.equal(img.getAttribute('srcset'), expectedMedia.srcSet);
      assert.equal(img.getAttribute('alt'), expectedMedia.alt);
      assert.equal(img.getAttribute('width'), String(expectedMedia.width));
      assert.equal(img.getAttribute('height'), String(expectedMedia.height));
      assert.equal(img.getAttribute('loading'), 'eager');
      assert.ok(figure.textContent!.includes(expectedMedia.caption));
      assert.ok(figure.textContent!.includes(expectedMedia.credit));
      if (expectedMedia.creditUrl) assert.ok([...figure.querySelectorAll('a')].some(a => a.getAttribute('href') === expectedMedia.creditUrl));
      if (expectedMedia.licenseUrl) assert.ok([...figure.querySelectorAll('a')].some(a => a.getAttribute('href') === expectedMedia.licenseUrl));
    } else assert.equal(figure, null, share.id + ' stays readable without inventing an image');
    if (item.kind === 'event') {
      assert.deepEqual([...content.querySelectorAll('.discovery-plan li p')].map(node => node.textContent), item.event.plan, 'all three planning steps are indexable outside the paginated list');
      assert.ok(content.textContent!.includes(item.event.costLabel));
      assert.ok(content.textContent!.includes(item.event.venue));
      assert.equal(content.querySelector('.event-interest span')?.textContent, '—');
    } else if (item.kind === 'offer') {
      assert.ok(content.textContent!.includes(item.offer.requirement), 'redemption conditions are visible before following the offer');
      assert.ok(content.textContent!.includes(item.offer.description));
      assert.equal(content.querySelector('.event-participation'), null);
    } else {
      assert.ok(content.textContent!.includes(item.shop.editorTip));
      assert.ok(content.textContent!.includes(item.shop.address));
      assert.ok(content.textContent!.includes(item.shop.dateLabel));
      assert.equal(content.querySelector('.event-participation'), null);
    }
    assert.equal(doc.querySelector('link[rel="canonical"]')!.getAttribute('href')!.includes('?'), false);
    page.window.close();
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
      const body = renderToStaticMarkup(<StaticRouter><LocalDiscoveryDetail item={fixture} today="2026-09-15" /></StaticRouter>);
      const page = new JSDOM(body);
      assert.equal(page.window.document.querySelector('h1')?.textContent, discoveryShare(item).title);
      assert.equal(page.window.document.querySelector('.discovery-detail-media'), null);
      assert.ok(page.window.document.querySelector('.discovery-detail-links a'));
      page.window.close();
    }
  }
});

test('discovery posters and full-frame photos stay contained and open their complete source in an accessible lightbox', () => {
  const style = document.createElement('style');
  style.textContent = readFileSync(new URL('../src/components/guide-visuals.css', import.meta.url), 'utf8') + '\n'
    + readFileSync(new URL('../src/components/discovery-community.css', import.meta.url), 'utf8');
  document.head.append(style);
  const poster = find('event', item => GUIDE_IMAGES[item.event.imageKey]?.kind === 'poster');
  const fullPhoto = find('offer', item => GUIDE_IMAGES[item.offer.imageKey]?.kind === 'photo' && !!GUIDE_IMAGES[item.offer.imageKey]?.fullFrame);
  for (const item of [poster, fullPhoto]) {
    const imageKey = item.kind === 'event' ? item.event.imageKey : item.offer.imageKey;
    const image = GUIDE_IMAGES[imageKey];
    const view = render(detail(item));
    const img = view.getByRole('img', { name: image.alt });
    assert.ok(img.closest('.discovery-detail-media--full'));
    const computed = dom.window.getComputedStyle(img);
    assert.equal(computed.objectFit, 'contain');
    assert.equal(computed.aspectRatio, 'auto');
    const zoom = view.getByRole('button', { name: '放大图片：' + image.alt });
    fireEvent.click(zoom);
    const dialog = view.getByRole('dialog', { name: '图片放大：' + image.alt });
    assert.equal(within(dialog).getByRole('img', { name: image.alt }).getAttribute('src'), image.src);
    assert.ok(within(dialog).getByText(image.caption));
    fireEvent.click(within(dialog).getByRole('button', { name: '关闭放大图片' }));
    assert.equal(view.queryByRole('dialog'), null);
    assert.equal(document.body.style.overflow, '');
    view.unmount();
  }
});

test('event recipients see all planning, cost, venue and audience details and retain safe source and return links', () => {
  const view = render(detail(eventItem, eventItem.event.endDate));
  assert.equal(view.getByRole('heading', { level: 1 }).textContent, eventItem.event.title);
  assert.ok(view.getByRole('heading', { name: '出发前，把这三件事安排好' }));
  const steps = within(view.getByRole('list')).getAllByRole('listitem');
  assert.equal(steps.length, 3);
  eventItem.event.plan.forEach((step, index) => assert.ok(steps[index].textContent!.includes(step)));
  assert.ok(view.getByText(eventItem.event.costLabel, { exact: true }));
  assert.ok(view.container.textContent!.includes(eventItem.event.venue));
  assert.ok(view.container.textContent!.includes(eventItem.event.audience.join(' / ')));
  assertExternal(view.getByRole('link', { name: '查看主办方详情' }), eventItem.event.officialUrl);
  assertExternal(view.getByRole('link', { name: eventItem.event.sourceLabel, exact: true }), eventItem.event.officialUrl);
  assert.ok(view.getByRole('button', { name: '存入日历', exact: true }), 'the final event day is still valid');
  assert.equal(view.getByRole('link', { name: '发现更多湾区好去处' }).getAttribute('href'), '/this-month#monthly-events');
  assert.equal(view.getByRole('link', { name: '十月活动日历' }).getAttribute('href'), '/this-month?when=october');
  assert.equal(view.queryByText(/这条信息的日期已过/), null);
});

test('expired event links remain readable and shareable but cannot create new interest or a calendar reminder', () => {
  const view = render(detail(eventItem, nextDay(eventItem.event.endDate)));
  assert.ok(view.getByText(/这条信息的日期已过/));
  assert.equal(view.getByRole('heading', { level: 1 }).textContent, eventItem.event.title);
  assert.equal(view.queryByRole('button', { name: '存入日历', exact: true }), null);
  const interest = view.getByRole('button', { name: '我想去：' + eventItem.event.title, exact: true }) as HTMLButtonElement;
  assert.equal(interest.disabled, true);
  assert.match(interest.textContent!, /活动已结束/);
  assert.ok(view.getByRole('button', { name: '分享：' + eventItem.event.title, exact: true }));
  assertExternal(view.getByRole('link', { name: '查看主办方详情' }), eventItem.event.officialUrl);
  assert.equal(view.getByRole('list').querySelectorAll('li').length, 3);
});

test('offer details preserve eligibility and local-store links, while expiry begins after the final redemption day', () => {
  const view = render(detail(offerItem, offerItem.offer.endDate));
  assert.ok(view.getByRole('heading', { name: '先看领取条件' }));
  assert.ok(view.getByRole('heading', { name: '这份福利怎么用' }));
  assert.equal(view.container.querySelector('.discovery-important')!.textContent, offerItem.offer.requirement);
  assert.ok(view.getByText(offerItem.offer.description, { exact: true }));
  assertExternal(view.getByRole('link', { name: '查看领取入口' }), offerItem.offer.sourceUrl);
  assertExternal(view.getByRole('link', { name: '查询本地门店' }), offerItem.offer.storeUrl!);
  assert.equal(view.getByRole('link', { name: '发现更多湾区好去处' }).getAttribute('href'), '/this-month#monthly-perks');
  assert.equal(view.queryByText(/这条信息的日期已过/), null);
  assert.equal(view.queryByRole('button', { name: '存入日历', exact: true }), null);
  assert.equal(view.container.querySelector('.event-participation'), null);
  view.rerender(detail(offerItem, nextDay(offerItem.offer.endDate!)));
  assert.ok(view.getByText(/这条信息的日期已过/));
  assert.equal(view.container.querySelector('.discovery-important')!.textContent, offerItem.offer.requirement);
  assertExternal(view.getByRole('link', { name: '查看领取入口' }), offerItem.offer.sourceUrl);
});

test('offers without end dates retain their actual conditions instead of acquiring an invented expiry', () => {
  for (const availability of ['ongoing', 'check-local'] as const) {
    const item = find('offer', value => value.offer.availability === availability && !value.offer.endDate);
    const view = render(detail(item, '2027-01-01'));
    assert.equal(view.queryByText(/这条信息的日期已过/), null);
    assert.ok(view.getAllByText(item.offer.requirement, { exact: true }).length > 0);
    assert.ok(view.getByText(item.offer.dateLabel, { exact: true }));
    view.unmount();
  }
});

test('opening recipients can distinguish an operating shop from an unconfirmed announcement and inspect both sources', () => {
  for (const item of [openShop, announcedShop]) {
    const view = render(detail(item, '2027-01-01'));
    assert.ok(view.getByRole('heading', { name: '这一趟怎么安排' }));
    assert.ok(view.getByText(item.shop.editorTip, { exact: true }));
    assert.ok(view.container.textContent!.includes(item.shop.address));
    assertExternal(view.getByRole('link', { name: '查看商家官网' }), item.shop.officialUrl);
    assertExternal(view.getByRole('link', { name: item.shop.sourceLabel, exact: true }), item.shop.sourceUrl);
    const notice = view.container.querySelector('.discovery-inline-note')!.textContent!;
    if (item.shop.status === 'open') assert.match(notice, /已开业.*当天营业与订位/);
    else {
      assert.match(notice, /开业预告.*尚未确认正式营业/);
      assert.doesNotMatch(notice, /已开业/, 'an expected opening date does not automatically confirm operation');
    }
    assert.equal(view.queryByText(/这条信息的日期已过/), null, 'an opening report is not an expiring event');
    assert.equal(view.queryByRole('button', { name: '存入日历', exact: true }), null);
    assert.equal(view.container.querySelector('.event-participation'), null);
    assert.equal(view.getByRole('link', { name: '发现更多湾区好去处' }).getAttribute('href'), '/this-month#monthly-openings');
    assert.equal(view.container.querySelector('.discovery-source time')?.getAttribute('datetime'), item.shop.verifiedAt);
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
  <Routes>
    <Route path="/events/:id" element={<LocalDiscoveryPage kind="event" />} />
    <Route path="/offers/:id" element={<LocalDiscoveryPage kind="offer" />} />
    <Route path="/openings/:id" element={<LocalDiscoveryPage kind="opening" />} />
  </Routes>
</>;

test('client recipient navigation replaces category content and metadata, and wrong-kind URLs clear stale article metadata', () => {
  const view = render(<MemoryRouter initialEntries={[discoveryShare(eventItem).path + '?from=share&lang=en#planning']}><RouteHarness /></MemoryRouter>);
  for (const [label, item] of [['fixture event', eventItem], ['fixture offer', offerItem], ['fixture opening', announcedShop]] as const) {
    fireEvent.click(view.getByRole('link', { name: label, exact: true }));
    const share = discoveryShare(item);
    assert.equal(view.getByRole('heading', { level: 1 }).textContent, share.title);
    assert.equal(canonical(document), SITE_URL + share.path, 'attribution, locale query and fragments do not alter canonical URLs');
    assert.equal(meta(document, 'og:url'), SITE_URL + share.path);
    assert.equal(meta(document, 'og:image'), SITE_URL + shareCardPath(share));
    assert.equal(meta(document, 'twitter:card'), 'summary_large_image');
    assert.equal(meta(document, 'robots'), 'index, follow');
    assert.equal(document.querySelectorAll('script[data-baylink-structured-data]').length, 1);
    const [article] = JSON.parse(document.querySelector('script[data-baylink-structured-data]')!.textContent!);
    assert.equal(article.mainEntityOfPage, SITE_URL + share.path);
  }
  fireEvent.click(view.getByRole('link', { name: 'fixture wrong kind', exact: true }));
  assert.ok(view.getByRole('heading', { name: '没有找到这个页面' }));
  assert.equal(meta(document, 'robots'), 'noindex, follow');
  assert.equal(meta(document, 'og:type'), 'website');
  assert.equal(meta(document, 'og:image'), DEFAULT_SOCIAL_IMAGE, '404 must not advertise the previously viewed shop');
  assert.equal(document.querySelectorAll('script[data-baylink-structured-data]').length, 0);
  assert.equal(view.container.querySelector('.local-discovery-detail'), null);
});
