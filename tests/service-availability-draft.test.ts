import assert from 'node:assert/strict';
import test from 'node:test';
import { draftServiceAvailability, serviceToday } from '../src/lib/service-availability-draft';

test('explicit appointment dates verify weekday, calendar validity and current-year semantics', () => {
  assert.deepEqual(draftServiceAvailability('10月17日周六 09:00-12:00', '2026-09-30').slots, [{ date: '2026-10-17', startTime: '09:00', endTime: '12:00' }]);
  assert.equal(draftServiceAvailability('10月17日周日 09:00-12:00', '2026-09-30').error, 'weekday');
  assert.equal(draftServiceAvailability('2026-02-30 09:00-12:00', '2026-01-01').error, 'date');
  assert.equal(draftServiceAvailability('1月17日 09:00-12:00', '2026-09-30').error, 'past');
  assert.equal(draftServiceAvailability('2026-10-17 12:00-09:00', '2026-09-30').error, 'time');
  assert.equal(draftServiceAvailability('2026-10-17 09:60-12:00', '2026-09-30').error, 'time');
});

test('monthly schedules enumerate future dates explicitly including year rollover', () => {
  assert.deepEqual(draftServiceAvailability('本月每周六 9:00-12:00', '2026-10-10').slots.map(slot => slot.date), ['2026-10-10', '2026-10-17', '2026-10-24', '2026-10-31']);
  assert.equal(draftServiceAvailability('下月每星期五 09:00-12:00', '2026-12-31').slots[0].date, '2027-01-01');
  assert.equal(draftServiceAvailability('2026-13每周六 09:00-12:00', '2026-09-30').error, 'date');
  assert.equal(serviceToday(new Date('2026-10-01T02:00:00Z')), '2026-09-30');
});

test('unsupported exceptions and ambiguous input never generate silently incomplete availability', () => {
  for (const input of ['本月每周六，17号除外 09:00-12:00', '10月17日、18日 09:00-12:00', '周六 09:00-12:00', '明天上午有空', '本月每周六 09:00-12:00 但不要发布', '2026-10-17 9-12']) {
    const result = draftServiceAvailability(input, '2026-09-30');
    assert.deepEqual(result.slots, []);
    assert.ok(result.error, input);
  }
});
