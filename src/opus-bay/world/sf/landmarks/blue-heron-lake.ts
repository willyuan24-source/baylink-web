import type { Vec2 } from '../../../core/types';
import { BOX, type BatchLike, M } from '../../builder';
import { NONE, cyl, lathe, rect, worldPoly } from './kit';
import { type W4Site, siteGround } from './siteKit';

/**
 * Blue Heron Lake (formerly Stow Lake; wave 4, P3 · map T2, the blue-heron-lake site): the 1893 boating lake that
 * rings Strawberry Hill in Golden Gate Park, renamed on 18 January 2024 (sfrecpark.org). The lake, the island, its
 * paths and the waterfall are the city's; this site is the Chinese Pavilion on the island's east shore, the 1981 gift of
 * San Francisco's sister city Taipei: eight bold red columns under a grey-green tiled roof (the Arts Commission's
 * colours, chosen to show through the foliage; sfrecpark.org, Richmond Review 2021), open between every pair of
 * columns. The roof carvings are never reproduced.
 *
 * Built to lane V's AI pavilion (`sf-chinese-pavilion`, data/sf/w4Models.ts) so the swap keeps the footprint: origin
 * at its placement (−251.5, 1017.0), yaw 0, front +Z; a 0.3 u floor platform of r 2.4, columns r 0.25 on a ring r 2.15
 * at 22.5° + k·45°, 2.0 u clear under the roof, eaves r ≈ 2.8, 4.5 u to the finial. The city draws the lake up to the
 * pavilion (see the lane-L report), so the model stands on a stone base at the water's edge (its origin at local y
 * BASE) and two short causeways reach the island path: +Z (south) and west.
 */

const ID = 'blue-heron-lake';
const X0 = -251.5, Z0 = 1017.0, YAW = 0;
const g = siteGround(ID, 19.5);

const RED = '#b8322a', ROOF = '#7f9483', STONE = '#c9c1b2', FLOOR_C = '#b9a58f', GOLD = '#c9a64a';
/** the model's origin (local y): the floor is 0.3 above it, the island path's ground at the causeways ≈ 0.5 */
const BASE = 0.45, FLOOR = BASE + 0.3;
const R_COL = 2.15, R_FLOOR = 2.4, EAVE = 2.8;
const oct = (r: number): Vec2[] => Array.from({ length: 8 }, (_, k) => ({ x: Math.sin((k * Math.PI) / 4 + Math.PI / 8) * r, z: Math.cos((k * Math.PI) / 4 + Math.PI / 8) * r }));
/** causeways to the island path: [centre x, z, length, heading] */
const CAUSEWAYS: [number, number, number, number][] = [[0, 2.8, 1.3, 0], [-2.75, -1.05, 1.6, -1.48]];
const causeway = ([x, z, len, ry]: [number, number, number, number]) => rect(x, z, 1.3, len, ry);

function build(b: BatchLike, lod: 0 | 2) {
  if (lod === 2) {
    lathe(b, [[R_FLOOR + 0.1, -1.0], [R_FLOOR, 0.3]], 0, BASE, 0, STONE, NONE, 6);
    lathe(b, [[EAVE, 0], [0.05, 1.9]], 0, BASE + 2.4, 0, ROOF, NONE, 6);
    return;
  }
  // the stone base down into the lake, the floor platform, eight red columns and the beam ring
  lathe(b, [[R_FLOOR + 0.15, -1.2], [R_FLOOR + 0.15, 0]], 0, BASE, 0, STONE, NONE, 8);
  lathe(b, [[R_FLOOR, 0], [R_FLOOR, 0.3], [R_FLOOR - 0.1, 0.3]], 0, BASE, 0, FLOOR_C, NONE, 8);
  for (const p of oct(R_COL)) cyl(b, p.x, FLOOR, p.z, 0.2, 2.0, RED, NONE, 6);
  lathe(b, [[R_COL + 0.25, 0], [R_COL + 0.25, 0.3], [R_COL - 0.25, 0.3], [R_COL - 0.25, 0]], 0, FLOOR + 1.85, 0, RED, NONE, 8);
  // the upswept roof (eaves turned up at the rim), the finial
  lathe(b, [[EAVE, 0.25], [EAVE - 0.3, 0.1], [2.0, 0.35], [1.2, 0.95], [0.45, 1.45], [0.08, 1.6]], 0, BASE + 2.3, 0, ROOF, NONE, 8);
  lathe(b, [[0.16, 0], [0.12, 0.25], [0.2, 0.36], [0.02, 0.6]], 0, BASE + 3.9, 0, GOLD, NONE, 6);
  // the causeways: stone slabs from the lake bed up to the path
  for (const [x, z, len, ry] of CAUSEWAYS) b.add(BOX(), M(x, BASE - 1.2, z, ry, 1.3, 1.4, len), STONE);
}

/** exclusion: the base, the roof's reach and the causeways (the island path around them stays the city's) */
const EXCLUDE: Vec2[] = [
  { x: -1.15, z: 2.77 }, { x: -0.8, z: 3.5 }, { x: 0.8, z: 3.5 }, { x: 1.15, z: 2.77 }, { x: 2.77, z: 1.15 }, { x: 2.77, z: -1.15 },
  { x: 1.15, z: -2.77 }, { x: -1.15, z: -2.77 }, { x: -2.2, z: -1.9 }, { x: -3.6, z: -1.8 }, { x: -3.6, z: -0.3 }, { x: -2.77, z: 1.15 },
];

export const blueHeronLake: W4Site = {
  id: ID,
  tier: 2,
  x: X0,
  z: Z0,
  yaw: YAW,
  base: g.base,
  sink: 0,
  exclude: { poly: worldPoly(X0, Z0, YAW, EXCLUDE) },
  build,
  walk: {
    blockers: oct(R_COL).map(p => ({ x: p.x, z: p.z, r: 0.25 })),
    surfaces: [
      { poly: oct(R_FLOOR), y: FLOOR, surface: 'plaza' },
      ...CAUSEWAYS.map(c => ({ poly: causeway(c), y: BASE + 0.2, surface: 'plaza' as const })),
    ],
  },
  plaza: [
    { poly: oct(R_FLOOR), surface: 'plaza' },
    // the island path's approach, and the promenade on the far shore that looks across at the pavilion
    { poly: [{ x: -5.7, z: -3.0 }, { x: -3.6, z: -2.1 }, { x: -3.4, z: 1.7 }, { x: -5.0, z: 2.3 }], surface: 'dirt' },
    { poly: [{ x: 12.0, z: -0.5 }, { x: 13.4, z: -0.9 }, { x: 15.6, z: 4.5 }, { x: 14.2, z: 4.9 }], surface: 'pavement' },
  ],
  w4: {
    placeId: 'stow-lake',
    attractions: ['blue-heron-lake'],
    arrival: { x: 0, z: 1.2, heading: 0 },
    photo: { target: [0, 2.2, 0], distance: 16, elevation: 0.22, bearing: 1.4 },
    flag: { x: 0, z: 0, h: 30 },
    height: { realM: 8.5, u: 4.5, top: 5.0, rule: 'H = 3.2 + 0.155·h' },
    osm: ['way/120479810'],
    terrain: [-6, -5, 6, 6],
    aiSlot: { model: 'w4-chinese-pavilion', id: 'sf-chinese-pavilion', at: [0, BASE, 0], note: 'lane V (data/sf/w4Models.ts, sf-chinese-pavilion): 2,940 triangles, 5.62 × 4.5 × 5.61 u, placed at the origin with scale 1 at local y BASE; the column blockers match its ring' },
    notes: 'The bridges to Strawberry Hill are the city\'s paths (their walk strips wait for the island fix and the integration).',
  },
};
