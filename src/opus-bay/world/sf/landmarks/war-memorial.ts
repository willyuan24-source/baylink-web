import type { Vec2 } from '../../../core/types';
import type { BatchLike } from '../../builder';
import { box, rect, worldPoly } from './kit';
import { type CivicBlock, civicBlock } from './civicKit';
import { GC, PAT, type SiteGroundPoly, type W4Site, gfill, hedge, siteGround } from './siteKit';

/**
 * The War Memorial Opera House and the Veterans Building (wave 4, P3 · map T3, the Civic Center extension): the twin
 * Beaux-Arts buildings of 1932 facing City Hall across Van Ness Avenue — the Opera House, home of SF Opera and SF
 * Ballet (3,006 seats), and the Veterans Building, where the United Nations Charter was signed in 1945 in its Herbst
 * Theatre — with the Memorial Court between them (sfwarmemorial.org; Wikipedia). Toy version on their OSM footprints
 * (ways 32865161, 32865757): light stone blocks with colonnades to Van Ness, the Opera House's fly tower rising behind,
 * the court's lawn between hedges. Davies Symphony Hall (south, across Grove St) stays the city's. No names or banners.
 *
 * Frame: origin (79.5, 437.0) in the Memorial Court, yaw −34.9°: Van Ness is a dual carriageway in the data (two
 * one-way ribbons 5.6 wide along z −11.1 and z −13.5; the fronts face −z), so its sidewalk on this side is
 * z −8.9…−8.3 (W4-L-review: the front plaza reached z −10.2, onto the asphalt); Franklin St along z 8.3 behind; the
 * Veterans Building is x −12.6…−3.1, the Opera House x 3.4…12.3 (the city drew them 7.5 and 10.0 u high).
 */

const ID = 'war-memorial';
const X0 = 79.5, Z0 = 437.0, YAW = (-34.9 * Math.PI) / 180;
const g = siteGround(ID, 3.8);

const STONE = '#e6e0d2', BASE = '#d3cbb9';
const VETERANS: CivicBlock = { x0: -12.6, x1: -3.1, z0: -7.3, z1: 4.3, h: 7.3, front: -1, cols: 6, stone: STONE, base: BASE };
const OPERA: CivicBlock = { x0: 3.4, x1: 12.3, z0: -7.6, z1: 6.1, h: 7.3, front: -1, cols: 6, stone: STONE, base: BASE };
const COURT: Vec2[] = [{ x: -2.4, z: -4.0 }, { x: 1.8, z: -4.0 }, { x: 1.8, z: 4.2 }, { x: -2.4, z: 4.2 }];

function build(b: BatchLike, lod: 0 | 2) {
  civicBlock(b, VETERANS, g.at(-7.8, -7.3), lod);
  civicBlock(b, OPERA, g.at(7.8, -7.6), lod);
  // the Opera House's fly tower behind its auditorium roof
  box(b, 8.0, g.at(8, 2) + 7.3, 2.0, 5.2, 2.7, 4.6, BASE);
  if (lod === 2) return;
  hedge(b, { x: -2.2, z: -3.8 }, { x: -2.2, z: 3.9 }, g.at(-2.2, 0), 0.6, 0.4);
  hedge(b, { x: 1.6, z: -3.8 }, { x: 1.6, z: 3.9 }, g.at(1.6, 0), 0.6, 0.4);
}

function ground(): SiteGroundPoly[] { return gfill([{ x: -1.8, z: -3.6 }, { x: 1.2, z: -3.6 }, { x: 1.2, z: 3.8 }, { x: -1.8, z: 3.8 }], GC.lawn, PAT.grass, g, 3); }

export const warMemorial: W4Site = {
  id: ID,
  tier: 3,
  x: X0,
  z: Z0,
  yaw: YAW,
  base: g.base,
  sink: 0,
  exclude: { poly: worldPoly(X0, Z0, YAW, [{ x: -13.0, z: -8.2 }, { x: 12.7, z: -8.2 }, { x: 12.7, z: 6.4 }, { x: -13.0, z: 6.4 }]) },
  build,
  walk: {
    blockers: [
      { poly: rect(-7.85, -1.5, 9.5, 11.6) }, { poly: rect(7.85, -0.75, 8.9, 13.7) },
      { poly: [{ x: -2.4, z: -3.8 }, { x: -2.0, z: -3.8 }, { x: -2.0, z: 3.9 }, { x: -2.4, z: 3.9 }] },
      { poly: [{ x: 1.4, z: -3.8 }, { x: 1.8, z: -3.8 }, { x: 1.8, z: 3.9 }, { x: 1.4, z: 3.9 }] },
    ],
  },
  ground: ground(),
  plaza: [{ poly: COURT, surface: 'grass' }, { poly: [{ x: -12.4, z: -8.85 }, { x: 12.1, z: -8.85 }, { x: 12.1, z: -8.35 }, { x: -12.4, z: -8.35 }], surface: 'pavement' }],
  w4: {
    placeId: 'osm-w32865161',
    attractions: ['war-memorial-opera-house'],
    arrival: { x: 0.0, z: -6.0, heading: 0 },
    photo: { target: [0, 3.5, -2], distance: 32, elevation: 0.18, bearing: Math.PI + 0.35 },
    flag: { x: 7.8, z: -1, h: 30 },
    height: { realM: 30, u: 10.0, top: 10.5, rule: 'H = 3.2 + 0.155·h' },
    osm: ['way/32865161', 'way/32865757'],
    terrain: [-14, -11, 14, 8],
    ringMin: 0.6,
    notes: 'Two big blocks and the court between them: the walk-around ring crosses both buildings (72 %). No names, posters or banners on the buildings. Davies Symphony Hall is the city building south of Grove St.',
  },
};
