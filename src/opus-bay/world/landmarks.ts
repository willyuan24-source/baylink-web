import * as THREE from 'three';
import type { LandmarkDef } from '../core/types';
import { heightAt } from '../core/terrain';
import { DISTRICT } from '../data/district';
import { BOX, Batch, CBOX, CONE, CYL, Frame, type Info, SPHERE, shade } from './builder';
import { gableRoof, obb } from './city';
import type { LabelAtlas, LabelBatch } from './labels';
import { PAL } from './palette';

/**
 * Hero landmarks — each in its own batch so they can cast shadows and be culled individually.
 * Local frames follow three.js: a landmark with rotationY = r faces (sin r, cos r) = its local +z.
 */

const NONE: Info = [0, 0, 0, 0];
/** small props next to the player never dither away */
const KEEP: Info = [0, 0, 0, -1];
const GLOW = (w: number): Info => [0, 0, 0, w];
/** warm lit opening at night (arches, doors) */
const LIT: Info = [7, 0, 0, 0];
const litAt = (base: number): Info => [7, base, 0, 0];
const win = (style: number, base = 0): Info => [style, base, 0, 0];

function archGeo(w: number, h: number) {
  const s = new THREE.Shape();
  const r = w / 2;
  s.moveTo(-r, 0); s.lineTo(-r, h - r); s.absarc(0, h - r, r, Math.PI, 0, true); s.lineTo(r, 0); s.lineTo(-r, 0);
  return new THREE.ShapeGeometry(s, 8);
}
const ARCHES = new Map<string, THREE.ShapeGeometry>();
function arch(w: number, h: number) {
  const k = `${w.toFixed(2)}:${h.toFixed(2)}`;
  let g = ARCHES.get(k);
  if (!g) { g = archGeo(w, h); ARCHES.set(k, g); }
  return g;
}

const landmark = (id: string) => DISTRICT.landmarks.find(l => l.id === id);
const baseOf = (l: LandmarkDef) => l.baseY ?? heightAt(l.position.x, l.position.z);

export interface Hero {
  id: string;
  batch: Batch;
  /** vertical cylinder used to fade the whole hero when it stands between the camera and the player */
  fade?: { x: number; z: number; r: number; y0: number; y1: number };
}

// ---------------------------------------------------------------------------
// Ferry Building
// ---------------------------------------------------------------------------

export interface ClockSpec { center: THREE.Vector3; normal: THREE.Vector3; radius: number }

function ferryBuilding(labels: LabelBatch, atlas: LabelAtlas, clocks: ClockSpec[]): { body: Batch; tower: Batch; towerAt: THREE.Vector3 } {
  const l = landmark('ferry-building')!;
  const b = new Batch();
  const f = new Frame(l.position.x, 0, l.position.z, l.rotationY);
  const L = 32, D = 8.2, H = 7.6;
  const stone = '#ede3ce', trim = '#f8f1e2', dark = '#6b6152', roof = '#a6b3ab';
  b.add(BOX(), f.at(0, -0.3, 0, 0, L + 0.6, 0.5, D + 0.6), '#d6c9b1');
  b.add(BOX(), f.at(0, 0, 0, 0, L, H, D), stone, GLOW(0.05));
  // end pavilions
  for (const s of [-1, 1]) {
    b.add(BOX(), f.at(s * (L / 2 - 1.8), 0, 0, 0, 3.8, H + 0.9, D + 0.5), stone);
    b.add(BOX(), f.at(s * (L / 2 - 1.8), H + 0.9, 0, 0, 4.1, 0.3, D + 0.8), trim);
  }
  // cornice + belt course
  b.add(BOX(), f.at(0, H - 0.1, 0, 0, L + 0.3, 0.4, D + 0.3), trim);
  b.add(BOX(), f.at(0, 3.75, 0, 0, L + 0.12, 0.28, D + 0.12), trim);
  // long hip roof with the nave skylight
  const r = { cx: f.point(0, 0, 0).x, cz: f.point(0, 0, 0).z, ux: Math.cos(l.rotationY), uz: -Math.sin(l.rotationY), vx: Math.sin(l.rotationY), vz: Math.cos(l.rotationY), hu: L / 2 - 3.6, hv: D / 2 };
  gableRoof(b, r, H + 0.3, 1.9, roof, stone, NONE, 0.25);
  b.add(BOX(), f.at(0, H + 1.7, 0, 0, L - 9, 0.7, 1.2), '#d5e0dc', [0, 0, 0, 1.15]);
  // arcades: ground floor arches + upper windows on both long sides
  for (const side of [1, -1]) {
    const z = side * (D / 2 + 0.02);
    const ry = side > 0 ? 0 : Math.PI;
    for (let i = -6; i <= 6; i++) {
      const x = i * 2.05;
      if (side > 0 && Math.abs(x) < 3) continue; // tower entrance
      b.add(arch(1.35, 3.0), f.at(x, 0.35, z, ry), dark, LIT);
      b.add(arch(0.95, 2.1), f.at(x, 4.4, z, ry), '#5f6d72', i % 3 === 0 ? NONE : litAt(4.4));
      b.add(BOX(), f.at(x - 1.02, 0.2, z + side * 0.06, ry, 0.22, H - 0.5, 0.14), trim);
    }
  }
  for (const s of [-1, 1]) for (let k = -1; k <= 1; k++) b.add(arch(1.0, 2.6), f.at(s * (L / 2 + 0.26), 1.0, k * 2.3, s * Math.PI / 2), dark);
  // clock tower (own mesh: it fades as a whole when it hides the player)
  const t = new Batch();
  // slender shaft with corner pilasters, clock stage, arcaded belfry, lantern and cupola
  const tz = D / 2 - 1.2;
  const tw = 3.9;
  const shaft = '#f4ecdb', pil = '#fbf6ec';
  t.add(BOX(), f.at(0, 0, tz, 0, tw, 20.2, tw), shaft, GLOW(0.2));
  t.add(arch(2.4, 4.6), f.at(0, 0.3, tz + tw / 2 + 0.02), dark, LIT);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) t.add(BOX(), f.at(sx * (tw / 2 - 0.12), 0, tz + sz * (tw / 2 - 0.12), 0, 0.45, 20.2, 0.45), pil);
  for (const y of [7.8, 11.4, 15.0, 19.6]) t.add(BOX(), f.at(0, y, tz, 0, tw + 0.3, 0.28, tw + 0.3), trim);
  for (const face of [0, 1, 2, 3]) {
    const ry = (face * Math.PI) / 2;
    const nx = Math.sin(ry), nz = Math.cos(ry);
    for (const [y, h] of [[8.4, 2.4], [12.0, 2.4], [15.6, 3.2]] as [number, number][]) {
      for (const o of [-0.6, 0.6]) t.add(arch(0.55, h), f.at(nx * (tw / 2 + 0.02) + Math.cos(ry) * o, y, tz + nz * (tw / 2 + 0.02) - Math.sin(ry) * o, ry), '#606c6a');
    }
  }
  // clock stage
  t.add(BOX(), f.at(0, 20.2, tz, 0, tw + 0.7, 3.5, tw + 0.7), '#f6eedf', GLOW(0.35));
  t.add(BOX(), f.at(0, 23.7, tz, 0, tw + 1.0, 0.35, tw + 1.0), trim);
  const clockR = 1.35;
  const face = atlas.clockFace();
  for (let k = 0; k < 4; k++) {
    const ry = l.rotationY + (k * Math.PI) / 2;
    const n = new THREE.Vector3(Math.sin(ry), 0, Math.cos(ry));
    const c = f.point(0, 21.95, tz).addScaledVector(n, (tw + 0.7) / 2 + 0.03);
    labels.facing(c.x, c.y, c.z, ry, clockR * 2.1, clockR * 2.1, face);
    clocks.push({ center: c.clone().addScaledVector(n, 0.05), normal: n, radius: clockR });
  }
  // belfry: open arcade with corner piers
  t.add(BOX(), f.at(0, 24.05, tz, 0, 3.3, 3.1, 3.3), '#e9dfcb', GLOW(0.35));
  for (let k = 0; k < 4; k++) {
    const ry = (k * Math.PI) / 2;
    for (const o of [-0.75, 0.75]) t.add(arch(0.9, 2.3), f.at(Math.sin(ry) * 1.67 + Math.cos(ry) * o, 24.4, tz + Math.cos(ry) * 1.67 - Math.sin(ry) * o, ry), '#4d5552', litAt(24.4));
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) t.add(BOX(), f.at(sx * 1.55, 24.05, tz + sz * 1.55, 0, 0.42, 3.3, 0.42), pil);
  t.add(BOX(), f.at(0, 27.35, tz, 0, 3.8, 0.32, 3.8), trim);
  // lantern stage + cupola
  t.add(BOX(), f.at(0, 27.67, tz, 0, 2.3, 1.9, 2.3), shaft);
  for (let k = 0; k < 4; k++) { const ry = (k * Math.PI) / 2; t.add(arch(0.75, 1.3), f.at(Math.sin(ry) * 1.17, 27.95, tz + Math.cos(ry) * 1.17, ry), '#4d5552'); }
  t.add(BOX(), f.at(0, 29.55, tz, 0, 2.6, 0.25, 2.6), trim);
  t.add(CYL(8), f.at(0, 29.8, tz, Math.PI / 8, 0.95, 0.9, 0.95), shaft);
  t.add(CONE(8), f.at(0, 30.7, tz, Math.PI / 8, 1.1, 1.8, 1.1), '#a9b9ad');
  t.add(SPHERE(8, 6), f.at(0, 32.5, tz, 0, 0.24, 0.24, 0.24), '#cdb88f');
  t.add(CYL(5), f.at(0, 32.5, tz, 0, 0.05, 3.0, 0.05), '#d9d4c8');
  t.add(CBOX(), f.at(0.55, 35.0, tz, 0, 1.0, 0.6, 0.04), '#2f8f88');
  // entrance plaque
  const plaque = atlas.label('ferry-building', { text: 'FERRY BUILDING', w: 512, h: 72, bg: '#f5ecd9', fg: '#46524c', font: 'serif', size: 0.56 });
  const pp = f.point(0, 6.2, tz + tw / 2 + 0.04);
  labels.facing(pp.x, pp.y, pp.z, l.rotationY, 3.8, 0.55, plaque);
  // flagpoles at the end pavilions
  for (const s of [-1, 1]) {
    b.add(CYL(5), f.at(s * (L / 2 - 1.8), H + 1.2, 0, 0, 0.05, 2.6, 0.05), '#d9d4c8');
    b.add(CBOX(), f.at(s * (L / 2 - 1.8) + 0.45, H + 3.4, 0, 0, 0.9, 0.5, 0.04), s > 0 ? '#d8744a' : '#2f8f88');
  }
  return { body: b, tower: t, towerAt: f.point(0, 0, tz) };
}

// ---------------------------------------------------------------------------
// Coit Tower
// ---------------------------------------------------------------------------

function flutedColumn(r: number, h: number, flutes: number): THREE.BufferGeometry {
  const s = new THREE.Shape();
  const n = flutes * 2;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rr = i % 2 ? r * 0.93 : r;
    const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
    if (i === 0) s.moveTo(x, y); else s.lineTo(x, y);
  }
  const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false, curveSegments: 1 });
  g.rotateX(-Math.PI / 2);
  return g;
}

function coitTower(labels: LabelBatch, atlas: LabelAtlas): Batch {
  const l = landmark('coit-tower')!;
  const b = new Batch();
  const y0 = baseOf(l);
  const f = new Frame(l.position.x, y0, l.position.z, l.rotationY);
  const white = '#f4efe4', stone = '#e6ddcc';
  // lobby building
  b.add(BOX(), f.at(0, -0.4, 0, 0, 5.6, 3.1, 5.6), stone);
  b.add(BOX(), f.at(0, 2.7, 0, 0, 5.9, 0.3, 5.9), '#f6f0e4');
  for (let k = 0; k < 4; k++) {
    const ry = (k * Math.PI) / 2;
    for (const o of [-1.5, 0, 1.5]) b.add(arch(0.8, 1.7), f.at(Math.sin(ry) * 2.82 + Math.cos(ry) * o, 0.35, Math.cos(ry) * 2.82 - Math.sin(ry) * o, ry), '#5c615d', litAt(y0));
  }
  // fluted shaft (floodlit at night)
  const H = 14.2;
  b.add(flutedColumn(1.75, H, 16), f.at(0, 2.9, 0), white, GLOW(0.55));
  // observation arches ring
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    b.add(arch(0.62, 1.5), f.at(Math.sin(a) * 1.78, 2.9 + H - 2.3, Math.cos(a) * 1.78, a), '#4f5654');
  }
  b.add(CYL(24), f.at(0, 2.9 + H - 0.1, 0, 0, 1.98, 0.45, 1.98), '#f7f3ea', GLOW(0.55));
  b.add(CYL(24), f.at(0, 2.9 + H + 0.35, 0, 0, 1.7, 0.35, 1.7), '#efe8da');
  b.add(CYL(8), f.at(0, 2.9 + H + 0.7, 0, 0, 0.5, 0.5, 0.5), '#d9d0bf');
  b.add(SPHERE(6, 4), f.at(0, 2.9 + H + 1.2, 0, 0, 0.18, 0.18, 0.18), '#ffe6b0', GLOW(1));
  // name plate on the lobby
  const rect = atlas.label('coit', { text: 'COIT TOWER', w: 320, h: 64, bg: '#f5efe2', fg: '#4a524e', font: 'serif', size: 0.55 });
  const p = f.point(0, 2.25, 2.83);
  labels.facing(p.x, p.y, p.z, l.rotationY, 2.6, 0.5, rect);
  return b;
}

// ---------------------------------------------------------------------------
// Transamerica Pyramid + Salesforce Tower
// ---------------------------------------------------------------------------

function transamerica(): Batch {
  const l = landmark('transamerica')!;
  const b = new Batch();
  const f = new Frame(l.position.x, 0, l.position.z, l.rotationY);
  const h0 = 3.2, top = 41, half = 4.2, halfTop = 0.55;
  const c = '#ece9e1';
  // base colonnade
  b.add(BOX(), f.at(0, 0, 0, 0, half * 2 - 0.4, h0, half * 2 - 0.4), '#8e8b86');
  for (let k = 0; k < 4; k++) {
    const ry = (k * Math.PI) / 2;
    for (let i = -3; i <= 3; i++) {
      const o = i * 1.15;
      b.add(BOX(), f.at(Math.sin(ry) * (half - 0.2) + Math.cos(ry) * o, 0, Math.cos(ry) * (half - 0.2) - Math.sin(ry) * o, ry, 0.3, h0, 0.3), c);
    }
  }
  // four sloped faces
  const P = (x: number, y: number, z: number) => f.point(x, y, z);
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  for (let k = 0; k < 4; k++) {
    const [ax, az] = corners[k], [bx, bz] = corners[(k + 1) % 4];
    const A = P(ax * half, h0, az * half), B = P(bx * half, h0, bz * half), Cc = P(bx * halfTop, top, bz * halfTop), D = P(ax * halfTop, top, az * halfTop);
    const mid = new THREE.Vector3().addVectors(A, B).multiplyScalar(0.5);
    const center = P(0, h0, 0);
    const out = mid.clone().sub(center).setY(0).normalize();
    const n = out.multiplyScalar(top - h0).setY(half - halfTop).normalize();
    b.quad(A, B, Cc, D, n, c, win(2, h0));
  }
  // wings (elevator + stair shafts) near the top
  for (const s of [-1, 1]) {
    b.add(BOX(), f.at(s * 1.35, 25, 0, 0, 1.0, 11.5, 2.2), c, win(2, 25));
    b.add(CONE(4), f.at(s * 1.35, 36.5, 0, Math.PI / 4, 1.1, 2.2, 1.6), c);
  }
  // spire
  b.add(CONE(4), f.at(0, top, 0, Math.PI / 4, halfTop * 1.42, 6.5, halfTop * 1.42), '#f4f1ea', GLOW(0.6));
  return b;
}

function roundedSquare(half: number, radius: number, seg = 3): { x: number; z: number }[] {
  const pts: { x: number; z: number }[] = [];
  const cs = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
  cs.forEach(([sx, sz], k) => {
    const cx = sx * (half - radius), cz = sz * (half - radius);
    const a0 = (k * Math.PI) / 2;
    for (let i = 0; i <= seg; i++) {
      const a = a0 + (i / seg) * (Math.PI / 2);
      pts.push({ x: cx + Math.cos(a) * radius, z: cz + Math.sin(a) * radius });
    }
  });
  return pts;
}

function salesforce(): Batch {
  const l = landmark('salesforce-tower')!;
  const b = new Batch();
  const f = new Frame(l.position.x, 0, l.position.z, l.rotationY);
  const levels = [
    { y: 0, half: 4.1, r: 1.6 }, { y: 30, half: 3.7, r: 1.6 }, { y: 44, half: 3.1, r: 1.5 }, { y: 49, half: 2.6, r: 1.4 }, { y: 53.5, half: 1.9, r: 1.2 }, { y: 56.5, half: 0.9, r: 0.8 },
  ];
  const rings = levels.map(lv => roundedSquare(lv.half, lv.r, 3).map(p => f.point(p.x, lv.y, p.z)));
  const center = f.point(0, 0, 0);
  for (let li = 0; li < levels.length - 1; li++) {
    const A = rings[li], B = rings[li + 1];
    const crown = levels[li].y >= 44;
    const col = crown ? '#eef0ee' : '#d5d8d6';
    const info: Info = crown ? [0, 0, 0, 1] : win(6, 0);
    for (let i = 0; i < A.length; i++) {
      const j = (i + 1) % A.length;
      const mid = new THREE.Vector3().addVectors(A[i], A[j]).multiplyScalar(0.5);
      const out = mid.clone().sub(center).setY(0).normalize();
      const n = out.clone().multiplyScalar(levels[li + 1].y - levels[li].y).setY(levels[li].half - levels[li + 1].half).normalize();
      b.quad(A[i], A[j], B[j], B[i], n, col, info);
    }
  }
  const tip = rings[rings.length - 1];
  const apex = f.point(0, 57.6, 0);
  for (let i = 0; i < tip.length; i++) b.tri(tip[i], tip[(i + 1) % tip.length], apex, '#f2f3f1', [0, 0, 0, 1]);
  // crown lattice bands
  for (const y of [45.5, 47.5, 50.5, 52.5]) {
    const t = (y - 44) / (56.5 - 44);
    const half = 3.1 + (0.9 - 3.1) * t + 0.08;
    b.add(BOX(), f.at(0, y, 0, 0, half * 2, 0.25, half * 2), '#c9cdcb');
  }
  return b;
}

// ---------------------------------------------------------------------------
// Pier 39 gateway + K-Dock floats, Pier 33 canopy, cruise terminal, weekly board, fountain, stops
// ---------------------------------------------------------------------------

function pier39(labels: LabelBatch, atlas: LabelAtlas): Batch {
  const l = landmark('pier39')!;
  const b = new Batch();
  const f = new Frame(l.position.x, 0, l.position.z, l.rotationY);
  const wood = '#8c6442', beam = '#6f4f35';
  for (const s of [-1, 1]) {
    b.add(BOX(), f.at(s * 5.2, 0, 0, 0, 0.7, 5.6, 0.7), wood);
    b.add(BOX(), f.at(s * 5.2, 5.6, 0, 0, 0.9, 0.3, 0.9), beam);
    b.add(CYL(5), f.at(s * 5.2, 5.9, 0, 0, 0.05, 1.8, 0.05), '#e8e1d2');
    b.add(CBOX(), f.at(s * 5.2 + 0.4, 7.35, 0, 0, 0.8, 0.5, 0.04), s > 0 ? '#2f8f88' : '#d8744a');
  }
  b.add(BOX(), f.at(0, 4.3, 0, 0, 11.4, 0.6, 0.55), beam);
  b.add(BOX(), f.at(0, 4.9, 0, 0, 5.6, 1.4, 0.4), '#c9573c');
  const rect = atlas.label('pier39', { text: 'PIER 39', w: 320, h: 80, bg: '#c9573c', fg: '#fff5e3', font: 'sans', size: 0.62 });
  for (const s of [1, -1]) {
    const p = f.point(0, 5.6, s * 0.21);
    labels.facing(p.x, p.y, p.z, l.rotationY + (s < 0 ? Math.PI : 0), 5.2, 1.3, rect);
  }
  // (the K-Dock floats bob on the water: instanced in life.ts)
  return b;
}

/**
 * K-Dock floats in the sea-lion-docks landmark frame: [u (along the pier), v (across), width, depth, yaw].
 * Hand-placed, slightly skewed and uneven like the real weathered floats; a couple of them touch.
 */
export const K_DOCK_FLOATS: [number, number, number, number, number][] = [
  [-7.0, -1.6, 3.0, 2.3, 0.12], [-3.9, -2.3, 2.4, 1.9, -0.16], [-0.7, -1.7, 3.4, 2.5, 0.05], [2.9, -2.2, 2.6, 2.0, 0.18], [6.1, -1.5, 2.2, 1.8, -0.1],
  [-5.2, 1.7, 2.8, 2.2, -0.08], [-2.3, 2.2, 2.3, 1.7, 0.2], [1.0, 1.5, 3.2, 2.6, -0.14], [4.7, 2.0, 2.5, 2.0, 0.07],
];
/** Sea lions per float: two big piles, a few pairs and singles, one empty float. */
export const K_DOCK_LIONS = [5, 1, 0, 2, 6, 2, 1, 1, 1];
/** Float top above the water line. */
export const K_DOCK_TOP = 0.22;

export interface KDockSpot { x: number; y: number; z: number; ry: number; float: number; lx: number; ly: number; lz: number; lry: number; s: number }

/** K-Dock frame (world position + yaw of the sea-lion-docks landmark). */
export function kDockFrame() {
  const k = landmark('sea-lion-docks')!;
  return { x: k.position.x, z: k.position.z, ry: k.rotationY };
}

/**
 * Where the sea lions lie: per float a small heap (the first ones side by side, the rest piled on top),
 * in float-local coordinates plus their rest pose in world space.
 */
export function kDockSpots(): KDockSpot[] {
  const k = kDockFrame();
  const kf = new Frame(k.x, 0, k.z, k.ry);
  const out: KDockSpot[] = [];
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  K_DOCK_FLOATS.forEach(([u, v, w, d, yaw], fi) => {
    const n = K_DOCK_LIONS[fi] ?? 0;
    for (let j = 0; j < n; j++) {
      const layer = j < 3 ? 0 : 1;
      const slot = layer ? j - 3 : j;
      const across = n === 1 ? 0 : ((slot + 0.5) / Math.min(3, n - layer * 3) - 0.5) * (w - 1.1);
      const lx = across + (rnd() - 0.5) * 0.35 + (layer ? 0.3 : 0);
      const lz = (rnd() - 0.5) * Math.max(0.1, d - 1.6);
      const ly = DISTRICT.waterLevel + K_DOCK_TOP + layer * 0.34;
      const lry = (rnd() - 0.5) * 2.4 + (j % 2 ? Math.PI : 0);
      const sc = 0.85 + rnd() * 0.3;
      const c = Math.cos(yaw), sn = Math.sin(yaw);
      const p = kf.point(v + lx * c + lz * sn, ly, u - lx * sn + lz * c);
      out.push({ x: p.x, y: p.y, z: p.z, ry: k.ry + yaw + lry, float: fi, lx, ly: ly - DISTRICT.waterLevel, lz, lry, s: sc });
    }
  });
  return out;
}

function pier33(labels: LabelBatch, atlas: LabelAtlas): Batch {
  const l = landmark('pier33')!;
  const b = new Batch();
  const f = new Frame(l.position.x, 0, l.position.z, l.rotationY);
  const teal = '#3f6d73';
  for (const x of [-3.4, 3.4]) for (const z of [1.2, 3.8]) b.add(CYL(6), f.at(x, 0, z, 0, 0.1, 3.4, 0.1), '#39514f');
  b.add(BOX(), f.at(0, 3.4, 2.5, 0, 8.0, 0.25, 3.4), teal);
  b.add(BOX(), f.at(0, 3.1, 4.25, 0, 8.0, 0.55, 0.1), teal);
  const rect = atlas.label('alcatraz-landing', { text: 'ALCATRAZ LANDING', w: 512, h: 64, bg: '#3f6d73', fg: '#f4efe3', font: 'sans', size: 0.5 });
  const p = f.point(0, 3.38, 4.31);
  labels.facing(p.x, p.y, p.z, l.rotationY, 6.2, 0.5, rect);
  // queue stanchions
  for (let i = 0; i < 5; i++) for (const z of [0.9, 2.2]) b.add(CYL(5), f.at(-2.6 + i * 1.3, 0, z + 0.6, 0, 0.05, 0.9, 0.05), '#b9a37a');
  return b;
}

function cruiseTerminal(): Batch {
  const l = landmark('cruise-terminal')!;
  const b = new Batch();
  if (!l.collider || !('polygon' in l.collider)) return b;
  const poly = l.collider.polygon;
  b.walls(poly, -0.2, 4.6, '#dde2df', win(6, 0.3), shade('#dde2df', 0.8));
  b.polygon(poly, 4.6, '#c5ccc9');
  const r = obb(poly);
  // butterfly roof canopy
  const f = new Frame(r.cx, 4.6, r.cz, Math.atan2(r.ux, r.uz));
  b.add(CBOX(), f.at(-r.hv * 0.5, 0.55, 0, 0, r.hv * 1.1, 0.18, r.hu * 2 + 1.6, 0, 0.12), '#f1f2ef');
  b.add(CBOX(), f.at(r.hv * 0.5, 0.55, 0, 0, r.hv * 1.1, 0.18, r.hu * 2 + 1.6, 0, -0.12), '#e9ebe8');
  return b;
}

function weeklyBoard(labels: LabelBatch, atlas: LabelAtlas): Batch {
  const l = landmark('weekly-board')!;
  const b = new Batch();
  const f = new Frame(l.position.x, 0, l.position.z, l.rotationY);
  const post = '#6f4f35';
  for (const s of [-1, 1]) b.add(BOX(), f.at(s * 1.45, 0, 0, 0, 0.18, 2.9, 0.18), post);
  b.add(BOX(), f.at(0, 0.8, 0, 0, 3.1, 1.8, 0.16), '#3f5a50');
  b.add(BOX(), f.at(0, 0.9, 0.05, 0, 2.8, 1.6, 0.12), '#eadbb8');
  // five flyers in the same tints as the week panel's flyers (ui/WeekPanel FLYER_TINTS), pinned a little askew
  const tints = ['#f6e3c4', '#dcebe4', '#f3d6cc', '#e3e4f2', '#efe6c8'];
  const slots: [number, number, number][] = [[-0.92, 1.42, -0.05], [0, 1.47, 0.04], [0.92, 1.4, -0.03], [-0.46, 0.72, 0.05], [0.5, 0.74, -0.06]];
  slots.forEach(([x, y, tilt], i) => {
    b.add(BOX(), f.at(x, y - 0.3, 0.13, 0, 0.8, 0.62, 0.02, 0, tilt), tints[i]);
    b.add(BOX(), f.at(x, y + 0.17, 0.142, 0, 0.66, 0.1, 0.01, 0, tilt), shade(tints[i], 0.78));
    for (let k = 0; k < 2; k++) b.add(BOX(), f.at(x - 0.08 * k, y - 0.02 - k * 0.14, 0.142, 0, 0.5 - k * 0.16, 0.035, 0.01, 0, tilt), '#9a8f82');
    b.add(SPHERE(4, 3), f.at(x, y + 0.29, 0.16, 0, 0.045, 0.045, 0.045), '#d8744a');
  });
  const r = { cx: f.point(0, 0, 0).x, cz: f.point(0, 0, 0).z, ux: Math.cos(l.rotationY), uz: -Math.sin(l.rotationY), vx: Math.sin(l.rotationY), vz: Math.cos(l.rotationY), hu: 1.55, hv: 0.3 };
  gableRoof(b, r, 2.9, 0.45, PAL.roof, post, NONE, 0.2);
  const rect = atlas.label('week-board', { text: '这周去哪 · THIS WEEK', w: 448, h: 64, bg: '#2f8f88', fg: '#fffaf1', font: 'cjk', size: 0.52 });
  const p = f.point(0, 2.66, 0.13);
  labels.facing(p.x, p.y, p.z, l.rotationY, 2.6, 0.38, rect);
  // ground lamp lights the board at night
  b.add(BOX(), f.at(0, 2.78, 0.35, 0, 1.8, 0.08, 0.14), PAL.lampGlass, GLOW(0.8));
  return b;
}

function levisFountain(): Batch {
  const l = landmark('levis-plaza')!;
  const b = new Batch();
  const f = new Frame(l.position.x, 0, l.position.z, 0.61);
  const granite = '#c4b6aa';
  b.add(CYL(20), f.at(0, 0, 0, 0, 2.15, 0.45, 2.15), '#b3a99c');
  b.add(CYL(20), f.at(0, 0.3, 0, 0, 1.95, 0.18, 1.95), '#86c3c1', [0, 0, 0, 1.1]);
  const blocks: [number, number, number, number, number][] = [[-0.5, 0.2, 1.1, 1.3, 0.9], [0.5, -0.3, 0.9, 1.8, 0.8], [0.1, 0.6, 0.8, 0.9, 0.7], [-0.2, -0.6, 0.7, 1.0, 1.0]];
  blocks.forEach(([x, z, w, h, d], i) => b.add(BOX(), f.at(x, 0.3, z, i * 0.4, w, h, d), i % 2 ? granite : shade(granite, 0.92)));
  for (const [x, z] of [[0.5, -0.3], [-0.5, 0.2]]) b.add(CYL(6, 0.3), f.at(x, 1.6, z, 0, 0.12, 0.7, 0.12), '#e9f5f3', [0, 0, 0, 1.12]);
  return b;
}

function streetcarStops(labels: LabelBatch, atlas: LabelAtlas): Batch {
  const b = new Batch();
  for (const l of DISTRICT.landmarks.filter(x => x.kind === 'streetcar-stop')) {
    const f = new Frame(l.position.x, 0.06, l.position.z, l.rotationY);
    const frame = '#3f5a50';
    for (const s of [-1, 1]) b.add(BOX(), f.at(s * 1.15, 0, -0.45, 0, 0.1, 2.5, 0.1), frame);
    b.add(BOX(), f.at(0, 0.1, -0.5, 0, 2.3, 2.2, 0.05), '#cfe3e6', [0, 0, 0, 1.1]);
    b.add(BOX(), f.at(0, 2.5, -0.1, 0, 2.6, 0.12, 1.2), frame);
    b.add(BOX(), f.at(0, 0.45, -0.3, 0, 1.8, 0.08, 0.4), '#9b7a55');
    // stop sign post
    b.add(CYL(5), f.at(1.65, 0, 0.2, 0, 0.05, 2.6, 0.05), frame);
    const id = l.id.replace('streetcar-stop-', '');
    const stop = DISTRICT.streetcar.stops.find(s => s.id === id);
    const rect = atlas.label(`stop:${id}`, { text: `F · ${stop?.name.en ?? id}`, w: 320, h: 64, bg: '#f4efe3', fg: '#3f5a50', font: 'sans', border: '#e0a94a', size: 0.42 });
    const p = f.point(1.65, 2.35, 0.26);
    labels.facing(p.x, p.y, p.z, l.rotationY, 1.5, 0.3, rect);
    const p2 = f.point(1.65, 2.35, 0.14);
    labels.facing(p2.x, p2.y, p2.z, l.rotationY + Math.PI, 1.5, 0.3, rect);
    b.add(BOX(), f.at(0, 2.42, 0.45, 0, 1.6, 0.06, 0.12), PAL.lampGlass, GLOW(0.9));
  }
  return b;
}

function telescopes(): Batch {
  const b = new Batch();
  const spots: { x: number; z: number; ry: number; y: number }[] = [];
  for (const l of DISTRICT.landmarks.filter(x => x.kind === 'telescope')) spots.push({ x: l.position.x, z: l.position.z, ry: l.rotationY, y: baseOf(l) });
  for (const p of DISTRICT.props.filter(x => x.kind === 'telescope')) spots.push({ x: p.x, z: p.z, ry: p.rotationY ?? 0, y: heightAt(p.x, p.z) });
  for (const s of spots) {
    const f = new Frame(s.x, s.y, s.z, s.ry);
    b.add(CYL(8), f.at(0, 0, 0, 0, 0.26, 0.12, 0.26), '#5c6b69', KEEP);
    b.add(CYL(6), f.at(0, 0.1, 0, 0, 0.09, 0.95, 0.09), '#6c7b79', KEEP);
    b.add(BOX(), f.at(0, 1.02, 0, 0, 0.5, 0.36, 0.34, -0.15), PAL.teal, KEEP);
    for (const sx of [-0.12, 0.12]) b.add(CYL(8), f.at(sx, 1.2, 0.12, 0, 0.1, 0.34, 0.1, Math.PI / 2 - 0.15), '#2b3432', KEEP);
  }
  return b;
}

export interface Landmarks { heroes: Hero[]; clocks: ClockSpec[] }

export function buildLandmarks(labels: LabelBatch, atlas: LabelAtlas): Landmarks {
  const clocks: ClockSpec[] = [];
  const ferry = ferryBuilding(labels, atlas, clocks);
  const coit = landmark('coit-tower')!, trans = landmark('transamerica')!;
  const coitY = baseOf(coit);
  const heroes: Hero[] = [
    { id: 'ferry-building', batch: ferry.body },
    { id: 'ferry-tower', batch: ferry.tower, fade: { x: ferry.towerAt.x, z: ferry.towerAt.z, r: 2.9, y0: 0, y1: 36 } },
    { id: 'coit-tower', batch: coitTower(labels, atlas), fade: { x: coit.position.x, z: coit.position.z, r: 3.2, y0: coitY - 0.4, y1: coitY + 18.5 } },
    { id: 'transamerica', batch: transamerica(), fade: { x: trans.position.x, z: trans.position.z, r: 4.6, y0: 0, y1: 48 } },
    { id: 'salesforce-tower', batch: salesforce() },
    { id: 'pier39', batch: pier39(labels, atlas) },
    { id: 'pier33', batch: pier33(labels, atlas) },
    { id: 'cruise-terminal', batch: cruiseTerminal() },
    { id: 'weekly-board', batch: weeklyBoard(labels, atlas) },
    { id: 'levis-plaza', batch: levisFountain() },
    { id: 'streetcar-stops', batch: streetcarStops(labels, atlas) },
    { id: 'telescopes', batch: telescopes() },
  ];
  return { heroes, clocks };
}
