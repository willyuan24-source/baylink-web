import type { Vec2 } from '../../../core/types';
import { BOX, type BatchLike, ICO, M } from '../../builder';
import { ngon, worldPoly } from './kit';
import { FC, GC, PAT, type SiteGroundPoly, type W4Site, gfill, gstrip, plazaOf } from './siteKit';
import { signBoard, site3Ground } from './siteKit3';

/**
 * Mount Sutro Open Space Reserve (wave 4, P4 · map T3, above UCSF Parnassus): the 911-ft hill first called Mount
 * Parnassus, whose 61 acres UCSF owns and keeps open to the public as a reserve — a eucalyptus "cloud forest" that gets
 * some 30–40 % of its moisture from fog drip, damp all summer; at the summit Rotary Meadow, a garden of native
 * California plants funded by San Francisco Rotary Club #2 in 2004 (Wikipedia "Mount Sutro"; UCSF). Sutro Tower stands
 * on the next hill.
 *
 * Toy: the summit meadow — native-grass ground, the track and the path over the top redrawn, three log seats, clumps of
 * wildflowers in poppy and lupine colours, and a blank trail board. The forest round it is the city's (its trees and
 * paths). Fog is the sky's, not the site's.
 *
 * Frame: origin (3.3, 981.9) at the summit (OSM node 12056865382, 49.9 over the sea in the city data), yaw 0 (the city
 * frame); a track crosses the top from (0.6, 1.7) to (−0.9, −2.5), a path joins it from the north-west.
 */

const ID = 'mount-sutro-open-space';
const X0 = 3.3, Z0 = 981.9, YAW = 0;
const g = site3Ground(ID, 49.0);

const MEADOW: Vec2[] = ngon(0, 0, 2.9, 14);
/** the track and the path over the top (the city's lines, redrawn inside the site) */
const TRACK: Vec2[] = [{ x: 0.52, z: 3.0 }, { x: 0.63, z: 1.74 }, { x: -0.17, z: 0.5 }, { x: -0.14, z: -0.67 }, { x: -0.87, z: -2.54 }, { x: -1.2, z: -3.3 }];
const PATH: Vec2[] = [{ x: -2.9, z: 2.2 }, { x: -2.62, z: 1.61 }, { x: -1.64, z: 1.14 }, { x: -0.17, z: 0.5 }];
const LOGS: [number, number, number][] = [[1.7, -0.9, 0.4], [1.6, 1.0, -0.3], [-1.6, -0.8, 1.2]];
const FLOWERS: [number, number, string][] = [[2.2, 0.1, '#f28c3a'], [1.0, -2.0, '#8a6bd1'], [-2.0, 0.2, '#f28c3a'], [-1.0, 2.1, '#8a6bd1'], [2.3, -1.6, '#e8d44d']];

function build(b: BatchLike, lod: 0 | 2) {
  if (lod === 2) {
    b.add(BOX(), M(1.7, g.at(1.7, -0.9), -0.9, 0.4, 1.6, 0.4, 0.45), FC.wood);
    return;
  }
  for (const [x, z, ry] of LOGS) b.add(BOX(), M(x, g.at(x, z) - 0.05, z, ry, 1.6, 0.45, 0.45), FC.wood);
  for (const [k, [x, z, c]] of FLOWERS.entries()) b.add(ICO(0), M(x, g.at(x, z) + 0.12, z, k, 0.32, 0.22, 0.32), c, [0, 0, 0.3, 0]);
  signBoard(b, 1.3, g.at(1.3, 2.4), 2.4, 0.6, 0.8, 0.5, 0.6, '#e2d8c0', '#5d4a38');
}

function ground(): SiteGroundPoly[] {
  return [
    ...gfill(MEADOW, GC.meadow, PAT.grass, g, 1.2, 0.1),
    ...gstrip(TRACK, 1.3, GC.path, PAT.earth, g, 1.2, 0.13),
    ...gstrip(PATH, 1.1, GC.path, PAT.earth, g, 1.2, 0.13),
  ];
}

export const mountSutroOpenSpace: W4Site = {
  id: ID,
  tier: 3,
  x: X0,
  z: Z0,
  yaw: YAW,
  base: g.base,
  sink: 0,
  exclude: { poly: worldPoly(X0, Z0, YAW, ngon(0, 0, 3.1, 14)) },
  build,
  walk: { blockers: [...LOGS.map(([x, z]) => ({ x, z, r: 0.35 })), { x: 1.3, z: 2.4, r: 0.2 }] },
  ground: ground(),
  plaza: [plazaOf(ngon(0, 0, 3.3, 14), 'grass')],
  w4: {
    placeId: 'osm-n12056865382',
    attractions: ['mount-sutro-open-space'],
    arrival: { x: 0.2, z: 1.3, heading: Math.PI },
    photo: { target: [0, 0.6, 0], distance: 11, elevation: 0.45, bearing: 0.8 },
    flag: { x: 0.3, z: -0.2, h: 30 },
    height: { realM: 0, u: 1.0, top: 1.74, rule: 'overlook' },
    osm: ['node/12056865382'],
    terrain: [-4, -4, 4, 4],
    terrainStep: 1,
    notes: 'UCSF\'s reserve: trails only (the card says so). The crowd spots are the summit meadow.',
  },
};
