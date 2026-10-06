import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import { MONTHLY_EVENTS } from '../src/data/monthly-edition';
import { filterMonthlyEvents, getMonthlyDateRange } from '../src/lib/monthly';

const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'https://www.baylink.us/calendar' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { render, cleanup, fireEvent, act } = await import('@testing-library/react');
const { MemoryRouter, StaticRouter, useLocation } = await import('react-router-dom');
const { MonthlyEdition } = await import('../src/components/MonthlyEdition');
const { default: CalendarPage } = await import('../src/pages/CalendarPage');
const originalMatchMedia = dom.window.matchMedia;
afterEach(() => { cleanup(); dom.window.matchMedia = originalMatchMedia; });

function LocationProbe() { const location = useLocation(); return <output data-testid="route">{location.pathname}{location.search}</output>; }
const today = '2026-10-06';
const dateButton = (document: ParentNode) => document.querySelector('.bl-monthly-date-options button[aria-pressed="true"]')?.textContent;

test('weekly SSR starts with the real Bay Area weekend across language prefixes and trailing slashes', () => {
  for (const path of ['/this-week', '/this-week/', '/en/this-week', '/zh-Hant/this-week/']) {
    const fragment = JSDOM.fragment(renderToStaticMarkup(<StaticRouter location={path}><MonthlyEdition today={today} /></StaticRouter>));
    assert.equal(dateButton(fragment), '这个周末', path);
    const range = getMonthlyDateRange('weekend', today)!;
    assert.deepEqual([...fragment.querySelectorAll('.bl-monthly-date-range time')].map(item => item.getAttribute('datetime')), [range.start, range.end]);
    assert.equal(fragment.querySelector('.bl-monthly-results [role="status"]')?.textContent, `找到 ${filterMonthlyEvents(MONTHLY_EVENTS, { date: 'weekend' }, today).length} 场活动`);
  }
});

test('monthly SSR defaults to all dates, allows explicit initial filters, and places life bulletins after activities', () => {
  const monthly = JSDOM.fragment(renderToStaticMarkup(<StaticRouter location="/this-month"><MonthlyEdition today={today} defaultDateFilter="all" /></StaticRouter>));
  assert.equal(dateButton(monthly), '全部日期');
  const sections = [...monthly.querySelectorAll('section[id]')].map(item => item.id);
  assert.ok(sections.includes('monthly-news'), 'the current verified bulletins remain available');
  assert.ok(sections.indexOf('monthly-events') < sections.indexOf('monthly-news'), 'activities are reached before life bulletins');
  assert.ok(sections.indexOf('monthly-news') < sections.indexOf('monthly-perks'));
  const explicit = JSDOM.fragment(renderToStaticMarkup(<StaticRouter location="/this-month"><MonthlyEdition today={today} defaultDateFilter="weekend" /></StaticRouter>));
  assert.equal(dateButton(explicit), '这个周末');
  const override = JSDOM.fragment(renderToStaticMarkup(<StaticRouter location="/this-week?when=today"><MonthlyEdition today={today} defaultDateFilter="weekend" /></StaticRouter>));
  assert.equal(dateButton(override), '今天', 'explicit URL state takes priority over the page default');
});

test('weekly all-dates selection persists in the URL and retains unrelated query filters', () => {
  const view = render(<MemoryRouter initialEntries={['/this-week?region=sf&tracking=kept']}><MonthlyEdition today={today} /><LocationProbe /></MemoryRouter>);
  fireEvent.click(view.getByRole('button', { name: '全部日期', exact: true }));
  assert.equal(dateButton(view.container), '全部日期');
  const query = new URL(view.getByTestId('route').textContent!, 'https://www.baylink.us').searchParams;
  assert.equal(query.get('when'), 'all');
  assert.equal(query.get('region'), 'sf');
  assert.equal(query.get('tracking'), 'kept');
  fireEvent.click(view.getByRole('button', { name: '这个周末', exact: true }));
  assert.equal(dateButton(view.container), '这个周末');
});

function viewport(matches: boolean) {
  const listeners = new Set<() => void>();
  const media = { matches, media: '(min-width: 781px)', onchange: null, addEventListener: (_type: string, listener: () => void) => listeners.add(listener), removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener), addListener: (listener: () => void) => listeners.add(listener), removeListener: (listener: () => void) => listeners.delete(listener), dispatchEvent: () => true };
  dom.window.matchMedia = (() => media) as typeof window.matchMedia;
  return { resize: (next: boolean) => { media.matches = next; for (const listener of listeners) listener(); }, listeners };
}

test('phone calendar serves the day list before the calendar and keeps the map unloaded until expanded', async () => {
  viewport(false);
  const view = render(<MemoryRouter initialEntries={['/calendar?date=2026-10-05']}><CalendarPage today={today} /></MemoryRouter>);
  const panel = view.container.querySelector<HTMLElement>('#ec-day-map')!;
  assert.equal(panel.hidden, true);
  assert.equal(panel.childElementCount, 0, 'the map engine is not mounted for the phone first render');
  assert.equal(view.container.querySelector('.ec-layout > section')?.className, 'ec-day-panel', 'DOM reading and focus order begins with the list');
  assert.ok(view.container.querySelectorAll('.ec-event-card').length > 0, 'the phone first render contains actual event cards');
  const toggle = view.getByRole('button', { name: '展开活动地图', exact: true });
  assert.equal(toggle.getAttribute('aria-expanded'), 'false');
  assert.equal(toggle.getAttribute('aria-controls'), 'ec-day-map');
  await act(async () => { fireEvent.click(toggle); });
  assert.equal(panel.hidden, false);
  assert.equal(view.getByRole('button', { name: '收起活动地图', exact: true }).getAttribute('aria-expanded'), 'true');
  await act(async () => { fireEvent.click(view.getByRole('button', { name: '收起活动地图', exact: true })); });
  assert.equal(panel.hidden, true);
  assert.equal(panel.childElementCount, 0);
});

test('phone location actions open the map, while desktop and viewport changes keep the map available', async () => {
  const media = viewport(false);
  let view!: ReturnType<typeof render>;
  await act(async () => { view = render(<MemoryRouter initialEntries={['/calendar?date=2026-10-05']}><CalendarPage today={today} /></MemoryRouter>); });
  const before = view.container.querySelectorAll('.ec-event-card').length;
  await act(async () => { fireEvent.click(view.getAllByRole('button', { name: '定位场馆', exact: true })[0]); });
  assert.equal(view.container.querySelector<HTMLElement>('#ec-day-map')!.hidden, false);
  assert.ok(view.container.querySelectorAll('.ec-event-card').length <= before);
  assert.ok(view.getByRole('button', { name: '清除地图地点筛选' }));
  cleanup();
  viewport(true);
  await act(async () => { view = render(<MemoryRouter><CalendarPage today={today} /></MemoryRouter>); });
  assert.equal(view.container.querySelector<HTMLElement>('#ec-day-map')!.hidden, false, 'desktop opens the map automatically');
  cleanup();
  assert.equal(media.listeners.size, 0, 'the responsive listener is removed when navigating away');
  const changing = viewport(false);
  await act(async () => { view = render(<MemoryRouter><CalendarPage today={today} /></MemoryRouter>); });
  await act(async () => { changing.resize(true); });
  assert.equal(view.container.querySelector<HTMLElement>('#ec-day-map')!.hidden, false);
  await act(async () => { changing.resize(false); });
  assert.equal(view.container.querySelector<HTMLElement>('#ec-day-map')!.hidden, true);
  const css = readFileSync(new URL('../src/components/event-calendar.css', import.meta.url), 'utf8');
  assert.match(css, /@media\(min-width:781px\)\{[^}]*ec-map-toggle\{display:none\}/);
  assert.match(css, /\.ec-calendar-panel\{grid-column:1;grid-row:1\}/, 'desktop keeps its calendar left and event list right');
});
