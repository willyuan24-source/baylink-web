import type { Vec2 } from '../../../core/types';
import { type BatchLike, ICO, M } from '../../builder';
import { worldPoly } from './kit';
import { FC, GC, PAT, type SiteGroundPoly, type W4Site, bench, gfill, lamp, plazaOf } from './siteKit';
import { box3, lowWall, site3Ground, stairFlight } from './siteKit3';

/**
 * Lyon Street Steps (wave 4, P4 · map T3, Pacific Heights / the Presidio's edge): about 288 steps in flights and
 * landings from Broadway down to Green Street along the Presidio's wall, lined with clipped hedges and flower beds,
 * looking straight down on the Palace of Fine Arts dome, the Marina and the bay (SFGate, 2023; the step count varies
 * by source). Residential on the east side.
 *
 * Toy: the upper run, Broadway to Vallejo — the top landing with a bench and a lamp facing the view, the two upper
 * flights (one box a step), the low stone wall on the Presidio side, clipped hedges on the house side, the middle
 * landing's planted bed with its walks round it, and the lower lamp. The flights below Vallejo stay the city's.
 *
 * Frame: origin (−293.14, 512.25) at the head of the first flight, yaw −127°: local +z runs down the steps toward the
 * Palace of Fine Arts (≈ 156 u away, straight ahead) on x = 0 (OSM steps "Lyon Street"): the top landing z −2.4…−0.33
 * with the viewpoint (OSM node 7221410485, local (0.43, −2.0)) and Broadway's centreline at z ≈ −2.3; flight one
 * z −0.33…3.36 (22.8 → 21.7 over sea level in the city data), a landing, flight two z 4.24…8.24 (down to 19.8), the
 * middle landing with its bed z 8.2…10.4, then the city's steps to Vallejo (z ≈ 12.5). The Presidio's forest is at
 * x > 1.7, the houses at x < −1.6.
 */

const ID = 'lyon-street-steps';
const X0 = -293.14, Z0 = 512.25, YAW = (-127 * Math.PI) / 180;
const g = site3Ground(ID, 19.4);

const STEP = '#d8d1c3', NOSE = '#cbc3b3', WALL = '#b3a58c', HEDGE = '#5f8f4e';
/** the two upper flights (x 0, 1.5 u wide) between their landings */
const FLIGHTS: [number, number][] = [[-0.33, 3.36], [4.24, 8.24]];
const SW = 1.5;

/** a clipped hedge run stepping down with the ground (one box per ≤ 1.4 u) */
function hedgeRun(b: BatchLike, x: number, z0: number, z1: number, h = 0.75) {
  const n = Math.max(1, Math.ceil((z1 - z0) / 1.4));
  for (let k = 0; k < n; k++) {
    const a = z0 + ((z1 - z0) * k) / n, c = z0 + ((z1 - z0) * (k + 1)) / n, y = Math.max(g.at(x, a), g.at(x, c));
    box3(b, x, y - 0.3, (a + c) / 2, 0.5, h + 0.3, c - a + 0.02, HEDGE, 0, [0, 0, 0.12, 0]);
  }
}

function build(b: BatchLike, lod: 0 | 2) {
  if (lod === 2) {
    // far: the hedge line and the Presidio wall as two long blocks
    box3(b, -1.32, g.at(-1.32, 4) - 0.3, 4, 0.5, 1.2, 9.5, HEDGE);
    box3(b, 1.55, g.at(1.55, 4) - 0.3, 4, 0.35, 1.2, 9.5, WALL);
    return;
  }
  for (const [z0, z1] of FLIGHTS) stairFlight(b, { x: 0, z: z0 }, { x: 0, z: z1 }, g.at(0, z0), g.at(0, z1), SW, STEP, NOSE);
  // the Presidio's low stone wall on the +x side, the hedges on the house side
  for (const [z0, z1] of [[-0.4, 2.0], [2.0, 4.3], [4.3, 6.5], [6.5, 8.4], [8.4, 10.5]]) lowWall(b, { x: 1.55, z: z0 }, { x: 1.55, z: z1 }, g.at(1.55, z0), g.at(1.55, z1), 0.55, 0.32, WALL);
  hedgeRun(b, -1.29, -0.3, 8.1);
  // the middle landing's planted bed along the house side: the clipped hedge carries on past the landing with two round
  // topiaries on it (W6-W3, lane W: the bed stood in the middle, 1.2 u wide, and left 0.76 u either side — too narrow for a
  // walker, the steps below were cut off; the landing is open from the hedge to the wall now, as the flights are)
  hedgeRun(b, -1.29, 8.6, 10.05);
  for (const tz of [8.95, 9.7]) b.add(ICO(0), M(-1.29, g.at(-1.29, tz) + 0.85, tz, tz * 3, 0.3, 0.42, 0.3), FC.treeDark, [0, 0, 0.2, 0]);
  // the top landing: a bench facing the view, lamps at the top and the middle landing
  bench(b, 0.98, g.at(0.98, -1.05), -1.05, 0);
  lamp(b, -1.19, g.at(-1.19, -0.7), -0.7);
  lamp(b, 1.18, g.at(1.18, 3.8), 3.8);
}

function ground(): SiteGroundPoly[] {
  return [
    ...gfill([{ x: -0.77, z: 3.36 }, { x: 0.77, z: 3.36 }, { x: 0.77, z: 4.24 }, { x: -0.77, z: 4.24 }], GC.pavers, PAT.stone, g, 3, 0.07),
    ...gfill([{ x: -1.02, z: 8.24 }, { x: 1.28, z: 8.24 }, { x: 1.28, z: 10.55 }, { x: -1.02, z: 10.55 }], GC.pavers, PAT.stone, g, 3, 0.07),
  ];
}

const BLOCKERS = [
  { poly: [{ x: 1.38, z: -0.45 }, { x: 1.73, z: -0.45 }, { x: 1.73, z: 10.6 }, { x: 1.38, z: 10.6 }] },
  { poly: [{ x: -1.55, z: -0.35 }, { x: -1.03, z: -0.35 }, { x: -1.03, z: 8.15 }, { x: -1.55, z: 8.15 }] },
  { poly: [{ x: -1.59, z: 8.58 }, { x: -0.99, z: 8.58 }, { x: -0.99, z: 10.05 }, { x: -1.59, z: 10.05 }] },
];

/** exclusion: the corridor between the houses and the Presidio's forest, from the top landing (Broadway's ribbon
 *  ends at z −0.5) to the middle landing (Vallejo's starts at z ≈ 10.7) */
const EXCLUDE: Vec2[] = [{ x: -1.59, z: -0.48 }, { x: 1.75, z: -0.48 }, { x: 1.75, z: 10.65 }, { x: -1.59, z: 10.65 }];

export const lyonStreetSteps: W4Site = {
  id: ID,
  tier: 3,
  x: X0,
  z: Z0,
  yaw: YAW,
  base: g.base,
  sink: 0,
  exclude: { poly: worldPoly(X0, Z0, YAW, EXCLUDE) },
  build,
  // W6-W3 (lane W): the city's lower flights below the middle landing (Vallejo, then down to Green St) are an OSM steps
  // line narrower than a walker's disc on the steep ground either side: one stairs surface 3 u wide carries the walk (and
  // the Lyon stair race) down to lz 20
  walk: { blockers: BLOCKERS, surfaces: [{ poly: [{ x: -1.5, z: 10.4 }, { x: 1.5, z: 10.4 }, { x: 1.5, z: 20.0 }, { x: -1.5, z: 20.0 }], y: 'terrain', surface: 'stairs' }] },
  ground: ground(),
  lights: [{ x: -1.19, y: g.at(-1.19, -0.7) + 3.8, z: -0.7, size: 1, color: '#ffd9a0' }, { x: 1.18, y: g.at(1.18, 3.8) + 3.8, z: 3.8, size: 1, color: '#ffd9a0' }],
  plaza: [plazaOf([{ x: -1.0, z: -0.45 }, { x: 1.35, z: -0.45 }, { x: 1.35, z: 10.55 }, { x: -1.0, z: 10.55 }], 'pavement'), plazaOf([{ x: -4.07, z: -1.8 }, { x: 3.93, z: -1.8 }, { x: 3.93, z: -0.45 }, { x: -4.07, z: -0.45 }], 'pavement')],
  w4: {
    placeId: 'osm-n7221410485',
    attractions: ['lyon-street-steps'],
    arrival: { x: 0.03, z: -0.7, heading: 0 },
    photo: { target: [0.03, 1.0, 14], distance: 15.5, elevation: 0.22, bearing: Math.PI },
    flag: { x: 0, z: 1.5, h: 30 },
    height: { realM: 0, u: 1.2, top: 8.85, rule: 'overlook' },
    osm: ['node/7221410485'],
    terrain: [-2.6, -2.2, 2.4, 11],
    terrainStep: 1,
    notes: 'The view point: straight down the steps to the Palace of Fine Arts dome. Residential on the house side (the hedges); the flights below Vallejo are the city\'s steps.',
  },
};
