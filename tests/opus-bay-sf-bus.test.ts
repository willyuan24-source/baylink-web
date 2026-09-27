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
