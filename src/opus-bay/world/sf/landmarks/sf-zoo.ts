import type { Vec2 } from '../../../core/types';
import { BOX, type BatchLike, CBOX, CONE, ICO, M } from '../../builder';
import { worldPoly } from './kit';
import { GC, PAT, type SiteGroundPoly, type W4Site, bench, fence, gfill, plazaOf, siteGround } from './siteKit';

/**
 * San Francisco Zoo (wave 4, P2 · map T2): the zoo by the ocean at Sloat Blvd and the Great Highway, and its African
 * Savanna, the mixed-species yard where giraffes, zebras and ostriches share the grass (sfzoo.org; Wikipedia). The zoo's
 * paths, animal houses and entry plaza stay the city's (OSM); this site stocks the savanna (OSM way 382796793, its
 * grass drawn from the OSM grass area) with toy giraffes, zebras and an ostrich, two flat-topped shade trees and a
 * rock, rails on its viewing sides, and a small wooden deck at the African Savanna Viewpoint (OSM node 3860138780) on
 * the entry-plaza side. The giraffes' necks are the animate part (a slow grazing bob). Never pandas; no names, no
 * signs, no logos.
 *
 * Frame: origin (−122, 1680) on the savanna, yaw 0 (local = world offsets): the Zebra house is north-west (x −7.6…−2.9,
 * z 2.9…8.7), the Giraffe Lodge south-east (x 6…11.8), the viewing path runs along the north edge (z ≈ 6.6), the
 * service road passes south of the deck (z ≈ −8…−9).
 */

const ID = 'sf-zoo';
const X0 = -122, Z0 = 1680, YAW = 0;
const g = siteGround(ID, 0.6);

/** the savanna's grass (OSM, simplified; the notch at x −1.6…1.7, z 0…3.2 is outside it) */
const SAVANNA: Vec2[] = [
  { x: -2.9, z: 7.3 }, { x: -1.5, z: 5.7 }, { x: 1.2, z: 5.8 }, { x: 1.7, z: 3.2 }, { x: -1.1, z: 2.8 }, { x: -1.6, z: 1.0 },
  { x: 0.5, z: 0.1 }, { x: 2.7, z: -1.8 }, { x: 4.6, z: -1.7 }, { x: 5.0, z: -3.8 }, { x: 3.1, z: -4.4 }, { x: 2.7, z: -5.7 },
  { x: 0.2, z: -6.5 }, { x: -1.7, z: -4.6 }, { x: -1.7, z: -3.6 }, { x: -2.3, z: -2.3 }, { x: -4.7, z: -1.2 }, { x: -6.1, z: 0.4 },
  { x: -4.9, z: 2.2 }, { x: -5.6, z: 3.2 },
];
/** the viewing deck at the African Savanna Viewpoint, against the savanna's south-west edge */
const DECK: Vec2[] = [{ x: -3.0, z: -7.5 }, { x: -0.9, z: -7.5 }, { x: 0.1, z: -6.4 }, { x: -1.8, z: -4.4 }, { x: -3.0, z: -4.4 }];
/** rails: along the deck, the entry-plaza side and the north viewing path */
const RAILS: Vec2[][] = [
  [{ x: 0.1, z: -6.3 }, { x: -1.75, z: -4.4 }, { x: -1.75, z: -3.6 }, { x: -2.3, z: -2.25 }, { x: -4.7, z: -1.15 }, { x: -6.0, z: 0.4 }],
  [{ x: -2.8, z: 7.1 }, { x: -1.5, z: 5.65 }, { x: 1.15, z: 5.75 }, { x: 1.65, z: 3.2 }],
];

/** [x, z, heading] (heading: the facing, (sin, cos)) */
const GIRAFFES: [number, number, number][] = [[-3.4, 1.4, 0.5], [1.0, -2.6, -2.3], [-0.6, 4.3, 1.4]];
const ZEBRAS: [number, number, number][] = [[-4.2, 0.2, 0.8], [-2.6, -0.6, 2.0], [-0.6, -1.4, -0.4], [2.0, -4.8, 2.4]];
const OSTRICH: [number, number, number] = [0.0, -4.8, 2.6];
const ACACIAS: [number, number][] = [[-4.0, 3.6], [3.4, -3.2]];

const HIDE = '#d9a55a', PATCH = '#8a5a34', WHITE = '#f1ede4', STRIPE = '#2f2f33', RAIL = '#8a6446';

/** a point `u` to the right and `v` ahead of (x, z) facing `h` */
const ahead = (x: number, z: number, h: number, u: number, v: number) => [x + u * Math.cos(h) + v * Math.sin(h), z - u * Math.sin(h) + v * Math.cos(h)] as const;

/** a giraffe's legs, body and patches (the neck and head are the animate part) */
function giraffe(b: BatchLike, x: number, z: number, h: number) {
  const y = g.at(x, z);
  for (const [u, v] of [[-0.3, -0.55], [0.3, -0.55], [-0.3, 0.5], [0.3, 0.5]]) { const [px, pz] = ahead(x, z, h, u, v); b.add(BOX(), M(px, y, pz, h, 0.14, 1.9, 0.14), HIDE); }
  b.add(CBOX(), M(x, y + 2.15, z, h, 0.8, 0.75, 1.5), HIDE);
  for (const v of [-0.4, 0.25]) { const [px, pz] = ahead(x, z, h, 0, v); b.add(CBOX(), M(px, y + 2.2, pz, h, 0.82, 0.4, 0.3), PATCH); }
}

/** the neck and head over a giraffe's shoulder, leaning forward */
function giraffeNeck(b: BatchLike, x: number, z: number, h: number) {
  const [px, pz] = ahead(x, z, h, 0, 0.6), base = M(px, g.at(x, z) + 2.3, pz, h);
  b.add(CBOX(), base.clone().multiply(M(0, 0.9, 0.35, 0, 0.3, 2.0, 0.3, 0.35)), HIDE);
  b.add(CBOX(), base.clone().multiply(M(0, 1.85, 0.72, 0, 0.26, 0.28, 0.62)), HIDE);
  for (const s of [-0.08, 0.08]) b.add(BOX(), base.clone().multiply(M(s, 1.95, 0.55, 0, 0.05, 0.22, 0.05)), PATCH);
}

function zebra(b: BatchLike, x: number, z: number, h: number) {
  const y = g.at(x, z);
  for (const [u, v] of [[-0.2, -0.45], [0.2, -0.45], [-0.2, 0.45], [0.2, 0.45]]) { const [px, pz] = ahead(x, z, h, u, v); b.add(BOX(), M(px, y, pz, h, 0.1, 0.75, 0.1), WHITE); }
  b.add(CBOX(), M(x, y + 0.98, z, h, 0.5, 0.5, 1.2), WHITE);
  for (const v of [-0.35, 0, 0.35]) { const [px, pz] = ahead(x, z, h, 0, v); b.add(CBOX(), M(px, y + 0.98, pz, h, 0.52, 0.52, 0.1), STRIPE); }
  const [hx, hz] = ahead(x, z, h, 0, 0.72);
  b.add(CBOX(), M(hx, y + 1.35, hz, h, 0.22, 0.55, 0.28, 0.5), WHITE);
}

function ostrich(b: BatchLike) {
  const [x, z, h] = OSTRICH, y = g.at(x, z);
  for (const u of [-0.1, 0.1]) { const [px, pz] = ahead(x, z, h, u, 0); b.add(BOX(), M(px, y, pz, h, 0.06, 0.9, 0.06), '#c9a98a'); }
  b.add(CBOX(), M(x, y + 1.05, z, h, 0.5, 0.4, 0.65), '#3b3430');
  const [nx, nz] = ahead(x, z, h, 0, 0.22);
  b.add(BOX(), M(nx, y + 1.15, nz, h, 0.07, 0.8, 0.07), '#c9a98a');
}

function build(b: BatchLike, lod: 0 | 2) {
  if (lod === 2) {
    for (const [x, z, h] of GIRAFFES.slice(0, 2)) b.add(CBOX(), M(x, g.at(x, z) + 2.0, z, h, 0.8, 2.6, 1.2), HIDE);
    return;
  }
  for (const [x, z, h] of GIRAFFES) giraffe(b, x, z, h);
  for (const [x, z, h] of ZEBRAS) zebra(b, x, z, h);
  ostrich(b);
  for (const r of RAILS) fence(b, r, g.at, 0.95, RAIL);
  // flat-topped shade trees, a rock
  for (const [x, z] of ACACIAS) {
    const y = g.at(x, z);
    b.add(BOX(), M(x, y - 0.2, z, 0.3, 0.18, 2.6, 0.18), '#7a5a3e');
    b.add(CONE(7), M(x, y + 2.3, z, 0, 1.6, 0.55, 1.6), '#7f9a55', [0, 0, 0.25, 0]);
  }
  b.add(ICO(0), M(-2.4, g.at(-2.4, 5.0) + 0.15, 5.0, 0.6, 1.0, 0.6, 0.8), '#a9a192');
  // the deck: a bench facing the grass and a plain board on two posts (no text)
  bench(b, -2.4, g.at(-2.4, -6.7) + 0.12, -6.7, Math.PI / 4);
  const bx = -2.8, bz = -4.9, by = g.at(bx, bz) + 0.12;
  for (const s of [-0.5, 0.5]) b.add(BOX(), M(bx + s * 0.7, by - 0.1, bz - s * 0.7, 0, 0.08, 1.6, 0.08), RAIL);
  b.add(BOX(), M(bx, by + 0.8, bz, Math.PI / 4 + Math.PI / 2, 1.2, 0.7, 0.06), '#e8dfc8');
}

function ground(): SiteGroundPoly[] {
  return [...gfill(SAVANNA, '#c9bd82', PAT.grass, g, 2), ...gfill(DECK, GC.deck, PAT.planks, g, 2, 0.12)];
}

/** exclusion: the savanna and the deck (the paths, the service road and the houses around stay) */
const EXCLUDE: Vec2[] = [...SAVANNA.slice(0, 13), { x: -0.9, z: -7.5 }, { x: -3.0, z: -7.5 }, { x: -3.0, z: -4.4 }, ...SAVANNA.slice(14)];

export const sfZoo: W4Site = {
  id: ID,
  tier: 2,
  x: X0,
  z: Z0,
  yaw: YAW,
  base: g.base,
  sink: 0,
  exclude: { poly: worldPoly(X0, Z0, YAW, EXCLUDE) },
  build,
  animate: {
    // the three necks in one mesh bob slowly, as if grazing the acacias
    build(b: BatchLike) { for (const [x, z, h] of GIRAFFES) giraffeNeck(b, x, z, h); },
    update(obj, t) { obj.position.set(0, Math.sin(t * 0.4) * 0.07, 0); },
  },
  walk: { blockers: [{ poly: SAVANNA }], surfaces: [{ poly: DECK, y: 'terrain', surface: 'wood' }] },
  ground: ground(),
  // crowd spots: the deck, the entry plaza beside it (the city's) and the north viewing path
  plaza: [
    plazaOf(DECK, 'wood'),
    plazaOf([{ x: -7.6, z: -8.6 }, { x: -3.0, z: -8.6 }, { x: -3.0, z: -3.5 }, { x: -7.6, z: -3.5 }]),
    plazaOf([{ x: -1.4, z: 6.3 }, { x: 1.2, z: 6.35 }, { x: 1.2, z: 7.2 }, { x: -1.3, z: 7.4 }], 'pavement'),
  ],
  w4: {
    placeId: 'sf-zoo',
    attractions: ['sf-zoo'],
    lod0R: 220,
    arrival: { x: -2.0, z: -6.0, heading: 0.31 },
    photo: { target: [0, 1.8, 0], distance: 24, elevation: 0.38, bearing: -2.5 },
    flag: { x: -2.2, z: -7.0, h: 30 },
    height: { realM: 5.5, u: 4.3, top: 3.3, rule: 'overlook' },
    osm: ['way/382796793', 'node/3860138780'],
    terrain: [-8, -9, 7, 9],
    notes: 'Never pandas. The zoo\'s paths, animal houses and entry plaza stay the city\'s; the savanna is seen over its rails from the deck and the north path.',
  },
};
