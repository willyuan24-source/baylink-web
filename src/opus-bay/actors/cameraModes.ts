import * as THREE from 'three';
import { forEachBlockerNear, heightAt, inWorld, type Blocker } from '../core/terrain';
import { cityStreamerLazy } from '../world/cityLoader';

/**
 * (W7-K1) The street trees the cameras' ray tests ask about: the running city's props (world/sf/props.ts CityProps
 * `segmentCanopy` / `canopyLift`, in the city chunk), none in the district. Tests swap the source.
 */
export interface CanopySource {
  segmentCanopy(ax: number, ay: number, az: number, bx: number, by: number, bz: number, skip?: number, cone?: number): number;
  canopyLift(ax: number, ay: number, az: number, bx: number, by: number, bz: number, from: number, clear: number): number;
}
const cityCanopies = (): CanopySource | null => cityStreamerLazy()?.props ?? null;
let canopyFn: () => CanopySource | null = cityCanopies;
export function canopySource(): CanopySource | null { return canopyFn(); }
/** Tests: a fake canopy source (null restores the city's). */
export function setCanopySourceForTests(fn: (() => CanopySource | null) | null) { canopyFn = fn ?? cityCanopies; }

/**
 * Camera rigs per movement mode (plan §6.8). actors/camera.ts keeps the on-foot rig (zoom-coupled pitch, zone views,
 * two-shots, cinematics) and delegates here while the newcomer is carried:
 *
 * | mode    | distance            | pitch                         | FOV              | follow                                   |
 * | bike    | 9 + 0.25v (≤ 12)    | 0.24 (+0.2 when the road drops) | 44 + 0.4v (≤ 50) | carried by the vehicle's delta, exp 8; behind the heading 1 s after a drag |
 * | car     | 10 + 0.25v (≤ 13)   | 0.26 + 0.25·max(0, −g 8 u ahead) | 44 + 0.6v (≤ 52) | carried by the delta (GTA_SZ src/city-world.ts), 2 s hold after a drag, rate 3 |
 * | glide   | 14, pitch 0.3       | —                             | 50 + 0.4(v − 14) | exp 6                                    |
 * | transit | rail 7 / seat 8     | window height                 | 46               | fixed to the car frame, the chosen side  |
 * | bus, LRV (W5-F10) | 14 / 15   | 0.38 / 0.46                   | 50               | behind and above, turned toward the view side (RIDE_TOUR) |
 * | sit     | 9 behind the seat   | 0.22                          | 42               | over the shoulder toward the view        |
 *
 * Occlusion: vehicles pull in to ≥ 4 u in front of a building (the TOY dither thins what is left); the glide pulls in
 * to the hit − 1.2 (GTA_SZ src/city-flight.ts). C cycles a near / far preset. Drag / right stick orbit; the rig
 * re-centres behind the heading after the hold.
 */

export type RideCamMode = 'bike' | 'car' | 'glide' | 'transit' | 'sit';

/** The side of a transit car the ride camera looks in from (+1 = the car's left), for the riders to face it. */
export const rideCamInfo = { side: 1 as 1 | -1 };

export interface RideSubject {
  mode: RideCamMode;
  /** the point to frame (rider's chest), its heading and speed (u/s; W7-K1: a city line's is the car's own along its
   *  heading, for the swing's and the pull-in's look-ahead) */
  x: number;
  y: number;
  z: number;
  heading: number;
  speed: number;
  /** ground grade 8 u ahead along the heading (car / bike look down the hill at a crest) */
  gradeAhead: number;
  /** transit: which side of the car the camera sits on (+1 = the car's left) and the rider's spot */
  side?: 1 | -1;
  seated?: boolean;
  /** transit: pull in before a building like the vehicles (city lines run between houses; the F-line keeps its window shot) */
  occlude?: boolean;
  /** transit: the vehicle kind (W5-F10: the sightseeing bus's open deck and the Metro's LRV get a designed shot) */
  kind?: 'streetcar' | 'cable-car' | 'ferry' | 'bus' | 'light-rail';
}

export interface RidePose { pos: THREE.Vector3; target: THREE.Vector3; fov: number }

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/**
 * W4-G9 · a look-at bias for the ride camera (transit): lane T's 'approach' event of the ridden bus / train (the stop's
 * attraction, 4 s) and the train coming out of a portal (the mouth behind it, 2.5 s) swing the camera round the rider
 * toward the point — 85 % of the way, the rider stays in frame — easing in and out over 0.8 s. A drag cancels it.
 * Performance-clock seconds (the callers are event handlers, not the camera's frame clock).
 */
// (W9-C-review, C-RV-2) `checked`: the t0 of the look the city check (cityViews rideLookClear) last judged, `kept`:
// its verdict — a 「窗外是 X」 line plays only when its look was kept (data/sf/tourLines.ts viewLineGate)
export const lookBias = { x: 0, z: 0, t0: -1e9, t1: -1e9, wide: false, checked: -1e9, kept: false };
const perfNow = () => performance.now() / 1000;
/**
 * `wide` (part b, the portal): the camera also pulls back (+5 u), lifts a little and widens (+6°) while it looks, so the
 * train coming out of the mouth shows whole with the portal behind it, not just the rider against the tunnel wall.
 */
export function rideLookAt(x: number, z: number, seconds = 4, wide = false) {
  const now = perfNow();
  lookBias.x = x; lookBias.z = z; lookBias.t0 = now; lookBias.t1 = now + Math.max(0.5, seconds); lookBias.wide = wide;
}
/** The bias weight now (0–1, smooth in and out over 0.8 s). */
export function rideLookWeight(now = perfNow()): number {
  if (now < lookBias.t0 || now >= lookBias.t1) return 0;
  const k = Math.min(1, (now - lookBias.t0) / 0.8, (lookBias.t1 - now) / 0.8);
  return k * k * (3 - 2 * k);
}

/**
 * W5-F10 · the designed ride shots (transit kinds with one): distance, pitch, FOV, the look point above the rider and
 * ahead of the vehicle, and how far round from straight behind toward the view side (rad).
 */
export const RIDE_TOUR: Partial<Record<NonNullable<RideSubject['kind']>, { dist: number; pitch: number; fov: number; lookUp: number; ahead: number; quarter: number }>> = {
  // (a phone frame is narrow: a wider quarter-turn or a longer look ahead put the riders at its edge)
  bus: { dist: 14, pitch: 0.38, fov: 50, lookUp: 1.2, ahead: 6, quarter: 0.35 },
  // (the Metro runs down the middle of the street between two- and three-storey houses: from nearly straight behind the
  // street stays open to the camera; a quarter-turn put the rig over the houses and it pulled in to a wall at corners)
  'light-rail': { dist: 15, pitch: 0.46, fov: 50, lookUp: 1.4, ahead: 6, quarter: 0.18 },
};

/** Distance (u) the camera may pull in to, and the hold after a manual drag before re-centring (s). */
const MIN_PULL = 4;
const HOLD = { bike: 1.0, car: 2.0, glide: 1.5, transit: 2.5, sit: 3 } as const;
const PRESETS = [1, 0.72, 1.4];
/** (W6-K1) the side-on transit shot's swing toward behind the car: the steps tried, the pitch it gains, and the share of
 * its distance a wall may stand at before the side is given up */
const SWING_STEPS = [0, 0.3, 0.55, 0.8, 1] as const;
const SWING_PITCH = 0.35;
export const SWING_CLEAR = 0.7;
/**
 * (W6-K1 review) a SEATED rider sits on the outward bench under the roof's overhang: the swung shot stays level with the
 * bench (no SWING_PITCH: from above, the roof hid the sitter — on Hyde St at swing 1 only the car's roof was in the frame)
 * and stops at the rear quarter (straight behind at bench level the car's own back hides the bench); a wall SEAT_CLEAR u
 * off is fine there (the pull-in brings the shot in front of it; the bench shot is a close one anyway)
 */
export const SEAT_SWING_MAX = 0.8;
export const SEAT_CLEAR = 5;
/**
 * (W7-K1) Street trees are in the ride camera's ray test on the city lines (their canopies, world/sf/props.ts): the
 * swing looks for a step whose line misses the canopies too, and the pull-in stops in front of one. A canopy the ray
 * enters within CANOPY_SKIP u of the rider is left to the dither (the car passes right under it). A tree-lined street
 * blocks the side-on line only now and then, so a swing is held until the side has been clear for SWING_HOLD s (it
 * used to ease back at every gap between two trees or two houses).
 */
export const CANOPY_SKIP = 1.5;
/**
 * (W7-K1) …and a canopy within atan(CANOPY_CONE) ≈ 12° of that line (seen from the camera) counts too: played on Hyde
 * St, the seated rear-quarter shot stood right beside a kerb tree — the line to the rider clear, half the phone's frame
 * leaves (a phone in portrait sees ≈ 11° either side of its axis)
 */
export const CANOPY_CONE = 0.22;
export const SWING_HOLD = 2.5;
/** (W7-K1) the swing's look-ahead: a step is clear only if it is also clear where the car will be after these seconds */
const SWING_AHEAD = [0.5, 1, 1.5] as const;
/** (W7-K1) how far ahead (s) the pull-in looks for a canopy crossing the line */
const CANOPY_LEAD = 0.35;
/**
 * (W9-C7) the look-at bias's check on a city line — set by actors/cityViews.ts (the city camera chunk) when it loads:
 * [the share of the look kept 0 … 1, its rise (rad)] for the look's full pose
 */
export const rideLookCheck: { fn: null | ((rc: RideCamera, sub: RideSubject, yaw: number, pitch: number, dist: number, lookUp: number, now: number, dt: number) => readonly [number, number]) } = { fn: null };

export class RideCamera {
  /** manual yaw / pitch offsets from the mode's default (drag / right stick) */
  yawOff = 0;
  pitchOff = 0;
  /** index into PRESETS (C) */
  preset = 0;
  /** world yaw the rig looks from (camera at target + (sin, cos)·d), for hand-back to the foot rig */
  worldYaw = 0;
  private mode: RideCamMode | null = null;
  private pos = new THREE.Vector3();
  private last = new THREE.Vector3();
  private want = new THREE.Vector3();
  private pull = 99;
  private lastDragAt = -99;
  /** performance-clock time of the last drag (a drag cancels the look-at bias) */
  private dragPerf = -1e9;
  private fov = 44;
  /**
   * (W6-K1, lane T's review: on Hyde St the side-on cable-car shot sat inside the houses) how far the side-on transit
   * shot has swung round toward behind the car (0 = side-on, 1 = straight behind, along the street) and the swing a
   * narrow street asks for (re-checked at 5 Hz)
   */
  swing = 0;
  private swingWant = 0;
  private swingAt = -1;
  /** (W7-K1) the swing does not ease back toward the side before this (perf-clock s of the ride's `now`) */
  private swingHoldUntil = -1;
  private readonly probe = new THREE.Vector3();
  /** (W7-K1) the subject a moment ahead on its line (the swing's look-ahead probes) */
  private readonly aheadSub: RideSubject = { mode: 'transit', x: 0, y: 0, z: 0, heading: 0, speed: 0, gradeAhead: 0 };

  /** Manual orbit (px from the pointer, or stick deltas already scaled to rad). */
  orbit(dYaw: number, dPitch: number, now: number) {
    this.yawOff = wrap(this.yawOff + dYaw);
    this.pitchOff = clamp(this.pitchOff + dPitch, -0.25, 0.7);
    this.lastDragAt = now;
    this.dragPerf = perfNow();
  }

  cyclePreset() { this.preset = (this.preset + 1) % PRESETS.length; }

  reset() { this.mode = null; this.yawOff = 0; this.pitchOff = 0; }

  update(sub: RideSubject, dt: number, now: number, out: RidePose, baseFovDelta = 0) {
    const fresh = this.mode !== sub.mode;
    if (fresh) { this.mode = sub.mode; this.yawOff = 0; this.pitchOff = 0; this.pull = 99; this.swing = this.swingWant = 0; this.swingAt = -1; this.swingHoldUntil = -1; }
    // re-centre behind the heading after the hold
    if (now - this.lastDragAt > HOLD[sub.mode]) {
      const k = 1 - Math.exp(-3 * dt);
      this.yawOff -= wrap(this.yawOff) * k;
      this.pitchOff -= this.pitchOff * k;
    }
    const v = Math.abs(sub.speed);
    const zoom = PRESETS[this.preset];
    let dist = 12, pitch = 0.25, fov = 44, lookUp = 1.1, ahead = 0, rate = 8;
    let yaw = sub.heading + Math.PI + this.yawOff;
    switch (sub.mode) {
      case 'bike':
        // (a touch higher than the plan's 0.24 and a quarter-turn off the tail, so BAYBAY in the basket shows past the rider)
        dist = Math.min(12, 9 + 0.25 * v);
        pitch = 0.34 + (sub.gradeAhead < -0.08 ? 0.2 : 0);
        yaw += 0.5;
        fov = Math.min(50, 44 + 0.4 * v);
        lookUp = 1.0; ahead = Math.min(3, v * 0.25);
        break;
      case 'car':
        dist = Math.min(13, 10 + 0.25 * v);
        pitch = 0.3 + 0.25 * Math.max(0, -sub.gradeAhead);
        yaw += 0.22;
        fov = Math.min(52, 44 + 0.6 * v);
        lookUp = 1.0; ahead = Math.min(4, v * 0.3);
        rate = 8;
        break;
      case 'glide':
        // (E2-6 / E2-8 tuning: closer and lower than the first 16.8 u / 0.4 — the procedural pelican fills more of the
        // frame and the horizon stays in it; still above the rider's hat so BAYBAY up front shows)
        dist = 14; pitch = 0.3;
        fov = clamp(50 + 0.4 * (v - 14), 46, 56);
        lookUp = 0.9; ahead = 10; rate = 6;
        break;
      case 'transit': {
        // side-on through the open windows, at window height, a little ahead of the rider
        const side = sub.side ?? 1;
        dist = sub.seated ? 8 : 7;
        pitch = 0.07; fov = 46; lookUp = 0; ahead = 0; rate = 10;
        // city lines (cable cars between houses): a little farther and higher, over the street furniture; seated, level
        // with the outward bench under the roof's overhang (E2-6 / DR-5: from above the roof edge hid the sitter's head,
        // worst when a narrow street pulls the rig in)
        if (sub.occlude) { dist += 1.5; pitch = sub.seated ? 0.03 : 0.2; lookUp = sub.seated ? -0.1 : 0.15; }
        yaw = sub.heading + (Math.PI / 2) * side - 0.35 * side + this.yawOff + Math.sin(now * 0.15) * 0.05;
        const tour = RIDE_TOUR[sub.kind ?? 'streetcar'];
        if (tour) {
          // W5-F10 (plan §4.4, gaps S18): the sightseeing bus's open top deck and the Metro's LRV — a designed shot from
          // behind the vehicle and above it, a quarter-turn toward the view side, looking ahead down the street: the
          // riders small in the lower third, the city opening in front (the side-on window shot filled the frame
          // with the rider and the next wall)
          dist = tour.dist; pitch = tour.pitch; fov = tour.fov; lookUp = tour.lookUp; ahead = tour.ahead; rate = 5;
          yaw = sub.heading + Math.PI - tour.quarter * side + this.yawOff + Math.sin(now * 0.12) * 0.04;
        } else if (sub.occlude) {
          // (W6-K1) a narrow street (Hyde St between its houses): where a wall stands within SWING_CLEAR of the side-on
          // distance, the shot swings round toward behind the car — along the street, where it is open — and a little
          // higher, over the car's roof; it eases back to the side once the street opens (a drag holds it where it is)
          if (now >= this.swingAt && now - this.lastDragAt > HOLD.transit) {
            this.swingAt = now + 0.2;
            const behind = wrap(sub.heading + Math.PI - yaw), d = dist * zoom;
            const seat = !!sub.seated, lift = seat ? 0 : SWING_PITCH, top = seat ? SEAT_SWING_MAX : 1;
            const need = seat ? Math.min(d * SWING_CLEAR, SEAT_CLEAR) : d * SWING_CLEAR;
            const prev = this.swingWant;
            this.swingWant = top;
            for (const k of SWING_STEPS) {
              if (k > top) break;
              if (this.clearAt(sub, yaw + behind * k, clamp(pitch + lift * k + this.pitchOff, -0.1, 1.2), d, lookUp, need)) { this.swingWant = k; break; }
            }
            // (W7-K1) the side is blocked: hold the swing; it eases back only after SWING_HOLD s of a clear side
            if (this.swingWant > 0) this.swingHoldUntil = now + SWING_HOLD;
            if (this.swingWant < prev && now < this.swingHoldUntil) this.swingWant = prev;
          }
          this.swing += (this.swingWant - this.swing) * (1 - Math.exp(-(this.swingWant > this.swing ? 5 : 1.2) * dt));
          yaw += wrap(sub.heading + Math.PI - yaw) * this.swing;
          if (!sub.seated) pitch += SWING_PITCH * this.swing;
        }
        // W4-G9: toward the stop's attraction / the portal (behind the rider on the line to it), unless dragged since
        const w = this.dragPerf >= lookBias.t0 ? 0 : rideLookWeight();
        if (w > 0) {
          const look = Math.atan2(sub.x - lookBias.x, sub.z - lookBias.z);
          // (W9-C7) a city line: the share of the look kept and its rise (actors/cityViews.ts rideLookClear)
          const c = sub.occlude && rideLookCheck.fn ? rideLookCheck.fn(this, sub, yaw + wrap(look - yaw) * 0.85, pitch + this.pitchOff, dist * zoom, lookUp, now, dt) : null;
          const k = c ? w * c[0] : w;
          yaw += wrap(look - yaw) * 0.85 * k;
          pitch += (0.06 + (c ? c[1] : 0)) * k;
          if (lookBias.wide) { dist += 5 * k; pitch += 0.08 * k; fov += 6 * k; }
        }
        break;
      }
      case 'sit':
        dist = 9; pitch = 0.22; fov = 42; lookUp = 1.6; ahead = 0; rate = 4;
        break;
    }
    dist *= zoom;
    pitch = clamp(pitch + this.pitchOff, -0.1, 1.2);
    this.worldYaw = yaw;
    const fx = Math.sin(sub.heading), fz = Math.cos(sub.heading);
    out.target.set(sub.x + fx * ahead, sub.y + lookUp, sub.z + fz * ahead);
    const cp = Math.cos(pitch);
    const want = this.want.set(sub.x + Math.sin(yaw) * cp * dist, sub.y + lookUp + Math.sin(pitch) * dist + (sub.mode === 'glide' ? 1.5 : 0), sub.z + Math.cos(yaw) * cp * dist);
    // occlusion: pull in in front of a building (≥ 4 u; the glide to the hit − 1.2)
    let hit = this.occluded(sub, want, dist);
    // (W7-K1) a canopy the shot cannot come in front of (nearer the rider than MIN_PULL): no pull-in for it — closer,
    // the leaves would only fill more of the frame (played on Hyde St: the kerb trees overhang the seated rider's side
    // and the shot sat 4 u off in the leaves); from the full distance they are a smaller part of it and the dither
    // thins them
    if (hit !== null && hit !== this.wallHit && hit - 0.6 < MIN_PULL) hit = this.wallHit;
    const pullTo = hit === null ? dist : Math.max(sub.mode === 'glide' ? 3 : MIN_PULL, hit - (sub.mode === 'glide' ? 1.2 : 0.6));
    this.pull += (pullTo - this.pull) * (pullTo < this.pull ? 1 - Math.exp(-14 * dt) : 1 - Math.exp(-1.5 * dt));
    const d = Math.min(dist, this.pull);
    if (d < dist) want.lerpVectors(out.target, want, d / dist);
    // carried by the subject's delta (no lag with speed), then eased toward the ideal spot (no allocation per frame)
    if (fresh) this.pos.copy(want);
    else {
      this.pos.x += sub.x - this.last.x; this.pos.y += sub.y - this.last.y; this.pos.z += sub.z - this.last.z;
      this.pos.lerp(want, 1 - Math.exp(-rate * dt));
    }
    this.last.set(sub.x, sub.y, sub.z);
    this.fov += (fov + baseFovDelta - this.fov) * (fresh ? 1 : 1 - Math.exp(-3 * dt));
    out.pos.copy(this.pos);
    out.fov = this.fov;
  }

  /**
   * (W6-K1) the shot from `yaw` / `pitch` at `dist` has no wall nearer than SWING_CLEAR of its distance — (W7-K1) now
   * and where the car will be SWING_AHEAD s from now (a kerb tree 8 u on passed through a step that was clear at the
   * check: every other second the line ran through a canopy)
   */
  clearAt(sub: RideSubject, yaw: number, pitch: number, dist: number, lookUp: number, need: number): boolean {
    if (!this.clearFrom(sub, yaw, pitch, dist, lookUp, need)) return false;
    const v = sub.speed;
    if (Math.abs(v) < 0.5) return true;
    const a = this.aheadSub;
    Object.assign(a, sub);
    for (const t of SWING_AHEAD) {
      a.x = sub.x + Math.sin(sub.heading) * v * t; a.z = sub.z + Math.cos(sub.heading) * v * t;
      if (!this.clearFrom(a, yaw, pitch, dist, lookUp, need)) return false;
    }
    return true;
  }

  private clearFrom(sub: RideSubject, yaw: number, pitch: number, dist: number, lookUp: number, need: number): boolean {
    const cp = Math.cos(pitch);
    const p = this.probe.set(sub.x + Math.sin(yaw) * cp * dist, sub.y + lookUp + Math.sin(pitch) * dist, sub.z + Math.cos(yaw) * cp * dist);
    const hit = this.occluded(sub, p, dist);
    return hit === null || hit >= need;
  }

  /** Distance from the target to the first building sample (or, riding a city line, street-tree canopy) on the way to the camera, or null. */
  private occluded(sub: RideSubject, want: THREE.Vector3, dist: number): number | null {
    if (sub.mode === 'transit' && !sub.occlude) return null; // the car's own body is handled by the window framing + dither
    const tx = sub.x, tz = sub.z, ty = sub.y + 1;
    // (W7-K1) the street trees' canopies on the city lines (not the car / bike / glide: their shots run along the road
    // or over it; a pull-in for every kerb tree on a turn would breathe)
    let tree: number | null = null;
    const trees = sub.mode === 'transit' ? canopySource() : null;
    if (trees) {
      let t = trees.segmentCanopy(tx, ty, tz, want.x, want.y, want.z, CANOPY_SKIP, CANOPY_CONE);
      // (and the same line CANOPY_LEAD s on: the pull-in comes in before a kerb tree crosses it, not a moment after)
      const lead = sub.speed * CANOPY_LEAD;
      if (Math.abs(lead) > 0.2) {
        const ax = Math.sin(sub.heading) * lead, az = Math.cos(sub.heading) * lead;
        const t2 = trees.segmentCanopy(tx + ax, ty, tz + az, want.x + ax, want.y, want.z + az, CANOPY_SKIP, CANOPY_CONE);
        if (t2 >= 0 && (t < 0 || t2 < t)) t = t2;
      }
      if (t >= 0) tree = dist * t;
    }
    this.wallHit = null;
    const n = Math.ceil(dist / 0.6);
    for (let i = 2; i <= n; i++) {
      const k = i / n;
      const x = tx + (want.x - tx) * k, z = tz + (want.z - tz) * k, y = ty + (want.y - ty) * k;
      if (!inWorld(x, z)) continue;
      // a building below the ray does not block it: its known top (Blocker.top, city buildings and landmarks, E2-6), else
      // an assumed 18 u over the ground here (the hero's blockers carry no roof heights)
      rayY = y; rayGround = heightAt(x, z); hitB = false;
      forEachBlockerNear(x, z, 0.35, blocksRay);
      if (hitB) { this.wallHit = dist * k; break; }
    }
    return tree !== null && (this.wallHit === null || tree < this.wallHit) ? tree : this.wallHit;
  }
  /** (W7-K1) the building part of the last occluded() answer (the pull-in never comes in for a canopy it cannot pass) */
  private wallHit: number | null = null;
}

// (the ray sample the blocker test reads: module state instead of a closure per sample)
let rayY = 0, rayGround = 0, hitB = false;
const blocksRay = (o: Blocker) => {
  if (hitB || !(o.kind === 'polygon' || o.r > 1)) return;
  hitB = o.top !== undefined ? rayY <= o.top + 0.3 : rayY <= rayGround + 18;
};
