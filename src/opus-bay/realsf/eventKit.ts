import * as THREE from 'three';
import type { Info } from '../world/builder';
import { BOX, CONE, CYL, ICO, M, Batch } from '../world/builder';
import { patchToyShader } from '../world/materials';
import type { KitKind } from './eventVenues';

/**
 * Wave 5 · lane R (W5-R3) · the small toy kit that stands at a San Francisco event during its real window (plan §3.3
 * item 2): music → a toy stage with speakers and picnic blankets on the lawn (Hardly Strictly); fair → three stall tents
 * under bunting (Chowder Fest, the science festival); street → a tall festival arch over a narrow street (the Castro fair); festival → a low stage, two tents and bunting (Yerba Buena Gardens); parade → a bunting
 * arch with balloons at the route start; board → a sandwich board with a blank poster at the door (indoor events).
 * Toy shapes and colours only: no lettering, no logos, no real performers.
 *
 * One merged geometry per kit (≤ 1.5k triangles, one draw call) in world space, on the kit material: a plain-Mesh toy
 * material of its own (world/materials.ts patchToyShader, no sway) whose program key is TOY_DYN's, so it links no new
 * program; realsf/presence.ts registers its warm-up (world/warmup.ts meshWarmup) all the same.
 */

/** The kits' material: plain Meshes only (every kit mesh), never another kind of object. */
export function makeKitMaterial(): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.86, metalness: 0 });
  m.name = 'ob-realsf-kit';
  m.onBeforeCompile = shader => { patchToyShader(shader, { sway: false }); };
  m.customProgramCacheKey = () => 'ob-toy-dyn';
  return m;
}

export const KIT_TRIS_MAX = 1500;
/** Each kind's footprint in its local frame [x0, x1, z0, z1] (u): kept on open ground, off the car lanes (tests). */
export const KIT_FOOTPRINT: Readonly<Record<KitKind, readonly [number, number, number, number]>> = {
  music: [-8, 8, -3, 3.5], fair: [-5.5, 5.5, -1.5, 2], festival: [-7.5, 7.5, -2, 7], parade: [-4.5, 4.5, -0.5, 0.5], street: [-2.1, 2.1, -0.3, 0.3], board: [-0.6, 0.6, -0.4, 0.4],
};

const CORAL = '#e8705a', TEAL = '#3f8f8a', CREAM = '#f3e6c8', MUSTARD = '#e0a94a', NAVY = '#34506b', WOOD = '#9a6b45';
const DARK = '#3b3a40', WHITE = '#f5f1e8', PLUM = '#8a5a8c', LEAF = '#7fb069', SKY = '#5b8fd1', RED = '#d9534f';
const FLAGS = [CORAL, MUSTARD, TEAL, CREAM, SKY, PLUM];
/** glow at night ((0, 1]: lit windows / bulbs in the toy shader's night light) */
const BULB: Info = [0, 0, 0, 0.9];

interface Frame { x: number; z: number; cos: number; sin: number; ground: (x: number, z: number) => number }

/** A kit writer in its local frame: +z = the front (the audience / the walkway), +x = its right. */
class KitWriter {
  readonly b = new Batch();
  private readonly f: Frame;
  private readonly yaw: number;
  constructor(f: Frame, yaw: number) { this.f = f; this.yaw = yaw; }
  /** local → world (x, z) */
  w(lx: number, lz: number): { x: number; z: number } {
    const { x, z, cos, sin } = this.f;
    return { x: x + lx * cos + lz * sin, z: z - lx * sin + lz * cos };
  }
  /** ground height under a local point */
  gy(lx: number, lz: number): number { const p = this.w(lx, lz); return this.f.ground(p.x, p.z); }
  /** a box: centre (lx, lz), base height `y` above the local ground at `yAt` (default: its own centre), size, turn */
  box(lx: number, lz: number, y: number, sx: number, sy: number, sz: number, color: string, turn = 0, info?: Info, groundAt?: [number, number]) {
    const p = this.w(lx, lz);
    const g = groundAt ? this.gy(groundAt[0], groundAt[1]) : this.gy(lx, lz);
    this.b.add(BOX(), M(p.x, g + y, p.z, this.yaw + turn, sx, sy, sz), color, info);
  }
  cyl(lx: number, lz: number, y: number, r: number, h: number, color: string, seg = 6, groundAt?: [number, number]) {
    const p = this.w(lx, lz);
    const g = groundAt ? this.gy(groundAt[0], groundAt[1]) : this.gy(lx, lz);
    this.b.add(CYL(seg), M(p.x, g + y, p.z, 0, r, h, r), color);
  }
  /** a four-sided tent roof (a pyramid) */
  roof(lx: number, lz: number, y: number, w: number, h: number, color: string, groundAt?: [number, number]) {
    const p = this.w(lx, lz);
    const g = groundAt ? this.gy(groundAt[0], groundAt[1]) : this.gy(lx, lz);
    this.b.add(CONE(4), M(p.x, g + y, p.z, this.yaw + Math.PI / 4, w * 0.72, h, w * 0.72), color);
  }
  ball(lx: number, lz: number, y: number, r: number, color: string, groundAt?: [number, number]) {
    const p = this.w(lx, lz);
    const g = groundAt ? this.gy(groundAt[0], groundAt[1]) : this.gy(lx, lz);
    this.b.add(ICO(0), M(p.x, g + y, p.z, 0, r, r * 1.15, r), color);
  }
  /** a string of little triangle flags from local a to local b, sagging, at height y (above the ground at a) */
  bunting(ax: number, az: number, bx: number, bz: number, y: number, count: number, sag = 0.5) {
    const g0 = this.gy(ax, az), g1 = this.gy(bx, bz);
    const dx = bx - ax, dz = bz - az;
    // the flags face the kit's front (two faces: seen from both sides)
    const nf = this.w(0, 1), o = this.w(0, 0);
    const front = new THREE.Vector3(nf.x - o.x, 0, nf.z - o.z).normalize(), back = front.clone().negate();
    const sagAt = (t: number) => y - sag * 4 * t * (1 - t) + (g0 + (g1 - g0) * t);
    for (let i = 0; i < count; i++) {
      const t0 = (i + 0.15) / count, t1 = (i + 0.85) / count, tm = (i + 0.5) / count;
      const a = this.w(ax + dx * t0, az + dz * t0), c = this.w(ax + dx * t1, az + dz * t1), m = this.w(ax + dx * tm, az + dz * tm);
      const A = new THREE.Vector3(a.x, sagAt(t0), a.z), C = new THREE.Vector3(c.x, sagAt(t1), c.z), Mv = new THREE.Vector3(m.x, sagAt(tm) - 0.55, m.z);
      const color = FLAGS[i % FLAGS.length];
      this.b.tri(A, Mv, C, color, NO, front);
      this.b.tri(A, C, Mv, color, NO, back);
    }
  }
}
const NO: Info = [0, 0, 0, 0];

function tent(k: KitWriter, lx: number, lz: number, color: string, stripe: string, goods: string[]) {
  const w = 2.8, d = 2.2, post = 2.1;
  const at: [number, number] = [lx, lz];
  for (const [px, pz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) k.box(lx + px * (w / 2 - 0.1), lz + pz * (d / 2 - 0.1), 0, 0.12, post, 0.12, WHITE, 0, undefined, at);
  k.roof(lx, lz, post, w + 0.5, 1.1, color, at);
  // a striped valance along the front and the counter with its goods
  k.box(lx, lz + d / 2, post - 0.35, w + 0.1, 0.35, 0.06, stripe, 0, undefined, at);
  k.box(lx, lz + d / 2 - 0.45, 0, w - 0.3, 0.95, 0.7, WOOD, 0, undefined, at);
  goods.forEach((c, i) => k.box(lx - 0.8 + i * 0.8, lz + d / 2 - 0.45, 0.95, 0.45, 0.3, 0.4, c, i * 0.3, undefined, at));
}

function stage(k: KitWriter, w: number, d: number, h: number, back: number) {
  const at: [number, number] = [0, 0];
  k.box(0, 0, 0, w, h, d, WOOD, 0, undefined, at);
  k.box(0, -d / 2 + 0.15, h, w, back, 0.3, NAVY, 0, undefined, at);
  // a coral and mustard banner across the back (no lettering)
  k.box(0, -d / 2 + 0.33, h + back * 0.62, w * 0.72, back * 0.22, 0.05, CORAL, 0, undefined, at);
  k.box(0, -d / 2 + 0.34, h + back * 0.47, w * 0.72, back * 0.07, 0.05, MUSTARD, 0, undefined, at);
}

function blankets(k: KitWriter, spots: [number, number, number][]) {
  const colors = [RED, SKY, MUSTARD, LEAF, PLUM, TEAL, CORAL];
  spots.forEach(([x, z, turn], i) => {
    k.box(x, z, 0.02, 2.2, 0.05, 1.6, colors[i % colors.length], turn);
    // a picnic basket or a cooler on some
    if (i % 2 === 0) k.box(x + 0.6, z - 0.3, 0.07, 0.5, 0.35, 0.35, i % 4 ? WOOD : SKY, turn);
  });
}

function music(k: KitWriter) {
  const w = 9, d = 5.5, h = 0.9, back = 4.2;
  stage(k, w, d, h, back);
  const at: [number, number] = [0, 0];
  // a roof on four posts, bulbs along its front edge
  for (const px of [-1, 1]) for (const pz of [-1, 1]) k.box(px * (w / 2 - 0.2), pz * (d / 2 - 0.2), h, 0.22, back + 0.4, 0.22, DARK, 0, undefined, at);
  k.box(0, 0, h + back + 0.4, w + 0.8, 0.3, d + 0.6, CORAL, 0, undefined, at);
  for (let i = 0; i < 7; i++) k.box(-w / 2 + 0.8 + i * ((w - 1.6) / 6), d / 2 + 0.2, h + back + 0.2, 0.18, 0.18, 0.18, MUSTARD, 0, BULB, at);
  // speaker stacks at both wings
  for (const px of [-1, 1]) {
    k.box(px * (w / 2 + 0.9), d / 2 - 0.9, 0, 1.2, 1.3, 1.0, DARK);
    k.box(px * (w / 2 + 0.9), d / 2 - 0.9, 1.3, 1.0, 1.0, 0.9, DARK, 0, undefined, [px * (w / 2 + 0.9), d / 2 - 0.9]);
  }
  // three mic stands and a toy upright bass on the stage
  for (const px of [-2.4, 0, 2.4]) k.cyl(px, 0.9, h, 0.05, 1.5, DARK, 5, at);
  k.box(2.9, 0.2, h, 0.55, 1.6, 0.3, WOOD, 0.2, undefined, at);
  k.box(2.9, 0.2, h + 1.6, 0.12, 0.6, 0.12, DARK, 0.2, undefined, at);
  // bunting from the roof corners out to two poles by the lawn
  for (const px of [-1, 1]) k.cyl(px * 7.5, d / 2 + 6, 0, 0.1, 3.4, WHITE, 5);
  k.bunting(-w / 2 - 0.3, d / 2 + 0.2, -7.5, d / 2 + 6, h + back, 6);
  k.bunting(w / 2 + 0.3, d / 2 + 0.2, 7.5, d / 2 + 6, h + back, 6);
  // blankets on the lawn in front (people sit and listen: the crowd stands behind them)
  blankets(k, [[-5.5, 9, 0.2], [-2.2, 8.5, -0.15], [1.4, 9.2, 0.1], [4.8, 8.6, -0.3], [-4, 12.2, 0.4], [0.2, 12.5, -0.1], [3.8, 12, 0.25]]);
}

function fair(k: KitWriter) {
  tent(k, -3.6, 0, CORAL, CREAM, [MUSTARD, SKY, RED]);
  tent(k, 0, 0.6, TEAL, CREAM, [LEAF, PLUM, MUSTARD]);
  tent(k, 3.6, 0, MUSTARD, CORAL, [CORAL, TEAL, CREAM]);
  k.bunting(-5.2, 1.2, 0, 1.9, 2.9, 5, 0.35);
  k.bunting(0, 1.9, 5.2, 1.2, 2.9, 5, 0.35);
}

function festival(k: KitWriter) {
  // a low stage for the drummers and dancers, two tents beside it, bunting over the lawn
  const at: [number, number] = [0, 0];
  k.box(0, 0, 0, 6, 0.5, 3.6, WOOD, 0, undefined, at);
  k.box(0, -1.65, 0.5, 6, 2.6, 0.25, TEAL, 0, undefined, at);
  k.box(0, -1.5, 1.9, 4.2, 0.6, 0.05, CORAL, 0, undefined, at);
  k.box(0, -1.49, 1.55, 4.2, 0.18, 0.05, MUSTARD, 0, undefined, at);
  // a ring of toy drums on the stage
  for (const [dx, dz] of [[-1.6, 0.4], [-0.5, 0.8], [0.6, 0.8], [1.7, 0.4]]) k.cyl(dx, dz, 0.5, 0.32, 0.7, [CORAL, MUSTARD, WOOD, TEAL][Math.round(dx + 2) % 4], 7, at);
  tent(k, -6, 1.5, CORAL, CREAM, [MUSTARD, LEAF, SKY]);
  tent(k, 6, 1.5, PLUM, CREAM, [CREAM, CORAL, TEAL]);
  for (const px of [-1, 1]) k.cyl(px * 3.6, 6.5, 0, 0.1, 3.2, WHITE, 5);
  k.bunting(-3.6, 6.5, 3.6, 6.5, 3.2, 8, 0.45);
  k.bunting(-3.2, -1.5, -3.6, 6.5, 3.2, 5, 0.3);
  k.bunting(3.2, -1.5, 3.6, 6.5, 3.2, 5, 0.3);
}

function parade(k: KitWriter) {
  // an arch of two poles and a bunting line at the route start, balloon bunches on the poles
  for (const px of [-1, 1]) {
    k.cyl(px * 4.2, 0, 0, 0.14, 4.6, WHITE, 6);
    [CORAL, MUSTARD, SKY, LEAF].forEach((c, i) => k.ball(px * 4.2 + (i % 2 ? 0.35 : -0.35), (i < 2 ? 0.3 : -0.3), 4.8 + (i % 3) * 0.3, 0.42, c, [px * 4.2, 0]));
  }
  k.box(0, 0, 4.1, 8.4, 0.5, 0.08, CORAL, 0, undefined, [0, 0]);
  k.box(0, 0, 3.85, 8.4, 0.12, 0.09, MUSTARD, 0, undefined, [0, 0]);
  k.bunting(-4.2, 0.1, 4.2, 0.1, 3.7, 9, 0.6);
}

/** A festival arch over a narrow street: poles at the curbs (±1.9 u), a banner and bunting high enough for anything on
 *  the street to pass under (≥ 4 u above the road), balloon bunches at the pole tops, small pennants down the poles. */
function street(k: KitWriter) {
  const half = 1.9, top = 6.4;
  const at: [number, number] = [0, 0];
  for (const px of [-1, 1]) {
    k.cyl(px * half, 0, 0, 0.13, top, WHITE, 6, at);
    [CORAL, MUSTARD, SKY, LEAF, PLUM].forEach((c, i) => k.ball(px * half + (i % 2 ? 0.32 : -0.32), (i < 2 ? 0.28 : i < 4 ? -0.28 : 0), top + 0.25 + (i % 3) * 0.3, 0.38, c, at));
    // three small pennants down each pole, on its sidewalk side (nothing low hangs over the roadway)
    for (let j = 0; j < 3; j++) k.box(px * (half + 0.35), 0, 2.2 + j * 1.0, 0.55, 0.42, 0.05, FLAGS[(j + (px > 0 ? 3 : 0)) % FLAGS.length], 0, undefined, at);
  }
  k.box(0, 0, top - 0.9, half * 2 + 0.3, 0.62, 0.1, CORAL, 0, undefined, at);
  k.box(0, 0, top - 1.18, half * 2 + 0.3, 0.16, 0.11, MUSTARD, 0, undefined, at);
  k.bunting(-half, 0.08, half, 0.08, top - 1.35, 5, 0.25);
  k.bunting(-half, -0.08, half, -0.08, top - 1.35, 5, 0.25);
}

function board(k: KitWriter) {
  // an A-frame sandwich board: two leaning panels with a blank coral poster and a mustard strip on each, a balloon pair
  const at: [number, number] = [0, 0];
  for (const side of [-1, 1]) {
    k.box(0, side * 0.22, 0, 0.9, 1.25, 0.05, WOOD, 0, undefined, at);
    k.box(0, side * 0.25, 0.25, 0.7, 0.75, 0.07, side > 0 ? CORAL : TEAL, 0, undefined, at);
    k.box(0, side * 0.26, 0.95, 0.7, 0.12, 0.08, MUSTARD, 0, undefined, at);
  }
  k.cyl(0.7, 0, 0, 0.03, 1.9, WHITE, 4, at);
  k.ball(0.62, 0.05, 1.95, 0.28, CORAL, at);
  k.ball(0.85, -0.08, 2.1, 0.26, MUSTARD, at);
}

const BUILDERS: Record<KitKind, (k: KitWriter) => void> = { music, fair, festival, parade, street, board };

/** The kit's merged geometry in world space at (x, z) facing `yaw` (its front = local +z turned by yaw). */
export function buildKitGeometry(kind: KitKind, at: { x: number; z: number; yaw: number }, ground: (x: number, z: number) => number): THREE.BufferGeometry {
  const k = new KitWriter({ x: at.x, z: at.z, cos: Math.cos(at.yaw), sin: Math.sin(at.yaw), ground }, at.yaw);
  BUILDERS[kind](k);
  return k.b.build();
}

/** Where the E prompt (看看活动) sits: in front of the kit, reachable from its crowd. */
export function kitPrompt(kind: KitKind, at: { x: number; z: number; yaw: number }): { x: number; z: number; r: number } {
  const cos = Math.cos(at.yaw), sin = Math.sin(at.yaw);
  const w = (lx: number, lz: number) => ({ x: at.x + lx * cos + lz * sin, z: at.z - lx * sin + lz * cos });
  switch (kind) {
    case 'music': return { ...w(0, 5), r: 8 };
    case 'festival': return { ...w(0, 3.5), r: 7 };
    case 'fair': return { ...w(0, 2.8), r: 6 };
    case 'parade': return { ...w(0, 0), r: 5 };
    case 'street': return { ...w(0, 0), r: 5 };
    case 'board': return { ...w(0, 0.9), r: 3 };
  }
}

/** Where the crowd stands for a kit (local: in front of it, facing it), in world units. */
export function kitCrowd(kind: KitKind, at: { x: number; z: number; yaw: number }): { center: { x: number; z: number }; r: number; face: { x: number; z: number }; count: number } | null {
  const cos = Math.cos(at.yaw), sin = Math.sin(at.yaw);
  const w = (lx: number, lz: number) => ({ x: at.x + lx * cos + lz * sin, z: at.z - lx * sin + lz * cos });
  switch (kind) {
    case 'music': return { center: w(0, 15.5), r: 6.5, face: w(0, 0), count: 18 };
    case 'festival': return { center: w(0, 9), r: 5, face: w(0, 0), count: 14 };
    case 'fair': return { center: w(0, 5.5), r: 4.5, face: w(0, 1), count: 12 };
    case 'parade': return { center: w(0, 4), r: 4.5, face: w(0, 0), count: 14 };
    // a narrow street: no room for standers beside T's 3 u clear lane (the city's own walkers fill it)
    case 'street': return null;
    case 'board': return null;
  }
}
