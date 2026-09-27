import type { Vec2 } from '../../../core/types';
import { BOX, type BatchLike, M } from '../../builder';
import { worldPoly } from './kit';
import { type W4Site, bench, conifer, fence, siteGround } from './siteKit';

/**
 * Grand View Park, "Turtle Hill" (wave 4, P3 · map T3, the golden-gate-heights group with the Tiled Steps): a tiny
 * chert summit about 666 ft up in Golden Gate Heights with a 360° view from the Pacific to downtown and Sutro Tower
 * (Wikipedia; the scouting). The hill, its dune scrub and the stairs up are the city's; this site dresses the top of
 * the summit loop: a coin telescope, two benches (one to the ocean, one to downtown), a short rail where the ridge
 * drops, two wind-bent cypresses. A panorama point.
 *
 * Frame: origin (−101.0, 1130.8) inside the summit loop path (walked 37.0–37.9; the ridge path across it 38.2), yaw 0
 * (local = world offsets): the Encinal Walk stairs come up from the south-east (x 5.4, z −7.3), the Moraga stairs from
 * the north-east (x 4.1, z 6.3). The ocean lies to −x in the city frame, downtown to +x.
 */

const ID = 'grand-view-park';
const X0 = -101.0, Z0 = 1130.8, YAW = 0;
const g = siteGround(ID, 36.9);

const SCOPE = { x: 0.4, z: -0.1 };
const RAIL: Vec2[] = [{ x: -2.4, z: 1.6 }, { x: -1.4, z: 2.5 }, { x: 0.2, z: 2.9 }];

function build(b: BatchLike, lod: 0 | 2) {
  if (lod === 2) { b.add(BOX(), M(-1.6, g.at(-1.6, -1.8), -1.8, 0, 1.2, 3.4, 1.2), '#4d7247'); return; }
  const y = g.at(SCOPE.x, SCOPE.z);
  // the coin telescope on its post, turned to the ocean
  b.add(BOX(), M(SCOPE.x, y - 0.1, SCOPE.z, 0, 0.12, 1.1, 0.12), '#5d6662');
  b.add(BOX(), M(SCOPE.x - 0.1, y + 1.02, SCOPE.z, -Math.PI / 2, 0.22, 0.22, 0.55, -0.25), '#3f4a47');
  bench(b, -1.2, g.at(-1.2, 0.3), 0.3, -Math.PI / 2);
  bench(b, 2.0, g.at(2.0, 1.2), 1.2, Math.PI / 2);
  fence(b, RAIL, g.at, 0.9, '#6d6a62');
  // two wind-bent cypresses on the lee of the top
  conifer(b, -1.6, g.at(-1.6, -1.8), -1.8, 1.0);
  conifer(b, 2.6, g.at(2.6, -1.4), -1.4, 0.8);
}

/** exclusion: the summit inside the loop path (the paths and the stairs stay the city's) */
const EXCLUDE: Vec2[] = [{ x: -2.7, z: -2.3 }, { x: 0.6, z: -3.3 }, { x: 3.2, z: -1.6 }, { x: 3.2, z: 1.7 }, { x: 0.6, z: 3.4 }, { x: -2.7, z: 2.2 }];

export const grandViewPark: W4Site = {
  id: ID,
  tier: 3,
  x: X0,
  z: Z0,
  yaw: YAW,
  base: g.base,
  sink: 0,
  exclude: { poly: worldPoly(X0, Z0, YAW, EXCLUDE) },
  build,
  // (the cypresses' thin trunks do not block, like the city's park trees)
  walk: { blockers: [{ x: SCOPE.x, z: SCOPE.z, r: 0.15 }] },
  plaza: [{ poly: [{ x: -2.8, z: -2.3 }, { x: 0.6, z: -3.4 }, { x: 3.2, z: -1.7 }, { x: 3.2, z: 1.7 }, { x: 0.6, z: 3.4 }, { x: -2.8, z: 2.2 }], surface: 'dirt' }],
  w4: {
    placeId: 'osm-n7707827583',
    attractions: ['grand-view-park'],
    arrival: { x: 0.9, z: 0.9, heading: -Math.PI / 2 },
    photo: { target: [0.4, 1.2, 0], distance: 12, elevation: 0.3, bearing: 1.9 },
    flag: { x: 0.4, z: 0.6, h: 30 },
    height: { realM: 203, u: 3.4, top: 5.1, rule: 'overlook' },
    osm: ['node/7707827583'],
    terrain: [-4, -4, 5, 5],
    terrainStep: 1,
    notes: 'A panorama point (lane C / G): the whole city from the Pacific to downtown and Sutro Tower.',
  },
};
