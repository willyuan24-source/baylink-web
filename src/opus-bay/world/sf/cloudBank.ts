import * as THREE from 'three';
import type { TimeOfDay } from '../../core/store';
import { Batch, C, ICO, freezeStatic } from '../builder';
import { TOY_INST_TINT } from '../materials';
import type { WorldSystem } from '../world';
import { KARL_GEO, type KarlState, type KarlTarget } from './fog';
import { hazeCullDepth } from './pools';

/**
 * Karl the Fog's cloud bank (lane C2-8, city chunk): CLOUD_BANK.count cotton clusters (3 lumps each) on ONE TOY_INST_TINT
 * InstancedMesh (1 draw call, ≤ 9.6k triangles: only the clusters in view are packed; no shadow; one tint per time
 * through instanceColor, the props' tinted program, warmed up), laid out per time of day from Karl's target (fog.ts):
 *
 *   morning   the front edge of the bank over the Sunset and the Richmond up to the Sutro slopes, a tongue in the Gate
 *   golden    a row pouring through the Golden Gate (under the towers, over the deck), the rest rolling in over the
 *             outer Sunset
 * Three in five of the west clusters stand tall on the rolling front, the others lie low on the bank behind it (M3).
 *   day       offshore, a low bank on the Pacific horizon
 *   night     like the morning, lower and thinner
 *
 * Under the bank (a camera below a cluster's top, within ≈ 70–170 u) the clusters overhead shrink away: there Karl is
 * the distance fog. On a time change the clusters slide from where they are to the new layout with Karl's front (KARL_SLIDE s, eased;
 * morning rolls in from the Pacific); they also drift inland with the wind and wrap, shrinking to nothing at the wrap.
 * Clusters whose spot is higher than Karl's top (the Sutro slopes, Twin Peaks) stay hidden. It replaces the district's
 * hand-hung cotton clouds in city mode (backdrop.ts; CS-12: they rested on the waterfront in high views).
 */
export const CLOUD_BANK = { count: 40, lumps: 3, trisPerCluster: 240, wrap: 110 } as const;

/** One unit cotton cluster: three flattened icospheres, white tops and cool undersides (240 triangles). */
export function cloudClusterGeometry(): THREE.BufferGeometry {
  const b = new Batch();
  const top = C('#fdfcf8'), mid = C('#f3f4f2'), under = C('#e2e7eb');
  // aInfo: no windows, base far below (no contact AO), a faint always-on glow (TOY: w in (1, 2]) so the side away from a
  // low sun reads as lit fog, not a storm cloud (M3: the golden-hour bank was grey from Twin Peaks)
  const info = [0, -1000, 0, 1.18] as const;
  const lumps: [number, number, number, number, number, number][] = [[0, 0.08, 0, 1, 0.78, 0.9], [-0.8, -0.04, 0.2, 0.7, 0.62, 0.66], [0.82, -0.02, -0.16, 0.74, 0.64, 0.68]];
  for (const [x, y, z, sx, sy, sz] of lumps) {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(sx, sy, sz));
    b.add(ICO(1), m, (_x, yy) => (yy < -0.14 ? under : yy < 0.14 ? mid : top), info);
  }
  return b.build();
}

export interface CloudSlot { x: number; y: number; z: number; sx: number; sy: number; sz: number; yaw: number }

function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/**
 * Where the clusters sit for a Karl target (pure, deterministic): ≈ 30 % in the gate lobe when there is one, the rest
 * in a band behind the west front, from the Presidio (north) to Fort Funston (south). Ordered north to south, so a
 * cluster keeps roughly its latitude from one layout to the next and slides mostly east–west.
 */
export function cloudSlots(t: KarlTarget, n: number = CLOUD_BANK.count): CloudSlot[] {
  const G = KARL_GEO, r = rng(4417);
  const out: CloudSlot[] = [];
  const nGate = t.gate > 0.05 ? Math.round(n * 0.3) : 0;
  const gateYaw = Math.atan2(-G.gate.dz, G.gate.dx);
  for (let i = 0; i < nGate; i++) {
    const along = -140 + ((nGate - i - 0.5) / nGate) * Math.max(120, t.gateLen - 200) + (r() - 0.5) * 30;
    const across = (r() - 0.5) * 150;
    out.push({
      x: G.gate.x + G.gate.dx * along - G.gate.dz * across, z: G.gate.z + G.gate.dz * along + G.gate.dx * across,
      y: t.top - 8 + r() * 3, sx: 40 + r() * 16, sy: 14 + r() * 5, sz: 26 + r() * 10, yaw: gateYaw + (r() - 0.5) * 0.5,
    });
  }
  const nWest = n - nGate;
  const eastYaw = Math.atan2(-G.east.z, G.east.x);
  for (let i = 0; i < nWest; i++) {
    // three in five on the rolling front (tall, lined up along it), the rest low and flat on the bank behind (M3)
    const wall = i % 5 < 3;
    const b = 820 - ((i + 0.5) / nWest) * 1450 + (r() - 0.5) * 40;
    const a = wall ? t.front - 70 - r() * 45 : t.front - 150 - r() * 260;
    out.push({
      x: G.origin.x + G.east.x * a + G.north.x * b, z: G.origin.z + G.east.z * a + G.north.z * b,
      y: t.top - (wall ? 6 : 9) + r() * 3,
      sx: wall ? 54 + r() * 24 : 34 + r() * 20, sy: wall ? 17 + r() * 6 : 12 + r() * 5, sz: 30 + r() * 16,
      yaw: eastYaw + Math.PI / 2 + (r() - 0.5) * (wall ? 0.5 : 0.9),
    });
  }
  return out;
}

/** instanceColor of the bank per time (multiplies the white / grey vertex colours and the clusters' faint glow; the TOY
 *  lighting stays): at night low and cool, or the always-on glow lights the bank brighter than the city (wave 4,
 *  verify-visual F4: at 0.6 / 0.55 / 0.62 the night clusters were lavender clay blobs over the lit Sunset) */
export const CLOUD_TINT: Record<TimeOfDay, [number, number, number]> = {
  morning: [1.2, 1.2, 1.22], day: [1.15, 1.15, 1.15], golden: [1.42, 1.26, 1.14], night: [0.3, 0.33, 0.42],
};

/**
 * A camera flying into the bank (a glide, the 70–115 u views) sees the nearest clusters melt away instead of filling
 * the frame with faceted lumps (verify-visual F4): a cluster shrinks to nothing as the camera comes within NEAR_MELT.in
 * of its surface, full size beyond NEAR_MELT.out.
 */
export const NEAR_MELT = { in: 8, out: 60 } as const;

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
const _c = new THREE.Color(), _c2 = new THREE.Color();
const _f = new THREE.Frustum(), _pm = new THREE.Matrix4(), _sph = new THREE.Sphere(), _fwd = new THREE.Vector3();
const ease = (t: number) => t * t * (3 - 2 * t);
const smooth = (e0: number, e1: number, x: number) => ease(Math.min(1, Math.max(0, (x - e0) / (e1 - e0))));

export class CloudBank implements WorldSystem {
  readonly name = 'karl-clouds';
  readonly group = new THREE.Group();
  readonly mesh: THREE.InstancedMesh;
  private geo = cloudClusterGeometry();
  private epoch = -1;
  private from: CloudSlot[] = [];
  private to: CloudSlot[] = [];
  private phase: number[] = [];
  /** the slide progress (eased) the clusters were last placed at */
  private placed = 1;

  private karl: KarlState;
  /** city ground height (the far DEM), so no cluster sits inside a hill; null until the far city is in */
  private groundAt: ((x: number, z: number) => number) | null;

  /** the scene's live FogExp2 density (the world's environment): clusters lost in the haze are not packed */
  private haze: (() => number) | null;

  constructor(karl: KarlState, groundAt: ((x: number, z: number) => number) | null = null, haze: (() => number) | null = null) {
    this.karl = karl;
    this.groundAt = groundAt;
    this.haze = haze;
    this.group.name = 'karl-clouds';
    this.mesh = new THREE.InstancedMesh(this.geo, TOY_INST_TINT, CLOUD_BANK.count);
    this.mesh.name = 'karl-clouds';
    freezeStatic(this.group);
    freezeStatic(this.mesh);
    // the props' tinted TOY_INST_TINT program (warmup.ts: receiveShadow on, instanceColor); a cloud never casts a shadow
    this.mesh.receiveShadow = true;
    this.mesh.castShadow = false;
    // culled per cluster in update() (only the clusters in view are packed and drawn)
    this.mesh.frustumCulled = false;
    // one tint for the whole bank (instanceColor multiplies the vertex colours: > 1 brightens): the props' tinted variant
    for (let i = 0; i < CLOUD_BANK.count; i++) this.mesh.setColorAt(i, _c.setRGB(1, 1, 1));
    this.mesh.visible = false;
    const r = rng(907);
    for (let i = 0; i < CLOUD_BANK.count; i++) this.phase.push(r());
    this.group.add(this.mesh);
  }

  /** the far DEM arrived: lay the clusters out again, clear of the hills */
  setGround(groundAt: (x: number, z: number) => number) {
    this.groundAt = groundAt;
    this.epoch = -1;
  }

  /** the slots of a target, lifted clear of the ground and hidden (size 0) where the ground rises above Karl's top */
  private slots(t: KarlTarget): CloudSlot[] {
    return cloudSlots(t).map(s => {
      const g = this.groundAt?.(s.x, s.z) ?? 0;
      if (g + 3 > t.top + 2) return { ...s, sx: 0, sy: 0, sz: 0 };
      return { ...s, y: Math.max(s.y, g + 3 + s.sy * 0.5) };
    });
  }

  update(_dt: number, _t: number, camera: THREE.Camera) {
    const k = this.karl;
    const cam = camera.position;
    if (k.epoch !== this.epoch) {
      // start the slide from where the clusters are now (the first time: straight at the target)
      this.from = this.epoch < 0 ? this.slots(k.target) : this.current();
      this.to = this.slots(k.target);
      this.epoch = k.epoch;
    }
    const level = k.cur.level;
    if (level <= 0.02) { this.mesh.visible = false; return; }
    this.tint(k.tod, k.t);
    camera.updateMatrixWorld();
    _f.setFromProjectionMatrix(_pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    // the haze cull (pools.ts): at walking height the bank 2 km off behind the city is ≥ 98.5 % haze
    const maxDepth = hazeCullDepth(this.haze?.() ?? 0, (camera as THREE.PerspectiveCamera).far ?? Infinity);
    camera.getWorldDirection(_fwd);
    let n = 0;
    const e = (this.placed = ease(k.t));
    const size = Math.min(1, level / 0.12) * (0.8 + 0.2 * Math.min(1, level / 0.6));
    const W = CLOUD_BANK.wrap, E = KARL_GEO.east;
    for (let i = 0; i < CLOUD_BANK.count; i++) {
      const a = this.from[i], b = this.to[i];
      const f = (this.phase[i] + k.drift / W) % 1;
      const d = (f - 0.5) * W;
      let grow = Math.sqrt(Math.sin(Math.PI * f)) * size;
      _p.set(a.x + (b.x - a.x) * e + E.x * d, a.y + (b.y - a.y) * e, a.z + (b.z - a.z) * e + E.z * d);
      // under the bank (walking in the Sunset, on Ocean Beach) Karl is the distance fog, not blobs overhead
      if (cam.y < _p.y + 12) grow *= smooth(70, 170, Math.hypot(_p.x - cam.x, _p.z - cam.z));
      _s.set(a.sx + (b.sx - a.sx) * e, a.sy + (b.sy - a.sy) * e, a.sz + (b.sz - a.sz) * e);
      // near the camera (above the bank: a glide, a high view) the cluster melts instead of filling the frame
      const gap = Math.hypot((_p.x - cam.x) / Math.max(1, _s.x), (_p.y - cam.y) / Math.max(1, _s.y), (_p.z - cam.z) / Math.max(1, _s.z));
      if (gap < 4) grow *= smooth(NEAR_MELT.in, NEAR_MELT.out, (gap - 1) * Math.min(_s.x, _s.z));
      _s.multiplyScalar(grow);
      if (_s.x < 0.05 || _s.y < 0.05) continue;
      const r = Math.max(_s.x, _s.z) * 1.8;
      if (!_f.intersectsSphere(_sph.set(_p, r))) continue;
      if (maxDepth < Infinity && (_p.x - cam.x) * _fwd.x + (_p.y - cam.y) * _fwd.y + (_p.z - cam.z) * _fwd.z - r > maxDepth) continue;
      _q.setFromAxisAngle(_up, a.yaw + (b.yaw - a.yaw) * e);
      this.mesh.setMatrixAt(n++, _m.compose(_p, _q, _s));
    }
    this.mesh.count = n;
    this.mesh.visible = n > 0;
    if (n) { this.mesh.instanceMatrix.clearUpdateRanges(); this.mesh.instanceMatrix.addUpdateRange(0, n * 16); this.mesh.instanceMatrix.needsUpdate = true; }
  }

  /** the bank's tint (sunlit cotton by day, backlit peach at golden hour, dim at night), eased with the slide */
  private tintTod: TimeOfDay | null = null;
  private tintFrom = new THREE.Color(1, 1, 1);
  private tintNow = new THREE.Color(1, 1, 1);
  /** the tint last written to instanceColor (float64: the Float32 attribute never compares equal to it) */
  private tintSet = new THREE.Color(NaN, NaN, NaN);
  /** Instance colours rewritten (and uploaded) this visit: only while the tint slides, never on a steady frame. */
  tintWrites = 0;
  private tint(tod: TimeOfDay, t: number) {
    if (tod !== this.tintTod) { this.tintFrom.copy(this.tintNow); this.tintTod = tod; }
    const [r, g, b] = CLOUD_TINT[tod];
    this.tintNow.copy(this.tintFrom).lerp(_c2.setRGB(r, g, b), ease(t));
    if (this.tintNow.equals(this.tintSet)) return;
    this.tintSet.copy(this.tintNow);
    for (let i = 0; i < CLOUD_BANK.count; i++) this.mesh.setColorAt(i, this.tintNow);
    this.mesh.instanceColor!.needsUpdate = true;
    this.tintWrites++;
  }

  /** the clusters' layout positions right now (without the drift) */
  private current(): CloudSlot[] {
    const e = this.placed;
    return this.to.map((b, i) => {
      const a = this.from[i] ?? b;
      const l = (u: number, v: number) => u + (v - u) * e;
      return { x: l(a.x, b.x), y: l(a.y, b.y), z: l(a.z, b.z), sx: l(a.sx, b.sx), sy: l(a.sy, b.sy), sz: l(a.sz, b.sz), yaw: l(a.yaw, b.yaw) };
    });
  }

  /** triangles of the whole bank (all clusters in view; for the budget table / tests) */
  get triangles(): number { return CLOUD_BANK.count * ((this.geo.index?.count ?? this.geo.getAttribute('position').count) / 3); }

  dispose() {
    this.mesh.dispose();
    this.geo.dispose();
  }
}
