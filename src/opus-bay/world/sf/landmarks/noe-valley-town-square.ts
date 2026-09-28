import type { Vec2 } from '../../../core/types';
import type { BatchLike } from '../../builder';
import { worldPoly } from './kit';
import { FC, GC, PAT, type SiteGroundPoly, type W4Site, bench, gfill, lamp, planter, plazaOf, tree } from './siteKit';
import { box3, site3Ground, standSpot } from './siteKit3';

/**
 * Noe Valley Town Square (wave 4, P4 · map T3): a former parking lot on 24th Street between Vicksburg and Sanchez that
 * opened on 27 October 2016 as the neighbourhood's gathering place — a lawn, seating, gardens, a pergola stage and trees
 * — after four years of work by Rec and Park, the Residents for Noe Valley Town Square and the supervisor's office; it
 * hosts the Saturday Noe Valley Farmers' Market (volunteer-run since 2003), music, classes and bingo (sfrecpark.org
 * "Noe Valley Town Square"; CBS News).
 *
 * Toy: the square behind the 24th Street sidewalk — pavers and a lawn, the timber pergola at the back, two market
 * stalls under plain canopies (no stall names), benches, planters, a tree and a lamp.
 *
 * Frame: origin (319.4, 804.5) at the square's centre, yaw −129.5°: local +z faces 24th Street (centreline z 3.55,
 * 4.4 u wide, so its sidewalk begins at z 1.35), the neighbours stand at x < −2.0 and x > 1.9, the back lot line at
 * z −2.4.
 */

const ID = 'noe-valley-town-square';
const X0 = 319.4, Z0 = 804.5, YAW = (-129.5 * Math.PI) / 180;
const g = site3Ground(ID, 11.0);

const LOT: Vec2[] = [{ x: -1.95, z: -2.35 }, { x: 1.8, z: -2.35 }, { x: 1.8, z: 1.6 }, { x: -1.95, z: 1.6 }];
const LAWN: Vec2[] = [{ x: 0.1, z: -2.0 }, { x: 1.6, z: -2.0 }, { x: 1.6, z: -0.4 }, { x: 0.1, z: -0.4 }];
const CANOPY = ['#e8d44d', '#e8446a'];

function stall(b: BatchLike, x: number, z: number, color: string) {
  const y = g.at(x, z);
  for (const [dx, dz] of [[-0.55, -0.45], [0.55, -0.45], [0.55, 0.45], [-0.55, 0.45]]) box3(b, x + dx, y - 0.1, z + dz, 0.05, 1.6, 0.05, '#dcd8cf');
  box3(b, x, y + 1.5, z, 1.3, 0.12, 1.1, color, 0, [0, 0, 0.2, 0]);
  box3(b, x, y + 0.55, z + 0.25, 1.1, 0.12, 0.5, '#f4efe2');
  box3(b, x, y + 0.67, z + 0.25, 0.9, 0.12, 0.35, '#8cc152');
}

function build(b: BatchLike, lod: 0 | 2) {
  if (lod === 2) {
    box3(b, -0.2, g.at(-0.2, -1.9) + 1.6, -1.9, 3.2, 0.2, 0.7, FC.wood);
    return;
  }
  // the pergola at the back: posts and a slatted top
  for (const x of [-1.6, -0.2, 1.2]) box3(b, x, g.at(x, -2.05) - 0.1, -2.05, 0.14, 2.0, 0.14, FC.wood);
  box3(b, -0.2, g.at(-0.2, -2.05) + 1.85, -2.05, 3.1, 0.12, 0.7, FC.wood);
  // two market stalls, benches on the sides, planters, a tree and a lamp
  stall(b, -0.9, 0.2, CANOPY[0]);
  stall(b, 0.9, 0.35, CANOPY[1]);
  bench(b, -1.55, g.at(-1.55, -0.9), -0.9, Math.PI / 2);
  bench(b, 1.45, g.at(1.45, 1.1), 1.1, -Math.PI / 2);
  planter(b, -1.5, g.at(-1.5, 1.2), 1.2, 0.6, 0.6);
  tree(b, 0.9, g.at(0.9, -1.2), -1.2, 0.95, 4);
  lamp(b, -1.6, g.at(-1.6, 0.5), 0.5);
}

function ground(): SiteGroundPoly[] {
  return [
    ...gfill(LOT, GC.pavers, PAT.stone, g, 2, 0.07),
    ...gfill(LAWN, GC.lawn, PAT.grass, g, 2, 0.1),
  ];
}

export const noeValleyTownSquare: W4Site = {
  id: ID,
  tier: 3,
  x: X0,
  z: Z0,
  yaw: YAW,
  base: g.base,
  sink: 0,
  // the lot behind the sidewalk (24th Street keeps its ribbon: 1.9 u off its centreline)
  exclude: { poly: worldPoly(X0, Z0, YAW, [{ x: -2.0, z: -2.45 }, { x: 1.85, z: -2.45 }, { x: 1.85, z: 1.65 }, { x: -2.0, z: 1.65 }]) },
  build,
  walk: {
    blockers: [
      { x: -1.6, z: -2.05, r: 0.15 }, { x: -0.2, z: -2.05, r: 0.15 }, { x: 1.2, z: -2.05, r: 0.15 },
      { poly: [{ x: -1.5, z: -0.05 }, { x: -0.3, z: -0.05 }, { x: -0.3, z: 0.55 }, { x: -1.5, z: 0.55 }] },
      { poly: [{ x: 0.3, z: 0.1 }, { x: 1.5, z: 0.1 }, { x: 1.5, z: 0.7 }, { x: 0.3, z: 0.7 }] },
      { x: -1.5, z: 1.2, r: 0.35 }, { x: 0.9, z: -1.2, r: 0.2 },
    ],
  },
  ground: ground(),
  lights: [{ x: -1.6, y: g.at(-1.6, 0.5) + 3.8, z: 0.5, size: 1, color: '#ffd9a0' }],
  // the square, and three spots on the 24th Street sidewalk in front of it (≈ 0.55 u, the carriageway from z ≈ 1.95: the
  // early record's 1.7 u strip put four of its five spots in the traffic lanes; W4-L3-review)
  plaza: [plazaOf(LOT, 'plaza'), ...[{ x: -3.5, z: 1.75 }, { x: 0.5, z: 1.75 }, { x: 4.3, z: 1.75 }].map(p => standSpot(p))],
  w4: {
    placeId: 'noe-valley-town-square',
    attractions: ['noe-valley-town-square'],
    // W5-L1: at the square's mouth between the two stalls (the old spot stood in 24th Street's lane)
    arrival: { x: 0.0, z: 1.2, heading: Math.PI },
    photo: { target: [0, 1.0, -0.5], distance: 11, elevation: 0.3, bearing: 0.3 },
    flag: { x: -0.2, z: -0.8, h: 30 },
    height: { realM: 0, u: 2.0, top: 4.71, rule: 'overlook' },
    osm: [],
    terrain: [-3, -3, 3, 3],
    terrainStep: 1,
    ringMin: 0.62,
    notes: 'Market stalls are generic (no stall names). The crowd spots are the square and points on the 24th Street sidewalk in front (never the carriageway); a mid-block lot, so the houses either side and behind close the walk-around ring to 65 %.',
  },
};
