import * as THREE from 'three';
import type { Vec2 } from '../../../core/types';
import { type BatchLike, CBOX, M } from '../../builder';
import { box, cyl, rect, worldPoly } from './kit';
import { type W4Site, fence, siteGround } from './siteKit';

/**
 * Bernal Heights Park (wave 4, P3 · map T2, the bernal site): the bare hilltop above Bernal Heights, about 433 ft high
 * (the surveys differ), with a 360° view of the whole city, a one-mile loop and off-leash dogs (Wikipedia; the
 * scouting). At the top stands a privately owned equipment building and a 50 ft microwave relay tower — Pacific
 * Telephone's 1962 400-circuit relay station, nicknamed "Sutrito" by some neighbours for looking like a small Sutro
 * Tower (Wikipedia "Bernal Heights Summit"; Bernalwood 2012). Toy version: the low concrete equipment building on its
 * OSM footprint (way 68850853), the lattice mast with its microwave horns, the chain-link compound fence. The bare
 * summit, the loop and the trails are the city's. A panorama point.
 *
 * Frame: origin (529.3, 771.25) at the compound's centre, yaw −39.4° (the footprint's edges): the summit's walks pass
 * west and south of the compound (the loop road is the city's). 15 m → 5.6 u to the mast top.
 */

const ID = 'bernal-heights';
const X0 = 529.3, Z0 = 771.25, YAW = (-39.4 * Math.PI) / 180;
const g = siteGround(ID, 27.9);

const CONCRETE = '#cfc9bd', STEEL = '#b9bcb8', FENCE = '#8d938f';
const LOT = { w: 3.6, d: 4.4 }, HOUSE = { x: -0.4, z: 0.9, w: 2.8, d: 2.2, h: 2.1 }, MAST = { x: 0.7, z: -1.3, h: 5.6, base: 0.9 };

function mast(b: BatchLike, y: number, lod: 0 | 2) {
  if (lod === 2) { box(b, MAST.x, y, MAST.z, 0.5, MAST.h, 0.5, STEEL); return; }
  // four tapering legs, three rings of cross bars, the top platform with four microwave horns
  const top = 0.28;
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) b.beam(new THREE.Vector3(MAST.x + sx * MAST.base / 2, y - 0.1, MAST.z + sz * MAST.base / 2), new THREE.Vector3(MAST.x + sx * top, y + MAST.h - 0.6, MAST.z + sz * top), 0.07, 0.07, STEEL);
  for (let k = 1; k <= 3; k++) {
    const f = k / 4, hw = MAST.base / 2 + (top - MAST.base / 2) * f;
    b.add(CBOX(), M(MAST.x, y + (MAST.h - 0.6) * f, MAST.z, 0, hw * 2, 0.06, hw * 2), STEEL);
  }
  box(b, MAST.x, y + MAST.h - 0.6, MAST.z, 0.9, 0.12, 0.9, STEEL);
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 2 + 0.3;
    cyl(b, MAST.x + Math.sin(a) * 0.42, y + MAST.h - 0.45, MAST.z + Math.cos(a) * 0.42, 0.18, 0.42, '#e8e6e0', [0, 0, 0, 0], 6);
  }
  b.add(CBOX(), M(MAST.x, y + MAST.h, MAST.z, 0, 0.06, 0.4, 0.06), '#c9473a', [0, 0, 0, 1.2]);
}

function build(b: BatchLike, lod: 0 | 2) {
  const y = g.at(0, 0);
  box(b, HOUSE.x, y - 0.5, HOUSE.z, HOUSE.w, HOUSE.h + 0.5, HOUSE.d, CONCRETE);
  mast(b, g.at(MAST.x, MAST.z), lod);
  if (lod === 2) return;
  const hw = LOT.w / 2, hd = LOT.d / 2;
  fence(b, [{ x: -hw, z: -hd }, { x: hw, z: -hd }, { x: hw, z: hd }, { x: -hw, z: hd }, { x: -hw, z: -hd }], g.at, 1.3, FENCE);
}

export const bernalHeights: W4Site = {
  id: ID,
  tier: 2,
  x: X0,
  z: Z0,
  yaw: YAW,
  base: g.base,
  sink: 0,
  exclude: { poly: worldPoly(X0, Z0, YAW, rect(0, 0, LOT.w + 0.6, LOT.d + 0.6)) },
  build,
  walk: { blockers: [{ poly: rect(0, 0, LOT.w + 0.1, LOT.d + 0.1) }] },
  lights: [{ x: MAST.x, y: g.at(MAST.x, MAST.z) + MAST.h, z: MAST.z, size: 0.8, color: '#ff6a55' }],
  plaza: [{ poly: [{ x: -2.3, z: -2.7 }, { x: 2.3, z: -2.7 }, { x: 2.3, z: -5.8 }, { x: -2.3, z: -5.8 }], surface: 'dirt' }, { poly: [{ x: -2.4, z: 2.7 }, { x: 2.4, z: 2.7 }, { x: 2.4, z: 6.1 }, { x: -2.4, z: 6.1 }], surface: 'dirt' }],
  w4: {
    placeId: 'bernal-heights',
    attractions: ['bernal-heights-park'],
    arrival: { x: -3.2, z: 0.4, heading: -Math.PI / 2 },
    photo: { target: [0, 3, 0], distance: 18, elevation: 0.3, bearing: -2.2 },
    flag: { x: 0, z: 0, h: 30 },
    height: { realM: 15.2, u: 5.6, top: 6.4, rule: 'H = 3.2 + 0.155·h' },
    osm: ['way/68850853'],
    terrain: [-5, -7, 5, 7],
    terrainStep: 1,
    notes: 'A panorama point: the whole city in every direction. The equipment compound is private (fenced): no gameplay on it.',
  },
};
