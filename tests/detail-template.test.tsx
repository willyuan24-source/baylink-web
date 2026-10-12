import assert from 'node:assert/strict';
import test, { after, afterEach } from 'node:test';
import React, { Suspense } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'https://www.baylink.us/events/x' });
const globals = { window: dom.window, document: dom.window.document, navigator: dom.window.navigator, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, localStorage: dom.window.localStorage, IS_REACT_ACT_ENVIRONMENT: true };
const previous = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
const { render, fireEvent, cleanup } = await import('@testing-library/react');
const { MemoryRouter, StaticRouter, Routes, Route, Outlet } = await import('react-router-dom');
const { localDiscoveries, discoveryShare } = await import('../src/data/local-discoveries');
const { LocalDiscoveryDetail } = await import('../src/components/LocalDiscoveryDetail');
const { buildDetailRecord } = await import('../src/features/detail/build-detail');
const { default: LocalDiscoveryPage } = await import('../src/pages/LocalDiscoveryPage');
const { readDetailRecord } = await import('../src/features/detail/load-detail');

afterEach(cleanup);
after(() => {
  dom.window.close();
  for (const [key, descriptor] of previous) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
});

const TODAY = '2026-10-12';
// The 20 details sampled for the before/after screenshots (lanes/WEB-DETAIL/jobs.json): photos, posters, TypeCovers, ended and
// postponed events, offers and openings.
const SAMPLE = ['event:san-francisco-fleet-week-2026', 'event:sf-sunday-streets-excelsior-oct18-2026', 'event:half-moon-bay-pumpkin-festival-2026',
  'event:los-altos-halloween-movie-night-2026', 'event:cupertino-diwali-festival-2026', 'event:san-jose-avenida-altares-2026',
  'event:ssf-senior-holiday-boutique-nov7-2026', 'event:nov2026-big-break-accessible-winter-birding', 'event:danville-scarecrow-stroll-2026',
  'event:daly-city-top-of-the-hill-festival-2026', 'event:octnov-marin-holiday-lights-2026', 'event:sf-chinatown-calligraphy-oct8-2026',
  'event:vallejo-brewing-artwalk-2026', 'event:santana-row-glass-pumpkin-2026', 'offer:sfmta-free-muni-seniors', 'offer:oakland-tool-library',
  'offer:sephora-birthday', 'opening:old-post-office-burlingame', 'opening:broken-dreams-oakland', 'opening:marufuku-burlingame-announced'];
const sample = SAMPLE.map(key => {
  const item = localDiscoveries.find(row => `${row.kind}:${discoveryShare(row).id}` === key);
  assert.ok(item, key);
  return item;
});
const page = (item: (typeof sample)[number]) => JSDOM.fragment(renderToStaticMarkup(<StaticRouter location={discoveryShare(item).path}><LocalDiscoveryDetail record={buildDetailRecord(item)} today={TODAY} /></StaticRouter>));
const FOLLOWING = 4;

test('T6: the hero opens every sampled detail, then the chips, the H1 and the at-a-glance card; no masthead, nothing hidden', () => {
  for (const item of sample) {
    const doc = page(item);
    const id = discoveryShare(item).id;
    const main = doc.querySelector('.detail-main')!;
    assert.ok(main.firstElementChild?.matches('figure.detail-hero'), `${id}: the hero comes first`);
    assert.ok(main.querySelector('.detail-hero [data-cover]'), `${id}: a photo or a TypeCover, never an empty slot`);
    const head = main.querySelector('.detail-head')!;
    assert.ok(head.querySelector('.detail-chips .ui-status'), id);
    assert.equal(head.querySelectorAll('h1').length, 1, id);
    const facts = doc.querySelector('dl.detail-facts')!;
    assert.equal(doc.querySelectorAll('dl.detail-facts').length, 1, `${id}: one copy of the facts (the desktop card is the same element)`);
    assert.ok(facts.querySelectorAll('.detail-fact').length >= 3, `${id}: at least three facts`);
    assert.ok(head.compareDocumentPosition(facts) & FOLLOWING, `${id}: facts follow the H1`);
    assert.ok(facts.compareDocumentPosition(doc.querySelector('.detail-body')!) & FOLLOWING, `${id}: the body follows the facts`);
    assert.equal(doc.querySelector('.discovery-detail-brand, .discovery-detail-more-actions, details'), null, `${id}: no masthead and no tucked-away actions`);
    assert.ok(!/湾区生活手记/.test(doc.textContent || ''), id);
  }
});

test('D10: one action bar per detail with the ♡, the plan, 问 BayBay and the official page', () => {
  for (const item of sample) {
    const doc = page(item);
    const id = discoveryShare(item).id;
    const bars = doc.querySelectorAll('.site-detail-actions');
    assert.equal(bars.length, 1, `${id}: SiteChrome hides the tab bar once this bar is on the page`);
    const bar = bars[0];
    assert.ok(bar.querySelector('button.detail-action--ask'), `${id}: 问 BayBay`);
    const official = bar.querySelector<HTMLAnchorElement>('a[target="_blank"]')!;
    assert.match(official.getAttribute('rel') || '', /noopener/);
    assert.ok(/^https?:\/\//.test(official.getAttribute('href') || ''), id);
    const live = !doc.querySelector('.ui-status[data-tone="ended"]') && !/已过期|暂无已确认场次|待确认/.test(doc.querySelector('.detail-main')!.textContent || '');
    if (live) assert.ok(bar.querySelector('.saves-toggle'), `${id}: ♡ 收藏 (FC3-02, FC3-03)`);
    if (item.kind === 'event' && live) assert.ok(bar.querySelector('[data-day] .saves-add-day'), `${id}: 加入这天计划`);
  }
});

test('问 BayBay in the bar opens the assistant (the page capsule comes from the URL)', () => {
  let opened = 0;
  const app = { openBayBay: () => { opened += 1; }, user: null } as unknown as Record<string, unknown>;
  const item = sample[0];
  const view = render(<MemoryRouter initialEntries={[discoveryShare(item).path]}><Routes><Route element={<Outlet context={app} />}>
    <Route path="/events/:id" element={<LocalDiscoveryDetail record={buildDetailRecord(item)} today={TODAY} />} />
  </Route></Routes></MemoryRouter>);
  fireEvent.click(view.getByRole('button', { name: '问 BayBay 这一页' }));
  assert.equal(opened, 1);
});

test('the route renders 404 for an unknown id and the record for a known one', async () => {
  assert.equal(await new Promise(resolve => { try { resolve(readDetailRecord('event', 'no-such-event-anywhere')); } catch (pending) { void (pending as Promise<void>).then(() => resolve(readDetailRecord('event', 'no-such-event-anywhere'))); } }), null);
  const view = render(<MemoryRouter initialEntries={['/offers/sfmta-free-muni-seniors']}><Suspense fallback={<p>loading</p>}><Routes>
    <Route path="/offers/:id" element={<LocalDiscoveryPage kind="offer" />} />
  </Routes></Suspense></MemoryRouter>);
  // The record is a first dynamic import: allow for a loaded machine (testing-library waits 1 s by default).
  assert.ok(await view.findByRole('heading', { level: 1 }, { timeout: 15_000 }));
  assert.ok(view.container.querySelector('.site-detail-actions'));
});

test('a venue photo too old to be the cover still shows the place below the summary, labelled 资料图 · 年份; theme, AI and offer photos do not', () => {
  const find = (kind: string, id: string) => localDiscoveries.find(row => `${row.kind}:${discoveryShare(row).id}` === `${kind}:${id}`)!;
  // The SF main library's 2013 atrium photo is the approved venue photo of this swap, past the 8-year cover rule.
  const old = page(find('event', 'sf-main-halloween-costume-swap-oct15-2026'));
  assert.equal(old.querySelector('.detail-hero [data-cover]')?.getAttribute('data-cover'), 'type', 'the hero is the TypeCover');
  const photo = old.querySelector('.detail-body figure.detail-photo')!;
  assert.ok(photo, 'the venue photo is in the body');
  assert.ok(old.querySelector('.detail-summary')!.compareDocumentPosition(photo) & FOLLOWING, 'after the summary');
  assert.match(photo.textContent || '', /资料图 · 2013/);
  assert.ok(photo.querySelector('img[loading="lazy"]'), 'below the fold, so it loads lazily');
  assert.equal(old.querySelectorAll('.detail-credit').length, 1, 'one credit line for the one photo');
  // A photo that is the cover is not repeated; offers keep the brand-image rule (a CC Muni photo is not the offer).
  for (const [kind, id] of [['event', 'san-francisco-fleet-week-2026'], ['offer', 'sfmta-free-muni-seniors'], ['offer', 'omca-free-oct4']]) {
    assert.equal(page(find(kind, id)).querySelector('.detail-photo'), null, `${kind}:${id}`);
  }
});
