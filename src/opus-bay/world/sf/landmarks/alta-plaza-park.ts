import type { Vec2 } from '../../../core/types';
import type { BatchLike } from '../../builder';
import { worldPoly } from './kit';
import { FC, GC, PAT, type SiteGroundPoly, type W4Site, bench, gstrip, lamp, plazaOf } from './siteKit';
import { box3, lowWall, site3Ground, stairFlight } from './siteKit3';

/**
 * Alta Plaza Park (wave 4, P4 · map T3, Pacific Heights): a 12.9-acre hilltop park of 1888 between Jackson, Clay,
 * Steiner and Scott Streets, with terraced lawns stepping down to Clay Street and city views; the grand stairs at the
 * head of Pierce Street are the ones the cars careened down in the chase of "What's Up, Doc?" (1972), and the damage can
 * still be seen (Wikipedia "Alta Plaza Park"; San Francisco Chronicle).
 *
 * Toy: the terraced south front — the grand stairs at the head of Pierce Street (four flights between the terrace
 * walks), the low stone retaining walls at each terrace's edge, the terrace walks redrawn, two benches facing the view
 * and two lamps. The lawns, the courts and the rest of the park are the city's.
 *
 * Frame: origin (−192.0, 457.8) on the grand stairs, yaw 55.1°: local +z points down the stairs to Clay Street
 * (centreline z 6.43, its north kerb 4.6) and Pierce Street beyond it (along x = 0); the terrace walks run along x at
 * z −3.1 (19.6 over the sea in the city data), −1.3, 1.0 and 3.4 (16.8).
 */

const ID = 'alta-plaza-park';
const X0 = -192.0, Z0 = 457.8, YAW = (55.1 * Math.PI) / 180;
const g = site3Ground(ID, 15.8);

const STEP = '#d9d2c4', NOSE = '#c9c1b1', WALL = '#b9ad98';
/** the terrace walks (z) and the flights of the grand stairs between them (z0 → z1) */
const WALKS = [-3.11, -1.28, 0.96, 3.38];
const FLIGHTS: [number, number][] = [[-2.56, -1.88], [-0.85, 0.45], [1.47, 2.74], [3.71, 4.35]];
/** retaining walls at the downhill edge of each terrace (z), leaving the stairs (|x| < 1.25) open */
const WALLS = [-2.3, 0.2, 2.45];
const XW = 11.5;

function build(b: BatchLike, lod: 0 | 2) {
  if (lod === 2) {
    for (const z of WALLS) box3(b, 0, g.at(0, z) - 0.3, z, XW * 2, 0.8, 0.3, WALL);
    return;
  }
  for (const [z0, z1] of FLIGHTS) stairFlight(b, { x: 0, z: z0 }, { x: 0, z: z1 }, g.at(0, z0), g.at(0, z1), 2.2, STEP, NOSE);
  for (const z of WALLS) for (const [x0, x1] of [[-XW, -1.25], [1.25, XW]]) lowWall(b, { x: x0, z }, { x: x1, z }, g.at(x0, z), g.at(x1, z), 0.45, 0.35, WALL);
  // the stair cheeks (short walls either side of each flight)
  for (const [z0, z1] of FLIGHTS) for (const x of [-1.2, 1.2]) lowWall(b, { x, z: z0 }, { x, z: z1 }, g.at(x, z0), g.at(x, z1), 0.35, 0.22, WALL);
  bench(b, -4.2, g.at(-4.2, -3.75), -3.75, 0);
  bench(b, 4.2, g.at(4.2, -3.75), -3.75, 0);
  lamp(b, -1.9, g.at(-1.9, -3.6), -3.6);
  lamp(b, 1.9, g.at(1.9, 1.6), 1.6);
  box3(b, 0, g.at(0, -3.9) - 0.1, -3.9, 0.3, 0.35, 0.3, FC.bin);
}

function ground(): SiteGroundPoly[] {
  // the top walk ends where the city's turns away (x −10 … 9.8); the lower ones run on past the exclusion's sides
  return WALKS.flatMap((z, i) => gstrip(i === 0 ? [{ x: -10.0, z }, { x: 9.8, z }] : [{ x: -XW - 0.5, z }, { x: XW + 0.5, z }], 1.25, GC.pavers, PAT.stone, g, 1.5, 0.1));
}

/** exclusion: the terraced front between x ±12 (the courts, the lawns and Clay Street's ribbon stay the city's) */
const EXCLUDE: Vec2[] = [{ x: -12.2, z: -3.85 }, { x: 12.2, z: -3.85 }, { x: 12.2, z: 4.4 }, { x: -12.2, z: 4.4 }];

export const altaPlazaPark: W4Site = {
  id: ID,
  tier: 3,
  x: X0,
  z: Z0,
  yaw: YAW,
  base: g.base,
  sink: 0,
  exclude: { poly: worldPoly(X0, Z0, YAW, EXCLUDE) },
  build,
  walk: { blockers: [...WALLS.flatMap(z => [[-XW, -1.25], [1.25, XW]].map(([x0, x1]) => ({ poly: [{ x: x0, z: z - 0.18 }, { x: x1, z: z - 0.18 }, { x: x1, z: z + 0.18 }, { x: x0, z: z + 0.18 }] }))), { x: 0, z: -3.9, r: 0.2 }] },
  ground: ground(),
  lights: [{ x: -1.9, y: g.at(-1.9, -3.6) + 3.8, z: -3.6, size: 1, color: '#ffd9a0' }, { x: 1.9, y: g.at(1.9, 1.6) + 3.8, z: 1.6, size: 1, color: '#ffd9a0' }],
  plaza: WALKS.map(z => plazaOf([{ x: -XW, z: z - 0.6 }, { x: XW, z: z - 0.6 }, { x: XW, z: z + 0.6 }, { x: -XW, z: z + 0.6 }], 'pavement')),
  w4: {
    placeId: 'osm-w16751737',
    attractions: ['alta-plaza-park'],
    arrival: { x: 0.6, z: -3.4, heading: 0 },
    photo: { target: [0, 2.0, 1.0], distance: 16, elevation: 0.3, bearing: 0.25 },
    flag: { x: 0, z: -3.3, h: 30 },
    height: { realM: 0, u: 1.0, top: 8.63, rule: 'overlook' },
    osm: ['way/16751737'],
    terrain: [-13, -5, 13, 6],
    terrainStep: 1,
    notes: 'The famous stairs of the "What\'s Up, Doc?" chase (1972); no cars on them here. The lawns, the courts and the playground are the city\'s.',
  },
};
