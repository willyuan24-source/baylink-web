import assert from 'node:assert/strict';
import test from 'node:test';

/**
 * Wave 8 · lane A · the toy Alcatraz ferry (Pier 33 ⇄ the island's dock) and the island on foot: the timetable on a
 * pinned Bay clock, the shuttle (astern out of the slip, the pivot, the give-way crossing, ≈ 90 s out), the paths over
 * open water clear of the piers and the island, the ride through game/transit.ts (the deckhand, the deck, the count),
 * the quiet night line, the island rider always fetched, the hop-off brake; the island's walk (the quay to the
 * cellhouse front on the published city) and its own walking graph. The district ferry (Ferry Building ⇄ Pier 41) is
 * unchanged.
 */

// --- headless canvas stub (world modules create label atlases at import time) ---
const g = globalThis as unknown as Record<string, unknown>;
const noop = () => undefined;
const ctx2d = new Proxy({}, {
  get: (_t, k) => (k === 'measureText' ? () => ({ width: 10 }) : k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop: noop }) : k === 'getImageData' ? (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }) : noop),
  set: () => true,
});
g.window ??= globalThis;
g.document ??= { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => ctx2d }) };

const D = await import('../src/opus-bay/data/ferry');
const T = await import('../src/opus-bay/data/transit');
const A = await import('../src/opus-bay/world/sf/alcatrazFerrySystem');
const W = await import('../src/opus-bay/world/sf/alcatrazWalk');
const { ALCA_X, ALCA_Z } = await import('../src/opus-bay/world/sf/landmarks/alcatrazGround');
const { game } = await import('../src/opus-bay/core/store');
const { flow } = await import('../src/opus-bay/game/flowStore');
const { requestPlatformStop, releasePlatformStop, definePlatform } = await import('../src/opus-bay/actors/platform');
const { FERRY_PLATFORM } = await import('../src/opus-bay/world/ferry');
const transit = await import('../src/opus-bay/game/transit');
const ride = await import('../src/opus-bay/game/ride');
const { runtime } = await import('../src/opus-bay/core/runtime');

const DT = 1 / 30;
const P33 = D.ALCA_TERMINALS.pier33.id, ISL = D.ALCA_TERMINALS.island.id;
/** a Bay wall clock (the system reads it through its `clock` option: pinned, never the real time) */
const at = (spec: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(spec)!;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  return { year: y, month: mo, day: d, hour: h, minute: mi, weekday: new Date(Date.UTC(y, mo - 1, d)).getUTCDay() };
};

test('W8-A timetable: the real Day Tour hours (8:40 first boat out, 3:50 last out, 6:30 last back), closed on Thanksgiving / Christmas / New Year', () => {
  const s = (spec: string) => A.alcaService(at(spec));
  assert.equal(s('2026-10-02T08:39'), 'early');
  assert.equal(s('2026-10-02T08:40'), 'day');
  assert.equal(s('2026-10-02T15:49'), 'day');
  assert.equal(s('2026-10-02T15:50'), 'returns');
  assert.equal(s('2026-10-02T18:29'), 'returns');
  assert.equal(s('2026-10-02T18:30'), 'night');
  assert.equal(s('2026-10-02T23:59'), 'night');
  // the fourth Thursday of November 2026 is the 26th; Christmas Day; New Year's Day
  assert.equal(s('2026-11-26T11:00'), 'closed');
  assert.equal(s('2026-11-19T11:00'), 'day');
  assert.equal(s('2026-12-25T11:00'), 'closed');
  assert.equal(s('2027-01-01T11:00'), 'closed');
  assert.equal(A.alcaClosedDay({ year: 2027, month: 11, day: 25 }), true, 'Thanksgiving 2027 is the 25th');
  // the deckhand at Pier 33: a fixed line out of hours (official times only, 以官网为准), none by day; the island never
  for (const st of ['early', 'returns', 'night', 'closed'] as const) {
    const n = A.alcaServiceNote(P33, st)!;
    assert.ok(n && n.zh.includes('官网') && /official/i.test(n.en), `${st}: a note that points to the official site`);
    assert.ok(!/\$|美元|票价/.test(n.zh + n.en), `${st}: no prices`);
    assert.equal(A.alcaServiceNote(ISL, st), null, `${st}: the island is always fetched`);
  }
  assert.equal(A.alcaServiceNote(P33, 'day'), null);
  assert.ok(A.alcaServiceNote(P33, 'night')!.zh.includes('夜游'), 'the night tour exists: a quiet line');
});

test('W8-A route: its own line (ferry-alcatraz) beside the unchanged Ferry Building ⇄ Pier 41 boat; the island end lies at the float', () => {
  assert.equal(D.ferryTerminal(P33)?.route.id, D.ALCA_FERRY_ID);
  assert.equal(D.ferryTerminal(ISL)?.route.id, D.ALCA_FERRY_ID);
  const first = D.FERRY_ROUTES[0];
  assert.equal(first.id, 'ferry');
  assert.deepEqual(first.terminals.map(t => t.id), ['ferry-building', 'pier-41']);
  assert.equal(D.FERRY_ROUTES.find(r => r.running), first, 'the first running route is still the Ferry Building boat (world/ferry.ts FerryLayer)');
  assert.equal(D.ferryTerminal('pier-41')?.route.id, 'ferry');
  // the landmark origin (alcatrazGround) = data/ferry's copy
  assert.deepEqual(D.ALCA_ORIGIN, { x: ALCA_X, z: ALCA_Z });
  // the island berth lies alongside the float (alcatraz.ts FLOAT: local 18.98, −18.12, 3.37 × 1.71 u): beam/2 + float/2 + 0.25
  const b = D.ALCA_TERMINALS.island.berth;
  const d = Math.hypot(b.x - (ALCA_X + 18.98), b.z - (ALCA_Z - 18.12));
  assert.ok(d > 2.7 && d < 3.6, `berth ${d.toFixed(2)} u off the float's centre`);
  // the paths start / end at the berths and the pivot
  const P = A.ALCA_FERRY_PATHS;
  const end = (p: typeof P.out, s: number) => A.alcaPoint(p, s);
  assert.ok(Math.hypot(end(P.out, P.out.length).x - b.x, end(P.out, P.out.length).z - b.z) < 0.05);
  const p33 = D.ALCA_TERMINALS.pier33.berth;
  assert.ok(Math.hypot(end(P.back, P.back.length).x - p33.x, end(P.back, P.back.length).z - p33.z) < 0.05);
  assert.ok(Math.hypot(end(P.astern, 0).x - p33.x, end(P.astern, 0).z - p33.z) < 0.05);
  // the line's ride system is found by its id once installed (and never the cable cars before)
  assert.equal(T.rideSystemFor(D.ALCA_FERRY_ID), null);
  const sys = new A.AlcaFerrySystem({ clock: () => at('2026-10-02T11:00'), brake: () => false });
  const epoch = T.ferrySystemsEpoch();
  T.setFerrySystemFor(D.ALCA_FERRY_ID, sys);
  try {
    assert.equal(T.rideSystemFor(D.ALCA_FERRY_ID), sys);
    assert.ok(T.ferrySystemsEpoch() > epoch);
  } finally { T.setFerrySystemFor(D.ALCA_FERRY_ID, null); }
  assert.equal(T.rideSystemFor(D.ALCA_FERRY_ID), null);
});

test('W8-A the paths stay over open water: the hull clear of land and piers (1.5 u; 0.4 u in the slip and at the float), the pivot circle clear', async () => {
  const { sfDisk } = await import('./opus-bay-sf-disk');
  const { createCityTerrain, landmarkWalkInputs } = await import('../src/opus-bay/core/sfTerrain');
  const { isLand, canStand, setCityTerrain } = await import('../src/opus-bay/core/terrain');
  const { SF_SITES } = await import('../src/opus-bay/world/sf/landmarks/index');
  const { DISTRICT } = await import('../src/opus-bay/data/district');
  const sf = sfDisk();
  const lms = landmarkWalkInputs(SF_SITES);
  const city = createCityTerrain(sf.manifest, { landmarks: lms });
  city.setFar(await sf.far());
  const P = A.ALCA_FERRY_PATHS;
  for (const p of [P.out, P.back, P.astern]) for (let s = 0; s < p.length; s += 30) { const q = A.alcaPoint(p, s); await sf.attachAround(city, q.x, q.z, 30, lms); }
  setCityTerrain(city, { heroDropLots: new Set(sf.manifest.heroDropLots) });
  // the district's pier decks (the slip lies between PIER 31 and PIER 33)
  const decks = DISTRICT.piers.map(pr => pr.deck);
  const inPoly = (poly: readonly { x: number; z: number }[], x: number, z: number) => {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[i], b = poly[j];
      if ((a.z > z) !== (b.z > z) && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) c = !c;
    }
    return c;
  };
  const solid = (x: number, z: number) => isLand(x, z) || decks.some(d => inPoly(d, x, z));
  // anything walkable too (a quay, a pier, the island's dock) — except alongside the island's float, where the boat lies
  const bad = (x: number, z: number) => solid(x, z) || canStand(x, z, 0.1);
  const L = 11.8, B = 4.2;
  const ring = (x: number, z: number, heading: number, c: number, hit = bad) => {
    const fx = Math.sin(heading), fz = Math.cos(heading), reach = B / 2 + c, half = L / 2 + c;
    for (let a = -half; a <= half; a += 0.5) for (const s of [-reach, reach]) if (hit(x + fx * a + fz * s, z + fz * a - fx * s)) return true;
    for (let s = -reach; s <= reach; s += 0.5) for (const a of [-half, half]) if (hit(x + fx * a + fz * s, z + fz * a - fx * s)) return true;
    return false;
  };
  const berths = [D.ALCA_TERMINALS.pier33.berth, D.ALCA_TERMINALS.island.berth];
  const isl = D.ALCA_TERMINALS.island.berth;
  try {
    let n = 0;
    for (const [name, p] of Object.entries(P)) {
      for (let s = 0; s <= p.length; s += 0.5) {
        const q = A.alcaPoint(p, s), h = A.alcaPoint(p, Math.min(p.length, s + 2.5));
        const heading = name === 'astern' ? A.ALCA_SLIP_HEADING : Math.atan2(h.x - q.x, h.z - q.z) || q.heading;
        const nearBerth = Math.min(...berths.map(b => Math.hypot(b.x - q.x, b.z - q.z))) < 32 || name === 'astern';
        // the last 16 u to the island's berth: alongside the jetty and the float (0.25 u off it at the berth)
        const alongside = Math.hypot(isl.x - q.x, isl.z - q.z) < 16;
        const ok = alongside ? !ring(q.x, q.z, heading, 0.1, solid) : !ring(q.x, q.z, heading, nearBerth ? 0.4 : 1.5);
        assert.ok(ok, `${name} at s ${s.toFixed(1)} (${q.x.toFixed(1)}, ${q.z.toFixed(1)}): the hull touches land or a pier`);
        n++;
      }
    }
    assert.ok(n > 1800, `${n} hull checks`);
    // the pivot: the boat turns round on the spot — its swept circle is open water
    const pv = D.ALCA_PIVOT, r = Math.hypot(L / 2, B / 2) + 0.3;
    for (let a = 0; a < Math.PI * 2; a += 0.1) for (let k = 0.3; k <= 1; k += 0.35) assert.ok(!bad(pv.x + Math.sin(a) * r * k, pv.z + Math.cos(a) * r * k), `the pivot circle at ${a.toFixed(1)}`);
  } finally { setCityTerrain(null); }
});

test('W8-A crossing: the boat gives way to a boat on (or coming onto) the tracks, never stops on them, and crosses when clear', () => {
  assert.equal(A.alcaCrossingClear([]), true);
  const [a, b] = D.ALCA_CROSSING, mid = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
  assert.equal(A.alcaCrossingClear([{ x: mid.x, z: mid.z, vx: 0, vz: 0 }]), false, 'a boat on the crossing');
  assert.equal(A.alcaCrossingClear([{ x: mid.x + 80, z: mid.z, vx: -8, vz: 0 }]), false, 'a ferry coming from the east at 8 u/s');
  assert.equal(A.alcaCrossingClear([{ x: mid.x + 80, z: mid.z, vx: 8, vz: 0 }]), true, 'one going away');
  assert.equal(A.alcaCrossingClear([{ x: mid.x + 200, z: mid.z, vx: -8, vz: 0 }]), true, 'one too far to matter');
  // the system: traffic parked on the crossing holds the boat at the pivot; it goes the moment the water clears
  let traffic = [{ x: mid.x, z: mid.z, vx: 0, vz: 0 }];
  const sys = new A.AlcaFerrySystem({ clock: () => at('2026-10-02T11:00'), traffic: () => traffic, brake: () => false });
  let t = 0;
  while (sys.boat.leg !== 'out' && t < 120) { sys.step(DT); t += DT; }
  assert.equal(sys.boat.leg, 'out');
  for (let i = 0; i < 30 * 20; i++) sys.step(DT);
  assert.ok(sys.boat.s < 0.2 && sys.boat.v < 0.05, `held at the pivot (s ${sys.boat.s.toFixed(2)})`);
  assert.ok(sys.heldTotal > 15);
  traffic = [];
  for (let i = 0; i < 30 * 15; i++) sys.step(DT);
  assert.ok(sys.boat.s > 40, `under way once clear (s ${sys.boat.s.toFixed(1)})`);
  // once on the crossing it never stops for a boat that turns up
  traffic = [{ x: mid.x, z: mid.z, vx: 0, vz: 0 }];
  const s0 = sys.boat.s;
  for (let i = 0; i < 30 * 3; i++) sys.step(DT);
  assert.ok(sys.boat.s > s0 + 15, 'keeps going');
});

test('W8-A shuttle: ≈ 90 s out (astern, pivot, run) and ≈ 55 s back on a free crossing; 20 s at each end; the ETAs agree with the legs', () => {
  const sys = new A.AlcaFerrySystem({ clock: () => at('2026-10-02T11:00'), brake: () => false });
  const marks: [number, string][] = [];
  let t = 0, last = sys.boat.leg, vmax = 0;
  for (let i = 0; i < 30 * 400; i++) {
    sys.step(DT); t += DT; vmax = Math.max(vmax, sys.boat.v);
    if (sys.boat.leg !== last) { marks.push([t, `${last}>${sys.boat.leg}`]); last = sys.boat.leg; }
  }
  const when = (k: string, from = 0) => marks.find(([tt, m]) => m === k && tt >= from)![0];
  const t0 = when('dwell33>astern'), tOut = when('out>dwellI'), tBack = when('back>dwell33');
  assert.ok(Math.abs(t0 - A.ALCA.dwell) < 0.2, 'casts off after its dwell');
  const out = tOut - t0, back = tBack - when('dwellI>back');
  assert.ok(out > 80 && out < 100, `out ${out.toFixed(1)} s`);
  assert.ok(back > 45 && back < 65, `back ${back.toFixed(1)} s`);
  const legs = A.alcaLegSeconds;
  assert.ok(Math.abs(legs('astern') + legs('pivot') + legs('out') - out) / out < 0.1, 'rideSeconds out within 10 %');
  assert.ok(Math.abs(legs('back') - back) / back < 0.1, 'rideSeconds back within 10 %');
  assert.ok(vmax <= A.ALCA.speed + 1e-6, `top speed ${vmax.toFixed(2)}`);
  assert.ok(marks.filter(([, m]) => m === 'dwell33>astern').length >= 2, 'keeps shuttling by day');
});

test('W8-A night: the boat rests in its slip; Pier 33 gets a quiet line, but a rider on the island is always fetched', () => {
  let clock = at('2026-10-02T21:00');
  const sys = new A.AlcaFerrySystem({ clock: () => clock, brake: () => false });
  for (let i = 0; i < 30 * 120; i++) sys.step(DT);
  assert.equal(sys.boat.leg, 'dwell33', 'rests at night');
  assert.equal(sys.request({ line: D.ALCA_FERRY_ID, station: P33, to: ISL, dir: 1 }), null, 'no boat out at night');
  assert.ok(sys.serviceNote(P33));
  const st = sys.request({ line: D.ALCA_FERRY_ID, station: ISL, to: P33, dir: 1 })!;
  assert.equal(st.phase, 'coming');
  let t = 0;
  while (sys.rideStatus()?.phase !== 'here' && t < 200) { sys.step(DT); t += DT; }
  assert.equal(sys.rideStatus()?.phase, 'here', 'the boat came out to the island');
  assert.ok(t < 120, `fetched in ${t.toFixed(0)} s`);
  sys.board();
  while (sys.rideStatus()?.phase !== 'arrived' && t < 400) { sys.step(DT); t += DT; }
  assert.equal(sys.rideStatus()?.phase, 'arrived', 'brought back to Pier 33');
  sys.cancel();
  for (let i = 0; i < 30 * 60; i++) sys.step(DT);
  assert.equal(sys.boat.leg, 'dwell33', 'and rests again');
  // morning: the first boat goes at 8:40
  clock = at('2026-10-03T08:41');
  for (let i = 0; i < 30 * 30; i++) sys.step(DT);
  assert.notEqual(sys.boat.leg, 'dwell33', 'the first boat of the day');
});

test('W8-A ride: Pier 33 → the island through game/transit (the deckhand, the open deck, it counts once); the hop-off brake holds the boat; the night line at the quay', () => {
  const clockNow = { v: at('2026-10-02T11:00') };
  const sys = new A.AlcaFerrySystem({ clock: () => clockNow.v });
  definePlatform(D.ALCA_FERRY_ID, FERRY_PLATFORM);
  T.setFerrySystemFor(D.ALCA_FERRY_ID, sys);
  try {
    game.set({ phase: 'playing', worldMode: 'city' });
    const items = transit.transitInteractables();
    assert.deepEqual(items.filter(it => it.refId === P33 || it.refId === ISL).map(it => it.refId).sort(), [ISL, P33].sort(), 'both quays have a prompt');
    // by day the deckhand offers the island
    transit.boardFerry(P33);
    assert.equal(game.get().dialogue.nodeId, 'flow.ferry');
    game.set({ dialogue: { ...game.get().dialogue, nodeId: null } });
    transit.rideFerry(P33, ISL);
    assert.deepEqual(game.get().move, { mode: 'transit', line: D.ALCA_FERRY_ID, spot: 'deck' });
    assert.equal(flow.get().ride?.line, D.ALCA_FERRY_ID);
    const label = transit.rideLabel({ stage: 'riding', from: P33, to: ISL, line: D.ALCA_FERRY_ID, kind: 'ferry' });
    assert.equal(label.icon, 'ferry');
    assert.equal(label.dest?.en, 'Alcatraz dock');
    assert.ok(transit.ferryRideSeconds(P33, ISL) > 85 && transit.ferryRideSeconds(P33, ISL) < 105);
    let t = 0;
    const step = (n: number, until?: () => boolean) => { for (let i = 0; i < n; i++) { sys.step(DT); transit.stepTransit(DT); t += DT; if (until?.()) return true; } return false; };
    assert.ok(step(30 * 10, () => ride.currentRide()?.mode === 'follow'), 'boards at once (the boat lies at Pier 33)');
    // the rider's brake (Settings / the hop-off request) holds the boat out on the Bay
    assert.ok(step(30 * 60, () => sys.boat.leg === 'out' && sys.boat.s > 120));
    requestPlatformStop(D.ALCA_FERRY_ID, 3);
    step(30 * 8);
    const s0 = sys.boat.s;
    step(30 * 2);
    assert.ok(Math.abs(sys.boat.s - s0) < 0.05 && sys.boat.v < 0.05, 'held');
    releasePlatformStop(D.ALCA_FERRY_ID);
    t = 0;
    assert.ok(step(30 * 200, () => ride.currentRide() === null), 'arrives at the island');
    assert.ok(t < 90, `the rest of the way in ${t.toFixed(0)} s`);
    assert.equal(transit.rideLog()[D.ALCA_FERRY_ID], 1, 'counted once');
    assert.equal(game.get().move.mode, 'foot');
    const q = D.ALCA_TERMINALS.island.quay, p = runtime.player;
    assert.ok(Math.hypot(p.x - q.x, p.z - q.z) < 17, `on the island's quay (${p.x.toFixed(1)}, ${p.z.toFixed(1)})`);
    // night: the deckhand at Pier 33 says the boat rests (a dialogue, no ride)
    clockNow.v = at('2026-10-02T21:00');
    transit.boardFerry(P33);
    assert.equal(game.get().dialogue.nodeId, 'flow.ferry');
    assert.equal(ride.currentRide(), null, 'no ride starts at night from Pier 33');
  } finally {
    T.setFerrySystemFor(D.ALCA_FERRY_ID, null);
    ride.endRide();
    game.set({ riding: null, worldMode: 'district' });
    flow.set({ ride: null });
  }
});

test('W8-A the island on foot: the quay, the dock road, the stair and the cellhouse front are one walkable region; the walking graph\'s edges walk', async () => {
  const { sfDisk } = await import('./opus-bay-sf-disk');
  const { createCityTerrain, landmarkWalkInputs } = await import('../src/opus-bay/core/sfTerrain');
  const { canStand, heightAt, surfaceAt, setCityTerrain } = await import('../src/opus-bay/core/terrain');
  const { SF_SITES } = await import('../src/opus-bay/world/sf/landmarks/index');
  const { findPath } = await import('../src/opus-bay/actors/nav');
  const sf = sfDisk();
  const lms = landmarkWalkInputs(SF_SITES);
  const city = createCityTerrain(sf.manifest, { landmarks: lms });
  city.setFar(await sf.far());
  await sf.attachAround(city, ALCA_X, ALCA_Z, 70, lms);
  setCityTerrain(city, { heroDropLots: new Set(sf.manifest.heroDropLots) });
  try {
    const G = W.ALCA_WALK_GRAPH;
    for (const [i, n] of G.nodes.entries()) assert.ok(canStand(n.x, n.z, 0.45), `node ${i} (${n.x}, ${n.z}) standable`);
    const q = D.ALCA_TERMINALS.island.quay;
    assert.deepEqual(G.nodes[G.dock], q, 'the dock node is the quay');
    assert.deepEqual(G.nodes[G.arrival], W.ALCA_ARRIVAL, 'the arrival node');
    assert.ok(Math.abs(heightAt(q.x, q.z) - W.ALCA_DOCK_Y) < 0.05, 'the quay on the dock deck');
    assert.equal(surfaceAt(ALCA_X + W.ALCA_STAIR.x, ALCA_Z - 9), 'stairs');
    assert.ok(heightAt(W.ALCA_ARRIVAL.x, W.ALCA_ARRIVAL.z) > 8, 'the cellhouse front is up on the plateau');
    for (const [a, b] of G.edges) {
      const A0 = G.nodes[a], B0 = G.nodes[b];
      const res = findPath(A0, B0, 8);
      const e = res?.points[res.points.length - 1];
      assert.ok(res && e && Math.hypot(e.x - B0.x, e.z - B0.z) < 1.1, `edge ${a} → ${b} walks`);
    }
    const all = findPath(q, W.ALCA_ARRIVAL, 8);
    const e = all?.points[all.points.length - 1];
    assert.ok(all && e && Math.hypot(e.x - W.ALCA_ARRIVAL.x, e.z - W.ALCA_ARRIVAL.z) < 1.1, 'the quay → the cellhouse front');
    assert.ok(W.onAlcatraz(q.x, q.z) && W.onAlcatraz(W.ALCA_ARRIVAL.x, W.ALCA_ARRIVAL.z) && !W.onAlcatraz(D.ALCA_TERMINALS.pier33.quay.x, D.ALCA_TERMINALS.pier33.quay.z));
  } finally { setCityTerrain(null); }
});

test('W8-A Pier 33: the quay is walkable and joined to the city; the boat lies in the slip beside it', async () => {
  const { sfDisk } = await import('./opus-bay-sf-disk');
  const { createCityTerrain, landmarkWalkInputs } = await import('../src/opus-bay/core/sfTerrain');
  const { canStand, setCityTerrain } = await import('../src/opus-bay/core/terrain');
  const { SF_SITES } = await import('../src/opus-bay/world/sf/landmarks/index');
  const sf = sfDisk();
  const lms = landmarkWalkInputs(SF_SITES);
  const city = createCityTerrain(sf.manifest, { landmarks: lms });
  city.setFar(await sf.far());
  const t = D.ALCA_TERMINALS.pier33;
  await sf.attachAround(city, t.quay.x, t.quay.z, 60, lms);
  setCityTerrain(city, { heroDropLots: new Set(sf.manifest.heroDropLots) });
  try {
    assert.ok(canStand(t.quay.x, t.quay.z, 0.45), 'the Pier 33 quay is walkable');
    assert.ok(Math.hypot(t.quay.x - t.berth.x, t.quay.z - t.berth.z) < 12, 'the boat lies beside the quay');
    // the quay's region reaches 40 u (the Embarcadero), not a pocket
    const ix = await sf.graphIndex();
    const n = ix.nearestNode(t.quay.x, t.quay.z, 40, i => ix.component(i) === ix.mainComponent());
    assert.ok(n >= 0, 'a walking-graph node of the city within 40 u');
  } finally { setCityTerrain(null); }
});

test('W8-A Fleet Week: the Parade of Ships (lane S) crosses the boat\'s lanes; in its hour the boat stays in its slip, an island rider is fetched at noon', async () => {
  const F = await import('../src/opus-bay/world/sf/fleetWeekDay');
  const { PATH_POINTS } = await import('../src/opus-bay/world/sf/fleetWeek');
  // the parade's path comes within a ship's beam of the outbound lane (why the boat waits)
  const out = A.ALCA_FERRY_PATHS.out;
  let near = Infinity;
  for (let i = 0; i + 1 < PATH_POINTS.length; i++) {
    const a = PATH_POINTS[i], b = PATH_POINTS[i + 1], n = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 2);
    for (let k = 0; k <= n; k++) {
      const x = a.x + ((b.x - a.x) * k) / n, z = a.z + ((b.z - a.z) * k) / n;
      for (let s = 0; s < out.length; s += 2) { const q = A.alcaPoint(out, s); near = Math.min(near, Math.hypot(q.x - x, q.z - z)); }
    }
  }
  assert.ok(near < 15, `the parade passes ${near.toFixed(1)} u from the lane`);
  const day = F.PARADE_DAY.split('-').map(Number);
  const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  let clock = at(`${F.PARADE_DAY}T${hhmm(F.PARADE_FROM + 20)}`);
  assert.equal(A.alcaService(clock), 'parade');
  assert.equal(A.alcaService(at(`${F.PARADE_DAY}T${hhmm(F.PARADE_TO)}`)), 'day');
  assert.equal(A.alcaService(at(`${day[0]}-${String(day[1]).padStart(2, '0')}-${String(day[2] + 1).padStart(2, '0')}T${hhmm(F.PARADE_FROM + 20)}`)), 'day', 'the next day');
  const sys = new A.AlcaFerrySystem({ clock: () => clock, brake: () => false });
  assert.deepEqual(sys.serviceNote(P33), A.ALCA_PARADE_NOTE);
  assert.equal(sys.request({ line: D.ALCA_FERRY_ID, station: P33, to: ISL, dir: 1 }), null);
  for (let i = 0; i < 30 * 60; i++) sys.step(DT);
  assert.equal(sys.boat.leg, 'dwell33', 'stays in its slip');
  // the island can still call it: it comes after the parade (the ETA says so), the deckhand there says why
  const st = sys.request({ line: D.ALCA_FERRY_ID, station: ISL, to: P33, dir: 1 })!;
  assert.ok(st && st.eta > 35 * 60, `ETA ${st.eta.toFixed(0)} s`);
  assert.ok(sys.greeting(ISL)?.en.includes('Parade'));
  for (let i = 0; i < 30 * 30; i++) sys.step(DT);
  assert.equal(sys.boat.leg, 'dwell33');
  clock = at(`${F.PARADE_DAY}T${hhmm(F.PARADE_TO)}`);
  let t = 0;
  while (sys.rideStatus()?.phase !== 'here' && t < 200) { sys.step(DT); t += DT; }
  assert.equal(sys.rideStatus()?.phase, 'here', 'fetched at noon');
});

test('W8-A the return ferry: the island → Pier 33 through game/transit (BAYBAY\'s lines on boarding and ashore), the rider set down on Pier 33\'s quay', async () => {
  const { ALCA_LINES } = await import('../src/opus-bay/world/sf/alcatrazLines');
  const { teleportPlayer } = await import('../src/opus-bay/game/flow');
  const sys = new A.AlcaFerrySystem({ clock: () => at('2026-10-02T16:30') });
  definePlatform(D.ALCA_FERRY_ID, FERRY_PLATFORM);
  T.setFerrySystemFor(D.ALCA_FERRY_ID, sys);
  const said: string[] = [];
  try {
    game.set({ phase: 'playing', worldMode: 'city', move: { mode: 'foot' } });
    teleportPlayer(D.ALCA_TERMINALS.island.quay);
    // 'returns' (after the last boat out): the island still calls the boat
    assert.equal(sys.serviceState(), 'returns');
    transit.rideFerry(ISL, P33);
    assert.equal(ride.currentRide()?.mode, 'wait');
    const step = (n: number, until: () => boolean) => {
      for (let i = 0; i < n; i++) {
        sys.step(DT); transit.stepTransit(DT);
        const b = flow.get().bubble; if (b) { said.push(b.text.en); flow.set({ bubble: null }); }
        if (until()) return true;
      }
      return false;
    };
    assert.ok(step(30 * 200, () => ride.currentRide()?.mode === 'follow'), 'the boat came out and the rider boarded');
    // (W8-A review, A-RC-1) the way back: the ferry's usual boarding line, never "Off to Alcatraz!"
    assert.ok(!said.includes(ALCA_LINES.board.en), 'not the outbound line on the way back');
    assert.ok(said.some(s => /^All aboard!/.test(s)), `the ferry's usual boarding line (${said.join(' | ')})`);
    assert.ok(step(30 * 120, () => ride.currentRide() === null), 'back at Pier 33');
    assert.ok(said.includes(ALCA_LINES.backAt33.en), 'the line ashore at Pier 33');
    const q = D.ALCA_TERMINALS.pier33.quay, p = runtime.player;
    assert.ok(Math.hypot(p.x - q.x, p.z - q.z) < 17, `on Pier 33's quay (${p.x.toFixed(1)}, ${p.z.toFixed(1)})`);
  } finally {
    T.setFerrySystemFor(D.ALCA_FERRY_ID, null);
    ride.endRide();
    game.set({ riding: null, worldMode: 'district' });
    flow.set({ ride: null, bubble: null });
  }
});
