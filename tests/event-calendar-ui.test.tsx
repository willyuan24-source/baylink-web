import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { afterEach, test } from 'node:test';
import React from 'react';
import { JSDOM } from 'jsdom';
import type { AppContextValue } from '../src/app/context';

const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'https://www.baylink.us/calendar' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, MutationObserver: dom.window.MutationObserver, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
dom.window.HTMLElement.prototype.getClientRects = function () {
  return (this.isConnected && !this.hidden ? [{ width: 1, height: 1 }] : []) as unknown as DOMRectList;
};
// The calendar (the events column's 日历·地图 view) imports its stylesheet; here CSS loads as an empty module.
registerHooks({ load: (url, context, nextLoad) => url.endsWith('.css') ? { format: 'module', shortCircuit: true, source: 'export {};' } : nextLoad(url, context) });
const { render, cleanup, fireEvent, act, within, waitFor } = await import('@testing-library/react');
const { MemoryRouter, useLocation, useNavigate, Routes, Route, Outlet } = await import('react-router-dom');
const { default: CalendarPage } = await import('../src/pages/CalendarPage');
const { INDEX_EVENTS } = await import('../src/features/events/events-model');
const { nextOccurrence } = await import('../src/lib/monthly');
const { setLocale, translateText } = await import('../src/i18n/locale');
afterEach(async () => { cleanup(); localStorage.clear(); await setLocale('zh-Hans', false); });

const today = '2026-10-09';
function History() { const location = useLocation(); const navigate = useNavigate(); return <><output data-testid="query">{location.search}</output><button onClick={() => navigate(-1)}>Test back</button></>; }
async function open(query = '', openBayBay: AppContextValue['openBayBay'] = () => {}) {
  let view!: ReturnType<typeof render>;
  await act(async () => { view = render(<MemoryRouter initialEntries={['/calendar' + query]}><History /><Routes><Route element={<Outlet context={{ openBayBay }} />}><Route path="/calendar" element={<CalendarPage today={today} />} /></Route></Routes></MemoryRouter>); });
  return view;
}
const onDay = (day: string, region?: string) => INDEX_EVENTS.filter(event => nextOccurrence(event, day) === day && (!region || event.region === region));
// The day's lead card, then its rows.
const rowIds = (view: ReturnType<typeof render>) => [...view.container.querySelectorAll('.ev-calendar__rows a.ui-card-link')].map(link => link.getAttribute('href')!.split('?')[0].replace('/events/', ''));
const sameIds = (actual: string[], expected: { id: string }[]) => assert.deepEqual([...actual].sort(), expected.map(event => event.id).sort());

test('the week strip, city choices and row links all use the selected day', async () => {
  const view = await open('?date=2026-10-17');
  sameIds(rowIds(view), onDay('2026-10-17'));
  for (const link of view.container.querySelectorAll('.ev-calendar__rows a.ui-card-link')) assert.match(link.getAttribute('href')!, /\?date=2026-10-17$/);
  await act(async () => { fireEvent.click(view.getByRole('button', { name: /^10月18日 周日/ })); });
  sameIds(rowIds(view), onDay('2026-10-18'));
  assert.match(view.getByTestId('query').textContent!, /date=2026-10-18/);
  const cities = within(view.container.querySelector('.ev-cities')!);
  const city = onDay('2026-10-18')[0].city;
  await act(async () => { fireEvent.click(cities.getByRole('button', { name: new RegExp(city) })); });
  sameIds(rowIds(view), onDay('2026-10-18').filter(event => event.city === city));
  // A new day clears a city chosen for the previous one.
  await act(async () => { fireEvent.click(view.getByRole('button', { name: /^10月17日 周六/ })); });
  sameIds(rowIds(view), onDay('2026-10-17'));
});

test('加入这天计划 on every listed event of an upcoming day saves into that day at once; a past day has none', async t => {
  // WEB-SAVES (plan D19) moved with the calendar into the events column: one enabled button per listed event.
  t.mock.method(globalThis, 'fetch', async () => new Response('{}'));
  const view = await open('?date=2026-10-17');
  const listed = rowIds(view);
  sameIds(listed, onDay('2026-10-17'));
  // The button loads on its own; a disabled copy holds its place until then.
  await waitFor(() => assert.ok(view.getAllByRole('button', { name: /^加入这天计划：/ }).every(button => !button.hasAttribute('disabled'))));
  const adds = view.getAllByRole('button', { name: /^加入这天计划：/ });
  assert.equal(adds.length, listed.length);
  await act(async () => { fireEvent.click(adds[0]); });
  const plan = JSON.parse(localStorage.getItem('baylink.planner.guest.v1')!).plans[0];
  assert.equal(plan.date, '2026-10-17');
  assert.deepEqual(plan.stops, [{ kind: 'event', id: listed[0] }]);
  assert.match(view.getByTestId('save-toast').textContent!, /已加入 10\/17 计划/);
  assert.equal(within(view.getByTestId('save-toast')).getByRole('link', { name: '查看' }).getAttribute('href'), '/my-week#plan-2026-10-17');
  cleanup();
  const past = await open('?date=2026-10-08');
  assert.ok(rowIds(past).length > 0, 'the past day lists events');
  assert.equal(past.queryAllByRole('button', { name: /^加入这天计划/ }).length, 0, 'no 加入这天计划 on a past day');
});

test('week navigation crosses the month boundary, keeps the region and restores with Back', async () => {
  const view = await open('?date=2026-10-31&region=east-bay');
  assert.equal(view.container.querySelectorAll('.ev-week__day').length, 7);
  assert.ok(view.getByRole('button', { name: /^11月1日 周日/ }));
  await act(async () => { fireEvent.click(view.getByRole('button', { name: '下一周' })); });
  assert.match(view.getByTestId('query').textContent!, /date=2026-11-07/);
  assert.match(view.getByTestId('query').textContent!, /region=east-bay/);
  sameIds(rowIds(view), onDay('2026-11-07', 'east-bay'));
  assert.ok(rowIds(view).includes('livermore-great-elephant-migration-2026'), 'the verified outdoor exhibition continues into November');
  await act(async () => { fireEvent.click(view.getByRole('button', { name: 'Test back' })); });
  assert.match(view.getByTestId('query').textContent!, /date=2026-10-31/);
  sameIds(rowIds(view), onDay('2026-10-31', 'east-bay'));
});

test('malformed deep links fall back to today and the whole Bay Area, without fictional events', async () => {
  const view = await open('?date=2026-02-30&view=constructor&region=__proto__');
  assert.equal(view.container.querySelector('.ev-week__day[aria-pressed="true"]')?.getAttribute('aria-current'), 'date');
  sameIds(rowIds(view), onDay(today));
  assert.match(view.getByRole('button', { name: /选日期/ }).textContent!, /整个湾区/);
  assert.equal(view.container.querySelectorAll('.calendar-event-map-pin').length, 0, 'the map is not loaded until 地图 is chosen');
});

test('a day before this edition says so instead of claiming nothing happened', async () => {
  const view = await open('?date=2026-09-20');
  assert.match(view.container.querySelector('.ev-calendar__before')!.textContent!, /这一天在本期收录（10\/7 起）之前/);
  for (const id of rowIds(view)) assert.ok(INDEX_EVENTS.find(event => event.id === id)!.endDate >= today, `${id} is still running`);
});

test('the calendar asks BayBay in draft mode with the date, region and city in all three languages', async () => {
  for (const locale of ['zh-Hans', 'zh-Hant', 'en'] as const) {
    await setLocale(locale, false, '/calendar');
    const calls: Parameters<AppContextValue['openBayBay']>[] = [];
    const view = await open('?date=2026-10-31&region=east-bay', (...args) => calls.push(args));
    const ask = () => fireEvent.click(view.getByRole('button', { name: locale === 'en' ? 'Ask BayBay to plan this day' : translateText('让 BayBay 帮我安排这一天', locale) }));
    fireEvent.click(within(view.container.querySelector('.ev-cities')!).getByRole('button', { name: /Livermore/ }));
    ask();
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0][1], { mode: 'draft' });
    assert.match(calls[0][0]!, /2026-10-31/);
    assert.ok(calls[0][0]!.includes(locale === 'en' ? 'East Bay' : translateText('东湾', locale)));
    assert.match(calls[0][0]!, /Livermore/);
    if (locale === 'en') assert.doesNotMatch(calls[0][0]!, /\p{Script=Han}/u);
    if (locale === 'zh-Hant') assert.match(calls[0][0]!, /請幫我安排/);
    await act(async () => { fireEvent.click(view.getByRole('button', { name: locale === 'en' ? 'Next week' : translateText('下一周', locale) })); });
    ask();
    assert.match(calls[1][0]!, /2026-11-07/);
    assert.doesNotMatch(calls[1][0]!, /Livermore|2026-10-31/, 'a new day drops the old city');
    cleanup();
  }
});

test('invalid calendar query values never enter the BayBay draft', async () => {
  const calls: Parameters<AppContextValue['openBayBay']>[] = [];
  const view = await open('?date=2026-02-30&region=__proto__&city=Invented', (...args) => calls.push(args));
  fireEvent.click(view.getByRole('button', { name: '让 BayBay 帮我安排这一天' }));
  assert.match(calls[0][0]!, new RegExp(`${today}.*湾区`));
  assert.doesNotMatch(calls[0][0]!, /2026-02-30|__proto__|Invented/);
  assert.deepEqual(calls[0][1], { mode: 'draft' });
});
