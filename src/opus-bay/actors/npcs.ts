import * as THREE from 'three';
import { runtime } from '../core/runtime';
import { canStand, heightAt, nearestWalkable } from '../core/terrain';
import type { Vec2 } from '../core/types';
import { DISTRICT, at, frameAt, stationOf } from '../data/district';
import { Animator, type Emote } from './anim';
import { dampAngle, wrapAngle, type Obstacle } from './controller';
import { buildNpc, type NpcLook, type Rig } from './models';
import { joggerState } from './view';

/**
 * Ambient residents (DESIGN §2): market vendor, Pier 7 angler, promenade jogger, a visiting family (parent +
 * kid) and the F-line operator. Light behaviours: face the player when near, wave hello once in a while,
 * talk while their dialogue is open, and a signature idle (arranging produce, fishing, jogging the promenade,
 * pointing at the bay, ringing the bell when a streetcar leaves).
 */

export type NpcBehavior = 'vendor' | 'fisher' | 'jogger' | 'parent' | 'kid' | 'operator';

export interface NpcDef {
  /** interactable id when the NPC can be talked to (anchor name, matches game/interactables NPC_POSTS) */
  id: string;
  look: NpcLook;
  behavior: NpcBehavior;
  anchor: string;
  /** lateral offset (u) from the anchor, along the promenade tangent */
  offset?: number;
  scale?: number;
}

export const NPC_DEFS: NpcDef[] = [
  { id: 'npc-vendor', look: 'vendor', behavior: 'vendor', anchor: 'npc-vendor' },
  { id: 'npc-fisher', look: 'fisher', behavior: 'fisher', anchor: 'npc-fisher' },
  { id: 'npc-jogger', look: 'jogger', behavior: 'jogger', anchor: 'npc-jogger-a' },
  { id: 'npc-family', look: 'parent', behavior: 'parent', anchor: 'npc-family', offset: -0.55 },
  { id: 'npc-family-kid', look: 'kid', behavior: 'kid', anchor: 'npc-family', offset: 0.75, scale: 0.72 },
  { id: 'npc-streetcar', look: 'operator', behavior: 'operator', anchor: 'npc-streetcar' },
];

const JOG_SPEED = 3.3;
const GREET_RADIUS = 4.6;
/** the jogger stretches this long at each loop end, longer (up to JOG_WAIT_MAX) while the player stands close */
const JOG_PAUSE = 2.4, JOG_WAIT_MAX = 8;

function headingFrom(dx: number, dz: number) { return Math.atan2(dx, dz); }

/** Face the promenade centre line (for people standing beside it). */
function faceWalk(p: Vec2): number {
  const { st, d } = stationOf(p);
  const f = frameAt(st);
  const s = d > 0 ? -1 : 1;
  return headingFrom(f.nx * s, f.nz * s);
}

export class Npc {
  readonly def: NpcDef;
  readonly rig: Rig;
  readonly anim: Animator;
  readonly object: THREE.Object3D;
  x = 0;
  z = 0;
  y = 0;
  heading = 0;
  homeHeading = 0;
  speed = 0;
  stride = 0;
  talking = false;
  private near = false;
  private greetAt = -100;
  private nextIdleAt = 3 + Math.random() * 4;
  // jogger
  private route: Vec2[] = [];
  private routeT = 0;
  private dir = 1;
  private pauseUntil = 0;
  private pauseStart = 0;
  private passWaveAt = -100;
  private sidestep = 0;

  constructor(def: NpcDef) {
    this.def = def;
    this.rig = buildNpc(def.look);
    this.anim = new Animator(this.rig, 'npc');
    this.object = this.rig.mesh;
    const s = def.scale ?? 1;
    this.object.scale.setScalar(s);
    const a = DISTRICT.anchors[def.anchor] ?? DISTRICT.spawn;
    let p = { x: a.x, z: a.z };
    if (def.offset) {
      const f = frameAt(stationOf(a).st);
      p = { x: a.x + f.tx * def.offset, z: a.z + f.tz * def.offset };
      if (!canStand(p.x, p.z, 0.3)) p = nearestWalkable(p, 3) ?? { x: a.x, z: a.z };
    }
    this.x = p.x; this.z = p.z; this.y = heightAt(p.x, p.z);
    this.homeHeading = this.initialHeading(p);
    this.heading = this.homeHeading;
    if (def.behavior === 'jogger') this.buildRoute();
    this.object.position.set(this.x, this.y, this.z);
    this.object.rotation.y = this.heading;
  }

  private initialHeading(p: Vec2): number {
    const A = DISTRICT.anchors;
    switch (this.def.behavior) {
      case 'fisher': {
        const e = A['pier7-entrance'], end = A['pier7-end'];
        if (!e || !end) return 0;
        const ax = end.x - e.x, az = end.z - e.z, L = Math.hypot(ax, az) || 1;
        const ux = ax / L, uz = az / L;
        const vx = p.x - e.x, vz = p.z - e.z, along = vx * ux + vz * uz;
        let sx = vx - ux * along, sz = vz - uz * along;
        if (Math.hypot(sx, sz) < 0.2) { sx = -uz; sz = ux; }
        return headingFrom(sx, sz);
      }
      case 'parent':
      case 'kid': {
        const f = frameAt(stationOf(p).st);
        return headingFrom(f.nx, f.nz) + (this.def.behavior === 'kid' ? -0.5 : 0.35);
      }
      default:
        return faceWalk(p);
    }
  }

  private buildRoute() {
    const a = DISTRICT.anchors['npc-jogger-a'], b = DISTRICT.anchors['npc-jogger-b'];
    if (!a || !b) return;
    const sa = stationOf(a), sb = stationOf(b);
    const d = (sa.d + sb.d) / 2;
    const pts: Vec2[] = [];
    const n = Math.max(2, Math.ceil(Math.abs(sb.st - sa.st) / 2.5));
    for (let i = 0; i <= n; i++) {
      const st = sa.st + ((sb.st - sa.st) * i) / n;
      let p = at(st, d);
      if (!canStand(p.x, p.z, 0.35)) p = nearestWalkable(p, 4) ?? p;
      pts.push(p);
    }
    this.route = pts;
    this.routeT = 0;
  }

  /** soft obstacle for the player controller */
  obstacle(out: Obstacle[]) {
    out.push({ x: this.x, z: this.z, r: 0.42 * (this.def.scale ?? 1), kind: `npc-${this.def.behavior}` });
  }

  play(e: Emote) { this.anim.play(e); }

  update(dt: number, t: number) {
    const p = runtime.player;
    const dx = p.x - this.x, dz = p.z - this.z, d = Math.hypot(dx, dz);
    const wasNear = this.near;
    this.near = d < GREET_RADIUS;
    let face = this.homeHeading;
    let lookWeight = 0, lookYaw = 0;
    let moving = false;

    if (this.def.behavior === 'jogger' && this.route.length > 1) {
      moving = this.jog(dt, t, d);
      if (!moving && d < 7) this.heading = dampAngle(this.heading, headingFrom(dx, dz), 4, dt);
      // a friendly wave to the player when jogging past
      if (moving && d < 3 && t - this.passWaveAt > 6 && !this.anim.playing()) { this.passWaveAt = t; this.anim.play('wave', 1.1); }
      joggerState.paused = !moving || this.talking; joggerState.x = this.x; joggerState.z = this.z;
    } else {
      const toPlayer = headingFrom(dx, dz);
      if (this.talking || d < 5.5) {
        face = toPlayer;
        lookWeight = 1;
      } else if (d < 11) {
        lookYaw = wrapAngle(toPlayer - this.heading);
        lookWeight = Math.abs(lookYaw) < 1.6 ? 0.8 : 0;
      }
      this.heading = dampAngle(this.heading, face, this.talking ? 7 : 3.2, dt);
      if (lookWeight > 0) lookYaw = wrapAngle(toPlayer - this.heading);
    }

    // hello!
    if (this.near && !wasNear && t - this.greetAt > 22 && !this.talking && this.def.behavior !== 'jogger') {
      this.greetAt = t;
      this.anim.play(this.def.behavior === 'kid' ? 'hop' : 'wave');
    }
    // signature idles
    if (!this.anim.playing() && t > this.nextIdleAt && !this.talking) {
      this.nextIdleAt = t + 5 + Math.random() * 6;
      const idle: Partial<Record<NpcBehavior, Emote>> = { vendor: 'work', fisher: 'reel', parent: 'point', kid: 'hop', operator: 'tap' };
      const e = idle[this.def.behavior];
      if (e && !(this.def.behavior === 'vendor' && this.near)) this.anim.play(e);
    }

    this.y = heightAt(this.x, this.z);
    const jogger = this.def.behavior === 'jogger';
    this.anim.update({
      t, dt, speed: moving ? this.speed : 0, stride: this.stride, walkSpeed: jogger ? 1.4 : 2.6, runSpeed: jogger ? 3.1 : 5,
      grounded: true, vy: 0, crouch: 0, turnRate: 0, accel: 0,
      lookYaw, lookWeight, talking: this.talking, riding: false,
    });
    const b = this.rig.bones;
    if (this.def.behavior === 'fisher' && !this.anim.playing('wave')) {
      // hold the rod out over the water, with a lazy bob
      b.armR.rotation.set(-0.95 + Math.sin(t * 1.7) * 0.05, 0, -0.05);
    }
    if (this.def.behavior === 'vendor' && !this.anim.playing()) {
      // both hands under the produce crate
      b.armL.rotation.set(-0.95 + Math.sin(t * 1.3) * 0.03, 0, -0.35);
      b.armR.rotation.set(-0.95 + Math.sin(t * 1.3) * 0.03, 0, 0.35);
    }
    this.object.position.set(this.x, this.y, this.z);
    this.object.rotation.y = this.heading;
  }

  private jog(dt: number, t: number, playerDist: number): boolean {
    // paused at a loop end: keep waiting (up to JOG_WAIT_MAX) while the player stands close or is talking to them
    if (t < this.pauseUntil || ((playerDist < 3.5 || this.talking) && t - this.pauseStart < JOG_WAIT_MAX && this.pauseStart > 0 && t - this.pauseUntil < 0.2)) {
      if (t >= this.pauseUntil) this.pauseUntil = t + 0.1;
      this.speed = 0;
      return false;
    }
    const route = this.route;
    const seg = Math.min(route.length - 2, Math.floor(this.routeT));
    const a = route[seg], b = route[seg + 1];
    const segLen = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    // slow down near the player instead of bowling them over
    const slow = playerDist < 3 ? 0.55 : 1;
    this.speed = JOG_SPEED * slow;
    this.routeT += (this.dir * this.speed * dt) / segLen;
    if (this.routeT >= route.length - 1 || this.routeT <= 0) {
      this.routeT = Math.min(route.length - 1 - 1e-4, Math.max(0, this.routeT));
      this.dir *= -1;
      this.pauseStart = t;
      this.pauseUntil = t + JOG_PAUSE;
      this.anim.play('stretch', JOG_PAUSE - 0.4);
    }
    const s2 = Math.min(route.length - 2, Math.floor(this.routeT));
    const k = this.routeT - s2;
    const p0 = route[s2], p1 = route[s2 + 1];
    const tx = (p1.x - p0.x) * this.dir, tz = (p1.z - p0.z) * this.dir, tl = Math.hypot(tx, tz) || 1;
    const nx = -tz / tl, nz = tx / tl;
    // sidestep around the player
    const px = runtime.player.x - (p0.x + (p1.x - p0.x) * k), pz = runtime.player.z - (p0.z + (p1.z - p0.z) * k);
    const ahead = (px * tx + pz * tz) / tl, lateral = px * nx + pz * nz;
    const want = ahead > -1 && ahead < 4 && Math.abs(lateral) < 1.6 ? (lateral > 0 ? -1.5 : 1.5) : 0;
    this.sidestep += (want - this.sidestep) * Math.min(1, dt * 3);
    let x = p0.x + (p1.x - p0.x) * k + nx * this.sidestep, z = p0.z + (p1.z - p0.z) * k + nz * this.sidestep;
    if (!canStand(x, z, 0.3)) { x = p0.x + (p1.x - p0.x) * k; z = p0.z + (p1.z - p0.z) * k; }
    const moved = Math.hypot(x - this.x, z - this.z);
    this.x = x; this.z = z;
    this.stride += moved / 1.1;
    this.heading = dampAngle(this.heading, headingFrom(tx, tz), 8, dt);
    return true;
  }
}
