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

test('多少钱 is a short value (免费 / 部分免费 / $8–12 / 收费 / 费用待确认) with the listing’s cost sentence as the note under it', () => {
  const events = localDiscoveries.filter(row => row.kind === 'event' && row.event.endDate >= TODAY);
  assert.ok(events.length > 100);
  for (const item of events) {
    const doc = page(item);
    const value = doc.querySelector('[data-fact="cost"] dd > .detail-fact__line')!;
    assert.ok(value, discoveryShare(item).id);
    // A money range is two amounts, "$22.80–$28.80" (13 characters, WEB-FIX6), not a sentence.
    assert.ok((value.textContent || '').length <= 12 || /^\$\d+(?:\.\d\d)?–\$\d+(?:\.\d\d)?$/u.test(value.textContent || ''), `${discoveryShare(item).id}: "${value.textContent}" is not a sentence`);
  }
  const milagros = localDiscoveries.find(row => row.kind === 'event' && row.event.id === 'san-lorenzo-metal-milagros-oct10-2026')!;
  const cost = page(milagros).querySelector('[data-fact="cost"] dd')!;
  assert.equal(cost.querySelector('.detail-fact__line')!.textContent, '费用待确认');
  assert.match(cost.querySelector('small')!.textContent || '', /^官方未列明收费/, 'the note starts at its reason, not a second 费用待核');
  // CNT-HOTFIX-2 (H69): the SFPL swap is free under SFPL's "all programs and events are free" listing policy.
  const swap = localDiscoveries.find(row => row.kind === 'event' && row.event.id === 'sf-main-halloween-costume-swap-oct15-2026')!;
  const swapCost = page(swap).querySelector('[data-fact="cost"] dd')!;
  assert.equal(swapCost.querySelector('.detail-fact__line')!.textContent, '免费');
  assert.match(swapCost.querySelector('small')!.textContent || '', /^图书馆活动免费/);
});

const findItem = (kind: string, id: string) => {
  const item = localDiscoveries.find(row => `${row.kind}:${discoveryShare(row).id}` === `${kind}:${id}`);
  assert.ok(item, `${kind}:${id}`);
  return item;
};
const render0 = (record: ReturnType<typeof buildDetailRecord>) => JSDOM.fragment(renderToStaticMarkup(<StaticRouter location={discoveryShare(record.item).path}><LocalDiscoveryDetail record={record} today={TODAY} /></StaticRouter>));
const HAN = /[㐀-鿿]/;

test('a fact or a section whose text is all editor note is left out: no label or heading over nothing', () => {
  const record = buildDetailRecord(findItem('opening', 'marufuku-burlingame-announced'));
  assert.equal(record.item.kind, 'opening');
  if (record.item.kind !== 'opening') return;
  const doc = render0({ ...record, item: { ...record.item, shop: { ...record.item.shop, dateLabel: '本包只录入九月场', summary: '核对时尚未到开业日，保留预告状态。', editorTip: '本条只收录 10/5 场。' } } });
  assert.equal(doc.querySelector('[data-fact="when"]'), null, 'no 开业 cell without a date');
  assert.ok(doc.querySelector('[data-fact="where"]'), 'the other facts stay');
  assert.equal(doc.querySelector('#detail-visit-title'), null, 'no 这一趟怎么安排 without a tip');
  assert.equal(doc.querySelector('.detail-summary'), null, 'no empty summary paragraph');
  for (const cell of doc.querySelectorAll('.detail-fact dd')) assert.ok((cell.textContent || '').trim(), 'every fact has a value');
});

test('an ended event promises the 接下来可以去 rail only when it has cards', () => {
  const record = buildDetailRecord(findItem('event', 'vallejo-brewing-artwalk-2026'));
  const withRail = render0(record);
  assert.ok(withRail.querySelector('#detail-next-title'), 'the fixture still has upcoming events nearby');
  assert.match(withRail.textContent || '', /下面是附近接下来可以去的活动/);
  const alone = render0({ ...record, rail: [] });
  assert.equal(alone.querySelector('#detail-next-title'), null);
  assert.ok(!/下面是附近接下来可以去的活动/.test(alone.textContent || ''), 'no promise of a list that is not there');
  const note = [...alone.querySelectorAll('.detail-note')].find(node => /这场活动已结束/.test(node.textContent || ''));
  assert.ok(note?.querySelector('a[href="/events"]'), 'a way to the events list instead');
});

test('怎么领 · 怎么用 numbers only the steps a listing numbers itself; hedges about the listing follow as a note', () => {
  const muni = page(findItem('offer', 'sfmta-free-muni-seniors'));
  assert.equal(muni.querySelector('.detail-steps ol'), null, 'a description sentence is not step 1');
  assert.ok(muni.querySelectorAll('.detail-steps ul > li').length >= 3);
  const happy = page(findItem('offer', 'sunnyvale-st-johns-happy-hour-ongoing'));
  assert.match(happy.querySelector('.detail-steps__note')?.textContent || '', /^截至2026-09-29官网可见。/);
  assert.ok(![...happy.querySelectorAll('.detail-steps li')].some(li => /官网可见|未公布有效期/.test(li.textContent || '')), 'no hedge in the list');
  const record = buildDetailRecord(findItem('offer', 'oakland-tool-library'));
  if (record.item.kind !== 'offer') return;
  const numbered = render0({ ...record, item: { ...record.item, offer: { ...record.item.offer, description: '1. 先在官网登记会员。2. 带证件到馆领卡。3. 每次最多借 5 件。' } } });
  assert.deepEqual([...numbered.querySelectorAll('.detail-steps ol > li p')].map(node => node.textContent), ['先在官网登记会员。', '带证件到馆领卡。', '每次最多借 5 件。']);
});

test('English details: the facts and the visit tip keep their reader text, and an offer never prints a Chinese brand', async () => {
  const { setLocale } = await import('../src/i18n/locale');
  await setLocale('en', false);
  try {
    const asia = page(findItem('opening', 'asia-live-valley-fair'));
    assert.match(asia.querySelector('[data-fact="when"] dd')?.textContent || '', /^Open since June 2026/);
    const florecita = page(findItem('opening', 'florecita-mission'));
    // CNT-FRESH-1016: the tip names the old footer address and the new one. Owner decision 2026-10-17: the shop stays announced
    // until its 3D city sign, so the tip names the new address without sending the reader there as if it were open.
    const visitTip = florecita.querySelector('#detail-visit-title')?.parentElement?.querySelector('p')?.textContent || '';
    assert.match(visitTip, /old 2050 Bryant St address, and the new one is 3349 23rd Street/);
    assert.doesNotMatch(visitTip, /go to the new one/);
    const offers = localDiscoveries.filter(row => row.kind === 'offer');
    assert.ok(offers.length > 100);
    for (const item of offers) {
      const doc = page(item);
      const id = discoveryShare(item).id;
      for (const node of doc.querySelectorAll('.detail-brand, .detail-hero .ui-type-cover__brand')) assert.ok(!HAN.test(node.textContent || ''), `${id}: "${node.textContent}"`);
    }
    const cal = page(findItem('offer', 'berkeley-cal-golden-bear-oct-sale-2026'));
    assert.match(cal.querySelector('.detail-brand')?.textContent || '', /^Cal Performances/);
  } finally {
    await setLocale('zh-Hans', false);
  }
});
