// Step 10/11: per-chunk assembly (OBC1) — DEM, buildings (by centroid), roads (clipped, 8 u overhang), areas
// (land / sea from the raster, then landcover, clipped with 2 u overhang), props and place anchors.
import { CELL, CHUNK, chunkKey } from '../../../src/opus-bay/core/geo';
import {
  AREA_CLASSES, AREA_FLAG, type AreaSet, type BuildingSet, CHUNK_FLAG, type ChunkData, NO_NAME, type PlaceRefSet, type PropSet, ROAD_FLAG, type RoadSet,
} from '../../../src/opus-bay/world/sf/format';
import { AREA_ORDER, type AreaPoly } from './areas';
import type { ToyBuilding } from './buildings';
import { SpatialHash, area2, bbox, ccw, clipPolyline3, clipRect, ringArea, simplifyToMax } from './geom';
import { type Land, landRings } from './land';
import type { Prop } from './props';
import type { Chain } from './roads';
import { type Terrain, chunkDem } from './terrain';
import { DOMAIN, SLAB, SLAB_BBOX, inSlab } from './world';

export const ROAD_OVERHANG = 8;
/** Morton order of 4 u cells (spatial locality inside a chunk) */
function morton(x: number, z: number) {
  let a = Math.max(0, Math.min(1023, Math.floor((x + 2048) / 4))), b = Math.max(0, Math.min(1023, Math.floor((z + 2048) / 4))), m = 0;
  for (let bit = 0; bit < 10; bit++) { m += ((a & 1) + 2 * (b & 1)) * 4 ** bit; a >>= 1; b >>= 1; }
  return m;
}
export const AREA_OVERHANG = 2;

/** Rough L0 triangle cost of one toy building with today's recipes (walls, roof, trims). */
export function l0Triangles(b: ToyBuilding): number {
  const nv = b.ring.length / 2;
  const walls = 2 * nv;
  const roof = b.roof === 0 ? 2 * (nv - 2) + 12 : b.roof === 1 ? 16 : 8;
  const trim = b.style === 0 ? 4 * nv + 8 : 2 * nv;
  return walls + roof + trim;
}
/** ground + curbs + road markings per 64 u cell (1 u verts after simplification) */
export const L0_GROUND = 3500;
export const L0_LIMIT = 14000;

/**
 * Densest cells (Victorian rows) exceed the L0 budget with 8-vertex footprints: re-simplify the buildings of any cell
 * over 13k (estimate) to 6, then 5, then 4 vertices, largest-vertex-count first. Deterministic.
 */
export function fitL0Budget(buildings: ToyBuilding[], log: (s: string) => void): number {
  const cells = new Map<string, ToyBuilding[]>();
  for (const b of buildings) { const k = `${Math.floor(b.cx / CELL)}_${Math.floor(b.cz / CELL)}`; (cells.get(k) ?? cells.set(k, []).get(k)!).push(b); }
  let touched = 0;
  for (const list of cells.values()) {
    for (const maxV of [6, 5, 4]) {
      const est = L0_GROUND + list.reduce((s, b) => s + l0Triangles(b), 0);
      if (est <= L0_LIMIT - 1000) break;
      for (const b of list) {
        if (b.ring.length / 2 <= maxV) continue;
        const r = ccw(simplifyToMax(b.ring, maxV, 0.15, 1.2));
        if (r.length >= 6 && area2(r) < 0) { b.ring = r; touched++; }
      }
    }
  }
  log(`L0 budget: ${touched} footprints in dense cells simplified further`);
  return touched;
}

export interface ChunkBuild { data: ChunkData; land: boolean; shore: boolean; water: boolean; hero: boolean }

export function assembleChunks(o: {
  land: Land; terrain: Terrain; buildings: ToyBuilding[]; chains: Chain[]; areas: AreaPoly[]; props: Prop[];
  places: { x: number; z: number }[]; nameIndex: Map<string, number>; log: (s: string) => void;
}): { chunks: ChunkBuild[]; maxOverhang: number; l0: { max: number; p95: number; maxCell: string } } {
  const { land, terrain, buildings, chains, areas, props, places, nameIndex, log } = o;
  const cx0 = Math.floor(DOMAIN.x0 / CHUNK), cx1 = Math.floor((DOMAIN.x1 - 1) / CHUNK), cz0 = Math.floor(DOMAIN.z0 / CHUNK), cz1 = Math.floor((DOMAIN.z1 - 1) / CHUNK);
  // land cell counts per chunk
  const per = CHUNK / land.grid.cell;
  const landCount = new Map<string, number>();
  for (let cz = cz0; cz <= cz1; cz++) for (let cx = cx0; cx <= cx1; cx++) {
    const i0 = land.grid.col(cx * CHUNK), j0 = land.grid.row(cz * CHUNK);
    let n = 0;
    for (let j = 0; j < per; j++) for (let i = 0; i < per; i++) n += land.grid.data[(j0 + j) * land.grid.cols + i0 + i];
    if (n) landCount.set(chunkKey(cx, cz), n);
  }
  const bucket = <T>(items: T[], at: (t: T) => [number, number]) => {
    const m = new Map<string, T[]>();
    for (const it of items) { const [x, z] = at(it); const k = chunkKey(Math.floor(x / CHUNK), Math.floor(z / CHUNK)); (m.get(k) ?? m.set(k, []).get(k)!).push(it); }
    return m;
  };
  const bBy = bucket(buildings, b => [b.cx, b.cz]);
  const pBy = bucket(props, p => [p.x, p.z]);
  const placeBy = bucket(places.map((p, i) => ({ ...p, i })), p => [p.x, p.z]);
  const chainHash = new SpatialHash(CHUNK);
  chains.forEach((c, i) => { const [a, b, d, e] = bbox(c.xyz, 3); chainHash.insert(i, a - ROAD_OVERHANG, b - ROAD_OVERHANG, d + ROAD_OVERHANG, e + ROAD_OVERHANG); });
  const areaHash = new SpatialHash(CHUNK);
  areas.forEach((a, i) => { const [x0, z0, x1, z1] = bbox(a.rings[0]); areaHash.insert(i, x0 - AREA_OVERHANG, z0 - AREA_OVERHANG, x1 + AREA_OVERHANG, z1 + AREA_OVERHANG); });

  const keys = new Set<string>([...landCount.keys(), ...bBy.keys()]);
  for (const a of areas) if (a.cls === 'pier') { const [x0, z0] = bbox(a.rings[0]); keys.add(chunkKey(Math.floor(x0 / CHUNK), Math.floor(z0 / CHUNK))); }
  const out: ChunkBuild[] = [];
  let maxOverhang = 0;
  const cellTris = new Map<string, number>();
  for (const k of [...keys].sort()) {
    const [cx, cz] = k.split('_').map(Number);
    const x0 = cx * CHUNK, z0 = cz * CHUNK, x1 = x0 + CHUNK, z1 = z0 + CHUNK;
    // buildings (spatial order: delta-coded coordinates compress best)
    const bl = (bBy.get(k) ?? []).slice().sort((a, b) => morton(a.cx, a.cz) - morton(b.cx, b.cz));
    const bs: BuildingSet = {
      count: bl.length, style: Uint8Array.from(bl.map(b => b.style)), roof: Uint8Array.from(bl.map(b => b.roof)), palette: Uint8Array.from(bl.map(b => b.palette)),
      flags: Uint16Array.from(bl.map(b => b.flags)), height: Float32Array.from(bl.map(b => b.H)), baseY: Float32Array.from(bl.map(b => b.baseY)),
      osmId: Uint32Array.from(bl.map(b => b.osmId)), vStart: new Uint32Array(bl.length + 1), xz: Float32Array.from(bl.flatMap(b => b.ring)),
    };
    let v = 0;
    bl.forEach((b, i) => {
      bs.vStart[i] = v; v += b.ring.length / 2;
      for (let q = 0; q < b.ring.length; q += 2) maxOverhang = Math.max(maxOverhang, x0 - b.ring[q], b.ring[q] - x1, z0 - b.ring[q + 1], b.ring[q + 1] - z1);
      const ck = `${Math.floor(b.cx / CELL)}_${Math.floor(b.cz / CELL)}`;
      cellTris.set(ck, (cellTris.get(ck) ?? 0) + l0Triangles(b));
    });
    bs.vStart[bl.length] = v;
    // roads
    const runs: { c: Chain; p: number[] }[] = [];
    for (const i of chainHash.query(x0, z0, x1, z1)) {
      const c = chains[i];
      for (const p of clipPolyline3(c.xyz, x0 - ROAD_OVERHANG, z0 - ROAD_OVERHANG, x1 + ROAD_OVERHANG, z1 + ROAD_OVERHANG)) runs.push({ c, p });
    }
    runs.sort((a, b) => morton(a.p[0], a.p[2]) - morton(b.p[0], b.p[2]));
    const rs: RoadSet = {
      count: runs.length, cls: Uint8Array.from(runs.map(r => r.c.code)), width: Float32Array.from(runs.map(r => r.c.width)),
      nameIdx: Uint16Array.from(runs.map(r => (r.c.name ? nameIndex.get(r.c.name) ?? NO_NAME : NO_NAME))), flags: Uint8Array.from(runs.map(r => r.c.flags)),
      pStart: new Uint32Array(runs.length + 1), xyz: Float32Array.from(runs.flatMap(r => r.p)),
    };
    let pc = 0;
    runs.forEach((r, i) => { rs.pStart[i] = pc; pc += r.p.length / 3; });
    rs.pStart[runs.length] = pc;
    // areas: land / sea first (painter's order by area), then landcover in AREA_ORDER
    const rings: { cls: number; flags: number; r: number[] }[] = [];
    const lr = landRings(land, x0, z0, x1, z1, 0.3, 3);
    lr.rings.forEach((r, i) => rings.push({ cls: lr.isLand[i] ? 0 : 1, flags: 0, r }));
    const local = [...areaHash.query(x0, z0, x1, z1)].map(i => areas[i]).sort((a, b) => AREA_ORDER.indexOf(a.cls) - AREA_ORDER.indexOf(b.cls) || b.area - a.area);
    for (const a of local) {
      const outer = clipRect(a.rings[0], x0 - AREA_OVERHANG, z0 - AREA_OVERHANG, x1 + AREA_OVERHANG, z1 + AREA_OVERHANG);
      if (outer.length < 6 || ringArea(outer) < 0.5) continue;
      const cls = AREA_CLASSES.indexOf(a.cls), deck = a.cls === 'pier' ? AREA_FLAG.deck : 0;
      rings.push({ cls, flags: deck, r: outer });
      for (const h of a.rings.slice(1)) {
        const hc = clipRect(h, x0 - AREA_OVERHANG, z0 - AREA_OVERHANG, x1 + AREA_OVERHANG, z1 + AREA_OVERHANG);
        if (hc.length >= 6 && ringArea(hc) >= 0.5) rings.push({ cls, flags: deck | AREA_FLAG.hole, r: hc });
      }
    }
    const as: AreaSet = { count: rings.length, cls: Uint8Array.from(rings.map(r => r.cls)), flags: Uint8Array.from(rings.map(r => r.flags)), pStart: new Uint32Array(rings.length + 1), xz: Float32Array.from(rings.flatMap(r => r.r)) };
    let ac = 0;
    rings.forEach((r, i) => { as.pStart[i] = ac; ac += r.r.length / 2; });
    as.pStart[rings.length] = ac;
    // props, places
    const pl = (pBy.get(k) ?? []).slice().sort((a, b) => a.kind - b.kind || morton(a.x, a.z) - morton(b.x, b.z));
    const ps: PropSet = { count: pl.length, kind: Uint8Array.from(pl.map(p => p.kind)), variant: Uint8Array.from(pl.map(p => p.variant)), xz: Float32Array.from(pl.flatMap(p => [p.x, p.z])), rot: Float32Array.from(pl.map(p => p.rot)) };
    const pr = placeBy.get(k) ?? [];
    const prs: PlaceRefSet = { count: pr.length, place: Uint16Array.from(pr.map(p => p.i)), xz: Float32Array.from(pr.flatMap(p => [p.x, p.z])) };
    // flags
    const n = landCount.get(k) ?? 0, total = per * per;
    const isLand = n > 0, isWater = n < total, isShore = isLand && isWater;
    const hero = x1 > SLAB_BBOX.x0 && x0 < SLAB_BBOX.x1 && z1 > SLAB_BBOX.z0 && z0 < SLAB_BBOX.z1 && touchesSlab(x0, z0, x1, z1);
    const flags = (isLand ? CHUNK_FLAG.land : 0) | (isShore ? CHUNK_FLAG.shore : 0) | (isWater ? CHUNK_FLAG.water : 0) | (hero ? CHUNK_FLAG.hero : 0);
    out.push({ data: { cx, cz, flags, dem: chunkDem(terrain, cx, cz), buildings: bs, roads: rs, areas: as, props: ps, places: prs }, land: isLand, shore: isShore, water: isWater, hero });
  }
  const tris = [...cellTris.entries()].map(([k, t]) => [k, t + L0_GROUND] as [string, number]).sort((a, b) => b[1] - a[1]);
  const p95 = tris.length ? tris[Math.floor(tris.length * 0.05)][1] : 0;
  log(`chunks: ${out.length} files (${out.filter(c => c.land).length} with land, ${out.filter(c => c.shore).length} shore, ${out.filter(c => c.hero).length} touch the hero); max building overhang ${maxOverhang.toFixed(1)} u; L0 cell estimate max ${tris[0]?.[1]} (${tris[0]?.[0]}), p95 ${p95}`);
  return { chunks: out, maxOverhang, l0: { max: tris[0]?.[1] ?? 0, p95, maxCell: tris[0]?.[0] ?? '' } };
}

function touchesSlab(x0: number, z0: number, x1: number, z1: number): boolean {
  for (let z = z0; z <= z1; z += 8) for (let x = x0; x <= x1; x += 8) if (inSlab(x, z)) return true;
  for (let i = 0; i < SLAB.length; i += 2) if (SLAB[i] >= x0 && SLAB[i] <= x1 && SLAB[i + 1] >= z0 && SLAB[i + 1] <= z1) return true;
  return false;
}

/** Drop freeway decks over open water (Golden Gate / Bay Bridge spans): the landmarks lane builds those bridges. */
export function dropWaterDecks(chains: Chain[], land: Land): { kept: Chain[]; dropped: number } {
  const kept: Chain[] = [];
  let dropped = 0;
  for (const c of chains) {
    if (c.flags & (ROAD_FLAG.deckOnly | ROAD_FLAG.bridge)) {
      // sample every 2 u along the deck: long spans have few vertices but lots of water under them
      let on = 0, n = 0;
      for (let k = 3; k < c.xyz.length; k += 3) {
        const ax = c.xyz[k - 3], az = c.xyz[k - 1], bx = c.xyz[k], bz = c.xyz[k + 2], steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 2));
        for (let s = 0; s < steps; s++) { n++; if (land.grid.at(ax + ((bx - ax) * s) / steps, az + ((bz - az) * s) / steps) === 1) on++; }
      }
      if (on < n * 0.5) { dropped++; continue; }
    }
    kept.push(c);
  }
  return { kept, dropped };
}
