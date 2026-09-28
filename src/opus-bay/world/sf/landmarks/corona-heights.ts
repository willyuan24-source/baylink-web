import type { Vec2 } from '../../../core/types';
import { BOX, type BatchLike, ICO, M } from '../../builder';
import { ngon, worldPoly } from './kit';
import { type W4Site, siteGround } from './siteKit';

/**
 * Corona Heights (wave 4, P3 · map T2, the corona-heights site): the red-rock summit of Corona Heights Park above the
 * Castro, with one of the best close views of downtown, over the Randall Museum, the free city-run kids' science
 * museum with live animals and a model railroad (randallmuseum.org; SF Rec & Park). The summit (Wikipedia 37.7646522,
 * −122.4391379; lane C's panorama spot and lane P's arrival, about 90 m west of the museum door) is this site: the
 * rusty red chert outcrops of the top around a small bare clearing, a stone survey post. The museum, the dog run and the
 * city's benches below the top stay the city's.
 *
 * Frame: origin (81.0, 749.0) at the summit spot (walked 29.9 at its crown, local (−1.5, 0)), yaw 0 (local = world
 * offsets): downtown lies along −z (north-east in the world), the Castro south-east, the steps come up from the east.
 */

const ID = 'corona-heights';
const X0 = 81.0, Z0 = 749.0, YAW = 0;
const g = siteGround(ID, 28.5);

const CHERT = ['#9a4a3a', '#a85a42', '#8a3f32', '#b0664c'];
/** outcrops: [x, z, size, turn] — the crown's rocks ring the clearing, open toward downtown */
const ROCKS: [number, number, number, number][] = [[-2.3, 0.6, 0.95, 0.3], [-1.6, 1.6, 0.7, 1.1], [-2.3, -0.6, 0.8, 2.0], [0.6, 1.9, 0.6, 0.7], [1.6, -0.2, 0.55, 2.6], [-0.4, 2.3, 0.5, 1.9], [1.1, -2.1, 0.45, 0.2], [-2.9, 1.8, 0.45, 1.4], [2.3, 1.2, 0.4, 2.2], [-0.9, -2.5, 0.4, 0.9]];

function build(b: BatchLike, lod: 0 | 2) {
  const list = lod === 2 ? ROCKS.slice(0, 1) : ROCKS;
  for (const [k, [x, z, s, r]] of list.entries()) b.add(ICO(0), M(x, g.at(x, z) + s * 0.25, z, r, s * 1.3, s * 0.95, s * 1.05, 0.2 * (k % 3)), CHERT[k % 4]);
  if (lod === 2) return;
  // a small concrete survey post on the crown
  b.add(BOX(), M(-1.3, g.at(-1.3, -0.3) - 0.1, -0.3, 0.4, 0.22, 0.45, 0.22), '#cfc7b8');
}

export const coronaHeights: W4Site = {
  id: ID,
  tier: 2,
  x: X0,
  z: Z0,
  yaw: YAW,
  base: g.base,
  sink: 0,
  exclude: { poly: worldPoly(X0, Z0, YAW, ngon(-0.4, -0.2, 3.6, 10)) },
  build,
  walk: { blockers: ROCKS.filter(([, , s]) => s >= 0.6).map(([x, z, s]) => ({ x, z, r: s * 0.8 })) },
  plaza: [{ poly: ngon(-0.3, -0.6, 3.3, 10) as Vec2[], surface: 'dirt' }],
  w4: {
    placeId: 'corona-heights',
    attractions: ['corona-heights-randall-museum'],
    arrival: { x: 0.2, z: -0.8, heading: Math.PI },
    photo: { target: [-0.5, 1.2, 0.5], distance: 11, elevation: 0.35, bearing: 2.4 },
    flag: { x: -0.6, z: 0.4, h: 30 },
    height: { realM: 1.5, u: 1.3, top: 2.6, rule: 'overlook' },
    osm: ['way/705309578'],
    terrain: [-5, -5, 5, 5],
    terrainStep: 1,
    ringMin: 0.6,
    notes: 'The steep rocky sides of the top and the dog-run fence close part of the walk-around ring (73 %). A panorama point (lane C\'s summit spot): the close view of downtown. The Randall Museum (open Tue–Sat 10–5) is the city\'s building below the summit.',
  },
};
