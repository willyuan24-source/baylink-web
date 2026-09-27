// Step 8 (plan §4.8): the always-loaded far city — block prisms at the median height with averaged colours and roof,
// tower boxes, a 16 u DEM, land / park / water polygons, main street polylines, the 41 zones, names and landmark proxies.
import fs from 'node:fs';
import path from 'node:path';
import { buildingH, projectCity, structureY } from '../../../src/opus-bay/core/geo';
import { AREA_CLASSES, type AreaSet, type FarData, type LandmarkProxy, NO_NAME, type PrismSet, type RoadSet } from '../../../src/opus-bay/world/sf/format';
import type { AreaPoly } from './areas';
import type { ToyBuilding } from './buildings';
import { type Ring, area2, ringArea, simplifyRing, simplifyToMax, minRect } from './geom';
import { SF_DATA } from './io';
import { type Land } from './land';
import { traceContours } from './raster';
import { type Blocks, type Chain, TRAM_CODE, simplify3 } from './roads';
import { PALETTES } from './styles';
import { type Terrain, farDem, heightAt } from './terrain';
import { type Zones, simplifiedZoneRings } from './zones';

export const FAR_GRID = { originX: -1000, originZ: -800, step: 16, cols: 157, rows: 185 } as const;

const hex = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

export interface FarBuild { data: FarData; l2Triangles: number; stats: Record<string, number> }

export function buildFar(o: {
  terrain: Terrain; land: Land; blocks: Blocks; buildings: ToyBuilding[]; areas: AreaPoly[]; chains: Chain[];
  zones: Zones; names: string[]; nameIndex: Map<string, number>; log: (s: string) => void;
}): FarBuild {
  const { terrain, land, blocks, buildings, areas, chains, zones, names, nameIndex, log } = o;
  const dem = farDem(terrain, FAR_GRID.originX, FAR_GRID.originZ, FAR_GRID.step, FAR_GRID.cols, FAR_GRID.rows);

  // --- prisms
  const prisms: { kind: number; roof: number; wall: number[]; roofC: number[]; H: number; baseY: number; ring: Ring }[] = [];
  const g = blocks.grid, cols = g.cols;
  const nb = blocks.sizes.length;
  const bx0 = new Int32Array(nb).fill(1 << 30), bx1 = new Int32Array(nb).fill(-1), bz0 = new Int32Array(nb).fill(1 << 30), bz1 = new Int32Array(nb).fill(-1);
  for (let j = 0; j < g.rows; j++) for (let i = 0; i < cols; i++) {
    const b = g.data[j * cols + i];
    if (!b) continue;
    if (i < bx0[b]) bx0[b] = i; if (i > bx1[b]) bx1[b] = i; if (j < bz0[b]) bz0[b] = j; if (j > bz1[b]) bz1[b] = j;
  }
  const members = new Map<number, number[]>();
  let towers = 0, sparse = 0;
  buildings.forEach((b, i) => {
    if (b.heightM >= 60) {
      prisms.push({ kind: 1, roof: 0, wall: hex(PALETTES[b.palette].wall), roofC: hex(PALETTES[b.palette].roof), H: b.H, baseY: b.baseY, ring: simplifyToMax(b.ring, 6, 0.2, 2) });
      towers++;
      return;
    }
    const blk = b.block;
    (members.get(blk) ?? members.set(blk, []).get(blk)!).push(i);
  });
  const addBox = (b: ToyBuilding) => {
    prisms.push({ kind: 0, roof: b.roof, wall: hex(PALETTES[b.palette].wall), roofC: hex(PALETTES[b.palette].roof), H: b.H, baseY: b.baseY, ring: minRect(b.ring) });
  };
  for (const [blk, ids] of members) {
    const list = ids.map(i => buildings[i]);
    const built = list.reduce((s, b) => s + ringArea(b.ring), 0);
    const cells = blk > 0 ? blocks.sizes[blk] : 0;
    if (blk <= 0 || built < cells * 0.15 || cells > 4000) {
      for (const b of list) if (ringArea(b.ring) >= 10) { addBox(b); sparse++; }
      continue;
    }
    // (superblocks > 4000 u²: rail yards, campuses, the waterfront get per-building boxes above)
    // block outline: trace the block's cells (1 u lattice) and simplify to ≤ 6 vertices
    const i0 = bx0[blk] - 1, j0 = bz0[blk] - 1, w = bx1[blk] - bx0[blk] + 3, h = bz1[blk] - bz0[blk] + 3;
    const mask = new Uint8Array(w * h);
    for (let j = 1; j < h - 1; j++) for (let i = 1; i < w - 1; i++) if (g.data[(j0 + j) * cols + i0 + i] === blk) mask[j * w + i] = 1;
    const rings = traceContours(mask, w, h, g.cx(i0), g.cz(j0), 1).filter(r => area2(r) > 0);
    if (!rings.length) continue;
    rings.sort((a, b) => ringArea(b) - ringArea(a));
    // rectangular blocks (most of the grid) become their min-area rectangle: 10 triangles per prism
    const rect = minRect(rings[0]);
    const ring = ringArea(rect) <= ringArea(rings[0]) * 1.25 ? rect : simplifyToMax(rings[0], 6, 1.0, 8);
    // colours / roof: area-weighted; height: area-weighted median roof line above the lowest base
    const wall = [0, 0, 0], roofC = [0, 0, 0], roofVotes = [0, 0, 0];
    let aSum = 0, base = Infinity;
    const tops: [number, number][] = [];
    for (const b of list) {
      const a = ringArea(b.ring);
      const pw = hex(PALETTES[b.palette].wall), pr = hex(PALETTES[b.palette].roof);
      for (let k = 0; k < 3; k++) { wall[k] += pw[k] * a; roofC[k] += pr[k] * a; }
      roofVotes[b.roof] += a; aSum += a; base = Math.min(base, b.baseY);
      tops.push([b.baseY + b.H, a]);
    }
    tops.sort((p, q) => p[0] - q[0]);
    let acc = 0, top = tops[tops.length - 1][0];
    for (const [t, a] of tops) { acc += a; if (acc >= aSum / 2) { top = t; break; } }
    prisms.push({
      kind: 0, roof: roofVotes.indexOf(Math.max(...roofVotes)), wall: wall.map(v => Math.round(v / aSum)), roofC: roofC.map(v => Math.round(v / aSum)),
      H: Math.max(1, top - base), baseY: base, ring,
    });
  }
  const ps: PrismSet = {
    count: prisms.length, kind: Uint8Array.from(prisms.map(p => p.kind)), roof: Uint8Array.from(prisms.map(p => p.roof)),
    wallRgb: Uint8Array.from(prisms.flatMap(p => p.wall)), roofRgb: Uint8Array.from(prisms.flatMap(p => p.roofC)),
    height: Float32Array.from(prisms.map(p => p.H)), baseY: Float32Array.from(prisms.map(p => p.baseY)),
    vStart: new Uint32Array(prisms.length + 1), xz: Float32Array.from(prisms.flatMap(p => p.ring)),
  };
  let v = 0, tris = 0;
  prisms.forEach((p, i) => { ps.vStart[i] = v; const n = p.ring.length / 2; v += n; tris += 3 * n - 2 + (p.roof === 1 ? 2 : 0); });
  ps.vStart[prisms.length] = v;

  // --- areas: land / sea (2 u, simplified) then parks, golf, woods, sand, lakes
  const L = land.grid, ds = 4;
  const w2 = Math.floor(L.cols / ds), h2 = Math.floor(L.rows / ds);
  const coarse = new Uint8Array(w2 * h2);
  for (let j = 0; j < h2; j++) for (let i = 0; i < w2; i++) {
    let s = 0;
    for (let dj = 0; dj < ds; dj++) for (let di = 0; di < ds; di++) s += L.data[(j * ds + dj) * L.cols + i * ds + di];
    coarse[j * w2 + i] = s * 2 >= ds * ds ? 1 : 0;
  }
  const areaRings: { cls: number; ring: Ring; a: number }[] = [];
  for (const r of traceContours(coarse, w2, h2, L.x0 + (ds * L.cell) / 2, L.z0 + (ds * L.cell) / 2, ds * L.cell)) {
    const s = simplifyRing(r, 1.0);
    if (s.length < 6 || ringArea(s) < 40) continue;
    areaRings.push({ cls: area2(r) > 0 ? 0 : 1, ring: s, a: ringArea(s) });
  }
  areaRings.sort((p, q) => q.a - p.a);
  const order = ['park', 'golf', 'forest', 'sand', 'water'];
  const extra = areas.filter(a => order.includes(a.cls) && a.area >= 200).sort((p, q) => order.indexOf(p.cls) - order.indexOf(q.cls) || q.area - p.area);
  const farAreas: { cls: number; hole: boolean; ring: Ring }[] = areaRings.map(r => ({ cls: r.cls, hole: false, ring: r.ring }));
  for (const a of extra) {
    const r = simplifyRing(a.rings[0], 1.0);
    if (r.length < 6) continue;
    farAreas.push({ cls: AREA_CLASSES.indexOf(a.cls), hole: false, ring: r });
    for (const hole of a.rings.slice(1)) { const hr = simplifyRing(hole, 1.0); if (hr.length >= 6 && ringArea(hr) > 60) farAreas.push({ cls: AREA_CLASSES.indexOf(a.cls), hole: true, ring: hr }); }
  }
  const as: AreaSet = { count: farAreas.length, cls: Uint8Array.from(farAreas.map(a => a.cls)), flags: Uint8Array.from(farAreas.map(a => (a.hole ? 1 : 0))), pStart: new Uint32Array(farAreas.length + 1), xz: Float32Array.from(farAreas.flatMap(a => a.ring)) };
  let pc = 0;
  farAreas.forEach((a, i) => { as.pStart[i] = pc; pc += a.ring.length / 2; });
  as.pStart[farAreas.length] = pc;

  // --- main lines
  const lines = chains.filter(c => c.code <= 4 || c.code === TRAM_CODE).map(c => {
    const xz: number[] = [], y: number[] = [];
    for (let k = 0; k < c.xyz.length; k += 3) { xz.push(c.xyz[k], c.xyz[k + 2]); y.push(c.xyz[k + 1]); }
    return { c, p: simplify3(xz, y, 0.8, 0.3) };
  }).filter(l => l.p.length >= 6);
  const rs: RoadSet = {
    count: lines.length, cls: Uint8Array.from(lines.map(l => l.c.code)), width: Float32Array.from(lines.map(l => l.c.width)),
    nameIdx: Uint16Array.from(lines.map(l => (l.c.name ? nameIndex.get(l.c.name) ?? NO_NAME : NO_NAME))), flags: Uint8Array.from(lines.map(l => l.c.flags)),
    pStart: new Uint32Array(lines.length + 1), xyz: Float32Array.from(lines.flatMap(l => l.p)),
  };
  let lp = 0;
  lines.forEach((l, i) => { rs.pStart[i] = lp; lp += l.p.length / 3; });
  rs.pStart[lines.length] = lp;

  // --- zones + zone grid (cell centres on the DEM samples)
  const farZones = zones.list.map(z => ({ id: z.id, zh: z.zh, en: z.en, rings: simplifiedZoneRings(z, 1.5).map(r => ({ hole: r.hole, xz: Float32Array.from(r.xz) })) }));
  const zg = { originX: FAR_GRID.originX - FAR_GRID.step / 2, originZ: FAR_GRID.originZ - FAR_GRID.step / 2, step: FAR_GRID.step, cols: FAR_GRID.cols, rows: FAR_GRID.rows, idx: new Uint8Array(FAR_GRID.cols * FAR_GRID.rows) };
  for (let j = 0; j < zg.rows; j++) for (let i = 0; i < zg.cols; i++) zg.idx[j * zg.cols + i] = zones.grid.at(FAR_GRID.originX + i * FAR_GRID.step, FAR_GRID.originZ + j * FAR_GRID.step);

  // --- landmark proxies (landmarks.json; heights by the §2 policies)
  const doc = JSON.parse(fs.readFileSync(path.join(SF_DATA, 'landmarks.json'), 'utf8')) as { landmarks: { id: string; category: string; lat: number; lng: number; heightM: number | null; groundElevM: number | null }[] };
  const landmarks: LandmarkProxy[] = doc.landmarks.map(l => {
    const p = projectCity(l.lat, l.lng);
    const ground = l.groundElevM ?? 0;
    const baseY = Math.max(0, heightAt(terrain, p.x, p.z));
    let height = 0;
    if (l.heightM) height = l.category === 'bridge' || l.category === 'tower' ? structureY(Math.max(0, ground), l.heightM) : buildingH(l.heightM);
    const radius = l.category === 'bridge' ? 2 : ['park', 'hill', 'neighbourhood', 'beach', 'water', 'trail', 'garden', 'island', 'street'].includes(l.category) ? 0 : 3;
    return { id: l.id, x: Math.round(p.x * 8) / 8, z: Math.round(p.z * 8) / 8, baseY, height, radius };
  });

  const data: FarData = { dem, prisms: ps, areas: as, lines: rs, zones: farZones, names, landmarks, zoneGrid: zg };
  const stats = { prisms: prisms.length, blockPrisms: prisms.length - towers - sparse, towers, sparseBoxes: sparse, areas: farAreas.length, lines: lines.length, l2Triangles: tris };
  log(`far: ${prisms.length} prisms (${stats.blockPrisms} blocks, ${towers} towers, ${sparse} boxes in sparse blocks) ≈ ${tris} triangles; ${farAreas.length} areas, ${lines.length} lines`);
  return { data, l2Triangles: tris, stats };
}
