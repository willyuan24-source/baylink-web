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

test('G1-8 time: the auto-walk runs beyond 30 u (so a long 带我去 takes far less than walking it), labels unchanged', async () => {
  const { autoWalkSeconds, gameTimeLabel, secondsLabel, AUTO_RUN_LEFT } = await import('../src/opus-bay/game/travel');
  const { RUN_SPEED, WALK_SPEED } = await import('../src/opus-bay/actors/controller');
  assert.equal(autoWalkSeconds(0), 0);
  assert.ok(Math.abs(autoWalkSeconds(21) - 21 / WALK_SPEED) < 1e-9, 'short: walking pace');
  const L = 280;
  const s = autoWalkSeconds(L);
  assert.ok(s < L / WALK_SPEED && s > (L - AUTO_RUN_LEFT) / RUN_SPEED + AUTO_RUN_LEFT / WALK_SPEED, `${s.toFixed(1)} s`);
  // measured in the game on 2026-09-27: Ferry gate → Dragon Gate (the map said "~40s") arrived after 39.7 s
  assert.ok(Math.abs(s - 40.1) < 1, `${s.toFixed(1)} s`);
  let prev = 0;
  for (let d = 1; d < 3000; d += 7) { const t = autoWalkSeconds(d); assert.ok(t > prev, `monotonic at ${d}`); prev = t; }
  // the old walking labels are the same text through the shared rounding
  for (const d of [3, 30, 84, 90, 251, 400, 2600]) assert.deepEqual(gameTimeLabel(d), secondsLabel(d / WALK_SPEED));
  assert.deepEqual(secondsLabel(40.1), { zh: '约 40 秒', en: '~40s' });
  assert.deepEqual(secondsLabel(151), { zh: '约 3 分钟', en: '~3 min' });
});

test('G1-8 route: what is left ahead of the player, the honest label, the real km along the route', async () => {
  const { routeAhead, routeMeasure, routeTravelLabel } = await import('../src/opus-bay/game/travel');
  const route = [{ x: 0, z: 0 }, { x: 100, z: 0 }, { x: 100, z: 100 }];
  const all = routeAhead(route, { x: -3, z: 0 });
  assert.equal(all.length, 200);
  assert.equal(all.off, 3);
  const mid = routeAhead(route, { x: 100, z: 40 });
  assert.deepEqual(mid.points, [{ x: 100, z: 40 }, { x: 100, z: 100 }]);
  assert.equal(mid.length, 60);
  const offRoute = routeAhead(route, { x: 50, z: 30 });
  assert.equal(offRoute.off, 30, 'far off: from where the route comes nearest (the first leg on a tie)');
  assert.deepEqual(offRoute.points[0], { x: 50, z: 0 });
  // a loop back past the start: the earliest segment wins a tie
  const loop = routeAhead([{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 10 }, { x: 0, z: 10 }, { x: 0, z: 0.0001 }], { x: 0, z: 0 });
  assert.ok(loop.length > 39);
  assert.deepEqual(routeTravelLabel([{ x: 0, z: 0 }, { x: 1, z: 1 }]), { zh: '就在这', en: 'right here' });
  const m = routeMeasure(route);
  assert.equal(m.length, 200);
  assert.ok(m.km > 0.5 && m.km < 5, `${m.km} km for 200 u`);
  const label = routeTravelLabel(route);
  assert.match(label.zh, /^沿路走约 \d+ 秒 · 现实约 /);
  assert.match(label.en, /on foot · .* for real$/);
});

test('G1-8 planner: one plan at a time, kept plans serve the map again, the waypoint reads what is left', async () => {
  const { cachedRoute, offRoute, planRoute, routeLeftTo, REPLAN_U } = await import('../src/opus-bay/game/mapRoute');
  const calls: string[] = [];
  const slow = (from: { x: number; z: number }, to: { x: number; z: number }, signal: { aborted: boolean }) => new Promise<{ points: { x: number; z: number }[]; length: number; snapped: boolean } | null>(resolve => {
    calls.push(`${to.x}`);
    setTimeout(() => resolve(signal.aborted ? null : { points: [from, { x: to.x, z: from.z }, to], length: Math.abs(to.x - from.x) + Math.abs(to.z - from.z), snapped: false }), 20);
  });
  const from = { x: 1000, z: 1000 };
  const first = planRoute(from, { x: 1100, z: 1050 }, slow);
  const second = planRoute(from, { x: 1200, z: 1050 }, slow);
  assert.equal(await first, undefined, 'superseded');
  const r = await second;
  assert.ok(r && r.length === 250);
  assert.equal(cachedRoute({ x: 1000 + REPLAN_U - 1, z: 1000 }, { x: 1200, z: 1050 }), r, 'kept while you stay near its start');
  // G1-review: walking the route keeps the one plan (no re-plan every 20 u); leaving it plans again
  assert.equal(cachedRoute({ x: 1150, z: 1004 }, { x: 1200, z: 1050 }), r, 'kept while you walk along it');
  assert.equal(cachedRoute({ x: 1195, z: 1030 }, { x: 1200, z: 1050 }), r, 'kept round the corner');
  assert.equal(cachedRoute({ x: 1100, z: 1000 + REPLAN_U + 1 }, { x: 1200, z: 1050 }), null, 'off the route');
  assert.equal(cachedRoute({ x: 1000 - REPLAN_U - 1, z: 1000 }, { x: 1200, z: 1050 }), null, 'behind its start');
  assert.equal(offRoute(r!, { x: 1100, z: 1000 + REPLAN_U - 1 }), false);
  assert.equal(offRoute(r!, { x: 1100, z: 1000 + REPLAN_U + 1 }), true);
  const again = await planRoute({ x: 1002, z: 1001 }, { x: 1200, z: 1050 }, slow);
  assert.equal(again, r);
  assert.deepEqual(calls, ['1100', '1200'], 'no new search for a kept plan');
  assert.equal(await planRoute(from, { x: 1300, z: 1000 }, async () => null), null, 'no way there');
  // the in-world waypoint: 200 u along the first leg, 50 u down the second
  assert.equal(routeLeftTo({ x: 1200, z: 1050 }, { x: 1100, z: 1000 }), 150);
  assert.equal(routeLeftTo({ x: 1200, z: 1050 }, { x: 1100, z: 1040 }), null, 'more than 25 u off the route');
  assert.equal(routeLeftTo({ x: 5, z: 5 }, from), null);
});

test('E2 w3 part b request 1: a city arrival lands in a large open area (never a pocket or a slot between house rows); district unchanged', async () => {
  const { arrivalSpot, OPEN_ARRIVAL_R } = await import('../src/opus-bay/game/fastTravel');
  const nav = await import('../src/opus-bay/actors/nav');
  const { canStand, setCityTerrain } = await import('../src/opus-bay/core/terrain');
  const { createCityTerrain, landmarkWalkInputs } = await import('../src/opus-bay/core/sfTerrain');
  const { SF_LANDMARKS } = await import('../src/opus-bay/world/sf/landmarks/index');
  const { sfDisk } = await import('./opus-bay-sf-disk');
  assert.equal(OPEN_ARRIVAL_R, 30);
  // district (no city terrain): the open-area rule is never asked
  let asked = 0;
  const spy = (p: { x: number; z: number }, r: number) => { asked++; return nav.arrivalSpot(p, r); };
  const d = arrivalSpot({ x: 0, z: 0 }, spy);
  assert.equal(asked, 0);
  assert.ok(Number.isFinite(d.x) && Number.isFinite(d.z));
  // the city around (0, 420) (Western Addition: house rows with sealed backyards)
  const sf = sfDisk();
  const LMS = landmarkWalkInputs(SF_LANDMARKS);
  const city = createCityTerrain(sf.manifest, { landmarks: LMS });
  city.setFar(await sf.far());
  await sf.attachAround(city, 0, 420, 250, LMS);
  setCityTerrain(city, { heroDropLots: new Set(sf.manifest.heroDropLots) });
  try {
    const start = nav.arrivalSpot({ x: 0, z: 420 }, 20)!;
    assert.ok(start && canStand(start.x, start.z, 0.4));
    // sealed pockets: small walkable regions (backyards, slots between rows) the old rule kept you in (canStand = true)
    const g = nav.navGrid();
    const at = (i: number) => ({ x: g.minX + ((i % g.cols) + 0.5) * g.cell, z: g.minZ + (Math.floor(i / g.cols) + 0.5) * g.cell });
    const seen = new Uint8Array(g.cols * g.rows), pockets: { x: number; z: number }[] = [];
    for (let s0 = 0; s0 < seen.length && pockets.length < 12; s0++) {
      if (seen[s0] || g.walkable[s0] !== 1) continue;
      const st = [s0], cells = [s0]; seen[s0] = 1;
      while (st.length) {
        const u = st.pop()!, c = u % g.cols;
        for (const v of [c > 0 ? u - 1 : -1, c < g.cols - 1 ? u + 1 : -1, u - g.cols, u + g.cols]) if (v >= 0 && v < seen.length && !seen[v] && g.walkable[v] === 1) { seen[v] = 1; st.push(v); cells.push(v); }
      }
      const p = at(cells[0]);
      if (cells.length >= 4 && cells.length < 60 && Math.hypot(p.x - start.x, p.z - start.z) < 120 && canStand(p.x, p.z)) pockets.push(p);
    }
    assert.ok(pockets.length >= 5, `standable pockets near (0, 420): ${pockets.length}`);
    let moved = 0;
    for (const p of pockets) {
      const s = arrivalSpot(p);
      const open = nav.arrivalSpot(p, OPEN_ARRIVAL_R);
      if (open) { assert.deepEqual(s, open, 'the open-area spot first'); moved++; } else assert.deepEqual(s, p, 'no open area within 30 u: the spot itself');
      assert.ok(Math.hypot(s.x - p.x, s.z - p.z) <= OPEN_ARRIVAL_R + g.cell, 'moves at most 30 u');
      assert.ok(canStand(s.x, s.z));
      if (open) assert.ok(nav.findPath(start, s, 1), 'lands where the street network reaches');
    }
    assert.ok(moved >= 5, `pockets left for an open area: ${moved}`);
  } finally { setCityTerrain(null); }
});

test('fly to a discovered station (wave 4, lane P): the planner offers the pelican to a station once found, never before; the trip ends at its pole / kiosk', async () => {
  const fsx = await import('node:fs'), pathx = await import('node:path');
  const { sfDisk } = await import('./opus-bay-sf-disk');
  const { stationRows } = await import('../src/opus-bay/data/sf/stationPlaces');
  const { w4Of } = await import('../src/opus-bay/data/sf/mapTransit');
  const { buildTransit } = await import('../src/opus-bay/data/transit');
  const { mapLinesFrom, mapStations } = await import('../src/opus-bay/ui/mapLines');
  const { planTrips } = await import('../src/opus-bay/game/tripPlan');
  const sf = sfDisk();
  const file = JSON.parse(fsx.readFileSync(pathx.join(sf.base, 'transit.json'), 'utf8'));
  const w4 = w4Of(file).lines.length ? w4Of(file) : w4Of(JSON.parse(fsx.readFileSync(pathx.join(sf.base, 'transit-w4.json'), 'utf8')));
  const rows = stationRows(mapStations(mapLinesFrom(buildTransit(file), file.lines.find((l: { id: string }) => l.id === 'f-line'), w4.lines)), w4.props, new Set(), '2026-09-27');
  const castro = rows.find(r => r.id === 'muni-castro')!;
  const at = castro.arrival ?? castro;
  const dest = { placeId: castro.id, x: at.x, z: at.z, name: castro.name };
  const from = { x: 133, z: 10 };
  assert.ok(!planTrips(from, dest, { discovered: () => false }).some(o => o.mode === 'fly'), 'not before');
  const fly = planTrips(from, dest, { discovered: id => id === 'muni-castro' }).find(o => o.mode === 'fly');
  assert.ok(fly, 'the pelican once found');
  const leg = fly!.legs[0];
  assert.equal(leg.via, 'fly');
  assert.deepEqual([leg.to.x, leg.to.z], [at.x, at.z], 'lands at the kiosk');
});
