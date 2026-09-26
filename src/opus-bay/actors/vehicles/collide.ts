import { blockersNear, heightAt, inWorld, surfaceAt } from '../../core/terrain';
import type { SurfaceKind } from '../../core/types';

/**
 * Shared vehicle dynamics + collision for the bike and the toy car (plan §6.3 / §6.4). Pure maths over a small world
 * interface — the game passes core/terrain (heightAt / surfaceAt / blockersNear / inWorld, which the streamed city
 * extends); node tests pass synthetic worlds.
 *
 * Model: a kinematic bicycle (ω = v / wheelbase · tan δ) with a signed forward speed, toy longitudinal laws (drive,
 * brake, rolling friction, along-slope gravity, uphill top-speed cut, hill hold), a short-lived world-space bounce
 * velocity, a hop / crest hop with gravity, and a hull of probe points that must stay on the vehicle's surfaces, off
 * static blockers and inside the model. Fixed sub-steps: ≥ 120 Hz, ≤ 0.3 u each, ≤ 12 per frame.
 *
 * Contacts slide, never stick (GTA_SZ reverts the pose, src/city-world.ts): the wall normal comes from a ring of
 * samples round the failing probes (the same idea as controller.moveDisc), tangential velocity is kept ×0.85, the
 * normal part bounces at −0.3·v_n, and the heading eases toward the wall tangent at rate 6.
 */

export type VehicleKind = 'bike' | 'car';

/** What a vehicle asks of the world. */
export interface VehicleWorld {
  heightAt(x: number, z: number): number;
  /** walkable surface or null (water, building interior, off the model, unloaded city chunk) */
  surfaceAt(x: number, z: number): SurfaceKind | null;
  /** a static blocker (building, landmark, blocking prop) overlaps the disc */
  blocked(x: number, z: number, r: number): boolean;
  inWorld(x: number, z: number): boolean;
}

/** The game world: core/terrain only (never district geometry). */
export const TERRAIN_WORLD: VehicleWorld = {
  heightAt,
  surfaceAt,
  blocked: (x, z, r) => blockersNear(x, z, r).length > 0,
  inWorld,
};

/** Top-speed factor per surface; missing / 0 = the vehicle cannot go there. */
export type SurfaceRule = Partial<Record<SurfaceKind, number>>;

export interface Hull {
  halfL: number;
  halfW: number;
  /** probe points in the vehicle frame: [x (+ = its left), z (+ = forward)] */
  probes: readonly (readonly [number, number])[];
  /** each probe must be this clear of static blockers (u) */
  probeR: number;
}

export type BlockReason = 'wall' | 'edge' | 'water' | 'stairs' | 'surface' | 'step';

export interface VehicleSpec {
  kind: VehicleKind;
  hull: Hull;
  wheelbase: number;
  surfaces: SurfaceRule;
  /** cruise top speed; sprint top speed (Shift / RB); reverse top speed (u/s) */
  vmax: number;
  sprint: number;
  reverse: number;
  /** linearDrive: a = drive·t·(1 − v / vmax_eff) (toy car); else a constant `drive` up to vmax_eff (bike) */
  drive: number;
  linearDrive: boolean;
  /** brake and rolling-friction decelerations (u/s²) */
  brake: number;
  coast: number;
  /** on an uphill grade g: vmax_eff = vmax · max(uphillMin, 1 − uphillK·g) */
  uphillK: number;
  uphillMin: number;
  /** along-slope gravity (u/s² per unit grade) and the downhill speed cap (× top speed) */
  gravity: number;
  downCap: number;
  /** coasting downhill never rolls faster than this (u/s); a stopped vehicle with no input holds on the slope */
  hillHold: number;
  /** wheel angle δmax = steerMax / (1 + steerV·|v|), followed at steerRate; keyboard: u·(curveA − curveB·min(1, |v|/vmax)) */
  steerMax: number;
  steerV: number;
  steerRate: number;
  curveA: number;
  curveB: number;
  /** Space hop: vertical speed, cooldown (s); gravity while airborne (u/s²) */
  hopV: number;
  hopCooldown: number;
  airGravity: number;
  /** crest hop: when the grade drops by > crestDrop within crestAhead u at v > crestSpeed → vy = crestK·v (crestK 0 = off) */
  crestDrop: number;
  crestAhead: number;
  crestSpeed: number;
  crestK: number;
}

export interface DriveInput {
  /** 0..1 */
  throttle: number;
  /** 0..1: brake, then reverse once stopped */
  brake: number;
  /** −1..1, + = right */
  steer: number;
  /** keyboard steering (speed-shaped), else analog (stick / pad) */
  digital: boolean;
  sprint: boolean;
  /** Space / B this frame */
  hop: boolean;
}
export const NO_DRIVE: DriveInput = { throttle: 0, brake: 0, steer: 0, digital: true, sprint: false, hop: false };

export interface StepReport {
  /** strongest wall contact this frame: strength = v_n / vmax, hard = v_n > 5 u/s */
  bump: null | { strength: number; hard: boolean; reason: BlockReason; vn: number };
  /** a probe was refused by its surface (stairs for the bike, piers / paths / steps for the car) */
  refuse: null | { reason: BlockReason; surface: SurfaceKind | null };
  hop: null | { crest: boolean };
  /** landing impact 0..1 */
  land: null | number;
}

export const SUBSTEP_HZ = 120;
export const MAX_SUBSTEP_DIST = 0.3;
export const MAX_SUBSTEPS = 12;
/** a probe may differ from the hull centre by this grade × its distance, plus a curb (u) */
const STEP_GRADE = 0.8, STEP_CURB = 0.25;
/** hard contact threshold (u/s of normal speed) */
export const HARD_BUMP = 5;
const TANGENT_KEEP = 0.85, RESTITUTION = 0.3, TANGENT_YAW_RATE = 6, BOUNCE_DECAY = 6;

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const damp = (cur: number, target: number, rate: number, dt: number) => cur + wrap(target - cur) * (1 - Math.exp(-rate * dt));

/** Vehicle-frame point → world (heading h faces (sin h, cos h); local +x is the vehicle's left). */
export function localToWorld(x: number, z: number, heading: number, lx: number, lz: number): [number, number] {
  const s = Math.sin(heading), c = Math.cos(heading);
  return [x + s * lz + c * lx, z + c * lz - s * lx];
}

/** Grade along the heading at (x, z): (h(front) − h(rear)) / span. */
export function gradeAt(world: VehicleWorld, x: number, z: number, heading: number, half: number): number {
  const fx = Math.sin(heading) * half, fz = Math.cos(heading) * half;
  return (world.heightAt(x + fx, z + fz) - world.heightAt(x - fx, z - fz)) / (2 * half);
}

export interface ProbeResult { ok: boolean; factor: number; reason: BlockReason | null; surface: SurfaceKind | null }

/** One hull point: inside the model, off blockers, on an allowed surface, no cliff relative to the hull centre. */
export function probePoint(world: VehicleWorld, rule: SurfaceRule, x: number, z: number, centreY: number, dist: number, r: number): ProbeResult {
  if (!world.inWorld(x, z)) return { ok: false, factor: 0, reason: 'edge', surface: null };
  if (r > 0 && world.blocked(x, z, r)) return { ok: false, factor: 0, reason: 'wall', surface: null };
  const s = world.surfaceAt(x, z);
  if (!s) return { ok: false, factor: 0, reason: 'water', surface: null };
  const f = rule[s] ?? 0;
  if (f <= 0) return { ok: false, factor: 0, reason: s === 'stairs' ? 'stairs' : 'surface', surface: s };
  if (Math.abs(world.heightAt(x, z) - centreY) > STEP_GRADE * dist + STEP_CURB) return { ok: false, factor: 0, reason: 'step', surface: s };
  return { ok: true, factor: f, reason: null, surface: s };
}

/** The whole hull at a pose: ok when every probe passes; factor = the surface factor under the centre. */
export function poseCheck(world: VehicleWorld, spec: VehicleSpec, x: number, z: number, heading: number): ProbeResult & { probe: number } {
  const cy = world.heightAt(x, z);
  const centre = probePoint(world, spec.surfaces, x, z, cy, 0, spec.hull.probeR);
  if (!centre.ok) return { ...centre, probe: -1 };
  const probes = spec.hull.probes;
  for (let i = 0; i < probes.length; i++) {
    const [lx, lz] = probes[i];
    const [wx, wz] = localToWorld(x, z, heading, lx, lz);
    const r = probePoint(world, spec.surfaces, wx, wz, cy, Math.hypot(lx, lz), spec.hull.probeR);
    if (!r.ok) return { ...r, probe: i };
  }
  return { ...centre, probe: -2 };
}

/**
 * Unit normal pointing INTO the obstacle near a failing pose: a ring of samples round every probe that fails,
 * summing the directions of the blocked samples. Null when nothing blocks locally (a pure "step" refusal).
 */
export function contactNormal(world: VehicleWorld, spec: VehicleSpec, x: number, z: number, heading: number): { nx: number; nz: number } | null {
  const cy = world.heightAt(x, z);
  let sx = 0, sz = 0;
  const ring = 16, rr = spec.hull.probeR + 0.3;
  const pts: [number, number, number][] = [[0, 0, 0]];
  for (const [lx, lz] of spec.hull.probes) pts.push([lx, lz, Math.hypot(lx, lz)]);
  for (const [lx, lz, d] of pts) {
    const [px, pz] = localToWorld(x, z, heading, lx, lz);
    if (probePoint(world, spec.surfaces, px, pz, cy, d, spec.hull.probeR).ok) continue;
    for (let i = 0; i < ring; i++) {
      const a = (i / ring) * Math.PI * 2, ox = Math.cos(a), oz = Math.sin(a);
      if (!probePoint(world, spec.surfaces, px + ox * rr, pz + oz * rr, cy, d + rr, 0.02).ok) { sx += ox; sz += oz; }
    }
  }
  const L = Math.hypot(sx, sz);
  return L > 1e-3 ? { nx: sx / L, nz: sz / L } : null;
}

/**
 * R ("back on the road"): the nearest pose within maxDist where the hull fits, preferring open space (a drivable
 * centre, not a kerb) and a heading close to the current one.
 */
export function findFit(world: VehicleWorld, spec: VehicleSpec, x: number, z: number, heading: number, maxDist = 30): { x: number; z: number; heading: number } | null {
  const headings = [0, Math.PI / 4, -Math.PI / 4, Math.PI / 2, -Math.PI / 2, (3 * Math.PI) / 4, (-3 * Math.PI) / 4, Math.PI].map(d => heading + d);
  let best: { x: number; z: number; heading: number; score: number } | null = null;
  let foundAt = Infinity;
  for (let r = 0; r <= maxDist && r <= foundAt + 2; r += 0.5) {
    const n = r === 0 ? 1 : Math.max(8, Math.round((2 * Math.PI * r) / 0.6));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
      for (let k = 0; k < headings.length; k++) {
        if (!poseCheck(world, spec, px, pz, headings[k]).ok) continue;
        // openness: how many points of a 1.6 u ring round it the hull centre could also stand on
        let open = 0;
        for (let j = 0; j < 12; j++) { const b = (j / 12) * Math.PI * 2; if (probePoint(world, spec.surfaces, px + Math.cos(b) * 1.6, pz + Math.sin(b) * 1.6, world.heightAt(px, pz), 1.6, spec.hull.probeR).ok) open++; }
        const score = r + k * 0.35 - open * 0.25;
        if (!best || score < best.score) best = { x: px, z: pz, heading: wrap(headings[k]), score };
        if (foundAt === Infinity) foundAt = r;
        break;
      }
    }
  }
  return best ? { x: best.x, z: best.z, heading: best.heading } : null;
}

/** A bike or toy car: state + one step() per frame. */
export class VehicleSim {
  readonly spec: VehicleSpec;
  x = 0;
  z = 0;
  y = 0;
  heading = 0;
  /** signed forward speed (u/s) */
  v = 0;
  /** world-space bounce velocity after a contact (decays at rate 6) */
  px = 0;
  pz = 0;
  vy = 0;
  airborne = false;
  /** front-wheel angle (rad, + = left) and yaw rate (rad/s) */
  steer = 0;
  yawRate = 0;
  /** longitudinal acceleration of the last sub-step (u/s², for body pitch) */
  accel = 0;
  /** grade along the heading under the vehicle; surface top-speed factor under the centre */
  grade = 0;
  factor = 1;
  /** body pitch from the terrain under the wheels (rad, + = nose up) */
  terrainPitch = 0;
  /** seconds since the last wall contact */
  contactT = 99;
  /** last refusal (for hints) */
  lastBlock: BlockReason | null = null;
  /** wall tangent of the last contact (unit); the heading keeps easing onto it for a moment after the contact */
  private tanX = 0;
  private tanZ = 0;
  private time = 0;
  private lastHopAt = -99;

  constructor(spec: VehicleSpec) { this.spec = spec; }

  /** Put the vehicle at a pose, at rest. */
  place(x: number, z: number, heading: number, world: VehicleWorld = TERRAIN_WORLD) {
    this.x = x; this.z = z; this.heading = heading;
    this.y = world.heightAt(x, z);
    this.v = 0; this.px = 0; this.pz = 0; this.vy = 0; this.airborne = false;
    this.steer = 0; this.yawRate = 0; this.accel = 0; this.contactT = 99; this.tanX = 0; this.tanZ = 0;
    this.grade = gradeAt(world, x, z, heading, this.spec.hull.halfL);
    this.terrainPitch = Math.atan(this.grade);
  }

  /** Top speed right now (sprint, uphill cut, surface). */
  topSpeed(sprint: boolean, uphill: number): number {
    const s = this.spec;
    return (sprint ? s.sprint : s.vmax) * Math.max(s.uphillMin, 1 - s.uphillK * Math.max(0, uphill)) * this.factor;
  }

  step(dtRaw: number, input: DriveInput, world: VehicleWorld = TERRAIN_WORLD): StepReport {
    const s = this.spec;
    const report: StepReport = { bump: null, refuse: null, hop: null, land: null };
    const dt = Math.min(Math.max(dtRaw, 0), 0.1);
    if (dt <= 0) return report;
    const n = clamp(Math.ceil(Math.max(dt * SUBSTEP_HZ, (Math.abs(this.v) * dt) / MAX_SUBSTEP_DIST)), 1, MAX_SUBSTEPS);
    const h = dt / n;
    let hop = input.hop;
    const thr = clamp(input.throttle, 0, 1), brk = clamp(input.brake, 0, 1);
    const coasting = thr <= 0.02 && brk <= 0.02;
    for (let i = 0; i < n; i++) {
      this.time += h;
      if (hop && !this.airborne && this.time - this.lastHopAt >= s.hopCooldown) {
        this.vy = s.hopV; this.airborne = true; this.lastHopAt = this.time;
        report.hop = { crest: false };
        hop = false;
      }
      const g = gradeAt(world, this.x, this.z, this.heading, s.hull.halfL);
      this.grade = g;
      const v0 = this.v;
      const uphill = this.v >= 0 ? g : -g;
      const top = this.topSpeed(input.sprint, uphill);

      // --- longitudinal
      let a = 0;
      let held = false;
      if (!this.airborne) {
        if (thr > 0.02 && this.v > -0.3) {
          a = s.linearDrive ? s.drive * thr * (1 - this.v / Math.max(0.5, top)) : this.v < top ? s.drive * thr : -s.coast * 2;
        } else if (thr > 0.02) {
          a = s.brake * thr; // throttle while rolling backwards brakes first
        } else if (brk > 0.02) {
          if (this.v > 0.4) a = -s.brake * brk;
          else a = -s.drive * 0.6 * brk * Math.max(0, 1 - Math.max(0, -this.v) / s.reverse);
        } else {
          a = -Math.sign(this.v) * Math.min(Math.abs(this.v) / h, s.coast);
        }
        // a vehicle standing still with no input holds on the hill; downhill, gravity pulls (−gravity·g along the
        // heading) — uphill is the top-speed cut's job, so a chugging toy still reaches vmax_eff
        const pull = -s.gravity * g;
        const dir = Math.abs(this.v) > 0.05 ? Math.sign(this.v) : thr > 0.02 ? 1 : brk > 0.02 ? -1 : 0;
        if (coasting && Math.abs(this.v) < 0.3) { held = true; a = 0; this.v = 0; }
        else if (dir !== 0 && Math.sign(pull) === dir) a += pull;
      }
      this.v += a * h;
      if (!this.airborne && coasting && !held) {
        // hill hold: a downhill coast settles at ≤ hillHold (a faster entry sheds speed at the rolling rate)
        const cap = Math.max(s.hillHold, Math.abs(v0) - s.coast * h);
        if (Math.abs(this.v) > cap) this.v = Math.sign(this.v) * cap;
      }
      this.v = clamp(this.v, -s.reverse, s.downCap * (input.sprint ? s.sprint : s.vmax));
      this.accel = (this.v - v0) / h;

      // --- steering (no air steering)
      const sp = Math.abs(this.v);
      const dmax = s.steerMax / (1 + s.steerV * sp);
      let u = clamp(input.steer, -1, 1);
      if (input.digital) u *= s.curveA - s.curveB * Math.min(1, sp / s.vmax);
      const want = -u * dmax;
      this.steer += (want - this.steer) * Math.min(1, s.steerRate * h);
      const omega = this.airborne ? 0 : (this.v / s.wheelbase) * Math.tan(this.steer);
      this.yawRate = omega;
      const oldHeading = this.heading;
      this.heading = wrap(this.heading + omega * h);
      // scraping along a wall: keep easing onto its tangent for 0.35 s unless the driver steers away
      if (this.contactT < 0.35 && Math.abs(input.steer) < 0.5 && Math.abs(this.v) > 0.5 && (this.tanX || this.tanZ)) {
        const along = Math.atan2(this.tanX, this.tanZ);
        this.heading = damp(this.heading, this.v >= 0 ? along : along + Math.PI, TANGENT_YAW_RATE, h);
      }
      // turning on the spot must not swing the hull into a wall
      if (omega !== 0 && !poseCheck(world, s, this.x, this.z, this.heading).ok && poseCheck(world, s, this.x, this.z, oldHeading).ok) {
        this.heading = oldHeading; this.steer *= 0.5; this.yawRate = 0;
      }

      // --- horizontal move with contacts
      this.move(world, h, report);

      // --- vertical
      const ground = world.heightAt(this.x, this.z);
      if (this.airborne) {
        this.vy -= s.airGravity * h;
        this.y += this.vy * h;
        if (this.y <= ground) {
          report.land = clamp(-this.vy / 8, 0.1, 1);
          this.y = ground; this.vy = 0; this.airborne = false;
        }
      } else {
        this.y = ground;
        if (s.crestK > 0 && this.v > s.crestSpeed) {
          const fx = Math.sin(this.heading) * s.crestAhead, fz = Math.cos(this.heading) * s.crestAhead;
          const ahead = gradeAt(world, this.x + fx, this.z + fz, this.heading, s.hull.halfL);
          if (g - ahead > s.crestDrop) {
            this.vy = s.crestK * this.v; this.airborne = true;
            report.hop = { crest: true };
          }
        }
      }
      const k = Math.exp(-BOUNCE_DECAY * h);
      this.px *= k; this.pz *= k;
      this.contactT += h;
    }
    const half = s.hull.halfL, fx = Math.sin(this.heading) * half, fz = Math.cos(this.heading) * half;
    this.terrainPitch = Math.atan2(world.heightAt(this.x + fx, this.z + fz) - world.heightAt(this.x - fx, this.z - fz), 2 * half);
    return report;
  }

  /** One sub-step of horizontal motion; slides along whatever stops it. */
  private move(world: VehicleWorld, h: number, report: StepReport) {
    const s = this.spec;
    let fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    const dx = (fx * this.v + this.px) * h, dz = (fz * this.v + this.pz) * h;
    if (Math.abs(dx) + Math.abs(dz) < 1e-7) return;
    const test = poseCheck(world, s, this.x + dx, this.z + dz, this.heading);
    if (test.ok) { this.x += dx; this.z += dz; this.factor = test.factor; return; }
    this.lastBlock = test.reason;
    if (test.reason === 'stairs' || test.reason === 'surface') report.refuse = { reason: test.reason, surface: test.surface };
    // contact: slide along the wall (tangent ×0.85), bounce the normal part (−0.3·v_n), ease the heading to the tangent
    const n = contactNormal(world, s, this.x + dx, this.z + dz, this.heading);
    const L = Math.hypot(dx, dz) || 1;
    const nx = n ? n.nx : dx / L, nz = n ? n.nz : dz / L;
    const Vx = fx * this.v + this.px, Vz = fz * this.v + this.pz;
    const vn = Vx * nx + Vz * nz;
    if (vn > 0) {
      const tx = Vx - nx * vn, tz = Vz - nz * vn;
      const Wx = tx * TANGENT_KEEP - nx * RESTITUTION * vn, Wz = tz * TANGENT_KEEP - nz * RESTITUTION * vn;
      const tl = Math.hypot(tx, tz);
      if (tl > 0.3) {
        this.tanX = tx / tl; this.tanZ = tz / tl;
        const along = Math.atan2(tx, tz);
        this.heading = damp(this.heading, this.v >= 0 ? along : along + Math.PI, TANGENT_YAW_RATE, h);
        fx = Math.sin(this.heading); fz = Math.cos(this.heading);
      }
      this.v = Wx * fx + Wz * fz;
      this.px = Wx - fx * this.v; this.pz = Wz - fz * this.v;
      if (!report.bump || vn > report.bump.vn) {
        const reason = test.reason ?? 'wall';
        report.bump = { strength: clamp(vn / s.vmax, 0, 1), hard: vn > HARD_BUMP, reason, vn };
      }
    }
    this.contactT = 0;
    const sx = (fx * this.v + this.px) * h, sz = (fz * this.v + this.pz) * h;
    if (poseCheck(world, s, this.x + sx, this.z + sz, this.heading).ok) { this.x += sx; this.z += sz; return; }
    // wedged: back off along the normal a hair, lose speed
    if (poseCheck(world, s, this.x - nx * 0.03, this.z - nz * 0.03, this.heading).ok) { this.x -= nx * 0.03; this.z -= nz * 0.03; }
    this.v *= 0.5; this.px *= 0.5; this.pz *= 0.5;
  }
}
