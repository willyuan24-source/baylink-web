// W6-W1 · the North Beach seam fill (sf-w5-summary NEXT #15, sf-w5-L.md "Known gaps"); W7-W1 · the Financial District's
// south edge too (world/sf/cornersNB.ts SEAM_REGIONS, a list of rectangles; --why names every candidate left out).
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
// on the same raw snapshots and gives back the buildings of the hero-owned blocks where **no district lot stands**
// (in the regions of SEAM_REGIONS),
// finished exactly as the build finishes them (style, roof, palette, toy height), with two seam-specific rules:
//   - base = the hero ground (core/terrain heightAt in district mode: inside the slab the city walks on the hero's
//     heights, seam rule 2), the lowest point of the footprint;
//   - a building crossed by (or within 0.5 u of) an edge of the published walking graph (service alleys), or within 0.05 u of a district street ribbon (roadway / path / track / crosswalk half-width: the city carves its footprints 1.8 u off a residential centreline, the district ribbon is 1.6 u half-wide), a district walk area or prop or a transit board spot (W7-W1), a district lot, a hero exclusion
//     (the ramps, Levi's, Coit …) or Washington Square's lawn is left out, so the district's own streets stay open.
// Writes src/opus-bay/world/sf/cornersSeamData.ts (world/sf/build.ts addSeamFill appends the rows to their chunks in
// the stream worker: drawn by the city's own L0 / L1 recipes, collision rasterised like any city building).
import fs from 'node:fs';
import path from 'node:path';
import { heightAt } from '../../src/opus-bay/core/terrain';
import { DISTRICT } from '../../src/opus-bay/data/district';
import { NB_CHURCH_OSM, NB_CHURCH_SETBACK, NB_FRONT, NB_SQUARE, SEAM_EXTRA_OSM, SEAM_REGIONS, SENTINEL_OSM, SENTINEL_RING, nbDropLots, seamRegionAt } from '../../src/opus-bay/world/sf/cornersNB';
import { loadAreas } from './lib/areas';
import { carve, finishBuildings, heroExclusions, heroSeam, landmarkOsmIds, loadBuildings, mergeLots, HERO_OWN } from './lib/buildings';
import { buildLand, loadBoundaryRings, loadCoast } from './lib/land';
import { buildBlocks, blockAt, loadWays, segIndex } from './lib/roads';
import { loadDem } from './lib/io';
import { buildTerrain } from './lib/terrain';
import { pickPalette } from './lib/styles';
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
  const near = SEAM_REGIONS.some(r => Math.max(ax, bx) >= r.xMin - 10 && Math.min(ax, bx) <= r.xMax + 10 && Math.max(az, bz) >= r.zMin - 10 && Math.min(az, bz) <= r.zMax + 10);
  if (j > i && (inPoly(ax, az, DISTRICT.slab) || inPoly(bx, bz, DISTRICT.slab)) && near) graphSegs.push([ax, az, bx, bz]);
}
const roads = DISTRICT.roads.filter(r => r.kind === 'roadway' || r.kind === 'path' || r.kind === 'track' || r.kind === 'crosswalk');
// W7-W1: the district's walk areas (plazas, platforms, Rincon Park) and its props (trees, lamps, benches) stay clear too
const walks = DISTRICT.walk.map(w => w.polygon);
const props = DISTRICT.props;
// W7-W1: every wave-4 board spot (public/opus-bay/sf/v1/transit.json props: the poles / kiosks on the sidewalk) keeps
// BOARD_CLEAR u of open ground round it, so a rider put there can walk away (the Muni Embarcadero kiosk on Market St);
// the line stops (on the track / street centreline) STOP_CLEAR u
const BOARD_CLEAR = 2.5, STOP_CLEAR = 1.2;
const transitFile = JSON.parse(fs.readFileSync(path.join(REPO, 'public/opus-bay/sf/v1/transit.json'), 'utf8')) as { lines: { stops: { x: number; z: number }[] }[]; props?: Record<string, [number, number]> };
const stopPts: (P & { r: number })[] = [
  ...transitFile.lines.flatMap(l => l.stops.map(s => ({ x: s.x, z: s.z, r: STOP_CLEAR }))),
  ...Object.values(transitFile.props ?? {}).map(([x, z]) => ({ x, z, r: BOARD_CLEAR })),
];
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
    for (const w of walks) if (inPoly(p.x, p.z, w) || ringDist(p.x, p.z, w) < 0.4) return 'walk area';
  }
  for (const q of props) if (inPoly(q.x, q.z, ring) || ringDist(q.x, q.z, ring) < (q.blockRadius ?? 0.3) + 0.3) return `prop ${q.kind}`;
  for (const q of stopPts) if (inPoly(q.x, q.z, ring) || ringDist(q.x, q.z, ring) < q.r) return 'transit stop';
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
const TRACE = process.argv.includes('--trace') ? Number(process.argv[process.argv.indexOf('--trace') + 1]) : 0;
if (TRACE) {
  const f = (l: { osmId: number; members?: unknown }[]) => l.find(b => b.osmId === TRACE || (Array.isArray(b.members) && b.members.includes(TRACE)));
  const c = carved.find(b => b.osmId === TRACE);
  const r0 = f(rawB) as unknown as { cx: number; cz: number } | undefined;
  if (r0) for (const b of merged) { const rr = ringPts(b.ring); if (inPoly(r0.cx, r0.cz, rr)) log(`  merged ${b.osmId} members ${b.members} H ${b.heightM} block ${b.block} slabFrac ${blocks.slabFrac[b.block]} carved-has ${carved.some(c => c.osmId === b.osmId)} kept ${[...kept].some(c => c.osmId === b.osmId)} lotBlock ${lotBlocks.has(b.block)}`); }
  for (const b of carved) { const rr = ringPts(b.ring); if (r0 && inPoly(r0.cx, r0.cz, rr)) log(`  carved ${b.osmId} members ${b.members}`); }
  log(`trace ${TRACE}: raw ${!!f(rawB)} merged ${!!f(merged)} carved ${!!c} kept ${c ? kept.has(c) : '-'} block ${c?.block} slabFrac ${c ? blocks.slabFrac[c.block] : '-'} lotBlock ${c ? lotBlocks.has(c.block) : '-'} merged-into ${JSON.stringify(merged.filter(b => Array.isArray(b.members) && (b.members as number[]).includes(TRACE)).map(b => b.osmId))}`);
}
const cand = carved.filter(b => !kept.has(b) && blocks.slabFrac[b.block] >= HERO_OWN && !lotBlocks.has(b.block) && !b.onPier && inPoly(b.cx, b.cz, DISTRICT.slab) && !!seamRegionAt(b.cx, b.cz));
const why = new Map<string, number>();
const pass = cand.filter(b => {
  const w = clear(ringPts(b.ring)), k = `${seamRegionAt(b.cx, b.cz)!.id} ${w?.split(' ')[0] ?? 'kept'}`;
  why.set(k, (why.get(k) ?? 0) + 1);
  if (w && process.argv.includes('--why')) log(`  out ${b.osmId} (${b.cx.toFixed(1)}, ${b.cz.toFixed(1)}): ${w}`);
  return !w;
});
// W7-W1: buildings the build merged with a neighbour and then carved away whole (the Sentinel Building's thin
// flatiron): their own raw footprint, when it is clear (world/sf/cornersEastCut.ts dresses them)
const areaOf = (r: readonly number[]) => { let a = 0; for (let i = 0, n = r.length / 2; i < n; i++) { const j = (i + 1) % n; a += r[2 * i] * r[2 * j + 1] - r[2 * j] * r[2 * i + 1]; } return a / 2; };
for (const id of SEAM_EXTRA_OSM) {
  if (pass.some(b => b.osmId === id)) continue;
  const raw = rawB.find(b => b.osmId === id);
  if (!raw) { log(`extra ${id}: not in the raw snapshot`); continue; }
  let b = raw;
  if (id === SENTINEL_OSM) {
    // the toy's footprint in the district's own corner (cornersNB.ts SENTINEL_RING), wound like OSM's ring
    let ring = SENTINEL_RING.flatMap(p => [p.x, p.z]);
    if (Math.sign(areaOf(ring)) !== Math.sign(areaOf(raw.ring))) ring = SENTINEL_RING.slice().reverse().flatMap(p => [p.x, p.z]);
    const c = SENTINEL_RING.reduce((s, p) => ({ x: s.x + p.x / SENTINEL_RING.length, z: s.z + p.z / SENTINEL_RING.length }), { x: 0, z: 0 });
    b = { ...raw, ring, cx: c.x, cz: c.z, area: Math.abs(areaOf(ring)) };
    // the fill's own buildings give way to it
    const sr = [...SENTINEL_RING];
    for (let k = pass.length - 1; k >= 0; k--) {
      const r = ringPts(pass[k].ring);
      if (r.some(p => inPoly(p.x, p.z, sr) || ringDist(p.x, p.z, sr) < 0.3) || sr.some(p => inPoly(p.x, p.z, r))) { log(`  ${pass[k].osmId} gives way to the Sentinel`); pass.splice(k, 1); }
    }
  }
  const w = clear(ringPts(b.ring));
  log(`extra ${id}: ${w ?? 'kept'}`);
  if (!w) pass.push(b);
}
const fin = finishBuildings(pass, zones, terrain, new Set(), log);
log(`seam fill: ${cand.length} candidates in ${new Set(cand.map(b => b.block)).size} empty hero-owned blocks, ${pass.length} clear (${[...why].map(([k, n]) => `${k} ${n}`).join(', ')}), ${fin.length} finished`);

const r2 = (v: number) => Math.round(v * 100) / 100;
// the Sentinel: a plain 'brick' prism under world/sf/cornersEastCut.ts's copper shell (no office crown or mast poking out)
for (const b of fin) if (b.osmId === SENTINEL_OSM) { b.style = 5; b.roof = 0; b.palette = pickPalette('brick', b.osmId, false); }
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
  for (const [blk, l] of byBlock) log(`  block ${blk} ${seamRegionAt(l[0].cx, l[0].cz)!.id}: ${l.length} at (${(l.reduce((s, b) => s + b.cx, 0) / l.length).toFixed(0)}, ${(l.reduce((s, b) => s + b.cz, 0) / l.length).toFixed(0)}) ${l.map(b => b.zone).filter((z, i, a) => a.indexOf(z) === i).join('/')}`);
  process.exit(0);
}

const body = rows.map(r => `  [${r.osm}, ${r.s}, ${r.r}, ${r.p}, ${r.f}, ${r.h}, ${r.y}, [${r.xz.join(', ')}]],`).join('\n');
fs.writeFileSync(OUT, `// GENERATED by scripts/opus-sf/seam-fill.mts (W6-W1, W7-W1) from the raw snapshots in C:/Users/willy/opus-qa/sf-data — do not edit.
// The seam (North Beach and the Financial District's south edge: cornersNB.ts SEAM_REGIONS): OSM buildings
// (© OpenStreetMap contributors, ODbL) of the hero-owned city blocks that the district leaves empty, finished like the
// offline build's (styles, palettes, toy heights); base = the hero ground.

/** [osmId, style, roof, palette, flags, toy height, baseY, footprint x, z pairs (CCW from above)] */
export type SeamRow = readonly [number, number, number, number, number, number, number, readonly number[]];

export const SEAM_FILL: readonly SeamRow[] = [
${body}
];
`);
log(`wrote ${OUT} (${rows.length} rows)`);
