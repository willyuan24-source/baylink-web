import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { afterEach, test } from 'node:test';
import React from 'react';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'https://www.baylink.us/calendar' });
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, HTMLElement: dom.window.HTMLElement,
  Node: dom.window.Node, MutationObserver: dom.window.MutationObserver, IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
registerHooks({ load: (url, context, nextLoad) => url.endsWith('.css') ? { format: 'module', shortCircuit: true, source: 'export {};' } : nextLoad(url, context) });
const { render, cleanup, act } = await import('@testing-library/react');
const { MemoryRouter } = await import('react-router-dom');
const { EventsView } = await import('../src/components/EventsView');
const { default: CalendarPage } = await import('../src/pages/CalendarPage');
const { carryHeight, takeCarriedHeight } = await import('../src/features/events/view-hold');
const { READING_SIZE_KEY } = await import('../src/lib/reading-preferences');
const model = await import('../src/features/events/events-model');
const { addCalendarDays } = await import('../src/lib/calendar-days');
const { nextOccurrence } = await import('../src/lib/monthly');
void React;

// UI9-R2-EVENTS-CAL (round-2 cold review, lanes/UI9-P4/r2/synthesis-r2.json): the calendar's one card anatomy (R2-10), the
// add control off the pictures, the phone filter row (R2-12), the 接下来 page end (C P20), row hearts off the thumbnail at
// 大 / 特大 (DECISIONS 44), the place piece of a card's meta, and the carried height between /calendar and /events (N24).
afterEach(() => { cleanup(); localStorage.clear(); document.documentElement.removeAttribute('data-reading'); });
const css = readFileSync('src/features/events/events.css', 'utf8');
// The generated data's own day (pretest regenerates the home catalog on the run day), so the catalog always has it.
const today = (JSON.parse(readFileSync('src/data/generated/home-catalog.json', 'utf8')) as { generatedAt: string }).generatedAt;
const onDay = (day: string) => model.INDEX_EVENTS.filter(event => nextOccurrence(event, day) === day);
const busyDay = [0, 1, 2, 3, 4, 5, 6].map(offset => addCalendarDays(today, offset)).sort((a, b) => onDay(b).length - onDay(a).length)[0];

test('the calendar day is one list in one anatomy, every 加入 its card\'s own last part and never on a picture (R2-10)', () => {
  const view = render(<MemoryRouter initialEntries={[`/calendar?date=${busyDay}`]}><CalendarPage today={today} /></MemoryRouter>);
  const items = [...view.container.querySelectorAll('.ev-calendar__rows article')];
  assert.ok(items.length > 2, busyDay);
  assert.deepEqual(new Set(items.map(item => item.className.split(' ')[0])), new Set(['ui-feed-card']), 'one card kind');
  for (const item of items) {
    const add = item.querySelector('.saves-add-day')!;
    assert.ok(add, 'every listed event has its 加入');
    assert.equal(add.closest('.ui-feed-card__media, [data-cover]'), null, 'the control is not inside the picture');
    assert.equal(item.lastElementChild!.contains(add), true, 'the control is the card\'s last part (under the meta)');
  }
  assert.equal(view.container.querySelector('.ev-calendar__cards li:first-child img')!.getAttribute('fetchpriority'), 'high', 'the first card is the lead');
});

test('row hearts: on the thumbnail at the standard size (A1), under it at 大 / 特大 (DECISIONS 44), in RowCard\'s save slot', () => {
  localStorage.setItem(READING_SIZE_KEY, 'extra-large');
  document.documentElement.setAttribute('data-reading', 'extra-large');
  const view = render(<MemoryRouter initialEntries={['/events?when=next7']}><EventsView today={today} /></MemoryRouter>);
  const rows = [...view.container.querySelectorAll('.ev-rows .ui-row-card')];
  assert.ok(rows.length > 0);
  for (const row of rows) {
    assert.ok(row.querySelector(':scope > .ui-row-card__save .saves-control'), 'the heart is in the save slot');
    assert.equal(row.querySelector(':scope > .ui-row-card__trailing'), null, 'no trailing heart');
  }
  assert.match(css, /html:is\(\[data-reading=large\],\[data-reading=extra-large\]\) \.ev-page \.ui-row-card:has\(>\.ui-row-card__save\) \{ grid-template-areas:"thumb body" "save body";/);
});

test('the phone filters are one row with an edge fade; at 大 / 特大 the rail is the date chip, 免费, the region and 筛选 (R2-12)', async () => {
  assert.match(css, /\.ev-page :is\(\.ev-rail,\.ev-cities,\.fb-kinds\) \{ padding-inline-end:var\(--sp-7\); mask-image:linear-gradient\(/);
  assert.match(css, /html:not\(\[data-reading=large\],\[data-reading=extra-large\],\[data-simple\]\) \.ev-page \.ev-regions \{ display:none; \}/);
  localStorage.setItem(READING_SIZE_KEY, 'extra-large');
  document.documentElement.setAttribute('data-reading', 'extra-large');
  const view = render(<MemoryRouter initialEntries={['/events']}><EventsView today={today} /></MemoryRouter>);
  const chip = view.container.querySelector('.ev-date-chip')!;
  assert.ok(chip, 'the date choice as a sheet chip');
  assert.equal(chip.getAttribute('aria-haspopup'), 'dialog');
  assert.match(chip.textContent!, /本周末/);
  assert.ok(view.container.querySelectorAll('.ev-rail__tag').length >= 2, 'the tags stay in the DOM (CSS shows one that is on)');
  assert.match(css, /\.ev-rail__tag:not\(\[aria-pressed=true\]\) \{ display:none; \}/);
});

test('the page end is one 接下来 card of icon rows: save, subscribe, the related lists (C P20)', () => {
  const view = render(<MemoryRouter initialEntries={['/events']}><EventsView today={today} /></MemoryRouter>);
  const end = view.container.querySelector('nav.ev-end')!;
  assert.equal(end.querySelector('h2')!.textContent, '接下来');
  const rows = [...end.querySelectorAll(':scope .ev-end__rows > li')];
  assert.equal(rows.length, 3);
  assert.ok(rows.every(row => row.querySelector('.ev-end__icon svg')), 'each row has its icon');
  assert.deepEqual([...rows[2].querySelectorAll('a.ev-end__item')].map(link => link.textContent), ['免费与优惠', '新店', '半日慢游去处', '出门前读一篇指南']);
  assert.equal(rows[2].getAttribute('data-simple'), 'hide', '简洁显示 keeps the first two rows');
});

test('a card\'s place and its separator are one element that steps aside before it shows under about 4 characters', () => {
  const view = render(<MemoryRouter initialEntries={['/events?when=next7']}><EventsView today={today} /></MemoryRouter>);
  const places = [...view.container.querySelectorAll('.ui-feed-card__meta .ui-meta-place')];
  assert.ok(places.length > 0);
  for (const place of places) if (place.previousSibling) assert.match(place.textContent!, /^ · /, 'the separator is inside the place piece');
  assert.match(css, /\.ev-page \.ui-feed-card__meta \{ display:flex; flex-wrap:wrap; align-items:baseline; max-height:calc\(var\(--lh-ui\) \* 1em\); \}/);
  assert.match(css, /\.ev-page \.ui-feed-card__meta>\.ui-meta-place \{ flex:1 1 4\.5em; min-width:4\.5em;/);
});

test('N24: the column\'s body height carries over to the next events route for a moment, and only once', async () => {
  const body = document.createElement('div');
  Object.defineProperty(body, 'offsetHeight', { value: 3100 });
  carryHeight(body);
  assert.equal(takeCarriedHeight(), 3100);
  assert.equal(takeCarriedHeight(), 0, 'taken once');
  carryHeight(body);
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 1600)); });
  assert.equal(takeCarriedHeight(), 0, 'a later visit starts fresh');
});
