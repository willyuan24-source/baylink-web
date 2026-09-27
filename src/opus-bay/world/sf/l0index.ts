import type * as THREE from 'three';
import type { Vec2 } from '../../core/types';
import { type CityBuildingSpec, cityLook } from '../recipes/city';

/**
 * Per-building index of an L0 cell's toy mesh (lane D2 owns this file from wave 2; plan D2-08, the lead's day-0 pick
 * over C2-12's OBB discard). WORKER-SAFE and pure: no DOM, no materials, type-only three import.
 *
 * Worker side (world/sf/build.ts buildL0, a few lines):
 *   const rec = new L0Recorder();
 *   rec.begin(t); toyBuildingL0(t, spec); rec.end(t, desc);     // per building, around its recipe call
 *   return { …, buildings: rec.result() };                        // L0Result.buildings (null when none)
 *   postMessage(result, [...l0Transferables(result.buildings)])  // world/sf/worker.ts
 *
 * Main thread (world/sf/stream.ts keeps each attached cell's L0Buildings; the streamer exposes):
 *   streamer.forEachL0Building(x, z, r, fn)      fn(cellKey, k, view) for every building whose centre is within r
 *   streamer.setL0BuildingHidden(cellKey, k, h)  hide / restore building k of that cell (degenerate triangles)
 *   streamer.onL0Drop(fn)                        fn(cellKey) before a cell's L0 mesh goes away (release swaps)
 *
 * Index ranges are in index-buffer elements of the cell's toy geometry (TypedBatch keeps emission order).
 */

/** What build.ts knows about a building when it records it. */
export interface L0BuildingDesc {
  osmId: number;
  /** CITY_STYLES / CITY_ROOFS codes (world/recipes/city.ts) */
  style: number;
  roof: number;
  /** BuildingSet.flags + CITY_FLAG hints, as passed to the recipe */
  flags: number;
  baseY: number;
  /** wall height (u) */
  H: number;
  /** the wall colour the recipe drew (THREE.Color components, i.e. linear 0..1, as the TOY vertex colours) */
  wall: readonly [number, number, number];
  /** footprint polygon (world xz) */
  poly: readonly Vec2[];
  /** index of the footprint edge facing the street (bay windows / storefront), if any */
  front?: number;
  /** ground height range under the footprint (u): max − min */
  slope: number;
}

/** Packed per-building data for one L0 cell (structured-clone / transfer friendly). */
export interface L0Buildings {
  count: number;
  /** osmId per building (f64: OSM ids exceed 2^31) */
  osmId: Float64Array;
  /** per building: indexStart, indexCount (toy index buffer elements) */
  ranges: Uint32Array;
  /** per building, STRIDE floats: see F_* offsets */
  data: Float32Array;
}

/** data layout (floats per building) */
export const L0_STRIDE = 16;
export const F_CX = 0, F_CZ = 1, F_HX = 2, F_HZ = 3, F_YAW = 4, F_FRONT_YAW = 5, F_BASE = 6, F_H = 7, F_R = 8, F_G = 9, F_B = 10,
  F_SLOPE = 11, F_STYLE = 12, F_ROOF = 13, F_FLAGS = 14, F_HAS_FRONT = 15;

/** Minimal oriented box of a footprint: along its longest edge. */
function obb(poly: readonly Vec2[]): { cx: number; cz: number; hx: number; hz: number; yaw: number } {
  let best = 0, yaw = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const L = Math.hypot(b.x - a.x, b.z - a.z);
    if (L > best) { best = L; yaw = Math.atan2(b.x - a.x, b.z - a.z); }
  }
  // local x = across the long edge, local z = along it (three.js yaw: +z → (sin yaw, cos yaw))
  const s = Math.sin(yaw), c = Math.cos(yaw);
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const p of poly) {
    const lx = p.x * c - p.z * s, lz = p.x * s + p.z * c;
    x0 = Math.min(x0, lx); x1 = Math.max(x1, lx); z0 = Math.min(z0, lz); z1 = Math.max(z1, lz);
  }
  const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
  return { cx: mx * c + mz * s, cz: -mx * s + mz * c, hx: (x1 - x0) / 2, hz: (z1 - z0) / 2, yaw };
}

/** Outward-facing yaw of footprint edge `i` (the direction a front door faces). */
function edgeYaw(poly: readonly Vec2[], i: number): number {
  let area = 0;
  for (let k = 0; k < poly.length; k++) { const p = poly[k], q = poly[(k + 1) % poly.length]; area += p.x * q.z - q.x * p.z; }
  const a = poly[i], b = poly[(i + 1) % poly.length];
  const dx = b.x - a.x, dz = b.z - a.z;
  // outward normal: right of the edge for a counter-clockwise (area > 0 in x/z) ring, left otherwise
  const nx = area >= 0 ? dz : -dz, nz = area >= 0 ? -dx : dx;
  return Math.atan2(nx, nz);
}

export class L0Recorder {
  private osm: number[] = [];
  private rng: number[] = [];
  private dat: number[] = [];
  private start = 0;

  /** Before the building's recipe writes into the toy batch. */
  begin(batch: { indexCount: number }) { this.start = batch.indexCount; }

  /** After it: record the index range and the descriptor (nothing when the recipe wrote no triangles). */
  end(batch: { indexCount: number }, d: L0BuildingDesc) {
    const count = batch.indexCount - this.start;
    if (count <= 0) return;
    const o = obb(d.poly);
    const hasFront = d.front !== undefined && d.front >= 0 && d.front < d.poly.length;
    this.osm.push(d.osmId);
    this.rng.push(this.start, count);
    this.dat.push(o.cx, o.cz, o.hx, o.hz, o.yaw, hasFront ? edgeYaw(d.poly, d.front!) : o.yaw, d.baseY, d.H, d.wall[0], d.wall[1], d.wall[2], d.slope, d.style, d.roof, d.flags, hasFront ? 1 : 0);
  }

  result(): L0Buildings | null {
    const n = this.osm.length;
    if (!n) return null;
    return { count: n, osmId: Float64Array.from(this.osm), ranges: Uint32Array.from(this.rng), data: Float32Array.from(this.dat) };
  }
}

/**
 * The descriptor build.ts records for building i of a chunk: codes from the chunk's BuildingSet, geometry from the spec
 * the recipe got, the wall colour the recipe really drew (cityLook, jitter included), the footprint's ground slope.
 */
export function l0Desc(set: { osmId: ArrayLike<number>; style: ArrayLike<number>; roof: ArrayLike<number> }, i: number, spec: CityBuildingSpec, height: (x: number, z: number) => number): L0BuildingDesc {
  let lo = Infinity, hi = -Infinity;
  for (const p of spec.poly) { const h = height(p.x, p.z); if (h < lo) lo = h; if (h > hi) hi = h; }
  const wall = cityLook(spec).wall;
  return {
    osmId: set.osmId[i], style: set.style[i], roof: set.roof[i], flags: spec.flags, baseY: spec.baseY, H: spec.H,
    wall: [wall.r, wall.g, wall.b], poly: spec.poly, front: spec.front, slope: Number.isFinite(hi - lo) ? hi - lo : 0,
  };
}

/** Buffers of `b` for postMessage's transfer list. */
export function l0Transferables(b: L0Buildings | null | undefined): ArrayBuffer[] {
  return b ? [b.osmId.buffer, b.ranges.buffer, b.data.buffer] as ArrayBuffer[] : [];
}

/** '#rrggbb' → [r, g, b] in 0..1 (palette wall colours). */
export function hexRgb(hex: string): [number, number, number] {
  const v = parseInt(hex.replace('#', '').slice(0, 6), 16);
  return Number.isFinite(v) ? [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255] : [1, 1, 1];
}

/** A readable view of building k (allocates: use in lookups, not per frame for every building). */
export interface L0BuildingView {
  k: number;
  osmId: number;
  indexStart: number;
  indexCount: number;
  cx: number; cz: number;
  hx: number; hz: number;
  yaw: number;
  frontYaw: number;
  hasFront: boolean;
  baseY: number;
  H: number;
  wall: [number, number, number];
  slope: number;
  style: number;
  roof: number;
  flags: number;
}

export function l0Building(b: L0Buildings, k: number): L0BuildingView {
  const d = b.data, o = k * L0_STRIDE;
  return {
    k, osmId: b.osmId[k], indexStart: b.ranges[k * 2], indexCount: b.ranges[k * 2 + 1],
    cx: d[o + F_CX], cz: d[o + F_CZ], hx: d[o + F_HX], hz: d[o + F_HZ], yaw: d[o + F_YAW], frontYaw: d[o + F_FRONT_YAW], hasFront: d[o + F_HAS_FRONT] > 0.5,
    baseY: d[o + F_BASE], H: d[o + F_H], wall: [d[o + F_R], d[o + F_G], d[o + F_B]], slope: d[o + F_SLOPE],
    style: d[o + F_STYLE], roof: d[o + F_ROOF], flags: d[o + F_FLAGS],
  };
}

/** Buildings of one cell whose centre lies within r of (x, z). */
export function l0Near(b: L0Buildings, x: number, z: number, r: number, fn: (k: number) => void) {
  const d = b.data, r2 = r * r;
  for (let k = 0; k < b.count; k++) {
    const dx = d[k * L0_STRIDE + F_CX] - x, dz = d[k * L0_STRIDE + F_CZ] - z;
    if (dx * dx + dz * dz <= r2) fn(k);
  }
}

/** Saved original indices of hidden ranges, per geometry. */
export type L0Hidden = Map<number, Uint16Array | Uint32Array>;

/**
 * Hide (degenerate triangles) or restore building k's triangles in `geo` (the cell's toy geometry). Keeps the saved
 * copy in `hidden`; uploads only the touched range. Returns false when nothing changed.
 */
export function setRangeHidden(geo: THREE.BufferGeometry, b: L0Buildings, k: number, hide: boolean, hidden: L0Hidden): boolean {
  const index = geo.getIndex();
  if (!index || k < 0 || k >= b.count) return false;
  const start = b.ranges[k * 2], count = b.ranges[k * 2 + 1];
  const arr = index.array as Uint16Array | Uint32Array;
  if (start + count > arr.length) return false;
  if (hide) {
    if (hidden.has(k)) return false;
    hidden.set(k, arr.slice(start, start + count));
    arr.fill(arr[start], start, start + count);
  } else {
    const saved = hidden.get(k);
    if (!saved) return false;
    arr.set(saved, start);
    hidden.delete(k);
  }
  index.addUpdateRange(start, count);
  index.needsUpdate = true;
  return true;
}
