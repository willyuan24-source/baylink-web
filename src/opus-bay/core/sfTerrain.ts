import { CHUNK, CURB_BAND, smoothstep } from './geo';
import type { Blocker, CityTerrain } from './terrain';
import type { Polygon, SurfaceKind, Vec2 } from './types';
import {
  AREA_CLASSES, AREA_FLAG, CHUNK_FLAG, DEM_N, DEM_STEP, ROAD_CLASSES, ROAD_FLAG, demSample,
  emptyAreas, emptyBuildings, emptyPlaces, emptyProps, emptyRoads,
  type ChunkData, type FarData, type RoadClass, type SfManifest,
} from '../world/sf/format';

/**
 * Collision / walk rasters and the terrain provider of the streamed San Francisco (plan §5.6). Pure and worker-safe:
 * no three.js, no DOM, and no runtime import of core/terrain or data/district (type-only imports are erased), so lane
 * C's module worker can run `rasterizeChunk` next to decoding.
 *
 * Per chunk (128 u square, origin (cx·128, cz·128)) `rasterizeChunk` builds 0.5 u rasters — the same cell size and
 * lattice as the hero grid in core/terrain (cell centres at x ≡ 0.25 mod 0.5), so both answer on one lattice:
 * - `h`     ground height at cell CORNERS, (n+1)² samples, h[j·(n+1)+i] at (ox + i·0.5, oz + j·0.5), stored as
 *           u16 = (y + SF_H_BIAS)·SF_H_Q (y ∈ −4 … 127). Decode with `rasterHeight` / `cornerHeight`. Shared chunk edges
 *           hold identical values (shared DEM edge + road runs clipped ±8 u), so bilinear heights are C0 across chunks.
 *           Model: chunk DEM (2 u, bilinear) with road corridors flattened toward their centreline y (a coverage-
 *           weighted average of every nearby corridor, so junctions become small plateaus instead of steps), blended
 *           into the ground over ROAD_BLEND; landmark decks with an explicit y are flat.
 * - `surf`  cell surface code (SF_SURFACES index + 1, the same codes as core/terrain SURFACE_CODES; 0 = not walkable):
 *           land 'pavement', parks / grass / golf / pitches 'grass', forest / scrub / rock 'dirt', sand, plazas, piers
 *           'wood'; road corridors 'road' (vehicle classes; the outer CURB_BAND of corridors ≥ 3 u is 'pavement'),
 *           pedestrian 'plaza', footway / cycleway 'pavement', path / track 'dirt', steps 'stairs'. Not walkable:
 *           water, building interiors, at-grade fenced freeways (ROAD_FLAG.noWalk), ground steeper than MAX_GRADE that
 *           is neither stairs nor a landmark deck. Viaducts (deckOnly), tram and rail entries are ignored (they lie over / inside streets).
 * - `kind`  SF_KIND (= core/terrain KIND): open water by default, then area rings in file order (land, lakes, piers →
 *           deck); walkable road corridors over water (bridges) become deck.
 * - `stand` bit 0 (STAND_BIT): a SF_STAND_RADIUS disc fits (cell and its 8 neighbours walkable, no blocker within the
 *           radius); bit 1 (BLOCK_BIT): a blocker lies within the radius (set even where the ground is not walkable).
 * - `blockers` the chunk's own building footprints (every building belongs to the chunk holding its centroid and may
 *           overhang by ≤ manifest.maxOverhang) in a 4 u CSR hash that covers the overhang, so a query looks at the
 *           resident chunks within maxOverhang. Buildings inside a landmark's `exclude` are dropped (the landmark's own
 *           walk.blockers replace them).
 *
 * - pier decks (area class pier / AREA_FLAG.deck) are flat at PIER_DECK_Y where the ground is lower.
 *
 * `createCityTerrain` is the main-thread provider behind core/terrain's `setCityTerrain`: it keeps the resident rasters,
 * stamps overhanging footprints into neighbours on attach, answers the CityTerrain queries (not resident → standAt −1,
 * height from the far 16 u DEM), owns the landmark blockers (one global hash; they never depend on residency),
 * synthesises rasters for open-water chunk slots that carry landmark decks (the Golden Gate Bridge span), and stamps
 * the decks of 'terrain'-based landmarks (deferredLandmark) once their base is known — pinned by the renderer
 * (setLandmarkBase) or resolved by the renderer's own rule — re-stamping them if the base moves.
 */

// ---------------------------------------------------------------------------
// Codes and constants (kept equal to core/terrain — tests/opus-bay-sf-terrain.test.ts checks)
// ---------------------------------------------------------------------------

export const SF_CELL = 0.5;
/** cells per chunk side */
export const SF_N = CHUNK / SF_CELL;
/** height quantisation of ChunkRasters.h: u16 = (y + SF_H_BIAS)·SF_H_Q */
export const SF_H_Q = 500;
export const SF_H_BIAS = 4;
/** = core/terrain SURFACE_CODES (code = index + 1) */
export const SF_SURFACES: readonly SurfaceKind[] = ['pavement', 'wood', 'grass', 'sand', 'plaza', 'stairs', 'dirt', 'road'];
/** = core/terrain KIND */
export const SF_KIND = { outside: 0, water: 1, land: 2, deck: 3 } as const;
/** = core/terrain STAND_RADIUS */
export const SF_STAND_RADIUS = 0.45;
export const STAND_BIT = 1;
export const BLOCK_BIT = 2;
/** ground steeper than this (rise per run over a 0.5 u cell) is a wall unless it is stairs (plan §6.2) */
export const MAX_GRADE = 0.9;
/** road corridors blend into the ground over this distance beyond their half width (u) */
export const ROAD_BLEND = 1.5;
/** blocker hash cell (u) */
export const BLOCK_CELL = 4;
/** highest ground in the city model (Twin Peaks ≈ 50, Sutro base ≈ 46.5, landmark decks) — core/terrain MAX_GROUND_Y */
export const CITY_MAX_GROUND_Y = 120;
/** pier deck height (world y) — the y lane C's world/sf/build draws city pier decks at */
export const PIER_DECK_Y = 0.06;

const code = (s: SurfaceKind) => SF_SURFACES.indexOf(s) + 1;
const S_PAVE = code('pavement'), S_WOOD = code('wood'), S_STAIRS = code('stairs'), S_ROAD = code('road');
const APRON = 2;
const W_Q = SF_H_Q, W_B = SF_H_BIAS;

const AREA_SURFACE: Record<(typeof AREA_CLASSES)[number], SurfaceKind | null> = {
  land: 'pavement', water: null, park: 'grass', grass: 'grass', forest: 'dirt', sand: 'sand', pier: 'wood',
  plaza: 'plaza', parking: 'pavement', golf: 'grass', pitch: 'grass', scrub: 'dirt', rock: 'dirt',
};
const AREA_CODE = AREA_CLASSES.map(c => { const s = AREA_SURFACE[c]; return s ? code(s) : 0; });
const A_LAND = AREA_CLASSES.indexOf('land'), A_WATER = AREA_CLASSES.indexOf('water'), A_PIER = AREA_CLASSES.indexOf('pier');

const ROAD_SURFACE: Record<RoadClass, SurfaceKind | null> = {
  motorway: 'road', trunk: 'road', primary: 'road', secondary: 'road', tertiary: 'road', residential: 'road', service: 'road',
  pedestrian: 'plaza', footway: 'pavement', path: 'dirt', cycleway: 'pavement', steps: 'stairs', track: 'dirt', tram: null, rail: null,
};
const ROAD_CODE = ROAD_CLASSES.map(c => { const s = ROAD_SURFACE[c]; return s ? code(s) : 0; });
const VEHICLE = ROAD_CLASSES.map(c => ROAD_SURFACE[c] === 'road');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A chunk's own building footprints as a compact CSR spatial hash (all typed arrays, transferable). */
export interface ChunkBlockers {
  count: number;
  /** hash lattice: cols × rows cells of `cell` u from (x0, z0); covers the chunk square and every footprint's bbox */
  cell: number;
  x0: number;
  z0: number;
  cols: number;
  rows: number;
  /** items of hash cell k are items[offsets[k] … offsets[k+1]−1] (blocker indices) */
  offsets: Uint32Array;
  items: Uint16Array;
  /** per blocker: bbox x0, z0, x1, z1 */
  bbox: Float32Array;
  /** polygon of blocker k: xz[2·vStart[k] … 2·vStart[k+1]−1] (world x, z pairs, CCW) */
  vStart: Uint32Array;
  xz: Float32Array;
  /** index into ChunkData.buildings of each blocker */
  building: Uint16Array;
  /** wall top (world y = baseY + height) of each blocker; pitched roofs rise a little above it */
  top: Float32Array;
  /** blockers whose STAND_RADIUS-padded bbox leaves the chunk square (stamped into resident neighbours on attach) */
  overhang: Uint16Array;
}

export interface ChunkRasters {
  cx: number;
  cz: number;
  /** 0.5 */
  cell: number;
  /** 256 cells per side */
  n: number;
  /** corner heights, (n+1)², u16 (see SF_H_Q / SF_H_BIAS); decode with rasterHeight / cornerHeight */
  h: Uint16Array;
  /** n², surface code, 0 = not walkable */
  surf: Uint8Array;
  /** n², SF_KIND */
  kind: Uint8Array;
  /** n², STAND_BIT | BLOCK_BIT */
  stand: Uint8Array;
  blockers: ChunkBlockers;
  /** CHUNK_FLAG bits of the source chunk (0 for a synthesised open-water chunk) */
  flags: number;
  /** true once landmark walk data was applied (by rasterizeChunk with opts.landmarks, or by the provider on attach) */
  landmarks: boolean;
  /** rasterising time (ms) */
  ms: number;
}

/** `top`: LOCAL y above the base of what stands on the blocker (lane D2, D2-10): the provider's Blocker.top = base + top. */
type LocalBlocker = { x: number; z: number; r: number; top?: number } | { poly: Vec2[]; top?: number };
interface LocalSurface { poly: Vec2[]; y: number | 'terrain'; surface: SurfaceKind }

/**
 * The walk-relevant part of a landmark record (world/sf/landmarks SfLandmark is structurally one). Plain data: pass
 * `landmarkWalkInputs(SF_LANDMARKS)` through postMessage (SfLandmark itself carries functions).
 */
export interface LandmarkWalkInput {
  id: string;
  x: number;
  z: number;
  yaw: number;
  base: 'terrain' | number;
  /**
   * base 'terrain' only, a hint: the provider uses it until the far city or the landmark's centre chunk resolves the
   * base (or setLandmarkBase pins the renderer's value). Numeric decks of 'terrain' landmarks never use it in the worker.
   */
  baseY?: number;
  /**
   * city buildings whose centroid lies inside are dropped from collision (r around (x, z), or a world polygon) — pass
   * the same exclusion the renderer drops buildings with, or they stay as invisible walls; also sets the base radius
   */
  exclude?: { r: number } | { poly: Vec2[] };
  /**
   * the renderer lowers the city ground inside `exclude` by this much (world/sf/sites SINK, so the landmark's own
   * lanes and terraces stay on top); collision follows it (landmark decks keep their own y). Default 0.
   */
  sink?: number;
  /** LOCAL space: world = (x + lx·cos yaw + lz·sin yaw, z − lx·sin yaw + lz·cos yaw); numeric surface y is above baseY */
  walk?: { blockers: LocalBlocker[]; surfaces?: LocalSurface[] };
}

export interface RasterizeOptions {
  /** landmark walk data (exclusion, decks, blockers); pass the same list to createCityTerrain */
  landmarks?: readonly LandmarkWalkInput[];
  /**
   * Reserved, ignored: hero ownership is composed on the main thread by core/terrain (hero grid first, city as
   * fallback), so the worker never masks the city inside the slab.
   */
  heroMask?: { slab: ArrayLike<number> };
}

/**
 * Strip a landmark list down to cloneable walk data. With `ground` (e.g. the far DEM), a base-'terrain' landmark
 * without baseY gets the lowest ground inside its exclude (sampled every 2 u) — lane D's placement rule — so every
 * chunk and the renderer agree on it. Without either, each chunk falls back to its own DEM at the landmark centre,
 * which can disagree across a chunk border: always resolve baseY for landmarks with numeric-y decks.
 */
export function landmarkWalkInputs(list: readonly LandmarkWalkInput[], ground?: (x: number, z: number) => number): LandmarkWalkInput[] {
  const lowest = (l: LandmarkWalkInput) => {
    if (!ground) return undefined;
    const e = l.exclude ?? { r: 4 };
    let lo = Infinity;
    if ('r' in e) {
      for (let dz = -e.r; dz <= e.r; dz += 2) for (let dx = -e.r; dx <= e.r; dx += 2) if (dx * dx + dz * dz <= e.r * e.r) lo = Math.min(lo, ground(l.x + dx, l.z + dz));
    } else {
      const poly = flatPoly(e.poly), [x0, z0, x1, z1] = polyBBox(poly);
      for (let z = z0; z <= z1; z += 2) for (let x = x0; x <= x1; x += 2) if (pointInRing(poly, 0, poly.length / 2, x, z)) lo = Math.min(lo, ground(x, z));
    }
    return Number.isFinite(lo) ? lo : ground(l.x, l.z);
  };
  return list.map(l => ({
    id: l.id, x: l.x, z: l.z, yaw: l.yaw, base: l.base,
    ...(l.baseY !== undefined ? { baseY: l.baseY } : l.base === 'terrain' && ground ? { baseY: lowest(l) } : {}),
    ...(l.exclude ? { exclude: 'r' in l.exclude ? { r: l.exclude.r } : { poly: l.exclude.poly.map(p => ({ x: p.x, z: p.z })) } } : {}),
    ...(l.sink ? { sink: l.sink } : {}),
    ...(l.walk ? {
      walk: {
        blockers: l.walk.blockers.map(b => ({ ...('poly' in b ? { poly: b.poly.map(p => ({ x: p.x, z: p.z })) } : { x: b.x, z: b.z, r: b.r }), ...(b.top !== undefined ? { top: b.top } : {}) })),
        ...(l.walk.surfaces ? { surfaces: l.walk.surfaces.map(s => ({ poly: s.poly.map(p => ({ x: p.x, z: p.z })), y: s.y, surface: s.surface })) } : {}),
      },
    } : {}),
  }));
}

// ---------------------------------------------------------------------------
// Lattice helpers (typed-array polygons; sample k of a lattice sits at x0 + k·cell)
// ---------------------------------------------------------------------------

interface Lattice { x0: number; z0: number; cell: number; cols: number; rows: number }

/** Even-odd scanline fill over several rings (xz pairs, [start, end) point ranges): fn(index) for every lattice sample inside. */
function scanFill(L: Lattice, xz: ArrayLike<number>, ranges: number[], fn: (i: number) => void) {
  let zMin = Infinity, zMax = -Infinity;
  for (let k = 0; k < ranges.length; k += 2) for (let p = ranges[k]; p < ranges[k + 1]; p++) { const z = xz[2 * p + 1]; if (z < zMin) zMin = z; if (z > zMax) zMax = z; }
  const r0 = Math.max(0, Math.ceil((zMin - L.z0) / L.cell)), r1 = Math.min(L.rows - 1, Math.floor((zMax - L.z0) / L.cell));
  const xs: number[] = [];
  for (let r = r0; r <= r1; r++) {
    const z = L.z0 + r * L.cell;
    xs.length = 0;
    for (let k = 0; k < ranges.length; k += 2) {
      const s = ranges[k], e = ranges[k + 1];
      for (let p = s, q = e - 1; p < e; q = p++) {
        const az = xz[2 * p + 1], bz = xz[2 * q + 1];
        if ((az > z) !== (bz > z)) { const ax = xz[2 * p], bx = xz[2 * q]; xs.push(ax + ((z - az) * (bx - ax)) / (bz - az)); }
      }
    }
    if (xs.length < 2) continue;
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const c0 = Math.max(0, Math.ceil((xs[k] - L.x0) / L.cell)), c1 = Math.min(L.cols - 1, Math.floor((xs[k + 1] - L.x0) / L.cell));
      for (let c = c0; c <= c1; c++) fn(r * L.cols + c);
    }
  }
}

/** fn(index, distance, t) for every lattice sample within `reach` of segment a→b (t = projection parameter 0…1). */
function visitSegment(L: Lattice, ax: number, az: number, bx: number, bz: number, reach: number, fn: (i: number, d: number, t: number) => void) {
  const c0 = Math.max(0, Math.ceil((Math.min(ax, bx) - reach - L.x0) / L.cell)), c1 = Math.min(L.cols - 1, Math.floor((Math.max(ax, bx) + reach - L.x0) / L.cell));
  const r0 = Math.max(0, Math.ceil((Math.min(az, bz) - reach - L.z0) / L.cell)), r1 = Math.min(L.rows - 1, Math.floor((Math.max(az, bz) + reach - L.z0) / L.cell));
  if (c0 > c1 || r0 > r1) return;
  const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz, R2 = reach * reach;
  for (let r = r0; r <= r1; r++) {
    const z = L.z0 + r * L.cell;
    for (let c = c0; c <= c1; c++) {
      const x = L.x0 + c * L.cell;
      let t = L2 > 0 ? ((x - ax) * dx + (z - az) * dz) / L2 : 0;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const ex = x - ax - dx * t, ez = z - az - dz * t, d2 = ex * ex + ez * ez;
      if (d2 <= R2) fn(r * L.cols + c, Math.sqrt(d2), t);
    }
  }
}

function pointInRing(xz: ArrayLike<number>, s: number, e: number, x: number, z: number): boolean {
  let inside = false;
  for (let p = s, q = e - 1; p < e; q = p++) {
    const az = xz[2 * p + 1], bz = xz[2 * q + 1];
    if ((az > z) !== (bz > z) && x < ((xz[2 * q] - xz[2 * p]) * (z - az)) / (bz - az) + xz[2 * p]) inside = !inside;
  }
  return inside;
}

function ringDist2(xz: ArrayLike<number>, s: number, e: number, x: number, z: number): number {
  let best = Infinity;
  for (let p = s, q = e - 1; p < e; q = p++) {
    const ax = xz[2 * q], az = xz[2 * q + 1], dx = xz[2 * p] - ax, dz = xz[2 * p + 1] - az, L2 = dx * dx + dz * dz;
    let t = L2 > 0 ? ((x - ax) * dx + (z - az) * dz) / L2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const ex = x - ax - dx * t, ez = z - az - dz * t, d = ex * ex + ez * ez;
    if (d < best) best = d;
  }
  return best;
}

const flatPoly = (poly: readonly Vec2[]) => { const a = new Float64Array(poly.length * 2); poly.forEach((p, i) => { a[2 * i] = p.x; a[2 * i + 1] = p.z; }); return a; };

// ---------------------------------------------------------------------------
// Landmarks (world space)
// ---------------------------------------------------------------------------

/** `lm` = index of its landmark in the prepared list; `top` = its LOCAL top (D2-10), obj.top = base + top */
interface LmBlocker { poly: Float64Array | null; x: number; z: number; r: number; bbox: [number, number, number, number]; obj: Blocker; lm: number; top?: number }
interface LmSurface { poly: Float64Array; y: number | null; code: number; bbox: [number, number, number, number] }
interface PreparedLandmarks {
  blockers: LmBlocker[];
  surfaces: LmSurface[];
  excludes: (({ x: number; z: number; r: number } | { poly: Float64Array; bbox: [number, number, number, number] }) & { sink: number })[];
  /** union bbox of each landmark's walk data, to find the chunk slots it touches */
  extents: [number, number, number, number][];
}

const polyBBox = (a: ArrayLike<number>): [number, number, number, number] => {
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (let i = 0; i < a.length; i += 2) { if (a[i] < x0) x0 = a[i]; if (a[i] > x1) x1 = a[i]; if (a[i + 1] < z0) z0 = a[i + 1]; if (a[i + 1] > z1) z1 = a[i + 1]; }
  return [x0, z0, x1, z1];
};

/**
 * A 'terrain'-based landmark with numeric-y surfaces: its decks depend on the resolved base, which only the main thread
 * knows (the renderer's base, see CityTerrainProvider.setLandmarkBase), so `rasterizeChunk` leaves all of its surfaces
 * to the provider. Its blockers and exclusion are base-independent and stay in the worker.
 */
export const deferredLandmark = (l: LandmarkWalkInput): boolean => l.base === 'terrain' && !!l.walk?.surfaces?.some(s => s.y !== 'terrain');

/** Base y of a landmark whose base does not need resolving (numeric base, or the record's own baseY), else ground. */
const fixedBase = (l: LandmarkWalkInput, ground: (x: number, z: number) => number) => (typeof l.base === 'number' ? l.base : l.baseY ?? ground(l.x, l.z));

/**
 * Local → world for every landmark. `baseOf` gives the base y numeric surface heights sit on; `withSurfaces` false
 * leaves a landmark's surfaces out (deferred ones in the worker). Extents always cover every surface.
 */
function prepareLandmarks(list: readonly LandmarkWalkInput[], baseOf: (l: LandmarkWalkInput) => number, withSurfaces: (l: LandmarkWalkInput) => boolean = () => true): PreparedLandmarks {
  const out: PreparedLandmarks = { blockers: [], surfaces: [], excludes: [], extents: [] };
  for (const [li, l] of list.entries()) {
    const c = Math.cos(l.yaw), s = Math.sin(l.yaw);
    const W = (p: Vec2): Vec2 => ({ x: l.x + p.x * c + p.z * s, z: l.z - p.x * s + p.z * c });
    const baseY = baseOf(l), keep = withSurfaces(l);
    const ext: [number, number, number, number] = [l.x, l.z, l.x, l.z];
    const grow = (b: [number, number, number, number]) => { ext[0] = Math.min(ext[0], b[0]); ext[1] = Math.min(ext[1], b[1]); ext[2] = Math.max(ext[2], b[2]); ext[3] = Math.max(ext[3], b[3]); };
    if (l.exclude) {
      const sink = l.sink ?? 0;
      if ('r' in l.exclude) out.excludes.push({ x: l.x, z: l.z, r: l.exclude.r, sink });
      else { const poly = flatPoly(l.exclude.poly); out.excludes.push({ poly, bbox: polyBBox(poly), sink }); }
    }
    for (const b of l.walk?.blockers ?? []) {
      if ('poly' in b) {
        const wp = b.poly.map(W), poly = flatPoly(wp), bbox = polyBBox(poly);
        out.blockers.push({ poly, x: 0, z: 0, r: 0, bbox, obj: { kind: 'polygon', polygon: wp, ...(b.top !== undefined ? { top: baseY + b.top } : {}) }, lm: li, top: b.top });
        grow(bbox);
      } else {
        const p = W(b), bbox: [number, number, number, number] = [p.x - b.r, p.z - b.r, p.x + b.r, p.z + b.r];
        out.blockers.push({ poly: null, x: p.x, z: p.z, r: b.r, bbox, obj: { kind: 'circle', x: p.x, z: p.z, r: b.r, ...(b.top !== undefined ? { top: baseY + b.top } : {}) }, lm: li, top: b.top });
        grow(bbox);
      }
    }
    for (const sf of l.walk?.surfaces ?? []) {
      const poly = flatPoly(sf.poly.map(W)), bbox = polyBBox(poly);
      if (keep) out.surfaces.push({ poly, y: sf.y === 'terrain' ? null : sf.y + baseY, code: code(sf.surface), bbox });
      grow(bbox);
    }
    out.extents.push(ext);
  }
  return out;
}

function excludedBy(lm: PreparedLandmarks, x: number, z: number): boolean {
  for (const e of lm.excludes) {
    if ('r' in e) { if ((x - e.x) ** 2 + (z - e.z) ** 2 < e.r * e.r) return true; }
    else if (x >= e.bbox[0] && x <= e.bbox[2] && z >= e.bbox[1] && z <= e.bbox[3] && pointInRing(e.poly, 0, e.poly.length / 2, x, z)) return true;
  }
  return false;
}

/** The exclusion rule lane C must share for rendering: a city building is dropped when its centroid (vertex mean) is inside. */
export function landmarkExcludes(list: readonly LandmarkWalkInput[]): (x: number, z: number) => boolean {
  const lm = prepareLandmarks(list, () => 0, () => false);
  return (x, z) => excludedBy(lm, x, z);
}

// ---------------------------------------------------------------------------
// Rasterising one chunk (worker)
// ---------------------------------------------------------------------------

const boxHit = (b: ArrayLike<number>, x0: number, z0: number, x1: number, z1: number) => b[0] <= x1 && b[2] >= x0 && b[1] <= z1 && b[3] >= z0;

/** Per-cell result of the road pass: nearest corridor (distance beyond its half width), its surface, barriers. */
interface RoadCells { best: Float32Array; code: Uint8Array; barrier: Uint8Array; bridged: Uint8Array }

/**
 * The ground height model on the 0.5 u corner lattice of a chunk plus an apron of A cells ((n + 2A + 1)² floats from
 * (ox − A·0.5, oz − A·0.5)): chunk DEM (bilinear), pier decks raised to PIER_DECK_Y, then every walkable road corridor
 * (not deckOnly, not tram / rail) pulls the ground toward its centreline y — a coverage-weighted average of all nearby
 * corridors (junctions become small plateaus, never steps), full inside the half width, fading over ROAD_BLEND.
 * With `cells`, also records each cell centre's nearest corridor for the surface pass.
 */
function groundCorners(chunk: ChunkData, A: number, cells: RoadCells | null): Float32Array {
  const n = SF_N, m = n + 2 * A, cell = SF_CELL, ox = chunk.cx * CHUNK, oz = chunk.cz * CHUNK;
  const Ctr: Lattice = { x0: ox + (0.5 - A) * cell, z0: oz + (0.5 - A) * cell, cell, cols: m, rows: m };
  const Cor: Lattice = { x0: ox - A * cell, z0: oz - A * cell, cell, cols: m + 1, rows: m + 1 };
  const wx0 = ox - A * cell, wz0 = oz - A * cell, wx1 = ox + CHUNK + A * cell, wz1 = oz + CHUNK + A * cell;
  const NV = (m + 1) * (m + 1);
  const hv = new Float32Array(NV);
  for (let r = 0, k = 0; r <= m; r++) for (let c = 0; c <= m; c++, k++) hv[k] = demSample(chunk.dem, Cor.x0 + c * cell, Cor.z0 + r * cell);
  // pier decks are flat at PIER_DECK_Y (lane C draws them there); where land pokes above the deck, the land wins
  const ar = chunk.areas;
  for (let i = 0; i < ar.count; i++) {
    if (ar.flags[i] & AREA_FLAG.hole || !(ar.cls[i] === A_PIER || ar.flags[i] & AREA_FLAG.deck)) continue;
    scanFill(Cor, ar.xz, [ar.pStart[i], ar.pStart[i + 1]], k => { if (hv[k] < PIER_DECK_Y) hv[k] = PIER_DECK_Y; });
  }
  const sumW = new Float32Array(NV), sumWY = new Float32Array(NV), cov = new Float32Array(NV);
  const rd = chunk.roads;
  for (let i = 0; i < rd.count; i++) {
    const f = rd.flags[i], cls = rd.cls[i];
    if (f & ROAD_FLAG.deckOnly || !ROAD_CODE[cls]) continue;
    const half = rd.width[i] / 2, reach = half + ROAD_BLEND;
    const sc = f & ROAD_FLAG.steps ? S_STAIRS : ROAD_CODE[cls];
    const curb = VEHICLE[cls] && sc === S_ROAD && rd.width[i] >= 3 ? half - CURB_BAND : Infinity;
    const noWalk = (f & ROAD_FLAG.noWalk) !== 0, bridge = (f & ROAD_FLAG.bridge) !== 0;
    for (let p = rd.pStart[i] + 1; p < rd.pStart[i + 1]; p++) {
      const ax = rd.xyz[3 * p - 3], ay = rd.xyz[3 * p - 2], az = rd.xyz[3 * p - 1], bx = rd.xyz[3 * p], by = rd.xyz[3 * p + 1], bz = rd.xyz[3 * p + 2];
      if (Math.max(ax, bx) + reach < wx0 || Math.min(ax, bx) - reach > wx1 || Math.max(az, bz) + reach < wz0 || Math.min(az, bz) - reach > wz1) continue;
      visitSegment(Cor, ax, az, bx, bz, reach, (k, d, t) => {
        const w = d <= half ? 1 : 1 - smoothstep(half, reach, d);
        if (w <= 0) return;
        sumW[k] += w; sumWY[k] += w * (ay + (by - ay) * t);
        if (w > cov[k]) cov[k] = w;
      });
      if (!cells) continue;
      visitSegment(Ctr, ax, az, bx, bz, half, (k, d) => {
        if (noWalk) { cells.barrier[k] = 1; return; }
        if (bridge) cells.bridged[k] = 1;
        const rel = d - half;
        if (rel < cells.best[k]) { cells.best[k] = rel; cells.code[k] = d > curb ? S_PAVE : sc; }
      });
    }
  }
  for (let k = 0; k < NV; k++) if (cov[k] > 0) hv[k] += (sumWY[k] / sumW[k] - hv[k]) * cov[k];
  return hv;
}

/** Heights only: the `h` corner lattice of ChunkRasters, read with rasterHeight / cornerHeight. */
export interface GroundRaster { cx: number; cz: number; cell: number; n: number; h: Uint16Array }

/**
 * The walked ground of a chunk without the collision passes (≈ 1/3 of rasterizeChunk): DEM, pier decks and road
 * corridors exactly as the terrain provider answers heightAt (landmark decks aside). For the renderer, so drawn and
 * walked ground agree: sample `rasterHeight(g, x, z)` for ground vertices, props and building bases. Where a walkable
 * bridge crosses land the ground rises to its deck (a heightfield cannot pass under it).
 */
export function groundRaster(chunk: ChunkData): GroundRaster {
  const hv = groundCorners(chunk, 0, null), W = SF_N + 1, h = new Uint16Array(W * W);
  for (let k = 0; k < W * W; k++) h[k] = quantH(hv[k]);
  return { cx: chunk.cx, cz: chunk.cz, cell: SF_CELL, n: SF_N, h };
}

/**
 * Build the collision / walk rasters of one decoded chunk. Runs in lane C's worker (≈ 10–40 ms for a dense chunk);
 * `transferables(r)` lists the buffers to post back.
 */
export function rasterizeChunk(chunk: ChunkData, opts: RasterizeOptions = {}): ChunkRasters {
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const n = SF_N, A = APRON, m = n + 2 * A, cell = SF_CELL;
  const ox = chunk.cx * CHUNK, oz = chunk.cz * CHUNK;
  const Ctr: Lattice = { x0: ox + (0.5 - A) * cell, z0: oz + (0.5 - A) * cell, cell, cols: m, rows: m };
  const Cor: Lattice = { x0: ox - A * cell, z0: oz - A * cell, cell, cols: m + 1, rows: m + 1 };
  const wx0 = ox - A * cell, wz0 = oz - A * cell, wx1 = ox + CHUNK + A * cell, wz1 = oz + CHUNK + A * cell;
  const kind = new Uint8Array(m * m).fill(SF_KIND.water), surf = new Uint8Array(m * m);

  // 1. area rings in file order; a ring flagged `hole` cuts the preceding outer ring of the same class (even-odd)
  const ar = chunk.areas;
  for (let i = 0; i < ar.count; i++) {
    if (ar.flags[i] & AREA_FLAG.hole) continue;
    const cls = ar.cls[i], ranges = [ar.pStart[i], ar.pStart[i + 1]];
    for (let j = i + 1; j < ar.count && ar.flags[j] & AREA_FLAG.hole; j++) if (ar.cls[j] === cls) ranges.push(ar.pStart[j], ar.pStart[j + 1]);
    const deck = cls === A_PIER || (ar.flags[i] & AREA_FLAG.deck) !== 0;
    const sc = AREA_CODE[cls];
    if (cls === A_LAND) scanFill(Ctr, ar.xz, ranges, k => { kind[k] = SF_KIND.land; surf[k] = S_PAVE; });
    else if (cls === A_WATER) scanFill(Ctr, ar.xz, ranges, k => { kind[k] = SF_KIND.water; surf[k] = 0; });
    else if (deck) scanFill(Ctr, ar.xz, ranges, k => { if (kind[k] !== SF_KIND.land) kind[k] = SF_KIND.deck; surf[k] = sc || S_WOOD; });
    else scanFill(Ctr, ar.xz, ranges, k => { if (kind[k] === SF_KIND.land) surf[k] = sc; });
  }

  // 2. corner heights (DEM, pier decks, road corridors) and each cell's nearest corridor
  const road: RoadCells = { best: new Float32Array(m * m).fill(Infinity), code: new Uint8Array(m * m), barrier: new Uint8Array(m * m), bridged: new Uint8Array(m * m) };
  const hv = groundCorners(chunk, A, road);
  for (let k = 0; k < m * m; k++) {
    if (road.best[k] !== Infinity) { surf[k] = road.code[k]; if (kind[k] === SF_KIND.water) kind[k] = SF_KIND.deck; }
    if (road.barrier[k] && !road.bridged[k]) surf[k] = 0;
  }

  // 3. landmarks: decks / plazas (flat at their y), then (below) their blockers; buildings inside `exclude` are dropped.
  //    Surfaces of deferred landmarks (numeric decks on a 'terrain' base) are the provider's (deferredLandmark).
  const lm = opts.landmarks?.length ? prepareLandmarks(opts.landmarks, l => fixedBase(l, (x, z) => demSample(chunk.dem, x, z)), l => !deferredLandmark(l)) : null;
  if (lm) {
    // the renderer's sink inside exclusions (the first exclusion containing a corner wins, as in world/sf/build)
    const sunk = new Uint8Array(hv.length);
    for (const e of lm.excludes) {
      if (!(e.sink > 0)) continue;
      const lower = (k: number) => { if (!sunk[k]) { sunk[k] = 1; hv[k] -= e.sink; } };
      if ('r' in e) { if (boxHit([e.x - e.r, e.z - e.r, e.x + e.r, e.z + e.r], wx0, wz0, wx1, wz1)) visitSegment(Cor, e.x, e.z, e.x, e.z, e.r, (k, d) => { if (d < e.r) lower(k); }); }
      else if (boxHit(e.bbox, wx0, wz0, wx1, wz1)) scanFill(Cor, e.poly, [0, e.poly.length / 2], lower);
    }
  }
  const lmDeck = new Uint8Array(m * m);
  if (lm) stampLandmarkSurfaces(lm, Ctr, Cor, wx0, wz0, wx1, wz1, surf, kind, (k, y) => { hv[k] = y; }, undefined, lmDeck);

  // 4. steep ground (not stairs, not a landmark deck) is not walkable
  for (let r = 0; r < m; r++) {
    for (let c = 0; c < m; c++) {
      const k = r * m + c, s = surf[k];
      if (!s || s === S_STAIRS || lmDeck[k]) continue;
      const v = r * (m + 1) + c, h00 = hv[v], h10 = hv[v + 1], h01 = hv[v + m + 1], h11 = hv[v + m + 2];
      const gx = (h10 + h11 - h00 - h01) / (2 * cell), gz = (h01 + h11 - h00 - h10) / (2 * cell);
      if (gx * gx + gz * gz > MAX_GRADE * MAX_GRADE) surf[k] = 0;
    }
  }

  // 5. buildings (own, minus landmark exclusions) and landmark blockers: interiors not walkable, BLOCK within the radius
  const blk = new Uint8Array(m * m);
  const bs = chunk.buildings;
  const keep: number[] = [];
  for (let b = 0; b < bs.count; b++) {
    const s = bs.vStart[b], e = bs.vStart[b + 1];
    if (lm) {
      let mx = 0, mz = 0;
      for (let p = s; p < e; p++) { mx += bs.xz[2 * p]; mz += bs.xz[2 * p + 1]; }
      if (excludedBy(lm, mx / (e - s), mz / (e - s))) continue;
    }
    keep.push(b);
    stampPolygon(Ctr, bs.xz, s, e, surf, blk);
  }
  if (lm) for (const b of lm.blockers) if (boxHit(b.bbox, wx0 - 1, wz0 - 1, wx1 + 1, wz1 + 1)) stampLmBlocker(Ctr, b, surf, blk);

  // 6. stand: walkable cell and 8 neighbours, no blocker within the radius
  const out = { surf: new Uint8Array(n * n), kind: new Uint8Array(n * n), stand: new Uint8Array(n * n) };
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const k = (j + A) * m + (i + A), o = j * n + i;
      out.surf[o] = surf[k]; out.kind[o] = kind[k];
      let st = blk[k] ? BLOCK_BIT : 0;
      if (!blk[k] && surf[k] && surf[k - 1] && surf[k + 1] && surf[k - m] && surf[k + m] && surf[k - m - 1] && surf[k - m + 1] && surf[k + m - 1] && surf[k + m + 1]) st |= STAND_BIT;
      out.stand[o] = st;
    }
  }
  const W = n + 1, h = new Uint16Array(W * W);
  for (let j = 0; j < W; j++) for (let i = 0; i < W; i++) h[j * W + i] = quantH(hv[(j + A) * (m + 1) + (i + A)]);

  const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  return { cx: chunk.cx, cz: chunk.cz, cell, n, h, ...out, blockers: buildBlockers(chunk, keep), flags: chunk.flags, landmarks: !!opts.landmarks, ms: t1 - t0 };
}

const quantH = (y: number) => { const q = Math.round((y + W_B) * W_Q); return q < 0 ? 0 : q > 65535 ? 65535 : q; };

/** Mark a polygon's interior (surf 0, blocked) and every sample within the stand radius of its outline (blocked). */
function stampPolygon(L: Lattice, xz: ArrayLike<number>, s: number, e: number, surf: Uint8Array, blk: Uint8Array) {
  scanFill(L, xz, [s, e], k => { surf[k] = 0; blk[k] = 1; });
  for (let p = s, q = e - 1; p < e; q = p++) visitSegment(L, xz[2 * q], xz[2 * q + 1], xz[2 * p], xz[2 * p + 1], SF_STAND_RADIUS, k => { blk[k] = 1; });
}

function stampLmBlocker(L: Lattice, b: LmBlocker, surf: Uint8Array, blk: Uint8Array) {
  if (b.poly) { stampPolygon(L, b.poly, 0, b.poly.length / 2, surf, blk); return; }
  const R = b.r + SF_STAND_RADIUS;
  visitSegment(L, b.x, b.z, b.x, b.z, R, (k, d) => { blk[k] = 1; if (d < b.r) surf[k] = 0; });
}

/**
 * Landmark surfaces, painted last-to-first so the first listed surface wins where they overlap (lane D's rule).
 * `solid(k)` protects cells that must stay unwalkable (blocker interiors, when stamping after the blockers); `deck`
 * marks the stamped cells (authored decks are walkable at any grade — Lombard's slices climb up to 0.8).
 */
function stampLandmarkSurfaces(lm: PreparedLandmarks, Ctr: Lattice, Cor: Lattice, x0: number, z0: number, x1: number, z1: number, surf: Uint8Array, kind: Uint8Array, setH: (k: number, y: number) => void, solid?: (k: number) => boolean, deck?: Uint8Array) {
  for (let q = lm.surfaces.length - 1; q >= 0; q--) {
    const s = lm.surfaces[q];
    if (!boxHit(s.bbox, x0 - 1, z0 - 1, x1 + 1, z1 + 1)) continue;
    scanFill(Ctr, s.poly, [0, s.poly.length / 2], k => { if (solid?.(k)) return; surf[k] = s.code; if (deck) deck[k] = 1; if (kind[k] === SF_KIND.water) kind[k] = SF_KIND.deck; });
    if (s.y !== null) { const y = s.y; scanFill(Cor, s.poly, [0, s.poly.length / 2], k => setH(k, y)); }
  }
}

function buildBlockers(chunk: ChunkData, keep: number[]): ChunkBlockers {
  const bs = chunk.buildings, count = keep.length;
  const ox = chunk.cx * CHUNK, oz = chunk.cz * CHUNK, R = SF_STAND_RADIUS;
  const bbox = new Float32Array(count * 4), vStart = new Uint32Array(count + 1), building = new Uint16Array(count), top = new Float32Array(count);
  let nv = 0;
  for (const b of keep) nv += bs.vStart[b + 1] - bs.vStart[b];
  const xz = new Float32Array(nv * 2);
  let x0 = ox, z0 = oz, x1 = ox + CHUNK, z1 = oz + CHUNK;
  const over: number[] = [];
  let o = 0;
  keep.forEach((b, k) => {
    building[k] = b;
    top[k] = bs.baseY[b] + bs.height[b];
    let bx0 = Infinity, bz0 = Infinity, bx1 = -Infinity, bz1 = -Infinity;
    vStart[k] = o;
    for (let p = bs.vStart[b]; p < bs.vStart[b + 1]; p++, o++) {
      const x = bs.xz[2 * p], z = bs.xz[2 * p + 1];
      xz[2 * o] = x; xz[2 * o + 1] = z;
      if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (z < bz0) bz0 = z; if (z > bz1) bz1 = z;
    }
    vStart[k + 1] = o;
    bbox[4 * k] = bx0; bbox[4 * k + 1] = bz0; bbox[4 * k + 2] = bx1; bbox[4 * k + 3] = bz1;
    if (bx0 < x0) x0 = bx0; if (bz0 < z0) z0 = bz0; if (bx1 > x1) x1 = bx1; if (bz1 > z1) z1 = bz1;
    if (bx0 - R < ox || bz0 - R < oz || bx1 + R > ox + CHUNK || bz1 + R > oz + CHUNK) over.push(k);
  });
  const cellU = BLOCK_CELL;
  const hx0 = Math.floor(x0 / cellU) * cellU, hz0 = Math.floor(z0 / cellU) * cellU;
  const cols = Math.ceil((x1 - hx0) / cellU) + 1, rows = Math.ceil((z1 - hz0) / cellU) + 1;
  const counts = new Uint32Array(cols * rows + 1);
  const span = (k: number) => [
    Math.floor((bbox[4 * k] - hx0) / cellU), Math.floor((bbox[4 * k + 1] - hz0) / cellU),
    Math.floor((bbox[4 * k + 2] - hx0) / cellU), Math.floor((bbox[4 * k + 3] - hz0) / cellU),
  ];
  for (let k = 0; k < count; k++) { const [c0, r0, c1, r1] = span(k); for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) counts[r * cols + c + 1]++; }
  const offsets = new Uint32Array(cols * rows + 1);
  for (let i = 1; i <= cols * rows; i++) offsets[i] = offsets[i - 1] + counts[i];
  const items = new Uint16Array(offsets[cols * rows]);
  const fill = offsets.slice(0, cols * rows);
  for (let k = 0; k < count; k++) { const [c0, r0, c1, r1] = span(k); for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) items[fill[r * cols + c]++] = k; }
  return { count, cell: cellU, x0: hx0, z0: hz0, cols, rows, offsets, items, bbox, vStart, xz, building, top, overhang: Uint16Array.from(over) };
}

/** Buffers to pass as the transfer list when posting rasters from the worker. */
export function transferables(r: ChunkRasters): ArrayBuffer[] {
  const b = r.blockers;
  return [r.h, r.surf, r.kind, r.stand, b.offsets, b.items, b.bbox, b.vStart, b.xz, b.building, b.top, b.overhang].map(a => a.buffer as ArrayBuffer);
}

// ---------------------------------------------------------------------------
// Raster reads
// ---------------------------------------------------------------------------

/** Corner height (i, j ∈ 0…n) in world units. */
export function cornerHeight(r: GroundRaster, i: number, j: number): number {
  return r.h[j * (r.n + 1) + i] / W_Q - W_B;
}

/** Bilinear ground height at a world point (clamped to the chunk square). */
export function rasterHeight(r: GroundRaster, x: number, z: number): number {
  const n = r.n, W = n + 1;
  const u = (x - r.cx * CHUNK) / r.cell, v = (z - r.cz * CHUNK) / r.cell;
  let i = Math.floor(u), j = Math.floor(v);
  if (i < 0) i = 0; else if (i > n - 1) i = n - 1;
  if (j < 0) j = 0; else if (j > n - 1) j = n - 1;
  let tx = u - i, tz = v - j;
  tx = tx < 0 ? 0 : tx > 1 ? 1 : tx; tz = tz < 0 ? 0 : tz > 1 ? 1 : tz;
  const h = r.h, k = j * W + i;
  const a = h[k] + (h[k + 1] - h[k]) * tx, b = h[k + W] + (h[k + W + 1] - h[k + W]) * tx;
  return (a + (b - a) * tz) / W_Q - W_B;
}

const cellOfRaster = (r: ChunkRasters, x: number, z: number) => {
  const n = r.n;
  let i = Math.floor((x - r.cx * CHUNK) / r.cell), j = Math.floor((z - r.cz * CHUNK) / r.cell);
  if (i < 0) i = 0; else if (i >= n) i = n - 1;
  if (j < 0) j = 0; else if (j >= n) j = n - 1;
  return j * n + i;
};

/** rasterizeChunk step 4 over a cell rectangle of resident rasters: walkable cells steeper than MAX_GRADE (not stairs, not `deck`) → 0. */
function steepRegion(r: ChunkRasters, i0: number, j0: number, i1: number, j1: number, deck: Uint8Array) {
  const n = r.n, W = n + 1, h = r.h, k2 = 1 / (2 * r.cell * W_Q), G2 = MAX_GRADE * MAX_GRADE;
  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) {
      const k = j * n + i, s = r.surf[k];
      if (!s || s === S_STAIRS || deck[k]) continue;
      const v = j * W + i, h00 = h[v], h10 = h[v + 1], h01 = h[v + W], h11 = h[v + W + 1];
      const gx = (h10 + h11 - h00 - h01) * k2, gz = (h01 + h11 - h00 - h10) * k2;
      if (gx * gx + gz * gz > G2) r.surf[k] = 0;
    }
  }
}

/** An open-water chunk (DEM 0, no content) — the provider synthesises these for slots with landmark decks only. */
export function emptyChunk(cx: number, cz: number): ChunkData {
  return {
    cx, cz, flags: CHUNK_FLAG.water,
    dem: { originX: cx * CHUNK, originZ: cz * CHUNK, step: DEM_STEP, cols: DEM_N, rows: DEM_N, y: new Float32Array(DEM_N * DEM_N) },
    buildings: emptyBuildings(), roads: emptyRoads(), areas: emptyAreas(), props: emptyProps(), places: emptyPlaces(),
  };
}

// ---------------------------------------------------------------------------
// Provider (main thread)
// ---------------------------------------------------------------------------

/** City zone record, shaped like DISTRICT.zones entries (polygon = the zone's largest outer ring). */
export interface CityZone { id: string; name: { zh: string; en: string }; polygon: Polygon }

export interface CityTerrainProvider extends CityTerrain {
  /** Register a chunk's rasters (from the worker). Stamps overhanging footprints between it and resident neighbours. */
  attach(r: ChunkRasters): void;
  /** Drop a chunk's rasters (queries there report "not resident" until it is attached again). */
  detach(cx: number, cz: number): void;
  /** The always-loaded far city: heights and land / water where no chunk is resident, and neighbourhood zones. */
  setFar(far: FarData): void;
  /** true when the chunk's rasters are available (attached, or a synthesised open-water slot) */
  resident(cx: number, cz: number): boolean;
  /** true when the manifest lists a data file for the chunk */
  hasChunk(cx: number, cz: number): boolean;
  /** the resident rasters of a chunk (null if none) */
  rasters(cx: number, cz: number): ChunkRasters | null;
  zoneAt(x: number, z: number): CityZone | null;
  onChange(fn: (cx: number, cz: number) => void): () => void;
  /**
   * Pin the base y of a 'terrain'-based landmark to what the renderer uses (world/sf/sites baseY), so its decks
   * (deferred surfaces) sit exactly under the drawn model; resident chunks are re-stamped. Unknown id → false.
   * Unpinned, the provider resolves it like the renderer does: the far-DEM estimate, then the lowest land ground within
   * the exclusion radius once the landmark's centre chunk is resident.
   */
  setLandmarkBase(id: string, y: number): boolean;
  /** the base y collision uses for a landmark (numeric base, pinned, or resolved), null for an unknown id */
  landmarkBase(id: string): number | null;
  stats(): Record<string, number>;
}

/** A deferred landmark's decks stamped into one resident chunk, with the untouched cells under them (for re-stamping). */
interface DeferredStamp { base: number; i0: number; j0: number; i1: number; j1: number; surf: Uint8Array; kind: Uint8Array; h: Uint16Array }

class Provider implements CityTerrainProvider {
  private readonly cx0: number;
  private readonly cz0: number;
  private readonly ncx: number;
  private readonly ncz: number;
  private readonly bx0: number;
  private readonly bz0: number;
  private readonly bx1: number;
  private readonly bz1: number;
  private readonly pad: number;
  private readonly hasFile: Uint8Array;
  private readonly res: (ChunkRasters | null)[];
  private readonly synth: Uint8Array;
  private readonly stamps: (Uint32Array | null)[];
  private readonly objs: (Blocker | undefined)[][];
  private readonly lmInput: readonly LandmarkWalkInput[];
  private lm: PreparedLandmarks | null = null;
  /** slot → landmark indices whose walk data touches it */
  private lmSlot: Map<number, number[]> = new Map();
  private lmHash: Map<number, number[]> = new Map();
  private lmStamp = new Uint32Array(0);
  /** landmark → slots its walk data touches */
  private lmSlots: number[][] = [];
  /** deferred landmarks (deferredLandmark): base y, and where it came from (0 none, 1 centre chunk, 2 pinned) */
  private readonly lmDeferred: Uint8Array;
  private readonly lmBase: Float64Array;
  private readonly lmBaseSrc: Uint8Array;
  /** the renderer's base radius: the exclusion circle, or a polygon's farthest vertex (world/sf/sites) */
  private readonly lmRadius: Float64Array;
  private readonly lmIndex = new Map<string, number>();
  /** slot → landmark → its deferred decks as stamped there */
  private defStamps = new Map<number, Map<number, DeferredStamp>>();
  private tick = 0;
  private far: FarData | null = null;
  private farKind: { x0: number; z0: number; cell: number; cols: number; rows: number; kind: Uint8Array } | null = null;
  private zones: (CityZone | null)[] = [];
  private listeners = new Set<(cx: number, cz: number) => void>();
  private counters = { attaches: 0, detaches: 0, synthesised: 0, patchMs: 0, rasterMs: 0, deckStamps: 0 };

  constructor(manifest: SfManifest, landmarks: readonly LandmarkWalkInput[]) {
    const b = manifest.bbox;
    this.bx0 = b.minX; this.bz0 = b.minZ; this.bx1 = b.maxX; this.bz1 = b.maxZ;
    this.cx0 = Math.floor(b.minX / CHUNK); this.cz0 = Math.floor(b.minZ / CHUNK);
    this.ncx = Math.ceil(b.maxX / CHUNK) - this.cx0; this.ncz = Math.ceil(b.maxZ / CHUNK) - this.cz0;
    const slots = this.ncx * this.ncz;
    this.hasFile = new Uint8Array(slots); this.synth = new Uint8Array(slots);
    this.res = new Array(slots).fill(null); this.stamps = new Array(slots).fill(null); this.objs = Array.from({ length: slots }, () => []);
    for (const c of manifest.chunks) { const s = this.slot(c.cx, c.cz); if (s >= 0) this.hasFile[s] = 1; }
    this.pad = Math.max(manifest.maxOverhang ?? 0, 0) + SF_STAND_RADIUS + 1;
    this.lmInput = landmarks;
    const nl = landmarks.length;
    this.lmDeferred = Uint8Array.from(landmarks, l => (deferredLandmark(l) ? 1 : 0));
    this.lmBase = new Float64Array(nl).fill(NaN); this.lmBaseSrc = new Uint8Array(nl); this.lmRadius = new Float64Array(nl);
    landmarks.forEach((l, i) => { this.lmIndex.set(l.id, i); });
    this.prepareLm();
  }

  private prepareLm() {
    if (!this.lmInput.length) { this.lm = null; return; }
    const lm = prepareLandmarks(this.lmInput, l => fixedBase(l, (x, z) => this.groundGuess(x, z)));
    this.lm = lm;
    this.lmSlot = new Map(); this.lmHash = new Map(); this.lmSlots = this.lmInput.map(() => []);
    lm.extents.forEach((e, li) => {
      const l = this.lmInput[li], ex = l.exclude;
      this.lmRadius[li] = ex ? ('r' in ex ? ex.r : Math.max(...ex.poly.map(p => Math.hypot(p.x - l.x, p.z - l.z))))
        : Math.max(8, Math.hypot(Math.max(l.x - e[0], e[2] - l.x), Math.max(l.z - e[1], e[3] - l.z)));
      for (let cz = Math.floor(e[1] / CHUNK); cz <= Math.floor(e[3] / CHUNK); cz++) {
        for (let cx = Math.floor(e[0] / CHUNK); cx <= Math.floor(e[2] / CHUNK); cx++) {
          const s = this.slot(cx, cz);
          if (s < 0) continue;
          let a = this.lmSlot.get(s);
          if (!a) this.lmSlot.set(s, (a = []));
          a.push(li);
          this.lmSlots[li].push(s);
        }
      }
    });
    lm.blockers.forEach((b, i) => {
      for (let cz = Math.floor(b.bbox[1] / BLOCK_CELL); cz <= Math.floor(b.bbox[3] / BLOCK_CELL); cz++) {
        for (let cx = Math.floor(b.bbox[0] / BLOCK_CELL); cx <= Math.floor(b.bbox[2] / BLOCK_CELL); cx++) {
          const k = (cx + 32768) * 65536 + (cz + 32768);
          let a = this.lmHash.get(k);
          if (!a) this.lmHash.set(k, (a = []));
          a.push(i);
        }
      }
    });
    this.lmStamp = new Uint32Array(lm.blockers.length);
  }

  /** ground for base-'terrain' landmarks without baseY: resident raster, else far DEM, else 0 */
  private groundGuess(x: number, z: number): number {
    const s = this.slotAt(x, z), r = s >= 0 ? this.res[s] : null;
    if (r) return rasterHeight(r, x, z);
    return this.far ? demSample(this.far.dem, x, z) : 0;
  }

  private slot(cx: number, cz: number): number {
    const i = cx - this.cx0, j = cz - this.cz0;
    return i < 0 || j < 0 || i >= this.ncx || j >= this.ncz ? -1 : j * this.ncx + i;
  }
  private slotAt(x: number, z: number): number {
    return this.slot(Math.floor(x / CHUNK), Math.floor(z / CHUNK));
  }
  /** rasters for a slot, synthesising an open-water chunk that carries landmark walk data on first use */
  private rastersAt(s: number): ChunkRasters | null {
    const r = this.res[s];
    if (r || this.hasFile[s] || !this.lmSlot.has(s)) return r;
    const cx = (s % this.ncx) + this.cx0, cz = Math.floor(s / this.ncx) + this.cz0;
    const lis = this.lmSlot.get(s)!;
    const syn = rasterizeChunk(emptyChunk(cx, cz), { landmarks: lis.map(i => this.lmInput[i]) });
    this.res[s] = syn; this.synth[s] = 1; this.stamps[s] = new Uint32Array(0);
    this.counters.synthesised++; this.counters.rasterMs += syn.ms;
    for (const li of lis) if (this.lmDeferred[li]) this.stampDeferred(s, li);
    return syn;
  }

  // --- residency -----------------------------------------------------------------------------------------------

  attach(r: ChunkRasters): void {
    const s = this.slot(r.cx, r.cz);
    if (s < 0) return;
    const t0 = performance.now();
    if (this.lm && !r.landmarks && this.lmSlot.has(s)) this.applyLandmarks(r, this.lmSlot.get(s)!);
    this.res[s] = r; this.synth[s] = 0;
    this.stamps[s] = new Uint32Array(r.blockers.count); this.objs[s] = [];
    const ox = r.cx * CHUNK, oz = r.cz * CHUNK, e = r.cell;
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dz) continue;
        const ns = this.slot(r.cx + dx, r.cz + dz), q = ns >= 0 ? this.res[ns] : null;
        if (!q) continue;
        if (!this.synth[ns]) { this.stampOverhangs(q, r); this.stampOverhangs(r, q); }
        // the cells along the shared edge / corner now see the neighbour's real surfaces
        const x0 = dx < 0 ? ox - e : dx > 0 ? ox + CHUNK - e : ox, x1 = dx < 0 ? ox + e : dx > 0 ? ox + CHUNK + e : ox + CHUNK;
        const z0 = dz < 0 ? oz - e : dz > 0 ? oz + CHUNK - e : oz, z1 = dz < 0 ? oz + e : dz > 0 ? oz + CHUNK + e : oz + CHUNK;
        this.restandWorld(x0, z0, x1 - 1e-6, z1 - 1e-6);
      }
    }
    // deferred landmark decks: resolve bases centred here (unless pinned), then stamp every deferred landmark touching it
    const lis = this.lmSlot.get(s);
    if (lis) {
      for (const li of lis) {
        const l = this.lmInput[li];
        if (!this.lmDeferred[li] || this.lmBaseSrc[li] || Math.floor(l.x / CHUNK) !== r.cx || Math.floor(l.z / CHUNK) !== r.cz) continue;
        const y = this.baseFromChunk(r, li);
        if (y === null) continue;
        this.lmBase[li] = y; this.lmBaseSrc[li] = 1;
        this.refreshDeferred(li, s);
      }
      for (const li of lis) if (this.lmDeferred[li]) this.stampDeferred(s, li);
    }
    this.counters.attaches++; this.counters.patchMs += performance.now() - t0; this.counters.rasterMs += r.ms;
    this.emit(r.cx, r.cz);
  }

  detach(cx: number, cz: number): void {
    const s = this.slot(cx, cz);
    if (s < 0 || !this.res[s] || this.synth[s]) return;
    this.res[s] = null; this.stamps[s] = null; this.objs[s] = [];
    this.defStamps.delete(s);
    this.counters.detaches++;
    this.emit(cx, cz);
  }

  // --- deferred landmark decks ---------------------------------------------------------------------------------

  setLandmarkBase(id: string, y: number): boolean {
    const li = this.lmIndex.get(id);
    if (li === undefined) return false;
    if (typeof this.lmInput[li].base === 'number') return true;
    this.lmBase[li] = y; this.lmBaseSrc[li] = 2;
    // blocker tops follow the renderer's base (D2-10; prepared with the walkInputs hint before the base was known)
    for (const b of this.lm?.blockers ?? []) if (b.lm === li && b.top !== undefined) b.obj.top = y + b.top;
    this.refreshDeferred(li, -1);
    return true;
  }

  landmarkBase(id: string): number | null {
    const li = this.lmIndex.get(id);
    if (li === undefined) return null;
    const l = this.lmInput[li];
    return typeof l.base === 'number' ? l.base : this.lmDeferred[li] ? this.deferredBase(li) : fixedBase(l, (x, z) => this.groundGuess(x, z));
  }

  /** Base of a deferred landmark: pinned / centre chunk, else the renderer's first estimate (far DEM), else the hint. */
  private deferredBase(li: number): number {
    if (this.lmBaseSrc[li]) return this.lmBase[li];
    const l = this.lmInput[li], rad = this.lmRadius[li];
    if (this.far) {
      let lo = Infinity;
      for (let dz = -rad; dz <= rad; dz += 4) for (let dx = -rad; dx <= rad; dx += 4) if (dx * dx + dz * dz <= rad * rad) lo = Math.min(lo, demSample(this.far.dem, l.x + dx, l.z + dz));
      if (Number.isFinite(lo)) return lo;
    }
    return l.baseY ?? this.groundGuess(l.x, l.z);
  }

  /** The renderer's refined base (world/sf/build buildL1 bases): lowest land ground within the radius, 2 u steps. */
  private baseFromChunk(r: ChunkRasters, li: number): number | null {
    const l = this.lmInput[li], rad = this.lmRadius[li];
    let lo = Infinity;
    for (let dz = -rad; dz <= rad; dz += 2) {
      for (let dx = -rad; dx <= rad; dx += 2) {
        if (dx * dx + dz * dz > rad * rad) continue;
        const x = l.x + dx, z = l.z + dz;
        if (r.kind[cellOfRaster(r, x, z)] === SF_KIND.land) lo = Math.min(lo, rasterHeight(r, x, z));
      }
    }
    return Number.isFinite(lo) ? lo : null;
  }

  /** Re-stamp a deferred landmark in every resident chunk it touches (except `skip`) whose decks use another base. */
  private refreshDeferred(li: number, skip: number) {
    for (const s of this.lmSlots[li] ?? []) {
      if (s === skip || !this.res[s]) continue;
      if (this.stampDeferred(s, li)) this.emit((s % this.ncx) + this.cx0, Math.floor(s / this.ncx) + this.cz0);
    }
  }

  /**
   * Stamp (or re-stamp at a new base) one deferred landmark's decks into a resident chunk, in the worker's order:
   * surfaces (first listed wins, never over a blocker interior), its blockers, steep rims, then stand bits. The cells
   * under the decks are kept from the first stamp so a re-stamp starts from the untouched ground. Returns true if
   * anything changed.
   */
  private stampDeferred(s: number, li: number): boolean {
    const r = this.res[s];
    if (!r) return false;
    const base = this.deferredBase(li);
    let per = this.defStamps.get(s);
    if (!per) this.defStamps.set(s, (per = new Map()));
    let rec = per.get(li);
    if (rec && rec.base === base) return false;
    const lm = prepareLandmarks([this.lmInput[li]], () => base);
    const e = lm.extents[0], n = r.n, W = n + 1, cell = r.cell, ox = r.cx * CHUNK, oz = r.cz * CHUNK, M = 3;
    const cl = (v: number) => (v < 0 ? 0 : v > n - 1 ? n - 1 : v);
    const i0 = cl(Math.floor((e[0] - ox) / cell) - M), i1 = cl(Math.floor((e[2] - ox) / cell) + M);
    const j0 = cl(Math.floor((e[1] - oz) / cell) - M), j1 = cl(Math.floor((e[3] - oz) / cell) + M);
    if (!rec) {
      const w = i1 - i0 + 1, hgt = j1 - j0 + 1;
      rec = { base, i0, j0, i1, j1, surf: new Uint8Array(w * hgt), kind: new Uint8Array(w * hgt), h: new Uint16Array((w + 1) * (hgt + 1)) };
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const q = (j - j0) * w + (i - i0); rec.surf[q] = r.surf[j * n + i]; rec.kind[q] = r.kind[j * n + i]; }
      for (let j = j0; j <= j1 + 1; j++) for (let i = i0; i <= i1 + 1; i++) rec.h[(j - j0) * (w + 1) + (i - i0)] = r.h[j * W + i];
      per.set(li, rec);
    } else {
      const w = rec.i1 - rec.i0 + 1;
      for (let j = rec.j0; j <= rec.j1; j++) {
        for (let i = rec.i0; i <= rec.i1; i++) {
          const q = (j - rec.j0) * w + (i - rec.i0), k = j * n + i;
          r.kind[k] = rec.kind[q];
          if (!(r.stand[k] & BLOCK_BIT)) r.surf[k] = rec.surf[q];
        }
      }
      for (let j = rec.j0; j <= rec.j1 + 1; j++) for (let i = rec.i0; i <= rec.i1 + 1; i++) r.h[j * W + i] = rec.h[(j - rec.j0) * (w + 1) + (i - rec.i0)];
      rec.base = base;
    }
    const Ctr: Lattice = { x0: ox + 0.5 * cell, z0: oz + 0.5 * cell, cell, cols: n, rows: n };
    const Cor: Lattice = { x0: ox, z0: oz, cell, cols: W, rows: W };
    const deck = new Uint8Array(n * n), blk = new Uint8Array(n * n);
    stampLandmarkSurfaces(lm, Ctr, Cor, ox, oz, ox + CHUNK, oz + CHUNK, r.surf, r.kind, (k, y) => { r.h[k] = quantH(y); }, k => (r.stand[k] & BLOCK_BIT) !== 0 && r.surf[k] === 0, deck);
    for (const b of lm.blockers) if (boxHit(b.bbox, ox - 1, oz - 1, ox + CHUNK + 1, oz + CHUNK + 1)) stampLmBlocker(Ctr, b, r.surf, blk);
    for (let j = rec.j0; j <= rec.j1; j++) for (let i = rec.i0; i <= rec.i1; i++) if (blk[j * n + i]) r.stand[j * n + i] |= BLOCK_BIT;
    steepRegion(r, rec.i0, rec.j0, rec.i1, rec.j1, deck);
    this.restandWorld(ox + (rec.i0 - 1) * cell, oz + (rec.j0 - 1) * cell, ox + (rec.i1 + 2) * cell - 1e-6, oz + (rec.j1 + 2) * cell - 1e-6);
    this.counters.deckStamps++;
    return true;
  }

  resident(cx: number, cz: number): boolean {
    const s = this.slot(cx, cz);
    return s >= 0 && this.rastersAt(s) !== null;
  }
  hasChunk(cx: number, cz: number): boolean {
    const s = this.slot(cx, cz);
    return s >= 0 && this.hasFile[s] === 1;
  }
  rasters(cx: number, cz: number): ChunkRasters | null {
    const s = this.slot(cx, cz);
    return s >= 0 ? this.rastersAt(s) : null;
  }
  onChange(fn: (cx: number, cz: number) => void): () => void {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  }
  private emit(cx: number, cz: number) { for (const fn of this.listeners) fn(cx, cz); }

  /** Stamp the overhanging footprints of `src` into `dst` (idempotent), then refresh dst's stand bits around them. */
  private stampOverhangs(src: ChunkRasters, dst: ChunkRasters) {
    const B = src.blockers, ox = dst.cx * CHUNK, oz = dst.cz * CHUNK, R = SF_STAND_RADIUS, n = dst.n;
    const L: Lattice = { x0: ox + 0.5 * dst.cell, z0: oz + 0.5 * dst.cell, cell: dst.cell, cols: n, rows: n };
    for (let q = 0; q < B.overhang.length; q++) {
      const k = B.overhang[q], bb = B.bbox.subarray(4 * k, 4 * k + 4);
      if (!boxHit(bb, ox - R, oz - R, ox + CHUNK + R, oz + CHUNK + R)) continue;
      scanFill(L, B.xz, [B.vStart[k], B.vStart[k + 1]], i => { dst.surf[i] = 0; dst.stand[i] = BLOCK_BIT; });
      for (let p = B.vStart[k], pq = B.vStart[k + 1] - 1; p < B.vStart[k + 1]; pq = p++) {
        visitSegment(L, B.xz[2 * pq], B.xz[2 * pq + 1], B.xz[2 * p], B.xz[2 * p + 1], R, i => { dst.stand[i] = BLOCK_BIT; });
      }
      this.restandWorld(bb[0] - R - 1, bb[1] - R - 1, bb[2] + R + 1, bb[3] + R + 1);
    }
  }

  /** restand over a world rectangle in every resident chunk it touches (a surface change moves neighbours' stand bits) */
  private restandWorld(x0: number, z0: number, x1: number, z1: number) {
    for (let cz = Math.floor(z0 / CHUNK); cz <= Math.floor(z1 / CHUNK); cz++) {
      for (let cx = Math.floor(x0 / CHUNK); cx <= Math.floor(x1 / CHUNK); cx++) {
        const s = this.slot(cx, cz), q = s >= 0 ? this.res[s] : null;
        if (q) this.restand(q, x0, z0, x1, z1);
      }
    }
  }

  /** Recompute STAND_BIT (walkable cell + 8 neighbours, no BLOCK_BIT) in a world rectangle of one chunk. */
  private restand(r: ChunkRasters, x0: number, z0: number, x1: number, z1: number) {
    const n = r.n, ox = r.cx * CHUNK, oz = r.cz * CHUNK;
    const i0 = Math.max(0, Math.floor((x0 - ox) / r.cell)), i1 = Math.min(n - 1, Math.floor((x1 - ox) / r.cell));
    const j0 = Math.max(0, Math.floor((z0 - oz) / r.cell)), j1 = Math.min(n - 1, Math.floor((z1 - oz) / r.cell));
    const walk = (i: number, j: number) => {
      if (i >= 0 && j >= 0 && i < n && j < n) return r.surf[j * n + i] !== 0;
      const x = ox + (i + 0.5) * r.cell, z = oz + (j + 0.5) * r.cell, s = this.slotAt(x, z), q = s >= 0 ? this.res[s] : null;
      return q ? q.surf[cellOfRaster(q, x, z)] !== 0 : r.surf[Math.min(n - 1, Math.max(0, j)) * n + Math.min(n - 1, Math.max(0, i))] !== 0;
    };
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const k = j * n + i, blocked = r.stand[k] & BLOCK_BIT;
        const ok = !blocked && r.surf[k] !== 0 && walk(i - 1, j) && walk(i + 1, j) && walk(i, j - 1) && walk(i, j + 1)
          && walk(i - 1, j - 1) && walk(i + 1, j - 1) && walk(i - 1, j + 1) && walk(i + 1, j + 1);
        r.stand[k] = blocked | (ok ? STAND_BIT : 0);
      }
    }
  }

  /** Landmark decks and blockers stamped on the main thread (rasters made without opts.landmarks; exclusion can't be undone). */
  private applyLandmarks(r: ChunkRasters, lis: number[]) {
    const lm = prepareLandmarks(lis.map(i => this.lmInput[i]), l => fixedBase(l, (x, z) => rasterHeight(r, x, z)), l => !deferredLandmark(l));
    const n = r.n, ox = r.cx * CHUNK, oz = r.cz * CHUNK;
    const Ctr: Lattice = { x0: ox + 0.5 * r.cell, z0: oz + 0.5 * r.cell, cell: r.cell, cols: n, rows: n };
    const Cor: Lattice = { x0: ox, z0: oz, cell: r.cell, cols: n + 1, rows: n + 1 };
    const deck = new Uint8Array(n * n);
    stampLandmarkSurfaces(lm, Ctr, Cor, ox, oz, ox + CHUNK, oz + CHUNK, r.surf, r.kind, (k, y) => { r.h[k] = quantH(y); }, undefined, deck);
    for (const sf of lm.surfaces) {
      if (!boxHit(sf.bbox, ox - 1, oz - 1, ox + CHUNK + 1, oz + CHUNK + 1)) continue;
      const cl = (v: number) => (v < 0 ? 0 : v > n - 1 ? n - 1 : v);
      steepRegion(r, cl(Math.floor((sf.bbox[0] - ox) / r.cell) - 1), cl(Math.floor((sf.bbox[1] - oz) / r.cell) - 1), cl(Math.floor((sf.bbox[2] - ox) / r.cell) + 1), cl(Math.floor((sf.bbox[3] - oz) / r.cell) + 1), deck);
    }
    const blk = new Uint8Array(n * n);
    for (const b of lm.blockers) if (boxHit(b.bbox, ox - 1, oz - 1, ox + CHUNK + 1, oz + CHUNK + 1)) stampLmBlocker(Ctr, b, r.surf, blk);
    for (let k = 0; k < n * n; k++) if (blk[k]) r.stand[k] |= BLOCK_BIT;
    this.restand(r, ox, oz, ox + CHUNK - 1e-6, oz + CHUNK - 1e-6);
    r.landmarks = true;
  }

  // --- far ---------------------------------------------------------------------------------------------------------

  setFar(far: FarData): void {
    this.far = far;
    const cell = 8, x0 = this.bx0, z0 = this.bz0;
    const cols = Math.ceil((this.bx1 - x0) / cell), rows = Math.ceil((this.bz1 - z0) / cell);
    const kind = new Uint8Array(cols * rows).fill(SF_KIND.water);
    const L: Lattice = { x0: x0 + cell / 2, z0: z0 + cell / 2, cell, cols, rows };
    const ar = far.areas;
    for (let i = 0; i < ar.count; i++) {
      if (ar.flags[i] & AREA_FLAG.hole) continue;
      const cls = ar.cls[i];
      if (cls !== A_LAND && cls !== A_WATER && cls !== A_PIER) continue;
      const ranges = [ar.pStart[i], ar.pStart[i + 1]];
      for (let j = i + 1; j < ar.count && ar.flags[j] & AREA_FLAG.hole; j++) if (ar.cls[j] === cls) ranges.push(ar.pStart[j], ar.pStart[j + 1]);
      const v = cls === A_LAND ? SF_KIND.land : cls === A_WATER ? SF_KIND.water : SF_KIND.deck;
      scanFill(L, ar.xz, ranges, k => { if (v !== SF_KIND.deck || kind[k] === SF_KIND.water) kind[k] = v; });
    }
    this.farKind = { x0, z0, cell, cols, rows, kind };
    this.zones = far.zones.map(() => null);
    if (this.lm) {
      this.prepareLm();
      this.lmInput.forEach((_, li) => { if (this.lmDeferred[li] && !this.lmBaseSrc[li]) this.refreshDeferred(li, -1); });
    }
  }

  // --- CityTerrain -------------------------------------------------------------------------------------------------

  heightAt(x: number, z: number): number | null {
    const s = this.slotAt(x, z);
    if (s < 0) return this.far ? 0 : null;
    const r = this.rastersAt(s);
    if (r) return rasterHeight(r, x, z);
    if (!this.hasFile[s]) return 0;
    return this.far ? demSample(this.far.dem, x, z) : null;
  }

  surfaceCode(x: number, z: number): number {
    const s = this.slotAt(x, z), r = s >= 0 ? this.rastersAt(s) : null;
    return r ? r.surf[cellOfRaster(r, x, z)] : 0;
  }

  kindAt(x: number, z: number): number {
    if (x < this.bx0 || z < this.bz0 || x >= this.bx1 || z >= this.bz1) return SF_KIND.outside;
    const s = this.slotAt(x, z), r = s >= 0 ? this.rastersAt(s) : null;
    if (r) return r.kind[cellOfRaster(r, x, z)];
    if (s < 0 || !this.hasFile[s]) return SF_KIND.water;
    const f = this.farKind;
    if (!f) return SF_KIND.land;
    const c = Math.floor((x - f.x0) / f.cell), rr = Math.floor((z - f.z0) / f.cell);
    return c < 0 || rr < 0 || c >= f.cols || rr >= f.rows ? SF_KIND.water : f.kind[rr * f.cols + c];
  }

  standAt(x: number, z: number): 0 | 1 | -1 {
    const s = this.slotAt(x, z);
    if (s < 0) return 0;
    const r = this.rastersAt(s);
    if (r) return (r.stand[cellOfRaster(r, x, z)] & STAND_BIT) as 0 | 1;
    return this.hasFile[s] ? -1 : 0;
  }

  blockedAt(x: number, z: number): boolean {
    const s = this.slotAt(x, z), r = s >= 0 ? this.res[s] : null;
    return !!r && (r.stand[cellOfRaster(r, x, z)] & BLOCK_BIT) !== 0;
  }

  /** Candidates whose bbox meets the disc (buildings of resident chunks within maxOverhang, and landmark blockers). */
  forEachBlockerNear(x: number, z: number, rad: number, fn: (b: Blocker) => void): void {
    this.visit(x, z, rad, (s, k) => { fn(this.buildingObj(s, k)); return false; }, li => { fn(this.lm!.blockers[li].obj); return false; });
  }

  hitsBlocker(x: number, z: number, rad: number): boolean {
    const r2 = rad * rad;
    return this.visit(x, z, rad, (s, k) => {
      const B = this.res[s]!.blockers, a = B.vStart[k], e = B.vStart[k + 1];
      return pointInRing(B.xz, a, e, x, z) || ringDist2(B.xz, a, e, x, z) < r2;
    }, li => {
      const b = this.lm!.blockers[li];
      if (!b.poly) { const rr = rad + b.r; return (x - b.x) ** 2 + (z - b.z) ** 2 < rr * rr; }
      const e = b.poly.length / 2;
      return pointInRing(b.poly, 0, e, x, z) || ringDist2(b.poly, 0, e, x, z) < r2;
    });
  }

  /** Walk bbox-overlapping blockers; a callback returning true stops the walk (and visit returns true). */
  private visit(x: number, z: number, rad: number, onBuilding: (slot: number, k: number) => boolean, onLandmark: (i: number) => boolean): boolean {
    this.tick = (this.tick + 1) >>> 0;
    if (this.tick === 0) { this.tick = 1; for (const st of this.stamps) st?.fill(0); this.lmStamp.fill(0); }
    const tick = this.tick, qx0 = x - rad, qz0 = z - rad, qx1 = x + rad, qz1 = z + rad, pad = this.pad;
    const cxa = Math.floor((qx0 - pad) / CHUNK), cxb = Math.floor((qx1 + pad) / CHUNK);
    const cza = Math.floor((qz0 - pad) / CHUNK), czb = Math.floor((qz1 + pad) / CHUNK);
    for (let cz = cza; cz <= czb; cz++) {
      for (let cx = cxa; cx <= cxb; cx++) {
        const s = this.slot(cx, cz), r = s >= 0 ? this.res[s] : null;
        if (!r || !r.blockers.count) continue;
        const B = r.blockers, st = this.stamps[s]!;
        const c0 = Math.max(0, Math.floor((qx0 - B.x0) / B.cell)), c1 = Math.min(B.cols - 1, Math.floor((qx1 - B.x0) / B.cell));
        const r0 = Math.max(0, Math.floor((qz0 - B.z0) / B.cell)), r1 = Math.min(B.rows - 1, Math.floor((qz1 - B.z0) / B.cell));
        for (let hr = r0; hr <= r1; hr++) {
          for (let hc = c0; hc <= c1; hc++) {
            const cellK = hr * B.cols + hc;
            for (let p = B.offsets[cellK]; p < B.offsets[cellK + 1]; p++) {
              const k = B.items[p];
              if (st[k] === tick) continue;
              st[k] = tick;
              if (B.bbox[4 * k] > qx1 || B.bbox[4 * k + 2] < qx0 || B.bbox[4 * k + 1] > qz1 || B.bbox[4 * k + 3] < qz0) continue;
              if (onBuilding(s, k)) return true;
            }
          }
        }
      }
    }
    if (this.lm) {
      const blockers = this.lm.blockers;
      for (let hz = Math.floor(qz0 / BLOCK_CELL); hz <= Math.floor(qz1 / BLOCK_CELL); hz++) {
        for (let hx = Math.floor(qx0 / BLOCK_CELL); hx <= Math.floor(qx1 / BLOCK_CELL); hx++) {
          const a = this.lmHash.get((hx + 32768) * 65536 + (hz + 32768));
          if (!a) continue;
          for (const i of a) {
            if (this.lmStamp[i] === tick) continue;
            this.lmStamp[i] = tick;
            const bb = blockers[i].bbox;
            if (bb[0] > qx1 || bb[2] < qx0 || bb[1] > qz1 || bb[3] < qz0) continue;
            if (onLandmark(i)) return true;
          }
        }
      }
    }
    return false;
  }

  private buildingObj(s: number, k: number): Blocker {
    const cache = this.objs[s];
    let o = cache[k];
    if (!o) {
      const B = this.res[s]!.blockers, polygon: Vec2[] = [];
      for (let p = B.vStart[k]; p < B.vStart[k + 1]; p++) polygon.push({ x: B.xz[2 * p], z: B.xz[2 * p + 1] });
      o = cache[k] = { kind: 'polygon', polygon, top: B.top[k] };
    }
    return o;
  }

  /**
   * Fill a regular grid (cell centres at minX + (c + 0.5)·cell, …) from the resident rasters: `walk` gets the raw stand
   * bits of the 0.5 u cell under each centre (STAND_BIT | BLOCK_BIT; 0 where nothing is resident), `heights` the
   * nearest corner height (heightAt where nothing is resident). ≈ 1–3 ms for a 512² nav window.
   */
  fillGrid(minX: number, minZ: number, cell: number, cols: number, rows: number, walk: Uint8Array, heights: Float32Array): void {
    const n = SF_N, W = n + 1, inv = 1 / SF_CELL;
    for (let rr = 0; rr < rows; rr++) {
      const z = minZ + (rr + 0.5) * cell, czAbs = Math.floor(z / CHUNK);
      let j = Math.floor((z - czAbs * CHUNK) * inv);
      if (j > n - 1) j = n - 1;
      const jv = Math.round((z - czAbs * CHUNK) * inv);
      let lastCx = NaN, r: ChunkRasters | null = null, ox = 0;
      for (let cc = 0, k = rr * cols; cc < cols; cc++, k++) {
        const x = minX + (cc + 0.5) * cell, cxAbs = Math.floor(x / CHUNK);
        if (cxAbs !== lastCx) { lastCx = cxAbs; const s = this.slot(cxAbs, czAbs); r = s >= 0 ? this.rastersAt(s) : null; ox = cxAbs * CHUNK; }
        if (!r) { walk[k] = 0; heights[k] = this.heightAt(x, z) ?? 0; continue; }
        let i = ((x - ox) * inv) | 0;
        if (i > n - 1) i = n - 1;
        walk[k] = r.stand[j * n + i];
        heights[k] = r.h[jv * W + Math.round((x - ox) * inv)] / W_Q - W_B;
      }
    }
  }

  zoneAt(x: number, z: number): CityZone | null {
    const far = this.far;
    if (!far) return null;
    const g = far.zoneGrid, c = Math.floor((x - g.originX) / g.step), r = Math.floor((z - g.originZ) / g.step);
    if (c < 0 || r < 0 || c >= g.cols || r >= g.rows) return null;
    const idx = g.idx[r * g.cols + c];
    if (!idx) return null;
    let zone = this.zones[idx - 1];
    if (!zone) {
      const src = far.zones[idx - 1];
      let bestRing = src.rings[0], bestN = -1;
      for (const ring of src.rings) if (!ring.hole && ring.xz.length > bestN) { bestN = ring.xz.length; bestRing = ring; }
      const polygon: Polygon = [];
      for (let i = 0; i < bestRing.xz.length; i += 2) polygon.push({ x: bestRing.xz[i], z: bestRing.xz[i + 1] });
      zone = this.zones[idx - 1] = { id: src.id, name: { zh: src.zh, en: src.en }, polygon };
    }
    return zone;
  }

  stats(): Record<string, number> {
    let resident = 0, bytes = 0;
    this.res.forEach((r, s) => {
      if (!r || this.synth[s]) return;
      resident++;
      bytes += r.h.byteLength + r.surf.byteLength + r.kind.byteLength + r.stand.byteLength + r.blockers.xz.byteLength + r.blockers.items.byteLength + r.blockers.offsets.byteLength + r.blockers.bbox.byteLength;
    });
    return { resident, heapKB: Math.round(bytes / 1024), ...this.counters, patchMs: +this.counters.patchMs.toFixed(2), rasterMs: +this.counters.rasterMs.toFixed(1), landmarks: this.lm?.blockers.length ?? 0 };
  }
}

/**
 * The main-thread city terrain provider for core/terrain `setCityTerrain`. Pass the same landmark list the worker uses
 * for `rasterizeChunk` (landmark blockers are answered from here; decks are stamped by the worker, or on attach).
 */
export function createCityTerrain(manifest: SfManifest, opts: { landmarks?: readonly LandmarkWalkInput[] } = {}): CityTerrainProvider {
  return new Provider(manifest, opts.landmarks ?? []);
}
