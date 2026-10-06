import assert from 'node:assert/strict';
import test, { after, afterEach } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import type { MonthlyEvent } from '../src/data/monthly-types';
import { MONTHLY_EVENTS } from '../src/data/monthly-edition';
import { guides } from '../src/data/guides';
import { eventOccursOn } from '../src/lib/event-calendar';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://www.baylink.us/events/example' });
const globals = { window: dom.window, document: dom.window.document, navigator: dom.window.navigator, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true };
const previous = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
const { render, fireEvent, cleanup, within } = await import('@testing-library/react');
const { MemoryRouter, StaticRouter } = await import('react-router-dom');
const { LocalDiscoveryDetail, getRelatedUpcomingEvents } = await import('../src/components/LocalDiscoveryDetail');
const { SiteMobileNavigation } = await import('../src/components/SiteMobileNavigation');
const { GuidesHome } = await import('../src/components/GuidesHome');

afterEach(cleanup);
after(() => {
  dom.window.close();
  for (const [key, descriptor] of previous) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
});

const fixture = (id: string, values: Partial<MonthlyEvent> = {}): MonthlyEvent => ({
  id, title: id, startDate: '2026-10-01', endDate: '2026-10-31', occurrenceDates: ['2026-10-10'], dateLabel: 'October confirmed session',
  region: 'east-bay', city: 'Oakland', venue: 'Organizer venue', category: 'culture', cost: 'unknown', costLabel: 'Check organizer for prices',
  summary: 'A confirmed local event.', plan: ['Check the organizer before leaving.'], audience: ['Everyone'],
  officialUrl: 'https://example.org/events/' + id, sourceLabel: 'Organizer ' + id, verifiedAt: '2026-10-06', imageKey: '', ...values,
});

test('related sessions prefer the same city, then region, and use actual occurrence dates without padding', () => {
  const current = fixture('audit-current');
  const laterCity = fixture('audit-city-later', { occurrenceDates: ['2026-10-16'] });
  const nextCity = fixture('audit-city-next', { occurrenceDates: ['2026-10-03', '2026-10-10'] });
  const nearby = fixture('audit-region', { city: 'Berkeley', occurrenceDates: ['2026-10-08'] });
  const earlierRegion = fixture('audit-region-later', { city: 'Alameda', occurrenceDates: ['2026-10-09'] });
  const candidates = [current, nearby, laterCity, nextCity, earlierRegion,
    fixture('audit-ended', { endDate: '2026-10-05', occurrenceDates: ['2026-10-05'] }),
    fixture('audit-unconfirmed', { occurrenceDates: [] }),
    fixture('audit-other-category', { category: 'food' }),
    fixture('audit-other-region', { region: 'south-bay', city: 'San Jose' }),
  ];
  const actual = getRelatedUpcomingEvents(current, '2026-10-06', candidates);
  assert.deepEqual(actual.map(({ event, date }) => [event.id, date]), [['audit-city-next', '2026-10-10'], ['audit-city-later', '2026-10-16'], ['audit-region', '2026-10-08']]);
  for (const { event, date } of actual) assert.ok(eventOccursOn(event, date));
  assert.equal(getRelatedUpcomingEvents(current, '2026-11-01', candidates).length, 0);
  assert.equal(getRelatedUpcomingEvents(current, '2026-10-06', [current, nextCity]).length, 1, 'one real session does not become three fabricated cards');
});

test('expired and unconfirmed event details preserve archives and official access, without current-week saving or planning', () => {
  for (const event of [fixture('audit-ended-detail', { endDate: '2026-10-05', occurrenceDates: ['2026-10-05'] }), fixture('audit-empty-schedule', { occurrenceDates: [] })]) {
    const fragment = JSDOM.fragment(renderToStaticMarkup(<StaticRouter><LocalDiscoveryDetail item={{ kind: 'event', event }} today="2026-10-06" /></StaticRouter>));
    const actions = fragment.querySelector('.discovery-detail-more-actions')!;
    assert.equal(actions.querySelector('summary')?.textContent, '历史资料与分享');
    assert.equal(actions.querySelector('.planner-launch-links'), null);
    assert.equal(actions.querySelector('button.discovery-secondary'), null);
    assert.equal(fragment.querySelector('a[href^="/plan?stops="]'), null);
    assert.equal(fragment.querySelector('.discovery-detail-main-actions a')?.getAttribute('href'), event.officialUrl);
    assert.ok(actions.querySelector('.editorial-share-actions'));
    assert.ok(fragment.textContent?.includes(event.plan[0]));
  }
});

test('confirmed future sessions retain saving and planning, while an empty future catalog offers no invented next event', () => {
  const event = fixture('audit-confirmed-detail');
  const upcoming = JSDOM.fragment(renderToStaticMarkup(<StaticRouter><LocalDiscoveryDetail item={{ kind: 'event', event }} today="2026-10-06" /></StaticRouter>));
  assert.ok(upcoming.querySelector('.discovery-detail-more-actions .planner-launch-links'));
  assert.ok(upcoming.querySelector('.discovery-detail-more-actions button.discovery-secondary'));
  assert.ok(upcoming.querySelector('a[href="/plan?stops=event:audit-confirmed-detail&date=2026-10-10"]'));
  const empty = JSDOM.fragment(renderToStaticMarkup(<StaticRouter><LocalDiscoveryDetail item={{ kind: 'event', event }} today="2027-01-01" /></StaticRouter>));
  assert.equal(empty.querySelectorAll('.discovery-next-event').length, 0);
  assert.ok(empty.querySelector('.discovery-next-events .discovery-inline-note')?.textContent?.includes('暂未收录'));
});

test('current detail recommendations retain exact fees, confirmed dates, official sources, and evergreen return links', () => {
  const selected = MONTHLY_EVENTS.find(event => getRelatedUpcomingEvents(event, '2026-10-06').length > 0);
  assert.ok(selected, 'the published catalog supplies genuine related sessions');
  const related = getRelatedUpcomingEvents(selected, '2026-10-06');
  const fragment = JSDOM.fragment(renderToStaticMarkup(<StaticRouter><LocalDiscoveryDetail item={{ kind: 'event', event: selected }} today="2026-10-06" /></StaticRouter>));
  const cards = [...fragment.querySelectorAll('.discovery-next-event')];
  assert.equal(cards.length, related.length);
  cards.forEach((card, index) => {
    const { event, date } = related[index];
    assert.equal(card.querySelector('h3 a')?.getAttribute('href'), `/events/${event.id}`);
    assert.equal(card.querySelector('time')?.getAttribute('datetime'), date);
    assert.ok(eventOccursOn(event, date));
    assert.ok(card.textContent?.includes(event.costLabel));
    assert.ok(card.textContent?.includes(event.venue));
    const source = card.querySelector('a[target="_blank"]')!;
    assert.equal(source.getAttribute('href'), event.officialUrl);
    assert.match(source.getAttribute('rel')!, /noopener/);
    assert.ok(source.textContent?.includes(event.sourceLabel));
  });
  assert.ok(fragment.querySelector('.discovery-return a[href="/this-week"]'));
  assert.ok(fragment.querySelector('.discovery-return a[href="/this-month#monthly-perks"]'));
  assert.equal(fragment.querySelector('.discovery-return a[href*="when=october"],.discovery-return a[href*="2026-10"]'), null);
});

test('unknown notification totals show a real notification dot and do not invent a numeric count', () => {
  const view = render(<MemoryRouter><SiteMobileNavigation pathname="/me" notificationCount={0} hasNotification onAsk={() => {}} /></MemoryRouter>);
  const badge = view.getByLabelText('有未读通知');
  assert.equal(badge.textContent, '');
  assert.ok(badge.classList.contains('site-mobile-notification-dot'));
  view.rerender(<MemoryRouter><SiteMobileNavigation pathname="/me" notificationCount={2} hasNotification onAsk={() => {}} /></MemoryRouter>);
  assert.equal(view.getByLabelText('2 条未读消息').textContent, '2');
  view.rerender(<MemoryRouter><SiteMobileNavigation pathname="/me" notificationCount={0} onAsk={() => {}} /></MemoryRouter>);
  assert.equal(view.queryByLabelText('有未读通知'), null);
});

test('the complete guide directory stays in crawlable HTML while its collapsed links are hidden until requested', () => {
  const view = render(<MemoryRouter initialEntries={['/guides?q=租房防骗']}><GuidesHome onOpenGuide={() => {}} /></MemoryRouter>);
  const trigger = view.getByRole('button', { name: `查看全部 ${guides.length} 篇指南目录` });
  const directory = view.container.querySelector<HTMLElement>('#guide-complete-directory')!;
  assert.equal(trigger.getAttribute('aria-expanded'), 'false');
  assert.equal(directory.hidden, true);
  assert.equal(within(directory).queryAllByRole('link').length, 0, 'collapsed directory links do not compete with visible search results');
  assert.equal(directory.querySelectorAll('a[href^="/guides/"]').length, guides.length, 'every published target is present in HTML');
  fireEvent.click(trigger);
  assert.equal(trigger.getAttribute('aria-expanded'), 'true');
  assert.equal(directory.hidden, false);
  assert.equal(within(directory).getAllByRole('link').length, guides.length);
  fireEvent.click(trigger);
  assert.equal(directory.hidden, true);
  const ssr = JSDOM.fragment(renderToStaticMarkup(<StaticRouter location="/guides"><GuidesHome onOpenGuide={() => {}} /></StaticRouter>));
  for (const guide of guides) assert.ok(ssr.querySelector(`.guide-complete-index a[href="/guides/${guide.slug}"]`));
});
