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
const { nextOccurrence } = await import('../src/lib/monthly');
const { addCalendarDays } = await import('../src/lib/calendar-days');

const route = JSON.parse(readFileSync('src/data/generated/events-index.json', 'utf8')) as EventsIndex;
const rest = JSON.parse(readFileSync('src/data/generated/events-later.json', 'utf8')) as EventsLater;
const occursIn = (event: IndexEvent, start: string, end: string) => { const day = nextOccurrence(event, start); return !!day && day <= end; };
const render = (today: string, search = '') => renderToStaticMarkup(<StaticRouter location={`/events${search}`}><EventsShell today={today} /></StaticRouter>);

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

test('a view inside the route\'s days renders at once; a later one shows a fixed-height skeleton, then the merged catalog in its order', async () => {
  // a week before the route's last day: its weekend and its next 7 days are all inside
  const today = addCalendarDays(route.near.through, -7);
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
  // boot (route-loaders.ts): the first screens wait for nothing more; a 全部日期 link waits for the rest
  for (const [page, search] of [['events', ''], ['events', '?view=perks'], ['events', '?when=next7'], ['calendar', '']] as const) await later.loadForLocation(page, search, 'zh-Hans', today);
  assert.equal(model.isLaterInstalled(), false, 'the first screens need nothing more');
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
});
