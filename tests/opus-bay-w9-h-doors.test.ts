import assert from 'node:assert/strict';
import test from 'node:test';

/**
 * Wave 9 · lane H · every trick-or-treat door can be knocked by a player who walks up to it in the game (31 Oct 19:30,
 * desktop, dev 5912; the in-game sweeps of docs/opus-bay/sf-w9-H.md part a — scratch C:/Users/willy/opus-qa/w9/h/sweep*.js):
 *   - the joystick walk-up from the street (7 u straight out of the door) reached the 1.3 u prompt at 40 of 44 doors;
 *     door 4 stopped 1.33 u away and door 54 2.18 u away behind a porch corner → their prompt reaches further (`reach`);
 *     doors 10 and 43 are pockets (2.56 / 2.33 u, the player's disc reaches no roadway from 43 and only a 39.5 u walk
 *     round the block from 10) → gone, numbers kept
 *   - a click-to-walk knocked 43 of 44; door 52's walk ended 4.56 u away (past radius + 3) → its prompt reaches 1.8
 */

const { TREAT_DOORS } = await import('../src/opus-bay/halloween/treatDoors');
const { TREAT_STREETS, KNOCK_OUT } = await import('../src/opus-bay/halloween/treatStreets');
const { KNOCK_RADIUS, knockRadius } = await import('../src/opus-bay/halloween/treat');

const knockOf = (d: (typeof TREAT_DOORS)[number]) => ({ x: d.x + Math.sin(d.f) * KNOCK_OUT, z: d.z + Math.cos(d.f) * KNOCK_OUT });

test('W9-H doors: the two pockets are gone (numbers kept), every street keeps ≥ 6 live doors (42 in all)', () => {
  assert.deepEqual(TREAT_DOORS.map(d => d.n), Array.from({ length: 54 }, (_, i) => i + 1), 'the numbers never change');
  for (const n of [10, 43]) assert.ok(TREAT_DOORS.find(d => d.n === n)?.gone, `door ${n} is gone`);
  const live = TREAT_DOORS.filter(d => !d.gone);
  assert.equal(live.length, 42);
  for (const st of TREAT_STREETS) assert.ok(live.filter(d => d.street === st.id).length >= 6, st.id);
});

test('W9-H doors: the prompt reaches further only where the player stops short, and never takes in another door\'s knock spot', () => {
  assert.equal(KNOCK_RADIUS, 1.3);
  const reach = Object.fromEntries(TREAT_DOORS.filter(d => d.reach !== undefined).map(d => [d.n, d.reach]));
  assert.deepEqual(reach, { 4: 1.8, 52: 1.8, 54: 2.6 });
  for (const d of TREAT_DOORS) {
    if (d.gone) { assert.equal(d.reach, undefined, `door ${d.n}: no reach on a gone door`); continue; }
    const r = knockRadius(d);
    assert.ok(r >= KNOCK_RADIUS && r <= 2.6, `door ${d.n}: ${r}`);
    // the measured stop is inside the new reach (4: 1.33, 54: 2.18; 52's click-to-walk 4.56 ≤ reach + 3)
    if (d.n === 4) assert.ok(1.33 < r);
    if (d.n === 54) assert.ok(2.18 < r);
    if (d.n === 52) assert.ok(4.56 < r + 3);
    const k = knockOf(d);
    for (const o of TREAT_DOORS) {
      if (o === d || o.gone) continue;
      const ok = knockOf(o);
      assert.ok(Math.hypot(ok.x - k.x, ok.z - k.z) > r, `door ${d.n}'s prompt takes in door ${o.n}'s knock spot`);
    }
  }
});
