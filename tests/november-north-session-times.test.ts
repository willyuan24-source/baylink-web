import test from 'node:test';
import assert from 'node:assert/strict';
import northPlanning from '../src/data/november-refresh-north-planning.json';
import type { PlanningFacts } from '../src/lib/planner';
import { clockMinutes, resolveStopTiming, resolveTimeEvidence } from '../src/lib/planner-hours';

const facts = northPlanning as Record<string, { planning: PlanningFacts }>;

for (const [id, date, start, end] of [
  ['november-north-jack-london-author-2026', '2026-11-15', '14:00', '15:30'],
  ['november-north-sips-stars-2026', '2026-11-13', '17:00', '19:00'],
  ['november-north-sugarloaf-public-star-party-2026', '2026-11-07', '19:00', '22:00'],
]) {
  test(`${id}: late arrival cannot silently move the published session`, () => {
    const evidence = resolveTimeEvidence(facts[id].planning.schedule, date, '2026-10-05');
    assert.equal(evidence.kind, 'sessions');
    assert.deepEqual(evidence.sessions, [{ date, start, end }]);
    const timing = resolveStopTiming(evidence, clockMinutes(start) + 30, 30);
    assert.equal(timing.start, clockMinutes(start));
    assert.ok(timing.conflicts.some(issue => issue.code === 'session-missed'));
  });
}

test('Fairfax storytime uses a fixed start and does not turn the calendar block into a 90-minute arrival window', () => {
  const planning = facts['november-north-fairfax-bilingual-storytime-2026'].planning;
  assert.equal(planning.programTimeUnconfirmed, true);
  assert.equal(planning.schedule?.dates, undefined);
  assert.equal(planning.schedule?.sessions?.length, 6);
  const evidence = resolveTimeEvidence(planning.schedule, '2026-11-03', '2026-10-05');
  assert.deepEqual(evidence.sessions, [{ date: '2026-11-03', start: '10:15' }]);
  const timing = resolveStopTiming(evidence, clockMinutes('11:00'), 30);
  assert.ok(timing.conflicts.some(issue => issue.code === 'session-missed'));
  assert.ok(timing.notices.some(issue => issue.code === 'session-end-unknown'));
});

test('the explicitly drop-in nature talk remains an arrival window', () => {
  const evidence = resolveTimeEvidence(facts['november-north-sugarloaf-nature-talk-2026'].planning.schedule, '2026-11-08', '2026-10-05');
  assert.equal(evidence.kind, 'hours');
  const timing = resolveStopTiming(evidence, clockMinutes('14:00'), 30);
  assert.equal(timing.start, clockMinutes('14:00'));
  assert.deepEqual(timing.conflicts, []);
});
