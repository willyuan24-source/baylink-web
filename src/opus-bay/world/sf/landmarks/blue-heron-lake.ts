import type { Vec2 } from '../../../core/types';
import { w4Swap, w4SwapPart } from '../../../data/sf/w4Swaps';
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
 * at 22.5° + k·45°, 2.0 u clear under the roof, eaves r ≈ 2.8, 4.5 u to the finial. The model stands on a raised stone
 * base at the water's edge (its origin at local y BASE, 0.45 over the lake's 20.0: the island ground there is 20.2–20.3,
 * so the platform stands a step up, like the real pavilion's) and two short causeways reach the island path: +Z (south)
 * and west. The island itself is drawn as land since lane V's render fix (W4-V-I1); lane V's swap row
 * (data/sf/w4Swaps.ts) places the AI pavilion on this same base.
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
  stoneBase(b);
  lathe(b, [[R_FLOOR, 0], [R_FLOOR, 0.3], [R_FLOOR - 0.1, 0.3]], 0, BASE, 0, FLOOR_C, NONE, 8);
  for (const p of oct(R_COL)) cyl(b, p.x, FLOOR, p.z, 0.2, 2.0, RED, NONE, 6);
  lathe(b, [[R_COL + 0.25, 0], [R_COL + 0.25, 0.3], [R_COL - 0.25, 0.3], [R_COL - 0.25, 0]], 0, FLOOR + 1.85, 0, RED, NONE, 8);
  // the upswept roof (eaves turned up at the rim), the finial
  lathe(b, [[EAVE, 0.25], [EAVE - 0.3, 0.1], [2.0, 0.35], [1.2, 0.95], [0.45, 1.45], [0.08, 1.6]], 0, BASE + 2.3, 0, ROOF, NONE, 8);
  lathe(b, [[0.16, 0], [0.12, 0.25], [0.2, 0.36], [0.02, 0.6]], 0, BASE + 3.9, 0, GOLD, NONE, 6);
  causeways(b);
}

function stoneBase(b: BatchLike) {
  lathe(b, [[R_FLOOR + 0.15, -1.2], [R_FLOOR + 0.15, 0]], 0, BASE, 0, STONE, NONE, 8);
}
/** the causeways: stone slabs from the lake bed up to the path */
function causeways(b: BatchLike) {
  for (const [x, z, len, ry] of CAUSEWAYS) b.add(BOX(), M(x, BASE - 1.2, z, ry, 1.3, 1.4, len), STONE);
}

/**
 * Lane V's AI pavilion (W4-L4; data/sf/w4Swaps.ts, verdict "ship": upturned eaves, tile ribs and finial against a
 * plain cone) on this stone base: the remainder is the base and the two causeways; the column blockers and the decks
 * stay (the model was fitted to them), and the roof thins as one while the player walks under it.
 */
const SWAP_ROW = w4Swap('blue-heron-lake')!;

/**
 * W4-L7, the island's two footbridges (OSM bridge footways, 1.2 u wide): the walk raster left a cell of each deck
 * unstandable (the 0.4 u stand radius meets the water beside a 1.2 u deck), so Strawberry Hill could not be reached on
 * foot. Walkable decks 2.6 u wide along each bridge, flat steps at the deck's own heights (WORLD y, as the published
 * bridge ways carry them), from the lake drive onto the island path. Walk data only: the city draws the bridges.
 */
const BRIDGES: { a: [number, number]; b: [number, number]; spans: [number, number, number][] }[] = [
  // south-west bridge (from Stow Lake Drive), deck 20.4 → 21.0
  { a: [-273.3, 1012.8], b: [-271.9, 1015.8], spans: [[-1.4, 0.6, 20.45], [0.6, 1.8, 20.65], [1.8, 3.1, 20.9]] },
  // north-west bridge, deck 20.1 → 20.7
  { a: [-270.4, 1048.3], b: [-271.4, 1045.3], spans: [[-1.4, 1.2, 20.1], [1.2, 2.2, 20.4], [2.2, 3.5, 20.65]] },
];
/**
 * The island's shore loop (OSM path round Strawberry Hill, WORLD x / z; through the south bridge's island end, the
 * pavilion's south causeway and the north bridge's end): the published DEM makes the hill so steep that the raster
 * cut this 1.2 u path into pieces, so neither bridge led to the pavilion. As a landmark deck ('terrain': it keeps the
 * ground's height) it is walkable at any grade (core/sfTerrain stampLandmarkSurfaces).
 */
const SHORE_LOOP: [number, number][] = [
  [-272.1, 1016.0], [-266.2, 1012.4], [-264.2, 1011.8], [-262.2, 1011.5], [-260.4, 1012.0], [-256.8, 1014.1], [-254.4, 1016.2],
  [-252.4, 1018.4], [-250.8, 1019.7], [-250.1, 1021.5], [-249.4, 1027.8], [-250.2, 1029.6], [-251.9, 1031.9], [-255.1, 1035.3],
  [-260.8, 1040.6], [-263.5, 1042.2], [-268.6, 1044.2], [-273.9, 1045.8], [-277.2, 1046.1], [-280.0, 1045.6], [-282.1, 1044.9],
  [-283.8, 1043.8], [-285.3, 1042.5], [-286.7, 1041.1], [-288.5, 1038.5], [-289.5, 1036.4], [-290.4, 1033.8], [-290.6, 1031.1],
  [-290.1, 1030.1], [-288.9, 1028.6], [-287.0, 1026.8], [-285.8, 1026.0], [-283.0, 1025.5], [-277.1, 1020.9], [-272.1, 1016.0],
];
const LOOP_HALF = 1.1;
/** the loop as LOCAL quads, each run 0.15 u past its ends (scan-filled polygons that only share an edge leave a crack) */
export const HERON_SHORE_DECKS: Vec2[][] = SHORE_LOOP.slice(1).map(([bx, bz], i) => {
  const [ax, az] = SHORE_LOOP[i], L = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / L, uz = (bz - az) / L, px = -uz * LOOP_HALF, pz = ux * LOOP_HALF;
  const p = (x: number, z: number): Vec2 => ({ x: +(x - X0).toFixed(2), z: +(z - Z0).toFixed(2) });
  const a0 = [ax - ux * 0.15, az - uz * 0.15], b0 = [bx + ux * 0.15, bz + uz * 0.15];
  return [p(a0[0] + px, a0[1] + pz), p(b0[0] + px, b0[1] + pz), p(b0[0] - px, b0[1] - pz), p(a0[0] - px, a0[1] - pz)];
});
/** half-width 1.3: the raster stands a cell only when its 8 neighbours walk, so a 1.7 u deck left one 0.5 u column (too thin for the 0.75 u nav grid) */
const BRIDGE_HALF = 1.3;
/** the deck pieces as LOCAL polygons with their local y (over the site's base) */
export const HERON_BRIDGE_DECKS: { poly: Vec2[]; y: number }[] = BRIDGES.flatMap(({ a, b, spans }) => {
  const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L, px = -uz * BRIDGE_HALF, pz = ux * BRIDGE_HALF;
  const at = (t: number, s: number): Vec2 => ({ x: +(a[0] + ux * t + px * s - X0).toFixed(2), z: +(a[1] + uz * t + pz * s - Z0).toFixed(2) });
  // neighbouring spans overlap 0.3 u (the rasteriser's scan fill leaves a crack of cells between polygons that only
  // share an edge; where two overlap, the first listed wins)
  return spans.map(([t0, t1, y]) => ({ poly: [at(t0 - 0.15, -1), at(t1 + 0.15, -1), at(t1 + 0.15, 1), at(t0 - 0.15, 1)], y: +(y - g.base).toFixed(2) }));
});

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
  swap: { parts: [w4SwapPart(SWAP_ROW, g.at)], build: b => { stoneBase(b); causeways(b); }, ship: SWAP_ROW.ship, note: SWAP_ROW.note },
  ...(SWAP_ROW.ship && SWAP_ROW.fade ? { fade: SWAP_ROW.fade } : {}),
  walk: {
    blockers: SWAP_ROW.ship ? SWAP_ROW.blockers : oct(R_COL).map(p => ({ x: p.x, z: p.z, r: 0.25 })),
    surfaces: [
      { poly: oct(R_FLOOR), y: FLOOR, surface: 'plaza' },
      ...CAUSEWAYS.map(c => ({ poly: causeway(c), y: BASE + 0.2, surface: 'plaza' as const })),
      ...HERON_BRIDGE_DECKS.map(d => ({ poly: d.poly, y: d.y, surface: 'wood' as const })),
      ...HERON_SHORE_DECKS.map(poly => ({ poly, y: 'terrain' as const, surface: 'dirt' as const })),
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
    // on the south causeway, facing the pavilion (lane L, W4-L7: the 1.1 u gaps between the columns are narrower than
    // a walker's clearance, so the floor inside is looked into, not walked to)
    arrival: { x: 0, z: 3.0, heading: Math.PI },
    photo: { target: [0, 2.2, 0], distance: 16, elevation: 0.22, bearing: 1.4 },
    flag: { x: 0, z: 0, h: 30 },
    height: { realM: 8.5, u: 4.5, top: 5.0, rule: 'H = 3.2 + 0.155·h' },
    osm: ['way/120479810'],
    terrain: [-6, -5, 6, 6],
    aiSlot: { model: 'w4-chinese-pavilion', id: 'sf-chinese-pavilion', at: [0, BASE, 0], note: 'lane V (data/sf/w4Models.ts, sf-chinese-pavilion): 2,940 triangles, 5.62 × 4.5 × 5.61 u, placed at the origin with scale 1 at local y BASE; the column blockers match its ring' },
    notes: 'Walk data for the island (W4-L7): decks on both footbridges and along the shore loop, so the pavilion is reached from Stow Lake Drive over either bridge. Walk-around ring 74 %: the lake closes the east side and the hill\'s steep flank the west, above the loop.',
    ringMin: 0.7,
  },
};
