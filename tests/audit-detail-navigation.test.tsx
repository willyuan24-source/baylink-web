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
const { LocalDiscoveryDetail } = await import('../src/components/LocalDiscoveryDetail');
const { buildDetailRecord } = await import('../src/features/detail/build-detail');
const { railEvents } = await import('../src/features/detail/detail-record');
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

/** The record a detail page renders for this event, with `events` as the catalog its rails draw from. */
const recordFor = (event: MonthlyEvent, events: readonly MonthlyEvent[] = [event]) => buildDetailRecord({ kind: 'event', event }, events);
const related = (event: MonthlyEvent, today: string, events: readonly MonthlyEvent[] = MONTHLY_EVENTS) =>
  railEvents(event, recordFor(event, events).rail, today, { sameCategory: true, limit: 3 });
const page = (event: MonthlyEvent, today: string, events?: readonly MonthlyEvent[]) =>
  JSDOM.fragment(renderToStaticMarkup(<StaticRouter><LocalDiscoveryDetail record={recordFor(event, events)} today={today} /></StaticRouter>));

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
  const actual = related(current, '2026-10-06', candidates);
  assert.deepEqual(actual.map(({ event, date }) => [event.id, date]), [['audit-city-next', '2026-10-10'], ['audit-city-later', '2026-10-16'], ['audit-region', '2026-10-08']]);
  for (const { event, date } of actual) assert.ok(eventOccursOn(event as unknown as MonthlyEvent, date));
  assert.equal(related(current, '2026-11-01', candidates).length, 0);
  assert.equal(related(current, '2026-10-06', [current, nextCity]).length, 1, 'one real session does not become three fabricated cards');
  assert.ok(!recordFor(current, candidates).rail.some(event => event.id === 'audit-unconfirmed' || event.id === 'audit-other-region'), 'no unconfirmed or far-away candidates are kept');
});

test('expired and unconfirmed event details keep official access and sharing, without saving or planning', () => {
  for (const event of [fixture('audit-ended-detail', { endDate: '2026-10-05', occurrenceDates: ['2026-10-05'] }), fixture('audit-empty-schedule', { occurrenceDates: [] })]) {
    const fragment = page(event, '2026-10-06');
    const actions = fragment.querySelector('.site-detail-actions')!;
    assert.ok(actions, 'the action bar replaces the tab bar on this route');
    assert.equal(actions.querySelector('a[target="_blank"]')?.getAttribute('href'), event.officialUrl);
    assert.equal(actions.querySelector('.saves-toggle'), null, 'no ♡ for a listing that cannot be planned');
    assert.equal(fragment.querySelector('.saves-add-day'), null);
    assert.equal(fragment.querySelector('a[href^="/plan?stops="]'), null);
    assert.equal(fragment.querySelector('.detail-calendar'), null);
    assert.ok(fragment.querySelector('.detail-share .editorial-share-actions'));
  }
  const ended = page(fixture('audit-ended-detail', { endDate: '2026-10-05', occurrenceDates: ['2026-10-05'] }), '2026-10-06');
  assert.ok([...ended.querySelectorAll('.ui-status')].some(chip => chip.textContent === '已结束 · 10/5'));
  assert.ok(!ended.textContent?.includes('Check the organizer before leaving.'), 'an ended event hides the departure checklist');
  const waiting = page(fixture('audit-empty-schedule', { occurrenceDates: [] }), '2026-10-06');
  assert.ok(waiting.textContent?.includes('暂无已确认场次'));
  assert.ok(waiting.textContent?.includes('Check the organizer before leaving.'), 'a postponed event is not over: its checklist stays');
});

test('ended events show what is on next nearby on the first screen, before the facts', () => {
  const ended = fixture('audit-ended-rail', { endDate: '2026-10-05', occurrenceDates: ['2026-10-05'] });
  const next = [fixture('audit-next-a', { category: 'food', occurrenceDates: ['2026-10-12'] }), fixture('audit-next-b', { city: 'Berkeley', occurrenceDates: ['2026-10-09'] })];
  const fragment = page(ended, '2026-10-06', [ended, ...next]);
  const rail = fragment.querySelector('section[aria-labelledby="detail-next-title"]')!;
  assert.equal(rail.querySelector('h2')?.textContent, '接下来可以去');
  assert.deepEqual([...rail.querySelectorAll('a.ui-card-link')].map(link => link.getAttribute('href')), ['/events/audit-next-a?date=2026-10-12', '/events/audit-next-b?date=2026-10-09'], 'same city first, any category');
  assert.ok(rail.compareDocumentPosition(fragment.querySelector('.detail-facts')!) & 4, 'the rail comes before the facts');
  assert.ok(fragment.querySelector('.detail-hero')!.compareDocumentPosition(rail) & 4, 'after the hero');
});

test('confirmed future sessions keep the ♡, the day plan and the calendar; an empty future offers no invented next event', () => {
  const event = fixture('audit-confirmed-detail');
  const upcoming = page(event, '2026-10-06');
  const actions = upcoming.querySelector('.site-detail-actions')!;
  assert.equal(actions.querySelector('.saves-toggle')?.textContent, '收藏', 'the one ♡ save control');
  assert.equal(actions.querySelector('[data-day]')?.getAttribute('data-day'), '2026-10-10');
  assert.ok(actions.querySelector('.saves-add-day'));
  assert.ok(upcoming.querySelector('.detail-calendar'));
  const later = page(event, '2027-01-01');
  assert.equal(later.querySelectorAll('.detail-rail .ui-feed-card').length, 0);
});

test('related cards are real sessions with their own date in the link, and the page ends with evergreen links', () => {
  const selected = MONTHLY_EVENTS.find(event => related(event, '2026-10-06').length > 0);
  assert.ok(selected, 'the published catalog supplies genuine related sessions');
  const cards = related(selected, '2026-10-06');
  const fragment = JSDOM.fragment(renderToStaticMarkup(<StaticRouter><LocalDiscoveryDetail record={buildDetailRecord({ kind: 'event', event: selected })} today="2026-10-06" /></StaticRouter>));
  const links = [...fragment.querySelectorAll('section[aria-labelledby="detail-related-title"] a.ui-card-link')];
  assert.deepEqual(links.map(link => link.getAttribute('href')), cards.map(({ event, date }) => `/events/${event.id}?date=${date}`));
  for (const { event, date } of cards) assert.ok(eventOccursOn(event as unknown as MonthlyEvent, date));
  assert.ok(fragment.querySelector('.discovery-return a[href="/events"]'));
  assert.ok(fragment.querySelector('.discovery-return a[href="/my-week#saved"]'));
  assert.ok(fragment.querySelector('.discovery-return a[href="/events?view=perks"]'));
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
  for (const guide of guides) assert.ok(ssr.querySelector(`#guide-complete-directory a[href="/guides/${guide.slug}"]`));
});
