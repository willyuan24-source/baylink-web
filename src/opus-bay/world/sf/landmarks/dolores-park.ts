import type { Vec2 } from '../../../core/types';
import { BOX, type BatchLike, CYL, M } from '../../builder';
import { GLOW, NONE, box, lathe, rect, worldPoly } from './kit';
import { GC, PAT, type SiteGroundPoly, type W4Site, bench, gfill, gstrip, lamp, palm, plazaOf, siteGround, tree } from './siteKit';

/**
 * Mission Dolores Park (wave 4, P2 · map T2, the Mission Dolores site): the Mission's sunny 16-acre lawn that climbs
 * from Dolores St to Church St, with the postcard downtown view from its upper slope, the J Church streetcar running
 * along its top edge, the playground at the 18th St end, tennis courts, and the Miguel Hidalgo monument by Dolores St
 * (Wikipedia; SF Rec & Park). The lawn itself is the city's park ground; this site adds the walks, the courts, the
 * playground, the monument, trees, palms along Dolores, benches and lamps.
 *
 * Frame: origin (243, 698), yaw −39.6° (along Dolores St): local −z is Dolores St (its park-side carriageway at
 * z −13.2, the other at −15.1), +z climbs to
 * the J Church right of way (z ≈ 11.3) and Church St (14.4); 18th St is the −x end, 20th St the +x end (x 24).
 * The park (OSM) is x −24.9…23.5; the ground climbs ≈ 6 u from Dolores to the top walk.
 */

const ID = 'dolores-park';
const X0 = 243, Z0 = 698, YAW = (-39.6 * Math.PI) / 180;
const g = siteGround(ID, 3.5);

const WALKS: Vec2[][] = [
  [{ x: -22.6, z: -10.35 }, { x: 21.6, z: -10.35 }],                      // along Dolores St
  [{ x: -14.0, z: 7.6 }, { x: 21.2, z: 7.6 }],                            // the top walk under the J Church
  [{ x: -1.5, z: -10.35 }, { x: -1.5, z: 7.6 }],                          // up the middle
  [{ x: -12.0, z: -10.35 }, { x: -7.0, z: 0.0 }, { x: -1.5, z: 3.2 }],    // the curving walk to the 18th St side
  [{ x: 10.0, z: -10.35 }, { x: 10.0, z: 7.6 }],                          // by the courts
];
const COURTS: [number, number][] = [[14.3, -3.0], [18.8, -3.0]];
const PLAY = { x: -18.8, z: 4.2, w: 8.4, d: 6.4 };
const TREES: [number, number, number][] = [[-22.4, -2.0, 1.2], [-13.0, -7.6, 1.15], [3.6, -6.8, 1.2], [6.8, 5.2, 1.1], [-10.5, 6.6, 1.2], [19.6, 5.0, 1.15], [-5.6, -3.2, 1.05], [13.2, 6.4, 1.1]];
const PALMS: [number, number][] = [[-14.0, -8.6], [-4.0, -8.6], [6.0, -8.6], [16.0, -8.6]];
const LAMPS: Vec2[] = [{ x: -12.0, z: -9.3 }, { x: 8.6, z: -9.3 }, { x: -0.6, z: 6.8 }, { x: 12.0, z: 6.8 }];
const BENCHES: [number, number, number][] = [[-6.0, 6.8, 0], [3.4, 6.8, 0], [15.0, 6.8, 0], [-9.0, -9.2, Math.PI], [0.6, -9.2, Math.PI]];
const HIDALGO = { x: 2.2, z: -8.4 };

function playground(b: BatchLike) {
  const { x, z } = PLAY, y = g.at(x, z);
  const COLORS = ['#e46b54', '#f2c14e', '#4f7fbf', '#4f8f6a'];
  // a climbing tower with a red roof, a slide, a swing frame, a play hill
  box(b, x - 1.5, y, z, 1.6, 1.4, 1.6, COLORS[2]);
  for (const [ox, oz] of [[-0.75, -0.75], [0.75, -0.75], [0.75, 0.75], [-0.75, 0.75]]) box(b, x - 1.5 + ox, y, z + oz, 0.12, 2.4, 0.12, '#e8e2d4');
  b.add(BOX(), M(x - 1.5, y + 2.4, z, Math.PI / 4, 1.3, 0.5, 1.3), COLORS[0]);
  b.add(BOX(), M(x + 0.2, y + 0.8, z, 0, 2.6, 0.12, 0.8, 0, -0.5), COLORS[1]);
  for (const s of [-1, 1]) box(b, x + 2.4, y, z + s * 1.4, 0.1, 1.9, 0.1, '#e8e2d4');
  box(b, x + 2.4, y + 1.85, z, 0.12, 0.12, 2.9, '#e8e2d4');
  for (const s of [-0.6, 0.6]) box(b, x + 2.4, y + 0.55, z + s, 0.5, 0.06, 0.28, COLORS[3]);
  lathe(b, [[1.5, 0], [1.1, 0.5], [0.4, 0.8], [0.02, 0.85]], x - 1.0, y - 0.05, z - 2.2, '#9fbf7a', NONE, 8);
}

function courts(b: BatchLike) {
  for (const [cx, cz] of COURTS) {
    const y = g.at(cx, cz);
    box(b, cx, y + 0.05, cz, 0.05, 0.5, 5.0, '#f4f1ea');                                  // the net
    for (const s of [-1, 1]) box(b, cx, y - 0.1, cz + s * 2.6, 0.08, 0.7, 0.08, '#56605c');
  }
  // the chain-link fence around both courts: posts at the corners and midpoints
  for (const [px, pz] of [[11.8, -6.4], [16.55, -6.4], [21.3, -6.4], [11.8, 0.4], [16.55, 0.4], [21.3, 0.4]]) box(b, px, g.at(px, pz) - 0.2, pz, 0.08, 2.2, 0.08, '#5d6662');
}

function hidalgo(b: BatchLike) {
  const { x, z } = HIDALGO, y = g.at(x, z);
  box(b, x, y - 0.3, z, 1.3, 0.6, 1.3, '#d6cdbf');
  box(b, x, y + 0.3, z, 0.8, 1.4, 0.8, '#e3dccd', GLOW(0.15));
  b.add(CYL(6), M(x, y + 1.7, z, 0, 0.3, 0.55, 0.26), '#6f6450');                      // the bust
  b.add(CYL(6), M(x, y + 2.25, z, 0, 0.17, 0.35, 0.17), '#6f6450');
}

function build(b: BatchLike, lod: 0 | 2) {
  if (lod === 2) {
    for (const [x, z] of [[-10, -4], [8, 3]]) b.add(BOX(), M(x, g.at(x, z) + 1.4, z, 0, 10, 2.2, 3), '#6f9a5b');
    return;
  }
  playground(b);
  courts(b);
  hidalgo(b);
  for (const [k, [x, z, s]] of TREES.entries()) tree(b, x, g.at(x, z), z, s, k + 71);
  for (const [k, [x, z]] of PALMS.entries()) palm(b, x, g.at(x, z), z, 4.8, k * 0.9);
  for (const l of LAMPS) lamp(b, l.x, g.at(l.x, l.z), l.z);
  for (const [x, z, ry] of BENCHES) bench(b, x, g.at(x, z), z, ry);
}

function ground(): SiteGroundPoly[] {
  return [
    ...WALKS.flatMap(w => gstrip(w, 1.6, GC.pavers, PAT.stone, g, 1.5, 0.08)),
    ...COURTS.flatMap(([cx, cz]) => gfill([{ x: cx - 2.1, z: cz - 3.1 }, { x: cx + 2.1, z: cz - 3.1 }, { x: cx + 2.1, z: cz + 3.1 }, { x: cx - 2.1, z: cz + 3.1 }], '#5f8a6f', PAT.none, g, 2, 0.09)),
    ...gfill([{ x: PLAY.x - PLAY.w / 2, z: PLAY.z - PLAY.d / 2 }, { x: PLAY.x + PLAY.w / 2, z: PLAY.z - PLAY.d / 2 }, { x: PLAY.x + PLAY.w / 2, z: PLAY.z + PLAY.d / 2 }, { x: PLAY.x - PLAY.w / 2, z: PLAY.z + PLAY.d / 2 }], '#d7a86e', PAT.earth, g, 2, 0.09),
  ];
}

const LAWN: Vec2[] = [{ x: -23.2, z: -9.5 }, { x: 21.6, z: -9.5 }, { x: 21.6, z: 8.2 }, { x: -23.2, z: 8.2 }];

const BLOCKERS = [
  ...TREES.map(([x, z]) => ({ x, z, r: 0.3 })), ...PALMS.map(([x, z]) => ({ x, z, r: 0.35 })),
  { x: HIDALGO.x, z: HIDALGO.z, r: 0.75 }, { poly: rect(PLAY.x - 1.5, PLAY.z, 1.7, 1.7) },
];

/** exclusion: the park between Dolores St, 18th St, 20th St and the J Church right of way (kept whole) */
const EXCLUDE: Vec2[] = [{ x: -23.6, z: -11.3 }, { x: 22.0, z: -11.3 }, { x: 22.0, z: 10.2 }, { x: -23.6, z: 10.2 }];

export const doloresPark: W4Site = {
  id: ID,
  tier: 2,
  x: X0,
  z: Z0,
  yaw: YAW,
  base: g.base,
  sink: 0,
  exclude: { poly: worldPoly(X0, Z0, YAW, EXCLUDE) },
  build,
  walk: { blockers: BLOCKERS, surfaces: [{ poly: LAWN, y: 'terrain', surface: 'grass' }] },
  ground: ground(),
  lights: LAMPS.map(l => ({ x: l.x, y: g.at(l.x, l.z) + 3.8, z: l.z, size: 1, color: '#ffd9a0' })),
  plaza: [plazaOf(LAWN, 'grass')],
  w4: {
    placeId: 'dolores-park',
    attractions: ['dolores-park'],
    arrival: { x: 3.2, z: 7.0, heading: Math.PI },
    photo: { target: [0, 1, -4], distance: 40, elevation: 0.3, bearing: 0.3 },
    flag: { x: -1.5, z: 0, h: 30 },
    height: { realM: 0, u: 5.6, rule: 'ground' },
    osm: ['park ways of Mission Dolores Park'],
    terrain: [-26, -15, 24, 12],
    terrainStep: 1,
    ringMin: 0.65,
    notes: 'Walk-around ring 65 %: the row houses of Church St and 18th St close the upper side of the ring.',
  },
};
