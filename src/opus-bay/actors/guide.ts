import { runtime } from '../core/runtime';
import { canStand, heightAt, nearestWalkable } from '../core/terrain';
import type { Vec2 } from '../core/types';
import { DISTRICT } from '../data/district';
import { dampAngle, moveDisc } from './controller';
import { findPath, lineOfSight, pathLength } from './nav';
import { RouteFollower, isLongRoute } from './routeFollow';

/**
 * BAYBAY's legs (contract C3). The guide brain (game/brain.ts, 10 Hz) decides WHERE and WHICH MODE
 * (runtime.guide.state / target / run / emote); this decides HOW, every frame: plans a path (straight when there is
 * line of sight, A* otherwise), paces herself against the player (follow: a rubber band that never lets the gap grow;
 * lead: holds ~3.5 u ahead and never sprints away from a walking player), arrives comfortably, keeps out of the
 * player's way (with a dead zone so two idle friends do not shuffle), faces the player while talking / waiting, and
 * when she is left far behind and off-screen she hops back in beside the player (never a visible teleport).
 *
 * City mode (lane E2 wave 2, E2-2): a lead target beyond the local window asks for a walking-graph route like the
 * player's click-to-walk (routeFollow.RouteFollower: abortable, the clamped local path while it is pending, legs refined
 * as she reaches them, a fresh route after repeated stalls); small nudges of the brain's target keep the route. The
 * > 60 u hop-in stays. District mode is unchanged (findPath / line of sight only).
 */

export const GUIDE_RADIUS = 0.42;
export const GUIDE_WALK = 3.9;
export const GUIDE_RUN = 8.2;
const GUIDE_MAX = 9.5;
const ACCEL = 16;
const DECEL = 20;
const PERSONAL_SPACE = 1.25;
const FOLLOW_GAP = 3.5;
/** lead: how far ahead of the player BAYBAY walks */
const LEAD_AHEAD = 3.5;
/** hop-in: farther than this and off-screen for HOP_DELAY s → hop back in (A6) */
const HOP_FAR = 18, HOP_DELAY = 1.5, HOP_TIME = 0.4;
/** the walk cycle starts only after the commanded speed has been above this for WALK_GATE s */
const WALK_MIN = 0.4, WALK_GATE = 0.15;
/** a long route is kept while the brain's target stays within this of its goal (lead targets shift with the player) */
const LONG_KEEP = 8;
/** (W6-K1) a talk mark farther than this from the player is stale (every live one is beside them) */
export const TALK_FAR = 30;

/**
 * (W7-K2, lane B's request) City mode: where BAYBAY on foot steps to when a transit vehicle comes at her on its rails or
 * lane (actors/vehicles/transitClear.ts guideAside, registered by the city's ride module), else null. The transit stops
 * only for the player; without this a tram passed through her. Asked ASIDE_HZ times a second while she walks or waits.
 */
let transitAside: ((x: number, z: number) => Vec2 | null) | null = null;
export function setTransitAside(fn: ((x: number, z: number) => Vec2 | null) | null) { transitAside = fn; }
const ASIDE_EVERY = 0.2;
/** her quick step off the rails: at least this long (s), at running pace */
const ASIDE_MIN_S = 0.25;

const dist = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.z - b.z);
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

export interface GuideStepOptions {
  playing: boolean;
  riding: boolean;
  /** BAYBAY is inside the camera frustum (actors/system.ts); undefined = assume visible */
  visible?: boolean;
}

export class GuideMover {
  vx = 0;
  vz = 0;
  stride = 0;
  /** speed the walk cycle should show (commanded, gated so tiny shuffles do not flicker the legs) */
  animSpeed = 0;
  /** last hop-in (QA / telemetry) */
  hops = 0;
  private path: Vec2[] = [];
  private pathIndex = 0;
  private plannedFor: Vec2 | null = null;
  private planAt = -10;
  private stallT = 0;
  private stallRef = Infinity;
  private fails = 0;
  private lastX = NaN;
  private lastZ = NaN;
  private placed = false;
  /** player-follow goal when the brain leaves target null in follow mode */
  private followGoal: Vec2 | null = null;
  private side = 1;
  private sideKey = '';
  private sideTarget: Vec2 | null = null;
  private stillT = 0;
  private frame: (Vec2 & { yaw: number; px: number; pz: number }) | null = null;
  private hiddenFarT = 0;
  /** a scripted move in progress: the hop-in arc, or (W5-F5) a dash to the pull spot (`dur` s, running legs, no arc) */
  private hop: { fx: number; fz: number; tx: number; tz: number; t: number; dur?: number } | null = null;
  private gateT = 0;
  /** (W7-K2) the next transit check (s, the step clock) and how often she stepped aside (QA / tests) */
  private asideAt = -1;
  asides = 0;
  /**
   * (W7-K-review) where she stood when she stepped aside: she waits beside the rails until no transit vehicle has that
   * spot in its path any more (her follow / framing spot lay on the rails: she walked back in and dashed off again,
   * 15 times in 12 s beside a car waiting for the player), or the player walks on
   */
  private asideFrom: Vec2 | null = null;
  /** city mode: the long route of the current target (E2-2) */
  readonly route = new RouteFollower();
  /** following `route` (pending: still on the clamped local path) */
  long = false;

  /** Initial spot: a few steps ahead of the spawn, in view, so BAYBAY can waddle up for the welcome. */
  place() {
    const g = runtime.guide;
    const s = DISTRICT.spawn;
    const want = { x: s.x + Math.sin(s.heading) * 9 + Math.cos(s.heading) * 2.5, z: s.z + Math.cos(s.heading) * 9 - Math.sin(s.heading) * 2.5 };
    const spot = nearestWalkable(want, 12) ?? { x: s.x + 2, z: s.z + 2 };
    g.x = spot.x; g.z = spot.z; g.y = heightAt(spot.x, spot.z);
    g.heading = s.heading + Math.PI;
    this.lastX = g.x; this.lastZ = g.z;
    this.placed = true;
  }

  private resetPath() {
    this.path = []; this.pathIndex = 0; this.plannedFor = null; this.stallT = 0; this.stallRef = Infinity; this.fails = 0;
    this.route.cancel(); this.long = false;
  }

  /** The camera-space side slot beside the player (F15 semantics): ±2 u lateral, 0.6 u beyond. */
  private sideSlot(): Vec2 {
    const p = runtime.player, yaw = runtime.camera.yaw;
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
    for (const sgn of [this.side, -this.side]) {
      const c = { x: p.x + rx * 2 * sgn + fx * 0.6, z: p.z + rz * 2 * sgn + fz * 0.6 };
      if (canStand(c.x, c.z, GUIDE_RADIUS)) return c;
    }
    return nearestWalkable({ x: p.x + fx * 1.5, z: p.z + fz * 1.5 }, 6) ?? { x: p.x, z: p.z };
  }

  /**
   * Hop back in (replaces the old teleport rescue): start just out of frame on the camera side of the player and
   * arc into the side slot over 0.4 s.
   */
  private hopIn() {
    const g = runtime.guide, p = runtime.player, yaw = runtime.camera.yaw;
    const brainSlot = g.target && dist(g.target, p) < 5 ? g.target : null;
    const to = brainSlot ?? this.sideSlot();
    // 6 u toward the camera from the slot is below the bottom edge of the follow frame
    const back = { x: to.x + Math.sin(yaw) * 6, z: to.z + Math.cos(yaw) * 6 };
    const from = canStand(back.x, back.z, GUIDE_RADIUS) ? back : nearestWalkable(back, 6) ?? to;
    this.hop = { fx: from.x, fz: from.z, tx: to.x, tz: to.z, t: 0 };
    g.x = from.x; g.z = from.z; g.y = heightAt(from.x, from.z);
    this.vx = this.vz = 0;
    this.resetPath();
    this.hiddenFarT = 0;
    this.hops++;
    this.lastX = g.x; this.lastZ = g.z;
  }

  /**
   * W5-F5 (BAYBAY's pull): run to `to` in `seconds` (a straight dash at running pace; seen from far off or out of view,
   * she hops in beside it instead). Her own path and route are dropped; the brain takes over again when she is there.
   */
  dash(to: Vec2, seconds: number, visible = true) {
    const g = runtime.guide;
    if (!visible || Math.hypot(to.x - g.x, to.z - g.z) > 14) {
      const yaw = runtime.camera.yaw;
      const back = { x: to.x + Math.sin(yaw) * 6, z: to.z + Math.cos(yaw) * 6 };
      const from = canStand(back.x, back.z, GUIDE_RADIUS) ? back : nearestWalkable(back, 6) ?? to;
      g.x = from.x; g.z = from.z; g.y = heightAt(from.x, from.z);
      this.hop = { fx: from.x, fz: from.z, tx: to.x, tz: to.z, t: 0 };
      this.hops++;
    } else this.hop = { fx: g.x, fz: g.z, tx: to.x, tz: to.z, t: 0, dur: Math.max(0.05, seconds) };
    this.vx = this.vz = 0;
    this.resetPath();
    this.hiddenFarT = 0;
    this.lastX = g.x; this.lastZ = g.z;
  }

  /** a dash or a hop-in is under way */
  get dashing(): boolean { return this.hop !== null; }

  step(dt: number, now: number, opts: GuideStepOptions) {
    const g = runtime.guide, p = runtime.player;
    if (!this.placed) this.place();
    // external moves (flow puts BAYBAY next to you after a ride)
    if (Math.abs(g.x - this.lastX) > 1e-4 || Math.abs(g.z - this.lastZ) > 1e-4) { this.resetPath(); this.vx = this.vz = 0; this.hop = null; }

    // --- hop-in arc (or a dash) in progress
    if (this.hop) {
      const h = this.hop;
      h.t += dt;
      const dash = h.dur !== undefined;
      const k = clamp(h.t / (h.dur ?? HOP_TIME), 0, 1);
      const e = dash ? k : k * k * (3 - 2 * k);
      const x0 = g.x, z0 = g.z;
      g.x = h.fx + (h.tx - h.fx) * e; g.z = h.fz + (h.tz - h.fz) * e;
      g.y = heightAt(g.x, g.z) + (dash ? 0 : Math.sin(k * Math.PI) * 0.9);
      if (Math.hypot(h.tx - h.fx, h.tz - h.fz) > 0.05) g.heading = Math.atan2(h.tx - h.fx, h.tz - h.fz);
      const moved = Math.hypot(g.x - x0, g.z - z0);
      g.speed = dash && dt > 0 ? moved / dt : 0;
      this.animSpeed = dash && k < 1 ? GUIDE_RUN : 0;
      if (dash) this.stride += moved / 0.95;
      g.arrived = k >= 1;
      if (k >= 1) { this.hop = null; g.y = heightAt(g.x, g.z); this.vx = this.vz = 0; }
      this.lastX = g.x; this.lastZ = g.z;
      return;
    }

    // --- (W7-K2) a cable car / streetcar / bus / train coming at her on its rails or lane: step off it
    if (!transitAside || !opts.playing || opts.riding) this.asideFrom = null;
    else if (now >= this.asideAt) {
      this.asideAt = now + ASIDE_EVERY;
      const to = transitAside(g.x, g.z);
      if (to) {
        this.asides++;
        if (!this.asideFrom) this.asideFrom = { x: g.x, z: g.z };
        this.dash(to, Math.max(ASIDE_MIN_S, Math.hypot(to.x - g.x, to.z - g.z) / GUIDE_RUN), opts.visible !== false);
        return;
      }
      // (W7-K-review) the vehicle has passed the spot she left (or stopped): back to following
      if (this.asideFrom && !transitAside(this.asideFrom.x, this.asideFrom.z)) this.asideFrom = null;
    }

    const gp = Math.hypot(g.x - p.x, g.z - p.z);
    // (W7-K-review) waiting beside the rails for the vehicle to pass — unless the player walks on
    if (this.asideFrom && gp > FOLLOW_GAP + 3) this.asideFrom = null;
    const asideWait = this.asideFrom !== null;
    // --- left behind and out of sight → hop back in
    const hidden = opts.visible === false;
    if (opts.playing && !opts.riding && gp > HOP_FAR && hidden && g.state !== 'wait') this.hiddenFarT += dt; else this.hiddenFarT = 0;
    if (this.hiddenFarT > HOP_DELAY || (opts.playing && !opts.riding && gp > 60)) { this.hopIn(); return; }

    // --- goal
    let target: Vec2 | null = g.target;
    // (W6-K1, W5-Z §7.5) a talk mark far from the player is stale (a dialogue left open across a teleport / a hop-in: her
    // welcome or stage mark hundreds of u back): she stays by the player instead of re-planning a long findPath to it
    // every few seconds and hopping back in when it fails. Every live talk mark stands beside the player.
    if (target && g.state === 'talk' && Math.hypot(target.x - p.x, target.z - p.z) > TALK_FAR) target = null;
    if (!target && g.state === 'follow' && opts.playing && !opts.riding) {
      // brain let go: loiter, but never drift too far from the player
      if (gp > FOLLOW_GAP + 3 || (this.followGoal && dist(this.followGoal, g) > 0.6)) {
        if (!this.followGoal || gp > FOLLOW_GAP + 3) this.followGoal = this.sideSlot();
        target = this.followGoal;
      } else this.followGoal = null;
    } else this.followGoal = null;

    // following: keep to one side (never parked between the camera and the player)
    if (target && g.state === 'follow' && opts.playing && Math.hypot(target.x - p.x, target.z - p.z) < 5) {
      const yaw = runtime.camera.yaw;
      const rx = Math.cos(yaw), rz = -Math.sin(yaw);
      const lateral = (g.x - p.x) * rx + (g.z - p.z) * rz;
      if (Math.abs(lateral) > 0.8) this.side = lateral > 0 ? 1 : -1;
      const tl = (target.x - p.x) * rx + (target.z - p.z) * rz;
      if (Math.abs(tl) < 1.2) {
        const key = `${target.x.toFixed(2)},${target.z.toFixed(2)},${this.side}`;
        if (key !== this.sideKey) { this.sideKey = key; this.sideTarget = { x: target.x + rx * 1.7 * this.side, z: target.z + rz * 1.7 * this.side }; }
        if (this.sideTarget && canStand(this.sideTarget.x, this.sideTarget.z, GUIDE_RADIUS)) target = this.sideTarget;
      }
    }

    // standing still / chatting: settle beside the player as seen from the camera (both stay in frame)
    if (!p.moving) this.stillT += dt; else this.stillT = 0;
    const settle = opts.playing && !opts.riding && gp < 7 && !g.target && !asideWait
      && ((g.state === 'follow' && this.stillT > 0.9) || (g.state === 'talk' && this.stillT > 0.3));
    if (settle) {
      const spot = this.framingSpot();
      if (spot) target = spot;
    } else this.frame = null;

    let wx = 0, wz = 0, want = 0;
    let arrived = true;
    // (W7-K-review) waiting for the vehicle to pass: she stands (a target she has not reached stays unreached)
    if (target && asideWait) arrived = false;
    else if (target) {
      if (target !== this.plannedFor || (this.path.length === 0 && now - this.planAt > 0.5)) this.plan(target, now);
      if (this.long) this.followLong(target);
      while (this.pathIndex < this.path.length - 1 && dist(this.path[this.pathIndex], g) < 0.6) this.pathIndex++;
      const wp = this.path[this.pathIndex];
      if (wp) {
        const last = this.pathIndex === this.path.length - 1;
        const d = dist(wp, g);
        const remaining = pathLength({ x: g.x, z: g.z }, this.path, this.pathIndex);
        if (last && d < 0.45 && this.long && this.route.walker && !this.route.walker.lastLeg) { this.route.walker.leg++; arrived = false; }
        else if (last && d < 0.45) { arrived = true; }
        else {
          arrived = false;
          wx = (wp.x - g.x) / (d || 1); wz = (wp.z - g.z) / (d || 1);
          want = this.paceSpeed(g.state, gp, remaining, wx, wz);
          if (last) want *= Math.min(1, Math.max(0.3, d / 1.8));
          // stall → re-plan → hop back in
          if (remaining < this.stallRef - 0.2) { this.stallRef = remaining; this.stallT = 0; } else this.stallT += dt;
          if (this.stallT > 1.2) {
            this.stallT = 0; this.stallRef = Infinity;
            if (this.long) {
              // long route: re-plan the leg, then ask for a fresh route (twice), then as below
              if (++this.fails <= 3) { const re = this.route.replan(g); if (re && re.length) { this.path = re; this.pathIndex = 0; } }
              else if (this.route.requests < 3) { this.fails = 0; this.route.request({ x: g.x, z: g.z }, target); }
              else { if (gp > 12 && hidden) { this.hopIn(); return; } this.resetPath(); this.plannedFor = target; }
            } else if (++this.fails > 3) { if (gp > 12 && hidden) { this.hopIn(); return; } this.resetPath(); this.plannedFor = target; }
            else this.plan(target, now);
          }
        }
      }
    }

    // personal space: step aside instead of blocking the player — but two idle friends a step apart stay put
    const bothIdle = !p.moving && want < 0.01;
    if (gp < PERSONAL_SPACE && gp > 1e-3 && opts.playing && !(bothIdle && gp > 0.9)) {
      const k = (PERSONAL_SPACE - gp) / PERSONAL_SPACE;
      wx += ((g.x - p.x) / gp) * k * 1.6; wz += ((g.z - p.z) / gp) * k * 1.6;
      want = Math.max(want, 2.4 * k + (p.moving ? 1.5 : 0));
      const L = Math.hypot(wx, wz) || 1; wx /= L; wz /= L;
    }

    const tx = wx * want, tz = wz * want;
    const dvx = tx - this.vx, dvz = tz - this.vz, dv = Math.hypot(dvx, dvz), max = (want > 0.01 ? ACCEL : DECEL) * dt;
    if (dv <= max) { this.vx = tx; this.vz = tz; } else { this.vx += (dvx / dv) * max; this.vz += (dvz / dv) * max; }
    const speed = Math.hypot(this.vx, this.vz);
    const x0 = g.x, z0 = g.z;
    if (speed > 1e-3) {
      const n = Math.max(1, Math.ceil((speed * dt) / 0.2));
      for (let i = 0; i < n; i++) {
        const r = moveDisc(g.x, g.z, (this.vx * dt) / n, (this.vz * dt) / n, GUIDE_RADIUS, heightAt(g.x, g.z));
        g.x = r.x; g.z = r.z;
      }
    }
    const moved = Math.hypot(g.x - x0, g.z - z0);
    g.y = heightAt(g.x, g.z);
    g.speed = dt > 0 ? moved / dt : 0;
    // legs follow the commanded speed (no flicker from tiny corrections): > 0.4 u/s for 0.15 s before walking
    const commanded = Math.min(speed, g.speed + 0.5);
    if (commanded > WALK_MIN) this.gateT += dt; else this.gateT = 0;
    this.animSpeed = this.gateT >= WALK_GATE ? commanded : 0;
    if (this.animSpeed > 0) this.stride += moved / (speed > GUIDE_WALK + 1 ? 0.95 : 0.55);

    // facing
    const faceTalk = g.state === 'talk' || g.state === 'wait' || g.state === 'idle' || g.state === 'emote' || (arrived && gp < 9);
    if (speed > 0.35 && g.speed > 0.2) g.heading = dampAngle(g.heading, Math.atan2(this.vx, this.vz), 10, dt);
    else if (faceTalk && gp > 0.3 && opts.playing) g.heading = dampAngle(g.heading, Math.atan2(p.x - g.x, p.z - g.z), 6, dt);

    g.arrived = arrived || !target;
    // keep BAYBAY standable (the brain may target points inside blockers)
    if (!canStand(g.x, g.z, GUIDE_RADIUS * 0.6)) {
      const spot = nearestWalkable({ x: g.x, z: g.z }, 6);
      if (spot) { g.x = spot.x; g.z = spot.z; g.y = heightAt(spot.x, spot.z); }
    }
    this.lastX = g.x; this.lastZ = g.z;
  }

  /**
   * Speed profile (A6).
   *  - follow: rubber band on the player's speed, clamp(v·1.1 + max(0, gap − 4)·0.6, 0, 9.5), with a floor so she
   *    still settles into her slot when the player stands still;
   *  - lead: hold ~3.5 u ahead, clamp(v + (3.5 − ahead)·0.9, 1.5, 8), never sprinting away from a walking player.
   */
  private paceSpeed(state: string, gap: number, remaining: number, dirX: number, dirZ: number): number {
    const g = runtime.guide, p = runtime.player;
    const pv = p.moving ? p.speed : 0;
    if (state === 'lead') {
      // how far ahead of the player she is, measured along her direction of travel
      const ahead = (g.x - p.x) * dirX + (g.z - p.z) * dirZ;
      let v = clamp(pv + (LEAD_AHEAD - ahead) * 0.9, 1.5, 8);
      if (pv > 0.3 && !p.running) v = Math.min(v, pv + 2); // never sprint away from a walking player
      return v;
    }
    if (state === 'follow') {
      const band = clamp(pv * 1.1 + Math.max(0, gap - 4) * 0.6, 0, GUIDE_MAX);
      const settle = Math.min(GUIDE_WALK, 1.2 + remaining * 0.8);
      return Math.max(band, settle, g.run ? GUIDE_RUN : 0);
    }
    return g.run || remaining > 16 ? GUIDE_RUN : GUIDE_WALK;
  }

  /**
   * A spot 2 u to the player's side from the camera's point of view and 0.6 u further from the camera than the
   * player, kept while the camera / player do not move much. Null when BAYBAY is already well placed.
   */
  private framingSpot(): Vec2 | null {
    const g = runtime.guide, p = runtime.player, yaw = runtime.camera.yaw;
    const f = this.frame;
    if (f && Math.abs(Math.atan2(Math.sin(yaw - f.yaw), Math.cos(yaw - f.yaw))) < 0.6 && Math.hypot(p.x - f.px, p.z - f.pz) < 1.2) return f;
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
    const relX = g.x - p.x, relZ = g.z - p.z;
    const lateral = relX * rx + relZ * rz, depth = relX * fx + relZ * fz;
    // already beside / beyond the player and not too far: stay put
    if (depth > -0.4 && Math.abs(lateral) > 1.3 && Math.hypot(relX, relZ) < 4.2) { this.frame = null; return null; }
    const side = lateral >= 0 ? 1 : -1;
    for (const sgn of [side, -side]) {
      const cand = { x: p.x + rx * 2 * sgn + fx * 0.6, z: p.z + rz * 2 * sgn + fz * 0.6 };
      if (canStand(cand.x, cand.z, GUIDE_RADIUS)) { this.frame = { ...cand, yaw, px: p.x, pz: p.z }; return this.frame; }
    }
    this.frame = null;
    return null;
  }

  private plan(target: Vec2, now: number) {
    const g = runtime.guide;
    this.plannedFor = target;
    this.planAt = now;
    this.stallT = 0; this.stallRef = Infinity;
    const from = { x: g.x, z: g.z };
    // a lead target nudged by the brain keeps its long route
    if (this.long && this.route.goal && dist(this.route.goal, target) < LONG_KEEP) return;
    if (this.long) { this.long = false; this.route.cancel(); }
    if (lineOfSight(from, target)) { this.path = [{ x: target.x, z: target.z }]; this.pathIndex = 0; return; }
    const res = findPath(from, target, 8);
    if (isLongRoute(from, target, res)) { this.long = true; this.route.request(from, target); }
    this.path = res?.points ?? [];
    this.pathIndex = 0;
  }

  /** Long route: the route walker's local legs once the route is known (else the clamped path planned above). */
  private followLong(target: Vec2) {
    const g = runtime.guide, f = this.route;
    if (f.state === 'failed') {
      // no graph route: walk as far as the local grid goes
      this.long = false; f.cancel();
      this.path = findPath({ x: g.x, z: g.z }, target, 8)?.points ?? []; this.pathIndex = 0;
      return;
    }
    if (!f.active) return;
    const pts = f.update({ x: g.x, z: g.z }, 3, 0.45);
    if (!pts) {
      // the route is walked: the last bit to the (possibly nudged) target is local
      this.long = false; f.cancel();
      const from = { x: g.x, z: g.z };
      this.path = lineOfSight(from, target) ? [{ x: target.x, z: target.z }] : findPath(from, target, 8)?.points ?? [];
      this.pathIndex = 0;
      return;
    }
    if (pts !== this.path) { this.path = pts; this.pathIndex = 0; this.stallRef = Infinity; this.stallT = 0; }
  }
}
