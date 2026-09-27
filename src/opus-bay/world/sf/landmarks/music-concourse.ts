import type { Vec2 } from '../../../core/types';
import { BOX, type BatchLike, ICO, M } from '../../builder';
import { GLOW, LIT, NONE, arch, box, gable, lathe, rect, worldPoly } from './kit';
import { FC, GC, PAT, type SiteGroundPoly, type W4Site, bench, gfill, lamp, plazaOf, siteGround } from './siteKit';

/**
 * The Music Concourse (wave 4, P2, Golden Gate Park): the sunken bowl between the de Young and the California Academy
 * of Sciences, laid out for the 1894 Midwinter Fair — lawn squares between gravel walks under rows of pollarded plane
 * trees, a fountain, benches before the Spreckels Temple of Music, the 1900 bandshell at its south end. The attraction
 * cards are the neighbours' (de Young, Cal Academy, the Tea Garden); this record is the bowl they share.
 *
 * Frame: origin (−224.5, 939), yaw 0 (local = world offsets; +z = south to the bandshell). The bowl (OSM park way of
 * the Music Concourse, place osm-w30899551) is x −9.6…10, z −19.6…19.2; the exclusion stays inside Music Concourse
 * Drive's loop and Hagiwara Tea Garden Drive, and 0.9 u off the pedestrian walk south of the bandshell. The bandshell
 * replaces OSM way 30896932: a tall arched shell with its cornice, flanked by colonnades, 5.8 u high.
 */

const ID = 'music-concourse';
const X0 = -224.5, Z0 = 939, YAW = 0;
const g = siteGround(ID, 16.6);

const STONE = '#e7dcc4', STONE_SHADE = '#d2c5aa', SHELL = '#5b5249', GRAVEL = '#dccbaa';
const FLOOR: Vec2[] = [{ x: -8.0, z: -15.4 }, { x: -6.9, z: -17.0 }, { x: 8.6, z: -17.0 }, { x: 8.6, z: 18.7 }, { x: -8.0, z: 18.7 }];
/** the lawn squares (two columns, three rows) and the audience area before the bandshell */
const LAWNS: [number, number, number, number][] = [[-6.2, -15.6, -1.2, -9.0], [1.2, -15.6, 6.8, -9.0], [-6.2, -6.6, -1.2, 0.0], [1.2, -6.6, 6.8, 0.0], [-6.2, 3.4, -1.2, 8.0], [1.2, 3.4, 6.8, 8.0]];
const TREE_X = [-6.9, 0.0, 7.6], TREE_Z = [-16.2, -12.3, -8.2, -4.2, -0.6, 2.6, 8.8];
const FOUNTAIN = { x: 0.3, z: 1.4 };
const LAMPS: Vec2[] = [{ x: -7.3, z: 10.4 }, { x: 7.7, z: 10.4 }, { x: -7.3, z: -10.4 }, { x: 7.7, z: -10.4 }];
const BENCHES: [number, number][] = [[-4.4, 10.6], [-1.4, 10.6], [2.2, 10.6], [5.2, 10.6], [-3.0, 12.8], [3.6, 12.8]];

/** a pollarded plane tree: straight trunk, a clipped flat crown (≈ 32 triangles) */
function pollard(b: BatchLike, x: number, y: number, z: number, k: number) {
  b.add(BOX(), M(x, y - 0.2, z, k, 0.22, 2.3, 0.22), FC.trunk);
  b.add(ICO(0), M(x, y + 2.55, z, k * 1.7, 1.25, 0.75, 1.25), k % 2 ? FC.tree : FC.treeDark, [0, 0, 0.25, 0]);
}

/** Spreckels Temple of Music: the arched shell, cornice and flanking colonnades, facing north (local −z) */
function bandshell(b: BatchLike, lod: 0 | 2) {
  const cx = -0.6, cz = 17.5, y0 = g.at(cx, cz - 2);
  box(b, cx, -1.2, cz, 3.4, y0 + 5.2 + 1.2, 2.4, STONE, GLOW(0.2));
  gable(b, cx, y0 + 5.2, cz, 3.8, 2.6, 0.6, STONE_SHADE, STONE, 0, 0.1);
  for (const s of [-1, 1]) box(b, cx + s * 3.6, -1.2, cz + 0.3, 3.8, y0 + 3.0 + 1.2, 1.8, STONE, GLOW(0.15));
  if (lod === 2) return;
  arch(b, cx, y0 + 0.4, cz - 1.22, 2.6, 4.2, Math.PI, SHELL, LIT(y0 + 0.4));
  box(b, cx, y0 - 0.2, cz - 1.9, 4.2, 0.6, 1.4, STONE_SHADE);                    // the stage apron
  box(b, cx, y0 + 4.6, cz - 1.25, 3.9, 0.45, 0.2, STONE_SHADE);                  // cornice
  for (const s of [-1, 1]) {
    box(b, cx + s * 3.6, y0 + 3.0, cz + 0.3, 4.1, 0.3, 2.0, STONE_SHADE);
    for (let k = 0; k < 4; k++) box(b, cx + s * (2.2 + k * 0.95), y0 - 0.1, cz - 0.7, 0.24, 3.1, 0.24, STONE);
  }
}

function fountain(b: BatchLike) {
  const y = g.at(FOUNTAIN.x, FOUNTAIN.z);
  lathe(b, [[1.5, 0], [1.5, 0.45], [1.3, 0.45], [1.3, 0.25]], FOUNTAIN.x, y - 0.1, FOUNTAIN.z, STONE, NONE, 12);
  lathe(b, [[0.25, 0], [0.25, 0.9], [0.7, 1.0], [0.1, 1.15]], FOUNTAIN.x, y, FOUNTAIN.z, STONE_SHADE, NONE, 8);
  lathe(b, [[1.28, 0], [0.02, 0.02]], FOUNTAIN.x, y + 0.3, FOUNTAIN.z, '#7fb7c4', GLOW(0.15), 12);
  lathe(b, [[0.12, 0], [0.02, 0.9]], FOUNTAIN.x, y + 1.1, FOUNTAIN.z, '#e8f4f6', GLOW(0.3), 6);
}

function build(b: BatchLike, lod: 0 | 2) {
  bandshell(b, lod);
  if (lod === 2) return;
  let k = 0;
  for (const x of TREE_X) for (const z of TREE_Z) pollard(b, x, g.at(x, z), z, k++);
  fountain(b);
  for (const l of LAMPS) lamp(b, l.x, g.at(l.x, l.z), l.z);
  for (const [x, z] of BENCHES) bench(b, x, g.at(x, z), z, Math.PI);
}

function ground(): SiteGroundPoly[] {
  return [
    ...gfill(FLOOR, GRAVEL, PAT.earth, g, 2),
    ...LAWNS.flatMap(([x0, z0, x1, z1]) => gfill([{ x: x0, z: z0 }, { x: x1, z: z0 }, { x: x1, z: z1 }, { x: x0, z: z1 }], GC.lawn, PAT.grass, g, 2.5, 0.075)),
    ...gfill([{ x: -6.6, z: 9.6 }, { x: 7.2, z: 9.6 }, { x: 7.2, z: 14.4 }, { x: -6.6, z: 14.4 }], GC.plaza, PAT.stone, g, 3, 0.075),
  ];
}

const BLOCKERS = [
  { poly: rect(-0.6, 17.5, 3.4, 2.4) }, ...[-1, 1].map(s => ({ poly: rect(-0.6 + s * 3.6, 17.8, 3.8, 1.8) })),
  { x: FOUNTAIN.x, z: FOUNTAIN.z, r: 1.55 },
  ...TREE_X.flatMap(x => TREE_Z.map(z => ({ x, z, r: 0.25 }))),
];

const EXCLUDE: Vec2[] = [{ x: -8.2, z: -15.2 }, { x: -6.8, z: -17.2 }, { x: 8.8, z: -17.2 }, { x: 8.8, z: 18.8 }, { x: -8.2, z: 18.8 }];

export const musicConcourse: W4Site = {
  id: ID,
  tier: 2,
  x: X0,
  z: Z0,
  yaw: YAW,
  base: g.base,
  exclude: { poly: worldPoly(X0, Z0, YAW, EXCLUDE) },
  build,
  walk: { blockers: BLOCKERS, surfaces: [{ poly: FLOOR, y: 'terrain', surface: 'dirt' }] },
  ground: ground(),
  lights: [...LAMPS.map(l => ({ x: l.x, y: g.at(l.x, l.z) + 3.8, z: l.z, size: 1, color: '#ffd9a0' })), { x: -0.6, y: g.at(-0.6, 15) + 3, z: 15.6, size: 2.2, color: '#ffe3b0' }],
  plaza: [plazaOf(FLOOR, 'dirt')],
  w4: {
    placeId: 'osm-w30899551',
    attractions: [],
    arrival: { x: 0.3, z: -3.0, heading: Math.PI },
    photo: { target: [0, 2, 6], distance: 40, elevation: 0.42, bearing: 2.6 },
    flag: { x: -0.6, z: 17.5, h: 30 },
    height: { realM: 17, u: 5.8, rule: 'H = 3.2 + 0.155·h' },
    osm: ['way/30896932', 'place osm-w30899551'],
    terrain: [-10, -19, 10, 20],
    notes: 'Shared bowl of the Music Concourse site: no attraction of its own (the de Young, cal-academy and japanese-tea-garden records carry them); place row = the Music Concourse park.',
  },
};
