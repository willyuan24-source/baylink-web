// W6-W1 · the North Beach seam fill (sf-w5-summary NEXT #15, sf-w5-L.md "Known gaps").
//
//   npx tsx --tsconfig tsconfig.app.json scripts/opus-sf/seam-fill.mts [--dry]
//
// The offline build (scripts/opus-sf/build.ts, lib/buildings.ts heroSeam) drops every OSM building of a city block that
// lies ≥ 60 % inside the hero slab: the hand-made district is supposed to draw those blocks. The district's lot
// generator (data/district.ts §12) leaves the slab's south band empty (Washington Square, Columbus Ave, upper Grant,
// the Saints Peter and Paul block: its grid lots there fail `inSlab(p, 1.2)` or the building-line clip), so in city mode
// that band was bare fallback pavement two blocks deep.
//
// This script re-runs the build's building steps (land, terrain, roads + blocks, load / merge / carve, the seam rule)
// on the same raw snapshots and gives back the buildings of the hero-owned blocks where **no district lot stands**,
// finished exactly as the build finishes them (style, roof, palette, toy height), with two seam-specific rules:
//   - base = the hero ground (core/terrain heightAt in district mode: inside the slab the city walks on the hero's
//     heights, seam rule 2), the lowest point of the footprint;
//   - a building crossed by (or within 0.5 u of) an edge of the published walking graph (service alleys), or within 0.05 u of a district street ribbon (roadway / path half-width: the city carves its footprints 1.8 u off a residential centreline, the district ribbon is 1.6 u half-wide), a district lot, a hero exclusion
//     (the ramps, Levi's, Coit …) or Washington Square's lawn is left out, so the district's own streets stay open.
// Writes src/opus-bay/world/sf/cornersSeamData.ts (world/sf/build.ts addSeamFill appends the rows to their chunks in
// the stream worker: drawn by the city's own L0 / L1 recipes, collision rasterised like any city building).
import fs from 'node:fs';
import path from 'node:path';
import { heightAt } from '../../src/opus-bay/core/terrain';
import { DISTRICT } from '../../src/opus-bay/data/district';
import { NB_CHURCH_OSM, NB_CHURCH_SETBACK, NB_FRONT, NB_SQUARE, SEAM_REGION, nbDropLots } from '../../src/opus-bay/world/sf/cornersNB';
import { loadAreas } from './lib/areas';
import { carve, finishBuildings, heroExclusions, heroSeam, landmarkOsmIds, loadBuildings, mergeLots, HERO_OWN } from './lib/buildings';
import { buildLand, loadBoundaryRings, loadCoast } from './lib/land';
import { buildBlocks, blockAt, loadWays, segIndex } from './lib/roads';
import { loadDem } from './lib/io';
import { buildTerrain } from './lib/terrain';
import { loadZones } from './lib/zones';
import { unproject } from '../../src/opus-bay/core/geo';
import { decodeGraphFile } from '../../src/opus-bay/world/sf/format';

const REPO = path.resolve(import.meta.dirname, '../..');
const OUT = path.join(REPO, 'src/opus-bay/world/sf/cornersSeamData.ts');
const log = (s: string) => console.log(s);

const coast = loadCoast();
const dem = loadDem();
const land = buildLand(coast, loadBoundaryRings(), dem, log);
const insideSf = (x: number, z: number) => { if (land.inside.at(x, z) !== 1) return false; const ll = unproject({ x, z }); return !(ll.lat > 37.815 && ll.lng < -122.44); };
const terrain = buildTerrain(dem, log);
const { ways, plazas } = loadWays(log, insideSf);
const blocks = buildBlocks(ways, land, log);
const areas = loadAreas(land, plazas, log);
const zones = loadZones(log);
const rawB = loadBuildings(land, areas, blocks, landmarkOsmIds(), log);
const streetIx = segIndex(ways, w => ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'residential', 'pedestrian'].includes(w.cls) && !(w.flags & 64));
const merged = mergeLots(rawB, streetIx, log);
const carveIx = segIndex(ways, w => (w.walk || !!(w.flags & 128)) && !['footway', 'path', 'cycleway', 'track'].includes(w.cls));
const carved = carve(merged, carveIx, log);
const seam = heroSeam(carved, blocks, log);
const kept = new Set(seam.kept);

type P = { x: number; z: number };
function inPoly(x: number, z: number, p: readonly P[]) {
  let c = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const a = p[i], b = p[j]; if ((a.z > z) !== (b.z > z) && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) c = !c; }
  return c;
}
function segD(x: number, z: number, ax: number, az: number, bx: number, bz: number) {
  const dx = bx - ax, dz = bz - az, l = dx * dx + dz * dz, t = l ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l)) : 0;
  return Math.hypot(x - ax - dx * t, z - az - dz * t);
}
function ringDist(x: number, z: number, p: readonly P[]) {
  let d = Infinity;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) d = Math.min(d, segD(x, z, p[j].x, p[j].z, p[i].x, p[i].z));
  return d;
}
const ringPts = (r: number[]) => { const o: P[] = []; for (let k = 0; k < r.length; k += 2) o.push({ x: r[k], z: r[k + 1] }); return o; };

// district lots by city block: a block with any district lot centroid is the district's
const nbDrop = new Set(nbDropLots(DISTRICT.blocks));
const lots = DISTRICT.blocks.filter((_, i) => !nbDrop.has(i));
log(`district lots hidden for the church: ${[...nbDrop].map(i => DISTRICT.blocks[i].id).join(", ")}`);
const lotBlocks = new Set<number>();
for (const lot of lots) {
  const c = lot.footprint.reduce((s, p) => ({ x: s.x + p.x / lot.footprint.length, z: s.z + p.z / lot.footprint.length }), { x: 0, z: 0 });
  const b = blockAt(blocks, c.x, c.z, 2);
  if (b > 0) lotBlocks.add(b);
}
const ex = heroExclusions();
const graph = await decodeGraphFile(new Uint8Array(fs.readFileSync(path.join(REPO, 'public/opus-bay/sf/v1/graph.obc'))));
const graphSegs: [number, number, number, number][] = [];
for (let i = 0; i < graph.nodeCount; i++) for (let e = graph.offsets[i]; e < graph.offsets[i + 1]; e++) {
  const j = graph.targets[e], ax = graph.xyz[3 * i], az = graph.xyz[3 * i + 2], bx = graph.xyz[3 * j], bz = graph.xyz[3 * j + 2];
  if (j > i && (inPoly(ax, az, DISTRICT.slab) || inPoly(bx, bz, DISTRICT.slab)) && Math.min(ax, bx) <= SEAM_REGION.xMax + 10 && Math.max(az, bz) >= SEAM_REGION.zMin - 10) graphSegs.push([ax, az, bx, bz]);
}
const roads =DISTRICT.roads.filter(r => r.kind === 'roadway' || r.kind === 'path');
function clear(ring: P[]): string | null {
  const probes = [...ring, ring.reduce((s, p) => ({ x: s.x + p.x / ring.length, z: s.z + p.z / ring.length }), { x: 0, z: 0 })];
  // the edges too (a long wall can cross a thin ribbon between two corners)
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) for (const t of [0.25, 0.5, 0.75]) probes.push({ x: ring[j].x + (ring[i].x - ring[j].x) * t, z: ring[j].z + (ring[i].z - ring[j].z) * t });
  for (const p of probes) {
    for (const r of roads) for (let s = 1; s < r.points.length; s++) if (segD(p.x, p.z, r.points[s - 1].x, r.points[s - 1].z, r.points[s].x, r.points[s].z) < r.width / 2 + 0.05) return `street ${r.id}`;
    for (const lot of lots) if (inPoly(p.x, p.z, lot.footprint) || ringDist(p.x, p.z, lot.footprint) < 0.4) return `lot ${lot.id}`;
    for (const q of ex.polys) if (inPoly(p.x, p.z, ringPts(q)) || ringDist(p.x, p.z, ringPts(q)) < 0.8) return 'exclusion poly';
    for (const [ox, oz, rr] of ex.circles) if (Math.hypot(p.x - ox, p.z - oz) < rr + 0.8) return 'exclusion circle';
    for (const l of ex.lines) for (let i = 2; i < l.pts.length; i += 2) if (segD(p.x, p.z, l.pts[i - 2], l.pts[i - 1], l.pts[i], l.pts[i + 1]) < l.r + 0.8) return 'exclusion line';
    if (inPoly(p.x, p.z, NB_SQUARE) || ringDist(p.x, p.z, NB_SQUARE) < 0.4) return 'washington square';
  }
  for (const lot of lots) for (const q of lot.footprint) if (inPoly(q.x, q.z, ring)) return `lot ${lot.id} inside`;
  // the published walking graph (the game's routes): no edge may run through the building (service alleys do)
  for (const [ax, az, bx, bz] of graphSegs) {
    const L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(L / 0.4));
    for (let k = 0; k <= n; k++) { const x = ax + ((bx - ax) * k) / n, z = az + ((bz - az) * k) / n; if (inPoly(x, z, ring) || ringDist(x, z, ring) < 0.5) return 'graph edge'; }
  }
  return null;
}

/** The church's nave set back behind its front (the steps, the towers' feet and route r1's stop stand in front). */
function setBack(r: number[]): number[] {
  const { a, n } = NB_FRONT, d = (x: number, z: number) => (x - a.x) * n.x + (z - a.z) * n.z + NB_CHURCH_SETBACK;
  const out: number[] = [], m = r.length / 2;
  for (let i = 0; i < m; i++) {
    const j = (i + 1) % m, x0 = r[2 * i], z0 = r[2 * i + 1], x1 = r[2 * j], z1 = r[2 * j + 1], d0 = d(x0, z0), d1 = d(x1, z1);
    if (d0 <= 0) out.push(x0, z0);
    if ((d0 < 0) !== (d1 < 0)) { const t = d0 / (d0 - d1); out.push(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t); }
  }
  return out;
}
for (const b of carved) if (b.osmId === NB_CHURCH_OSM) { b.ring = setBack(b.ring); log(`church ${b.osmId}: nave set back ${NB_CHURCH_SETBACK} u (${b.ring.length / 2} vertices, members ${b.members})`); }
const cand = carved.filter(b => !kept.has(b) && blocks.slabFrac[b.block] >= HERO_OWN && !lotBlocks.has(b.block) && !b.onPier && inPoly(b.cx, b.cz, DISTRICT.slab) && b.cx <= SEAM_REGION.xMax && b.cz >= SEAM_REGION.zMin);
const why = new Map<string, number>();
const pass = cand.filter(b => { const w = clear(ringPts(b.ring)); if (w) why.set(w.split(' ')[0], (why.get(w.split(' ')[0]) ?? 0) + 1); return !w; });
const fin = finishBuildings(pass, zones, terrain, new Set(), log);
log(`seam fill: ${cand.length} candidates in ${new Set(cand.map(b => b.block)).size} empty hero-owned blocks, ${pass.length} clear (${[...why].map(([k, n]) => `${k} ${n}`).join(', ')}), ${fin.length} finished`);

const r2 = (v: number) => Math.round(v * 100) / 100;
const rows = fin.map(b => {
  const ring = ringPts(b.ring);
  let base = Infinity;
  for (const p of [...ring, { x: b.cx, z: b.cz }]) base = Math.min(base, heightAt(p.x, p.z));
  return { osm: b.osmId, s: b.style, r: b.roof, p: b.palette, f: b.flags, h: r2(b.H), y: r2(Math.max(0, base)), xz: b.ring.map(r2) };
}).sort((a, b) => a.osm - b.osm);
const xs = rows.flatMap(r => r.xz.filter((_, i) => i % 2 === 0)), zs = rows.flatMap(r => r.xz.filter((_, i) => i % 2 === 1));
log(`box x ${Math.min(...xs)}…${Math.max(...xs)} z ${Math.min(...zs)}…${Math.max(...zs)}; H ${Math.min(...rows.map(r => r.h))}…${Math.max(...rows.map(r => r.h))}`);
if (process.argv.includes('--dry')) {
  const byBlock = new Map<number, typeof fin>();
  for (const b of fin) (byBlock.get(b.block) ?? byBlock.set(b.block, []).get(b.block)!).push(b);
  for (const [blk, l] of byBlock) log(`  block ${blk}: ${l.length} at (${(l.reduce((s, b) => s + b.cx, 0) / l.length).toFixed(0)}, ${(l.reduce((s, b) => s + b.cz, 0) / l.length).toFixed(0)}) ${l.map(b => b.zone).filter((z, i, a) => a.indexOf(z) === i).join('/')}`);
  process.exit(0);
}

const body = rows.map(r => `  [${r.osm}, ${r.s}, ${r.r}, ${r.p}, ${r.f}, ${r.h}, ${r.y}, [${r.xz.join(', ')}]],`).join('\n');
fs.writeFileSync(OUT, `// GENERATED by scripts/opus-sf/seam-fill.mts (W6-W1) from the raw snapshots in C:/Users/willy/opus-qa/sf-data — do not edit.
// The North Beach seam: OSM buildings (© OpenStreetMap contributors, ODbL) of the hero-owned city blocks that the
// district leaves empty, finished like the offline build's (styles, palettes, toy heights); base = the hero ground.

/** [osmId, style, roof, palette, flags, toy height, baseY, footprint x, z pairs (CCW from above)] */
export type SeamRow = readonly [number, number, number, number, number, number, number, readonly number[]];

export const SEAM_FILL: readonly SeamRow[] = [
${body}
];
`);
log(`wrote ${OUT} (${rows.length} rows)`);
