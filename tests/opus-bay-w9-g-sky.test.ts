import assert from 'node:assert/strict';
import test from 'node:test';

/**
 * Wave 9 · lane G · W9-G6 那是什么？ (play/skyline.ts; review 2026-10-01 R§6 玩法与收集, gamer notes 08:31: "Q3 answer
 * Alcatraz but camera showed Embarcadero street + buildings, Alcatraz NOT visible"; verify-gamer gamer-2: one landmark in
 * sight, all right was only ●):
 *   - a landmark is asked only when it shows at least SKY_MIN_ANGLE of its height from the round's camera (Alcatraz from the
 *     Ferry Building plaza, 580 u off and 14 u high: 0.020 rad → not asked; from Pier 39 0.037, Aquatic Park 0.057 → asked);
 *   - and only when the round's camera (3.8 u behind, 0.9 u aside, 1.1 u up) has a clear line too, not just the eye;
 *   - the medal by the share named right.
 */

const g = globalThis as unknown as Record<string, unknown>;
g.window ??= globalThis;

const S = await import('../src/opus-bay/play/skyline');
const { SKYLINE_SPOTS } = await import('../src/opus-bay/play/skylineLines');

const ground = () => 2;
const eyeAt = (x: number, z: number) => ({ x, y: 2 + 1.6, z });
const spot = (id: string) => SKYLINE_SPOTS.find(s => s.id === id)!;

test('W9-G6 a landmark too low and far to make out is not asked (Alcatraz from the Ferry Building plaza); from Pier 39 / Aquatic Park it is', () => {
  const al = spot('alcatraz');
  const ids = (x: number, z: number) => S.spotsInSight(eyeAt(x, z), ground).map(s => s.id);
  const ang = (x: number, z: number) => S.visibleAngle(S.shotFrom(eyeAt(x, z), 3.6, al), al, ground);
  // the Ferry Building plaza and Pier 14 (the review's waterfront): a sliver of an island over the water
  for (const [x, z] of [[110, -10], [150, 30]]) {
    assert.ok(S.inSight(eyeAt(x, z), al, ground), 'nothing stands in the way (the old check asked it)');
    assert.ok(ang(x, z) < S.SKY_MIN_ANGLE, `(${x}, ${z}): ${ang(x, z).toFixed(3)} rad`);
    assert.ok(!ids(x, z).includes('alcatraz'), `(${x}, ${z}): not asked`);
    assert.ok(ids(x, z).includes('bay-bridge'), 'the Bay Bridge next door still is');
  }
  // Pier 39's gate plaza and Aquatic Park: the island shows
  for (const [x, z] of [[-160.66, 24.1], [-300, 60]]) {
    assert.ok(ang(x, z) >= S.SKY_MIN_ANGLE, `(${x}, ${z}): ${ang(x, z).toFixed(3)} rad`);
    assert.ok(ids(x, z).includes('alcatraz'), `(${x}, ${z}): asked`);
  }
  // a bridge (a long, low span) reads at half a tower's height (from a hill the Bay Bridge is a low line, but a long one)
  assert.equal(S.minAngleOf(spot('bay-bridge')), S.SKY_MIN_ANGLE / 2);
  assert.equal(S.minAngleOf(spot('golden-gate-bridge')), S.SKY_MIN_ANGLE / 2);
  assert.equal(SKYLINE_SPOTS.filter(s => s.long).length, 2, 'only the two bridges');
  // a wall in front hides most of a tower: what is left over the wall counts
  const coit = spot('coit-tower'), from = eyeAt(coit.x + 150, coit.z);
  const wall = (h: number) => (x: number, z: number) => (Math.abs(x - (coit.x + 60)) < 3 && Math.abs(z - coit.z) < 20 ? h : 2);
  assert.ok(S.visibleAngle(from, coit, wall(10)) > S.visibleAngle(from, coit, wall(25)));
  assert.ok(S.visibleAngle(from, coit, wall(34)) < S.SKY_MIN_ANGLE, 'only the very top over the wall: not asked');
});

test('W9-G6 the round\'s camera must see it too: a shed right behind you hides the landmark from the shot', () => {
  const coit = spot('coit-tower'), p = eyeAt(coit.x + 200, coit.z);
  assert.deepEqual(S.spotsInSight(p, ground, [coit]).map(s => s.id), ['coit-tower'], 'open ground: asked');
  const cam = S.shotFrom(p, p.y, coit);
  assert.ok(Math.hypot(cam.x - p.x, cam.z - p.z) > 3.5 && cam.y > p.y, 'behind and above the eye');
  // a 12 u shed round the camera's spot only (the eye, 3.9 u ahead, stands clear of it)
  const shed = (x: number, z: number) => (Math.hypot(x - cam.x, z - cam.z) < 3.2 ? 14 : 2);
  assert.ok(S.inSight(p, coit, shed), 'the eye sees it');
  assert.deepEqual(S.spotsInSight(p, shed, [coit]).map(s => s.id), [], 'the camera does not: not asked');
});

test('W9-G6 the medal by the share named right: ★ all right of two or more, ◆ two of three or one of one, ● otherwise', () => {
  const table: [number, number, number][] = [
    [0, 3, 0], [1, 3, 1], [2, 3, 2], [3, 3, 3],
    [0, 2, 0], [1, 2, 1], [2, 2, 3],
    [0, 1, 0], [1, 1, 2],
  ];
  for (const [right, asked, tier] of table) assert.equal(S.skylineTier(right, asked), tier, `${right} / ${asked}`);
});
