// Step 2 (plan §4.2): DEM → world-aligned 1 u height lattice (terrainY, hero seam blend, 3×3 blur), sampled by
// everything downstream (road centrelines, building bases, graph nodes, chunk DEMs at 2 u, far DEM at 16 u).
import { terrainY, unproject, warpOffset } from '../../../src/opus-bay/core/geo';
import { DEM_N, DEM_STEP, type DemGrid } from '../../../src/opus-bay/world/sf/format';
import { smoothstep } from './geom';
import { type DemHeader, demAt } from './io';
import { blur3 } from './raster';
import { DOMAIN, SLAB_BBOX, heroGround, inSlab, slabEdgeDist } from './world';

/** width of the height blend outside the hero slab (§5.1 rule 2) */
export const SEAM_BLEND = 40;

export interface Terrain {
  x0: number; z0: number; cols: number; rows: number;
  /** lattice (i, j) at world (x0 + i, z0 + j), 1 u apart */
  y: Float32Array;
  /** raw DEM metres at the lattice (unwarped), NaN outside the DEM */
  dem: Float32Array;
}

export function buildTerrain(dem: { hdr: DemHeader; data: Float32Array }, log: (s: string) => void): Terrain {
  const x0 = DOMAIN.x0, z0 = DOMAIN.z0, cols = DOMAIN.x1 - DOMAIN.x0 + 1, rows = DOMAIN.z1 - DOMAIN.z0 + 1;
  const y = new Float32Array(cols * rows), raw = new Float32Array(cols * rows);
  let seam = 0;
  for (let j = 0; j < rows; j++) {
    const z = z0 + j;
    for (let i = 0; i < cols; i++) {
      const x = x0 + i, idx = j * cols + i;
      const d = warpOffset(x, z);
      const ll = unproject({ x: x - d.x, z: z - d.z });
      const h = demAt(dem, ll.lat, ll.lng);
      raw[idx] = h;
      let v = Number.isNaN(h) ? 0 : terrainY(h);
      // hero seam: inside the slab the hero ground wins; outside, blend from the hero edge height over SEAM_BLEND u
      if (x > SLAB_BBOX.x0 - SEAM_BLEND && x < SLAB_BBOX.x1 + SEAM_BLEND && z > SLAB_BBOX.z0 - SEAM_BLEND && z < SLAB_BBOX.z1 + SEAM_BLEND) {
        if (inSlab(x, z)) { v = heroGround(x, z); seam++; }
        else {
          const e = slabEdgeDist(x, z);
          if (e.d < SEAM_BLEND) { v = heroGround(e.nx, e.nz) + (v - heroGround(e.nx, e.nz)) * smoothstep(0, SEAM_BLEND, e.d); seam++; }
        }
      }
      y[idx] = v;
    }
  }
  const blurred = blur3(y, cols, rows);
  log(`terrain: ${cols}×${rows} lattice at 1 u, ${seam} seam samples`);
  return { x0, z0, cols, rows, y: blurred, dem: raw };
}

/** Bilinear terrain height at a world point (clamped to the lattice). */
export function heightAt(t: Terrain, x: number, z: number): number {
  const fx = Math.min(t.cols - 1.000001, Math.max(0, x - t.x0)), fz = Math.min(t.rows - 1.000001, Math.max(0, z - t.z0));
  const i = Math.floor(fx), j = Math.floor(fz), tx = fx - i, tz = fz - j, c = t.cols;
  const a = t.y[j * c + i], b = t.y[j * c + i + 1], e = t.y[(j + 1) * c + i], f = t.y[(j + 1) * c + i + 1];
  return (a * (1 - tx) + b * tx) * (1 - tz) + (e * (1 - tx) + f * tx) * tz;
}

/** Raw DEM metres (unwarped) at a world point; NaN outside the DEM. */
export function demMetresAt(t: Terrain, x: number, z: number): number {
  const i = Math.round(x - t.x0), j = Math.round(z - t.z0);
  if (i < 0 || j < 0 || i >= t.cols || j >= t.rows) return Number.NaN;
  return t.dem[j * t.cols + i];
}

/** Lowest ground under a footprint (vertices + centroid + a few interior samples). */
export function minGround(t: Terrain, ring: number[], cx: number, cz: number): number {
  let lo = heightAt(t, cx, cz);
  for (let k = 0; k < ring.length; k += 2) {
    lo = Math.min(lo, heightAt(t, ring[k], ring[k + 1]), heightAt(t, (ring[k] + cx) / 2, (ring[k + 1] + cz) / 2));
  }
  return lo;
}

/** 65 × 65 chunk DEM (2 u) — point samples of the blurred lattice. */
export function chunkDem(t: Terrain, cx: number, cz: number): DemGrid {
  const ox = cx * 128, oz = cz * 128;
  const y = new Float32Array(DEM_N * DEM_N);
  for (let j = 0; j < DEM_N; j++) for (let i = 0; i < DEM_N; i++) y[j * DEM_N + i] = heightAt(t, ox + i * DEM_STEP, oz + j * DEM_STEP);
  return { originX: ox, originZ: oz, step: DEM_STEP, cols: DEM_N, rows: DEM_N, y };
}

/** Far DEM: box average over step × step, samples at (originX + i·step, …). */
export function farDem(t: Terrain, originX: number, originZ: number, step: number, cols: number, rows: number): DemGrid {
  const y = new Float32Array(cols * rows);
  const r = step / 2;
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const x = originX + i * step, z = originZ + j * step;
    let s = 0, n = 0;
    for (let dz = -r; dz <= r; dz += 2) for (let dx = -r; dx <= r; dx += 2) { s += heightAt(t, x + dx, z + dz); n++; }
    y[j * cols + i] = s / n;
  }
  return { originX, originZ, step, cols, rows, y };
}
