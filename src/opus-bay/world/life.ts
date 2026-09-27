import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { Vec2 } from '../core/types';
import { emit } from '../core/events';
import { runtime } from '../core/runtime';
import { game } from '../core/store';
import { canStand, heightAt, isWater } from '../core/terrain';
import { DISTRICT, frameAt, stationOf } from '../data/district';
import { ASSETS, type ModelAsset } from '../data/assets';
import { activeFerrySystem, pendingFerry } from '../data/transit';
import { BOX, Batch, C, CBOX, CONE, CYL, M, SPHERE, extrudeXZ, hash2, rng } from './builder';
import { cityStreamerLazy } from './cityLoader';
import { K_DOCK_FLOATS, kDockFrame, kDockSpots } from './landmarks';
import { TOY_DYN, TOY_INST, TOY_INST_TINT, U } from './materials';
import { MAX_WAKES } from './water';

/**
 * Ambient life: ferries (incl. the arrival ferry), sailboats, sea lions on the K-Dock, pelicans, gulls,
 * a harbor seal, promenade pedestrians, the Pier 39 carousel, Alcatraz's lighthouse beam and the
 * Exploratorium fog bridge. GLB creatures load lazily once the game starts.
 */

export const FERRY_ARRIVAL_SECONDS = 3;
const WATER = DISTRICT.waterLevel;
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const place = (mesh: THREE.InstancedMesh, i: number, x: number, y: number, z: number, ry: number, s = 1, rx = 0, rz = 0, sy = s) => {
  _e.set(rx, ry, rz, 'YXZ');
  _m.compose(_p.set(x, y, z), _q.setFromEuler(_e), _s.set(s, sy, s));
  mesh.setMatrixAt(i, _m);
};
const setObj = (o: THREE.Object3D, x: number, y: number, z: number, ry: number, rx = 0, rz = 0, s = 1) => {
  _e.set(rx, ry, rz, 'YXZ');
  o.matrix.compose(_p.set(x, y, z), _q.setFromEuler(_e), _s.set(s, s, s));
  o.matrixWorldNeedsUpdate = true;
};

// ---------------------------------------------------------------------------
// Routes (closed polylines over open water)
// ---------------------------------------------------------------------------

class Route {
  pts: Vec2[];
  cum: number[] = [0];
  total = 0;
  constructor(pts: Vec2[], closed: boolean) {
    // Catmull-Rom smoothing
    const src = closed ? pts : pts;
    const out: Vec2[] = [];
    const n = src.length;
    const get = (i: number) => (closed ? src[(i + n) % n] : src[Math.max(0, Math.min(n - 1, i))]);
    const segs = closed ? n : n - 1;
    for (let i = 0; i < segs; i++) {
      const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
      for (let k = 0; k < 10; k++) {
        const t = k / 10, t2 = t * t, t3 = t2 * t;
        const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
        out.push({ x: f(p0.x, p1.x, p2.x, p3.x), z: f(p0.z, p1.z, p2.z, p3.z) });
      }
    }
    out.push(closed ? { ...out[0] } : { ...src[n - 1] });
    this.pts = out;
    for (let i = 1; i < out.length; i++) this.cum.push(this.cum[i - 1] + Math.hypot(out[i].x - out[i - 1].x, out[i].z - out[i - 1].z));
    this.total = this.cum[this.cum.length - 1];
  }
  at(s: number) {
    const ss = ((s % this.total) + this.total) % this.total;
    let lo = 0, hi = this.cum.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (this.cum[mid] <= ss) lo = mid; else hi = mid; }
    const a = this.pts[lo], b = this.pts[hi];
    const t = (ss - this.cum[lo]) / (this.cum[hi] - this.cum[lo] || 1);
    return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, heading: Math.atan2(b.x - a.x, b.z - a.z) };
  }
}

// ---------------------------------------------------------------------------
// Models
// ---------------------------------------------------------------------------

const FERRY_PLAN = [
  { x: -1.7, z: -5.3 }, { x: 1.7, z: -5.3 }, { x: 2.1, z: -4.8 }, { x: 2.1, z: 2.6 }, { x: 1.55, z: 4.6 }, { x: 0.6, z: 5.7 }, { x: 0, z: 5.9 },
  { x: -0.6, z: 5.7 }, { x: -1.55, z: 4.6 }, { x: -2.1, z: 2.6 }, { x: -2.1, z: -4.8 },
];
let ferryHull: THREE.BufferGeometry[] | null = null;
/**
 * A Bay ferry. `openDeck` (city mode, lane F8: the rideable ferry): instead of the enclosed upper cabin, an open sun deck
 * on the main cabin roof (planks, railings, two outward benches) with the wheelhouse, funnel and mast at its bow end.
 */
export function ferryGeometry(stripe: string, openDeck = false): THREE.BufferGeometry {
  const b = new Batch();
  const white = '#f7f4ec', glass = '#41535a';
  ferryHull ??= [extrudeXZ(FERRY_PLAN, -1.0, -0.45), extrudeXZ(FERRY_PLAN, -0.45, 0.2), extrudeXZ(FERRY_PLAN, 0.2, 0.7), extrudeXZ(FERRY_PLAN.map(p => ({ x: p.x * 0.94, z: p.z * 0.97 })), 0.7, 0.74)];
  const id = new THREE.Matrix4();
  b.add(ferryHull[0], id, '#c9573c');
  b.add(ferryHull[1], id, white);
  b.add(ferryHull[2], id, stripe);
  b.add(ferryHull[3], id, '#d8cdbb');
  b.add(BOX(), M(0, 0.7, -0.4, 0, 3.8, 1.3, 8.4), white);
  // cabin windows: rows of panes, most of them warm-lit at night (style 7), a few dark
  const lit: [number, number, number, number] = [7, 0.4, 0, 0];
  const panes = (y: number, h: number, z0: number, z1: number, halfW: number, n: number, seed: number) => {
    const step = (z1 - z0) / n;
    for (let i = 0; i < n; i++) {
      const on = hash2(i, seed) > 0.18;
      for (const sx of [-1, 1]) b.add(BOX(), M(sx * halfW, y, z0 + (i + 0.5) * step, 0, 0.06, h, step * 0.72), glass, on ? lit : [0, 0, 0, 0]);
    }
  };
  b.add(BOX(), M(0, 1.05, -0.4, 0, 3.8, 0.6, 8.0), white);
  panes(1.08, 0.46, -4.4, 3.6, 1.93, 9, 3);
  if (openDeck) {
    sunDeck(b, stripe, white, glass, lit);
    for (const s of [-1, 1]) b.add(BOX(), M(s * 1.95, 0.7, -0.4, 0, 0.06, 0.5, 9.6), '#e9e4da');
    for (const z of [4.6, -5.6]) b.add(SPHERE(5, 4), M(0, 1.6, z, 0, 0.12, 0.12, 0.12), '#fff1c4', [0, 0, 0, 1]);
    return b.build();
  }
  b.add(BOX(), M(0, 2.0, -1.0, 0, 3.3, 1.1, 5.6), white);
  panes(2.32, 0.42, -3.6, 1.6, 1.68, 6, 7);
  b.add(BOX(), M(0, 3.1, 1.2, 0, 2.2, 0.9, 1.8), white);
  b.add(BOX(), M(0, 3.35, 1.2, 0, 2.24, 0.4, 1.6), glass, lit);
  b.add(BOX(), M(0, 4.0, 1.2, 0, 2.5, 0.12, 2.1), '#d9d4c7');
  b.add(CYL(8), M(0, 3.1, -2.5, 0, 0.35, 1.6, 0.35), stripe);
  b.add(CYL(5), M(0, 4.1, 1.8, 0, 0.05, 1.8, 0.05), '#e7e1d5');
  for (const s of [-1, 1]) b.add(BOX(), M(s * 1.95, 0.7, -0.4, 0, 0.06, 0.5, 9.6), '#e9e4da');
  for (const z of [4.6, -5.6]) b.add(SPHERE(5, 4), M(0, 1.6, z, 0, 0.12, 0.12, 0.12), '#fff1c4', [0, 0, 0, 1]);
  return b.build();
}

/** The open sun deck (F8): plank floor at y 2.0–2.04, railings, outward benches, the wheelhouse / funnel / mast forward. */
function sunDeck(b: Batch, stripe: string, white: string, glass: string, lit: [number, number, number, number]) {
  const wood = '#b98a5a', rail = '#f2eee6';
  b.add(BOX(), M(0, 2.0, -0.4, 0, 3.6, 0.04, 8.1), wood);
  // railings: posts round the edge and a top rail (open at nothing: the deck is a toy, you cannot fall off)
  const minZ = -4.4, maxZ = 3.7, hw = 1.82;
  for (let z = minZ; z <= maxZ + 1e-6; z += (maxZ - minZ) / 7) for (const sx of [-1, 1]) b.add(BOX(), M(sx * hw, 2.04, z, 0, 0.06, 0.72, 0.06), rail);
  for (const sx of [-1, 1]) b.add(BOX(), M(sx * hw, 2.74, (minZ + maxZ) / 2, 0, 0.07, 0.06, maxZ - minZ), rail);
  for (let x = -hw; x <= hw + 1e-6; x += hw / 2) b.add(BOX(), M(x, 2.04, minZ, 0, 0.06, 0.72, 0.06), rail);
  b.add(BOX(), M(0, 2.74, minZ, 0, hw * 2, 0.06, 0.07), rail);
  b.add(BOX(), M(0, 2.3, minZ, 0, hw * 2, 0.04, 0.05), rail);
  // two benches back to back down the middle, facing out to either rail
  for (const sx of [-1, 1]) {
    b.add(BOX(), M(sx * 0.95, 2.4, -2.2, 0, 0.5, 0.08, 2.8), wood);
    b.add(BOX(), M(sx * 0.95, 2.04, -2.2, 0, 0.36, 0.36, 2.6), '#8a6a4a');
    b.add(BOX(), M(sx * 0.66, 2.48, -2.2, 0, 0.07, 0.42, 2.8), wood);
  }
  // wheelhouse at the bow end of the deck: white box, a band of lit windows, roof, funnel in the line colour, mast
  b.add(BOX(), M(0, 2.04, 2.45, 0, 2.3, 1.15, 1.9), white);
  b.add(BOX(), M(0, 2.55, 2.45, 0, 2.34, 0.42, 1.7), glass, lit);
  b.add(BOX(), M(0, 3.19, 2.45, 0, 2.6, 0.12, 2.2), '#d9d4c7');
  b.add(CYL(8), M(0, 3.31, 2.0, 0, 0.3, 1.0, 0.3), stripe);
  b.add(CYL(5), M(0, 3.31, 1.8, 0, 0.05, 2.6, 0.05), '#e7e1d5');
}

function gullGeometry(): THREE.BufferGeometry {
  const b = new Batch();
  b.add(SPHERE(8, 6), M(0, 0, 0, 0, 0.13, 0.12, 0.3), '#fbfaf6');
  b.add(SPHERE(6, 5), M(0, 0.06, 0.26, 0, 0.09, 0.09, 0.1), '#fbfaf6');
  b.add(CONE(5), M(0, 0.05, 0.36, 0, 0.03, 0.12, 0.03, Math.PI / 2), '#f0c24a');
  b.add(CBOX(), M(0, 0, -0.33, 0, 0.16, 0.03, 0.14), '#e9e6e0');
  for (const s of [-1, 1]) {
    b.add(CBOX(), M(s * 0.3, 0.03, 0.02, 0, 0.46, 0.025, 0.2), '#c3c8cb', [0, 0, 1, 0]);
    b.add(CBOX(), M(s * 0.63, 0.03, -0.02, 0, 0.22, 0.02, 0.15), '#3c3f42', [0, 0, 1, 0]);
  }
  return b.build();
}

function glidingPelicanGeometry(): THREE.BufferGeometry {
  const b = new Batch();
  b.add(SPHERE(8, 6), M(0, 0, 0, 0, 0.22, 0.2, 0.55), '#8f8a84');
  b.add(SPHERE(6, 5), M(0, 0.1, 0.5, 0, 0.12, 0.12, 0.14), '#efe6cf');
  b.add(CONE(5), M(0, 0.06, 0.62, 0, 0.05, 0.55, 0.06, Math.PI / 2 + 0.12), '#d9905a');
  for (const s of [-1, 1]) {
    b.add(CBOX(), M(s * 0.55, 0.05, 0, 0, 0.9, 0.04, 0.34, 0, s * -0.05), '#8a857f', [0, 0, 0.6, 0]);
    b.add(CBOX(), M(s * 1.15, 0.02, -0.04, 0, 0.45, 0.03, 0.26, 0, s * -0.12), '#3d3a37', [0, 0, 1, 0]);
  }
  b.add(CBOX(), M(0, 0, -0.55, 0, 0.2, 0.03, 0.2), '#7a756f');
  return b.build();
}

function sealGeometry(): THREE.BufferGeometry {
  const b = new Batch();
  b.add(SPHERE(10, 8), M(0, 0.1, 0, 0, 0.28, 0.3, 0.3), '#6f6a66');
  b.add(SPHERE(8, 6), M(0, 0.05, 0.24, 0, 0.16, 0.13, 0.14), '#8a847d');
  for (const s of [-1, 1]) b.add(SPHERE(5, 4), M(s * 0.11, 0.2, 0.22, 0, 0.045, 0.05, 0.03), '#1d1c1c');
  b.add(SPHERE(5, 4), M(0, 0.08, 0.37, 0, 0.04, 0.03, 0.02), '#2a2626');
  return b.build();
}

/** Unit K-Dock float (1 × 1 footprint, origin at the water line): weathered deck, guano streaks, grey bumpers. */
function floatGeometry(): THREE.BufferGeometry {
  const b = new Batch();
  b.add(BOX(), M(0, -0.25, 0, 0, 1, 0.45, 1), '#6f6456');
  b.add(BOX(), M(0, 0.2, 0, 0, 0.97, 0.04, 0.97), '#a39683');
  for (const [x, z, r, l] of [[0.18, -0.1, 0.35, 0.55], [-0.26, 0.22, -0.5, 0.4]] as [number, number, number, number][]) b.add(BOX(), M(x, 0.235, z, r, 0.07, 0.012, l), '#e8e2d6');
  for (const s of [-1, 1]) b.add(BOX(), M(s * 0.505, -0.02, 0, 0, 0.035, 0.16, 0.86), '#8a8f92');
  return b.build();
}

/** A sea lion's head and neck poking out of the water (instanced, tinted wet brown). */
function lionHeadGeometry(): THREE.BufferGeometry {
  const b = new Batch();
  b.add(SPHERE(8, 6), M(0, -0.05, -0.05, 0, 0.2, 0.34, 0.22), '#4f3a2c');
  b.add(SPHERE(8, 6), M(0, 0.28, 0.06, 0, 0.17, 0.15, 0.19), '#4f3a2c');
  b.add(SPHERE(6, 5), M(0, 0.25, 0.22, 0, 0.09, 0.08, 0.1), '#5d4636');
  for (const x of [-0.08, 0.08]) b.add(SPHERE(4, 3), M(x, 0.34, 0.17, 0, 0.03, 0.03, 0.02), '#161413');
  return b.build();
}

/** The sea-lion GLBs are saturated orange: keep their texture detail as luminance only and tint per instance. */
function tintLionMaterial(m: THREE.Material) {
  const mat = m as THREE.MeshStandardMaterial;
  mat.onBeforeCompile = shader => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `#ifdef USE_MAP
  vec4 obTex = texture2D(map, vMapUv);
  diffuseColor *= vec4(vec3(min(dot(obTex.rgb, vec3(0.299, 0.587, 0.114)) * 5.5, 1.5)), obTex.a);
#endif`);
  };
  mat.customProgramCacheKey = () => 'ob-sea-lion';
  mat.needsUpdate = true;
}
const LION_WET = new THREE.Color('#4f3a2c'), LION_DRY = new THREE.Color('#9a744f');

let CAPSULE: THREE.BufferGeometry | null = null;
/**
 * Promenade walkers in the heroes' rounded shape language: capsule torso, round head, nub arms, bean feet. Also the city
 * crowd's near figure (world/sf/crowd.ts). aInfo.x 9 = the shirt (tinted per instance), aInfo.y ±1 = the legs (swing).
 */
export function personGeometry(): THREE.BufferGeometry {
  CAPSULE ??= new THREE.CapsuleGeometry(1, 1, 2, 8);
  const b = new Batch();
  const pants = '#4b5563', skin = '#e9c3a0';
  for (const s of [-1, 1]) {
    b.add(CYL(6), M(s * 0.09, 0.06, 0, 0, 0.075, 0.42, 0.075), pants, [0, s, 0, 0]);
    b.add(SPHERE(5, 3), M(s * 0.09, 0.05, 0.04, 0, 0.085, 0.055, 0.13), '#3c3a38', [0, s, 0, 0]);
    b.add(SPHERE(5, 3), M(s * 0.255, 0.78, 0, 0, 0.075, 0.1, 0.075), '#ffffff', [9, 0, 0, 0]);
  }
  b.add(CAPSULE, M(0, 0.74, 0, 0, 0.22, 0.19, 0.2), '#ffffff', [9, 0, 0, 0]);
  b.add(SPHERE(8, 6), M(0, 1.24, 0.01, 0, 0.2, 0.21, 0.2), skin);
  b.add(SPHERE(6, 4), M(0, 1.33, -0.02, 0, 0.205, 0.13, 0.205), '#5a3d2b');
  return b.build();
}

/** A small bean dog with a leash running up to its walker's hand (dog-local frame, walker 0.6 u to its left). */
function dogGeometry(): THREE.BufferGeometry {
  const b = new Batch();
  const fur = '#ffffff', dark = '#3a2f28';
  b.add(SPHERE(10, 7), M(0, 0.3, 0, 0, 0.17, 0.15, 0.3), fur);
  b.add(SPHERE(8, 6), M(0, 0.44, 0.3, 0, 0.13, 0.12, 0.13), fur);
  b.add(SPHERE(6, 4), M(0, 0.42, 0.42, 0, 0.06, 0.05, 0.06), dark);
  for (const s of [-1, 1]) {
    b.add(SPHERE(5, 4), M(s * 0.09, 0.5, 0.26, 0, 0.05, 0.08, 0.035, 0, s * 0.3), fur);
    for (const z of [-0.17, 0.17]) b.add(CYL(5), M(s * 0.08, 0, z, 0, 0.04, 0.2, 0.04), fur);
  }
  b.add(CYL(5), M(0, 0.33, -0.28, 0, 0.03, 0.22, 0.03, -0.9), fur);
  b.add(CYL(8), M(0, 0.4, 0.22, 0, 0.1, 0.04, 0.1), '#c9573c');
  b.beam(new THREE.Vector3(0, 0.44, 0.22), new THREE.Vector3(-0.58, 0.78, -0.35), 0.018, 0.018, dark);
  return b.build();
}

function carouselGeometry(): THREE.BufferGeometry {
  const b = new Batch();
  const R = 2.8;
  b.add(CYL(24), M(0, 0, 0, 0, R, 0.35, R), '#e9dcc2');
  b.add(CYL(10), M(0, 0.35, 0, 0, 0.45, 2.7, 0.45), '#d8b36a');
  // striped canopy
  b.addFlat(CONE(16), M(0, 3.05, 0, 0, R + 0.35, 1.5, R + 0.35), (_x, _y, _z, lx, _ly, lz) => {
    const a = Math.atan2(lz, lx);
    return Math.floor(((a + Math.PI) / (Math.PI * 2)) * 16 + 0.5) % 2 ? C('#fbf3e1') : C('#c9573c');
  });
  b.add(CYL(24), M(0, 2.75, 0, 0, R + 0.35, 0.35, R + 0.35), '#2f8f88');
  b.add(SPHERE(8, 6), M(0, 4.6, 0, 0, 0.25, 0.25, 0.25), '#d6bd8a');
  // bulbs around the valance (glow at night)
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    b.add(SPHERE(4, 3), M(Math.cos(a) * (R + 0.37), 2.92, Math.sin(a) * (R + 0.37), 0, 0.08, 0.08, 0.08), '#fff0b8', [0, 0, 0, 1]);
  }
  // horses on poles
  const horse = ['#fbf8f1', '#e8d3a6', '#b98a5a', '#f2c9b1', '#cfe0d0', '#fbf8f1', '#c9d6e8', '#e8c6cf'];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const x = Math.cos(a) * (R - 0.7), z = Math.sin(a) * (R - 0.7);
    const ry = -a;
    b.add(CYL(5), M(x, 0.35, z, 0, 0.035, 2.45, 0.035), '#e0c27a');
    const y = 1.0 + (i % 2) * 0.3;
    b.add(BOX(), M(x, y, z, ry, 0.28, 0.32, 0.72), horse[i]);
    b.add(BOX(), M(x + Math.cos(a + Math.PI / 2) * 0.32, y + 0.25, z + Math.sin(a + Math.PI / 2) * 0.32, ry, 0.18, 0.38, 0.22, 0.4), horse[i]);
    for (const s of [-1, 1]) b.add(BOX(), M(x + Math.cos(a + Math.PI / 2) * 0.22 * s, y - 0.35, z + Math.sin(a + Math.PI / 2) * 0.22 * s, ry, 0.08, 0.36, 0.08, s * 0.4), horse[i]);
  }
  return b.build();
}

// ---------------------------------------------------------------------------
// Custom material patches (flapping wings, walking people)
// ---------------------------------------------------------------------------

function flapMaterial(): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
  m.name = 'ob-flap';
  m.onBeforeCompile = shader => {
    shader.uniforms.uTime = U.uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 aInfo;\nattribute float aFlap;\nattribute float aPhase;\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
if (aInfo.z > 0.0) {
  if (aFlap < -0.5) {
    // perched: wings folded along the body
    transformed.x *= 0.24;
    transformed.y += 0.03 * aInfo.z;
  } else {
    float ang = sin(uTime * 10.0 + aPhase) * 0.7 * aFlap;
    float ax = abs(transformed.x);
    transformed.y += ax * sin(ang) * aInfo.z;
    transformed.x *= mix(1.0, cos(ang), aInfo.z * 0.5);
  }
}`);
  };
  return m;
}

function peopleMaterial(): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
  m.name = 'ob-people';
  m.onBeforeCompile = shader => {
    shader.uniforms.uTime = U.uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 aInfo;\nattribute float aPhase;\nattribute float aWalk;\nuniform float uTime;')
      .replace('#include <color_vertex>', `
vColor = vec4(1.0);
#ifdef USE_COLOR
vColor.rgb *= color;
#endif
#ifdef USE_INSTANCING_COLOR
if (aInfo.x > 8.5) vColor.rgb *= instanceColor.rgb;
#endif`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
if (abs(aInfo.y) > 0.5) transformed.z += sin(uTime * 7.5 + aPhase) * aInfo.y * aWalk * (0.55 - transformed.y) * 0.55;`);
  };
  return m;
}

let CROWD_MAT: THREE.MeshStandardMaterial | null = null;
/**
 * The city crowd's people material (lane F11, world/sf/crowd.ts): its own instance of the walkers' material (the same
 * onBeforeCompile, so the same program as the promenade's), made once so the warm-up (world/streetcar.ts 'f-crowd') and
 * the crowd share it and the program stays linked. Instanced with instanceColor only.
 */
export function crowdPeopleMaterial(): THREE.MeshStandardMaterial {
  return (CROWD_MAT ??= peopleMaterial());
}

// ---------------------------------------------------------------------------
// GLB loading
// ---------------------------------------------------------------------------

interface LoadedModel { geometry: THREE.BufferGeometry; material: THREE.Material; asset: ModelAsset }
async function loadModel(id: string): Promise<LoadedModel | null> {
  const asset = ASSETS.models[id];
  if (!asset) return null;
  const gltf = await new GLTFLoader().loadAsync(asset.url);
  let mesh: THREE.Mesh | null = null;
  gltf.scene.traverse(o => { if (!mesh && (o as THREE.Mesh).isMesh) mesh = o as THREE.Mesh; });
  if (!mesh) return null;
  const found = mesh as THREE.Mesh;
  found.updateWorldMatrix(true, false);
  const geometry = found.geometry.clone().applyMatrix4(found.matrixWorld);
  const material = (Array.isArray(found.material) ? found.material[0] : found.material) as THREE.MeshStandardMaterial;
  if ('roughness' in material) { material.roughness = 0.88; material.metalness = 0; }
  return { geometry, material, asset };
}

// ---------------------------------------------------------------------------
// Life
// ---------------------------------------------------------------------------

/** Moving night lights (ferry mast / stern / side lights, sailboat mast tops) written into the world's halo batch. */
export interface DynamicHalos { set(i: number, x: number, y: number, z: number, on: boolean): void; readonly count: number }
/** Local light points on a ferry: mast top, stern, port (red) and starboard (green) side lights. */
export const FERRY_LIGHTS: { p: [number, number, number]; color: [number, number, number]; size: number }[] = [
  { p: [0, 5.95, 1.8], color: [1.2, 1.1, 0.95], size: 1.1 },
  { p: [0, 1.75, -5.75], color: [1.1, 0.95, 0.8], size: 0.9 },
  { p: [-2.05, 1.6, 3.2], color: [1.3, 0.2, 0.15], size: 0.8 },
  { p: [2.05, 1.6, 3.2], color: [0.2, 1.2, 0.5], size: 0.8 },
];
const _lp = new THREE.Vector3();
/** walkers (indices) that have a dog on a leash */
const DOG_OWNERS = [3, 17];
const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

interface Gull { mode: 'circle' | 'perched' | 'flee' | 'return'; cx: number; cz: number; y: number; r: number; speed: number; ph: number; perch?: THREE.Vector3; timer: number; x: number; yy: number; z: number; heading: number; pigeon?: boolean }
interface Walker { s: number; d: number; dir: number; v: number; ph: number; stand: boolean; x?: number; z?: number; ry?: number; off: number }
interface SeaLion { spot: number; bark: number; next: number }

export class Life {
  readonly group = new THREE.Group();
  readonly wakes: THREE.Vector4[] = [];
  private ferries: THREE.Mesh[] = [];
  private ferryRoutes: Route[] = [];
  private ferryS = [0, 0];
  private ferryDock = 0;
  private arrival = { active: false, t: 0, done: false, from: new THREE.Vector3(), ctrl: new THREE.Vector3(), to: new THREE.Vector3(), heading: 0 };
  private gulls: Gull[] = [];
  private gullMesh: THREE.InstancedMesh;
  private gullFlap: THREE.InstancedBufferAttribute;
  private pelicanGlide: THREE.InstancedMesh;
  private pelicanFlap: THREE.InstancedBufferAttribute;
  private pelicanRoute: Route;
  private pelicanS = -9999;
  private seal: THREE.Mesh;
  private sealState = { t: 0, next: 12, x: 0, z: 0, active: false };
  private sealSpots: Vec2[] = [];
  private people: THREE.InstancedMesh;
  private peopleWalk: THREE.InstancedBufferAttribute;
  private walkers: Walker[] = [];
  private dogs: THREE.InstancedMesh;
  private playerSt = 0;
  private frame = 0;
  private dtA = 0;
  private dtB = 0;
  private stAt = -9;
  private carousel: THREE.Mesh;
  private carouselPos: Vec2;
  private beam: THREE.Mesh | null = null;
  private beamMat: THREE.MeshBasicMaterial | null = null;
  private mist: THREE.InstancedMesh;
  private mistMat: THREE.ShaderMaterial;
  private mistPts: THREE.Vector3[] = [];
  private seaLions: SeaLion[] = [];
  private lionLie: THREE.InstancedMesh | null = null;
  private lionBark: THREE.InstancedMesh | null = null;
  private lionSpots = kDockSpots();
  private floats: THREE.InstancedMesh;
  private floatMats: THREE.Matrix4[] = K_DOCK_FLOATS.map(() => new THREE.Matrix4());
  private kFrame = new THREE.Matrix4();
  private heads: THREE.InstancedMesh;
  private headSpots: { x: number; z: number; ph: number; ry: number }[] = [];
  private mA = new THREE.Matrix4();
  private mB = new THREE.Matrix4();
  private lionNextEvent = 3;
  private sailboats: THREE.InstancedMesh | null = null;
  private sailRoutes: { route: Route; s: number; v: number }[] = [];
  private pelicans: THREE.InstancedMesh | null = null;
  private pelicanSpots: { x: number; y: number; z: number; ry: number; ph: number }[] = [];
  private loading = false;
  private lastGullEmit = -9;
  private flapMat = flapMaterial();
  private peopleMat = peopleMaterial();
  private kdock: Vec2;
  /** moving night lights (set by the world after construction) */
  halos: DynamicHalos | null = null;
  /**
   * F13 (city mode): the player is beyond the streamer's HERO_NEAR of the district slab (`cityStreamer().heroFar`), so
   * the district's ambient life hides and stops updating (≈ 38k triangles and 9 calls in C2's high views). Ferry 0
   * keeps running (the arrival cinematic; the rideable ferry of F8) and so does the Alcatraz beam (seen across the Bay).
   */
  private heroFar = false;
  /** where heroFar comes from (tests replace it) */
  heroFarSource = (): boolean => game.get().worldMode === 'city' && !!cityStreamerLazy()?.heroFar;

  constructor(beams: { x: number; y: number; z: number; length: number; speed: number }[]) {
    this.group.name = 'life';
    for (let i = 0; i < MAX_WAKES; i++) this.wakes.push(new THREE.Vector4(0, 0, 0, 0));
    const k = DISTRICT.landmarks.find(l => l.kind === 'sea-lion-docks');
    this.kdock = k ? { x: k.position.x, z: k.position.z } : { x: 0, z: 0 };

    // ferries --------------------------------------------------------------------
    const dock = DISTRICT.ferryDock;
    const fr = frameAt(42.5);
    const ferryHeading = Math.atan2(-fr.tx, -fr.tz); // bow toward the Ferry Building's south end
    const out = (d: number, along: number): Vec2 => ({ x: dock.x + fr.nx * d + fr.tx * along, z: dock.z + fr.nz * d + fr.tz * along });
    const loopA = new Route([dock, out(8, -6), out(24, 10), { x: 110, z: -82 }, { x: -40, z: -92 }, { x: -140, z: -86 }, { x: -155, z: -74 }, { x: -60, z: -76 }, { x: 60, z: -72 }, out(22, 30), out(8, 18)], true);
    const loopB = new Route([{ x: 205, z: -90 }, { x: 90, z: -98 }, { x: -60, z: -99 }, { x: -205, z: -92 }, { x: -222, z: -70 }, { x: -120, z: -80 }, { x: 40, z: -86 }, { x: 170, z: -80 }, { x: 214, z: -78 }], true);
    this.ferryRoutes = [loopA, loopB];
    const city = game.get().worldMode === 'city';
    ['#2f8f88', '#3d6f9a'].forEach((stripe, i) => {
      // city mode: ferry 0 is the rideable ferry after the arrival (world/ferry.ts): an open sun deck to stand on
      const mesh = new THREE.Mesh(ferryGeometry(stripe, city && i === 0), TOY_DYN);
      mesh.name = `ferry-${i}`;
      mesh.matrixAutoUpdate = false;
      mesh.castShadow = true;
      this.ferries.push(mesh);
      this.group.add(mesh);
    });
    this.ferryS = [0, loopB.total * 0.35];
    this.arrival.to.set(dock.x, WATER, dock.z);
    this.arrival.from.set(dock.x + fr.nx * 36 + fr.tx * 26, WATER, dock.z + fr.nz * 36 + fr.tz * 26);
    this.arrival.ctrl.set(dock.x + fr.nx * 10 + fr.tx * 20, WATER, dock.z + fr.nz * 10 + fr.tz * 20);
    this.arrival.heading = ferryHeading;
    this.ferryDock = 30;

    // gulls ------------------------------------------------------------------------
    const r = rng(9090);
    const centers: [number, number, number][] = [[140, -12, 11], [150, -30, 9], [75, -40, 10], [-198, 4, 12], [-190, -20, 13], [183, -24, 8], [30, -30, 10]];
    for (let i = 0; i < 16; i++) {
      const [cx, cz, y] = centers[i % centers.length];
      // circling gulls stay high (14–19 u), above the follow camera
      this.gulls.push({ mode: 'circle', cx: cx + (r() - 0.5) * 8, cz: cz + (r() - 0.5) * 8, y: 14 + (y - 8) * 0.6 + r() * 2, r: 5 + r() * 7, speed: (0.35 + r() * 0.3) * (r() > 0.5 ? 1 : -1), ph: r() * 6.28, timer: 0, x: 0, yy: 0, z: 0, heading: 0 });
    }
    const lamps = DISTRICT.props.filter(p => p.kind === 'lamp');
    lamps.forEach((l, i) => {
      if (i % 3) return;
      this.gulls.push({ mode: 'perched', cx: l.x, cz: l.z, y: 9, r: 6, speed: 0.5, ph: r() * 6.28, perch: new THREE.Vector3(l.x, 4.45, l.z), timer: 0, x: l.x, yy: 4.45, z: l.z, heading: r() * 6.28 });
    });
    // a flock of pigeons pecking on the Ferry Building plaza (they scatter when you run through)
    const flock = DISTRICT.anchors['weekly-board'] ?? DISTRICT.anchors['ferry-clock'];
    if (flock) {
      for (let i = 0, tries = 0; i < 8 && tries < 60; tries++) {
        const a = r() * Math.PI * 2, d = 1 + r() * 2.6;
        const x = flock.x - 5 + Math.cos(a) * d, z = flock.z + 1.5 + Math.sin(a) * d;
        if (!canStand(x, z, 0.1)) continue;
        const y = heightAt(x, z) + 0.02;
        this.gulls.push({ mode: 'perched', cx: x, cz: z, y: y + 5, r: 4, speed: 0.6, ph: r() * 6.28, perch: new THREE.Vector3(x, y, z), timer: 0, x, yy: y, z, heading: r() * 6.28, pigeon: true });
        i++;
      }
    }
    const gullGeo = gullGeometry();
    this.gullFlap = new THREE.InstancedBufferAttribute(new Float32Array(this.gulls.length), 1);
    gullGeo.setAttribute('aFlap', this.gullFlap);
    gullGeo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(Float32Array.from(this.gulls.map(g => g.ph * 3)), 1));
    this.gullMesh = new THREE.InstancedMesh(gullGeo, this.flapMat, this.gulls.length);
    this.gullMesh.name = 'gulls';
    this.gullMesh.frustumCulled = false;
    this.gulls.forEach((g, i) => this.gullMesh.setColorAt(i, g.pigeon ? new THREE.Color(0.55, 0.58, 0.66) : new THREE.Color(1, 1, 1)));
    this.group.add(this.gullMesh);

    // gliding pelicans (procedural) ---------------------------------------------------
    const pGeo = glidingPelicanGeometry();
    this.pelicanFlap = new THREE.InstancedBufferAttribute(new Float32Array(4), 1);
    pGeo.setAttribute('aFlap', this.pelicanFlap);
    pGeo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(Float32Array.from([0, 1.3, 2.1, 3.7]), 1));
    this.pelicanGlide = new THREE.InstancedMesh(pGeo, this.flapMat, 4);
    this.pelicanGlide.name = 'pelicans-gliding';
    this.pelicanGlide.frustumCulled = false;
    // white instance colours: the same program variant as the gulls' (they share flapMat; C2's P2 request)
    for (let i = 0; i < 4; i++) this.pelicanGlide.setColorAt(i, new THREE.Color(1, 1, 1));
    this.group.add(this.pelicanGlide);
    this.pelicanRoute = new Route([{ x: 230, z: -66 }, { x: 120, z: -64 }, { x: 0, z: -70 }, { x: -120, z: -66 }, { x: -240, z: -62 }], false);

    // harbor seal ----------------------------------------------------------------------
    this.seal = new THREE.Mesh(sealGeometry(), TOY_DYN);
    this.seal.name = 'harbor-seal';
    this.seal.matrixAutoUpdate = false;
    this.seal.visible = false;
    this.group.add(this.seal);
    for (const [x, z] of [[70, -30], [82, -36], [178, -32], [-206, 16], [-192, 22], [150, -40], [22, -32]] as [number, number][]) if (isWater(x, z)) this.sealSpots.push({ x, z });

    // pedestrians -------------------------------------------------------------------------
    const pr = rng(31337);
    for (let i = 0; i < 40; i++) this.walkers.push({ s: 24 + pr() * 318, d: (pr() - 0.5) * 7, dir: pr() > 0.5 ? 1 : -1, v: 0.9 + pr() * 0.6, ph: pr() * 6.28, stand: false, off: 0 });
    // people standing about: commuters waiting at the ferry gate, sightseers at the landmarks
    const standers: [string, number, number][] = [
      ['ferry-back-plaza', 3, 2], ['pier39-entrance', -3, 3], ['levis-plaza', 2, -2], ['exploratorium-front', 2.5, 1], ['pier33-landing', -2, 1.2], ['farmers-market', 2, -1.5],
      ['ferry-gate', -4.5, -1.5], ['ferry-gate', -5.6, -0.6], ['ferry-gate', 4.2, -1.2], ['ferry-gate', 5.4, -2.0], ['ferry-gate', -2.2, -3.4], ['ferry-gate', 2.6, -3.6], ['ferry-back-plaza', -4, 3.5], ['sea-lion-viewpoint', 3, 1.5],
    ];
    for (const [a, ox, oz] of standers) {
      const p = DISTRICT.anchors[a];
      if (p && canStand(p.x + ox, p.z + oz, 0.3)) this.walkers.push({ s: 0, d: 0, dir: 1, v: 0, ph: pr() * 6.28, stand: true, x: p.x + ox, z: p.z + oz, ry: pr() * 6.28, off: 0 });
    }
    const pgeo = personGeometry();
    pgeo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(Float32Array.from(this.walkers.map(w => w.ph)), 1));
    this.peopleWalk = new THREE.InstancedBufferAttribute(Float32Array.from(this.walkers.map(w => (w.stand ? 0 : 1))), 1);
    pgeo.setAttribute('aWalk', this.peopleWalk);
    this.people = new THREE.InstancedMesh(pgeo, this.peopleMat, this.walkers.length);
    this.people.name = 'pedestrians';
    this.people.frustumCulled = false;
    const shirts = ['#d8744a', '#2f8f88', '#d9b779', '#6f8fc0', '#c95f5a', '#8fae5b', '#f2efe6', '#9c6fb0', '#5a6b7a'];
    this.walkers.forEach((_w, i) => this.people.setColorAt(i, new THREE.Color(shirts[i % shirts.length]).lerp(new THREE.Color('#e8dcc4'), 0.1)));
    this.group.add(this.people);
    // two walkers take their dogs out
    this.dogs = new THREE.InstancedMesh(dogGeometry(), TOY_INST_TINT, DOG_OWNERS.length);
    this.dogs.name = 'dogs';
    this.dogs.frustumCulled = false;
    this.dogs.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    DOG_OWNERS.forEach((_o, k) => this.dogs.setColorAt(k, new THREE.Color(k ? '#8a6446' : '#e2cba4')));
    this.group.add(this.dogs);

    // carousel -----------------------------------------------------------------------------
    const cl = DISTRICT.landmarks.find(l => l.kind === 'pier39-carousel');
    this.carouselPos = cl ? { x: cl.position.x, z: cl.position.z } : { x: 0, z: 0 };
    this.carousel = new THREE.Mesh(carouselGeometry(), TOY_DYN);
    this.carousel.name = 'carousel';
    this.carousel.matrixAutoUpdate = false;
    this.carousel.castShadow = true;
    this.group.add(this.carousel);

    // Alcatraz lighthouse beam -----------------------------------------------------------------
    const bm = beams[0];
    if (bm) {
      this.beamMat = new THREE.MeshBasicMaterial({ color: '#fff0c2', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
      this.beamMat.name = 'ob-beam';
      const g = new THREE.CylinderGeometry(0.3, 5, bm.length, 12, 1, true).translate(0, bm.length / 2, 0).rotateX(Math.PI / 2);
      this.beam = new THREE.Mesh(g, this.beamMat);
      this.beam.name = 'lighthouse-beam';
      this.beam.position.set(bm.x, bm.y, bm.z);
      this.beam.visible = false;
      this.group.add(this.beam);
    }

    // Exploratorium fog bridge mist ----------------------------------------------------------------
    const fog = DISTRICT.piers.find(p => p.id === 'fog-bridge');
    if (fog) {
      const cx = fog.deck.reduce((s, p) => s + p.x, 0) / fog.deck.length, cz = fog.deck.reduce((s, p) => s + p.z, 0) / fog.deck.length;
      let far = fog.deck[0];
      for (const p of fog.deck) if (Math.hypot(p.x - cx, p.z - cz) > Math.hypot(far.x - cx, far.z - cz)) far = p;
      const dx = far.x - cx, dz = far.z - cz;
      for (let i = 0; i < 9; i++) { const t = (i / 8 - 0.5) * 1.8; this.mistPts.push(new THREE.Vector3(cx + dx * t, 0.9 + (i % 3) * 0.35, cz + dz * t)); }
    }
    this.mistMat = new THREE.ShaderMaterial({
      name: 'ob-mist',
      uniforms: { uAmt: { value: 0 } },
      vertexShader: `varying vec2 vUv; uniform float uAmt; void main(){ vUv = uv; vec4 mv = modelViewMatrix * instanceMatrix * vec4(0.0,0.0,0.0,1.0); float s = length(instanceMatrix[0].xyz); mv.xy += position.xy * s * (0.6 + 0.4 * uAmt); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying vec2 vUv; uniform float uAmt; void main(){ float d = length(vUv - 0.5) * 2.0; float a = pow(max(0.0, 1.0 - d), 1.6) * uAmt * 0.55; if (a < 0.004) discard; gl_FragColor = vec4(vec3(0.97, 0.98, 1.0), a); }`,
      transparent: true, depthWrite: false,
    });
    this.mist = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), this.mistMat, Math.max(1, this.mistPts.length));
    this.mist.count = this.mistPts.length;
    this.mist.name = 'fog-bridge-mist';
    this.mist.frustumCulled = false;
    this.mist.renderOrder = 5;
    this.mistPts.forEach((p, i) => place(this.mist, i, p.x, p.y, p.z, 0, 2.6 + (i % 2)));
    this.group.add(this.mist);

    // K-Dock: bobbing floats (one instanced draw) and a few heads in the water
    const kf = kDockFrame();
    this.kFrame.compose(new THREE.Vector3(kf.x, 0, kf.z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), kf.ry), new THREE.Vector3(1, 1, 1));
    this.floats = new THREE.InstancedMesh(floatGeometry(), TOY_INST_TINT, K_DOCK_FLOATS.length);
    this.floats.name = 'k-dock-floats';
    this.floats.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    K_DOCK_FLOATS.forEach((_f, i) => this.floats.setColorAt(i, new THREE.Color().setScalar(hash2(i, 3.3) > 0.5 ? 1 : 0.88)));
    this.floats.boundingSphere = new THREE.Sphere(new THREE.Vector3(kf.x, WATER, kf.z), 14);
    this.group.add(this.floats);
    for (const [u, v] of [[-2.3, -4.7], [3.4, 4.3], [8.6, 0.4]] as [number, number][]) {
      const q = new THREE.Vector3(v, 0, u).applyMatrix4(this.kFrame);
      if (isWater(q.x, q.z)) this.headSpots.push({ x: q.x, z: q.z, ph: hash2(u, v) * 6.28, ry: hash2(v, u) * 6.28 });
    }
    this.heads = new THREE.InstancedMesh(lionHeadGeometry(), TOY_INST, Math.max(1, this.headSpots.length));
    this.heads.count = this.headSpots.length;
    this.heads.name = 'sea-lion-heads';
    this.heads.frustumCulled = false;
    this.group.add(this.heads);
    this.updateFloats(0);
    this.updatePeople(0, 0);

    // sea lions + pelicans + sailboats wait for their GLBs
    const lr = rng(555);
    for (let spot = 0; spot < this.lionSpots.length; spot++) this.seaLions.push({ spot, bark: 0, next: 2 + lr() * 8 });
    const p7 = DISTRICT.landmarks.find(l => l.id === 'pier7');
    if (p7) {
      const ux = Math.sin(p7.rotationY), uz = Math.cos(p7.rotationY), vx = Math.cos(p7.rotationY), vz = -Math.sin(p7.rotationY);
      for (const [u, v] of [[2.05, 3.6], [2.05, -4.4], [-2.1, 6.45]]) this.pelicanSpots.push({ x: p7.position.x + ux * u + vx * v, y: 1.08, z: p7.position.z + uz * u + vz * v, ry: p7.rotationY + (v > 5 ? 1.6 : 0), ph: hash2(u, v) * 6 });
    }
    // a pelican keeps the empty float company
    const empty = K_DOCK_FLOATS[2];
    if (empty) { const q = new THREE.Vector3(empty[1], WATER + 0.22, empty[0]).applyMatrix4(this.kFrame); this.pelicanSpots.push({ x: q.x, y: q.y, z: q.z, ry: 1.2, ph: 2 }); }
  }

  /** Lazily load the GLB creatures (called once the player starts). */
  ensureModels() {
    if (this.loading) return;
    this.loading = true;
    void Promise.all([loadModel('sea-lion'), loadModel('sea-lion-bark'), loadModel('pelican'), loadModel('sailboat')]).then(([lie, bark, pelican, sail]) => {
      const n = this.lionSpots.length;
      const dockSphere = new THREE.Sphere(new THREE.Vector3(this.kdock.x, WATER + 1, this.kdock.z), 16);
      const lions = (model: LoadedModel, name: string) => {
        tintLionMaterial(model.material);
        const mesh = new THREE.InstancedMesh(model.geometry, model.material, n);
        mesh.name = name;
        mesh.count = 0;
        mesh.boundingSphere = dockSphere.clone();
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        for (let i = 0; i < n; i++) mesh.setColorAt(i, LION_WET);
        mesh.visible = !this.heroFar;
        this.group.add(mesh);
        return mesh;
      };
      if (lie) this.lionLie = lions(lie, 'sea-lions');
      if (bark) this.lionBark = lions(bark, 'sea-lions-bark');
      if (pelican) {
        this.pelicans = new THREE.InstancedMesh(pelican.geometry, pelican.material, this.pelicanSpots.length);
        this.pelicans.name = 'pelicans';
        this.pelicanSpots.forEach((p, i) => place(this.pelicans!, i, p.x, p.y, p.z, p.ry, 1.05));
        this.pelicans.computeBoundingSphere();
        if (this.pelicans.boundingSphere) this.pelicans.boundingSphere.radius += 2;
        this.pelicans.visible = !this.heroFar;
        this.group.add(this.pelicans);
      }
      if (sail) {
        const loops: [number, number, number, number][] = [[-70, -92, 34, 6], [70, -93, 30, 5], [150, -90, 22, 6], [-215, -40, 12, 22], [10, -80, 16, 4]];
        for (const [cx, cz, rx, rz] of loops) {
          const pts: Vec2[] = [];
          let ok = true;
          for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; const p = { x: cx + Math.cos(a) * rx, z: cz + Math.sin(a) * rz }; if (!isWater(p.x, p.z) || !isWater(p.x + 2, p.z + 2) || !isWater(p.x - 2, p.z - 2)) ok = false; pts.push(p); }
          if (ok) this.sailRoutes.push({ route: new Route(pts, true), s: hash2(cx, cz) * 200, v: 2.2 + hash2(cz, cx) * 1.2 });
        }
        this.sailboats = new THREE.InstancedMesh(sail.geometry, sail.material, Math.max(1, this.sailRoutes.length));
        this.sailboats.count = this.sailRoutes.length;
        this.sailboats.name = 'sailboats';
        this.sailboats.frustumCulled = false;
        this.sailboats.visible = !this.heroFar;
        this.group.add(this.sailboats);
      }
    }).catch(error => { if (import.meta.env?.DEV) console.warn('[opus-bay world] model load failed', error); });
  }

  /** The district life that pauses while the hero is far (F13): everything in the group except ferry 0 and the beam. */
  private heroLife(): (THREE.Object3D | null)[] {
    return [this.ferries[1], this.gullMesh, this.pelicanGlide, this.seal, this.people, this.dogs, this.carousel, this.mist,
      this.floats, this.heads, this.lionLie, this.lionBark, this.sailboats, this.pelicans];
  }

  /** F13: hide / show the hero life (once near again, the per-frame code below manages what it always managed). */
  setHeroFar(far: boolean) {
    if (far === this.heroFar) return;
    this.heroFar = far;
    for (const o of this.heroLife()) if (o) o.visible = !far;
    if (!far) { this.seal.visible = this.sealState.active; return; }
    // their night lights off (ferry 1's, the sailboats' mast tops); ferry 0 keeps writing its own
    const hl = this.halos;
    if (hl) for (let i = FERRY_LIGHTS.length; i < hl.count; i++) hl.set(i, 0, 0, 0, false);
  }

  /** True while the hero life is paused (F13; QA and tests). */
  get paused() { return this.heroFar; }

  update(dt: number, t: number, night: number) {
    const s = game.get();
    if (s.phase !== 'title') this.ensureModels();
    this.setHeroFar(this.heroFarSource());
    if (this.heroFar) {
      this.updateFerries(dt, t, s.phase);
      this.updateBeam(t, night);
      this.pushWakes();
      return;
    }
    // GLB creatures are ~3k triangles each: skip them when they would be a few pixels
    const cam = U.uCam.value;
    const dockD = Math.hypot(cam.x - this.kdock.x, cam.z - this.kdock.z);
    const nearDock = dockD < 150;
    if (this.lionLie) this.lionLie.visible = nearDock;
    if (this.lionBark) this.lionBark.visible = nearDock;
    this.heads.visible = nearDock;
    if (dockD < 220) this.updateFloats(t);
    this.floats.visible = dockD < 220;
    if (this.pelicans) this.pelicans.visible = this.pelicanSpots.some(p => Math.hypot(cam.x - p.x, cam.z - p.z) < 110);
    this.updateFerries(dt, t, s.phase);
    // ambient life runs at 30 Hz in two interleaved halves (keeps the per-frame world update small)
    this.dtA += dt; this.dtB += dt;
    if ((this.frame++ & 1) === 0) {
      this.updateGulls(this.dtA, t);
      this.updatePelicans(this.dtA, t);
      this.updateSailboats(this.dtA, t);
      this.updateSeal(this.dtA, t);
      this.dtA = 0;
    } else {
      this.updatePeople(this.dtB, t);
      if (nearDock) this.updateSeaLions(this.dtB, t);
      this.dtB = 0;
    }
    // carousel turns
    const cy = 0.05;
    setObj(this.carousel, this.carouselPos.x, cy, this.carouselPos.z, t * 0.45);
    this.updateBeam(t, night);
    // fog bridge: mist for 9 s every 30 s
    const cycle = t % 30;
    const amt = cycle < 9 ? Math.sin((cycle / 9) * Math.PI) : 0;
    this.mistMat.uniforms.uAmt.value = amt;
    this.mist.visible = amt > 0.01;
    this.pushWakes();
  }

  /** Alcatraz lighthouse */
  private updateBeam(t: number, night: number) {
    if (!this.beam || !this.beamMat) return;
    this.beam.visible = night > 0.3;
    this.beamMat.opacity = Math.max(0, night - 0.3) * 0.22;
    this.beam.rotation.set(0.06, t * 0.9, 0);
  }

  /** wakes → water shader (only ferry 0's while the hero life is paused) */
  private pushWakes() {
    let w = 0;
    const push = (x: number, z: number, heading: number, strength: number) => { if (w < this.wakes.length) this.wakes[w++].set(x, z, heading, strength); };
    const ferries = this.heroFar ? 1 : this.ferries.length;
    for (let i = 0; i < ferries; i++) { const st = this.ferryState[i]; if (st) push(st.x, st.z, st.heading, st.moving ? 1 : 0); }
    if (this.sailboats && !this.heroFar) this.sailRoutes.forEach(r => { const p = r.route.at(r.s); push(p.x, p.z, p.heading, 0.45); });
    for (; w < this.wakes.length; w++) this.wakes[w].set(0, 0, 0, 0);
  }

  private ferryState: { x: number; z: number; heading: number; moving: boolean }[] = [];

  private updateFerries(dt: number, t: number, phase: string) {
    const a = this.arrival;
    // ferry 0: arrival glide, dock, then its harbour loop back to the dock
    const f0 = this.ferries[0];
    let x0: number, z0: number, h0: number, moving0 = false;
    if (phase === 'title' && !a.done) {
      x0 = a.from.x; z0 = a.from.z; h0 = a.heading + 0.6;
    } else if (phase === 'arrival' && !a.done) {
      if (!a.active) { a.active = true; a.t = 0; }
      a.t += dt;
      const k = Math.min(1, a.t / FERRY_ARRIVAL_SECONDS);
      const e = 1 - (1 - k) ** 3;
      const u = 1 - e;
      x0 = u * u * a.from.x + 2 * u * e * a.ctrl.x + e * e * a.to.x;
      z0 = u * u * a.from.z + 2 * u * e * a.ctrl.z + e * e * a.to.z;
      h0 = a.heading + 0.6 * (1 - e);
      moving0 = k < 1;
      if (k >= 1) { a.done = true; this.ferryDock = 22; this.ferryS[0] = 0; }
    } else {
      if (!a.done) { a.done = true; this.ferryDock = 22; }
      // city mode (F8): lying at Gate E after the arrival, ferry 0 is handed to the ride system (world/ferry.ts)
      if (this.ferryDock > 0 && game.get().worldMode === 'city') pendingFerry()?.takeOver();
      const sys = game.get().worldMode === 'city' ? activeFerrySystem() : null;
      const boat = sys?.cars[0]?.pose;
      if (boat) {
        setObj(f0, boat.x, boat.y, boat.z, boat.heading, -(boat.pitch ?? 0), boat.roll);
        const moving = ((sys as unknown as { boat?: { v: number } }).boat?.v ?? 0) > 0.3;
        this.ferryState[0] = { x: boat.x, z: boat.z, heading: boat.heading, moving };
        this.updateFerry1AndLights(dt, t);
        return;
      }
      if (this.ferryDock > 0) {
        this.ferryDock -= dt;
        x0 = a.to.x; z0 = a.to.z; h0 = a.heading;
        if (this.ferryDock <= 0) { this.ferryS[0] = 0; emit({ type: 'foghorn' }); }
      } else {
        const r = this.ferryRoutes[0];
        this.ferryS[0] += dt * 6.5;
        if (this.ferryS[0] >= r.total) { this.ferryS[0] = 0; this.ferryDock = 35; }
        const p = r.at(this.ferryS[0]);
        // blend the heading out of / into the dock
        const k = Math.min(1, this.ferryS[0] / 14, (r.total - this.ferryS[0]) / 14);
        x0 = p.x; z0 = p.z; h0 = lerpAngle(a.heading, p.heading, Math.max(0, k)); moving0 = true;
      }
    }
    const bob = Math.sin(t * 1.1) * 0.05;
    setObj(f0, x0, WATER + 0.55 + bob, z0, h0, Math.sin(t * 0.9) * 0.01, Math.sin(t * 0.7) * 0.015);
    this.ferryState[0] = { x: x0, z: z0, heading: h0, moving: moving0 };
    this.updateFerry1AndLights(dt, t);
  }

  /** Ferry 1's crossing loop and every ferry's night lights. */
  private updateFerry1AndLights(dt: number, t: number) {
    // ferry 1: crossing loop far out (paused with the rest of the hero life, F13)
    if (!this.heroFar) {
      const r1 = this.ferryRoutes[1];
      this.ferryS[1] += dt * 6;
      const p1 = r1.at(this.ferryS[1]);
      setObj(this.ferries[1], p1.x, WATER + 0.55 + Math.sin(t * 1.2 + 2) * 0.05, p1.z, p1.heading, 0, Math.sin(t * 0.8) * 0.015);
      this.ferryState[1] = { x: p1.x, z: p1.z, heading: p1.heading, moving: true };
    }
    const hl = this.halos;
    if (hl) {
      this.ferries.forEach((f, k) => {
        if (k > 0 && this.heroFar) return;
        FERRY_LIGHTS.forEach((l, j) => {
          const i = k * FERRY_LIGHTS.length + j;
          if (i >= hl.count) return;
          _lp.set(l.p[0], l.p[1], l.p[2]).applyMatrix4(f.matrix);
          hl.set(i, _lp.x, _lp.y, _lp.z, true);
        });
      });
    }
  }

  private updateGulls(dt: number, t: number) {
    const px = runtime.player.x, pz = runtime.player.z;
    const running = runtime.player.running || runtime.player.speed > 5;
    const cam = U.uCam.value;
    this.gulls.forEach((g, i) => {
      let flap = 0.25;
      const size = g.pigeon ? 0.55 : 1;
      // birds that come within 6 u of the lens shrink away instead of filling the frame
      const near = (x: number, y: number, z: number) => smooth(3, 6, Math.hypot(x - cam.x, y - cam.y, z - cam.z));
      if (g.mode === 'circle') {
        const a = g.ph + t * g.speed;
        g.x = g.cx + Math.cos(a) * g.r; g.z = g.cz + Math.sin(a) * g.r; g.yy = g.y + Math.sin(t * 0.6 + g.ph) * 0.8;
        g.heading = Math.atan2(-Math.sin(a) * Math.sign(g.speed), Math.cos(a) * Math.sign(g.speed));
        flap = 0.15 + 0.35 * Math.max(0, Math.sin(t * 0.8 + g.ph));
        place(this.gullMesh, i, g.x, g.yy, g.z, g.heading, size * near(g.x, g.yy, g.z), 0, -0.35 * Math.sign(g.speed));
      } else if (g.mode === 'perched' && g.perch) {
        const d = Math.hypot(g.perch.x - px, g.perch.z - pz);
        const scare = g.pigeon ? (running ? 3 : 1.2) : (running ? 4.5 : 1.8);
        if (d < scare) {
          g.mode = 'flee'; g.timer = 0;
          if (t - this.lastGullEmit > 1.2) { this.lastGullEmit = t; emit({ type: 'gull' }); }
        }
        g.x = g.perch.x; g.yy = g.perch.y; g.z = g.perch.z;
        g.heading += Math.sin(t * 0.5 + g.ph) * (g.pigeon ? 0.02 : 0.004);
        flap = -1;
        // pigeons peck
        const peck = g.pigeon ? Math.pow(Math.max(0, Math.sin(t * 2.6 + g.ph * 3)), 6) * 0.6 : 0;
        place(this.gullMesh, i, g.x, g.yy + 0.12 * size, g.z, g.heading, 0.9 * size * near(g.x, g.yy, g.z), peck, 0);
      } else if (g.mode === 'flee' && g.perch) {
        g.timer += dt;
        const a = g.ph + g.timer * (g.pigeon ? 1.4 : 0.9);
        const rise = Math.min(1, g.timer / 1.2);
        const R = g.pigeon ? 4 : 7;
        const tx = g.perch.x + Math.cos(a) * R, tz = g.perch.z + Math.sin(a) * R, ty = g.perch.y + (g.pigeon ? 2.5 + 3 * rise : 3 + 4 * rise);
        g.x += (tx - g.x) * Math.min(1, dt * 2.5); g.z += (tz - g.z) * Math.min(1, dt * 2.5); g.yy += (ty - g.yy) * Math.min(1, dt * 2.5);
        g.heading = Math.atan2(-Math.sin(a), Math.cos(a));
        flap = 1;
        if (g.timer > (g.pigeon ? 6 + (i % 4) : 10 + (i % 5))) { g.mode = 'return'; g.timer = 0; }
        place(this.gullMesh, i, g.x, g.yy, g.z, g.heading, size * near(g.x, g.yy, g.z), -0.2, -0.3);
      } else if (g.mode === 'return' && g.perch) {
        g.timer += dt;
        const d = Math.hypot(g.perch.x - px, g.perch.z - pz);
        const k = Math.min(1, dt * 1.6);
        g.x += (g.perch.x - g.x) * k; g.z += (g.perch.z - g.z) * k; g.yy += (g.perch.y - g.yy) * k;
        flap = 0.7;
        if (Math.hypot(g.x - g.perch.x, g.z - g.perch.z) < 0.08 && Math.abs(g.yy - g.perch.y) < 0.08) g.mode = d < (g.pigeon ? 2.5 : 5) ? 'flee' : 'perched';
        place(this.gullMesh, i, g.x, g.yy + 0.12 * size, g.z, g.heading, size * near(g.x, g.yy, g.z), 0, 0);
      }
      this.gullFlap.setX(i, flap);
    });
    this.gullFlap.needsUpdate = true;
    this.gullMesh.instanceMatrix.needsUpdate = true;
  }

  private updatePelicans(dt: number, t: number) {
    // a squadron glides low over the water every ~50 s
    if (this.pelicanS < -100) this.pelicanS = -40;
    this.pelicanS += dt * 7.5;
    const r = this.pelicanRoute;
    if (this.pelicanS > r.total + 60) this.pelicanS = -220;
    for (let i = 0; i < 4; i++) {
      const s = this.pelicanS - i * 3.2;
      if (s < 0 || s > r.total) { place(this.pelicanGlide, i, 0, -50, 0, 0, 0.001); continue; }
      const p = r.at(s);
      const y = WATER + 2.2 + Math.sin(s * 0.08 + i) * 0.5;
      place(this.pelicanGlide, i, p.x + (i % 2 ? 1.2 : -1.2) * Math.cos(p.heading), y, p.z - (i % 2 ? 1.2 : -1.2) * Math.sin(p.heading), p.heading, 1.25, 0.04, Math.sin(t * 0.7 + i) * 0.08);
      this.pelicanFlap.setX(i, Math.max(0, Math.sin(t * 0.35 + i)) > 0.93 ? 0.6 : 0.04);
    }
    this.pelicanFlap.needsUpdate = true;
    this.pelicanGlide.instanceMatrix.needsUpdate = true;
    if (this.pelicans) {
      this.pelicanSpots.forEach((p, i) => place(this.pelicans!, i, p.x, p.y, p.z, p.ry + Math.sin(t * 0.3 + p.ph) * 0.5, 1.05));
      this.pelicans.instanceMatrix.needsUpdate = true;
    }
  }

  private updateSeaLions(dt: number, t: number) {
    const d = Math.hypot(runtime.player.x - this.kdock.x, runtime.player.z - this.kdock.z);
    const near = d < 32;
    this.lionNextEvent -= dt;
    if (this.lionNextEvent <= 0) {
      this.lionNextEvent = near ? 1.4 + Math.random() * 3 : 4 + Math.random() * 6;
      const who = this.seaLions[Math.floor(Math.random() * this.seaLions.length)];
      if (who) who.bark = 1.1 + Math.random() * 1.2;
      if (near) emit({ type: 'sea-lion', intensity: Math.max(0.25, 1 - d / 32) });
    }
    if (!this.lionLie || !this.lionBark) return;
    let a = 0, b = 0;
    for (const s of this.seaLions) {
      const spot = this.lionSpots[s.spot];
      s.next -= dt;
      if (s.next <= 0) { s.next = 5 + Math.random() * 12; if (Math.random() < 0.3) s.bark = 0.9 + Math.random(); }
      const breathe = 1 + Math.sin(t * 1.3 + s.spot) * 0.02;
      const barking = s.bark > 0;
      if (barking) s.bark -= dt;
      const pulse = barking ? 1 + Math.abs(Math.sin(t * 9 + s.spot)) * 0.05 : breathe;
      const ry = spot.lry + (barking ? Math.sin(t * 3 + s.spot) * 0.15 : Math.sin(t * 0.2 + s.spot) * 0.08);
      // lion on its (bobbing) float
      _e.set(0, ry, barking ? 0 : Math.sin(t * 0.4 + s.spot * 2) * 0.04, 'YXZ');
      this.mB.compose(_p.set(spot.lx, spot.ly, spot.lz), _q.setFromEuler(_e), _s.set(spot.s, spot.s * pulse, spot.s));
      this.mA.multiplyMatrices(this.floatMats[spot.float], this.mB);
      const mesh = barking ? this.lionBark : this.lionLie;
      const i = barking ? b++ : a++;
      mesh.setMatrixAt(i, this.mA);
      // wet on the waterline side of each heap, dry and tan on top
      mesh.setColorAt(i, spot.ly > 0.4 || hash2(s.spot, 1.7) > 0.4 ? LION_DRY : LION_WET);
    }
    this.lionLie.count = a; this.lionBark.count = b;
    for (const m of [this.lionLie, this.lionBark]) {
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  }

  /** Floats bob and roll on the swell; heads bob in the water between them. */
  private updateFloats(t: number) {
    K_DOCK_FLOATS.forEach(([u, v, w, d, yaw], i) => {
      const ph = i * 1.37;
      const y = WATER + Math.sin(t * 1.1 + ph) * 0.05;
      _e.set(Math.sin(t * 0.8 + ph * 2) * 0.015, yaw, Math.sin(t * 0.9 + ph) * 0.03, 'YXZ');
      this.mB.compose(_p.set(v, y, u), _q.setFromEuler(_e), _s.set(1, 1, 1));
      this.floatMats[i].multiplyMatrices(this.kFrame, this.mB);
      this.mA.makeScale(w, 1, d).premultiply(this.floatMats[i]);
      this.floats.setMatrixAt(i, this.mA);
    });
    this.floats.instanceMatrix.needsUpdate = true;
    this.headSpots.forEach((h, i) => {
      const bob = Math.sin(t * 1.6 + h.ph) * 0.12 + Math.sin(t * 0.37 + h.ph) * 0.1;
      place(this.heads, i, h.x + Math.sin(t * 0.21 + h.ph) * 0.6, WATER - 0.12 + bob, h.z + Math.cos(t * 0.17 + h.ph) * 0.6, h.ry + Math.sin(t * 0.3 + h.ph) * 0.6, 1.1, Math.sin(t * 0.9 + h.ph) * 0.15);
    });
    this.heads.instanceMatrix.needsUpdate = true;
  }

  private updateSailboats(dt: number, t: number) {
    if (!this.sailboats) return;
    const asset = ASSETS.models.sailboat;
    this.sailRoutes.forEach((r, i) => {
      r.s += r.v * dt;
      const p = r.route.at(r.s);
      place(this.sailboats!, i, p.x, WATER + (asset?.yOffset ?? -0.75) * 1.2 + Math.sin(t * 1.3 + i) * 0.06, p.z, p.heading, 1.2, Math.sin(t * 0.9 + i) * 0.03, 0.14 + Math.sin(t * 0.6 + i) * 0.04);
      const hi = this.ferries.length * FERRY_LIGHTS.length + i;
      if (this.halos && hi < this.halos.count) {
        _lp.set(0, (asset?.size[1] ?? 4.96) + 0.1, 0).applyMatrix4(_m);
        this.halos.set(hi, _lp.x, _lp.y, _lp.z, true);
      }
    });
    this.sailboats.instanceMatrix.needsUpdate = true;
  }

  private updateSeal(dt: number, t: number) {
    const st = this.sealState;
    if (!this.sealSpots.length) return;
    if (!st.active) {
      st.next -= dt;
      if (st.next <= 0) {
        const spot = this.sealSpots[Math.floor(Math.random() * this.sealSpots.length)];
        st.x = spot.x + (Math.random() - 0.5) * 4; st.z = spot.z + (Math.random() - 0.5) * 4;
        if (isWater(st.x, st.z)) { st.active = true; st.t = 0; this.seal.visible = true; }
        st.next = 14 + Math.random() * 18;
      }
      return;
    }
    st.t += dt;
    const dur = 5.5;
    const k = st.t / dur;
    const rise = k < 0.15 ? k / 0.15 : k > 0.85 ? (1 - k) / 0.15 : 1;
    setObj(this.seal, st.x, WATER - 0.45 + rise * 0.42 + Math.sin(t * 2) * 0.02, st.z, Math.sin(t * 0.8) * 1.2, 0, 0, 1.2);
    if (st.t >= dur) { st.active = false; this.seal.visible = false; }
  }

  private updatePeople(dt: number, t: number) {
    const px = runtime.player.x, pz = runtime.player.z;
    const gx = runtime.guide.x, gz = runtime.guide.z;
    if (t - this.stAt > 0.5) { this.stAt = t; this.playerSt = stationOf({ x: px, z: pz }).st; }
    let dog = 0;
    // people right at the lens (a low two-shot camera among the ferry-gate commuters) shrink away instead of
    // filling the frame, like the gulls
    const cam = U.uCam.value;
    const lens = (x: number, y: number, z: number) => smooth(1.6, 3.6, Math.hypot(x - cam.x, y + 0.8 - cam.y, z - cam.z));
    this.walkers.forEach((w, i) => {
      const hs = 0.95 + hash2(i, 6.1) * 0.1;
      if (w.stand) {
        const y = heightAt(w.x!, w.z!) + 0.04, k = lens(w.x!, y, w.z!);
        place(this.people, i, w.x!, y, w.z!, w.ry! + Math.sin(t * 0.3 + w.ph) * 0.4, hs * k, 0, 0, hs * k * (1 + Math.sin(t * 2 + w.ph) * 0.01));
        return;
      }
      // three in five walkers keep the promenade busy around the player: far ones re-enter the scene
      if (i % 5 < 3 && Math.abs(w.s - this.playerSt) > 75) {
        w.s = Math.max(20, Math.min(344, this.playerSt - w.dir * (45 + hash2(i, t) * 15)));
        w.off = 0;
      }
      w.s += w.v * w.dir * dt;
      if (w.s > 344) w.dir = -1;
      if (w.s < 20) w.dir = 1;
      const f = frameAt(w.s);
      let x = f.x + f.nx * (w.d + w.off), z = f.z + f.nz * (w.d + w.off);
      // step aside for the player and BAYBAY
      for (const [ax, az] of [[px, pz], [gx, gz]]) {
        const dd = Math.hypot(x - ax, z - az);
        if (dd < 1.6) {
          const side = (x - ax) * f.nx + (z - az) * f.nz >= 0 ? 1 : -1;
          w.off += side * (1.6 - dd) * dt * 3;
        }
      }
      w.off *= Math.exp(-dt * 0.4);
      w.off = Math.max(-3, Math.min(3, w.off));
      const dClamp = Math.max(-4.4, Math.min(4.4, w.d + w.off));
      x = f.x + f.nx * dClamp; z = f.z + f.nz * dClamp;
      const heading = Math.atan2(f.tx * w.dir, f.tz * w.dir);
      const bob = Math.abs(Math.sin(t * 7.5 + w.ph)) * 0.05;
      const k0 = lens(x, 0, z);
      place(this.people, i, x, 0.04 + bob, z, heading, hs * k0, 0, Math.sin(t * 7.5 + w.ph) * 0.03);
      const k = DOG_OWNERS.indexOf(i);
      if (k >= 0) {
        // the dog trots ahead and to the right of its walker
        const fx = Math.sin(heading), fz = Math.cos(heading);
        const trot = Math.abs(Math.sin(t * 11 + w.ph)) * 0.06;
        place(this.dogs, k, x + fz * 0.58 + fx * 0.35, 0.04 + trot, z - fx * 0.58 + fz * 0.35, heading, k0, 0, Math.sin(t * 11 + w.ph) * 0.05);
        dog++;
      }
    });
    this.dogs.count = dog;
    this.dogs.instanceMatrix.needsUpdate = true;
    this.people.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    this.group.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) m.geometry.dispose(); });
    this.flapMat.dispose(); this.peopleMat.dispose(); this.mistMat.dispose(); this.beamMat?.dispose();
  }
}

function lerpAngle(a: number, b: number, t: number) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

