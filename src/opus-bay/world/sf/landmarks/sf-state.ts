import * as THREE from 'three';
import type { Vec2 } from '../../../core/types';
import type { BatchLike } from '../../builder';
import { GLOW, LIT, NONE, box, cbox, loftRings, rect, worldPoly } from './kit';
import {
  GC, PAT, type SiteGroundPoly, type W4Site, bench, bin, gfill, gstrip, lamp, plazaOf, siteGround, tree,
} from './siteKit';

/**
 * San Francisco State University (wave 4, P1 · map T1, the owner's request): the heart of the CSU campus by Lake
 * Merced (founded 1899, here since 1953) — the Quad lawn with its crossing walks and big trees, Malcolm X Plaza, the
 * Cesar Chavez Student Center and the J. Paul Leonard Library around it, and a plain gateway where the walk from 19th
 * Ave (the M stop at 19th & Holloway) enters the Quad. No names, marks or mascot anywhere; the gateway banner is plain
 * purple and gold (the university's colours).
 *
 * - Cesar Chavez Student Center (OSM relation 4793449; Paffard Keatinge-Clay, 1969–75): an "iceberg" building, mostly
 *   below grade, with two trapezoidal concrete pyramids rising from its podium — one aligned to Polaris for quiet
 *   rooms, the other an occupiable roof terrace (Golden Gate Xpress, SFSU archive). The murals on it are never copied:
 *   the podium walls carry plain warm colour panels.
 * - J. Paul Leonard Library (OSM way 338711158, 7 levels / 18 m → H 6.0 u; HMC Architects, reopened 2012): concrete
 *   with a structural glass front toward the Quad.
 * Frame: origin (225, 1552) on the Quad, yaw 132.8° (the campus grid: local +x ≈ north, +z ≈ east toward 19th Ave).
 * Library x −18.2…−7.7, z −9.7…6.9; student center podium x −6.1…4.1, z −13.7…−5.8; the Quad x −6…12, z −2…12.
 */

const ID = 'sfsu';
const X0 = 225, Z0 = 1552, YAW = (132.8 * Math.PI) / 180;
const g = siteGround(ID, 7.9);

const CONCRETE = '#d6cfc2', CONCRETE_SHADE = '#bdb5a7', GLASS = '#a9c9d0', STONE = '#e4dccb';
const PURPLE = '#5b3f86', GOLD = '#d9ae4f';
const MURAL = ['#d8744a', '#e0a94a', '#4f8f6a', '#c9473a', '#3f6d9a'];

/** the Quad lawn, Malcolm X Plaza and the walks (local) */
const QUAD: Vec2[] = [{ x: -6.4, z: -1.6 }, { x: 12.4, z: -1.6 }, { x: 12.4, z: 8.2 }, { x: 10.6, z: 11.6 }, { x: -6.4, z: 11.6 }];
const PLAZA: Vec2[] = [{ x: -7.4, z: -5.6 }, { x: 12.6, z: -5.6 }, { x: 12.6, z: -1.6 }, { x: -6.4, z: -1.6 }, { x: -6.4, z: 11.6 }, { x: -7.4, z: 11.6 }];
const WALKS: Vec2[][] = [
  [{ x: -6.0, z: -1.2 }, { x: 12.0, z: 11.2 }],          // the long diagonal
  [{ x: 12.0, z: -1.2 }, { x: -6.0, z: 11.2 }],          // the cross diagonal
  [{ x: 3.0, z: -1.4 }, { x: 3.0, z: 11.4 }],            // the axis from the student center to Business
  [{ x: 8.6, z: 11.6 }, { x: 5.2, z: 7.2 }],             // from the gateway (19th Ave walk) into the lawn
];
const TREES: [number, number, number][] = [
  [-5.2, 0.2, 1.3], [-5.0, 5.4, 1.2], [-5.4, 10.3, 1.3], [0.2, 10.6, 1.15], [6.2, 10.5, 1.2], [11.4, 3.2, 1.25], [11.0, -0.6, 1.2],
  [7.8, 3.4, 1.1], [-1.2, 3.6, 1.05], [11.6, 6.6, 1.15],
];
const LAMPS: Vec2[] = [{ x: -6.9, z: -3.8 }, { x: 4.2, z: -3.2 }, { x: 12.0, z: -3.6 }, { x: -6.9, z: 6.4 }, { x: 3.9, z: 5.2 }, { x: 9.8, z: 10.9 }];
const BENCHES: [number, number, number][] = [[-2.6, -2.4, 0], [8.4, -2.4, 0], [-6.9, 2.6, Math.PI / 2], [-6.9, 8.8, Math.PI / 2], [1.8, 11.0, Math.PI], [9.8, 5.0, -Math.PI / 2]];

const LIB = { x0: -18.2, x1: -7.7, z0: -9.7, z1: 6.9 };
const CC = { x0: -6.1, x1: 4.1, z0: -13.7, z1: -5.8 };
const GATE = { x: 8.6, z: 11.4, span: 3.6 };

/** J. Paul Leonard Library: a concrete block with a structural glass front on the Quad (+x side), roof plant, entry */
function library(b: BatchLike, lod: 0 | 2) {
  const { x0, x1, z0, z1 } = LIB, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, w = x1 - x0, d = z1 - z0;
  const gy = g.at(cx, cz), top = gy + 6.0;
  box(b, cx, -1.2, cz, w, top + 1.2, d, CONCRETE, lod === 0 ? [2, gy, -5.3, 0] : NONE);
  if (lod === 2) return;
  // the 2012 glass front toward the Quad: a full-height glass wall with thin mullion fins, glowing at night
  const fy = g.at(x1 + 1, cz);
  box(b, x1 + 0.12, -1.2, cz, 0.24, top + 1.2 - 0.4, d - 1.2, GLASS, [6, fy, -2.1, 0.35]);
  for (let k = 0; k <= 6; k++) box(b, x1 + 0.3, fy - 0.1, z0 + 0.6 + (k * (d - 1.2)) / 6, 0.12, top - fy - 0.3, 0.12, CONCRETE_SHADE);
  box(b, cx, top, cz, w + 0.4, 0.3, d + 0.4, CONCRETE_SHADE);
  box(b, cx - 1.5, top + 0.3, cz - 2, 3.2, 1.0, 4.2, '#c7c0b3');
  // the entry canopy on the plaza side
  box(b, x1 + 1.2, fy + 2.6, z0 + 3.2, 2.4, 0.2, 4.0, CONCRETE_SHADE);
  box(b, x1 + 0.3, fy - 0.05, z0 + 3.2, 0.1, 2.3, 2.4, '#51605d', LIT(fy));
}

/** a truncated pyramid (trapezoid prism) from a w0 × d0 base at y0 to a w1 × d1 top at y1, centred at (x, z) */
function frustum(b: BatchLike, x: number, z: number, y0: number, y1: number, w0: number, d0: number, w1: number, d1: number, color: string, top: string | null, dz1 = 0) {
  const R = (w: number, d: number, y: number, oz: number) => [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => new THREE.Vector3(x + (u * w) / 2, y, z + oz + (v * d) / 2));
  loftRings(b, [R(w0, d0, y0, 0), R(w1, d1, y1, dz1)], (_l, side) => (side % 2 ? color : CONCRETE_SHADE), NONE, top);
}

/** Cesar Chavez Student Center: the podium half below the plaza and its two concrete pyramids */
function studentCenter(b: BatchLike, lod: 0 | 2) {
  const { x0, x1, z0, z1 } = CC, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const py = g.at(cx, z1 + 1), podium = py + 1.4;
  box(b, cx, -1.2, cz, x1 - x0, podium + 1.2, z1 - z0, CONCRETE, NONE);
  // the "quiet" pyramid (aligned to Polaris: its steep face to the north, local +x) and the terrace pyramid
  frustum(b, cx - 2.4, cz - 0.4, podium, podium + 4.6, 5.0, 6.4, 1.2, 2.6, CONCRETE, CONCRETE_SHADE);
  if (lod === 2) { frustum(b, cx + 2.6, cz - 0.6, podium, podium + 2.8, 4.4, 5.8, 2.4, 3.4, CONCRETE, CONCRETE_SHADE); return; }
  // the terrace pyramid as three stepped tiers (the roof terrace / theatre)
  for (let k = 0; k < 3; k++) box(b, cx + 2.6, podium + k * 0.95, cz - 0.6, 4.4 - k * 1.0, 0.95, 5.8 - k * 1.2, k % 2 ? CONCRETE_SHADE : CONCRETE);
  // plain warm colour panels on the podium wall facing the plaza (the murals are never copied), doors, a stair
  for (let k = 0; k < 5; k++) box(b, x0 + 1.0 + k * 1.95, py + 0.05, z1 + 0.06, 1.6, 1.15, 0.08, MURAL[k]);
  box(b, cx, py - 0.05, z1 + 0.08, 1.8, 1.25, 0.06, '#4a5652', LIT(py));
  for (let k = 0; k < 4; k++) box(b, x1 - 0.8, py - 0.2 + k * 0.35, z1 + 0.5 + (3 - k) * 0.45, 1.2, 0.35, 0.5, CONCRETE_SHADE);
  // slot windows in the quiet pyramid (warm at night)
  for (let k = 0; k < 3; k++) cbox(b, cx - 2.4, podium + 1.0 + k * 1.1, cz + 2.1 - k * 0.45, 2.2 - k * 0.5, 0.3, 0.12, '#e8c98a', GLOW(0.8), 0, -0.6);
}

/** the gateway where the walk from 19th Ave enters the Quad: two brick-and-stone pillars, a beam, plain banners */
function gateway(b: BatchLike) {
  const y = g.at(GATE.x, GATE.z);
  for (const s of [-1, 1]) {
    const x = GATE.x + (s * GATE.span) / 2;
    box(b, x, y - 0.3, GATE.z, 0.7, 3.5, 0.7, '#a5553d');
    box(b, x, y + 3.2, GATE.z, 0.9, 0.25, 0.9, STONE);
    box(b, x + s * 0.45, y + 1.0, GATE.z, 0.05, 1.8, 0.55, s < 0 ? PURPLE : GOLD);
  }
  box(b, GATE.x, y + 2.75, GATE.z, GATE.span + 0.7, 0.45, 0.4, STONE);
  box(b, GATE.x, y + 2.8, GATE.z + 0.21, GATE.span - 0.6, 0.3, 0.02, PURPLE);
}

function quadFurniture(b: BatchLike) {
  for (const [k, [x, z, s]] of TREES.entries()) tree(b, x, g.at(x, z), z, s, k + 11);
  for (const l of LAMPS) lamp(b, l.x, g.at(l.x, l.z), l.z);
  for (const [x, z, ry] of BENCHES) bench(b, x, g.at(x, z), z, ry);
  for (const [x, z] of [[-6.9, -1.0], [12.2, 0.6]]) bin(b, x, g.at(x, z), z);
}

function build(b: BatchLike, lod: 0 | 2) {
  library(b, lod);
  studentCenter(b, lod);
  if (lod === 2) return;
  gateway(b);
  quadFurniture(b);
}

function ground(): SiteGroundPoly[] {
  return [
    ...gfill(PLAZA, GC.plaza, PAT.stone, g, 5),
    ...gfill(QUAD, GC.lawn, PAT.grass, g, 4),
    ...WALKS.flatMap(w => gstrip(w, 1.5, GC.path, PAT.earth, g, 3, 0.075)),
  ];
}

const BLOCKERS = [
  { poly: rect((LIB.x0 + LIB.x1) / 2 + 0.2, (LIB.z0 + LIB.z1) / 2, LIB.x1 - LIB.x0 + 0.5, LIB.z1 - LIB.z0) },
  { poly: rect((CC.x0 + CC.x1) / 2, (CC.z0 + CC.z1) / 2, CC.x1 - CC.x0, CC.z1 - CC.z0) },
  ...[-1, 1].map(s => ({ x: GATE.x + (s * GATE.span) / 2, z: GATE.z, r: 0.5 })),
  ...TREES.map(([x, z]) => ({ x, z, r: 0.3 })),
];

/** exclusion: the Quad, Malcolm X Plaza, the student center and the library (Business, Science, the gym, Admin and
 * Fine Arts stay city buildings; only campus walks and a loading-dock service road run inside) */
const EXCLUDE: Vec2[] = [
  { x: -18.6, z: -13.9 }, { x: 13.0, z: -13.9 }, { x: 13.0, z: 8.6 }, { x: 11.0, z: 12.2 }, { x: -11.1, z: 12.2 },
  { x: -11.1, z: 6.9 }, { x: -18.6, z: 6.9 },
];

export const sfState: W4Site = {
  id: ID,
  tier: 1,
  x: X0,
  z: Z0,
  yaw: YAW,
  base: g.base,
  exclude: { poly: worldPoly(X0, Z0, YAW, EXCLUDE) },
  build,
  castShadow: true,
  walk: {
    blockers: BLOCKERS,
    surfaces: [{ poly: QUAD, y: 'terrain', surface: 'grass' }, { poly: PLAZA, y: 'terrain', surface: 'plaza' }],
  },
  ground: ground(),
  lights: LAMPS.map(l => ({ x: l.x, y: g.at(l.x, l.z) + 3.8, z: l.z, size: 1, color: '#ffd9a0' })),
  plaza: [plazaOf(PLAZA), plazaOf(QUAD, 'grass')],
  w4: {
    placeId: 'sf-state-university',
    attractions: ['sf-state-university'],
    lod0R: 340,
    arrival: { x: 7.4, z: 9.4, heading: -2.4 },
    photo: { target: [-4, 3.5, 0], distance: 42, elevation: 0.36, bearing: 0.9 },
    flag: { x: 3.0, z: 4.0, h: 30 },
    height: { realM: 18, u: 7.4, rule: 'H = 3.2 + 0.155·h' },
    osm: ['relation/19710046', 'relation/4751349', 'relation/4793449', 'way/338711158'],
    terrain: [-20, -16, 15, 14],
  },
};
