import { emit } from '../core/events';
import { input } from '../core/input';
import { runtime } from '../core/runtime';
import { canStand, cityTerrain, groundPending, heightAt, inWorld, nearestWalkable, pushOutOfBlockers, surfaceAt, blockersNear } from '../core/terrain';
import type { SurfaceKind, Vec2 } from '../core/types';
import { DISTRICT } from '../data/district';
import { findPath, pathLength } from './nav';
import { RouteFollower, isLongRoute } from './routeFollow';

/**
 * Player controller: camera-relative movement with acceleration curves, turn smoothing, gravity jump,
 * ground following (hills, Filbert Steps, pier decks), sub-stepped collision that slides along walls and
 * round blockers, a soft bump at the model edge, footstep / jump / land events, click-to-walk path following
 * and the unstuck rescue. Framework-free (tested in node); Actors.tsx calls step() every frame.
 *
 * Grade model (plan §6.2, whole-SF hills): g = Δh/Δs over 0.6 u along the motion; uphill × max(0.55, 1 − 0.45·g),
 * downhill × (1 + 0.12·min(1, |g| / 0.5)), stairs × 0.8 up / × 0.9 down, and ground steeper than 0.9 that is not a
 * flight of stairs is a wall (moveDisc). No stamina: a climb of ≥ 6 u ends in a cosmetic pant at the crest.
 * Ground / collision come from core/terrain only (the city provider extends it).
 *
 * Long click-to-walk (city mode, lane E2 wave 2, E2-1): a target beyond LOCAL_ROUTE (or one the local grid cannot
 * reach) asks for a walking-graph route (routeFollow.RouteFollower → nav.routeTo, abortable) and walks the clamped local
 * path while it is pending; then it follows the route leg by leg (each ≤ 60 u, refined with findPath), re-plans a leg on
 * a stall and asks for a fresh route after 3 stalls. District mode never takes that branch (findPath only, as before).
 * City ground that is not resident yet (standAt −1) is unknown, not stuck: the stuck timer pauses there and the rescue
 * never throws the player back to the Ferry gate (checkpoint CS-4).
 */

/** = terrain STAND_RADIUS, so A* paths on the nav grid stay valid for the body (A8) */
export const PLAYER_RADIUS = 0.45;
export const WALK_SPEED = 4.2;
export const RUN_SPEED = 7.5;
const ACCEL = 24;
const DECEL = 30;
const AIR_ACCEL = 9;
const TURN_RATE = 13;
/** A10: snappier, asymmetric jump — rise at 24, fall at 40; apex ≈ 1.33 u, air time ≈ 0.6 s */
const GRAVITY_UP = 24;
const GRAVITY_DOWN = 40;
const JUMP_SPEED = 8.2;
const ANTICIPATION = 0.07;
/** jump still allowed this long after walking off an edge; a press this long before landing is kept */
const COYOTE = 0.1, JUMP_BUFFER = 0.12;
/** releasing the jump key before the apex cuts the rise */
const JUMP_CUT = 0.55;
/** stride lengths (u per footstep) */
const STRIDE_WALK = 0.95, STRIDE_RUN = 1.6, STRIDE_STAIRS = 0.5;
/** sharp reversal at speed: a short lean-back skid */
const SKID_SPEED = 5, SKID_TIME = 0.18;
const SUBSTEP = 0.18;
/** max ground rise per sub-step while walking (ramps are continuous; this only stops cliffs) */
const MAX_RISE = 0.55;
/** ground drop that still counts as "walking down" (snap) instead of falling */
const SNAP_DOWN = 0.75;
const WALL_SAMPLES = 32;
/** ground steeper than this (Δh/Δs, not stairs) is a wall */
export const WALL_GRADE = 0.9;
/** grade sampled this far along the motion (u) */
export const GRADE_SPAN = 0.6;

/** Walking speed factor on grade g (+ = uphill along the motion) and surface (plan §6.2). */
export function gradeFactor(g: number, surface: SurfaceKind | null): number {
  if (surface === 'stairs') return g > 0.02 ? 0.8 : g < -0.02 ? 0.9 : 1;
  if (g > 0) return Math.max(0.55, 1 - 0.45 * g);
  return 1 + 0.12 * Math.min(1, -g / 0.5);
}

/** Too steep to walk up: a non-stairs slope above WALL_GRADE between (x, z) and 0.3 u further along (dx, dz). */
function steepWall(x: number, z: number, dx: number, dz: number, ground: number): boolean {
  const L = Math.hypot(dx, dz);
  if (L < 1e-6) return false;
  const px = x + (dx / L) * 0.3, pz = z + (dz / L) * 0.3;
  if (surfaceAt(px, pz) === 'stairs') return false;
  return (heightAt(px, pz) - ground) / 0.3 > WALL_GRADE;
}

/** Crest pant (E2-13): a climb counts from g > PANT.climbG; its crest pants once it rose ≥ PANT.rise u. */
export const PANT = {
  /** grade that makes (and keeps) a climb */
  climbG: 0.2,
  /** below this the ground is flat / downhill; between the two a gentle stretch keeps the climb without ending it */
  crestG: 0.1,
  /** height gained since the foot of the climb (u) */
  rise: 6,
  /** the crest: this long on the flat (s) or standing still (s), or this far back down (u) */
  crestMove: 1,
  crestStill: 1.5,
  crestDrop: 1.5,
  /** at most one pant per this long (s) */
  cooldown: 45,
} as const;

/**
 * No stamina, only a cosmetic pant (plan §6.2, E2-13 by climb height): a climb starts when the walker moves uphill at
 * g > 0.2 (walking or running, steps included) and lasts through gentle stretches (0.1–0.2); its crest is 1 s on the flat,
 * 1.5 s standing still, or 1.5 u back down. A crest after a ≥ 6 u rise returns true once, at most one per 45 s — so a
 * short landing on the Filbert Steps is not a crest, and the whole climb to Coit Tower pants once, at the top.
 */
export class GradeTracker {
  /** a climb is on: its foot and highest point (y), and how long the crest has lasted on the flat / standing */
  private active = false;
  private base = 0;
  private peak = 0;
  private flat = 0;
  private still = 0;
  private t = 0;
  private lastPant = -Infinity;
  /** height gained so far by the current climb (0 when none) */
  get rise() { return this.active ? this.peak - this.base : 0; }
  /** Forget the current climb (teleports); the cooldown stays. */
  reset() { this.active = false; this.flat = this.still = 0; }
  /** One grounded step: g = grade along the motion (+ uphill), moving = walking / running, y = the feet. True = pant. */
  update(dt: number, g: number, moving: boolean, y: number): boolean {
    this.t += dt;
    if (!this.active) {
      if (moving && g > PANT.climbG) { this.active = true; this.base = this.peak = y; this.flat = this.still = 0; }
      return false;
    }
    if (y > this.peak) this.peak = y;
    if (moving && g > PANT.climbG) { this.flat = this.still = 0; return false; }
    if (moving && g >= PANT.crestG) { this.still = 0; return false; }
    if (moving) { this.flat += dt; this.still = 0; } else this.still += dt;
    if (this.flat < PANT.crestMove && this.still < PANT.crestStill && this.peak - y < PANT.crestDrop) return false;
    const rise = this.peak - this.base;
    this.active = false;
    if (rise < PANT.rise || this.t - this.lastPant < PANT.cooldown) return false;
    this.lastPant = this.t;
    return true;
  }
}
/** a long walk that has not come LONG_PROGRESS u closer in this many seconds gives up (verify-desktop D2) */
export const LONG_NO_PROGRESS = 14;
const LONG_PROGRESS = 2;
/** a failed walk to a target farther than this (u) is "far": BAYBAY says why (the red ring may be off screen) */
const FAR_FAIL = 14;
/** pushing into a wall at less than this share of the wish speed along it = stop and lean instead of crawling */
const SLIDE_MIN = 0.35;
/** minimum time a press lasts before sliding can resume (s) */
const PRESS_HOLD = 0.25;

export interface Obstacle { x: number; z: number; r: number; kind: string }

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
/** Exponential approach toward an angle along the shortest arc. */
export function dampAngle(cur: number, target: number, rate: number, dt: number) {
  return cur + wrapAngle(target - cur) * (1 - Math.exp(-rate * dt));
}

/** Walkable ring test around (x, z): the centre and 8 rim points must be on a walkable surface. */
function walkableDisc(x: number, z: number, r: number) {
  return canStand(x, z, r);
}

/**
 * Move a disc of radius r by (dx, dz) with sliding. Returns the resolved position and the unit normal of
 * the surface it hit (0,0 when free). `ground` is the current ground height (for the cliff test).
 */
export function moveDisc(x: number, z: number, dx: number, dz: number, r: number, ground: number, airborne = false): { x: number; z: number; nx: number; nz: number; blocked: boolean } {
  const ok = (px: number, pz: number): Vec2 | null => {
    const q = pushOutOfBlockers(px, pz, r);
    const moved = Math.hypot(q.x - x, q.z - z);
    if (moved > Math.hypot(dx, dz) + SUBSTEP * 1.5) return null; // never tunnel / teleport through a blocker
    if (!walkableDisc(q.x, q.z, r * 0.96)) return null;
    if (!airborne && heightAt(q.x, q.z) - ground > MAX_RISE) return null;
    if (!airborne && steepWall(x, z, q.x - x, q.z - z, ground)) return null;
    return q;
  };
  const direct = ok(x + dx, z + dz);
  if (direct) {
    const pushed = Math.abs(direct.x - (x + dx)) + Math.abs(direct.z - (z + dz)) > 1e-4;
    let nx = 0, nz = 0;
    if (pushed) { const px = x + dx - direct.x, pz = z + dz - direct.z, L = Math.hypot(px, pz) || 1; nx = px / L; nz = pz / L; }
    return { x: direct.x, z: direct.z, nx, nz, blocked: pushed };
  }
  // Wall normal from the walkable boundary (and cliffs) around the attempted spot.
  let sx = 0, sz = 0;
  const tx = x + dx, tz = z + dz, rr = r + 0.2;
  for (let i = 0; i < WALL_SAMPLES; i++) {
    const a = (i / WALL_SAMPLES) * Math.PI * 2, ox = Math.cos(a), oz = Math.sin(a);
    const px = tx + ox * rr, pz = tz + oz * rr;
    const rise = heightAt(px, pz) - ground;
    const wall = !surfaceAt(px, pz) || (!airborne && (rise > MAX_RISE * 1.6 || (rise / rr > WALL_GRADE && surfaceAt(px, pz) !== 'stairs'))) || blockersNear(px, pz, 0.05).length > 0;
    if (wall) { sx += ox; sz += oz; }
  }
  const L = Math.hypot(sx, sz);
  if (L > 1e-3) {
    const nx = sx / L, nz = sz / L;
    const into = dx * nx + dz * nz;
    if (into > 0) {
      const slideX = dx - nx * into, slideZ = dz - nz * into;
      const slid = ok(x + slideX, z + slideZ);
      if (slid) return { x: slid.x, z: slid.z, nx, nz, blocked: true };
    }
    // corner: try the two axis-aligned components
    const ax = ok(x + dx, z), az = ok(x, z + dz);
    const best = ax && az ? (Math.abs(dx) > Math.abs(dz) ? ax : az) : ax ?? az;
    if (best) return { x: best.x, z: best.z, nx, nz, blocked: true };
    return { x, z, nx, nz, blocked: true };
  }
  const ax = ok(x + dx, z), az = ok(x, z + dz);
  const best = ax && az ? (Math.abs(dx) > Math.abs(dz) ? ax : az) : ax ?? az;
  if (best) return { x: best.x, z: best.z, nx: 0, nz: 0, blocked: true };
  const L2 = Math.hypot(dx, dz) || 1;
  return { x, z, nx: dx / L2, nz: dz / L2, blocked: true };
}

/** Kind of the static prop blocker nearest to (x, z) — for bump sounds. */
function blockerKind(x: number, z: number): string {
  let best = 'wall', bestD = 1.6;
  for (const p of DISTRICT.props) {
    if (!p.blockRadius) continue;
    const d = Math.hypot(p.x - x, p.z - z) - p.blockRadius;
    if (d < bestD) { bestD = d; best = p.kind; }
  }
  return best;
}

export interface StepContext {
  dt: number;
  /** seconds, monotonic */
  now: number;
  cameraYaw: number;
  /** movement frozen (dialogue, cinematic, ride, photo mode, title …) */
  frozen: boolean;
  /** carried by something else (streetcar, bike, toy car, pelican, sitting): the movement system places the body */
  riding: boolean;
  /** dynamic soft obstacles (NPCs, BAYBAY) the player is pushed out of */
  obstacles?: Obstacle[];
}

export class PlayerController {
  vx = 0;
  vz = 0;
  vy = 0;
  grounded = true;
  airTime = 0;
  /** stride phase in steps (integer crossings = foot contacts) */
  stride = 0;
  /** ≥ 0 while in jump anticipation (seconds) */
  anticipation = -1;
  /** last landing (for squash): time + impact 0..1 */
  landedAt = -10;
  landImpact = 0;
  jumpedAt = -10;
  /** smoothed turn rate (rad/s) for banking */
  turnRate = 0;
  /** acceleration along the heading (u/s²) for lean */
  accel = 0;
  // path following
  path: Vec2[] = [];
  pathIndex = 0;
  /** incremented on every successful plan (breadcrumbs) */
  planCount = 0;
  /** `now` of the last path that could not be planned / had to be given up (A11: say so) */
  pathFailedAt = -10;
  /** that failed walk's target was far (a long auto-walk: the map's 带我去, a lead) — the actor system says why */
  pathFailedFar = false;
  /** double-click / double-tap: run the whole way */
  forceRun = false;
  private autoRunK = 0;
  private stepNow = 0;
  private plannedFor: Vec2 | null = null;
  private stallT = 0;
  private stallRef = Infinity;
  private repaths = 0;
  /**
   * (part b, verify-desktop D2) no-progress watchdog of a long walk: the least route length left so far and when it was
   * reached. Re-planning legs and fresh routes reset the stall counters, so a walker that paced between two points
   * (Pier 41's walkway: (-239, 70) ↔ (-212, 69) for 60 s and more) never gave up; now it does after LONG_NO_PROGRESS s.
   */
  private bestLeft = Infinity;
  private bestAt = 0;
  /** city mode: the long route being fetched / followed for the current target (E2-1) */
  readonly route = new RouteFollower();
  /** following `route` (pending: still walking the clamped local path) */
  longMode = false;
  /** the clamped local path of a long target reached the target itself (fallback when the graph fails) */
  private localOk = false;
  private seenArrivals = 0;
  // bookkeeping
  private lastX = NaN;
  private lastZ = NaN;
  private stuckT = 0;
  private resetSeen = input.resetCount;
  private edgeBumpAt = -10;
  private wallBumpAt = -10;
  private obstacleBumpAt = -10;
  /** set when the external world moved the player (teleport / ride) this frame */
  teleported = false;
  /** 0..1 leaning into a wall the player is pushing against (animation) */
  wallLean = 0;
  /** 0..1 skid lean-back after a sharp reversal (animation) */
  skid = 0;
  /** on a flight of stairs (animation: knee lift, short strides) */
  onStairs = false;
  /** grade along the motion (Δh/Δs, + = uphill) and the speed factor it gave (plan §6.2) */
  grade = 0;
  gradeK = 1;
  /** climbs of ≥ 6 u → a pant at the crest (the actor system plays it, the movement system says 'pant') */
  readonly climb = new GradeTracker();
  /** `now` of the last crest pant */
  pantAt = -10;
  private skidUntil = -10;
  private lastGroundedAt = -10;
  private jumpPressedAt = -10;
  private cutAllowed = false;
  /** the buffered jump came from the touch 跳 button (core/input touchJumpArm) */
  private tapCut = false;
  private cutDone = false;
  /** averaged wall normal (points into the wall) of the last 3 contacts, and time since the last contact */
  private wallN = { x: 0, z: 0 };
  private wallHits: { x: number; z: number }[] = [];
  private contactAge = 99;
  private pressing = false;
  private pressSince = -10;
  private releaseAt = -10;

  /** Put the controller in sync with runtime.player (after teleports). */
  sync() {
    const p = runtime.player;
    this.vx = this.vz = this.vy = 0;
    this.grounded = true;
    this.anticipation = -1;
    p.y = heightAt(p.x, p.z);
    this.lastX = p.x; this.lastZ = p.z;
    this.clearPath();
    this.climb.reset();
    this.stuckT = 0;
    this.wallHits.length = 0; this.contactAge = 99; this.pressing = false; this.wallLean = 0;
  }

  clearPath() {
    this.forceRun = false;
    this.path = [];
    this.pathIndex = 0;
    this.plannedFor = null;
    this.stallT = 0;
    this.stallRef = Infinity;
    this.repaths = 0;
    this.route.cancel();
    this.longMode = false;
  }

  /** Where the breadcrumbs go: the long route ahead (≤ 140 u) once it is known, else the local path. */
  crumbPath(): Vec2[] {
    const p = runtime.player;
    return this.longMode && this.route.active ? this.route.ahead({ x: p.x, z: p.z }, 140) : this.path;
  }

  /** Stop auto-walking (keyboard/stick took over, or the path is impossible). */
  cancelPath() {
    const p = runtime.player;
    p.pathTarget = null;
    p.pendingInteract = null;
    this.clearPath();
  }

  unstick() {
    const p = runtime.player;
    // city mode: never the district spawn (CS-4) — with nothing standable within 60 u, stay put until the ground streams in
    const spot = nearestWalkable({ x: p.x, z: p.z }, 60) ?? (cityTerrain() ? null : nearestWalkable(DISTRICT.spawn, 20) ?? { x: DISTRICT.spawn.x, z: DISTRICT.spawn.z });
    if (!spot) { this.stuckT = 0; return; }
    p.x = spot.x; p.z = spot.z;
    this.sync();
    p.pathTarget = null;
    p.pendingInteract = null;
  }

  step(ctx: StepContext) {
    const p = runtime.player;
    const dt = ctx.dt;
    this.teleported = false;
    this.stepNow = ctx.now;

    // 1. somebody else moved us (teleportPlayer, ?at=, ride end, QA)
    if (Number.isFinite(this.lastX) && (Math.abs(p.x - this.lastX) > 1e-4 || Math.abs(p.z - this.lastZ) > 1e-4)) {
      this.teleported = true;
      if (!ctx.riding) { this.sync(); }
    }
    if (!Number.isFinite(this.lastX)) this.sync();

    // edges are always consumed so they never fire late
    if (runtime.input.jump) { this.jumpPressedAt = ctx.now; this.tapCut = input.touchJumpArm; }
    runtime.input.jump = false;
    input.touchJumpArm = false;
    const wantJump = ctx.now - this.jumpPressedAt <= JUMP_BUFFER;
    if (input.resetCount !== this.resetSeen) {
      this.resetSeen = input.resetCount;
      if (!ctx.riding && !canStand(p.x, p.z, PLAYER_RADIUS)) this.unstick();
    }

    if (ctx.riding) {
      // the ride (game/ride.ts) writes x/z/heading; we only keep the body on the car floor
      this.vx = this.vz = this.vy = 0;
      this.grounded = true;
      this.anticipation = -1;
      p.y = heightAt(p.x, p.z);
      p.speed = 0; p.moving = false; p.running = false; p.grounded = true;
      this.clearPath();
      this.lastX = p.x; this.lastZ = p.z;
      return;
    }

    // 2. desired horizontal velocity
    let wx = 0, wz = 0, wantSpeed = 0;
    const mx = runtime.input.moveX, my = runtime.input.moveY, mag = Math.min(1, Math.hypot(mx, my));
    if (!ctx.frozen && mag > 0.05) {
      if (p.pathTarget || this.path.length) this.cancelPath();
      const yaw = ctx.cameraYaw;
      // camera looks along (−sin yaw, −cos yaw); right = (cos yaw, −sin yaw)
      const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
      wx = rx * mx + fx * my; wz = rz * mx + fz * my;
      const L = Math.hypot(wx, wz) || 1;
      wx /= L; wz /= L;
      wantSpeed = (runtime.input.run ? RUN_SPEED : WALK_SPEED) * (mag < 0.35 ? 0.35 + mag : Math.min(1, mag * 1.08));
    } else if (!ctx.frozen && p.pathTarget) {
      const dir = this.followPath(dt);
      if (dir) { wx = dir.x; wz = dir.z; wantSpeed = dir.speed; }
    }

    // 2a. grade (plan §6.2): uphill slower, downhill a touch faster, stairs their own pace
    if (wantSpeed > 0 && this.grounded) {
      const h0 = heightAt(p.x, p.z), h1 = heightAt(p.x + wx * GRADE_SPAN, p.z + wz * GRADE_SPAN);
      this.grade = (h1 - h0) / GRADE_SPAN;
      this.gradeK = gradeFactor(this.grade, surfaceAt(p.x + wx * 0.3, p.z + wz * 0.3) ?? p.surface);
      wantSpeed *= this.gradeK;
    } else if (this.grounded) { this.grade = 0; this.gradeK = 1; }

    // 2b. wall contact (A8): slide along the averaged wall normal with the full wish projected onto the tangent;
    //     pushing nearly straight in = stop, face the wish, lean into the wall (no sideways crawl, no twitching)
    this.contactAge += dt;
    if (this.pressing && wantSpeed > 0) {
      // still pushing: probe a short step along the wish so the contact stays alive while we stand at the wall
      const probe = moveDisc(p.x, p.z, wx * 0.06, wz * 0.06, PLAYER_RADIUS, heightAt(p.x, p.z));
      if (probe.blocked && (probe.nx || probe.nz)) this.noteWall(probe.nx, probe.nz);
    }
    let pressing = false;
    const wishX = wx, wishZ = wz;
    if (wantSpeed > 0 && this.grounded && this.contactAge < 0.15) {
      const n = this.wallN;
      const into = wx * n.x + wz * n.z;
      if (into > 0.05) {
        const tgx = wx - n.x * into, tgz = wz - n.z * into, ratio = Math.hypot(tgx, tgz);
        // hysteresis: start pressing below SLIDE_MIN, only start sliding again well above it (the averaged normal of an
        // irregular edge still wobbles a little)
        const limit = this.pressing ? SLIDE_MIN + 0.2 : SLIDE_MIN;
        if (ratio < limit || (this.pressing && ctx.now - this.pressSince < PRESS_HOLD)) pressing = true;
        else { wx = tgx / ratio; wz = tgz / ratio; wantSpeed *= ratio; }
      }
    }
    if (pressing && !this.pressing) {
      this.pressSince = ctx.now;
      // one bump per contact
      if (Math.hypot(this.vx, this.vz) > 1 && ctx.now - this.releaseAt > 0.25 && inWorld(p.x + this.wallN.x * 2.6, p.z + this.wallN.z * 2.6)) {
        emit({ type: 'bump', kind: blockerKind(p.x, p.z), strength: clamp(Math.hypot(this.vx, this.vz) / RUN_SPEED, 0.15, 1) });
        this.wallBumpAt = ctx.now;
      }
    }
    if (!pressing && this.pressing) this.releaseAt = ctx.now;
    this.pressing = pressing;
    if (pressing) wantSpeed = 0;
    this.wallLean += ((pressing ? 1 : 0) - this.wallLean) * Math.min(1, dt * 10);

    // 3. accelerate (curves: quick start, quicker stop, weak air control)
    const tx = wx * wantSpeed, tz = wz * wantSpeed;
    const accel = !this.grounded ? AIR_ACCEL : wantSpeed > 0.01 ? ACCEL : DECEL;
    const dvx = tx - this.vx, dvz = tz - this.vz, dv = Math.hypot(dvx, dvz);
    const maxDv = accel * dt;
    const prevSpeed = Math.hypot(this.vx, this.vz);
    if (dv <= maxDv) { this.vx = tx; this.vz = tz; } else { this.vx += (dvx / dv) * maxDv; this.vz += (dvz / dv) * maxDv; }
    // sharp reversals: bleed speed so the turn reads (toy feel) instead of moonwalking; above 5 u/s it is a skid
    if (wantSpeed > 0 && prevSpeed > 1) {
      const dot = (this.vx * wx + this.vz * wz) / (Math.hypot(this.vx, this.vz) || 1);
      if (dot < -0.2) { this.vx *= 0.9; this.vz *= 0.9; }
      if (dot < -0.5 && prevSpeed > SKID_SPEED && this.grounded && ctx.now > this.skidUntil + 0.3) {
        this.skidUntil = ctx.now + SKID_TIME;
        emit({ type: 'bump', kind: 'skid', strength: clamp(prevSpeed / RUN_SPEED, 0.3, 1) });
      }
    }
    this.skid += ((ctx.now < this.skidUntil ? 1 : 0) - this.skid) * Math.min(1, dt * 18);
    let speed = Math.hypot(this.vx, this.vz);
    this.accel = (speed - prevSpeed) / Math.max(dt, 1e-3);

    // 4. heading follows the velocity (or the wish when starting from rest / pressing into a wall)
    const before = p.heading;
    const held = !ctx.frozen && (Math.hypot(runtime.input.moveX, runtime.input.moveY) > 0.05 || !!p.pathTarget);
    if (pressing) p.heading = dampAngle(p.heading, Math.atan2(wishX, wishZ), TURN_RATE, dt);
    else if (speed > 1.0) p.heading = dampAngle(p.heading, Math.atan2(this.vx, this.vz), TURN_RATE, dt);
    else if (held && wantSpeed > 0) p.heading = dampAngle(p.heading, Math.atan2(wx, wz), TURN_RATE, dt);
    this.turnRate += (wrapAngle(p.heading - before) / Math.max(dt, 1e-3) - this.turnRate) * Math.min(1, dt * 10);

    // 5. jump (with a short anticipation squash), coyote time after an edge, buffered presses before landing
    if (this.grounded) this.lastGroundedAt = ctx.now;
    const coyote = !this.grounded && this.vy <= 0 && ctx.now - this.lastGroundedAt < COYOTE && this.jumpedAt < this.lastGroundedAt;
    if (wantJump && !ctx.frozen && (this.grounded || coyote) && this.anticipation < 0) {
      this.jumpPressedAt = -10;
      if (coyote) this.anticipation = ANTICIPATION; // no time to crouch: leave right away
      else this.anticipation = 0;
    }
    if (this.anticipation >= 0) {
      this.anticipation += dt;
      if (ctx.frozen) this.anticipation = -1;
      else if (this.anticipation >= ANTICIPATION) {
        this.anticipation = -1;
        this.vy = JUMP_SPEED;
        this.grounded = false;
        this.airTime = 0;
        this.jumpedAt = ctx.now;
        // (a touch 跳 tap may already be released: it still cuts — a quick tap is a short hop, E2-review)
        this.cutAllowed = input.jumpHeld || this.tapCut;
        this.cutDone = false;
        emit({ type: 'jump' });
      }
    }

    // 6. horizontal move, sub-stepped
    const ground0 = heightAt(p.x, p.z);
    const dist = speed * dt;
    const n = Math.max(1, Math.ceil(dist / SUBSTEP));
    let hitX = 0, hitZ = 0, blocked = false;
    const x0 = p.x, z0 = p.z;
    if (dist > 1e-5) {
      let ground = this.grounded ? ground0 : Math.max(ground0, p.y);
      for (let i = 0; i < n; i++) {
        const r = moveDisc(p.x, p.z, (this.vx * dt) / n, (this.vz * dt) / n, PLAYER_RADIUS, ground, !this.grounded);
        p.x = r.x; p.z = r.z;
        if (r.blocked) { blocked = true; hitX = r.nx; hitZ = r.nz; }
        ground = this.grounded ? heightAt(p.x, p.z) : ground;
      }
      if (blocked && (hitX || hitZ)) {
        // remove the velocity component into the wall so we slide instead of grinding
        const into = this.vx * hitX + this.vz * hitZ;
        if (into > 0) { this.vx -= hitX * into; this.vz -= hitZ * into; }
        this.noteWall(hitX, hitZ);
      }
    }
    // soft dynamic obstacles (NPCs, BAYBAY)
    if (ctx.obstacles) {
      for (const o of ctx.obstacles) {
        const dx = p.x - o.x, dz = p.z - o.z, d = Math.hypot(dx, dz), min = o.r + PLAYER_RADIUS;
        if (d < min && d > 1e-4) {
          const push = min - d;
          const q = moveDisc(p.x, p.z, (dx / d) * push, (dz / d) * push, PLAYER_RADIUS, heightAt(p.x, p.z));
          p.x = q.x; p.z = q.z;
          if (speed > 2.2 && ctx.now - this.obstacleBumpAt > 1.2) { this.obstacleBumpAt = ctx.now; emit({ type: 'bump', kind: o.kind, strength: clamp(speed / RUN_SPEED, 0.2, 1) }); }
        }
      }
    }
    const moved = Math.hypot(p.x - x0, p.z - z0);
    if (blocked && dist > 1e-3) {
      const intoSpeed = prevSpeed;
      // edge of the model: a gentle bounce + BAYBAY's line (flow listens for kind /edge/)
      const ahead = { x: p.x + (wx || this.vx) * 2.2, z: p.z + (wz || this.vz) * 2.2 };
      const hx = wx || hitX, hz = wz || hitZ;
      if (!inWorld(p.x + hx * 2.6, p.z + hz * 2.6) || !inWorld(ahead.x, ahead.z)) {
        if (ctx.now - this.edgeBumpAt > 1.4 && intoSpeed > 1) {
          this.edgeBumpAt = ctx.now;
          emit({ type: 'bump', kind: 'slab-edge', strength: clamp(intoSpeed / RUN_SPEED, 0.2, 1) });
          if (hitX || hitZ) { this.vx = -hitX * 2.2; this.vz = -hitZ * 2.2; }
        }
      } else if (!this.pressing && moved < dist * 0.35 && intoSpeed > 3 && ctx.now - this.wallBumpAt > 0.9) {
        this.wallBumpAt = ctx.now;
        emit({ type: 'bump', kind: blockerKind(p.x, p.z), strength: clamp(intoSpeed / RUN_SPEED, 0.15, 1) });
      }
    }
    speed = Math.hypot(this.vx, this.vz);

    // 7. vertical: follow the ground, fall, land
    const ground = heightAt(p.x, p.z);
    if (this.grounded) {
      if (ground < p.y - SNAP_DOWN) { this.grounded = false; this.vy = 0; this.airTime = 0; }
      else p.y = ground;
    }
    if (!this.grounded) {
      this.airTime += dt;
      // short hop: the key came up before the apex
      if (this.cutAllowed && !this.cutDone && !input.jumpHeld && this.vy > 0) { this.vy *= JUMP_CUT; this.cutDone = true; }
      this.vy -= (this.vy > 0 ? GRAVITY_UP : GRAVITY_DOWN) * dt;
      p.y += this.vy * dt;
      if (p.y <= ground) {
        const impact = clamp(-this.vy / 12, 0.1, 1);
        p.y = ground;
        this.grounded = true;
        this.landedAt = ctx.now;
        this.landImpact = impact;
        this.vy = 0;
        emit({ type: 'land', impact });
      }
    }

    // 8. footsteps at stride contacts
    if (this.grounded && moved > 1e-4) {
      const strideLen = this.onStairs ? STRIDE_STAIRS : speed > (WALK_SPEED + RUN_SPEED) / 2 ? STRIDE_RUN : STRIDE_WALK;
      const before2 = Math.floor(this.stride);
      this.stride += moved / strideLen;
      if (Math.floor(this.stride) !== before2) {
        const surface = (surfaceAt(p.x, p.z) ?? p.surface) as SurfaceKind;
        emit({ type: 'footstep', surface, run: speed > WALK_SPEED + 0.8 });
      }
    } else if (this.grounded && speed < 0.2) {
      // settle the stride to the nearest contact so the next step starts cleanly
      const target = Math.round(this.stride);
      this.stride += (target - this.stride) * Math.min(1, dt * 6);
    }

    // 9. unstuck: inside a blocker / off the walkable area for > 1 s (city ground that is not resident is unknown: the
    //    timer pauses there, CS-4)
    if (!canStand(p.x, p.z, PLAYER_RADIUS * 0.7)) { if (!groundPending(p.x, p.z)) this.stuckT += dt; } else this.stuckT = 0;
    if (this.stuckT > 1) this.unstick();

    // 10. publish (+ the crest pant after a climb of ≥ 6 u, E2-13)
    if (this.grounded && this.climb.update(dt, speed > 0.5 ? this.grade : 0, speed > 0.5, p.y)) this.pantAt = ctx.now;
    p.speed = speed;
    p.moving = speed > 0.3;
    p.running = speed > WALK_SPEED + 0.8;
    p.grounded = this.grounded;
    const surf = surfaceAt(p.x, p.z);
    if (surf) p.surface = surf;
    this.onStairs = surf === 'stairs';
    this.lastX = p.x; this.lastZ = p.z;
  }

  /** Remember a wall contact; the normal used for sliding is the average of the last three. */
  private noteWall(nx: number, nz: number) {
    this.wallHits.push({ x: nx, z: nz });
    if (this.wallHits.length > 3) this.wallHits.shift();
    let sx = 0, sz = 0;
    for (const h of this.wallHits) { sx += h.x; sz += h.z; }
    const L = Math.hypot(sx, sz);
    if (L > 1e-3) { this.wallN.x = sx / L; this.wallN.z = sz / L; }
    this.contactAge = 0;
  }

  /** Returns the wish direction + speed toward the next waypoint, or null when arrived / impossible. */
  private followPath(dt: number): { x: number; z: number; speed: number } | null {
    const p = runtime.player;
    const target = p.pathTarget!;
    if (target !== this.plannedFor) {
      this.plannedFor = target;
      this.repaths = 0;
      this.bestLeft = Infinity;
      this.bestAt = this.stepNow;
      this.autoRunK = 0;
      if (this.longMode) { this.longMode = false; this.route.cancel(); }
      if (!this.plan(target)) { this.failPath(target); return null; }
    }
    if (this.longMode) return this.followLong(dt, target);
    // advance through reached waypoints
    while (this.pathIndex < this.path.length - 1 && Math.hypot(this.path[this.pathIndex].x - p.x, this.path[this.pathIndex].z - p.z) < 0.55) this.pathIndex++;
    const wp = this.path[this.pathIndex];
    if (!wp) { p.pathTarget = null; this.clearPath(); return null; }
    const last = this.pathIndex === this.path.length - 1;
    const dx = wp.x - p.x, dz = wp.z - p.z, d = Math.hypot(dx, dz);
    if (last && d < 0.3) { p.pathTarget = null; this.clearPath(); return null; }
    // stall detection → re-plan, then give up
    const remaining = pathLength({ x: p.x, z: p.z }, this.path, this.pathIndex);
    if (remaining < this.stallRef - 0.25) { this.stallRef = remaining; this.stallT = 0; }
    else this.stallT += dt;
    if (this.stallT > 0.9) {
      this.stallT = 0; this.stallRef = Infinity;
      if (++this.repaths > 3 || !this.plan(target)) { this.failPath(target); return null; }
    }
    // A11: auto-run only for long routes (> 30 u left), easing in; a double-click runs the whole way
    const far = remaining > 30;
    this.autoRunK = clamp(this.autoRunK + (far || this.forceRun ? dt / 0.8 : -dt / 0.4), 0, 1);
    let speed = runtime.input.run ? RUN_SPEED : WALK_SPEED + (RUN_SPEED - WALK_SPEED) * this.autoRunK * this.autoRunK;
    if (last) speed *= clamp(d / 1.6, 0.35, 1);
    return { x: dx / (d || 1), z: dz / (d || 1), speed };
  }

  /** Give the walk up (A11: the actor system shows the red ring; a far target also gets BAYBAY's line). */
  private failPath(target: Vec2) {
    const p = runtime.player;
    this.pathFailedFar = Math.hypot(target.x - p.x, target.z - p.z) > FAR_FAIL;
    this.pathFailedAt = this.stepNow;
    this.cancelPath();
  }

  private plan(target: Vec2): boolean {
    const p = runtime.player;
    const res = findPath({ x: p.x, z: p.z }, target, 10);
    if (!this.longMode && isLongRoute(p, target, res)) {
      // city mode, far target: fetch the graph route, walk the clamped local path meanwhile
      this.longMode = true;
      this.localOk = !!res && !res.snapped && res.points.length > 0;
      this.route.request({ x: p.x, z: p.z }, target);
      this.path = res?.points ?? [];
      this.pathIndex = 0;
      this.stallRef = Infinity;
      this.stallT = 0;
      return true;
    }
    if (!res || !res.points.length) return false;
    this.path = res.points;
    this.pathIndex = 0;
    this.stallRef = Infinity;
    this.stallT = 0;
    this.planCount++;
    return true;
  }

  /** Long route (city mode): the route walker's local legs once the route is known, the clamped path until then. */
  private followLong(dt: number, target: Vec2): { x: number; z: number; speed: number } | null {
    const p = runtime.player, f = this.route, pos = { x: p.x, z: p.z };
    if (f.state === 'failed') {
      // no graph route: finish the local path when it reached the target itself, else say so
      if (this.localOk && this.path.length) { this.longMode = false; this.route.cancel(); return null; }
      this.failPath(target); return null;
    }
    if (f.active) {
      if (f.arrivals !== this.seenArrivals) { this.seenArrivals = f.arrivals; this.planCount++; }
      const pts = f.update(pos, 3, 0.35);
      if (!pts) { p.pathTarget = null; this.clearPath(); return null; }
      if (pts !== this.path) { this.path = pts; this.pathIndex = 0; this.stallRef = Infinity; this.stallT = 0; }
    }
    while (this.pathIndex < this.path.length - 1 && Math.hypot(this.path[this.pathIndex].x - p.x, this.path[this.pathIndex].z - p.z) < 0.55) this.pathIndex++;
    const wp = this.path[this.pathIndex];
    // still fetching and no local way (or its end reached): wait here for the route
    if (!wp) return null;
    const last = this.pathIndex === this.path.length - 1;
    const final = f.active && !!f.walker?.lastLeg && last;
    const dx = wp.x - p.x, dz = wp.z - p.z, d = Math.hypot(dx, dz);
    if (last && d < 0.3) {
      if (final || !f.active) { if (final) { p.pathTarget = null; this.clearPath(); } return null; }
      // the leg's local path ended short of the leg end (its goal snapped): go on with the next leg
      f.walker!.leg++;
      return null;
    }
    // stall → re-plan the leg (3×) → a fresh route (twice) → give up. Ground that is still streaming in is not a stall.
    const remaining = pathLength(pos, this.path, this.pathIndex);
    const ahead = groundPending(p.x + (dx / (d || 1)) * 1.2, p.z + (dz / (d || 1)) * 1.2, 0.45);
    if (remaining < this.stallRef - 0.25) { this.stallRef = remaining; this.stallT = 0; }
    else if (!ahead) this.stallT += dt;
    if (this.stallT > 0.9) {
      this.stallT = 0; this.stallRef = Infinity;
      if (++this.repaths <= 3) {
        const re = f.active ? f.replan(pos) : findPath(pos, target, 10)?.points ?? null;
        if (re && re.length) { this.path = re; this.pathIndex = 0; }
      } else if (f.requests < 3) {
        this.repaths = 0;
        f.request(pos, target);
        this.path = findPath(pos, target, 10)?.points ?? [];
        this.pathIndex = 0;
      } else { this.failPath(target); return null; }
    }
    const left = f.active ? f.remaining(pos) : Infinity;
    // the whole way must shrink now and then (the stall counters above only watch the current leg)
    const toGo = Number.isFinite(left) ? left : Math.hypot(target.x - p.x, target.z - p.z);
    if (toGo < this.bestLeft - LONG_PROGRESS) { this.bestLeft = toGo; this.bestAt = this.stepNow; }
    else if (ahead) this.bestAt += dt;
    else if (this.stepNow - this.bestAt > LONG_NO_PROGRESS) { this.failPath(target); return null; }
    this.autoRunK = clamp(this.autoRunK + (left > 30 || this.forceRun ? dt / 0.8 : -dt / 0.4), 0, 1);
    let speed = runtime.input.run ? RUN_SPEED : WALK_SPEED + (RUN_SPEED - WALK_SPEED) * this.autoRunK * this.autoRunK;
    if (final) speed *= clamp(d / 1.6, 0.35, 1);
    return { x: dx / (d || 1), z: dz / (d || 1), speed };
  }
}
