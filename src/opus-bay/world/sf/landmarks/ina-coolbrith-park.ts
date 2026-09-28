import type { Vec2 } from '../../../core/types';
import type { BatchLike } from '../../builder';
import { worldPoly } from './kit';
import { GC, PAT, type SiteGroundPoly, type W4Site, bench, gfill, lamp, planter, plazaOf } from './siteKit';
import { box3, lowWall, signBoard, site3Ground } from './siteKit3';

/**
 * Ina Coolbrith Park (wave 4, P4 · map T3, Russian Hill): a 0.8-acre terraced hillside park at Vallejo and Taylor
 * Streets, steep enough that the climb is part of the visit, with benches and views over the city and the bay
 * (sfrecpark.org "Ina Coolbrith Park"; San Francisco Chronicle 2024). It is named for Ina Coolbrith, California's first
 * poet laureate (named on 30 June 1915 at the Panama-Pacific Exposition; Wikipedia). The Vallejo Street steps drop from it toward Mason Street.
 *
 * Toy: the top terrace by Taylor Street — a paved overlook, a low stone parapet on the downhill edge, three benches
 * facing the view, two planters, a lamp and a blank plaque (no text). The steep slope, its paths and the Vallejo
 * Street steps are the city's.
 *
 * Frame: origin (−70.2, 164.2) on the top terrace (≈ 20 over the sea in the city data), yaw 145.1°: local +z faces the
 * view (north-east, down the slope), +x runs north-west along Taylor Street, whose centreline is at z −2.98 (3.6 u
 * wide); the terrace ends at z ≈ 2.5 where the slope falls away.
 */

const ID = 'ina-coolbrith-park';
const X0 = -70.2, Z0 = 164.2, YAW = (145.1 * Math.PI) / 180;
const g = site3Ground(ID, 19.2);

const STONE = '#c2b8a4';
const PAD: Vec2[] = [{ x: -2.8, z: -0.7 }, { x: 2.8, z: -0.7 }, { x: 2.8, z: 2.2 }, { x: -2.8, z: 2.2 }];
const BENCHES = [-1.8, 0, 1.8];

function build(b: BatchLike, lod: 0 | 2) {
  if (lod === 2) {
    box3(b, 0, g.at(0, 2.5) - 0.3, 2.5, 5.8, 0.9, 0.3, STONE);
    return;
  }
  for (const [x0, x1] of [[-2.9, -0.95], [-0.95, 0.95], [0.95, 2.9]]) lowWall(b, { x: x0, z: 2.5 }, { x: x1, z: 2.5 }, g.at(x0, 2.5), g.at(x1, 2.5), 0.55, 0.3, STONE);
  for (const x of BENCHES) bench(b, x, g.at(x, 1.55), 1.55, 0);
  planter(b, -2.2, g.at(-2.2, 0.3), 0.3, 0.6, 1.0);
  planter(b, 2.2, g.at(2.2, 0.3), 0.3, 0.6, 1.0);
  lamp(b, 2.6, g.at(2.6, -0.6), -0.6);
  signBoard(b, -2.5, g.at(-2.5, -0.6), -0.6, Math.PI, 0.5, 0.35, 0.6, '#6d5b3f', '#3f3a33');
}

function ground(): SiteGroundPoly[] {
  return gfill(PAD, GC.pavers, PAT.stone, g, 1.5, 0.11);
}

export const inaCoolbrithPark: W4Site = {
  id: ID,
  tier: 3,
  x: X0,
  z: Z0,
  yaw: YAW,
  base: g.base,
  sink: 0,
  // the top terrace: 1.9 u clear of Taylor Street's centreline, to the head of the slope
  exclude: { poly: worldPoly(X0, Z0, YAW, [{ x: -3.3, z: -1.05 }, { x: 3.3, z: -1.05 }, { x: 3.3, z: 2.75 }, { x: -3.3, z: 2.75 }]) },
  build,
  walk: {
    // the parapet stands on the head of the slope, which the city's walk raster already closes: only the planters block
    blockers: [{ x: -2.2, z: 0.3, r: 0.5 }, { x: 2.2, z: 0.3, r: 0.5 }],
  },
  ground: ground(),
  lights: [{ x: 2.6, y: g.at(2.6, -0.6) + 3.8, z: -0.6, size: 1, color: '#ffd9a0' }],
  plaza: [plazaOf([{ x: -3.5, z: -3.0 }, { x: 3.5, z: -3.0 }, { x: 3.5, z: 2.1 }, { x: -3.5, z: 2.1 }], 'pavement')],
  w4: {
    placeId: 'osm-w114151121',
    attractions: ['ina-coolbrith-park'],
    arrival: { x: 0.9, z: 0.4, heading: 0 },
    photo: { target: [0, 0.5, 6], distance: 12, elevation: 0.25, bearing: Math.PI },
    flag: { x: 0, z: 0.6, h: 30 },
    height: { realM: 0, u: 1.0, top: 5.91, rule: 'overlook' },
    osm: ['way/114151121'],
    terrain: [-4, -3, 4, 3],
    terrainStep: 1,
    notes: 'A viewpoint on a steep slope: the crowd spots are the terrace and the Taylor Street sidewalk and lane beside it.',
  },
};
