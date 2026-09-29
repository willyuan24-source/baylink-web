import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

/**
 * W6-K2 part a: Settings (the game's pause) holds a city ride. The wave-5 hand-off: "with Settings open the tour bus
 * still boards and drives on". Scripted on a city cable car (lane F's CableSystem stepped in node, its rider car
 * published as the platform like world/transitLayer does; every city line holds the same way: phase 'here' waits for
 * the rider, the hop-off brake stands the ridden car).
 */

// --- headless canvas stub (world modules create label atlases at import time), as tests/opus-bay-sf-hopoff.test.ts
const g = globalThis as unknown as Record<string, unknown>;
const noop = () => undefined;
const ctx2d = new Proxy({}, {
  get: (_t, k) => (k === 'measureText' ? () => ({ width: 10 }) : k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop: noop }) : k === 'getImageData' ? (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }) : noop),
  set: () => true,
});
g.window ??= globalThis;
g.document ??= { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => ctx2d }) };

const T = await import('../src/opus-bay/data/transit');
const { CableSystem, setActiveCableSystem } = await import('../src/opus-bay/world/transitLine');
const platform = await import('../src/opus-bay/actors/platform');
const { CABLE_PLATFORM } = await import('../src/opus-bay/world/cablecar');
const { game } = await import('../src/opus-bay/core/store');
const { flow } = await import('../src/opus-bay/game/flowStore');
const transit = await import('../src/opus-bay/game/transit');
const ride = await import('../src/opus-bay/game/ride');

const FILE = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, '../public/opus-bay/sf/v1/transit.json'), 'utf8')) as import('../src/opus-bay/data/transit').TransitFileJson;
const DATA = T.buildTransit(FILE);
const DT = 1 / 30;
const LINE = 'powell-hyde';

test('W6-K2: with Settings open a city ride holds — the car waits at the stop for the rider, the ridden car stands, nothing goes on until Settings closes', () => {
  T.setTransitData(DATA);
  const sys = new CableSystem(DATA);
  setActiveCableSystem(sys);
  platform.definePlatform(LINE, CABLE_PLATFORM);
  const frame = () => {
    sys.step(DT);
    const car = sys.riderCarOf(LINE);
    if (car) platform.setPlatformPose(LINE, car.pose, DT);
    transit.stepTransit(DT);
  };
  const run = (maxS: number, until: () => boolean) => { for (let i = 0; i < maxS / DT; i++) { frame(); if (until()) return true; } return false; };
  const settings = (open: boolean) => game.set({ panel: { kind: open ? 'settings' : null }, paused: open });
  try {
    game.set({ phase: 'playing', worldMode: 'city' });
    // (1) waiting at the stop, Settings opens: the car comes and stands at the stop; the rider is not boarded
    transit.rideCable(LINE, 'powell-geary', 'hyde-beach');
    settings(true);
    assert.equal(transit.ridePausedNow(), true);
    assert.ok(run(180, () => sys.rideStatus()?.phase === 'here'), 'the car reached the stop');
    const car = sys.cars[sys.rideStatus()!.car];
    const at = { x: car.pose.x, z: car.pose.z };
    run(20, () => false);
    assert.equal(ride.currentRide()?.mode, 'wait', 'not boarded while Settings is open');
    assert.equal(sys.rideStatus()?.phase, 'here');
    assert.ok(Math.hypot(car.pose.x - at.x, car.pose.z - at.z) < 0.2, 'the car waited at the stop for its rider');
    // (2) Settings closes: the rider boards
    settings(false);
    assert.ok(run(3, () => ride.currentRide()?.mode === 'follow'), 'boarded once Settings closed');
    assert.ok(run(40, () => car.v > 3), `the car goes (v ${car.v.toFixed(2)})`);
    // (3) riding, Settings opens: the car brakes to a stand and holds, the rider stays aboard
    settings(true);
    assert.ok(platform.platformStop(LINE) === null, 'the brake is asked on the next frame');
    assert.ok(run(4, () => car.v < 0.05), `stood within 4 s (v ${car.v.toFixed(2)})`);
    assert.ok(platform.platformStop(LINE), 'held by the pause brake');
    const still = { x: car.pose.x, z: car.pose.z };
    run(30, () => false);
    assert.ok(Math.hypot(car.pose.x - still.x, car.pose.z - still.z) < 0.3, 'stood 30 s while Settings was open');
    assert.ok(ride.currentRide(), 'still aboard');
    assert.equal(flow.get().ride?.stage, 'braking', 'the HUD banner says the car stands');
    // (4) Settings closes: the brake the pause asked for is released and the car goes on
    settings(false);
    frame();
    assert.equal(platform.platformStop(LINE), null, 'the pause brake released');
    assert.ok(run(10, () => car.v > 1), `the car goes on (v ${car.v.toFixed(2)})`);
    // (5) the ride finishes as before
    assert.ok(run(400, () => ride.currentRide() === null), 'arrived and stepped off');
    // (6) the district's hero ride never holds (district mode never changes)
    game.set({ worldMode: 'district', paused: true });
    assert.equal(transit.ridePausedNow({ from: 'a', to: 'b', fromT: 0, toT: 1, mode: 'follow', elapsed: 0, duration: 5, carT0: 0, leftStop: false, line: 'streetcar', hero: true }), false);
  } finally {
    setActiveCableSystem(null);
    T.setTransitData(null);
    ride.endRide();
    platform.releasePlatformStop(LINE);
    platform.platforms.delete(LINE);
    game.set({ riding: null, phase: 'title', paused: false, panel: { kind: null }, worldMode: 'district' });
    flow.set({ ride: null });
  }
});

test('W6-K2: a rider\'s own hop-off brake is never released by the pause', () => {
  T.setTransitData(DATA);
  const sys = new CableSystem(DATA);
  setActiveCableSystem(sys);
  platform.definePlatform(LINE, CABLE_PLATFORM);
  try {
    game.set({ phase: 'playing', worldMode: 'city', paused: false });
    transit.rideCable(LINE, 'powell-geary', 'hyde-beach');
    for (let i = 0; i < 180 / DT && ride.currentRide()?.mode !== 'follow'; i++) {
      sys.step(DT);
      const car = sys.riderCarOf(LINE);
      if (car) platform.setPlatformPose(LINE, car.pose, DT);
      transit.stepTransit(DT);
    }
    assert.equal(ride.currentRide()?.mode, 'follow');
    platform.requestPlatformStop(LINE, 1.2);
    game.set({ paused: true, panel: { kind: 'settings' } });
    transit.stepTransit(DT);
    game.set({ paused: false, panel: { kind: null } });
    transit.stepTransit(DT);
    assert.ok(platform.platformStop(LINE), 'the rider\'s brake still stands');
  } finally {
    setActiveCableSystem(null);
    T.setTransitData(null);
    ride.endRide();
    platform.releasePlatformStop(LINE);
    platform.platforms.delete(LINE);
    game.set({ riding: null, phase: 'title', paused: false, panel: { kind: null }, worldMode: 'district' });
    flow.set({ ride: null });
  }
});
