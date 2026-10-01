import * as THREE from 'three';
import type { Vec2 } from '../../core/types';
import type { BatchLike, ColorLike, Info } from '../builder';
import { GLOW, LIT, NONE, WIN, arch, box, cbox, cyl, disc, pyramid, rect, worldPoly } from './landmarks/kit';

/**
 * Wave 8 · lane W1 · Chinatown's pagoda cluster (W8-W1, sf-w8-lead.md §3 row W1 (1)): the buildings that make Grant
 * Avenue read as Chinatown, drawn by the Dragon Gate's own site (landmarks/dragon-gate.ts: its lod-0 TOY mesh and its
 * lod-2 far silhouette — no new mesh, no new draw call) in the gate's LOCAL frame:
 *
 *   Sing Chong    601 Grant Ave, the north-west corner of Grant & California (1907–08, Ross & Burgren for Look Tin Eli):
 *                 buff brick, three storeys, a corner tower of green-tiled pagoda roofs with red eaves, a red awning
 *   Sing Fat      573 Grant Ave, the south-west corner (1908, the same architects for Tong Bong): tan brick, four storeys,
 *                 green piers, the big corner tower of three yellow pagoda roofs with green railings and a spire
 *   Old St. Mary's 660 California St, the north-east corner (1854, red brick, Gothic Revival): the nave along Grant Ave,
 *                 the square clock tower on the south front (California St), the clock, a blank panel where the
 *                 inscription is (no text), corner pinnacles and a cross; the parish buildings east of it
 *   the Chinese Telephone Exchange  743 Washington St (1909; the Bank of Canton, now East West Bank): three tiers of
 *                 green-tiled roofs with red walls and red columns, facing Washington St east of Grant Ave
 *   and the plain walk-ups that shared their merged city boxes (615 Grant, 505–545 Grant), so no lot stands empty.
 *
 * The city's own boxes on those lots are dropped (`CT_EXCLUDES`, the gate's `excludeMore`: world/sf/sites.ts sends them
 * to the stream workers, the far city and the walk rasters with the sites' own exclusions); the gate's walk blockers
 * take `CT_BLOCKERS` (one per building, its top measured into landmarks/tops.ts). Positions are the published city's
 * lots (its footprints squared to Grant Ave: the street fronts at across ±1.8, California St's at along 24.1 / 28.5,
 * Washington St's at along 66.65), so the corner's lantern wires and blade signs keep their walls.
 *
 * Ground: `CT_GROUND` bakes, per building, the lowest city ground under its footprint (`lo`: the walls start
 * WALL_SINK below it) and the ground at its street reference point (`ref`: the storeys count from there), WORLD y,
 * measured with the published walked ground (tests/opus-bay-w8-w1-chinatown.test.ts re-measures them). The gate's
 * site is mounted at its setting's base (landmarks/settingData.ts 'dragon-gate'), passed in as `base`.
 *
 * Sources (checked 2026-09-30): the corners and the architects — https://en.wikipedia.org/wiki/Look_Tin_Eli ,
 * commons.wikimedia.org "SING FAT CO … S.W. CORNER CALIFORNIA ST. AND GRANT AVE." (postcard), the colours from
 * Wikimedia Commons photos (File:Sing_Chong_Building.jpg, File:601_Grant_Avenue_at_California_Street.jpg,
 * File:Telephone_Exchange_(5402029672).jpg; reference only, not shipped); Old St. Mary's (1854, red brick and granite,
 * Gothic Revival, ≈ 27 m, the façade faces south, the clock and its inscription) —
 * https://en.wikipedia.org/wiki/Old_St._Mary%27s_Cathedral ; the exchange (1909, a three-tiered pagoda, 743 Washington
 * St) — https://www.kqed.org/arts/13960573/chinese-telephone-exchange-san-francisco-chinatown-history ,
 * https://hoodline.com/2016/04/plugged-in-the-fascinating-history-of-the-chinese-telephone-exchange/ ; footprints and
 * heights: OpenStreetMap ways 260519113 (h 16), 260208816 (4 levels), 260520154 (Old Saint Mary's, h 19), 251790077
 * (East West Bank) in the raw snapshot of 2026-09-26.
 */

/** the Dragon Gate's frame (landmarks/dragon-gate.ts X0, Z0, YAW: the test pins them) */
export const CT_GATE = { x: 82.366, z: 175.035, yaw: (52.4 * Math.PI) / 180 } as const;
/** Grant Ave's axis turns this far west of the gate's (dragon-gate.ts GA_T) */
const T = Math.atan(0.0478), ST = Math.sin(T), CT = Math.cos(T);
const SINK = 1.2;

/** Grant Ave's frame in the gate's LOCAL frame (dragon-gate.ts grant): `along` u north, `across` u east of the street's middle. */
export function ctPoint(along: number, across: number): Vec2 {
  return { x: -0.07 - along * ST + across * CT, z: -2 - along * CT - across * ST };
}
/** local yaw of a face looking east / west / north / south (three.js: +z of the face → (sin ry, cos ry)) */
const FACE = { e: Math.PI / 2 + T, w: -Math.PI / 2 + T, n: Math.PI + T, s: T } as const;

/** one building: its footprint in Grant Ave's frame (across a0…a1, along l0…l1) and the street point its storeys count from */
export interface CtLot { a0: number; a1: number; l0: number; l1: number; ref: readonly [number, number] }

export const CT_LOTS = {
  'sing-chong': { a0: -4.28, a1: -1.84, l0: 28.54, l1: 30.55, ref: [-1.84, 28.54] },
  'grant-615': { a0: -4.01, a1: -1.84, l0: 30.55, l1: 33.14, ref: [-1.84, 31.85] },
  'sing-fat': { a0: -5.38, a1: -1.84, l0: 21.75, l1: 24.1, ref: [-1.84, 24.1] },
  'grant-505': { a0: -5.87, a1: -1.84, l0: 18.67, l1: 21.75, ref: [-1.84, 20.2] },
  'st-marys-tower': { a0: 2.75, a1: 3.85, l0: 28.62, l1: 29.72, ref: [3.3, 28.62] },
  'st-marys': { a0: 1.8, a1: 4.8, l0: 29.15, l1: 35.06, ref: [3.3, 28.62] },
  'cal-660': { a0: 4.82, a1: 6.79, l0: 28.53, l1: 30.66, ref: [5.8, 28.53] },
  'st-marys-hall': { a0: 4.82, a1: 6.79, l0: 30.66, l1: 35.06, ref: [6.79, 32.9] },
  exchange: { a0: 1.84, a1: 3.17, l0: 64.15, l1: 66.62, ref: [2.5, 66.62] },
} as const satisfies Record<string, CtLot>;
export type CtLotId = keyof typeof CT_LOTS;

/**
 * Baked WORLD ground per building (tests/opus-bay-w8-w1-chinatown.test.ts re-measures: `lo` the lowest walked ground
 * under the footprint, sampled every 0.25 u; `ref` the ground at the lot's `ref` point).
 */
export const CT_GROUND: Readonly<Record<CtLotId, { lo: number; ref: number }>> = {
  'sing-chong': { lo: 6.04, ref: 6.53 },
  'grant-615': { lo: 5.72, ref: 5.88 },
  'sing-fat': { lo: 6.54, ref: 6.6 },
  'grant-505': { lo: 6.65, ref: 6.76 },
  'st-marys-tower': { lo: 5.49, ref: 5.73 },
  'st-marys': { lo: 4.15, ref: 5.73 },
  'cal-660': { lo: 4.49, ref: 5.37 },
  'st-marys-hall': { lo: 3.52, ref: 4.04 },
  exchange: { lo: 2.1, ref: 2.32 },
};

/**
 * The city lots the cluster replaces (WORLD polygons, the gate's `excludeMore`): the published city's merged boxes
 * whose centroids lie inside are dropped from the render, the far city and collision — 260519113 (Sing Chong + 615
 * Grant), 260208813 (Sing Fat + 505–545 Grant), 260520154 and 260520161 (Old St. Mary's and 660 California),
 * 256080511 (854 Grant with the exchange). Grant Ave frame rectangles (across a0…a1, along l0…l1).
 */
export const CT_EXCLUDE_LOTS: readonly (readonly [number, number, number, number])[] = [
  [-4.3, -1.82, 28.51, 33.17],
  [-5.89, -1.82, 18.64, 24.12],
  [1.77, 6.81, 28.5, 35.09],
  [1.81, 3.19, 64.12, 66.65],
];
/** a Grant Ave frame rectangle as a LOCAL polygon of the gate */
function lotPoly(a0: number, a1: number, l0: number, l1: number): Vec2[] {
  const c = ctPoint((l0 + l1) / 2, (a0 + a1) / 2);
  return rect(c.x, c.z, a1 - a0, l1 - l0, T);
}
export const CT_EXCLUDES: Vec2[][] = CT_EXCLUDE_LOTS.map(([a0, a1, l0, l1]) => worldPoly(CT_GATE.x, CT_GATE.z, CT_GATE.yaw, lotPoly(a0, a1, l0, l1)));

/** the walk blockers (LOCAL, one per building, in CT_LOTS order) */
export const CT_BLOCKERS: { poly: Vec2[] }[] = Object.values(CT_LOTS).map(l => ({ poly: lotPoly(l.a0, l.a1, l.l0, l.l1) }));

// ---------------------------------------------------------------------------
// colours (sRGB; the toy palette's family)
// ---------------------------------------------------------------------------

const C = {
  buff: '#e3cd9a', tan: '#d8b88a', cream: '#efe6d4', stone: '#ece0c8', pastel: '#e7d9bd',
  green: '#3f8a62', greenDark: '#2f6e4d', red: '#c2412f', redDeep: '#a8352a', gold: '#e0b04e', yellow: '#e8c447',
  brick: '#a5553d', brickDark: '#8a4633', brickWarm: '#b8654c', slate: '#80878b', clock: '#f4efe2', ink: '#2b2a28',
  glass: '#3a4048', door: '#5a3a2a', roofTop: '#b9b2a6', teal: '#3b9a7b', tealDark: '#2c7a60', exRed: '#c8392b',
} as const;

// ---------------------------------------------------------------------------
// pieces (Grant Ave frame → the gate's LOCAL frame)
// ---------------------------------------------------------------------------

/** a box over a Grant Ave frame rectangle from y0 to y1 (LOCAL y) */
function lotBox(b: BatchLike, a0: number, a1: number, l0: number, l1: number, y0: number, y1: number, color: ColorLike, info: Info = NONE) {
  const c = ctPoint((l0 + l1) / 2, (a0 + a1) / 2);
  box(b, c.x, y0, c.z, a1 - a0, y1 - y0, l1 - l0, color, info, T);
}

/** hip roof over a w (across) × d (along) rectangle centred at the local point p, eaves at y0, rising h */
function hip(b: BatchLike, p: Vec2, y0: number, w: number, d: number, h: number, color: ColorLike) {
  const c = Math.cos(T), s = Math.sin(T);
  const P = (u: number, yy: number, v: number) => new THREE.Vector3(p.x + u * c + v * s, yy, p.z - u * s + v * c);
  const N = (ou: number, ov: number, run: number) => new THREE.Vector3((ou * c + ov * s) * h, run, (-ou * s + ov * c) * h).normalize();
  const hw = w / 2, hd = d / 2;
  if (w >= d) {
    const r = hw - hd, R0 = P(-r, y0 + h, 0), R1 = P(r, y0 + h, 0);
    b.quad(P(-hw, y0, hd), P(hw, y0, hd), R1, R0, N(0, 1, hd), color, NONE);
    b.quad(P(hw, y0, -hd), P(-hw, y0, -hd), R0, R1, N(0, -1, hd), color, NONE);
    b.tri(P(-hw, y0, -hd), P(-hw, y0, hd), R0, color, NONE, N(-1, 0, hd));
    b.tri(P(hw, y0, hd), P(hw, y0, -hd), R1, color, NONE, N(1, 0, hd));
  } else {
    const r = hd - hw, R0 = P(0, y0 + h, -r), R1 = P(0, y0 + h, r);
    b.quad(P(hw, y0, -hd), P(hw, y0, hd), R1, R0, N(1, 0, hw), color, NONE);
    b.quad(P(-hw, y0, hd), P(-hw, y0, -hd), R0, R1, N(-1, 0, hw), color, NONE);
    b.tri(P(-hw, y0, -hd), P(hw, y0, -hd), R0, color, NONE, N(0, -1, hw));
    b.tri(P(hw, y0, hd), P(-hw, y0, hd), R1, color, NONE, N(0, 1, hw));
  }
}

/**
 * One pagoda tier's roof over a w (across) × d (along) rectangle centred at Grant (along l, across a), eaves at y:
 * the tiled hip, a fascia slab in the trim colour under it and four upturned corner tips. 32 triangles.
 */
function tierRoof(b: BatchLike, l: number, a: number, y: number, w: number, d: number, rise: number, tile: ColorLike, trim: ColorLike) {
  const p = ctPoint(l, a);
  box(b, p.x, y - 0.1, p.z, w - 0.06, 0.12, d - 0.06, trim, NONE, T);
  hip(b, p, y, w, d, rise, tile);
  // the tips point out along the corner's diagonal and curl up (+x of the turned box is the outer end)
  for (const su of [-1, 1]) for (const sv of [-1, 1]) {
    const dx = su * CT - sv * ST, dz = -su * ST - sv * CT, n = Math.hypot(dx, dz), ux = dx / n, uz = dz / n;
    const q = ctPoint(l + sv * d / 2, a + su * w / 2);
    cbox(b, q.x + ux * 0.07, y + 0.06, q.z + uz * 0.07, 0.22, 0.06, 0.09, trim, NONE, Math.atan2(-uz, ux), 0, 0.7);
  }
}

/** a run of tiled pagoda eave along a street front: from (l0, a0) to (l1, a1) at y, `out` = the outward yaw */
function eave(b: BatchLike, l0: number, a0: number, l1: number, a1: number, y: number, out: number, tile: ColorLike, trim: ColorLike) {
  const m = ctPoint((l0 + l1) / 2, (a0 + a1) / 2), len = Math.hypot(l1 - l0, a1 - a0);
  const fx = Math.sin(out), fz = Math.cos(out), dz = 0.42, tilt = 0.42;
  // the sloping tiles (a thin plate tilted out and down from the wall), the red fascia under its edge
  cbox(b, m.x + fx * dz * 0.5, y, m.z + fz * dz * 0.5, len + 0.5, 0.07, dz + 0.1, tile, NONE, out, tilt);
  cbox(b, m.x + fx * dz, y - 0.2, m.z + fz * dz, len + 0.5, 0.1, 0.05, trim, NONE, out);
}

/** a flat street awning on a front (cornerKit.awning's shape): its middle (l, a), width w, facing yaw `out`, at y */
function awn(b: BatchLike, l: number, a: number, w: number, out: number, y: number, color: ColorLike) {
  const p = ctPoint(l, a), fx = Math.sin(out), fz = Math.cos(out), d = 0.42, tilt = 0.3, dz = Math.cos(tilt) * d, dy = Math.sin(tilt) * d;
  cbox(b, p.x + (fx * dz) / 2, y - dy / 2, p.z + (fz * dz) / 2, w, 0.06, d, color, NONE, out, tilt);
  cbox(b, p.x + fx * (dz + 0.01), y - dy - 0.1, p.z + fz * (dz + 0.01), w, 0.2, 0.03, color, NONE, out);
}

/** a lit shop window band on a front: middle (l, a), width w, facing `out`, from y to y + h */
function shopBand(b: BatchLike, l: number, a: number, w: number, out: number, y: number, h: number, base: number) {
  const p = ctPoint(l, a), fx = Math.sin(out), fz = Math.cos(out);
  cbox(b, p.x + fx * 0.02, y + h / 2, p.z + fz * 0.02, w, h, 0.04, C.glass, LIT(base), out);
}

const lotC = (id: CtLotId) => { const l = CT_LOTS[id]; return { ...l, lm: (l.l0 + l.l1) / 2, am: (l.a0 + l.a1) / 2 }; };

/** a Chinatown walk-up: the box with the city's painted façade (TOY window style 10, seeded), a coloured parapet */
function walkUp(b: BatchLike, id: CtLotId, Y: (w: number) => number, H: number, wall: ColorLike, parapet: ColorLike, seed: number) {
  const l = lotC(id), g = CT_GROUND[id], ref = Y(g.ref), top = ref + H;
  lotBox(b, l.a0, l.a1, l.l0, l.l1, Y(g.lo) - SINK, top, wall, WIN(10, ref, seed));
  // the coloured parapet (the city's Chinatown façade: a band of the accent colour round the top, walls only)
  b.walls(lotPoly(l.a0 - 0.04, l.a1 + 0.04, l.l0 - 0.04, l.l1 + 0.04), top - 0.3, top + 0.2, parapet);
  lotBox(b, l.a0, l.a1, l.l0, l.l1, top - 0.05, top + 0.02, C.roofTop);
  return { ref, top };
}

// ---------------------------------------------------------------------------
// the buildings
// ---------------------------------------------------------------------------

/** Sing Chong: the NW corner, its tower on the Grant / California corner (green tiles, red eaves, a gold band). */
function singChong(b: BatchLike, Y: (w: number) => number) {
  const l = lotC('sing-chong'), g = CT_GROUND['sing-chong'], ref = Y(g.ref), H = 5.0, top = ref + H;
  lotBox(b, l.a0, l.a1, l.l0, l.l1, Y(g.lo) - SINK, top, C.buff, WIN(10, ref, 0.37));
  // the pagoda eave along both street fronts (California St to the south, Grant Ave to the east)
  eave(b, l.l0, l.a0 + 0.1, l.l0, l.a1 - 1.2, top - 0.05, FACE.s, C.green, C.red);
  eave(b, l.l0 + 1.25, l.a1, l.l1, l.a1, top - 0.05, FACE.e, C.green, C.red);
  lotBox(b, l.a0, l.a1, l.l0, l.l1, top - 0.05, top + 0.12, C.roofTop);
  // shop windows and the long red awning on California St, a second on Grant Ave
  shopBand(b, l.l0, l.am, l.a1 - l.a0 - 0.5, FACE.s, ref + 0.05, 1.0, ref);
  awn(b, l.l0, l.am - 0.2, 1.9, FACE.s, ref + 1.35, C.red);
  shopBand(b, l.lm + 0.4, l.a1, 1.0, FACE.e, ref - 0.1, 1.0, ref);
  awn(b, l.lm + 0.45, l.a1, 1.0, FACE.e, ref + 1.3, C.red);
  // the corner tower: a square stage over the roof, two green pagoda roofs, the top cap and a gold finial
  const tl = l.l0 + 0.62, ta = l.a1 - 0.62;
  const t0 = ctPoint(tl, ta);
  box(b, t0.x, top - 0.6, t0.z, 1.22, 1.45, 1.22, C.buff, NONE, T);
  box(b, t0.x, top + 0.62, t0.z, 1.26, 0.16, 1.26, C.gold, NONE, T);
  tierRoof(b, tl, ta, top + 0.85, 2.0, 2.0, 0.42, C.green, C.red);
  box(b, t0.x, top + 1.0, t0.z, 0.86, 0.72, 0.86, C.red, NONE, T);
  box(b, t0.x, top + 1.32, t0.z, 0.9, 0.12, 0.9, C.gold, NONE, T);
  tierRoof(b, tl, ta, top + 1.72, 1.5, 1.5, 0.36, C.green, C.red);
  box(b, t0.x, top + 1.86, t0.z, 0.52, 0.42, 0.52, C.red, NONE, T);
  tierRoof(b, tl, ta, top + 2.28, 0.95, 0.95, 0.42, C.green, C.red);
  cyl(b, t0.x, top + 2.66, t0.z, 0.06, 0.4, C.gold, GLOW(0.3), 6);
}

/** Sing Fat: the SW corner, four storeys of tan brick with green piers, the big three-tier yellow tower and a spire. */
function singFat(b: BatchLike, Y: (w: number) => number) {
  const l = lotC('sing-fat'), g = CT_GROUND['sing-fat'], ref = Y(g.ref), H = 5.4, top = ref + H;
  lotBox(b, l.a0, l.a1, l.l0, l.l1, Y(g.lo) - SINK, top, C.tan, WIN(10, ref, 0.71));
  // green piers on both fronts and a green-and-cream cornice
  for (const a of [-1.98, -2.9, -3.9, -4.9]) { const p = ctPoint(l.l1 + 0.02, a); box(b, p.x, ref + 1.2, p.z, 0.16, H - 1.25, 0.06, C.green, NONE, T); }
  for (const al of [23.95, 23.0, 22.0]) { const p = ctPoint(al, l.a1 + 0.02); box(b, p.x, ref + 1.2, p.z, 0.06, H - 1.25, 0.16, C.green, NONE, T); }
  lotBox(b, l.a0 - 0.04, l.a1 + 0.04, l.l0 - 0.04, l.l1 + 0.04, top - 0.32, top - 0.12, C.green);
  lotBox(b, l.a0 - 0.02, l.a1 + 0.02, l.l0 - 0.02, l.l1 + 0.02, top - 0.12, top + 0.1, C.cream);
  // shop windows, a red awning on the corner
  shopBand(b, l.l1, l.am, l.a1 - l.a0 - 0.4, FACE.n, ref - 0.3, 1.25, ref);
  shopBand(b, l.lm, l.a1, l.l1 - l.l0 - 0.3, FACE.e, ref - 0.05, 1.05, ref);
  awn(b, l.l1, l.a1 - 0.85, 1.4, FACE.n, ref + 1.3, C.red);
  // the tower: three stacked yellow pagoda roofs (green railings on the stages), a lantern and a gold spire
  const tl = l.l1 - 0.78, ta = l.a1 - 0.78, t0 = ctPoint(tl, ta);
  box(b, t0.x, top - 0.6, t0.z, 1.5, 1.0, 1.5, C.tan, NONE, T);
  tierRoof(b, tl, ta, top + 0.42, 2.3, 2.3, 0.4, C.yellow, C.green);
  box(b, t0.x, top + 0.55, t0.z, 1.12, 0.62, 1.12, C.cream, WIN(1, top + 0.4), T);
  box(b, t0.x, top + 0.6, t0.z, 1.24, 0.12, 1.24, C.greenDark, NONE, T);
  tierRoof(b, tl, ta, top + 1.2, 1.85, 1.85, 0.36, C.yellow, C.green);
  box(b, t0.x, top + 1.32, t0.z, 0.82, 0.55, 0.82, C.cream, NONE, T);
  box(b, t0.x, top + 1.36, t0.z, 0.92, 0.1, 0.92, C.greenDark, NONE, T);
  tierRoof(b, tl, ta, top + 1.9, 1.4, 1.4, 0.34, C.yellow, C.green);
  box(b, t0.x, top + 2.0, t0.z, 0.5, 0.45, 0.5, C.cream, NONE, T);
  tierRoof(b, tl, ta, top + 2.45, 0.85, 0.85, 0.42, C.yellow, C.green);
  cyl(b, t0.x, top + 2.82, t0.z, 0.07, 0.62, C.gold, GLOW(0.3), 6, 0.2);
}

/** Old St. Mary's: the red-brick nave along Grant Ave, the clock tower on California St, the parish buildings east. */
function stMarys(b: BatchLike, Y: (w: number) => number) {
  const n = lotC('st-marys'), g = CT_GROUND['st-marys'], ref = Y(g.ref), lo = Y(g.lo) - SINK;
  const eaveY = ref + 4.3, rise = 1.55;
  // the nave and its slate gable roof (ridge along Grant Ave, the gable end to California St)
  lotBox(b, n.a0, n.a1, n.l0, n.l1, lo, eaveY, C.brick);
  const c = ctPoint(n.lm, n.am), w = n.l1 - n.l0, d = n.a1 - n.a0;
  {
    const ry = T + Math.PI / 2, cs = Math.cos(ry), sn = Math.sin(ry);
    const P = (u: number, yy: number, v: number) => new THREE.Vector3(c.x + u * cs + v * sn, yy, c.z - u * sn + v * cs);
    const hu = w / 2 + 0.12, hv = d / 2 + 0.15;
    for (const sd of [-1, 1]) {
      const nn = new THREE.Vector3(sn * sd * rise, d / 2, cs * sd * rise).normalize();
      b.quad(P(-hu, eaveY - 0.1, sd * hv), P(hu, eaveY - 0.1, sd * hv), P(hu, eaveY + rise, 0), P(-hu, eaveY + rise, 0), nn, C.slate, NONE);
    }
    for (const su of [-1, 1]) b.tri(P(su * w / 2, eaveY, -d / 2), P(su * w / 2, eaveY, d / 2), P(su * w / 2, eaveY + rise, 0), C.brick, NONE, new THREE.Vector3(cs * su, 0, -sn * su));
  }
  // buttresses and tall pointed windows along Grant Ave (lit at night), a side door
  for (let k = 0; k < 5; k++) {
    const al = n.l0 + 0.55 + k * 1.2, p = ctPoint(al, n.a0 - 0.02);
    box(b, p.x, lo, p.z, 0.14, eaveY - lo - 0.3, 0.2, C.brickDark, NONE, T);
    if (k < 4) { const q = ctPoint(al + 0.6, n.a0 - 0.01); arch(b, q.x, ref + 1.4, q.z, 0.42, 2.2, FACE.w, '#3c3550', LIT(ref)); }
  }
  // the tower: red brick, a stone band, clocks on the south and west faces, the blank panel under the south clock
  // (no lettering), paired belfry openings, a parapet with four pinnacles and the cross
  const t = lotC('st-marys-tower'), tc = ctPoint(t.lm, t.am), tTop = ref + 6.05, tw = t.a1 - t.a0;
  lotBox(b, t.a0, t.a1, t.l0, t.l1, Y(CT_GROUND['st-marys-tower'].lo) - SINK, tTop, C.brick);
  lotBox(b, t.a0 - 0.04, t.a1 + 0.04, t.l0 - 0.04, t.l1 + 0.04, ref + 4.55, ref + 4.7, C.stone);
  lotBox(b, t.a0 - 0.05, t.a1 + 0.05, t.l0 - 0.05, t.l1 + 0.05, tTop - 0.12, tTop + 0.08, C.stone);
  const south = ctPoint(t.l0 - 0.03, t.am), west = ctPoint(t.lm, t.a0 - 0.03);
  for (const [p, ry] of [[south, FACE.s], [west, FACE.w]] as const) {
    disc(b, p.x, ref + 5.25, p.z, 0.36, 0.05, ry, C.clock, GLOW(0.7), 14);
    const fx = Math.sin(ry), fz = Math.cos(ry);
    cbox(b, p.x + fx * 0.03, ref + 5.33, p.z + fz * 0.03, 0.04, 0.2, 0.02, C.ink, NONE, ry);
    cbox(b, p.x + fx * 0.03 + Math.cos(ry) * 0.06, ref + 5.25, p.z + fz * 0.03 - Math.sin(ry) * 0.06, 0.15, 0.035, 0.02, C.ink, NONE, ry);
    for (const s of [-0.2, 0.2]) arch(b, p.x + Math.cos(ry) * s + fx * 0.01, ref + 5.68, p.z - Math.sin(ry) * s + fz * 0.01, 0.2, 0.32, ry, C.ink, NONE, 4);
  }
  cbox(b, south.x, ref + 4.25, south.z, 0.62, 0.32, 0.04, '#d9cdb5', NONE, FACE.s);
  arch(b, south.x, ref - 0.05, south.z, 0.62, 1.55, FACE.s, C.door, LIT(ref));
  arch(b, south.x, ref + 2.0, south.z, 0.36, 1.2, FACE.s, '#3c3550', LIT(ref));
  for (const su of [-1, 1]) for (const sv of [-1, 1]) {
    const p = ctPoint(t.lm + sv * (tw / 2 - 0.07), t.am + su * (tw / 2 - 0.07));
    box(b, p.x, tTop, p.z, 0.16, 0.42, 0.16, C.brick, NONE, T);
    pyramid(b, p.x, tTop + 0.42, p.z, 0.2, 0.2, 0.55, C.stone, T);
  }
  box(b, tc.x, tTop, tc.z, 0.08, 1.25, 0.08, C.ink, NONE, T);
  { const q = ctPoint(t.lm, t.am); cbox(b, q.x, tTop + 1.0, q.z, 0.42, 0.07, 0.07, C.ink, NONE, T); }
  // the gable end's stone coping either side of the tower, the side aisle doors on California St
  for (const s of [-1, 1]) { const q = ctPoint(n.l0 - 0.01, t.am + s * 1.05); arch(b, q.x, ref - 0.15, q.z, 0.34, 1.0, FACE.s, C.door, LIT(ref)); }
  // the parish buildings east of the church: 660 California (a brick walk-up on the corner) and the hall
  walkUp(b, 'cal-660', Y, 5.2, C.brickWarm, C.brickDark, 0.53);
  const hl = lotC('st-marys-hall'), hg = CT_GROUND['st-marys-hall'];
  lotBox(b, hl.a0, hl.a1, hl.l0, hl.l1, Y(hg.lo) - SINK, Y(CT_GROUND['cal-660'].ref) + 4.2, C.brick, WIN(1, Y(hg.ref)));
}

/** The Chinese Telephone Exchange: three tiers of green-tiled roofs over red walls, red columns on Washington St. */
function exchange(b: BatchLike, Y: (w: number) => number) {
  const l = lotC('exchange'), g = CT_GROUND.exchange, ref = Y(g.ref), lo = Y(g.lo) - SINK;
  const w = l.a1 - l.a0, d = l.l1 - l.l0;
  // the ground floor: shop glass behind four red columns and a red lintel, the first roof over it
  lotBox(b, l.a0, l.a1, l.l0, l.l1 - 0.2, lo, ref + 1.55, C.cream);
  shopBand(b, l.l1 - 0.2, l.am, w - 0.2, FACE.n, ref + 0.02, 1.1, ref);
  for (let k = 0; k < 4; k++) { const p = ctPoint(l.l1 - 0.1, l.a0 + 0.1 + (k * (w - 0.2)) / 3); cyl(b, p.x, ref - 0.1, p.z, 0.055, 1.62, C.red, NONE, 6); }
  { const p = ctPoint(l.l1 - 0.1, l.am); cbox(b, p.x, ref + 1.42, p.z, w, 0.2, 0.12, C.red, NONE, T); }
  tierRoof(b, l.lm + 0.05, l.am, ref + 1.68, w + 0.5, d + 0.35, 0.32, C.teal, C.red);
  // the second floor: red walls, a band of windows, a green balcony rail on the front, the second roof
  lotBox(b, l.a0 + 0.1, l.a1 - 0.1, l.l0 + 0.1, l.l1 - 0.35, ref + 1.7, ref + 2.85, C.exRed);
  { const p = ctPoint(l.l1 - 0.33, l.am); cbox(b, p.x, ref + 2.45, p.z, w - 0.4, 0.42, 0.03, '#f1ece0', LIT(ref + 1.7), T); }
  { const p = ctPoint(l.l1 - 0.2, l.am); cbox(b, p.x, ref + 2.05, p.z, w - 0.1, 0.08, 0.05, C.tealDark, NONE, T); }
  tierRoof(b, l.lm, l.am, ref + 2.95, w + 0.3, d + 0.05, 0.3, C.teal, C.red);
  // the third floor and the top roof with a small red ridge lantern
  lotBox(b, l.a0 + 0.2, l.a1 - 0.2, l.l0 + 0.25, l.l1 - 0.5, ref + 2.95, ref + 3.95, C.exRed);
  { const p = ctPoint(l.l1 - 0.48, l.am); cbox(b, p.x, ref + 3.5, p.z, w - 0.6, 0.38, 0.03, '#f1ece0', LIT(ref + 2.95), T); }
  tierRoof(b, l.lm - 0.12, l.am, ref + 4.05, w + 0.15, d - 0.2, 0.42, C.teal, C.red);
  const top = ctPoint(l.lm - 0.12, l.am);
  box(b, top.x, ref + 4.38, top.z, 0.22, 0.24, 0.22, C.red, GLOW(0.4), T);
}

/**
 * The whole cluster in the gate's LOCAL frame (lod 0), the gate mounted at `base` (WORLD y). ≈ 2.6k triangles.
 * lod 2: one box per lot at its roof line and the towers as caps (≈ 100 triangles), for the far pool.
 */
export function chinatownCluster(b: BatchLike, lod: 0 | 2, base: number) {
  const Y = (w: number) => w - base;
  if (lod === 2) {
    const far = (id: CtLotId, H: number, color: ColorLike) => { const l = CT_LOTS[id], g = CT_GROUND[id]; lotBox(b, l.a0, l.a1, l.l0, l.l1, Y(g.lo) - SINK, Y(g.ref) + H, color); };
    far('sing-chong', 5.0, C.buff); far('grant-615', 5.3, C.cream); far('sing-fat', 5.4, C.tan); far('grant-505', 4.2, C.stone);
    far('st-marys', 4.9, C.brick); far('st-marys-tower', 6.05, C.brick); far('cal-660', 5.2, C.brickWarm); far('st-marys-hall', 4.6, C.brick);
    far('exchange', 4.0, C.exRed);
    const sc = lotC('sing-chong'), sf = lotC('sing-fat');
    { const p = ctPoint(sc.l0 + 0.62, sc.a1 - 0.62); pyramid(b, p.x, Y(CT_GROUND['sing-chong'].ref) + 5.0, p.z, 1.6, 1.6, 2.7, C.green, T); }
    { const p = ctPoint(sf.l1 - 0.78, sf.a1 - 0.78); pyramid(b, p.x, Y(CT_GROUND['sing-fat'].ref) + 5.4, p.z, 2.0, 2.0, 3.4, C.yellow, T); }
    return;
  }
  singChong(b, Y);
  walkUp(b, 'grant-615', Y, 5.3, C.cream, C.green, 0.19);
  awn(b, CT_LOTS['grant-615'].l0 + 1.8, CT_LOTS['grant-615'].a1, 1.1, FACE.e, Y(CT_GROUND['grant-615'].ref) + 1.3, C.green);
  singFat(b, Y);
  walkUp(b, 'grant-505', Y, 4.2, C.stone, C.red, 0.83);
  awn(b, 20.2, CT_LOTS['grant-505'].a1, 1.3, FACE.e, Y(CT_GROUND['grant-505'].ref) + 1.25, C.gold);
  stMarys(b, Y);
  exchange(b, Y);
}
