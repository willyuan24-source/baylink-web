import * as THREE from 'three';
import { runtime } from '../core/runtime';
import { game, type WorldMode } from '../core/store';
import { canStand, heightAt, nearestWalkable } from '../core/terrain';
import type { Vec2 } from '../core/types';
import { DISTRICT, at, frameAt, stationOf } from '../data/district';
import { RESIDENTS, type ResidentIdle, type ResidentKey } from '../data/sf/residents';
import { Animator, type Emote } from './anim';
import { dampAngle, wrapAngle, type Obstacle } from './controller';
import { NPC_BONES, box, buildNpc, buildRig, type NpcLook, type Rig, type Vec3 } from './models';
import { joggerState } from './view';

/**
 * Ambient residents (DESIGN §2): market vendor, Pier 7 angler, promenade jogger, a visiting family (parent +
 * kid) and the F-line operator. Light behaviours: face the player when near, wave hello once in a while,
 * talk while their dialogue is open, and a signature idle (arranging produce, fishing, jogging the promenade,
 * pointing at the bay, ringing the bell when a streetcar leaves).
 *
 * City mode adds lane G2's six residents (data/sf/residents.ts, plan G2-7): placed at their `at` spot, hidden beyond
 * RESIDENT_HIDE u (no update, no obstacle), their bodies (actors/residentLooks.ts, its own chunk) built the first time
 * the player comes within RESIDENT_LOAD u; until then a hidden 12-triangle stand-in holds the place.
 */

export type NpcBehavior = 'vendor' | 'fisher' | 'jogger' | 'parent' | 'kid' | 'operator' | ResidentIdle;

export interface NpcDef {
  /** interactable id when the NPC can be talked to (anchor name, matches game/interactables NPC_POSTS) */
  id: string;
  look: NpcLook;
  behavior: NpcBehavior;
  anchor: string;
  /** lateral offset (u) from the anchor, along the promenade tangent */
  offset?: number;
  scale?: number;
  /**
   * Day-0 (wave 2, lane G2's city residents): an explicit world spot instead of a DISTRICT anchor (`anchor` is then
   * only a label). The district promenade helpers (offset, facing the walk) are skipped; heading defaults to 0.
   */
  at?: { x: number; z: number; heading?: number };
  /** false = never the "talking" resident (the family's kid); default true */
  talks?: boolean;
  /** lane G2's city resident: the body is actors/residentLooks.ts buildResident(key) (`look` is only a fallback label) */
  resident?: ResidentKey;
}

export const NPC_DEFS: NpcDef[] = [
  { id: 'npc-vendor', look: 'vendor', behavior: 'vendor', anchor: 'npc-vendor' },
  { id: 'npc-fisher', look: 'fisher', behavior: 'fisher', anchor: 'npc-fisher' },
  { id: 'npc-jogger', look: 'jogger', behavior: 'jogger', anchor: 'npc-jogger-a' },
  { id: 'npc-family', look: 'parent', behavior: 'parent', anchor: 'npc-family', offset: -0.55 },
  { id: 'npc-family-kid', look: 'kid', behavior: 'kid', anchor: 'npc-family', offset: 0.75, scale: 0.72, talks: false },
  { id: 'npc-streetcar', look: 'operator', behavior: 'operator', anchor: 'npc-streetcar' },
];

/** The six city residents (data/sf/residents.ts): ids `npc-<key>` = their interactables (game/cityContent.ts). */
export const CITY_NPC_DEFS: NpcDef[] = RESIDENTS.map(r => ({
  id: r.id, look: 'parent', behavior: r.idle, anchor: r.id, at: { x: r.at.x, z: r.at.z, heading: r.at.heading }, resident: r.key,
}));

/**
 * The residents the ActorSystem spawns for a world mode (lane G2 owns this file from wave 2). A def spawns when it has
 * `at` or its DISTRICT anchor exists. City mode keeps the waterfront's residents and adds the six city ones.
 */
export const npcDefsFor = (mode: WorldMode): NpcDef[] => (mode === 'city' ? [...NPC_DEFS, ...CITY_NPC_DEFS] : NPC_DEFS);

/**
 * Wave 5 (lane V, W5-V2; plan MF9 "room first"): in city mode the six waterfront residents (NPC_DEFS) are hidden beyond
 * DISTRICT_NPC_HIDE u from the player (no animation, no ground lookup, no obstacle, no blob, no draw, no shadow) and shown
 * again inside DISTRICT_NPC_SHOW. They cost ≈ 33k triangles and 6 draw calls wherever the waterfront is in view (Twin
 * Peaks looks straight at it). District mode never hides them.
 */
export const DISTRICT_NPC_HIDE = 250;
export const DISTRICT_NPC_SHOW = 235;

/** City residents: hidden beyond this distance from the player (u), shown again inside RESIDENT_SHOW. */
export const RESIDENT_HIDE = 160;
export const RESIDENT_SHOW = 150;
/** …and their bodies are built the first time the player comes this close. */
export const RESIDENT_LOAD = 220;

type LooksModule = typeof import('./residentLooks');
let looks: Promise<LooksModule> | null = null;
const loadLooks = () => (looks ??= import('./residentLooks').catch((e: unknown) => { looks = null; throw e; }));
/** a body fetch that has not answered in this long is started again (a stalled request must not hide a resident) */
const LOOKS_RETRY_MS = 8000;

/** A 12-triangle stand-in rig on the resident skeleton (hidden) until the real body is built. */
function standInRig(): Rig {
  return buildRig(NPC_BONES.map(b => ({ ...b, pos: [...b.pos] as Vec3 })), [{ geo: box(0.02, 0.02, 0.02, [0, 0.5, 0]), color: '#000000', bone: 'body' }]);
}

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
  /** the body (a city resident's changes once, from the stand-in to its built look) */
  rig: Rig;
  anim: Animator;
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
  // city residents
  /** 'gone': released with its ActorSystem (a body still loading is never built) */
  private bodyState: 'none' | 'loading' | 'ready' | 'gone' = 'none';
  private bodyAsked = 0;
  private shown = false;
  // the waterfront residents in city mode (W5-V2): hidden while the player is far away
  private readonly farHide: boolean;
  private farHidden = false;

  /** `mode`: the world the ActorSystem builds (default: the store's; city mode hides the waterfront residents when far). */
  constructor(def: NpcDef, mode: WorldMode = game.get().worldMode) {
    this.def = def;
    this.farHide = !def.resident && mode === 'city';
    this.rig = def.resident ? standInRig() : buildNpc(def.look);
    this.anim = new Animator(this.rig, 'npc');
    if (def.resident) {
      // a group the body can be swapped into (the ActorSystem adds `object` once and never looks inside)
      const group = new THREE.Group();
      group.name = `opus-resident-${def.resident}`;
      group.add(this.rig.mesh);
      group.visible = false;
      this.object = group;
    } else this.object = this.rig.mesh;
    const s = def.scale ?? 1;
    this.object.scale.setScalar(s);
    const a = def.at ?? DISTRICT.anchors[def.anchor] ?? DISTRICT.spawn;
    let p = { x: a.x, z: a.z };
    if (def.offset && !def.at) {
      const f = frameAt(stationOf(a).st);
      p = { x: a.x + f.tx * def.offset, z: a.z + f.tz * def.offset };
      if (!canStand(p.x, p.z, 0.3)) p = nearestWalkable(p, 3) ?? { x: a.x, z: a.z };
    }
    this.x = p.x; this.z = p.z; this.y = heightAt(p.x, p.z);
    this.homeHeading = def.at ? def.at.heading ?? 0 : this.initialHeading(p);
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

  /** False while a city resident is hidden (far away, or its body is not built yet) or a waterfront resident is hidden far away in city mode. */
  get visible(): boolean { return (!this.def.resident || this.shown) && !this.farHidden; }

  /** City mode, a waterfront resident: hidden beyond DISTRICT_NPC_HIDE from the player, back inside DISTRICT_NPC_SHOW. */
  private farVisible(d: number): boolean {
    const hide = this.farHidden ? d > DISTRICT_NPC_SHOW : d > DISTRICT_NPC_HIDE;
    if (hide !== this.farHidden) { this.farHidden = hide; this.object.visible = !hide; }
    return !hide;
  }

  /** soft obstacle for the player controller */
  obstacle(out: Obstacle[]) {
    if (!this.visible) return;
    out.push({ x: this.x, z: this.z, r: 0.42 * (this.def.scale ?? 1), kind: `npc-${this.def.behavior}` });
  }

  play(e: Emote) { this.anim.play(e); }

  /** City resident: build the body when first near, show it inside RESIDENT_SHOW, hide it beyond RESIDENT_HIDE. */
  private residentVisible(d: number): boolean {
    const key = this.def.resident!;
    if (this.bodyState === 'loading' && performance.now() - this.bodyAsked > LOOKS_RETRY_MS) { looks = null; this.bodyState = 'none'; }
    if (this.bodyState === 'none' && d < RESIDENT_LOAD) {
      this.bodyState = 'loading';
      this.bodyAsked = performance.now();
      loadLooks().then(m => { if (this.bodyState === 'loading') this.setBody(m.buildResident(key)); }).catch((e: unknown) => {
        if (this.bodyState === 'loading') this.bodyState = 'none';
        if (import.meta.env?.DEV) console.warn('[opus-bay residents] body', key, e);
      });
    }
    const want = this.bodyState === 'ready' && (this.shown ? d < RESIDENT_HIDE : d < RESIDENT_SHOW);
    if (want !== this.shown) { this.shown = want; this.object.visible = want; }
    return want;
  }

  /**
   * The ActorSystem is going away (it disposes the current rig's geometry and skeleton itself): a city resident's body
   * that is still loading is never built, so its fresh geometry and skeleton cannot outlive the system. (G2 review: the
   * body fetch resolved after dispose built an orphan rig; only a remount can hit it, the world mode is fixed per page.)
   */
  release() { if (this.def.resident) { this.bodyState = 'gone'; this.shown = false; this.object.visible = false; } }

  /** Swap the stand-in for the built body (same skeleton layout, so a fresh Animator picks up from rest). */
  private setBody(rig: Rig) {
    const old = this.rig;
    this.object.remove(old.mesh);
    old.mesh.geometry.dispose();
    old.mesh.skeleton.dispose();
    rig.mesh.castShadow = true;
    rig.mesh.name = `opus-resident-${this.def.resident}-body`;
    this.object.add(rig.mesh);
    this.rig = rig;
    this.anim = new Animator(rig, 'npc');
    this.bodyState = 'ready';
  }

  update(dt: number, t: number) {
    const p = runtime.player;
    const dx = p.x - this.x, dz = p.z - this.z, d = Math.hypot(dx, dz);
    // far city residents cost nothing (no animation, no ground lookup); nor do the waterfront residents far away in city mode
    if (this.def.resident && !this.residentVisible(d)) { this.talking = false; return; }
    if (this.farHide && !this.farVisible(d)) { this.talking = false; return; }
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
      const idle: Partial<Record<NpcBehavior, Emote>> = {
        vendor: 'work', fisher: 'reel', parent: 'point', kid: 'hop', operator: 'tap',
        bell: 'bell', knead: 'taste', paint: 'think', dig: 'work', spot: 'look', groove: 'tap',
      };
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
    if ((this.def.behavior === 'vendor' || this.def.behavior === 'knead') && !this.anim.playing()) {
      // both hands under the produce crate (the baker: around her loaf)
      b.armL.rotation.set(-0.95 + Math.sin(t * 1.3) * 0.03, 0, -0.35);
      b.armR.rotation.set(-0.95 + Math.sin(t * 1.3) * 0.03, 0, 0.35);
    }
    if (this.def.resident && !this.anim.playing() && !this.talking) this.residentHold(b, t);
    this.object.position.set(this.x, this.y, this.z);
    this.object.rotation.y = this.heading;
  }

  /** The city residents' held poses between idles: the brush up at the wall, the pot and the record held out. */
  private residentHold(b: Rig['bones'], t: number) {
    switch (this.def.behavior) {
      case 'paint':
        b.armR.rotation.set(-1.75 + Math.sin(t * 2.6) * 0.12, 0, 0.25 + Math.sin(t * 1.7) * 0.12);
        b.armL.rotation.set(-0.55, 0, -0.1);
        break;
      case 'dig':
        b.armL.rotation.set(-0.5 + Math.sin(t * 1.1) * 0.03, 0, -0.1);
        break;
      case 'groove':
        b.armR.rotation.set(-0.35, 0, -1.05 + Math.sin(t * 4.2) * 0.06);
        b.head.rotation.x += Math.sin(t * 4.2) * 0.06;
        break;
    }
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
