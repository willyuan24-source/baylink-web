import assert from 'node:assert/strict';
import test from 'node:test';
import type { PlanningSchedule } from '../src/lib/planner';
import { resolveStopTiming, resolveTimeEvidence, timeEvidenceLabel } from '../src/lib/planner-hours';

const asOf = '2026-09-29';
const date = '2026-10-03';
const source: PlanningSchedule = { sourceUrl: 'https://example.com/official-hours', verifiedAt: asOf, validFrom: '2026-09-01', validThrough: '2026-10-31', weekly: { 6: [{ open: '10:00', close: '17:00', lastEntry: '16:00' }] } };
const evidence = (patch: Partial<PlanningSchedule> = {}, day = date) => resolveTimeEvidence({ ...source, ...patch }, day, asOf);

test('explicit dates override weekly rules; omitted weekdays are unknown and empty days are closed', () => {
  assert.equal(evidence().status, 'confirmed');
  assert.equal(evidence({}, '2026-10-04').status, 'unknown');
  assert.equal(evidence({ dates: { [date]: [] } }).status, 'closed');
  assert.deepEqual(evidence({ dates: { [date]: [{ open: '12:00', close: '16:00' }] } }).windows, [{ open: '12:00', close: '16:00' }]);
  assert.equal(evidence({ weekly: { 6: [] } }).status, 'closed');
  assert.equal(evidence({ weekly: { 0: [{ open: '10:00', close: '16:00' }] } }, '2026-10-04').status, 'confirmed');
});

test('unknown, stale, out-of-range and malformed rules never claim an open window or force a session', () => {
  assert.equal(resolveTimeEvidence(undefined, date, asOf).status, 'unknown');
  assert.equal(evidence({ verifiedAt: '2026-08-01' }).status, 'stale');
  assert.equal(evidence({ verifiedAt: '2026-08-15' }).status, 'confirmed', 'exactly 45 days remains within the verification window');
  assert.equal(evidence({ verifiedAt: '2026-08-14' }).status, 'stale');
  assert.equal(evidence({ validThrough: '2026-09-30' }).status, 'out-of-range');
  assert.equal(evidence({ sourceUrl: 'javascript:alert(1)' }).status, 'invalid');
  assert.equal(evidence({ verifiedAt: '2026-09-30' }).status, 'invalid');
  assert.equal(evidence({ weekly: { 6: [{ open: '22:00', close: '02:00' }] } }).status, 'invalid');
  assert.equal(evidence({ weekly: { 6: [{ open: '10:00', close: '17:00', lastEntry: '18:00' }] } }).status, 'invalid');
  for (const item of [resolveTimeEvidence(undefined, date, asOf), evidence({ verifiedAt: '2026-08-01' }), evidence({ validThrough: '2026-09-30' })]) {
    const timing = resolveStopTiming(item, 540, 60);
    assert.equal(timing.start, 540);
    assert.equal(timing.conflicts.length, 0);
    assert.ok(timing.notices.length > 0);
  }
});

test('opening waits and split hours choose a window that fits the whole visit without moving user-fixed starts', () => {
  const morning = resolveStopTiming(evidence(), 540, 60);
  assert.equal(morning.start, 600);
  assert.equal(morning.wait, 60);
  assert.equal(morning.conflicts.length, 0);
  const split = evidence({ weekly: { 6: [{ open: '10:00', close: '12:00' }, { open: '14:00', close: '18:00', lastEntry: '17:00' }] } });
  const fullVisit = resolveStopTiming(split, 660, 120);
  assert.equal(fullVisit.start, 840);
  assert.equal(fullVisit.wait, 180);
  assert.equal(fullVisit.conflicts.length, 0);
  const fixed = resolveStopTiming(split, 660, 120, '11:00');
  assert.equal(fixed.start, 660);
  assert.ok(fixed.conflicts.some(issue => issue.code === 'closing-overrun'));
  const before = resolveStopTiming(evidence(), 480, 60, '09:00');
  assert.equal(before.start, 540);
  assert.ok(before.conflicts.some(issue => issue.code === 'before-opening-fixed'));
});

test('closing, last entry and explicit closure are real conflicts, with 24:00 supported only as a closing boundary', () => {
  assert.ok(resolveStopTiming(evidence(), 990, 15).conflicts.some(issue => issue.code === 'last-entry-missed'));
  assert.ok(resolveStopTiming(evidence(), 960, 90).conflicts.some(issue => issue.code === 'closing-overrun'));
  assert.ok(resolveStopTiming(evidence(), 1080, 30).conflicts.some(issue => issue.code === 'after-closing'));
  assert.ok(resolveStopTiming(evidence({ dates: { [date]: [] } }), 600, 30).conflicts.some(issue => issue.code === 'closed-day'));
  const midnight = evidence({ weekly: { 6: [{ open: '00:00', close: '24:00' }] } });
  assert.equal(midnight.status, 'confirmed');
  assert.equal(resolveStopTiming(midnight, 1380, 30).conflicts.length, 0);
});

test('official sessions never shift when late or when a user chooses a conflicting time', () => {
  const session = evidence({ weekly: undefined, sessions: [{ date, start: '11:00', end: '12:00' }] });
  const early = resolveStopTiming(session, 600, 60);
  assert.deepEqual([early.start, early.end, early.wait], [660, 720, 60]);
  const late = resolveStopTiming(session, 750, 60);
  assert.deepEqual([late.start, late.end, late.lateByMinutes], [660, 720, 90]);
  assert.ok(late.conflicts.some(issue => issue.code === 'session-missed'));
  const moved = resolveStopTiming(session, 600, 60, '12:00');
  assert.equal(moved.start, 660);
  assert.ok(moved.conflicts.some(issue => issue.code === 'session-mismatch'));
  assert.ok(resolveStopTiming(session, 600, 90).conflicts.some(issue => issue.code === 'session-overrun'));
  const unknownEnd = resolveStopTiming(evidence({ weekly: undefined, sessions: [{ date, start: '11:00' }] }), 600, 90);
  assert.equal(unknownEnd.conflicts.length, 0);
  assert.ok(unknownEnd.notices.some(item => item.code === 'session-end-unknown'));
  assert.match(timeEvidenceLabel(session, true), /Official sessions.*11:00–12:00/);
});

test('multiple sessions require an explicit valid selection, and arriving after the last session is a conflict', () => {
  const sessions = evidence({ weekly: undefined, sessions: [{ date, start: '11:00', end: '12:00' }, { date, start: '14:00', end: '15:00' }] });
  assert.ok(resolveStopTiming(sessions, 600, 60).conflicts.some(item => item.code === 'session-unselected'));
  assert.ok(resolveStopTiming(sessions, 900, 60).conflicts.some(item => item.code === 'all-sessions-missed'));
  assert.ok(resolveStopTiming(sessions, 600, 60, '13:00').conflicts.some(item => item.code === 'session-mismatch'));
  const selected = resolveStopTiming(sessions, 600, 60, '14:00');
  assert.equal(selected.start, 840);
  assert.equal(selected.conflicts.length, 0);
});

test('last order is distinct from last entry, validated and considered before waiting for a later full window', () => {
  const lunch = evidence({ weekly: { 6: [{ open: '11:00', close: '16:00', lastOrder: '15:15' }] } });
  assert.match(timeEvidenceLabel(lunch, true), /last order 15:15/);
  assert.doesNotMatch(timeEvidenceLabel(lunch, true), /last entry/);
  assert.ok(resolveStopTiming(lunch, 930, 30).conflicts.some(item => item.code === 'last-order-missed'));
  assert.equal(resolveStopTiming(lunch, 915, 30).conflicts.length, 0);
  const dinner = evidence({ weekly: { 6: [...lunch.windows, { open: '17:00', close: '21:00', lastOrder: '20:00' }] } });
  assert.equal(resolveStopTiming(dinner, 930, 30).start, 1020);
  assert.ok(resolveStopTiming(dinner, 930, 30, '15:30').conflicts.some(item => item.code === 'last-order-missed'));
  for (const lastOrder of ['9:00', '10:59', '16:01', '24:00']) {
    assert.equal(evidence({ weekly: { 6: [{ open: '11:00', close: '16:00', lastOrder }] } }).status, 'invalid');
  }
});
