// Blocker tops and tall parts measured on the drawn landmark (lane D2, D2-10). Pure except for the GLB reads the caller
// passes in: landmark-tops.ts writes src/opus-bay/world/sf/landmarks/tops.ts from it, and the landmark-context test
// recomputes the procedural landmarks to keep that table honest.
//
// The drawn lod 0 = what world/sf/sites.ts draws in the city: `swap.build` + the AI parts (scaled, placed) when the swap
// ships, else `build(b, 0)`; plus the animated part swept over its motion (the windmill's sails), sampled through the
// landmark's own `animate.update`. Everything in the landmark's LOCAL frame (y above its base).
//
// A top-surface height grid (0.25 u cells) takes each triangle's xz area (interpolated y at the cell centres) and its
// edges (walls are vertical: their top edges carry them); a blocker's top is the highest cell within its footprint
// grown by MARGIN, a tall part's top the highest cell inside its circle.
import * as THREE from 'three';
import { Batch } from '../../../src/opus-bay/world/builder';
import { type SfLandmark, type WalkBlocker, usesAi } from '../../../src/opus-bay/world/sf/landmarks/index';
import { forceFireRings } from '../../../src/opus-bay/world/sf/landmarks/ocean-beach-fire-rings';
import type { GlbMesh } from './glbNode';

/** grid cell (u) */
export const TOP_CELL = 0.25;
/** a blocker's footprint grows by this before its top is read (u): eaves and cornices overhang the walls a little */
export const MARGIN = 0.3;

export interface Tri { positions: ArrayLike<number>; index: ArrayLike<number> }

/** The lod-0 triangle soups a landmark draws, LOCAL frame (`models`: the decoded GLB per model id, for AI swaps). */
export function drawnLandmark(l: SfLandmark, models: ReadonlyMap<string, GlbMesh>): Tri[] {
  const out: Tri[] = [];
  const b = new Batch();
  const ai = usesAi(l) && l.swap!.parts.every(p => models.has(p.model));
  // (W5-L2: the Ocean Beach fire rings are measured lit, their tallest state, whatever the wall clock says)
  forceFireRings(true);
  try { if (ai) l.swap!.build(b); else l.build(b, 0); } finally { forceFireRings(null); }
  out.push({ positions: b.pos, index: b.idx });
  if (ai) {
    for (const p of l.swap!.parts) {
      const g = models.get(p.model)!;
      const m = new THREE.Matrix4().compose(new THREE.Vector3(p.x, p.y, p.z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.yaw ?? 0), new THREE.Vector3(...p.scale));
      const pos = new Float32Array(g.positions.length), v = new THREE.Vector3();
      for (let i = 0; i < pos.length; i += 3) { v.fromArray(g.positions, i).applyMatrix4(m); v.toArray(pos, i); }
      out.push({ positions: pos, index: g.index });
    }
  }
  if (l.animate) {
    const ab = new Batch();
    l.animate.build(ab);
    const obj = new THREE.Object3D(), v = new THREE.Vector3();
    // sweep: 96 poses over two minutes of animation time (a turn of the windmill takes well under that)
    for (let k = 0; k < 96; k++) {
      l.animate.update(obj, k * 1.25);
      obj.updateMatrix();
      const pos = new Float32Array(ab.pos.length);
      for (let i = 0; i < pos.length; i += 3) { v.fromArray(ab.pos, i).applyMatrix4(obj.matrix); v.toArray(pos, i); }
      out.push({ positions: pos, index: ab.idx });
    }
  }
  return out;
}

export interface TopGrid { x0: number; z0: number; cols: number; rows: number; h: Float32Array }

/** Highest drawn surface per TOP_CELL cell (−Infinity where nothing is drawn). */
export function topGrid(tris: readonly Tri[]): TopGrid {
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const t of tris) for (let i = 0; i < t.positions.length; i += 3) {
    const x = t.positions[i], z = t.positions[i + 2];
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (z < z0) z0 = z; if (z > z1) z1 = z;
  }
  x0 -= 1; z0 -= 1;
  const cols = Math.ceil((x1 + 1 - x0) / TOP_CELL) + 1, rows = Math.ceil((z1 + 1 - z0) / TOP_CELL) + 1;
  const h = new Float32Array(cols * rows).fill(-Infinity);
  const stamp = (x: number, z: number, y: number) => {
    const c = Math.floor((x - x0) / TOP_CELL), r = Math.floor((z - z0) / TOP_CELL);
    if (c < 0 || r < 0 || c >= cols || r >= rows) return;
    const k = r * cols + c;
    if (y > h[k]) h[k] = y;
  };
  for (const t of tris) {
    const P = t.positions, I = t.index;
    for (let f = 0; f < I.length; f += 3) {
      const a = I[f] * 3, b = I[f + 1] * 3, c = I[f + 2] * 3;
      const ax = P[a], ay = P[a + 1], az = P[a + 2], bx = P[b], by = P[b + 1], bz = P[b + 2], cx = P[c], cy = P[c + 1], cz = P[c + 2];
      // edges (vertical walls have no xz area: their top edges carry them)
      for (const [px, py, pz, qx, qy, qz] of [[ax, ay, az, bx, by, bz], [bx, by, bz, cx, cy, cz], [cx, cy, cz, ax, ay, az]]) {
        const n = Math.max(1, Math.ceil(Math.hypot(qx - px, qz - pz) / (TOP_CELL / 2)));
        for (let s = 0; s <= n; s++) { const u = s / n; stamp(px + (qx - px) * u, pz + (qz - pz) * u, py + (qy - py) * u); }
      }
      // area: cell centres inside the xz triangle, y interpolated
      const det = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
      if (Math.abs(det) < 1e-9) continue;
      const c0 = Math.max(0, Math.floor((Math.min(ax, bx, cx) - x0) / TOP_CELL)), c1 = Math.min(cols - 1, Math.floor((Math.max(ax, bx, cx) - x0) / TOP_CELL));
      const r0 = Math.max(0, Math.floor((Math.min(az, bz, cz) - z0) / TOP_CELL)), r1 = Math.min(rows - 1, Math.floor((Math.max(az, bz, cz) - z0) / TOP_CELL));
      for (let r = r0; r <= r1; r++) {
        const z = z0 + (r + 0.5) * TOP_CELL;
        for (let col = c0; col <= c1; col++) {
          const x = x0 + (col + 0.5) * TOP_CELL;
          const l1 = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / det, l2 = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / det, l3 = 1 - l1 - l2;
          if (l1 < -1e-6 || l2 < -1e-6 || l3 < -1e-6) continue;
          const y = l1 * ay + l2 * by + l3 * cy, k = r * cols + col;
          if (y > h[k]) h[k] = y;
        }
      }
    }
  }
  return { x0, z0, cols, rows, h };
}

/** Highest cell whose centre passes `inside`, looking only inside the bbox [x0, z0, x1, z1]; −Infinity when none. */
export function gridMax(g: TopGrid, bbox: readonly [number, number, number, number], inside: (x: number, z: number) => boolean): number {
  let top = -Infinity;
  const c0 = Math.max(0, Math.floor((bbox[0] - g.x0) / TOP_CELL)), c1 = Math.min(g.cols - 1, Math.floor((bbox[2] - g.x0) / TOP_CELL));
  const r0 = Math.max(0, Math.floor((bbox[1] - g.z0) / TOP_CELL)), r1 = Math.min(g.rows - 1, Math.floor((bbox[3] - g.z0) / TOP_CELL));
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const y = g.h[r * g.cols + c];
      if (y > top && inside(g.x0 + (c + 0.5) * TOP_CELL, g.z0 + (r + 0.5) * TOP_CELL)) top = y;
    }
  }
  return top;
}

function segDist2(px: number, pz: number, ax: number, az: number, bx: number, bz: number) {
  const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz;
  let t = L2 > 0 ? ((px - ax) * dx + (pz - az) * dz) / L2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const ex = px - ax - dx * t, ez = pz - az - dz * t;
  return ex * ex + ez * ez;
}
function inPoly(poly: readonly { x: number; z: number }[], x: number, z: number) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.z > z) !== (b.z > z) && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
}

type Circle = { x: number; z: number; r: number };
const inCircles = (cs: readonly Circle[], x: number, z: number) => cs.some(c => (x - c.x) ** 2 + (z - c.z) ** 2 <= c.r * c.r);

/**
 * Top (local y) of the drawn geometry over a blocker's footprint grown by MARGIN; −Infinity when nothing is drawn there.
 * Cells inside the landmark's tall parts (`skip`) do not count: a blocker's top is its roof, and a dome, mast or spire on
 * it is a tall part of its own. A blocker that lies mostly (≥ half its footprint) inside tall parts — a tower's leg, a
 * rotunda pier — is part of them and takes their height.
 */
export function blockerTop(g: TopGrid, bl: WalkBlocker, skip: readonly Circle[] = []): number {
  let bbox: [number, number, number, number], inside: (x: number, z: number) => boolean;
  if ('poly' in bl) {
    const p = bl.poly, m2 = MARGIN * MARGIN;
    bbox = [Math.min(...p.map(q => q.x)) - MARGIN, Math.min(...p.map(q => q.z)) - MARGIN, Math.max(...p.map(q => q.x)) + MARGIN, Math.max(...p.map(q => q.z)) + MARGIN];
    inside = (x, z) => {
      if (inPoly(p, x, z)) return true;
      for (let i = 0, j = p.length - 1; i < p.length; j = i++) if (segDist2(x, z, p[j].x, p[j].z, p[i].x, p[i].z) <= m2) return true;
      return false;
    };
  } else {
    const R = bl.r + MARGIN;
    bbox = [bl.x - R, bl.z - R, bl.x + R, bl.z + R];
    inside = (x, z) => (x - bl.x) ** 2 + (z - bl.z) ** 2 <= R * R;
  }
  let cells = 0, inTall = 0;
  if (skip.length) {
    for (let z = Math.floor(bbox[1] / TOP_CELL) * TOP_CELL + TOP_CELL / 2; z <= bbox[3]; z += TOP_CELL) {
      for (let x = Math.floor(bbox[0] / TOP_CELL) * TOP_CELL + TOP_CELL / 2; x <= bbox[2]; x += TOP_CELL) {
        if (!inside(x, z)) continue;
        cells++;
        if (inCircles(skip, x, z)) inTall++;
      }
    }
  }
  const roof = cells && inTall < cells / 2 ? gridMax(g, bbox, (x, z) => inside(x, z) && !inCircles(skip, x, z)) : -Infinity;
  return Number.isFinite(roof) ? roof : gridMax(g, bbox, inside);
}

/** Top (local y) of the drawn geometry inside a circle; −Infinity when nothing is drawn there. */
export function circleTop(g: TopGrid, c: { x: number; z: number; r: number }): number {
  return gridMax(g, [c.x - c.r, c.z - c.r, c.x + c.r, c.z + c.r], (x, z) => (x - c.x) ** 2 + (z - c.z) ** 2 <= c.r * c.r);
}

/** Round a measured top up to 0.1 u (a blocker over nothing drawn: 0.5 u, a kerb-high wall). */
export const roundTop = (y: number) => (Number.isFinite(y) ? Math.ceil(y * 10 - 1e-6) / 10 : 0.5);

export interface MeasuredTops { blockers: number[]; tall: number[] }

/** Every blocker's and tall part's top for landmark `l` (LOCAL y, rounded up to 0.1). */
export function measureTops(l: SfLandmark, models: ReadonlyMap<string, GlbMesh>): MeasuredTops {
  const g = topGrid(drawnLandmark(l, models)), tall = l.tall ?? [];
  return {
    blockers: (l.walk?.blockers ?? []).map(bl => roundTop(blockerTop(g, bl, tall))),
    tall: tall.map(t => roundTop(circleTop(g, t))),
  };
}
