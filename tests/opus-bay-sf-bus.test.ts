import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

/**
 * Wave 4 · lane T: the sightseeing loop `sf-loop` — the baked route (public/opus-bay/sf/v1/transit-w4.json, written by
 * scripts/opus-sf/transit-sidecar.ts from lib/busLoop.ts), and (below) the bus simulation, the toy bus and the stops.
 */

const { transitLineProblems } = await import('../src/opus-bay/world/sf/format');
const { projectCity } = await import('../src/opus-bay/core/geo');
const { stationOf, STATIONS } = await import('../src/opus-bay/data/district');
const names = await import('../src/opus-bay/data/sf/stationNames');
type TransitFile = import('../src/opus-bay/world/sf/format').TransitFile;
type TransitLine = import('../src/opus-bay/world/sf/format').TransitLine;

const FILE = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, '../public/opus-bay/sf/v1/transit-w4.json'), 'utf8')) as TransitFile;
const LOOP = FILE.lines.find(l => l.id === 'sf-loop')! as TransitLine & { speeds: [number, number, number][] };
const pts: [number, number, number][] = [];
for (let i = 0; i < LOOP.path.length; i += 3) pts.push([LOOP.path[i], LOOP.path[i + 1], LOOP.path[i + 2]]);
const minDist = (x: number, z: number) => {
  let d = Infinity;
  for (let i = 1; i < pts.length; i++) {
    const [ax, , az] = pts[i - 1], [bx, , bz] = pts[i], dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2));
    d = Math.min(d, Math.hypot(x - ax - dx * t, z - az - dz * t));
  }
  return d;
};

test('the loop: 16 stops in plan order from the Ferry Building, closed, ≈ 6,522 u, valid', () => {
  assert.deepEqual(transitLineProblems(LOOP), []);
  assert.equal(LOOP.kind, 'bus');
  assert.equal(LOOP.loop, true);
  assert.equal(LOOP.doubleEnded, false);
  assert.equal(LOOP.short, '观光');
  assert.ok(Math.abs(LOOP.length - 6522) < 6522 * 0.05, `loop ${LOOP.length} u`);
  assert.deepEqual(LOOP.stops.map(s => s.id), names.LOOP_STOPS.map(s => s.id));
  assert.equal(LOOP.stops[0].at, 0);
  for (let i = 1; i < LOOP.stops.length; i++) assert.ok(LOOP.stops[i].at - LOOP.stops[i - 1].at > 60, `${LOOP.stops[i].id} spacing`);
  const [a, b] = [pts[0], pts[pts.length - 1]];
  assert.ok(Math.hypot(a[0] - b[0], a[2] - b[2]) < 0.01, 'closes on itself');
  for (const s of LOOP.stops) assert.ok(s.major && s.name.zh && s.name.en, s.id);
});

test('stops sit near their measured kerb points (plan §3.2) and serve the right attractions', () => {
  for (const def of names.LOOP_STOPS) {
    const s = LOOP.stops.find(q => q.id === def.id)!;
    const d = Math.hypot(s.x - def.at.x, s.z - def.at.z);
    assert.ok(d < 40, `${def.id} pole ${d.toFixed(1)} u from the plan point`);
    assert.ok(minDist(s.x, s.z) < 4.5 && minDist(s.x, s.z) > 1.5, `${def.id} pole beside the lane (${minDist(s.x, s.z).toFixed(2)} u)`);
  }
  const at = (id: string) => LOOP.stops.find(s => s.id === id)!;
  assert.equal(at('loop-golden-gate-bridge').attractions![0], 'golden-gate-bridge');
  assert.equal(at('loop-painted-ladies').attractions![0], 'alamo-square-painted-ladies');
  assert.ok(at('loop-golden-gate-park').attractions!.includes('cal-academy'));
});

test('every stop attraction id exists in lane P ATTRACTIONS (data/sf/attractions.ts)', async () => {
  const { ATTRACTIONS } = await import('../src/opus-bay/data/sf/attractions');
  const ids = new Set(ATTRACTIONS.map(a => a.id));
  for (const [stop, list] of Object.entries(names.STOP_ATTRACTIONS)) for (const a of list) assert.ok(ids.has(a), `${stop}: ${a}`);
  for (const l of FILE.lines) for (const s of l.stops) for (const a of s.attractions ?? []) assert.ok(ids.has(a), `${l.id} ${s.id}: ${a}`);
});

test('hero: the Embarcadero stops use the hand-made lanes (bayside north lanes, pole on the promenade kerb)', () => {
  for (const [id, st] of [['loop-ferry-building', STATIONS.stopFerry], ['loop-pier-39', STATIONS.stopPier39]] as const) {
    const s = LOOP.stops.find(q => q.id === id)!;
    const f = stationOf({ x: s.x, z: s.z });
    assert.ok(Math.abs(f.st - st) < 1.5, `${id} at station ${f.st}`);
    assert.ok(f.d > -5 && f.d < -3.5, `${id} pole on the promenade kerb (d ${f.d})`);
  }
  // along the north lanes between the two stops the bus stays in d −9.4 … −5 (clear of the F-line platforms)
  for (const [x, , z] of pts) {
    const f = stationOf({ x, z });
    if (f.st > 70 && f.st < 330 && Math.abs(f.d) < 30 && f.d > -12) assert.ok(f.d > -9.4 + 1.2 && f.d < -5 - 1.2 + 2.4, `north lane d ${f.d} at st ${f.st}`);
  }
  assert.ok(LOOP.heroSpans.length >= 1 && LOOP.heroSpans[0][0] === 0, 'the lap starts in the hero');
});

test('car-free streets are avoided (plan R8): JFK Promenade, the Upper Great Highway south of Lincoln Way', () => {
  // JFK Promenade (OSM ways 133856247, 255166632, 27031304: in front of the Conservatory, by the de Young, the Rose Garden)
  for (const [lat, lng] of [[37.77178, -122.46205], [37.77257, -122.46527], [37.77087, -122.47284]]) {
    const p = projectCity(lat, lng);
    assert.ok(minDist(p.x, p.z) > 20, `JFK Drive at ${lat}, ${lng}: ${minDist(p.x, p.z).toFixed(1)} u`);
  }
  // Sunset Dunes (the former Upper Great Highway) at Judah, Noriega and Taraval (Lincoln Way meets the coast at 37.7640)
  for (const [lat, lng] of [[37.7609, -122.5094], [37.7536, -122.5087], [37.7427, -122.5071]]) {
    const p = projectCity(lat, lng);
    assert.ok(minDist(p.x, p.z) > 25, `Upper Great Highway at ${lat}: ${minDist(p.x, p.z).toFixed(1)} u`);
  }
});

test('speeds: contiguous spans over the lap, 12 / 11 / 9 u/s; heights on the terrain; lap ≈ 14 min with dwells', () => {
  const sp = LOOP.speeds;
  assert.equal(sp[0][0], 0);
  assert.ok(Math.abs(sp[sp.length - 1][1] - LOOP.length) < 0.05);
  for (let i = 1; i < sp.length; i++) assert.ok(Math.abs(sp[i][0] - sp[i - 1][1]) < 0.05, `span ${i} contiguous`);
  for (const s of sp) assert.ok([9, 11, 12].includes(s[2]), `speed ${s[2]}`);
  let t = 0;
  for (const [a, b, v] of sp) t += (b - a) / v;
  const lap = t + 16 * 8;
  assert.ok(lap > 10 * 60 && lap < 16 * 60, `lap ≈ ${(lap / 60).toFixed(1)} min`);
  for (const [, y] of pts) assert.ok(y >= 0 && y < 60, `y ${y}`);
});

// ---------------------------------------------------------------------------
// The bus simulation (world/busSystem.ts)
// ---------------------------------------------------------------------------

const platform = await import('../src/opus-bay/actors/platform');
const { BUS, BusSystem, busTrack } = await import('../src/opus-bay/world/busSystem');
const { runSeconds, proximitySpans, trackPoint } = await import('../src/opus-bay/world/lineTrack');
const TRACK = busTrack(LOOP);
const stepN = (sys: InstanceType<typeof BusSystem>, secs: number, dt = 1 / 30, each?: () => void) => { for (let t = 0; t < secs; t += dt) { sys.step(dt); each?.(); } };

test('bus: 10 simulated minutes, 3 buses, no overlap, every stop served with an 8 s dwell, lap ≈ 14 min', () => {
  const sys = new BusSystem(TRACK);
  assert.equal(sys.buses.length, 3);
  const arrivals = new Map<string, number>();
  let worst: string[] = [];
  const dwellStart = new Map<number, number>(), dwells: number[] = [];
  stepN(sys, 600, 1 / 20, () => {
    const v = sys.violations();
    if (v.length) worst = v;
    for (const e of sys.events) {
      if (e.what === 'arrive') { arrivals.set(e.station!, (arrivals.get(e.station!) ?? 0) + 1); dwellStart.set(e.bus, sys.time); }
      if (e.what === 'depart' && dwellStart.has(e.bus)) dwells.push(sys.time - dwellStart.get(e.bus)!);
    }
    sys.events.length = 0;
  });
  assert.deepEqual(worst, []);
  assert.ok(arrivals.size >= 12, `stops served in 10 min: ${arrivals.size}`);
  assert.ok(dwells.length > 20 && dwells.every(d => d >= BUS.dwell - 0.1 && d < BUS.dwell + 3), `dwells ${Math.min(...dwells).toFixed(1)}–${Math.max(...dwells).toFixed(1)} s`);
  const lap = runSeconds(TRACK, 0, -0.01) + 16 * BUS.dwell;
  assert.ok(lap > 11 * 60 && lap < 16 * 60, `lap ${(lap / 60).toFixed(1)} min`);
  for (const b of sys.buses) assert.ok(b.still < 30, `bus ${b.index} still ${b.still.toFixed(1)} s`);
});

test('bus: a waiting rider is picked up within 15 s (dispatch), boards, rides, arrives; ride time within 15 % of the estimate', () => {
  for (const [from, to] of [['loop-palace-of-fine-arts', 'loop-golden-gate-bridge'], ['loop-castro', 'loop-twin-peaks'], ['loop-civic-center', 'loop-chinatown']]) {
    const sys = new BusSystem(TRACK);
    stepN(sys, 7);
    const st = sys.request({ line: 'sf-loop', station: from, to })!;
    assert.ok(st, from);
    let waited = 0;
    while (sys.rideStatus()!.phase === 'coming' && waited < 40) { sys.step(1 / 20); waited += 1 / 20; }
    assert.equal(sys.rideStatus()!.phase, 'here', `${from}: bus there`);
    assert.ok(waited <= 15.5, `${from}: picked up after ${waited.toFixed(1)} s`);
    sys.board();
    const est = sys.rideSeconds(from, to);
    // the ride estimate runs from the doors closing (the dwell left at boarding is the wait)
    let rode = -sys.riderCarOf('sf-loop')!.timer;
    while (sys.rideStatus()!.phase !== 'arrived' && rode < 400) { sys.step(1 / 20); rode += 1 / 20; }
    assert.equal(sys.rideStatus()!.phase, 'arrived', `${from} → ${to}`);
    assert.equal(sys.rideStatus()!.lastStation, to);
    assert.ok(Math.abs(rode - est) < est * 0.15 + 3, `${from} → ${to}: rode ${rode.toFixed(1)} s, estimated ${est.toFixed(1)} s`);
    sys.cancel();
  }
});

test('bus: approach fires ≈ 60 u before each stop with the stop attraction; 下一站下车 ends the ride at the next stop', () => {
  const sys = new BusSystem(TRACK);
  sys.request({ line: 'sf-loop', station: 'loop-ferry-building', to: 'loop-ferry-building' });
  for (let g = 0; sys.rideStatus()!.phase === 'coming' && g < 1200; g++) sys.step(1 / 20);
  sys.board();
  const bus = sys.riderCarOf('sf-loop')!;
  const seen: { station: string; d: number; attraction?: string }[] = [];
  stepN(sys, 200, 1 / 20, () => {
    for (const e of sys.events) if (e.what === 'approach' && e.bus === bus.index) {
      const stop = TRACK.stops.find(s => s.id === e.station)!;
      const d = ((stop.at - bus.s) % TRACK.length + TRACK.length) % TRACK.length;
      seen.push({ station: e.station!, d, attraction: e.attraction });
    }
    sys.events.length = 0;
  });
  assert.ok(seen.length >= 2, `approaches ${seen.length}`);
  for (const a of seen) assert.ok(a.d <= BUS.approach + 0.5 && a.d > BUS.approach - 20, `${a.station} at ${a.d.toFixed(1)} u`);
  assert.equal(seen.find(a => a.station === 'loop-pier-39')?.attraction, 'pier-39');
  assert.equal(sys.rideStatus()!.phase, 'riding', 'a full lap is still riding');
  const next = sys.requestNextStop()!;
  let t = 0;
  while (sys.rideStatus()!.phase !== 'arrived' && t < 200) { sys.step(1 / 20); t += 1 / 20; }
  assert.equal(sys.rideStatus()!.lastStation, next);
});

test('bus: a hop-off request brakes to 0 within the asked time and pulls to the kerb; release lets it go', () => {
  const sys = new BusSystem(TRACK);
  sys.request({ line: 'sf-loop', station: 'loop-pier-39', to: 'loop-palace-of-fine-arts' });
  for (let g = 0; sys.rideStatus()!.phase === 'coming' && g < 1200; g++) sys.step(1 / 20);
  sys.board();
  const bus = sys.riderCarOf('sf-loop')!;
  let t = 0;
  while (bus.v < 8 && t < 60) { sys.step(1 / 20); t += 1 / 20; }
  assert.ok(bus.v >= 8, 'at speed');
  platform.requestPlatformStop('sf-loop', 1.4);
  const s0 = bus.s;
  let k = 0;
  while (bus.v > 0.02 && k < 200) { sys.step(1 / 60); k++; }
  assert.ok(k / 60 <= 1.6, `stopped in ${(k / 60).toFixed(2)} s`);
  stepN(sys, 2, 1 / 60);
  assert.ok(Math.abs(bus.s - s0) < 12 && bus.mode === 'hold', 'holds');
  assert.ok(bus.lateral > 0.3, `kerb shift ${bus.lateral.toFixed(2)}`);
  platform.releasePlatformStop('sf-loop');
  stepN(sys, 3, 1 / 30);
  assert.ok(bus.v > 1, 'goes on after the release');
});

test('bus: interlocks — the bus waits before a shared box while the other line is inside, and occupies() reports it', () => {
  const T2 = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, '../public/opus-bay/sf/v1/transit.json'), 'utf8')) as TransitFile;
  const cable = (id: string) => {
    const l = T2.lines.find(q => q.id === id)!;
    const n = l.path.length / 3, xyz = new Float32Array(l.path), cum = new Float32Array(n);
    for (let i = 1; i < n; i++) cum[i] = cum[i - 1] + Math.hypot(xyz[i * 3] - xyz[i * 3 - 3], xyz[i * 3 + 2] - xyz[i * 3 - 1]);
    return { xyz, cum, length: cum[n - 1], loop: false };
  };
  const spans = [...proximitySpans(TRACK, cable('powell-hyde'), 2.6), ...proximitySpans(TRACK, cable('powell-mason'), 2.6), ...proximitySpans(TRACK, cable('california'), 2.6)];
  assert.ok(spans.length >= 2, `bus × cable-car spans: ${spans.length}`);
  const bush = spans.find(s => { const p = trackPoint(TRACK, (s.a0 + s.a1) / 2); return Math.hypot(p.x - 61, p.z - 208) < 20; });
  assert.ok(bush, 'Bush × Powell crossing found');
  let blocked = true;
  const box = { id: 'bush-powell', a0: bush!.a0 - 1.5, a1: bush!.a1 + 1.5, blocked: () => blocked };
  const sys = new BusSystem(TRACK, { boxes: [box], count: 1 });
  const b = sys.buses[0];
  b.s = box.a0 - 120; b.mode = 'run'; b.v = 8; b.next = sys.stopIndex('loop-chinatown');
  sys.updatePose(b);
  stepN(sys, 40, 1 / 30);
  assert.ok(!sys.occupies('bush-powell'), 'waits outside while blocked');
  assert.ok(b.waitBox === 0 && b.v < 0.05, 'standing before the box');
  blocked = false;
  let inside = false;
  stepN(sys, 30, 1 / 30, () => { if (sys.occupies('bush-powell')) inside = true; });
  assert.ok(inside, 'drives through once clear');
});

test('bus: stop poles stand at the right kerb of the bus lane', () => {
  for (const s of LOOP.stops) {
    const p = trackPoint(TRACK, s.at);
    const rx = -Math.cos(p.heading), rz = Math.sin(p.heading);
    const side = (s.x - p.x) * rx + (s.z - p.z) * rz;
    assert.ok(side > 1.5 && side < 4.5, `${s.id} pole side ${side.toFixed(2)}`);
  }
});
