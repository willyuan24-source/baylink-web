import type { Vec2 } from '../../../core/types';
import { type BatchLike, CBOX, ICO, M } from '../../builder';
import type { SiteHooks } from '../sites';
import { GLOW, NONE, arch, band, box, cyl, lathe, ngon, rot, worldPoly } from './kit';
import type { LandmarkGround, LandmarkSwap, SfLandmark, WalkBlocker } from './index';
import { ringBand, settingGround, streetStrips } from './setting';
import { bench, conifer, lamp, tree } from './siteKit';

/**
 * Palace of Fine Arts (T1): the 1915 rotunda on its lagoon, the two curved peristyle wings with their flower-box
 * "weeping maidens" and the long curved exhibition hall behind. Local frame: origin at the rotunda (OSM dome part,
 * way 456820271), yaw 135° so +z looks across the lagoon (relation 7471537). Wings / hall centrelines come from the
 * OSM "roof" ways 288371306 / 288371310 and the hall parts 1550664399 / 1550664400 (opus-qa/landmarks/_tools).
 * Height: rotunda 49 m → H = 3.2 + 0.155·49 = 10.8 u; colonnades 20 m and hall 17 m at the same 0.22 u/m.
 *
 * Setting (lane D2, D2-09): the exclusion (a rectangle over the whole lagoon) clipped the lagoon's shore walks, Palace
 * Drive behind the hall and a corner of the Presidio Parkway; they run on as restored strips, except where the lagoon,
 * the hall, the wings or the rotunda deck cover them. The lagoon (CS-13) is no longer a raised slab with a dark side:
 * the water lies 0.18 u over the sunk ground, inside a pale stone coping that slopes down to the lawn. Benches and lamps
 * line the south shore walk (the classic view of the rotunda across the water), willows and cypresses stand on the
 * lawns at both ends, and two swans float on the lagoon.
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

const G = settingGround('palace-of-fine-arts');
/** water level (local): just over the sunk lawn, never under the drawn ground where it rises to the exclusion edge */
const WATER = -0.12;
const waterY = (x: number, z: number) => Math.max(WATER, G.at(x, z) + 0.05);

/** lagoon water (its coping and bank are `ground`) — replaces the city's water inside `exclude` */
function lagoon(b: BatchLike) {
  b.polygon(LAGOON, waterY, '#6fb3ad', [0, 0, 0, 1.05]);
}

/** the stone coping round the water (0.35 u, just above it) and the bank sloping down to the lawn (0.4 u) */
function lagoonRim(): LandmarkGround[] {
  const top = (x: number, z: number) => waterY(x, z) + 0.08;
  return [
    ...ringBand(LAGOON, -0.05, 0.35, (x, z) => top(x, z), '#e4d6bd', 2),
    ...ringBand(LAGOON, 0.35, 0.75, (x, z, d) => (d < 0.5 ? top(x, z) : Math.min(top(x, z) - 0.02, G.at(x, z) + 0.03)), '#cfc1a3', 0),
  ];
}

// ---------------------------------------------------------------------------
// setting (D2-09): shore walk furniture, trees, swans
// ---------------------------------------------------------------------------

/** benches on the south shore walk, facing the rotunda across the water */
const BENCHES: Vec2[] = [{ x: -6.2, z: 17.9 }, { x: -0.8, z: 17.3 }, { x: 4.6, z: 16.7 }, { x: 9.6, z: 14.9 }, { x: 14.8, z: 13.9 }];
const LAMPS: Vec2[] = [{ x: -9.4, z: 18.1 }, { x: 1.9, z: 17.2 }, { x: 12.2, z: 15.0 }, { x: 18.2, z: 12.6 }, { x: -16.6, z: 13.4 }];
/** willows (round) on the lagoon lawns and cypresses by the hall ends */
const WILLOWS: Vec2[] = [{ x: -16.2, z: 9.2 }, { x: -11.2, z: 17.6 }, { x: 18.3, z: 9.6 }, { x: 16.3, z: 14.9 }, { x: -14.2, z: 16.2 }];
const CYPRESS: Vec2[] = [{ x: -17.6, z: 0.8 }, { x: 18.8, z: -2.2 }, { x: -18.2, z: -4.6 }];
const SWANS: [number, number, number][] = [[5.5, 9.5, 0.6], [-6.0, 11.2, 2.4]];
const faceRotunda = (p: Vec2) => Math.atan2(-p.x, -p.z);

/** a toy swan (≈ 70 triangles): round body, the neck rising from its breast, head and orange bill forward */
function swan(b: BatchLike, x: number, z: number, ry: number) {
  const y = waterY(x, z), s = Math.sin(ry), c = Math.cos(ry);
  const at = (u: number, h: number): [number, number, number] => [x + s * u, y + h, z + c * u];
  b.add(ICO(0), M(...at(-0.04, 0.12), ry, 0.2, 0.12, 0.32), '#f7f4ec');
  b.add(ICO(0), M(...at(-0.3, 0.2), ry, 0.1, 0.07, 0.1), '#eeeae0');
  b.add(CBOX(), M(...at(0.2, 0.36), ry, 0.06, 0.4, 0.06, -0.18), '#f7f4ec');
  b.add(ICO(0), M(...at(0.25, 0.58), ry, 0.06, 0.055, 0.085), '#f7f4ec');
  b.add(CBOX(), M(...at(0.35, 0.56), ry, 0.035, 0.03, 0.1), '#e08a3c');
}

function setting(b: BatchLike) {
  for (const p of BENCHES) bench(b, p.x, G.at(p.x, p.z), p.z, faceRotunda(p));
  for (const p of LAMPS) lamp(b, p.x, G.at(p.x, p.z), p.z);
  WILLOWS.forEach((p, i) => tree(b, p.x, G.at(p.x, p.z), p.z, 1.25, i + 3));
  for (const p of CYPRESS) conifer(b, p.x, G.at(p.x, p.z), p.z, 1.3);
  for (const [x, z, ry] of SWANS) swan(b, x, z, ry);
}

const LIGHTS: NonNullable<SiteHooks['lights']> = LAMPS.map(p => ({ x: p.x, y: G.at(p.x, p.z) + 3.8, z: p.z, size: 1, color: '#ffd9a0' }));
/** the south shore walk (the rotunda across the water) and the rotunda deck */
const PLAZA: Vec2[][] = [[{ x: -9, z: 16.8 }, { x: 1.6, z: 15.6 }, { x: 6.6, z: 14.8 }, { x: 13.6, z: 13.0 }, { x: 16.6, z: 11.3 }, { x: 17.4, z: 12.6 }, { x: 14.2, z: 14.4 }, { x: 6.8, z: 16.3 }, { x: 1.6, z: 17.0 }, { x: -9, z: 17.9 }], ngon(0, 0, 4.2, 12)];

/** the restored walks keep out of the lagoon, the buildings and from under the rotunda deck */
const inPoly = (x: number, z: number, poly: readonly Vec2[]) => {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], q = poly[j];
    if ((a.z > z) !== (q.z > z) && x < ((q.x - a.x) * (z - a.z)) / (q.z - a.z) + a.x) c = !c;
  }
  return c;
};

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
  if (lod === 0) { lagoon(b); setting(b); }
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
  setting(b);
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
  for (const p of BENCHES) blockers.push({ x: p.x, z: p.z, r: 0.5 });
  for (const p of [...WILLOWS, ...CYPRESS]) blockers.push({ x: p.x, z: p.z, r: 0.3 });
  // the AI rotunda stands on a 0.2 u deck (the procedural platform is a solid plinth under the clusters)
  return ai ? { blockers, surfaces: [{ poly: ngon(0, 0, AI_DECK_R, 24), y: AI_DECK, surface: 'plaza' }] } : { blockers };
}

const WALK = walk(SWAP.ship);
const covered = (x: number, z: number) => Math.hypot(x, z) < AI_DECK_R || WALK.blockers.some(b => ('poly' in b ? b.poly.length > 3 && inPoly(x, z, b.poly) : false));

export const palaceOfFineArts: SfLandmark & SiteHooks = {
  id: 'palace-of-fine-arts',
  tier: 1,
  x: X0,
  z: Z0,
  yaw: YAW,
  base: 0.1,
  exclude: { poly: worldPoly(X0, Z0, YAW, [{ x: -19, z: -14 }, { x: 20, z: -14 }, { x: 20, z: 17 }, { x: -19, z: 17 }]) },
  castShadow: true,
  build,
  walk: WALK,
  swap: SWAP,
  ground: [...lagoonRim(), ...streetStrips('palace-of-fine-arts', (x, z) => !covered(x, z))],
  lights: LIGHTS,
  plaza: PLAZA.map(poly => ({ poly, surface: 'plaza' as const })),
  // only the rotunda thins as one (no dither holes under it); the wings and the hall keep the per-fragment fade
  fade: { r: 4.8, y1: 11.5, procedural: false },
  // D2-10: the rotunda (piers, entablature, dome) on its deck
  tall: [{ x: 0, z: 0, r: 4.6 }],
};

export const PALACE_LAGOON = LAGOON;
