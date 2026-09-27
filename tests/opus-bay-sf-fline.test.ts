import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

/**
 * The city F-line to the Castro (lane F, wave 3, F7): the spliced line (data/fline.ts), the streetcar simulation
 * (world/flineSystem.ts: single track with passing places, the balloon loop, dispatch, the hop-off brake), the rails F
 * lays for it, and the ride flow from the Ferry Building to 17th & Castro (game/transit.ts). District mode keeps its
 * two-car loop (tests/opus-bay-world.test.ts pins `new Streetcars()`).
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

const { DISTRICT } = await import('../src/opus-bay/data/district');
const F = await import('../src/opus-bay/data/fline');
const T = await import('../src/opus-bay/data/transit');
const { StreetcarSystem, FLINE_ID } = await import('../src/opus-bay/world/flineSystem');
const { flineRailTracks } = await import('../src/opus-bay/world/flineLayer');
const platform = await import('../src/opus-bay/actors/platform');
const { game } = await import('../src/opus-bay/core/store');
const { onEvent } = await import('../src/opus-bay/core/events');
const { flow } = await import('../src/opus-bay/game/flowStore');
const transit = await import('../src/opus-bay/game/transit');
const ride = await import('../src/opus-bay/game/ride');

const FILE = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, '../public/opus-bay/sf/v1/transit.json'), 'utf8')) as import('../src/opus-bay/data/transit').TransitFileJson;
const LINE = F.buildFLine(FILE.lines.find(l => l.id === 'f-line'), DISTRICT.streetcar)!;
const DT = 1 / 30;
const { FL } = F;

test('line: the hero track spliced to Market St and a balloon loop at 17th & Castro, one closed cycle', () => {
  assert.ok(LINE, 'built');
  // a closed, continuous cycle: legs in order, no vertex gap longer than the densify step
  const n = LINE.xyz.length / 3;
  let maxGap = 0;
  for (let i = 0; i < n; i++) maxGap = Math.max(maxGap, LINE.cum[i + 1] - LINE.cum[i]);
  assert.ok(maxGap < 2.2, `max gap ${maxGap.toFixed(2)}`);
  assert.deepEqual([...new Set(LINE.leg)], [1, 2, 3, 4]);
  assert.ok(LINE.length > 1900 && LINE.length < 2300, `cycle ${LINE.length.toFixed(0)} u`);
  // no kink anywhere a car could not take (heading change over one car length ≤ 150°, the Castro hairpin)
  // (the Pier 39 turnaround is the district's own half loop, as tight as the district draws it)
  const turn = LINE.legU[3];
  for (let i = 0; i < n; i += 3) {
    if (LINE.cum[i] > turn - FL.length || LINE.cum[i] < FL.length) continue;
    const a = F.cyclePoint(LINE, LINE.cum[i] - FL.half), b = F.cyclePoint(LINE, LINE.cum[i] + FL.half);
    const dh = Math.abs(Math.atan2(Math.sin(b.heading - a.heading), Math.cos(b.heading - a.heading)));
    assert.ok(dh < 2.7, `kink at ${a.x.toFixed(1)},${a.z.toFixed(1)}: ${dh.toFixed(2)} rad`);
  }
  // the switch sits on the hero track just east of the Ferry Building stop; the loop starts and ends at J2 on Market
  const ferry = LINE.stations.find(s => s.id === 'ferry')!;
  const join = F.centreAt(LINE, LINE.sJoin);
  assert.ok(join.x > ferry.x + FL.half + 2 && join.x < ferry.x + 14, `switch at x ${join.x.toFixed(1)}, ferry stop ${ferry.x.toFixed(1)}`);
  const j2 = F.centreAt(LINE, 0);
  assert.ok(Math.abs(j2.z - 700) < 1 && Math.abs(j2.x - 141.6) < 0.5, `J2 ${j2.x.toFixed(1)},${j2.z.toFixed(1)}`);
});

test('stations: the four hero stops, Market Street stops merged by name, the Castro terminal; dwell and passing places', () => {
  const ids = LINE.stations.map(s => s.id);
  for (const id of ['ferry', 'green', 'bay', 'pier39', 'f-17th-castro', 'f-market-church', 'f-market-van-ness', 'f-market-stockton']) assert.ok(ids.includes(id), id);
  assert.ok(ids.every(id => /^[a-z0-9-]{1,64}$/.test(id)));
  assert.equal(new Set(ids).size, ids.length, 'unique ids');
  assert.deepEqual(LINE.stations.filter(s => s.terminus).map(s => s.id).sort(), ['f-17th-castro', 'pier39']);
  assert.ok(LINE.stations.find(s => s.id === 'f-17th-castro')!.name.zh.includes('卡斯特罗'));
  // every stem station has a stop on both legs, the Castro terminal one on the loop
  for (const st of LINE.stations) {
    const legs = LINE.stops.filter(s => s.station === st.id).map(s => s.leg).sort();
    assert.deepEqual(legs, st.id === 'f-17th-castro' ? [2] : [1, 3], st.id);
  }
  const dwellCity = LINE.stops.filter(s => s.station.startsWith('f-market') && s.dwell).length / 2;
  const allCity = LINE.stops.filter(s => s.station.startsWith('f-market')).length / 2;
  assert.ok(dwellCity >= 4 && dwellCity <= Math.ceil(allCity / 2), `${dwellCity} of ${allCity} Market stations always stopped at`);
  // passing places: at stations, at least a block apart, all on Market St outside the slab
  const b = LINE.bounds;
  assert.equal(b[0], 0);
  assert.equal(b[b.length - 1], LINE.sJoin);
  for (let k = 1; k < b.length; k++) assert.ok(b[k] - b[k - 1] >= FL.minBlock - 1e-6, `block ${k} ${(b[k] - b[k - 1]).toFixed(1)} u`);
  assert.ok(b.length - 2 >= 10, `${b.length - 2} passing places`);
  for (const p of b.slice(1, -1)) assert.ok(p < LINE.sSlab, 'passing places beyond the slab');
  // lanes: the double track on the hero side (the district's tracks A / B), 0 on the single track, ±PASS at passing places
  assert.equal(F.laneOffset(LINE, LINE.sJoin + 30, 1), -FL.lane);
  assert.equal(F.laneOffset(LINE, LINE.sJoin + 30, -1), FL.lane);
  assert.equal(F.laneOffset(LINE, (b[1] + b[2]) / 2, 1), -0);
  assert.equal(F.laneOffset(LINE, b[2], -1), FL.pass);
});

/** The car body (8.4 × 2.1, plus a small margin) at cycle position u, as a rotated rectangle. */
function body(u: number, margin = 0.1) {
  const f = F.cyclePoint(LINE, u + FL.bogie), r = F.cyclePoint(LINE, u - FL.bogie);
  const cx = (f.x + r.x) / 2, cz = (f.z + r.z) / 2, h = Math.atan2(f.x - r.x, f.z - r.z);
  return { cx, cz, fx: Math.sin(h), fz: Math.cos(h), hl: FL.half + margin, hw: FL.width / 2 + margin };
}
function hitsCircle(b: ReturnType<typeof body>, x: number, z: number, r: number) {
  const dx = x - b.cx, dz = z - b.cz;
  const along = dx * b.fx + dz * b.fz, side = dx * b.fz - dz * b.fx;
  const qx = Math.max(-b.hl, Math.min(b.hl, along)), qz = Math.max(-b.hw, Math.min(b.hw, side));
  return Math.hypot(along - qx, side - qz) < r;
}
function hitsPoly(b: ReturnType<typeof body>, poly: { x: number; z: number }[]) {
  // separating axis test: the car rectangle vs a convex lot polygon
  const corners = [[1, 1], [1, -1], [-1, -1], [-1, 1]].map(([a, s]) => ({ x: b.cx + b.fx * b.hl * a + b.fz * b.hw * s, z: b.cz + b.fz * b.hl * a - b.fx * b.hw * s }));
  const axes = [{ x: b.fx, z: b.fz }, { x: b.fz, z: -b.fx }];
  for (let i = 0; i < poly.length; i++) { const p = poly[i], q = poly[(i + 1) % poly.length]; axes.push({ x: -(q.z - p.z), z: q.x - p.x }); }
  for (const ax of axes) {
    const pa = corners.map(c => c.x * ax.x + c.z * ax.z), pb = poly.map(c => c.x * ax.x + c.z * ax.z);
    if (Math.max(...pa) < Math.min(...pb) || Math.max(...pb) < Math.min(...pa)) return false;
  }
  return true;
}

test('the splice at the foot of Market clears the district: no lot, tree or palm touches a car on it', () => {
  const d = DISTRICT as unknown as { blocks: { id: string; polygon?: { x: number; z: number }[]; footprint?: { x: number; z: number }[]; points?: { x: number; z: number }[] }[]; props: { kind: string; x: number; z: number; scale?: number }[] };
  const lots = d.blocks.map(b => ({ id: b.id, poly: b.polygon ?? b.footprint ?? b.points ?? [] })).filter(l => l.poly.length >= 3);
  // trees: the main canopy (world/props.ts tree: 1.15 × scale at car height); palms: the trunk and low fronds
  const trees = d.props.filter(p => p.kind === 'tree' || p.kind === 'palm').map(p => ({ ...p, r: (p.kind === 'tree' ? 1.15 : 0.5) * (p.scale ?? 1) }));
  // both legs through the slab: from the slab edge on Market to the switch (the hero track beyond is the district's own)
  let checked = 0;
  for (const leg of [1, 3] as const) {
    const u0 = F.uAtS(LINE, leg, LINE.sSlab + 6), u1 = F.uAtS(LINE, leg, LINE.sJoin + 2);
    const [a, bEnd] = leg === 1 ? [u1, u0] : [u0, u1];
    for (let u = a; u <= bEnd; u += 0.25) {
      const b = body(u, 0.015);
      for (const l of lots) assert.ok(!hitsPoly(b, l.poly), `leg ${leg} u ${u.toFixed(1)} hits ${l.id}`);
      for (const t of trees) assert.ok(!hitsCircle(b, t.x, t.z, t.r), `leg ${leg} u ${u.toFixed(1)} hits the ${t.kind} at ${t.x},${t.z}`);
      checked++;
    }
  }
  assert.ok(checked > 300, `${checked} poses`);
});

test('motion: 20 simulated minutes, four cars, never two on one block of single track, nobody stuck, every car laps', () => {
  const sys = new StreetcarSystem(LINE);
  const last = sys.cars.map(c => c.u), odo = sys.cars.map(() => 0);
  let maxStill = 0;
  const arrivals = new Set<string>();
  for (let i = 0; i < 30 * 1200; i++) {
    sys.step(DT);
    for (const e of sys.events) if (e.what === 'arrive' && e.station) arrivals.add(e.station);
    sys.events.length = 0;
    sys.cars.forEach((c, k) => { const d = F.aheadU(LINE, last[k], c.u); odo[k] += d < LINE.length / 2 ? d : 0; last[k] = c.u; maxStill = Math.max(maxStill, c.still); });
    if (i % 3 === 0) assert.deepEqual(sys.violations(), [], `t ${(i * DT).toFixed(1)} s`);
  }
  for (const o of odo) assert.ok(o > LINE.length * 2.4, `laps ${(o / LINE.length).toFixed(2)}`);
  assert.ok(maxStill < 40, `longest stand ${maxStill.toFixed(1)} s`);
  assert.equal(arrivals.size, LINE.stations.filter(s => LINE.stops.some(st => st.station === s.id && st.dwell)).length, 'every dwell station served');
  // speeds: 11 on the hero, 14 on Market, slower in the curves
  assert.ok(Math.max(...LINE.vlim) <= FL.vCity + 1e-6 && Math.min(...LINE.vlim) >= FL.vCurveMin - 1e-6);
});

test('dispatch: a rider at a Market Street station gets a car within a few seconds (an unseen one is brought in)', () => {
  for (const warm of [0, 90, 200, 330]) {
    const st = LINE.stations.find(s => s.id === 'f-market-van-ness')!;
    const sys = new StreetcarSystem(LINE, { viewer: () => ({ x: st.x + 4, z: st.z, onFoot: false }), visible: (x, z) => Math.hypot(x - st.x, z - st.z) < 40 });
    for (let t = 0; t < warm; t += DT) sys.step(DT);
    const status = sys.request({ line: FLINE_ID, station: 'f-market-van-ness', dir: 1, to: 'f-17th-castro' });
    assert.ok(status);
    let t = 0;
    while (t < 90 && sys.rideStatus()!.phase !== 'here') { sys.step(DT); t += DT; }
    assert.equal(sys.rideStatus()!.phase, 'here', `after ${warm} s`);
    assert.ok(t < 30, `car at the stop after ${t.toFixed(1)} s (warm ${warm})`);
    const car = sys.cars[sys.rideStatus()!.car];
    assert.equal(LINE.stops[car.at].station, 'f-market-van-ness');
    assert.equal(LINE.stops[car.at].leg, 1, 'toward Castro');
    assert.deepEqual(sys.violations(), []);
  }
});

test('rails: F lays the foot of Market inside the slab, both switch ramps and a siding pair at every passing place', () => {
  const tracks = flineRailTracks(LINE);
  assert.equal(tracks.length, 1 + 2 + 2 * (LINE.bounds.length - 2));
  assert.ok(tracks.every(t => !t.cable && t.track.length > 5));
  const slab = tracks[0].track;
  assert.ok(slab.length > 80 && slab.length < 140, `in-slab track ${slab.length.toFixed(0)} u`);
});

test('ride: Ferry Building → 17th & Castro end to end; it counts once; the hop-off brake stops the car within 1.2 s', () => {
  const sys = new StreetcarSystem(LINE);
  T.setActiveStreetcarSystem(sys);
  const events: string[] = [];
  const off = onEvent(e => { if (e.type === 'transit' && e.kind === 'streetcar') events.push(`${e.what}${e.real ? ':real' : ''}`); });
  try {
    game.set({ phase: 'playing', worldMode: 'city' });
    const step = (n: number, until?: () => boolean) => { for (let i = 0; i < n; i++) { sys.step(DT); transit.stepTransit(DT); if (until?.()) return true; } return false; };
    // the stations show up as interactables (the Market ones; the hero stops keep the district's)
    const items = transit.transitInteractables();
    assert.ok(items.some(it => it.refId === 'f-market-church'));
    assert.ok(!items.some(it => it.refId === 'ferry'));
    // (1) the hop-off brake
    transit.rideFLine('green', 'f-market-church');
    assert.equal(game.get().move.line, FLINE_ID);
    assert.equal(flow.get().ride?.kind, 'streetcar');
    assert.ok(step(30 * 120, () => ride.currentRide()?.mode === 'follow'), 'boards');
    assert.ok(step(30 * 60, () => { const c = sys.riderCarOf(FLINE_ID); return !!c && c.v > 9; }), 'gets going');
    platform.requestPlatformStop(FLINE_ID, 1.2);
    const car = sys.riderCarOf(FLINE_ID)!;
    let tStop = 0;
    while (car.v > 0.02 && tStop < 3) { sys.step(DT); transit.stepTransit(DT); tStop += DT; }
    assert.ok(tStop <= 1.25, `braked in ${tStop.toFixed(2)} s`);
    assert.equal(flow.get().ride?.stage, 'braking');
    transit.hopOffRide();
    assert.equal(platform.platformStop(FLINE_ID), null, 'released');
    assert.equal(ride.currentRide(), null);
    // (2) the whole line: board at the Ferry Building, ride to the Castro terminal
    const label = transit.rideLabel({ stage: 'waiting', from: 'ferry', to: 'f-17th-castro', line: FLINE_ID, kind: 'streetcar' });
    assert.equal(label.icon, 'tram');
    assert.equal(label.dest?.en, '17th & Castro');
    const secs = transit.flineRideSeconds('ferry', 'f-17th-castro');
    transit.rideFLine('ferry', 'f-17th-castro');
    assert.ok(step(30 * 120, () => ride.currentRide()?.mode === 'follow'), 'boards at the Ferry Building');
    let t = 0;
    const done = step(30 * 400, () => { t += DT; return ride.currentRide() === null; });
    assert.ok(done, 'arrives');
    assert.ok(t < 200, `Ferry → Castro in ${t.toFixed(0)} s`);
    assert.ok(Math.abs(t - secs) < 45, `estimate ${secs.toFixed(0)} s vs ${t.toFixed(0)} s`);
    assert.equal(transit.rideLog()[FLINE_ID], 1, 'counted once');
    assert.ok(game.get().goalsDone.includes('streetcar'));
    assert.equal(events.filter(e => e === 'ride:real').length, 1);
    assert.equal(game.get().move.mode, 'foot');
    assert.deepEqual(sys.violations(), []);
  } finally {
    off();
    T.setActiveStreetcarSystem(null);
    ride.endRide();
    game.set({ riding: null, worldMode: 'district' });
    flow.set({ ride: null });
  }
});

test('review: a hero ride that began before the city F-line came in keeps its car; the F-line waits hidden, then takes over', async () => {
  const { FLineLayer } = await import('../src/opus-bay/world/flineLayer');
  const { Streetcars } = await import('../src/opus-bay/world/streetcar');
  const { runtime } = await import('../src/opus-bay/core/runtime');
  const layer = new FLineLayer(LINE, () => false, () => null);
  const cars = new Streetcars();
  // the transit layer the city loads lazily, reduced to its F-line (world/transitLayer.ts hosts it the same way)
  (cars as unknown as { layer: unknown }).layer = { fline: layer, group: layer.group, update: (dt: number) => layer.update(dt), dispose: () => layer.dispose() };
  try {
    game.set({ phase: 'playing', worldMode: 'city' });
    const heroPos = () => (cars as unknown as { positions(): { x: number; z: number; heading: number }[] }).positions();
    // as world/streetcar.ts does when the layer comes in: the F-line cars start where the hero cars are
    layer.sys.seedFrom(heroPos().map(p => ({ x: p.x, z: p.z, heading: p.heading })));
    // the rider boarded the hero loop's car before the layer existed (a district-style ride: no `line`)
    assert.ok(ride.beginRide('ferry', 'pier39'));
    const heroCar = () => (cars as unknown as { cars: { mesh: { visible: boolean } }[] }).cars;
    let maxOff = 0;
    for (let i = 0; i < 30 * 40; i++) {
      cars.update(DT, i * DT);
      platform.agePlatforms(DT);
      if (!ride.currentRide()) break;
      // the platform 'streetcar' (the rider's car) and the mirror stay the hero loop's: the F-line never moves them
      const pl = platform.platforms.get('streetcar')!, sc = runtime.streetcar;
      const toHero = Math.min(...heroPos().map(h => Math.hypot(pl.x - h.x, pl.z - h.z)));
      maxOff = Math.max(maxOff, toHero, Math.hypot(pl.x - sc.x, pl.z - sc.z));
    }
    assert.ok(maxOff < 0.05, `the rider's platform stays on a hero car (${maxOff.toFixed(2)} u off at worst)`);
    assert.equal(layer.active, false, 'F-line waits while the hero ride runs');
    assert.equal(layer.group.visible, false, 'its cars are not drawn over the hero cars');
    assert.ok(heroCar().every(c => c.mesh.visible), 'the hero cars stay');
    // the hero ride ends: the F-line takes over where the hero cars are now
    const hero = heroPos();
    ride.endRide();
    cars.update(DT, 20);
    assert.equal(layer.active, true);
    assert.equal(layer.group.visible, true);
    assert.ok(heroCar().every(c => !c.mesh.visible), 'hero cars hidden once the F-line runs');
    const near = hero.map(h => Math.min(...layer.sys.cars.map(c => Math.hypot(c.pose.x - h.x, c.pose.z - h.z))));
    assert.ok(near.every(d => d < 6), `an F-line car where each hero car was (${near.map(d => d.toFixed(1)).join(', ')} u)`);
    assert.deepEqual(layer.sys.violations(), []);
  } finally {
    ride.endRide();
    cars.dispose();
    layer.dispose();
    T.setActiveStreetcarSystem(null);
    game.set({ riding: null, worldMode: 'district' });
    flow.set({ ride: null });
  }
});
