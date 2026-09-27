import type { Vec2 } from '../../../core/types';
import type { BatchLike } from '../../builder';
import { GLOW, NONE, arch, band, box, cyl, lathe, ngon, rot, worldPoly } from './kit';
import type { LandmarkSwap, SfLandmark, WalkBlocker } from './index';

/**
 * Palace of Fine Arts (T1): the 1915 rotunda on its lagoon, the two curved peristyle wings with their flower-box
 * "weeping maidens" and the long curved exhibition hall behind. Local frame: origin at the rotunda (OSM dome part,
 * way 456820271), yaw 135° so +z looks across the lagoon (relation 7471537). Wings / hall centrelines come from the
 * OSM "roof" ways 288371306 / 288371310 and the hall parts 1550664399 / 1550664400 (opus-qa/landmarks/_tools).
 * Height: rotunda 49 m → H = 3.2 + 0.155·49 = 10.8 u; colonnades 20 m and hall 17 m at the same 0.22 u/m.
 */

const X0 = -420.32, Z0 = 422.43, YAW = (135 * Math.PI) / 180;
const STONE = '#e6c9a2', STONE_LIGHT = '#f0dcbc', STONE_SHADE = '#c9a57e', DOME = '#d49467', HALL = '#d9c2a0', HALL_ROOF = '#b99b7c';
/** colonnade centrelines from the rotunda outward (local), last point = end pavilion */
const WING_L: Vec2[] = [{ x: -4.4, z: -3.5 }, { x: -7.4, z: -1.6 }, { x: -9.4, z: 0.9 }, { x: -10.1, z: 3.3 }, { x: -10.0, z: 6.2 }, { x: -14.0, z: 6.7 }];
const WING_R: Vec2[] = [{ x: 3.0, z: -4.7 }, { x: 6.2, z: -4.3 }, { x: 9.6, z: -2.4 }, { x: 10.9, z: 0.0 }, { x: 11.4, z: 1.9 }, { x: 15.3, z: 1.6 }];
/** exhibition hall centreline + width */
const HALL_PTS: Vec2[] = [{ x: -15.7, z: 0.9 }, { x: -13.5, z: -3.1 }, { x: -10.2, z: -6.4 }, { x: -6.1, z: -8.9 }, { x: -1.3, z: -10.3 }, { x: 2.9, z: -10.4 }, { x: 7.4, z: -9.6 }, { x: 11.3, z: -7.8 }, { x: 15.3, z: -4.7 }];
const HALL_W = 5.4, HALL_H = 4.2;
/** lagoon outline (OSM, simplified) */
const LAGOON: Vec2[] = [[15.58, 5.81], [18.48, 4.63], [19.07, 7.98], [17.2, 10.91], [13.77, 12.88], [10.8, 12.37], [7.9, 14.3], [2.11, 15.09], [0.18, 13.48], [-4.18, 16.51], [-6.19, 15.61], [-8.4, 16.5], [-12.35, 13.52], [-14.19, 14.3], [-14.48, 11.14], [-12.41, 8.1], [-8.42, 6.52], [-8.8, 2.55], [-6.19, -0.9], [-4.79, 0.08], [-4.05, 4.96], [1.12, 6.58], [5.86, 2.71], [4.66, -1.65], [6.32, -2.88], [9.58, -0.75], [11.12, 4.22], [14.57, 2.99], [15.18, 3.87], [13.66, 5.23]].map(([x, z]) => ({ x, z }));

const COL_H = 3.6, ENT = 0.55;

function colonnade(b: BatchLike, pts: Vec2[], lod: 0 | 2) {
  const n = pts.length;
  for (let i = 0; i < n - 1; i++) {
    const a = pts[i], c = pts[i + 1];
    const dx = c.x - a.x, dz = c.z - a.z, L = Math.hypot(dx, dz), ry = Math.atan2(dx, dz);
    const mx = (a.x + c.x) / 2, mz = (a.z + c.z) / 2;
    const last = i === n - 2;
    if (last) {
      // end pavilion: a solid block with a niche
      box(b, c.x, 0, c.z, 1.6, COL_H + ENT + 0.6, 1.6, STONE, GLOW(0.06), ry);
      if (lod === 0) box(b, c.x, COL_H + ENT + 0.6, c.z, 1.1, 0.5, 1.1, STONE_LIGHT, NONE, ry);
    }
    if (lod === 2) { box(b, mx, 0, mz, 1.2, COL_H + ENT, L + 0.4, STONE_SHADE, NONE, ry); continue; }
    // plinth + entablature
    box(b, mx, -0.6, mz, 1.5, 0.9, L + 0.5, STONE_SHADE, NONE, ry);
    box(b, mx, COL_H + 0.3, mz, 1.5, ENT, L + 0.5, STONE_LIGHT, GLOW(0.06), ry);
    // double row of columns
    const k = Math.max(2, Math.round(L / 0.95));
    const ux = dx / L, uz = dz / L, px = uz, pz = -ux;
    for (let j = 0; j <= k; j++) {
      if (last && j === k) continue;
      const t = j / k, x = a.x + dx * t, z = a.z + dz * t;
      for (const s of [-0.45, 0.45]) cyl(b, x + px * s, 0.3, z + pz * s, 0.14, COL_H, STONE_LIGHT, NONE, 5);
      // flower-box planters on top of every second column pair
      if (j % 2 === 0) box(b, x, COL_H + 0.85, z, 1.0, 0.7, 0.7, STONE, NONE, ry);
    }
  }
}

/** lagoon (water + a stone rim) — replaces the city's water inside `exclude` */
function lagoon(b: BatchLike) {
  b.polygon(LAGOON, 0.04, '#6fb3ad', [0, 0, 0, 1.05]);
  b.walls(LAGOON, -0.4, 0.14, '#cdbb9d', NONE);
}

/** rotunda: platform, 8 clusters of 4 columns, arches, entablature, attic drum, dome, finial */
function rotunda(b: BatchLike, lod: 0 | 2) {
  const lit = GLOW(0.12);
  lathe(b, lod === 0 ? [[4.1, -1.2], [4.1, 0.2], [3.7, 0.2], [3.7, 0.45]] : [[4.1, -1.2], [4.1, 0.45]], 0, 0, 0, STONE_SHADE, NONE, lod === 0 ? 16 : 6);
  const R = 3.05;
  for (let k = 0; k < 8; k++) {
    const a = ((k + 0.5) / 8) * Math.PI * 2;
    const cx = Math.sin(a) * R, cz = Math.cos(a) * R;
    if (lod === 2) continue;
    for (const [ox, oz] of [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]]) {
      const o = rot({ x: ox, z: oz }, a);
      cyl(b, cx + o.x, 0.45, cz + o.z, 0.17, 3.85, STONE_LIGHT, lit, 6);
    }
    box(b, cx, 4.3, cz, 1.05, 0.35, 1.05, STONE, NONE, a);
    // attic sculpture block above each cluster
    box(b, cx * 1.02, 5.35, cz * 1.02, 0.8, 0.9, 0.8, STONE_SHADE, NONE, a);
  }
  if (lod === 0) for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    arch(b, Math.sin(a) * (R + 0.02), 0.45, Math.cos(a) * (R + 0.02), 1.7, 3.6, a, '#5f5a52', NONE);
  }
  if (lod === 2) lathe(b, [[3.2, 0.4], [3.2, 6.2], [2.9, 6.2], [2.3, 8.5], [0.3, 9.55]], 0, 0, 0, band([[6.1, STONE_LIGHT], [99, DOME]]), lit, 6);
  else {
    lathe(b, [[3.55, 0], [3.55, 0.7], [3.35, 0.75], [3.2, 1.9], [3.0, 1.9]], 0, 4.3, 0, band([[0.7, STONE_LIGHT], [99, STONE]]), lit, 16);
    lathe(b, [[3.0, 0], [2.95, 0.7], [2.7, 1.5], [2.2, 2.3], [1.4, 2.95], [0.5, 3.3], [0.25, 3.35]], 0, 6.2, 0, DOME, GLOW(0.08), 18);
  }
  if (lod === 0) {
    cyl(b, 0, 9.5, 0, 0.3, 0.6, STONE_LIGHT, NONE, 8);
    lathe(b, [[0.3, 0], [0.14, 0.5], [0.02, 1.2]], 0, 10.0, 0, STONE, NONE, 6);
  }
}

/** peristyle wings + the exhibition hall */
function wings(b: BatchLike, lod: 0 | 2) {
  colonnade(b, WING_L, lod);
  colonnade(b, WING_R, lod);
  for (let i = 0; i < HALL_PTS.length - 1; i++) {
    const a = HALL_PTS[i], c = HALL_PTS[i + 1];
    const dx = c.x - a.x, dz = c.z - a.z, L = Math.hypot(dx, dz), ry = Math.atan2(dx, dz);
    const mx = (a.x + c.x) / 2, mz = (a.z + c.z) / 2;
    box(b, mx, -1.2, mz, HALL_W, HALL_H + 1.2, L + 0.8, HALL, lod === 0 ? [3, 0, -4.2, 0] : NONE, ry);
    if (lod === 0) {
      // low-pitched roof in two planes + a cornice
      const c0 = Math.cos(ry), s0 = Math.sin(ry);
      for (const sd of [-1, 1]) {
        const off = (sd * HALL_W) / 4;
        box(b, mx + off * c0, HALL_H, mz - off * s0, HALL_W / 2 + 0.15, 0.4, L + 0.9, HALL_ROOF, NONE, ry);
      }
      box(b, mx, HALL_H + 0.4, mz, 0.6, 0.3, L + 0.9, HALL_ROOF, NONE, ry);
    }
  }
}

function build(b: BatchLike, lod: 0 | 2) {
  if (lod === 0) lagoon(b);
  rotunda(b, lod);
  wings(b, lod);
}

/**
 * AI rotunda (lane D2, D2-06): lane H's SAM mesh (12.66 u across, 8 piers, open underneath) squeezed to xz 0.65 so its
 * piers stand on the procedural platform ring (pier centres 5.69 → 3.70 u, bases 2.1 → 1.4 u, the walk-in arches
 * 2.45 → 1.6 u wide, 3.3 u clear) and kept at its 10.8 u height (plan §7). Its piers sit at the procedural clusters'
 * angles ((k + ½)·45°, measured on the decoded mesh), so the colonnades still meet it between two piers. The platform
 * is wider and lower than the procedural one (r 4.6, 0.2 u: a walkable deck, not a plinth).
 */
const AI_XZ = 0.65, AI_PIER_R = 3.7, AI_PIER = 0.72, AI_DECK = 0.2, AI_DECK_R = 4.6;

function aiRemainder(b: BatchLike) {
  lagoon(b);
  lathe(b, [[AI_DECK_R, -1.2], [AI_DECK_R, AI_DECK - 0.06], [AI_DECK_R - 0.12, AI_DECK]], 0, 0, 0, STONE_SHADE, NONE, 24);
  b.polygon(ngon(0, 0, AI_DECK_R - 0.12, 24), AI_DECK, STONE, NONE);
  wings(b, 0);
}

const SWAP: LandmarkSwap = {
  parts: [{ model: 'sf-palace-rotunda', x: 0, y: AI_DECK, z: 0, scale: [AI_XZ, 1, AI_XZ], castShadow: true, glow: 0.1 }],
  build: aiRemainder,
  ship: true,
  note: 'rotunda xz 0.65 on a walkable deck',
};

function walk(ai: boolean): NonNullable<SfLandmark['walk']> {
  const blockers: WalkBlocker[] = ai ? [] : [{ x: 0, z: 0, r: 0.1 }];
  // rotunda piers: the AI mesh's (walk-in arches between them) or the procedural column clusters
  for (let k = 0; k < 8; k++) {
    const a = ((k + 0.5) / 8) * Math.PI * 2, R = ai ? AI_PIER_R : 3.05;
    blockers.push({ x: Math.sin(a) * R, z: Math.cos(a) * R, r: ai ? AI_PIER : 0.7 });
  }
  for (const pts of [WING_L, WING_R, HALL_PTS]) {
    const w = pts === HALL_PTS ? HALL_W : 1.5;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], c = pts[i + 1], dx = c.x - a.x, dz = c.z - a.z, L = Math.hypot(dx, dz), px = (dz / L) * (w / 2), pz = (-dx / L) * (w / 2);
      blockers.push({ poly: [{ x: a.x + px, z: a.z + pz }, { x: c.x + px, z: c.z + pz }, { x: c.x - px, z: c.z - pz }, { x: a.x - px, z: a.z - pz }] });
    }
  }
  blockers.push({ poly: LAGOON });
  // the AI rotunda stands on a 0.2 u deck (the procedural platform is a solid plinth under the clusters)
  return ai ? { blockers, surfaces: [{ poly: ngon(0, 0, AI_DECK_R, 24), y: AI_DECK, surface: 'plaza' }] } : { blockers };
}

export const palaceOfFineArts: SfLandmark = {
  id: 'palace-of-fine-arts',
  tier: 1,
  x: X0,
  z: Z0,
  yaw: YAW,
  base: 0.1,
  exclude: { poly: worldPoly(X0, Z0, YAW, [{ x: -19, z: -14 }, { x: 20, z: -14 }, { x: 20, z: 17 }, { x: -19, z: 17 }]) },
  castShadow: true,
  build,
  walk: walk(SWAP.ship),
  swap: SWAP,
  // only the rotunda thins as one (no dither holes under it); the wings and the hall keep the per-fragment fade
  fade: { r: 4.8, y1: 11.5, procedural: false },
  // D2-10: the rotunda (piers, entablature, dome) on its deck
  tall: [{ x: 0, z: 0, r: 4.6 }],
};

export const PALACE_LAGOON = LAGOON;
