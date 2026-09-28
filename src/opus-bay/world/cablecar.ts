import * as THREE from 'three';
import type { Platform } from '../actors/platform';
import { RAIL_LEAN } from '../actors/platform';
import { CABLE } from '../data/transit';
import { BOX, Batch, CYL, type Info, M, SPHERE, shade } from './builder';

/**
 * The toy cable car (lane F, plan §6.5 / checkpoint F3): 5.6 × 2.0 × 2.6 u, cream and maroon like the postcard
 * (postcards/sf-cable-car-hill) and the V1-1 reference sheet: open ends with outward-facing wooden benches and brass
 * poles, an enclosed saloon in the middle with warm windows at night, running boards along both sides at x ±1.25, the
 * gripman baked in at the front grip, head lamps and roof lamps that glow after dark. No number, no lettering.
 *
 * One geometry for every car (drawn as one TOY_INST InstancedMesh by world/transitLayer.ts). Local frame: +z forward
 * (the gripman's end), +x the car's left, y up from the rail top. aInfo: no procedural windows (x 0 or 7), no contact
 * AO (y −100: the car moves over hills), glow in w (lamps), style 7 on the saloon glass (warm at night).
 */

/** floor / running-board top above the rail (u) */
export const CAR_FLOOR = 0.55;
/** bench seat top above the floor (u) */
export const CAR_SEAT_Y = 0.42;

const L = CABLE.length, W = CABLE.width;
const HL = L / 2;
const CREAM = '#efe4c8', CREAM_DARK = '#dccfb0', MAROON = '#7d2a2d', MAROON_DARK = '#5a1f22', GOLD = '#d8b25c';
const WOOD = '#b3844f', WOOD_DARK = '#8c6440', BRASS = '#d6b25e', IRON = '#34302e', GLASS = '#44535a', ROOF = '#e9e0cb';
const SKIN = '#e2b48e', NAVY = '#2e3a52', VEST = '#6e2230', CAP = '#2b2f3a';

const NO: Info = [0, -100, 0, 0];
const LAMP: Info = [0, -100, 0, 1];
const WINDOW: Info = [7, -100, 0, 0];

/** saloon (enclosed middle) z range; open sections before and after it */
const SALOON = { z0: -1.15, z1: 1.05 };
const ROOF_Y = 2.28;

function box(b: Batch, x: number, y: number, z: number, sx: number, sy: number, sz: number, color: string | THREE.Color, info: Info = NO, ry = 0, rx = 0, rz = 0) {
  b.add(BOX(), M(x, y, z, ry, sx, sy, sz, rx, rz), color, info);
}

/** One little standing figure (gripman / crew), feet at (x, y, z), facing +z (turned by ry). Pushing leans forward. */
export function figure(b: Batch, x: number, y: number, z: number, ry: number, opts: { push?: boolean; vest?: string } = {}) {
  const lean = opts.push ? 0.32 : 0;
  const f = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(lean, ry, 0, 'YXZ')), new THREE.Vector3(1, 1, 1));
  const at = (m: THREE.Matrix4) => f.clone().multiply(m);
  for (const s of [-1, 1]) b.add(BOX(), at(M(s * 0.1, 0, 0, 0, 0.14, 0.66, 0.16)), NAVY, NO);
  b.add(BOX(), at(M(0, 0.64, 0, 0, 0.42, 0.6, 0.26)), opts.vest ?? VEST, NO);
  b.add(BOX(), at(M(0, 0.66, 0.135, 0, 0.18, 0.5, 0.01)), '#f1ead8', NO);
  for (const s of [-1, 1]) {
    // arms: forward and down (pushing: straight out)
    b.add(BOX(), at(M(s * 0.27, opts.push ? 0.98 : 0.74, opts.push ? 0.22 : 0.08, 0, 0.11, 0.46, 0.12, opts.push ? -1.35 : -0.5)), opts.vest ?? VEST, NO);
    b.add(SPHERE(5, 4), at(M(s * 0.27, opts.push ? 1.03 : 0.66, opts.push ? 0.52 : 0.3, 0, 0.07, 0.07, 0.07)), '#3b2a22', NO);
  }
  b.add(SPHERE(8, 6), at(M(0, 1.43, 0, 0, 0.17, 0.18, 0.17)), SKIN, NO);
  b.add(CYL(8), at(M(0, 1.52, 0, 0, 0.18, 0.08, 0.18)), CAP, NO);
  b.add(BOX(), at(M(0, 1.52, 0.17, 0, 0.3, 0.03, 0.14)), CAP, NO);
}

/** The whole car in one geometry (position, normal, color, aInfo). ≈ 1.9k triangles. */
export function cableCarGeometry(): THREE.BufferGeometry {
  const b = new Batch();
  const F = CAR_FLOOR;
  // --- running gear: two trucks with wheels, underframe, floor, running boards
  for (const s of [-1, 1]) {
    box(b, 0, 0.05, s * CABLE.bogie, 1.3, 0.22, 1.25, IRON);
    for (const wz of [-0.42, 0.42]) for (const wx of [-0.62, 0.62]) b.add(CYL(8), M(wx + Math.sign(wx) * 0.05, 0.2, s * CABLE.bogie + wz, 0, 0.2, 0.1, 0.2, 0, Math.PI / 2), '#2a2624', NO);
  }
  box(b, 0, 0.28, 0, W - 0.1, 0.22, L - 0.2, MAROON_DARK);
  box(b, 0, F - 0.06, 0, W, 0.06, L, WOOD_DARK);
  for (const s of [-1, 1]) {
    box(b, s * 1.22, F - 0.05, 0, 0.36, 0.05, L - 0.5, WOOD);
    box(b, s * 1.39, F - 0.09, 0, 0.03, 0.09, L - 0.5, GOLD);
    for (const z of [-2, 0, 2]) box(b, s * 1.1, 0.3, z, 0.26, F - 0.35, 0.08, IRON);
  }
  // --- saloon: maroon lower panels, gold belt, cream posts between three warm windows a side, maroon letter board
  const sl = SALOON.z1 - SALOON.z0, sc = (SALOON.z0 + SALOON.z1) / 2;
  for (const s of [-1, 1]) {
    const x = s * (W / 2 - 0.03);
    box(b, x, F, sc, 0.06, 0.7, sl, MAROON);
    box(b, s * (W / 2 - 0.02), F + 0.66, sc, 0.08, 0.05, sl + 0.02, GOLD);
    box(b, x, F + 0.71, sc, 0.06, 0.08, sl, CREAM);
    for (let i = 0; i < 4; i++) box(b, x, F + 0.79, SALOON.z0 + 0.06 + i * ((sl - 0.12) / 3), 0.07, 0.72, 0.12, CREAM);
    for (let i = 0; i < 3; i++) {
      const z = SALOON.z0 + 0.06 + (i + 0.5) * ((sl - 0.12) / 3);
      box(b, s * (W / 2 - 0.06), F + 0.8, z, 0.02, 0.68, (sl - 0.12) / 3 - 0.12, GLASS, WINDOW);
    }
    box(b, x, F + 1.51, sc, 0.07, ROOF_Y - F - 1.51, sl, MAROON);
    box(b, s * (W / 2 - 0.015), F + 1.51, sc, 0.07, 0.03, sl, GOLD);
    // outer maroon skirt under the benches of both open sections
    for (const [z0, z1] of [[SALOON.z1, HL - 0.12], [-HL + 0.12, SALOON.z0]]) box(b, x, F, (z0 + z1) / 2, 0.06, 0.42, z1 - z0, MAROON);
    for (const [z0, z1] of [[SALOON.z1, HL - 0.12], [-HL + 0.12, SALOON.z0]]) box(b, s * (W / 2 - 0.02), F + 0.38, (z0 + z1) / 2, 0.08, 0.04, z1 - z0, GOLD);
  }
  // saloon bulkheads (cream above maroon, a window each) with the door gap in the middle
  for (const z of [SALOON.z0, SALOON.z1]) {
    for (const s of [-1, 1]) {
      box(b, s * 0.68, F, z, 0.64, 0.7, 0.06, MAROON);
      box(b, s * 0.68, F + 0.7, z, 0.64, ROOF_Y - F - 0.7, 0.06, CREAM);
      box(b, s * 0.68, F + 0.95, z + Math.sign(z) * 0.035, 0.44, 0.5, 0.01, GLASS, WINDOW);
    }
    box(b, 0, F + 1.62, z, 0.72, ROOF_Y - F - 1.62, 0.06, CREAM);
  }
  // saloon inside: longitudinal benches and a warm ceiling
  for (const s of [-1, 1]) box(b, s * 0.72, F + 0.38, sc, 0.4, 0.06, sl - 0.3, WOOD);
  // --- open sections: outward benches (back to back along the middle), brass poles at the edge
  for (const [z0, z1] of [[SALOON.z1 + 0.08, HL - 0.36], [-HL + 0.36, SALOON.z0 - 0.08]]) {
    const zc = (z0 + z1) / 2, zl = z1 - z0;
    for (const s of [-1, 1]) {
      box(b, s * 0.72, F + CAR_SEAT_Y - 0.06, zc, 0.46, 0.06, zl, WOOD);
      box(b, s * 0.52, F, zc, 0.04, CAR_SEAT_Y - 0.06, zl, shade(WOOD, 0.8));
      box(b, s * 0.47, F + CAR_SEAT_Y, zc, 0.06, 0.46, zl, WOOD_DARK);
    }
  }
  for (const s of [-1, 1]) {
    for (const z of [SALOON.z1 + 0.08, 1.8, HL - 0.2, SALOON.z0 - 0.08, -1.85, -HL + 0.2]) b.add(CYL(6), M(s * 0.95, F, z, 0, 0.035, ROOF_Y - F, 0.035), BRASS, NO);
  }
  // --- dashes at both ends: maroon panel, cream rail, gold trim, head lamp (front) / tail lamp (back)
  for (const e of [-1, 1]) {
    const z = e * (HL - 0.06);
    box(b, 0, F, z, W - 0.1, 0.78, 0.1, MAROON);
    box(b, 0, F + 0.78, z, W - 0.06, 0.07, 0.14, CREAM);
    box(b, 0, F + 0.5, z + e * 0.055, W - 0.3, 0.04, 0.01, GOLD);
    b.add(CYL(10), M(0, F + 0.36, z + e * 0.05, 0, 0.13, 0.08, 0.13, e * Math.PI / 2), e > 0 ? '#fff1c8' : '#ffc08a', LAMP);
    box(b, 0, 0.3, z + e * 0.06, 1.2, 0.2, 0.12, IRON);
  }
  // --- roof: cream roof with an overhang at the ends, maroon fascia over the open sections, clerestory, roof lamps
  box(b, 0, ROOF_Y, 0, W + 0.14, 0.1, L + 0.2, ROOF);
  box(b, 0, ROOF_Y - 0.03, 0, W - 0.1, 0.03, L, CREAM_DARK);
  for (const s of [-1, 1]) {
    for (const [z0, z1] of [[SALOON.z1, HL], [-HL, SALOON.z0]]) box(b, s * (W / 2 + 0.02), ROOF_Y - 0.14, (z0 + z1) / 2, 0.05, 0.14, z1 - z0, MAROON);
  }
  box(b, 0, ROOF_Y + 0.1, 0, 1.05, 0.12, L - 1.6, CREAM_DARK);
  for (const s of [-1, 1]) box(b, s * 0.53, ROOF_Y + 0.13, 0, 0.01, 0.06, L - 2.2, GLASS, WINDOW);
  box(b, 0, ROOF_Y + 0.22, 0, 0.9, 0.04, L - 1.8, ROOF);
  for (const e of [-1, 1]) {
    // destination board (blank) and two roof lamps each end
    box(b, 0, ROOF_Y + 0.1, e * (HL - 0.05), 0.9, 0.2, 0.06, CREAM);
    for (const s of [-1, 1]) box(b, s * 0.78, ROOF_Y + 0.1, e * (HL + 0.02), 0.12, 0.12, 0.08, '#fff0c4', LAMP);
  }
  // --- the gripman at the front grip, the grip lever and the brake handle, a bell above him
  figure(b, 0, F, 1.9, 0);
  box(b, 0, F - 0.2, 2.2, 0.06, 1.2, 0.06, IRON, NO, 0, -0.12);
  box(b, 0, F + 0.98, 2.33, 0.2, 0.05, 0.05, '#1e1b1a');
  box(b, 0.3, F, 2.3, 0.05, 0.9, 0.05, IRON, NO, 0, -0.2);
  b.add(CYL(8, 0.55), M(0, ROOF_Y - 0.26, 2.05, 0, 0.1, 0.16, 0.1), BRASS, NO);
  const g = b.build();
  g.computeBoundingSphere();
  g.name = 'cable-car';
  return g;
}

/**
 * (W5-T4, plan MF9) The middle distance (≈ 45–110 u from the camera, drawn without a shadow): the full car's look in
 * ≈ 580 triangles instead of 2,124. The saloon as a maroon / gold / cream stack with one warm window band and two posts
 * a side, the open ends' benches and brass poles (as thin boxes), the dashes with their lamps, the roof with its
 * clerestory, maroon fascia and lamp bars, and the gripman in five pieces. No wheels, trucks as two dark blocks.
 */
export function cableCarMidGeometry(): THREE.BufferGeometry {
  const b = new Batch();
  const F = CAR_FLOOR;
  const sl = SALOON.z1 - SALOON.z0, sc = (SALOON.z0 + SALOON.z1) / 2;
  // running gear, underframe, floor with the running boards
  for (const s of [-1, 1]) box(b, 0, 0.05, s * CABLE.bogie, 1.3, 0.3, 1.25, IRON);
  box(b, 0, 0.28, 0, W - 0.1, 0.22, L - 0.2, MAROON_DARK);
  box(b, 0, F - 0.08, 0, W + 0.5, 0.08, L - 0.3, WOOD);
  // saloon: maroon lower, gold belt, cream upper, the window band (both sides in one box), two posts a side, letter board
  box(b, 0, F, sc, W - 0.06, 0.7, sl, MAROON);
  box(b, 0, F + 0.66, sc, W + 0.02, 0.05, sl + 0.02, GOLD);
  box(b, 0, F + 0.71, sc, W - 0.1, ROOF_Y - F - 0.71, sl, CREAM);
  box(b, 0, F + 0.8, sc, W - 0.08, 0.68, sl - 0.16, GLASS, WINDOW);
  for (const s of [-1, 1]) for (const k of [1, 2]) box(b, s * (W / 2 - 0.03), F + 0.79, SALOON.z0 + 0.06 + k * ((sl - 0.12) / 3), 0.08, 0.72, 0.12, CREAM);
  box(b, 0, F + 1.51, sc, W - 0.06, ROOF_Y - F - 1.51, sl, MAROON);
  // skirts under the open sections, with their gold rail
  for (const s of [-1, 1]) {
    box(b, s * (W / 2 - 0.03), F, 0, 0.06, 0.42, L - 0.24, MAROON);
    box(b, s * (W / 2 - 0.02), F + 0.38, 0, 0.08, 0.04, L - 0.24, GOLD);
  }
  // open sections: the outward benches (seats and the backrest down the middle), brass poles at the corners
  for (const [z0, z1] of [[SALOON.z1 + 0.08, HL - 0.36], [-HL + 0.36, SALOON.z0 - 0.08]]) {
    box(b, 0, F + CAR_SEAT_Y - 0.06, (z0 + z1) / 2, 1.9, 0.06, z1 - z0, WOOD);
    box(b, 0, F + CAR_SEAT_Y, (z0 + z1) / 2, 1.0, 0.46, z1 - z0, WOOD_DARK);
  }
  for (const s of [-1, 1]) for (const z of [SALOON.z1 + 0.08, HL - 0.2, SALOON.z0 - 0.08, -HL + 0.2]) box(b, s * 0.95, F, z, 0.07, ROOF_Y - F, 0.07, BRASS);
  // dashes at both ends: maroon panel, cream rail, the head / tail lamp
  for (const e of [-1, 1]) {
    const z = e * (HL - 0.06);
    box(b, 0, F, z, W - 0.1, 0.78, 0.1, MAROON);
    box(b, 0, F + 0.78, z, W - 0.06, 0.07, 0.14, CREAM);
    box(b, 0, F + 0.28, z + e * 0.06, 0.26, 0.16, 0.06, e > 0 ? '#fff1c8' : '#ffc08a', LAMP);
  }
  // roof, clerestory, the maroon fascia along both sides, a lamp bar at each end
  box(b, 0, ROOF_Y, 0, W + 0.14, 0.1, L + 0.2, ROOF);
  box(b, 0, ROOF_Y + 0.1, 0, 1.05, 0.14, L - 1.6, CREAM_DARK);
  for (const s of [-1, 1]) box(b, s * (W / 2 + 0.02), ROOF_Y - 0.14, 0, 0.05, 0.14, L, MAROON);
  for (const e of [-1, 1]) box(b, 0, ROOF_Y + 0.1, e * (HL + 0.02), 1.68, 0.12, 0.08, '#fff0c4', LAMP);
  // the gripman at the front grip: legs, vest, head, cap; the grip lever
  const gz = 1.9;
  box(b, 0, F, gz, 0.34, 0.66, 0.16, NAVY);
  box(b, 0, F + 0.64, gz, 0.6, 0.6, 0.26, VEST);
  b.add(SPHERE(6, 4), M(0, F + 1.43, gz, 0, 0.17, 0.18, 0.17), SKIN, NO);
  box(b, 0, F + 1.52, gz + 0.03, 0.36, 0.08, 0.36, CAP);
  box(b, 0, F - 0.2, 2.2, 0.06, 1.2, 0.06, IRON, NO, 0, -0.12);
  const g = b.build();
  g.computeBoundingSphere();
  g.name = 'cable-car-mid';
  return g;
}

/**
 * The far version (beyond ~110 u, drawn without shadows): the same silhouette and colours in 13 boxes (156
 * triangles instead of 2,124), lamps and warm windows included so a far car still reads at night.
 */
export function cableCarFarGeometry(): THREE.BufferGeometry {
  const b = new Batch();
  const F = CAR_FLOOR;
  box(b, 0, 0.1, 0, 1.3, 0.3, L - 1.2, IRON);
  box(b, 0, F - 0.06, 0, W + 0.5, 0.06, L - 0.5, WOOD);
  box(b, 0, F, 0, W, 0.7, L - 0.12, MAROON);
  box(b, 0, F + 0.7, 0, W - 0.3, 0.8, SALOON.z1 - SALOON.z0, CREAM);
  for (const s of [-1, 1]) box(b, s * (W / 2 - 0.16), F + 0.8, (SALOON.z0 + SALOON.z1) / 2, 0.02, 0.6, SALOON.z1 - SALOON.z0 - 0.2, GLASS, WINDOW);
  box(b, 0, F + 1.5, 0, W - 0.1, ROOF_Y - F - 1.5, L - 0.2, MAROON);
  box(b, 0, ROOF_Y, 0, W + 0.14, 0.1, L + 0.2, ROOF);
  box(b, 0, ROOF_Y + 0.1, 0, 1.05, 0.14, L - 1.6, CREAM_DARK);
  for (const e of [-1, 1]) {
    box(b, 0, F + 0.3, e * (HL + 0.02), 0.22, 0.2, 0.06, e > 0 ? '#fff1c8' : '#ffc08a', LAMP);
    box(b, 0, ROOF_Y + 0.1, e * (HL + 0.02), 0.9, 0.14, 0.06, '#fff0c4', LAMP);
  }
  const g = b.build();
  g.computeBoundingSphere();
  g.name = 'cable-car-far';
  return g;
}

/**
 * The cable-car platform (actors/platform.ts): the running boards at x ±1.22 (rider on the camera's side, leaning out
 * 12°), the outward benches of the front section (facing out, on the camera's side), the middle aisle as the deck and
 * the running boards as extra deck rects.
 */
export const CABLE_PLATFORM: Pick<Platform, 'floor' | 'deck' | 'rail' | 'seatLeft' | 'seatRight' | 'seatY' | 'kind' | 'railLeft' | 'railRight' | 'hangLean' | 'railMirror' | 'decks'> = {
  floor: CAR_FLOOR,
  deck: { minX: -0.4, maxX: 0.4, minZ: -2.5, maxZ: 1.55 },
  rail: { x: 1.22, z: 1.3, heading: 0 },
  railLeft: { x: 1.22, z: 1.3, heading: 0 },
  railRight: { x: -1.22, z: 1.3, heading: 0 },
  seatLeft: { x: 0.74, z: 1.45, heading: Math.PI / 2 },
  seatRight: { x: -0.74, z: 1.45, heading: -Math.PI / 2 },
  seatY: CAR_SEAT_Y,
  kind: 'cable-car',
  hangLean: RAIL_LEAN,
  railMirror: true,
  decks: [{ minX: 1.04, maxX: 1.4, minZ: -2.55, maxZ: 2.55 }, { minX: -1.4, maxX: -1.04, minZ: -2.55, maxZ: 2.55 }],
};
