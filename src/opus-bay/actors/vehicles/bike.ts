import { VehicleSim, type Hull, type SurfaceRule, type VehicleSpec } from './collide';

/**
 * The chunky toy bike (plan §6.3): cruise 9 u/s, Shift / RB 11.5, accel 8 / brake 18 / rolling 1.5 u/s², uphill top
 * speed × max(0.45, 1 − 0.9·g) with a stand-pedal pose above g 0.3, bicycle steering δmax = 0.7 / (1 + 0.12·v) on a
 * 0.95 u wheelbase, visual lean 0.8·atan(v·ω / 9.8), Space hop (5 u/s, g 24 → apex 0.52 u). Rides roads, plazas,
 * promenades, piers and paths (grass ×0.7, sand ×0.5); never stairs (hint "楼梯要走上去 · F 下车"), water or buildings.
 * Pure (node tests: tests/opus-bay-sf-vehicles.test.ts); the model lives in vehicles/models.ts.
 */

export const BIKE_LENGTH = 1.3;
/** body width incl. the rider's round belly (collision), and the frame's own width (door slots) */
export const BIKE_WIDTH = 0.5;

/** Hull: nose / tail wheels plus the rider's width at the saddle. */
export const BIKE_HULL: Hull = {
  halfL: 0.65,
  halfW: 0.42,
  probes: [[0, 0.65], [0, -0.62], [0.42, 0.05], [-0.42, 0.05]],
  probeR: 0.1,
};

export const BIKE_SURFACES: SurfaceRule = { road: 1, plaza: 1, pavement: 1, wood: 1, dirt: 0.85, grass: 0.7, sand: 0.5 };

export const BIKE_SPEC: VehicleSpec = {
  kind: 'bike',
  hull: BIKE_HULL,
  wheelbase: 0.95,
  surfaces: BIKE_SURFACES,
  vmax: 9,
  sprint: 11.5,
  reverse: 1.2,
  drive: 8,
  linearDrive: false,
  brake: 18,
  coast: 1.5,
  uphillK: 0.9,
  uphillMin: 0.45,
  gravity: 7,
  downCap: 1.25,
  hillHold: 6,
  steerMax: 0.7,
  steerV: 0.12,
  steerRate: 8,
  curveA: 0.9,
  curveB: 0.25,
  hopV: 5,
  hopCooldown: 0.45,
  airGravity: 24,
  crestDrop: 0.25,
  crestAhead: 1.6,
  crestSpeed: 8,
  crestK: 0.1,
};

export function createBike(): VehicleSim { return new VehicleSim(BIKE_SPEC); }

/** Visual lean into a turn (rad, + = leaning left). */
export function bikeLean(v: number, yawRate: number): number { return 0.8 * Math.atan((v * yawRate) / 9.8); }

/** Standing on the pedals up a steep street. */
export const STAND_PEDAL_GRADE = 0.3;
export const standPedal = (grade: number, v: number) => grade > STAND_PEDAL_GRADE && v > 0.3;

/** Pedal crank rate (rad/s) at speed v: one turn per ~2.2 u, pedalling faster when standing. */
export const crankRate = (v: number, standing: boolean) => (v / 2.2) * Math.PI * 2 * (standing ? 1.25 : 1);
