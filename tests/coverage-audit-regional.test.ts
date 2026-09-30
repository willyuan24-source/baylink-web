import assert from 'node:assert/strict';
import test from 'node:test';
import records from '../src/data/coverage-audit-regional-events.json';
import english from '../src/data/coverage-audit-regional-en.json';
import { COVERAGE_AUDIT_REGIONAL_PLANNING as facts, COVERAGE_AUDIT_REGIONAL_SCHEDULES as schedules } from '../src/data/coverage-audit-regional-planning';
import { GUIDE_IMAGES } from '../src/data/guide-media';
import type { MonthlyEvent } from '../src/data/monthly-types';
import { filterMonthlyEvents } from '../src/lib/monthly';
import { resolveStopTiming, resolveTimeEvidence } from '../src/lib/planner-hours';

const events = records as MonthlyEvent[];
const asOf = '2026-09-29';
const evidence = (id: string, date: string) => resolveTimeEvidence(schedules[id], date, asOf);

test('four verified additions retain exact occurrences, source-backed times, and illustrative media', () => {
  assert.equal(events.length, 4);
  assert.equal(new Set(events.map(row => row.id)).size, 4);
  assert.deepEqual(Object.keys(facts).sort(), events.map(row => row.id).sort());
  assert.deepEqual(Object.keys(schedules).sort(), events.map(row => row.id).sort());
  for (const row of events) {
    assert.equal(row.verifiedAt, asOf);
    assert.deepEqual(row.occurrenceDates, [row.startDate]);
    assert.equal(row.endDate, row.startDate);
    const schedule = schedules[row.id];
    assert.equal(schedule.sourceUrl, row.officialUrl);
    assert.equal(schedule.verifiedAt, asOf);
    assert.equal(schedule.weekly, undefined);
    assert.equal(evidence(row.id, row.startDate).status, 'confirmed');
    assert.equal(evidence(row.id, '2026-11-01').status, 'out-of-range');
    const days = [...new Set([...Object.keys(schedule.dates ?? {}), ...(schedule.sessions ?? []).map(session => session.date)])];
    assert.deepEqual(days, row.occurrenceDates);
    assert.equal(GUIDE_IMAGES[row.imageKey]?.kind, 'illustration', row.id);
    assert.equal('location' in row, false, 'No invented venue coordinates');
  }
});

test('FOG free registration never becomes free admission or a fixed early-bird admission price', () => {
  const fog = events.find(row => row.id === 'fremont-fog-diwali-mela-2026')!;
  assert.equal(fog.cost, 'paid');
  assert.equal(facts[fog.id].admissionUsd, null);
  assert.match(fog.costLabel, /\$4 \+ \$0\.22.*\$5/);
  assert.match(fog.plan.join(' '), /免费登记.*不能把免费登记当免费入场/);
  const free = filterMonthlyEvents(events, { cost: 'free' }, asOf).map(row => row.id);
  assert.ok(!free.includes(fog.id));
  assert.equal(free.length, 3);
  for (const id of free) assert.equal(facts[id].admissionUsd, 0);
});

test('Djerassi is only the booked two-hour free visit, not an open estate or all fall dates', () => {
  const id = 'woodside-djerassi-free-art-hike-oct5-2026';
  const row = events.find(event => event.id === id)!;
  assert.equal(row.city, 'Woodside');
  assert.match(row.venue, /2325 Bear Gulch Road/);
  assert.equal(facts[id].reservation, 'required');
  assert.deepEqual(evidence(id, '2026-10-05').sessions, [{ date: '2026-10-05', start: '10:00', end: '12:00' }]);
  assert.equal(evidence(id, '2026-10-04').status, 'out-of-range');
  const late = resolveStopTiming(evidence(id, '2026-10-05'), 605, 120);
  assert.equal(late.start, 600);
  assert.ok(late.conflicts.some(issue => issue.code === 'session-missed'));
  assert.ok(resolveStopTiming(evidence(id, '2026-10-05'), 600, 180).conflicts.some(issue => issue.code === 'session-overrun'));
  assert.match(schedules[id].note!, /3小时、3.5英里不自动适用/);
  assert.match(schedules[id].note!, /剩余名额.*未确认/);
});

test('the concert keeps doors, music start, and unconfirmed performance end distinct', () => {
  const id = 'san-jose-hellflowers-free-concert-oct2-2026';
  const ev = evidence(id, '2026-10-02');
  assert.deepEqual(ev.windows, [{ open: '18:00', close: '22:00' }]);
  assert.deepEqual(ev.sessions, [{ date: '2026-10-02', start: '18:30' }]);
  const arrival = resolveStopTiming(ev, 18 * 60, 90);
  assert.equal(arrival.start, 18 * 60 + 30);
  assert.equal(ev.sessions[0].end, undefined, 'The event closing time is not a published set end');
  assert.match(ev.note!, /演出结束时间未公布/);
});

test('all Chinese editorial strings and schedule notes have complete English translations', () => {
  const dictionary = english as Record<string, string>;
  const strings = (value: unknown): string[] => typeof value === 'string' ? [value]
    : Array.isArray(value) ? value.flatMap(strings)
    : value && typeof value === 'object' ? Object.values(value).flatMap(strings) : [];
  const chinese = strings([events, Object.values(schedules).map(schedule => schedule.note)]).filter(text => /[\u3400-\u9fff]/.test(text));
  assert.ok(chinese.length > 30);
  for (const text of chinese) {
    assert.ok(dictionary[text]?.trim(), text);
    assert.ok(!/[\u3400-\u9fff]/.test(dictionary[text]), text);
  }
});
