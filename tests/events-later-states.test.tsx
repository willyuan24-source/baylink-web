import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import test, { afterEach } from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';
import type { EventsIndex } from '../src/features/events/events-index-types';

/**
 * WEB-PERF-2 (RC-25), the browser's path when the rest of the events catalog (events-later.json) does not load: the views
 * say it did not load (never "loading" above the retry state), the calendar's month grid says so under the grid, and a
 * retry loads the list. BAYLINK_LAZY_EVENTS=1 makes Node load the rest as the browser does.
 */
process.env.BAYLINK_LAZY_EVENTS = '1';
// The data chunk fails while `laterOffline` is set (an offline reader, a deploy that swapped files).
let laterOffline = true;
registerHooks({
  resolve(specifier, context, next) {
    if (laterOffline && specifier.includes('events-later.json')) throw new TypeError('Failed to fetch dynamically imported module: events-later.json');
    return next(specifier, context);
  },
});
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/events', pretendToBeVisual: true });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, sessionStorage: dom.window.sessionStorage, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, MutationObserver: dom.window.MutationObserver, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
Object.assign(globalThis, { getComputedStyle: dom.window.getComputedStyle.bind(dom.window), requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window), cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window) });
// jsdom has no layout: let the Sheet's focus trap see connected controls.
dom.window.HTMLElement.prototype.getClientRects = function () {
  return (this.isConnected && !this.hidden ? [{ width: 1, height: 1 }] : []) as unknown as DOMRectList;
};
const { render, cleanup, fireEvent, waitFor } = await import('@testing-library/react');
const { MemoryRouter } = await import('react-router-dom');
const { EventsShell } = await import('../src/features/events/EventsShell');
const { default: CalendarPage } = await import('../src/pages/CalendarPage');
const model = await import('../src/features/events/events-model');
const { addCalendarDays } = await import('../src/lib/calendar-days');
afterEach(() => { cleanup(); localStorage.clear(); });

const route = JSON.parse(readFileSync('src/data/generated/events-index.json', 'utf8')) as EventsIndex;
const today = addCalendarDays(route.near.through, -7);
const statusLine = (root: HTMLElement) => root.querySelector('.ev-count')?.textContent;

test('the calendar\'s month grid says when its weeks did not load, and the date stays pickable', async () => {
  const view = render(<MemoryRouter initialEntries={['/calendar']}><CalendarPage today={today} /></MemoryRouter>);
  // the week is the route's own: its rows and counts are there at once
  assert.ok(view.container.querySelector('.ev-calendar__count'));
  fireEvent.click(view.getByRole('button', { name: /选日期/ }));
  const grid = await view.findByRole('group', { name: /\d{4}年\d+月/ }, { timeout: 5000 });
  assert.equal(grid.getAttribute('aria-busy'), 'true', 'the month loads its weeks');
  assert.ok(view.getByText('正在加载这个月的活动…'));
  const note = await view.findByText(/这个月的活动没能加载/, {}, { timeout: 10000 });
  assert.equal(grid.hasAttribute('aria-busy'), false);
  assert.ok(note.closest('[role="status"]'));
  assert.ok(view.getByRole('button', { name: '重试' }));
  // no day of the grid claims a count it does not have
  for (const day of grid.querySelectorAll('button.ev-month__day')) assert.doesNotMatch(day.getAttribute('aria-label') ?? '', /场/);
  assert.equal(model.isLaterInstalled(), false);
});

test('全部日期 that does not load says so above the retry state (no "loading" left), and the retry loads the list', async () => {
  const view = render(<MemoryRouter initialEntries={['/events?when=all']}><EventsShell today={today} /></MemoryRouter>);
  assert.equal(statusLine(view.container), '正在加载这些日期的活动…');
  const alert = await view.findByRole('alert', {}, { timeout: 10000 });
  assert.match(alert.textContent ?? '', /这一栏暂时没能加载/);
  assert.equal(statusLine(view.container), '这些日期的活动没能加载');
  assert.doesNotMatch(view.container.textContent ?? '', /正在加载/);
  // the filter Sheet: its button closes it (no count, no "loading"), its status says the dates did not load
  fireEvent.click(view.getByRole('button', { name: /筛选/ }));
  const sheet = (await view.findByRole('dialog', {}, { timeout: 5000 })).querySelector<HTMLElement>('.ui-sheet')!;
  const done = [...sheet.querySelectorAll<HTMLButtonElement>('.ui-sheet__footer button')].at(-1)!;
  assert.equal(done.textContent, '关闭');
  assert.equal(sheet.querySelector(':scope > [role="status"]')?.textContent, '这些日期的活动没能加载');
  fireEvent.click(done);
  laterOffline = false;
  fireEvent.click(view.getByRole('button', { name: '重试' }));
  await waitFor(() => assert.match(statusLine(view.container) ?? '', /^找到 \d+ 场活动$/), { timeout: 10000 });
  assert.equal(view.queryByRole('alert'), null);
  assert.equal(model.isLaterInstalled(), true);
  assert.match(view.container.querySelector('.ev-lede-facts')?.textContent ?? '', /\d+ 场\s·\s\d+ 场免费/);
});
