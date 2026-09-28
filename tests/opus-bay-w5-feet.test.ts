import assert from 'node:assert/strict';
import test from 'node:test';

/**
 * Wave 5 · lane F's feet (plan sf-w5-plan.md §2 MF2, §4.4): arrivals face open ground (W5-F7, actors/faceOpen.ts);
 * the forgiving-feet guards (W5-F5) join this file.
 */

const { runtime } = await import('../src/opus-bay/core/runtime');
const { canStand } = await import('../src/opus-bay/core/terrain');
const { DISTRICT } = await import('../src/opus-bay/data/district');
const { FACE_OPEN, faceOpen, openHeading, openRuns } = await import('../src/opus-bay/actors/faceOpen');
const { takeFaceRequest } = await import('../src/opus-bay/game/cinema');

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

test('faceOpen: the heading faces the longest run of standable ground (a wide opening over a narrow gap), never the water or a wall', () => {
  let checked = 0;
  for (const [name, p] of Object.entries(DISTRICT.anchors)) {
    if (!canStand(p.x, p.z, 0.45)) continue;
    const runs = openRuns(p.x, p.z);
    assert.equal(runs.length, FACE_OPEN.dirs);
    const { heading, run } = openHeading(p.x, p.z);
    const max = Math.max(...runs);
    if (max === 0) continue;
    // the chosen ray is open for at least half of the longest one (a wide opening may beat a slightly longer slit)
    assert.ok(run >= max * 0.5, `${name}: run ${run} vs longest ${max}`);
    // and it really is walkable a few metres ahead
    for (const d of [1.4, 2.8].filter(d => d <= run)) assert.ok(canStand(p.x + Math.sin(heading) * d, p.z + Math.cos(heading) * d, FACE_OPEN.radius), `${name}: ${d} u ahead`);
    checked++;
  }
  assert.ok(checked > 20, `${checked} district anchors checked`);
});

test('faceOpen: at a pier end (water on three sides) the player turns back along the pier; ties go to the current heading', () => {
  const end = DISTRICT.anchors['pier7-end'];
  assert.ok(end && canStand(end.x, end.z, 0.45));
  const { heading, run } = openHeading(end.x, end.z);
  assert.ok(run >= 8, `back along the pier (${run} u)`);
  // the pier's axis: back toward its entrance on the Embarcadero
  const entrance = DISTRICT.anchors['pier7-entrance'];
  const toShore = Math.atan2(entrance.x - end.x, entrance.z - end.z);
  assert.ok(Math.abs(wrap(heading - toShore)) < 0.4, `faces back along the pier (${heading.toFixed(2)} vs ${toShore.toFixed(2)})`);
  // nowhere to go (unstandable everywhere): the preferred heading stays
  assert.deepEqual(openHeading(1e5, 1e5, 1.25), { heading: 1.25, run: 0 });
});

test('faceOpen: turns the player standing there and asks the camera to swing behind them (an `open` request that outranks the arrival yaw)', () => {
  const p = runtime.player, a = DISTRICT.anchors['pier7-end'];
  p.x = a.x; p.z = a.z; p.heading = 0;
  takeFaceRequest();
  const h = faceOpen(a.x, a.z);
  assert.equal(p.heading, h);
  const req = takeFaceRequest();
  assert.ok(req && req.open && req.uncapped, 'an open, uncapped camera turn');
  assert.ok(Math.abs(wrap(Math.atan2(req.x - a.x, req.z - a.z) - h)) < 1e-6, 'toward the open side');
  // a player elsewhere is not turned (the caller places them first)
  p.x = a.x + 50; p.heading = 0.3;
  faceOpen(a.x, a.z);
  assert.equal(p.heading, 0.3);
  takeFaceRequest();
});
