import assert from 'node:assert/strict';
import test from 'node:test';

// Wave 6 day 0 (docs/opus-bay/sf-w6-lead.md §4): the frozen Halloween contracts.

const season = await import('../src/opus-bay/halloween/season');
const rewards = await import('../src/opus-bay/halloween/rewards');
const events = await import('../src/opus-bay/core/events');
const ledger = await import('../src/opus-bay/economy/ledger');

// Bay wall-clock instants (PDT until 1 Nov 2026 09:00 UTC, then PST)
const at = (iso: string) => new Date(iso);

test('W6-0: halloweenPhase follows the Bay date (1–30 Oct season, 31 Oct night, 1–2 Nov muertos, else off)', () => {
  const none = '';
  assert.equal(season.halloweenPhase(at('2026-09-30T12:00:00-07:00'), none), 'off');
  assert.equal(season.halloweenPhase(at('2026-10-01T00:05:00-07:00'), none), 'season');
  assert.equal(season.halloweenPhase(at('2026-10-30T23:59:00-07:00'), none), 'season');
  assert.equal(season.halloweenPhase(at('2026-10-31T00:00:00-07:00'), none), 'night');
  assert.equal(season.halloweenPhase(at('2026-10-31T23:59:00-07:00'), none), 'night');
  assert.equal(season.halloweenPhase(at('2026-11-01T12:00:00-08:00'), none), 'muertos');
  assert.equal(season.halloweenPhase(at('2026-11-02T23:00:00-08:00'), none), 'muertos');
  assert.equal(season.halloweenPhase(at('2026-11-03T00:30:00-08:00'), none), 'off');
  // a UTC instant that is still 30 September in San Francisco
  assert.equal(season.halloweenPhase(at('2026-10-01T05:00:00Z'), none), 'off');
  assert.equal(season.inHalloween(at('2026-10-12T12:00:00-07:00'), none), true);
});

test('W6-0: ?halloween= previews a phase in any build; unknown values are ignored', () => {
  const d = at('2026-09-29T12:00:00-07:00');
  assert.equal(season.halloweenPhase(d, '?halloween=1'), 'season');
  assert.equal(season.halloweenPhase(d, '?world=city&halloween=night'), 'night');
  assert.equal(season.halloweenPhase(d, '?halloween=MUERTOS'), 'muertos');
  assert.equal(season.halloweenPhase(at('2026-10-31T20:00:00-07:00'), '?halloween=off'), 'off');
  assert.equal(season.halloweenPhase(d, '?halloween=banana'), 'off');
  assert.equal(season.halloweenPreview(null), null, 'node: no location, no preview');
});

test('W6-0: isTreatHour is 16:00–22:00 Bay time', () => {
  assert.equal(season.isTreatHour(at('2026-10-31T15:59:00-07:00')), false);
  assert.equal(season.isTreatHour(at('2026-10-31T16:00:00-07:00')), true);
  assert.equal(season.isTreatHour(at('2026-10-31T21:59:00-07:00')), true);
  assert.equal(season.isTreatHour(at('2026-10-31T22:00:00-07:00')), false);
});

test('W6-0: the halloween reward ids are append-only, unique, in the grammar, and paid by the ledger', () => {
  const ids = rewards.HALLOWEEN_REWARD_IDS;
  assert.equal(new Set(ids).size, ids.length, 'unique');
  // the frozen head of the list (bits never move)
  assert.equal(ids[0], 'pumpkin:1');
  assert.equal(ids[39], 'pumpkin:40');
  assert.deepEqual(ids.slice(40, 43), ['hunt:10', 'hunt:20', 'hunt:all']);
  assert.equal(ids[43], 'door:1');
  assert.equal(ids[103], 'night:1');
  assert.equal(ids[163], 'costume:first');
  assert.equal(ids[164], 'muertos:1');
  assert.equal(ids[176], 'spare:1');
  assert.equal(ids.length, 196);
  for (const id of ids) assert.match(rewards.halloweenSource(id), events.REWARD_SOURCE);
  assert.throws(() => rewards.halloweenSource('pumpkin:41'));
  assert.equal(ledger.REWARD_CAPS.halloween, 25);
  assert.equal(ledger.PREFIX_KIND.halloween, 'halloween');
  assert.equal(events.rewardPrefix('halloween:pumpkin:3'), 'halloween');
});

test('W6-0: the halloween feature starts and undoes cleanly (node: no world, no DOM)', async () => {
  const mod = await import('../src/opus-bay/halloween/index');
  const undo = mod.init();
  assert.equal(typeof undo, 'function');
  undo();
});
