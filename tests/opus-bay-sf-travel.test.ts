import assert from 'node:assert/strict';
import test from 'node:test';
import { CLOUD_PAN_SHARE, DESCENT_S, HOLD_MAX_S, PICKUP_S, RISE_S, TOP_DIST, TOP_PITCH, TripClock, panPoint, planTrip, topShot, tripPose } from '../src/opus-bay/game/fastTravel';
import { parseAt, readQa } from '../src/opus-bay/game/qa';

/** Lane G1 (G1-7 / G1-12): fast-travel phases on a fake clock, the sky path, ?at= parsing. */

const run = (c: TripClock, ready: (t: number) => boolean, dt = 1 / 60) => {
  const log: { phase: string; at: number }[] = [];
  let t = 0;
  while (!c.done && t < 60) { t += dt; const e = c.step(dt, ready(t)); if (e) log.push({ phase: e, at: t }); }
  return log;
};

test('plan: pan = clamp(d / 400, 0.6, 3.5) s, cloud cut beyond 1,400 u, yaw toward the destination', () => {
  assert.equal(planTrip({ x: 0, z: 0 }, { x: 100, z: 0 }).pan, 0.6);
  assert.equal(planTrip({ x: 0, z: 0 }, { x: 800, z: 0 }).pan, 2);
  assert.equal(planTrip({ x: 0, z: 0 }, { x: 0, z: 2400 }).pan, 3.5);
  assert.equal(planTrip({ x: 0, z: 0 }, { x: 1300, z: 0 }).cloud, false);
  assert.equal(planTrip({ x: 0, z: 0 }, { x: 1500, z: 0 }).cloud, true);
  assert.ok(Math.abs(planTrip({ x: 0, z: 0 }, { x: 10, z: 0 }).yaw - Math.PI / 2) < 1e-9);
});

test('clock: pickup 0.8 → rise 1.0 → pan → hold (until ready) → descent 1.2 → done', () => {
  const c = new TripClock(planTrip({ x: 0, z: 0 }, { x: 800, z: 0 }));
  const readyAt = 6;
  const log = run(c, t => t >= readyAt);
  assert.deepEqual(log.map(l => l.phase), ['rise', 'pan', 'hold', 'descent', 'done']);
  const at = Object.fromEntries(log.map(l => [l.phase, l.at]));
  const eps = 0.05;
  assert.ok(Math.abs(at.rise - PICKUP_S) < eps);
  assert.ok(Math.abs(at.pan - (PICKUP_S + RISE_S)) < eps);
  assert.ok(Math.abs(at.hold - (PICKUP_S + RISE_S + 2)) < eps);
  assert.ok(Math.abs(at.descent - readyAt) < eps, 'the hold ends when the city is ready');
  assert.ok(Math.abs(at.done - (readyAt + DESCENT_S)) < eps);
});

test('clock: the hold cuts after 8 s; a ready city skips it; skip jumps to the hold', () => {
  const slow = new TripClock(planTrip({ x: 0, z: 0 }, { x: 100, z: 0 }));
  const log = run(slow, () => false);
  const at = Object.fromEntries(log.map(l => [l.phase, l.at]));
  assert.ok(Math.abs(at.descent - at.hold - HOLD_MAX_S) < 0.05);
  const fast = new TripClock(planTrip({ x: 0, z: 0 }, { x: 100, z: 0 }));
  const log2 = run(fast, () => true);
  const at2 = Object.fromEntries(log2.map(l => [l.phase, l.at]));
  assert.ok(at2.descent - at2.hold < 0.05, 'ready: no wait');
  const sk = new TripClock(planTrip({ x: 0, z: 0 }, { x: 900, z: 0 }));
  sk.step(0.1, false);
  sk.skip();
  assert.equal(sk.phase, 'hold');
  sk.skip();
  assert.equal(sk.phase, 'hold', 'skipping in the hold does nothing');
});

test('sky path: pan stops at 45 % on cloud trips; the pelican cruises and lands on the destination', () => {
  const from = { x: 0, z: 0 }, to = { x: 2000, z: 0 };
  const plan = planTrip(from, to);
  assert.ok(Math.abs(panPoint(from, to, plan, 1).x - 2000 * CLOUD_PAN_SHARE) < 1e-6);
  const near = planTrip(from, { x: 500, z: 0 });
  assert.equal(panPoint(from, { x: 500, z: 0 }, near, 1).x, 500);
  const flat = () => 3;
  const c = new TripClock(near);
  const poses: number[] = [];
  let guard = 0;
  while (!c.done && guard++ < 2000) { poses.push(tripPose(c, from, { x: 500, z: 0 }, flat).y); c.step(1 / 30, true); }
  assert.ok(Math.max(...poses) > 40, 'cruise height');
  const end = new TripClock(near);
  end.phase = 'descent'; end.elapsed = DESCENT_S;
  const last = tripPose(end, from, { x: 500, z: 0 }, flat);
  assert.deepEqual([last.x, last.y, last.z], [500, 3, 0]);
  const shot = topShot({ x: 10, z: 20 }, 5, 0);
  const d = Math.hypot(shot.position[0] - 10, shot.position[1] - 5, shot.position[2] - 20);
  assert.ok(Math.abs(d - TOP_DIST) < 1e-6);
  assert.ok(Math.abs(Math.asin((shot.position[1] - 5) / d) - TOP_PITCH) < 1e-6, 'pitch 1.1');
});

test('?at=: ids, lm-<id>, ll: and xz:; the old district cases unchanged', () => {
  assert.deepEqual(parseAt('coit-view'), { kind: 'id', id: 'coit-view' });
  assert.deepEqual(parseAt('lm-sutro-tower'), { kind: 'id', id: 'lm-sutro-tower' });
  assert.deepEqual(parseAt('postcard:sf-painted-ladies'), { kind: 'id', id: 'postcard:sf-painted-ladies' });
  assert.deepEqual(parseAt('ll:37.7955,-122.3937'), { kind: 'll', lat: 37.7955, lng: -122.3937 });
  assert.deepEqual(parseAt('xz:120.5,-40'), { kind: 'xz', x: 120.5, z: -40 });
  for (const bad of ['ll:95,0', 'xz:1', 'xz:a,b', 'll:', '../x', '', undefined]) assert.equal(parseAt(bad), null, String(bad));
  assert.equal(readQa('?at=ll:37.8,-122.4').at, 'll:37.8,-122.4');
  assert.equal(readQa('?at=../../x').at, undefined);
  assert.deepEqual(readQa('?start=tour&time=night&quality=low&debug=1&at=coit-view'), { start: 'tour', time: 'night', quality: 'low', debug: true, at: 'coit-view' });
});
