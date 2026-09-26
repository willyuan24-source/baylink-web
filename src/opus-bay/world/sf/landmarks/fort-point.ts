import * as THREE from 'three';
import { type BatchLike, M } from '../../builder';
import { GLOW, LIT, NONE, archGeo, box, lathe, worldPoly } from './kit';
import type { SfLandmark } from './index';

/**
 * Fort Point (T2): the 1861 brick casemate fort under the Golden Gate Bridge's south arch — three tiers of gun
 * arches on the walls, the open parade ground ringed by three tiers of arched casemates, a granite sea-wall foot,
 * the barbette parapet and the little iron lighthouse on its rim.
 * Local +z faces the strait (yaw −123°), outline = OSM relation 5504536 (simplified, local). 15 m → H 5.5 u.
 */

const X0 = -750.46, Z0 = 594.21, YAW = (-123 * Math.PI) / 180;
const BRICK = '#a8573e', BRICK_DARK = '#8d4733', GRANITE = '#bdb3a2', ROOF = '#a79d8e';
const FORT: [number, number][] = [[5.15, -5.25], [-4.08, -1.32], [-4.44, 1.66], [-5.81, 2.23], [-6.01, 2.78], [-5.57, 3.76], [-5.04, 4.01], [-3.68, 3.44], [-2.24, 4.54], [-1.56, 4.57], [3.72, 2.35], [4.92, 3.29], [5.56, 3.23], [6.21, 2.36], [6.11, 1.77], [4.92, 0.83], [5.62, -4.87]];
const H = 5.5;
/** parade ground = the outline shrunk toward its centroid */
const COURT = 0.56;

function build(b: BatchLike, lod: 0 | 2) {
  const poly = FORT.map(([x, z]) => ({ x, z }));
  b.walls(poly, -1.5, 0.7, GRANITE, NONE);
  b.walls(poly, 0.7, H + 0.5, BRICK, GLOW(0.05), BRICK_DARK);
  if (lod === 2) { b.polygon(poly, H + 0.5, ROOF, NONE); return; }
  // barbette roof as a ring around the open parade ground; courtyard walls face inward
  const cx = FORT.reduce((s, p) => s + p[0], 0) / FORT.length, cz = FORT.reduce((s, p) => s + p[1], 0) / FORT.length;
  const inner = poly.map(p => ({ x: cx + (p.x - cx) * COURT, z: cz + (p.z - cz) * COURT }));
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < poly.length; i++) {
    const j = (i + 1) % poly.length, a = poly[i], c = poly[j], ia = inner[i], ic = inner[j];
    b.quad(new THREE.Vector3(a.x, H + 0.5, a.z), new THREE.Vector3(c.x, H + 0.5, c.z), new THREE.Vector3(ic.x, H + 0.5, ic.z), new THREE.Vector3(ia.x, H + 0.5, ia.z), up, ROOF, NONE);
    const dx = ic.x - ia.x, dz = ic.z - ia.z, L = Math.hypot(dx, dz);
    if (L < 1e-3) continue;
    let nx = -dz / L, nz = dx / L;
    if (nx * (cx - (ia.x + ic.x) / 2) + nz * (cz - (ia.z + ic.z) / 2) < 0) { nx = -nx; nz = -nz; }
    b.quad(new THREE.Vector3(ia.x, 0.3, ia.z), new THREE.Vector3(ic.x, 0.3, ic.z), new THREE.Vector3(ic.x, H + 0.5, ic.z), new THREE.Vector3(ia.x, H + 0.5, ia.z), new THREE.Vector3(nx, 0, nz), [BRICK_DARK, BRICK_DARK, BRICK, BRICK], [0, 0.3, 0, 0.05]);
    if (L < 0.9) continue;
    const ry = Math.atan2(nx, nz), n = Math.floor(L / 0.62);
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n;
      for (const y of [0.35, 2.0, 3.65]) b.add(archGeo(0.42, 1.35, 4), M(ia.x + dx * t + nx * 0.02, y, ia.z + dz * t + nz * 0.02, ry), '#3a2d27', y < 1 ? LIT(0.35) : NONE);
    }
  }
  b.polygon(inner, 0.3, '#b7ad9e', NONE);
  b.walls(poly.map(p => ({ x: cx + (p.x - cx) * 1.005, z: cz + (p.z - cz) * 1.005 })), H + 0.2, H + 0.35, GRANITE, NONE);
  // casemate arches on every long wall: three tiers on the strait side, two elsewhere
  const area = FORT.reduce((s, p, i) => { const q = FORT[(i + 1) % FORT.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0);
  const sgn = area >= 0 ? 1 : -1;
  for (let i = 0; i < FORT.length; i++) {
    const [ax, az] = FORT[i], [bx, bz] = FORT[(i + 1) % FORT.length];
    const dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz);
    if (L < 1.4) continue;
    const nx = (sgn * dz) / L, nz = (-sgn * dx) / L;
    const ry = Math.atan2(nx, nz);
    const tiers = nz > 0.3 ? [0.9, 2.5, 4.1] : [2.5, 4.1];
    const n = Math.floor(L / 0.78);
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n;
      for (const y of tiers) b.add(archGeo(0.36, 0.95, 4), M(ax + dx * t + nx * 0.02, y, az + dz * t + nz * 0.02, ry), '#3d302a', y < 1 ? LIT(y) : NONE);
    }
  }
  // the lighthouse on the north-west rim
  const lx = -5.2, lz = 3.2;
  lathe(b, [[0.42, 0], [0.34, 1.4], [0.5, 1.45], [0.5, 1.55]], lx, H + 0.5, lz, '#e9e4d8', NONE, 6);
  lathe(b, [[0.34, 0], [0.34, 0.5]], lx, H + 2.05, lz, '#fff0c8', GLOW(1), 6);
  lathe(b, [[0.42, 0], [0.12, 0.45], [0.02, 0.6]], lx, H + 2.55, lz, '#3e4447', NONE, 6);
  // sea wall + the stair tower where the bridge's arch lands
  box(b, 0.5, -1.2, 5.6, 13.5, 1.5, 0.7, GRANITE, NONE);
  box(b, 5.4, 0.3, -4.2, 1.4, H + 1.3, 1.4, BRICK, NONE);
  box(b, 5.4, H + 1.6, -4.2, 1.6, 0.2, 1.6, GRANITE, NONE);
}

export const fortPoint: SfLandmark = {
  id: 'fort-point',
  tier: 2,
  x: X0,
  z: Z0,
  yaw: YAW,
  base: 0.3,
  exclude: { poly: worldPoly(X0, Z0, YAW, [{ x: -7, z: -6.5 }, { x: 7, z: -6.5 }, { x: 7, z: 6.2 }, { x: -7, z: 6.2 }]) },
  build,
  walk: { blockers: [{ poly: FORT.map(([x, z]) => ({ x, z })) }, { poly: [{ x: -6.3, z: 5.25 }, { x: 7.3, z: 5.25 }, { x: 7.3, z: 5.95 }, { x: -6.3, z: 5.95 }] }] },
};

