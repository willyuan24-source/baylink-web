import assert from 'node:assert/strict';
import test from 'node:test';
import { CALENDAR_CITY_LOCATIONS } from '../src/data/calendar-city-locations';
import { EVENT_DATE_OVERRIDES, EVENT_SCHEDULE_NOTES } from '../src/data/event-calendar-dates';
import { MONTHLY_EVENTS } from '../src/data/monthly-edition';
import { PLANNER_EVENTS } from '../src/data/planner-catalog';
import type { PlannerEvent } from '../src/lib/planner';
import {
  addCalendarDays, calendarCells, calendarPeriod, eventOccursOn,
  eventsOnCalendarDay, groupCalendarMapEvents, shiftCalendarPeriod, validCalendarDay,
} from '../src/lib/event-calendar';

const DAY_MS = 24 * 60 * 60 * 1000;
const fixture = (changes: Partial<PlannerEvent> = {}): PlannerEvent => ({
  ...PLANNER_EVENTS[0], id: 'calendar-test', city: 'Oakland', venue: 'Test venue',
  startDate: '2026-10-01', endDate: '2026-10-12', location: undefined, ...changes,
});

function assertConsecutive(days: string[]) {
  assert.equal(new Set(days).size, days.length, 'calendar cells cannot repeat a day');
  for (let i = 1; i < days.length; i++) {
    assert.equal(Date.parse(`${days[i]}T12:00:00Z`) - Date.parse(`${days[i - 1]}T12:00:00Z`), DAY_MS);
  }
}

test('calendar date validation rejects impossible, ambiguous and out-of-range dates', () => {
  for (const day of ['1900-01-01', '2000-02-29', '2028-02-29', '2026-10-31', '2100-12-31']) {
    assert.equal(validCalendarDay(day), true, day);
  }
  for (const day of ['', '2026-02-29', '1900-02-29', '2100-02-29', '2026-02-30', '2026-04-31',
    '2026-00-10', '2026-13-01', '2026-10-00', '2026-10-32', '2026-1-01', '10/03/2026',
    '2026-10-03T00:00:00Z', '2026-10-03\n', ' 2026-10-03', '1899-12-31', '2101-01-01']) {
    assert.equal(validCalendarDay(day), false, day);
    assert.equal(eventOccursOn(fixture(), day), false, day);
  }
});

test('day arithmetic crosses Pacific DST, months, years and leap days without skipping dates', () => {
  const cases: [string, number, string][] = [
    ['2026-03-07', 1, '2026-03-08'], ['2026-03-08', 1, '2026-03-09'],
    ['2026-10-31', 1, '2026-11-01'], ['2026-11-01', 1, '2026-11-02'],
    ['2026-12-31', 1, '2027-01-01'], ['2027-01-01', -1, '2026-12-31'],
    ['2026-02-28', 1, '2026-03-01'], ['2028-02-28', 1, '2028-02-29'],
    ['2028-02-29', 1, '2028-03-01'], ['2028-03-01', -2, '2028-02-28'],
    ['2026-10-03', 0, '2026-10-03'], ['2026-01-01', 365, '2027-01-01'],
  ];
  for (const [day, amount, expected] of cases) {
    assert.equal(addCalendarDays(day, amount), expected, `${day} + ${amount}`);
    assert.equal(addCalendarDays(expected, -amount), day);
  }
});

test('period navigation clamps a 31st to the target month instead of overflowing it', () => {
  const cases: [string, number, string][] = [
    ['2026-01-31', 1, '2026-02-28'], ['2028-01-31', 1, '2028-02-29'],
    ['2026-03-31', -1, '2026-02-28'], ['2026-05-31', -1, '2026-04-30'],
    ['2026-08-31', 1, '2026-09-30'], ['2026-12-31', 1, '2027-01-31'],
    ['2026-01-31', -1, '2025-12-31'], ['2028-02-29', 12, '2029-02-28'],
    ['2026-10-31', 0, '2026-10-31'],
  ];
  for (const [day, direction, expected] of cases) assert.equal(shiftCalendarPeriod(day, 'month', direction), expected);
  assert.equal(shiftCalendarPeriod('2026-03-07', 'week', 1), '2026-03-14');
  assert.equal(shiftCalendarPeriod('2027-01-03', 'week', -1), '2026-12-27');
});

test('weeks always run Monday through Sunday, including Sunday selections and year boundaries', () => {
  const expected = ['2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27'];
  for (const day of expected) {
    assert.deepEqual(calendarPeriod(day, 'week'), { start: expected[0], end: expected[6], days: expected });
    assert.deepEqual(calendarCells(day, 'week'), expected);
  }
  for (const [day, start, end] of [
    ['2026-12-31', '2026-12-28', '2027-01-03'],
    ['2026-03-08', '2026-03-02', '2026-03-08'],
    ['2026-11-01', '2026-10-26', '2026-11-01'],
  ]) {
    const period = calendarPeriod(day, 'week');
    assert.equal(period.start, start); assert.equal(period.end, end);
    assert.equal(period.days.length, 7); assertConsecutive(period.days);
  }
});

test('month periods include every actual day of leap and non-leap February', () => {
  for (const [day, start, end, length] of [
    ['2026-02-15', '2026-02-01', '2026-02-28', 28],
    ['2028-02-29', '2028-02-01', '2028-02-29', 29],
    ['2026-04-30', '2026-04-01', '2026-04-30', 30],
    ['2026-12-31', '2026-12-01', '2026-12-31', 31],
  ] as const) {
    const period = calendarPeriod(day, 'month');
    assert.equal(period.start, start); assert.equal(period.end, end);
    assert.equal(period.days.length, length); assertConsecutive(period.days);
  }
});

test('month grids use complete Monday–Sunday rows and preserve adjacent-month dates', () => {
  for (const [day, first, last, length] of [
    ['2021-02-10', '2021-02-01', '2021-02-28', 28],
    ['2026-10-15', '2026-09-28', '2026-11-01', 35],
    ['2026-03-01', '2026-02-23', '2026-04-05', 42],
    ['2026-12-31', '2026-11-30', '2027-01-03', 35],
  ] as const) {
    const cells = calendarCells(day, 'month');
    assert.equal(cells.length, length); assert.equal(cells.length % 7, 0);
    assert.equal(cells[0], first); assert.equal(cells.at(-1), last);
    assert.equal(new Date(`${cells[0]}T12:00:00Z`).getUTCDay(), 1);
    assert.equal(new Date(`${cells.at(-1)}T12:00:00Z`).getUTCDay(), 0);
    assert.ok(calendarPeriod(day, 'month').days.every(date => cells.includes(date)));
    assertConsecutive(cells);
  }
});

test('explicit noncontiguous schedules include confirmed dates only and cannot extend catalog bounds', () => {
  const event = fixture();
  const overrides = { [event.id]: ['2026-09-30', '2026-10-02', '2026-10-09', '2026-10-13'] };
  for (const day of ['2026-10-02', '2026-10-09']) assert.equal(eventOccursOn(event, day, overrides), true);
  for (const day of ['2026-09-30', '2026-10-01', '2026-10-03', '2026-10-08', '2026-10-10', '2026-10-12', '2026-10-13']) {
    assert.equal(eventOccursOn(event, day, overrides), false, day);
  }
  assert.equal(eventOccursOn(event, event.startDate, {}), true);
  assert.equal(eventOccursOn(event, event.endDate, {}), true);
});

test('an empty schedule override never falls back to a fabricated continuous date range', () => {
  const event = fixture();
  for (const day of calendarPeriod('2026-10-01', 'month').days) assert.equal(eventOccursOn(event, day, { [event.id]: [] }), false);
  // Only explicitly owned data counts as an override; inherited entries are not schedules.
  const inherited = Object.create({ [event.id]: [] }) as Record<string, string[]>;
  assert.equal(eventOccursOn(event, '2026-10-02', inherited), true);
});

test('all published schedule overrides and notes belong to catalog events and stay within their dates', () => {
  const catalog = new Map(MONTHLY_EVENTS.map(event => [event.id, event]));
  assert.ok(Object.keys(EVENT_DATE_OVERRIDES).length > 0, 'real reviewed schedule exceptions are loaded');
  for (const [id, dates] of Object.entries(EVENT_DATE_OVERRIDES)) {
    const event = catalog.get(id); assert.ok(event, `unknown override id: ${id}`);
    assert.equal(new Set(dates).size, dates.length, `duplicate schedule date: ${id}`);
    assert.deepEqual([...dates].sort(), dates, `unordered schedule: ${id}`);
    for (const day of dates) {
      assert.ok(validCalendarDay(day), `${id}: invalid date ${day}`);
      assert.ok(day >= event.startDate && day <= event.endDate, `${id}: ${day} is outside catalog bounds`);
      assert.ok(eventsOnCalendarDay(PLANNER_EVENTS, day).some(item => item.id === id));
    }
    for (let day = event.startDate; day <= event.endDate; day = addCalendarDays(day, 1)) {
      assert.equal(eventOccursOn(event, day), dates.includes(day), `${id}: unconfirmed day ${day}`);
    }
  }
  for (const [id, note] of Object.entries(EVENT_SCHEDULE_NOTES)) {
    assert.ok(catalog.has(id), `unknown schedule note id: ${id}`);
    assert.ok(note.trim().length > 0, `empty schedule note: ${id}`);
  }
});

test('every published event has sourced map coverage while venue and fallback precision remain distinct', () => {
  assert.ok(PLANNER_EVENTS.length >= 73, 'the complete current catalog is covered');
  assert.deepEqual(PLANNER_EVENTS.map(event => event.id).sort(), MONTHLY_EVENTS.map(event => event.id).sort());
  const mapped = groupCalendarMapEvents(PLANNER_EVENTS);
  assert.deepEqual(mapped.unmapped, []);
  assert.equal(mapped.points.reduce((count, point) => count + point.count, 0), PLANNER_EVENTS.length);
  assert.deepEqual(mapped.points.flatMap(point => point.eventIds).sort(), PLANNER_EVENTS.map(event => event.id).sort());
  for (const point of mapped.points) {
    assert.equal(point.count, point.eventIds.length);
    const memberSources = PLANNER_EVENTS.filter(event => point.eventIds.includes(event.id))
      .map(event => (event.location || CALENDAR_CITY_LOCATIONS[event.city]).sourceUrl);
    assert.ok(memberSources.includes(point.sourceUrl), 'a shared venue keeps one of its actual published sources');
  }
  for (const event of PLANNER_EVENTS) {
    const point = mapped.points.find(item => item.eventIds.includes(event.id)); assert.ok(point, event.id);
    const location = event.location || CALENDAR_CITY_LOCATIONS[event.city]; assert.ok(location, event.city);
    assert.equal(point.lat, location.lat); assert.equal(point.lng, location.lng);
    assert.equal(point.precision, location.precision);
    assert.match(point.sourceUrl, /^https:\/\//);
    assert.ok(point.lat >= 37 && point.lat <= 39 && point.lng >= -124 && point.lng <= -121, event.id);
    if (!event.location) {
      assert.notEqual(point.precision, 'venue', `${event.id}: city fallback cannot claim an entrance`);
      assert.equal(point.title, event.city);
    }
  }
  // Fallback coverage is complete even if no exact event locations are available.
  const fallbacks = groupCalendarMapEvents(PLANNER_EVENTS.map(event => ({ ...event, location: undefined })));
  assert.deepEqual(fallbacks.unmapped, []);
  assert.equal(fallbacks.points.length, new Set(PLANNER_EVENTS.map(event => event.city)).size);
  assert.ok(fallbacks.points.every(point => point.precision === 'city' || point.precision === 'area'));
  assert.equal(CALENDAR_CITY_LOCATIONS['Mill Valley / San Rafael / Larkspur'].precision, 'area');
  assert.equal(CALENDAR_CITY_LOCATIONS['Sonoma County'].precision, 'area');
});

test('same venue activities aggregate counts and IDs without merging an equally positioned city reference', () => {
  const city = CALENDAR_CITY_LOCATIONS.Oakland;
  const location = { ...city, precision: 'venue' as const, label: 'Test venue' };
  const a = fixture({ id: 'same-venue-a', location });
  const b = fixture({ id: 'same-venue-b', location: { ...location } });
  const fallback = fixture({ id: 'city-reference' });
  const before = structuredClone([a, b, fallback]);
  const mapped = groupCalendarMapEvents([a, b, fallback]);
  assert.equal(mapped.points.length, 2); assert.deepEqual(mapped.unmapped, []);
  const venue = mapped.points.find(point => point.precision === 'venue'); assert.ok(venue);
  assert.equal(venue.count, 2); assert.deepEqual(venue.eventIds, [a.id, b.id]); assert.equal(venue.title, a.venue);
  const reference = mapped.points.find(point => point.precision === 'city'); assert.ok(reference);
  assert.equal(reference.count, 1); assert.deepEqual(reference.eventIds, [fallback.id]);
  assert.notEqual(reference.id, venue.id);
  assert.deepEqual([a, b, fallback], before, 'grouping must not mutate catalog events');
  assert.equal(groupCalendarMapEvents([a]).points[0].count, 1, 'groups must not leak across calls');
});

test('unknown and unusable coordinates remain in the list instead of becoming invented map points', () => {
  const missing = fixture({ id: 'unknown-city', city: 'Unverified destination' });
  const invalid = fixture({ id: 'invalid-point', location: { lat: NaN, lng: -122, precision: 'venue', label: 'Invalid', sourceUrl: 'https://example.org' } });
  const outOfRange = fixture({ id: 'out-of-range', location: { lat: 91, lng: 181, precision: 'venue', label: 'Out of range', sourceUrl: 'https://example.org' } });
  const mapped = groupCalendarMapEvents([missing, invalid, outOfRange]);
  assert.deepEqual(mapped.points, []);
  assert.deepEqual(mapped.unmapped.map(event => event.id), [missing.id, invalid.id, outOfRange.id]);
});

test('switching from a busy day to an empty or invalid date leaves no previous events or map groups', () => {
  const busy = eventsOnCalendarDay(PLANNER_EVENTS, '2026-10-03');
  assert.ok(busy.length > 0);
  assert.ok(groupCalendarMapEvents(busy).points.length > 0);
  for (const day of ['2027-01-01', '', '2026-02-30']) {
    const events = eventsOnCalendarDay(PLANNER_EVENTS, day);
    assert.deepEqual(events, []);
    assert.deepEqual(groupCalendarMapEvents(events), { points: [], unmapped: [] });
  }
  const again = eventsOnCalendarDay(PLANNER_EVENTS, '2026-10-03');
  assert.deepEqual(again.map(event => event.id), busy.map(event => event.id));
});
