import type { Vec2 } from '../../../core/types';
import type { BatchLike } from '../../builder';
import { worldPoly } from './kit';
import { FC, GC, PAT, type SiteGroundPoly, type W4Site, bench, gfill, plazaOf } from './siteKit';
import { box3, markerStone, signBoard, site3Ground } from './siteKit3';

/**
 * China Beach (wave 4, P4 · map T3, Sea Cliff): a tiny sheltered cove between Lands End and Baker Beach looking at the
 * Marin Headlands and the Golden Gate, named for the Chinese fishermen who anchored their junks in the cove and camped
 * on the beach from Gold Rush times; a monument that Chinese Americans put up in 1982 honours them at the trailhead by
 * the parking at the end of Sea Cliff Avenue. A paved drive and a stairway lead down to the water; picnic tables and
 * grills; no lifeguards, swimming not recommended (parksconservancy.org "China Beach"; hmdb 52925; NPS "Vestiges of
 * China Beach"). It was long called James D. Phelan Beach.
 *
 * Toy: the lawn above the cove by the trailhead — the monument (a stone with a plain plaque, no inscription) on a paved
 * pad, a picnic table and a grill, two benches looking over the cove, a blank board by the head of the stair (no swim
 * prompt). The beach, the old lifeguard station, the drive, the stairway and Sea Cliff Avenue's end are the city's.
 *
 * Frame: origin (−613, 969) on the lawn, yaw 0 (the city frame): the lawn falls west to the sand (x < −4); Sea Cliff
 * Avenue ends east of it (its centreline from (5.7, −1.3) to (4.1, 2.1), 3.6 u wide); the stairway starts at (2.7,
 * −3.5), the drive and the parking lie south (z < −3).
 */

const ID = 'china-beach';
const X0 = -613, Z0 = 969, YAW = 0;
const g = site3Ground(ID, 5.3);

const PAD: Vec2[] = [{ x: 0.5, z: -1.5 }, { x: 1.95, z: -1.5 }, { x: 1.95, z: -0.1 }, { x: 0.5, z: -0.1 }];

function picnicTable(b: BatchLike, x: number, z: number) {
  const y = g.at(x, z);
  box3(b, x, y + 0.62, z, 1.5, 0.08, 0.7, FC.wood);
  for (const s of [-0.62, 0.62]) box3(b, x, y + 0.35, z + s, 1.5, 0.07, 0.28, FC.wood);
  box3(b, x, y - 0.1, z, 0.12, 0.72, 0.5, FC.metal);
}

function build(b: BatchLike, lod: 0 | 2) {
  if (lod === 2) {
    box3(b, 1.2, g.at(1.2, -0.8) - 0.2, -0.8, 0.9, 0.9, 0.6, '#b9b1a3');
    return;
  }
  markerStone(b, 1.2, g.at(1.2, -0.8), -0.8, -Math.PI / 2, 1.2);
  picnicTable(b, 0, 1.5);
  const gx = -0.6, gz = 2.15, gy = g.at(gx, gz);
  box3(b, gx, gy - 0.1, gz, 0.1, 0.8, 0.1, FC.metal);
  box3(b, gx, gy + 0.7, gz, 0.5, 0.18, 0.35, '#3b3b3b');
  bench(b, -1.5, g.at(-1.5, -0.9), -0.9, -Math.PI / 2);
  bench(b, -1.5, g.at(-1.5, 0.7), 0.7, -Math.PI / 2);
  signBoard(b, 1.4, g.at(1.4, -1.9), -1.9, -Math.PI / 2, 0.9, 0.6, 0.6, '#e8dfc8', '#5d4a38');
}

function ground(): SiteGroundPoly[] {
  return gfill(PAD, GC.pavers, PAT.stone, g, 3, 0.07);
}

export const chinaBeach: W4Site = {
  id: ID,
  tier: 3,
  x: X0,
  z: Z0,
  yaw: YAW,
  base: g.base,
  sink: 0,
  // the lawn by the trailhead: 1.8 u clear of Sea Cliff Avenue's end (the drive, the stairway and the beach stay the city's)
  exclude: { poly: worldPoly(X0, Z0, YAW, [{ x: -2.3, z: -3.1 }, { x: 2.25, z: -3.1 }, { x: 2.25, z: 3.2 }, { x: -2.3, z: 3.2 }]) },
  build,
  walk: {
    blockers: [
      { poly: [{ x: 0.7, z: -1.2 }, { x: 1.7, z: -1.2 }, { x: 1.7, z: -0.4 }, { x: 0.7, z: -0.4 }] },
      { poly: [{ x: -0.75, z: 1.0 }, { x: 0.75, z: 1.0 }, { x: 0.75, z: 2.0 }, { x: -0.75, z: 2.0 }] },
      { x: -0.6, z: 2.15, r: 0.3 }, { x: 1.4, z: -1.9, r: 0.2 },
    ],
  },
  ground: ground(),
  plaza: [plazaOf([{ x: -3.0, z: -2.8 }, { x: 2.2, z: -2.8 }, { x: 2.2, z: 3.2 }, { x: -3.0, z: 3.2 }], 'grass')],
  w4: {
    placeId: 'osm-r2142591',
    attractions: ['china-beach'],
    arrival: { x: 0.1, z: -2.4, heading: -Math.PI / 2 },
    photo: { target: [-3, 0, -2], distance: 18, elevation: 0.3, bearing: 1.2 },
    flag: { x: 0.8, z: 0.4, h: 30 },
    height: { realM: 0, u: 1.0, top: 3.49, rule: 'overlook' },
    osm: ['relation/2142591'],
    terrain: [-3.5, -4, 3, 4],
    terrainStep: 1,
    notes: 'The monument carries no inscription here (the card tells its story); no lifeguards and swimming not recommended: no swim prompt. The crowd spots are the lawn above the cove.',
  },
};
