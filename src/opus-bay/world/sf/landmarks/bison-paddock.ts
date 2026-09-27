import * as THREE from 'three';
import type { Vec2 } from '../../../core/types';
import { BOX, type BatchLike, CBOX, M } from '../../builder';
import { worldPoly } from './kit';
import { type W4Site, along, conifer, siteGround } from './siteKit';

/**
 * Golden Gate Park Bison Paddock (wave 4, P3 · map T3, the park-west site): bison have lived in the park since 1892
 * and in this meadow beside John F Kennedy Drive since 1899; the SF Zoo looks after the small herd (sfzoo.org). The
 * meadow itself is the city's (OSM way 161707029, the paddock outline); this site fences its viewing sides — JFK Drive
 * on the east and the footway on the north — and grazes a small toy herd near the east fence, where people stop to
 * look. The heads are the animate part (a slow grazing bob). No signs.
 *
 * Frame: origin (−478, 1222) in the meadow, yaw 0 (local = world offsets): the paddock is x −20.3…21.2, z −23.4…22.3;
 * JFK Drive runs along its east side (its centreline from (21.1, −11.7) to (9.3, 10.8)), the north footway ≈ 0.5–1 u
 * outside the north edge. The ground falls ≈ 3.8 u across the meadow (baked on a 2 u grid).
 */

const ID = 'bison-paddock';
const X0 = -478, Z0 = 1222, YAW = 0;
const g = siteGround(ID, 5.2);

/** the paddock (OSM way 161707029, simplified) */
const PADDOCK: Vec2[] = [
  { x: 1.2, z: 22.3 }, { x: -5.8, z: 22.0 }, { x: -10.5, z: 19.2 }, { x: -12.2, z: 17.2 }, { x: -19.0, z: 12.8 }, { x: -20.3, z: 11.7 },
  { x: -17.9, z: 4.7 }, { x: -16.0, z: 3.9 }, { x: -12.8, z: -5.6 }, { x: -10.2, z: -13.3 }, { x: -4.3, z: -17.2 }, { x: 3.8, z: -15.9 },
  { x: 7.8, z: -17.3 }, { x: 11.6, z: -21.6 }, { x: 13.2, z: -23.4 }, { x: 21.2, z: -19.2 }, { x: 8.7, z: 4.7 }, { x: 6.6, z: 11.1 },
  { x: 3.9, z: 16.4 }, { x: 2.9, z: 17.3 },
];
/** the fenced viewing sides: the north footway, then JFK Drive (inset 0.25 u) */
const FENCE: Vec2[] = [
  { x: -10.0, z: -13.1 }, { x: -4.3, z: -16.9 }, { x: 3.8, z: -15.6 }, { x: 7.9, z: -17.0 }, { x: 11.7, z: -21.3 }, { x: 13.3, z: -23.0 },
  { x: 20.8, z: -19.1 }, { x: 8.4, z: 4.6 }, { x: 6.3, z: 11.0 }, { x: 3.6, z: 16.2 },
];

/** the herd near the east fence: [x, z, heading, size] */
const HERD: [number, number, number, number][] = [
  [11.0, -12.0, -2.2, 1.0], [8.6, -9.4, -1.7, 1.1], [12.6, -16.4, -2.6, 0.95], [6.2, -5.6, -1.2, 1.05],
  [4.4, -11.0, 2.4, 0.9], [7.2, -1.2, -1.9, 1.0], [3.0, -3.0, 1.1, 0.8], [9.2, -14.6, 0.6, 1.0],
];

const HIDE = '#7a5a3e', MANE = '#3f2e22', HORN = '#d8cfbf', RAIL = '#8a6a4c';

/** a point `u` to the right and `v` ahead of (x, z) facing `h` */
const ahead = (x: number, z: number, h: number, u: number, v: number) => [x + u * Math.cos(h) + v * Math.sin(h), z - u * Math.sin(h) + v * Math.cos(h)] as const;

/** one bison: front and hind legs, the body, the high shaggy hump over the shoulders (48 triangles); the head is the
 *  animate part */
function bison(b: BatchLike, x: number, z: number, h: number, s: number) {
  const y = g.at(x, z) - 0.25;
  for (const [v, w] of [[0.4, 0.5], [-0.5, 0.45]] as const) {
    const [lx, lz] = ahead(x, z, h, 0, v * s);
    b.add(BOX(), M(lx, y, lz, h, w * s, 0.85 * s, 0.28 * s), MANE);
  }
  b.add(CBOX(), M(x, y + 1.05 * s, z, h, 0.75 * s, 0.6 * s, 1.5 * s), HIDE);
  const [hx, hz] = ahead(x, z, h, 0, 0.35 * s);
  b.add(CBOX(), M(hx, y + 1.3 * s, hz, h, 0.85 * s, 0.95 * s, 0.8 * s, -0.15), MANE);
}

function head(b: BatchLike, x: number, z: number, h: number, s: number) {
  const y = g.at(x, z) - 0.25;
  const [px, pz] = ahead(x, z, h, 0, 0.95 * s);
  b.add(CBOX(), M(px, y + 0.95 * s, pz, h, 0.5 * s, 0.55 * s, 0.55 * s, 0.35), MANE);
  const [cx, cz] = ahead(x, z, h, 0, 0.85 * s);
  b.add(BOX(), M(cx, y + 1.2 * s, cz, h, 0.72 * s, 0.07 * s, 0.07 * s), HORN);
}

function build(b: BatchLike, lod: 0 | 2) {
  if (lod === 2) {
    for (const [x, z, h, s] of HERD.slice(0, 2)) b.add(CBOX(), M(x, g.at(x, z) + 0.8 * s, z, h, 0.8 * s, 1.3 * s, 1.6 * s), HIDE);
    return;
  }
  for (const [x, z, h, s] of HERD) bison(b, x, z, h, s);
  // a post-and-rail fence, posts every 5 u
  for (const p of along(FENCE, 5, 0, 0)) b.add(BOX(), M(p.x, g.at(p.x, p.z) - 0.4, p.z, p.ry, 0.14, 1.55, 0.14), RAIL);
  for (let i = 0; i + 1 < FENCE.length; i++) {
    const a = FENCE[i], c = FENCE[i + 1];
    b.beam(new THREE.Vector3(a.x, g.at(a.x, a.z) + 0.85, a.z), new THREE.Vector3(c.x, g.at(c.x, c.z) + 0.85, c.z), 0.08, 0.1, RAIL);
  }
  // the hay feeder the keepers fill
  b.add(BOX(), M(13.6, g.at(13.6, -13.6) - 0.2, -13.6, 0.5, 1.6, 0.8, 0.8), '#7a6048');
  b.add(BOX(), M(13.6, g.at(13.6, -13.6) + 0.6, -13.6, 0.5, 1.4, 0.25, 0.6), '#d8c27a');
  // one of the meadow's pines (the exclusion drops the city's props inside the paddock)
  conifer(b, 0.4, g.at(0.4, -11.7) - 0.2, -11.7, 1.1);
}

export const bisonPaddock: W4Site = {
  id: ID,
  tier: 3,
  x: X0,
  z: Z0,
  yaw: YAW,
  base: g.base,
  exclude: { poly: worldPoly(X0, Z0, YAW, PADDOCK) },
  build,
  animate: {
    // the heads dip to graze and come up again, all together
    build(b: BatchLike) { for (const [x, z, h, s] of HERD) head(b, x, z, h, s); },
    update(obj, t) { obj.position.set(0, -0.12 * (0.5 + 0.5 * Math.sin(t * 0.5)), 0); },
  },
  walk: { blockers: [{ poly: PADDOCK }] },
  plaza: [
    // the JFK Drive side between the fence and the roadway, and the north footway
    { poly: [{ x: 17.8, z: -12.4 }, { x: 19.1, z: -12.4 }, { x: 10.7, z: 3.6 }, { x: 9.4, z: 3.6 }], surface: 'pavement' },
    { poly: [{ x: -9.0, z: -15.0 }, { x: -4.3, z: -18.3 }, { x: 3.8, z: -17.2 }, { x: 3.8, z: -16.3 }, { x: -4.3, z: -17.4 }, { x: -8.6, z: -14.5 }], surface: 'pavement' },
  ],
  w4: {
    placeId: 'bison-paddock',
    attractions: ['bison-paddock'],
    arrival: { x: 13.9, z: -2.0, heading: -Math.PI / 2 },
    photo: { target: [8, 1, -9], distance: 22, elevation: 0.3, bearing: 1.1 },
    flag: { x: 4.0, z: -4.0, h: 30 },
    height: { realM: 2, u: 1.9, rule: 'ground' },
    osm: ['way/161707029'],
    terrain: [-22, -25, 23, 24],
    notes: 'The meadow and its trees stay the city\'s ground; only the viewing sides are fenced (the far sides read as the meadow edge).',
  },
};
