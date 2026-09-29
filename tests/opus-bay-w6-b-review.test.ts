import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

/**
 * W6-B review (docs/opus-bay/sf-w6-B.md "## Review (adversarial, W6-B-review)"): the defects the review of lane B found,
 * each red on the lane's head (8ac629d3) before its fix.
 */

// --- headless canvas / DOM stubs (world modules create label atlases at import time), as tests/opus-bay-sf-transit-verify.test.ts
const g = globalThis as unknown as Record<string, unknown>;
const noop = () => undefined;
const ctx2d = new Proxy({}, {
  get: (_t, k) => (k === 'measureText' ? () => ({ width: 10 }) : k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop: noop }) : k === 'getImageData' ? (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }) : noop),
  set: () => true,
});
g.window ??= globalThis;
const el = () => ({ width: 0, height: 0, style: {} as Record<string, string>, textContent: '', getContext: () => ctx2d, setAttribute: noop, remove: noop, appendChild: noop });
g.document ??= { createElement: el, querySelector: () => null, body: el() };
g.requestAnimationFrame ??= (fn: () => void) => setTimeout(fn, 0);

const T = await import('../src/opus-bay/data/transit');
const { CableSystem } = await import('../src/opus-bay/world/transitLine');
const { roadViewer } = await import('../src/opus-bay/world/sf/roadViewer');
const { game } = await import('../src/opus-bay/core/store');
const { runtime } = await import('../src/opus-bay/core/runtime');
const { flow } = await import('../src/opus-bay/game/flowStore');
const transit = await import('../src/opus-bay/game/transit');
const LR = await transit.loadLineRides();

const PUB = path.resolve(import.meta.dirname, '../public/opus-bay/sf/v1');
const FILE = JSON.parse(fs.readFileSync(path.join(PUB, 'transit.json'), 'utf8')) as import('../src/opus-bay/data/transit').TransitFileJson;
const DATA = T.buildTransit(FILE);
const DT = 1 / 30;

test('W6-B review R1: a cable car standing short of the player sitting in their toy car — after a few seconds BAYBAY asks them to pull over (W6-B1 made the transit wait for the car; the ask was for the player on foot only, so the car waited in silence for good)', () => {
  // a Powell–Hyde car coming in to the Powell & Market turntable (s → 0); the others parked far off (verify D3's set-up)
  const sys = new CableSystem(DATA, { viewer: roadViewer });
  const line = DATA.lines.find(l => l.id === 'powell-hyde')!;
  const cars = sys.cars.filter(c => c.line === line);
  for (const c of sys.cars) if (c !== cars[1]) { c.mode = 'dwell'; c.timer = 1e6; c.s = c.line === line ? 300 : c.s; c.station = null; }
  const car = cars[1];
  Object.assign(car, { s: 40, dir: -1, mode: 'run', v: 0, timer: 0, turned: false, station: null, authority: 0, authStation: 'powell-market' });
  sys.updatePose(car);
  const c = T.pointAt(line, 0), q = T.pointAt(line, 3);
  const fx = (c.x - q.x) / 3, fz = (c.z - q.z) / 3;
  // the player's toy car (occupied) on the rails where the car's body would rest
  const at = { x: c.x + fx * (T.CABLE.length / 2 - 2), z: c.z + fz * (T.CABLE.length / 2 - 2) };
  T.setTransitData(DATA);
  T.setActiveCableSystem(sys);
  const prev = game.get();
  try {
    Object.assign(runtime.vehicle, { id: 'qa-car', kind: 'car', occupied: true, x: at.x, y: 0, z: at.z, heading: 0, speed: 0 });
    runtime.player.x = at.x; runtime.player.z = at.z;
    runtime.move.mode = 'car';
    game.set({ phase: 'playing', worldMode: 'city', move: { mode: 'car' } } as never);
    flow.set({ bubble: null });
    let asked = -1;
    for (let i = 0; i < 30 * 25; i++) {
      sys.step(DT);
      transit.stepTransit(DT);
      if (asked < 0 && flow.get().bubble) asked = i * DT;
    }
    assert.ok(car.s > 2 && Math.abs(car.v) < 0.05, `the cable car stands short of the toy car (s ${car.s.toFixed(2)}, v ${car.v.toFixed(2)})`);
    assert.ok(sys.viewerHeld() >= LR.STEP_ASIDE_AFTER, `held ${sys.viewerHeld().toFixed(1)} s`);
    assert.ok(asked >= LR.STEP_ASIDE_AFTER && asked < 25, `BAYBAY asked after ${asked.toFixed(1)} s (never: -1)`);
    const b = flow.get().bubble!;
    assert.equal(b.text.zh, '叮当车在等我们让路呢，把车挪到路边吧');
    assert.equal(b.text.en, 'The cable car is waiting for us. Let’s pull over to the side');
  } finally {
    Object.assign(runtime.vehicle, { id: null, kind: null, occupied: false, speed: 0 });
    runtime.move.mode = 'foot';
    T.setActiveCableSystem(null);
    game.set({ phase: prev.phase, worldMode: prev.worldMode, move: prev.move } as never);
    flow.set({ bubble: null });
  }
  // on the bike: the same ask in the bike's words; on foot the line is unchanged
  const line0 = { zh: '电车在等我们让路呢，往路边站一站吧', en: 'The streetcar is waiting for us. Let’s step to the side' };
  assert.deepEqual(LR.pullOver(line0, 'bike'), { zh: '电车在等我们让路呢，把单车骑到路边吧', en: 'The streetcar is waiting for us. Let’s pull over to the side' });
});

test('W6-B review R2: roadViewer (asked by every cable car, streetcar, bus and train every frame) rewrites one record — it made a new object per call', () => {
  Object.assign(runtime.vehicle, { id: null, kind: null, occupied: false });
  runtime.player.x = 3; runtime.player.z = 4; runtime.move.mode = 'foot';
  const a = roadViewer();
  assert.deepEqual({ ...a }, { x: 3, z: 4, onFoot: true });
  Object.assign(runtime.vehicle, { id: 'qa-bike', kind: 'bike', occupied: true, x: 7, z: 8 });
  const b = roadViewer();
  assert.equal(b, a, 'the same record');
  assert.deepEqual({ ...b }, { x: 7, z: 8, onFoot: true });
  Object.assign(runtime.vehicle, { id: null, kind: null, occupied: false });
  runtime.move.mode = 'transit';
  assert.equal(roadViewer().onFoot, false, 'riding transit: nobody on the road');
  runtime.move.mode = 'foot';
});
