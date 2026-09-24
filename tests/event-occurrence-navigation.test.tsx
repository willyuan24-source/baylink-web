import assert from 'node:assert/strict';
import { after, afterEach, beforeEach, test } from 'node:test';
import React from 'react';
import { JSDOM } from 'jsdom';
import { renderToStaticMarkup } from 'react-dom/server';
import { MONTHLY_EVENTS } from '../src/data/monthly-edition';
import { nextConfirmedEventDate } from '../src/lib/event-occurrences';

const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'https://www.baylink.us/my-week' });
const globals = {
  window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
  localStorage: dom.window.localStorage, HTMLElement: dom.window.HTMLElement,
  Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true,
};
const previous = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
const { render, cleanup, act } = await import('@testing-library/react');
const { MemoryRouter, StaticRouter } = await import('react-router-dom');
const { LocalDiscoveryDetail } = await import('../src/components/LocalDiscoveryDetail');
const { default: MyWeekPage } = await import('../src/pages/MyWeekPage');
const { api } = await import('../src/lib/api');
const publishedEvents = [...MONTHLY_EVENTS];
const fixture = (id: string, occurrenceDates?: string[]) => ({
  ...publishedEvents[0], id, title: id, startDate: '2026-09-20', endDate: '2026-10-31', occurrenceDates,
});

beforeEach(context => {
  context.mock.timers.enable({ apis: ['Date'], now: new Date('2026-09-27T19:00:00Z') });
  context.mock.method(globalThis, 'fetch', async () => new Response('{}'));
  context.mock.method(api, 'request', async () => { throw new Error('A guest page cannot require account APIs'); });
  localStorage.clear();
});
afterEach(() => { cleanup(); localStorage.clear(); MONTHLY_EVENTS.splice(0, MONTHLY_EVENTS.length, ...publishedEvents); });
after(() => {
  dom.window.close();
  for (const [key, descriptor] of previous) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
});

test('next confirmed day supports unordered sessions, continuous events and exhausted ranges', () => {
  const event = fixture('sessions', ['2026-10-10', '2026-09-20', '2026-09-29']);
  assert.equal(nextConfirmedEventDate(event, '2026-09-27'), '2026-09-29');
  assert.equal(nextConfirmedEventDate(event, '2026-09-29'), '2026-09-29');
  assert.equal(nextConfirmedEventDate(event, '2026-10-11'), null);
  assert.equal(nextConfirmedEventDate(fixture('none', []), '2026-09-27'), null);
  assert.equal(nextConfirmedEventDate(fixture('continuous'), '2026-09-27'), '2026-09-27');
  assert.equal(nextConfirmedEventDate(fixture('continuous'), '2026-09-19'), '2026-09-20');
  assert.equal(nextConfirmedEventDate(fixture('continuous'), '2026-11-01'), null);
});

test('the published Fleet Week detail starts a plan on its first confirmed program day', () => {
  const event = publishedEvents.find(item => item.id === 'san-francisco-fleet-week-2026')!;
  assert.equal(event.startDate, '2026-10-04');
  const body = renderToStaticMarkup(<StaticRouter><LocalDiscoveryDetail item={{ kind: 'event', event }} today="2026-09-27" /></StaticRouter>);
  const page = new JSDOM(body);
  const link = [...page.window.document.querySelectorAll('a')].find(node => node.textContent?.includes('新建出游计划'));
  assert.equal(link?.getAttribute('href'), `/plan?stops=event:${event.id}&date=2026-10-06`);
  page.window.close();
});

test('details with no future confirmed sessions hide plan and calendar actions even before the wider range ends', () => {
  for (const occurrenceDates of [[], ['2026-09-20']]) {
    const body = renderToStaticMarkup(<StaticRouter><LocalDiscoveryDetail item={{ kind: 'event', event: fixture('no-future', occurrenceDates) }} today="2026-09-27" /></StaticRouter>);
    const page = new JSDOM(body);
    assert.equal([...page.window.document.querySelectorAll('a')].some(node => node.textContent?.includes('新建出游计划')), false);
    assert.equal([...page.window.document.querySelectorAll('button')].some(node => node.textContent?.includes('存入日历')), false);
    if (!occurrenceDates.length) assert.match(page.window.document.body.textContent!, /暂无已确认场次/);
    page.window.close();
  }
});

test('My Week excludes gaps covering the entire week and links only to a confirmed future day', async () => {
  MONTHLY_EVENTS.splice(0, MONTHLY_EVENTS.length,
    fixture('next-week-only', ['2026-09-26', '2026-10-10']),
    fixture('no-confirmed-days', []),
    fixture('exhausted-sessions', ['2026-09-20']),
    fixture('this-week-sessions', ['2026-10-10', '2026-09-26', '2026-09-29']),
    fixture('continuous-program'),
  );
  let view!: ReturnType<typeof render>;
  await act(async () => { view = render(<MemoryRouter><MyWeekPage /></MemoryRouter>); });
  const cards = [...view.container.querySelectorAll('.week-event-card')];
  assert.deepEqual(cards.map(card => card.querySelector('h3')?.textContent), ['continuous-program', 'this-week-sessions']);
  assert.deepEqual(cards.map(card => card.querySelector('a[href^="/plan?"]')?.getAttribute('href')), [
    '/plan?stops=event:continuous-program&date=2026-09-27',
    '/plan?stops=event:this-week-sessions&date=2026-09-29',
  ]);
});
