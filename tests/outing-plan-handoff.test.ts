import assert from 'node:assert/strict';
import test from 'node:test';
import { createOutingPlanHandoff, readOutingPlanHandoff } from '../src/lib/outing-plan-handoff';
import { PLANNER_PLACES } from '../src/data/planner-catalog';
import type { PlanDetails, Stop } from '../src/lib/planner';
const now = Date.parse('2026-10-01T16:00:00Z');
const stop: Stop = { kind: 'place', id: PLANNER_PLACES[0].id };
const input = { ownerId: 'alice', title: '周末一起去', date: '2026-10-17', stops: [stop], details: { startTime: '10:00', finishBy: '20:00', partySize: 3, totalBudgetUsd: 500, extraCostUsd: 30, travelMode: 'transit', stopSettings: [], constraints: { topic: 'private preference' } } as PlanDetails };

test('plan to outing handoff only copies known references and minimal draft fields, never budgets or private constraints', () => {
  const state = createOutingPlanHandoff(input, now)!;
  assert.ok(state); assert.doesNotMatch(JSON.stringify(state), /private preference|500|extraCost|constraints|finishBy/);
  const draft = readOutingPlanHandoff(state, 'alice', now)!;
  assert.equal(draft.date, '2026-10-17'); assert.equal(draft.startTime, '10:00'); assert.equal(draft.endTime, '', 'return deadline is not the estimated outing end');
  assert.equal(draft.capacity, 3); assert.equal(draft.transport, 'transit'); assert.equal(draft.eventId, null);
  assert.match(draft.costNote, /待核实/); assert.doesNotMatch(draft.costNote, /500/);
  assert.equal('adultConsent' in draft, false); assert.equal('publicPlaceConsent' in draft, false);
  assert.equal(draft.cover?.kind, 'guide');
});

test('handoff rejects other accounts, expired drafts, injected fields and unknown or duplicate stops', () => {
  const state = createOutingPlanHandoff(input, now)!;
  for (const [owner, time] of [['bob', now], [undefined, now], ['alice', now + 30 * 60000 + 1], ['alice', now - 1]] as const) assert.equal(readOutingPlanHandoff(state, owner, time), null);
  for (const patch of [{ venue: 'private address' }, { date: '2026-02-30' }, { startTime: '25:00' }, { createdAt: Infinity }, { stops: [{ kind: 'place', id: 'web-result' }] }, { stops: [{ ...stop, image: 'https://evil.example' }] }, { stops: [stop, stop] }]) assert.equal(readOutingPlanHandoff({ ...state, ...patch }, 'alice', now), null);
  assert.equal(createOutingPlanHandoff({ ...input, stops: [{ kind: 'place', id: 'external-unverified' }] }, now), null);
  assert.equal(createOutingPlanHandoff({ ...input, stops: [stop, stop] }, now), null);
});

test('group meeting uses the first visit start after travel and opening waits, not the plan departure time', () => {
  const eventStop: Stop = { kind: 'event', id: 'sf-sunday-streets-excelsior-oct18-2026' };
  const state = createOutingPlanHandoff({ ...input, date: '2026-10-18', stops: [eventStop], details: { ...input.details, startTime: '10:00', finishBy: '18:00' } }, now)!;
  assert.ok(state); assert.equal(state.startTime, '11:00', 'Sunday Streets starts at 11; the plan includes a wait after 10:00 departure');
  assert.equal(readOutingPlanHandoff(state, 'alice', now)!.startTime, '11:00');
  const invalid = createOutingPlanHandoff({ ...input, details: { ...input.details, finishBy: '09:00' } }, now)!;
  assert.equal(invalid.startTime, '', 'invalid schedules require an explicit meeting time');
  const missing = createOutingPlanHandoff({ ...input, details: undefined }, now)!;
  assert.equal(missing.startTime, '');
});
