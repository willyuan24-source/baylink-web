import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { EventsIndex, EventsLater, IndexEvent } from '../src/features/events/events-index-types';

/**
 * WEB-PERF-2: /events and /calendar carry the events of their first screens only (events-index.json `near`); the rest
 * (events-later.json) loads when a view reaches past those days, so a batch of far-off events no longer grows the routes.
 * BAYLINK_LAZY_EVENTS=1 makes Node take the browser's path (events-model.ts installs the rest at once otherwise).
 */
process.env.BAYLINK_LAZY_EVENTS = '1';
registerHooks({ load: (url, context, nextLoad) => url.endsWith('.css') ? { format: 'module', shortCircuit: true, source: 'export {};' } : nextLoad(url, context) });
const { StaticRouter } = await import('react-router-dom');
const { EventsShell } = await import('../src/features/events/EventsShell');
const model = await import('../src/features/events/events-model');
const later = await import('../src/features/events/events-later');
// The page modules evaluate here, in Node; the boot test below stubs `window` only around currentPageLoader.
const { default: CalendarPage } = await import('../src/pages/CalendarPage');
const { default: EventsPage } = await import('../src/pages/EventsPage');
const { currentPageLoader, pageLoaders } = await import('../src/route-loaders');
const { nextOccurrence } = await import('../src/lib/monthly');
const { addCalendarDays } = await import('../src/lib/calendar-days');

const route = JSON.parse(readFileSync('src/data/generated/events-index.json', 'utf8')) as EventsIndex;
const rest = JSON.parse(readFileSync('src/data/generated/events-later.json', 'utf8')) as EventsLater;
const occursIn = (event: IndexEvent, start: string, end: string) => { const day = nextOccurrence(event, start); return !!day && day <= end; };
const render = (today: string, search = '') => renderToStaticMarkup(<StaticRouter location={`/events${search}`}><EventsShell today={today} /></StaticRouter>);
const renderCalendar = (today: string, date: string) => renderToStaticMarkup(<StaticRouter location={`/calendar?date=${date}`}><CalendarPage today={today} /></StaticRouter>);
// a week before the route's last day: its weekend and its next 7 days are all inside; a day 8 days past it is not
const today = addCalendarDays(route.near.through, -7);
const laterDay = addCalendarDays(route.near.through, 8);
const weekLabels = (html: string) => [...html.matchAll(/<button type="button" class="ev-week__day"[^>]*aria-label="([^"]+)"/g)].map(match => match[1]);

test('the route lists every event of its own days; the rest has none of them; together they are the catalog once', () => {
  const { from, through } = route.near;
  assert.ok(from <= through && addCalendarDays(from, 6) <= through, `${from}…${through} holds a week`);
  for (const event of route.events) assert.ok(occursIn(event, from, through), `${event.id} is on a day of ${from}…${through}`);
  for (const event of rest.events) assert.equal(occursIn(event, from, through), false, `${event.id} is listed by the route already`);
  const ids = [...route.events, ...rest.events].map(event => event.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(rest.at.length, rest.events.length);
  assert.ok(rest.at.every((position, index) => index === 0 || position > rest.at[index - 1]), 'positions ascend');
  for (const key of Object.keys(rest.images)) assert.equal(Object.hasOwn(route.images, key), false, `${key} ships once`);
});

test('a view inside the route\'s days renders at once; a later one shows a fixed-height skeleton until the rest is in', async () => {
  assert.equal(model.isLaterInstalled(), false);
  assert.equal(model.INDEX_EVENTS.length, route.events.length);
  // 本周末 of a day inside the route's days: no skeleton, the list is there
  const weekend = render(today);
  assert.doesNotMatch(weekend, /正在加载这些日期的活动/);
  // 全部日期 reaches past them: the skeleton (aria-busy) and the loading status, no count line yet
  const all = render(today, '?when=all');
  assert.match(all, /正在加载这些日期的活动/);
  assert.match(all, /aria-busy="true"/);
  assert.doesNotMatch(all, /\d+ 场 · \d+ 场免费/);
  // boot: the first screens wait for nothing more
  for (const [page, search] of [['events', ''], ['events', '?view=perks'], ['events', '?when=next7'], ['calendar', '']] as const) await later.loadForLocation(page, search, 'zh-Hans', today);
  assert.equal(model.isLaterInstalled(), false, 'the first screens need nothing more');
});

test('the calendar of a later week shows its skeleton and announces no count (no "0 场") until the rest is in', () => {
  assert.equal(model.isLaterInstalled(), false);
  // a week inside the route's days: the counts are there at once
  const near = renderCalendar(today, today);
  assert.match(near, /class="ev-calendar__count"/);
  assert.ok(weekLabels(near).every(label => / · \d+ 场$/.test(label)), 'each day names its count');
  const html = renderCalendar(today, laterDay);
  assert.match(html, /aria-busy="true"/, 'the rows are a skeleton');
  assert.doesNotMatch(html, /class="ev-calendar__count"/);
  const labels = weekLabels(html);
  assert.equal(labels.length, 7);
  for (const label of labels) assert.doesNotMatch(label, /场/, `${label}: the date only while the week loads`);
});

test('boot: the page chunk for a link past the route\'s days resolves only once the rest is in (the page\'s prepare)', async () => {
  assert.equal(model.isLaterInstalled(), false);
  // Node (the prerender, the route table): the plain page loaders
  assert.equal(currentPageLoader('/calendar'), pageLoaders.calendar);
  const at = (pathname: string, search: string) => Object.assign(globalThis, { window: { location: { pathname, search } } });
  try {
    at('/events', '?view=perks');
    const perks = currentPageLoader('/events');
    assert.notEqual(perks, pageLoaders.events, 'in the browser /events runs its prepare step');
    assert.equal((await perks()).default, EventsPage);
    assert.equal(model.isLaterInstalled(), false, 'the perks board needs nothing more');
    at('/en/calendar', `?date=${laterDay}`);
    let settled = false;
    const boot = currentPageLoader('/calendar')().then(module => { settled = true; return module; });
    await pageLoaders.calendar();
    assert.equal(settled, false, 'the page chunk is in, the rest of the catalog is not: the prerender stays');
    const module = await boot;
    assert.equal(module.default, CalendarPage);
    assert.equal(model.isLaterInstalled(), true, 'the rest is in before the app replaces the prerender');
    assert.equal(later.isLaterReady('en'), true, '/en has its English pack too');
  } finally { delete (globalThis as { window?: unknown }).window; }
});

test('once the rest is in: the merged catalog in its order, the counts and the later week of the calendar', async () => {
  await later.loadForLocation('events', '?when=all', 'zh-Hans', today);
  assert.equal(model.isLaterInstalled(), true);
  assert.equal(model.INDEX_EVENTS.length, route.events.length + rest.events.length);
  assert.equal(model.EVENTS_INDEX.events, model.INDEX_EVENTS);
  // each later event is back at its own position; the route's events keep their order in between
  rest.at.forEach((position, index) => assert.equal(model.INDEX_EVENTS[position].id, rest.events[index].id));
  assert.deepEqual(model.INDEX_EVENTS.filter(event => route.events.some(item => item.id === event.id)).map(event => event.id), route.events.map(event => event.id));
  for (const key of Object.keys(rest.images)) assert.ok(Object.hasOwn(model.EVENTS_INDEX.images, key), `${key} joins the cover registry`);
  const loaded = render(today, '?when=all');
  assert.doesNotMatch(loaded, /正在加载这些日期的活动/);
  assert.match(loaded, /\d+ 场 · \d+ 场免费/);
  const calendar = renderCalendar(today, laterDay);
  assert.doesNotMatch(calendar, /aria-busy="true"/);
  assert.match(calendar, /class="ev-calendar__count"/);
  assert.ok(weekLabels(calendar).every(label => / · \d+ 场$/.test(label)), 'each day names its count');
});
