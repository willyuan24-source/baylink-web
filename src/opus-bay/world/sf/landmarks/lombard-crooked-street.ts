import * as THREE from 'three';
import type { Vec2 } from '../../../core/types';
import { type BatchLike, ICO, M, resample } from '../../builder';
import { GLOW, NONE, SF, box, rect, worldPoly } from './kit';
import type { SiteHooks } from '../sites';
import type { SfLandmark, WalkBlocker, WalkSurface } from './index';
import { streetStrips } from './setting';

/**
 * Lombard Street's crooked block (T2), Hyde → Leavenworth: the red-brick one-way lane zig-zagging through eight
 * hairpins between terraced flower beds, with stair sidewalks down both sides. Local +z = downhill east toward
 * Leavenworth (yaw 143.9°); the path is the OSM way 402111597 with its swing widened 2.4× (the real 5 m lane would
 * be 0.7 u — the toy car is 1.0 u wide). Heights: DEM → terrainY (plan §2.2) along the block, base 11.8 = the
 * Leavenworth end; Hyde St sits 7.8 u higher (27 % real grade → 0.39 in the world).
 *
 * Walk: the lane is published as short constant-height `road` slices and each stair step as a `stairs` slice
 * (steps ≤ 0.2 u, under the controller's 0.55 u rise), beds and hedges are blockers.
 */

const X0 = -157.58, Z0 = 168.04, YAW = (143.9 * Math.PI) / 180;
/** terrain (terrainY − base) along the block, sampled on the DEM every 2 u of local z */
const PROFILE: [number, number][] = [[-12, 7.87], [-10, 7.76], [-8, 7.03], [-6, 6.12], [-4, 5.26], [-2, 4.38], [0, 3.48], [2, 2.58], [4, 1.71], [6, 0.84], [8, 0.17], [10, 0.06]];
export function lombardGround(z: number): number {
  if (z <= PROFILE[0][0]) return PROFILE[0][1];
  for (let i = 0; i < PROFILE.length - 1; i++) {
    const [z0, y0] = PROFILE[i], [z1, y1] = PROFILE[i + 1];
    if (z <= z1) return y0 + ((y1 - y0) * (z - z0)) / (z1 - z0);
  }
  return PROFILE[PROFILE.length - 1][1];
}
/** OSM centreline (local), x widened */
const OSM_PATH: [number, number][] = [[-0.36, -11.42], [-0.48, -10.31], [-0.43, -9.92], [-0.29, -9.65], [0.65, -8.54], [0.74, -8.07], [0.62, -7.72], [0.39, -7.44], [-0.8, -6.67], [-1.03, -6.29], [-1.06, -5.94], [-0.94, -5.62], [-0.78, -5.45], [0.6, -4.66], [0.79, -4.36], [0.82, -3.99], [0.55, -3.43], [-0.79, -2.49], [-0.95, -2.2], [-0.98, -1.85], [-0.85, -1.53], [-0.61, -1.29], [0.69, -0.56], [0.87, -0.26], [0.91, -0.02], [0.84, 0.34], [0.64, 0.65], [-0.7, 1.61], [-0.86, 1.9], [-0.9, 2.25], [-0.83, 2.47], [-0.62, 2.74], [0.77, 3.53], [0.95, 3.83], [1, 4.07], [0.93, 4.43], [0.73, 4.74], [-0.55, 5.6], [-0.74, 5.88], [-0.82, 6.21], [-0.69, 6.65], [0.12, 7.29], [0.31, 7.53], [0.37, 8.3], [0.28, 9.1]];
const SWING = 2.4;
const PATH: Vec2[] = resample(OSM_PATH.map(([x, z]) => ({ x: x * SWING, z })), 0.55);
const ROAD_W = 1.35, LIFT = 0.2;
/**
 * Wave 7 (lane R, sf-w7-R-realism.md #6): the hydrangeas that make the postcard — round clumps of blue, pink and purple
 * heads in the hairpin beds and the terraced planters (they were small flat cubes of the generic flower colours).
 * Reference: Wikimedia Commons "Lombard Street 2020.jpg" (checked 2026-09-29).
 */
const HYDRANGEA = ['#8fa6dc', '#e59bb9', '#a88bd3', '#c3cff0', '#d9799f', '#7f92d0'];

/** hairpin apexes (local x extremes along the path) → the flower beds sit inside each hairpin */
const TURNS: Vec2[] = OSM_PATH.filter((p, i, a) => i > 0 && i < a.length - 1 && Math.abs(p[0]) > 0.7 && Math.abs(p[0]) >= Math.abs(a[i - 1][0]) && Math.abs(p[0]) >= Math.abs(a[i + 1][0])).map(([x, z]) => ({ x: x * SWING, z }));
const STAIR_X = 4.0, STAIR_W = 0.9, STEP = 0.8;
const Z_TOP = -10.6, Z_BOT = 9.0;

function bedTriangle(t: Vec2): Vec2[] {
  const s = Math.sign(t.x), A = Math.abs(t.x);
  const c = { x: -s * (A / 3), z: t.z };
  const k = 0.4;
  return [{ x: t.x, z: t.z }, { x: -s * A, z: t.z - 2 }, { x: -s * A, z: t.z + 2 }].map(p => ({ x: c.x + (p.x - c.x) * k, z: c.z + (p.z - c.z) * k }));
}

function build(b: BatchLike, lod: 0 | 2) {
  const yRoad = (_x: number, z: number) => lombardGround(z) + LIFT;
  // the red-brick lane (with a darker curb band under it) and the grass terraces between everything
  box(b, 0, -1.0, (Z_TOP + Z_BOT) / 2, STAIR_X * 2 - 0.4, 0.1, Z_BOT - Z_TOP, SF.lawn, NONE);
  for (let i = 0; i < PROFILE.length - 1; i++) {
    const [z0, y0] = PROFILE[i], [z1, y1] = PROFILE[i + 1];
    if (z1 < Z_TOP - 1 || z0 > Z_BOT + 1) continue;
    const zz0 = Math.max(z0, Z_TOP), zz1 = Math.min(z1, Z_BOT);
    const g0 = y0 + ((y1 - y0) * (zz0 - z0)) / (z1 - z0), g1 = y0 + ((y1 - y0) * (zz1 - z0)) / (z1 - z0);
    const w = STAIR_X * 2 - STAIR_W - 0.2;
    b.quad(new THREE.Vector3(-w / 2, g0 + 0.05, zz0), new THREE.Vector3(w / 2, g0 + 0.05, zz0), new THREE.Vector3(w / 2, g1 + 0.05, zz1), new THREE.Vector3(-w / 2, g1 + 0.05, zz1), new THREE.Vector3(0, 1, 0), SF.lawn, NONE);
  }
  if (lod === 2) {
    b.ribbon(resample(OSM_PATH.map(([x, z]) => ({ x: x * SWING, z })), 1.6), ROAD_W + 0.4, yRoad, '#a4523d', NONE);
    return;
  }
  b.ribbon(PATH, ROAD_W + 0.3, (x, z) => yRoad(x, z) - 0.06, '#8c7b6c', NONE);
  b.ribbon(PATH, ROAD_W, yRoad, (i: number) => new THREE.Color(i % 2 ? '#a9543e' : '#a04f3a'), NONE);
  // flower beds inside each hairpin, clipped hedges along both edges
  TURNS.forEach((t, i) => {
    const tri = bedTriangle(t);
    const cz = (tri[0].z + tri[1].z + tri[2].z) / 3, cx = (tri[0].x + tri[1].x + tri[2].x) / 3;
    const y = lombardGround(cz);
    b.walls(tri, y - 0.8, y + 0.55, '#7d6a58', NONE);
    b.polygon(tri, y + 0.55, SF.hedge, NONE);
    for (let k = 0; k < 4; k++) {
      const p = tri[k % 3], f = k < 3 ? 0.5 : 0.1, q = { x: cx + (p.x - cx) * f, z: cz + (p.z - cz) * f };
      b.add(ICO(0), M(q.x, y + 0.72, q.z, k * 1.3, 0.38, 0.28, 0.38), HYDRANGEA[(i * 2 + k) % HYDRANGEA.length], NONE);
    }
  });
  // terraced planter boxes along both edges (each box tops out 0.35 over its uphill end)
  for (const sx of [-1, 1]) {
    for (let z = Z_TOP, k = 0; z < Z_BOT - 0.1; z += 2.2, k++) {
      const z1 = Math.min(z + 2.2, Z_BOT), yHi = lombardGround(z), yLo = lombardGround(z1);
      box(b, sx * (STAIR_X - 0.95), yLo - 0.3, (z + z1) / 2, 0.8, yHi - yLo + 0.65, z1 - z - 0.05, SF.hedge, NONE);
      for (const f of [0.25, 0.7]) box(b, sx * (STAIR_X - 0.95) + (f - 0.5) * 0.3, yHi + 0.33, z + (z1 - z) * f, 0.36, 0.24, 0.36, HYDRANGEA[(k + (sx > 0 ? 3 : 0) + Math.round(f * 3)) % HYDRANGEA.length], NONE, k + f);
    }
  }
  // stair sidewalks down both sides (treads every 0.8 u following the grade) + a lamp at the top and bottom
  for (const sx of [-1, 1]) {
    for (let z = Z_TOP; z < Z_BOT; z += STEP) {
      const y = lombardGround(z + STEP / 2);
      box(b, sx * STAIR_X, y - 0.8, z + STEP / 2, STAIR_W, 0.95, STEP, '#cfc6b6', NONE);
    }
    for (const z of [Z_TOP + 0.4, Z_BOT - 0.4]) {
      const y = lombardGround(z) + 0.15;
      box(b, sx * (STAIR_X + 0.55), y, z, 0.1, 2.6, 0.1, '#3f5a50', NONE);
      box(b, sx * (STAIR_X + 0.55), y + 2.6, z, 0.28, 0.3, 0.28, '#fff1cf', GLOW(0.9));
    }
  }
}

function walk(): NonNullable<SfLandmark['walk']> {
  const surfaces: WalkSurface[] = [];
  const blockers: WalkBlocker[] = TURNS.map(t => ({ poly: bedTriangle(t) }));
  // lane: one slice per resampled segment (≈0.55 u), constant height = the lane top at its middle
  for (let i = 0; i < PATH.length - 1; i++) {
    const a = PATH[i], c = PATH[i + 1];
    const dx = c.x - a.x, dz = c.z - a.z, L = Math.hypot(dx, dz) || 1, px = (-dz / L) * (ROAD_W / 2), pz = (dx / L) * (ROAD_W / 2);
    const ex = (dx / L) * 0.05, ez = (dz / L) * 0.05;
    surfaces.push({ poly: [{ x: a.x + px - ex, z: a.z + pz - ez }, { x: c.x + px + ex, z: c.z + pz + ez }, { x: c.x - px + ex, z: c.z - pz + ez }, { x: a.x - px - ex, z: a.z - pz - ez }], y: +(lombardGround((a.z + c.z) / 2) + LIFT).toFixed(3), surface: 'road' });
  }
  for (const sx of [-1, 1]) {
    for (let z = Z_TOP; z < Z_BOT; z += STEP) surfaces.push({ poly: rect(sx * STAIR_X, z + STEP / 2, STAIR_W, STEP), y: +(lombardGround(z + STEP / 2) + 0.15).toFixed(3), surface: 'stairs' });
    blockers.push({ poly: rect(sx * (STAIR_X - 0.95), (Z_TOP + Z_BOT) / 2, 0.8, Z_BOT - Z_TOP) });
  }
  return { blockers, surfaces };
}

/**
 * Setting (lane L, wave 4 — D2's remaining T2 settings): the exclusion clipped Hyde St with the Powell–Hyde cable-car
 * rails across the top and Leavenworth St across the foot (the lane met a gap in both): restored as the city draws
 * them, only beyond the lane's ends. The classic view at the top is a crowd spot: Hyde St's far corner (the lane and
 * the Bay below); the foot's view is the arrival, at the foot of the east stairs (looking up the switchbacks).
 */
const CROSS_STREETS = (_x: number, z: number, cls: string) => (cls === 'tertiary' || cls === 'tram' || cls === 'residential') && (z < Z_TOP - 0.3 || z > Z_BOT - 0.4);

export const lombardCrookedStreet: SfLandmark & SiteHooks = {
  id: 'lombard-crooked-street',
  tier: 2,
  x: X0,
  z: Z0,
  yaw: YAW,
  base: 11.8,
  exclude: { poly: worldPoly(X0, Z0, YAW, rect(0, -0.8, 9.6, 21.6)) },
  build,
  walk: walk(),
  ground: streetStrips('lombard-crooked-street', CROSS_STREETS),
  // (W4-L-int-review: the top strip at z −13.9 lay on Hyde St's asphalt by the Powell–Hyde rails; two chosen points on
  // the far corner's sidewalk instead; the foot strip at z 11.1 is dropped too: it lay over Lombard St's roadway and the
  // corner houses east of Leavenworth)
  plaza: [{ poly: rect(-2.5, -13.5, 0.3, 0.3), surface: 'pavement' }, { poly: rect(-3.5, -13.3, 0.3, 0.3), surface: 'pavement' }],
};

export const LOMBARD = { PATH, TURNS, ROAD_W, LIFT, Z_TOP, Z_BOT };
