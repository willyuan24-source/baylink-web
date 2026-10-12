import assert from 'node:assert/strict';
import test from 'node:test';
import { MONTHLY_EVENTS } from '../src/data/monthly-edition';
import { PLANNER_EVENTS } from '../src/data/planner-catalog';
import { buildEventCalendar, sessionTimes, type CalendarEventInput } from '../src/lib/event-ics';

const unfold = (text: string) => text.replace(/\r\n /g, '');
const lines = (text: string) => unfold(text).split('\r\n');
const base = (): CalendarEventInput => ({ ...MONTHLY_EVENTS.find(event => event.id === 'bark-in-the-park-san-jose-2026')!, startDate: '2026-10-17', endDate: '2026-10-17', occurrenceDates: undefined });

test('E2E-13: a confirmed session time exports a timed Pacific event with reminders a day and two hours before', () => {
  const event = { ...base(), sessions: [{ date: '2026-10-17', start: '17:00', end: '18:30' }] };
  const file = lines(buildEventCalendar(event));
  assert.ok(file.includes('DTSTART;TZID=America/Los_Angeles:20261017T170000'));
  assert.ok(file.includes('DTEND;TZID=America/Los_Angeles:20261017T183000'));
  assert.equal(file.some(line => line.startsWith('DTSTART;VALUE=DATE')), false, 'no all-day line beside the timed one');
  assert.deepEqual(file.filter(line => line.startsWith('TRIGGER:')), ['TRIGGER:-P1D', 'TRIGGER:-PT2H']);
  assert.equal(file.filter(line => line === 'BEGIN:VALARM').length, 2);
  // One VTIMEZONE with both US Pacific rules, before the event that refers to it.
  assert.equal(file.filter(line => line === 'BEGIN:VTIMEZONE').length, 1);
  assert.ok(file.indexOf('TZID:America/Los_Angeles') < file.indexOf('BEGIN:VEVENT'));
  assert.ok(file.includes('RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU') && file.includes('RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU'));
});

test('without a confirmed time the file stays an all-day date reminder with one reminder the day before', () => {
  const file = lines(buildEventCalendar(base()));
  assert.ok(file.includes('DTSTART;VALUE=DATE:20261017'));
  assert.ok(file.includes('DTEND;VALUE=DATE:20261018'));
  assert.equal(file.some(line => line.includes('TZID=')), false, 'no invented time');
  assert.equal(file.includes('BEGIN:VTIMEZONE'), false);
  assert.deepEqual(file.filter(line => line.startsWith('TRIGGER:')), ['TRIGGER:-PT15H']);
  // A time the planning marks unconfirmed is not used, nor an end before the start.
  const unconfirmed = { ...base(), planning: { programTimeUnconfirmed: true, schedule: { sourceUrl: 'https://example.org', verifiedAt: '2026-10-01', dates: { '2026-10-17': [{ open: '10:00', close: '12:00' }] } } } };
  assert.equal(lines(buildEventCalendar(unconfirmed)).some(line => line.includes('TZID=')), false);
  assert.deepEqual(sessionTimes({ ...base(), sessions: [{ date: '2026-10-17', start: '18:00', end: '17:00' }] }, '2026-10-17'), { start: '180000' });
  assert.equal(sessionTimes({ ...base(), sessions: [{ date: '2026-10-17', start: '25:00' }] }, '2026-10-17'), undefined);
});

test('the reviewed planning schedule supplies times per day; a multi-day run stays a date range', () => {
  const weekly: CalendarEventInput = { ...base(), startDate: '2026-10-10', endDate: '2026-10-31', occurrenceDates: ['2026-10-17', '2026-10-24'],
    planning: { schedule: { sourceUrl: 'https://example.org', verifiedAt: '2026-10-01', validThrough: '2026-10-20', weekly: { 6: [{ open: '9:00', close: '13:00' }] } } } };
  const file = lines(buildEventCalendar(weekly));
  assert.ok(file.includes('DTSTART;TZID=America/Los_Angeles:20261017T090000'), 'inside the schedule window: timed');
  assert.ok(file.includes('DTSTART;VALUE=DATE:20261024'), 'after validThrough: all-day');
  const run = lines(buildEventCalendar({ ...base(), startDate: '2026-10-10', endDate: '2026-10-12', sessions: [{ date: '2026-10-10', start: '10:00' }] }));
  assert.ok(run.includes('DTSTART;VALUE=DATE:20261010') && run.includes('DTEND;VALUE=DATE:20261013'), 'one entry for a run is a date range');
  // Every catalog event still exports (planner facts included) with lines folded to 75 bytes.
  for (const event of PLANNER_EVENTS) {
    const calendar = buildEventCalendar(event as CalendarEventInput);
    for (const line of calendar.split('\r\n')) assert.ok(Buffer.byteLength(line, 'utf8') <= 75, event.id);
  }
});
