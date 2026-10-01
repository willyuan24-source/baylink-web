import * as THREE from 'three';
import { runtime } from '../../core/runtime';
import { Batch, C, CBOX, CONE, CYL, Frame, ICO, SPHERE, freezeStatic, mixColor, type Info } from '../builder';
import { HALO, POOL, TOY_INST_TINT, U } from '../materials';
import { PAL } from '../palette';
import type { PropArrays } from './build';
import { PROP_KINDS } from './format';

/**
 * City street trees and lamps (plan §5.5 props): instanced, nearest-N around the focus, re-selected after 12 u of
 * movement. New instances grow in over ~0.45 s instead of popping (idea: GTA_SZ city-meadow.ts fade-in).
 *
 *   trees      full toy trees (round / tall / small by variant, cypress, pine, palm) — nearest 200 within 70 u
 *   lollipops  a 36-triangle tree for the ring beyond — nearest 600 within 140 u
 *   lamps      the district's lamp post — nearest 48 within 120 u, with night halos and light pools
 * ≈ 27k + 22k + 6k triangles at most (measured 83k with 300 / 900 / 64: the props were the city's largest group).
 *
 * With the camera (wave 3, P6): beyond PROP_VIEW.near u of the camera only props inside a widened copy of its frustum
 * (+ PROP_VIEW.widen° on every side) are placed, under the PROP_VIEW.k share of the caps, and the selection is redone
 * when the view turns by more than PROP_VIEW.yaw° / .pitch° (less than the widening: nothing inside the real frustum
 * is ever missing, and props a turn brings in are placed full-grown: they were out of view). Props behind the camera
 * were ≈ half of the group's triangles.
 *
 * One InstancedMesh per shape on TOY_INST_TINT (instanceColor, receiveShadow on, as warmed up; the tinted twin of TOY_INST,
 * so the untinted instanced meshes never flip its program), HALO and POOL for the night light.
 */

const K = Object.fromEntries(PROP_KINDS.map((c, i) => [c, i])) as Record<(typeof PROP_KINDS)[number], number>;
const RESELECT = 12;
const GROW = 0.45;
const CAP = { tree: 200, lolli: 600, lamp: 48 } as const;
const R_FULL = 70, R_LOLLI = 140, R_LAMP = 120;

/**
 * Props capped by camera height above the ground (lane C2-5 high-view budget): from 25 u up, full trees and lamps
 * thin out toward the focus (at 80 u: the nearest 50 full trees within 40 u, 350 lollipops, 12 lamps within 60 u:
 * ≈ 20k instead of ≈ 45k triangles). Four steps, so a bobbing camera never re-selects every frame.
 */
export const PROP_HIGH = { h0: 25, h1: 80, steps: 4, tree: 50, lolli: 350, lamp: 12, rFull: 40, rLamp: 60 } as const;
export interface PropCaps { tree: number; lolli: number; lamp: number; rFull: number; rLolli: number; rLamp: number; step: number }

/** View-aware selection (see the header): near = always kept (u from the camera), widen / yaw / pitch in degrees, k = cap share. */
export const PROP_VIEW = { near: 25, widen: 40, yaw: 20, pitch: 12, k: 0.5, minGap: 0.1 } as const;

const _wideM = new THREE.Matrix4();
/** The camera's frustum widened by `deg` degrees on every side (same position and orientation), into `out`. */
export function widenedFrustum(camera: THREE.PerspectiveCamera, deg: number, out: THREE.Frustum, tmp = new THREE.PerspectiveCamera()): THREE.Frustum {
  const w = THREE.MathUtils.degToRad(deg), lim = THREE.MathUtils.degToRad(84);
  const v = THREE.MathUtils.degToRad(camera.fov) / 2, h = Math.atan(Math.tan(v) * camera.aspect);
  const v2 = Math.min(lim, v + w), h2 = Math.min(lim, h + w);
  tmp.fov = THREE.MathUtils.radToDeg(v2 * 2);
  tmp.aspect = Math.tan(h2) / Math.tan(v2);
  tmp.near = camera.near;
  tmp.far = camera.far;
  tmp.updateProjectionMatrix();
  camera.updateMatrixWorld();
  return out.setFromProjectionMatrix(_wideM.multiplyMatrices(tmp.projectionMatrix, camera.matrixWorldInverse));
}
export function propCaps(camH: number): PropCaps {
  const P = PROP_HIGH;
  const t = Number.isFinite(camH) ? Math.min(1, Math.max(0, (camH - P.h0) / (P.h1 - P.h0))) : 0;
  const step = Math.round(t * P.steps), k = step / P.steps;
  const lerp = (a: number, b: number) => Math.round(a + (b - a) * k);
  return { tree: lerp(CAP.tree, P.tree), lolli: lerp(CAP.lolli, P.lolli), lamp: lerp(CAP.lamp, P.lamp), rFull: lerp(R_FULL, P.rFull), rLolli: R_LOLLI, rLamp: lerp(R_LAMP, P.rLamp), step };
}

/**
 * (W8-K5, lane K) The street trees' leaves carry aInfo.x CANOPY_INFO: TOY_FRAG thins them to a dither in front of the
 * player while U.uCanopy.w is on (CityProps.update: a canopy within CANOPY_FADE_REACH u of the player, the occlusion fade
 * on). Trunks, lamps and the far lollipops stay untagged; nothing else in the city or the district uses 11.
 */
export const CANOPY_INFO = 11;
const LEAF: Info = [CANOPY_INFO, 0, 0, 0];
/** a canopy edge this near the player (u, XZ) switches the dither on */
export const CANOPY_FADE_REACH = 2.6;
/** ...if it hangs between these heights over the player's feet (u): over the head, not a tree down the hill */
export const CANOPY_FADE_BAND = { below: 0.5, above: 3.6 } as const;
/** the dither's target over the player's feet (u): the chest */
export const CANOPY_FADE_CHEST = 0.9;
/**
 * ...and only with the camera this near the chest (u): the seated / side-on ride shots stand ≈ 4 u off at bench height,
 * where the occlusion fade's cut-offs keep the leaves at the rider; the follow camera on foot (≈ 12 u off, high) keeps
 * the occlusion fade alone (played: with the dither on there a walker's tree lost its whole canopy to a bare trunk)
 */
export const CANOPY_CAM_NEAR = 7;

/** Unit geometry from a Batch (keeps aInfo; TOY_INST reads it). */
function geo(build: (b: Batch) => void): THREE.BufferGeometry {
  const b = new Batch();
  build(b);
  return b.build();
}

function roundTree(b: Batch) {
  const f = new Frame(0, 0, 0);
  b.add(CYL(5, 0.8), f.at(0, 0, 0, 0, 0.16, 1.9, 0.16), '#7a5a3e');
  const blobs: [number, number, number, number][] = [[0, 2.4, 0, 1.15], [0.55, 2.1, 0.3, 0.85], [-0.45, 2.2, -0.35, 0.8]];
  blobs.forEach(([x, y, z, r], k) => b.add(ICO(k === 0 ? 1 : 0), f.at(x, y, z, k, r, r * 0.92, r), mixColor(PAL.tree, PAL.treeDark, k === 0 ? 0.15 : 0.45), LEAF));
}
function cypress(b: Batch) {
  b.add(CYL(5), new Frame(0, 0, 0).at(0, 0, 0, 0, 0.14, 1.2, 0.14), '#6b4f36');
  b.add(CONE(7), new Frame(0, 0, 0).at(0, 0.6, 0, 0, 0.9, 4.6, 0.9), PAL.pine, LEAF);
}
function pine(b: Batch) {
  const f = new Frame(0, 0, 0);
  b.add(CYL(5), f.at(0, 0, 0, 0, 0.14, 1.5, 0.14), '#6b4f36');
  for (let k = 0; k < 3; k++) b.add(CONE(7), f.at(0, 0.9 + k * 1.0, 0, k, 1.25 - k * 0.3, 1.7, 1.25 - k * 0.3), mixColor(PAL.pine, '#3f6340', k * 0.3), LEAF);
}
function palm(b: Batch) {
  const f = new Frame(0, 0, 0);
  const H = 4.3;
  b.add(CYL(6, 0.78), f.at(0, 0, 0, 0, 0.34, H, 0.34), '#9a7a55');
  b.add(ICO(0), f.at(0, H + 0.05, 0, 0, 0.5, 0.42, 0.5), '#7a6a3c', LEAF);
  for (let i = 0; i < 8; i++) {
    const yaw = (i / 8) * Math.PI * 2;
    let px = 0, py = H + 0.15, pz = 0, pitch = i % 2 ? 0.7 : 0.35;
    for (let k = 0; k < 2; k++) {
      const seg = 0.95;
      const dx = Math.sin(yaw) * Math.cos(pitch) * seg, dy = Math.sin(pitch) * seg, dz = Math.cos(yaw) * Math.cos(pitch) * seg;
      b.add(CBOX(), f.at(px + dx / 2, py + dy / 2, pz + dz / 2, yaw, 0.5 - k * 0.14, 0.05, seg * 1.04, -pitch), mixColor('#5d8a42', '#86ae57', k * 0.5), LEAF);
      px += dx; py += dy; pz += dz; pitch -= 0.75;
    }
  }
}
function lollipop(b: Batch) {
  const f = new Frame(0, 0, 0);
  b.add(CYL(4), f.at(0, 0, 0, 0, 0.18, 1.8, 0.18), '#7a5a3e');
  b.add(ICO(0), f.at(0, 2.35, 0, 0, 1.2, 1.1, 1.2), mixColor(PAL.tree, PAL.treeDark, 0.3));
}
function lampPost(b: Batch) {
  const f = new Frame(0, 0, 0);
  const keep = [0, 0, 0, -1] as const;
  b.add(CYL(8), f.at(0, 0, 0, 0, 0.16, 0.35, 0.16), PAL.lampPost, keep);
  b.add(CYL(6), f.at(0, 0.3, 0, 0, 0.06, 3.3, 0.06), PAL.lampPost, keep);
  b.add(CYL(8, 0.7), f.at(0, 3.55, 0, 0, 0.22, 0.5, 0.22), PAL.lampGlass, [0, 0, 0, -2]);
  b.add(CONE(8), f.at(0, 4.02, 0, 0, 0.3, 0.3, 0.3), PAL.lampPost, keep);
  b.add(SPHERE(5, 4), f.at(0, 4.34, 0, 0, 0.06, 0.06, 0.06), '#c9b48c', keep);
}

/**
 * (W7-K1) A street tree's canopy as the cameras' ray tests see it: a vertical cylinder (world u) round the trunk, from
 * y0 to y1. Per unit scale, from the shapes above: the round tree's three blobs (1.3 … 3.45, reach 1.45 off the trunk),
 * the cypress cone, the pine's three cones, the palm's fronds (the trunk itself is thin).
 */
export interface Canopy { x: number; z: number; r: number; y0: number; y1: number }
export const CANOPY_SHAPE = {
  round: { r: 1.45, y0: 1.3, y1: 3.45 },
  cypress: { r: 0.8, y0: 0.6, y1: 4.6 },
  pine: { r: 1.15, y0: 0.9, y1: 4.2 },
  palm: { r: 1.75, y0: 3.8, y1: 5.1 },
} as const;
/** the widest canopy at the largest scale (round variant 1: 1.25 × 1.15) */
const CANOPY_MAX_R = 1.45 * 1.25 * 1.15 + 0.05;
/** the tree index's cell (u) */
const TREE_CELL = 16;
/** The per-instance scale select() gives a tree (the same hash), so a canopy matches what is drawn. */
function treeScale(kind: number, variant: number, id: number): number {
  const hue = ((id * 2654435761) >>> 0) / 4294967296;
  return kind === K.tree ? (variant === 1 ? 1.25 : variant === 2 ? 0.75 : 1) * (0.9 + hue * 0.25) : 0.85 + hue * 0.3;
}
/** A chunk's trees in a CSR grid (built on the first query after the chunk arrives). */
interface TreeIndex { minX: number; minZ: number; maxX: number; maxZ: number; cols: number; rows: number; start: Int32Array; idx: Int32Array }
function buildTreeIndex(p: PropArrays): TreeIndex | null {
  let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity, n = 0;
  for (let i = 0; i < p.count; i++) {
    if (p.kind[i] === K.lamp) continue;
    const x = p.xyzr[i * 4], z = p.xyzr[i * 4 + 2];
    if (x < minX) minX = x; if (x > maxX) maxX = x; if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
    n++;
  }
  if (!n) return null;
  const cols = Math.floor((maxX - minX) / TREE_CELL) + 1, rows = Math.floor((maxZ - minZ) / TREE_CELL) + 1;
  const cell = (i: number) => Math.floor((p.xyzr[i * 4 + 2] - minZ) / TREE_CELL) * cols + Math.floor((p.xyzr[i * 4] - minX) / TREE_CELL);
  const start = new Int32Array(cols * rows + 1), idx = new Int32Array(n);
  for (let i = 0; i < p.count; i++) if (p.kind[i] !== K.lamp) start[cell(i) + 1]++;
  for (let c = 0; c < cols * rows; c++) start[c + 1] += start[c];
  const fill = start.slice(0, cols * rows);
  for (let i = 0; i < p.count; i++) if (p.kind[i] !== K.lamp) idx[fill[cell(i)]++] = i;
  return { minX, minZ, maxX, maxZ, cols, rows, start, idx };
}

// (the segment tests' running state: module scratch, no closure per call)
const SEG = { ax: 0, ay: 0, az: 0, dx: 0, dy: 0, dz: 0, len: 1, skip: 0, cone: 0, from: 0, clear: 0, best: -1, need: 0 };
/** The fractions [lo, hi] of the segment SEG inside canopy c (XZ disc ∩ the y band when `band`), or lo > hi if none. */
const SPAN = { lo: 0, hi: 0 };
function segSpan(c: Canopy, band: boolean): void {
  SPAN.lo = 1; SPAN.hi = 0;
  const ox = SEG.ax - c.x, oz = SEG.az - c.z;
  const a = SEG.dx * SEG.dx + SEG.dz * SEG.dz, b = 2 * (ox * SEG.dx + oz * SEG.dz), cc = ox * ox + oz * oz - c.r * c.r;
  let lo = 0, hi = 1;
  if (a < 1e-9) { if (cc > 0) return; } else {
    const disc = b * b - 4 * a * cc;
    if (disc <= 0) return;
    const q = Math.sqrt(disc);
    lo = Math.max(lo, (-b - q) / (2 * a)); hi = Math.min(hi, (-b + q) / (2 * a));
  }
  if (band) {
    if (Math.abs(SEG.dy) < 1e-9) { if (SEG.ay < c.y0 || SEG.ay > c.y1) return; } else {
      const t0 = (c.y0 - SEG.ay) / SEG.dy, t1 = (c.y1 - SEG.ay) / SEG.dy;
      lo = Math.max(lo, Math.min(t0, t1)); hi = Math.min(hi, Math.max(t0, t1));
    }
  }
  SPAN.lo = lo; SPAN.hi = hi;
}
const segHit = (c: Canopy) => {
  segSpan(c, true);
  let enter = SPAN.lo <= SPAN.hi ? SPAN.lo : 2;
  if (SEG.cone > 0 && SEG.len > 1e-6) {
    // the view cone from b (the camera) round the line to a: a canopy within atan(cone) of the line, between the two,
    // fills part of the frame round the subject (the closer to the camera, the more). Tested at the line's closest
    // approach to the trunk (XZ, fraction t, e off the line; the band grown by half the cone's reach there). The answer
    // is how far out a camera may stand with the canopy still outside its cone: t·len + (e − r)/cone (or the disc's
    // entry when the line runs through it)
    const L2 = SEG.dx * SEG.dx + SEG.dz * SEG.dz, Lxz = Math.sqrt(L2);
    const t = L2 > 1e-9 ? Math.min(1, Math.max(0, ((c.x - SEG.ax) * SEG.dx + (c.z - SEG.az) * SEG.dz) / L2)) : 0;
    const e = Math.hypot(SEG.ax + SEG.dx * t - c.x, SEG.az + SEG.dz * t - c.z);
    const grow = SEG.cone * (1 - t) * SEG.len, y = SEG.ay + SEG.dy * t;
    if (y > c.y0 - grow * 0.5 && y < c.y1 + grow * 0.5) {
      const reach = e >= c.r ? t + (e - c.r) / (SEG.cone * SEG.len) : Lxz > 1e-6 ? Math.max(0, t - Math.sqrt(c.r * c.r - e * e) / Lxz) : 0;
      if (reach < 1) enter = Math.min(enter, reach);
    }
  }
  if (enter > 1 || enter * SEG.len < SEG.skip) return;
  if (SEG.best < 0 || enter < SEG.best) SEG.best = enter;
};
const segLift = (c: Canopy) => {
  segSpan(c, false);
  const lo = Math.max(SPAN.lo, SEG.from), hi = SPAN.hi;
  if (lo > hi || lo <= 0) return;
  // under the canopy all the way across it (a low camera looks beneath the tree): nothing to clear
  if (SEG.ay + SEG.dy * lo < c.y0 && SEG.ay + SEG.dy * hi < c.y0) return;
  // raising b by L lifts the segment at f by L·f: clear the top at both ends of the crossing
  const top = c.y1 + SEG.clear;
  const need = Math.max((top - SEG.ay) / lo, (top - SEG.ay) / hi) - SEG.dy;
  if (need > SEG.need) SEG.need = need;
};

interface Layer { mesh: THREE.InstancedMesh; ids: number[]; born: Float32Array; scale: Float32Array; cap: number }

/** One prop candidate: index into its chunk's arrays. */
interface Pick { d: number; x: number; y: number; z: number; rot: number; kind: number; variant: number; id: number }

export class CityProps {
  readonly group = new THREE.Group();
  private layers: Record<'round' | 'cypress' | 'pine' | 'palm' | 'lolli' | 'lamp', Layer>;
  private halos: THREE.InstancedMesh;
  private pools: THREE.InstancedMesh;
  private sources = new Map<number, PropArrays>();
  private lastX = Infinity;
  private lastZ = Infinity;
  private dirty = false;
  private growing = false;
  private m4 = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private v = new THREE.Vector3();
  private s = new THREE.Vector3();
  private col = new THREE.Color();
  private up = new THREE.Vector3(0, 1, 0);
  /** view-aware selection state (PROP_VIEW): the widened frustum and the view it was made for */
  private wide = new THREE.Frustum();
  private wideCam = new THREE.PerspectiveCamera();
  private sph = new THREE.Sphere();
  private dir = new THREE.Vector3();
  private view: { yaw: number; pitch: number; fov: number; aspect: number; at: number; cx: number; cz: number } | null = null;
  selected = 0;

  constructor() {
    this.group.name = 'city-props';
    freezeStatic(this.group);
    const layer = (name: string, g: THREE.BufferGeometry, cap: number): Layer => {
      const mesh = new THREE.InstancedMesh(g, TOY_INST_TINT, cap);
      mesh.name = `city-${name}`;
      freezeStatic(mesh);
      mesh.count = 0;
      mesh.receiveShadow = true;
      mesh.castShadow = false;
      mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.setColorAt(0, C('#ffffff'));
      this.group.add(mesh);
      return { mesh, ids: [], born: new Float32Array(cap), scale: new Float32Array(cap), cap };
    };
    this.layers = {
      round: layer('trees', geo(roundTree), CAP.tree),
      cypress: layer('cypress', geo(cypress), 160),
      pine: layer('pines', geo(pine), 160),
      palm: layer('palms', geo(palm), 120),
      lolli: layer('lollipops', geo(lollipop), CAP.lolli),
      lamp: layer('lamps', geo(lampPost), CAP.lamp),
    };
    // night light: a warm halo + a hot core per lamp, and a pool on the paving
    const hg = new THREE.PlaneGeometry(1, 1);
    const data = new Float32Array(CAP.lamp * 2 * 3);
    for (let i = 0; i < CAP.lamp * 2; i++) { data[i * 3] = i % 2 ? 0.6 : 3.2; data[i * 3 + 1] = (i * 0.618) % 1; data[i * 3 + 2] = 0; }
    hg.setAttribute('aHalo', new THREE.InstancedBufferAttribute(data, 3));
    this.halos = new THREE.InstancedMesh(hg, HALO, CAP.lamp * 2);
    this.halos.name = 'city-lamp-halos';
    freezeStatic(this.halos);
    this.halos.count = 0;
    this.halos.frustumCulled = false;
    this.halos.renderOrder = 10;
    for (let i = 0; i < CAP.lamp * 2; i++) this.halos.setColorAt(i, i % 2 ? new THREE.Color(1.5, 1.25, 0.95) : new THREE.Color(1.0, 0.74, 0.42));
    this.pools = new THREE.InstancedMesh(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), POOL, CAP.lamp);
    this.pools.name = 'city-lamp-pools';
    freezeStatic(this.pools);
    this.pools.count = 0;
    this.pools.frustumCulled = false;
    this.pools.renderOrder = 1;
    this.group.add(this.halos, this.pools);
  }

  /** Props of a resident chunk (key) arrive / leave. */
  setSource(key: number, p: PropArrays | null) {
    if (p) this.sources.set(key, p); else this.sources.delete(key);
    this.treeIdx.delete(key);
    this.dirty = true;
  }

  // --- (W7-K1) street trees for the cameras' ray tests (lane K1's Hyde St open item, lane B's Powell & Sacramento shot)
  private treeIdx = new Map<number, TreeIndex | null>();
  private readonly canopy: Canopy = { x: 0, z: 0, r: 0, y0: 0, y1: 0 };

  /**
   * Every street tree of the resident chunks whose canopy disc meets the disc (x, z, r), as a Canopy (one reused
   * object: read it inside `fn`, keep nothing). Full trees and the far lollipops alike (both stand there); none in the
   * hero slab (the hero draws its own trees) or the district.
   */
  treesNear(x: number, z: number, r: number, fn: (c: Canopy) => void): void {
    // (W8-K5) Map.forEach with one bound callback and the query in fields: no iterator or entry array per resident chunk
    // per call (a few calls a frame while riding a city line, one for the follow camera's lift, one for the dither)
    const Q = this.query;
    Q.x = x; Q.z = z; Q.r = r; Q.fn = fn;
    this.sources.forEach(this.scanSource);
    Q.fn = null;
  }

  private readonly query: { x: number; z: number; r: number; fn: ((c: Canopy) => void) | null } = { x: 0, z: 0, r: 0, fn: null };
  private readonly scanSource = (p: PropArrays, key: number): void => {
    const { x, z, r, fn } = this.query;
    if (!fn) return;
    const R = r + CANOPY_MAX_R, c = this.canopy;
    let ix = this.treeIdx.get(key);
    if (ix === undefined) { ix = buildTreeIndex(p); this.treeIdx.set(key, ix); }
    if (!ix || x + R < ix.minX || x - R > ix.maxX || z + R < ix.minZ || z - R > ix.maxZ) return;
    const c0 = Math.max(0, Math.floor((x - R - ix.minX) / TREE_CELL)), c1 = Math.min(ix.cols - 1, Math.floor((x + R - ix.minX) / TREE_CELL));
    const r0 = Math.max(0, Math.floor((z - R - ix.minZ) / TREE_CELL)), r1 = Math.min(ix.rows - 1, Math.floor((z + R - ix.minZ) / TREE_CELL));
    for (let row = r0; row <= r1; row++) {
      for (let col = c0; col <= c1; col++) {
        const cell = row * ix.cols + col;
        for (let k = ix.start[cell]; k < ix.start[cell + 1]; k++) {
          const i = ix.idx[k], kind = p.kind[i], variant = p.variant[i];
          const shape = kind === K.palm ? CANOPY_SHAPE.palm : kind === K.pine ? (variant === 0 ? CANOPY_SHAPE.cypress : CANOPY_SHAPE.pine) : CANOPY_SHAPE.round;
          const s = treeScale(kind, variant, key * 8192 + i), gy = p.xyzr[i * 4 + 1] - 0.02;
          c.x = p.xyzr[i * 4]; c.z = p.xyzr[i * 4 + 2]; c.r = shape.r * s;
          if ((c.x - x) ** 2 + (c.z - z) ** 2 > (r + c.r) ** 2) continue;
          c.y0 = gy + shape.y0 * s; c.y1 = gy + shape.y1 * s;
          fn(c);
        }
      }
    }
  };

  // --- (W8-K5) the canopy dither in front of the player (data/sf/cityShaders.ts toyCanopy in TOY_FRAG, U.uCanopy) ---
  private canopyHit = false;
  private readonly canopyBand = { y0: 0, y1: 0 };
  private readonly canopyProbe = (c: Canopy): void => { if (c.y1 > this.canopyBand.y0 && c.y0 < this.canopyBand.y1) this.canopyHit = true; };

  /**
   * (W8-K5) Each frame: U.uCanopy = the player's chest, w = 1 while a street tree's canopy hangs within CANOPY_FADE_REACH
   * u of them (in CANOPY_FADE_BAND over their feet), the camera stands within CANOPY_CAM_NEAR u of their chest and the
   * occlusion fade is on (photo mode / SoloView turn it off), else 0 (the shader's branch is then skipped for every fragment). A seated rider on the Powell-Hyde, a stop under a
   * kerb tree: the leaves between the camera and them thin out; no new draw call.
   */
  stepCanopyFade(px = runtime.player.x, py = runtime.player.y, pz = runtime.player.z): boolean {
    const u = U.uCanopy.value;
    this.canopyHit = false;
    const cam = U.uCam.value, cy = py + CANOPY_FADE_CHEST;
    if (U.uFade.value > 0.5 && this.sources.size && (cam.x - px) ** 2 + (cam.y - cy) ** 2 + (cam.z - pz) ** 2 < CANOPY_CAM_NEAR ** 2) {
      this.canopyBand.y0 = py - CANOPY_FADE_BAND.below; this.canopyBand.y1 = py + CANOPY_FADE_BAND.above;
      this.treesNear(px, pz, CANOPY_FADE_REACH, this.canopyProbe);
    }
    u.set(px, cy, pz, this.canopyHit ? 1 : 0);
    return this.canopyHit;
  }

  /** Query the canopies along the segment SEG (a disc round its middle that holds it). */
  private alongSeg(fn: (c: Canopy) => void, grow = 0) {
    const hx = SEG.dx / 2, hz = SEG.dz / 2;
    this.treesNear(SEG.ax + hx, SEG.az + hz, Math.hypot(hx, hz) + grow, fn);
  }

  /**
   * (W7-K1) The fraction along a → b (0–1) where the segment first enters a street tree's canopy, or −1. A canopy the
   * segment enters within `skip` u of a is left out (the subject stands under it: the camera's dither is the answer).
   * `cone` > 0 also counts a canopy near the line inside the view cone from b toward a (reach cone · the distance from
   * b): a camera at b with a canopy right beside its lens sees mostly leaves even when the line itself is clear.
   */
  segmentCanopy(ax: number, ay: number, az: number, bx: number, by: number, bz: number, skip = 0, cone = 0): number {
    SEG.ax = ax; SEG.ay = ay; SEG.az = az; SEG.dx = bx - ax; SEG.dy = by - ay; SEG.dz = bz - az;
    SEG.len = Math.hypot(SEG.dx, SEG.dy, SEG.dz); SEG.skip = skip; SEG.cone = cone; SEG.best = -1;
    this.alongSeg(segHit, cone * SEG.len);
    return SEG.best;
  }

  /**
   * (W7-K1) How far to raise b (u) so the segment a → b passes `clear` u over the top of every canopy it crosses beyond
   * the fraction `from` (0 when it already does; a segment that stays under a canopy all the way across needs nothing).
   */
  canopyLift(ax: number, ay: number, az: number, bx: number, by: number, bz: number, from: number, clear: number): number {
    SEG.ax = ax; SEG.ay = ay; SEG.az = az; SEG.dx = bx - ax; SEG.dy = by - ay; SEG.dz = bz - az;
    SEG.from = from; SEG.clear = clear; SEG.need = 0;
    this.alongSeg(segLift);
    return SEG.need;
  }

  get sourceCount() { return this.sources.size; }

  private caps: PropCaps = propCaps(0);

  /** `grow`: new props grow in (the focus moved); a turn of the view places them full-grown (they come in out of sight) */
  private select(fx: number, fz: number, now: number, grow = true) {
    const view = this.view;
    const k0 = view ? PROP_VIEW.k : 1;
    const base = this.caps;
    const cap = view ? { ...base, tree: Math.round(base.tree * k0), lolli: Math.round(base.lolli * k0), lamp: Math.round(base.lamp * k0) } : base;
    const near2 = PROP_VIEW.near * PROP_VIEW.near;
    const trees: Pick[] = [], lamps: Pick[] = [];
    for (const [key, p] of this.sources) {
      for (let i = 0; i < p.count; i++) {
        const x = p.xyzr[i * 4], z = p.xyzr[i * 4 + 2];
        const d = Math.hypot(x - fx, z - fz);
        const k = p.kind[i];
        if (d >= (k === K.lamp ? cap.rLamp : cap.rLolli)) continue;
        const y = p.xyzr[i * 4 + 1];
        // out of the widened view (and not right next to the camera): skip
        if (view && (x - view.cx) ** 2 + (z - view.cz) ** 2 > near2 && !this.wide.intersectsSphere(this.sph.set(this.v.set(x, y + 2.5, z), 4))) continue;
        const pick = { d, x, y, z, rot: p.xyzr[i * 4 + 3], kind: k, variant: p.variant[i], id: key * 8192 + i };
        if (k === K.lamp) lamps.push(pick); else trees.push(pick);
      }
    }
    trees.sort((a, b) => a.d - b.d);
    lamps.sort((a, b) => a.d - b.d);
    const want: Record<keyof typeof this.layers, Pick[]> = { round: [], cypress: [], pine: [], palm: [], lolli: [], lamp: lamps.slice(0, cap.lamp) };
    let full = 0;
    for (const t of trees) {
      if (t.d < cap.rFull && full < cap.tree) {
        const layer = t.kind === K.palm ? 'palm' : t.kind === K.pine ? (t.variant === 0 ? 'cypress' : 'pine') : 'round';
        if (want[layer].length < this.layers[layer].cap) { want[layer].push(t); full++; continue; }
      }
      if (want.lolli.length < cap.lolli) want.lolli.push(t);
    }
    let n = 0;
    for (const name of Object.keys(this.layers) as (keyof typeof this.layers)[]) {
      const L = this.layers[name], list = want[name];
      const prev = new Map<number, number>();
      L.ids.forEach((pid, i) => prev.set(pid, L.born[i]));
      L.ids = list.map(p => p.id);
      list.forEach((p, i) => {
        L.born[i] = prev.get(p.id) ?? (grow ? now : now - GROW);
        const hue = ((p.id * 2654435761) >>> 0) / 4294967296;
        const s = name === 'round' ? (p.variant === 1 ? 1.25 : p.variant === 2 ? 0.75 : 1) * (0.9 + hue * 0.25) : 0.85 + hue * 0.3;
        L.scale[i] = s;
        // (the canopies of treesNear follow the same scale: treeScale)
        if (name !== 'lamp') L.mesh.setColorAt(i, this.col.setRGB(0.92 + hue * 0.16, 0.95 + ((hue * 7) % 1) * 0.1, 0.9 + ((hue * 13) % 1) * 0.12));
        else L.mesh.setColorAt(i, this.col.setRGB(1, 1, 1));
      });
      L.mesh.count = list.length;
      if (L.mesh.instanceColor) L.mesh.instanceColor.needsUpdate = true;
      this.place(name, list, now);
      n += list.length;
    }
    // lamp light
    this.halos.count = want.lamp.length * 2;
    this.pools.count = want.lamp.length;
    want.lamp.forEach((p, i) => {
      this.halos.setMatrixAt(i * 2, this.m4.makeTranslation(p.x, p.y + 3.8, p.z));
      this.halos.setMatrixAt(i * 2 + 1, this.m4.makeTranslation(p.x, p.y + 3.78, p.z));
      this.pools.setMatrixAt(i, this.m4.makeScale(3.4, 1, 3.4).setPosition(p.x, p.y + 0.09, p.z));
    });
    this.halos.instanceMatrix.needsUpdate = true;
    this.pools.instanceMatrix.needsUpdate = true;
    this.picks = want;
    this.selected = n;
  }

  private picks: Record<string, Pick[]> = {};

  /** Write instance matrices (grow-in scale for the young ones). Returns true while something still grows. */
  private place(name: keyof typeof this.layers, list: Pick[], now: number): boolean {
    const L = this.layers[name];
    let growing = false;
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      const age = (now - L.born[i]) / GROW;
      let g = 1;
      if (age < 1) { growing = true; const t = Math.max(0, age); g = 1 - (1 - t) ** 3 * (1 - 1.4 * t); g = Math.max(0.02, Math.min(1.08, g)); }
      const s = L.scale[i] * g;
      this.q.setFromAxisAngle(this.up, p.rot);
      this.m4.compose(this.v.set(p.x, p.y - 0.02, p.z), this.q, this.s.set(s, s, s));
      L.mesh.setMatrixAt(i, this.m4);
    }
    L.mesh.instanceMatrix.needsUpdate = true;
    return growing;
  }

  /** The view turned past PROP_VIEW.yaw / .pitch (or its lens changed) since the last selection. */
  private turned(camera: THREE.PerspectiveCamera, now: number): boolean {
    const v = this.view;
    if (!v) return true;
    if (now - v.at < PROP_VIEW.minGap) return false;
    camera.getWorldDirection(this.dir);
    const yaw = Math.atan2(this.dir.x, this.dir.z), pitch = Math.asin(Math.max(-1, Math.min(1, this.dir.y)));
    const dyaw = Math.abs(((yaw - v.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
    const R = THREE.MathUtils.degToRad;
    return dyaw > R(PROP_VIEW.yaw) || Math.abs(pitch - v.pitch) > R(PROP_VIEW.pitch) || camera.fov !== v.fov || Math.abs(camera.aspect - v.aspect) > 0.01;
  }

  private setView(camera: THREE.PerspectiveCamera, now: number) {
    camera.getWorldDirection(this.dir);
    widenedFrustum(camera, PROP_VIEW.widen, this.wide, this.wideCam);
    this.view = { yaw: Math.atan2(this.dir.x, this.dir.z), pitch: Math.asin(Math.max(-1, Math.min(1, this.dir.y))), fov: camera.fov, aspect: camera.aspect, at: now, cx: camera.position.x, cz: camera.position.z };
  }

  /**
   * Per frame: re-select after 12 u of focus movement, a new source, a new height step (camH = camera height above the
   * ground) or, with a camera, a turn of the view (PROP_VIEW).
   */
  update(fx: number, fz: number, now: number, camH = 0, camera?: THREE.Camera) {
    const caps = propCaps(camH);
    if (caps.step !== this.caps.step) { this.caps = caps; this.dirty = true; }
    const cam = (camera as THREE.PerspectiveCamera | undefined)?.isPerspectiveCamera ? camera as THREE.PerspectiveCamera : null;
    const moved = this.dirty || Math.hypot(fx - this.lastX, fz - this.lastZ) > RESELECT;
    if (moved || (cam && this.turned(cam, now))) {
      this.lastX = fx; this.lastZ = fz; this.dirty = false;
      if (cam) this.setView(cam, now); else this.view = null;
      this.select(fx, fz, now, moved);
      this.growing = true;
    } else if (this.growing) {
      let any = false;
      for (const name of Object.keys(this.layers) as (keyof typeof this.layers)[]) if (this.place(name, this.picks[name] ?? [], now)) any = true;
      this.growing = any;
    }
    const night = U.uNight.value > 0.02;
    this.halos.visible = night;
    this.pools.visible = night;
    this.stepCanopyFade();
  }

  counts() {
    const out: Record<string, number> = {};
    for (const [k, L] of Object.entries(this.layers)) out[k] = L.mesh.count;
    return out;
  }

  dispose() {
    U.uCanopy.value.w = 0;
    for (const L of Object.values(this.layers)) { L.mesh.geometry.dispose(); L.mesh.dispose(); }
    this.halos.geometry.dispose(); this.halos.dispose();
    this.pools.geometry.dispose(); this.pools.dispose();
  }
}
