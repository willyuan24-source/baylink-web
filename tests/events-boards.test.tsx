import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { afterEach, test } from 'node:test';
import React from 'react';
import { JSDOM } from 'jsdom';

/**
 * The 免费与优惠 and 新店 boards inside the events shell (PerksView, OpeningsView, RegionFilter; UI9-FREE). UI9-PREP moved
 * these cases here from tests/events-shell.test.tsx (UI9-EVENTS) with their assertions unchanged, so FREE can rename the
 * boards' classes (.ev-perks-kinds) without editing EVENTS' test. UI9-FREE: the boards' sections (这 7 天 / 7 天以后 / 长期有效,
 * 已开业 / 即将开业) replace the paged list and the openings status chips.
 */
const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'https://www.baylink.us/events' });
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, HTMLElement: dom.window.HTMLElement,
  Node: dom.window.Node, MutationObserver: dom.window.MutationObserver, IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
// jsdom has no layout: let the Sheet's focus trap see connected controls.
dom.window.HTMLElement.prototype.getClientRects = function () {
  return (this.isConnected && !this.hidden ? [{ width: 1, height: 1 }] : []) as unknown as DOMRectList;
};
// Stylesheets are Vite's job; here they load as empty modules (the prerender does the same).
registerHooks({ load: (url, context, nextLoad) => url.endsWith('.css') ? { format: 'module', shortCircuit: true, source: 'export {};' } : nextLoad(url, context) });
const { render, cleanup, fireEvent, within, waitFor } = await import('@testing-library/react');
const { MemoryRouter, useLocation } = await import('react-router-dom');
const { EventsView } = await import('../src/components/EventsView');
const { MonthlyEdition } = await import('../src/components/MonthlyEdition');
const model = await import('../src/features/events/events-model');
const boards = await import('../src/features/events/board-status');

const originalFetch = globalThis.fetch;
afterEach(() => { cleanup(); localStorage.clear(); globalThis.fetch = originalFetch; });

const today = '2026-10-09'; // Friday: the weekend is 10/10–11
function LocationProbe() { const location = useLocation(); return <output data-testid="route">{location.pathname}{location.search}</output>; }
const routed = (location: string, node: React.ReactNode) => render(<MemoryRouter initialEntries={[location]}>{node}<LocationProbe /></MemoryRouter>);
const query = (view: ReturnType<typeof render>) => new URL(view.getByTestId('route').textContent!, 'https://www.baylink.us').searchParams;
const feedIds = (root: ParentNode) => [...root.querySelectorAll('.ui-feed-card a.ui-card-link')].map(link => link.getAttribute('href')!.replace(/^\/(?:events|offers|openings)\//, ''));
// jsdom has no matchMedia, so the boards take the phone layout: 4 offers per section; 6 open shops and 4 coming soon.
const firstOffers = (offers: ReturnType<typeof model.liveOffers>) => boards.offerSections(offers, today).flatMap(section => section.offers.slice(0, 4).map(offer => offer.id));
const firstShops = (shops: ReturnType<typeof model.filterOpenings>) => boards.openingSections(shops, today).flatMap(section => section.openings.slice(0, section.id === 'open' ? 6 : 4).map(shop => shop.id));
const heads = (root: ParentNode) => [...root.querySelectorAll('h2.fb-section__head')].map(head => head.textContent);

test('免费与优惠 and 新店 load as their own boards: a skeleton, 1:1 covers, sections by end date and by opening, a condition status line', async () => {
  const perks = routed('/events?view=perks', <EventsView today={today} />);
  assert.ok(perks.container.querySelector('[aria-busy="true"]'), 'skeleton first');
  await waitFor(() => assert.ok(perks.container.querySelector('.ui-feed[data-ratio="1:1"] .ui-feed-card')));
  assert.equal(perks.container.querySelector('nav[aria-label="活动分区"] a[aria-current="page"]')?.textContent, '免费与优惠');
  const offers = model.liveOffers(model.INDEX_OFFERS, today);
  assert.deepEqual(feedIds(perks.container), firstOffers(offers));
  assert.deepEqual(heads(perks.container), boards.offerSections(offers, today).map(section => `${section.label.zh} · ${section.offers.length} 条`));
  assert.equal(perks.container.querySelector('.fb-status')!.textContent, '', 'no count line until a condition is chosen');
  fireEvent.click(perks.getByRole('button', { name: '无需购物', exact: true }));
  const free = model.liveOffers(model.INDEX_OFFERS, today, 'no-purchase');
  assert.equal(perks.container.querySelector('.fb-status')!.textContent, `无需购物 · ${free.length} 条`);
  for (const id of feedIds(perks.container)) assert.equal(model.INDEX_OFFERS.find(offer => offer.id === id)?.kind, 'no-purchase', id);
  cleanup();
  const openings = routed('/events?view=openings', <EventsView today={today} />);
  await waitFor(() => assert.ok(openings.container.querySelector('.ui-feed[data-ratio="1:1"] .ui-feed-card')));
  // The two sections replace the status chips; their counts add up to every shop.
  assert.equal(openings.container.querySelector('.ev-perks-kinds, .fb-kinds'), null, 'no status chip row');
  const counts = heads(openings.container).map(head => Number(/· (\d+) 家$/.exec(head!)![1]));
  assert.deepEqual(heads(openings.container).map(head => head!.split(' · ')[0]), ['已开业', '即将开业']);
  assert.equal(counts.reduce((sum, count) => sum + count, 0), model.INDEX_OPENINGS.length, '已开业 + 即将开业 = 全部');
  assert.deepEqual(feedIds(openings.container), firstShops(model.INDEX_OPENINGS));
  assert.equal(openings.container.querySelector('.fb-note')?.textContent, '整理自公开资料，未实地探店');
  cleanup();
  // The old anchors land on the boards.
  const anchor = render(<MemoryRouter initialEntries={['/this-month#monthly-perks']}><MonthlyEdition today={today} /></MemoryRouter>);
  await waitFor(() => assert.equal(anchor.container.querySelector('nav[aria-label="活动分区"] a[aria-current="page"]')?.textContent, '免费与优惠'));
});

test('the boards show the remembered region and can change it: 整个湾区 ▾ on 新店 and 免费与优惠', async () => {
  localStorage.setItem(model.REGION_KEY, 'south-bay');
  const view = routed('/events?view=openings', <EventsView today={today} />);
  await waitFor(() => assert.ok(view.container.querySelector('.ui-feed-card')));
  await waitFor(() => assert.equal(view.container.querySelector('.ev-range')?.textContent, '新店 · 南湾'));
  const south = model.filterOpenings(model.INDEX_OPENINGS, 'all', 'south-bay');
  assert.ok(south.length > 0 && south.length < model.INDEX_OPENINGS.length);
  assert.deepEqual(feedIds(view.container), firstShops(south));
  // The region chip says where the board is narrowed to and opens the region Sheet, which announces its count.
  fireEvent.click(view.getByRole('button', { name: '南湾', exact: true }));
  const sheet = await view.findByRole('dialog', { name: '选择地区' });
  assert.equal(within(sheet).getByRole('status').textContent, `显示 ${south.length} 家`);
  fireEvent.click(within(sheet).getByRole('button', { name: '整个湾区', exact: true }));
  assert.equal(query(view).get('region'), 'all');
  assert.equal(query(view).get('view'), 'openings', 'the board stays open');
  assert.equal(localStorage.getItem(model.REGION_KEY), null, '整个湾区 is remembered too');
  await waitFor(() => assert.equal(within(sheet).getByRole('status').textContent, `显示 ${model.INDEX_OPENINGS.length} 家`));
  fireEvent.click(within(sheet).getByRole('button', { name: `显示 ${model.INDEX_OPENINGS.length} 家`, exact: true }));
  await waitFor(() => assert.equal(view.queryByRole('dialog'), null));
  assert.equal(view.container.querySelector('.ev-range')?.textContent, '新店');
  assert.deepEqual(feedIds(view.container), firstShops(model.INDEX_OPENINGS));
  cleanup();
  // 免费与优惠: the same chip, here narrowing to a region from 整个湾区.
  const perks = routed('/events?view=perks', <EventsView today={today} />);
  await waitFor(() => assert.ok(perks.container.querySelector('.ui-feed-card')));
  fireEvent.click(perks.getByRole('button', { name: '整个湾区', exact: true }));
  const perksSheet = await perks.findByRole('dialog', { name: '选择地区' });
  fireEvent.click(within(perksSheet).getByRole('button', { name: '旧金山', exact: true }));
  assert.equal(query(perks).get('region'), 'sf');
  assert.equal(localStorage.getItem(model.REGION_KEY), 'sf');
  const sf = model.liveOffers(model.INDEX_OFFERS, today, 'all', 'sf');
  await waitFor(() => assert.equal(within(perksSheet).getByRole('status').textContent, `显示 ${sf.length} 条`));
  assert.deepEqual(feedIds(perks.container), firstOffers(sf));
});
