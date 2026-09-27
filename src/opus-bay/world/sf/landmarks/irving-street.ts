import type { BatchLike } from '../../builder';
import { worldPoly } from './kit';
import { type ShopBlock, shopBlockers, shopExclude, shopFronts, shopGround, shopLights } from './shopStreet';
import { type W4Site, siteGround } from './siteKit';

/**
 * Irving Street, the Sunset (wave 4, P3 · map T3, the irving strip): the Sunset's main street, with a long run of
 * Chinese bakeries, roast-meat shops, grocers and Vietnamese and Thai cafés serving one of the city's largest
 * Chinese-American neighbourhoods (SF Chronicle, "The Middle Sunset's vibrant food scene"; the scouting). Toy version
 * of the block between 21st and 22nd Avenues, the N Judah two blocks south: the carriageway and sidewalks rebuilt,
 * zebra crossings at both corners, awnings, blank signboards (no names), produce stands with market crates, the
 * block's street tree and two palms, a lamp.
 *
 * Frame: origin (−249.91, 1125.02) on Irving's centreline mid-block, yaw −130.7°: local +x runs west toward 22nd
 * Avenue (its centreline at x 6.5), 21st Avenue at x −6.6; the ribbon (3.6 wide, with its sidewalks) meets the
 * facades at z ±1.8. The shops stay the city's buildings.
 */

const ID = 'irving-street';
const X0 = -249.91, Z0 = 1125.02, YAW = (-130.7 * Math.PI) / 180;
const g = siteGround(ID, 15.0);

const BLOCK: ShopBlock = {
  x0: -4.8, x1: 4.7, half: 1.8, road: 1.2, bays: 4,
  stands: [[1, 1], [-1, 2], [1, 3]],
  kerb: [[-2.0, 1, 'tree'], [0.4, -1, 'palm'], [3.6, 1, 'palm'], [-3.2, -1, 'lamp']],
  awnings: ['#d8744a', '#2f8f88', '#c9473a', '#e0a94a', '#f1e6cf'],
  signs: ['#f4efe2', '#c9473a', '#e0b04e', '#2f6f4a', '#4f7fbf'],
};

function build(b: BatchLike, lod: 0 | 2) { shopFronts(b, BLOCK, g, lod); }

export const irvingStreet: W4Site = {
  id: ID,
  tier: 3,
  x: X0,
  z: Z0,
  yaw: YAW,
  base: g.base,
  sink: 0,
  exclude: { poly: worldPoly(X0, Z0, YAW, shopExclude(BLOCK)) },
  build,
  walk: { blockers: shopBlockers(BLOCK) },
  ground: shopGround(BLOCK, g),
  lights: shopLights(BLOCK, g),
  plaza: [{ poly: [{ x: -4.6, z: -1.75 }, { x: 4.5, z: -1.75 }, { x: 4.5, z: -1.2 }, { x: -4.6, z: -1.2 }], surface: 'pavement' }, { poly: [{ x: -4.6, z: 1.2 }, { x: 4.5, z: 1.2 }, { x: 4.5, z: 1.75 }, { x: -4.6, z: 1.75 }], surface: 'pavement' }, { poly: [{ x: -4.6, z: -1.1 }, { x: 4.5, z: -1.1 }, { x: 4.5, z: 1.1 }, { x: -4.6, z: 1.1 }], surface: 'road' }],
  w4: {
    placeId: 'irving-street',
    attractions: ['irving-street'],
    arrival: { x: -1.2, z: -0.9, heading: Math.PI / 2 },
    photo: { target: [0, 1.6, 0], distance: 13, elevation: 0.28, bearing: 1.25 },
    flag: { x: 0, z: 0, h: 30 },
    height: { realM: 6, u: 2.9, top: 4.5, rule: 'overlook' },
    osm: [],
    terrain: [-7, -3, 7, 3],
    terrainStep: 1,
    street: { x0: BLOCK.x0, x1: BLOCK.x1, half: BLOCK.half },
    notes: 'A shopping street: no shop names, signs or characters anywhere (blank boards); the shops are the city\'s buildings.',
  },
};
