import type { Vec2 } from '../../../core/types';
import { BOX, type BatchLike, M } from '../../builder';
import { NONE, cyl, lathe, rect, worldPoly } from './kit';
import { type W4Site, bench, siteGround } from './siteKit';

/**
 * Blue Heron Lake (formerly Stow Lake; wave 4, P3 · map T2, the blue-heron-lake site): the 1893 boating lake that
 * rings Strawberry Hill in Golden Gate Park, renamed on 18 January 2024 (sfrecpark.org). The lake, the island, its
 * paths and the waterfall are the city's; this site is the Chinese Pavilion on the island's east shore, the 1981 gift of
 * San Francisco's sister city Taipei: eight bold red columns under a grey-green tiled roof (the Arts Commission's
 * colours, chosen to show through the foliage; sfrecpark.org, Richmond Review 2021) on a low stone platform, with
 * benches facing the water. The roof carvings are never reproduced; lane V's small AI pavilion may replace the body.
 *
 * Frame: origin (−251.7, 1017.5) at the pavilion (OSM way 120479810), yaw 0 (local = world offsets): the island path
 * reaches it from the south-west ((−2.7, −1.3) → (−0.7, 0.9)) and goes on north; the lake shore is ≈ 3 u east, the
 * lakeside promenade on the far shore ≈ 13 u east.
 */

const ID = 'blue-heron-lake';
const X0 = -251.7, Z0 = 1017.5, YAW = 0;
const g = siteGround(ID, 19.5);

const RED = '#b8322a', ROOF = '#7f9483', STONE = '#c9c1b2', GOLD = '#c9a64a';
const R_COL = 1.45, R_PLAT = 1.9, EAVE = 2.25;
/** the platform top (local y): the city draws the lake up to the pavilion, so it stands on a stone base at the
 *  water's edge, reached by two short causeways from the island path (land 0.49–0.53 u at their ends) */
const Y = 0.45;
const SW = rect(-2.15, -1.15, 1.2, 2.3, 1.08), NORTH = rect(0.85, 2.2, 1.2, 1.8, 0.53);
const oct = (r: number): Vec2[] => Array.from({ length: 8 }, (_, k) => ({ x: Math.sin((k * Math.PI) / 4 + Math.PI / 8) * r, z: Math.cos((k * Math.PI) / 4 + Math.PI / 8) * r }));

function build(b: BatchLike, lod: 0 | 2) {
  const y0 = Y;
  if (lod === 2) {
    lathe(b, [[R_PLAT, -0.8], [R_PLAT, 0]], 0, y0, 0, STONE, NONE, 6);
    lathe(b, [[EAVE, 0], [0.05, 1.2]], 0, y0 + 2.2, 0, ROOF, NONE, 6);
    return;
  }
  // stone platform, eight red columns, a red beam ring, the upswept roof with its finial
  lathe(b, [[R_PLAT + 0.1, -0.9], [R_PLAT + 0.1, -0.05], [R_PLAT, 0]], 0, y0, 0, STONE, NONE, 8);
  for (const p of oct(R_COL)) cyl(b, p.x, y0, p.z, 0.13, 2.2, RED, NONE, 6);
  lathe(b, [[R_COL + 0.2, 0], [R_COL + 0.2, 0.3], [R_COL - 0.2, 0.3], [R_COL - 0.2, 0]], 0, y0 + 2.05, 0, RED, NONE, 8);
  lathe(b, [[EAVE + 0.1, 0.1], [EAVE - 0.1, 0.05], [1.6, 0.3], [0.9, 0.8], [0.35, 1.2], [0.08, 1.35]], 0, y0 + 2.3, 0, ROOF, NONE, 8);
  lathe(b, [[0.16, 0], [0.12, 0.3], [0.2, 0.42], [0.02, 0.7]], 0, y0 + 3.6, 0, GOLD, NONE, 6);
  // a low red railing between the columns, open to the path (south-west) and the water (east)
  const P = oct(R_COL);
  for (let k = 0; k < 8; k++) {
    if (k === 2 || k === 5) continue;
    const a = P[k], c = P[(k + 1) % 8], mx = (a.x + c.x) / 2, mz = (a.z + c.z) / 2;
    b.add(BOX(), M(mx, y0 + 0.35, mz, Math.atan2(c.x - a.x, c.z - a.z), 0.08, 0.3, Math.hypot(c.x - a.x, c.z - a.z) - 0.26), RED);
  }
  // the causeways (stone slabs down to the lake bed) and a bench inside facing the water
  for (const [cx, cz, len, ry] of [[-2.15, -1.15, 2.3, 1.08], [0.85, 2.2, 1.8, 0.53]] as const) b.add(BOX(), M(cx, Y - 1.0, cz, ry, 1.2, 1.0, len), STONE);
  bench(b, 0.55, Y, 0.0, Math.PI / 2);
}

/** exclusion: the platform, the roof's reach and the causeways (the island path around them stays the city's) */
const EXCLUDE: Vec2[] = [
  { x: -0.84, z: 2.03 }, { x: 0.1, z: 1.9 }, { x: 0.35, z: 3.2 }, { x: 1.65, z: 3.2 }, { x: 2.03, z: 0.84 }, { x: 2.03, z: -0.84 },
  { x: 0.84, z: -2.03 }, { x: -0.84, z: -2.03 }, { x: -2.6, z: -2.4 }, { x: -3.6, z: -1.6 }, { x: -2.03, z: 0.84 },
];

export const blueHeronLake: W4Site = {
  id: ID,
  tier: 2,
  x: X0,
  z: Z0,
  yaw: YAW,
  base: g.base,
  exclude: { poly: worldPoly(X0, Z0, YAW, EXCLUDE) },
  build,
  walk: {
    blockers: oct(R_COL).map(p => ({ x: p.x, z: p.z, r: 0.15 })),
    surfaces: [{ poly: oct(R_PLAT), y: Y, surface: 'plaza' }, { poly: SW, y: Y, surface: 'plaza' }, { poly: NORTH, y: Y, surface: 'plaza' }],
  },
  plaza: [
    { poly: oct(R_PLAT), surface: 'plaza' },
    // the island path's approach, and the promenade on the far shore that looks across at the pavilion
    { poly: [{ x: -5.5, z: -3.5 }, { x: -2.6, z: -2.6 }, { x: -2.2, z: 1.2 }, { x: -4.8, z: 1.8 }], surface: 'dirt' },
    { poly: [{ x: 12.2, z: -1.0 }, { x: 13.6, z: -1.4 }, { x: 15.8, z: 4.0 }, { x: 14.4, z: 4.4 }], surface: 'pavement' },
  ],
  w4: {
    placeId: 'stow-lake',
    attractions: ['blue-heron-lake'],
    arrival: { x: -0.1, z: -0.5, heading: Math.PI / 2 },
    photo: { target: [0, 1.8, 0], distance: 16, elevation: 0.22, bearing: 1.4 },
    flag: { x: 0, z: 0, h: 30 },
    height: { realM: 0, u: 3.9, rule: 'ground' },
    osm: ['way/120479810'],
    terrain: [-6, -5, 6, 6],
    aiSlot: { model: 'w4-chinese-pavilion', note: 'lane V: the small Chinese Pavilion (red columns, grey-green upswept roof, no carvings copied), ≤ 6k, the same octagon footprint and column blockers' },
    notes: 'Height by eye (a one-storey open pavilion); the bridges to Strawberry Hill are the city\'s paths (their walk strips wait for the integration).',
  },
};
