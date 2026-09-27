import type { Vec2 } from '../../../core/types';
import type { BatchLike } from '../../builder';
import { GLOW, LIT, box, disc, lathe, rect, worldPoly } from './kit';
import { type W4Site, siteGround } from './siteKit';

/**
 * SFMOMA (wave 4, P2 · map T2, downtown diet ≤ 1.2k triangles, lod-0 ring 200 u): Mario Botta's 1995 museum — a
 * stepped brick block on 3rd Street crowned by the truncated cylinder of its black-and-white striped oculus — and
 * Snøhetta's rippled white 2016 expansion rising behind it (sfmoma.org). No names or signs on the facades.
 *
 * Frame: origin (176.6, 183), yaw 0 (the SoMa grid is the world grid here): local +z faces 3rd Street (centreline
 * z 7.5), the Botta block is x −4.1…4.1, z −1…5.5 (the front of OSM way 41692824), the expansion x −4.1…4.1 behind it
 * (z −4.4…−1); the hotel tower east of the museum (x ≥ 4.9) stays a city building, so the exclusion is an L around
 * it. Heights: the Botta steps 3.6 / 4.6 / 5.4 u, the oculus to 7.6 u, the expansion 8.8 u.
 */

const ID = 'sfmoma';
const X0 = 176.6, Z0 = 183, YAW = 0;
const g = siteGround(ID, 1.2);

const BRICK = '#a45a42', BRICK_DARK = '#8a4a36', STONE = '#e3d8c4', WHITE = '#f1efe8', WHITE_SHADE = '#dcdad2';

function build(b: BatchLike, lod: 0 | 2) {
  const y0 = g.at(0, 2);
  if (lod === 2) {
    box(b, 0, -1.2, 1.6, 8.2, y0 + 5.4 + 1.2, 7.8, BRICK);
    box(b, 0, -1.2, -2.7, 8.2, y0 + 8.8 + 1.2, 3.4, WHITE);
    lathe(b, [[1.45, 0], [1.45, 2.2]], 0, y0 + 5.4, 2.4, '#8f8a86', GLOW(0.2), 5);
    return;
  }
  // Botta: three stepped brick masses toward 3rd St (the middle one set back), stone bands, a stone base
  box(b, 0, -1.2, 2.2, 8.2, y0 + 3.6 + 1.2, 6.6, BRICK, [4, y0, -5.1, 0.1]);
  for (const sx of [-1, 1]) {
    box(b, sx * 2.3, -1.2, 1.6, 3.6, y0 + 4.6 + 1.2, 5.0, BRICK_DARK, GLOW(0.1));
    // the stepped setbacks: diagonal-banded stone bands on the side masses
    for (let k = 0; k < 4; k++) box(b, sx * 2.3, y0 + 1.0 + k * 0.95, 4.12, 3.62, 0.16, 0.06, k % 2 ? STONE : '#2f2f33');
    box(b, sx * 2.3, y0 + 4.6, 1.6, 3.7, 0.14, 5.1, STONE);
  }
  box(b, 0, -1.2, 0.8, 8.2, y0 + 5.4 + 1.2, 3.4, BRICK, GLOW(0.1));
  box(b, 0, y0 + 5.4, 0.8, 8.3, 0.14, 3.5, STONE);
  // the oculus: a truncated striped cylinder (black and white bands) with its glass top
  for (let k = 0; k < 6; k++) lathe(b, [[1.45, 0], [1.45, 0.37]], 0, y0 + 5.4 + k * 0.37, 2.4, k % 2 ? '#2f2f33' : '#f3f1ea', GLOW(0.2), 14);
  disc(b, 0, y0 + 7.62, 2.4, 1.3, 0.06, 0, '#9fc3cc', GLOW(0.6), 16);
  // the expansion: a tall white block with vertical ripples on its faces, a roof terrace
  box(b, 0, -1.2, -2.7, 8.2, y0 + 8.8 + 1.2, 3.4, WHITE, GLOW(0.12));
  for (let k = 0; k < 11; k++) {
    const x = -4.0 + k * 0.8;
    box(b, x, y0 + 4.8, -1.05 + (k % 2) * 0.08, 0.42, 4.0, 0.18, k % 2 ? WHITE_SHADE : WHITE);
  }
  for (const sx of [-1, 1]) for (let k = 0; k < 4; k++) box(b, sx * 4.14, y0 + 0.6, -4.1 + k * 0.9, 0.12, 8.2, 0.4, k % 2 ? WHITE_SHADE : WHITE);
  box(b, 0, y0 + 8.8, -2.7, 7.4, 0.5, 2.6, '#d4d1c8');
  box(b, 0, y0 - 0.1, 5.55, 8.3, 0.7, 0.12, STONE);
  box(b, 0, y0 + 3.6, 5.52, 8.3, 0.18, 0.1, STONE);
  // the entrance under the oculus: a tall recess with glass doors, lit at night
  box(b, 0, y0 - 0.05, 5.52, 2.4, 2.8, 0.06, '#4f5b5e', LIT(y0));
  for (const x of [-1.25, 1.25]) box(b, x, y0 - 0.1, 5.6, 0.2, 3.2, 0.2, STONE);
}

/** exclusion: the museum, an L around the hotel tower (x ≥ 4.9, z ≥ −1.1), 1.9 u off 3rd St's centreline */
const EXCLUDE: Vec2[] = [{ x: -4.2, z: -4.4 }, { x: 4.6, z: -4.4 }, { x: 4.6, z: 5.6 }, { x: -4.2, z: 5.6 }];

export const sfmoma: W4Site = {
  id: ID,
  tier: 2,
  x: X0,
  z: Z0,
  yaw: YAW,
  base: g.base,
  sink: 0,
  exclude: { poly: worldPoly(X0, Z0, YAW, EXCLUDE) },
  build,
  walk: { blockers: [{ poly: rect(0, 0.6, 8.3, 10.0) }] },
  lights: [{ x: 0, y: g.at(0, 6) + 5, z: 7, size: 2.4, color: '#ffe3b0' }],
  plaza: [{ poly: [{ x: -4.3, z: 5.6 }, { x: 4.6, z: 5.6 }, { x: 4.6, z: 9.5 }, { x: -4.3, z: 9.5 }], surface: 'pavement' }],
  w4: {
    placeId: 'sfmoma',
    attractions: ['sfmoma'],
    lod0R: 200,
    budget: 1200,
    arrival: { x: 0, z: 6.6, heading: Math.PI },
    photo: { target: [0, 5, 2], distance: 26, elevation: 0.22, bearing: 0.4 },
    flag: { x: 0, z: 2.4, h: 30 },
    height: { realM: 43, u: 10.0, rule: 'H = 3.2 + 0.155·h' },
    osm: ['way/41692824'],
    terrain: [-6, -6, 6, 9],
    ringMin: 0.6,
    notes: 'Downtown diet (plan §2.2): ≤ 1.2k, lod0R 200. Walk-around ring 60 %: the hotel tower and the garage hug the museum on two sides; its front is the 3rd St sidewalk.',
  },
};
