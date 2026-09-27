import type { BatchLike } from '../../builder';
import { GLOW, NONE, WIN, box, disc, lathe, prismXZ, pyramid, rect, worldPoly } from './kit';
import type { LandmarkSwap, SfLandmark, WalkBlocker } from './index';

/**
 * Ghirardelli Square (T2): the red-brick former chocolate factory stepping down the hill to Beach St and the Bay,
 * its clock tower on the Larkin St corner, the rooftop sign frame (plain lit panels, no lettering) and the fountain
 * terrace in the middle. Footprints = the OSM building ways (Cocoa, Chocolate, Mustard, Clock Tower, Apartment,
 * Carousel, Infill, Woolen Mill, Wurster, Power House, Plaza), local with +z = north to the Bay (yaw −124.6°).
 * Heights per plan §2.3 from OSM levels/height (22 m → 6.6 u … 1 level → 3.6 u); each building sits on the DEM
 * grade under its lowest corner (base 1.3 u; the south row is ~2.7 u higher than Beach St).
 */

const X0 = -235.55, Z0 = 165.22, YAW = (-124.6 * Math.PI) / 180;
const BRICKS = ['#a8573e', '#b3614a', '#9c4f3a', '#ad5a42'];
const TRIM = '#efe3cc';
type P = [number, number][];
const B: { name: string; poly: P; h: number }[] = [
  { name: 'cocoa', h: 6.6, poly: [[6.55, -1.71], [6.06, -1.72], [6.06, -2.83], [2.98, -2.84], [2.98, -2.45], [2.36, -2.46], [2.36, -2.86], [1.26, -2.87], [1.26, -2.77], [0.55, -2.77], [0.55, -2.52], [0.09, -2.52], [0.09, -5.89], [6.55, -5.87]] },
  { name: 'chocolate', h: 6.6, poly: [[6.55, -1.71], [6.55, -5.87], [8.76, -5.88], [8.76, -1.14], [6.57, -1.15]] },
  { name: 'mustard', h: 4.75, poly: [[-5.51, -5.85], [-5.48, -3.43], [-2.8, -3.45], [-2.8, -3.09], [-2.16, -3.09], [-2.17, -3.44], [0.09, -3.46], [0.09, -5.89]] },
  { name: 'clock', h: 4.75, poly: [[-8.2, -2.32], [-8.29, -5.95], [-5.87, -5.83], [-5.86, -2.32]] },
  { name: 'apartment', h: 4.75, poly: [[-8.77, 1.19], [-8.76, -0.67], [-6.31, -0.68], [-6.33, 1.21]] },
  { name: 'carousel', h: 4.1, poly: [[-6.33, 1.21], [-6.33, 1.72], [-6.53, 1.71], [-6.53, 2.02], [-7.25, 2.02], [-7.41, 4.25], [-8.79, 4.24], [-8.77, 1.19]] },
  { name: 'infill', h: 3.6, poly: [[-1.22, -0.62], [-1.22, -1.13], [-0.81, -1.13], [-0.81, -1.55], [-1.02, -1.55], [-1.02, -2.02], [2.63, -1.99], [2.62, -0.77], [1.45, -0.78], [1.45, -0.6]] },
  { name: 'woolen', h: 4.75, poly: [[2.39, 2.04], [2.96, -0.22], [8.82, 1.25], [8.27, 3.45], [5.1, 2.66], [4.97, 3.2], [4.83, 3.17], [3.42, 2.81], [3.55, 2.33]] },
  { name: 'wurster', h: 4.1, poly: [[-1.49, 3.06], [-1.49, 2.93], [-0.06, 2.93], [-0.05, 3.21], [2.57, 3.32], [2.57, 5.72], [-0.09, 5.72], [-0.09, 5.99], [-6.52, 5.9], [-6.66, 4.19], [-6.5, 4.19], [-6.5, 2.87], [-6.26, 2.87], [-6.26, 2.59], [-5.02, 2.59], [-5.01, 3.07]] },
  { name: 'powerhouse', h: 3.6, poly: [[3.62, 4.63], [4.81, 4.65], [4.83, 3.4], [8.2, 3.6], [8.69, 5.81], [3.61, 5.73]] },
];
/** DEM grade (terrainY − base) by local z */
const GRADE: [number, number][] = [[-6, 2.73], [-4, 2.83], [-2, 2.69], [0, 2.37], [2, 2.08], [4, 1.12], [6, 0.13]];
function groundAt(z: number) {
  if (z <= GRADE[0][0]) return GRADE[0][1];
  for (let i = 0; i < GRADE.length - 1; i++) if (z <= GRADE[i + 1][0]) { const t = (z - GRADE[i][0]) / (GRADE[i + 1][0] - GRADE[i][0]); return GRADE[i][1] + (GRADE[i + 1][1] - GRADE[i][1]) * t; }
  return GRADE[GRADE.length - 1][1];
}
const floorOf = (poly: P) => Math.min(...poly.map(p => groundAt(p[1])));
const TERRACE = { x: -1.0, z: 1.85, w: 5.0, d: 2.4, y: groundAt(1.85) + 0.25 };

function build(b: BatchLike, lod: 0 | 2) {
  if (lod === 2) {
    // far massing: the tall south row, the lower north row, the clock tower + spire
    box(b, 1.6, 1.2, -3.8, 17.0, 8.1, 4.4, BRICKS[0]);
    box(b, 0.5, -0.5, 3.3, 16.0, 5.0, 5.4, BRICKS[1]);
    const top = floorOf(B[3].poly) + B[3].h;
    box(b, -7.1, 1.2, -4.1, 2.2, top + 2.2 - 1.2, 2.2, BRICKS[0]);
    pyramid(b, -7.1, top + 2.7, -4.1, 2.3, 2.3, 2.9, '#5f6c6a');
    return;
  }
  buildings(b, false);
  clockTower(b);
  signAndTerrace(b);
}

/** the brick blocks with their cream cornice lines (`ai`: without the Clock Tower block, the AI mesh stands there) */
function buildings(b: BatchLike, ai: boolean) {
  B.forEach((bd, i) => {
    if (ai && bd.name === 'clock') return;
    const y0 = floorOf(bd.poly);
    prismXZ(b, bd.poly, y0 - 1.5, y0 + bd.h, BRICKS[i % BRICKS.length], '#8e8173', WIN(4, y0 + 0.4, 3 + i));
    // cream cornice line
    b.walls(bd.poly.map(([x, z]) => ({ x, z })), y0 + bd.h - 0.25, y0 + bd.h + 0.05, TRIM, NONE);
  });
}

/** clock tower (Larkin St corner): shaft, clock stage, steep slate spire */
function clockTower(b: BatchLike) {
  const clock = B[3], cy = floorOf(clock.poly) + clock.h, tx = -7.1, tz = -4.1;
  box(b, tx, cy - 0.5, tz, 2.2, 3.2, 2.2, BRICKS[0], GLOW(0.08));
  box(b, tx, cy + 2.7, tz, 2.45, 0.3, 2.45, TRIM);
  pyramid(b, tx, cy + 3.0, tz, 2.3, 2.3, 2.9, '#5f6c6a');
  for (let k = 0; k < 4; k++) { const a = (k * Math.PI) / 2; disc(b, tx + Math.sin(a) * 1.11, cy + 1.9, tz + Math.cos(a) * 1.11, 0.55, 0.04, a, '#f7f1e3', GLOW(0.9), 12); }
  box(b, tx, cy + 5.9, tz, 0.1, 0.8, 0.1, '#d9b25a');
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) pyramid(b, tx + dx * 1.05, cy + 2.95, tz + dz * 1.05, 0.35, 0.35, 0.8, '#5f6c6a');
}

function signAndTerrace(b: BatchLike) {
  // rooftop sign frame on the Cocoa/Chocolate row, facing the Bay: plain lit panels on a dark lattice
  const sy = floorOf(B[0].poly) + B[0].h;
  for (const x of [0.8, 4.6, 8.3]) box(b, x, sy, -2.2, 0.12, 1.5, 0.12, '#3e3a36');
  box(b, 4.5, sy + 0.2, -2.2, 8.2, 0.1, 0.1, '#3e3a36');
  for (let k = 0; k < 11; k++) box(b, 0.95 + k * 0.72, sy + 0.35, -2.12, 0.55, 1.0, 0.06, '#f6efe0', GLOW(1));
  // fountain terrace (the Plaza) with the round basin, café umbrellas
  box(b, TERRACE.x, TERRACE.y - 1.6, TERRACE.z, TERRACE.w, 1.6, TERRACE.d, '#d8cbb4');
  lathe(b, [[0.75, 0], [0.75, 0.35], [0.62, 0.35], [0.62, 0.12]], TERRACE.x, TERRACE.y, TERRACE.z, '#cfc6b6', NONE, 10);
  disc(b, TERRACE.x, TERRACE.y + 0.12, TERRACE.z, 0.62, 0.15, 0, '#7cc1bd', [0, 0, 0, 1.08], 10);
  box(b, TERRACE.x, TERRACE.y + 0.3, TERRACE.z, 0.2, 0.9, 0.2, '#a9926a');
  for (const [ux, uz] of [[-2.9, 1.3], [0.9, 2.5]]) {
    box(b, ux, TERRACE.y, uz, 0.06, 1.2, 0.06, '#6b5b4a');
    pyramid(b, ux, TERRACE.y + 1.1, uz, 1.1, 1.1, 0.35, '#2f8f88');
  }
}

/**
 * AI clock tower (lane D2, D2-15): lane H's SAM mesh (LM2-3D: a three-storey brick block with the clock tower and
 * spire on one corner, 4.77 × 8 × 4.89 u) in place of the Clock Tower block, turned so the tower stands on the Larkin /
 * North Point corner, at [0.75, 1.3, 0.75]: 3.67 × 3.58 u (the OSM block is 2.4 × 3.6 u; it overlaps the Mustard
 * block by 0.3 u), the block 4.7 u tall like the others and the spire at 10.4 u (the procedural 10.65 u).
 * Decision gate (wave 3): stays procedural. Among the ten brick blocks the AI tower is thin, its clock faces small and
 * dark at night; the procedural clock stage with its four lit faces reads better at 64 px and after dark.
 */
const AI_AT = { x: -7.07, z: -4.12, yaw: Math.PI / 2 }, AI_S = [0.75, 1.3, 0.75] as const;
const AI_FOOT = rect(AI_AT.x, AI_AT.z, 3.67, 3.58);

function aiRemainder(b: BatchLike) {
  buildings(b, true);
  const y0 = floorOf(B[3].poly);
  box(b, AI_AT.x, y0 - 1.5, AI_AT.z, 3.6, 1.52, 3.5, BRICKS[0], NONE);
  signAndTerrace(b);
}

const SWAP: LandmarkSwap = {
  parts: [{ model: 'sf-ghirardelli-clock-tower', x: AI_AT.x, y: floorOf(B[3].poly), z: AI_AT.z, yaw: AI_AT.yaw, scale: AI_S, glow: 0.05 }],
  build: aiRemainder,
  ship: false,
  note: 'prototype: the slim AI tower reads weaker than the procedural clock stage, no lit clocks at night',
};

const blockers = (ai: boolean): WalkBlocker[] => [
  ...B.filter(bd => !(ai && bd.name === 'clock')).map(bd => ({ poly: bd.poly.map(([x, z]) => ({ x, z })) })),
  ...(ai ? [{ poly: AI_FOOT }] : []),
];

export const ghirardelliSquare: SfLandmark = {
  id: 'ghirardelli-square',
  tier: 2,
  x: X0,
  z: Z0,
  yaw: YAW,
  base: 1.3,
  exclude: { poly: worldPoly(X0, Z0, YAW, rect(0, 0, 18.2, 12.4)) },
  build,
  walk: { blockers: blockers(SWAP.ship), surfaces: [{ poly: rect(TERRACE.x, TERRACE.z, TERRACE.w, TERRACE.d), y: TERRACE.y, surface: 'plaza' }] },
  swap: SWAP,
  // D2-10: the clock tower and its spire
  tall: [{ x: -7.2, z: -4.1, r: 1.6 }],
};
