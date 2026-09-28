import type { BatchLike } from '../../builder';
import { worldPoly } from './kit';
import { type ShopBlock, shopBlockers, shopExclude, shopFronts, shopGround, shopLights } from './shopStreet';
import { type W4Site, siteGround } from './siteKit';

/**
 * Clement Street, Inner Richmond (wave 4, P3 · map T3, the clement strip): one of the Richmond's main streets, lined
 * with dim sum restaurants, bakeries, Cantonese delis, Chinese grocers and produce markets — the city's "New
 * Chinatown", grown from the 1970s when families moved west for space and cheaper houses (SF Examiner, "How the
 * Richmond became 'New Chinatown'"; Richmond Review 2021). Toy version of the block between 5th and 6th Avenues: the
 * carriageway and sidewalks rebuilt, zebra crossings at both corners, awnings over every shopfront, blank signboards
 * (no shop names, no characters), produce stands with crates on the sidewalk, street trees and lamps.
 *
 * Frame: origin (−331.05, 774.13) on Clement's centreline mid-block, yaw −130.7°: local +x runs west along Clement
 * toward 6th Avenue (its centreline at x 6.6), 5th Avenue at x −6.6; the published ribbon (3.6 wide, with its
 * sidewalks) meets the shop facades at z ±1.8. The shops themselves stay the city's buildings.
 */

const ID = 'clement-street';
const X0 = -331.05, Z0 = 774.13, YAW = (-130.7 * Math.PI) / 180;
const g = siteGround(ID, 12.4);

const BLOCK: ShopBlock = {
  x0: -4.8, x1: 4.8, half: 1.8, road: 1.2, bays: 5,
  stands: [[-1, 1], [1, 3], [1, 0]],
  kerb: [[-3.6, -1, 'tree'], [3.4, 1, 'tree'], [0.4, 1, 'lamp'], [-0.6, -1, 'lamp']],
  awnings: ['#b8322a', '#2f6f4a', '#e0b04e', '#f1e6cf', '#4f7fbf'],
  signs: ['#c9473a', '#e0b04e', '#2f6f4a', '#f4efe2', '#7a4fa0'],
};

function build(b: BatchLike, lod: 0 | 2) { shopFronts(b, BLOCK, g, lod); }

export const clementStreet: W4Site = {
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
  // the two sidewalks (a crowd spot is never on the carriageway: the crowd stands exactly there)
  plaza: [{ poly: [{ x: -4.6, z: -1.75 }, { x: 4.6, z: -1.75 }, { x: 4.6, z: -1.2 }, { x: -4.6, z: -1.2 }], surface: 'pavement' }, { poly: [{ x: -4.6, z: 1.2 }, { x: 4.6, z: 1.2 }, { x: 4.6, z: 1.75 }, { x: -4.6, z: 1.75 }], surface: 'pavement' }],
  w4: {
    placeId: 'clement-street',
    attractions: ['clement-street'],
    arrival: { x: 1.6, z: -1.3, heading: -Math.PI / 2 },
    photo: { target: [0, 1.6, 0], distance: 13, elevation: 0.28, bearing: 1.25 },
    flag: { x: 0, z: 0, h: 30 },
    height: { realM: 6, u: 2.9, top: 4.7, rule: 'overlook' },
    osm: [],
    terrain: [-7, -3, 7, 3],
    terrainStep: 1,
    street: { x0: BLOCK.x0, x1: BLOCK.x1, half: BLOCK.half },
    plazaMin: 10,
    notes: 'The crowd plaza is the two sidewalks of the block (10 u²: the shops close both sides); the arrival is on the south sidewalk. A shopping street: no shop names, signs or characters anywhere (blank boards); the shops are the city\'s buildings.',
  },
};
