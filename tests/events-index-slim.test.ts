import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { PLANNER_EVENTS } from '../src/data/planner-catalog';
import { eventPriceChip, eventTimeLabel, type EventFactsInput } from '../src/lib/event-facts';
import { isFreeToAttend } from '../src/lib/monthly';
import type { EventsIndex } from '../src/features/events/events-index-types';

const index = JSON.parse(readFileSync('src/data/generated/events-index.json', 'utf8')) as EventsIndex;
const full = new Map(PLANNER_EVENTS.map(event => [event.id, event]));
const facts = (event: unknown) => event as EventFactsInput;

// Every event a batch adds costs the list routes bytes (verify-release route budgets), so the index carries only the
// fields a listing reads (scripts/generate-events-index.ts).
test('the events index leaves out the fields no listing reads', () => {
  for (const event of index.events) {
    assert.equal('costLabel' in event, event.cost === 'mixed', `${event.id}: costLabel only where the 免费 filter reads it (mixed cost)`);
    assert.equal('sourceLabel' in event, false, `${event.id}: sourceLabel stays on the detail page`);
    const schedule = event.planning?.schedule as Record<string, unknown> | undefined;
    if (!schedule) continue;
    assert.equal('sourceUrl' in schedule || 'verifiedAt' in schedule, false, `${event.id}: the schedule's source check stays on the detail page`);
    assert.ok(schedule.weekly || schedule.dates || schedule.sessions, `${event.id}: a listed schedule has a time window`);
    if (schedule.sessions && event.sessions?.length) assert.notDeepEqual(schedule.sessions, event.sessions, `${event.id}: sessions are listed once`);
  }
});

test('cards and the 免费 filter read the same hours, price and free entry from the index as from the full record', () => {
  let checked = 0;
  for (const event of index.events) {
    const record = full.get(event.id);
    assert.ok(record, event.id);
    assert.deepEqual(eventPriceChip(facts(event)), eventPriceChip(facts(record)), `${event.id}: price chip`);
    assert.equal(isFreeToAttend(event), isFreeToAttend(record), `${event.id}: 免费 filter`);
    const days = event.occurrenceDates?.length ? event.occurrenceDates : [event.startDate, event.endDate];
    for (const day of days) for (const english of [false, true]) {
      assert.equal(eventTimeLabel(facts(event), day, english), eventTimeLabel(facts(record), day, english), `${event.id} ${day}`);
      checked++;
    }
  }
  assert.ok(checked > 1000, `${checked} labels compared`);
});
