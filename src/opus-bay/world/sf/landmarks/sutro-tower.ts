import * as THREE from 'three';
import type { BatchLike } from '../../builder';
import { GLOW, NONE, SF, box, cbox, tube } from './kit';
import type { SfLandmark } from './index';

/**
 * Sutro Tower (T1): the three-legged red-and-white TV mast on Mt Sutro, the highest point of the model and its
 * compass. Real: 297.8 m above ground (→ H = 3.2 + 0.155·298 = 49.4 u); base triangle 45.7 m a side, waist triangle
 * 18.3 m, antenna triangle 30.5 m (Wikipedia, verified 2026-09-26) → 6.4 / 2.6 / 4.3 u at 0.14 u/m, kept 1:1 so the
 * waist pinch and the "claw" at the top read. Leg feet from the OSM outline (relation 3829019): one leg points to
 * local +z at yaw −40°. Ground: DEM 255 m → terrainY 46.48 u (base 46.4).
 */

const H = 49.4;
const WAIST_Y = 0.6 * H;
const TOP_Y = 0.84 * H;
const R_BASE = 6.4 / Math.sqrt(3), R_WAIST = 2.6 / Math.sqrt(3), R_TOP = 4.3 / Math.sqrt(3);
const RED = '#c9473a', WHITE = '#f4f1ea';
/** leg angles (local): one leg toward +z, the other two at ±120° */
const LEG_A = [0, (2 * Math.PI) / 3, (-2 * Math.PI) / 3];

const legAt = (a: number, y: number) => {
  const r = y <= WAIST_Y ? R_BASE + (R_WAIST - R_BASE) * (y / WAIST_Y) : y <= TOP_Y ? R_WAIST + (R_TOP - R_WAIST) * ((y - WAIST_Y) / (TOP_Y - WAIST_Y)) : R_TOP;
  return new THREE.Vector3(Math.sin(a) * r, y, Math.cos(a) * r);
};
/** aviation bands: 7 alternating red / white bands up the legs, red at the top */
const bandColor = (y: number) => (Math.floor((y / H) * 7) % 2 === 0 ? RED : WHITE);

function build(b: BatchLike, lod: 0 | 2) {
  const lit = GLOW(0.08);
  const nBands = lod === 0 ? 14 : 2;
  for (const a of LEG_A) {
    // leg: stacked segments following the taper → waist → splay profile, alternating paint bands
    const ys: number[] = [];
    for (let i = 0; i <= nBands; i++) ys.push((TOP_Y * i) / nBands);
    for (let i = 0; i < ys.length - 1; i++) {
      const p0 = legAt(a, ys[i]), p1 = legAt(a, ys[i + 1]);
      const w = 0.46 - 0.14 * (ys[i] / TOP_Y);
      tube(b, p0, p1, lod === 0 ? w : 0.5, lod === 0 ? bandColor((ys[i] + ys[i + 1]) / 2) : i % 2 ? WHITE : RED, lit, lod === 0 ? 4 : 3);
    }
    // antenna mast on top of each leg
    const t = legAt(a, TOP_Y);
    if (lod === 2) { tube(b, t, new THREE.Vector3(t.x, H, t.z), 0.3, RED, lit, 3); continue; }
    tube(b, t, new THREE.Vector3(t.x, H - 1.4, t.z), 0.28, RED, lit, 4);
    tube(b, new THREE.Vector3(t.x, H - 1.4, t.z), new THREE.Vector3(t.x, H, t.z), 0.14, WHITE, NONE, 4);
    if (lod === 0) {
      box(b, t.x, H, t.z, 0.25, 0.25, 0.25, '#ff5040', GLOW(1));
      // concrete foot
      const f = legAt(a, 0);
      box(b, f.x, -1.2, f.z, 1.4, 1.6, 1.4, SF.concrete);
    }
  }
  // horizontal crossbar triangles (platform levels) — the waist, the observatory level and the top "claw"
  const levels = lod === 0 ? [0.2 * H, 0.4 * H, WAIST_Y, 0.74 * H, TOP_Y, TOP_Y + 3.2] : [TOP_Y];
  for (const y of levels) {
    for (let k = 0; k < 3; k++) {
      const yy = Math.min(y, TOP_Y);
      const p = legAt(LEG_A[k], yy), q = legAt(LEG_A[(k + 1) % 3], yy);
      if (y > TOP_Y) { p.y = q.y = y; }
      tube(b, p, q, y >= WAIST_Y ? 0.26 : 0.18, y >= TOP_Y ? RED : WHITE, lit, lod === 0 ? 4 : 3);
    }
  }
  if (lod === 2) return;
  // diagonal lattice braces on the three faces (lower tower)
  for (let k = 0; k < 3; k++) {
    const a0 = LEG_A[k], a1 = LEG_A[(k + 1) % 3];
    for (const [ya, yb] of [[0, 0.2 * H], [0.2 * H, 0.4 * H], [0.4 * H, WAIST_Y]]) {
      tube(b, legAt(a0, ya), legAt(a1, yb), 0.1, WHITE, NONE, 3);
      tube(b, legAt(a1, ya), legAt(a0, yb), 0.1, WHITE, NONE, 3);
    }
  }
  // outrigger prongs of the claw + dish/antenna panels
  for (const a of LEG_A) {
    const t = legAt(a, TOP_Y + 1.6);
    const out = new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
    tube(b, t, t.clone().addScaledVector(out, 1.4), 0.14, WHITE, NONE, 3);
    cbox(b, t.x + out.x * 1.5, TOP_Y + 1.6, t.z + out.z * 1.5, 0.35, 1.1, 0.35, '#e7e3da');
    for (const y of [0.52 * H, 0.66 * H]) {
      const p = legAt(a, y);
      cbox(b, p.x * 1.18, y, p.z * 1.18, 0.5, 0.8, 0.5, '#e7e3da', NONE, a);
    }
  }
  // transmitter building on the summit
  box(b, -3.6, -1, -2.4, 4.2, 2.6, 2.4, '#d9d2c3', [3, -1, 0, 0]);
  box(b, -3.6, 1.6, -2.4, 4.4, 0.18, 2.6, '#c1b8a6');
  // mid-level aviation lights
  for (const a of LEG_A) {
    const p = legAt(a, WAIST_Y);
    box(b, p.x, WAIST_Y + 0.25, p.z, 0.2, 0.2, 0.2, '#ff5040', GLOW(1));
  }
}

export const sutroTower: SfLandmark = {
  id: 'sutro-tower',
  tier: 1,
  x: 72.87,
  z: 974.54,
  yaw: (-40 * Math.PI) / 180,
  base: 46.4,
  exclude: { r: 6.5 },
  castShadow: true,
  build,
  walk: {
    blockers: [
      ...LEG_A.map(a => { const f = legAt(a, 0); return { x: f.x, z: f.z, r: 0.9 }; }),
      // the transmitter building (its roof, 1.6 + 0.18: it stands mostly inside the mast's tall circle, which would lend it 49.7)
      { poly: [{ x: -5.8, z: -3.7 }, { x: -1.4, z: -3.7 }, { x: -1.4, z: -1.1 }, { x: -5.8, z: -1.1 }], top: 1.8 },
    ],
  },
  // D2-10: the glide steers round the whole mast (legs, platforms, antenna arms): r 6 about the upper cluster
  tall: [{ x: 0, z: 0.8, r: 6 }],
};
