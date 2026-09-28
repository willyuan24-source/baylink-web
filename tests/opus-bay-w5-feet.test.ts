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

test('faceOpen at a glide landing (W5-F7): the pelican sets the player down facing the open ground, and the camera is asked to swing behind them', async () => {
  const THREE = await import('three');
  const { game } = await import('../src/opus-bay/core/store');
  const { input } = await import('../src/opus-bay/core/input');
  const { heightAt } = await import('../src/opus-bay/core/terrain');
  const { PlayerController } = await import('../src/opus-bay/actors/controller');
  const { MoveSystem } = await import('../src/opus-bay/actors/moveSystem');
  const moveApi = await import('../src/opus-bay/actors/moveApi');
  const g = globalThis as unknown as Record<string, unknown>;
  g.window ??= globalThis;
  game.set({ phase: 'playing', worldMode: 'district', move: { mode: 'foot' }, riding: null, dialogue: { nodeId: null }, panel: { kind: null } });
  const ms = new MoveSystem(), c = new PlayerController();
  moveApi.bindMoveApi(ms);
  try {
    const gate = DISTRICT.anchors['ferry-gate'], p = runtime.player;
    p.x = gate.x; p.z = gate.z; p.y = heightAt(gate.x, gate.z); p.heading = 0; p.locked = false;
    c.sync();
    ms.setGlideUnlocked(true);
    // fly inland (west, over the Embarcadero) for 2.5 s, then land
    runtime.camera.yaw = Math.PI / 2;
    const yaw = runtime.camera.yaw;
    let t = 0;
    const step = (s: number, until?: () => boolean) => {
      for (let i = 0; i < s * 30; i++) {
        t += 1 / 30;
        ms.update(1 / 30, t, { cameraYaw: yaw, frozen: false, playing: true, controller: c, frustum: new THREE.Frustum() });
        c.step({ dt: 1 / 30, now: t, cameraYaw: yaw, frozen: p.locked, riding: ms.carried });
        ms.finishPlayer();
        if (until?.()) return true;
      }
      return false;
    };
    input.glideCount++;
    step(2.5);
    assert.equal(ms.mode, 'glide');
    takeFaceRequest();
    input.glideCount++;
    assert.ok(step(12, () => ms.mode === 'foot'), 'landed');
    const req = takeFaceRequest();
    assert.ok(req?.open, 'the camera is asked to face the open ground');
    const { heading, run } = openHeading(p.x, p.z, p.heading);
    assert.ok(Math.abs(wrap(p.heading - heading)) < 1e-6 && run > 0, `facing the open ground (${p.heading.toFixed(2)} vs ${heading.toFixed(2)}, run ${run})`);
    for (const d of [1.4, 2.8].filter(d => d <= run)) assert.ok(canStand(p.x + Math.sin(p.heading) * d, p.z + Math.cos(p.heading) * d, FACE_OPEN.radius), `walkable ${d} u ahead`);
  } finally { moveApi.bindMoveApi(null); ms.dispose(); game.set({ phase: 'title', move: { mode: 'foot' } }); }
});

test('faceOpen at a transit hop-off (W5-F7): actors/moveSystem faces the open pavement once the rider has stepped down', async () => {
  const { readFileSync } = await import('node:fs');
  const path = await import('node:path');
  const src = readFileSync(path.resolve(import.meta.dirname, '../src/opus-bay/actors/moveSystem.ts'), 'utf8');
  assert.match(src, /case 'transit-alighted':[\s\S]{0,260}faceOpen\(o\.slot\.x, o\.slot\.z\);/);
  assert.match(src, /c\.sync\(\);\s*\/\/ W5-F7: face the open ground[^\n]*\n\s*faceOpen\(spot\.x, spot\.z\);/);
});
