import * as THREE from 'three';
import type { SurfaceKind, Vec2 } from '../../../core/types';
import { BOX, type BatchLike, CBOX, CONE, CYL, type ColorLike, ICO, type Info, M, mixColor } from '../../builder';
import type { SiteHooks } from '../sites';
import type { LandmarkGround, SfLandmark } from './index';
import { SITE_TERRAIN, type SiteTerrainGrid } from './siteTerrain';

/**
 * Wave-4 site kit (lane L, plan §2.2 / §5.4): the record type of a new landmark site, its terrain, and the plaza /
 * street / furniture helpers every new site module uses. DECLARATIVE like the registry (landmarks/index.ts): data and
 * maths only, no loader or material imports, node-safe. Everything is in the site's LOCAL frame (origin at the
 * ground centre, +y up, the front faces +z, yaw as in the registry).
 *
 * A wave-4 site stands on a NUMERIC base (world y): the lowest walked city ground inside its exclusion, measured
 * offline on the published v1 data by scripts/opus-sf/sites-terrain.mts, which also bakes the site's ground heights
 * (siteTerrain.ts, local y = ground − base on a 2 u grid). So its plazas, lawns, street strips and furniture follow the
 * real slope (`SiteGround.at`), and tests/opus-bay-sf-sites-w4.test.ts checks every ground polygon against the live
 * rasters. Ground polygons carry per-vertex heights (`ys`): the renderer's buildGroundMesh draws them draped once
 * the integration phase lands (until then it draws them flat at `y`, the mean).
 */

/** The ground lift of plazas / lawns / strips over the walked city ground (streets use 0.035 / 0.055 / dash 0.07). */
export const LIFT = 0.06;
/** crosswalk stripes over the asphalt (0.055) */
export const LIFT_STRIPE = 0.078;

// ---------------------------------------------------------------------------
// record
// ---------------------------------------------------------------------------

/** Camera pose for photos and the arrival reveal, like SfLandmarkInfo.photo (LOCAL). */
export interface SitePhoto { target: [number, number, number]; distance: number; elevation: number; bearing: number }

/**
 * The wave-4 metadata on a site record. Text (names, facts, barks) is lane C's cards; this is geometry and poses.
 * `flag.h` follows plan §4.2: the pole top over the ground at the foot = skyline + 10 u, clamped to 28–70 u.
 */
export interface W4SiteMeta {
  /** its places.json row (existing id), or lane P's new extraPlaces row (= the attraction id) */
  placeId: string;
  /** attraction ids (sf-w4-attractions.json / lane P's ATTRACTIONS) this record models, the main one first; empty for a
   *  shared setting whose attractions are its neighbours' records (the Music Concourse bowl) */
  attractions: readonly string[];
  /** lod-0 ring (u) when it differs from the tier's 520 / 340 / 220 (downtown diet 200, low sites less) */
  lod0R?: number;
  /** lod-0 triangle cap when tighter than the tier's (downtown diet, plan §2.2) */
  budget?: number;
  /** walkable arrival spot outside the blockers, facing `heading` (local yaw), like SfLandmarkInfo.arrival */
  arrival: { x: number; z: number; heading: number };
  photo: SitePhoto;
  /** flag pole foot (local) and top above the ground there (u, 28–70) */
  flag: { x: number; z: number; h: number };
  /**
   * real height (m) of the tallest structure and the toy height used (height policy, plan §2.2): `u` = the policy's
   * height of the main structure over its own ground, `top` = the lod-0 model's measured top over the site's BASE (the
   * test re-measures it; data/sf/landmarks SfLandmarkInfo.height.u means this one: cityViews / cityLive add it to the
   * base), `rule` as SfLandmarkInfo's ('overlook' for a plaza, park or view site with no building to frame)
   */
  height: { realM: number; u: number; top: number; rule: 'H = 3.2 + 0.155·h' | 'terrainY' | 'overlook' };
  /** OSM features the model replaces or was measured from */
  osm: readonly string[];
  /** the local box (x0, z0, x1, z1) scripts/opus-sf/sites-terrain.mts bakes the ground heights over */
  terrain: readonly [number, number, number, number];
  /** grid step of the baked ground (u, default 2; 1 on terraced slopes whose walks are flattened steps) */
  terrainStep?: number;
  /**
   * lane V's AI mesh planned for this site (the swap lands in integration, through the SoloView gate): `model` = the
   * GLB stem (`w4-holy-virgin`, lane V's test pairs it with the file), `id` = the SF_MODELS registry id the swap part
   * names (`sf-holy-virgin`, data/sf/w4Models.ts W4_MODEL_IDS), `at` = the part's placement in the LOCAL frame (y over
   * the base), yaw 0 and scale 1 unless stated
   */
  aiSlot?: { model: string; id: string; at: [number, number, number]; note: string };
  /** attractions of this site that stay card-only here, and why (quiet memorials, closures, the downtown diet) */
  notes?: string;
  /** the walk-around ring's open share when an existing building or the shore closes one side (default 0.75; say why in `notes`) */
  ringMin?: number;
  /**
   * the crowd plaza's least area (u², default 30) when the site only has sidewalks to offer (a shopping block, a corner
   * building, a bridge over a street; say why in `notes`). The crowd stands EXACTLY on the plaza spots
   * (world/sf/crowd.ts spawnStander skips its roadway check for them), so a plaza never covers a carriageway
   */
  plazaMin?: number;
  /**
   * a street site (a shopping block: shopStreet.ts): the block's kerb corners along local x and the facade line |z|.
   * The walk check samples the street's length (sidewalks and carriageway) instead of a ring, which would cross the
   * shops on both sides.
   */
  street?: { x0: number; x1: number; half: number };
}

/** A ground polygon with per-vertex local heights (the draped form of LandmarkGround) and the lift it was draped with. */
export interface SiteGroundPoly extends LandmarkGround { ys?: number[]; lift?: number }

/**
 * A wave-4 landmark site: an SfLandmark (numeric base) with the SiteHooks and its wave-4 metadata. `sink: 0` is
 * required: sites.ts (landmarkSink) otherwise sinks the city ground 0.2 u inside the exclusion, render and walk raster,
 * while the site drapes its ground on the UNSUNK walked ground (siteTerrain.ts): walkers would stand ≈ 0.3 u, a sixth
 * of the player, under every plaza and lawn (W4-L-review).
 */
export type W4Site = SfLandmark & SiteHooks & { base: number; sink: 0; ground?: SiteGroundPoly[]; w4: W4SiteMeta };

// ---------------------------------------------------------------------------
// terrain
// ---------------------------------------------------------------------------

/** The site's baked ground: `base` (world y) and local heights over it (bilinear on the baked grid, 0 outside it). */
export interface SiteGround {
  readonly base: number;
  readonly grid: SiteTerrainGrid | null;
  at(x: number, z: number): number;
}

export function siteGround(id: string, fallbackBase = 0): SiteGround {
  const g = SITE_TERRAIN[id] ?? null;
  if (!g) return { base: fallbackBase, grid: null, at: () => 0 };
  const { x0, z0, step, cols, rows, h } = g;
  const at = (x: number, z: number) => {
    const fx = Math.min(cols - 1, Math.max(0, (x - x0) / step)), fz = Math.min(rows - 1, Math.max(0, (z - z0) / step));
    const i = Math.min(cols - 2, Math.floor(fx)), j = Math.min(rows - 2, Math.floor(fz));
    const u = fx - i, v = fz - j;
    const k = j * cols + i;
    const a = h[k] * (1 - u) + h[k + 1] * u, b = h[k + cols] * (1 - u) + h[k + cols + 1] * u;
    return (a * (1 - v) + b * v) / 100;
  };
  return { base: g.base, grid: g, at };
}

// ---------------------------------------------------------------------------
// ground polygons (GROUND material, drawn by sites.ts buildGroundMesh)
// ---------------------------------------------------------------------------

/** GROUND pattern ids (world/materials.ts GROUND_PATTERN): polygons use the angle patterns, never the ribbon ones. */
export const PAT = { none: 0, stone: 2, planks: 3, grass: 4, asphalt: 5, cobble: 6, earth: 7 } as const;

/** Site ground colours (the city's CITY_PAL family, so strips continue the streets they replace). */
export const GC = {
  plaza: '#ede3d0',
  plazaWarm: '#e6d6bb',
  pavers: '#e2d6c0',
  sidewalk: '#ece2cd',
  curb: '#d4c9b5',
  asphalt: '#a7a29b',
  asphaltMajor: '#9e9992',
  lawn: '#a8c683',
  lawnDeep: '#9fbf7a',
  meadow: '#a9bf7e',
  earth: '#c9b391',
  path: '#d9c7a3',
  sand: '#eedcb0',
  deck: '#b98a5a',
  parking: '#d2cabd',
  stripe: '#f4efe2',
  bed: '#8a6a4a',
} as const;

const meanY = (ys: number[]) => ys.reduce((s, y) => s + y, 0) / ys.length;

/** One ground polygon draped on the site ground (`lift` over it). */
export function gpoly(poly: Vec2[], color: string, pattern: number, g: SiteGround, lift = LIFT): SiteGroundPoly {
  const ys = poly.map(p => +(g.at(p.x, p.z) + lift).toFixed(3));
  return { poly, y: +meanY(ys).toFixed(3), ys, color, pattern, lift };
}

/** A rectangle (centre x, z, size w × d, yaw ry) as ground cells of ≤ `cell` u, draped. */
export function grect(x: number, z: number, w: number, d: number, ry: number, color: string, pattern: number, g: SiteGround, cell = 5, lift = LIFT): SiteGroundPoly[] {
  const nu = Math.max(1, Math.ceil(w / cell)), nv = Math.max(1, Math.ceil(d / cell));
  const c = Math.cos(ry), s = Math.sin(ry), out: SiteGroundPoly[] = [];
  const P = (u: number, v: number): Vec2 => ({ x: x + u * c + v * s, z: z - u * s + v * c });
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const u0 = -w / 2 + (w * i) / nu, u1 = -w / 2 + (w * (i + 1)) / nu, v0 = -d / 2 + (d * j) / nv, v1 = -d / 2 + (d * (j + 1)) / nv;
    out.push(gpoly([P(u0, v0), P(u1, v0), P(u1, v1), P(u0, v1)], color, pattern, g, lift));
  }
  return out;
}

/**
 * Any local polygon (concave is fine) as draped ground: cut into ≤ `cell` u squares of the local grid (each square
 * clips the polygon, Sutherland–Hodgman), so big lawns and plazas follow the slope between their corners.
 */
export function gfill(poly: Vec2[], color: string, pattern: number, g: SiteGround, cell = 5, lift = LIFT): SiteGroundPoly[] {
  const xs = poly.map(p => p.x), zs = poly.map(p => p.z);
  const x0 = Math.floor(Math.min(...xs) / cell) * cell, z0 = Math.floor(Math.min(...zs) / cell) * cell;
  const x1 = Math.max(...xs), z1 = Math.max(...zs), out: SiteGroundPoly[] = [];
  for (let z = z0; z < z1; z += cell) for (let x = x0; x < x1; x += cell) {
    const piece = clipRect(poly, x, z, x + cell, z + cell);
    if (piece.length >= 3 && polyArea(piece) > 0.02) out.push(gpoly(piece, color, pattern, g, lift));
  }
  return out;
}

/** Sutherland–Hodgman: the part of `poly` inside the axis-aligned rectangle (rounded to 1/1000 u). */
export function clipRect(poly: Vec2[], x0: number, z0: number, x1: number, z1: number): Vec2[] {
  let out = poly;
  const edges: [(p: Vec2) => boolean, (a: Vec2, b: Vec2) => Vec2][] = [
    [p => p.x >= x0, (a, b) => ({ x: x0, z: a.z + ((b.z - a.z) * (x0 - a.x)) / (b.x - a.x) })],
    [p => p.x <= x1, (a, b) => ({ x: x1, z: a.z + ((b.z - a.z) * (x1 - a.x)) / (b.x - a.x) })],
    [p => p.z >= z0, (a, b) => ({ x: a.x + ((b.x - a.x) * (z0 - a.z)) / (b.z - a.z), z: z0 })],
    [p => p.z <= z1, (a, b) => ({ x: a.x + ((b.x - a.x) * (z1 - a.z)) / (b.z - a.z), z: z1 })],
  ];
  for (const [inside, cut] of edges) {
    const src = out;
    out = [];
    for (let i = 0; i < src.length; i++) {
      const a = src[i], b = src[(i + 1) % src.length], ia = inside(a), ib = inside(b);
      if (ia) out.push(a);
      if (ia !== ib) out.push(cut(a, b));
    }
    if (!out.length) return out;
  }
  const r = (v: number) => Math.round(v * 1000) / 1000;
  return out.map(p => ({ x: r(p.x), z: r(p.z) })).filter((p, i, a) => { const q = a[(i + a.length - 1) % a.length]; return a.length < 2 || p.x !== q.x || p.z !== q.z; });
}

/** A strip of width w along a local polyline (paths, street strips through an exclusion), one quad per ≤ seg u. */
export function gstrip(points: Vec2[], w: number, color: string, pattern: number, g: SiteGround, seg = 5, lift = LIFT): SiteGroundPoly[] {
  const pts = resample(points, seg), out: SiteGroundPoly[] = [];
  const side = (i: number) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz) || 1;
    return { x: (-dz / L) * (w / 2), z: (dx / L) * (w / 2) };
  };
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i], b = pts[i + 1], sa = side(i), sb = side(i + 1);
    out.push(gpoly([{ x: a.x - sa.x, z: a.z - sa.z }, { x: b.x - sb.x, z: b.z - sb.z }, { x: b.x + sb.x, z: b.z + sb.z }, { x: a.x + sa.x, z: a.z + sa.z }], color, pattern, g, lift));
  }
  return out;
}

/**
 * Zebra crosswalk from kerb point a to kerb point b (across the street), `width` along the street: white stripes
 * `stripe` u wide with `gap` between them, parallel to the street. City streets are flat across (the corridor model
 * pulls the ground to the centreline), so the stripes lie at `yRoad` (local: the street's centreline height from the
 * published road, minus the base) + LIFT_STRIPE; without it they drape on the site ground.
 */
export function crosswalk(a: Vec2, b: Vec2, g: SiteGround, width = 2.4, yRoad?: number, stripe = 0.45, gap = 0.45): SiteGroundPoly[] {
  const dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz);
  if (L < 0.5) return [];
  const ux = dx / L, uz = dz / L, px = -uz * (width / 2), pz = ux * (width / 2);
  const n = Math.max(1, Math.floor((L + gap) / (stripe + gap))), used = n * stripe + (n - 1) * gap, off = (L - used) / 2;
  const out: SiteGroundPoly[] = [];
  for (let k = 0; k < n; k++) {
    const s0 = off + k * (stripe + gap), s1 = s0 + stripe;
    const p0 = { x: a.x + ux * s0, z: a.z + uz * s0 }, p1 = { x: a.x + ux * s1, z: a.z + uz * s1 };
    const poly = [{ x: p0.x - px, z: p0.z - pz }, { x: p1.x - px, z: p1.z - pz }, { x: p1.x + px, z: p1.z + pz }, { x: p0.x + px, z: p0.z + pz }];
    if (yRoad === undefined) out.push(gpoly(poly, GC.stripe, PAT.none, g, LIFT_STRIPE));
    else { const y = +(yRoad + LIFT_STRIPE).toFixed(3); out.push({ poly, y, ys: poly.map(() => y), color: GC.stripe, pattern: PAT.none, lift: LIFT_STRIPE }); }
  }
  return out;
}

/** Evenly spaced points along a polyline (keeps the corners). */
export function resample(points: Vec2[], step: number): Vec2[] {
  const out: Vec2[] = [points[0]];
  for (let i = 0; i + 1 < points.length; i++) {
    const a = points[i], b = points[i + 1], L = Math.hypot(b.x - a.x, b.z - a.z), n = Math.max(1, Math.ceil(L / step));
    for (let k = 1; k <= n; k++) out.push({ x: a.x + ((b.x - a.x) * k) / n, z: a.z + ((b.z - a.z) * k) / n });
  }
  return out;
}

/** Points every `spacing` u along a polyline, offset sideways by `offset` (+ = left of the direction), with headings. */
export function along(points: Vec2[], spacing: number, offset = 0, start = spacing / 2): { x: number; z: number; ry: number }[] {
  const out: { x: number; z: number; ry: number }[] = [];
  let carry = start;
  for (let i = 0; i + 1 < points.length; i++) {
    const a = points[i], b = points[i + 1], dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz);
    if (L < 1e-6) continue;
    const ux = dx / L, uz = dz / L;
    for (let s = carry; s <= L; s += spacing) out.push({ x: a.x + ux * s - uz * offset, z: a.z + uz * s + ux * offset, ry: Math.atan2(ux, uz) });
    carry = spacing - ((L - carry) % spacing);
    if (carry >= spacing - 1e-9) carry = 0;
  }
  return out;
}

/** Shoelace area of a local polygon (u²). */
export function polyArea(poly: Vec2[]): number {
  let a = 0;
  for (let i = 0; i < poly.length; i++) { const p = poly[i], q = poly[(i + 1) % poly.length]; a += p.x * q.z - q.x * p.z; }
  return Math.abs(a) / 2;
}

// ---------------------------------------------------------------------------
// furniture (TOY, into the lod-0 batch; y = the ground there, local)
// ---------------------------------------------------------------------------

export const FC = {
  wood: '#a4774d',
  metal: '#39433f',
  lampPost: '#3f5a50',
  lampGlass: '#fff1cf',
  bollard: '#6d7571',
  bin: '#4f6a5e',
  planter: '#cdbfa6',
  hedge: '#6f9a5b',
  trunk: '#7a5a3e',
  tree: '#6f9a5b',
  treeDark: '#557f47',
  pine: '#4d7247',
  palmTrunk: '#9a7a55',
  frond: '#6f9a4c',
  stone: '#e3dccd',
  concrete: '#cfc7b8',
  white: '#f7f4ec',
  glass: '#9fc3cc',
} as const;

/** TOY aInfo helpers (world/materials.ts): no windows; w = night glow / self-lit */
const NONE: Info = [0, 0, 0, 0];
const SWAY_I = (w: number): Info => [0, 0, w, 0];

/** Park bench (seat, back, two legs: 48 triangles), facing +z of its yaw. */
export function bench(b: BatchLike, x: number, y: number, z: number, ry: number) {
  b.add(BOX(), M(x, y + 0.42, z, ry, 1.55, 0.08, 0.46), FC.wood);
  b.add(BOX(), M(x - Math.sin(ry) * 0.2, y + 0.55, z - Math.cos(ry) * 0.2, ry, 1.55, 0.34, 0.06), FC.wood);
  for (const s of [-0.65, 0.65]) b.add(BOX(), M(x + Math.cos(ry) * s, y, z - Math.sin(ry) * s, ry, 0.08, 0.42, 0.4), FC.metal);
}

/** Street lamp like the district's (post, lantern, cap: ≈ 56 triangles); returns its light point (local). */
export function lamp(b: BatchLike, x: number, y: number, z: number): { x: number; y: number; z: number; size: number; color: string } {
  b.add(CYL(6), M(x, y, z, 0, 0.1, 0.45, 0.1), FC.lampPost);
  b.add(CYL(5), M(x, y + 0.4, z, 0, 0.06, 3.2, 0.06), FC.lampPost);
  b.add(CYL(6, 0.7), M(x, y + 3.55, z, 0, 0.22, 0.5, 0.22), FC.lampGlass, [0, 0, 0, 1.3]);
  b.add(CONE(6), M(x, y + 4.02, z, 0, 0.3, 0.3, 0.3), FC.lampPost);
  return { x, y: y + 3.8, z, size: 1, color: '#ffd9a0' };
}

export function bollard(b: BatchLike, x: number, y: number, z: number) {
  b.add(BOX(), M(x, y, z, 0, 0.22, 0.75, 0.22), FC.bollard);
}

export function bin(b: BatchLike, x: number, y: number, z: number, ry = 0) {
  b.add(BOX(), M(x, y, z, ry, 0.45, 0.8, 0.45), FC.bin);
}

/** Raised planter with a hedge top (24 triangles). */
export function planter(b: BatchLike, x: number, y: number, z: number, w: number, d: number, ry = 0) {
  b.add(BOX(), M(x, y - 0.3, z, ry, w, 0.85, d), FC.planter);
  b.add(BOX(), M(x, y + 0.55, z, ry, w - 0.2, 0.35, d - 0.2), FC.hedge, SWAY_I(0.15));
}

/** Toy tree (≈ 56 triangles): a tapered trunk and two leaf blobs; s scales it (1 ≈ 3.2 u tall). */
export function tree(b: BatchLike, x: number, y: number, z: number, s = 1, seed = 0) {
  const r = (k: number) => { const h = Math.sin(seed * 12.9898 + k * 78.233) * 43758.5453; return h - Math.floor(h); };
  b.add(CYL(5, 0.75), M(x, y - 0.2, z, 0, 0.16 * s, 2.0 * s, 0.16 * s), FC.trunk);
  const col = mixColor(FC.tree, FC.treeDark, r(1) * 0.5);
  b.add(ICO(0), M(x, y + 2.45 * s, z, r(2) * 3, 1.2 * s, 1.1 * s, 1.2 * s), col, SWAY_I(0.35));
  b.add(ICO(0), M(x + (r(3) - 0.5) * 0.9 * s, y + 2.05 * s, z + (r(4) - 0.5) * 0.9 * s, r(5) * 3, 0.85 * s, 0.8 * s, 0.85 * s), mixColor(col, FC.treeDark, 0.4), SWAY_I(0.35));
}

/** Toy conifer (cypress / pine / eucalyptus stand-in, ≈ 40 triangles). */
export function conifer(b: BatchLike, x: number, y: number, z: number, s = 1) {
  b.add(CYL(5), M(x, y - 0.2, z, 0, 0.15 * s, 1.4 * s, 0.15 * s), FC.trunk);
  b.add(CONE(7), M(x, y + 0.8 * s, z, 0, 1.05 * s, 3.6 * s, 1.05 * s), FC.pine, SWAY_I(0.25));
}

/** Toy palm (≈ 100 triangles): Union Square, the Embarcadero family. */
export function palm(b: BatchLike, x: number, y: number, z: number, H = 4.6, seed = 0) {
  b.add(CYL(6, 0.78), M(x, y - 0.2, z, 0, 0.3, H + 0.2, 0.3), FC.palmTrunk);
  for (let i = 0; i < 7; i++) {
    const yaw = seed + (i / 7) * Math.PI * 2, pitch = i % 2 ? 0.55 : 0.2, seg = 1.5;
    const dx = Math.sin(yaw) * Math.cos(pitch) * seg, dy = -Math.sin(pitch) * seg, dz = Math.cos(yaw) * Math.cos(pitch) * seg;
    b.add(CBOX(), M(x + dx / 2, y + H + dy / 2, z + dz / 2, yaw, 0.45, 0.05, seg * 1.05, pitch), FC.frond, SWAY_I(0.3));
  }
}

/** A hedge / low wall run between two local points (12 triangles). */
export function hedge(b: BatchLike, a: Vec2, c: Vec2, y: number, h = 0.7, t = 0.5, color: string = FC.hedge) {
  const dx = c.x - a.x, dz = c.z - a.z, L = Math.hypot(dx, dz);
  if (L < 0.05) return;
  b.add(BOX(), M((a.x + c.x) / 2, y - 0.25, (a.z + c.z) / 2, Math.atan2(dx, dz), t, h + 0.25, L), color, color === FC.hedge ? SWAY_I(0.12) : NONE);
}

/** A rail fence along a polyline: posts every ~3 u and one rail (≈ 12 triangles a post). */
export function fence(b: BatchLike, pts: Vec2[], yAt: (x: number, z: number) => number, h = 0.9, color = '#6d6a62') {
  for (const p of along(pts, 3, 0, 0)) b.add(BOX(), M(p.x, yAt(p.x, p.z) - 0.2, p.z, p.ry, 0.1, h + 0.2, 0.1), color);
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i], c = pts[i + 1], ya = yAt(a.x, a.z) + h - 0.1, yc = yAt(c.x, c.z) + h - 0.1;
    b.beam(new THREE.Vector3(a.x, ya, a.z), new THREE.Vector3(c.x, yc, c.z), 0.07, 0.07, color);
  }
}

/** Flagpole with a plain pennant (no text; ≈ 30 triangles). */
export function flagpole(b: BatchLike, x: number, y: number, z: number, h: number, color = '#c9473a', ry = 0) {
  b.add(CYL(5), M(x, y, z, 0, 0.07, h, 0.07), '#dcd8cf');
  b.add(CBOX(), M(x + Math.cos(ry) * 0.7, y + h - 0.45, z - Math.sin(ry) * 0.7, ry, 1.3, 0.8, 0.03), color, SWAY_I(0.5));
}

// ---------------------------------------------------------------------------
// construction sites (UCSF Parnassus, CCSF's Diego Rivera Performing Arts Center)
// ---------------------------------------------------------------------------

const CRANE_YELLOW = '#e0b04e';
const BEACON: Info = [0, 0, 0, 1];

/** A tower crane's lattice mast from the ground y0 to `top` (local y); lod 2: one post and a fixed jib bar. */
export function craneMast(b: BatchLike, x: number, y0: number, z: number, top: number, lod: 0 | 2, jib = 11, counter = 4.2) {
  if (lod === 2) {
    box6(b, x, y0, z, 0.6, top - y0 + 0.9, 0.6, CRANE_YELLOW);
    b.add(CBOX(), M(x + (jib - counter) / 2, top + 0.6, z, 0.6, jib + counter, 0.4, 0.4), CRANE_YELLOW);
    return;
  }
  box6(b, x, y0 - 0.4, z, 1.2, 0.6, 1.2, '#8d8983');
  for (const [ox, oz] of [[-0.3, -0.3], [0.3, -0.3], [0.3, 0.3], [-0.3, 0.3]]) box6(b, x + ox, y0, z + oz, 0.1, top - y0, 0.1, CRANE_YELLOW);
  for (let k = 1; k < 9; k++) b.add(CBOX(), M(x, y0 + (k * (top - y0)) / 9, z, 0, 0.66, 0.08, 0.66), CRANE_YELLOW);
}

/**
 * The crane's slewing part (the `animate` mesh, LOCAL to the mast top): slewing unit, cab, tower head, jib,
 * counter-jib with weights, pendant lines, hoist line and hook, a red tip light. Turn it about +y.
 */
export function craneJib(b: BatchLike, jib = 11, counter = 4.2) {
  box6(b, 0, 0, 0, 0.9, 0.5, 0.9, '#c9a23f');
  box6(b, -0.55, 0.05, 0.45, 0.5, 0.45, 0.45, '#e9e4d8', [0, 0, 0, 0.3]);
  box6(b, 0, 0.5, 0, 0.18, 1.6, 0.18, CRANE_YELLOW);
  b.add(CBOX(), M(jib / 2, 0.62, 0, 0, jib, 0.34, 0.34), CRANE_YELLOW);
  b.add(CBOX(), M(-counter / 2, 0.62, 0, 0, counter, 0.3, 0.42), CRANE_YELLOW);
  box6(b, -counter + 0.7, 0.2, 0, 1.2, 0.5, 0.6, '#9a958c');
  b.add(CBOX(), M(jib * 0.35, 1.25, 0, 0, jib * 0.72, 0.05, 0.05, 0, -0.18), '#6b5e4c');
  b.add(CBOX(), M(-counter * 0.45, 1.25, 0, 0, counter * 0.95, 0.05, 0.05, 0, 0.35), '#6b5e4c');
  box6(b, jib * 0.62, -3.4, 0, 0.04, 3.9, 0.04, '#3e3a34');
  box6(b, jib * 0.62, -3.75, 0, 0.3, 0.35, 0.3, '#c9473a');
  b.add(CBOX(), M(jib, 0.62, 0, 0, 0.16, 0.16, 0.16), '#ff5a44', BEACON);
}

/** a slow working swing of ±`amp` about `mid` (radians), never a full turn */
export const craneSwing = (t: number, mid: number, amp = 0.62, rate = 0.09) => mid + Math.sin(t * rate) * amp;

/** Site hoarding (blue plywood, 1.9 u) along a local polyline, stepping with the ground. */
export function hoarding(b: BatchLike, pts: Vec2[], yAt: (x: number, z: number) => number, color = '#5f86a6') {
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i], c = pts[i + 1], dx = c.x - a.x, dz = c.z - a.z, L = Math.hypot(dx, dz);
    if (L < 0.2) continue;
    const ya = yAt(a.x, a.z), yc = yAt(c.x, c.z);
    b.add(BOX(), M((a.x + c.x) / 2, Math.min(ya, yc) - 0.3, (a.z + c.z) / 2, Math.atan2(dx, dz), 0.12, Math.abs(ya - yc) + 1.9, L), color);
  }
}

/** box from its bottom centre (the kit's box without importing kit.ts here) */
function box6(b: BatchLike, x: number, y: number, z: number, w: number, h: number, d: number, color: string, info: Info = NONE) {
  b.add(BOX(), M(x, y, z, 0, w, h, d), color, info);
}

/** Night light points of the site's lamps (SiteHooks.lights) collected while building. */
export type SiteLight = NonNullable<SiteHooks['lights']>[number];

/** A walkable plaza polygon (SiteHooks.plaza, lane F's crowd spots) with its surface kind. */
export const plazaOf = (poly: Vec2[], surface: SurfaceKind = 'plaza') => ({ poly, surface });

/**
 * Hip roof over a centred rectangle w × d (eaves at y0, the ridge — or the apex on a square — at y0 + h; ridge along
 * the longer side), 6 triangles. kit.pyramid draws a true rectangle only when w = d: its scale applies before the 45°
 * turn, so a w ≠ d cap comes out as a skewed rhombus (see the lane-L report).
 */
export function hipRoof(b: BatchLike, x: number, y0: number, z: number, w: number, d: number, h: number, color: ColorLike, ry = 0, info: Info = NONE) {
  const c = Math.cos(ry), s = Math.sin(ry);
  const P = (u: number, yy: number, v: number) => new THREE.Vector3(x + u * c + v * s, yy, z - u * s + v * c);
  /** outward normal of a slope facing local (ou, ov) that climbs h over `run` */
  const N = (ou: number, ov: number, run: number) => new THREE.Vector3((ou * c + ov * s) * h, run, (-ou * s + ov * c) * h).normalize();
  const hw = w / 2, hd = d / 2;
  if (w >= d) {
    const r = hw - hd, R0 = P(-r, y0 + h, 0), R1 = P(r, y0 + h, 0);
    b.quad(P(-hw, y0, hd), P(hw, y0, hd), R1, R0, N(0, 1, hd), color, info);
    b.quad(P(hw, y0, -hd), P(-hw, y0, -hd), R0, R1, N(0, -1, hd), color, info);
    b.tri(P(-hw, y0, -hd), P(-hw, y0, hd), R0, color, info, N(-1, 0, hd));
    b.tri(P(hw, y0, hd), P(hw, y0, -hd), R1, color, info, N(1, 0, hd));
  } else {
    const r = hd - hw, R0 = P(0, y0 + h, -r), R1 = P(0, y0 + h, r);
    b.quad(P(hw, y0, -hd), P(hw, y0, hd), R1, R0, N(1, 0, hw), color, info);
    b.quad(P(-hw, y0, hd), P(-hw, y0, -hd), R0, R1, N(-1, 0, hw), color, info);
    b.tri(P(-hw, y0, -hd), P(hw, y0, -hd), R0, color, info, N(0, -1, hw));
    b.tri(P(hw, y0, hd), P(-hw, y0, hd), R1, color, info, N(0, 1, hw));
  }
}
