import { blockersNear, heightAt, inWorld, nearestWalkable, type Blocker } from '../core/terrain';
import type { Vec2 } from '../core/types';

/**
 * Pelican glide (plan §6.6): the newcomer rides the big pelican over the Bay, BAYBAY up front. A cozy flight model
 * after GTA_SZ's floatplane (MIT, src/city-flight-simulation.ts) with no crash and no stall:
 *  - speed eases to cruise 14 u/s, boost 20 (Shift / RT), slow 9 (Space / LT); a dive adds speed;
 *  - pitch → 0.45·input at rate 1.8 (W / stick up climbs), roll → 0.7·steer at rate 2.5, yaw rate = tan(roll)·0.9,
 *    wings level themselves with no input;
 *  - soft floor = max(ground, roofs within 6 u) + 6 with a k = 4 spring below it (hard floor + 4, never through a
 *    roof), ceiling 260;
 *  - model edge: when a point 30 u ahead leaves the model (core/terrain inWorld) the pelican turns back at 0.8 rad/s;
 *  - buildings: a 2 s swept look-ahead against roof heights acts as a repulsor (climb, bank toward the lower side —
 *    the idea of GTA_SZ src/city-flight-collision.ts, as a nudge instead of a crash);
 *  - landing: the nearest standable spot within 40 u, never water (the resolver idea of GTA_SZ
 *    src/city-observer-destination.ts), reached along a 2–3 s descent curve that ends with the seat `perch` u above
 *    the spot; the rider hops down (hop + squash) and the pelican flies on.
 * Take-off is a scripted 1 s swoop. Pure (node tests with synthetic worlds).
 */

export const GLIDE = {
  cruise: 14,
  boost: 20,
  slow: 9,
  /** speed eases toward its target at this rate (1/s); diving adds DIVE_SPEED per rad of nose-down pitch */
  speedRate: 0.9,
  diveSpeed: 8,
  pitchK: 0.45,
  pitchRate: 1.8,
  rollK: 0.7,
  rollRate: 2.5,
  yawK: 0.9,
  /** soft floor clearance above ground / roofs (u), roof search radius (u), spring constant, hard clearance (u) */
  floorClear: 6,
  floorR: 6,
  springK: 4,
  hardClear: 4,
  ceiling: 260,
  /** model edge look-ahead (u) and turn-back rate (rad/s) */
  edgeLook: 30,
  edgeTurn: 0.8,
  /** building look-ahead (s) */
  lookAhead: 2,
  /** landing search radius (u) */
  landR: 40,
  takeoffRise: 7,
  takeoffAhead: 12,
  /** the rider's seat above the ground when the pelican picks you up / sets you down (u) */
  perch: 1.1,
} as const;

export interface GlideWorld {
  heightAt(x: number, z: number): number;
  inWorld(x: number, z: number): boolean;
  /** highest roof (world y) of static structures within r of (x, z); −Infinity when there is none */
  roofAt(x: number, z: number, r: number): number;
  /** a standable landing spot within r of (x, z) — never water — or null */
  landingSpot(x: number, z: number, r: number): Vec2 | null;
}

/** A known tall structure (world y of its top) used as a glide repulsor when blockers carry no heights. */
export interface TallStructure { x: number; z: number; r: number; top: number }

/**
 * Roof of a static blocker: its `top` when the terrain provider supplies one (city lane), else a conservative toy
 * estimate over the ground (buildings 24 u, round landmark colliders 20 u, small props 5 u).
 */
function blockerTop(b: Blocker, x: number, z: number): number {
  const top = (b as { top?: number }).top;
  if (typeof top === 'number') return top;
  if (b.kind === 'circle') return heightAt(b.x, b.z) + (b.r >= 0.7 ? 20 : 5);
  return heightAt(x, z) + 24;
}

/** The game's glide world: core/terrain (heights, model, blockers, standable grid) + optional known towers. */
export function terrainGlideWorld(tall: readonly TallStructure[] = []): GlideWorld {
  return {
    heightAt,
    inWorld,
    roofAt(x, z, r) {
      let top = -Infinity;
      for (const b of blockersNear(x, z, r)) top = Math.max(top, blockerTop(b, x, z));
      for (const t of tall) if (Math.hypot(t.x - x, t.z - z) < t.r + r) top = Math.max(top, t.top);
      return top;
    },
    landingSpot(x, z, r) { return nearestWalkable({ x, z }, r); },
  };
}

export interface GlideInput {
  /** −1..1, + = climb (W / stick up) */
  pitch: number;
  /** −1..1, + = bank right */
  steer: number;
  boost: boolean;
  slow: boolean;
}
export const NO_GLIDE_INPUT: GlideInput = { pitch: 0, steer: 0, boost: false, slow: false };

export interface GlideReport {
  /** brushed a roof / structure (soft bump) */
  bump: boolean;
  /** turning back at the model edge */
  edge: boolean;
  /** the landing curve finished this step */
  landed: boolean;
  /** the take-off swoop finished this step */
  airborne: boolean;
}

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const ease = (k: number) => k * k * (3 - 2 * k);

interface Curve { ax: number; ay: number; az: number; bx: number; by: number; bz: number; cx: number; cy: number; cz: number; t: number; dur: number }
const bez = (a: number, b: number, c: number, t: number) => (1 - t) * (1 - t) * a + 2 * (1 - t) * t * b + t * t * c;

export class GlideSim {
  x = 0;
  y = 0;
  z = 0;
  heading = 0;
  /** + = nose up (rad) */
  pitch = 0;
  /** + = banked right (rad) */
  roll = 0;
  speed: number = GLIDE.cruise;
  /** vertical speed (u/s) */
  vy = 0;
  /** 'takeoff' swoop, free 'flight', 'landing' descent */
  stage: 'takeoff' | 'flight' | 'landing' = 'flight';
  /** where the landing ends */
  landing: Vec2 | null = null;
  private curve: Curve | null = null;
  /** the lowest the pelican may be right now (ground / roof + hard clearance), for tests and QA */
  hardFloor = -Infinity;
  softFloor = -Infinity;

  /** Start the take-off swoop from the rider standing at (x, z) facing `heading`. */
  takeOff(x: number, z: number, heading: number, world: GlideWorld, dur = 1) {
    const fx = Math.sin(heading), fz = Math.cos(heading);
    const g = world.heightAt(x, z) + GLIDE.perch;
    this.x = x; this.y = g; this.z = z; this.heading = heading;
    this.pitch = 0.3; this.roll = 0; this.speed = GLIDE.cruise; this.vy = 0;
    const ex = x + fx * GLIDE.takeoffAhead, ez = z + fz * GLIDE.takeoffAhead;
    const ey = Math.max(g, world.heightAt(ex, ez), world.roofAt(ex, ez, 3)) + GLIDE.takeoffRise;
    this.curve = { ax: x, ay: g, az: z, bx: x + fx * 4, by: g + 1.2, bz: z + fz * 4, cx: ex, cy: ey, cz: ez, t: 0, dur };
    this.stage = 'takeoff';
    this.landing = null;
  }

  /** Resolve a landing spot a little ahead; returns the descent seconds, or null (no safe spot → keep flying). */
  beginLanding(world: GlideWorld): number | null {
    if (this.stage !== 'flight') return null;
    const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    const lead = Math.min(18, this.speed * 1.1);
    const spot = world.landingSpot(this.x + fx * lead, this.z + fz * lead, GLIDE.landR) ?? world.landingSpot(this.x, this.z, GLIDE.landR);
    if (!spot) return null;
    const gy = world.heightAt(spot.x, spot.z) + GLIDE.perch;
    const d = Math.hypot(spot.x - this.x, spot.z - this.z);
    const dur = clamp(Math.hypot(d, this.y - gy) / 11, 2, 3);
    // control point: straight ahead at the current height, so the pelican flares down instead of dropping
    const k = Math.min(d * 0.55, this.speed * dur * 0.4);
    this.curve = { ax: this.x, ay: this.y, az: this.z, bx: this.x + fx * k, by: this.y, bz: this.z + fz * k, cx: spot.x, cy: gy, cz: spot.z, t: 0, dur };
    this.stage = 'landing';
    this.landing = spot;
    return dur;
  }

  /** 0..1 through the take-off / landing curve (1 in free flight) */
  get progress(): number { return this.curve ? clamp(this.curve.t / this.curve.dur, 0, 1) : 1; }

  step(dtRaw: number, input: GlideInput, world: GlideWorld): GlideReport {
    const report: GlideReport = { bump: false, edge: false, landed: false, airborne: false };
    const dt = Math.min(Math.max(dtRaw, 0), 0.1);
    if (dt <= 0) return report;
    if (this.curve) { this.followCurve(dt, report); return report; }
    // fixed 120 Hz sub-steps (as GTA_SZ's flight), capped
    const n = Math.min(12, Math.max(1, Math.ceil(dt * 120)));
    const h = dt / n;
    for (let i = 0; i < n; i++) this.fly(h, input, world, report);
    return report;
  }

  private followCurve(dt: number, report: GlideReport) {
    const c = this.curve!;
    c.t = Math.min(c.dur, c.t + dt);
    const k = c.t / c.dur;
    const e = this.stage === 'landing' ? ease(k) : k * (2 - k);
    const px = this.x, py = this.y, pz = this.z;
    this.x = bez(c.ax, c.bx, c.cx, e); this.y = bez(c.ay, c.by, c.cy, e); this.z = bez(c.az, c.bz, c.cz, e);
    const dx = this.x - px, dz = this.z - pz, dy = this.y - py, L = Math.hypot(dx, dz);
    if (L > 1e-4) this.heading = Math.atan2(dx, dz);
    this.vy = dy / dt;
    this.pitch += (clamp(Math.atan2(dy, Math.max(L, 1e-3)), -0.5, 0.5) - this.pitch) * Math.min(1, dt * 6);
    this.roll *= Math.exp(-4 * dt);
    if (c.t >= c.dur) {
      this.curve = null;
      if (this.stage === 'landing') report.landed = true;
      else { this.stage = 'flight'; report.airborne = true; this.speed = GLIDE.cruise; }
    }
  }

  /** Soft floor under / just ahead of (x, z): ground or roofs within 6 u, + 6. */
  floorAt(world: GlideWorld, x: number, z: number): { soft: number; hard: number } {
    const base = Math.max(world.heightAt(x, z), world.roofAt(x, z, GLIDE.floorR));
    return { soft: base + GLIDE.floorClear, hard: Math.max(world.heightAt(x, z), world.roofAt(x, z, 1)) + GLIDE.hardClear };
  }

  private fly(h: number, input: GlideInput, world: GlideWorld, report: GlideReport) {
    const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    // --- speed
    const target = (input.boost ? GLIDE.boost : input.slow ? GLIDE.slow : GLIDE.cruise) + Math.max(0, -this.pitch) * GLIDE.diveSpeed;
    this.speed += (target - this.speed) * (1 - Math.exp(-GLIDE.speedRate * h));

    // --- attitude targets from input
    let pitchT = GLIDE.pitchK * clamp(input.pitch, -1, 1);
    let rollT = GLIDE.rollK * clamp(input.steer, -1, 1);
    let yawOverride: number | null = null;

    // --- floor (here and 1 s ahead, so hills are anticipated), ceiling
    const here = this.floorAt(world, this.x, this.z);
    const ahead = this.floorAt(world, this.x + fx * this.speed, this.z + fz * this.speed);
    const soft = Math.max(here.soft, ahead.soft);
    this.softFloor = soft; this.hardFloor = here.hard;
    let spring = 0;
    if (this.y < soft) {
      spring = GLIDE.springK * (soft - this.y);
      pitchT = Math.max(pitchT, Math.min(GLIDE.pitchK, 0.08 * (soft - this.y)));
    }
    if (this.y > GLIDE.ceiling) pitchT = Math.min(pitchT, -0.15);

    // --- buildings: 2 s swept look-ahead against roof heights
    const vyNow = this.speed * Math.sin(this.pitch);
    for (let t = 0.25; t <= GLIDE.lookAhead; t += 0.25) {
      const px = this.x + fx * this.speed * t, pz = this.z + fz * this.speed * t;
      const roof = world.roofAt(px, pz, 1.5);
      if (roof > this.y + vyNow * t - 2) {
        pitchT = GLIDE.pitchK;
        // bank toward the lower side
        const rx = Math.cos(this.heading), rz = -Math.sin(this.heading); // (its left)
        const left = world.roofAt(px + rx * 5, pz + rz * 5, 1.5), right = world.roofAt(px - rx * 5, pz - rz * 5, 1.5);
        if (Math.abs(input.steer) < 0.3) rollT = left < right ? -GLIDE.rollK * 0.8 : GLIDE.rollK * 0.8;
        break;
      }
    }

    // --- model edge: turn back toward the inside
    if (!world.inWorld(this.x + fx * GLIDE.edgeLook, this.z + fz * GLIDE.edgeLook)) {
      const test = (d: number) => world.inWorld(this.x + Math.sin(this.heading + d) * GLIDE.edgeLook, this.z + Math.cos(this.heading + d) * GLIDE.edgeLook);
      let dir = 0;
      for (const d of [0.6, 1.2, 1.8, 2.4]) { if (test(d)) { dir = 1; break; } if (test(-d)) { dir = -1; break; } }
      if (dir === 0) dir = 1;
      yawOverride = dir * GLIDE.edgeTurn;
      rollT = -dir * GLIDE.rollK * 0.8;
      report.edge = true;
    }

    // --- attitude
    this.pitch += (pitchT - this.pitch) * (1 - Math.exp(-GLIDE.pitchRate * h));
    this.roll += (rollT - this.roll) * (1 - Math.exp(-GLIDE.rollRate * h));
    const yawRate = yawOverride ?? -Math.tan(this.roll) * GLIDE.yawK;
    this.heading = wrap(this.heading + yawRate * h);

    // --- integrate
    const f2x = Math.sin(this.heading), f2z = Math.cos(this.heading);
    const horiz = this.speed * Math.cos(this.pitch);
    this.vy = this.speed * Math.sin(this.pitch) + spring;
    this.x += f2x * horiz * h;
    this.z += f2z * horiz * h;
    this.y += this.vy * h;
    // never through a roof or the ground; a residual overlap is a soft bump
    const hard = this.floorAt(world, this.x, this.z).hard;
    if (this.y < hard) {
      if (hard - this.y > 0.35) report.bump = true;
      this.y = hard;
      if (this.vy < 0) this.vy = 0;
    }
    if (this.y > GLIDE.ceiling + 20) this.y = GLIDE.ceiling + 20;
  }
}
