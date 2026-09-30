import * as THREE from 'three';
import { vehicleSpots, RETURN_DISTANCE, type VehicleSpot } from '../../data/vehicles';
import { TERRAIN_WORLD, VehicleSim, findFit, poseCheck, type DriveInput, type StepReport } from './collide';
import { BIKE_SPEC, BIKE_WIDTH, BIKE_LENGTH, bikeLean, crankRate, standPedal } from './bike';
import { CAR_LENGTH, CAR_SPEC, CAR_WIDTH, carPitch, carRoll } from './toyCar';
import { buildBikeRig, buildToyCarRig, type VehicleRig } from './models';

/**
 * The rideable toys in the world: one bike per spot and the toy car (data/vehicles.ts), each a VehicleSim + one
 * SkinnedMesh. The ridden one steps every frame; parked ones only re-pose when something moved them. Also: the
 * call-your-vehicle autopilot (hold F), R (back on open drivable ground), squash on bumps / landings, and bikes left
 * more than 80 u behind rolling home unseen.
 */

export type RideKind = 'bike' | 'car';

export interface Ride {
  id: string;
  kind: RideKind;
  spot: VehicleSpot;
  sim: VehicleSim;
  rig: VehicleRig;
  width: number;
  length: number;
  /** the player sits in it */
  occupied: boolean;
  /** moved away from its spot */
  displaced: boolean;
  /** wheel spin (rad) and pedal crank (rad) */
  spin: number;
  crank: number;
  /** squash spring (vertical scale − 1) */
  squash: number;
  squashV: number;
  /** smoothed visual lean / roll / pitch (rad) */
  lean: number;
  roll: number;
  pitch: number;
  /** stand-pedal weight 0..1 */
  standing: boolean;
  /** hold-F autopilot target and time left */
  call: { x: number; z: number; t: number } | null;
  dirty: boolean;
  /** (W7-K2) a tow out of a transit vehicle's path in progress (from → to, progress 0…1; actors/vehicles/transitClear) */
  tow?: { fx: number; fz: number; fh: number; tx: number; tz: number; th: number; k: number } | null;
  /** (W7-K2) the tow's hop over the ground (u), added to the drawn pose */
  hopY?: number;
}

/** (W7-K2) the tow's hop: as the toy traffic's give-way hop (world/sf/traffic.ts HOP_UP, LEAVE_RATE) */
export const TOW_HOP = 0.35;
export const TOW_RATE = 2;

const tmpE = new THREE.Euler(0, 0, 0, 'YXZ');
const COLUMN = new THREE.Vector3(0, Math.sin(0.9), Math.cos(0.9)).normalize();
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

export class Fleet {
  readonly group = new THREE.Group();
  readonly rides: Ride[] = [];

  constructor() {
    this.group.name = 'opus-rides';
    for (const spot of vehicleSpots()) this.add(spot);
  }

  /** Build a rideable at `spot` (the district's at construction; city mode's pooled bikes later, cityBikes.ts). */
  add(spot: VehicleSpot): Ride {
    const car = spot.kind === 'car';
    const sim = new VehicleSim(car ? CAR_SPEC : BIKE_SPEC);
    sim.place(spot.x, spot.z, spot.heading, TERRAIN_WORLD);
    const rig = car ? buildToyCarRig() : buildBikeRig(spot.livery ?? 0);
    rig.mesh.name = `ride-${spot.id}`;
    rig.mesh.castShadow = true;
    if (car) for (const w of ['wheelFL', 'wheelFR']) rig.bones[w].rotation.order = 'YXZ';
    this.group.add(rig.mesh);
    const ride: Ride = {
      id: spot.id, kind: spot.kind, spot, sim, rig, width: car ? CAR_WIDTH : BIKE_WIDTH, length: car ? CAR_LENGTH : BIKE_LENGTH,
      occupied: false, displaced: false, spin: 0, crank: 0, squash: 0, squashV: 0, lean: 0, roll: 0, pitch: sim.terrainPitch,
      standing: false, call: null, dirty: true,
    };
    this.rides.push(ride);
    this.pose(ride, 0);
    return ride;
  }

  /** A pooled ride moves to another spot (and takes its id): parked there, at rest. */
  reassign(ride: Ride, spot: VehicleSpot) {
    ride.id = spot.id;
    ride.spot = spot;
    ride.rig.mesh.name = `ride-${spot.id}`;
    ride.sim.v = 0;
    this.home(ride);
    this.pose(ride, 0);
  }

  byId(id: string | null): Ride | undefined { return id ? this.rides.find(r => r.id === id) : undefined; }

  /** Drive the ridden vehicle one frame. */
  drive(ride: Ride, dt: number, input: DriveInput): StepReport {
    const report = ride.sim.step(dt, input, TERRAIN_WORLD);
    ride.displaced = true;
    ride.dirty = true;
    if (report.bump?.hard || (report.land ?? 0) > 0.35) this.kick(ride, report.bump?.hard ? -0.22 : -0.16 * (report.land ?? 0.5) - 0.06);
    return report;
  }

  /** A squash impulse (negative = squash down). */
  kick(ride: Ride, v: number) { ride.squashV += v * 14; }

  /**
   * (W7-K2) Tow a parked, empty ride to (x, z, heading): a little hop over ≈ 1 / TOW_RATE s (the toy traffic's give-way
   * hop), squash on landing. Stepped by idle(); a player who gets in ends it where it is.
   */
  tow(ride: Ride, x: number, z: number, heading: number) {
    const s = ride.sim;
    ride.tow = { fx: s.x, fz: s.z, fh: s.heading, tx: x, tz: z, th: heading, k: 0 };
    ride.call = null;
    ride.displaced = true;
    ride.dirty = true;
  }

  private stepTow(ride: Ride, dt: number) {
    const t = ride.tow!, s = ride.sim;
    t.k = Math.min(1, t.k + dt * TOW_RATE);
    const e = t.k * t.k * (3 - 2 * t.k);
    const dh = Math.atan2(Math.sin(t.th - t.fh), Math.cos(t.th - t.fh));
    s.place(t.fx + (t.tx - t.fx) * e, t.fz + (t.tz - t.fz) * e, t.fh + dh * e, TERRAIN_WORLD);
    s.v = 0;
    ride.hopY = Math.sin(Math.PI * t.k) * TOW_HOP;
    ride.dirty = true;
    if (t.k >= 1) { ride.tow = null; ride.hopY = 0; this.kick(ride, -0.16); }
  }

  /** Parked / abandoned vehicles: settle, roll home when far and unseen, run a call autopilot. */
  idle(ride: Ride, dt: number, player: { x: number; z: number }, visible: boolean) {
    if (ride.tow) { if (ride.occupied) { ride.tow = null; ride.hopY = 0; } else { this.stepTow(ride, dt); return; } }
    if (ride.call) { this.autopilot(ride, dt); return; }
    const s = ride.sim;
    if (Math.abs(s.v) > 0.05 || s.airborne) { s.step(dt, { throttle: 0, brake: 1, steer: 0, digital: false, sprint: false, hop: false }, TERRAIN_WORLD); ride.dirty = true; }
    // abandoned bike far from the player and out of sight: quietly back to its spot
    if (ride.kind === 'bike' && ride.displaced && !visible && Math.hypot(s.x - player.x, s.z - player.z) > RETURN_DISTANCE) this.home(ride);
  }

  home(ride: Ride) {
    ride.sim.place(ride.spot.x, ride.spot.z, ride.spot.heading, TERRAIN_WORLD);
    ride.displaced = false;
    ride.call = null;
    ride.tow = null; ride.hopY = 0;
    ride.dirty = true;
  }

  /** R while driving: back onto open drivable ground nearby, facing near the current heading. */
  reset(ride: Ride): boolean {
    const s = ride.sim;
    const fit = findFit(TERRAIN_WORLD, s.spec, s.x, s.z, s.heading, 30);
    if (!fit) return false;
    s.place(fit.x, fit.z, fit.heading, TERRAIN_WORLD);
    ride.dirty = true;
    return true;
  }

  /**
   * Hold F: bring `ride` to the player. It appears ~9 u away where it fits (behind the camera if possible) and rolls
   * up for at most 4 s, stopping 1.8 u short. Returns false when there is nowhere to put it.
   */
  summon(ride: Ride, player: { x: number; z: number }, cameraYaw: number): boolean {
    const s = ride.sim;
    let from: { x: number; z: number; heading: number } | null = null;
    for (const off of [0, 0.7, -0.7, 1.4, -1.4, Math.PI]) {
      const a = cameraYaw + off; // the camera sits toward (sin yaw, cos yaw) from the player
      const px = player.x + Math.sin(a) * 9, pz = player.z + Math.cos(a) * 9;
      const heading = Math.atan2(player.x - px, player.z - pz);
      if (poseCheck(TERRAIN_WORLD, s.spec, px, pz, heading).ok) { from = { x: px, z: pz, heading }; break; }
      const fit = findFit(TERRAIN_WORLD, s.spec, px, pz, heading, 4);
      if (fit) { from = fit; break; }
    }
    if (!from) {
      const fit = findFit(TERRAIN_WORLD, s.spec, player.x, player.z, cameraYaw + Math.PI, 12);
      if (!fit) return false;
      s.place(fit.x, fit.z, fit.heading, TERRAIN_WORLD);
      ride.displaced = true; ride.dirty = true;
      return true;
    }
    s.place(from.x, from.z, from.heading, TERRAIN_WORLD);
    ride.call = { x: player.x, z: player.z, t: 4 };
    ride.displaced = true;
    ride.dirty = true;
    return true;
  }

  /** Pure-pursuit-ish roll toward the call target (≤ 6 u/s, stops 1.8 u short or after 4 s). */
  private autopilot(ride: Ride, dt: number) {
    const c = ride.call!, s = ride.sim;
    c.t -= dt;
    const dx = c.x - s.x, dz = c.z - s.z, d = Math.hypot(dx, dz);
    const want = Math.atan2(dx, dz);
    const err = wrap(want - s.heading);
    const done = d < 1.8 || c.t <= 0;
    const throttle = done ? 0 : Math.abs(s.v) < Math.min(6, d * 1.5) ? 0.6 : 0;
    s.step(dt, { throttle, brake: done ? 1 : 0, steer: clamp(-err * 2, -1, 1), digital: false, sprint: false, hop: false }, TERRAIN_WORLD);
    ride.dirty = true;
    if (done && Math.abs(s.v) < 0.1) ride.call = null;
  }

  /** Write the mesh pose (and wheels / fork / pedals / squash). */
  pose(ride: Ride, dt: number) {
    // (W7-K-review) the player got in during a tow's hop: idle() never runs for a carried ride, so the tow ends here —
    // else the car was driven floating at the hop's height and, parked again, snapped back onto the old tow path
    if (ride.tow && ride.occupied) { ride.tow = null; ride.hopY = 0; }
    const s = ride.sim, rig = ride.rig, mesh = rig.mesh, b = rig.bones;
    const v = s.v;
    ride.spin += (v * dt) / rig.wheelRadius;
    const k = 1 - Math.exp(-10 * dt);
    // squash spring
    const acc = -170 * ride.squash - 12 * ride.squashV;
    ride.squashV += acc * dt;
    ride.squash = clamp(ride.squash + ride.squashV * dt, -0.3, 0.25);
    if (ride.kind === 'bike') {
      const standing = standPedal(s.grade, v);
      ride.standing = standing;
      if (ride.occupied && v > 0.1) ride.crank += crankRate(v, standing) * dt;
      ride.lean += (clamp(bikeLean(v, s.yawRate), -0.7, 0.7) - ride.lean) * k;
      ride.pitch += (s.terrainPitch - ride.pitch) * k;
      // parked on the kickstand: a slight tilt
      const rest = ride.occupied || Math.abs(v) > 0.3 ? 0 : 0.12;
      tmpE.set(-ride.pitch, s.heading, -ride.lean + rest, 'YXZ');
      b.fork.rotation.y = s.steer * 0.9;
      b.wheelF.rotation.x = ride.spin;
      b.wheelR.rotation.x = ride.spin;
      b.crank.rotation.x = ride.crank;
    } else {
      ride.roll += (carRoll(v, s.yawRate) - ride.roll) * k;
      ride.pitch += (carPitch(s.terrainPitch, clamp(s.accel, -30, 30)) - ride.pitch) * k;
      tmpE.set(-ride.pitch, s.heading, -ride.roll, 'YXZ');
      for (const w of ['wheelFL', 'wheelFR']) { b[w].rotation.y = s.steer; b[w].rotation.x = ride.spin; }
      for (const w of ['wheelRL', 'wheelRR']) b[w].rotation.x = ride.spin;
      b.wheel.quaternion.setFromAxisAngle(COLUMN, -s.steer * 2.5);
      b.body.position.y = rig.rest.body.y + Math.sin(ride.spin * 0.7) * 0.01 * Math.min(1, Math.abs(v) / 8);
    }
    mesh.position.set(s.x, s.y + (ride.hopY ?? 0), s.z);
    mesh.quaternion.setFromEuler(tmpE);
    const sq = ride.squash;
    mesh.scale.set(1 - sq * 0.5, 1 + sq, 1 - sq * 0.5);
    ride.dirty = Math.abs(sq) > 1e-3 || Math.abs(ride.squashV) > 1e-3 || !!ride.tow;
  }

  dispose() {
    for (const r of this.rides) { r.rig.mesh.geometry.dispose(); r.rig.mesh.skeleton.dispose(); }
  }
}

/** The kind-specific door-slot size (for modes.ts doorSlots). */
export const rideSize = (r: Ride) => ({ width: r.width, length: r.length });
