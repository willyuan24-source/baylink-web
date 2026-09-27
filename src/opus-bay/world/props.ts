import * as THREE from 'three';
import type { PropDef } from '../core/types';
import { emit } from '../core/events';
import { runtime } from '../core/runtime';
import { blockersNear, canStand, heightAt, surfaceAt } from '../core/terrain';
import { COIT_POS, DISTRICT, at, frameAt, stationOf } from '../data/district';
import { BOX, Batch, C, CBOX, CONE, CYL, CYLH, Frame, ICO, type Info, M, SPHERE, TORUS, hash2, mixColor, rng, shade } from './builder';
import { BLOB, TOY_INST, blobTexture } from './materials';
import { PAL } from './palette';

/**
 * Street furniture and planting. Static props + nature merge into the toy batch (one draw call; palms,
 * trees and flags sway in the vertex shader). Market stalls are two small meshes (market day / closed).
 * Pushables (cones, crates) and floating things (buoys, small boats) are instanced and simulated here.
 */

const WATER = DISTRICT.waterLevel;

export interface HaloSpec { x: number; y: number; z: number; size: number; color: THREE.Color; day?: number; blink?: boolean }
/** Ground light pool under a street lamp. */
export interface PoolSpec { x: number; y: number; z: number }

/** Contact-shadow blobs: quads with a radial alpha. */
export class BlobBatch {
  pos: number[] = [];
  uv: number[] = [];
  idx: number[] = [];
  add(x: number, z: number, rx: number, rz = rx, ry = 0, y?: number) {
    const yy = (y ?? heightAt(x, z)) + 0.07;
    const c = Math.cos(ry), s = Math.sin(ry);
    const base = this.pos.length / 3;
    for (const [u, v] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const lx = u * rx, lz = v * rz;
      this.pos.push(x + lx * c + lz * s, yy, z - lx * s + lz * c);
      this.uv.push((u + 1) / 2, (v + 1) / 2);
    }
    this.idx.push(base, base + 2, base + 1, base, base + 3, base + 2);
  }
  build(): THREE.Mesh {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    BLOB.alphaMap = blobTexture();
    const m = new THREE.Mesh(g, BLOB);
    m.name = 'blob-shadows';
    m.renderOrder = 2;
    m.matrixAutoUpdate = false;
    return m;
  }
}

const sway = (base: number, height: number, k = 1): ((x: number, y: number) => Info) => (_x: number, y: number) => [0, 0, Math.max(0, Math.min(1, (y - base) / height)) * k, 0];

// ---------------------------------------------------------------------------
// Models (local frame)
// ---------------------------------------------------------------------------

function palm(b: Batch, x: number, z: number, s: number, seed: number) {
  const y0 = heightAt(x, z);
  const H = 4.3 * s;
  const f = new Frame(x, y0, z, seed * 6.28);
  const bark = (_x: number, _y: number, _z: number, _lx: number, ly: number) => (Math.floor(ly * 9) % 2 ? C('#8f6e4b') : C('#a58360'));
  b.addFlat(CYLH(7, 0.78, 9), f.at(0, 0, 0, 0, 0.36 * s, H, 0.36 * s), bark, [0, 0, 0.12, 0]);
  b.add(ICO(0), f.at(0, H + 0.05, 0, 0, 0.5 * s, 0.42 * s, 0.5 * s), '#7a6a3c', sway(y0, H, 0.9));
  const fronds = 11;
  for (let i = 0; i < fronds; i++) {
    const yaw = (i / fronds) * Math.PI * 2 + seed;
    const len = (1.6 + hash2(i, seed * 9) * 0.5) * s;
    const up = i % 3 === 0 ? 0.75 : 0.35;
    // three segments bending down
    let px = 0, py = H + 0.15 * s, pz = 0;
    let pitch = up;
    for (let k = 0; k < 3; k++) {
      const seg = len / 3;
      const dx = Math.sin(yaw) * Math.cos(pitch) * seg, dy = Math.sin(pitch) * seg, dz = Math.cos(yaw) * Math.cos(pitch) * seg;
      const w = (0.5 - k * 0.13) * s;
      const col = mixColor('#5d8a42', '#86ae57', k / 2 + hash2(i, k) * 0.2);
      b.add(CBOX(), f.at(px + dx / 2, py + dy / 2, pz + dz / 2, yaw, w, 0.05, seg * 1.02, -pitch), col, sway(y0, H, 1));
      px += dx; py += dy; pz += dz;
      pitch -= 0.55;
    }
  }
}

function tree(b: Batch, x: number, z: number, s: number, seed: number) {
  const y0 = heightAt(x, z);
  const f = new Frame(x, y0, z, seed * 6.28);
  const pine = y0 > 4 && hash2(x, z) > 0.45;
  if (pine) {
    const H = 3.6 * s;
    b.add(CYL(5), f.at(0, 0, 0, 0, 0.14 * s, H * 0.4, 0.14 * s), '#6b4f36');
    for (let k = 0; k < 3; k++) {
      const r = (1.2 - k * 0.3) * s, y = H * 0.25 + k * 0.85 * s;
      b.add(CONE(7), f.at(0, y, 0, k, r, 1.5 * s, r), mixColor(PAL.pine, '#3f6340', hash2(seed, k)), sway(y0, H * 1.2, 0.5));
    }
    return;
  }
  const H = 1.5 * s;
  b.add(CYL(5, 0.8), f.at(0, 0, 0, 0, 0.16 * s, H + 0.4, 0.16 * s), '#7a5a3e');
  const blobs: [number, number, number, number][] = [[0, H + 0.9, 0, 1.15], [0.55, H + 0.6, 0.3, 0.85], [-0.45, H + 0.7, -0.35, 0.8]];
  blobs.forEach(([bx, by, bz, r], k) => {
    const col = mixColor(PAL.tree, PAL.treeDark, (hash2(seed * 3, k) * 0.8 + (k === 0 ? 0 : 0.2)));
    b.add(ICO(k === 0 ? 1 : 0), f.at(bx * s, by * s, bz * s, k, r * s, r * s * 0.92, r * s), col, sway(y0, (H + 2) * s, 0.45));
  });
}

function bush(b: Batch, x: number, z: number, s: number, seed: number, flowers = true) {
  const y0 = heightAt(x, z);
  const f = new Frame(x, y0, z, seed * 6.28);
  b.add(ICO(s > 0.85 ? 1 : 0), f.at(0, 0.35 * s, 0, 0, 0.7 * s, 0.55 * s, 0.7 * s), mixColor(PAL.grassDark, PAL.treeDark, hash2(seed, 1) * 0.6), sway(y0, 1.2, 0.25));
  b.add(ICO(0), f.at(0.45 * s, 0.3 * s, 0.25 * s, 1, 0.45 * s, 0.4 * s, 0.45 * s), mixColor(PAL.tree, PAL.grassDark, 0.4), sway(y0, 1.2, 0.25));
  if (flowers) {
    const cols = ['#e8a0b0', '#f2d27a', '#c9a6e0', '#f6efe1', '#e98b6d'];
    for (let k = 0; k < 3; k++) {
      const a = k * 2.1 + seed;
      b.add(ICO(0), f.at(Math.cos(a) * 0.5 * s, (0.55 + (k % 2) * 0.12) * s, Math.sin(a) * 0.5 * s, 0, 0.13, 0.13, 0.13), cols[(k + Math.floor(seed * 10)) % cols.length]);
    }
  }
}

function lamp(b: Batch, halos: HaloSpec[], blobs: BlobBatch, pools: PoolSpec[], x: number, z: number) {
  const y0 = heightAt(x, z);
  const f = new Frame(x, y0, z);
  // lamp posts never dither away (w = −1); the glass also glows at night (w = −2)
  const keep: Info = [0, y0, 0, -1];
  b.add(CYL(8), f.at(0, 0, 0, 0, 0.16, 0.35, 0.16), PAL.lampPost, keep);
  b.add(CYL(6), f.at(0, 0.3, 0, 0, 0.06, 3.3, 0.06), PAL.lampPost, keep);
  b.add(CYL(8, 0.7), f.at(0, 3.55, 0, 0, 0.22, 0.5, 0.22), PAL.lampGlass, [0, y0, 0, -2]);
  b.add(CONE(8), f.at(0, 4.02, 0, 0, 0.3, 0.3, 0.3), PAL.lampPost, keep);
  b.add(SPHERE(5, 4), f.at(0, 4.34, 0, 0, 0.06, 0.06, 0.06), '#c9b48c', keep);
  halos.push({ x, y: y0 + 3.8, z, size: 3.2, color: new THREE.Color(1.0, 0.74, 0.42) });
  halos.push({ x, y: y0 + 3.78, z, size: 0.6, color: new THREE.Color(1.5, 1.25, 0.95) });
  blobs.add(x, z, 0.45);
  // warm light pool on the paving (skipped on slopes, where a flat decal would float or clip)
  const slope = Math.max(Math.abs(heightAt(x + 1, z) - heightAt(x - 1, z)), Math.abs(heightAt(x, z + 1) - heightAt(x, z - 1))) / 2;
  if (slope <= 0.1) pools.push({ x, y: y0, z });
}

function bench(b: Batch, x: number, z: number, ry: number) {
  const f = new Frame(x, heightAt(x, z), z, ry);
  const wood = '#a4774d', metal = '#39433f';
  b.add(BOX(), f.at(0, 0.42, 0.05, 0, 1.55, 0.08, 0.46), wood);
  b.add(BOX(), f.at(0, 0.58, -0.2, 0, 1.55, 0.36, 0.06, -0.18), wood);
  for (const s of [-0.66, 0.66]) b.add(BOX(), f.at(s, 0, 0, 0, 0.07, 0.46, 0.46), metal);
}

function planter(b: Batch, x: number, z: number, seed: number) {
  const y0 = heightAt(x, z);
  const f = new Frame(x, y0, z, seed);
  b.add(BOX(), f.at(0, 0, 0, 0, 1.2, 0.55, 1.2), '#cdbfa7');
  b.add(BOX(), f.at(0, 0.5, 0, 0, 1.05, 0.08, 1.05), '#6b5440');
  bush(b, x, z, 0.8, seed);
  void f;
}

function bin(b: Batch, x: number, z: number) {
  const f = new Frame(x, heightAt(x, z), z);
  b.add(CYL(8), f.at(0, 0, 0, 0, 0.28, 0.85, 0.28), '#3f6b57');
  b.add(CYL(8), f.at(0, 0.85, 0, 0, 0.31, 0.08, 0.31), '#2f5244');
}

function bollard(b: Batch, x: number, z: number) {
  const f = new Frame(x, heightAt(x, z), z);
  b.add(CYL(8), f.at(0, 0, 0, 0, 0.14, 0.72, 0.14), '#4a4f4f');
  b.add(SPHERE(6, 4), f.at(0, 0.72, 0, 0, 0.15, 0.1, 0.15), '#5b6161');
}

function bikeRack(b: Batch, x: number, z: number, ry: number) {
  const f = new Frame(x, heightAt(x, z), z, ry);
  for (const o of [-0.6, 0, 0.6]) b.add(TORUS(1, 0.09, 4, 8, Math.PI), f.at(o, 0.35, 0, Math.PI / 2, 0.35, 0.45, 0.35), '#5b6566');
}

const FLAG_COLORS = ['#2f8f88', '#d8744a', '#efe3c8', '#c9573c'];
function flag(b: Batch, x: number, z: number, i: number) {
  const y0 = heightAt(x, z);
  const f = new Frame(x, y0, z, i * 0.7);
  b.add(CYL(5), f.at(0, 0, 0, 0, 0.05, 4.6, 0.05), '#e7e1d5');
  b.add(SPHERE(5, 4), f.at(0, 4.62, 0, 0, 0.08, 0.08, 0.08), '#d9d2c2');
  b.add(CBOX(), f.at(0.55, 4.1, 0, 0, 1.05, 0.66, 0.03), FLAG_COLORS[i % FLAG_COLORS.length], () => [0, 0, 0.55, 0]);
}

function mailbox(b: Batch, x: number, z: number) {
  const f = new Frame(x, heightAt(x, z), z);
  b.add(BOX(), f.at(0, 0, 0, 0, 0.12, 0.3, 0.12), '#2c3f63');
  b.add(BOX(), f.at(0, 0.3, 0, 0, 0.46, 0.62, 0.42), '#3d5f97');
  b.add(CYL(8, 1), f.at(0, 0.92, 0, 0, 0.23, 0.01, 0.21), '#3d5f97');
}

function kiosk(b: Batch, blobs: BlobBatch, x: number, z: number, ry: number, seed: number) {
  const f = new Frame(x, heightAt(x, z), z, ry);
  const body = seed > 0.5 ? '#2f8f88' : '#d8744a';
  b.add(BOX(), f.at(0, 0, 0, 0, 1.7, 1.1, 1.4), body);
  b.add(BOX(), f.at(0, 1.1, 0, 0, 1.7, 0.9, 1.4), '#f6efe1', [3, 1.1, 0, 0]);
  b.add(BOX(), f.at(0, 2.0, 0, 0, 2.0, 0.18, 1.7), body);
  b.add(BOX(), f.at(0, 1.05, 0.8, 0, 1.8, 0.07, 0.35), '#e9dcc2');
  blobs.add(x, z, 1.3, 1.1, ry);
}

function board(b: Batch, x: number, z: number, ry: number) {
  const f = new Frame(x, heightAt(x, z), z, ry);
  for (const s of [-0.8, 0.8]) b.add(BOX(), f.at(s, 0, 0, 0, 0.12, 2.1, 0.12), '#6f4f35');
  b.add(BOX(), f.at(0, 0.9, 0, 0, 1.9, 1.1, 0.1), '#3f5a50');
  b.add(BOX(), f.at(0, 0.97, 0.04, 0, 1.7, 0.95, 0.05), '#cfe0d0');
  b.add(BOX(), f.at(-0.3, 1.15, 0.07, 0, 0.6, 0.45, 0.02), '#79c1bb');
  b.add(BOX(), f.at(0.45, 1.3, 0.07, 0, 0.5, 0.2, 0.02), '#d8744a');
}

function sign(b: Batch, x: number, z: number, ry: number, seed: number) {
  const f = new Frame(x, heightAt(x, z), z, ry);
  b.add(CYL(5), f.at(0, 0, 0, 0, 0.05, 2.1, 0.05), '#3f5a50');
  b.add(BOX(), f.at(0, 1.35, 0.04, 0, 0.9, 0.7, 0.05), '#f4efe3');
  b.add(BOX(), f.at(0, 1.85, 0.05, 0, 0.9, 0.2, 0.06), seed > 0.5 ? PAL.teal : PAL.terracotta);
}

function bell(b: Batch, x: number, z: number, ry: number) {
  const f = new Frame(x, heightAt(x, z), z, ry);
  for (const s of [-0.55, 0.55]) b.add(BOX(), f.at(s, 0, 0, 0, 0.16, 2.1, 0.16), '#6f4f35');
  b.add(BOX(), f.at(0, 2.05, 0, 0, 1.4, 0.18, 0.24), '#6f4f35');
  b.add(CYL(12, 0.55), f.at(0, 1.35, 0, 0, 0.36, 0.58, 0.36), '#b0813e');
  b.add(SPHERE(8, 5), f.at(0, 1.92, 0, 0, 0.2, 0.12, 0.2), '#b0813e');
  b.add(SPHERE(5, 4), f.at(0, 1.3, 0, 0, 0.08, 0.08, 0.08), '#6e5226');
}

function fishingRod(b: Batch, x: number, z: number, ry: number) {
  const f = new Frame(x, heightAt(x, z), z, ry);
  const base = f.point(0, 0.95, -0.1), tip = f.point(0, 2.6, 1.6), water = f.point(0, WATER - heightAt(x, z), 2.4);
  b.beam(base, tip, 0.05, 0.05, '#3a3a3a');
  b.beam(tip, water, 0.015, 0.015, '#e9e6de');
  b.add(CYL(8), f.at(0.35, 0, -0.3, 0, 0.2, 0.36, 0.2), '#d8744a');
}

function umbrellaTable(b: Batch, blobs: BlobBatch, x: number, z: number, seed: number) {
  const y0 = heightAt(x, z);
  const f = new Frame(x, y0, z, seed);
  b.add(CYL(10), f.at(0, 0.7, 0, 0, 0.55, 0.06, 0.55), '#f6efe1');
  b.add(CYL(6), f.at(0, 0, 0, 0, 0.05, 2.3, 0.05), '#6d6a64');
  const stripe = seed > 0.5 ? PAL.terracotta : PAL.teal;
  b.addFlat(CONE(8), f.at(0, 2.05, 0, 0, 1.25, 0.5, 1.25), (_x2, _y, _z2, lx, _ly, lz) => {
    const a = Math.atan2(lz, lx);
    return Math.floor(((a + Math.PI) / (Math.PI * 2)) * 8 + 0.5) % 2 ? C('#f6efe1') : C(stripe);
  });
  for (let k = 0; k < 3; k++) { const a = k * 2.1 + seed; b.add(BOX(), f.at(Math.cos(a) * 0.9, 0, Math.sin(a) * 0.9, a, 0.38, 0.45, 0.38), '#9b7a55'); }
  blobs.add(x, z, 1.25);
}

// Market stall (open / closed variants)
function stall(open: Batch, closed: Batch, x: number, z: number, ry: number, i: number) {
  const y0 = heightAt(x, z);
  // canopies 15 % less saturated than the brand accents; every other stall striped with cream
  const cols = ['#cf7a55', '#3d8a84', '#d2b27a', '#93aa68', '#c46a62'];
  const stripe = cols[i % cols.length];
  const striped = i % 2 === 0;
  for (const b of [open, closed]) {
    const f = new Frame(x, y0, z, ry);
    for (const sx of [-1.2, 1.2]) for (const sz of [-0.75, 0.75]) b.add(BOX(), f.at(sx, 0, sz, 0, 0.08, 2.3, 0.08), '#6d6a64');
    b.add(BOX(), f.at(0, 0.8, 0.35, 0, 2.4, 0.08, 0.9), '#e8dcc4');
  }
  const f = new Frame(x, y0, z, ry);
  // open: striped awning + produce crates + price flag
  for (let k = 0; k < 6; k++) open.add(CBOX(), f.at(-1.25 + (k + 0.5) * (2.5 / 6), 2.35, 0, 0, 2.5 / 6, 0.07, 1.9, 0.18), striped && k % 2 ? '#f7f1e3' : stripe);
  if (!striped) open.add(CBOX(), f.at(0, 2.2, 0.96, 0, 2.55, 0.16, 0.05, 0.18), '#f7f1e3');
  const produce = ['#d9483b', '#e8913a', '#8fbf4d', '#f2cc4f', '#9c5aa0', '#6fae4a'];
  for (let k = 0; k < 4; k++) {
    open.add(BOX(), f.at(-0.9 + k * 0.6, 0.88, 0.45, 0, 0.5, 0.18, 0.5), '#b88d62');
    for (let m = 0; m < 3; m++) open.add(SPHERE(5, 4), f.at(-1.02 + k * 0.6 + m * 0.12, 1.08, 0.38 + (m % 2) * 0.14, 0, 0.1, 0.1, 0.1), produce[(k * 2 + i + m) % produce.length]);
  }
  open.add(BOX(), f.at(0, 1.8, 0.95, 0, 1.2, 0.35, 0.03), '#fffaf1');
  // closed: plain roof + tarps over stacked crates
  closed.add(CBOX(), f.at(0, 2.33, 0, 0, 2.5, 0.07, 1.9, 0.18), shade(stripe, 0.8));
  closed.add(BOX(), f.at(0, 0.88, 0.35, 0, 1.6, 0.5, 0.7), '#7d93a3');
}

// ---------------------------------------------------------------------------
// Pushables + floaters (instanced, simulated)
// ---------------------------------------------------------------------------

interface Body { kind: 'cone' | 'crate'; x: number; z: number; vx: number; vz: number; yaw: number; spin: number; tilt: number; tiltV: number; ax: number; az: number; r: number; lastBump: number; hop: number }

function coneGeo(): THREE.BufferGeometry {
  const b = new Batch();
  b.add(BOX(), new THREE.Matrix4().makeScale(0.5, 0.06, 0.5), '#e2622f');
  // three frustum bands: orange / white reflective collar / orange tip
  const bands: [number, number, string][] = [[0, 0.28, '#ee7437'], [0.28, 0.42, '#f6f1e6'], [0.42, 0.62, '#ee7437']];
  for (const [h0, h1, col] of bands) {
    const r0 = 0.21 * (1 - h0 / 0.64), r1 = 0.21 * (1 - h1 / 0.64);
    b.add(CYL(10, r1 / r0), new THREE.Matrix4().compose(new THREE.Vector3(0, 0.06 + h0, 0), new THREE.Quaternion(), new THREE.Vector3(r0, h1 - h0, r0)), col);
  }
  return b.build();
}
function crateGeo(): THREE.BufferGeometry {
  const b = new Batch();
  b.add(BOX(), new THREE.Matrix4().makeScale(0.72, 0.62, 0.72), '#b88d62');
  for (const y of [0.08, 0.5]) b.add(BOX(), new THREE.Matrix4().compose(new THREE.Vector3(0, y, 0), new THREE.Quaternion(), new THREE.Vector3(0.76, 0.1, 0.76)), '#96704b');
  return b.build();
}
function buoyGeo(): THREE.BufferGeometry {
  const b = new Batch();
  b.add(CYL(10), new THREE.Matrix4().compose(new THREE.Vector3(0, -0.4, 0), new THREE.Quaternion(), new THREE.Vector3(0.42, 0.45, 0.42)), '#f4efe6');
  b.add(CYL(10), new THREE.Matrix4().compose(new THREE.Vector3(0, 0.05, 0), new THREE.Quaternion(), new THREE.Vector3(0.42, 0.25, 0.42)), '#d9483b');
  b.add(CONE(8), new THREE.Matrix4().compose(new THREE.Vector3(0, 0.3, 0), new THREE.Quaternion(), new THREE.Vector3(0.3, 0.7, 0.3)), '#d9483b');
  b.add(SPHERE(6, 4), new THREE.Matrix4().compose(new THREE.Vector3(0, 1.05, 0), new THREE.Quaternion(), new THREE.Vector3(0.12, 0.12, 0.12)), '#ffe9b0', [0, 0, 0, 1]);
  return b.build();
}
function boatGeo(): THREE.BufferGeometry {
  const b = new Batch();
  // hull: tapered box + bow
  b.add(BOX(), new THREE.Matrix4().compose(new THREE.Vector3(0, -0.25, -0.2), new THREE.Quaternion(), new THREE.Vector3(1.2, 0.55, 2.6)), (_x, y) => (y > 0.18 ? C('#2f8f88') : C('#f6f2ea')));
  b.add(CYL(3), new THREE.Matrix4().compose(new THREE.Vector3(0, -0.25, 1.1), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI, 0)), new THREE.Vector3(0.7, 0.55, 0.8)), '#f6f2ea');
  b.add(BOX(), new THREE.Matrix4().compose(new THREE.Vector3(0, 0.3, -0.5), new THREE.Quaternion(), new THREE.Vector3(0.9, 0.45, 1.0)), '#fbf8f1', [6, 0.3, 0, 0]);
  b.add(BOX(), new THREE.Matrix4().compose(new THREE.Vector3(0, 0.3, -0.05), new THREE.Quaternion(), new THREE.Vector3(0.86, 0.3, 0.1)), '#5d7a86');
  b.add(CYL(5), new THREE.Matrix4().compose(new THREE.Vector3(0, 0.3, 0.3), new THREE.Quaternion(), new THREE.Vector3(0.04, 2.6, 0.04)), '#e7e1d5');
  return b.build();
}

export class Floaters {
  readonly group = new THREE.Group();
  private bodies: Body[] = [];
  private cones: THREE.InstancedMesh;
  private crates: THREE.InstancedMesh;
  private buoys: THREE.InstancedMesh;
  private boats: THREE.InstancedMesh;
  private buoyData: { x: number; z: number; ph: number }[] = [];
  private boatData: { x: number; z: number; ry: number; s: number; ph: number }[] = [];
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();
  private p = new THREE.Vector3();
  private s = new THREE.Vector3();

  constructor(props: PropDef[]) {
    this.group.name = 'floaters';
    for (const p of props) {
      if (p.kind === 'cone' || p.kind === 'crate') {
        this.bodies.push({ kind: p.kind, x: p.x, z: p.z, vx: 0, vz: 0, yaw: p.rotationY ?? 0, spin: 0, tilt: 0, tiltV: 0, ax: 1, az: 0, r: p.kind === 'cone' ? 0.26 : 0.42, lastBump: -9, hop: 0 });
      } else if (p.kind === 'buoy') this.buoyData.push({ x: p.x, z: p.z, ph: hash2(p.x, p.z) * 6.28 });
      else if (p.kind === 'boat-small') this.boatData.push({ x: p.x, z: p.z, ry: p.rotationY ?? 0, s: p.scale ?? 1, ph: hash2(p.z, p.x) * 6.28 });
    }
    const make = (geo: THREE.BufferGeometry, n: number, name: string) => {
      const mesh = new THREE.InstancedMesh(geo, TOY_INST, Math.max(1, n));
      mesh.count = n;
      mesh.name = name;
      mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.group.add(mesh);
      return mesh;
    };
    this.cones = make(coneGeo(), this.bodies.filter(b => b.kind === 'cone').length, 'cones');
    this.crates = make(crateGeo(), this.bodies.filter(b => b.kind === 'crate').length, 'crates');
    this.buoys = make(buoyGeo(), this.buoyData.length, 'buoys');
    this.boats = make(boatGeo(), this.boatData.length, 'small-boats');
    this.boats.castShadow = false;
    this.update(0, 0);
  }

  private frame = 0;
  private waterDt = 0;
  private q2 = new THREE.Quaternion();
  private actors = [{ x: 0, z: 0, sp: 0, r: 0.45 }, { x: 0, z: 0, sp: 0, r: 0.42 }];

  update(dt: number, t: number) {
    const actors = this.actors;
    actors[0].x = runtime.player.x; actors[0].z = runtime.player.z; actors[0].sp = runtime.player.speed;
    actors[1].x = runtime.guide.x; actors[1].z = runtime.guide.z; actors[1].sp = runtime.guide.speed;
    let ci = 0, ki = 0, changed = this.frame === 0;
    for (const b of this.bodies) {
      // resting bodies far from both actors: nothing to simulate or upload
      const still = Math.abs(b.vx) + Math.abs(b.vz) + Math.abs(b.tilt) + Math.abs(b.tiltV) + Math.abs(b.spin) + b.hop < 1e-3;
      if (still && dt > 0 && Math.min(Math.hypot(b.x - actors[0].x, b.z - actors[0].z), Math.hypot(b.x - actors[1].x, b.z - actors[1].z)) > 2) {
        if (b.kind === 'cone') ci++; else ki++;
        continue;
      }
      changed = true;
      for (const a of actors) {
        const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz), min = b.r + a.r;
        if (d < min && d > 1e-4) {
          const nx = dx / d, nz = dz / d, over = min - d;
          const mass = b.kind === 'cone' ? 1 : 2.2;
          const tx = b.x + nx * over, tz = b.z + nz * over;
          if (canStand(tx, tz, 0.05)) { b.x = tx; b.z = tz; }
          const kick = (Math.max(1.2, a.sp) * 1.1 + 0.8) / mass;
          b.vx += nx * kick * 0.6; b.vz += nz * kick * 0.6;
          b.spin += (hash2(t, b.x) - 0.5) * 6 / mass;
          b.ax = nz; b.az = -nx;
          b.tiltV += (b.kind === 'cone' ? 7 : 3) * Math.min(1.5, kick);
          if (b.kind === 'crate') b.hop = Math.min(0.25, 0.08 * a.sp);
          if (t - b.lastBump > 0.35) { b.lastBump = t; emit({ type: 'bump', kind: b.kind, strength: Math.min(1, a.sp / 7 + 0.25) }); }
        }
      }
      if (dt > 0) {
        const nx = b.x + b.vx * dt, nz = b.z + b.vz * dt;
        if (canStand(nx, nz, b.r * 0.5)) { b.x = nx; b.z = nz; } else { b.vx *= -0.35; b.vz *= -0.35; }
        const fr = Math.exp(-dt * (b.kind === 'cone' ? 2.6 : 4.5));
        b.vx *= fr; b.vz *= fr;
        b.yaw += b.spin * dt; b.spin *= Math.exp(-dt * 3);
        // spring back upright (toy wobble)
        b.tiltV += (-b.tilt * 38 - b.tiltV * 5.5) * dt;
        b.tilt += b.tiltV * dt;
        b.tilt = Math.max(-1.1, Math.min(1.1, b.tilt));
        b.hop = Math.max(0, b.hop - dt * 1.2);
      }
      const y = heightAt(b.x, b.z) + 0.03 + Math.sin(Math.min(1, b.hop * 4) * Math.PI) * b.hop;
      this.q.setFromAxisAngle(this.p.set(b.ax, 0, b.az), b.tilt * (b.kind === 'cone' ? 1 : 0.35));
      this.q.multiply(this.q2.setFromAxisAngle(this.s.set(0, 1, 0), b.yaw));
      this.m.compose(this.p.set(b.x, y, b.z), this.q, this.s.set(1, 1, 1));
      if (b.kind === 'cone') this.cones.setMatrixAt(ci++, this.m); else this.crates.setMatrixAt(ki++, this.m);
    }
    if (changed) {
      this.cones.instanceMatrix.needsUpdate = true;
      this.crates.instanceMatrix.needsUpdate = true;
    }
    // buoys and moored boats bob at 30 Hz
    this.waterDt += dt;
    if ((this.frame++ & 1) && dt > 0) return;
    this.waterDt = 0;
    this.buoyData.forEach((d, i) => {
      const bob = Math.sin(t * 1.4 + d.ph) * 0.09;
      this.e.set(Math.sin(t * 1.1 + d.ph) * 0.12, d.ph, Math.cos(t * 0.9 + d.ph) * 0.12);
      this.m.compose(this.p.set(d.x, WATER + bob, d.z), this.q.setFromEuler(this.e), this.s.set(1, 1, 1));
      this.buoys.setMatrixAt(i, this.m);
    });
    this.buoys.instanceMatrix.needsUpdate = true;
    this.boatData.forEach((d, i) => {
      const bob = Math.sin(t * 1.2 + d.ph) * 0.06;
      this.e.set(Math.sin(t * 0.8 + d.ph) * 0.03, d.ry, Math.sin(t * 1.1 + d.ph * 2) * 0.05);
      this.m.compose(this.p.set(d.x, WATER + 0.12 + bob, d.z), this.q.setFromEuler(this.e), this.s.set(d.s, d.s, d.s));
      this.boats.setMatrixAt(i, this.m);
    });
    this.boats.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    for (const m of [this.cones, this.crates, this.buoys, this.boats]) m.geometry.dispose();
  }
}

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------

export interface PropsOut {
  halos: HaloSpec[];
  pools: PoolSpec[];
  marketOpen: Batch;
  marketClosed: Batch;
}

export function buildProps(b: Batch, blobs: BlobBatch): PropsOut {
  const halos: HaloSpec[] = [];
  const pools: PoolSpec[] = [];
  const marketOpen = new Batch(), marketClosed = new Batch();
  let flagI = 0, stallI = 0;
  DISTRICT.props.forEach((p, i) => {
    const seed = hash2(p.x * 0.37, p.z * 0.91);
    const s = p.scale ?? 1;
    const ry = p.rotationY ?? 0;
    switch (p.kind) {
      case 'palm': palm(b, p.x, p.z, s, seed); blobs.add(p.x, p.z, 1.5 * s); treeGrate(b, p.x, p.z, ry + seed); break;
      case 'tree': tree(b, p.x, p.z, s, seed); blobs.add(p.x, p.z, 1.5 * s); break;
      case 'bush': bush(b, p.x, p.z, s, seed); break;
      case 'lamp': lamp(b, halos, blobs, pools, p.x, p.z); break;
      case 'bench': bench(b, p.x, p.z, ry); blobs.add(p.x, p.z, 0.95, 0.45, ry); break;
      case 'bollard': bollard(b, p.x, p.z); break;
      case 'planter': planter(b, p.x, p.z, seed); blobs.add(p.x, p.z, 0.9); break;
      case 'bin': bin(b, p.x, p.z); blobs.add(p.x, p.z, 0.42); break;
      case 'bike-rack': bikeRack(b, p.x, p.z, ry); break;
      case 'flag': flag(b, p.x, p.z, flagI++); break;
      case 'mailbox': mailbox(b, p.x, p.z); break;
      case 'kiosk': kiosk(b, blobs, p.x, p.z, ry, seed); break;
      case 'board': board(b, p.x, p.z, ry); break;
      case 'sign': sign(b, p.x, p.z, ry, seed); break;
      case 'bell': bell(b, p.x, p.z, ry); blobs.add(p.x, p.z, 0.8, 0.4, ry); break;
      case 'fishing-rod': fishingRod(b, p.x, p.z, ry); break;
      case 'umbrella-table': umbrellaTable(b, blobs, p.x, p.z, seed); break;
      case 'stall': stall(marketOpen, marketClosed, p.x, p.z, ry, stallI++); blobs.add(p.x, p.z, 1.6, 1.1, ry); break;
      default: break; // telescope (landmarks.ts), cone/crate/buoy/boat-small (Floaters)
    }
    void i;
  });
  gardens(b);
  marketLights(b, halos);
  streetDetails(b);
  return { halos, pools, marketOpen, marketClosed };
}

/** Cast-iron tree grate around a palm on paving (skipped on lawns and slopes). */
function treeGrate(b: Batch, x: number, z: number, ry: number) {
  const s = surfaceAt(x + 0.8, z);
  if (s !== 'pavement' && s !== 'plaza') return;
  const y = heightAt(x, z);
  const f = new Frame(x, y, z, ry);
  b.add(BOX(), f.at(0, 0.005, 0, 0, 1.25, 0.03, 1.25), '#57534c', [0, y, 0, -1]);
  b.add(BOX(), f.at(0, 0.02, 0, 0, 0.8, 0.03, 0.8), '#6a655c', [0, y, 0, -1]);
}

/** Manhole covers and drain grates along the promenade (flat, merged). */
function streetDetails(b: Batch) {
  for (let st = 24; st < 340; st += 26) {
    const m = at(st, -2.4);
    if (canStand(m.x, m.z, 0.5)) b.add(CYL(12), M(m.x, heightAt(m.x, m.z) + 0.035, m.z, 0, 0.4, 0.02, 0.4), '#6b665e', [0, 0, 0, -1]);
    const g = at(st + 13, -4.55);
    if (canStand(g.x, g.z, 0.3)) { const fr = frameAt(st + 13); b.add(BOX(), M(g.x, heightAt(g.x, g.z) + 0.03, g.z, Math.atan2(fr.tx, fr.tz), 0.35, 0.02, 0.9), '#4f4c47', [0, 0, 0, -1]); }
  }
}

/** Festoon lights strung between the market stalls: warm bulbs that glow (and halo) at night. */
function marketLights(b: Batch, halos: HaloSpec[]) {
  const stalls = DISTRICT.props.filter(p => p.kind === 'stall').map(p => ({ p, st: stationOf(p).st })).sort((a, c) => a.st - c.st).map(x => x.p);
  const H = 3.05;
  for (let i = 1; i < stalls.length; i++) {
    const a = stalls[i - 1], c = stalls[i];
    const L = Math.hypot(c.x - a.x, c.z - a.z);
    if (L > 9) continue;
    const ya = heightAt(a.x, a.z) + H, yc = heightAt(c.x, c.z) + H;
    let prev = new THREE.Vector3(a.x, ya, a.z);
    const n = 6;
    for (let k = 1; k <= n; k++) {
      const u = k / n;
      const q = new THREE.Vector3(a.x + (c.x - a.x) * u, ya + (yc - ya) * u - 0.45 * 4 * u * (1 - u), a.z + (c.z - a.z) * u);
      b.beam(prev, q, 0.02, 0.02, '#3b3f40', [0, 0, 0, -1]);
      if (k < n) {
        b.add(SPHERE(4, 3), M(q.x, q.y - 0.08, q.z, 0, 0.07, 0.09, 0.07), '#ffe3a6', [0, 0, 0, -2]);
        halos.push({ x: q.x, y: q.y - 0.08, z: q.z, size: 0.55, color: new THREE.Color(1.2, 0.85, 0.5) });
      }
      prev = q;
    }
  }
  // the poles at both ends carry the strings
  for (const s of [stalls[0], stalls[stalls.length - 1]]) if (s) b.add(CYL(5), M(s.x, heightAt(s.x, s.z), s.z, 0, 0.05, H + 0.1, 0.05), '#3b3f40', [0, 0, 0, -1]);
}

/** Distance to the nearest road centreline minus its half width (only roads near the hill). */
function roadClearance(x: number, z: number) {
  let best = Infinity;
  for (const road of DISTRICT.roads) {
    const pts = road.points;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], c = pts[i];
      const dx = c.x - a.x, dz = c.z - a.z, L2 = dx * dx + dz * dz || 1;
      const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / L2));
      best = Math.min(best, Math.hypot(x - a.x - dx * t, z - a.z - dz * t) - road.width / 2);
    }
  }
  return best;
}
const freeSpot = (x: number, z: number, r: number) => !canStand(x, z, 0.1) && blockersNear(x, z, r).length === 0 && roadClearance(x, z) > r;

/** Extra planting that makes Telegraph Hill and the Filbert Steps lush (visual only, off the walkways). */
function gardens(b: Batch) {
  const r = rng(4242);
  const steps = DISTRICT.ramps.find(x => x.id === 'filbert-steps');
  if (steps) {
    for (let i = 1; i < steps.points.length; i++) {
      const a = steps.points[i - 1], c = steps.points[i];
      const L = Math.hypot(c.x - a.x, c.z - a.z);
      const nx = -(c.z - a.z) / (L || 1), nz = (c.x - a.x) / (L || 1);
      for (let k = 0; k < L; k += 1.3) {
        for (const side of [-1, 1]) {
          const off = steps.width / 2 + 0.7 + r() * 1.4;
          const x = a.x + ((c.x - a.x) * k) / L + nx * off * side, z = a.z + ((c.z - a.z) * k) / L + nz * off * side;
          if (!freeSpot(x, z, 0.5)) continue;
          bush(b, x, z, 0.55 + r() * 0.4, r() * 10, r() > 0.3);
        }
      }
    }
  }
  // scattered hillside shrubs and trees in the gaps between houses (off paths, streets and buildings)
  let placed = 0;
  for (let i = 0; i < 400 && placed < 90; i++) {
    const a = r() * Math.PI * 2, d = 9 + r() * 34;
    const x = COIT_POS.x - 8 + Math.cos(a) * d, z = COIT_POS.z + 6 + Math.sin(a) * d;
    const h = heightAt(x, z);
    if (h < 2.5 || !freeSpot(x, z, 0.8)) continue;
    placed++;
    if (r() < 0.35) tree(b, x, z, 0.7 + r() * 0.4, r() * 10);
    else bush(b, x, z, 0.6 + r() * 0.5, r() * 10, r() > 0.6);
  }
}
