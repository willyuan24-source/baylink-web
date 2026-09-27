import * as THREE from 'three';
import { blockersNear, heightAt, inWorld } from '../core/terrain';

/**
 * Camera rigs per movement mode (plan §6.8). actors/camera.ts keeps the on-foot rig (zoom-coupled pitch, zone views,
 * two-shots, cinematics) and delegates here while the newcomer is carried:
 *
 * | mode    | distance            | pitch                         | FOV              | follow                                   |
 * | bike    | 9 + 0.25v (≤ 12)    | 0.24 (+0.2 when the road drops) | 44 + 0.4v (≤ 50) | carried by the vehicle's delta, exp 8; behind the heading 1 s after a drag |
 * | car     | 10 + 0.25v (≤ 13)   | 0.26 + 0.25·max(0, −g 8 u ahead) | 44 + 0.6v (≤ 52) | carried by the delta (GTA_SZ src/city-world.ts), 2 s hold after a drag, rate 3 |
 * | glide   | eye p − f·16 + 5 up | —                             | 50 + 0.4(v − 14) | exp 6                                    |
 * | transit | rail 7 / seat 8     | window height                 | 46               | fixed to the car frame, the chosen side  |
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
  /** the point to frame (rider's chest), its heading and speed (u/s) */
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
}

export interface RidePose { pos: THREE.Vector3; target: THREE.Vector3; fov: number }

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** Distance (u) the camera may pull in to, and the hold after a manual drag before re-centring (s). */
const MIN_PULL = 4;
const HOLD = { bike: 1.0, car: 2.0, glide: 1.5, transit: 2.5, sit: 3 } as const;
const PRESETS = [1, 0.72, 1.4];

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
  private pull = 99;
  private lastDragAt = -99;
  private fov = 44;

  /** Manual orbit (px from the pointer, or stick deltas already scaled to rad). */
  orbit(dYaw: number, dPitch: number, now: number) {
    this.yawOff = wrap(this.yawOff + dYaw);
    this.pitchOff = clamp(this.pitchOff + dPitch, -0.25, 0.7);
    this.lastDragAt = now;
  }

  cyclePreset() { this.preset = (this.preset + 1) % PRESETS.length; }

  reset() { this.mode = null; this.yawOff = 0; this.pitchOff = 0; }

  update(sub: RideSubject, dt: number, now: number, out: RidePose, baseFovDelta = 0) {
    const fresh = this.mode !== sub.mode;
    if (fresh) { this.mode = sub.mode; this.yawOff = 0; this.pitchOff = 0; this.pull = 99; }
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
        // (a little above the plan's eye so BAYBAY up front clears the rider's hat)
        dist = 16.8; pitch = 0.4;
        fov = clamp(50 + 0.4 * (v - 14), 46, 56);
        lookUp = 0.5; ahead = 12; rate = 6;
        break;
      case 'transit': {
        // side-on through the open windows, at window height, a little ahead of the rider
        const side = sub.side ?? 1;
        yaw = sub.heading + (Math.PI / 2) * side - 0.35 * side + this.yawOff + Math.sin(now * 0.15) * 0.05;
        dist = sub.seated ? 8 : 7;
        pitch = 0.07; fov = 46; lookUp = 0; ahead = 0; rate = 10;
        // city lines (cable cars between houses): a little farther and higher, over the street furniture
        if (sub.occlude) { dist += 1.5; pitch = 0.2; lookUp = 0.15; }
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
    const want = new THREE.Vector3(sub.x + Math.sin(yaw) * cp * dist, sub.y + lookUp + Math.sin(pitch) * dist + (sub.mode === 'glide' ? 1.5 : 0), sub.z + Math.cos(yaw) * cp * dist);
    // occlusion: pull in in front of a building (≥ 4 u; the glide to the hit − 1.2)
    const hit = this.occluded(sub, want, dist);
    const pullTo = hit === null ? dist : Math.max(sub.mode === 'glide' ? 3 : MIN_PULL, hit - (sub.mode === 'glide' ? 1.2 : 0.6));
    this.pull += (pullTo - this.pull) * (pullTo < this.pull ? 1 - Math.exp(-14 * dt) : 1 - Math.exp(-1.5 * dt));
    const d = Math.min(dist, this.pull);
    if (d < dist) want.lerpVectors(out.target, want, d / dist);
    // carried by the subject's delta (no lag with speed), then eased toward the ideal spot
    const subject = new THREE.Vector3(sub.x, sub.y, sub.z);
    if (fresh) this.pos.copy(want);
    else {
      this.pos.add(subject.clone().sub(this.last));
      this.pos.lerp(want, 1 - Math.exp(-rate * dt));
    }
    this.last.copy(subject);
    this.fov += (fov + baseFovDelta - this.fov) * (fresh ? 1 : 1 - Math.exp(-3 * dt));
    out.pos.copy(this.pos);
    out.fov = this.fov;
  }

  /** Distance from the target to the first building sample on the way to the camera, or null. */
  private occluded(sub: RideSubject, want: THREE.Vector3, dist: number): number | null {
    if (sub.mode === 'transit' && !sub.occlude) return null; // the car's own body is handled by the window framing + dither
    const tx = sub.x, tz = sub.z, ty = sub.y + 1;
    const n = Math.ceil(dist / 0.6);
    for (let i = 2; i <= n; i++) {
      const k = i / n;
      const x = tx + (want.x - tx) * k, z = tz + (want.z - tz) * k, y = ty + (want.y - ty) * k;
      if (!inWorld(x, z)) continue;
      // a building below the ray does not block it (roofs are not known: assume 18 u over the ground here)
      if (y > heightAt(x, z) + 18) continue;
      const b = blockersNear(x, z, 0.35);
      if (b.some(o => o.kind === 'polygon' || o.r > 1)) return dist * k;
    }
    return null;
  }
}
