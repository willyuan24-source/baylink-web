import type { Vec2 } from './types';

/**
 * Opus Bay world frame for the whole-city build (plan §2): pure numbers, no three.js, safe in a module Web Worker
 * and in node (the offline build in scripts/opus-sf imports this file, so reader and writer cannot drift).
 *
 * - Horizontal: `project()` / `unproject()` are the exact functions of data/district.ts (K = 0.14 u per real metre,
 *   the map rotated 46° so the Embarcadero runs along +x, origin 37.802338 / −122.40001). x = east-ish, z = south-ish.
 *   `project()` rounds to 0.01 u like the district; `projectRaw()` is the same maths without rounding.
 * - City frame: the streamed city is stored in "city" coordinates = the projected position plus the small waterfront
 *   warp at the two ends of the hand-made hero slab (§5.1 seam rule 3, `warpCity`). Everything in public/opus-bay/sf/*
 *   (chunks, far, graph, transit, places) is already warped; use `projectCity()` / `unprojectCity()` to go between
 *   lat/lng and those files. Inside the hero slab (away from its two coastal ends) city = projected exactly.
 * - Vertical: `terrainY(dem)` maps DEM metres to world y (§2.2); `buildingH(m)` maps a real building height to a toy
 *   wall height (§2.3). Streets use `STREET_ROW` right-of-way widths (§2.4).
 * - Streaming grid: 128 u chunks (`CHUNK`), 64 u render cells (`CELL`); chunk (cx, cz) covers
 *   x ∈ [cx·128, cx·128 + 128), z ∈ [cz·128, cz·128 + 128).
 */

// ---------------------------------------------------------------------------
// 1. Projection (identical to data/district.ts §1 — do not change one without the other; tests compare them)
// ---------------------------------------------------------------------------

const RAD = Math.PI / 180;
/** world units per real metre */
export const K = 0.14;
/** map rotation, degrees (counter-clockwise on a north-up map) */
export const ROT_DEG = 46;
export const LAT0 = 37.802338;
export const LNG0 = -122.40001;
const ROT = ROT_DEG * RAD;
/** metres per degree of longitude / latitude at LAT0 (fixed, local equirectangular) */
export const MX = 111320 * Math.cos(LAT0 * RAD);
export const MZ = 110540;
const COS = Math.cos(ROT), SIN = Math.sin(ROT);

const r2 = (v: number) => Math.round(v * 100) / 100;

/** Real lat/lng → world (x, z), unrounded. */
export function projectRaw(lat: number, lng: number): Vec2 {
  const e = (lng - LNG0) * MX, n = (lat - LAT0) * MZ;
  return { x: K * (e * COS - n * SIN), z: K * (-e * SIN - n * COS) };
}

/** Real lat/lng → world (x, z) rounded to 0.01 u — bit-identical to data/district.ts project(). */
export function project(lat: number, lng: number): Vec2 {
  const e = (lng - LNG0) * MX, n = (lat - LAT0) * MZ;
  return { x: r2(K * (e * COS - n * SIN)), z: r2(K * (-e * SIN - n * COS)) };
}

/** World (x, z) → real lat/lng — bit-identical to data/district.ts unproject() (ignores the waterfront warp). */
export function unproject(p: Vec2): { lat: number; lng: number } {
  const X = p.x / K, Z = p.z / K;
  const e = X * COS - Z * SIN, n = -X * SIN - Z * COS;
  return { lat: LAT0 + n / MZ, lng: LNG0 + e / MX };
}

/** Real metres → world units (horizontal). */
export const metresToU = (m: number) => m * K;

// ---------------------------------------------------------------------------
// 2. Terrain curve (§2.2): y = 0.238·k(max(0, dem − 3)), k(h) = h ≤ 90 ? h : 90 + 0.65·(h − 90)
// ---------------------------------------------------------------------------

export const TERRAIN_CURVE = { datum: 3, a: 0.238, knee: 90, s: 0.65 } as const;

/** DEM elevation (metres above sea level) → world y (u). Water / anything ≤ 3 m → 0. */
export function terrainY(dem: number): number {
  const { datum, a, knee, s } = TERRAIN_CURVE;
  const h = dem - datum;
  if (!(h > 0)) return 0;
  return a * (h <= knee ? h : knee + s * (h - knee));
}

/** Inverse of terrainY for y > 0 (metres above sea level); y ≤ 0 → the 3 m datum. */
export function demFromY(y: number): number {
  const { datum, a, knee, s } = TERRAIN_CURVE;
  if (!(y > 0)) return datum;
  const k = y / a;
  return datum + (k <= knee ? k : knee + (k - knee) / s);
}

/** Vertical world units per real metre of a structure standing on the terrain (bridge decks, towers): the curve slope. */
export function structureY(groundDem: number, heightM: number): number {
  return terrainY(groundDem + heightM) - terrainY(groundDem);
}

// ---------------------------------------------------------------------------
// 3. Buildings (§2.3): H = max(3.6, 3.2 + 0.155·h_m)
// ---------------------------------------------------------------------------

export const BUILDING_H = { min: 3.6, a: 3.2, b: 0.155 } as const;
/** Real building height (m) → toy wall height (u), measured from the lowest ground under the footprint. */
export function buildingH(heightM: number): number {
  return Math.max(BUILDING_H.min, BUILDING_H.a + BUILDING_H.b * Math.max(0, heightM));
}
/** Toy wall height (u) → the real height (m) it stands for (inverse of buildingH above its 3.6 u floor). */
export function buildingHeightM(h: number): number {
  return Math.max(0, (h - BUILDING_H.a) / BUILDING_H.b);
}
/** Walls start this far below the base (sink into slopes), as world/city.ts does for the hero lots. */
export const WALL_SINK = 1.2;

// ---------------------------------------------------------------------------
// 4. Streets (§2.4): right-of-way (curb to curb plus sidewalks) in toy units. The whole corridor is walkable.
// ---------------------------------------------------------------------------

export type StreetClass =
  | 'motorway' | 'trunk' | 'primary' | 'secondary' | 'tertiary' | 'residential' | 'service'
  | 'pedestrian' | 'footway' | 'path' | 'cycleway' | 'steps' | 'track';

export const STREET_ROW: Readonly<Record<StreetClass, number>> = {
  motorway: 6,
  trunk: 5.6,
  primary: 5.6,
  secondary: 4.4,
  tertiary: 4.4,
  residential: 3.6,
  service: 2,
  pedestrian: 2.4,
  footway: 1.2,
  path: 1.2,
  cycleway: 1.2,
  steps: 1.4,
  track: 1.2,
};
/** Curb band drawn inside the corridor (sidewalk ways are not used as geometry). */
export const CURB_BAND = 0.6;

// ---------------------------------------------------------------------------
// 5. Streaming grid
// ---------------------------------------------------------------------------

/** chunk edge (u): one data file per chunk */
export const CHUNK = 128;
/** render cell edge (u): each cell shows exactly one LOD tier */
export const CELL = 64;

export const chunkOf = (x: number, z: number) => ({ cx: Math.floor(x / CHUNK), cz: Math.floor(z / CHUNK) });
export const cellOf = (x: number, z: number) => ({ ix: Math.floor(x / CELL), iz: Math.floor(z / CELL) });
/** "cx_cz" — the file name stem under sf/<version>/c/ and the manifest key */
export const chunkKey = (cx: number, cz: number) => `${cx}_${cz}`;
export function parseChunkKey(k: string): { cx: number; cz: number } {
  const m = /^(-?\d+)_(-?\d+)$/.exec(k);
  if (!m) throw new Error(`bad chunk key ${k}`);
  return { cx: Number(m[1]), cz: Number(m[2]) };
}

// ---------------------------------------------------------------------------
// 6. Waterfront warp (§5.1 seam rule 3)
// ---------------------------------------------------------------------------

/**
 * The hero promenade sits ~18 u seaward of the real waterfront (district.ts SHIFT). Where the real coast leaves the
 * hero slab, the city's coastal band is translated so its shoreline meets the hero seawall at the slab edge, tapering
 * to nothing along the coast. One entry per slab end; measured by scripts/opus-sf (coastline ∩ slab edge) and pinned
 * here (the build fails if the data no longer agrees).
 */
export interface WarpEnd {
  id: string;
  /** where the real (unwarped) coastline crosses the slab edge */
  ox: number; oz: number;
  /** translation applied at the anchor (u): hero seawall crossing − real coast crossing */
  dx: number; dz: number;
  /** unit direction along the real coast, away from the hero (s > 0 is outside the slab) */
  tx: number; tz: number;
  /** unit normal pointing inland from the (straightened) real coast */
  mx: number; mz: number;
}

export const WATERFRONT_WARP: readonly WarpEnd[] = [
  // East end (Rincon Park): the hero seawall leaves the slab at (244, 12.6), the real shore at (244, 28.2).
  // West end: no warp — there the hero seawall (extrapolated past Pier 39) is LANDWARD of the real shore, which meets
  // the slab's diagonal edge 16.4 u further along it (scripts/opus-sf measures both; see sf-w1-A report).
  { id: 'east', ox: 244, oz: 28.2, dx: 0, dz: -15.6, tx: 0.999, tz: -0.053, mx: 0.053, mz: 0.999 },
];
/** taper along the coast outside the slab (u) */
export const WARP_ALONG = 160;
/** taper along the coast inside the slab (u) */
export const WARP_INSIDE = 40;
/** full shift up to this far inland of the straightened coast (u), fading to 0 at WARP_IN1 */
export const WARP_IN0 = 25;
export const WARP_IN1 = 85;

export function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

/** Warp displacement at a projected (unwarped) point. */
export function warpOffset(x: number, z: number, ends: readonly WarpEnd[] = WATERFRONT_WARP): Vec2 {
  let ox = 0, oz = 0;
  for (const e of ends) {
    const px = x - e.ox, pz = z - e.oz;
    const s = px * e.tx + pz * e.tz;
    const f = s >= 0 ? 1 - smoothstep(0, WARP_ALONG, s) : 1 - smoothstep(0, WARP_INSIDE, -s);
    if (f <= 0) continue;
    const inland = px * e.mx + pz * e.mz;
    const g = 1 - smoothstep(WARP_IN0, WARP_IN1, inland);
    if (g <= 0) continue;
    ox += e.dx * f * g; oz += e.dz * f * g;
  }
  return { x: ox, z: oz };
}

/** Projected (real) world point → city frame. */
export function warpCity(p: Vec2, ends: readonly WarpEnd[] = WATERFRONT_WARP): Vec2 {
  const d = warpOffset(p.x, p.z, ends);
  return { x: p.x + d.x, z: p.z + d.z };
}

/** City frame → projected (real) world point (fixed-point inverse of warpCity; the warp is a contraction-safe taper). */
export function unwarpCity(q: Vec2, ends: readonly WarpEnd[] = WATERFRONT_WARP): Vec2 {
  let x = q.x, z = q.z;
  for (let i = 0; i < 24; i++) {
    const d = warpOffset(x, z, ends);
    const nx = q.x - d.x, nz = q.z - d.z;
    if (Math.abs(nx - x) < 1e-7 && Math.abs(nz - z) < 1e-7) { x = nx; z = nz; break; }
    x = nx; z = nz;
  }
  return { x, z };
}

/** Real lat/lng → city frame (what every file under public/opus-bay/sf/ uses). */
export function projectCity(lat: number, lng: number): Vec2 {
  return warpCity(projectRaw(lat, lng));
}

/** City frame → real lat/lng (for labels, map links, "open in Maps"). */
export function unprojectCity(p: Vec2): { lat: number; lng: number } {
  return unproject(unwarpCity(p));
}
