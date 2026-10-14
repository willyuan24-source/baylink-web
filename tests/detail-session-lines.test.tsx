import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import { MONTHLY_EVENTS } from '../src/data/monthly-edition';
import { EventFacts } from '../src/features/detail/FactsGrid';
import { MAX_SESSION_LINES, sessionLines } from '../src/features/detail/session-lines';
import type { MonthlyEvent } from '../src/data/monthly-types';

/**
 * H58 (EVT13-12): the facts card's 何时 cell collapses sessions that share a time into one line, shows at most two lines
 * and then 另有 N 场, so the card ends above the phone's fixed action bar. Every date is a session date and every time
 * the record's own; nothing is invented.
 */
const sessions = (rows: [string, string?, string?][]) => ({ sessions: rows.map(([date, start, end]) => ({ date, ...(start ? { start } : {}), ...(end ? { end } : {}) })) });
const saturdays = ['2026-10-17', '2026-10-24', '2026-10-31', '2026-11-07', '2026-11-14', '2026-11-21', '2026-11-28'];

test('sessions with one time collapse into one line: one weekday, a weekly series, or a run of days', () => {
  assert.deepEqual(sessionLines(sessions(saturdays.slice(0, 3).map(day => [day, '08:30', '12:00'])), '2026-10-13', false),
    { lines: ['周六 10/17、10/24、10/31 · 08:30–12:00'], more: 0 }, 'the brief\'s example');
  assert.deepEqual(sessionLines(sessions(saturdays.map(day => [day, '08:30', '12:00'])), '2026-10-13', false),
    { lines: ['每周六 10/17–11/28 · 08:30–12:00'], more: 0 }, 'strictly weekly: the whole series in one line');
  assert.deepEqual(sessionLines(sessions(saturdays.map(day => [day, '08:30', '12:00'])), '2026-10-13', true),
    { lines: ['Every Sat 10/17–11/28 · 8:30am–12pm'], more: 0 });
  // The Fall Show: three days at one time, the Sunday at another.
  const fall = sessions([['2026-10-15', '10:30', '19:00'], ['2026-10-16', '10:30', '19:00'], ['2026-10-17', '10:30', '19:00'], ['2026-10-18', '11:00', '17:00']]);
  assert.deepEqual(sessionLines(fall, '2026-10-13', false), { lines: ['周四至周六 10/15–17 · 10:30–19:00', '周日 10/18 · 11–17 点'], more: 0 });
  assert.deepEqual(sessionLines(fall, '2026-10-13', true).lines, ['Thu–Sat 10/15–17 · 10:30am–7pm', 'Sun 10/18 · 11am–5pm']);
  // A run across a month end.
  assert.deepEqual(sessionLines(sessions([['2026-10-30', '18:30', '22:00'], ['2026-10-31', '18:30', '22:00'], ['2026-11-01', '18:30', '22:00']]), '2026-10-13', false).lines, ['周五至周日 10/30–11/1 · 18:30–22:00']);
});

test('mixed dates list up to three items and count the rest of the line; times beyond two lines become 另有 N 场', () => {
  // The opera: 19:30 on five days, 14:00 on one.
  const opera = sessions([['2026-10-15', '19:30'], ['2026-10-18', '14:00'], ['2026-10-21', '19:30'], ['2026-10-24', '19:30'], ['2026-10-27', '19:30'], ['2026-10-30', '19:30']]);
  assert.deepEqual(sessionLines(opera, '2026-10-13', false), { lines: ['10/15、10/21、10/24 等 5 场 · 19:30 起', '周日 10/18 · 14 点起'], more: 0 });
  assert.deepEqual(sessionLines(opera, '2026-10-13', true).lines, ['10/15, 10/21, 10/24 + 2 more · From 7:30pm', 'Sun 10/18 · From 2pm']);
  // Weekend runs at one time: runs keep their own spans, no weekday for a mixed list.
  const goblin = sessions(['2026-10-17', '2026-10-18', '2026-10-24', '2026-10-25', '2026-10-31'].map(day => [day, '09:00']));
  assert.deepEqual(sessionLines(goblin, '2026-10-13', false).lines, ['10/17–18、10/24–25、10/31 · 9 点起']);
  // Three times: two lines, then the third time's days are counted.
  const three = sessions([['2026-10-17', '10:00'], ['2026-10-18', '12:00'], ['2026-10-24', '15:00'], ['2026-10-25', '15:00']]);
  const result = sessionLines(three, '2026-10-13', false);
  assert.equal(result.lines.length, MAX_SESSION_LINES);
  assert.deepEqual(result, { lines: ['周六 10/17 · 10 点起', '周日 10/18 · 12 点起'], more: 2 });
});

test('past days drop out (all of them stay when none is left); a day without a time is a date alone', () => {
  const past = sessions([['2026-10-03', '09:00'], ['2026-10-10', '09:00'], ['2026-10-17', '09:00']]);
  assert.deepEqual(sessionLines(past, '2026-10-13', false).lines, ['周六 10/17 · 9 点起']);
  assert.deepEqual(sessionLines(past, '2026-11-01', false).lines, ['周六 10/3、10/10、10/17 · 9 点起'], 'an ended event keeps its dates');
  assert.deepEqual(sessionLines(sessions([['2026-10-17'], ['2026-10-18']]), '2026-10-13', false).lines, ['周六至周日 10/17–18']);
  assert.deepEqual(sessionLines({}, '2026-10-13', false), { lines: [], more: 0 });
});

test('the facts card renders the merged lines and 另有 N 场 for an event with sessions', () => {
  const base = MONTHLY_EVENTS.find(event => event.id === 'bark-in-the-park-san-jose-2026')!;
  const event = { ...base, ...sessions([['2026-10-17', '10:00'], ['2026-10-18', '12:00'], ['2026-10-24', '15:00'], ['2026-10-25', '15:00']]) } as MonthlyEvent;
  const doc = new JSDOM(renderToStaticMarkup(<EventFacts event={event} today="2026-10-13" />)).window.document;
  const lines = [...doc.querySelectorAll('[data-fact="when"] dd > .detail-fact__line')].map(line => line.textContent);
  assert.deepEqual(lines, ['周六 10/17 · 10 点起', '周日 10/18 · 12 点起', '另有 2 场']);
});
