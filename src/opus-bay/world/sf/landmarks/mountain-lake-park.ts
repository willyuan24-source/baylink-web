import * as THREE from 'three';
import type { Vec2 } from '../../../core/types';
import { type BatchLike, ICO, M } from '../../builder';
import { worldPoly } from './kit';
import { GC, PAT, type SiteGroundPoly, type W4Site, bench, gfill, gstrip, plazaOf } from './siteKit';
import { box3, markerStone, site3Ground } from './siteKit3';

/**
 * Mountain Lake Park (wave 4, P4 · map T3, the Richmond's edge of the Presidio): Mountain Lake, one of the last natural
 * lakes in San Francisco (4 acres; once 30 ft deep), where Juan Bautista de Anza's expedition stopped for two days in
 * 1776 while choosing the site of the Presidio — a plaque placed in September 1957 marks the spot; the lake was treated
 * for lead in its sediment in 2014 and native plants set on the eastern and southern shores; a playground, a tennis
 * court and a dog area on the park's south side (Wikipedia "Mountain Lake (San Francisco)").
 *
 * Toy: a small timber overlook on the east shore beside the lakeside walk (a walk deck reaching over the water's edge,
 * a rail on the lake side), the Anza marker as a stone with a plain plaque (no text) on a paved pad, a bench across the
 * walk, reed clumps; the walk is redrawn through the site. The lake and the park round it are the city's.
 *
 * Frame: origin (−433, 780) on the east shore's lawn, yaw 0 (the city frame): the water's edge runs from (−3.1, −1.9)
 * by (−5.0, 1.4) to (−5.0, 3.9); the lakeside walk crosses from (1.3, −3.1) to (−2.4, 3.6).
 */

const ID = 'mountain-lake-park';
const X0 = -433, Z0 = 780, YAW = 0;
const g = site3Ground(ID, 9.3);

const WOOD = '#9a7454', RAIL = '#6f5038';
const DECK = { x0: -5.0, x1: -3.0, z0: 0.6, z1: 3.0 };
const DECK_Y = 0.55;
/** the lakeside walk (the city's footway along the east shore), redrawn through the site */
const PATH: Vec2[] = [{ x: 2.0, z: -4.1 }, { x: 1.27, z: -3.09 }, { x: -0.41, z: -0.2 }, { x: -2.36, z: 3.59 }, { x: -3.2, z: 5.2 }];
const REEDS: Vec2[] = [{ x: -3.9, z: -0.3 }, { x: -4.5, z: 3.5 }];

function build(b: BatchLike, lod: 0 | 2) {
  const deckTop = DECK_Y;
  if (lod === 2) {
    box3(b, (DECK.x0 + DECK.x1) / 2, -0.6, (DECK.z0 + DECK.z1) / 2, DECK.x1 - DECK.x0, deckTop + 0.6, DECK.z1 - DECK.z0, WOOD);
    return;
  }
  // the deck on posts, its rail on the three lake sides
  box3(b, (DECK.x0 + DECK.x1) / 2, deckTop - 0.12, (DECK.z0 + DECK.z1) / 2, DECK.x1 - DECK.x0, 0.12, DECK.z1 - DECK.z0, WOOD);
  for (const [x, z] of [[DECK.x0 + 0.1, DECK.z0 + 0.1], [DECK.x0 + 0.1, DECK.z1 - 0.1], [DECK.x1 - 0.3, DECK.z0 + 0.1], [DECK.x1 - 0.3, DECK.z1 - 0.1]]) box3(b, x, -0.8, z, 0.14, deckTop + 0.7, 0.14, RAIL);
  const y = deckTop + 0.85, V = (x: number, z: number) => new THREE.Vector3(x, y, z);
  b.beam(V(DECK.x1 - 0.1, DECK.z0 + 0.05), V(DECK.x0 + 0.05, DECK.z0 + 0.05), 0.07, 0.07, RAIL);
  b.beam(V(DECK.x0 + 0.05, DECK.z0 + 0.05), V(DECK.x0 + 0.05, DECK.z1 - 0.05), 0.07, 0.07, RAIL);
  b.beam(V(DECK.x0 + 0.05, DECK.z1 - 0.05), V(DECK.x1 - 0.1, DECK.z1 - 0.05), 0.07, 0.07, RAIL);
  for (const [x, z] of [[DECK.x0 + 0.05, DECK.z0 + 1.4], [DECK.x0 + 1.4, DECK.z0 + 0.05], [DECK.x0 + 1.4, DECK.z1 - 0.05]]) box3(b, x, deckTop, z, 0.08, 0.85, 0.08, RAIL);
  markerStone(b, -2.6, g.at(-2.6, -0.4), -0.4, Math.PI / 2, 1.0);
  bench(b, 0.3, g.at(0.3, 2.6), 2.6, -Math.PI / 2);
  for (const [k, r] of REEDS.entries()) b.add(ICO(0), M(r.x, g.at(r.x, r.z) + 0.25, r.z, k, 0.4, 0.5, 0.35), k % 2 ? '#7a9a55' : '#6b8a4a', [0, 0, 0.4, 0]);
}

function ground(): SiteGroundPoly[] {
  return [
    ...gstrip(PATH, 1.2, GC.path, PAT.earth, g, 1.5, 0.09),
    ...gfill([{ x: -3.2, z: -0.95 }, { x: -2.0, z: -0.95 }, { x: -2.0, z: 0.15 }, { x: -3.2, z: 0.15 }], GC.pavers, PAT.stone, g, 2, 0.09),
  ];
}

export const mountainLakePark: W4Site = {
  id: ID,
  tier: 3,
  x: X0,
  z: Z0,
  yaw: YAW,
  base: g.base,
  sink: 0,
  // the shore's lawn only: the lake stays the city's water (an exclusion over it would take the water away)
  exclude: { poly: worldPoly(X0, Z0, YAW, [{ x: -3.9, z: -1.4 }, { x: 1.0, z: -1.4 }, { x: 1.0, z: 3.6 }, { x: -4.4, z: 3.6 }, { x: -4.4, z: 0.7 }]) },
  build,
  walk: {
    blockers: [{ x: -2.6, z: -0.4, r: 0.45 }, ...REEDS.map(r => ({ x: r.x, z: r.z, r: 0.3 }))],
    surfaces: [{ poly: [{ x: DECK.x0, z: DECK.z0 }, { x: DECK.x1 + 0.3, z: DECK.z0 }, { x: DECK.x1 + 0.3, z: DECK.z1 }, { x: DECK.x0, z: DECK.z1 }], y: DECK_Y, surface: 'wood' }],
  },
  ground: ground(),
  plaza: [plazaOf([{ x: DECK.x0, z: DECK.z0 }, { x: DECK.x1, z: DECK.z0 }, { x: DECK.x1, z: DECK.z1 }, { x: DECK.x0, z: DECK.z1 }], 'wood'), plazaOf([{ x: -3.0, z: -2.0 }, { x: 3.0, z: -2.0 }, { x: 3.0, z: 4.5 }, { x: -3.0, z: 4.5 }], 'grass')],
  w4: {
    placeId: 'osm-w401354283',
    attractions: ['mountain-lake-park'],
    arrival: { x: -1.2, z: 1.2, heading: -Math.PI / 2 },
    photo: { target: [-6, 0.5, 2], distance: 14, elevation: 0.3, bearing: 1.9 },
    flag: { x: -1.5, z: 0.4, h: 30 },
    height: { realM: 0, u: 1.0, top: 1.62, rule: 'overlook' },
    osm: ['way/401354283'],
    terrain: [-6, -5, 4, 6],
    terrainStep: 1,
    notes: 'The Anza plaque is a plain plate here (the card tells its words). The crowd spots are the deck and the lawn by it.',
  },
};
