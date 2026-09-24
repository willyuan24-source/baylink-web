import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import React from 'react';
import { JSDOM } from 'jsdom';
import { PLANNER_EVENTS } from '../src/data/planner-catalog';

const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'https://www.baylink.us/calendar' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { render, cleanup, fireEvent, act, within } = await import('@testing-library/react');
const { MemoryRouter, useLocation, useNavigate } = await import('react-router-dom');
const { default: CalendarPage } = await import('../src/pages/CalendarPage');
const { eventsOnCalendarDay } = await import('../src/lib/event-calendar');
afterEach(cleanup);

function History() { const location = useLocation(); const navigate = useNavigate(); return <><output data-testid="query">{location.search}</output><button onClick={() => navigate(-1)}>Test back</button></>; }
async function open(query = '') {
  let view!: ReturnType<typeof render>;
  await act(async () => { view = render(<MemoryRouter initialEntries={['/calendar' + query]}><History /><CalendarPage today="2026-09-23" /></MemoryRouter>); });
  return view;
}
const visibleTitles = (view: ReturnType<typeof render>) => [...view.container.querySelectorAll('.ec-event-card h3')].map(element => element.textContent);

test('month date markers, city choices and plan links all use the selected day', async () => {
  const view = await open('?date=2026-10-04');
  const calendar = within(view.getByRole('region', { name: '活动日期日历' }));
  assert.equal(view.container.querySelectorAll('.ec-days .ec-day').length % 7, 0);
  assert.ok(!visibleTitles(view).some(title => title?.includes('Fleet Week')), 'unpublished opening dates must not appear');
  await act(async () => { fireEvent.click(calendar.getByRole('button', { name: /^2026年10月5日/ })); });
  const expected = eventsOnCalendarDay(PLANNER_EVENTS, '2026-10-05');
  assert.deepEqual(visibleTitles(view), expected.map(event => event.title));
  for (const link of view.getAllByRole('link', { name: '加入这天计划' })) assert.match(link.getAttribute('href')!, /date=2026-10-05&stops=event:/);
  const cities = within(view.getByLabelText('当天的城市与区域'));
  await act(async () => { fireEvent.click(cities.getByRole('button', { name: /^San Francisco/ })); });
  assert.deepEqual(visibleTitles(view), expected.filter(event => event.city === 'San Francisco').map(event => event.title));
});

test('map location selection narrows the list and changing day clears stale city and location filters', async () => {
  const view = await open('?date=2026-10-05');
  const cards = [...view.container.querySelectorAll('.ec-event-card')];
  const n8n = cards.find(card => card.textContent?.includes('n8n'))!;
  assert.ok(n8n);
  await act(async () => { fireEvent.click(within(n8n as HTMLElement).getByRole('button', { name: '定位场馆' })); });
  assert.equal(visibleTitles(view).length, 1);
  assert.match(visibleTitles(view)[0]!, /n8n/);
  await act(async () => { fireEvent.change(view.getByLabelText('跳到日期'), { target: { value: '2026-10-02' } }); });
  assert.equal(view.queryByRole('button', { name: '清除地图地点筛选' }), null);
  assert.deepEqual(visibleTitles(view), eventsOnCalendarDay(PLANNER_EVENTS, '2026-10-02').map(event => event.title));
});

test('week navigation crosses the month boundary, preserves filters and restores with Back', async () => {
  const view = await open('?date=2026-10-31&view=week&region=east-bay');
  assert.equal(view.container.querySelectorAll('.ec-days .ec-day').length, 7);
  assert.ok(view.getByRole('button', { name: /^2026年11月1日/ }));
  await act(async () => { fireEvent.click(view.getByRole('button', { name: '下一周' })); });
  assert.match(view.getByTestId('query').textContent!, /date=2026-11-07/);
  assert.match(view.getByTestId('query').textContent!, /region=east-bay/);
  assert.equal(visibleTitles(view).length, 0);
  assert.ok(view.getByRole('heading', { name: '这一天，暂未收录活动。' }));
  await act(async () => { fireEvent.click(view.getByRole('button', { name: 'Test back' })); });
  assert.match(view.getByTestId('query').textContent!, /date=2026-10-31/);
  assert.deepEqual(visibleTitles(view), eventsOnCalendarDay(PLANNER_EVENTS, '2026-10-31').filter(event => event.region === 'east-bay').map(event => event.title));
});

test('malformed deep links safely fall back to today and current month, without fictional events', async () => {
  const view = await open('?date=2026-02-30&view=constructor&region=__proto__');
  assert.equal(view.getByRole('button', { name: '月历', exact: true }).getAttribute('aria-pressed'), 'true');
  assert.equal((view.getByLabelText('跳到日期') as HTMLInputElement).value, '2026-09-23');
  assert.equal((view.getByLabelText('地区') as HTMLSelectElement).value, 'all');
  assert.deepEqual(visibleTitles(view), []);
  assert.equal(view.container.querySelectorAll('.calendar-event-map-pin').length, 0);
});
