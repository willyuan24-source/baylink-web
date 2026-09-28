import * as THREE from 'three';
import type { Polygon, Vec2 } from '../core/types';

/**
 * Tiny geometry kit for the world module. Everything static is appended into a few `Batch`es
 * (position + normal + color + aInfo vec4) and turned into one BufferGeometry per material, so the
 * whole district renders in a handful of draw calls.
 *
 * aInfo meaning depends on the material (see materials.ts):
 *   ground: x = pattern id, y = pattern angle, w = source flag (0 hero, GROUND_CITY = streamed city ground)
 *   toy:    x = window style, y = base height for window floors, z = sway weight (> 0) or −building seed (< 0),
 *           w = glow ((0,1] at night, (1,2] always; ≤ −1 = never dither-fade)
 *
 * Storage backends: `Batch` (below, the hero district) and `TypedBatch` (typedBatch.ts, streamed city, 36 B/vertex,
 * worker-safe). Recipes take a `BatchLike` and never care which one they write into.
 */

export type Info = readonly [number, number, number, number];
export const NO_INFO: Info = [0, 0, 0, 0];
export type ColorLike = THREE.Color | string;

const colorCache = new Map<string, THREE.Color>();
/** sRGB hex → cached linear THREE.Color (do not mutate). */
export function C(hex: string): THREE.Color {
  let c = colorCache.get(hex);
  if (!c) { c = new THREE.Color(hex); colorCache.set(hex, c); }
  return c;
}
const toColor = (c: ColorLike) => (typeof c === 'string' ? C(c) : c);
/** Multiply a color (returns a new color). */
export const shade = (c: ColorLike, k: number) => toColor(c).clone().multiplyScalar(k);
export const mixColor = (a: ColorLike, b: ColorLike, t: number) => toColor(a).clone().lerp(toColor(b), t);

// Seeded RNG (mulberry32) — the world is deterministic; also keeps React render functions pure.
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** Stable 0..1 hash of two numbers. */
export function hash2(x: number, z: number) {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

// ---------------------------------------------------------------------------
// Matrices
// ---------------------------------------------------------------------------

const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
/** Compose a matrix: translate (x, y, z), rotate (rx, ry, rz order YXZ), scale (sx, sy, sz). */
export function M(x = 0, y = 0, z = 0, ry = 0, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0): THREE.Matrix4 {
  _e.set(rx, ry, rz, 'YXZ');
  _q.setFromEuler(_e);
  return new THREE.Matrix4().compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz));
}
/** A local frame (origin + yaw) used to author a model in local units then place it. */
export class Frame {
  m: THREE.Matrix4;
  constructor(x: number, y: number, z: number, ry = 0, scale = 1) { this.m = M(x, y, z, ry, scale, scale, scale); }
  /** frame · local transform */
  at(x = 0, y = 0, z = 0, ry = 0, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0): THREE.Matrix4 {
    return this.m.clone().multiply(M(x, y, z, ry, sx, sy, sz, rx, rz));
  }
  /** World position of a local point. */
  point(x: number, y: number, z: number): THREE.Vector3 { return new THREE.Vector3(x, y, z).applyMatrix4(this.m); }
}

// ---------------------------------------------------------------------------
// Primitive cache (unit shapes, origin at bottom centre unless noted)
// ---------------------------------------------------------------------------

const prim = new Map<string, THREE.BufferGeometry>();
function cached(key: string, make: () => THREE.BufferGeometry) {
  let g = prim.get(key);
  if (!g) { g = make(); prim.set(key, g); }
  return g;
}
/** 1×1×1 box, origin at the bottom centre. */
export const BOX = () => cached('box', () => new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0));
/** 1×1×1 box centred. */
export const CBOX = () => cached('cbox', () => new THREE.BoxGeometry(1, 1, 1));
/** Cylinder r=1 h=1 bottom at 0 (radiusTop ratio configurable). */
export const CYL = (seg = 8, top = 1, open = false) => cached(`cyl${seg}-${top}-${open}`, () => new THREE.CylinderGeometry(top, 1, 1, seg, 1, open).translate(0, 0.5, 0));
export const CONE = (seg = 8) => cached(`cone${seg}`, () => new THREE.ConeGeometry(1, 1, seg, 1).translate(0, 0.5, 0));
export const SPHERE = (w = 10, h = 7) => cached(`sph${w}-${h}`, () => new THREE.SphereGeometry(1, w, h));
export const ICO = (detail = 1) => cached(`ico${detail}`, () => new THREE.IcosahedronGeometry(1, detail));
/** Cylinder with several height segments (for ring bands via addFlat). */
export const CYLH = (seg = 8, top = 1, hseg = 4) => cached(`cylh${seg}-${top}-${hseg}`, () => new THREE.CylinderGeometry(top, 1, 1, seg, hseg, true).translate(0, 0.5, 0));
/** Extruded plan outline (local x/z points) from y0 to y1. */
export function extrudeXZ(outline: { x: number; z: number }[], y0: number, y1: number): THREE.BufferGeometry {
  const shape = new THREE.Shape(outline.map(p => new THREE.Vector2(p.x, -p.z)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: y1 - y0, bevelEnabled: false, curveSegments: 4 });
  g.rotateX(-Math.PI / 2);
  g.translate(0, y0, 0);
  return g;
}
/** Hemisphere dome r=1, base at 0. */
export const DOME = (w = 12, h = 5) => cached(`dome${w}-${h}`, () => new THREE.SphereGeometry(1, w, h, 0, Math.PI * 2, 0, Math.PI / 2));
/** Torus in the XY plane (ring facing +Z). */
export const TORUS = (r = 1, tube = 0.1, rs = 6, ts = 16, arc = Math.PI * 2) => cached(`tor${r}-${tube}-${rs}-${ts}-${arc.toFixed(3)}`, () => new THREE.TorusGeometry(r, tube, rs, ts, arc));

// ---------------------------------------------------------------------------
// Batch
// ---------------------------------------------------------------------------

const _v = new THREE.Vector3();
const _n = new THREE.Vector3();
const _nm = new THREE.Matrix3();
export type ColorFn = (x: number, y: number, z: number, lx: number, ly: number, lz: number) => THREE.Color;
export type InfoFn = (x: number, y: number, z: number, lx: number, ly: number, lz: number) => Info;

/**
 * The geometry-writing surface every recipe / landmark builder uses. `Batch` (number[] arrays) implements it;
 * compact typed-array batches for the streamed city implement it too, so recipes stay backend-agnostic.
 */
export interface BatchLike {
  readonly vertexCount: number;
  add(geo: THREE.BufferGeometry, m: THREE.Matrix4, color: ColorLike | ColorFn, info?: Info | InfoFn): this;
  addFlat(geo: THREE.BufferGeometry, m: THREE.Matrix4, color: ColorFn, info?: Info): this;
  vert(x: number, y: number, z: number, nx: number, ny: number, nz: number, c: THREE.Color, info?: Info): number;
  tri(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, color: ColorLike, info?: Info, n?: THREE.Vector3): this;
  quad(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, n: THREE.Vector3, color: ColorLike | [ColorLike, ColorLike, ColorLike, ColorLike], info?: Info): this;
  polygon(poly: Polygon, y: number | ((x: number, z: number) => number), color: ColorLike | ((x: number, z: number) => THREE.Color), info?: Info, down?: boolean): this;
  walls(poly: Polygon, y0: number | ((x: number, z: number) => number), y1: number | ((x: number, z: number) => number), color: ColorLike, info?: Info, bottomColor?: ColorLike): this;
  prism(poly: Polygon, y0: number, y1: number, wall: ColorLike, top: ColorLike, info?: Info, bottomAO?: number): this;
  ribbon(points: Vec2[], w: number, yFn: (x: number, z: number) => number, color: ColorLike | ((i: number, side: number) => THREE.Color), info?: Info, step?: number): this;
  beam(a: THREE.Vector3, b: THREE.Vector3, w: number, h: number, color: ColorLike, info?: Info): this;
}

/**
 * Every recipe-facing method, written once over three primitives the storage backends provide: `vert()`
 * (append one vertex), `index3()` (append one triangle) and `px()`/`pz()` (read back a position). `Batch`
 * (number[] arrays, the hero district) and `TypedBatch` (typedBatch.ts: compact growable typed arrays for the
 * streamed city, worker-safe) both extend it, so a recipe writes the same geometry into either.
 */
export abstract class BatchBase implements BatchLike {
  abstract get vertexCount(): number;
  /** Raw vertex; returns its index. */
  abstract vert(x: number, y: number, z: number, nx: number, ny: number, nz: number, c: THREE.Color, info?: Info): number;
  /** Append one triangle (vertex indices). */
  protected abstract index3(a: number, b: number, c: number): void;
  /** x / z of an already written vertex. */
  protected abstract px(i: number): number;
  protected abstract pz(i: number): number;

  /** Append a (cached) geometry transformed by m. */
  add(geo: THREE.BufferGeometry, m: THREE.Matrix4, color: ColorLike | ColorFn, info: Info | InfoFn = NO_INFO): this {
    const p = geo.getAttribute('position') as THREE.BufferAttribute;
    const n = geo.getAttribute('normal') as THREE.BufferAttribute;
    const base = this.vertexCount;
    _nm.getNormalMatrix(m);
    const cf = typeof color === 'function' ? color : null;
    const cc = cf ? null : toColor(color as ColorLike);
    const inf = typeof info === 'function' ? info : null;
    const flip = m.determinant() < 0;
    for (let i = 0; i < p.count; i++) {
      const lx = p.getX(i), ly = p.getY(i), lz = p.getZ(i);
      _v.set(lx, ly, lz).applyMatrix4(m);
      _n.set(n.getX(i), n.getY(i), n.getZ(i)).applyMatrix3(_nm).normalize();
      const c = cf ? cf(_v.x, _v.y, _v.z, lx, ly, lz) : cc!;
      const f = inf ? inf(_v.x, _v.y, _v.z, lx, ly, lz) : (info as Info);
      this.vert(_v.x, _v.y, _v.z, _n.x, _n.y, _n.z, c, f);
    }
    const index = geo.getIndex();
    if (index) {
      for (let i = 0; i < index.count; i += 3) {
        const a = index.getX(i), b = index.getX(i + 1), c = index.getX(i + 2);
        if (flip) this.index3(base + a, base + c, base + b); else this.index3(base + a, base + b, base + c);
      }
    } else {
      for (let i = 0; i < p.count; i += 3) {
        if (flip) this.index3(base + i, base + i + 2, base + i + 1); else this.index3(base + i, base + i + 1, base + i + 2);
      }
    }
    return this;
  }

  /** Like add(), but each triangle gets one colour from its centroid (crisp stripes / bands). */
  addFlat(geo: THREE.BufferGeometry, m: THREE.Matrix4, color: ColorFn, info: Info = NO_INFO): this {
    const p = geo.getAttribute('position') as THREE.BufferAttribute;
    const n = geo.getAttribute('normal') as THREE.BufferAttribute;
    const index = geo.getIndex();
    _nm.getNormalMatrix(m);
    const flip = m.determinant() < 0;
    const count = index ? index.count : p.count;
    const w = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
    const nn = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
    for (let t = 0; t < count; t += 3) {
      let lx = 0, ly = 0, lz = 0;
      for (let k = 0; k < 3; k++) {
        const i = index ? index.getX(t + k) : t + k;
        lx += p.getX(i) / 3; ly += p.getY(i) / 3; lz += p.getZ(i) / 3;
        w[k].set(p.getX(i), p.getY(i), p.getZ(i)).applyMatrix4(m);
        nn[k].set(n.getX(i), n.getY(i), n.getZ(i)).applyMatrix3(_nm).normalize();
      }
      const cx = (w[0].x + w[1].x + w[2].x) / 3, cy = (w[0].y + w[1].y + w[2].y) / 3, cz = (w[0].z + w[1].z + w[2].z) / 3;
      const c = color(cx, cy, cz, lx, ly, lz);
      const order = flip ? [0, 2, 1] : [0, 1, 2];
      const ids = order.map(k => this.vert(w[k].x, w[k].y, w[k].z, nn[k].x, nn[k].y, nn[k].z, c, info));
      this.index3(ids[0], ids[1], ids[2]);
    }
    return this;
  }

  /** Flat triangle; the winding is fixed so its face normal matches `n` (if given). */
  tri(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, color: ColorLike, info: Info = NO_INFO, n?: THREE.Vector3): this {
    const ab = _v.subVectors(b, a), ac = _n.subVectors(c, a);
    const fn = new THREE.Vector3().crossVectors(ab, ac);
    if (fn.lengthSq() < 1e-12) return this;
    fn.normalize();
    let B = b, Cc = c;
    if (n && fn.dot(n) < 0) { B = c; Cc = b; fn.negate(); }
    const nn = n ?? fn;
    const col = toColor(color);
    const i0 = this.vert(a.x, a.y, a.z, nn.x, nn.y, nn.z, col, info);
    const i1 = this.vert(B.x, B.y, B.z, nn.x, nn.y, nn.z, col, info);
    const i2 = this.vert(Cc.x, Cc.y, Cc.z, nn.x, nn.y, nn.z, col, info);
    this.index3(i0, i1, i2);
    return this;
  }

  /** Flat quad a-b-c-d (planar, in order around the edge) facing `n`. Optional per-edge colours (bottom darker etc.). */
  quad(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, n: THREE.Vector3, color: ColorLike | [ColorLike, ColorLike, ColorLike, ColorLike], info: Info = NO_INFO): this {
    const cols = Array.isArray(color) ? color.map(toColor) : [toColor(color), toColor(color), toColor(color), toColor(color)];
    const fn = new THREE.Vector3().crossVectors(_v.subVectors(b, a), _n.subVectors(c, a));
    const order = fn.dot(n) >= 0 ? [0, 1, 2, 3] : [0, 3, 2, 1];
    const pts = [a, b, c, d];
    const ids = order.map(k => this.vert(pts[k].x, pts[k].y, pts[k].z, n.x, n.y, n.z, cols[k], info));
    this.index3(ids[0], ids[1], ids[2]);
    this.index3(ids[0], ids[2], ids[3]);
    return this;
  }

  /** Horizontal polygon (world x/z) at height y, facing up (or down). */
  polygon(poly: Polygon, y: number | ((x: number, z: number) => number), color: ColorLike | ((x: number, z: number) => THREE.Color), info: Info = NO_INFO, down = false): this {
    if (poly.length < 3) return this;
    const contour = poly.map(p => new THREE.Vector2(p.x, p.z));
    const tris = THREE.ShapeUtils.triangulateShape(contour, []);
    const base = this.vertexCount;
    const ny = down ? -1 : 1;
    for (const p of poly) {
      const yy = typeof y === 'function' ? y(p.x, p.z) : y;
      const c = typeof color === 'function' ? color(p.x, p.z) : toColor(color);
      this.vert(p.x, yy, p.z, 0, ny, 0, c, info);
    }
    for (const t of tris) {
      const a = poly[t[0]], b = poly[t[1]], c = poly[t[2]];
      // cross of (b−a)×(c−a) y-component: positive → CCW seen from above (+y normal needs (x,z) clockwise in maths coords)
      const cy = (b.z - a.z) * (c.x - a.x) - (b.x - a.x) * (c.z - a.z);
      const up = cy > 0;
      if (up !== down) this.index3(base + t[0], base + t[1], base + t[2]);
      else this.index3(base + t[0], base + t[2], base + t[1]);
    }
    return this;
  }

  /** Vertical walls around a polygon from y0 to y1 (outward facing). Bottom row colour can differ (AO). */
  walls(poly: Polygon, y0: number | ((x: number, z: number) => number), y1: number | ((x: number, z: number) => number), color: ColorLike, info: Info = NO_INFO, bottomColor?: ColorLike): this {
    const s = signedArea(poly) >= 0 ? 1 : -1;
    const top = toColor(color), bot = bottomColor ? toColor(bottomColor) : top;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      const dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz);
      if (L < 1e-4) continue;
      const nx = (s * dz) / L, nz = (-s * dx) / L;
      const ya0 = typeof y0 === 'function' ? y0(a.x, a.z) : y0, yb0 = typeof y0 === 'function' ? y0(b.x, b.z) : y0;
      const ya1 = typeof y1 === 'function' ? y1(a.x, a.z) : y1, yb1 = typeof y1 === 'function' ? y1(b.x, b.z) : y1;
      this.quad(new THREE.Vector3(a.x, ya0, a.z), new THREE.Vector3(b.x, yb0, b.z), new THREE.Vector3(b.x, yb1, b.z), new THREE.Vector3(a.x, ya1, a.z), new THREE.Vector3(nx, 0, nz), [bot, bot, top, top], info);
    }
    return this;
  }

  /** Solid prism: walls + top (+ optional bottom). */
  prism(poly: Polygon, y0: number, y1: number, wall: ColorLike, top: ColorLike, info: Info = NO_INFO, bottomAO = 0.82): this {
    this.walls(poly, y0, y1, wall, info, shade(wall, bottomAO));
    this.polygon(poly, y1, top, info);
    return this;
  }

  /** Flat ribbon along a polyline (width w) at heights from yFn, facing up. */
  ribbon(points: Vec2[], w: number, yFn: (x: number, z: number) => number, color: ColorLike | ((i: number, side: number) => THREE.Color), info: Info = NO_INFO, step = 0): this {
    const pts = step > 0 ? resample(points, step) : points;
    if (pts.length < 2) return this;
    const base = this.vertexCount;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      const dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz) || 1;
      const px = -dz / L, pz = dx / L;
      for (const side of [-1, 1]) {
        const x = pts[i].x + px * side * w / 2, z = pts[i].z + pz * side * w / 2;
        const c = typeof color === 'function' ? color(i, side) : toColor(color);
        this.vert(x, yFn(x, z), z, 0, 1, 0, c, info);
      }
    }
    for (let i = 0; i < pts.length - 1; i++) {
      const a = base + i * 2, b = a + 1, c = a + 2, d = a + 3;
      // make it face up regardless of direction
      const ax = this.px(a), az = this.pz(a), bx = this.px(b), bz = this.pz(b), cx = this.px(c), cz = this.pz(c);
      const cy = (bz - az) * (cx - ax) - (bx - ax) * (cz - az);
      if (cy > 0) { this.index3(a, b, c); this.index3(b, d, c); } else { this.index3(a, c, b); this.index3(b, c, d); }
    }
    return this;
  }

  /** Thin box between two 3D points (beams, cables, rails). */
  beam(a: THREE.Vector3, b: THREE.Vector3, w: number, h: number, color: ColorLike, info: Info = NO_INFO): this {
    const d = new THREE.Vector3().subVectors(b, a);
    const L = d.length();
    if (L < 1e-4) return this;
    const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), d.normalize());
    const m = new THREE.Matrix4().compose(mid, q, new THREE.Vector3(w, h, L));
    return this.add(CBOX(), m, color, info);
  }
}

/** The hero district's batch: plain number[] attributes while building, float32 attributes on build(). */
export class Batch extends BatchBase {
  pos: number[] = [];
  nor: number[] = [];
  col: number[] = [];
  inf: number[] = [];
  idx: number[] = [];
  uv: number[] | null = null;

  get vertexCount() { return this.pos.length / 3; }

  /** Raw vertex. */
  vert(x: number, y: number, z: number, nx: number, ny: number, nz: number, c: THREE.Color, info: Info = NO_INFO): number {
    this.pos.push(x, y, z);
    this.nor.push(nx, ny, nz);
    this.col.push(c.r, c.g, c.b);
    this.inf.push(info[0], info[1], info[2], info[3]);
    return this.vertexCount - 1;
  }

  protected index3(a: number, b: number, c: number) { this.idx.push(a, b, c); }
  protected px(i: number) { return this.pos[i * 3]; }
  protected pz(i: number) { return this.pos[i * 3 + 2]; }

  merge(other: Batch): this {
    const base = this.vertexCount;
    this.pos.push(...other.pos); this.nor.push(...other.nor); this.col.push(...other.col); this.inf.push(...other.inf);
    for (const i of other.idx) this.idx.push(i + base);
    return this;
  }

  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('aInfo', new THREE.Float32BufferAttribute(this.inf, 4));
    const n = this.vertexCount;
    g.setIndex(n > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}

/**
 * Split an indexed geometry into spatial chunks (by triangle centroid on an xz grid) so that frustum
 * culling can skip the parts of the district that are off screen. All attributes are carried over.
 */
const _identity = new THREE.Matrix4();
/**
 * A static object built in world space (identity transform, under identity parents): never recompose its matrix and
 * never recompute its world matrix (wave 3, P2). The scene root recomposes itself every frame, which forces a
 * matrixWorld multiply on every object below it; objects frozen here skip it (their world matrix stays identity).
 * Objects with a real transform are left alone (only matrixAutoUpdate is switched off, as before).
 */
export function freezeStatic<T extends THREE.Object3D>(o: T): T {
  o.matrixAutoUpdate = false;
  if (o.matrix.equals(_identity) && o.matrixWorld.equals(_identity)) o.matrixWorldAutoUpdate = false;
  return o;
}

export function splitGeometry(geo: THREE.BufferGeometry, cell: number): THREE.BufferGeometry[] {
  return splitGeometryCells(geo, cell).map(c => c.geometry);
}

/**
 * splitGeometry with each chunk's grid cell (ix, iz): the chunk holds the triangles whose centroid lies in
 * [ix·cell, ix·cell + cell) × [iz·cell, iz·cell + cell). Same chunks, same order, same bytes. Wave 5 (W5-V2): the city
 * pairs the hero's near and far chunks by cell. A geometry without an index is one chunk at cell (0, 0).
 */
export function splitGeometryCells(geo: THREE.BufferGeometry, cell: number): { ix: number; iz: number; geometry: THREE.BufferGeometry }[] {
  const index = geo.getIndex();
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  if (!index) return [{ ix: 0, iz: 0, geometry: geo }];
  const names = Object.keys(geo.attributes);
  const buckets = new Map<string, { ix: number; iz: number; map: Map<number, number>; idx: number[]; data: Record<string, number[]> }>();
  for (let i = 0; i < index.count; i += 3) {
    const a = index.getX(i), b = index.getX(i + 1), c = index.getX(i + 2);
    const cx = (pos.getX(a) + pos.getX(b) + pos.getX(c)) / 3, cz = (pos.getZ(a) + pos.getZ(b) + pos.getZ(c)) / 3;
    const ix = Math.floor(cx / cell), iz = Math.floor(cz / cell);
    const key = `${ix}:${iz}`;
    let bk = buckets.get(key);
    if (!bk) { bk = { ix, iz, map: new Map(), idx: [], data: Object.fromEntries(names.map(n => [n, [] as number[]])) }; buckets.set(key, bk); }
    for (const v of [a, b, c]) {
      let ni = bk.map.get(v);
      if (ni === undefined) {
        ni = bk.map.size;
        bk.map.set(v, ni);
        for (const n of names) {
          const attr = geo.getAttribute(n) as THREE.BufferAttribute;
          for (let k = 0; k < attr.itemSize; k++) bk.data[n].push(attr.array[v * attr.itemSize + k] as number);
        }
      }
      bk.idx.push(ni);
    }
  }
  const out: { ix: number; iz: number; geometry: THREE.BufferGeometry }[] = [];
  for (const bk of buckets.values()) {
    const g = new THREE.BufferGeometry();
    for (const n of names) {
      const attr = geo.getAttribute(n) as THREE.BufferAttribute;
      g.setAttribute(n, new THREE.Float32BufferAttribute(bk.data[n], attr.itemSize));
    }
    g.setIndex(bk.map.size > 65535 ? new THREE.Uint32BufferAttribute(bk.idx, 1) : new THREE.Uint16BufferAttribute(bk.idx, 1));
    g.computeBoundingSphere();
    g.computeBoundingBox();
    out.push({ ix: bk.ix, iz: bk.iz, geometry: g });
  }
  geo.dispose();
  return out;
}

/** Shoelace area in the (x, z) plane: > 0 when counter-clockwise with x right and z up. */
export function signedArea(poly: Polygon): number {
  let a = 0;
  for (let i = 0; i < poly.length; i++) { const p = poly[i], q = poly[(i + 1) % poly.length]; a += p.x * q.z - q.x * p.z; }
  return a / 2;
}

/** Resample a polyline at a fixed step (keeps the corners). */
export function resample(points: Vec2[], step: number): Vec2[] {
  const out: Vec2[] = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    const L = Math.hypot(b.x - a.x, b.z - a.z);
    const n = Math.max(1, Math.ceil(L / step));
    for (let k = 1; k <= n; k++) out.push({ x: a.x + ((b.x - a.x) * k) / n, z: a.z + ((b.z - a.z) * k) / n });
  }
  return out;
}

export function polylineLength(points: Vec2[]) {
  let L = 0;
  for (let i = 1; i < points.length; i++) L += Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z);
  return L;
}

/** Point + direction at distance s along a polyline. */
export function alongPolyline(points: Vec2[], s: number): { x: number; z: number; dx: number; dz: number } {
  let rem = s;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    const L = Math.hypot(b.x - a.x, b.z - a.z);
    if (rem <= L || i === points.length - 1) {
      const t = L > 0 ? Math.max(0, Math.min(1, rem / L)) : 0;
      return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, dx: (b.x - a.x) / (L || 1), dz: (b.z - a.z) / (L || 1) };
    }
    rem -= L;
  }
  const p = points[points.length - 1];
  return { x: p.x, z: p.z, dx: 1, dz: 0 };
}

/** Longest edge direction of a polygon (for roof ridges). */
export function longestEdge(poly: Polygon): { dx: number; dz: number; len: number } {
  let best = { dx: 1, dz: 0, len: 0 };
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const L = Math.hypot(b.x - a.x, b.z - a.z);
    if (L > best.len) best = { dx: (b.x - a.x) / L, dz: (b.z - a.z) / L, len: L };
  }
  return best;
}

/** Shrink (inset) a convex-ish polygon towards its centroid by d units (approximate, for roofs/parapets). */
export function inset(poly: Polygon, d: number): Polygon {
  const cx = poly.reduce((s, p) => s + p.x, 0) / poly.length, cz = poly.reduce((s, p) => s + p.z, 0) / poly.length;
  return poly.map(p => {
    const dx = p.x - cx, dz = p.z - cz, L = Math.hypot(dx, dz) || 1;
    const k = Math.max(0, (L - d * 1.25) / L);
    return { x: cx + dx * k, z: cz + dz * k };
  });
}

export const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
