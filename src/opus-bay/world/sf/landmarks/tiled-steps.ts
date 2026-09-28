import * as THREE from 'three';
import type { Vec2 } from '../../../core/types';
import { BOX, type BatchLike, M } from '../../builder';
import { NONE, worldPoly } from './kit';
import { FC, type W4Site, bench, lamp, siteGround } from './siteKit';

/**
 * The 16th Avenue Tiled Steps, "Moraga Steps" (wave 4, P3 · map T3, the golden-gate-heights group with Grand View
 * Park): 163 steps from Moraga Street at 16th Avenue up toward 15th Avenue and Grand View Park, their risers covered
 * with a sea-to-sky mosaic of about 2,000 handmade tiles by Aileen Barr and Colette Crutcher, made with the neighbours
 * and finished in 2005 (Wikipedia; the scouting). The mosaic itself is never copied: the toy risers climb through an
 * ABSTRACT colour run — deep sea, surf, sand, green hills, sky, a pale sun at the top — on fourteen toy steps between low
 * garden walls with the neighbours' planting, a lamp at the foot and a bench at the top landing.
 *
 * Frame: origin (−113.3, 1143.4) at the attraction on the stair, yaw 138°: local +z climbs the stair (its centreline
 * x −0.35 from the corner of 16th Ave and Moraga St — the streets' ribbon ends at z −3.9 — to the top landing at z 2.4); the houses stand 0.75 u
 * off both sides (x ≤ −1.1 and ≥ 1.2). The city's walk keeps the stair (the steps follow its walked slope).
 */

const ID = 'tiled-steps';
const X0 = -113.3, Z0 = 1143.4, YAW = (138 * Math.PI) / 180;
const g = siteGround(ID, 28.3);

const CX = -0.35, Z_FOOT = -3.9, Z_TOP = 2.4, N = 14, W = 1.4;
/** the abstract run up the risers: sea, surf, sand, hills, sky, sun */
const RUN: [number, string][] = [[0, '#23507a'], [0.18, '#2f7fa6'], [0.33, '#6fb7c0'], [0.45, '#e3cf94'], [0.58, '#8fb46a'], [0.72, '#6fa8d8'], [0.88, '#a9d0ec'], [1, '#f3dc8a']];
const runColor = (t: number) => {
  let i = 0;
  while (i + 1 < RUN.length - 1 && RUN[i + 1][0] <= t) i++;
  const [t0, c0] = RUN[i], [t1, c1] = RUN[i + 1];
  return new THREE.Color(c0).lerp(new THREE.Color(c1), Math.min(1, Math.max(0, (t - t0) / (t1 - t0))));
};

function build(b: BatchLike, lod: 0 | 2) {
  const dz = (Z_TOP - Z_FOOT) / N;
  if (lod === 2) {
    for (const k of [0, 1]) { const z0 = Z_FOOT + (k * (Z_TOP - Z_FOOT)) / 2, zc = z0 + (Z_TOP - Z_FOOT) / 4; b.add(BOX(), M(CX, g.at(CX, zc) - 1, zc, 0, W, 1.1, (Z_TOP - Z_FOOT) / 2), runColor(k ? 0.8 : 0.2)); }
    return;
  }
  // fourteen steps, each a block whose top meets the walked slope at its middle; the riser colour runs sea → sun
  for (let k = 0; k < N; k++) {
    const zc = Z_FOOT + dz * (k + 0.5), top = g.at(CX, zc) + 0.04;
    b.add(BOX(), M(CX, top - 0.9, zc, 0, W, 0.9, dz), runColor(k / (N - 1)), NONE);
  }
  // low garden walls along both sides, stepping with the stair, and the neighbours' planting behind the east one (the
  // west house stands at the wall: W4-L-review, its planting boxes were inside that house)
  for (const side of [-1, 1]) {
    const x = CX + side * (W / 2 + 0.12);
    for (let k = 0; k < N; k += 4) {
      const z0 = Z_FOOT + dz * k, z1 = z0 + dz * 4, y0 = g.at(x, z0) + 0.35, y1 = g.at(x, z1) + 0.35;
      b.beam(new THREE.Vector3(x, y0, z0), new THREE.Vector3(x, y1, z1), 0.2, 0.5, FC.concrete);
    }
    if (side < 0) continue;
    for (const [k, z] of [-2.9, -0.4, 1.8].entries()) {
      const hx = CX + side * (W / 2 + 0.5), y = g.at(hx, z);
      b.add(BOX(), M(hx, y - 0.2, z, 0.3 * side, 0.55, 0.75 + (k % 2) * 0.25, 1.4), k % 2 ? FC.hedge : '#7fa05a');
    }
  }
  lamp(b, CX + W / 2 + 0.45, g.at(CX + W / 2 + 0.45, Z_FOOT - 0.3), Z_FOOT - 0.3);
  bench(b, CX + 0.35, g.at(CX + 0.35, Z_TOP + 0.7), Z_TOP + 0.7, -Math.PI / 2);
}

/** exclusion: the stair between the houses, its foot at the end of Moraga St and the top landing */
const EXCLUDE: Vec2[] = [{ x: -1.65, z: -4.05 }, { x: 1.25, z: -4.05 }, { x: 1.25, z: 4.0 }, { x: -1.65, z: 4.0 }];

export const tiledSteps: W4Site = {
  id: ID,
  tier: 3,
  x: X0,
  z: Z0,
  yaw: YAW,
  base: g.base,
  sink: 0,
  exclude: { poly: worldPoly(X0, Z0, YAW, EXCLUDE) },
  build,
  walk: { blockers: [{ x: CX + W / 2 + 0.45, z: Z_FOOT - 0.3, r: 0.15 }] },
  lights: [{ x: CX + W / 2 + 0.45, y: g.at(CX + W / 2 + 0.45, Z_FOOT - 0.3) + 3.8, z: Z_FOOT - 0.3, size: 1, color: '#ffd9a0' }],
  plaza: [
    { poly: [{ x: CX - W / 2, z: Z_FOOT }, { x: CX + W / 2, z: Z_FOOT }, { x: CX + W / 2, z: Z_TOP }, { x: CX - W / 2, z: Z_TOP }], surface: 'stairs' },
    // the foot on the corner of 16th Ave and Moraga St (people stop there to look up the run of colours), the top
    // landing, and the garden strip on the east side (the west house stands at the stair). The foot is the sidewalk of
    // the street across it (its asphalt from z −4.6: W4-L-review, the plaza reached onto it)
    { poly: [{ x: -2.5, z: -4.4 }, { x: 2.5, z: -4.4 }, { x: 2.5, z: Z_FOOT }, { x: -2.5, z: Z_FOOT }], surface: 'pavement' },
    { poly: [{ x: -1.2, z: Z_TOP }, { x: 1.2, z: Z_TOP }, { x: 1.2, z: 5.2 }, { x: -1.2, z: 5.2 }], surface: 'pavement' },
    { poly: [{ x: CX + W / 2 + 0.1, z: Z_FOOT }, { x: 1.2, z: Z_FOOT }, { x: 1.2, z: Z_TOP }, { x: CX + W / 2 + 0.1, z: Z_TOP }], surface: 'grass' },
  ],
  w4: {
    placeId: 'tiled-steps-16th-avenue',
    attractions: ['tiled-steps-16th-avenue'],
    arrival: { x: CX, z: Z_FOOT - 0.6, heading: 0 },
    photo: { target: [CX, 1.5, -1.5], distance: 11, elevation: 0.12, bearing: Math.PI },
    flag: { x: CX, z: 0, h: 30 },
    height: { realM: 29, u: 2.6, top: 4.6, rule: 'overlook' },
    osm: [],
    terrain: [-3, -9, 3, 5],
    terrainStep: 1,
    plazaMin: 20,
    notes: 'The crowd plaza is the stair, the sidewalk at its foot, the top landing and the east garden strip (≈ 23 u²: the houses close both sides). Never a copy of the mosaic (Aileen Barr and Colette Crutcher\'s artwork): an abstract colour run on the risers only. The Hidden Garden Steps (16th Ave, Kirkham to Lawton) are a card.',
  },
};
