import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';

/**
 * Wave 9 · lane N · the adversarial review's fixes (W9-N-review).
 * N-RC-1: at Judah & La Playa the pill said 「车 9 秒后到」 for ~230 s (the rail model's live ETA stood still).
 * N-RP-2: the pill said 约 12 秒 and the waypoint 约 16 秒 for one walk, both frozen (each slot held its own low).
 */

const styles = registerHooks({ load(url, context, next) { return url.endsWith('.css') ? { format: 'module', shortCircuit: true, source: 'export {}' } : next(url, context); } });
const GT = await import('../src/opus-bay/ui/guideText');
const GC = await import('../src/opus-bay/game/guideCity');
styles.deregister();

test('N-RC-1 a live wait that stands still for WAIT_STALL_MS says 车快到了, not a frozen 9 秒', () => {
  let t = GC.trackWait(null, 'k', 9, 0);
  assert.equal(t.soon, false);
  t = GC.trackWait(t.track, 'k', 9, GC.WAIT_STALL_MS - 1);
  assert.equal(t.soon, false, 'not yet');
  t = GC.trackWait(t.track, 'k', 9, GC.WAIT_STALL_MS + 1);
  assert.equal(t.soon, true, 'stood still for 15 s');
  // a falling wait starts afresh; a new leg too; a long frozen wait keeps its number
  assert.equal(GC.trackWait(t.track, 'k', 7, GC.WAIT_STALL_MS + 2).soon, false);
  assert.equal(GC.trackWait(t.track, 'k2', 9, GC.WAIT_STALL_MS + 2).soon, false);
  const long = GC.trackWait(GC.trackWait(null, 'L', 120, 0).track, 'L', 120, 60000);
  assert.equal(long.soon, false, 'a wait over WAIT_STALL_MAX keeps its number');
  // the counting-down wait: never "soon"
  let c = GC.trackWait(null, 'c', 40, 0);
  for (let s = 1; s <= 30; s++) { c = GC.trackWait(c.track, 'c', 40 - s, s * 1000); assert.equal(c.soon, false); }
  assert.equal(GT.waitRideLabel(9, 60, 'light-rail', true).zh, '车快到了 · 车程约 1 分钟');
  assert.equal(GT.waitRideLabel(9, 60, 'light-rail', true).en, 'Train due soon · ride ~1 min');
  assert.equal(GT.waitRideLabel(9, 60, 'light-rail').zh, '车 9 秒后到 · 车程约 1 分钟', 'unchanged without a stall');
  assert.equal(GT.waitRideLabel(0, 60, 'light-rail', true).zh, '车已到站 · 车程约 1 分钟', 'at the stop wins');
});

test('N-RP-2 the pill, the card and the last leg\'s waypoint share ONE smoothed time; a pace change re-bases it', () => {
  const trip = { startedAt: 42, leg: 0, legs: [{ via: 'walk', from: { x: 0, z: 0 }, to: { x: 40, z: 0 }, seconds: 30, length: 40 }] } as never;
  const a = GC.tripEtaShown('pill', trip, { x: 0, z: 0 });
  const b = GC.tripEtaShown('card', trip, { x: 0, z: 0 });
  assert.equal(a.seconds, b.seconds);
  // the pill saw a lower time; then the waypoint asks with the same position: the same number (it was 12 vs 16)
  const low = GC.tripEtaShown('pill', trip, { x: 10, z: 0 }).seconds;
  assert.equal(GC.tripEtaShown('wp', trip, { x: 10, z: 0 }).seconds, low);
  assert.notEqual(GC.tripEtaKey(trip, true), GC.tripEtaKey(trip, false), 'carried vs walking is a new key');
});
