import * as THREE from 'three';
import type { Vec2 } from '../../../core/types';
import { BOX, type BatchLike, C, CBOX, CYL, type ColorLike, type Info, M, shade } from '../../builder';

/**
 * Shared toy-kit for the San Francisco landmark modules (lane D). Everything writes through `BatchLike`, in the
 * landmark's LOCAL frame: origin at the ground centre, +y up, the front faces +z. Colours are sRGB hex like the
 * rest of the world; aInfo follows the TOY conventions in world/materials.ts (x = window style, y = base height,
 * z = sway, w = glow). Base heights here are local; the registry shifts aInfo.y by the placed base height.
 */

export const NONE: Info = [0, 0, 0, 0];
/** glows at night with strength w (floodlit stone, lamp heads) */
export const GLOW = (w: number): Info => [0, 0, 0, w];
/** always self-lit (glass lanterns, marquee bulbs), 1 < w ≤ 2 */
export const SELF = (w = 1.15): Info => [0, 0, 0, w];
/** warm lit opening at night (arches, doors), brighter toward `base` */
export const LIT = (base = 0): Info => [7, base, 0, 0];
/** procedural window style on vertical faces (1 res, 2 office, 3 shop, 4 brick, 5 victorian, 6 glass) */
export const WIN = (style: number, base = 0, seed = 0): Info => [style, base, seed ? -seed : 0, 0];
/** trees and flags: wind sway weight */
export const SWAY = (w: number): Info => [0, 0, w, 0];

/** landmark palette additions (DESIGN §6 family: soft, matte, warm) */
export const SF = {
  ggb: '#c44a31',
  ggbLight: '#d45e43',
  ggbDark: '#9b3a27',
  ggbCable: '#b5432e',
  stone: '#ece4d2',
  stoneWarm: '#e6d7bd',
  stoneShade: '#d3c6ae',
  granite: '#dcd6ca',
  marble: '#f1ede4',
  stucco: '#f3ead8',
  adobe: '#f1e8d6',
  terracotta: '#c96f4c',
  tileRed: '#b95c3f',
  brick: '#a5553d',
  brickDark: '#8a4633',
  brickLight: '#bd6a4d',
  copper: '#8c6b4f',
  copperDark: '#6f5440',
  verdigris: '#86a79b',
  domeGrey: '#7c8f8f',
  gold: '#d9b25a',
  slate: '#6f7a80',
  roofGrey: '#7d7a78',
  glassDay: '#9fc3cc',
  dark: '#4f5654',
  arch: '#5a615e',
  lawn: '#9fbf7a',
  hedge: '#6f9a5b',
  flowers: ['#e58aa0', '#f2c14e', '#e46b54', '#b88ad8', '#f4f1e6'],
  asphalt: '#8d8983',
  concrete: '#cfc7b8',
  chinaGreen: '#4f8f6a',
  chinaGreenDark: '#3d7255',
  chinaRed: '#c2412f',
  chinaGold: '#e0b04e',
  white: '#f7f4ec',
  red: '#c9473a',
} as const;

const _m = new THREE.Matrix4();

/** Box from its bottom centre (x, y, z), size (w, h, d), yaw ry. */
export function box(b: BatchLike, x: number, y: number, z: number, w: number, h: number, d: number, color: ColorLike, info: Info = NONE, ry = 0) {
  b.add(BOX(), M(x, y, z, ry, w, h, d), color, info);
}
/** Box centred at (x, y, z). */
export function cbox(b: BatchLike, x: number, y: number, z: number, w: number, h: number, d: number, color: ColorLike, info: Info = NONE, ry = 0, rx = 0, rz = 0) {
  b.add(CBOX(), M(x, y, z, ry, w, h, d, rx, rz), color, info);
}
/** Vertical cylinder from its bottom centre. */
export function cyl(b: BatchLike, x: number, y: number, z: number, r: number, h: number, color: ColorLike, info: Info = NONE, seg = 8, top = 1, ry = 0) {
  b.add(CYL(seg, top), M(x, y, z, ry, r, h, r), color, info);
}

/** Straight segment between two local points as an open n-gon tube (cheaper than a box: no end caps). */
export function tube(b: BatchLike, a: THREE.Vector3, c: THREE.Vector3, r: number, color: ColorLike, info: Info = NONE, seg = 4) {
  const d = new THREE.Vector3().subVectors(c, a);
  const L = d.length();
  if (L < 1e-4) return;
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  _m.compose(a, q, new THREE.Vector3(r, L, r));
  b.add(CYL(seg, 1, true), _m.clone(), color, info);
}

/** Horizontal arch-shaped plate (door/window cut look) facing +z at (x, y, z), rotated by ry. */
const archCache = new Map<string, THREE.ShapeGeometry>();
export function archGeo(w: number, h: number, seg = 6) {
  const k = `${w.toFixed(2)}:${h.toFixed(2)}:${seg}`;
  let g = archCache.get(k);
  if (!g) {
    const s = new THREE.Shape();
    const r = w / 2;
    s.moveTo(-r, 0); s.lineTo(-r, Math.max(0, h - r)); s.absarc(0, Math.max(0, h - r), r, Math.PI, 0, true); s.lineTo(r, 0); s.lineTo(-r, 0);
    g = new THREE.ShapeGeometry(s, seg);
    archCache.set(k, g);
  }
  return g;
}
export function arch(b: BatchLike, x: number, y: number, z: number, w: number, h: number, ry: number, color: ColorLike, info: Info = NONE, seg = 6) {
  b.add(archGeo(w, h, seg), M(x, y, z, ry), color, info);
}

/** Lathe (surface of revolution) from a profile [r, y] bottom → top. */
const latheCache = new Map<string, THREE.LatheGeometry>();
export function lathe(b: BatchLike, profile: [number, number][], x: number, y: number, z: number, color: ColorLike | ((ly: number) => THREE.Color), info: Info = NONE, seg = 16, sx = 1, sz = 1) {
  const k = `${seg}|${profile.map(p => p.join(',')).join(';')}`;
  let g = latheCache.get(k);
  if (!g) { g = new THREE.LatheGeometry(profile.map(([r, yy]) => new THREE.Vector2(Math.max(r, 1e-3), yy)), seg); latheCache.set(k, g); }
  const m = M(x, y, z, 0, sx, 1, sz);
  if (typeof color === 'function') b.add(g, m, (_x, _y, _z, _lx, ly) => color(ly), info);
  else b.add(g, m, color, info);
}

/** Gable roof over a centred rectangle (ridge along local x) from eave height y0 rising `rise`. */
export function gable(b: BatchLike, x: number, y0: number, z: number, w: number, d: number, rise: number, roof: ColorLike, wall: ColorLike, ry = 0, over = 0.15, info: Info = NONE) {
  const c = Math.cos(ry), s = Math.sin(ry);
  const P = (u: number, yy: number, v: number) => new THREE.Vector3(x + u * c + v * s, yy, z - u * s + v * c);
  const hu = w / 2 + over, hv = d / 2 + over;
  const eave = y0 - over * (rise / (d / 2));
  for (const sd of [-1, 1]) {
    const n = new THREE.Vector3(s * sd * rise, d / 2, c * sd * rise).normalize();
    b.quad(P(-hu, eave, sd * hv), P(hu, eave, sd * hv), P(hu, y0 + rise, 0), P(-hu, y0 + rise, 0), n, [shade(roof, 0.9), shade(roof, 0.9), roof, roof], info);
  }
  for (const su of [-1, 1]) b.tri(P(su * w / 2, y0, -d / 2), P(su * w / 2, y0, d / 2), P(su * w / 2, y0 + rise, 0), wall, info, new THREE.Vector3(c * su, 0, -s * su));
}

/** Four-sided pyramid / hip cap over a centred rectangle. */
export function pyramid(b: BatchLike, x: number, y0: number, z: number, w: number, d: number, h: number, color: ColorLike, ry = 0, info: Info = NONE) {
  b.add(CYLPYR(), M(x, y0, z, ry + Math.PI / 4, w / Math.SQRT2, h, d / Math.SQRT2), color, info);
}
const CYLPYR = () => pyr ??= new THREE.ConeGeometry(1, 1, 4, 1).translate(0, 0.5, 0);
let pyr: THREE.BufferGeometry | undefined;

/** Rotate a local 2D offset by yaw (three.js convention: +z of the local frame → (sin ry, cos ry)). */
export function rot(p: Vec2, ry: number): Vec2 {
  const c = Math.cos(ry), s = Math.sin(ry);
  return { x: p.x * c + p.z * s, z: -p.x * s + p.z * c };
}
/** Local rectangle polygon (for walk blockers / surfaces) centred at (x, z), size w × d, yaw ry. */
export function rect(x: number, z: number, w: number, d: number, ry = 0): Vec2[] {
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => { const p = rot({ x: (u * w) / 2, z: (v * d) / 2 }, ry); return { x: x + p.x, z: z + p.z }; });
}
/** Regular polygon (local) for round footprints. */
export function ngon(x: number, z: number, r: number, n = 12, phase = 0): Vec2[] {
  return Array.from({ length: n }, (_, i) => { const a = phase + (i / n) * Math.PI * 2; return { x: x + Math.cos(a) * r, z: z + Math.sin(a) * r }; });
}

/** Flower bed: a low hedge-edged box with scattered bloom tufts (cheap: ~8 boxes). */
export function flowerBed(b: BatchLike, x: number, y: number, z: number, w: number, d: number, seed: number, ry = 0) {
  const c = Math.cos(ry), s = Math.sin(ry);
  box(b, x, y, z, w, 0.35, d, SF.hedge, SWAY(0.2), ry);
  const n = Math.max(2, Math.round((w * d) / 1.2));
  for (let i = 0; i < n; i++) {
    const h1 = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453, h2 = Math.sin(seed * 39.3468 + i * 11.135) * 24634.6345;
    const u = (h1 - Math.floor(h1) - 0.5) * (w - 0.3), v = (h2 - Math.floor(h2) - 0.5) * (d - 0.3);
    const col = SF.flowers[(i + seed) % SF.flowers.length];
    box(b, x + u * c + v * s, y + 0.3, z - u * s + v * c, 0.32, 0.16, 0.32, col, NONE, ry + i);
  }
}

/** Colour ramp helper for lathe profiles. */
export const band = (stops: [number, string][]) => (ly: number) => {
  for (const [y, col] of stops) if (ly <= y) return C(col);
  return C(stops[stops.length - 1][1]);
};

export { C, shade };

/**
 * Extrude a closed cross-section (points (z, dy) in the local y-z plane, dy relative to `y(x)`) along local x
 * between stations xs (y(x) linear between stations). One flat-shaded strip per section edge; `color(i)` colours
 * edge i. Used for bridge decks and viaducts: a whole deck with barriers and railings is ~100 triangles.
 */
export function sweepX(b: BatchLike, xs: number[], y: (x: number) => number, section: [number, number][], color: (edge: number) => ColorLike, info: Info = NONE) {
  const n = section.length;
  // orientation of the section (signed area in z-y): outward normal = rotate edge by −90° for CCW
  let area = 0;
  for (let i = 0; i < n; i++) { const [z0, y0] = section[i], [z1, y1] = section[(i + 1) % n]; area += z0 * y1 - z1 * y0; }
  const sgn = area >= 0 ? 1 : -1;
  for (let i = 0; i < n; i++) {
    const [z0, d0] = section[i], [z1, d1] = section[(i + 1) % n];
    const ez = z1 - z0, ey = d1 - d0, L = Math.hypot(ez, ey);
    if (L < 1e-5) continue;
    const nz = (sgn * ey) / L, ny = (-sgn * ez) / L;
    for (let k = 0; k < xs.length - 1; k++) {
      const xa = xs[k], xb = xs[k + 1], ya = y(xa), yb = y(xb);
      const nrm = new THREE.Vector3(0, ny, nz);
      // slope tilts the normal slightly; flat shading per quad is fine for toy decks
      b.quad(new THREE.Vector3(xa, ya + d0, z0), new THREE.Vector3(xb, yb + d0, z0), new THREE.Vector3(xb, yb + d1, z1), new THREE.Vector3(xa, ya + d1, z1), nrm, color(i), info);
    }
  }
  // end caps
  for (const [xe, dir] of [[xs[0], -1], [xs[xs.length - 1], 1]] as [number, number][]) {
    const ye = y(xe);
    const pts = section.map(([z, d]) => new THREE.Vector2(z, d));
    const tris = THREE.ShapeUtils.triangulateShape(pts, []);
    const nrm = new THREE.Vector3(dir, 0, 0);
    for (const t of tris) b.tri(new THREE.Vector3(xe, ye + section[t[0]][1], section[t[0]][0]), new THREE.Vector3(xe, ye + section[t[1]][1], section[t[1]][0]), new THREE.Vector3(xe, ye + section[t[2]][1], section[t[2]][0]), color(0), info, nrm);
  }
}

/** Local polygon → world polygon for a landmark placed at (x, z) with yaw (for `exclude.poly`). */
export function worldPoly(x: number, z: number, yaw: number, local: Vec2[]): Vec2[] {
  return local.map(p => { const r = rot(p, yaw); return { x: +(x + r.x).toFixed(2), z: +(z + r.z).toFixed(2) }; });
}

/** Connect consecutive rings (same vertex count, CCW seen from above) with flat quads; optional top cap. */
export function loftRings(b: BatchLike, rings: THREE.Vector3[][], color: (level: number, side: number) => ColorLike, info: Info | ((level: number) => Info) = NONE, cap: ColorLike | null = null) {
  const inf = (l: number) => (typeof info === 'function' ? info(l) : info);
  for (let l = 0; l < rings.length - 1; l++) {
    const A = rings[l], B = rings[l + 1];
    const cA = A.reduce((s, p) => s.add(p), new THREE.Vector3()).divideScalar(A.length);
    for (let i = 0; i < A.length; i++) {
      const j = (i + 1) % A.length;
      const mid = new THREE.Vector3().addVectors(A[i], A[j]).add(B[i]).add(B[j]).multiplyScalar(0.25);
      const n = new THREE.Vector3().crossVectors(new THREE.Vector3().subVectors(A[j], A[i]), new THREE.Vector3().subVectors(B[i], A[i])).normalize();
      if (n.dot(new THREE.Vector3().subVectors(mid, cA).setY(0)) < 0) n.negate();
      b.quad(A[i], A[j], B[j], B[i], n, color(l, i), inf(l));
    }
  }
  if (cap) {
    const T = rings[rings.length - 1];
    for (let i = 1; i < T.length - 1; i++) b.tri(T[0], T[i], T[i + 1], cap, inf(rings.length - 1), new THREE.Vector3(0, 1, 0));
  }
}

/** Prism from a local polygon (list of [x, z]) between y0 and y1 with an optional roof colour. */
export function prismXZ(b: BatchLike, pts: [number, number][], y0: number, y1: number, wall: ColorLike, roof: ColorLike | null, info: Info = NONE) {
  const poly = pts.map(([x, z]) => ({ x, z }));
  b.walls(poly, y0, y1, wall, info, shade(wall, 0.82));
  if (roof) b.polygon(poly, y1, roof, info);
}

/** Half-cylinder barrel vault along local x (glass-house wings), springing at y0 with radius r. */
export function vault(b: BatchLike, x: number, y0: number, z: number, length: number, r: number, color: ColorLike, info: Info = NONE, seg = 6, ry = 0, rib?: ColorLike) {
  const c = Math.cos(ry), s = Math.sin(ry);
  const P = (u: number, a: number) => { const v = Math.cos(a) * r, h = Math.sin(a) * r; return new THREE.Vector3(x + u * c + v * s, y0 + h, z - u * s + v * c); };
  const h = length / 2;
  for (let i = 0; i < seg; i++) {
    const a0 = (i / seg) * Math.PI, a1 = ((i + 1) / seg) * Math.PI, am = (a0 + a1) / 2;
    const n = new THREE.Vector3(Math.cos(am) * s, Math.sin(am), Math.cos(am) * c);
    b.quad(P(-h, a0), P(h, a0), P(h, a1), P(-h, a1), n, color, info);
  }
  for (const [u, sd] of [[-h, -1], [h, 1]] as [number, number][]) {
    const n = new THREE.Vector3(sd * c, 0, -sd * s);
    for (let i = 0; i < seg; i++) b.tri(P(u, 0).setY(y0).lerp(P(u, Math.PI), 0.5), P(u, (i / seg) * Math.PI), P(u, ((i + 1) / seg) * Math.PI), color, info, n);
  }
  if (rib) {
    const n = Math.max(2, Math.round(length / 0.9));
    for (let k = 0; k <= n; k++) {
      const u = -h + (length * k) / n;
      for (let i = 0; i < seg; i++) {
        const a = P(u, (i / seg) * Math.PI), bb = P(u, ((i + 1) / seg) * Math.PI);
        const m = new THREE.Vector3().addVectors(a, bb).multiplyScalar(0.5);
        const L = a.distanceTo(bb);
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3().subVectors(bb, a).normalize());
        b.add(CBOX(), new THREE.Matrix4().compose(m, q, new THREE.Vector3(0.07, L, 0.07)).premultiply(new THREE.Matrix4()), rib, info);
      }
    }
  }
}

/** Round plate facing the local direction ry (rose windows, clock faces, signs): radius r, thickness t. */
export function disc(b: BatchLike, x: number, y: number, z: number, r: number, t: number, ry: number, color: ColorLike, info: Info = NONE, seg = 12) {
  b.add(CYL(seg), M(x, y, z, ry, r, t, r, Math.PI / 2), color, info);
}
