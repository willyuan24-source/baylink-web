import type { BatchLike } from '../../builder';
import { LIT, NONE, box, rect, worldPoly } from './kit';
import { type W4Site, hipRoof, siteGround } from './siteKit';

/**
 * Beach Chalet (wave 4, P2 · map T3, the Ocean Beach west site): the white Spanish Revival building at the ocean end
 * of Golden Gate Park, by Willis Polk (1925), facing the Great Highway; the Golden Gate Park Visitor Center is on its
 * ground floor (beachchalet.com). Toy: the white two-storey block under a red tile hip roof, arched ground-floor
 * windows and a central door on the ocean front, a cornice band, blank signs. The murals inside are never reproduced;
 * no names. The Park Chalet behind it (OSM way 120483949) stays the city's.
 *
 * Frame: origin (−576.75, 1329.55) at the centre of OSM way 28691595 (a 4.6 × 2.6 u rectangle), yaw −39.7°: local
 * +z faces the Great Highway and the ocean (the parking strip at z 2…4.5, the coastal bikeway at z ≈ 5.2, the highway
 * from z ≈ 6.5), +x runs along the front. 12 m → 5.06 u (the city's value): walls 3.9 u, the roof to 5.06 u.
 */

const ID = 'beach-chalet';
const X0 = -576.75, Z0 = 1329.55, YAW = (-39.7 * Math.PI) / 180;
const g = siteGround(ID, 1.2);

const W = 4.6, D = 2.56, WALL_H = 3.9, TOP = 5.06;
const WHITE = '#f3eee3', ROOF = '#b5553c', TRIM = '#d9cfbd', GLASS = '#3f4d57';

function build(b: BatchLike, lod: 0 | 2) {
  const y0 = g.at(0, 0);
  // the block and the red hip roof
  box(b, 0, y0 - 1.2, 0, W, WALL_H + 1.2, D, WHITE, lod === 0 ? NONE : LIT(y0));
  hipRoof(b, 0, y0 + WALL_H, 0, W + 0.35, D + 0.35, TOP - WALL_H, ROOF);
  if (lod === 2) return;
  // cornice band and a plinth
  box(b, 0, y0 + WALL_H - 0.18, 0, W + 0.12, 0.2, D + 0.12, TRIM);
  box(b, 0, y0 - 0.3, 0, W + 0.1, 0.4, D + 0.1, TRIM);
  // the ocean front: arched ground-floor windows (a tall pane under a round head), a central door with a small canopy,
  // the upper row of windows
  const fz = D / 2 + 0.03;
  for (const x of [-1.75, -1.05, 1.05, 1.75]) {
    box(b, x, y0 + 0.3, fz, 0.48, 1.3, 0.06, GLASS, LIT(y0));
    box(b, x, y0 + 1.6, fz, 0.34, 0.2, 0.06, GLASS, LIT(y0));
    box(b, x, y0 + 0.25, fz + 0.02, 0.6, 0.08, 0.08, TRIM);
  }
  box(b, 0, y0, fz, 0.8, 1.9, 0.06, '#6b4a36', LIT(y0));
  box(b, 0, y0 + 2.0, fz + 0.25, 1.3, 0.12, 0.55, ROOF);
  for (const x of [-1.6, -0.8, 0, 0.8, 1.6]) box(b, x, y0 + 2.55, fz, 0.42, 0.75, 0.06, GLASS, LIT(y0));
  // a blank sign panel over the door
  box(b, 0, y0 + 2.2, fz + 0.04, 1.0, 0.25, 0.04, TRIM, NONE);
  // the ends (two windows a floor) and the back (the upper row)
  for (const sx of [-1, 1]) for (const z of [-0.55, 0.55]) for (const y of [0.5, 2.5]) box(b, sx * (W / 2 + 0.03), y0 + y, z, 0.06, y < 1 ? 1.1 : 0.75, 0.42, GLASS, LIT(y0));
  for (const x of [-1.6, -0.5, 0.5, 1.6]) box(b, x, y0 + 2.55, -fz, 0.42, 0.75, 0.06, GLASS, LIT(y0));
}

/** exclusion: the building (the footway along its front, the parking strip and the Park Chalet behind stay) */
const EXCLUDE = rect(0, 0, W + 0.3, D + 0.2);

export const beachChalet: W4Site = {
  id: ID,
  tier: 3,
  x: X0,
  z: Z0,
  yaw: YAW,
  base: g.base,
  sink: 0,
  exclude: { poly: worldPoly(X0, Z0, YAW, EXCLUDE) },
  build,
  walk: { blockers: [{ poly: rect(0, 0, W + 0.1, D + 0.1) }] },
  plaza: [{ poly: [{ x: -7.5, z: 1.6 }, { x: 3.5, z: 1.6 }, { x: 3.5, z: 4.4 }, { x: -7.5, z: 4.4 }], surface: 'pavement' }],
  lights: [{ x: 0, y: g.at(0, 1.6) + 2.0, z: 1.8, size: 1.4, color: '#ffe0b0' }],
  w4: {
    placeId: 'beach-chalet',
    attractions: ['beach-chalet'],
    lod0R: 220,
    arrival: { x: 0.2, z: 2.8, heading: Math.PI },
    photo: { target: [0, 2.5, 0], distance: 20, elevation: 0.2, bearing: 0.5 },
    flag: { x: 0, z: 0, h: 30 },
    height: { realM: 12, u: 5.06, top: 5.2, rule: 'H = 3.2 + 0.155·h' },
    osm: ['way/28691595'],
    terrain: [-5, -3, 5, 5],
    notes: 'The WPA-era murals inside are never reproduced; the restaurant has no name or sign here.',
  },
};
