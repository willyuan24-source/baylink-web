import * as THREE from 'three';
import type { Vec2 } from '../../../core/types';
import { type BatchLike, ICO, M, resample } from '../../builder';
import { GLOW, NONE, SELF, SWAY, box, cyl, disc, pyramid, worldPoly } from './kit';
import type { SfLandmark } from './index';

/**
 * Oracle Park (T2): the brick ballpark on McCovey Cove — horseshoe grandstand from the left-field pole around home
 * to the short right-field line along the water, the brick right-field wall, outfield bleachers, a blank
 * scoreboard, the giant glove in left field, light towers and the brick clock tower over the plaza gate. No logos,
 * no bottle. Local +z points from center field to home plate (yaw −41.3°); home plate, the foul lines and the
 * outfield fence follow the OSM pitch (way 500283910): LF 339 ft, CF 399 ft, RF 309 ft at 0.14 u/m. The stands
 * rise to 7 u (45 m OSM height, plan §2.3 gives 10.2 u incl. the light towers).
 */

const X0 = 356.81, Z0 = 162.26, YAW = (-41.3 * Math.PI) / 180;
const HOME: Vec2 = { x: 0.6, z: 7.6 };
const GRASS = '#7fae5e', GRASS_DARK = '#6f9d52', DIRT = '#c79f76', SEAT = '#3d6158', SEAT2 = '#46695f', BRICK = '#a9583f', BRICK_DARK = '#8f4834', CREAM = '#efe4cf';
const dir = (th: number) => ({ x: Math.sin(th), z: -Math.cos(th) });
const at = (th: number, r: number): Vec2 => { const d = dir(th); return { x: HOME.x + d.x * r, z: HOME.z + d.z * r }; };
const DEG = Math.PI / 180;
const OUTLINE: Vec2[] = [[14.13, 5.26], [5.68, 14.9], [2.41, 15.68], [0.37, 16.2], [-19.77, -1.83], [-14.74, -6.66], [-13.26, -4.97], [-3.52, -13.97], [5.14, -14.23]].map(([x, z]) => ({ x, z }));
/** outfield fence radius by angle from centre field (LF −45° … RF +45°) */
const FENCE: [number, number][] = [[-45, 14.2], [-22.5, 16.2], [0, 17.0], [22.5, 17.4], [45, 13.2]];
const fenceR = (deg: number) => {
  for (let i = 0; i < FENCE.length - 1; i++) {
    const [a0, r0] = FENCE[i], [a1, r1] = FENCE[i + 1];
    if (deg <= a1) { const t = (deg - a0) / (a1 - a0); return r0 + (r1 - r0) * (t * t * (3 - 2 * t)); }
  }
  return FENCE[FENCE.length - 1][1];
};

/** grandstand: inner edge polyline + per-point depth/height; one rake quad, back wall and front wall per segment */
function stands(b: BatchLike, lod: 0 | 2) {
  const inner: Vec2[] = resample([{ x: -10.3, z: -1.6 }, { x: -2.4, z: 6.3 }, { x: -0.9, z: 9.4 }, { x: 2.1, z: 9.4 }, { x: 3.6, z: 6.3 }, { x: 10.8, z: -0.9 }], lod === 0 ? 2.4 : 9);
  const n = inner.length;
  const prof = (i: number) => {
    // right-field side (the last third) is the low arcade along the cove
    const t = i / (n - 1);
    return t < 0.72 ? { d: 6.8, h: 7.0 } : { d: 6.8 - (t - 0.72) * 12, h: 7.0 - (t - 0.72) * 14 };
  };
  const norms = inner.map((_, i) => {
    const a = inner[Math.max(0, i - 1)], c = inner[Math.min(n - 1, i + 1)];
    const dx = c.x - a.x, dz = c.z - a.z, L = Math.hypot(dx, dz) || 1;
    return { x: -dz / L, z: dx / L }; // left of travel = away from the field for this winding
  });
  const outer = inner.map((p, i) => ({ x: p.x + norms[i].x * prof(i).d, z: p.z + norms[i].z * prof(i).d }));
  const V = (p: Vec2, y: number) => new THREE.Vector3(p.x, y, p.z);
  for (let i = 0; i < n - 1; i++) {
    const h0 = prof(i).h, h1 = prof(i + 1).h;
    const up = new THREE.Vector3(-(norms[i].x + norms[i + 1].x) / 2, 1.4, -(norms[i].z + norms[i + 1].z) / 2).normalize();
    b.quad(V(inner[i], 0.8), V(inner[i + 1], 0.8), V(outer[i + 1], h1), V(outer[i], h0), up, i % 2 ? SEAT : SEAT2, NONE);
    const out = new THREE.Vector3((norms[i].x + norms[i + 1].x) / 2, 0, (norms[i].z + norms[i + 1].z) / 2).normalize();
    b.quad(V(outer[i], -1.2), V(outer[i + 1], -1.2), V(outer[i + 1], h1 + 0.4), V(outer[i], h0 + 0.4), out, [BRICK_DARK, BRICK_DARK, BRICK, BRICK], lod === 0 ? [4, 0, -3.3, 0] : NONE);
    b.quad(V(inner[i], -0.2), V(inner[i + 1], -0.2), V(inner[i + 1], 0.8), V(inner[i], 0.8), out.clone().negate(), '#2f4a44', NONE);
    if (lod === 0) {
      // roof lip / upper deck fascia, concourse cross-aisle stripe
      b.quad(V(outer[i], h0 + 0.4), V(outer[i + 1], h1 + 0.4), V({ x: outer[i + 1].x - norms[i + 1].x * 1.0, z: outer[i + 1].z - norms[i + 1].z * 1.0 }, h1 + 0.45), V({ x: outer[i].x - norms[i].x * 1.0, z: outer[i].z - norms[i].z * 1.0 }, h0 + 0.45), new THREE.Vector3(0, 1, 0), CREAM, NONE);
      const m = (k: number, f: number) => ({ x: inner[k].x + (outer[k].x - inner[k].x) * f, z: inner[k].z + (outer[k].z - inner[k].z) * f });
      b.quad(V(m(i, 0.5), 0.8 + (h0 - 0.8) * 0.5 + 0.03), V(m(i + 1, 0.5), 0.8 + (h1 - 0.8) * 0.5 + 0.03), V(m(i + 1, 0.56), 0.8 + (h1 - 0.8) * 0.56 + 0.03), V(m(i, 0.56), 0.8 + (h0 - 0.8) * 0.56 + 0.03), up, '#c9c1b1', NONE);
    }
  }
  return outer;
}

function build(b: BatchLike, lod: 0 | 2) {
  // field: outfield grass fan, infield dirt, grass diamond, mound, bases
  const fan: Vec2[] = [HOME];
  for (let d = -45; d <= 45; d += lod === 0 ? 7.5 : 22.5) fan.push(at(d * DEG, fenceR(d)));
  b.polygon(fan, 0.05, GRASS, NONE);
  if (lod === 0) {
    const dirt: Vec2[] = [HOME];
    for (let d = -45; d <= 45; d += 15) dirt.push(at(d * DEG, 4.3));
    b.polygon(dirt, 0.07, DIRT, NONE);
    b.polygon([HOME, at(-45 * DEG, 3.84), at(0, 5.43), at(45 * DEG, 3.84)].map((p, i) => (i === 0 ? { x: p.x, z: p.z - 0.5 } : p)), 0.09, GRASS_DARK, NONE);
    disc(b, at(0, 2.6).x, 0.1, at(0, 2.6).z, 0.45, 0.06, 0, DIRT, NONE, 10);
    for (const p of [at(-45 * DEG, 3.84), at(0, 5.43), at(45 * DEG, 3.84), HOME]) box(b, p.x, 0.1, p.z, 0.22, 0.05, 0.22, '#f7f4ec', NONE, Math.PI / 4);
    // warning track stripes along the fence
    for (let d = -45; d < 45; d += 7.5) {
      const a = at(d * DEG, fenceR(d) - 0.5), c = at((d + 7.5) * DEG, fenceR(d + 7.5) - 0.5), a2 = at(d * DEG, fenceR(d)), c2 = at((d + 7.5) * DEG, fenceR(d + 7.5));
      b.polygon([a, c, c2, a2], 0.08, DIRT, NONE);
    }
  }
  const outer = stands(b, lod);
  // outfield fence: tall brick wall in right field (the cove side), low green wall elsewhere; bleachers in left-centre
  const step = lod === 0 ? 7.5 : 22.5;
  for (let d = -45; d < 45 && lod === 0; d += step) {
    const a = at(d * DEG, fenceR(d)), c = at((d + step) * DEG, fenceR(d + step));
    const tall = d >= 15;
    const L = Math.hypot(c.x - a.x, c.z - a.z), ry = Math.atan2(c.x - a.x, c.z - a.z);
    box(b, (a.x + c.x) / 2, -1.2, (a.z + c.z) / 2, 0.35, (tall ? 3.4 : 2.1), L + 0.1, tall ? BRICK : '#2f5a4b', tall && lod === 0 ? [4, -1, -5.1, 0] : NONE, ry);
    if (!tall && d < 5) {
      const a3 = at(d * DEG, fenceR(d) + 4.2), c3 = at((d + step) * DEG, fenceR(d + step) + 4.2);
      const nrm = new THREE.Vector3((a.x + c.x) / 2 - HOME.x, 3, (a.z + c.z) / 2 - HOME.z).normalize().multiply(new THREE.Vector3(-1, 1, -1));
      b.quad(new THREE.Vector3(a.x, 0.9, a.z), new THREE.Vector3(c.x, 0.9, c.z), new THREE.Vector3(c3.x, 3.6, c3.z), new THREE.Vector3(a3.x, 3.6, a3.z), nrm, SEAT2, NONE);
      b.quad(new THREE.Vector3(a3.x, -1.2, a3.z), new THREE.Vector3(c3.x, -1.2, c3.z), new THREE.Vector3(c3.x, 3.6, c3.z), new THREE.Vector3(a3.x, 3.6, a3.z), nrm.clone().setY(0).negate().normalize(), BRICK, NONE);
    }
  }
  // clock tower over the plaza gate behind home plate (brick, cream trim, blank clock faces)
  const ct = { x: 1.2, z: 17.4 };
  box(b, ct.x, -1.2, ct.z, 1.8, 8.6, 1.8, BRICK, GLOW(0.08));
  pyramid(b, ct.x, 7.4, ct.z, 1.9, 1.9, 1.5, '#5f6f6a');
  if (lod === 2) return;
  box(b, ct.x, 7.4, ct.z, 2.1, 0.3, 2.1, CREAM);
  for (let k = 0; k < 4; k++) { const a = (k * Math.PI) / 2; disc(b, ct.x + Math.sin(a) * 0.91, 6.1, ct.z + Math.cos(a) * 0.91, 0.55, 0.04, a, '#f7f1e3', GLOW(0.9), 12); }
  // light towers on the stand rims
  for (const k of [1, 3, 5, 8]) {
    const p = outer[Math.min(outer.length - 1, k)];
    cyl(b, p.x, 6.5, p.z, 0.12, 5.2, '#8e9594', NONE, 5);
    box(b, p.x, 11.6, p.z, 1.3, 0.8, 0.3, '#e9eef0', GLOW(0.9), Math.atan2(HOME.x - p.x, HOME.z - p.z));
  }
  // scoreboard (blank) in right-centre, the giant glove in left field
  const sb = at(18 * DEG, 21.6);
  for (const sx of [-1.6, 1.6]) box(b, sb.x + sx, -1.2, sb.z, 0.3, 5.5, 0.3, '#5d6664', NONE, 18 * DEG);
  box(b, sb.x, 4.0, sb.z, 5.0, 2.8, 0.5, '#2c3a40', SELF(1.08), 18 * DEG);
  box(b, sb.x, 6.8, sb.z, 5.2, 0.3, 0.6, CREAM, NONE, 18 * DEG);
  const gl = at(-33 * DEG, 21.2);
  b.add(ICO(1), M(gl.x, 2.4, gl.z, -33 * DEG, 1.5, 1.9, 0.7), '#8a5a36', NONE);
  for (let f = 0; f < 4; f++) cyl(b, gl.x + Math.cos(-33 * DEG) * (f - 1.5) * 0.62, 3.6, gl.z - Math.sin(-33 * DEG) * (f - 1.5) * 0.62, 0.28, 1.4 - Math.abs(f - 1.5) * 0.25, '#8a5a36', NONE, 6);
  cyl(b, gl.x, -0.5, gl.z, 0.3, 1.5, '#6f6a62', NONE, 6);
  // palms on the plaza
  for (const [px, pz] of [[-3.4, 16.8], [5.6, 16.2]]) {
    cyl(b, px, 0, pz, 0.14, 3.6, '#8f7458', NONE, 5);
    b.add(ICO(0), M(px, 3.9, pz, 0, 1.2, 0.5, 1.2), '#5f8f4f', SWAY(0.6));
  }
}

export const oraclePark: SfLandmark = {
  id: 'oracle-park',
  tier: 2,
  x: X0,
  z: Z0,
  yaw: YAW,
  base: 0.15,
  exclude: { poly: worldPoly(X0, Z0, YAW, [{ x: -20, z: -14.5 }, { x: 14.5, z: -14.5 }, { x: 14.5, z: 20 }, { x: -20, z: 20 }]) },
  build,
  // the ballpark is ticketed: its whole OSM outline (relation 7325085, local) blocks; the plaza gate is outside
  walk: { blockers: [{ poly: OUTLINE }] },
};
