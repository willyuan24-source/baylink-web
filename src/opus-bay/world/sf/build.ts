import * as THREE from 'three';
import { CELL, CHUNK, CURB_BAND } from '../../core/geo';
import { type GroundRaster, groundRaster, rasterHeight } from '../../core/sfTerrain';
import type { Vec2 } from '../../core/types';
import { BOX, C, CYL, type Info, M, hash2, mixColor, shade } from '../builder';
import { CITY_PAL } from '../palette';
import { CITY_ROOFS, CITY_STYLES, type CityBuildingSpec, type CityPalette, toyBuildingL0, toyBuildingL1 } from '../recipes/city';
import { WIN } from '../recipes/shapes';
import type { TypedBatchArrays } from '../typedBatch';
import { type L0Buildings, L0Recorder, l0Desc } from './l0index';
import { HILL, type LookStyle, type LookZones, asphaltInfo, hillMix, landPatchAt, sfLook, slopeEarth, zoneAt } from './look';
import { AREA_CLASSES, AREA_FLAG, type ChunkData, PROP_KINDS, ROAD_CLASSES, ROAD_FLAG, type SfPalette, demSample } from './format';
import { type FarWater, inFarWater } from './far';
import { CityBatch, GROUND_CITY, type Line3, type PoolArrays, buildGround, clipOutside, clipPolyline, dashes, ribbon } from './mesh';
import { type Raster, fillPoly, fillRing, fillRings, inPoly, makeRaster, pushOutOf, ringWithHoles, sampleField, sampleNearest, signedDistance } from './raster';

/**
 * Chunk → render geometry for the streamed city (runs in the stream workers; pure, three core only):
 *
 *   chunkContext(chunk, init)     rasters shared by both tiers: ground mask as a signed distance (land minus sea,
 *                                 lakes and the hero slab), landcover classes, street segments for the flattened height
 *   buildL1(ctx)                  per 64 u cell: one box per building (TOY pool) + 4 u ground with the main streets
 *                                 (GROUND pool), the chunk's trees / lamps for the instanced props, landmark bases
 *   buildL0(ctx, sub)             one 64 u cell: full toy buildings, benches / bike racks / stop poles, freeway decks
 *                                 (TOY) + 2 u road-flattened ground, every street with sidewalks, rails, dashes,
 *                                 pier decks (GROUND)
 *
 * Seam rules (plan §5.1): nothing of the city is drawn inside the hero slab (ground, streets, props); buildings
 * there were already dropped offline except the seam blocks. Buildings inside a landmark's exclusion are dropped.
 */

/**
 * A landmark's footprint (lane D's exclude): city buildings, props and streets inside are dropped, lakes inside are
 * the landmark's own (the Palace lagoon, the Sutro Baths basins: no city water hole), and the city ground there sinks
 * by `sink` u so the landmark's own terraces, lanes and plazas (built on the same DEM grade) always stay on top.
 */
export interface Exclude { id: string; x: number; z: number; r?: number; poly?: Vec2[]; base?: 'terrain' | number; sink?: number }

/** Sent once to every worker. */
export interface CityInit {
  palettes: SfPalette[];
  /** hero slab outline (DISTRICT.slab) */
  slab: Vec2[];
  excludes: Exclude[];
  /**
   * The hero's own land + decks (1) at 2 u (core/terrain's grid, downsampled): lane A keeps the buildings of seam
   * blocks (< 60 % inside the slab) even where they reach inside it, and at the west seam some of them stand where the
   * hero has water (its seawall runs landward of the real shore) — those are dropped.
   */
  heroLand?: { x0: number; z0: number; step: number; cols: number; rows: number; data: Uint8Array };
  /**
   * The DataSF neighbourhoods (far.obc zone grid) for the SF look (look.ts). Not known at init (far.obc loads in a
   * worker): stream.ts posts them to both workers as a `zones` message before any chunk job; without them every
   * building takes its zone-free look (flat, the neutral pools).
   */
  zones?: LookZones | null;
  /**
   * far.obc's water rings (far.ts farWaterRings), posted with `zones`: a lake of a chunk that lies in none of them
   * and stands above the sea has no water surface (far.ts draws the lakes), so it is painted on the ground as a pond
   * (POND_CLASS) instead of cut out. Without them (tests, the first jobs) every lake is cut out as before.
   */
  farWater?: FarWater[] | null;
}

/** Class raster value of a pond painted on the ground (no far lake surface covers it); not an AREA_CLASSES index. */
export const POND_CLASS = 200;
/** A lake whose shore is lower than this sits at the sea plane, which shows through its hole: it stays cut out. */
const POND_MIN_Y = 0.6;

const P = { none: 0, pavers: 1, stone: 2, planks: 3, grass: 4, asphalt: 5, cobble: 6, earth: 7, brick: 8 } as const;
const A = Object.fromEntries(AREA_CLASSES.map((c, i) => [c, i])) as Record<(typeof AREA_CLASSES)[number], number>;
const R = Object.fromEntries(ROAD_CLASSES.map((c, i) => [c, i])) as Record<(typeof ROAD_CLASSES)[number], number>;
const PK = Object.fromEntries(PROP_KINDS.map((c, i) => [c, i])) as Record<(typeof PROP_KINDS)[number], number>;

/** landcover class → ground colour and GROUND pattern */
const CLASS_PAINT: Record<number, { color: string; pattern: number }> = {
  0: { color: CITY_PAL.land, pattern: P.earth },
  [A.park]: { color: CITY_PAL.park, pattern: P.grass },
  [A.grass]: { color: CITY_PAL.grass, pattern: P.grass },
  [A.forest]: { color: CITY_PAL.forest, pattern: P.grass },
  [A.golf]: { color: CITY_PAL.golf, pattern: P.grass },
  [A.pitch]: { color: CITY_PAL.pitch, pattern: P.grass },
  [A.sand]: { color: CITY_PAL.sand, pattern: P.earth },
  [A.scrub]: { color: CITY_PAL.scrub, pattern: P.grass },
  [A.rock]: { color: CITY_PAL.rock, pattern: P.earth },
  [A.plaza]: { color: CITY_PAL.plaza, pattern: P.stone },
  [A.parking]: { color: CITY_PAL.parking, pattern: P.asphalt },
  [A.water]: { color: CITY_PAL.land, pattern: P.earth },
  [A.pier]: { color: CITY_PAL.pier, pattern: P.planks },
  // a small pond painted on the ground (between the lake shader's shallow and deep day colours)
  [POND_CLASS]: { color: '#5ea9a8', pattern: P.none },
};

// ---------------------------------------------------------------------------
// shared per-chunk context
// ---------------------------------------------------------------------------

interface Seg { ax: number; az: number; ay: number; bx: number; bz: number; by: number; hw: number }

/** Street centreline segments in 8 u buckets (flattened height, street-facing side of buildings). */
class SegIndex {
  private buckets = new Map<number, Seg[]>();
  readonly x0: number;
  readonly z0: number;
  constructor(x0: number, z0: number) { this.x0 = x0; this.z0 = z0; }
  private key(i: number, j: number) { return (i + 64) * 1024 + (j + 64); }
  add(s: Seg, reach: number) {
    const i0 = Math.floor((Math.min(s.ax, s.bx) - reach - this.x0) / 8), i1 = Math.floor((Math.max(s.ax, s.bx) + reach - this.x0) / 8);
    const j0 = Math.floor((Math.min(s.az, s.bz) - reach - this.z0) / 8), j1 = Math.floor((Math.max(s.az, s.bz) + reach - this.z0) / 8);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const k = this.key(i, j);
      let b = this.buckets.get(k);
      if (!b) { b = []; this.buckets.set(k, b); }
      b.push(s);
    }
  }
  near(x: number, z: number): Seg[] | undefined { return this.buckets.get(this.key(Math.floor((x - this.x0) / 8), Math.floor((z - this.z0) / 8))); }
}

const BLEND = 1.5;
const smooth = (e0: number, e1: number, x: number) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

export interface ChunkContext {
  chunk: ChunkData;
  init: CityInit;
  /** mask raster (0.5 u, chunk ± 4 u) and its signed distance: + = ground */
  mask: Raster;
  sdf: Float32Array;
  /** landcover class raster (1 u, chunk ± 4 u) */
  cls: Raster;
  clsData: Uint8Array;
  segs: SegIndex;
  /** chunk touches the hero slab */
  hero: boolean;
  inSlab(x: number, z: number): boolean;
  excluded(x: number, z: number): boolean;
  /** the exclusions touching this chunk, as polygons (circles as 16-gons) for clipping streets */
  exclusions: { poly: Vec2[]; sink: number }[];
  /** street ribbons stay out of the slab and the landmark footprints (CityBatch.clampXZ), null when none is near */
  clampXZ: CityBatch['clampXZ'];
  /**
   * ground height = the walked ground (core/sfTerrain groundRaster: DEM, pier decks, road corridors, exactly what
   * heightAt answers) minus the landmark sink; within BRIDGE_KEEP of a bridge / deck-only road the renderer's own
   * DEM + corridor model instead (the walk raster rises to walkable decks; the drawn ground must stay under them)
   */
  height(x: number, z: number): number;
  /** the walked-ground raster of the chunk */
  ground: GroundRaster;
  /** DEM only (L1 / skirts) */
  dem(x: number, z: number): number;
}

/** Is the centroid of ring i0 … i1 (x, z pairs) inside one of the exclusions? */
function ringInside(xz: ArrayLike<number>, i0: number, i1: number, inside: (x: number, z: number) => unknown) {
  let cx = 0, cz = 0;
  for (let k = i0; k < i1; k++) { cx += xz[k * 2]; cz += xz[k * 2 + 1]; }
  return i1 > i0 && !!inside(cx / (i1 - i0), cz / (i1 - i0));
}

/**
 * A chunk lake (ring i0 … i1) that no far water covers and that stands above the sea: far.ts draws no surface for it,
 * so its hole in the ground would open onto the table. Covered = its centre or half its shore points lie in far water.
 */
function pondOnGround(xz: ArrayLike<number>, i0: number, i1: number, chunk: ChunkData, farWater: readonly FarWater[]) {
  const n = i1 - i0;
  if (n < 3) return false;
  let cx = 0, cz = 0, lo = Infinity, wet = 0;
  for (let k = i0; k < i1; k++) {
    const x = xz[k * 2], z = xz[k * 2 + 1];
    cx += x; cz += z;
    lo = Math.min(lo, demSample(chunk.dem, x, z));
    if (inFarWater(farWater, x, z)) wet++;
  }
  if (lo <= POND_MIN_Y) return false;
  return !inFarWater(farWater, cx / n, cz / n) && wet * 2 < n;
}

const bboxOf = (poly: readonly Vec2[]) => {
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const p of poly) { x0 = Math.min(x0, p.x); z0 = Math.min(z0, p.z); x1 = Math.max(x1, p.x); z1 = Math.max(z1, p.z); }
  return { x0, z0, x1, z1 };
};

/** Road classes that are corridors on the ground (flattened, walkable); tram / rail lie inside streets. */
const CORRIDOR = new Set([R.motorway, R.trunk, R.primary, R.secondary, R.tertiary, R.residential, R.service, R.pedestrian, R.footway, R.path, R.cycleway, R.steps, R.track]);

export function chunkContext(chunk: ChunkData, init: CityInit): ChunkContext {
  const ox = chunk.cx * CHUNK, oz = chunk.cz * CHUNK, M4 = 4;
  const mask = makeRaster(ox - M4, oz - M4, ox + CHUNK + M4, oz + CHUNK + M4, 0.5);
  const cls = makeRaster(ox - M4, oz - M4, ox + CHUNK + M4, oz + CHUNK + M4, 1);
  const m = new Uint8Array(mask.cols * mask.rows), c = new Uint8Array(cls.cols * cls.rows);
  const ar = chunk.areas;
  // exclusions near this chunk (pre-filtered once: height() runs ~10k times per cell)
  const R16 = 1 / Math.cos(Math.PI / 16);
  const exclusions = init.excludes.flatMap(e => {
    const poly = e.poly ?? Array.from({ length: 16 }, (_, k) => ({ x: e.x + Math.cos((k / 16) * Math.PI * 2) * (e.r ?? 0) * R16, z: e.z + Math.sin((k / 16) * Math.PI * 2) * (e.r ?? 0) * R16 }));
    const b = bboxOf(poly);
    return b.x1 < ox - 24 || b.x0 > ox + CHUNK + 24 || b.z1 < oz - 24 || b.z0 > oz + CHUNK + 24 ? [] : [{ poly, sink: e.sink ?? 0, box: b }];
  });
  const inExclusion = (x: number, z: number) => {
    for (const e of exclusions) if (x >= e.box.x0 && x <= e.box.x1 && z >= e.box.z0 && z <= e.box.z1 && inPoly(x, z, e.poly)) return e;
    return null;
  };
  let coast = true;
  for (let i = 0; i < ar.count; i++) {
    const k = ar.cls[i], i0 = ar.pStart[i], i1 = ar.pStart[i + 1], hole = (ar.flags[i] & AREA_FLAG.hole) !== 0;
    if (k !== A.land && k !== A.water) coast = false;
    if (!coast && k === A.water && !hole && ringInside(ar.xz, i0, i1, inExclusion)) continue; // a landmark's own lagoon / basins
    if (coast || k === A.water) {
      // coastline rings and lakes: the ground mask. A hole ring was filled with its outer ring (even-odd, as
      // core/sfTerrain rasterizeChunk walks it): the islands of a lake (Strawberry Hill in Stow Lake …) stay land.
      if (hole) continue;
      const v = k === A.land ? 1 : 0, rings = ringWithHoles(ar, i, AREA_FLAG.hole);
      if (!coast && k === A.water && init.farWater && pondOnGround(ar.xz, i0, i1, chunk, init.farWater)) {
        fillRings(cls, ar.xz, rings, j => { c[j] = POND_CLASS; });
        continue;
      }
      fillRings(mask, ar.xz, rings, j => { m[j] = v; });
      if (k === A.water) fillRings(cls, ar.xz, rings, j => { c[j] = A.water; });
      continue;
    }
    if ((ar.flags[i] & AREA_FLAG.deck) !== 0) continue; // piers: drawn as decks (buildL0 / buildL1)
    if (hole) fillRing(cls, ar.xz, i0, i1, j => { if (c[j] === k) c[j] = 0; });
    else fillRing(cls, ar.xz, i0, i1, j => { c[j] = k; });
  }
  const sb = bboxOf(init.slab);
  const hero = !(sb.x1 < ox - M4 || sb.x0 > ox + CHUNK + M4 || sb.z1 < oz - M4 || sb.z0 > oz + CHUNK + M4);
  if (hero) fillPoly(mask, init.slab, j => { m[j] = 0; });
  const sdf = signedDistance(m, mask, 16);

  const segs = new SegIndex(ox - 16, oz - 16);
  const rd = chunk.roads;
  for (let i = 0; i < rd.count; i++) {
    if (!CORRIDOR.has(rd.cls[i]) || rd.flags[i] & (ROAD_FLAG.bridge | ROAD_FLAG.deckOnly)) continue;
    const hw = rd.width[i] / 2;
    for (let k = rd.pStart[i]; k + 1 < rd.pStart[i + 1]; k++) {
      const p = rd.xyz;
      segs.add({ ax: p[k * 3], ay: p[k * 3 + 1], az: p[k * 3 + 2], bx: p[k * 3 + 3], by: p[k * 3 + 4], bz: p[k * 3 + 5], hw }, hw + BLEND);
    }
  }
  const dem = (x: number, z: number) => demSample(chunk.dem, x, z);
  // the renderer's own corridor model: DEM pulled to the nearest corridor's centreline (bridges / decks excluded)
  const flat = (x: number, z: number) => {
    const base = dem(x, z);
    const list = segs.near(x, z);
    if (!list) return base;
    let bw = 0, by = base, bd = Infinity;
    for (const s of list) {
      const dx = s.bx - s.ax, dz = s.bz - s.az, L2 = dx * dx + dz * dz;
      let t = L2 > 0 ? ((x - s.ax) * dx + (z - s.az) * dz) / L2 : 0;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const d = Math.hypot(x - s.ax - dx * t, z - s.az - dz * t);
      const w = d <= s.hw ? 1 : 1 - smooth(s.hw, s.hw + BLEND, d);
      if (w <= 0) continue;
      if (w > bw + 1e-6 || (w >= bw - 1e-6 && d < bd)) { bw = w; bd = d; by = s.ay + (s.by - s.ay) * t; }
    }
    return base + (by - base) * bw;
  };
  // drawn ground = walked ground (lane C2-6): the raster, except next to bridges / deck-only roads
  const ground = groundRaster(chunk);
  const keep = bridgeKeep(chunk);
  const walked = (x: number, z: number) => {
    if (keep) {
      const i = Math.floor((x - ox) / ground.cell), j = Math.floor((z - oz) / ground.cell), W = ground.n + 1;
      if (i >= -1 && j >= -1 && i <= ground.n && j <= ground.n) {
        const i0 = Math.max(0, Math.min(ground.n, i)), j0 = Math.max(0, Math.min(ground.n, j)), i1 = Math.min(ground.n, i0 + 1), j1 = Math.min(ground.n, j0 + 1);
        if (keep[j0 * W + i0] || keep[j0 * W + i1] || keep[j1 * W + i0] || keep[j1 * W + i1]) return flat(x, z);
      }
    }
    return rasterHeight(ground, x, z);
  };
  const height = exclusions.some(e => e.sink > 0) ? (x: number, z: number) => walked(x, z) - (inExclusion(x, z)?.sink ?? 0) : walked;
  const inSlab = (x: number, z: number) => hero && inPoly(x, z, init.slab);
  const excluded = (x: number, z: number) => inExclusion(x, z) !== null;
  const clampPolys = [...(hero ? [init.slab] : []), ...exclusions.map(e => e.poly)];
  const clampXZ = clampPolys.length ? pushOutOf(clampPolys) : null;
  return { chunk, init, mask, sdf, cls, clsData: c, segs, hero, inSlab, excluded, exclusions, clampXZ, height, ground, dem };
}

/** Ground within this distance (u) beyond a bridge's / deck-only road's half width keeps the renderer's DEM model. */
export const BRIDGE_KEEP = 2;

/** Corner mask (groundRaster lattice) of the ground near bridges and deck-only roads, null when the chunk has none. */
function bridgeKeep(chunk: ChunkData): Uint8Array | null {
  const rd = chunk.roads, n = CHUNK / 0.5, W = n + 1, cell = 0.5;
  const ox = chunk.cx * CHUNK, oz = chunk.cz * CHUNK;
  let mask: Uint8Array | null = null;
  for (let i = 0; i < rd.count; i++) {
    if (!(rd.flags[i] & (ROAD_FLAG.bridge | ROAD_FLAG.deckOnly))) continue;
    const r = rd.width[i] / 2 + BRIDGE_KEEP;
    for (let k = rd.pStart[i]; k + 1 < rd.pStart[i + 1]; k++) {
      const ax = rd.xyz[k * 3], az = rd.xyz[k * 3 + 2], bx = rd.xyz[k * 3 + 3], bz = rd.xyz[k * 3 + 5];
      const c0 = Math.max(0, Math.floor((Math.min(ax, bx) - r - ox) / cell)), c1 = Math.min(n, Math.ceil((Math.max(ax, bx) + r - ox) / cell));
      const r0 = Math.max(0, Math.floor((Math.min(az, bz) - r - oz) / cell)), r1 = Math.min(n, Math.ceil((Math.max(az, bz) + r - oz) / cell));
      if (c0 > c1 || r0 > r1) continue;
      const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz;
      for (let jj = r0; jj <= r1; jj++) for (let ii = c0; ii <= c1; ii++) {
        const x = ox + ii * cell, z = oz + jj * cell;
        let t = L2 > 0 ? ((x - ax) * dx + (z - az) * dz) / L2 : 0;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        if (Math.hypot(x - ax - dx * t, z - az - dz * t) <= r) (mask ??= new Uint8Array(W * W))[jj * W + ii] = 1;
      }
    }
  }
  return mask;
}

/**
 * Seam buildings that stand where the hero district has water (lane A keeps whole seam blocks; the hero's seawall
 * runs landward of the real shore at the west seam): the renderer never drew them, and dropping them from the decoded
 * chunk before rasterising also removes their invisible collision walls (C2-6; osm 288472567 and 1092477935 in chunk
 * −2_0). Mutates `chunk.buildings`; returns the osmIds dropped.
 */
export function dropSeamBuildings(chunk: ChunkData, init: CityInit): number[] {
  const b = chunk.buildings;
  const sb = bboxOf(init.slab);
  const ox = chunk.cx * CHUNK, oz = chunk.cz * CHUNK;
  if (!init.heroLand || sb.x1 < ox - 64 || sb.x0 > ox + CHUNK + 64 || sb.z1 < oz - 64 || sb.z0 > oz + CHUNK + 64) return [];
  const keep: number[] = [], dropped: number[] = [];
  for (let i = 0; i < b.count; i++) {
    let cx = 0, cz = 0;
    const k0 = b.vStart[i], k1 = b.vStart[i + 1];
    for (let k = k0; k < k1; k++) { cx += b.xz[k * 2]; cz += b.xz[k * 2 + 1]; }
    cx /= Math.max(1, k1 - k0); cz /= Math.max(1, k1 - k0);
    if (k1 - k0 >= 3 && inPoly(cx, cz, init.slab) && !heroLandAt(init, cx, cz)) dropped.push(b.osmId[i]);
    else keep.push(i);
  }
  if (!dropped.length) return dropped;
  let nv = 0;
  for (const i of keep) nv += b.vStart[i + 1] - b.vStart[i];
  const vStart = new Uint32Array(keep.length + 1), xz = new Float32Array(nv * 2);
  let o = 0;
  keep.forEach((i, k) => {
    vStart[k] = o;
    for (let v = b.vStart[i]; v < b.vStart[i + 1]; v++, o++) { xz[o * 2] = b.xz[v * 2]; xz[o * 2 + 1] = b.xz[v * 2 + 1]; }
  });
  vStart[keep.length] = o;
  const sel = <T extends Uint8Array | Uint16Array | Uint32Array | Float32Array>(a: T): T => { const out = new (a.constructor as new (n: number) => T)(keep.length); keep.forEach((i, k) => { out[k] = a[i]; }); return out; };
  chunk.buildings = { count: keep.length, style: sel(b.style), roof: sel(b.roof), palette: sel(b.palette), flags: sel(b.flags), height: sel(b.height), baseY: sel(b.baseY), osmId: sel(b.osmId), vStart, xz };
  return dropped;
}

// ---------------------------------------------------------------------------
// ground paint
// ---------------------------------------------------------------------------

const _col = new THREE.Color();
function paintFor(ctx: ChunkContext) {
  return (x: number, z: number, h: number, slope: number) => {
    let k = sampleNearest(ctx.clsData, ctx.cls, x, z);
    if (k === 0) { const pc = landPatchAt(x, z, h); if (pc) k = A[pc]; } // landcover the data lacks (Yerba Buena Island)
    const p = CLASS_PAINT[k] ?? CLASS_PAINT[0];
    const n = hash2(Math.floor(x / 5), Math.floor(z / 5));
    let col = mixColor(p.color, k === 0 ? CITY_PAL.landShade : shade(p.color, 0.92), n * 0.45);
    // green hills (look.ts HILL): plain land high up turns to hill grass, only steep ground shows earth
    if (k === 0 && h > HILL.y0) col = mixColor(col, CITY_PAL.hillGrass, hillMix(h));
    if (slope > HILL.slope0 && k !== POND_CLASS) col = mixColor(col, CITY_PAL.earth, slopeEarth(slope));
    return { color: _col.copy(col), pattern: p.pattern };
  };
}

// ---------------------------------------------------------------------------
// buildings
// ---------------------------------------------------------------------------

interface BuildingRef { i: number; sub: number; poly: Vec2[]; cx: number; cz: number; area: number }

/** Is (x, z) hero land or deck? (true when the raster is missing: keep lane A's decision) */
function heroLandAt(init: CityInit, x: number, z: number) {
  const h = init.heroLand;
  if (!h) return true;
  const i = Math.floor((x - h.x0) / h.step), j = Math.floor((z - h.z0) / h.step);
  return i >= 0 && j >= 0 && i < h.cols && j < h.rows && h.data[j * h.cols + i] === 1;
}

function buildingsOf(ctx: ChunkContext): BuildingRef[] {
  const b = ctx.chunk.buildings, out: BuildingRef[] = [];
  const ox = ctx.chunk.cx * CHUNK, oz = ctx.chunk.cz * CHUNK;
  for (let i = 0; i < b.count; i++) {
    const poly: Vec2[] = [];
    let cx = 0, cz = 0, area = 0;
    for (let k = b.vStart[i]; k < b.vStart[i + 1]; k++) { const p = { x: b.xz[k * 2], z: b.xz[k * 2 + 1] }; poly.push(p); cx += p.x; cz += p.z; }
    if (poly.length < 3) continue;
    for (let k = 0; k < poly.length; k++) { const p = poly[k], q = poly[(k + 1) % poly.length]; area += p.x * q.z - q.x * p.z; }
    cx /= poly.length; cz /= poly.length;
    if (ctx.excluded(cx, cz) || (ctx.inSlab(cx, cz) && !heroLandAt(ctx.init, cx, cz))) continue;
    const sx = Math.min(1, Math.max(0, Math.floor((cx - ox) / CELL))), sz = Math.min(1, Math.max(0, Math.floor((cz - oz) / CELL)));
    out.push({ i, sub: sx + sz * 2, poly, cx, cz, area: Math.abs(area) / 2 });
  }
  return out;
}

/** The footprint edge facing the nearest street (bay windows and storefronts go there). */
function frontEdge(ctx: ChunkContext, poly: Vec2[]): number | undefined {
  let best = -1, bestD = 6;
  let area = 0;
  for (let i = 0; i < poly.length; i++) { const p = poly[i], q = poly[(i + 1) % poly.length]; area += p.x * q.z - q.x * p.z; }
  const s = area >= 0 ? 1 : -1;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const L = Math.hypot(b.x - a.x, b.z - a.z);
    if (L < 1.4) continue;
    const nx = (s * (b.z - a.z)) / L, nz = (-s * (b.x - a.x)) / L;
    const px = (a.x + b.x) / 2 + nx * 2.2, pz = (a.z + b.z) / 2 + nz * 2.2;
    const list = ctx.segs.near(px, pz);
    if (!list) continue;
    for (const g of list) {
      const dx = g.bx - g.ax, dz = g.bz - g.az, L2 = dx * dx + dz * dz;
      let t = L2 > 0 ? ((px - g.ax) * dx + (pz - g.az) * dz) / L2 : 0;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const d = Math.hypot(px - g.ax - dx * t, pz - g.az - dz * t) - g.hw - L * 0.02;
      if (d < bestD) { bestD = d; best = i; }
    }
  }
  return best >= 0 ? best : undefined;
}

/**
 * One building's recipe spec, shared by L0 and L1 (so the tiers never disagree): lane A's style and footprint with
 * the SF look (look.ts: flat roofs as the norm, white / pastel walls per neighbourhood, flat tops darker than the
 * walls). The far tier applies the same tables to its block prisms (far.ts).
 */
function specOf(ctx: ChunkContext, ref: BuildingRef, withFront: boolean): CityBuildingSpec {
  const b = ctx.chunk.buildings, i = ref.i;
  const pal = ctx.init.palettes[b.palette[i]] ?? null;
  const style = CITY_STYLES[b.style[i]] ?? 'residential';
  const look = sfLook({
    style: style as LookStyle, roof: CITY_ROOFS[b.roof[i]] ?? 'flat', pal, seed: b.osmId[i], area: ref.area, H: b.height[i],
    zone: zoneAt(ctx.init.zones, ref.cx, ref.cz), flags: b.flags[i],
  });
  const palette: CityPalette = { wall: look.wall, trim: look.trim, roof: look.roofColor };
  return {
    poly: ref.poly,
    baseY: b.baseY[i],
    H: b.height[i],
    style,
    roof: look.roof,
    palette,
    seed: b.osmId[i],
    flags: b.flags[i],
    front: withFront ? frontEdge(ctx, ref.poly) : undefined,
  };
}

// ---------------------------------------------------------------------------
// streets
// ---------------------------------------------------------------------------

interface StreetStyle { walk: string; walkPat: number; asphalt?: string; dash?: boolean }
const STREET: Partial<Record<number, StreetStyle>> = {
  [R.motorway]: { walk: CITY_PAL.curb, walkPat: P.none, asphalt: CITY_PAL.motorway, dash: true },
  [R.trunk]: { walk: CITY_PAL.sidewalk, walkPat: P.pavers, asphalt: CITY_PAL.asphaltMajor, dash: true },
  [R.primary]: { walk: CITY_PAL.sidewalk, walkPat: P.pavers, asphalt: CITY_PAL.asphaltMajor, dash: true },
  [R.secondary]: { walk: CITY_PAL.sidewalk, walkPat: P.pavers, asphalt: CITY_PAL.asphalt, dash: true },
  [R.tertiary]: { walk: CITY_PAL.sidewalk, walkPat: P.pavers, asphalt: CITY_PAL.asphalt, dash: true },
  [R.residential]: { walk: CITY_PAL.sidewalk, walkPat: P.pavers, asphalt: CITY_PAL.asphalt },
  [R.service]: { walk: CITY_PAL.asphalt, walkPat: P.asphalt },
  [R.pedestrian]: { walk: CITY_PAL.pedestrian, walkPat: P.stone },
  [R.footway]: { walk: CITY_PAL.footway, walkPat: P.stone },
  [R.path]: { walk: CITY_PAL.path, walkPat: P.earth },
  [R.cycleway]: { walk: CITY_PAL.cycleway, walkPat: P.earth },
  [R.steps]: { walk: CITY_PAL.steps, walkPat: P.stone },
  [R.track]: { walk: CITY_PAL.track, walkPat: P.earth },
};
const LIFT = { walk: 0.035, asphalt: 0.055, rail: 0.075, dash: 0.07 } as const;
const gInfo = (pattern: number): Info => [pattern, 0, 0, GROUND_CITY];

/** Street pieces of the chunk inside the square [x0, x0 + s]² (and outside the hero slab). */
function streetPieces(ctx: ChunkContext, i: number, x0: number, z0: number, s: number): Line3[] {
  const rd = ctx.chunk.roads;
  let pieces = clipPolyline(rd.xyz, rd.pStart[i], rd.pStart[i + 1], x0, z0, x0 + s, z0 + s);
  if (ctx.hero && pieces.length) pieces = pieces.flatMap(l => clipOutside(l, ctx.init.slab, (x, z) => inPoly(x, z, ctx.init.slab)));
  // a landmark draws its own streets (Lombard's crooked block, the GGB deck): the city's stop at its footprint
  for (const e of ctx.exclusions) if (pieces.length) pieces = pieces.flatMap(l => clipOutside(l, e.poly, (x, z) => inPoly(x, z, e.poly)));
  return pieces;
}

/** Elevated deck (freeway viaducts, bridges): asphalt top (ground batch), slab sides and pillars (toy batch). */
function deck(ctx: ChunkContext, g: CityBatch, t: CityBatch | null, l: Line3, w: number, walk: boolean) {
  if (walk) ribbon(g, l, w, 0.03, C(CITY_PAL.sidewalk), gInfo(P.stone));
  ribbon(g, l, walk ? Math.max(1.6, w - CURB_BAND * 2) : w - 0.3, 0.05, C(CITY_PAL.motorway), gInfo(P.asphalt));
  if (!t) return;
  const side = C(CITY_PAL.deckSide), pillar = C(CITY_PAL.pillar);
  const n = l.length / 3;
  let acc = 7;
  for (let k = 0; k + 1 < n; k++) {
    const ax = l[k * 3], ay = l[k * 3 + 1], az = l[k * 3 + 2], bx = l[k * 3 + 3], by = l[k * 3 + 4], bz = l[k * 3 + 5];
    const L = Math.hypot(bx - ax, bz - az);
    if (L < 1e-3) continue;
    const yaw = Math.atan2(bx - ax, bz - az);
    // slab: a box under the deck surface
    t.add(BOX(), M((ax + bx) / 2, Math.min(ay, by) - 0.75, (az + bz) / 2, yaw, w, 0.75 + Math.abs(by - ay) * 0.5, L + 0.05), side, [WIN.none, 0, 0, 0]);
    // pillars every 14 u
    while (acc < L) {
      const f = acc / L, x = ax + (bx - ax) * f, z = az + (bz - az) * f, y = ay + (by - ay) * f - 0.75;
      const gy = ctx.dem(x, z);
      if (y - gy > 1.2) t.add(CYL(8), M(x, gy - 0.5, z, 0, 0.5, y - gy + 0.5, 0.5), pillar, [WIN.none, gy, 0, 0]);
      acc += 14;
    }
    acc -= L;
  }
}

/** Every street of the cell (L0): sidewalk band, asphalt, centre dashes, rails, steps, paths, freeway decks. */
function streetsL0(ctx: ChunkContext, g: CityBatch, t: CityBatch, x0: number, z0: number) {
  const rd = ctx.chunk.roads;
  const asphalt: [Line3, number, number][] = [], extras: (() => void)[] = [];
  for (let i = 0; i < rd.count; i++) {
    const k = rd.cls[i], f = rd.flags[i], w = rd.width[i];
    const pieces = streetPieces(ctx, i, x0, z0, CELL);
    if (!pieces.length) continue;
    if (f & (ROAD_FLAG.deckOnly | ROAD_FLAG.bridge)) {
      const walk = !(f & ROAD_FLAG.deckOnly) && k !== R.motorway;
      for (const l of pieces) extras.push(() => deck(ctx, g, t, l, w, walk));
      continue;
    }
    if (k === R.tram || k === R.rail) {
      const cable = (f & ROAD_FLAG.cable) !== 0;
      for (const l of pieces) extras.push(() => {
        if (k === R.rail) ribbon(g, l, 2.2, LIFT.walk + 0.004, C(CITY_PAL.ballast), gInfo(P.cobble));
        for (const o of [-0.72, 0.72]) {
          ribbon(g, l, 0.16, LIFT.rail, C(CITY_PAL.rail), gInfo(P.none), o);
          ribbon(g, l, 0.07, LIFT.rail + 0.004, C(CITY_PAL.railTop), gInfo(P.none), o);
        }
        if (cable) ribbon(g, l, 0.06, LIFT.rail, C('#3f3a35'), gInfo(P.none));
      });
      continue;
    }
    const st = STREET[k];
    if (!st) continue;
    for (const l of pieces) {
      if (st.asphalt) asphalt.push([l, Math.max(1.6, w - CURB_BAND * 2), k]);
      else {
        const col = C(st.walk), pat = st.walkPat;
        extras.push(() => ribbon(g, l, w, k === R.service ? LIFT.asphalt - 0.004 : LIFT.walk + 0.002, col, pat === P.pavers ? (s, o) => [P.pavers, s, o, GROUND_CITY] : gInfo(pat)));
      }
    }
  }
  // sidewalks first, asphalt on top (clean junctions), then paths / steps / rails / decks
  const sw = C(CITY_PAL.sidewalk);
  for (const [l, aw, k] of asphalt) {
    const row = aw + CURB_BAND * 2;
    const st = STREET[k]!;
    ribbon(g, l, row, LIFT.walk, st.walk === CITY_PAL.sidewalk ? sw : C(st.walk), (s, o) => [st.walkPat, s, o, GROUND_CITY]);
  }
  for (const [l, aw, k] of asphalt) {
    const st = STREET[k]!;
    ribbon(g, l, aw, LIFT.asphalt, C(st.asphalt!), asphaltInfo(ROAD_CLASSES[k], aw / 2, P.asphalt, GROUND_CITY));
    ribbon(g, l, 0.12, LIFT.asphalt + 0.002, C(CITY_PAL.curb), gInfo(P.none), aw / 2 - 0.06);
    ribbon(g, l, 0.12, LIFT.asphalt + 0.002, C(CITY_PAL.curb), gInfo(P.none), -aw / 2 + 0.06);
    if (st.dash && aw > 3.2) dashes(g, l, 0.14, LIFT.dash, C(CITY_PAL.dash), 1.6, 4, gInfo(P.none));
  }
  for (const e of extras) e();
}

/** Main streets for L1 (asphalt only) and freeway decks as flat ribbons. */
function streetsL1(ctx: ChunkContext, g: CityBatch, x0: number, z0: number) {
  const rd = ctx.chunk.roads;
  const lift = 0.14;
  const onGround = (x: number, z: number, y: number) => Math.max(y, ctx.dem(x, z));
  for (let i = 0; i < rd.count; i++) {
    const k = rd.cls[i], f = rd.flags[i];
    const st = STREET[k];
    if (!st || !(st.asphalt || k === R.pedestrian)) continue;
    const elevated = (f & (ROAD_FLAG.deckOnly | ROAD_FLAG.bridge)) !== 0;
    for (const l of streetPieces(ctx, i, x0, z0, CELL)) {
      const w = rd.width[i];
      if (!elevated) ribbon(g, l, w, lift - 0.02, C(st.walk === CITY_PAL.sidewalk ? CITY_PAL.sidewalk : st.walk), gInfo(P.none), 0, onGround);
      const aw = st.asphalt ? Math.max(1.6, w - CURB_BAND * 2) : w;
      ribbon(g, l, aw, lift, C(st.asphalt ?? st.walk), st.asphalt && !elevated ? asphaltInfo(ROAD_CLASSES[k], aw / 2, P.asphalt, GROUND_CITY) : gInfo(st.asphalt ? P.asphalt : P.stone), 0, elevated ? undefined : onGround);
    }
  }
}

/** Pier decks (area class pier with the deck flag) of the square: planks at y 0 and a dark timber edge. */
const _pp = { x: 0, z: 0 };
function piers(ctx: ChunkContext, g: CityBatch, x0: number, z0: number, s: number) {
  const ar = ctx.chunk.areas;
  for (let i = 0; i < ar.count; i++) {
    if (ar.cls[i] !== A.pier || !(ar.flags[i] & AREA_FLAG.deck)) continue;
    const poly: Vec2[] = [];
    let cx = 0, cz = 0;
    for (let k = ar.pStart[i]; k < ar.pStart[i + 1]; k++) { const p = { x: ar.xz[k * 2], z: ar.xz[k * 2 + 1] }; poly.push(p); cx += p.x; cz += p.z; }
    if (poly.length < 3) continue;
    cx /= poly.length; cz /= poly.length;
    if (cx < x0 || cz < z0 || cx >= x0 + s || cz >= z0 + s || ctx.inSlab(cx, cz)) continue;
    // a pier crossing the slab edge stops at it (the hero draws its own decks inside)
    if (ctx.hero && ctx.clampXZ) for (const p of poly) { ctx.clampXZ(p.x, p.z, _pp); p.x = _pp.x; p.z = _pp.z; }
    const ang = Math.atan2(poly[1].z - poly[0].z, poly[1].x - poly[0].x);
    g.polygon(poly, 0.06, C(CITY_PAL.pier), [P.planks, ang, 0, GROUND_CITY]);
    g.walls(poly, -1.2, 0.06, C(CITY_PAL.pierSide), [0, 0, 0, GROUND_CITY], shade(CITY_PAL.pierSide, 0.6));
  }
}

// ---------------------------------------------------------------------------
// props
// ---------------------------------------------------------------------------

/** Instanced props of a chunk (trees, conifers, palms, lamps), y = flattened ground. */
export interface PropArrays { count: number; kind: Uint8Array; variant: Uint8Array; xyzr: Float32Array }

function propsOf(ctx: ChunkContext): PropArrays {
  const p = ctx.chunk.props;
  const kind: number[] = [], variant: number[] = [], xyzr: number[] = [];
  for (let i = 0; i < p.count; i++) {
    const k = p.kind[i];
    if (k !== PK.tree && k !== PK.pine && k !== PK.palm && k !== PK.lamp) continue;
    const x = p.xz[i * 2], z = p.xz[i * 2 + 1];
    if (ctx.inSlab(x, z) || ctx.excluded(x, z) || sampleField(ctx.sdf, ctx.mask, x, z) < 0.3) continue;
    kind.push(k); variant.push(p.variant[i]); xyzr.push(x, ctx.height(x, z), z, p.rot[i]);
  }
  return { count: kind.length, kind: Uint8Array.from(kind), variant: Uint8Array.from(variant), xyzr: Float32Array.from(xyzr) };
}

/** Street furniture baked into the L0 toy batch: benches, bike racks, stop poles. */
function furniture(ctx: ChunkContext, t: CityBatch, x0: number, z0: number) {
  const p = ctx.chunk.props;
  const wood = '#a4774d', metal = '#39433f';
  for (let i = 0; i < p.count; i++) {
    const k = p.kind[i];
    if (k !== PK.bench && k !== PK['bike-rack'] && k !== PK.stop) continue;
    const x = p.xz[i * 2], z = p.xz[i * 2 + 1];
    if (x < x0 || z < z0 || x >= x0 + CELL || z >= z0 + CELL || ctx.inSlab(x, z) || ctx.excluded(x, z)) continue;
    const y = ctx.height(x, z), ry = p.rot[i];
    const keep: Info = [0, y, 0, 0];
    if (k === PK.bench) {
      t.add(BOX(), M(x, y + 0.42, z, ry, 1.55, 0.08, 0.46), wood, keep);
      t.add(BOX(), M(x, y + 0.58, z, ry, 1.55, 0.36, 0.06, -0.18), wood, keep);
      for (const s of [-0.65, 0.65]) t.add(BOX(), M(x + Math.cos(ry) * s, y, z - Math.sin(ry) * s, ry, 0.08, 0.42, 0.4), metal, keep);
    } else if (k === PK['bike-rack']) {
      for (const s of [-0.5, 0, 0.5]) t.add(BOX(), M(x + Math.cos(ry) * s, y, z - Math.sin(ry) * s, ry, 0.06, 0.7, 0.7), '#56655f', keep);
    } else {
      t.add(CYL(6), M(x, y, z, 0, 0.05, 2.6, 0.05), metal, keep);
      t.add(BOX(), M(x, y + 2.2, z, ry, 0.5, 0.6, 0.05), '#d8744a', keep);
    }
  }
}

// ---------------------------------------------------------------------------
// tiers
// ---------------------------------------------------------------------------

const lipColor = () => C(CITY_PAL.lip);

export interface L1Result {
  cells: { sub: number; toy: PoolArrays | null; ground: PoolArrays | null }[];
  props: PropArrays;
  /** 'terrain'-based landmarks centred in this chunk: the lowest ground in their exclusion */
  bases: { id: string; y: number }[];
  ms: number;
}

export function buildL1(ctx: ChunkContext): L1Result {
  const t0 = performance.now();
  const refs = buildingsOf(ctx);
  const paint = paintFor(ctx);
  const cells: L1Result['cells'] = [];
  for (let sub = 0; sub < 4; sub++) {
    const ox = ctx.chunk.cx * CHUNK + (sub & 1) * CELL, oz = ctx.chunk.cz * CHUNK + (sub >> 1) * CELL;
    const t = new CityBatch(4096), g = new CityBatch(2048);
    g.clampXZ = ctx.clampXZ;
    for (const r of refs) if (r.sub === sub) toyBuildingL1(t, specOf(ctx, r, false));
    buildGround(g, {
      x0: ox, z0: oz, size: CELL, step: 4,
      sdf: (x, z) => sampleField(ctx.sdf, ctx.mask, x, z),
      height: ctx.dem, paint, lip: 1.4, lipColor, skirt: 2.5,
    });
    streetsL1(ctx, g, ox, oz);
    piers(ctx, g, ox, oz, CELL);
    cells.push({ sub, toy: t.toPool(), ground: g.toPool() });
  }
  const bases: L1Result['bases'] = [];
  const ox = ctx.chunk.cx * CHUNK, oz = ctx.chunk.cz * CHUNK;
  for (const e of ctx.init.excludes) {
    if (e.base !== 'terrain' || e.x < ox || e.z < oz || e.x >= ox + CHUNK || e.z >= oz + CHUNK) continue;
    const r = e.r ?? 8;
    let lo = Infinity;
    for (let dz = -r; dz <= r; dz += 2) for (let dx = -r; dx <= r; dx += 2) {
      if (dx * dx + dz * dz > r * r) continue;
      if (sampleField(ctx.sdf, ctx.mask, e.x + dx, e.z + dz) <= 0) continue;
      lo = Math.min(lo, ctx.height(e.x + dx, e.z + dz));
    }
    if (lo < Infinity) bases.push({ id: e.id, y: lo });
  }
  return { cells, props: propsOf(ctx), bases, ms: performance.now() - t0 };
}

/** `buildings`: per-building toy index ranges + descriptors (lane D2's kit swap, world/sf/l0index.ts), null when none */
export interface L0Result { sub: number; toy: TypedBatchArrays | null; ground: TypedBatchArrays | null; triangles: number; ms: number; buildings: L0Buildings | null }

export function buildL0(ctx: ChunkContext, sub: number): L0Result {
  const t0 = performance.now();
  const ox = ctx.chunk.cx * CHUNK + (sub & 1) * CELL, oz = ctx.chunk.cz * CHUNK + (sub >> 1) * CELL;
  const t = new CityBatch(16384), g = new CityBatch(8192);
  g.clampXZ = ctx.clampXZ;
  const rec = new L0Recorder();
  for (const r of buildingsOf(ctx)) if (r.sub === sub) { const spec = specOf(ctx, r, true); rec.begin(t); toyBuildingL0(t, spec); rec.end(t, l0Desc(ctx.chunk.buildings, r.i, spec, ctx.height)); }
  furniture(ctx, t, ox, oz);
  buildGround(g, {
    x0: ox, z0: oz, size: CELL, step: 2,
    sdf: (x, z) => sampleField(ctx.sdf, ctx.mask, x, z),
    height: ctx.height, paint: paintFor(ctx), lip: 1.4, lipColor, skirt: 1.5,
  });
  streetsL0(ctx, g, t, ox, oz);
  piers(ctx, g, ox, oz, CELL);
  return { sub, toy: t.arrays(), ground: g.arrays(), triangles: t.triangleCount + g.triangleCount, ms: performance.now() - t0, buildings: rec.result() };
}

/** Sea-level check used by tests and the far builder: is (x, z) city ground of this chunk? */
export function isGround(ctx: ChunkContext, x: number, z: number) { return sampleField(ctx.sdf, ctx.mask, x, z) > 0; }

