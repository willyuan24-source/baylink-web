import assert from 'node:assert/strict';
import test from 'node:test';
import { MONTHLY_EVENTS } from '../src/data/monthly-edition';
import type { MonthlyEvent } from '../src/data/monthly-types';
import { buildContentCoverage, contentCoverageMarkdown } from '../src/lib/content-coverage';
import { addCalendarDays, eventOccursOn } from '../src/lib/event-calendar';

const event = (id: string, changes: Partial<MonthlyEvent> = {}): MonthlyEvent => ({ ...MONTHLY_EVENTS[0], id, startDate: '2026-10-31', endDate: '2026-11-27', region: 'sf', category: 'culture', kind: 'event', occurrenceDates: undefined, ...changes });

test('coverage distinguishes recurring events, event-days and calendar days across DST', () => {
  const report = buildContentCoverage([
    event('range'), event('recurring', { occurrenceDates: ['2026-10-31', '2026-10-31', '2026-11-07'] }),
  ], '2026-10-31', 4, {});
  assert.deepEqual(report.window.total, { uniqueEvents: 2, eventDays: 30, calendarDays: 28, explicitEventDays: 2, rangeEventDays: 28 });
  assert.deepEqual(report.weeks.map(week => week.total.uniqueEvents), [2, 2, 1, 1]);
  assert.equal(report.weeks.reduce((sum, week) => sum + week.total.eventDays, 0), 30);
  assert.equal(report.endDate, '2026-11-27');
  assert.equal(report.entries[0].dates.length, 28);
});

test('calendar overrides win, including explicit empty dates; categories match monthly filters', () => {
  const report = buildContentCoverage([
    event('empty', { occurrenceDates: ['2026-10-31'] }),
    event('override', { kind: 'sports', occurrenceDates: ['2026-11-01'] }),
    event('performance', { kind: 'performance', occurrenceDates: ['2026-11-01'] }),
  ], '2026-10-31', 4, { empty: [], override: ['2026-11-02', '2026-11-02'] });
  assert.equal(report.window.total.uniqueEvents, 2);
  assert.equal(report.window.categories.culture.uniqueEvents, 0);
  assert.equal(report.window.categories.sports.eventDays, 1);
  assert.deepEqual(report.entries.find(entry => entry.id === 'override')!.dates, ['2026-11-02']);
  assert.equal(report.entries.some(entry => entry.id === 'empty'), false);
});

test('invalid and ambiguous data is visible without inflating coverage', () => {
  const report = buildContentCoverage([
    event('duplicate'), event('duplicate', { region: 'east-bay' }),
    event('invalid-range', { startDate: '2026-02-30' }),
    event('invalid-dates', { occurrenceDates: ['2026-11-01', '2026-11-31', '2027-01-01'] }),
  ], '2026-10-31', 4, {});
  assert.equal(report.diagnostics.length, 3);
  assert.equal(report.window.total.eventDays, 1);
  assert.equal(report.catalogRecords, 4);
  assert.equal(report.catalogUniqueIds, 3);
});

test('empty future windows are advisory and preserve every region/category/week cell', () => {
  const report = buildContentCoverage([], '2026-12-01', 8, {});
  assert.equal(report.warnings.emptyCellCount, 8 * 5 * 6);
  assert.equal(report.window.total.uniqueEvents, 0);
  assert.match(report.policy, /advisory-only/);
  assert.match(contentCoverageMarkdown(report), /not release failures or adopted coverage targets/);
  for (const weeks of [0, 3, 9, 4.5]) assert.throws(() => buildContentCoverage([], '2026-12-01', weeks));
  assert.throws(() => buildContentCoverage([], '2026-02-30', 4));
});

test('real catalog totals match the public calendar and every event-day is auditable', () => {
  const report = buildContentCoverage(MONTHLY_EVENTS, '2026-10-07', 8);
  assert.equal(report.diagnostics.length, 0);
  const expected = MONTHLY_EVENTS.flatMap(item => Array.from({ length: 56 }, (_, day) => addCalendarDays(report.startDate, day)).filter(day => eventOccursOn(item, day)).map(day => `${item.id}:${day}`)).sort();
  const actual = report.entries.flatMap(item => item.dates.map(day => `${item.id}:${day}`)).sort();
  assert.deepEqual(actual, expected);
  assert.equal(report.window.total.eventDays, expected.length);
  for (const week of report.weeks) {
    assert.equal(Object.values(week.regions).reduce((sum, count) => sum + count.eventDays, 0), week.total.eventDays);
    assert.equal(Object.values(week.categories).reduce((sum, count) => sum + count.eventDays, 0), week.total.eventDays);
  }
});
