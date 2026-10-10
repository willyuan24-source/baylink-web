import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { afterEach, test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'https://www.baylink.us/calendar' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, MutationObserver: dom.window.MutationObserver, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
// jsdom has no layout: let the Sheet's focus trap see connected controls.
dom.window.HTMLElement.prototype.getClientRects = function () {
  return (this.isConnected && !this.hidden ? [{ width: 1, height: 1 }] : []) as unknown as DOMRectList;
};
// The events column imports its stylesheets; here CSS loads as an empty module (the prerender does the same).
registerHooks({ load: (url, context, nextLoad) => url.endsWith('.css') ? { format: 'module', shortCircuit: true, source: 'export {};' } : nextLoad(url, context) });
const { render, cleanup, fireEvent, act, within } = await import('@testing-library/react');
const { MemoryRouter, StaticRouter, useLocation } = await import('react-router-dom');
const { MonthlyEdition } = await import('../src/components/MonthlyEdition');
const { EventsView } = await import('../src/components/EventsView');
const { default: CalendarPage } = await import('../src/pages/CalendarPage');
const { INDEX_EVENTS, activeBulletins, inRange } = await import('../src/features/events/events-model');
const { getMonthlyDateRange, nextOccurrence } = await import('../src/lib/monthly');
afterEach(() => { cleanup(); localStorage.clear(); });

function LocationProbe() { const location = useLocation(); return <output data-testid="route">{location.pathname}{location.search}</output>; }
const today = '2026-10-06'; // Tuesday: the weekend is 10/10–11
const ssr = (location: string, node: React.ReactNode) => JSDOM.fragment(renderToStaticMarkup(<StaticRouter location={location}>{node}</StaticRouter>));
const rangeLine = (root: ParentNode) => root.querySelector('.ev-range')?.textContent;

test('the /events SSR (活动, 本周末) starts on the real Bay Area weekend across language prefixes and trailing slashes', () => {
  const weekend = getMonthlyDateRange('weekend', today)!;
  const count = INDEX_EVENTS.filter(event => inRange(event, weekend, today)).length;
  assert.ok(count > 0);
  for (const path of ['/events', '/events/', '/en/events', '/zh-Hant/events/']) {
    const page = ssr(path, <EventsView today={today} />);
    assert.equal(rangeLine(page), '本周末 · 10/10–11', path);
    assert.match(page.querySelector('.ev-lede-facts')!.textContent!, new RegExp(`^${count} 场 · `), path);
    // Every card in the weekend feed is on Saturday or Sunday, never earlier in the week.
    for (const link of page.querySelectorAll('#monthly-events .ui-feed-card a.ui-card-link')) {
      const event = INDEX_EVENTS.find(item => `/events/${item.id}` === link.getAttribute('href'))!;
      assert.ok([weekend.start, weekend.end].some(day => nextOccurrence(event, day) === day), `${event.id} is on the weekend`);
    }
  }
});

test('/this-month opens on all dates, an explicit URL date wins over the page default, and travel alerts follow the activities', () => {
  assert.match(rangeLine(ssr('/this-month', <MonthlyEdition today={today} defaultDateFilter="all" />))!, /^全部日期 · 收录至/);
  assert.equal(rangeLine(ssr('/this-month', <MonthlyEdition today={today} defaultDateFilter="weekend" />)), '本周末 · 10/10–11');
  assert.equal(rangeLine(ssr('/events?when=today', <MonthlyEdition today={today} defaultDateFilter="weekend" />)), '今天 · 10/6 周二', 'explicit URL state takes priority over the page default');
  const monthly = ssr('/this-month', <MonthlyEdition today={today} defaultDateFilter="all" />);
  assert.ok(activeBulletins(today, 'all').length > 0, 'the fixture day has verified travel alerts');
  const events = monthly.querySelector('#monthly-events')!;
  const news = monthly.querySelector('#monthly-news')!;
  assert.ok(news, 'the current verified bulletins remain available at the #monthly-news anchor');
  assert.ok(events.compareDocumentPosition(news) & 4, 'activities are reached before life bulletins');
  assert.equal(news.tagName, 'DETAILS', 'the alerts stay folded until opened');
});

test('choosing 全部日期 in the filter Sheet persists in the URL and keeps unrelated query parameters', async () => {
  const view = render(<MemoryRouter initialEntries={['/events?region=sf&tracking=kept']}><EventsView today={today} /><LocationProbe /></MemoryRouter>);
  const query = () => new URL(view.getByTestId('route').textContent!, 'https://www.baylink.us').searchParams;
  await act(async () => { fireEvent.click(view.getByRole('button', { name: /^筛选/ })); });
  const sheet = within(view.getByRole('dialog'));
  await act(async () => { fireEvent.click(sheet.getByRole('button', { name: '全部日期', exact: true })); });
  assert.equal(query().get('when'), 'all');
  assert.equal(query().get('region'), 'sf');
  assert.equal(query().get('tracking'), 'kept');
  assert.match(rangeLine(view.container)!, /^全部日期 · 收录至 .* · 旧金山$/);
  // The page default (本周末) leaves the URL instead of being written into it.
  await act(async () => { fireEvent.click(sheet.getByRole('button', { name: '本周末', exact: true })); });
  assert.equal(query().get('when'), null);
  assert.equal(query().get('tracking'), 'kept');
  assert.equal(rangeLine(view.container), '本周末 · 10/10–11 · 旧金山');
});

test('the calendar serves the week strip and the day list first and loads the map only when 地图 is chosen', async () => {
  let view!: ReturnType<typeof render>;
  await act(async () => { view = render(<MemoryRouter initialEntries={['/calendar?date=2026-10-10']}><CalendarPage today={today} /></MemoryRouter>); });
  const week = view.container.querySelector('.ev-week')!;
  const rows = view.container.querySelector('.ev-calendar__rows')!;
  assert.ok(week.compareDocumentPosition(rows) & 4, 'the week strip comes before the rows');
  assert.ok(rows.querySelectorAll('.ui-row-card').length > 0, 'the first render contains actual event rows');
  assert.equal(view.container.querySelector('.ev-calendar__map'), null, 'the map engine is not mounted for the first render');
  const mode = within(view.getByRole('radiogroup', { name: '显示方式' }));
  assert.equal(mode.getByRole('radio', { name: '列表' }).getAttribute('aria-checked'), 'true');
  await act(async () => { fireEvent.click(mode.getByRole('radio', { name: '地图' })); });
  assert.ok(view.container.querySelector('.ev-calendar__map'), '地图 mounts the map panel');
  assert.ok(rows.isConnected && rows.querySelectorAll('.ui-row-card').length > 0, 'the rows stay under the map');
  await act(async () => { fireEvent.click(mode.getByRole('radio', { name: '列表' })); });
  assert.equal(view.container.querySelector('.ev-calendar__map'), null);
});
