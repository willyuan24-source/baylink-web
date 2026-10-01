import * as THREE from 'three';
import type { Platform, PlatformSpot } from '../../actors/platform';
import { BUS } from '../busSystem';
import { BOX, Batch, CYL, type Info, M } from '../builder';

/**
 * The toy open-top double-decker of the sightseeing loop (wave 4 · lane T, plan §3.2): a generic tour bus (no Big Bus /
 * City Sightseeing look, no lettering, no logo): coral body, a cream band, a cream roundel on each side (the 观光 disc,
 * plain), warm lower-deck windows at night, an open upper deck with four rows of blue benches and a front rail, stairs
 * at the back, the lower-deck door at the front right; head / tail lamps and a string of deck bulbs that glow after dark.
 *
 * One geometry for every bus (≤ 1.2k triangles; drawn from one batched mesh by world/sf/lineFleet.ts) + a far version
 * (≈ 150 triangles, beyond BUS.farLod, no shadow). Local frame: +z forward, +x the bus's left, y up from the road.
 * aInfo: no procedural windows, no contact AO (y −100: it drives over hills), glow in w (lamps), style 7 on the glass.
 */

export const BUS_W = BUS.width;
export const BUS_L = BUS.length;
/** top of the upper-deck floor above the road (u) */
export const UP_FLOOR = 2.3;
/** bench seat top above the upper-deck floor */
export const BUS_SEAT_Y = 0.42;
/** the benches: row z positions (front first), bench centre |x| */
export const BENCH_ROWS = [2.45, 1.25, 0.05, -1.15] as const;
export const BENCH_X = 0.68;

const HL = BUS_L / 2, HW = BUS_W / 2;
const CORAL = '#ec6a4c', CORAL_DARK = '#c85239', CREAM = '#f6ead0', CREAM_DARK = '#e0cfaa', GLASS = '#56707c';
const TYRE = '#262322', RIM = '#cfc9bf', SEAT = '#35698c', SEAT_DARK = '#2a5470', DECK = '#bdb6a8', STEP = '#8b8479', DARK = '#2f2c2b';

const NO: Info = [0, -100, 0, 0];
const LAMP: Info = [0, -100, 0, 1];
const WINDOW: Info = [7, -100, 0, 0];

function box(b: Batch, x: number, y: number, z: number, sx: number, sy: number, sz: number, color: string, info: Info = NO) {
  b.add(BOX(), M(x, y, z, 0, sx, sy, sz), color, info);
}

/** The near bus (≈ 850 triangles). */
export function tourBusGeometry(): THREE.BufferGeometry {
  const b = new Batch();
  const BASE = 0.66, BELT = 1.28, LOW_TOP = UP_FLOOR - 0.08;
  // --- running gear: four wheels (8-sided) standing proud under the body (toy style), hubs, the dark chassis
  // (W8-X2) both sides alike: the tyre spans |x| HW − 0.34 … HW + 0.1 (the cylinder grows toward −x from its origin, so
  // the left tyre was inset with its hub plate floating outside it), the hub plate on its outer face
  for (const z of [HL - 1.55, -HL + 1.65]) for (const s of [-1, 1]) {
    b.add(CYL(8), M(s > 0 ? HW + 0.1 : -(HW - 0.34), 0.48, z, 0, 0.48, 0.44, 0.48, 0, Math.PI / 2), TYRE, NO);
    b.add(BOX(), M(s * (HW + 0.12), 0.35, z, 0, 0.04, 0.26, 0.26), RIM, NO);
  }
  box(b, 0, 0.25, 0, BUS_W - 0.9, BASE - 0.25, BUS_L - 0.6, DARK);
  // --- lower deck: coral body, cream band, the window strip with cream pillars
  box(b, 0, BASE, 0, BUS_W, BELT - BASE, BUS_L, CORAL);
  box(b, 0, BELT, 0, BUS_W + 0.04, 0.16, BUS_L + 0.04, CREAM);
  box(b, 0, BELT + 0.16, 0, BUS_W, LOW_TOP - BELT - 0.16, BUS_L, CORAL);
  for (const s of [-1, 1]) {
    box(b, s * (HW + 0.01), BELT + 0.24, -0.35, 0.03, 0.66, BUS_L - 2.1, GLASS, WINDOW);
    for (const z of [-2.2, -0.35, 1.5]) box(b, s * (HW + 0.02), BELT + 0.24, z, 0.035, 0.66, 0.14, CREAM);
    // the plain roundel (the 观光 disc) low on the side, between the axles
    b.add(CYL(10), M(s * (HW + 0.02), 0.97, -0.2, 0, 0.26, 0.03, 0.26, 0, s * Math.PI / 2), CREAM, NO);
  }
  // the door: front right (−x), a dark glass panel over the band
  box(b, -(HW + 0.025), BASE + 0.1, HL - 0.85, 0.03, LOW_TOP - BASE - 0.2, 0.9, GLASS, WINDOW);
  // --- front: windscreen, blank destination board (lit), grille, lamps, bumper
  box(b, 0, BELT + 0.1, HL + 0.01, BUS_W - 0.3, 0.8, 0.03, GLASS, WINDOW);
  box(b, 0, BELT + 0.95, HL + 0.015, 1.3, 0.16, 0.03, '#fff3d6', LAMP);
  box(b, 0, BASE + 0.1, HL + 0.02, 1.0, 0.3, 0.04, DARK);
  // (W8-X2) the windscreen's cream pillars (middle + corners), two chrome bars on the grille, round head lamps
  for (const x of [0, -(HW - 0.17), HW - 0.17]) box(b, x, BELT + 0.08, HL + 0.025, 0.08, 0.84, 0.03, CREAM);
  for (let k = 0; k < 2; k++) box(b, 0, BASE + 0.18 + k * 0.11, HL + 0.045, 0.88, 0.025, 0.01, RIM);
  for (const s of [-1, 1]) b.add(CYL(10), M(s * 0.82, BASE + 0.28, HL + 0.02, 0, 0.15, 0.04, 0.15, Math.PI / 2), '#fff1c8', LAMP);
  box(b, 0, BASE - 0.14, HL + 0.04, BUS_W - 0.1, 0.2, 0.1, CREAM_DARK);
  // --- rear: window, tail lamps, bumper
  box(b, 0, BELT + 0.25, -HL - 0.01, BUS_W - 0.5, 0.62, 0.03, GLASS, WINDOW);
  for (const s of [-1, 1]) box(b, s * 0.95, BASE + 0.25, -HL - 0.02, 0.2, 0.26, 0.04, '#ff6a4a', LAMP);
  box(b, 0, BASE - 0.14, -HL - 0.04, BUS_W - 0.1, 0.2, 0.1, CREAM_DARK);
  // --- upper deck: floor, low coral walls with a cream top rail, a short front screen
  box(b, 0, LOW_TOP, 0, BUS_W - 0.1, 0.1, BUS_L - 0.1, DECK);
  const wallH = 0.62;
  for (const s of [-1, 1]) {
    box(b, s * (HW - 0.05), UP_FLOOR, 0, 0.1, wallH, BUS_L, CORAL);
    box(b, s * (HW - 0.05), UP_FLOOR + wallH, 0, 0.16, 0.07, BUS_L + 0.02, CREAM);
    // deck bulbs along the rail (glow at night)
    for (const z of [2.6, 0.2, -2.2]) box(b, s * (HW - 0.05), UP_FLOOR + wallH + 0.07, z, 0.1, 0.08, 0.1, '#ffe7a8', LAMP);
  }
  box(b, 0, UP_FLOOR, HL - 0.05, BUS_W, wallH + 0.05, 0.1, CORAL_DARK);
  box(b, 0, UP_FLOOR + wallH, HL - 0.05, BUS_W + 0.02, 0.07, 0.16, CREAM);
  box(b, 0, UP_FLOOR + wallH + 0.07, HL - 0.12, BUS_W - 0.4, 0.3, 0.03, '#8fb2c0', NO);
  box(b, 0, UP_FLOOR, -HL + 0.05, BUS_W, wallH, 0.1, CORAL_DARK);
  box(b, 0, UP_FLOOR + wallH, -HL + 0.05, BUS_W + 0.02, 0.07, 0.16, CREAM);
  // --- benches: four rows of two, facing forward (seat + back)
  for (const z of BENCH_ROWS) for (const s of [-1, 1]) {
    box(b, s * BENCH_X, UP_FLOOR + BUS_SEAT_Y - 0.08, z, 0.92, 0.08, 0.46, SEAT);
    box(b, s * BENCH_X, UP_FLOOR + 0.02, z, 0.8, BUS_SEAT_Y - 0.1, 0.36, SEAT_DARK);
    box(b, s * BENCH_X, UP_FLOOR + BUS_SEAT_Y, z - 0.25, 0.92, 0.46, 0.07, SEAT);
  }
  // --- stairs at the back (right side), a hand rail
  for (let k = 0; k < 3; k++) box(b, -0.6, UP_FLOOR - 0.5 + k * 0.17, -HL + 0.55 + k * 0.28, 0.7, 0.06, 0.26, STEP);
  box(b, -0.2, UP_FLOOR, -HL + 0.9, 0.05, 0.6, 0.05, CREAM);
  const g = b.build();
  g.computeBoundingSphere();
  g.name = 'tour-bus';
  return g;
}

/** The far bus (beyond BUS.farLod): the silhouette and colours in 11 boxes, lamps and warm windows included. */
export function tourBusFarGeometry(): THREE.BufferGeometry {
  const b = new Batch();
  box(b, 0, 0, 0, BUS_W - 0.3, 0.66, BUS_L - 1.2, TYRE);
  box(b, 0, 0.66, 0, BUS_W, UP_FLOOR - 0.66, BUS_L, CORAL);
  box(b, 0, 1.28, 0, BUS_W + 0.04, 0.16, BUS_L + 0.04, CREAM);
  for (const s of [-1, 1]) box(b, s * (BUS_W / 2 + 0.01), 1.52, -0.35, 0.03, 0.6, BUS_L - 2.1, GLASS, WINDOW);
  box(b, 0, UP_FLOOR, 0, BUS_W, 0.62, BUS_L, CORAL_DARK);
  box(b, 0, UP_FLOOR + 0.62, 0, BUS_W + 0.02, 0.07, BUS_L + 0.02, CREAM);
  box(b, 0, UP_FLOOR + 0.1, 0, BUS_W - 0.3, 0.6, BUS_L - 0.3, SEAT);
  for (const s of [-1, 1]) box(b, s * 0.85, 0.88, HL + 0.03, 0.3, 0.16, 0.04, '#fff1c8', LAMP);
  box(b, 0, 0.9, -HL - 0.02, 2.1, 0.26, 0.04, '#ff6a4a', LAMP);
  const g = b.build();
  g.computeBoundingSphere();
  g.name = 'tour-bus-far';
  return g;
}

/**
 * The bus as a moving platform (actors/platform.ts): the rider rides the UPPER deck (the "deck" ride camera): the front
 * row's two benches are the seats (player + BAYBAY), standing at the front rail is the rail spot, the aisle between the
 * benches is the deck.
 */
export const TOUR_BUS_PLATFORM: Pick<Platform, 'floor' | 'deck' | 'rail' | 'seatLeft' | 'seatRight' | 'seatY' | 'kind' | 'decks'> = {
  floor: UP_FLOOR,
  deck: { minX: -0.26, maxX: 0.26, minZ: -HL + 1.3, maxZ: HL - 0.35 },
  rail: { x: 0, z: HL - 0.45, heading: 0 },
  seatLeft: { x: BENCH_X + 0.22, z: BENCH_ROWS[0] + 0.02, heading: 0 },
  seatRight: { x: -BENCH_X - 0.22, z: BENCH_ROWS[0] + 0.02, heading: 0 },
  seatY: BUS_SEAT_Y,
  kind: 'bus',
  // the standing room in front of the first row
  decks: [{ minX: -HW + 0.2, maxX: HW - 0.2, minZ: BENCH_ROWS[0] + 0.3, maxZ: HL - 0.2 }],
};

/** Lane G reference spots: BAYBAY beside the rider on the front-left bench (mirror x for the right one), and the lower-deck standing spot by the door. */
export const TOUR_BUS_SPOTS: { baybaySeat: PlatformSpot; lowerDeck: { floor: number; spot: PlatformSpot } } = {
  baybaySeat: { x: BENCH_X - 0.24, z: BENCH_ROWS[0] + 0.02, heading: 0 },
  lowerDeck: { floor: 0.55, spot: { x: -0.55, z: HL - 1.4, heading: 0 } },
};
