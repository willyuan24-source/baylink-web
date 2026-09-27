import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

/**
 * Lane E2, wave 3, part a: the transit rider (E2-10 hop-off brake handshake, sf-w2-contracts §5.2, and lane F's platform
 * fields: pitch, running boards, hang lean, decks, BAYBAY's cable-car bench) scripted end to end on a city cable car
 * (lane F's CableSystem stepped in node, its rider car published as the platform like world/transitLayer does), and the
 * hero F-line (district: the car does not brake yet, so the hop-off stays immediate).
 */

// --- headless canvas stub (world modules create label atlases at import time), as tests/opus-bay-sf-transit.test.ts
const g = globalThis as unknown as Record<string, unknown>;
const noop = () => undefined;
const ctx2d = new Proxy({}, {
  get: (_t, k) => (k === 'measureText' ? () => ({ width: 10 }) : k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop: noop }) : k === 'getImageData' ? (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }) : noop),
  set: () => true,
});
g.window ??= globalThis;
g.document ??= { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => ctx2d }) };

const THREE = await import('three');
const T = await import('../src/opus-bay/data/transit');
const { CableSystem, setActiveCableSystem } = await import('../src/opus-bay/world/transitLine');
const platform = await import('../src/opus-bay/actors/platform');
const { CABLE_PLATFORM } = await import('../src/opus-bay/world/cablecar');
const { game } = await import('../src/opus-bay/core/store');
const { runtime } = await import('../src/opus-bay/core/runtime');
const { input } = await import('../src/opus-bay/core/input');
const { canStand } = await import('../src/opus-bay/core/terrain');
const { flow } = await import('../src/opus-bay/game/flowStore');
const transit = await import('../src/opus-bay/game/transit');
const ride = await import('../src/opus-bay/game/ride');
const { PlayerController } = await import('../src/opus-bay/actors/controller');
const { MoveSystem } = await import('../src/opus-bay/actors/moveSystem');
const { ALIGHT_SPEED, TIMING, transitExitSlots } = await import('../src/opus-bay/actors/modes');

const FILE = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, '../public/opus-bay/sf/v1/transit.json'), 'utf8')) as import('../src/opus-bay/data/transit').TransitFileJson;
const DATA = T.buildTransit(FILE);
const DT = 1 / 30;
const LINE = 'powell-hyde';

function env(c: InstanceType<typeof PlayerController>) {
  return { cameraYaw: runtime.camera.yaw, frozen: false, playing: true, controller: c, frustum: new THREE.Frustum() };
}

test('transitExitSlots: the rider\'s side level with the rider first, then the car middle, the other side, behind, ahead', () => {
  const car = { x: 10, z: 20, heading: 0 };
  const s = transitExitSlots(car, 1, 1.3, 1.4, 5.6);
  assert.deepEqual(s.map(q => q.side), ['left', 'left', 'right', 'right', 'back', 'front']);
  assert.ok(Math.abs(s[0].x - (10 + 2.3)) < 1e-9 && Math.abs(s[0].z - 21.3) < 1e-9, 'left of the car (+x at heading 0), at the rider\'s z');
  assert.ok(Math.abs(s[2].x - (10 - 2.3)) < 1e-9);
  const r = transitExitSlots(car, -1, 0, 1.4, 5.6);
  assert.equal(r[0].side, 'right');
});

test('E2-10 on a city cable car: board, ride pitched on the running board (lean out), hop off → brake → step off at a clear slot → the car goes on', () => {
  T.setTransitData(DATA);
  const sys = new CableSystem(DATA);
  setActiveCableSystem(sys);
  platform.definePlatform(LINE, CABLE_PLATFORM);
  const ms = new MoveSystem();
  const c = new PlayerController();
  let t = 0;
  const frame = () => {
    sys.step(DT);
    const car = sys.riderCarOf(LINE);
    if (car) platform.setPlatformPose(LINE, car.pose, DT);
    transit.stepTransit(DT);
    ms.update(DT, t, env(c));
    ms.finishPlayer();
    t += DT;
  };
  const run = (maxS: number, until: () => boolean) => { for (let i = 0; i < maxS / DT; i++) { frame(); if (until()) return true; } return false; };
  try {
    game.set({ phase: 'playing' });
    // (1) waiting at the stop: Space cancels at once, no brake request
    transit.rideCable(LINE, 'powell-geary', 'hyde-beach');
    frame();
    assert.equal(ms.mode, 'transit');
    runtime.input.jump = true;
    frame();
    assert.equal(ride.currentRide(), null, 'cancelled while waiting');
    assert.equal(ms.mode, 'foot');
    assert.equal(platform.platformStop(LINE), null);
    // (2) ride: the car comes, the rider boards and hangs off the running board on the camera's side
    transit.rideCable(LINE, 'powell-geary', 'hyde-beach');
    assert.ok(run(120, () => ride.currentRide()?.mode === 'follow'), 'boarded');
    const car = sys.riderCarOf(LINE)!;
    assert.ok(run(40, () => car.v > 8 && Math.abs(car.pose.pitch) > 0.02), 'moving on a grade');
    run(1.5, () => false);
    const plat = platform.platforms.get(LINE)!;
    assert.ok(ms.rider.active);
    assert.ok(Math.abs(Math.abs(platform.rider.x) - 1.22) < 1e-6, `on a running board (x ${platform.rider.x.toFixed(2)})`);
    const side = platform.rider.x > 0 ? 1 : -1;
    // the body follows the car's pitch and leans out over the street
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(ms.rider.quat);
    const fwd = { x: Math.sin(plat.heading), z: Math.cos(plat.heading) }, left = { x: Math.cos(plat.heading), z: -Math.sin(plat.heading) };
    const upFwd = up.x * fwd.x + up.z * fwd.z, upLeft = up.x * left.x + up.z * left.z;
    assert.ok(Math.abs(upFwd + Math.sin(plat.pitch!)) < 0.03, `pitched with the car (up·fwd ${upFwd.toFixed(3)}, pitch ${plat.pitch!.toFixed(3)})`);
    assert.ok(upLeft * side > Math.sin(CABLE_PLATFORM.hangLean!) * 0.8, `leans out on the board (up·left ${upLeft.toFixed(3)})`);
    // BAYBAY sits on the camera-side outward bench beside the rider
    const bench = platform.spotFor(plat, 'seat', side);
    const gl = platform.toLocal(plat, ms.guide.x, ms.guide.z, plat.floor + plat.seatY);
    assert.ok(ms.guide.active && ms.guideAnim.sitting, 'BAYBAY seated');
    assert.ok(Math.abs(gl.x - bench.x) < 0.05 && gl.z > bench.z, `BAYBAY on the rider's bench (local ${gl.x.toFixed(2)}, ${gl.z.toFixed(2)})`);
    // walking keeps the rider on the running board (lane F's decks), not in the aisle
    runtime.input.moveY = 1; input.manualMove = true;
    run(0.6, () => false);
    runtime.input.moveY = 0; input.manualMove = false;
    assert.equal(game.get().move.spot, 'deck');
    assert.ok(Math.abs(platform.rider.x) > 1.0, `still on the board (x ${platform.rider.x.toFixed(2)})`);
    run(0.3, () => false);
    // (3) hop off (the HUD's 提前下车 = moveApi.requestHopOff → input.hopOffCount): brake first
    const v0 = car.v;
    input.hopOffCount++;
    frame();
    assert.ok(platform.platformStop(LINE), 'the car was asked to stop');
    assert.equal(ms.machine.phase, 'braking');
    frame();
    assert.equal(flow.get().ride?.stage, 'braking', 'the HUD says braking');
    assert.ok(ride.currentRide(), 'still aboard while braking');
    let brakeT = 2 * DT, speedAtAlight = -1;
    for (; brakeT < 2; brakeT += DT) {
      frame();
      // (the speed the machine saw this frame: the platform's velocity after this frame's pose)
      const pl = platform.platforms.get(LINE)!;
      if (ms.machine.phase === 'alighting') { speedAtAlight = Math.hypot(pl.vx, pl.vz); break; }
    }
    assert.ok(brakeT <= TIMING.transitBrake + 0.1, `stepped off after ${brakeT.toFixed(2)} s (from ${v0.toFixed(1)} u/s)`);
    assert.ok(speedAtAlight < ALIGHT_SPEED || brakeT >= TIMING.transitBrake - DT, `slow when stepping off (${speedAtAlight.toFixed(2)} u/s)`);
    assert.equal(ride.currentRide(), null, 'the ride ended (lane F hopOffRide)');
    assert.equal(game.get().move.mode, 'foot');
    assert.equal(platform.platformStop(LINE), null, 'the brake released');
    const slot = ms.machine.exitSlot!;
    assert.ok(canStand(slot.x, slot.z, 0.45) || Math.hypot(slot.x - car.pose.x, slot.z - car.pose.z) < 13, 'a standable slot');
    // (4) the 0.4 s step down, then on foot at the slot
    assert.ok(run(1, () => ms.mode === 'foot'), 'on foot');
    assert.ok(Math.hypot(runtime.player.x - slot.x, runtime.player.z - slot.z) < 1e-6);
    assert.ok(Number.isFinite(runtime.player.y));
    assert.ok(!ms.rider.active);
    assert.ok(run(8, () => car.v > 0.5), `the car goes on (${car.mode}, v ${car.v.toFixed(2)})`);
  } finally {
    setActiveCableSystem(null);
    T.setTransitData(null);
    ride.endRide();
    platform.releasePlatformStop(LINE);
    platform.platforms.delete(LINE);
    game.set({ riding: null, phase: 'title' });
    flow.set({ ride: null });
    runtime.input.moveY = 0; input.manualMove = false;
    ms.dispose();
  }
});

test('E2-10 on the hero F-line (district): the car does not brake yet, so Space hops off at once as before (no stop request)', () => {
  const ms = new MoveSystem();
  const c = new PlayerController();
  let t = 0;
  const frame = () => { transit.stepTransit(DT); ms.update(DT, t, env(c)); t += DT; };
  try {
    game.set({ phase: 'playing' });
    const stops = ride.sortedStops();
    transit.rideTo(stops[1].id, stops[0].id);
    frame();
    assert.equal(ms.mode, 'transit');
    for (let i = 0; i < 90 && ride.currentRide()?.mode === 'wait'; i++) frame();
    assert.notEqual(ride.currentRide()?.mode, 'wait', 'the (virtual) car came');
    runtime.input.jump = true;
    frame();
    assert.equal(ride.currentRide(), null, 'off at once');
    assert.equal(ms.mode, 'foot');
    assert.equal(platform.platformStop('streetcar'), null, 'no stop request for the F-line');
  } finally {
    ride.endRide();
    game.set({ riding: null, phase: 'title' });
    flow.set({ ride: null });
    ms.dispose();
  }
});

test('W4 integration (lane T review open 1): while the ridden line says canHopOff false (a Metro tunnel / portal hood) the hop-off says why and the ride goes on; allowed again, it brakes', () => {
  T.setTransitData(DATA);
  const sys = new CableSystem(DATA);
  setActiveCableSystem(sys);
  platform.definePlatform(LINE, CABLE_PLATFORM);
  const ms = new MoveSystem();
  const c = new PlayerController();
  // stand-in for lane T's light-rail status: the same ride, with `canHopOff` / `portalWait` on top
  const own = sys.rideStatus.bind(sys);
  let blocked: false | 'tunnel' | 'mouth' = false;
  (sys as unknown as { rideStatus: () => unknown }).rideStatus = () => {
    const st = own();
    return st && blocked ? { ...st, canHopOff: false, portalWait: blocked === 'mouth' } : st;
  };
  let t = 0;
  const frame = () => {
    sys.step(DT);
    const car = sys.riderCarOf(LINE);
    if (car) platform.setPlatformPose(LINE, car.pose, DT);
    transit.stepTransit(DT);
    ms.update(DT, t, env(c));
    ms.finishPlayer();
    t += DT;
  };
  const run = (maxS: number, until: () => boolean) => { for (let i = 0; i < maxS / DT; i++) { frame(); if (until()) return true; } return false; };
  const toastTexts = () => game.get().toasts.map(x => x.text).join(' | ');
  try {
    game.set({ phase: 'playing', toasts: [] });
    transit.rideCable(LINE, 'powell-geary', 'hyde-beach');
    assert.ok(run(120, () => ride.currentRide()?.mode === 'follow'), 'boarded');
    const car = sys.riderCarOf(LINE)!;
    assert.ok(run(40, () => car.v > 6), 'moving');
    run(0.5, () => false);
    // (1) in the tunnel: Space, B and the HUD's 提前下车 all refuse, with the reason
    blocked = 'tunnel';
    runtime.input.jump = true;
    frame();
    input.hopOffCount++;
    frame();
    assert.equal(platform.platformStop(LINE), null, 'no stop request');
    assert.equal(ms.machine.phase, 'steady', 'no brake');
    assert.ok(ride.currentRide(), 'still riding');
    assert.match(toastTexts(), /隧道里不能下车|No getting off inside the tunnel/);
    // (2) waiting in a mouth for the surface: the other words
    blocked = 'mouth';
    input.hopOffCount++;
    frame();
    assert.equal(ms.machine.phase, 'steady');
    assert.match(toastTexts(), /马上出隧道|Coming out of the tunnel/);
    // (3) out in the open: the usual brake handshake
    blocked = false;
    input.hopOffCount++;
    frame();
    assert.ok(platform.platformStop(LINE), 'the car was asked to stop');
    assert.equal(ms.machine.phase, 'braking');
    assert.ok(run(3, () => ms.mode === 'foot'), 'off after the brake');
  } finally {
    setActiveCableSystem(null);
    T.setTransitData(null);
    ride.endRide();
    platform.releasePlatformStop(LINE);
    platform.platforms.delete(LINE);
    game.set({ riding: null, phase: 'title', toasts: [] });
    flow.set({ ride: null });
    ms.dispose();
  }
});
