import assert from 'node:assert/strict';
import test from 'node:test';

// Wave 9 · lane S · W9-S5 (review §9 北极星 "加日历（.ics）" is a real action): lane R's 加到日历 (realsf/addCal.ts, W9-R3)
// clicks an anchor outside the game page, which the runner's link listener never sees — its tap now tracks
// `opus_real_action_ics` itself (red before: no metric event on the bus).

const { onEvent } = await import('../src/opus-bay/core/events');
const { addToCalendar, addEventToCalendar } = await import('../src/opus-bay/realsf/addCal');

test('加到日历 (an event day or an offer\'s free day) emits { metric: real / ics } on the tap', () => {
  const seen: unknown[] = [];
  const off = onEvent(e => { if (e.type === 'metric') seen.push(e); });
  const event = { id: 'sfpl-richmond-lego-oct7-2026', title: '乐高时间', region: 'sf', dateLabel: '15:30–16:30', venue: 'Richmond Branch Library', city: 'San Francisco' } as unknown as Parameters<typeof addEventToCalendar>[0];
  addEventToCalendar(event, '2026-10-07');
  addToCalendar({ kind: 'event', event, day: '2026-10-08' });
  off();
  assert.deepEqual(seen, [{ type: 'metric', what: 'real', bucket: 'ics' }, { type: 'metric', what: 'real', bucket: 'ics' }]);
});
