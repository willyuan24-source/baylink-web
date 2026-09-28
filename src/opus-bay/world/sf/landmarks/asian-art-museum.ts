import type { BatchLike } from '../../builder';
import { rect, worldPoly } from './kit';
import { type CivicBlock, civicBlock } from './civicKit';
import { type W4Site, bench, siteGround } from './siteKit';

/**
 * The Asian Art Museum (wave 4, P3 · map T3, the Civic Center extension): one of the largest collections of Asian art
 * in the West, in the former Main Library of 1917 facing City Hall across Civic Center Plaza; free on the first Sunday
 * of each month (asianart.org; Wikipedia). Toy version on its OSM footprint (way 24588037): the granite Beaux-Arts block
 * with its colonnade and arched ground floor on the Larkin St front (toward the plaza) and the parapet; the 2021
 * pavilion on Hyde St and the Fulton St mall stay the city's. No names or banners.
 *
 * Frame: origin (108.87, 379.02) at the block's centre, yaw −35.3°: Larkin St runs along z 11.4 (the front, +z),
 * McAllister St along x −5.8, Hyde St along z −9.3; the block is x −3.7…3.7, z −7.1…7.2 (10.3 u in the city).
 */

const ID = 'asian-art-museum';
const X0 = 108.87, Z0 = 379.02, YAW = (-35.3 * Math.PI) / 180;
const g = siteGround(ID, 3.0);

const MUSEUM: CivicBlock = { x0: -3.6, x1: 3.6, z0: -7.1, z1: 7.2, h: 7.6, front: 1, cols: 5, stone: '#dcd6ca', base: '#c9c2b3' };

function build(b: BatchLike, lod: 0 | 2) {
  civicBlock(b, MUSEUM, g.at(0, 7.2), lod);
  if (lod === 2) return;
  for (const x of [-2.0, 2.0]) bench(b, x, g.at(x, 8.9), 8.9, Math.PI);
}

export const asianArtMuseum: W4Site = {
  id: ID,
  tier: 3,
  x: X0,
  z: Z0,
  yaw: YAW,
  base: g.base,
  sink: 0,
  exclude: { poly: worldPoly(X0, Z0, YAW, [{ x: -3.7, z: -7.4 }, { x: 4.0, z: -7.4 }, { x: 4.0, z: 9.4 }, { x: -3.7, z: 9.4 }]) },
  build,
  walk: { blockers: [{ poly: rect(0, 0.05, 7.3, 14.4) }] },
  plaza: [{ poly: [{ x: -3.6, z: 7.9 }, { x: 3.6, z: 7.9 }, { x: 3.6, z: 9.5 }, { x: -3.6, z: 9.5 }], surface: 'plaza' }, { poly: [{ x: 4.3, z: -6.8 }, { x: 6.8, z: -6.8 }, { x: 6.8, z: 7.0 }, { x: 4.3, z: 7.0 }], surface: 'pavement' }],
  w4: {
    placeId: 'osm-w24588037',
    attractions: ['asian-art-museum'],
    arrival: { x: 0.3, z: 8.6, heading: Math.PI },
    photo: { target: [0, 3.5, 5], distance: 22, elevation: 0.15, bearing: 0.3 },
    flag: { x: 0, z: 0, h: 30 },
    height: { realM: 30, u: 7.6, top: 8.6, rule: 'H = 3.2 + 0.155·h' },
    osm: ['way/24588037'],
    terrain: [-5, -9, 6, 11],
    notes: 'No names or banners. Closed Tuesday and Wednesday (the card has the hours).',
  },
};
