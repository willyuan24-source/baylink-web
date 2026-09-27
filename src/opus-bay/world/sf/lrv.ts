import * as THREE from 'three';
import type { Platform } from '../../actors/platform';
import { BOX, Batch, type Info, M } from '../builder';
import { LRV } from '../lightRail';

/**
 * The toy two-car Muni Metro light-rail vehicle (wave 4 · lane T, plan §3.3): generic (silver body, a red belt line, a
 * lit headsign in the line colour with no letters, no Muni logo). One CAR geometry (the cab at +z, the coupler at −z);
 * a train is two instances back to back (world/lightRail.ts `Train.cars`: car 0 faces +path, car 1 −path), so both
 * ends of a double-ended train show a cab. ≤ 500 triangles a car (≤ 1k a train), a far version ≈ 100 a car.
 *
 * One geometry per line colour (the headsign): `lrvCarGeometry('#2f6fb0')` for the N, `'#2f8f5b'` for the M; they sit in
 * the same batched mesh as the bus (world/sf/lineFleet.ts), so the colour costs no draw call. Local frame: +z the cab
 * end, +x the car's left, y up from the rail top. aInfo as the cable car: glass style 7 (warm at night), lamps glow,
 * the headsign glows always (w 1.5).
 */

export const CAR_L = LRV.carLength, CAR_W = LRV.width, CAR_H = LRV.height;
/** floor top above the rail (u) and seat top above the floor */
export const LRV_FLOOR = 0.9;
export const LRV_SEAT_Y = 0.42;

const HL = CAR_L / 2, HW = CAR_W / 2;
const SILVER = '#c9cdd2', SILVER_DARK = '#a9aeb4', RED = '#c8323a', GLASS = '#3b4750', ROOF = '#dcdfe2', DARK = '#34383c', BOGIE = '#2a2c2e';

const NO: Info = [0, -100, 0, 0];
const LAMP: Info = [0, -100, 0, 1];
const WINDOW: Info = [7, -100, 0, 0];
const SIGN: Info = [0, -100, 0, 1.5];

function box(b: Batch, x: number, y: number, z: number, sx: number, sy: number, sz: number, color: string, info: Info = NO, rx = 0) {
  b.add(BOX(), M(x, y, z, 0, sx, sy, sz, rx), color, info);
}

/** One car (≈ 400 triangles) with the headsign in `lineColor`. */
export function lrvCarGeometry(lineColor: string): THREE.BufferGeometry {
  const b = new Batch();
  const F = LRV_FLOOR, BELT = F + 0.62, WIN0 = F + 0.72, WIN1 = F + 1.55, TOP = CAR_H - 0.12;
  // --- bogies and the skirt
  for (const z of [1.9, -1.9]) box(b, 0, 0.05, z, 1.5, 0.42, 1.4, BOGIE);
  box(b, 0, 0.38, 0, CAR_W - 0.2, F - 0.38, CAR_L - 0.4, DARK);
  // --- body: silver sides, the red belt line, the window band with silver pillars and two dark doors a side
  box(b, 0, F - 0.1, -0.1, CAR_W, TOP - F + 0.1, CAR_L - 0.6, SILVER);
  for (const s of [-1, 1]) {
    box(b, s * (HW + 0.01), BELT, -0.1, 0.03, 0.1, CAR_L - 0.6, RED);
    box(b, s * (HW + 0.015), WIN0, -0.2, 0.03, WIN1 - WIN0, CAR_L - 1.4, GLASS, WINDOW);
    for (const z of [-2.2, -0.2, 1.8]) box(b, s * (HW + 0.02), WIN0, z, 0.035, WIN1 - WIN0, 0.16, SILVER);
    for (const z of [-1.2, 0.9]) box(b, s * (HW + 0.02), F - 0.05, z, 0.03, WIN1 - F + 0.05, 0.9, DARK);
  }
  // --- the cab end (+z): a sloped nose, windscreen, the lit headsign in the line colour, head lamps
  box(b, 0, F - 0.1, HL - 0.35, CAR_W - 0.08, 1.1, 0.7, SILVER_DARK);
  box(b, 0, F + 0.95, HL - 0.42, CAR_W - 0.2, WIN1 - F - 0.55, 0.5, GLASS, WINDOW, -0.18);
  box(b, 0, WIN1 + 0.05, HL - 0.28, 1.2, 0.26, 0.05, lineColor, SIGN);
  for (const s of [-1, 1]) box(b, s * 0.78, F + 0.2, HL + 0.01, 0.26, 0.14, 0.05, '#fff1c8', LAMP);
  box(b, 0, F - 0.02, HL + 0.02, CAR_W - 0.3, 0.07, 0.04, RED);
  box(b, 0, 0.3, HL - 0.1, CAR_W - 0.3, 0.26, 0.3, DARK);
  // --- the coupler end (−z): the gangway bellows, a rear lamp pair
  box(b, 0, F - 0.1, -HL + 0.2, CAR_W - 0.5, TOP - F, 0.4, DARK);
  for (const s of [-1, 1]) box(b, s * 0.85, F + 0.2, -HL + 0.28, 0.2, 0.12, 0.04, '#ff6a4a', LAMP);
  // --- roof, the roof pod and a folded pantograph
  box(b, 0, TOP, -0.1, CAR_W - 0.1, 0.12, CAR_L - 0.5, ROOF);
  box(b, 0, TOP + 0.12, -0.6, 1.2, 0.2, 2.0, SILVER_DARK);
  box(b, 0, TOP + 0.32, 0.8, 0.9, 0.05, 0.1, DARK);
  box(b, 0, TOP + 0.34, 0.6, 0.06, 0.05, 1.0, DARK, NO, 0.35);
  box(b, 0, TOP + 0.62, 0.95, 1.0, 0.04, 0.12, '#6c7075');
  const g = b.build();
  g.computeBoundingSphere();
  g.name = 'lrv-car';
  return g;
}

/** A far car (≈ 90 triangles): body, window band, roof, lit headsign, lamps. */
export function lrvCarFarGeometry(lineColor: string): THREE.BufferGeometry {
  const b = new Batch();
  box(b, 0, 0.05, 0, 1.6, 0.4, CAR_L - 1.2, BOGIE);
  box(b, 0, 0.4, 0, CAR_W, CAR_H - 0.4, CAR_L - 0.1, SILVER);
  for (const s of [-1, 1]) box(b, s * (HW + 0.015), LRV_FLOOR + 0.72, -0.2, 0.03, 0.83, CAR_L - 1.4, GLASS, WINDOW);
  box(b, 0, CAR_H, 0, CAR_W - 0.1, 0.12, CAR_L - 0.5, ROOF);
  box(b, 0, LRV_FLOOR + 1.6, HL + 0.01, 1.2, 0.26, 0.05, lineColor, SIGN);
  box(b, 0, LRV_FLOOR + 0.2, HL + 0.02, 1.8, 0.14, 0.05, '#fff1c8', LAMP);
  box(b, 0, LRV_FLOOR + 0.62, 0, CAR_W + 0.03, 0.1, CAR_L - 0.4, RED);
  const g = b.build();
  g.computeBoundingSphere();
  g.name = 'lrv-car-far';
  return g;
}

/**
 * The LRV as a moving platform (the car leading in the travel direction, world/lightRail.ts `leadCar`): standing behind
 * the cab is the rail spot, the side benches are the seats (facing the aisle), the aisle is the deck.
 */
export const LRV_PLATFORM: Pick<Platform, 'floor' | 'deck' | 'rail' | 'seatLeft' | 'seatRight' | 'seatY' | 'kind'> = {
  floor: LRV_FLOOR,
  deck: { minX: -0.4, maxX: 0.4, minZ: -HL + 0.6, maxZ: HL - 0.9 },
  rail: { x: 0.35, z: HL - 1.05, heading: 0 },
  seatLeft: { x: HW - 0.45, z: 0.4, heading: -Math.PI / 2 },
  seatRight: { x: -HW + 0.45, z: 0.4, heading: Math.PI / 2 },
  seatY: LRV_SEAT_Y,
  kind: 'light-rail',
};
