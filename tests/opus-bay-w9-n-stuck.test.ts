import assert from 'node:assert/strict';
import test from 'node:test';

/**
 * Wave 9 · lane N · W9-N1 (review R§5 #7 "带路和一日游会卡住，而且没有真正的兜底"): the carried walk's watchdog, the
 * player's own escape from a stuck spot (not a takeover), the rescue's choice (a short way delivered, a long one the
 * stuck card), the 换条路 detour spot, and the Grand Tour's resume chapter (R§6 growth row: one less at every boundary).
 * Red before the fix: autoStep had no `stall` give-up (a carried player who never moved stayed "carried" for ever:
 * gapfill/tour-full log 327 → 649 s), the stick in a stuck spot was a takeover (the tour's carrying off for good:
 * gapfill/tour2 chip-293 … chip-651), and the resume label said 第 1 章 at the start of chapter 2.
 */

const AT = await import('../src/opus-bay/game/autoTravel');
type AIn = import('../src/opus-bay/game/autoTravel').AutoInput;
const base = (over: Partial<AIn> = {}): AIn => ({ now: 1000, manualAt: -Infinity, pathTarget: null, player: { x: 0, z: 0 }, want: { p: { x: 100, z: 0 }, r: 2.5 }, blocked: false, legKey: 'L0', ...over });

test('W9-N1 watchdog: a carried player who does not move for AUTO_STALL_MS is given up (stall) — the controller still "walking"', () => {
  let r = AT.autoStep({ ...AT.AUTO_IDLE, on: true }, base());
  const ours = r.state.issued!;
  // the controller keeps our target (it waits for a route that never comes): no fails are counted, nothing moves
  for (let t = 1000; t < 1000 + AT.AUTO_STALL_MS; t += 100) {
    r = AT.autoStep(r.state, base({ now: t, pathTarget: ours }));
    assert.equal(r.decision.type, 'none', `still waiting at ${t}`);
  }
  r = AT.autoStep(r.state, base({ now: 1000 + AT.AUTO_STALL_MS, pathTarget: ours }));
  assert.deepEqual(r.decision, { type: 'giveup', why: 'stall' });
  assert.equal(r.state.on, false);
});

test('W9-N1 watchdog: a detour that first leads away still counts as progress; the clock stops while blocked or yielding', () => {
  let r = AT.autoStep({ ...AT.AUTO_IDLE, on: true }, base());
  const ours = r.state.issued!;
  // walking away from the target (the GGB stop's way round: 33 u → 113 u straight before it closes in) for 40 s
  for (let k = 1; k <= 400; k++) {
    r = AT.autoStep(r.state, base({ now: 1000 + k * 100, pathTarget: ours, player: { x: -k * 0.4, z: 0 } }));
    assert.equal(r.decision.type, 'none');
  }
  // a dialogue for 60 s: no give-up, and none right after it either
  const at = r.state;
  let b = AT.autoStep(at, base({ now: 50000, pathTarget: ours, player: { x: -160, z: 0 }, blocked: true }));
  b = AT.autoStep(b.state, base({ now: 110000, pathTarget: ours, player: { x: -160, z: 0 }, blocked: true }));
  assert.equal(AT.autoStep(b.state, base({ now: 110100, pathTarget: ours, player: { x: -160, z: 0 } })).decision.type, 'none');
});

test('W9-N1 escape: the stick in a stuck spot is the player getting out, not a takeover — BAYBAY carries on once they let go', () => {
  let r = AT.autoStep({ ...AT.AUTO_IDLE, on: true }, base());
  const ours = r.state.issued!;
  // stuck: no progress for AUTO_STUCK_MS
  r = AT.autoStep(r.state, base({ now: 1100, pathTarget: ours }));
  r = AT.autoStep(r.state, base({ now: 1000 + AT.AUTO_STUCK_MS + 100, pathTarget: ours }));
  assert.equal(r.decision.type, 'none');
  const esc = AT.autoStep(r.state, base({ now: 1000 + AT.AUTO_STUCK_MS + 200, manualAt: 1000 + AT.AUTO_STUCK_MS + 150, pathTarget: null, player: { x: 1, z: 0 } }));
  assert.deepEqual(esc.decision, { type: 'escape' });
  assert.equal(esc.state.on, true, 'still carried');
  assert.equal(esc.state.escaping, true);
  // while the stick is held (or just let go): nothing
  const t1 = 1000 + AT.AUTO_STUCK_MS + 600;
  assert.equal(AT.autoStep(esc.state, base({ now: t1, manualAt: t1 - 50, player: { x: 3, z: 2 } })).decision.type, 'none');
  // let go AUTO_ESCAPE_IDLE_MS: the leg's target again, the fails and the watchdog afresh
  const on = AT.autoStep(esc.state, base({ now: t1 + AT.AUTO_ESCAPE_IDLE_MS, manualAt: t1 - 50, player: { x: 3, z: 2 } }));
  assert.equal(on.decision.type, 'issue');
  assert.equal(on.state.escaping, false);
  assert.equal(on.state.fails, 0);
  // the same stick on a walk that was going fine is a takeover, as ever (W5-N3)
  const fine = AT.autoStep({ ...AT.AUTO_IDLE, on: true }, base());
  assert.deepEqual(AT.autoStep(fine.state, base({ now: 1200, manualAt: 1150, player: { x: 10, z: 0 } })).decision, { type: 'takeover' });
  // after a failed re-issue the walk counts as stuck at once
  const failed = { ...fine.state, fails: 1, issuedAt: 1300 };
  assert.deepEqual(AT.autoStep(failed, base({ now: 1400, manualAt: 1350, pathTarget: null })).decision, { type: 'escape' });
});

test('W9-N1 the end reason: the Grand Tour turns carrying off only for a takeover', () => {
  AT.autoBegin();
  assert.equal(AT.autoEndReason(), null);
  AT.noteAutoEnd('giveup');
  assert.equal(AT.autoEndReason(), 'giveup');
  AT.autoBegin();
  assert.equal(AT.autoEndReason(), null, 'carrying again clears it');
  AT.noteAutoEnd('takeover');
  assert.equal(AT.autoEndReason(), 'takeover');
  AT.autoEnd();
});

const TR = await import('../src/opus-bay/game/tripRun');

test('W9-N1 rescue: within DELIVER_R the blocked way is delivered (the GGB vista 31 u, Sutro 9 u), beyond it the stuck card', () => {
  assert.equal(TR.rescueKind({ x: -684.1, z: 630.7 }, { x: -700.86, z: 604.59 }), 'deliver', 'the Golden Gate stop → the Welcome Center');
  assert.equal(TR.rescueKind({ x: -700.7, z: 1229.1 }, { x: -706, z: 1222 }), 'deliver');
  assert.equal(TR.rescueKind({ x: 0, z: 0 }, { x: TR.DELIVER_R + 1, z: 0 }), 'card');
  assert.equal(TR.STUCK_LINE.zh, '这段路被挡住了，我们怎么走？');
});

test('W9-N1 换条路: the detour spot is standable, on a ring round the player, nearest the target among those with a way both sides', () => {
  const player = { x: 0, z: 0 }, target = { x: 50, z: 0 };
  // a wall east of the player (x in 2..6, |z| < 12): no straight way; north / south round it
  const wall = (p: { x: number; z: number }) => p.x > 2 && p.x < 6 && Math.abs(p.z) < 12;
  const stand = (p: { x: number; z: number }) => !wall(p);
  const crosses = (a: { x: number; z: number }, b: { x: number; z: number }) => { for (let k = 0; k <= 40; k++) { const t = k / 40; if (wall({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t })) return true; } return false; };
  const spot = TR.detourSpot(player, target, stand, (a, b) => !crosses(a, b))!;
  assert.ok(spot, 'a spot');
  assert.ok(stand(spot) && !crosses(player, spot) && !crosses(spot, target));
  const r = Math.hypot(spot.x, spot.z);
  assert.ok(TR.DETOUR_RINGS.some(k => Math.abs(k - r) < 1e-6), `on a ring (${r.toFixed(2)})`);
  // nothing passes: null (the runner then delivers)
  assert.equal(TR.detourSpot(player, target, stand, () => false), null);
  // the path checks are bounded
  let calls = 0;
  TR.detourSpot(player, target, () => true, () => { calls++; return false; });
  assert.ok(calls <= TR.DETOUR_CHECKS * 2, `${calls} path checks`);
});

const tours = await import('../src/opus-bay/data/sf/tours');
const CT = await import('../src/opus-bay/game/cityTour');

test('W9-N3 resume chapter: a chapter whose last stop was just reached resumes at the next chapter (was one less)', () => {
  const def = tours.SF_GRAND;
  const stops = tours.tourStops(def);
  // chapter 1 (海湾) done: bay-start, bay-ride-ggb, bay-vista; the run still points at bay-vista (the dwell)
  const done = def.chapters[0].stops.filter(s => !s.optional).map(s => s.id);
  const i = stops.findIndex(f => f.stop.id === 'bay-vista');
  const k = CT.resumeIndex(stops, i, done);
  assert.equal(stops[k].chapter, 1, 'chapter 2 (海岸)');
  assert.equal(stops[k].stop.id, 'coast-ride-lands-end');
  // in the middle of a chapter: the stop being led to
  assert.equal(CT.resumeIndex(stops, 1, ['bay-start']), 1);
  // all done: the last stop (never out of range)
  assert.equal(CT.resumeIndex(stops, stops.length - 1, stops.map(f => f.stop.id)), stops.length - 1);
  // the label for that save: 第 2 章
  assert.equal(tours.tourResumeLabel(def, { chapter: stops[k].chapter, stop: 0, completed: done }).zh, '继续一日游 · 第 2 章');
});

// ---------------------------------------------------------------------------------------------------------------
// The tour's bus drop-offs on the real San Francisco (review R§5 #7: the Golden Gate viewpoint and Lands End legs
// stalled; Ocean Beach the third loop drop-off of the coast): each reaches its stop within 2× the quote — walked
// (the A*'s route at the carried pace) or, for a short way that walks far round, delivered at once under the veil.
// ---------------------------------------------------------------------------------------------------------------

const { setCityTerrain } = await import('../src/opus-bay/core/terrain');
const { createCityTerrain, landmarkWalkInputs } = await import('../src/opus-bay/core/sfTerrain');
const { routeTo, setWalkGraph } = await import('../src/opus-bay/actors/nav');
const { SF_LANDMARKS } = await import('../src/opus-bay/world/sf/landmarks/index');
const { sfDisk } = await import('./opus-bay-sf-disk');
const { buildTransitW4, boardAt } = await import('../src/opus-bay/data/transit');
const LR = await import('../src/opus-bay/game/lineRides');
const { tourStopOption } = await import('../src/opus-bay/game/tourTrips');
const { autoTravelSeconds } = await import('../src/opus-bay/game/tripPlan');
const fs = await import('node:fs');

test('W9-N1 the Golden Gate, Lands End and Ocean Beach drop-offs reach the next tour stop within 2× the quote (Bay clock not involved: pure geometry)', async () => {
  const sf = sfDisk();
  const LMS = landmarkWalkInputs(SF_LANDMARKS);
  const city = createCityTerrain(sf.manifest, { landmarks: LMS });
  city.setFar(await sf.far());
  const w4 = buildTransitW4(JSON.parse(fs.readFileSync('public/opus-bay/sf/v1/transit.json', 'utf8')))!;
  const legs: [string, string][] = [['loop-golden-gate-bridge', 'bay-vista'], ['loop-lands-end-sutro', 'coast-sutro'], ['loop-ocean-beach-windmill', 'coast-windmill']];
  const stopOf = (id: string) => tours.SF_GRAND.chapters.flatMap(c => c.stops).find(s => s.id === id)!;
  for (const [pole] of legs) { const st = w4.loop.stops.find(s => s.id === pole)!; const at = boardAt(w4, st); await sf.attachAround(city, at.x, at.z, 260, LMS); }
  setCityTerrain(city, { heroDropLots: new Set(sf.manifest.heroDropLots) });
  setWalkGraph(await sf.graphIndex());
  try {
    for (const [pole, stopId] of legs) {
      const st = w4.loop.stops.find(s => s.id === pole)!;
      const drop = LR.roomySpot(w4.loop.path, LR.clearOfPath(w4.loop.path, boardAt(w4, st)));
      const option = tourStopOption(stopOf(stopId), drop)!;
      const leg = option.legs[0];
      const quote = option.seconds;
      const route = await routeTo(drop, leg.to, { schedule: fn => setImmediate(fn) });
      const straight = Math.hypot(leg.to.x - drop.x, leg.to.z - drop.z);
      const delivered = TR.deliverAtOnce(straight, route ? route.length : null);
      const took = delivered ? 1.5 : autoTravelSeconds(route!.length);
      assert.ok(took <= 2 * quote, `${stopId}: ${took.toFixed(1)} s vs the quote ${quote.toFixed(1)} s (straight ${straight.toFixed(0)} u, route ${route ? route.length.toFixed(0) : 'none'} u${delivered ? ', delivered' : ''})`);
    }
    // the Golden Gate stop's way round the cliff (≈ 259 u for 30 u straight) is the one delivered
    const ggb = w4.loop.stops.find(s => s.id === 'loop-golden-gate-bridge')!;
    const d0 = LR.roomySpot(w4.loop.path, LR.clearOfPath(w4.loop.path, boardAt(w4, ggb)));
    const to = tourStopOption(stopOf('bay-vista'), d0)!.legs[0].to;
    const r0 = await routeTo(d0, to, { schedule: fn => setImmediate(fn) });
    assert.equal(TR.deliverAtOnce(Math.hypot(to.x - d0.x, to.z - d0.z), r0 ? r0.length : null), true);
  } finally { setCityTerrain(null); setWalkGraph(null); }
});

test('W9-N1 deliverAtOnce / roomySpot (pure)', () => {
  assert.equal(TR.deliverAtOnce(30, 259), true, 'the cliff');
  assert.equal(TR.deliverAtOnce(24, 47), false, 'Lands End: a fair way round');
  assert.equal(TR.deliverAtOnce(30, null), true, 'no way at all');
  assert.equal(TR.deliverAtOnce(30, undefined), false, 'not known yet: walk');
  assert.equal(TR.deliverAtOnce(TR.SHORT_LEG_R + 1, 9999), false, 'long legs walk (the watchdog and the card cover them)');
  // roomySpot: the spot itself with room; else the nearest roomy point off the line
  const path = [0, 0, -50, 0, 0, 50];
  const free = () => true;
  assert.deepEqual(LR.roomySpot(path, { x: 3, z: 0 }, free), { x: 3, z: 0 });
  const tight = (x: number, z: number, r: number) => r < 0.5 || x > 4;
  const q = LR.roomySpot(path, { x: 3, z: 0 }, tight);
  assert.ok(q.x > 4 && Math.abs(q.x) >= LR.PATH_CLEAR, `moved off the corner (${q.x.toFixed(2)}, ${q.z.toFixed(2)})`);
  assert.deepEqual(LR.roomySpot(path, { x: 3, z: 0 }, () => false), { x: 3, z: 0 }, 'nowhere roomy: the spot');
});
