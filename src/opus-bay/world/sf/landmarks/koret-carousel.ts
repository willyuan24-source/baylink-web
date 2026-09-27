import * as THREE from 'three';
import type { Vec2 } from '../../../core/types';
import { BOX, type BatchLike, CBOX, M } from '../../builder';
import { GLOW, NONE, cyl, lathe, worldPoly } from './kit';
import { type W4Site, bench, siteGround } from './siteKit';

/**
 * Koret Children's Quarter and the Golden Gate Park Carousel (wave 4, P3 · map T3, the park-east group): the
 * playground opened in 1888 as the Sharon Quarters for Children, one of the first public playgrounds in the US, known
 * for its concrete slides set into the slope; beside it the carousel house with the 1914 Herschell-Spillman carousel
 * (62 hand-painted menagerie animals, in the park since 1940, restored and reopened in 1984; sfrecpark.org,
 * electrictourcompany.com). Toy version: the round carousel house (the city's building OSM way 1554375367 on the same
 * footprint) opened up so the carousel turns inside it (the animate part: platform, centre pole and six animals), and
 * a play mound with two slides and a small climbing tower on the playground. No names, no painted panels.
 *
 * Frame: origin (−109.9, 873.4) at the attraction (the playground), yaw 0 (local = world offsets): the carousel house
 * is at (−3.16, 10.65), r 1.75; the stone Sharon building west of it (x ≤ −7.4) and Kezar Drive east (≥ 2.5 u off the
 * exclusion) stay the city's. The house: 4.6 u in OSM, 4.3 u to the cupola here.
 */

const ID = 'koret-carousel';
const X0 = -109.9, Z0 = 873.4, YAW = 0;
const g = siteGround(ID, 16.8);

const C = { x: -3.16, z: 10.65 }, R_HOUSE = 1.9, R_RIDE = 1.5;
const CREAM = '#f1e6cf', ROOF = '#6f8f6a', ROOF_DARK = '#5d7a59', GOLD = '#d9b44a';
const ANIMALS = ['#f4eee2', '#c9473a', '#e0b04e', '#4f7fbf', '#7a4fa0', '#2f8f88'];
/** the play mound: centre, radius, height */
const MOUND = { x: 2.2, z: -1.8, r: 2.8, h: 1.5 };
const TOWER = { x: -2.4, z: -2.6 };

const hy = () => g.at(C.x, C.z);

function house(b: BatchLike, lod: 0 | 2) {
  const y = hy();
  if (lod === 2) {
    lathe(b, [[R_HOUSE, -0.3], [R_HOUSE, 2.3], [2.3, 2.3], [0.2, 3.7]], C.x, y, C.z, ROOF, NONE, 6);
    return;
  }
  cyl(b, C.x, y - 0.4, C.z, R_HOUSE + 0.1, 0.55, '#cfc6b4', NONE, 10);
  // eight slim posts carry the roof ring; the sides are open so the carousel shows
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
    b.add(BOX(), M(C.x + Math.sin(a) * R_HOUSE, y, C.z + Math.cos(a) * R_HOUSE, a, 0.16, 2.35, 0.16), CREAM);
  }
  lathe(b, [[R_HOUSE + 0.1, 0], [R_HOUSE + 0.1, 0.3], [2.35, 0.3], [2.15, 0.45], [0.95, 1.3], [0.45, 1.45]], C.x, y + 2.25, C.z, (ly: number) => new THREE.Color(ly < 0.35 ? CREAM : ROOF), NONE, 10);
  lathe(b, [[0.5, 0], [0.5, 0.35], [0.16, 0.62], [0.03, 0.75]], C.x, y + 3.7, C.z, ROOF_DARK, NONE, 8);
  b.add(BOX(), M(C.x, y + 4.4, C.z, 0, 0.05, 0.4, 0.05), GOLD);
}

function playground(b: BatchLike) {
  const my = g.at(MOUND.x, MOUND.z);
  lathe(b, [[MOUND.r, -0.2], [MOUND.r * 0.72, MOUND.h * 0.55], [MOUND.r * 0.3, MOUND.h * 0.95], [0.05, MOUND.h]], MOUND.x, my, MOUND.z, '#9fbf7a', NONE, 8);
  // two concrete slides down the mound's north-west face, side by side
  for (const off of [-0.45, 0.45]) {
    const a = -2.35, cx = MOUND.x + Math.sin(a) * 1.55 + Math.cos(a) * off, cz = MOUND.z + Math.cos(a) * 1.55 - Math.sin(a) * off;
    b.add(CBOX(), M(cx, my + 0.75, cz, a, 0.6, 0.12, 3.1, -0.46), '#d8d1c3');
  }
  // a small climbing tower: four posts, a deck, a pointed roof
  const ty = g.at(TOWER.x, TOWER.z);
  for (const [dx, dz] of [[-0.55, -0.55], [0.55, -0.55], [0.55, 0.55], [-0.55, 0.55]]) b.add(BOX(), M(TOWER.x + dx, ty, TOWER.z + dz, 0, 0.12, 2.4, 0.12), '#c9473a');
  b.add(BOX(), M(TOWER.x, ty + 1.1, TOWER.z, 0, 1.3, 0.14, 1.3), '#e0b04e');
  lathe(b, [[0.95, 0], [0.02, 0.8]], TOWER.x, ty + 2.4, TOWER.z, '#4f7fbf', NONE, 4);
}

function build(b: BatchLike, lod: 0 | 2) {
  house(b, lod);
  if (lod === 2) return;
  playground(b);
  bench(b, 1.2, g.at(1.2, 6.2), 6.2, -2.3);
}

/** the carousel (the animate part, LOCAL to the house centre at floor height): platform, centre pole, six animals on poles */
function carousel(b: BatchLike) {
  cyl(b, 0, 0, 0, R_RIDE, 0.18, '#b9a58f', NONE, 12);
  cyl(b, 0, 0.18, 0, 0.3, 2.05, '#e8c07a', GLOW(0.4), 6);
  for (let k = 0; k < ANIMALS.length; k++) {
    const a = (k / ANIMALS.length) * Math.PI * 2, x = Math.sin(a) * 1.1, z = Math.cos(a) * 1.1, lift = k % 2 ? 0.95 : 0.7;
    b.add(CBOX(), M(x, 0.18 + lift, z, a + Math.PI / 2, 0.26, 0.34, 0.7), ANIMALS[k]);
    b.add(CBOX(), M(x + Math.sin(a + Math.PI / 2) * 0.33, 0.18 + lift + 0.3, z + Math.cos(a + Math.PI / 2) * 0.33, a + Math.PI / 2, 0.2, 0.36, 0.22, -0.4), ANIMALS[k]);
    b.add(CBOX(), M(x, 1.2, z, 0, 0.04, 2.0, 0.04), GOLD);
  }
}

/** exclusion: the carousel house and the playground's play mound and tower (the paths around them stay the city's) */
const EXCLUDE: Vec2[] = [{ x: -4.2, z: -4.4 }, { x: 5.2, z: -4.8 }, { x: 5.0, z: 1.8 }, { x: 1.6, z: 8.4 }, { x: -0.6, z: 13.3 }, { x: -5.7, z: 13.3 }, { x: -6.0, z: 7.6 }, { x: -4.6, z: 1.0 }];

export const koretCarousel: W4Site = {
  id: ID,
  tier: 3,
  x: X0,
  z: Z0,
  yaw: YAW,
  base: g.base,
  sink: 0,
  exclude: { poly: worldPoly(X0, Z0, YAW, EXCLUDE) },
  build,
  animate: {
    build: carousel,
    // a slow merry-go-round turn about the house centre
    update(obj, t) { obj.position.set(C.x, hy(), C.z); obj.rotation.set(0, t * 0.55, 0); },
  },
  walk: {
    blockers: [{ x: C.x, z: C.z, r: R_HOUSE + 0.15 }, { x: MOUND.x, z: MOUND.z, r: MOUND.r - 0.3 }, { x: TOWER.x, z: TOWER.z, r: 0.8 }],
  },
  lights: [{ x: C.x, y: hy() + 2.0, z: C.z, size: 1.8, color: '#ffe0a0' }],
  plaza: [{ poly: [{ x: -2.0, z: 1.4 }, { x: 1.8, z: 2.6 }, { x: 0.6, z: 7.4 }, { x: -1.2, z: 7.8 }, { x: -3.4, z: 3.6 }], surface: 'pavement' }, { poly: [{ x: -4.0, z: -4.0 }, { x: -0.4, z: -4.2 }, { x: -0.6, z: -0.6 }, { x: -3.9, z: -0.3 }], surface: 'sand' }],
  w4: {
    placeId: 'koret-carousel',
    attractions: ['koret-carousel'],
    arrival: { x: -1.0, z: 4.6, heading: -0.3 },
    photo: { target: [-2, 1.4, 5], distance: 17, elevation: 0.35, bearing: 0.6 },
    flag: { x: C.x, z: C.z, h: 30 },
    height: { realM: 8, u: 4.4, top: 5.0, rule: 'H = 3.2 + 0.155·h' },
    osm: ['way/1554375367'],
    terrain: [-7, -6, 7, 15],
    notes: 'Carousel hours and fares change and it closes at times (lane C\'s card). The painted panels and the animals\' carving are never copied.',
  },
};
