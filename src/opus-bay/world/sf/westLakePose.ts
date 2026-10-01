import * as THREE from 'three';
import type { Vec2 } from '../../core/types';
import type { InstanceSink } from './westSeaPose';

/**
 * Wave 8 · lane W2 · Blue Heron Lake (formerly Stow Lake, Golden Gate Park): toy pedal boats and rowboats out on the
 * lake by day, a few moored at the boathouse's landing, ducks, and a great blue heron on the island's shore (sf-w8-lead
 * §3 W2 (2)). Pure data and the pose writer (node tests); world/sf/westLake.ts draws it as ONE InstancedMesh.
 *
 *   LAKE_Y      the lake's drawn surface: world/sf/far.ts gives a lake on a hill a flat surface at its lowest shore
 *               point less 0.2 (the published far ring of OSM relation 12908: 18.29; read in the browser on the
 *               'city-lakes' mesh 2026-09-30) — the banks stand ≈ 1.7 u over it
 *   BASINS      the wide parts of the ring of water round Strawberry Hill (the published city's water raster at 0.5 u,
 *               the clearance to the nearest non-water cell — scratch opus-qa/w8/w2/lake/basins.mts): each boat potters
 *               round a small circle inside one, so it never meets the banks (the narrow channels between them stay
 *               empty) and two boats on one circle sail half a turn apart
 *   BOATHOUSE   OSM way 120479803 "Blue Heron Lake Boathouse & Bike Rental" (amenity=boat_rental, pedalboat_rental /
 *               rowboat_rental yes) on the lake's west shore; its landing faces east over the water
 *
 * Facts (checked 2026-09-30): the boathouse rents "American-Made row and pedal boats" and has been "In operation since
 * 1893" (https://blueheronboathouse.com/); the current building is a 1946–49 "alpine chalet style" lodge
 * (https://en.wikipedia.org/wiki/Blue_Heron_Lake_Boathouse); the lake was renamed Blue Heron Lake after the great blue
 * heron (OSM relation 12908 name:etymology; https://sfrecpark.org). The toy boats' colours are the toy's own.
 */

export const LAKE_Y = 18.29;

/** a boat: the basin's centre, the circle's radius (u), its speed (u / s, > 0 anticlockwise seen from above), phase (rad), kind, hull colour */
export interface Boat { cx: number; cz: number; r: number; v: number; phase: number; kind: 'pedal' | 'row'; hull: string }
const PEDAL = ['#f4f1e8', '#f2c14e', '#3fae9a', '#e8483c', '#7fb3e0'], ROW = ['#2f6b4f', '#f4f1e8', '#3a5f8a'];
const bt = (cx: number, cz: number, r: number, v: number, phase: number, kind: 'pedal' | 'row', k: number): Boat => ({ cx, cz, r, v, phase, kind, hull: kind === 'pedal' ? PEDAL[k % PEDAL.length] : ROW[k % ROW.length] });
/** the basins: centre x, z and the clearance there (u) — the published water raster (see above) */
export const BASINS: readonly [number, number, number][] = [
  [-243.5, 1022.5, 5.0], [-251.5, 1010.5, 4.9], [-253.5, 998.5, 4.5], [-296, 1034, 4.0], [-284, 1019, 3.6], [-277.5, 1049.5, 3.0],
];
export const BOATS: readonly Boat[] = [
  bt(-243.5, 1022.5, 2.6, 0.42, 0, 'pedal', 0), bt(-243.5, 1022.5, 2.6, 0.42, Math.PI, 'pedal', 1),
  bt(-251.5, 1010.5, 2.5, -0.34, 0.8, 'row', 0), bt(-251.5, 1010.5, 2.5, -0.34, 0.8 + Math.PI, 'pedal', 2),
  bt(-253.5, 998.5, 2.1, 0.3, 2.0, 'row', 1),
  bt(-296, 1034, 1.7, -0.36, 1.1, 'pedal', 3), bt(-296, 1034, 1.7, -0.36, 1.1 + Math.PI, 'row', 2),
  bt(-284, 1019, 1.3, 0.3, 0.4, 'pedal', 4),
  bt(-277.5, 1049.5, 0.7, 0.18, 2.6, 'row', 0),
];
/**
 * boats moored at the boathouse's landing, bows to the shore: 2.9 u out from the building's axis on its lake side, 1.5 u
 * apart along it (OSM 120479803: the long axis runs (0.723, −0.691), the lake lies along (0.691, 0.723)): x, z, heading,
 * kind, colour index
 */
export const MOORED: readonly [number, number, number, 'pedal' | 'row', number][] = [
  [-303.21, 1025.06, -2.38, 'pedal', 0], [-304.3, 1026.1, -2.38, 'pedal', 3], [-305.38, 1027.13, -2.38, 'row', 1],
];
/** the boat's size (u): its length, beam and the hull's height (half of it under the water) */
export const BOAT = { pedal: { len: 1.7, beam: 1.0, h: 0.55 }, row: { len: 1.9, beam: 0.8, h: 0.45 } } as const;
/** ducks paddling round small circles near the banks: centre x, z, radius, speed (rad / s), phase */
export const DUCKS: readonly [number, number, number, number, number][] = [[-300.5, 1023, 0.9, 0.22, 0], [-262, 1007.5, 0.8, -0.25, 2], [-291, 1040.5, 0.6, 0.3, 4]];
/** the heron on the island's shore by the south footbridge (the island loop, blue-heron-lake.ts): x, z, ground y, heading (toward the water) */
export const HERON = { x: -264.0, z: 1011.0, y: 20.4, heading: Math.PI } as const;
export const LAKE_CENTRE: Vec2 = { x: -272, z: 1022 };

/** instances per boat: hull, deck, two riders (body + head each), two oars */
export const BOAT_PARTS = 8;
export const MOORED_PARTS = 2;
export const HERON_PARTS = 7;
export const MOORED_FROM = 0;
export const DUCKS_FROM = MOORED.length * MOORED_PARTS;
export const HERON_FROM = DUCKS_FROM + DUCKS.length * 2;
export const BOATS_FROM = HERON_FROM + HERON_PARTS;
export const LAKE_CAPACITY = BOATS_FROM + BOATS.length * BOAT_PARTS;
/** the boats are out by day (the boathouse rents from late morning to late afternoon): the sky's night factor below this */
export const BOATS_NIGHT_MAX = 0.35;

const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e3 = new THREE.Euler(0, 0, 0, 'YXZ'), p3 = new THREE.Vector3(), s3 = new THREE.Vector3();
const col = new THREE.Color();
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
function put(sink: InstanceSink, i: number, x: number, y: number, z: number, sx: number, sy: number, sz: number, yaw: number, pitch = 0, roll = 0) {
  e3.set(pitch, yaw, roll);
  sink.setMatrixAt(i, m4.compose(p3.set(x, y, z), q.setFromEuler(e3), s3.set(sx, sy, sz)));
}

const SHIRTS = ['#e8483c', '#3a7bd5', '#f2c14e', '#5aa469', '#8e5ea2', '#f08fb0', '#2f9aa0'];
const SKIN = ['#e0b08c', '#a8724e', '#f0c9a4', '#6b4630', '#c98e66'];
const DECK = '#ece6d6', OAR = '#b88a52', DUCK = '#6d5a3f', DUCK_HEAD = '#2f6b3f';
const HERON_C = { body: '#7f93a8', neck: '#c9d2da', head: '#e9ecef', beak: '#e0b030', leg: '#5a5f63' };

/** Paint every instance once (colours never change after this). */
export function paintLake(sink: InstanceSink) {
  let i = 0;
  for (const [, , , kind, k] of MOORED) { sink.setColorAt(i++, col.set(kind === 'pedal' ? PEDAL[k % PEDAL.length] : ROW[k % ROW.length])); sink.setColorAt(i++, col.set(DECK)); }
  for (let k = 0; k < DUCKS.length; k++) { sink.setColorAt(i++, col.set(DUCK)); sink.setColorAt(i++, col.set(DUCK_HEAD)); }
  for (const c of [HERON_C.body, HERON_C.neck, HERON_C.head, HERON_C.beak, HERON_C.leg, HERON_C.leg, HERON_C.body]) sink.setColorAt(i++, col.set(c));
  BOATS.forEach((b, k) => {
    sink.setColorAt(i++, col.set(b.hull));
    sink.setColorAt(i++, col.set(DECK));
    sink.setColorAt(i++, col.set(SHIRTS[(k * 3) % SHIRTS.length]));
    sink.setColorAt(i++, col.set(SKIN[k % SKIN.length]));
    sink.setColorAt(i++, col.set(SHIRTS[(k * 3 + 2) % SHIRTS.length]));
    sink.setColorAt(i++, col.set(SKIN[(k + 2) % SKIN.length]));
    sink.setColorAt(i++, col.set(OAR));
    sink.setColorAt(i++, col.set(OAR));
  });
}

/** Where a boat is at time t: its centre and heading (the tangent of its circle). */
export function boatAt(b: Boat, t: number, out: { x: number; z: number; yaw: number } = { x: 0, z: 0, yaw: 0 }) {
  const a = b.phase + (b.v / b.r) * t;
  out.x = b.cx + Math.cos(a) * b.r;
  out.z = b.cz + Math.sin(a) * b.r;
  // d/da (cos a, sin a) = (−sin a, cos a); a negative speed sails the other way
  const s = Math.sign(b.v) || 1;
  out.yaw = Math.atan2(-Math.sin(a) * s, Math.cos(a) * s);
  return out;
}

/** A hull and its deck (the deck: a lighter oval inset on top, so the boat reads as a boat and not as a pebble). */
function hull(sink: InstanceSink, i: number, x: number, z: number, yaw: number, kind: 'pedal' | 'row', bob: number, roll: number) {
  const d = BOAT[kind];
  put(sink, i, x, LAKE_Y + bob, z, d.beam, d.h, d.len, yaw, 0, roll);
  put(sink, i + 1, x, LAKE_Y + bob + d.h * 0.32, z, d.beam * 0.78, d.h * 0.4, d.len * 0.8, yaw, 0, roll);
}

const at = { x: 0, z: 0, yaw: 0 };
/**
 * One frame at time `t` (s) and the sky's `night` (0 … 1): writes every instance it draws and returns the count — the
 * boats out on the lake are the last block, left out at night (the moored ones, the ducks and the heron stay). No
 * allocation.
 */
export function poseLake(sink: InstanceSink, t: number, night: number): number {
  let i = 0;
  for (let k = 0; k < MOORED.length; k++) {
    const m = MOORED[k];
    hull(sink, i, m[0], m[1], m[2], m[3], Math.sin(t * 0.9 + k) * 0.02, Math.sin(t * 0.7 + k * 2) * 0.03);
    i += MOORED_PARTS;
  }
  for (let k = 0; k < DUCKS.length; k++) {
    const d = DUCKS[k], a = d[4] + d[3] * t, s = Math.sign(d[3]) || 1;
    const x = d[0] + Math.cos(a) * d[2], z = d[1] + Math.sin(a) * d[2], yaw = Math.atan2(-Math.sin(a) * s, Math.cos(a) * s);
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    put(sink, i++, x, LAKE_Y + 0.06, z, 0.26, 0.2, 0.4, yaw);
    put(sink, i++, x + fx * 0.17, LAKE_Y + 0.24, z + fz * 0.17, 0.14, 0.15, 0.17, yaw);
  }
  // the heron: standing still on the shore, now and then dipping its head
  {
    const { x, z, y, heading: h } = HERON, fx = Math.sin(h), fz = Math.cos(h);
    const dip = Math.max(0, Math.sin(t * 0.25) - 0.8) * 2.5;
    put(sink, i++, x, y + 0.95, z, 0.34, 0.36, 0.62, h, 0.35);
    put(sink, i++, x + fx * 0.2, y + 1.3 - dip * 0.12, z + fz * 0.2, 0.1, 0.55, 0.1, h, 0.25 + dip * 0.5);
    put(sink, i++, x + fx * (0.3 + dip * 0.12), y + 1.6 - dip * 0.3, z + fz * (0.3 + dip * 0.12), 0.15, 0.14, 0.2, h);
    put(sink, i++, x + fx * (0.46 + dip * 0.14), y + 1.58 - dip * 0.34, z + fz * (0.46 + dip * 0.14), 0.04, 0.04, 0.3, h, 0.15 + dip * 0.3);
    put(sink, i++, x - fz * 0.07, y + 0.38, z + fx * 0.07, 0.05, 0.8, 0.05, h);
    put(sink, i++, x + fz * 0.07, y + 0.38, z - fx * 0.07, 0.05, 0.8, 0.05, h);
    // the tail, a little behind and low
    put(sink, i++, x - fx * 0.32, y + 0.86, z - fz * 0.32, 0.18, 0.1, 0.3, h, -0.3);
  }
  if (night > BOATS_NIGHT_MAX) return i;
  for (let k = 0; k < BOATS.length; k++) {
    const b = BOATS[k];
    boatAt(b, t, at);
    const fx = Math.sin(at.yaw), fz = Math.cos(at.yaw), rx = fz, rz = -fx;
    const bob = Math.sin(t * 1.1 + k) * 0.025, roll = Math.sin(t * 0.8 + k * 1.7) * 0.04;
    hull(sink, i, at.x, at.z, at.yaw, b.kind, bob, roll);
    const top = LAKE_Y + bob + BOAT[b.kind].h * 0.45;
    if (b.kind === 'pedal') {
      // two riders side by side, a little aft of the middle
      for (let side = -1; side <= 1; side += 2) {
        const px = at.x + rx * side * 0.24 - fx * 0.15, pz = at.z + rz * side * 0.24 - fz * 0.15;
        put(sink, i + (side < 0 ? 2 : 4), px, top + 0.24, pz, 0.3, 0.46, 0.26, at.yaw);
        put(sink, i + (side < 0 ? 3 : 5), px, top + 0.6, pz, 0.24, 0.24, 0.24, at.yaw);
      }
      sink.setMatrixAt(i + 6, ZERO);
      sink.setMatrixAt(i + 7, ZERO);
    } else {
      // the rower amidships facing the stern, a passenger in the stern facing forward; the oars sweep (a 2.6 s stroke)
      put(sink, i + 2, at.x + fx * 0.15, top + 0.22, at.z + fz * 0.15, 0.3, 0.44, 0.26, at.yaw + Math.PI);
      put(sink, i + 3, at.x + fx * 0.15, top + 0.56, at.z + fz * 0.15, 0.23, 0.23, 0.23, at.yaw);
      put(sink, i + 4, at.x - fx * 0.55, top + 0.2, at.z - fz * 0.55, 0.28, 0.4, 0.24, at.yaw);
      put(sink, i + 5, at.x - fx * 0.55, top + 0.52, at.z - fz * 0.55, 0.22, 0.22, 0.22, at.yaw);
      const sweep = Math.sin(t * ((2 * Math.PI) / 2.6) + k) * 0.45;
      for (let side = -1; side <= 1; side += 2) {
        const ox = at.x + fx * 0.15 + rx * side * 0.62, oz = at.z + fz * 0.15 + rz * side * 0.62;
        put(sink, i + (side < 0 ? 6 : 7), ox, top + 0.05, oz, 0.07, 0.05, 1.2, at.yaw + Math.PI / 2 + side * sweep, 0, side * 0.25);
      }
    }
    i += BOAT_PARTS;
  }
  return i;
}
