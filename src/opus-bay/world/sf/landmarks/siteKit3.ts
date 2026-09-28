import type { Vec2 } from '../../../core/types';
import { BOX, type BatchLike, CBOX, type ColorLike, ICO, type Info, M, mixColor } from '../../builder';
import { FC, type SiteGround } from './siteKit';
import type { SiteTerrainGrid } from './siteTerrain';
import { SITE_TERRAIN3 } from './siteTerrain3';

/**
 * Wave-4 tier-3 site kit (lane L3, W4-L9): the ground lookup of the tier-3 sites (their own baked table,
 * siteTerrain3.ts) and the few props the small settings share (blank sign boards, colour-field panels, boulders,
 * stair flights, low walls). Everything else comes from lane L's siteKit.ts (ground polygons, furniture, trees), which
 * this file never changes. DECLARATIVE and node-safe like siteKit.ts; LOCAL frame (origin at the site's ground centre,
 * +y up, the front faces +z). No text anywhere: every board and panel is plain colour (plan §2.2 "Brands and art").
 */

/** bilinear lookup on a baked grid (1/100 u above the base; 0 outside the grid's box, clamped at its edges) */
export function groundOf(g: SiteTerrainGrid | null, fallbackBase = 0): SiteGround {
  if (!g) return { base: fallbackBase, grid: null, at: () => 0 };
  const { x0, z0, step, cols, rows, h } = g;
  const at = (x: number, z: number) => {
    const fx = Math.min(cols - 1, Math.max(0, (x - x0) / step)), fz = Math.min(rows - 1, Math.max(0, (z - z0) / step));
    const i = Math.min(cols - 2, Math.floor(fx)), j = Math.min(rows - 2, Math.floor(fz));
    const u = fx - i, v = fz - j, k = j * cols + i;
    const a = h[k] * (1 - u) + h[k + 1] * u, b = h[k + cols] * (1 - u) + h[k + cols + 1] * u;
    return (a * (1 - v) + b * v) / 100;
  };
  return { base: g.base, grid: g, at };
}

/** The baked ground of a tier-3 site (siteKit.siteGround reads lane L's table; this one reads SITE_TERRAIN3). */
export const site3Ground = (id: string, fallbackBase = 0): SiteGround => groundOf(SITE_TERRAIN3[id] ?? null, fallbackBase);

const NONE: Info = [0, 0, 0, 0];

/** Box from its bottom centre, yaw ry (the kit's box, without importing kit.ts' materials table). */
export function box3(b: BatchLike, x: number, y: number, z: number, w: number, h: number, d: number, color: ColorLike, ry = 0, info: Info = NONE) {
  b.add(BOX(), M(x, y, z, ry, w, h, d), color, info);
}

/**
 * A blank board on two posts (park entrance, trailhead, historical marker): the face is plain colour, never text.
 * Faces +z of its yaw; `w` × `h` board whose bottom edge is `lift` over the ground. 36 triangles.
 */
export function signBoard(b: BatchLike, x: number, y: number, z: number, ry: number, w = 1.3, h = 0.8, lift = 0.7, face: ColorLike = '#e8dfc8', post: ColorLike = '#6b5642') {
  const c = Math.cos(ry), s = Math.sin(ry);
  for (const k of [-1, 1]) box3(b, x + c * k * (w / 2 - 0.08), y - 0.15, z - s * k * (w / 2 - 0.08), 0.1, lift + h + 0.2, 0.1, post, ry);
  box3(b, x, y + lift, z, w, h, 0.07, face, ry);
}

/**
 * A plaque stone (a marker boulder with a flat bronze-coloured plate, no text): a squat block and the plate on its
 * sloped face toward +z. 24 triangles.
 */
export function markerStone(b: BatchLike, x: number, y: number, z: number, ry: number, s = 1, stone: ColorLike = '#b9b1a3') {
  box3(b, x, y - 0.2, z, 0.9 * s, 0.75 * s, 0.6 * s, stone, ry);
  const c = Math.cos(ry), sn = Math.sin(ry);
  b.add(CBOX(), M(x + sn * 0.31 * s, y + 0.3 * s, z + c * 0.31 * s, ry, 0.55 * s, 0.35 * s, 0.03, -0.35), '#8a6a3c');
}

/**
 * A colour-field panel (garage door, fence board, facade wash): `w` wide, `h` tall, bottom at y, facing +z of its yaw,
 * split vertically at `split` (0…1) into colours a | b (b omitted: one field). 12 triangles a field.
 */
export function colourPanel(b: BatchLike, x: number, y: number, z: number, ry: number, w: number, h: number, a: ColorLike, bCol?: ColorLike, split = 0.5, t = 0.08) {
  if (!bCol) { box3(b, x, y, z, w, h, t, a, ry); return; }
  const c = Math.cos(ry), s = Math.sin(ry), wa = w * split, wb = w - wa;
  const ua = -w / 2 + wa / 2, ub = w / 2 - wb / 2;
  box3(b, x + c * ua, y, z - s * ua, wa, h, t, a, ry);
  box3(b, x + c * ub, y, z - s * ub, wb, h, t, bCol, ry);
}

/** A chert boulder (a squashed icosahedron, 20 triangles), tinted by `seed`. */
export function boulder(b: BatchLike, x: number, y: number, z: number, s = 1, seed = 0, color: ColorLike = '#9c7f6a') {
  const r = (k: number) => { const q = Math.sin(seed * 12.9898 + k * 78.233) * 43758.5453; return q - Math.floor(q); };
  b.add(ICO(0), M(x, y + 0.25 * s, z, r(1) * 3, (0.8 + r(2) * 0.4) * s, (0.55 + r(3) * 0.3) * s, (0.7 + r(4) * 0.4) * s), mixColor(color, '#6f5b4d', r(5) * 0.5));
}

/**
 * A straight stair flight from local point a (ground y ya) to c (y yc), up or down, `w` wide: one box per step (12
 * triangles each), risers never over 0.3 u. Each tread is the HIGHER end of its stretch of the slope, so the treads sit
 * on the walked ground (which runs smoothly under them) and never sink into it. Returns the number of steps.
 */
export function stairFlight(b: BatchLike, a: Vec2, c: Vec2, ya: number, yc: number, w: number, color: ColorLike = FC.concrete, nose: ColorLike | null = null) {
  const dx = c.x - a.x, dz = c.z - a.z, L = Math.hypot(dx, dz);
  const rise = yc - ya, n = Math.max(1, Math.ceil(Math.max(Math.abs(rise) / 0.3, L / 0.6)));
  const ry = Math.atan2(dx, dz), tread = L / n;
  for (let k = 0; k < n; k++) {
    const t = (k + 0.5) / n, top = ya + (rise * (rise < 0 ? k : k + 1)) / n;
    const bottom = Math.min(ya, yc) - 0.15;
    b.add(BOX(), M(a.x + dx * t, bottom, a.z + dz * t, ry, w, top - bottom, tread + 0.02), k % 2 && nose ? nose : color);
  }
  return n;
}

/** A low wall / kerb run between two local points (12 triangles), its top `h` over the higher end's ground. */
export function lowWall(b: BatchLike, a: Vec2, c: Vec2, ya: number, yc: number, h = 0.5, t = 0.3, color: ColorLike = FC.stone) {
  const dx = c.x - a.x, dz = c.z - a.z, L = Math.hypot(dx, dz);
  if (L < 0.05) return;
  const y0 = Math.min(ya, yc) - 0.25;
  b.add(BOX(), M((a.x + c.x) / 2, y0, (a.z + c.z) / 2, Math.atan2(dx, dz), t, Math.max(ya, yc) + h - y0, L), color);
}

/**
 * The outline of a band `half` u either side of a gently bending polyline (an exclusion or a crowd strip along a
 * path): the left offsets forward, the right offsets back, each vertex offset along the mean of its two segments'
 * normals (mitred), the ends squared off `ext` u past the first and last points.
 */
export function bandPoly(points: Vec2[], half: number, ext = 0): Vec2[] {
  const n = points.length, left: Vec2[] = [], right: Vec2[] = [];
  const dir = (i: number) => { const a = points[Math.max(0, i - 1)], c = points[Math.min(n - 1, i + 1)], L = Math.hypot(c.x - a.x, c.z - a.z) || 1; return { x: (c.x - a.x) / L, z: (c.z - a.z) / L }; };
  for (let i = 0; i < n; i++) {
    const d = dir(i), e = i === 0 ? -ext : i === n - 1 ? ext : 0;
    const p = { x: points[i].x + d.x * e, z: points[i].z + d.z * e };
    left.push({ x: +(p.x - d.z * half).toFixed(3), z: +(p.z + d.x * half).toFixed(3) });
    right.push({ x: +(p.x + d.z * half).toFixed(3), z: +(p.z - d.x * half).toFixed(3) });
  }
  return [...left, ...right.reverse()];
}
