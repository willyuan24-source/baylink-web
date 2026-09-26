// World-aligned rasters for the offline SF build: polygon fill, supercover lines, flood fill, component labels,
// box blur and marching-squares contour tracing. Cell (i, j) covers [x0 + i·cell, x0 + (i+1)·cell) × [z0 + j·cell, …).

import type { Ring } from './geom';

export type Arr = Uint8Array | Int32Array | Float32Array | Uint16Array;

export class Grid<T extends Arr = Uint8Array> {
  readonly x0: number; readonly z0: number; readonly cell: number; readonly cols: number; readonly rows: number;
  readonly data: T;
  constructor(x0: number, z0: number, cell: number, cols: number, rows: number, data: T) {
    this.x0 = x0; this.z0 = z0; this.cell = cell; this.cols = cols; this.rows = rows; this.data = data;
  }
  static u8(x0: number, z0: number, cell: number, cols: number, rows: number) { return new Grid(x0, z0, cell, cols, rows, new Uint8Array(cols * rows)); }
  static i32(x0: number, z0: number, cell: number, cols: number, rows: number) { return new Grid(x0, z0, cell, cols, rows, new Int32Array(cols * rows)); }
  static f32(x0: number, z0: number, cell: number, cols: number, rows: number) { return new Grid(x0, z0, cell, cols, rows, new Float32Array(cols * rows)); }
  col(x: number) { return Math.floor((x - this.x0) / this.cell); }
  row(z: number) { return Math.floor((z - this.z0) / this.cell); }
  /** value of the cell containing (x, z), or `outside` */
  at(x: number, z: number, outside = 0): number {
    const i = this.col(x), j = this.row(z);
    return i < 0 || j < 0 || i >= this.cols || j >= this.rows ? outside : this.data[j * this.cols + i];
  }
  cx(i: number) { return this.x0 + (i + 0.5) * this.cell; }
  cz(j: number) { return this.z0 + (j + 0.5) * this.cell; }
}

/** Even-odd scanline fill over cell centres of a set of rings (outer + holes in one call). */
export function fillRings(g: Grid<Arr>, rings: Ring[], fn: (idx: number) => void) {
  let z0 = Infinity, z1 = -Infinity;
  for (const r of rings) for (let k = 1; k < r.length; k += 2) { if (r[k] < z0) z0 = r[k]; if (r[k] > z1) z1 = r[k]; }
  const r0 = Math.max(0, Math.floor((z0 - g.z0) / g.cell - 0.5)), r1 = Math.min(g.rows - 1, Math.ceil((z1 - g.z0) / g.cell - 0.5));
  const xs: number[] = [];
  for (let j = r0; j <= r1; j++) {
    const z = g.z0 + (j + 0.5) * g.cell;
    xs.length = 0;
    for (const r of rings) {
      const n = r.length / 2;
      for (let i = 0, k = n - 1; i < n; k = i++) {
        const az = r[i * 2 + 1], bz = r[k * 2 + 1];
        if ((az > z) !== (bz > z)) xs.push(r[i * 2] + ((z - az) * (r[k * 2] - r[i * 2])) / (bz - az));
      }
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const c0 = Math.max(0, Math.ceil((xs[k] - g.x0) / g.cell - 0.5)), c1 = Math.min(g.cols - 1, Math.floor((xs[k + 1] - g.x0) / g.cell - 0.5));
      for (let i = c0; i <= c1; i++) fn(j * g.cols + i);
    }
  }
}

/** Every cell a segment passes through (supercover, conservative), plus a `pad` of cells around. */
export function drawSegment(g: Grid<Arr>, ax: number, az: number, bx: number, bz: number, fn: (idx: number) => void) {
  const fx0 = (ax - g.x0) / g.cell, fz0 = (az - g.z0) / g.cell, fx1 = (bx - g.x0) / g.cell, fz1 = (bz - g.z0) / g.cell;
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(fx1 - fx0), Math.abs(fz1 - fz0)) * 2));
  let pi = -1, pj = -1;
  for (let s = 0; s <= n; s++) {
    const t = s / n;
    const i = Math.floor(fx0 + (fx1 - fx0) * t), j = Math.floor(fz0 + (fz1 - fz0) * t);
    if (i === pi && j === pj) continue;
    // when both indices change at once, also mark the two side cells so the wall stays 4-connected
    if (pi >= 0 && i !== pi && j !== pj) { mark(g, i, pj, fn); mark(g, pi, j, fn); }
    mark(g, i, j, fn);
    pi = i; pj = j;
  }
}
function mark(g: Grid<Arr>, i: number, j: number, fn: (idx: number) => void) {
  if (i >= 0 && j >= 0 && i < g.cols && j < g.rows) fn(j * g.cols + i);
}

/** Paint a thick polyline (corridor of half-width hw) into a grid: cells whose centre is within hw of the line. */
export function paintCorridor(g: Grid<Arr>, p: number[], hw: number, fn: (idx: number) => void, stride = 2) {
  const zOff = stride === 3 ? 2 : 1;
  for (let k = stride; k < p.length; k += stride) {
    const ax = p[k - stride], az = p[k - stride + zOff], bx = p[k], bz = p[k + zOff];
    const i0 = Math.max(0, Math.floor((Math.min(ax, bx) - hw - g.x0) / g.cell)), i1 = Math.min(g.cols - 1, Math.floor((Math.max(ax, bx) + hw - g.x0) / g.cell));
    const j0 = Math.max(0, Math.floor((Math.min(az, bz) - hw - g.z0) / g.cell)), j1 = Math.min(g.rows - 1, Math.floor((Math.max(az, bz) + hw - g.z0) / g.cell));
    const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1e-12, hw2 = hw * hw;
    for (let j = j0; j <= j1; j++) {
      const z = g.z0 + (j + 0.5) * g.cell;
      for (let i = i0; i <= i1; i++) {
        const x = g.x0 + (i + 0.5) * g.cell;
        let t = ((x - ax) * dx + (z - az) * dz) / L2;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const ex = x - ax - dx * t, ez = z - az - dz * t;
        if (ex * ex + ez * ez <= hw2) fn(j * g.cols + i);
      }
    }
  }
}

/** 4-connected flood fill from seeds over cells where passable(idx) is true; calls visit for each reached cell. */
export function flood(cols: number, rows: number, seeds: number[], passable: (idx: number) => boolean, visited: Uint8Array, visit?: (idx: number) => void): number {
  const stack = new Int32Array(cols * rows > 1 << 26 ? 1 << 26 : cols * rows);
  let sp = 0, count = 0;
  for (const s of seeds) if (!visited[s] && passable(s)) { visited[s] = 1; stack[sp++] = s; }
  while (sp > 0) {
    const idx = stack[--sp];
    count++;
    if (visit) visit(idx);
    const i = idx % cols, j = (idx - i) / cols;
    const nb = [i > 0 ? idx - 1 : -1, i < cols - 1 ? idx + 1 : -1, j > 0 ? idx - cols : -1, j < rows - 1 ? idx + cols : -1];
    for (const n of nb) if (n >= 0 && !visited[n] && passable(n)) { visited[n] = 1; stack[sp++] = n; }
  }
  return count;
}

/** Label 4-connected components of cells where member(idx); returns labels (0 = none, 1…n) and sizes. */
export function labelComponents(cols: number, rows: number, member: (idx: number) => boolean): { labels: Int32Array; sizes: number[] } {
  const labels = new Int32Array(cols * rows);
  const sizes = [0];
  const stack = new Int32Array(cols * rows);
  for (let s = 0; s < cols * rows; s++) {
    if (labels[s] || !member(s)) continue;
    const id = sizes.length;
    let sp = 0, count = 0;
    labels[s] = id; stack[sp++] = s;
    while (sp > 0) {
      const idx = stack[--sp];
      count++;
      const i = idx % cols;
      if (i > 0 && !labels[idx - 1] && member(idx - 1)) { labels[idx - 1] = id; stack[sp++] = idx - 1; }
      if (i < cols - 1 && !labels[idx + 1] && member(idx + 1)) { labels[idx + 1] = id; stack[sp++] = idx + 1; }
      if (idx >= cols && !labels[idx - cols] && member(idx - cols)) { labels[idx - cols] = id; stack[sp++] = idx - cols; }
      if (idx + cols < cols * rows && !labels[idx + cols] && member(idx + cols)) { labels[idx + cols] = id; stack[sp++] = idx + cols; }
    }
    sizes.push(count);
  }
  return { labels, sizes };
}

/** Separable box blur (radius 1 = 3×3), edges clamped. */
export function blur3(src: Float32Array, cols: number, rows: number): Float32Array {
  const tmp = new Float32Array(src.length), out = new Float32Array(src.length);
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const a = src[j * cols + Math.max(0, i - 1)], b = src[j * cols + i], c = src[j * cols + Math.min(cols - 1, i + 1)];
    tmp[j * cols + i] = (a + b + c) / 3;
  }
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const a = tmp[Math.max(0, j - 1) * cols + i], b = tmp[j * cols + i], c = tmp[Math.min(rows - 1, j + 1) * cols + i];
    out[j * cols + i] = (a + b + c) / 3;
  }
  return out;
}

/**
 * Marching squares over a binary lattice (value[j·w + i] = 1 inside), lattice point (i, j) at world
 * (ox + i·step, oz + j·step). Values outside the lattice count as 0, so every ring closes. Returns closed rings in
 * world coordinates: outer rings with area2 > 0 (counter-clockwise in the x/z math frame), holes with area2 < 0.
 * Saddles keep diagonal inside corners apart.
 */
export function traceContours(value: Uint8Array, w: number, h: number, ox: number, oz: number, step: number): Ring[] {
  const at = (i: number, j: number) => (i < 0 || j < 0 || i >= w || j >= h ? 0 : value[j * w + i]);
  // squares span lattice (i, j)…(i+1, j+1) for i in [−1, w−1], j in [−1, h−1]; W = w + 1 squares per row
  const W = w + 2;
  // edge ids: horizontal edge from (i, j) to (i+1, j): H(i, j); vertical from (i, j) to (i, j+1): V(i, j), i, j ∈ [−1, w]
  const eid = (i: number, j: number, vert: number) => (((j + 1) * W + (i + 1)) << 1) | vert;
  const next = new Map<number, number>();
  const pos = (e: number): [number, number] => {
    const vert = e & 1, k = e >> 1, i = (k % W) - 1, j = Math.floor(k / W) - 1;
    return vert ? [ox + i * step, oz + (j + 0.5) * step] : [ox + (i + 0.5) * step, oz + j * step];
  };
  for (let j = -1; j < h; j++) {
    for (let i = -1; i < w; i++) {
      const bl = at(i, j), br = at(i + 1, j), tr = at(i + 1, j + 1), tl = at(i, j + 1);
      const c = bl | (br << 1) | (tr << 2) | (tl << 3);
      if (c === 0 || c === 15) continue;
      const B = eid(i, j, 0), T = eid(i, j + 1, 0), L = eid(i, j, 1), R = eid(i + 1, j, 1);
      // directed segments with the inside on the left (x/z math frame)
      const seg = (a: number, b: number) => next.set(a, b);
      switch (c) {
        case 1: seg(B, L); break;
        case 2: seg(R, B); break;
        case 3: seg(R, L); break;
        case 4: seg(T, R); break;
        case 5: seg(B, L); seg(T, R); break;
        case 6: seg(T, B); break;
        case 7: seg(T, L); break;
        case 8: seg(L, T); break;
        case 9: seg(B, T); break;
        case 10: seg(R, B); seg(L, T); break;
        case 11: seg(R, T); break;
        case 12: seg(L, R); break;
        case 13: seg(B, R); break;
        case 14: seg(L, B); break;
      }
    }
  }
  const rings: Ring[] = [];
  const seen = new Set<number>();
  for (const start of next.keys()) {
    if (seen.has(start)) continue;
    const ring: number[] = [];
    let e = start;
    for (let guard = 0; guard < 1e7; guard++) {
      seen.add(e);
      const [x, z] = pos(e);
      ring.push(x, z);
      const n = next.get(e);
      if (n === undefined || n === start) break;
      e = n;
    }
    if (ring.length >= 6) rings.push(ring);
  }
  return rings;
}
