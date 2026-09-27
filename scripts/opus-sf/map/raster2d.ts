/**
 * A small anti-aliased 2D rasteriser for the painted-map base render (lane H2b, H2b-2). Pure and dependency-free, so
 * node tests can check its coverage maths.
 *
 * Coverage is 4 × 4 supersampled: a Mask keeps 16 sample bits per pixel (bit k·4 + j = sub-row k, sub-column j, sample
 * centres at (j + .5) / 4, (k + .5) / 4). Shapes OR into a mask (a union: overlapping strokes of one layer never
 * darken twice), rings of one shape use the even-odd rule, and a whole layer composites onto the image once with its
 * colour: img = img·(1 − a·cov) + colour·a·cov, cov = set samples / 16. Samples are half-open ([x0, x1) spans, sample
 * rows with y0 ≤ y < y1), so two shapes that share an edge split its samples exactly.
 *
 *   const m = new Mask(w, h);
 *   fillShape(m, [ring, hole]);          // rings: flat [x0, y0, x1, y1, …] in px
 *   strokePolyline(m, pts, radius);      // round caps and joins (a chain of capsules)
 *   composite(img, m, [r, g, b], 0.9);   // img: Float32Array RGB 0..1, w·h·3
 *   m.clear();                           // only the dirty box
 */

export const SS = 4;
const FULL_ROW = (1 << SS) - 1; // 0b1111

/** popcount of 16-bit values */
const POP = (() => {
  const t = new Uint8Array(1 << 16);
  for (let i = 1; i < t.length; i++) t[i] = (i & 1) + t[i >> 1];
  return t;
})();
export const coverageOf = (bits: number) => POP[bits & 0xffff] / (SS * SS);

export class Mask {
  readonly bits: Uint16Array;
  /** dirty box (pixels, inclusive) */
  x0 = Infinity;
  y0 = Infinity;
  x1 = -Infinity;
  y1 = -Infinity;
  constructor(readonly w: number, readonly h: number) {
    this.bits = new Uint16Array(w * h);
  }
  touch(px0: number, py0: number, px1: number, py1: number) {
    if (px0 < this.x0) this.x0 = px0;
    if (py0 < this.y0) this.y0 = py0;
    if (px1 > this.x1) this.x1 = px1;
    if (py1 > this.y1) this.y1 = py1;
  }
  get empty() { return this.x1 < this.x0; }
  clear() {
    if (this.empty) return;
    for (let y = this.y0; y <= this.y1; y++) this.bits.fill(0, y * this.w + this.x0, y * this.w + this.x1 + 1);
    this.x0 = this.y0 = Infinity;
    this.x1 = this.y1 = -Infinity;
  }
  /** covered fraction of pixel (x, y) */
  at(x: number, y: number) { return coverageOf(this.bits[y * this.w + x]); }
  /** OR another mask of the same size into this one */
  or(o: Mask) {
    if (o.empty) return;
    for (let y = o.y0; y <= o.y1; y++) for (let x = o.x0, i = y * o.w + o.x0; x <= o.x1; x++, i++) this.bits[i] |= o.bits[i];
    this.touch(o.x0, o.y0, o.x1, o.y1);
  }
  /** every covered fraction as bytes 0..255 (the land mask PNG) */
  toBytes(): Uint8Array {
    const out = new Uint8Array(this.w * this.h);
    for (let i = 0; i < out.length; i++) out[i] = Math.round(POP[this.bits[i]] * 255 / (SS * SS));
    return out;
  }
}

/** Set the samples of sub-row `s` whose centres lie in [xa, xb). */
function setSpan(m: Mask, s: number, xa: number, xb: number) {
  const c0 = Math.max(0, Math.ceil(xa * SS - 0.5));
  const c1 = Math.min(m.w * SS, Math.ceil(xb * SS - 0.5)); // exclusive
  if (c1 <= c0) return;
  const row = (s / SS) | 0, shift = (s % SS) * SS, base = row * m.w;
  const p0 = (c0 / SS) | 0, p1 = ((c1 - 1) / SS) | 0;
  const j0 = c0 % SS, j1 = (c1 - 1) % SS;
  if (p0 === p1) {
    m.bits[base + p0] |= (((1 << (j1 - j0 + 1)) - 1) << j0) << shift;
  } else {
    m.bits[base + p0] |= ((FULL_ROW << j0) & FULL_ROW) << shift;
    const full = FULL_ROW << shift;
    for (let p = p0 + 1; p < p1; p++) m.bits[base + p] |= full;
    m.bits[base + p1] |= ((1 << (j1 + 1)) - 1) << shift;
  }
  m.touch(p0, row, p1, row);
}

/**
 * Fill one shape (outer rings and holes, even-odd across all its rings) into the mask. Rings are flat [x, y, …] arrays in
 * pixels, open or closed. Scanline over the sample rows with an active-edge list.
 */
export function fillShape(m: Mask, rings: readonly ArrayLike<number>[]) {
  let n = 0;
  for (const r of rings) n += r.length >> 1;
  const ex = new Float64Array(n), ey = new Float64Array(n), slope = new Float64Array(n);
  const sTop = new Int32Array(n), sBot = new Int32Array(n);
  let e = 0;
  for (const r of rings) {
    const k = r.length >> 1;
    for (let i = 0; i < k; i++) {
      let xa = r[i * 2], ya = r[i * 2 + 1], xb = r[((i + 1) % k) * 2], yb = r[((i + 1) % k) * 2 + 1];
      if (ya === yb) continue;
      if (ya > yb) { [xa, xb] = [xb, xa]; [ya, yb] = [yb, ya]; }
      const t = Math.ceil(ya * SS - 0.5), b = Math.ceil(yb * SS - 0.5) - 1;
      if (b < t || b < 0 || t >= m.h * SS) continue;
      ex[e] = xa; ey[e] = ya; slope[e] = (xb - xa) / (yb - ya); sTop[e] = t; sBot[e] = b;
      e++;
    }
  }
  if (!e) return;
  const order = Array.from({ length: e }, (_, i) => i).sort((a, b) => sTop[a] - sTop[b]);
  const sMin = Math.max(0, sTop[order[0]]);
  let sMax = 0;
  for (let i = 0; i < e; i++) if (sBot[i] > sMax) sMax = sBot[i];
  sMax = Math.min(sMax, m.h * SS - 1);
  let next = 0;
  let active: number[] = [];
  const xs: number[] = [];
  for (let s = sMin; s <= sMax; s++) {
    while (next < e && sTop[order[next]] <= s) active.push(order[next++]);
    active = active.filter(i => sBot[i] >= s);
    if (!active.length) {
      if (next >= e) break;
      s = Math.max(s, sTop[order[next]] - 1);
      continue;
    }
    const yc = (s + 0.5) / SS;
    xs.length = 0;
    for (const i of active) xs.push(ex[i] + (yc - ey[i]) * slope[i]);
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) setSpan(m, s, xs[k], xs[k + 1]);
  }
}

/** Fill a circle (disc) of radius r at (cx, cy). */
export function fillDisc(m: Mask, cx: number, cy: number, r: number) {
  strokeCapsule(m, cx, cy, cx, cy, r);
}

/** Capsule (segment a→b with round caps, radius r) into the mask. */
export function strokeCapsule(m: Mask, ax: number, ay: number, bx: number, by: number, r: number) {
  if (!(r > 0)) return;
  const px0 = Math.max(0, Math.floor(Math.min(ax, bx) - r)), px1 = Math.min(m.w - 1, Math.floor(Math.max(ax, bx) + r));
  const py0 = Math.max(0, Math.floor(Math.min(ay, by) - r)), py1 = Math.min(m.h - 1, Math.floor(Math.max(ay, by) + r));
  if (px1 < px0 || py1 < py0) return;
  const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
  const r2 = r * r, inner = r - 0.71, outer = r + 0.71;
  const in2 = inner > 0 ? inner * inner : -1, out2 = outer * outer;
  const d2 = (x: number, y: number) => {
    let t = L2 > 0 ? ((x - ax) * dx + (y - ay) * dy) / L2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const qx = ax + t * dx - x, qy = ay + t * dy - y;
    return qx * qx + qy * qy;
  };
  for (let y = py0; y <= py1; y++) {
    for (let x = px0; x <= px1; x++) {
      const c = d2(x + 0.5, y + 0.5);
      if (c > out2) continue;
      let bits = 0;
      if (c <= in2) bits = 0xffff;
      else {
        for (let k = 0; k < SS; k++) for (let j = 0; j < SS; j++) if (d2(x + (j + 0.5) / SS, y + (k + 0.5) / SS) <= r2) bits |= 1 << (k * SS + j);
      }
      if (bits) m.bits[y * m.w + x] |= bits;
    }
  }
  m.touch(px0, py0, px1, py1);
}

/** A polyline (flat [x, y, …] in px) as a chain of capsules; long segments are split so boxes stay tight. */
export function strokePolyline(m: Mask, pts: ArrayLike<number>, r: number, maxPiece = 24) {
  const k = pts.length >> 1;
  if (k === 1) { fillDisc(m, pts[0], pts[1], r); return; }
  for (let i = 0; i + 1 < k; i++) {
    const ax = pts[i * 2], ay = pts[i * 2 + 1], bx = pts[i * 2 + 2], by = pts[i * 2 + 3];
    const L = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.ceil(L / maxPiece));
    for (let p = 0; p < n; p++) {
      const t0 = p / n, t1 = (p + 1) / n;
      strokeCapsule(m, ax + (bx - ax) * t0, ay + (by - ay) * t0, ax + (bx - ax) * t1, ay + (by - ay) * t1, r);
    }
  }
}

export type RGB = readonly [number, number, number];

/** '#rrggbb' → [r, g, b] 0..1 */
export function rgb(hex: string): RGB {
  const v = parseInt(hex.replace('#', ''), 16);
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
}

export function mix(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/**
 * Composite a mask onto an RGB float image: a constant colour, or a per-pixel colour function (x, y) → RGB (e.g. the
 * water depth tint). `alpha` scales the coverage.
 */
export function composite(img: Float32Array, m: Mask, color: RGB | ((x: number, y: number) => RGB), alpha = 1) {
  if (m.empty) return;
  const fn = typeof color === 'function' ? color : null;
  const c = fn ? null : color as RGB;
  for (let y = m.y0; y <= m.y1; y++) {
    for (let x = m.x0, i = y * m.w + m.x0; x <= m.x1; x++, i++) {
      const b = m.bits[i];
      if (!b) continue;
      const a = (POP[b] / (SS * SS)) * alpha;
      const col = fn ? fn(x, y) : c!;
      const o = i * 3;
      img[o] += (col[0] - img[o]) * a;
      img[o + 1] += (col[1] - img[o + 1]) * a;
      img[o + 2] += (col[2] - img[o + 2]) * a;
    }
  }
}

/** Float RGB 0..1 → RGBA bytes (pngjs `data`). */
export function toRgba(img: Float32Array, w: number, h: number): Uint8Array {
  const out = new Uint8Array(w * h * 4);
  for (let i = 0, n = w * h; i < n; i++) {
    out[i * 4] = Math.max(0, Math.min(255, Math.round(img[i * 3] * 255)));
    out[i * 4 + 1] = Math.max(0, Math.min(255, Math.round(img[i * 3 + 1] * 255)));
    out[i * 4 + 2] = Math.max(0, Math.min(255, Math.round(img[i * 3 + 2] * 255)));
    out[i * 4 + 3] = 255;
  }
  return out;
}

/** 2 × 2 box downsample of an RGB float image (4096 → 2048). */
export function halve(img: Float32Array, w: number, h: number): Float32Array {
  const W = w >> 1, H = h >> 1, out = new Float32Array(W * H * 3);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    for (let c = 0; c < 3; c++) {
      const a = ((2 * y) * w + 2 * x) * 3 + c, b = ((2 * y + 1) * w + 2 * x) * 3 + c;
      out[(y * W + x) * 3 + c] = (img[a] + img[a + 3] + img[b] + img[b + 3]) / 4;
    }
  }
  return out;
}

/** 2 × 2 box downsample of a byte plane. */
export function halveBytes(b: Uint8Array, w: number, h: number): Uint8Array {
  const W = w >> 1, H = h >> 1, out = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const a = 2 * y * w + 2 * x;
    out[y * W + x] = Math.round((b[a] + b[a + 1] + b[a + w] + b[a + w + 1]) / 4);
  }
  return out;
}

/**
 * Chamfer (3-4) distance transform of a boolean grid (true = feature), in cells. Two passes; ≈ Euclidean within 8 %.
 */
export function distanceTransform(feature: Uint8Array, w: number, h: number): Float32Array {
  const INF = 1e9, d = new Float32Array(w * h);
  for (let i = 0; i < d.length; i++) d[i] = feature[i] ? 0 : INF;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    let v = d[i];
    if (x > 0) v = Math.min(v, d[i - 1] + 3);
    if (y > 0) {
      v = Math.min(v, d[i - w] + 3);
      if (x > 0) v = Math.min(v, d[i - w - 1] + 4);
      if (x < w - 1) v = Math.min(v, d[i - w + 1] + 4);
    }
    d[i] = v;
  }
  for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) {
    const i = y * w + x;
    let v = d[i];
    if (x < w - 1) v = Math.min(v, d[i + 1] + 3);
    if (y < h - 1) {
      v = Math.min(v, d[i + w] + 3);
      if (x < w - 1) v = Math.min(v, d[i + w + 1] + 4);
      if (x > 0) v = Math.min(v, d[i + w - 1] + 4);
    }
    d[i] = v;
  }
  for (let i = 0; i < d.length; i++) d[i] /= 3;
  return d;
}
