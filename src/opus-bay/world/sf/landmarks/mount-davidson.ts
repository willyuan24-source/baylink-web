import type { BatchLike } from '../../builder';
import { NONE, box, lathe, ngon, worldPoly } from './kit';
import { GC, PAT, type SiteGroundPoly, type W4Site, bench, conifer, gfill, siteGround } from './siteKit';

/**
 * Mount Davidson and its cross (wave 4, P3 · map T2, the mount-davidson site): at 928 ft the highest natural point in
 * San Francisco, a forested hill near the city's middle (Wikipedia). Just west of the summit stands the 103 ft concrete
 * cross by George Kelham, dedicated in 1934: the shaft 10 ft wide at the base tapering to 9 ft, the arms 39 ft tip to
 * tip (mtdavidson.org; San Francisco Landmark #219). Since 1997 it belongs to the Council of Armenian-American
 * Organizations of Northern California, cared for in memory of the victims of the Armenian Genocide (mountdavidsoncross
 * .org). A memorial: a plain concrete cross on its stepped plinth, the paved ring path at its foot, two benches at a
 * respectful distance; no inscription copied, no gameplay objects, a quiet card.
 *
 * Frame: origin (244.03, 1173.05) at the cross (OSM node 633021134), yaw 180°: local +z faces downtown (city −z) so the
 * arms spread across the view from the city; the summit and its vista point are 18 u east-north-east (the attraction
 * and the place row), the eucalyptus forest all around is the city's. 31.4 m → 8.1 u by the landmark rule.
 */

const ID = 'mount-davidson';
const X0 = 244.03, Z0 = 1173.05, YAW = Math.PI;
const g = siteGround(ID, 50.2);

const CONCRETE = '#d9d4c8', CONCRETE_SHADE = '#c9c3b5';
const H = 8.1, SHAFT = 0.78, ARM = 3.05, ARM_T = 0.7, ARM_Y = 0.72;

function build(b: BatchLike, lod: 0 | 2) {
  const y = g.at(0, 0);
  const top = y + 0.55;
  if (lod === 2) {
    box(b, 0, y - 0.3, 0, SHAFT, H + 0.3, SHAFT, CONCRETE);
    box(b, 0, top + (H - 0.55) * ARM_Y - ARM_T / 2, 0, ARM, ARM_T, SHAFT, CONCRETE);
    return;
  }
  // the stepped plinth, the tapering shaft (two stages), the arms
  box(b, 0, y - 0.4, 0, 1.9, 0.62, 1.9, CONCRETE_SHADE);
  box(b, 0, y + 0.2, 0, 1.35, 0.35, 1.35, CONCRETE_SHADE);
  const hs = H - 0.55;
  box(b, 0, top, 0, SHAFT, hs * 0.5, SHAFT, CONCRETE, NONE);
  box(b, 0, top + hs * 0.5, 0, SHAFT * 0.92, hs * 0.5, SHAFT * 0.92, CONCRETE, NONE);
  box(b, 0, top + hs * ARM_Y - ARM_T / 2, 0, ARM, ARM_T, ARM_T, CONCRETE, NONE);
  // a low stone kerb around the paved ring, the memorial stone at the foot (its words are never copied)
  lathe(b, [[1.95, -0.2], [1.95, 0.18], [1.8, 0.18]], 0, y, 0, CONCRETE_SHADE, NONE, 10);
  box(b, 0, y - 0.1, 1.25, 0.9, 0.55, 0.25, '#b9b2a4');
  // two benches facing the cross at a respectful distance
  bench(b, -2.2, g.at(-2.2, 2.9), 2.9, Math.PI + 0.55);
  bench(b, 2.2, g.at(2.2, 2.9), 2.9, Math.PI - 0.55);
  // the eucalyptus close behind it
  conifer(b, -2.4, g.at(-2.4, -1.0), -1.0, 1.25);
  conifer(b, 2.4, g.at(2.4, -1.3), -1.3, 1.1);
}

function ground(): SiteGroundPoly[] { return gfill(ngon(0, 0, 1.75, 10), GC.pavers, PAT.stone, g, 2); }

export const mountDavidson: W4Site = {
  id: ID,
  tier: 2,
  x: X0,
  z: Z0,
  yaw: YAW,
  base: g.base,
  sink: 0,
  exclude: { poly: worldPoly(X0, Z0, YAW, ngon(0, 0.6, 3.7, 10)) },
  build,
  walk: { blockers: [{ poly: [{ x: -1.0, z: -1.0 }, { x: 1.0, z: -1.0 }, { x: 1.0, z: 1.0 }, { x: -1.0, z: 1.0 }] }] },
  ground: ground(),
  plaza: [{ poly: ngon(0, 1.2, 3.3, 10), surface: 'dirt' }],
  w4: {
    placeId: 'mount-davidson',
    attractions: ['mount-davidson'],
    arrival: { x: 0, z: 2.3, heading: Math.PI },
    photo: { target: [0, 4.5, 0], distance: 24, elevation: 0.12, bearing: 0 },
    flag: { x: 0, z: 0, h: 30 },
    height: { realM: 31.4, u: 8.1, top: 9.8, rule: 'H = 3.2 + 0.155·h' },
    osm: ['node/633021134', 'node/358806322'],
    terrain: [-4, -3, 4, 5],
    terrainStep: 1,
    ringMin: 0.6,
    notes: 'The knoll falls away steeply into the eucalyptus on the west (walk-around ring 73 %). A memorial (the Armenian Genocide, since 1997; Easter sunrise services since the 1920s): quiet card, no gameplay objects, the inscriptions never copied. The summit (the attraction and the place row) is 18 u ENE.',
  },
};
