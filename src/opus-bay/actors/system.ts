import * as THREE from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import { emit, onEvent, type GameEvent } from '../core/events';
import { input, pollInput, rumble } from '../core/input';
import { runtime } from '../core/runtime';
import { game } from '../core/store';
import { MAX_GROUND_Y, canStand, heightAt, inWorld, nearestWalkable } from '../core/terrain';
import type { Vec2 } from '../core/types';
import { MODELS } from '../data/assets';
import { DISTRICT } from '../data/district';
import { bubble, nodeById, say } from '../game/flow';
import { interactableById } from '../game/interactables';
import { flow } from '../game/flowStore';
import { Animator, GLB_BAYBAY_TUNING, type Emote } from './anim';
import { PlayerController, RUN_SPEED, WALK_SPEED, dampAngle, type Obstacle } from './controller';
import { GUIDE_RUN, GUIDE_WALK, GuideMover } from './guide';
import { collectObstacles, moveBasis, residents, view } from './view';
import { CHAR_SCALE } from './dims';
import { baybayGlbUniforms, buildBaybay, buildNewcomer, rigFromGltf, rimUniforms, type Rig } from './models';
import { Npc, npcDefsFor } from './npcs';
import { DRAG_THRESHOLD } from './pointer';
import { MoveSystem } from './moveSystem';
import { bindMoveApi } from './moveApi';
import { FACADE_REACH, facadeAlongRay, frontSpot, type FacadeIntersection } from './tapTarget';
import { CharImpl, type CharHost } from './charImpl';
import { StuckHelper, type PullStart } from './stuckHelper';

/**
 * Everything the actors module puts in the scene, driven imperatively from one useFrame (Actors.tsx):
 * player + BAYBAY + residents (one skinned draw each), one instanced blob-shadow draw, the click target
 * ring, and an invisible ground picker whose raycast is an analytic height-field march (no triangles).
 * The movement system (moveSystem.ts) owns the rideable toys, the pelican glide, benches and the streetcar
 * platform; when it carries the newcomer / BAYBAY it says where to draw them.
 */

export { view } from './view';

const BLOB_DAY = new THREE.Color('#3a2816'), BLOB_NIGHT = new THREE.Color('#2e2a3a');
const BABY_EMOTES = new Set(['wave', 'point', 'hop', 'clap', 'shrug', 'think']);

function radialTexture() {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  // white alpha falloff; the material colour tints it (warm brown by day, cool violet at night)
  g.addColorStop(0, 'rgba(255,255,255,0.68)');
  g.addColorStop(0.45, 'rgba(255,255,255,0.42)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Dev-only `?glb=0` keeps the procedural BAYBAY (A/B and fallback QA). */
function glbDisabled(): boolean {
  if (!import.meta.env.DEV || typeof location === 'undefined') return false;
  try { return new URLSearchParams(location.search).get('glb') === '0'; } catch { return false; }
}

/** residents and parked rides cast a real shadow within this of the camera (u; C2 part b request 1) */
const ACTOR_SHADOW_R = 40;
/** W5-F8: city mode draws a parked ride only within this of the camera (u) */
export const FAR_RIDE = 250;
const frustum = new THREE.Frustum();
const tmpPM = new THREE.Matrix4();
const tmpSphere = new THREE.Sphere();

const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpV = new THREE.Vector3();
const tmpS = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const tmpN = new THREE.Vector3();

function groundNormal(x: number, z: number, out: THREE.Vector3) {
  const e = 0.35;
  const hx = heightAt(x + e, z) - heightAt(x - e, z), hz = heightAt(x, z + e) - heightAt(x, z - e);
  return out.set(-hx / (2 * e), 1, -hz / (2 * e)).normalize();
}

/** Ray parameter of the first terrain hit along the ray (a height-field march), or −1. */
function groundAlongRay(o: THREE.Vector3, d: THREE.Vector3, far: number): number {
  if (d.y > -1e-3) return -1;
  const top = MAX_GROUND_Y;
  let t = o.y > top ? (top - o.y) / d.y : 0;
  const tMax = Math.min(far, t + 1400);
  let prevT = t;
  for (let i = 0; i < 900 && t <= tMax; i++) {
    const x = o.x + d.x * t, y = o.y + d.y * t, z = o.z + d.z * t;
    if (y < -6) return -1;
    const inside = inWorld(x, z);
    const h = inside ? heightAt(x, z) : 0;
    const diff = y - h;
    if (inside && diff <= 0) {
      let lo = prevT, hi = t;
      for (let k = 0; k < 10; k++) {
        const mid = (lo + hi) / 2;
        const mx = o.x + d.x * mid, mz = o.z + d.z * mid, my = o.y + d.y * mid;
        if (my - heightAt(mx, mz) > 0) lo = mid; else hi = mid;
      }
      return (lo + hi) / 2;
    }
    prevT = t;
    t += Math.max(0.25, diff * 0.55);
  }
  return -1;
}

/**
 * Wave 5 (W5-F2) · the player's tap body: a vertical capsule round the drawn newcomer (view.x / y / z), radius and
 * height in world units (CHAR_SCALE applied). A ray that meets it before the ground is a self-tap (lane A's emote wheel).
 */
export const SELF_TAP = { r: 0.55, h: 1.6 } as const;
/** set by the actor system each frame: the player's body can be tapped (on foot, playing, nothing open) */
const selfTap = { on: false };

/** Ray parameter where the ray meets the capsule of radius r from (x, y0, z) up to y0 + h, or −1. */
export function rayCapsuleT(o: { x: number; y: number; z: number }, d: { x: number; y: number; z: number }, x: number, y0: number, z: number, r: number, h: number): number {
  // closest approach of the ray to the capsule's axis segment, sampled along the segment (the capsule is small)
  let best = -1;
  for (let k = 0; k <= 8; k++) {
    const cy = y0 + r + ((h - 2 * r) * k) / 8;
    // ray vs sphere (x, cy, z) radius r
    const ox = o.x - x, oy = o.y - cy, oz = o.z - z;
    const b = ox * d.x + oy * d.y + oz * d.z, c = ox * ox + oy * oy + oz * oz - r * r;
    const disc = b * b - c;
    if (disc < 0) continue;
    const t = -b - Math.sqrt(disc);
    if (t >= 0 && (best < 0 || t < best)) best = t;
  }
  return best;
}

/**
 * The self-tap body's raycast (its own invisible mesh, Actors.tsx). The hit is reported SELF_TAP_LEAD u nearer than it
 * is, so the player's body wins over the invisible interactable spheres round the spot they stand on (a gold ring, the
 * ferry gate): under the finger the player is what shows.
 */
const SELF_TAP_LEAD = 4;
function selfTapRaycast(this: THREE.Mesh, raycaster: THREE.Raycaster, intersects: THREE.Intersection[]) {
  if (!selfTap.on || !view.ready) return;
  const o = raycaster.ray.origin, d = raycaster.ray.direction;
  const t = rayCapsuleT(o, d, view.x, view.y, view.z, SELF_TAP.r * CHAR_SCALE, SELF_TAP.h * CHAR_SCALE);
  if (t < 0 || t > raycaster.far) return;
  intersects.push({ distance: Math.max(raycaster.near, t - SELF_TAP_LEAD), point: new THREE.Vector3(o.x + d.x * t, o.y + d.y * t, o.z + d.z * t), object: this });
}

/** The point the occlusion dither fades around (world/world.ts sets uPlayer from the same place). */
const seenPlayer = () => ({ x: runtime.player.x, y: runtime.player.y + 0.8, z: runtime.player.z });

/**
 * Ray-march the terrain height field (clicks / taps): exact, zero triangles. In city mode the ray also stops at the
 * first building wall in front of the ground (M2, actors/tapTarget): that hit carries `facade`.
 */
function heightfieldRaycast(this: THREE.Mesh, raycaster: THREE.Raycaster, intersects: THREE.Intersection[]) {
  const o = raycaster.ray.origin, d = raycaster.ray.direction;
  const hitT = groundAlongRay(o, d, raycaster.far);
  const hl = Math.hypot(d.x, d.z);
  const wall = hl > 1e-4 ? facadeAlongRay(o, d, Math.min(hitT >= 0 ? hitT : Infinity, FACADE_REACH / hl, raycaster.far), seenPlayer()) : null;
  if (wall && wall.t >= raycaster.near) {
    const hit: FacadeIntersection = { distance: wall.t, point: new THREE.Vector3(wall.x, wall.y, wall.z), object: this, facade: wall };
    intersects.push(hit);
    return;
  }
  if (hitT < 0 || hitT < raycaster.near || hitT > raycaster.far) return;
  intersects.push({ distance: hitT, point: new THREE.Vector3(o.x + d.x * hitT, o.y + d.y * hitT, o.z + d.z * hitT), object: this });
}

class TargetRing {
  readonly mesh: THREE.Mesh;
  private material: THREE.MeshBasicMaterial;
  private age = 99;
  private fail = false;
  private shown = 0;
  private target: Vec2 | null = null;
  /** arrival: the ring collapses into its dot (A11) */
  private arriveAge = -1;
  constructor() {
    const ring = new THREE.RingGeometry(0.42, 0.58, 40);
    const dot = new THREE.CircleGeometry(0.13, 20);
    const g = new THREE.BufferGeometry();
    const merged = [ring, dot];
    const pos: number[] = [];
    for (const m of merged) {
      const src = m.toNonIndexed();
      pos.push(...(src.attributes.position.array as Float32Array));
      src.dispose();
      m.dispose();
    }
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.rotateX(-Math.PI / 2);
    this.material = new THREE.MeshBasicMaterial({ color: '#fffaf1', transparent: true, opacity: 0, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(g, this.material);
    this.mesh.renderOrder = 6;
    this.mesh.visible = false;
    this.mesh.frustumCulled = false;
  }
  show(p: Vec2, fail = false) {
    this.target = { x: p.x, z: p.z };
    this.age = 0;
    this.fail = fail;
    this.arriveAge = -1;
    this.material.color.set(fail ? '#d8744a' : '#fffaf1');
  }
  /** The walk reached its target: collapse the ring (0.35 s). */
  arrive() { if (this.target && !this.fail) { this.arriveAge = 0; } }
  /** where the ring is (null when hidden) */
  get current(): Vec2 | null { return this.target; }
  update(dt: number, t: number, pathTarget: Vec2 | null) {
    this.age += dt;
    if (this.arriveAge >= 0 && this.target) {
      this.arriveAge += dt;
      const k = Math.min(1, this.arriveAge / 0.35);
      if (k >= 1 || pathTarget) { this.arriveAge = -1; if (!pathTarget) { this.mesh.visible = false; this.target = null; this.shown = 0; return; } }
      else {
        const p = this.target;
        this.mesh.visible = true;
        this.mesh.position.set(p.x, Math.max(heightAt(p.x, p.z), DISTRICT.waterLevel ?? -0.6) + 0.06, p.z);
        this.mesh.scale.setScalar(Math.max(0.05, 1 - k * k));
        this.material.opacity = 0.9 * (1 - k * 0.6);
        return;
      }
    }
    const alive = this.target && (this.fail ? this.age < 0.7 : !!pathTarget);
    if (pathTarget && !this.fail && (!this.target || Math.hypot(pathTarget.x - this.target.x, pathTarget.z - this.target.z) > 0.8)) this.show(pathTarget);
    this.shown += ((alive ? 1 : 0) - this.shown) * Math.min(1, dt * (alive ? 14 : 6));
    if (this.shown < 0.02 || !this.target) { this.mesh.visible = false; if (!alive) this.target = null; return; }
    const p = this.target;
    const y = Math.max(heightAt(p.x, p.z), DISTRICT.waterLevel ?? -0.6) + 0.06; // a failed click on the water shows on its surface
    const pop = this.age < 0.35 ? 1 + Math.sin((this.age / 0.35) * Math.PI) * 0.35 : 1 + Math.sin(t * 4) * 0.06;
    const shake = this.fail ? Math.sin(this.age * 40) * 0.12 * (1 - this.age / 0.7) : 0;
    this.mesh.visible = true;
    this.mesh.position.set(p.x + shake, y, p.z);
    this.mesh.quaternion.setFromUnitVectors(UP, groundNormal(p.x, p.z, tmpN));
    this.mesh.scale.setScalar(pop * (0.6 + 0.4 * this.shown) * (this.fail ? 1.6 : 1));
    this.material.opacity = 0.9 * this.shown;
  }
  dispose() { this.mesh.geometry.dispose(); this.material.dispose(); }
}

/** The first `maxLen` u of a polyline after its start (breadcrumbs of a drive route). */
function crumbsAhead(pts: Vec2[], maxLen: number): Vec2[] {
  const out: Vec2[] = [];
  let acc = 0;
  for (let i = 1; i < pts.length && acc < maxLen; i++) { acc += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z); out.push(pts[i]); }
  return out;
}

/**
 * 6–8 fading dots along a long click-to-walk route (A11); up to 14 along the first 140 u of a city walking / drive
 * route (lane E2 wave 2). One instanced draw, hidden when idle.
 */
class Breadcrumbs {
  static readonly N = 8;
  /** capacity: long city routes lay more dots */
  static readonly MAX = 14;
  readonly mesh: THREE.InstancedMesh;
  private pts: THREE.Vector3[] = [];
  private startT = -10;
  /** how long one trace shows (s) and the pop-in stagger between dots */
  private life = 1.2;
  private stagger = 0.05;
  constructor() {
    const g = new THREE.CircleGeometry(0.2, 14).rotateX(-Math.PI / 2);
    const m = new THREE.MeshBasicMaterial({ color: '#fffaf1', transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false });
    this.mesh = new THREE.InstancedMesh(g, m, Breadcrumbs.MAX);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 6;
    this.mesh.visible = false;
    this.mesh.count = 0;
  }
  /** Lay dots along from → path when the route is long enough (> 18 u). `max` dots (long city routes: more, slower). */
  trace(from: Vec2, path: Vec2[], t: number, max = Breadcrumbs.N) {
    const pts = [from, ...path];
    let total = 0;
    for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
    if (total < 18) return;
    const n = Math.min(max, Breadcrumbs.MAX, Math.max(6, Math.round(total / 8)));
    this.life = max > Breadcrumbs.N ? 2.2 : 1.2;
    this.stagger = max > Breadcrumbs.N ? 0.07 : 0.05;
    this.pts = [];
    for (let k = 1; k <= n; k++) {
      let want = (total * k) / (n + 1), i = 1;
      for (; i < pts.length; i++) {
        const seg = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
        if (want <= seg) { const f = want / (seg || 1); const x = pts[i - 1].x + (pts[i].x - pts[i - 1].x) * f, z = pts[i - 1].z + (pts[i].z - pts[i - 1].z) * f; this.pts.push(new THREE.Vector3(x, heightAt(x, z) + 0.05, z)); break; }
        want -= seg;
      }
    }
    this.startT = t;
  }
  update(t: number) {
    const age = t - this.startT;
    if (age > this.life || !this.pts.length) { if (this.mesh.visible) { this.mesh.visible = false; this.mesh.count = 0; } return; }
    this.mesh.visible = true;
    let i = 0;
    for (const [k, p] of this.pts.entries()) {
      // dots pop in one after another (0.05 s apart; long routes 0.07) and fade over the last 0.5 s
      const local = age - k * this.stagger;
      const s = local < 0 ? 0 : Math.min(1, local / 0.12) * (1 - Math.max(0, (age - (this.life - 0.5)) / 0.5));
      tmpM.compose(p, tmpQ.identity(), tmpS.set(s, 1, s));
      this.mesh.setMatrixAt(i++, tmpM);
    }
    this.mesh.count = i;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
  dispose() { this.mesh.geometry.dispose(); (this.mesh.material as THREE.Material).dispose(); }
}

export class ActorSystem {
  readonly root = new THREE.Group();
  readonly pick: THREE.Mesh;
  /** wave 5 (W5-F2): the player's tap body (a capsule raycast, nothing drawn) */
  readonly selfPick: THREE.Mesh;
  readonly controller = new PlayerController();
  readonly mover = new GuideMover();
  readonly player: Rig;
  /** BAYBAY: procedural at first, swapped for the rigged GLB once it has loaded (A4) */
  guide: Rig;
  /** what is placed in the world for BAYBAY (the procedural SkinnedMesh, or the GLB scene holding mesh + bones) */
  guideObject: THREE.Object3D;
  readonly playerAnim: Animator;
  guideAnim: Animator;
  /** 'procedural' | 'loading' | 'ready' (loaded, waiting for an unseen moment) | 'glb' | 'failed' */
  guideModel: 'procedural' | 'loading' | 'ready' | 'glb' | 'failed' = 'procedural';
  private glbPending: { rig: Rig; object: THREE.Object3D } | null = null;
  private lastDialogueNode: string | null = null;
  readonly npcs: Npc[];
  private blobs: THREE.InstancedMesh;
  private blobTex: THREE.Texture;
  private ring = new TargetRing();
  private crumbs = new Breadcrumbs();
  private prevPathTarget: Vec2 | null = null;
  private seenPlan = 0;
  private seenFail = -10;
  private seenDrive = { routes: 0, arrivals: 0, fails: 0 };
  private lastClick = { t: -10, x: 0, z: 0 };
  private unsub: () => void;
  private obstacles: Obstacle[] = [];
  private lastLand = -10;
  private lastJump = -10;
  private lastGuideEmote = 'none';
  private guideTalkUntil = 0;
  private playerTalkUntil = 0;
  private npcTalkUntil = 0;
  private talkingNpc: string | null = null;
  /** spawned residents that can talk (derived from the defs, see the constructor) */
  private readonly talking: Set<string>;
  private lastBubbleKey = -1;
  private photoPose = false;
  private guidePhotoWaveAt = 0;
  private now = 0;
  private camPos = new THREE.Vector3();
  /**
   * Within ACTOR_SHADOW_R of the camera (horizontal): residents and parked rides draw into the shadow map only there
   * (C2's part b request 1: at the Ferry gate the actors cast 35k shadow triangles in 7 draws, two residents 42–44 u
   * off among them; their blob shadows stay).
   */
  private nearCamera(x: number, z: number): boolean {
    const dx = x - this.camPos.x, dz = z - this.camPos.z;
    return dx * dx + dz * dz < ACTOR_SHADOW_R * ACTOR_SHADOW_R;
  }
  /** (x, z) within r of the camera, horizontally (W5-F8) */
  private withinCamera(x: number, z: number, r: number): boolean {
    const dx = x - this.camPos.x, dz = z - this.camPos.z;
    return dx * dx + dz * dz < r * r;
  }
  /**
   * castShadow on / off; a skinned caster turned on takes the player's shadow-depth material (C2's kindSweep gives
   * casters their kind's one once a second and skips those not casting: before it, three drew the caster with its own
   * depth material and linked a skinned depth program on its first shadowed frame — P5; that was the "+1 program on the
   * first city glide": a pooled city bike, E2-12)
   */
  private castNear(mesh: THREE.Mesh, on: boolean) {
    mesh.castShadow = on;
    if (on && !mesh.customDepthMaterial && (mesh as THREE.SkinnedMesh).isSkinnedMesh) {
      const depth = this.player.mesh.customDepthMaterial;
      if (depth) mesh.customDepthMaterial = depth;
    }
  }
  /** vehicles, glide, benches, the streetcar platform */
  readonly move = new MoveSystem();
  /** wave 5 (W5-F2): the charApi implementation over these bodies (Actors.tsx registers it) */
  readonly char: CharImpl;
  private lastSelfTap = -10;
  private seenPant = -10;
  /** wave 5 (W5-F5): BAYBAY's pull for a player stuck on something unseen (QA: `__opusBay.actors.feet.pulls`) */
  readonly feet = new StuckHelper();
  private feetReset = input.resetCount;
  private feetPhase: StuckHelper['phase'] = 'idle';
  // A9 · idle life
  private idleT = 0;
  private idleStage = 0;
  private seaLionAt = -100;
  private guideIdleT = 0;
  private nextGroomAt = 14;

  constructor() {
    this.player = buildNewcomer();
    this.guide = buildBaybay();
    this.playerAnim = new Animator(this.player, 'newcomer');
    this.guideAnim = new Animator(this.guide, 'baybay');
    this.guideObject = this.guide.mesh;
    this.player.mesh.castShadow = true;
    this.guide.mesh.castShadow = true;
    // C2: both hero rigs read a little bigger in the new camera
    this.player.mesh.scale.setScalar(CHAR_SCALE);
    this.guide.mesh.scale.setScalar(CHAR_SCALE);
    this.player.mesh.name = 'opus-player';
    this.guide.mesh.name = 'opus-baybay';
    this.root.add(this.player.mesh, this.guide.mesh);
    // residents: the world mode's defs (actors/npcs.ts npcDefsFor, lane G2), placed at `at` or their DISTRICT anchor
    this.npcs = npcDefsFor(game.get().worldMode).filter(def => !!def.at || !!DISTRICT.anchors[def.anchor]).map(def => new Npc(def));
    for (const npc of this.npcs) { npc.rig.mesh.castShadow = true; this.root.add(npc.object); }
    // who can be "the resident you are talking to" (district: vendor, fisher, family, operator, jogger)
    this.talking = new Set(this.npcs.filter(n => n.def.talks !== false).map(n => n.def.id));
    bindMoveApi(this.move);

    this.blobTex = radialTexture();
    const blobGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    const blobMat = new THREE.MeshBasicMaterial({ map: this.blobTex, color: BLOB_DAY, transparent: true, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    this.blobs = new THREE.InstancedMesh(blobGeo, blobMat, 2 + this.npcs.length);
    this.blobs.frustumCulled = false;
    this.blobs.renderOrder = 1;
    this.root.add(this.blobs, this.ring.mesh, this.crumbs.mesh, this.move.root);

    const pickGeo = new THREE.BufferGeometry();
    pickGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0, 0, 0, 0], 3));
    this.pick = new THREE.Mesh(pickGeo, new THREE.MeshBasicMaterial({ visible: false }));
    this.pick.raycast = heightfieldRaycast;
    this.pick.frustumCulled = false;
    this.pick.name = 'opus-ground-pick';
    this.selfPick = new THREE.Mesh(pickGeo, this.pick.material);
    this.selfPick.raycast = selfTapRaycast;
    this.selfPick.frustumCulled = false;
    this.selfPick.name = 'opus-self-pick';

    this.unsub = onEvent(e => this.onGameEvent(e));
    this.mover.place();
    this.char = new CharImpl(this.charHost());
  }

  private charHost(): CharHost {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const sys = this;
    return {
      get player() { return sys.player; },
      get guide() { return sys.guide; },
      get playerAnim() { return sys.playerAnim; },
      get guideAnim() { return sys.guideAnim; },
      guideIsGlb: () => sys.guideModel === 'glb',
      playerFree: () => sys.move.mode === 'foot' && !sys.move.carried && game.get().riding === null,
      guideFree: () => !sys.move.guideCarried && !sys.move.guide.active,
      playerMoving: () => runtime.player.moving || input.manualMove || !!runtime.player.pathTarget || !sys.controller.grounded,
      guideMoving: () => sys.mover.animSpeed > 0.6,
      placePlayer: (x, z, heading) => {
        const p = runtime.player;
        p.x = x; p.z = z; p.heading = heading; p.pathTarget = null; p.pendingInteract = null;
        sys.controller.sync();
      },
      rides: () => sys.move.fleet.rides,
      pelican: () => sys.move.pelican.rig,
    };
  }

  // ---------------------------------------------------------------------------

  private onGameEvent(e: GameEvent) {
    const pa = this.playerAnim;
    // (QA: the last movement events, readable as __opusBay.actors.move.recent)
    if (e.type.includes(':') || e.type === 'sit' || e.type === 'stand' || e.type === 'hill' || e.type === 'pant' || e.type === 'self-tap') {
      this.move.recent.push({ t: +this.now.toFixed(2), ...e });
      if (this.move.recent.length > 24) this.move.recent.shift();
    }
    switch (e.type) {
      case 'interact': {
        // bikes / the toy car / benches are the movement system's (game/interactables registers them as 'info')
        if (e.id.startsWith('ride:') || e.id.startsWith('seat:')) { this.move.onInteract(e.id, this.controller); break; }
        const map: Partial<Record<string, Emote>> = { bell: 'bell', taste: 'taste', telescope: 'look', viewpoint: 'look', board: 'reach', fish: 'reach', info: 'reach' };
        const em = map[e.kind];
        if (em) pa.play(em);
        if (this.talking.has(e.id)) this.talkingNpc = e.id;
        break;
      }
      case 'emote':
        if (e.who === 'player') {
          const m: Partial<Record<string, Emote>> = { taste: 'taste', cast: 'reach', wave: 'wave', cheer: 'cheer', hop: 'cheer', clap: 'clap' };
          const em = m[e.emote];
          if (em) pa.play(em);
        } else if (e.who === 'baybay' && BABY_EMOTES.has(e.emote)) {
          // (W4-G4, part b) a gesture sent as an event alone (BAYBAY pointing at a turn from the bike basket) plays now,
          // even when it repeats; one also written to runtime.guide.emote plays through the update's change check
          if (!(runtime.guide.emote === e.emote && this.lastGuideEmote !== e.emote)) this.guideAnim.play(e.emote as Emote);
        }
        break;
      case 'guide-call': pa.play('call'); break;
      // (E2-11: a short rumble on the pad in use)
      case 'vehicle:bump': if (e.hard) rumble(0.35, 0.7, 140); break;
      case 'glide:land': rumble(0.5, 0.25, 180); break;
      case 'postcard': pa.play('pickup'); break;
      case 'goal': if (!pa.playing('pickup')) pa.play('cheer'); break;
      case 'sea-lion': this.seaLionAt = this.now; break;
      case 'streetcar-bell':
        for (const npc of this.npcs) if (npc.def.behavior === 'operator' && Math.hypot(npc.x - runtime.player.x, npc.z - runtime.player.z) < 45) npc.play('bell');
        break;
      case 'dialogue': {
        const node = nodeById(e.nodeId);
        const len = node ? node.text.zh.length : 12;
        const dur = Math.min(4.2, Math.max(0.9, len * 0.085));
        if (e.speaker === 'baybay') this.guideTalkUntil = this.now + dur;
        else if (e.speaker === 'player') this.playerTalkUntil = this.now + dur;
        else if (e.speaker === 'npc') {
          this.npcTalkUntil = this.now + dur;
          if (!this.talkingNpc) this.talkingNpc = this.nearestNpcId();
        }
        break;
      }
    }
  }

  /** the resident nearest the player within 7 u (never a far-away one: the camera two-shot would swing there) */
  private nearestNpcId(): string | null {
    let best: string | null = null, bestD = 7;
    for (const npc of this.npcs) {
      const d = Math.hypot(npc.x - runtime.player.x, npc.z - runtime.player.z);
      if (d < bestD) { bestD = d; best = npc.def.id; }
    }
    return best;
  }

  /**
   * Wave 5 (W5-F2) · R3F onClick on the player's tap body: a tap on your own character is a self-tap (lane A: the
   * emote wheel; a second tap within 0.38 s is a double), never a walk. Only while the body is tappable (selfTap.on:
   * playing, on foot, nothing open); otherwise the tap goes on to whatever is behind.
   */
  onSelfClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > DRAG_THRESHOLD || !selfTap.on) return;
    if ((e.nativeEvent as MouseEvent).button !== undefined && (e.nativeEvent as MouseEvent).button !== 0) return;
    const s = game.get(), f = flow.get();
    if (s.phase !== 'playing' || s.photoMode || s.dialogue.nodeId || f.cinematic || f.fishing || f.postcardReward || runtime.player.locked) return;
    e.stopPropagation();
    const now = performance.now() / 1000, double = now - this.lastSelfTap < 0.38;
    this.lastSelfTap = double ? -10 : now;
    emit({ type: 'self-tap', who: 'player', double });
  };

  /** R3F onClick on the ground picker: tap / click to walk; on a bike or in the toy car, tap to drive (E2-4). */
  onGroundClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > DRAG_THRESHOLD) return;
    if ((e.nativeEvent as MouseEvent).button !== undefined && (e.nativeEvent as MouseEvent).button !== 0) return;
    const s = game.get(), f = flow.get();
    const driving = this.move.mode === 'bike' || this.move.mode === 'car';
    if (s.phase !== 'playing' || s.photoMode || s.riding || (this.move.carried && !driving) || s.dialogue.nodeId || f.cinematic || f.fishing || f.postcardReward || runtime.player.locked) return;
    e.stopPropagation();
    // M2 (city): a tap on a building wall means "go there": the nearest open ground in front of it
    const wall = (e as unknown as FacadeIntersection).facade;
    const front = wall ? frontSpot(wall.x, wall.z, wall.ux, wall.uz) : null;
    if (wall && !front) { const at = { x: wall.x, z: wall.z }; this.ring.show(at, true); emit({ type: 'ui', action: 'error' }); return; }
    if (driving) {
      const at = front ?? { x: e.point.x, z: e.point.z };
      if (this.move.driveTo(at)) this.ring.show(at); else { this.ring.show(at, true); emit({ type: 'ui', action: 'error' }); }
      return;
    }
    let target: Vec2 = front ?? { x: e.point.x, z: e.point.z };
    if (!canStand(target.x, target.z, 0.4)) {
      const alt = nearestWalkable(target, 7);
      if (!alt) { this.ring.show(target, true); emit({ type: 'ui', action: 'error' }); return; }
      target = alt;
    }
    runtime.player.pendingInteract = null;
    // double-click / double-tap on (about) the same spot: run there
    const again = performance.now() / 1000 - this.lastClick.t < 0.38 && Math.hypot(target.x - this.lastClick.x, target.z - this.lastClick.z) < 3;
    this.lastClick = { t: performance.now() / 1000, x: target.x, z: target.z };
    runtime.player.pathTarget = target;
    this.controller.forceRun = again;
    this.ring.show(target);
  };

  // ---------------------------------------------------------------------------

  /** W5-F5: stage BAYBAY's pull — she runs over (or hops in when far / out of view) and says 嘿咻！ */
  private stagePull(pull: PullStart) {
    const move = this.move;
    if (!move.guideCarried && !move.guide.active) this.mover.dash(pull.baybay, pull.rush, this.guideSeen);
    bubble({ zh: '嘿咻！', en: 'Heave-ho!' }, 1800);
  }

  /** QA (`__opusBay.actors.qaScreen('baybay')`): where a hero's middle shows, in normalised device coordinates (−1..1) */
  qaScreen(who: 'player' | 'baybay'): { x: number; y: number } | null {
    const cam = this.lastCamera;
    if (!cam) return null;
    const o = who === 'player' ? this.player.mesh : this.guideObject;
    const v = o.getWorldPosition(new THREE.Vector3());
    v.y += 0.7 * CHAR_SCALE;
    v.project(cam);
    return { x: v.x, y: v.y };
  }
  private lastCamera: THREE.Camera | null = null;

  update(rawDt: number, t: number, camera: THREE.Camera) {
    const dt = Math.min(rawDt, 0.1);
    this.now = t;
    this.lastCamera = camera;
    camera.getWorldPosition(this.camPos);
    const s = game.get(), f = flow.get();
    const p = runtime.player, g = runtime.guide;

    pollInput();

    const riding = s.riding === 'streetcar';
    const frozen = p.locked || s.phase !== 'playing' || s.photoMode || !!s.dialogue.nodeId || !!f.fishing || !!f.postcardReward || !!f.cinematic;
    // flow locks the player during a streetcar ride; the movement system still lets the rider switch spots there
    const flowFrozen = s.phase !== 'playing' || s.photoMode || !!s.dialogue.nodeId || !!f.fishing || !!f.postcardReward || !!f.cinematic;
    // is BAYBAY / a vehicle in the camera frustum (last frame's matrices)? — hop-in (A6), the unseen GLB swap (A4), bikes going home
    tmpPM.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(tmpPM);

    // vehicles / glide / bench / streetcar platform first: they consume their own input edges and carry the body
    const move = this.move;
    move.update(dt, t, { cameraYaw: moveBasis.yaw, frozen: flowFrozen, playing: s.phase === 'playing', controller: this.controller, frustum, precompile: this.precompile ?? undefined });
    // parked rides cast a real shadow only near the camera (C2 part b request 1; the one you ride always does); W5-F8:
    // in city mode a parked ride more than FAR_RIDE from the camera is not drawn at all (the district's bikes and toy car
    // seen from the rest of the city: −10 calls, −15.6k triangles at Twin Peaks); district mode unchanged
    const cityMode = s.worldMode === 'city';
    for (const r of move.fleet.rides) {
      const mine = r === move.ride || r.occupied || !!r.call;
      r.rig.mesh.visible = !cityMode || mine || this.withinCamera(r.sim.x, r.sim.z, FAR_RIDE);
      this.castNear(r.rig.mesh, mine || this.nearCamera(r.sim.x, r.sim.z));
    }
    const carried = move.carried || riding;

    // soft obstacles for the player
    this.obstacles.length = 0;
    for (const npc of this.npcs) npc.obstacle(this.obstacles);
    if (s.phase === 'playing' && !carried && !move.guideCarried) this.obstacles.push({ x: g.x, z: g.z, r: 0.42, kind: 'baybay' });
    // parked bikes / the toy car are solid to the walker (soft obstacles, like the residents)
    for (const r of move.fleet.rides) {
      if (r.occupied || Math.abs(r.sim.x - p.x) > 8 || Math.abs(r.sim.z - p.z) > 8) continue;
      this.obstacles.push({ x: r.sim.x, z: r.sim.z, r: r.kind === 'car' ? 0.8 : 0.45, kind: r.kind === 'car' ? 'car' : 'bike-rack' });
    }
    // other lanes' moving things (F's crowd and traffic, actors/view.ts registerObstacleSource)
    collectObstacles(this.obstacles, p.x, p.z, 8);

    // W5-F5: BAYBAY's pull (a push that gets nowhere for 1.2 s, or R with the feet boxed in); the feet wait while it runs
    const pc0 = this.controller;
    const resetPress = input.resetCount !== this.feetReset;
    this.feetReset = input.resetCount;
    const pull = this.feet.update({
      dt, now: t, reset: resetPress, obstacles: this.obstacles,
      free: s.phase === 'playing' && !carried && move.mode === 'foot' && !frozen && pc0.grounded && !pc0.vault && !pc0.mantle && !p.pathTarget,
      pushing: pc0.manualWish && input.manualMove, dirX: pc0.wishX, dirZ: pc0.wishZ,
    });
    if (pull) this.stagePull(pull);
    const pulling = this.feet.active;
    this.controller.step({ dt, now: t, cameraYaw: moveBasis.yaw, frozen: frozen || pulling, riding: carried, obstacles: this.obstacles });
    if (pulling) p.y += this.feet.lift();
    if (this.feet.phase !== this.feetPhase) {
      // her paws out while she pulls, a happy hop when you are through
      if (this.feet.phase === 'pull' && !move.guideCarried && !move.guide.active) this.guideAnim.play('reach', 0.7);
      else if (this.feet.phase === 'idle' && this.feetPhase === 'pull') { this.playerAnim.land(0.35); if (!move.guideCarried && !move.guide.active) this.guideAnim.play('hop'); }
      this.feetPhase = this.feet.phase;
    }
    move.finishPlayer();
    // wave 5 (W5-F2): emote loops end on a move; the ridden bike wears its paint; the body can be tapped when free
    this.char.update(dt);
    selfTap.on = s.phase === 'playing' && !carried && move.mode === 'foot' && !frozen && !s.photoMode;
    this.guideSeen = frustum.intersectsSphere(tmpSphere.set(tmpV.set(g.x, g.y + 0.75, g.z), 1.1));
    const guideHeld = move.guideCarried || (carried && move.mode !== 'sit');
    this.mover.step(dt, t, { playing: s.phase === 'playing', riding: riding || guideHeld, visible: this.guideSeen });
    if (move.guide.active) { g.x = move.guide.x; g.y = move.guide.y; g.z = move.guide.z; }
    // (W5 lane A's request 2) posing in photo mode, BAYBAY turns her whole body to the camera (a selfie, not side-on)
    else if (s.photoMode && this.guideAnim.playing('pose')) g.heading = dampAngle(g.heading, Math.atan2(this.camPos.x - g.x, this.camPos.z - g.z), 6, dt);
    move.syncRideables();

    // --- player facing while talking / posing
    const pc = this.controller;
    const inDialogue = !!s.dialogue.nodeId;
    if (!p.moving && !carried) {
      if (s.photoMode) {
        p.heading = dampAngle(p.heading, Math.atan2(this.camPos.x - p.x, this.camPos.z - p.z), 5, dt);
      } else if (inDialogue) {
        const npc = this.talkingNpc ? this.npcs.find(n => n.def.id === this.talkingNpc) : undefined;
        const node = nodeById(s.dialogue.nodeId);
        const tx = node?.speaker === 'npc' && npc ? npc.x : g.x, tz = node?.speaker === 'npc' && npc ? npc.z : g.z;
        if (Math.hypot(tx - p.x, tz - p.z) < 9) p.heading = dampAngle(p.heading, Math.atan2(tx - p.x, tz - p.z), 5, dt);
      }
    }

    // --- visual placement (the movement system carries the rider on a bike / car / pelican / bench / streetcar)
    let vx = p.x, vy = p.y, vz = p.z;
    const vh = p.heading;
    const R = move.rider;
    if (R.active) {
      vx = R.x; vy = R.y; vz = R.z;
      this.player.mesh.position.set(vx, vy, vz);
      this.player.mesh.quaternion.copy(R.quat);
    } else {
      this.player.mesh.position.set(vx, vy, vz);
      this.player.mesh.rotation.set(0, vh, 0);
    }
    const onDeck = move.mode === 'transit' || move.mode === 'sit';
    view.x = vx; view.y = vy; view.z = vz; view.ground = R.active && onDeck ? vy : heightAt(p.x, p.z);
    const vv = move.ride && carried ? runtime.vehicle.speed : 0;
    view.vx = carried ? vv * Math.sin(vh) : pc.vx;
    view.vz = carried ? vv * Math.cos(vh) : pc.vz;
    view.heading = vh; view.ready = true;

    // --- player animation
    if (pc.landedAt !== this.lastLand) { this.lastLand = pc.landedAt; this.playerAnim.land(pc.landImpact); }
    if (pc.jumpedAt !== this.lastJump) { this.lastJump = pc.jumpedAt; this.playerAnim.jump(); }
    if (move.landing > 0) this.playerAnim.land(move.landing);
    if (pc.pantAt !== this.seenPant) { this.seenPant = pc.pantAt; if (!carried && !this.playerAnim.playing()) this.playerAnim.play('pant'); }
    if (s.photoMode && !this.photoPose) { this.photoPose = true; this.playerAnim.play('pose'); }
    if (!s.photoMode && this.photoPose) { this.photoPose = false; this.playerAnim.stop(); }
    const guideNode = inDialogue ? nodeById(s.dialogue.nodeId) : undefined;
    const look = this.playerLook(dt, frozen, carried, inDialogue);
    const RA = move.riderAnim;
    const deckWalk = move.mode === 'transit' && RA.speed > 0.05;
    this.playerAnim.update({
      t, dt, speed: carried ? RA.speed : p.speed, stride: deckWalk ? RA.stride : pc.stride, walkSpeed: deckWalk ? 2.4 : WALK_SPEED, runSpeed: RUN_SPEED,
      grounded: carried ? true : pc.grounded, vy: carried ? 0 : pc.vy, crouch: pc.anticipation >= 0 ? Math.min(1, pc.anticipation / 0.07) : 0,
      turnRate: carried ? 0 : pc.turnRate, accel: carried ? 0 : pc.accel,
      lookYaw: look.yaw, lookWeight: look.w, wallLean: pc.wallLean, skid: pc.skid, stairs: pc.onStairs && !carried, sitting: this.idleStage >= 3 || RA.sitting,
      vault: carried ? 0 : Math.max(pc.vaultK, Math.sin(this.feet.pullK * Math.PI)),
      talking: inDialogue && guideNode?.speaker === 'player' && t < this.playerTalkUntil,
      riding: RA.pole && !deckWalk,
      ride: RA.ride, pedal: RA.pedal, standing: RA.standing,
    });

    // --- BAYBAY (carried: in the bike basket / the car's front seat / on the pelican / beside you on the streetcar)
    let gx = g.x, gy = g.y, gz = g.z;
    const gh = g.heading;
    const GP = move.guide;
    this.maybeSwapGuide(t);
    if (GP.active) {
      gx = GP.x; gy = GP.y; gz = GP.z;
      this.guideObject.position.set(gx, gy, gz);
      this.guideObject.quaternion.copy(GP.quat);
      this.guideObject.scale.setScalar(CHAR_SCALE * GP.scale);
    } else {
      this.guideObject.position.set(gx, gy, gz);
      this.guideObject.rotation.set(0, gh, 0);
      this.guideObject.scale.setScalar(CHAR_SCALE);
    }
    if (g.emote !== this.lastGuideEmote) {
      this.lastGuideEmote = g.emote;
      if (BABY_EMOTES.has(g.emote)) this.guideAnim.play(g.emote as Emote);
    }
    // BAYBAY's own idle: a grooming moment now and then
    if (!GP.active && this.mover.animSpeed < 0.1 && t >= this.guideTalkUntil && !inDialogue && !s.photoMode) this.guideIdleT += dt; else this.guideIdleT = 0;
    if (this.guideIdleT > this.nextGroomAt && !this.guideAnim.playing()) {
      this.guideAnim.play('groom');
      this.guideIdleT = 0;
      this.nextGroomAt = 12 + Math.random() * 10;
    }
    if (s.photoMode && g.speed < 0.3 && t - this.guidePhotoWaveAt > 3.2 && Math.hypot(gx - p.x, gz - p.z) < 10) {
      this.guidePhotoWaveAt = t;
      this.guideAnim.play(Math.random() < 0.5 ? 'wave' : 'hop');
    }
    if (f.bubble && f.bubble.key !== this.lastBubbleKey) {
      this.lastBubbleKey = f.bubble.key;
      if (f.bubble.who === 'baybay') this.guideTalkUntil = Math.max(this.guideTalkUntil, t + 1.3);
      else if (this.talking.has(f.bubble.who)) { this.talkingNpc = f.bubble.who; this.npcTalkUntil = t + 1.4; }
    }
    let guideLook = 0, guideLookW = 0;
    const gdx = p.x - gx, gdz = p.z - gz, gd = Math.hypot(gdx, gdz);
    if (gd < 8 && this.mover.animSpeed < 0.5) { guideLook = Math.atan2(gdx, gdz) - gh; guideLook = Math.atan2(Math.sin(guideLook), Math.cos(guideLook)); guideLookW = 1; }
    if (s.photoMode) { guideLook = Math.atan2(this.camPos.x - gx, this.camPos.z - gz) - gh; guideLook = Math.atan2(Math.sin(guideLook), Math.cos(guideLook)); guideLookW = 1; }
    const GA = move.guideAnim;
    this.guideAnim.update({
      t, dt, speed: GP.active ? 0 : this.mover.animSpeed, stride: this.mover.stride, walkSpeed: GUIDE_WALK, runSpeed: GUIDE_RUN,
      grounded: !(GP.active && GA.hop), vy: GP.active && GA.hop ? 2 : 0, crouch: 0, turnRate: 0, accel: 0,
      lookYaw: guideLook, lookWeight: guideLookW,
      talking: t < this.guideTalkUntil, riding: GP.active && GA.pole, sitting: GP.active && GA.sitting,
    });

    // --- residents
    const npcTalking = inDialogue && guideNode?.speaker === 'npc';
    if (!inDialogue && t > this.npcTalkUntil + 0.5) this.talkingNpc = null;
    // who the player is talking to (the camera's conversation two-shot)
    view.speaker = 0;
    if (inDialogue) {
      const npc = this.talkingNpc ? this.npcs.find(n => n.def.id === this.talkingNpc) : undefined;
      if (npc && Math.hypot(npc.x - p.x, npc.z - p.z) < 9) { view.speaker = 2; view.speakerX = npc.x; view.speakerY = npc.y; view.speakerZ = npc.z; }
      else if (!carried) { view.speaker = 1; view.speakerX = gx; view.speakerY = gy; view.speakerZ = gz; }
    }
    for (let k = 0; k < this.npcs.length; k++) {
      const npc = this.npcs[k];
      npc.talking = !!this.talkingNpc && npc.def.id === this.talkingNpc && (npcTalking || t < this.npcTalkUntil);
      npc.update(dt, t);
      // (a resident's real shadow only near the camera, its blob always: C2 part b request 1)
      this.castNear(npc.rig.mesh, this.nearCamera(npc.x, npc.z));
      const r = residents[k] ?? (residents[k] = { x: 0, z: 0 });
      r.x = npc.x; r.z = npc.z;
    }
    residents.length = this.npcs.length;

    // --- blob shadows (tilted to the ground, shrink while airborne)
    let i = 0;
    const blob = (x: number, z: number, footY: number, size: number) => {
      const gy2 = heightAt(x, z);
      const lift = Math.max(0, footY - gy2);
      const k = size * Math.max(0.45, 1 - lift * 0.35);
      tmpQ.setFromUnitVectors(UP, groundNormal(x, z, tmpN));
      tmpM.compose(tmpV.set(x, gy2 + 0.035, z), tmpQ, tmpS.set(k, 1, k));
      this.blobs.setMatrixAt(i++, tmpM);
    };
    // (on a vehicle / the pelican the blob sits under the rider; high up it shrinks away)
    const high = (move.mode === 'glide' || move.mode === 'travel') && runtime.glide.height > 10;
    blob(vx, vz, carried ? Math.max(heightAt(vx, vz), vy - (move.mode === 'glide' ? 0 : 0.6)) : p.y, 1.25 * CHAR_SCALE * (high ? 0.0001 : 1));
    blob(gx, gz, gy, 1.1 * CHAR_SCALE * (GP.active ? (high ? 0.0001 : 0.6) : 1));
    // (a city resident hidden at home draws no blob either: G2's request 1, sf-w3-G2.md)
    for (const npc of this.npcs) if (npc.visible) blob(npc.x, npc.z, npc.y, (npc.def.scale ?? 1) * 1.05);
    this.blobs.count = i;
    this.blobs.instanceMatrix.needsUpdate = true;

    // A11: honest click-to-walk — say when a route fails, trace long routes, collapse the ring on arrival
    const pc2 = this.controller;
    if (pc2.pathFailedAt !== this.seenFail) {
      this.seenFail = pc2.pathFailedAt;
      if (this.prevPathTarget) { this.ring.show(this.prevPathTarget, true); emit({ type: 'ui', action: 'error' }); }
      // (part b, verify-desktop D2) a far walk that gave up says so: its red ring is often off screen
      if (pc2.pathFailedFar) say('这边走不过去了 · 打开地图换个方式吧', 'Can’t get through this way — try the map for another way', 'info', 4200);
    } else if (this.prevPathTarget && !p.pathTarget && Math.hypot(p.x - this.prevPathTarget.x, p.z - this.prevPathTarget.z) < 1.2) this.ring.arrive();
    if (pc2.planCount !== this.seenPlan) {
      this.seenPlan = pc2.planCount;
      if (p.pathTarget) this.crumbs.trace({ x: p.x, z: p.z }, pc2.crumbPath(), t, pc2.longMode ? Breadcrumbs.MAX : Breadcrumbs.N);
    }
    // tap-to-drive: dots along the drive route, the ring collapses on arrival, a red ring when there is no way
    const sd = this.seenDrive;
    if (move.driveRoutes !== sd.routes) { sd.routes = move.driveRoutes; if (move.drivePath.length > 1) this.crumbs.trace(move.drivePath[0], crumbsAhead(move.drivePath, 140), t, Breadcrumbs.MAX); }
    if (move.driveArrivals !== sd.arrivals) { sd.arrivals = move.driveArrivals; this.ring.arrive(); }
    if (move.driveFails !== sd.fails) { sd.fails = move.driveFails; const r = this.ring.current; if (r) { this.ring.show(r, true); emit({ type: 'ui', action: 'error' }); } }
    this.prevPathTarget = p.pathTarget ? { x: p.pathTarget.x, z: p.pathTarget.z } : null;
    this.crumbs.update(t);
    this.ring.update(dt, t, p.pathTarget ?? move.driveTarget);

    // warm rim light by day, faint at night
    const tod = s.timeOfDay;
    const k = Math.min(1, dt * 2);
    rimUniforms.rimStrength.value += ((tod === 'night' ? 0.25 : tod === 'golden' ? 0.26 : 0.2) - rimUniforms.rimStrength.value) * k;
    rimUniforms.charGlow.value += ((tod === 'night' ? 0.26 : tod === 'golden' ? 0.05 : 0.03) - rimUniforms.charGlow.value) * k;
    if (tod === 'night') rimUniforms.rimColor.value.setRGB(0.75, 0.82, 1.0); else rimUniforms.rimColor.value.setRGB(1.0, 0.93, 0.8);
    (this.blobs.material as THREE.MeshBasicMaterial).color.copy(tod === 'night' ? BLOB_NIGHT : BLOB_DAY);
    // the textured white fur reads grey at night without a bit more self-light than the clay toys
    baybayGlbUniforms.charGlow.value = rimUniforms.charGlow.value * (tod === 'night' ? 1.45 : 1.2);
  }

  // ---------------------------------------------------------------------------
  // A9 · where the newcomer looks, and what they do when left alone
  // ---------------------------------------------------------------------------

  /**
   * Look-at priority: the one speaking (BAYBAY / a resident), the focused interactable, barking sea lions or a passing
   * streetcar, then the camera after 8 s of standing still. Also runs the idle ladder: 5 s look around (the animator's
   * glances), 10 s read the carried map, 18 s sit down. Any input cancels.
   */
  private playerLook(dt: number, frozen: boolean, riding: boolean, inDialogue: boolean): { yaw: number; w: number } {
    const p = runtime.player, s = game.get();
    const busy = p.moving || riding || s.photoMode || inDialogue || input.manualMove || !!p.pathTarget || s.phase !== 'playing';
    if (busy || (frozen && !inDialogue)) {
      if (this.idleStage >= 2 && this.playerAnim.playing('map')) this.playerAnim.stop();
      this.idleT = 0; this.idleStage = 0;
    } else {
      this.idleT += dt;
      if (this.idleStage < 1 && this.idleT > 5) this.idleStage = 1;
      if (this.idleStage < 2 && this.idleT > 10) { this.idleStage = 2; if (!this.playerAnim.playing()) this.playerAnim.play('map'); }
      if (this.idleStage < 3 && this.idleT > 18) this.idleStage = 3;
    }
    let tx = NaN, tz = NaN;
    if (inDialogue) {
      if (view.speaker) { tx = view.speakerX; tz = view.speakerZ; }
    } else {
      const it = s.focus ? interactableById(s.focus) : undefined;
      if (it) { tx = it.source === 'baybay' ? runtime.guide.x : it.x; tz = it.source === 'baybay' ? runtime.guide.z : it.z; }
      else if (this.now - this.seaLionAt < 3) {
        const dock = DISTRICT.landmarks.find(l => l.kind === 'sea-lion-docks');
        if (dock && Math.hypot(dock.position.x - p.x, dock.position.z - p.z) < 30) { tx = dock.position.x; tz = dock.position.z; }
      }
      if (Number.isNaN(tx)) {
        const car = runtime.streetcar;
        if (Math.hypot(car.x - p.x, car.z - p.z) < 12 && !riding) { tx = car.x; tz = car.z; }
      }
      if (Number.isNaN(tx) && this.idleT > 8 && this.idleStage < 2) { tx = this.camPos.x; tz = this.camPos.z; }
    }
    if (Number.isNaN(tx) || Math.hypot(tx - p.x, tz - p.z) < 0.3) return { yaw: 0, w: 0 };
    const a = Math.atan2(tx - p.x, tz - p.z) - p.heading;
    return { yaw: Math.atan2(Math.sin(a), Math.cos(a)), w: 1 };
  }

  // ---------------------------------------------------------------------------
  // A4 · the rigged BAYBAY GLB: preload after Start (during the arrival cinematic), swap in unseen
  // ---------------------------------------------------------------------------

  /** set by Actors.tsx: compile an object's shader programs ahead of time (renderer.compileAsync) */
  private precompile: ((object: THREE.Object3D) => Promise<unknown>) | null = null;
  setPrecompile(fn: ((object: THREE.Object3D) => Promise<unknown>) | null) { this.precompile = fn; }
  /** game phase when the GLB was requested (QA: must never be 'title') */
  glbRequestedIn: string | null = null;

  private loadGuideGlb() {
    if (this.guideModel !== 'procedural' || glbDisabled()) return;
    this.guideModel = 'loading';
    this.glbRequestedIn = game.get().phase;
    // D2 w3 c2: the shared Draco-capable loader (world/models heroGltfLoader), imported dynamically so the district's
    // first load keeps DRACOLoader out; lane V can then publish BAYBAY as Draco + WebP like the other heroes
    import('../world/models').then(m => m.heroGltfLoader().loadAsync(MODELS.baybay.url)).then(gltf => {
      if (this.disposed) return;
      const built = rigFromGltf(gltf.scene, MODELS.baybay.size[1]);
      if (!built) { this.guideModel = 'failed'; return; }
      built.object.name = 'opus-baybay';
      built.object.scale.setScalar(CHAR_SCALE);
      // compile her shader programs before the swap (no hitch on the frame she appears)
      const ready = () => { if (this.disposed) return; this.glbPending = built; this.guideModel = 'ready'; };
      const pre = this.precompile?.(built.object);
      if (pre) pre.then(ready, ready); else ready();
    }).catch(() => { this.guideModel = 'failed'; });
  }

  /** Swap only when nobody sees the pop: BAYBAY off-screen or far, a cinematic, a dialogue line change, the title. */
  private maybeSwapGuide(t: number) {
    const s = game.get(), f = flow.get();
    if (this.guideModel === 'procedural' && s.phase !== 'title') this.loadGuideGlb();
    const node = s.dialogue.nodeId;
    const boundary = node !== this.lastDialogueNode;
    this.lastDialogueNode = node;
    if (this.guideModel !== 'ready' || !this.glbPending) return;
    const g = runtime.guide;
    const seen = this.guideSeen;
    const far = Math.hypot(g.x - this.camPos.x, g.z - this.camPos.z) > 34;
    if (seen && !far && !f.cinematic && !boundary && s.phase === 'playing' && t > 0) return;
    this.swapGuideNow();
  }

  /** Replace the procedural BAYBAY with the loaded GLB right now (also a QA hook: __opusBay.actors.swapGuideNow()). */
  swapGuideNow(): boolean {
    const next = this.glbPending;
    if (!next) return false;
    const old = this.guide, oldObject = this.guideObject;
    // the skinned shadow-depth material C2's kind sweep gave the procedural BAYBAY (world/materials kindSweep): on the
    // first shadowed frame too, so the swap links no program (C2's P5)
    if (old.mesh.customDepthMaterial && !next.rig.mesh.customDepthMaterial) next.rig.mesh.customDepthMaterial = old.mesh.customDepthMaterial;
    next.object.position.copy(oldObject.position);
    next.object.rotation.copy(oldObject.rotation);
    this.root.remove(oldObject);
    this.root.add(next.object);
    this.guide = next.rig;
    this.guideObject = next.object;
    this.guideAnim = new Animator(next.rig, 'baybay', GLB_BAYBAY_TUNING);
    this.lastGuideEmote = 'none';
    this.glbPending = null;
    this.guideModel = 'glb';
    this.char.onGuideSwap();
    old.mesh.geometry.dispose();
    old.mesh.skeleton.dispose();
    return true;
  }

  private disposed = false;
  /** BAYBAY inside the camera frustum this frame */
  guideSeen = true;

  dispose() {
    // (a city resident whose body is still loading never builds it now: G2's review request 7, sf-w3-G2.md)
    this.npcs.forEach(n => n.release());
    this.disposed = true;
    this.char.dispose();
    selfTap.on = false;
    this.unsub();
    bindMoveApi(null);
    const geos = [this.player.mesh.geometry, this.guide.mesh.geometry, ...this.npcs.map(n => n.rig.mesh.geometry), this.blobs.geometry, this.pick.geometry];
    if (this.guideModel === 'glb') {
      const mat = this.guide.mesh.material as THREE.MeshStandardMaterial;
      mat.map?.dispose();
      mat.dispose();
    }
    if (this.glbPending) this.glbPending.rig.mesh.geometry.dispose();
    geos.forEach(g => g.dispose());
    (this.blobs.material as THREE.Material).dispose();
    (this.pick.material as THREE.Material).dispose();
    this.blobTex.dispose();
    this.ring.dispose();
    this.crumbs.dispose();
    this.move.dispose();
    this.player.mesh.skeleton.dispose();
    this.guide.mesh.skeleton.dispose();
    this.npcs.forEach(n => n.rig.mesh.skeleton.dispose());
  }
}
