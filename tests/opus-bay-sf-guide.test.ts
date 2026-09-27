import assert from 'node:assert/strict';
import test from 'node:test';
import { REVEAL, RevealClock, photoPose, planReveal, revealAllowed, revealPose, revealShots } from '../src/opus-bay/actors/reveal';
import { type TripLineInfo, planTrips } from '../src/opus-bay/game/tripPlan';
import type { TripLeg, TripState } from '../src/opus-bay/game/tripTypes';
import { ARRIVAL_CARD_MS, PILL_UNITS, arrivalToastText, fitText, legIcon, legLabel, textUnits, tripLegRows, tripPillText } from '../src/opus-bay/ui/guideText';

/**
 * Lane G (W4-G10 / W4-G3): the arrival reveal camera path (pure math) and the words of the trip pill, trip card and
 * arrival toast / card (plan §4.2).
 */

const near = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) <= eps;
const dist3 = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

// the Palace of Fine Arts' photo spec (data/sf/landmarks.ts) on a site at (−414, 4, 404), turned 0.6 rad
const PHOTO = { target: [0, 9, 0] as const, distance: 42, elevation: 0.12, bearing: 0.35 };
const SITE = { x: -414, y: 4, z: 404, yaw: 0.6 };

test('photo pose: the SoloView formula in the landmark frame, turned by the site yaw', () => {
  const flat = photoPose({ x: 0, y: 0, z: 0, yaw: 0 }, PHOTO);
  assert.deepEqual(flat.target, { x: 0, y: 9, z: 0 });
  assert.ok(near(flat.pos.x, Math.sin(0.35) * Math.cos(0.12) * 42) && near(flat.pos.y, 9 + Math.sin(0.12) * 42) && near(flat.pos.z, Math.cos(0.35) * Math.cos(0.12) * 42));
  const p = photoPose(SITE, PHOTO);
  assert.ok(near(dist3(p.pos, p.target), 42));
  assert.ok(near(p.target.x, SITE.x) && near(p.target.z, SITE.z) && near(p.target.y, 13));
  // turning the site by yaw turns the bearing by the same angle (world bearing = local bearing + yaw)
  assert.ok(near(Math.atan2(p.pos.x - p.target.x, p.pos.z - p.target.z), 0.35 + 0.6));
  // an off-centre target moves with the site's rotation (landmarkToWorld)
  const off = photoPose({ x: 0, y: 0, z: 0, yaw: Math.PI / 2 }, { ...PHOTO, target: [10, 0, 0] });
  assert.ok(near(off.target.x, 0, 1e-9) && near(off.target.z, -10, 1e-9));
});

test('the reveal plays only for the first on-foot arrival at a T1, never twice, not with reduced motion or quality low', () => {
  const ok = { tier: 1, onFoot: true, first: true, reducedMotion: false, quality: 'high' as const };
  assert.equal(revealAllowed(ok), true);
  assert.equal(revealAllowed({ ...ok, quality: 'mid' }), true);
  assert.equal(revealAllowed({ ...ok, tier: 2 }), false);
  assert.equal(revealAllowed({ ...ok, onFoot: false }), false);
  assert.equal(revealAllowed({ ...ok, first: false }), false);
  assert.equal(revealAllowed({ ...ok, reducedMotion: true }), false);
  assert.equal(revealAllowed({ ...ok, quality: 'low' }), false);
  assert.equal(revealAllowed({ ...ok, seen: true }), false);
});

const player = { x: -420, y: 4, z: 360 };
const start = { pos: { x: -420, y: 11, z: 350 }, target: { x: -420, y: 5.6, z: 362 } };

test('the path: 1.0 s swing → photo pose, 0.8 s hold with a 4 % push-in, 0.6 s back behind the player; 2.4 s in all', () => {
  const photo = photoPose(SITE, PHOTO);
  const plan = planReveal(start, photo, player);
  assert.equal(REVEAL.swing + REVEAL.hold + REVEAL.back, REVEAL.seconds);
  assert.equal(REVEAL.seconds, 2.4);
  const p0 = revealPose(plan, 0), p1 = revealPose(plan, REVEAL.swing), p2 = revealPose(plan, REVEAL.swing + REVEAL.hold), p3 = revealPose(plan, REVEAL.seconds);
  assert.ok(dist3(p0.pos, start.pos) < 1e-6 && dist3(p0.target, start.target) < 1e-6);
  assert.ok(dist3(p1.pos, photo.pos) < 1e-6 && dist3(p1.target, photo.target) < 1e-6);
  assert.ok(near(dist3(p2.pos, photo.target), 42 * (1 - REVEAL.push), 1e-6));
  assert.ok(dist3(p3.pos, plan.end.pos) < 1e-6);
  // the end: 11 u behind the player, looking past the player toward the landmark
  assert.ok(near(Math.hypot(plan.end.pos.x - player.x, plan.end.pos.z - player.z), REVEAL.followDist));
  const look = { x: plan.end.target.x - plan.end.pos.x, z: plan.end.target.z - plan.end.pos.z };
  const toLm = { x: photo.target.x - plan.end.pos.x, z: photo.target.z - plan.end.pos.z };
  const cos = (look.x * toLm.x + look.z * toLm.z) / (Math.hypot(look.x, look.z) * Math.hypot(toLm.x, toLm.z));
  assert.ok(cos > 0.999, `looks at the landmark (${cos})`);
});

test('smooth: no jump anywhere (phase boundaries included); the swing arcs round the landmark, never through it', () => {
  const photo = photoPose(SITE, PHOTO);
  const plan = planReveal(start, photo, player);
  const ra = Math.hypot(start.pos.x - photo.target.x, start.pos.z - photo.target.z), rb = Math.hypot(photo.pos.x - photo.target.x, photo.pos.z - photo.target.z);
  let prev = revealPose(plan, 0), maxStep = 0;
  for (let t = 1 / 120; t <= REVEAL.seconds + 1e-9; t += 1 / 120) {
    const p = revealPose(plan, t);
    maxStep = Math.max(maxStep, dist3(p.pos, prev.pos));
    if (t <= REVEAL.swing) {
      const r = Math.hypot(p.pos.x - photo.target.x, p.pos.z - photo.target.z);
      assert.ok(r >= Math.min(ra, rb) - 1e-6 && r <= Math.max(ra, rb) + 1e-6, `radius ${r} at ${t}`);
    }
    prev = p;
  }
  // a quick whoosh (≤ 360 u/s at its fastest here), never a cut
  assert.ok(maxStep < 3, `largest step per 1/120 s: ${maxStep}`);
  for (const tb of [REVEAL.swing, REVEAL.swing + REVEAL.hold]) {
    const a = revealPose(plan, tb - 1e-4), b = revealPose(plan, tb + 1e-4);
    assert.ok(dist3(a.pos, b.pos) < 0.05 && dist3(a.target, b.target) < 0.05, `continuous at ${tb}`);
  }
});

test('the camera keeps 2 u over the ground under it; the clock skips to the way back and ends at 2.4 s; the cinema shots', () => {
  const photo = photoPose(SITE, PHOTO);
  const high = planReveal(start, photo, player, () => 60);
  for (let t = 0; t <= REVEAL.seconds; t += 0.05) assert.ok(revealPose(high, t).pos.y >= 62 - 1e-9);
  const c = new RevealClock(planReveal(start, photo, player));
  c.step(0.3);
  assert.equal(c.done, false);
  c.skip();
  assert.ok(near(c.t, REVEAL.swing + REVEAL.hold));
  for (let i = 0; i < 40; i++) c.step(1 / 60);
  assert.equal(c.done, true);
  assert.ok(dist3(c.pose.pos, c.plan.end.pos) < 1e-6);
  const shots = revealShots(c.plan);
  assert.equal(shots.length, 4);
  assert.ok(near(shots.reduce((s, x) => s + x.duration + (x.hold ?? 0), 0), REVEAL.seconds));
  assert.deepEqual(shots[3].position, [c.plan.end.pos.x, c.plan.end.pos.y, c.plan.end.pos.z]);
});

// ---------------------------------------------------------------------------------------------------------------
// words
// ---------------------------------------------------------------------------------------------------------------

const N: TripLineInfo = {
  id: 'n-judah', kind: 'light-rail', name: { zh: 'N 线', en: 'N Judah' }, short: 'N', length: 1580,
  stops: [
    { id: 'carl-cole', at: 804, x: -20, z: 834, name: { zh: '海特区', en: 'Carl & Cole' }, major: true },
    { id: 'la-playa', at: 1568, x: -465, z: 1417, name: { zh: '海洋海滩', en: 'Judah & La Playa' }, major: true },
  ],
};
const lines = new Map([[N.id, N]]);
const opt = planTrips({ x: -30, z: 820 }, { placeId: 'ocean-beach', x: -480, z: 1440, name: { zh: '海洋海滩', en: 'Ocean Beach' } }, { lines: () => [N] }).find(o => o.mode === 'line')!;
const trip: TripState = { placeId: 'ocean-beach', option: opt, legs: opt.legs, leg: 1, startedAt: 0 };

test('text units and fitting: CJK 1, Latin 0.55; cut with …', () => {
  assert.equal(textUnits('海洋海滩'), 4);
  assert.ok(near(textUnits('N 线'), 2.1));
  assert.equal(fitText('海洋海滩', 5), '海洋海滩');
  const cut = fitText('旧金山州立大学学生中心的草坪', 8);
  assert.ok(cut.endsWith('…') && textUnits(cut) <= 8);
});

test('trip pill: "下一站 名称 · 约 N 分钟", ≤ 16 CJK on phones, the leg step, waiting at the stop', () => {
  const t = tripPillText(trip, 118, { lines, compact: true, phase: 'riding' });
  assert.equal(t.icon, 'metro');
  assert.equal(t.title.zh, '下一站 海洋海滩');
  assert.equal(t.title.en, 'Next: Judah & La Playa');
  assert.deepEqual(t.time, { zh: '约 2 分钟', en: '~2 min' });
  assert.equal(t.step, '2/3');
  const wait = tripPillText({ ...trip, leg: 1 }, 118, { lines, compact: true, phase: 'waiting' });
  assert.equal(wait.title.zh, '等 N 线 · 海特区');
  // a long name is fitted so the whole pill (title + " · " + time) stays within 16 units on phones
  const longLegs: TripLeg[] = [{ via: 'walk', from: { x: 0, z: 0 }, to: { x: 1, z: 1, name: { zh: '旧金山州立大学学生中心草坪', en: 'SF State quad' } }, seconds: 300, length: 1260 }];
  const long = tripPillText({ legs: longLegs, leg: 0 }, 300, { compact: true });
  assert.ok(textUnits(long.title.zh) + 1.5 + textUnits(long.time.zh) <= PILL_UNITS.phone + 1e-9, long.title.zh);
  assert.ok(long.title.zh.endsWith('…'));
  assert.equal(long.step, null);
  assert.equal(tripPillText({ legs: longLegs, leg: 0 }, 300, { compact: false }).title.zh.endsWith('…'), false);
});

test('trip card rows: icons, words, times, done / now / next, the wait line; icons per line kind', () => {
  const rows = tripLegRows(trip, lines);
  assert.deepEqual(rows.map(r => r.state), ['done', 'now', 'next']);
  assert.deepEqual(rows.map(r => r.icon), ['walk', 'metro', 'walk']);
  assert.ok(/^坐 N 线 \d+ 站到海洋海滩$/.test(rows[1].label.zh), rows[1].label.zh);
  assert.ok(rows[1].wait && /等车/.test(rows[1].wait.zh));
  assert.equal(legIcon({ via: 'line', line: 'x' }, new Map([['x', { kind: 'bus' as const }]])), 'bus');
  assert.equal(legIcon({ via: 'line', line: 'c' }, new Map([['c', { kind: 'cable-car' as const }]])), 'cable-car');
  assert.equal(legIcon({ via: 'fly' }), 'fly');
  // a leg without the planner's label gets one here
  const bare: TripLeg = { via: 'bike', vehicle: 'b', from: { x: 0, z: 0 }, to: { x: 5, z: 5, name: { zh: '艺术宫', en: 'Palace of Fine Arts' } }, seconds: 40, length: 200 };
  assert.deepEqual(legLabel(bare), { zh: '骑车到艺术宫', en: 'Bike to Palace of Fine Arts' });
});

test('arrival words: "抵达 · 名称" (the English name under it in zh), quiet places "到了 · …"; the card stays 6 s', () => {
  assert.deepEqual(arrivalToastText({ zh: '艺术宫', en: 'Palace of Fine Arts' }), { zh: '抵达 · 艺术宫', en: 'Arrived · Palace of Fine Arts' });
  assert.deepEqual(arrivalToastText({ zh: '圣依纳爵堂', en: 'St Ignatius Church' }, true), { zh: '到了 · 圣依纳爵堂', en: 'Here: St Ignatius Church' });
  assert.equal(ARRIVAL_CARD_MS, 6000);
});

test('Settings › 显示地标旗: off by default, remembered for this visit without storage, listeners hear the change', async () => {
  const { landmarkFlagsPref, setLandmarkFlagsPref, subscribeLandmarkFlags } = await import('../src/opus-bay/game/guidePrefs');
  assert.equal(landmarkFlagsPref(), false);
  let heard = 0;
  const off = subscribeLandmarkFlags(() => { heard++; });
  setLandmarkFlagsPref(true);
  assert.equal(landmarkFlagsPref(), true);
  assert.equal(heard, 1);
  off();
  setLandmarkFlagsPref(false);
  assert.equal(heard, 1);
});
