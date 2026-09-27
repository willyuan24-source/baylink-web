import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { onEvent, type GameEvent } from '../src/opus-bay/core/events';
import { runtime } from '../src/opus-bay/core/runtime';
import { game } from '../src/opus-bay/core/store';
import { heightAt } from '../src/opus-bay/core/terrain';
import { PlayerController, type Obstacle } from '../src/opus-bay/actors/controller';
import { MoveSystem } from '../src/opus-bay/actors/moveSystem';
import * as moveApi from '../src/opus-bay/actors/moveApi';
import { registerObstacleSource } from '../src/opus-bay/actors/view';

// Lane E2, wave 3, part a: the cross-lane hooks other lanes wait for (setGlideUnlocked for G1's save v2, obstacle
// sources in giveWay for F's crowd and traffic), then the transit rider, touch, gamepad and pant work.

const DT = 1 / 60;

function moveEnv(c: PlayerController) {
  return { cameraYaw: Math.PI, frozen: false, playing: true, controller: c, frustum: new THREE.Frustum() };
}

function resetPlayer(p: { x: number; z: number }, heading = 0) {
  const pl = runtime.player;
  pl.x = p.x; pl.z = p.z; pl.y = heightAt(p.x, p.z); pl.heading = heading;
  pl.pathTarget = null; pl.pendingInteract = null; pl.locked = false;
}

// ---------------------------------------------------------------------------
// setGlideUnlocked (G1's save v2 restore)
// ---------------------------------------------------------------------------

test('moveApi.setGlideUnlocked: applied at the bind when called before it, quiet (no unlock event), and locks again', () => {
  const events: GameEvent[] = [];
  const off = onEvent(e => { if (e.type === 'glide:unlock') events.push(e); });
  moveApi.bindMoveApi(null);
  moveApi.setGlideUnlocked(true);
  assert.equal(moveApi.glideUnlocked(), true, 'before the bind: the pending value answers');
  const ms = new MoveSystem();
  assert.equal(ms.glideUnlocked, false, 'a fresh system starts locked (no viewpoint, no ?debug)');
  moveApi.bindMoveApi(ms);
  try {
    assert.equal(ms.glideUnlocked, true, 'the pending restore is applied at the bind');
    assert.equal(moveApi.glideUnlocked(), true);
    const c = new PlayerController();
    game.set({ phase: 'playing' });
    ms.update(DT, 0, moveEnv(c));
    assert.equal(events.length, 0, 'a restored unlock is quiet');
    moveApi.setGlideUnlocked(false);
    assert.equal(moveApi.glideUnlocked(), false, 'Settings reset locks it again');
    moveApi.setGlideUnlocked('yes' as unknown as boolean);
    assert.equal(moveApi.glideUnlocked(), false, 'junk is ignored');
    moveApi.setGlideUnlocked(true);
    assert.equal(ms.glideUnlocked, true);
  } finally { off(); moveApi.bindMoveApi(null); ms.dispose(); game.set({ phase: 'title' }); }
  moveApi.bindMoveApi(null);
  const ms2 = new MoveSystem();
  moveApi.bindMoveApi(ms2);
  try { assert.equal(ms2.glideUnlocked, false, 'the pending value is used once'); } finally { moveApi.bindMoveApi(null); ms2.dispose(); }
});

test('moveApi.subscribeGlide: the UI hears the bind, a restore and the viewpoint unlock', async () => {
  let calls = 0;
  const off = moveApi.subscribeGlide(() => { calls++; });
  const ms = new MoveSystem();
  try {
    moveApi.bindMoveApi(ms);
    assert.equal(calls, 0, 'the bind notifies after the render that built the system');
    await Promise.resolve();
    assert.equal(calls, 1);
    moveApi.setGlideUnlocked(true);
    assert.equal(calls, 2);
    moveApi.setGlideUnlocked(false);
    game.set({ phase: 'playing', viewpointUnlocked: true });
    // (the unlock line is a toast: core/store toast times out through window.setTimeout)
    const g = globalThis as { window?: unknown };
    const hadWindow = 'window' in g;
    if (!hadWindow) g.window = { setTimeout: () => 0 };
    try { ms.update(DT, 0, moveEnv(new PlayerController())); } finally { if (!hadWindow) delete g.window; }
    assert.equal(ms.glideUnlocked, true);
    assert.equal(calls, 4, 'the Coit viewpoint unlock notifies too');
  } finally { off(); moveApi.bindMoveApi(null); ms.dispose(); game.set({ phase: 'title', viewpointUnlocked: false }); }
});

// ---------------------------------------------------------------------------
// E2-16 · obstacle sources in giveWay (F's crowd walkers and toy traffic)
// ---------------------------------------------------------------------------

test('E2-16 giveWay: a vehicle stops short of a registered crowd walker (soft bump, a "whoa"), and drives on once it is gone', () => {
  game.set({ phase: 'playing' });
  const events: GameEvent[] = [];
  const off = onEvent(e => { if (e.type === 'vehicle:bump' || e.type === 'bump') events.push(e); });
  const ms = new MoveSystem();
  moveApi.bindMoveApi(ms);
  let unregister = () => {};
  try {
    const c = new PlayerController();
    const car = ms.fleet.rides.find(r => r.kind === 'car')!;
    resetPlayer({ x: car.sim.x + 1.6, z: car.sim.z }, 0);
    c.sync();
    ms.onInteract(`ride:${car.id}`, c);
    let t = 0;
    for (; t < 3; t += DT) ms.update(DT, t, moveEnv(c));
    assert.equal(ms.mode, 'car');
    // a walker standing 7 u up the promenade, in the car's lane
    const fx = Math.sin(car.sim.heading), fz = Math.cos(car.sim.heading);
    const walker = { x: car.sim.x + fx * 7, z: car.sim.z + fz * 7 };
    const asked: number[] = [];
    unregister = registerObstacleSource((out: Obstacle[], x, z, r) => {
      asked.push(r);
      if (Math.hypot(walker.x - x, walker.z - z) <= r + 0.5) out.push({ x: walker.x, z: walker.z, r: 0.35, kind: 'crowd' });
    });
    runtime.input.moveY = 1;
    let minGap = Infinity;
    for (let k = 0; k < 60 * 3; k++, t += DT) {
      ms.update(DT, t, moveEnv(c));
      minGap = Math.min(minGap, (walker.x - car.sim.x) * fx + (walker.z - car.sim.z) * fz);
    }
    assert.ok(asked.length > 0, 'the source was asked');
    assert.ok(minGap > car.length * 0.5, `the car never reached the walker (closest gap ${minGap.toFixed(2)} u)`);
    assert.ok(events.some(e => e.type === 'vehicle:bump' && !e.hard), 'a soft bump');
    assert.ok(events.some(e => e.type === 'bump' && e.kind === 'npc'), 'the walker says whoa');
    // gone: the car drives on past the spot
    unregister(); unregister = () => {};
    for (let k = 0; k < 60 * 1.5; k++, t += DT) ms.update(DT, t, moveEnv(c));
    const past = (car.sim.x - walker.x) * fx + (car.sim.z - walker.z) * fz;
    assert.ok(past > 0, `drove on (${past.toFixed(2)} u past the spot)`);
    // toy traffic 6 u ahead (a wider radius): a soft bump at speed, no "whoa"
    events.length = 0;
    const hx = Math.sin(car.sim.heading), hz = Math.cos(car.sim.heading);
    const cab = { x: car.sim.x + hx * 6, z: car.sim.z + hz * 6 };
    unregister = registerObstacleSource((out, x, z, r) => {
      if (Math.hypot(cab.x - x, cab.z - z) <= r + 2) out.push({ x: cab.x, z: cab.z, r: 1.1, kind: 'traffic' });
    });
    let cabGap = Infinity;
    for (let k = 0; k < 60 * 2; k++, t += DT) {
      ms.update(DT, t, moveEnv(c));
      cabGap = Math.min(cabGap, Math.hypot(cab.x - car.sim.x, cab.z - car.sim.z));
    }
    assert.ok(cabGap > car.length * 0.5 + 0.9, `stopped short of the other car (gap ${cabGap.toFixed(2)} u)`);
    assert.ok(events.some(e => e.type === 'vehicle:bump'), 'traffic: a soft bump');
    assert.ok(!events.some(e => e.type === 'bump' && e.kind === 'npc'), 'traffic: no whoa');
  } finally { runtime.input.moveY = 0; unregister(); off(); moveApi.bindMoveApi(null); ms.dispose(); game.set({ phase: 'title' }); }
});
