import { VehicleSim, type Hull, type SurfaceRule, type VehicleSpec } from './collide';

/**
 * The kiddie toy car (plan §6.4): a rounded open-top two-seater, 1.8 × 1.0 u on a 1.1 u wheelbase, so it fits a 3.6 u
 * San Francisco street. Top speed 14 u/s (reverse 4.5), drive a = 10·t·(1 − v / vmax_eff), brake 24, rolling 3 (no
 * drag term), uphill vmax_eff = vmax·max(0.35, 1 − 0.9·g) (≈ 7.2 u/s at g 0.54), downhill −9·g capped at 1.25·vmax,
 * hill hold ≤ 6 u/s when coasting, keyboard steering u·(0.85 − 0.25·min(1, v / vmax)) (the shape of GTA_SZ's
 * src/driving.ts), wheel δmax = 0.6 / (1 + 0.09·v) at rate 9 (full-lock radius ≈ 2.7 u at 6 u/s), a crest hop over SF
 * hill tops (grade drops > 0.25 within 2 u at v > 9 → vy = 0.12·v), Space hop 4.5 u/s (0.6 s cooldown, no air
 * steering). Drives roads, plazas and promenades; grass / sand at half speed; never steps, pier planks, paths, water
 * or buildings. Body pitch follows the terrain under the wheels (GTA_SZ src/city-world.ts) with a 0.006·a squat / dive;
 * roll clamp(−0.012·v·ω, ±0.12).
 */

export const CAR_LENGTH = 1.8;
export const CAR_WIDTH = 1.0;

/** Hitbox half-extents 0.95 × 0.55: 3 nose probes, 2 tail probes, 2 side probes (bollards along the flank). */
export const CAR_HULL: Hull = {
  halfL: 0.95,
  halfW: 0.55,
  probes: [[0.5, 0.95], [0, 0.97], [-0.5, 0.95], [0.45, -0.95], [-0.45, -0.95], [0.55, 0], [-0.55, 0]],
  probeR: 0.1,
};

/** The district has no roadway surface: promenade pavement and plazas are the toy car's streets. */
export const CAR_SURFACES: SurfaceRule = { road: 1, plaza: 1, pavement: 1, grass: 0.5, sand: 0.5 };

export const CAR_SPEC: VehicleSpec = {
  kind: 'car',
  hull: CAR_HULL,
  wheelbase: 1.1,
  surfaces: CAR_SURFACES,
  vmax: 14,
  sprint: 14,
  reverse: 4.5,
  drive: 10,
  linearDrive: true,
  brake: 24,
  coast: 3,
  uphillK: 0.9,
  uphillMin: 0.35,
  gravity: 9,
  downCap: 1.25,
  hillHold: 6,
  steerMax: 0.6,
  steerV: 0.09,
  steerRate: 9,
  curveA: 0.85,
  curveB: 0.25,
  hopV: 4.5,
  hopCooldown: 0.6,
  airGravity: 24,
  crestDrop: 0.25,
  crestAhead: 2,
  crestSpeed: 9,
  crestK: 0.12,
};

export function createToyCar(): VehicleSim { return new VehicleSim(CAR_SPEC); }

/**
 * Body pitch (rad, + = nose up): terrain under the wheels, plus 0.006·a — the plan's "− 0.006·a" in its nose-down
 * convention: the tail squats as it pulls away, the nose dives under braking.
 */
export const carPitch = (terrainPitch: number, accel: number) => terrainPitch + 0.006 * accel;
/** Body roll (rad, + = leaning left): the toy leans out of the turn. */
export const carRoll = (v: number, yawRate: number) => Math.max(-0.12, Math.min(0.12, -0.012 * v * yawRate));
