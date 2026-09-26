/**
 * Small raster kit for the city's worker side (pure, no three.js, no DOM): scanline ring fills on a regular grid,
 * a signed chamfer distance field (+ inside, − outside) for crisp marching-squares coasts, and bilinear sampling.
 * Cell (i, j) of a raster has its centre at (x0 + (i + ½)·step, z0 + (j + ½)·step).
 */

export interface Raster { x0: number; z0: number; step: number; cols: number; rows: number }

export function makeRaster(x0: number, z0: number, x1: number, z1: number, step: number): Raster {
  return { x0, z0, step, cols: Math.max(1, Math.ceil((x1 - x0) / step)), rows: Math.max(1, Math.ceil((z1 - z0) / step)) };
}

/**
 * Even-odd scanline fill of ONE ring (points i0 … i1−1 of an x, z pair array) on the raster's cell centres:
 * `set(index)` is called for every covered cell.
 */
export function fillRing(r: Raster, xz: ArrayLike<number>, i0: number, i1: number, set: (i: number) => void) {
  const n = i1 - i0;
  if (n < 3) return;
  let zMin = Infinity, zMax = -Infinity;
  for (let k = i0; k < i1; k++) { const z = xz[k * 2 + 1]; if (z < zMin) zMin = z; if (z > zMax) zMax = z; }
  const j0 = Math.max(0, Math.floor((zMin - r.z0) / r.step - 0.5)), j1 = Math.min(r.rows - 1, Math.ceil((zMax - r.z0) / r.step - 0.5));
  const xs: number[] = [];
  for (let j = j0; j <= j1; j++) {
    const z = r.z0 + (j + 0.5) * r.step;
    xs.length = 0;
    for (let a = 0; a < n; a++) {
      const p = i0 + a, q = i0 + ((a + n - 1) % n);
      const az = xz[p * 2 + 1], bz = xz[q * 2 + 1];
      if ((az > z) !== (bz > z)) {
        const ax = xz[p * 2], bx = xz[q * 2];
        xs.push(ax + ((z - az) * (bx - ax)) / (bz - az));
      }
    }
    if (xs.length < 2) continue;
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const c0 = Math.max(0, Math.ceil((xs[k] - r.x0) / r.step - 0.5)), c1 = Math.min(r.cols - 1, Math.floor((xs[k + 1] - r.x0) / r.step - 0.5));
      for (let c = c0; c <= c1; c++) set(j * r.cols + c);
    }
  }
}

/** Fill a polygon given as {x, z}[] (convenience for the slab / exclusion shapes). */
export function fillPoly(r: Raster, poly: readonly { x: number; z: number }[], set: (i: number) => void) {
  const xz = new Float32Array(poly.length * 2);
  poly.forEach((p, i) => { xz[i * 2] = p.x; xz[i * 2 + 1] = p.z; });
  fillRing(r, xz, 0, poly.length, set);
}

/** Two-pass chamfer distance (world units) from every cell to the nearest source cell (D = 0 at sources, INF elsewhere). */
export function chamfer(D: Float32Array, cols: number, rows: number, cell: number) {
  const d1 = cell, d2 = cell * Math.SQRT2;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      let v = D[i];
      if (v === 0) continue;
      if (c > 0) v = Math.min(v, D[i - 1] + d1);
      if (r > 0) {
        v = Math.min(v, D[i - cols] + d1);
        if (c > 0) v = Math.min(v, D[i - cols - 1] + d2);
        if (c < cols - 1) v = Math.min(v, D[i - cols + 1] + d2);
      }
      D[i] = v;
    }
  }
  for (let r = rows - 1; r >= 0; r--) {
    for (let c = cols - 1; c >= 0; c--) {
      const i = r * cols + c;
      let v = D[i];
      if (v === 0) continue;
      if (c < cols - 1) v = Math.min(v, D[i + 1] + d1);
      if (r < rows - 1) {
        v = Math.min(v, D[i + cols] + d1);
        if (c < cols - 1) v = Math.min(v, D[i + cols + 1] + d2);
        if (c > 0) v = Math.min(v, D[i + cols - 1] + d2);
      }
      D[i] = v;
    }
  }
}

/**
 * Signed distance to the mask's boundary (world units, + inside mask ≠ 0, − outside), capped at ±cap. The zero
 * crossing sits half a cell outside the last inside centre, so a bilinear sample reproduces the painted edge.
 */
export function signedDistance(mask: Uint8Array, r: Raster, cap = 64): Float32Array {
  const n = r.cols * r.rows, INF = 1e9;
  const dIn = new Float32Array(n), dOut = new Float32Array(n);
  for (let i = 0; i < n; i++) { const m = mask[i] !== 0; dIn[i] = m ? INF : 0; dOut[i] = m ? 0 : INF; }
  chamfer(dIn, r.cols, r.rows, r.step);
  chamfer(dOut, r.cols, r.rows, r.step);
  const s = new Float32Array(n), h = r.step / 2;
  for (let i = 0; i < n; i++) s[i] = mask[i] ? Math.min(cap, dIn[i] - h) : -Math.min(cap, dOut[i] - h);
  return s;
}

/** Bilinear sample of a per-cell field at world (x, z) (clamped to the raster). */
export function sampleField(f: ArrayLike<number>, r: Raster, x: number, z: number): number {
  const fx = Math.min(r.cols - 1, Math.max(0, (x - r.x0) / r.step - 0.5));
  const fz = Math.min(r.rows - 1, Math.max(0, (z - r.z0) / r.step - 0.5));
  const i = Math.min(r.cols - 2, Math.floor(fx)), j = Math.min(r.rows - 2, Math.floor(fz));
  if (i < 0 || j < 0) return f[0];
  const tx = fx - i, tz = fz - j, c = r.cols;
  const a = f[j * c + i], b = f[j * c + i + 1], e = f[(j + 1) * c + i], g = f[(j + 1) * c + i + 1];
  return (a * (1 - tx) + b * tx) * (1 - tz) + (e * (1 - tx) + g * tx) * tz;
}

/** Nearest-cell lookup (class rasters). */
export function sampleNearest(f: ArrayLike<number>, r: Raster, x: number, z: number): number {
  const i = Math.floor((x - r.x0) / r.step), j = Math.floor((z - r.z0) / r.step);
  if (i < 0 || j < 0 || i >= r.cols || j >= r.rows) return 0;
  return f[j * r.cols + i];
}

/**
 * A clamp for CityBatch.clampXZ: points inside any of the polygons move to the nearest point of that polygon's
 * boundary (a bbox test first, so points far from every polygon cost four comparisons each).
 */
export function pushOutOf(polys: readonly (readonly { x: number; z: number }[])[]): (x: number, z: number, out: { x: number; z: number }) => void {
  const boxes = polys.map(p => {
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    for (const q of p) { x0 = Math.min(x0, q.x); z0 = Math.min(z0, q.z); x1 = Math.max(x1, q.x); z1 = Math.max(z1, q.z); }
    return { x0, z0, x1, z1 };
  });
  return (x, z, out) => {
    out.x = x; out.z = z;
    for (let k = 0; k < polys.length; k++) {
      const b = boxes[k], poly = polys[k];
      if (x < b.x0 || x > b.x1 || z < b.z0 || z > b.z1 || !inPoly(x, z, poly)) continue;
      let best = Infinity;
      for (let i = 0; i < poly.length; i++) {
        const a = poly[i], c = poly[(i + 1) % poly.length];
        const dx = c.x - a.x, dz = c.z - a.z, L2 = dx * dx + dz * dz || 1;
        const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / L2));
        const px = a.x + dx * t, pz = a.z + dz * t, d = (px - x) ** 2 + (pz - z) ** 2;
        if (d < best) { best = d; out.x = px; out.z = pz; }
      }
      return;
    }
  };
}

/** Point in polygon for {x, z}[] (even-odd). */
export function inPoly(x: number, z: number, poly: readonly { x: number; z: number }[]): boolean {
  let ins = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.z > z) !== (b.z > z) && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) ins = !ins;
  }
  return ins;
}
