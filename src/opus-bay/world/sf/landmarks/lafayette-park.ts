import type { Vec2 } from '../../../core/types';
import type { BatchLike } from '../../builder';
import { worldPoly } from './kit';
import { FC, GC, PAT, type SiteGroundPoly, type W4Site, bench, conifer, gfill, gstrip, lamp, plazaOf } from './siteKit';
import { box3, signBoard, site3Ground } from './siteKit3';

/**
 * Lafayette Park (wave 4, P4 · map T3, Pacific Heights): 12.5 acres on a hilltop between Washington, Sacramento, Gough
 * and Laguna Streets among the Pacific Heights mansions, with views over the Marina to Alcatraz and the bay and back to
 * Buena Vista Park and Twin Peaks; two tennis courts, a playground, an off-leash dog area and a picnic area
 * (Wikipedia "Lafayette Park (San Francisco)"; sfrecpark.org).
 *
 * Toy: the summit (OSM "Lafayette Heights", node 7707941355) — the lawn inside the summit walk (redrawn on the city's
 * line), three benches facing north over the bay, two cypresses, a lamp and a blank park board; the walks leaving it
 * are the city's (the site redraws their first metre).
 *
 * Frame: origin (−119.34, 355.7) in the summit walk's loop (ground 24.7 over the sea in the city data: the park's top),
 * yaw 0 (the city frame): north (the bay) is up-left, local −z roughly; the loop runs from its south-east corner
 * (2.21, 3.11) up the east side to the north (0.8, −3.1) and back by the west (−2.73, 0.02).
 */

const ID = 'lafayette-park';
const X0 = -119.34, Z0 = 355.7, YAW = 0;
const g = site3Ground(ID, 24.2);

/** the summit walk (closed, the city's line) and the links out of it (the site's first metre of each) */
const LOOP: Vec2[] = [{ x: 2.21, z: 3.11 }, { x: 2.73, z: 0.29 }, { x: 2.45, z: -1.5 }, { x: 1.5, z: -2.8 }, { x: 0.78, z: -3.11 }, { x: -0.07, z: -2.99 }, { x: -1.43, z: -1.87 }, { x: -2.73, z: 0.02 }, { x: -0.11, z: 1.41 }, { x: 2.21, z: 3.11 }];
const LAWN: Vec2[] = [{ x: 1.8, z: 2.1 }, { x: 2.1, z: 0.3 }, { x: 1.9, z: -1.2 }, { x: 1.2, z: -2.2 }, { x: 0.1, z: -2.4 }, { x: -1.1, z: -1.5 }, { x: -2.0, z: -0.1 }, { x: -0.1, z: 0.8 }];
const LINKS: Vec2[][] = [[{ x: -2.73, z: 0.02 }, { x: -3.75, z: 0.62 }], [{ x: 2.21, z: 3.11 }, { x: 3.45, z: 3.95 }]];
const BENCHES: [number, number][] = [[-0.6, -1.3], [0.9, -1.7], [1.5, 0.2]];

function build(b: BatchLike, lod: 0 | 2) {
  if (lod === 2) {
    box3(b, 1.4, g.at(1.4, 0.9) - 0.2, 0.9, 1.6, 4.5, 1.6, FC.pine);
    return;
  }
  for (const [x, z] of BENCHES) bench(b, x, g.at(x, z), z, Math.PI);
  conifer(b, 1.4, g.at(1.4, 0.9), 0.9, 1.5);
  conifer(b, -1.2, g.at(-1.2, 0.0), 0.0, 1.3);
  lamp(b, 2.9, g.at(2.9, 1.9), 1.9);
  signBoard(b, 2.9, g.at(2.9, 3.4), 3.4, Math.PI / 2, 0.9, 0.55, 0.6, '#e2d8c0', '#5d4a38');
}

function ground(): SiteGroundPoly[] {
  return [
    ...gfill(LAWN, GC.lawn, PAT.grass, g, 2, 0.08),
    ...gstrip(LOOP, 1.15, GC.path, PAT.earth, g, 1.5, 0.08),
    ...LINKS.flatMap(l => gstrip(l, 1.15, GC.path, PAT.earth, g, 2, 0.08)),
  ];
}

/** exclusion: the loop and a metre round it (the walks beyond, the courts and the lawns stay the city's) */
const EXCLUDE: Vec2[] = [{ x: 3.3, z: 3.9 }, { x: 3.6, z: 0.3 }, { x: 3.3, z: -1.9 }, { x: 2.0, z: -3.8 }, { x: 0.8, z: -4.1 }, { x: -0.3, z: -3.9 }, { x: -1.9, z: -2.3 }, { x: -3.3, z: 0.1 }, { x: -0.3, z: 2.3 }, { x: 1.6, z: 3.9 }];

export const lafayettePark: W4Site = {
  id: ID,
  tier: 3,
  x: X0,
  z: Z0,
  yaw: YAW,
  base: g.base,
  sink: 0,
  exclude: { poly: worldPoly(X0, Z0, YAW, EXCLUDE) },
  build,
  walk: { blockers: [{ x: 1.4, z: 0.9, r: 0.3 }, { x: -1.2, z: 0.0, r: 0.3 }, { x: 2.9, z: 3.4, r: 0.2 }] },
  ground: ground(),
  lights: [{ x: 2.9, y: g.at(2.9, 1.9) + 3.8, z: 1.9, size: 1, color: '#ffd9a0' }],
  plaza: [plazaOf(EXCLUDE, 'grass')],
  w4: {
    placeId: 'osm-w16751838',
    attractions: ['lafayette-park'],
    // W5-L1: 188 u from the Grace / Nob Hill gate spot (398k of the 400k triangles): the full model only within 170 u
    lod0R: 170,
    arrival: { x: 2.6, z: -0.6, heading: -2.6 },
    photo: { target: [0.3, 1.0, -0.6], distance: 12, elevation: 0.45, bearing: 0.6 },
    flag: { x: 0.3, z: -0.8, h: 30 },
    height: { realM: 0, u: 1.0, top: 6.84, rule: 'overlook' },
    osm: ['way/16751838', 'node/7707941355'],
    terrain: [-4, -5, 4, 5],
    terrainStep: 1,
    notes: 'The courts, the playground and the dog area are the city\'s lawns and pitches; the crowd spots are the summit.',
  },
};
