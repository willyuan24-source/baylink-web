import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import * as geo from '../src/opus-bay/core/geo';
import { pointInPolygon } from '../src/opus-bay/core/terrain';
import { DISTRICT } from '../src/opus-bay/data/district';
import {
  AREA_CLASSES, BUILDING_FLAG, CHUNK_FLAG, type ChunkData, DEM_N, FORMAT_VERSION, type PlacesFile, type SfCurrent, type SfManifest, type TransitFile,
  computeDistrictHash, decodeChunkFile, decodeFarFile, decodeGraphFile,
} from '../src/opus-bay/world/sf/format';

const ROOT = path.resolve(import.meta.dirname, '../public/opus-bay/sf');
const current = JSON.parse(fs.readFileSync(path.join(ROOT, 'current.json'), 'utf8')) as SfCurrent;
const BASE = path.join(ROOT, current.version);
const manifest = JSON.parse(fs.readFileSync(path.join(BASE, 'manifest.json'), 'utf8')) as SfManifest;
const places = JSON.parse(fs.readFileSync(path.join(BASE, 'places.json'), 'utf8')) as PlacesFile;
const transit = JSON.parse(fs.readFileSync(path.join(BASE, 'transit.json'), 'utf8')) as TransitFile;
const file = (f: string) => new Uint8Array(fs.readFileSync(path.join(BASE, f)));
const KB = 1024;

let chunkCache: Map<string, ChunkData> | null = null;
async function chunks(): Promise<Map<string, ChunkData>> {
  if (chunkCache) return chunkCache;
  const m = new Map<string, ChunkData>();
  for (const c of manifest.chunks) m.set(c.k, await decodeChunkFile(file(`c/${c.k}.obc`)));
  chunkCache = m;
  return m;
}
const ringAt = (a: ChunkData['areas'], i: number) => {
  const out: { x: number; z: number }[] = [];
  for (let p = a.pStart[i]; p < a.pStart[i + 1]; p++) out.push({ x: a.xz[p * 2], z: a.xz[p * 2 + 1] });
  return out;
};
/** land / pier deck under a point, painter's order over the chunk's land + water + pier rings */
function solidAt(m: Map<string, ChunkData>, x: number, z: number): boolean {
  const { cx, cz } = geo.chunkOf(x, z);
  const c = m.get(geo.chunkKey(cx, cz));
  if (!c) return false;
  let solid = false;
  const LAND = AREA_CLASSES.indexOf('land'), WATER = AREA_CLASSES.indexOf('water'), PIER = AREA_CLASSES.indexOf('pier');
  for (let i = 0; i < c.areas.count; i++) {
    const k = c.areas.cls[i];
    if (k !== LAND && k !== WATER && k !== PIER) continue;
    if (pointInPolygon({ x, z }, ringAt(c.areas, i))) solid = k !== WATER || (c.areas.flags[i] & 1) === 1;
  }
  return solid;
}

test('manifest: format, geo constants, district hash, hero drop lots', () => {
  assert.equal(manifest.format, 'opus-sf');
  assert.equal(manifest.formatVersion, FORMAT_VERSION);
  assert.equal(manifest.version, current.version);
  assert.equal(manifest.geo.K, geo.K); assert.equal(manifest.geo.ROT_DEG, geo.ROT_DEG);
  assert.equal(manifest.geo.LAT0, geo.LAT0); assert.equal(manifest.geo.LNG0, geo.LNG0);
  assert.deepEqual(manifest.geo.curve, { ...geo.TERRAIN_CURVE });
  assert.deepEqual(manifest.geo.warp.ends, geo.WATERFRONT_WARP.map(e => ({ ...e })));
  assert.equal(manifest.chunk, geo.CHUNK); assert.equal(manifest.cell, geo.CELL);
  assert.equal(manifest.districtHash, computeDistrictHash(DISTRICT), 'published city was cut against this district.ts');
  assert.equal(new Set(manifest.heroDropLots).size, manifest.heroDropLots.length);
  for (const i of manifest.heroDropLots) assert.ok(Number.isInteger(i) && i >= 0 && i < DISTRICT.blocks.length, `heroDropLots ${i}`);
  assert.ok(manifest.attribution.some(a => a.includes('OpenStreetMap')));
  assert.ok(fs.existsSync(path.join(BASE, 'ATTRIBUTION.md')));
});

test('chunk files: ≈ 195 land chunks, hashes match, size budgets hold', () => {
  const land = manifest.chunks.filter(c => c.land).length;
  assert.ok(land >= 180 && land <= 210, `${land} land chunks`);
  let total = 0;
  for (const c of manifest.chunks) {
    const b = file(`c/${c.k}.obc`);
    assert.equal(b.length, c.bytes, `${c.k} size`);
    assert.equal(crypto.createHash('sha256').update(b).digest('hex'), c.sha256, `${c.k} sha256`);
    assert.ok(b.length <= 40 * KB, `${c.k} ${b.length} B > 40 KB`);
    total += b.length;
  }
  assert.ok(total / manifest.chunks.length <= 22 * KB, 'mean chunk ≤ 22 KB');
  const far = file('far.obc'), graph = file('graph.obc');
  assert.equal(far.length, manifest.far.bytes); assert.ok(far.length <= 400 * KB);
  assert.equal(graph.length, manifest.graph.bytes); assert.ok(graph.length <= 800 * KB);
  assert.ok(total + far.length + graph.length <= 5 * 1024 * KB, 'total ≤ 5 MB');
});

test('chunks decode; flags, DEM seams and building budget are consistent', async () => {
  const m = await chunks();
  let buildings = 0;
  for (const e of manifest.chunks) {
    const c = m.get(e.k)!;
    assert.equal(c.cx, e.cx); assert.equal(c.cz, e.cz);
    assert.equal((c.flags & CHUNK_FLAG.land) !== 0, e.land);
    assert.equal(c.buildings.count, e.buildings);
    buildings += c.buildings.count;
    for (let i = 0; i < c.buildings.count; i++) {
      const nv = c.buildings.vStart[i + 1] - c.buildings.vStart[i];
      assert.ok(nv >= 3 && nv <= 12, `${e.k} building ${i}: ${nv} vertices`);
      assert.ok(c.buildings.height[i] >= 3.6 - 0.01, 'height ≥ 3.6');
    }
    // shared DEM edges are identical with the east / south neighbour
    const east = m.get(geo.chunkKey(c.cx + 1, c.cz)), south = m.get(geo.chunkKey(c.cx, c.cz + 1));
    for (let j = 0; j < DEM_N; j++) {
      if (east) assert.ok(Math.abs(c.dem.y[j * DEM_N + DEM_N - 1] - east.dem.y[j * DEM_N]) < 1e-3, `${e.k} east seam`);
      if (south) assert.ok(Math.abs(c.dem.y[(DEM_N - 1) * DEM_N + j] - south.dem.y[j]) < 1e-3, `${e.k} south seam`);
    }
  }
  assert.ok(buildings <= 60000 && buildings > 30000, `${buildings} toy buildings`);
  assert.equal(buildings, manifest.counts.buildings);
});

test('hero seam: no city building in hero-owned ground or touching a kept hero lot', async () => {
  const m = await chunks();
  const drop = new Set(manifest.heroDropLots);
  const kept = DISTRICT.blocks.filter((_, i) => !drop.has(i)).map(b => b.footprint);
  for (const e of manifest.chunks.filter(c => c.hero)) {
    const c = m.get(e.k)!;
    for (let i = 0; i < c.buildings.count; i++) {
      const pts: { x: number; z: number }[] = [];
      for (let v = c.buildings.vStart[i]; v < c.buildings.vStart[i + 1]; v++) pts.push({ x: c.buildings.xz[v * 2], z: c.buildings.xz[v * 2 + 1] });
      const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length, cz = pts.reduce((s, p) => s + p.z, 0) / pts.length;
      if (pointInPolygon({ x: cx, z: cz }, DISTRICT.slab)) assert.ok(c.buildings.flags[i] & BUILDING_FLAG.seam, `${e.k} building ${i} inside the slab must be in a city-owned seam block`);
      for (const lot of kept) {
        for (const p of pts) assert.ok(!pointInPolygon(p, lot), `${e.k} building ${i} overlaps a hero lot`);
        for (const q of lot) assert.ok(!pointInPolygon(q, pts), `${e.k} hero lot inside building ${i}`);
      }
    }
  }
});

test('places: curated landmarks and POIs stand on SF land (or a pier) and link real sources', async () => {
  const m = await chunks();
  assert.ok(places.places.length >= 500);
  const ids = new Set<string>();
  for (const p of places.places) {
    assert.ok(!ids.has(p.id), `duplicate place ${p.id}`); ids.add(p.id);
    assert.ok(p.name.en && p.name.zh, `${p.id} names`);
    assert.match(p.sourceUrl, /^https:\/\/www\.openstreetmap\.org\//, `${p.id} source`);
    assert.match(p.verifiedAt, /^\d{4}-\d{2}-\d{2}$/);
    // bridge towers stand in the Golden Gate, lakes are water; hero places use the district's own ground
    if (p.kind === 'bridge' || p.kind === 'water' || p.hero) continue;
    let ok = false;
    for (const [dx, dz] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) if (solidAt(m, p.x + dx, p.z + dz)) { ok = true; break; }
    assert.ok(ok, `${p.id} (${p.x}, ${p.z}) is not on SF land`);
  }
  const curated = places.places.filter(p => p.curated);
  assert.equal(curated.length, 69);
  const planner = curated.filter(p => p.plannerId);
  assert.ok(planner.length >= 5);
  const catalog = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, '../public/planner-catalog.json'), 'utf8')) as { places: { id: string }[] };
  for (const p of planner) assert.ok(catalog.places.some(c => c.id === p.plannerId), `${p.id} planner id ${p.plannerId} exists`);
});

test('walking graph: connected from the Ferry Building to Twin Peaks, Ocean Beach, Fort Point and the Mission', async () => {
  const g = await decodeGraphFile(file('graph.obc'));
  assert.equal(g.nodeCount, manifest.graph.nodes);
  const near = (x: number, z: number, r: number) => {
    let best = -1, bd = r * r;
    for (let i = 0; i < g.nodeCount; i++) { const d = (g.xyz[i * 3] - x) ** 2 + (g.xyz[i * 3 + 2] - z) ** 2; if (d < bd) { bd = d; best = i; } }
    return best;
  };
  const gate = DISTRICT.anchors['ferry-gate'];
  const start = near(gate.x, gate.z, 40);
  assert.ok(start >= 0, 'a graph node within 40 u of the ferry gate');
  const seen = new Uint8Array(g.nodeCount);
  const stack = [start];
  seen[start] = 1;
  let reached = 0;
  while (stack.length) {
    const v = stack.pop()!;
    reached++;
    for (let e = g.offsets[v]; e < g.offsets[v + 1]; e++) { const t = g.targets[e]; assert.ok(g.cost[e] > 0); if (!seen[t]) { seen[t] = 1; stack.push(t); } }
  }
  assert.ok(reached >= g.nodeCount * 0.9, `ferry gate reaches ${reached} / ${g.nodeCount} nodes`);
  for (const [name, x, z] of [['Twin Peaks', 140, 947], ['Ocean Beach', -431, 1475], ['Fort Point', -750, 595], ['Mission Dolores', 195.5, 647.6], ['Coit Tower', -50, 51], ['Bernal Heights', 525.6, 778]] as const) {
    const n = near(x, z, 40);
    assert.ok(n >= 0 && seen[n], `${name} reachable from the ferry gate`);
  }
  const snapped = places.places.filter(p => !p.hero && p.graphNode >= 0);
  for (const p of snapped) assert.ok(seen[p.graphNode], `${p.id} snapped into the connected graph`);
  assert.ok(snapped.length >= places.places.filter(p => !p.hero).length * 0.9);
});

test('transit and far city', async () => {
  const want: Record<string, number> = { 'powell-hyde': 456, 'powell-mason': 346, california: 320, 'f-line': 1136 };
  assert.deepEqual(transit.lines.map(l => l.id).sort(), Object.keys(want).sort());
  for (const l of transit.lines) {
    assert.ok(Math.abs(l.length - want[l.id]) < want[l.id] * 0.15, `${l.id} length ${l.length}`);
    assert.ok(l.stops.length >= 10, `${l.id} stops`);
    for (let i = 1; i < l.stops.length; i++) assert.ok(l.stops[i].at >= l.stops[i - 1].at);
    for (let i = 1; i < l.path.length; i += 3) assert.ok(l.path[i] >= 0 && l.path[i] < 60, `${l.id} y`);
    assert.match(l.sourceUrl, /openstreetmap\.org\/relation\//);
  }
  assert.ok(transit.lines.find(l => l.id === 'powell-hyde')!.turntables.length >= 1);
  const far = await decodeFarFile(file('far.obc'));
  assert.equal(far.zones.length, 41);
  assert.ok(far.names.includes('Market Street'));
  assert.ok(far.prisms.count > 3000);
  assert.ok(far.landmarks.some(l => l.id === 'sutro-tower' && l.height > 30));
  assert.equal(far.dem.cols * far.dem.rows, far.dem.y.length);
});
