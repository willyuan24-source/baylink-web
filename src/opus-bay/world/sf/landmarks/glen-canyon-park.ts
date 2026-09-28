import type { Vec2 } from '../../../core/types';
import { BOX, type BatchLike, ICO, M } from '../../builder';
import { worldPoly } from './kit';
import { PAT, type SiteGroundPoly, type W4Site, bench, gstrip, plazaOf } from './siteKit';
import { bandPoly, boulder, signBoard, site3Ground } from './siteKit3';

/**
 * Glen Canyon Park (wave 4, P4 · map T3, Glen Park / Diamond Heights): about 70 wild acres around the canyon of Islais
 * Creek, "the largest remaining creek in San Francisco with public access", which rises in the canyon and falls about
 * 350 ft in a mile; its reddish, layered Franciscan chert outcrops are one of the best bouldering spots near the city.
 * The Giant Powder Company made the first commercial dynamite in the US here from 19 March 1868 until an explosion on
 * 26 November 1869 (California Historical Landmark 1002); the WPA built the recreation centre in 1937 (Wikipedia
 * "Glen Canyon Park").
 *
 * Toy: a stop on the canyon floor between the Islais Creek Trail and the Gum Tree Girls Trail — a cluster of red chert
 * boulders, the creek as a narrow strip beside the trail with reed clumps, a blank trail board and a bench. The trails,
 * the slopes, the eucalyptus and the recreation centre are the city's.
 *
 * Frame: origin (352.6, 1046.3) on the canyon floor (ground ≈ 19.2 over the sea in the city data), yaw 0 (the city
 * frame): the Islais Creek Trail runs south-west of it (local (−4.7, −0.4) to (5.6, 4.6)), the Gum Tree Girls Trail (a
 * service track) north-east of it; the slope climbs south to O'Shaughnessy Boulevard.
 */

const ID = 'glen-canyon-park';
const X0 = 352.6, Z0 = 1046.3, YAW = 0;
const g = site3Ground(ID, 19.0);

const CHERT = '#9a5a4a';
/** the boulders (local x, z, size) */
const ROCKS: [number, number, number][] = [[-2.3, -1.7, 1.1], [-1.2, -1.3, 0.8], [-0.4, -1.9, 1.0], [-2.9, -0.7, 0.7], [-1.7, -2.6, 0.6]];
/** Islais Creek beside the trail, and the trail stretch the crowd stands on */
const CREEK: Vec2[] = [{ x: -1.7, z: 0.2 }, { x: 0.2, z: 1.0 }, { x: 2.0, z: 1.3 }, { x: 3.8, z: 2.1 }];
const TRAIL: Vec2[] = [{ x: -4.7, z: -0.4 }, { x: -0.6, z: 2.9 }, { x: 1.9, z: 4.5 }, { x: 5.8, z: 6.3 }];
const REEDS: Vec2[] = [{ x: -1.0, z: 0.9 }, { x: 1.2, z: 1.7 }, { x: 3.0, z: 2.3 }];
/** the city's side path from the Islais Creek Trail up to the Gum Tree Girls Trail (redrawn across the site), and where
 *  it crosses the creek on a plank footbridge */
const SIDE: Vec2[] = [{ x: -1.89, z: 2.49 }, { x: 2.63, z: -1.64 }];
const BRIDGE = { x: -0.19, z: 0.94, ry: Math.atan2(4.52, -4.13) };

function build(b: BatchLike, lod: 0 | 2) {
  if (lod === 2) {
    boulder(b, -1.2, g.at(-1.2, -1.6), -1.6, 2.0, 1, CHERT);
    return;
  }
  for (const [k, [x, z, s]] of ROCKS.entries()) boulder(b, x, g.at(x, z) - 0.15, z, s * 1.6, k + 5, CHERT);
  for (const [k, r] of REEDS.entries()) b.add(ICO(0), M(r.x, g.at(r.x, r.z) + 0.25, r.z, k, 0.35, 0.45, 0.3), k % 2 ? '#7a9a55' : '#6b8a4a', [0, 0, 0.4, 0]);
  signBoard(b, 2.6, g.at(2.6, -0.9), -0.9, -0.6, 1.0, 0.6, 0.6, '#e2d8c0', '#5d4a38');
  // the plank footbridge over the creek on the side path, a low rail each side
  const by = g.at(BRIDGE.x, BRIDGE.z) + 0.05, c = Math.cos(BRIDGE.ry), sn = Math.sin(BRIDGE.ry);
  b.add(BOX(), M(BRIDGE.x, by, BRIDGE.z, BRIDGE.ry, 1.3, 0.12, 1.5), '#8a6a4a');
  for (const k of [-0.62, 0.62]) b.add(BOX(), M(BRIDGE.x + c * k, by + 0.1, BRIDGE.z - sn * k, BRIDGE.ry, 0.07, 0.45, 1.5), '#6f5038');
  bench(b, 0.9, g.at(0.9, 0.0), 0.0, Math.PI - 0.4);
}

function ground(): SiteGroundPoly[] {
  return [
    ...gstrip(CREEK, 0.75, '#7c9aa0', PAT.none, g, 1.5, 0.07),
    ...gstrip(SIDE, 1.2, '#d6c29c', PAT.earth, g, 1.5, 0.09),
  ];
}

export const glenCanyonPark: W4Site = {
  id: ID,
  tier: 3,
  x: X0,
  z: Z0,
  yaw: YAW,
  base: g.base,
  sink: 0,
  // the canyon floor between the two trails (both stay the city's)
  exclude: { poly: worldPoly(X0, Z0, YAW, [{ x: -3.9, z: -2.9 }, { x: -0.6, z: -3.0 }, { x: 3.0, z: -0.5 }, { x: 4.4, z: 1.4 }, { x: 3.7, z: 2.6 }, { x: 0.3, z: 1.6 }, { x: -2.4, z: 0.3 }, { x: -3.9, z: -0.6 }]) },
  build,
  walk: { blockers: [...ROCKS.map(([x, z, s]) => ({ x, z, r: s * 0.95 })), { x: 2.6, z: -0.9, r: 0.2 }] },
  ground: ground(),
  plaza: [plazaOf(bandPoly(TRAIL, 1.3), 'dirt'), plazaOf([{ x: -0.2, z: -0.6 }, { x: 2.8, z: -0.4 }, { x: 3.4, z: 1.2 }, { x: 0.4, z: 0.9 }], 'grass')],
  w4: {
    placeId: 'osm-w35800082',
    attractions: ['glen-canyon-park'],
    arrival: { x: 0.5, z: 3.0, heading: Math.PI + 0.3 },
    photo: { target: [-0.8, 0.8, -1.2], distance: 12, elevation: 0.3, bearing: 0.5 },
    flag: { x: -1.2, z: -1.3, h: 30 },
    height: { realM: 0, u: 1.0, top: 2.33, rule: 'overlook' },
    osm: ['way/35800082'],
    terrain: [-5, -4, 6, 4],
    terrainStep: 1,
    notes: 'The creek is a strip of colour here (the city has no water in the canyon); no climbing prompt at the chert. The crowd spots are the Islais Creek Trail beside the stop.',
  },
};
