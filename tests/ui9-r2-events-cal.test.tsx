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
const { render, cleanup, act, waitFor } = await import('@testing-library/react');
const { MemoryRouter } = await import('react-router-dom');
const { EventsView } = await import('../src/components/EventsView');
const { default: CalendarPage } = await import('../src/pages/CalendarPage');
const { carryHeight, peekCarriedHeight, dropCarriedHeight } = await import('../src/features/events/view-hold');
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
const pastDay = [1, 2, 3, 4, 5, 6].map(offset => addCalendarDays(today, -offset)).sort((a, b) => onDay(b).length - onDay(a).length)[0];

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

test('a past day has no 加入: its cards keep ♡ on the picture\'s top-right corner (A1), a row\'s on its thumbnail', () => {
  const view = render(<MemoryRouter initialEntries={[`/calendar?date=${pastDay}`]}><CalendarPage today={today} /></MemoryRouter>);
  const items = [...view.container.querySelectorAll('.ev-calendar__rows article')];
  assert.ok(items.length > 1, pastDay);
  assert.equal(view.container.querySelector('.ev-calendar__rows .saves-add-day'), null, 'no 加入 on a past day');
  for (const item of items) {
    assert.equal(item.classList.contains('ev-card--action'), false);
    assert.ok(item.querySelector(':scope > .ui-feed-card__save'), 'the heart is in the save slot');
  }
  // The rules that move the slot under the meta (phone) or to the row's end (768px+) are the 加入 card's only; a past row's
  // heart takes the media area, so it sits on the 112px thumbnail's top-right corner (cards.css's top / right).
  assert.doesNotMatch(css, /\.ev-calendar__cards \.ui-feed-card__save \{/);
  assert.match(css, /\.ev-calendar__cards \.ev-card--action>\.ui-feed-card__save \{ position:static;/);
  assert.match(css, /li:first-child>\.ev-card--action>\.ui-feed-card__save \{ grid-area:add;/);
  assert.match(css, /li\+li>\.ev-card--action>\.ui-feed-card__save \{ grid-area:add;/);
  assert.match(css, /li\+li>\.ui-feed-card:not\(\.ev-card--action\)>\.ui-feed-card__save \{ grid-area:media; \}/);
  // ...and a past day's lead and rows drop the empty add column (no trailing gap).
  assert.match(css, /li:first-child>\.ui-feed-card:not\(\.ev-card--action\) \{ grid-template-columns:minmax\(0, 1fr\); grid-template-areas:"media" "title" "when" "meta" "trust"; \}/);
  assert.match(css, /li\+li>\.ui-feed-card:not\(\.ev-card--action\) \{ grid-template-columns:7rem minmax\(0, 1fr\); grid-template-areas:"media title" "media when" "media meta" "media trust"; \}/);
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
  for (const place of places) if (place.previousSibling) assert.match(place.textContent!, /^\u00a0· /, 'the separator is inside the place piece');
  assert.match(css, /\.ev-page \.ui-feed-card__meta \{ display:flex; flex-wrap:wrap; align-items:baseline; max-height:calc\(var\(--lh-ui\) \* 1em\); \}/);
  assert.match(css, /\.ev-page \.ui-feed-card__meta>\.ui-meta-place \{ flex:1 1 4\.5em; min-width:4\.5em;/);
});

test('an offer card\'s chip and condition are one piece that stays on the line; only the brand steps aside', async () => {
  const view = render(<MemoryRouter initialEntries={['/events?view=perks']}><EventsView today={today} /></MemoryRouter>);
  await waitFor(() => assert.ok(view.container.querySelector('.ui-feed-card__meta .ui-meta-lead')));
  const metas = [...view.container.querySelectorAll('.ui-feed-card__meta')].filter(meta => meta.querySelector('.ui-meta-lead'));
  assert.ok(metas.length > 2);
  for (const meta of metas) {
    const lead = meta.firstElementChild!;
    assert.equal(lead.className, 'ui-meta-lead', 'the condition (with the chip) leads the line');
    assert.ok(lead.textContent!.trim().length > 0);
    assert.equal([...meta.childNodes].filter(node => node.nodeType === 3 && node.textContent!.trim()).length, 0, 'no bare text run');
    const place = meta.querySelector(':scope > .ui-meta-place');
    if (place) assert.match(place.textContent!, /^\u00a0· /, 'the brand piece carries its separator');
  }
  // Placed at most the line's width (max-width), so it never wraps onto the hidden second row with the brand.
  assert.match(css, /\.ev-page \.ui-feed-card__meta>:is\(\.ui-meta-lead,\.ui-meta-price\) \{ flex:0 1 auto; min-width:0; max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; \}/);
});

test('N24: the column\'s body height carries over to the next events route for a moment, and only once', async () => {
  const body = document.createElement('div');
  Object.defineProperty(body, 'offsetHeight', { value: 3100 });
  carryHeight(body);
  assert.equal(peekCarriedHeight(), 3100);
  assert.equal(peekCarriedHeight(), 3100, 'a read changes nothing (render may run twice)');
  dropCarriedHeight();
  assert.equal(peekCarriedHeight(), 0);
  carryHeight(body);
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 1600)); });
  assert.equal(peekCarriedHeight(), 0, 'a later visit starts fresh');
});

test('N24: a frame that mounts right after a click in the column holds that height under its loading board, then drops it', async () => {
  const body = document.createElement('div');
  Object.defineProperty(body, 'offsetHeight', { value: 3100 });
  carryHeight(body);
  // 新店 loads its board on demand (a lazy chunk and its records; no earlier test here opened it), so the frame first paints
  // the Suspense fallback.
  const view = render(<MemoryRouter initialEntries={['/events?view=openings']}><EventsView today={today} /></MemoryRouter>);
  const fallback = view.container.querySelector('.ev-view > div[style]') as HTMLElement | null;
  assert.ok(fallback?.querySelector(':scope > .ui-feed[aria-busy=true]'), 'the loading skeleton');
  assert.equal(fallback!.style.minHeight, '3100px', 'the previous page\'s body height');
  assert.equal(peekCarriedHeight(), 0, 'dropped once the frame has mounted');
  await waitFor(() => assert.ok(view.container.querySelector('.fb-board')));
  assert.equal(view.container.querySelector('.ev-view > div[style]'), null, 'the board replaces the held fallback');
});
