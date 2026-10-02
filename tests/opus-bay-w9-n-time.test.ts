import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';

/**
 * Wave 9 · lane N · W9-N2 (review R§5 #6 "状态信息互相矛盾：时间、地点、承诺都对不上"): one time source.
 * Red before the fix: the waiting pill said the whole trip from the boarding quote (约 7 分钟) while the banner said the
 * vehicle's live ETA (约 3 分钟 → 约 11 秒); a walk to a stop named like the place the player stood in said 下一站 渡轮大厦;
 * the walking ETA rose 9 → 25 s on the GGB stop's way round; a walk leg kept the straight-line estimate for good.
 */

// game/guideCity.ts imports its stylesheet (the waypoint's label rules): an empty module in node
const styles = registerHooks({ load(url, context, next) { return url.endsWith('.css') ? { format: 'module', shortCircuit: true, source: 'export {}' } : next(url, context); } });
const GT = await import('../src/opus-bay/ui/guideText');
const GC = await import('../src/opus-bay/game/guideCity');
styles.deregister();
const TPV = await import('../src/opus-bay/game/tripProviders');
const TR = await import('../src/opus-bay/game/trips');
type Leg = import('../src/opus-bay/game/tripTypes').TripLeg;

const walk = (to: { x: number; z: number; station?: string; name?: { zh: string; en: string } }): Leg => ({ via: 'walk', from: { x: 0, z: 0 }, to, seconds: 10, length: 40 });
const busLeg: Leg = { via: 'line', line: 'sf-loop', board: 'loop-ferry-building', alight: 'loop-golden-gate-bridge', wait: 15, stops: 4, from: { x: 0, z: 0, station: 'loop-ferry-building', name: { zh: '渡轮大厦', en: 'Ferry Building' } }, to: { x: 1, z: 1, station: 'loop-golden-gate-bridge', name: { zh: '金门大桥', en: 'Golden Gate Bridge' } }, seconds: 240, length: 1500 } as Leg;
const lines = new Map([['sf-loop', { id: 'sf-loop', kind: 'bus', name: { zh: '观光巴士', en: 'Tour bus' }, color: '#e0563f', length: 1, stops: [], path: [] }]]) as never;

test('W9-N2 waiting: "车 9 秒后到 · 车程约 4 分钟" — the banner\'s wait and the ride, not the trip total from the boarding quote', () => {
  const p = GT.tripPillText({ legs: [busLeg], leg: 0 }, 420, { lines, phase: 'waiting', wait: { wait: 9, ride: 225 } });
  assert.equal(p.time.zh, '车 9 秒后到 · 车程约 4 分钟');
  assert.equal(p.time.en, 'Bus in 9s · ride ~4 min');
  assert.match(p.title.zh, /^等观光巴士/);
  // the bus at the stop; a long wait in the banner's minutes (lane T's rule: ≥ 90 s)
  assert.equal(GT.waitRideLabel(0, 225, 'bus').zh, '车已到站 · 车程约 4 分钟');
  assert.equal(GT.waitRideLabel(180, 225, 'bus').zh, '车 3 分钟后到 · 车程约 4 分钟');
  assert.equal(GT.waitRideLabel(120, 300, 'ferry').zh, '船 120 秒后到 · 船程约 5 分钟', 'the ferry banner counts seconds');
  assert.equal(GT.waitRideLabel(30, 60, 'light-rail').en, 'Train in 30s · ride ~1 min');
  // no wait known: the old total
  assert.equal(GT.tripPillText({ legs: [busLeg], leg: 0 }, 420, { lines, phase: 'waiting' }).time.zh, '约 7 分钟');
});

test('W9-N2 the live wait: waiting, the line\'s live ETA (the banner\'s number), not the quote frozen when the wait began', () => {
  assert.equal(TPV.liveWaitLeft(() => ({ stage: 'waiting', waitLeft: 11 })), 11);
  assert.equal(TPV.liveWaitLeft(() => ({ stage: 'riding', waitLeft: 0 })), undefined);
  assert.equal(TPV.liveWaitLeft(() => ({ stage: 'waiting', waitLeft: NaN })), undefined);
  assert.equal(TPV.liveWaitLeft(() => { throw new Error('x'); }), undefined);
});

test('W9-N2 no "下一站 X" where X is: a walk to a stop is 去车站; within NEAR_R of the end 就在前面', () => {
  const ferry = { zh: '渡轮大厦', en: 'Ferry Building' };
  const toStop = GT.tripPillText({ legs: [walk({ x: 133, z: 10, station: 'loop-ferry-building', name: ferry })], leg: 0 }, 10);
  assert.equal(toStop.title.zh, '去车站 渡轮大厦');
  assert.equal(toStop.title.en, 'To the stop: Ferry Building');
  const near = GT.tripPillText({ legs: [walk({ x: 5, z: 5, name: { zh: '金门大桥', en: 'Golden Gate Bridge' } })], leg: 0 }, 9, { near: true });
  assert.equal(near.title.zh, '就在前面 金门大桥');
  const far = GT.tripPillText({ legs: [walk({ x: 500, z: 5, name: { zh: '金门大桥', en: 'Golden Gate Bridge' } })], leg: 0 }, 99);
  assert.equal(far.title.zh, '下一站 金门大桥');
  assert.ok(GT.NEAR_R >= 20 && GT.NEAR_R <= 30);
});

test('W9-N2 the shown ETA only goes down; a real detour rises once, after 3 s above the band, and says so (绕一下)', () => {
  let s = GC.smoothEta(null, 'k', 9, 0);
  assert.equal(s.shown, 9);
  // the review's GGB walk: 9 → 11 → 15 → 20 → 25 (raw) — jitter within the band holds, a lasting rise is a detour
  s = GC.smoothEta(s, 'k', 8, 1000); assert.equal(s.shown, 8);
  s = GC.smoothEta(s, 'k', 11, 2000); assert.equal(s.shown, 8, 'within 1.15 × + 3: held');
  s = GC.smoothEta(s, 'k', 25, 3000); assert.equal(s.shown, 8, 'a rise is not shown at once');
  s = GC.smoothEta(s, 'k', 25, 5900); assert.equal(s.shown, 8);
  s = GC.smoothEta(s, 'k', 25, 6000 + 100); assert.equal(s.shown, 25, 'after ETA_RISE_HOLD_MS: the longer way');
  assert.equal(s.detourAt, 6100);
  const shown = GC.shownEta('t', 'k1', 40, 0);
  assert.deepEqual(shown, { seconds: 40, detour: false });
  GC.shownEta('t', 'k1', 90, 100);
  const later = GC.shownEta('t', 'k1', 90, 100 + GC.ETA_RISE_HOLD_MS);
  assert.deepEqual(later, { seconds: 90, detour: true });
  assert.equal(GC.shownEta('t', 'k1', 85, 100 + GC.ETA_RISE_HOLD_MS + GC.ETA_DETOUR_MS + 1).detour, false, 'said for ETA_DETOUR_MS');
  // a new leg starts afresh (a higher number is no detour there)
  assert.deepEqual(GC.shownEta('t', 'k2', 300, 99999), { seconds: 300, detour: false });
  // the pill words for a detour
  assert.equal(GT.tripPillText({ legs: [walk({ x: 500, z: 5 })], leg: 0 }, 40, { detour: true }).time.zh, '绕一下 · 约 40 秒');
});

test('W9-N2 refine: the A*\'s route replaces a walk leg\'s estimate in place (no event, the leg index kept)', () => {
  const leg = walk({ x: 30, z: 0 });
  const t = TR.tripReducer(null, { type: 'start', placeId: 'p', option: { mode: 'walk', legs: [{ ...leg, estimate: true }], seconds: 10 }, now: 1, source: 'tour' })!;
  const path = [0, 0, 100, 0, 100, 50, 30, 0];
  const r = TR.tripReducer(t, { type: 'refine', leg: 0, patch: { path, length: 259, seconds: 50 } })!;
  assert.equal(r.leg, 0);
  assert.equal(r.legs[0].length, 259);
  assert.equal(r.legs[0].estimate, false);
  assert.deepEqual(r.legs[0].path, path);
  assert.equal(r.option.seconds, 50);
  assert.deepEqual(TR.tripEvents(t, r, { type: 'refine', leg: 0, patch: { length: 259, seconds: 50 } }), []);
  // another leg's answer (late): ignored
  assert.equal(TR.tripReducer(r, { type: 'refine', leg: 1, patch: { length: 1, seconds: 1 } }), r);
  // the remaining path counts from where the player is (guideCity legSecondsLeft → routeRemaining)
  const left = GC.legSecondsLeft(r.legs[0], { x: 100, z: 25 });
  assert.ok(left > 100 / 4.2 && left < 125 / 4.2, `${left.toFixed(1)} s along the rest of the path (25 + 86 u)`);
});
