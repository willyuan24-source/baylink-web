import * as THREE from 'three';
import { Batch, C, CBOX, CONE, CYL, Frame, ICO, SPHERE, mixColor } from '../builder';
import { HALO, POOL, TOY_INST, U } from '../materials';
import { PAL } from '../palette';
import type { PropArrays } from './build';
import { PROP_KINDS } from './format';

/**
 * City street trees and lamps (plan §5.5 props): instanced, nearest-N around the focus, re-selected after 12 u of
 * movement. New instances grow in over ~0.45 s instead of popping (idea: GTA_SZ city-meadow.ts fade-in).
 *
 *   trees      full toy trees (round / tall / small by variant, cypress, pine, palm) — nearest 200 within 70 u
 *   lollipops  a 36-triangle tree for the ring beyond — nearest 600 within 140 u
 *   lamps      the district's lamp post — nearest 48 within 120 u, with night halos and light pools
 * ≈ 27k + 22k + 6k triangles at most (measured 83k with 300 / 900 / 64: the props were the city's largest group).
 *
 * One InstancedMesh per shape on TOY_INST (receiveShadow on, as warmed up), HALO and POOL for the night light.
 */

const K = Object.fromEntries(PROP_KINDS.map((c, i) => [c, i])) as Record<(typeof PROP_KINDS)[number], number>;
const RESELECT = 12;
const GROW = 0.45;
const CAP = { tree: 200, lolli: 600, lamp: 48 } as const;
const R_FULL = 70, R_LOLLI = 140, R_LAMP = 120;

/**
 * Props capped by camera height above the ground (lane C2-5 high-view budget): from 25 u up, full trees and lamps
 * thin out toward the focus (at 80 u: the nearest 50 full trees within 40 u, 350 lollipops, 12 lamps within 60 u:
 * ≈ 20k instead of ≈ 45k triangles). Four steps, so a bobbing camera never re-selects every frame.
 */
export const PROP_HIGH = { h0: 25, h1: 80, steps: 4, tree: 50, lolli: 350, lamp: 12, rFull: 40, rLamp: 60 } as const;
export interface PropCaps { tree: number; lolli: number; lamp: number; rFull: number; rLolli: number; rLamp: number; step: number }
export function propCaps(camH: number): PropCaps {
  const P = PROP_HIGH;
  const t = Number.isFinite(camH) ? Math.min(1, Math.max(0, (camH - P.h0) / (P.h1 - P.h0))) : 0;
  const step = Math.round(t * P.steps), k = step / P.steps;
  const lerp = (a: number, b: number) => Math.round(a + (b - a) * k);
  return { tree: lerp(CAP.tree, P.tree), lolli: lerp(CAP.lolli, P.lolli), lamp: lerp(CAP.lamp, P.lamp), rFull: lerp(R_FULL, P.rFull), rLolli: R_LOLLI, rLamp: lerp(R_LAMP, P.rLamp), step };
}

/** Unit geometry from a Batch (keeps aInfo; TOY_INST reads it). */
function geo(build: (b: Batch) => void): THREE.BufferGeometry {
  const b = new Batch();
  build(b);
  return b.build();
}

function roundTree(b: Batch) {
  const f = new Frame(0, 0, 0);
  b.add(CYL(5, 0.8), f.at(0, 0, 0, 0, 0.16, 1.9, 0.16), '#7a5a3e');
  const blobs: [number, number, number, number][] = [[0, 2.4, 0, 1.15], [0.55, 2.1, 0.3, 0.85], [-0.45, 2.2, -0.35, 0.8]];
  blobs.forEach(([x, y, z, r], k) => b.add(ICO(k === 0 ? 1 : 0), f.at(x, y, z, k, r, r * 0.92, r), mixColor(PAL.tree, PAL.treeDark, k === 0 ? 0.15 : 0.45)));
}
function cypress(b: Batch) {
  b.add(CYL(5), new Frame(0, 0, 0).at(0, 0, 0, 0, 0.14, 1.2, 0.14), '#6b4f36');
  b.add(CONE(7), new Frame(0, 0, 0).at(0, 0.6, 0, 0, 0.9, 4.6, 0.9), PAL.pine);
}
function pine(b: Batch) {
  const f = new Frame(0, 0, 0);
  b.add(CYL(5), f.at(0, 0, 0, 0, 0.14, 1.5, 0.14), '#6b4f36');
  for (let k = 0; k < 3; k++) b.add(CONE(7), f.at(0, 0.9 + k * 1.0, 0, k, 1.25 - k * 0.3, 1.7, 1.25 - k * 0.3), mixColor(PAL.pine, '#3f6340', k * 0.3));
}
function palm(b: Batch) {
  const f = new Frame(0, 0, 0);
  const H = 4.3;
  b.add(CYL(6, 0.78), f.at(0, 0, 0, 0, 0.34, H, 0.34), '#9a7a55');
  b.add(ICO(0), f.at(0, H + 0.05, 0, 0, 0.5, 0.42, 0.5), '#7a6a3c');
  for (let i = 0; i < 8; i++) {
    const yaw = (i / 8) * Math.PI * 2;
    let px = 0, py = H + 0.15, pz = 0, pitch = i % 2 ? 0.7 : 0.35;
    for (let k = 0; k < 2; k++) {
      const seg = 0.95;
      const dx = Math.sin(yaw) * Math.cos(pitch) * seg, dy = Math.sin(pitch) * seg, dz = Math.cos(yaw) * Math.cos(pitch) * seg;
      b.add(CBOX(), f.at(px + dx / 2, py + dy / 2, pz + dz / 2, yaw, 0.5 - k * 0.14, 0.05, seg * 1.04, -pitch), mixColor('#5d8a42', '#86ae57', k * 0.5));
      px += dx; py += dy; pz += dz; pitch -= 0.75;
    }
  }
}
function lollipop(b: Batch) {
  const f = new Frame(0, 0, 0);
  b.add(CYL(4), f.at(0, 0, 0, 0, 0.18, 1.8, 0.18), '#7a5a3e');
  b.add(ICO(0), f.at(0, 2.35, 0, 0, 1.2, 1.1, 1.2), mixColor(PAL.tree, PAL.treeDark, 0.3));
}
function lampPost(b: Batch) {
  const f = new Frame(0, 0, 0);
  const keep = [0, 0, 0, -1] as const;
  b.add(CYL(8), f.at(0, 0, 0, 0, 0.16, 0.35, 0.16), PAL.lampPost, keep);
  b.add(CYL(6), f.at(0, 0.3, 0, 0, 0.06, 3.3, 0.06), PAL.lampPost, keep);
  b.add(CYL(8, 0.7), f.at(0, 3.55, 0, 0, 0.22, 0.5, 0.22), PAL.lampGlass, [0, 0, 0, -2]);
  b.add(CONE(8), f.at(0, 4.02, 0, 0, 0.3, 0.3, 0.3), PAL.lampPost, keep);
  b.add(SPHERE(5, 4), f.at(0, 4.34, 0, 0, 0.06, 0.06, 0.06), '#c9b48c', keep);
}

interface Layer { mesh: THREE.InstancedMesh; ids: number[]; born: Float32Array; scale: Float32Array; cap: number }

/** One prop candidate: index into its chunk's arrays. */
interface Pick { d: number; x: number; y: number; z: number; rot: number; kind: number; variant: number; id: number }

export class CityProps {
  readonly group = new THREE.Group();
  private layers: Record<'round' | 'cypress' | 'pine' | 'palm' | 'lolli' | 'lamp', Layer>;
  private halos: THREE.InstancedMesh;
  private pools: THREE.InstancedMesh;
  private sources = new Map<number, PropArrays>();
  private lastX = Infinity;
  private lastZ = Infinity;
  private dirty = false;
  private growing = false;
  private m4 = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private v = new THREE.Vector3();
  private s = new THREE.Vector3();
  private col = new THREE.Color();
  private up = new THREE.Vector3(0, 1, 0);
  selected = 0;

  constructor() {
    this.group.name = 'city-props';
    const layer = (name: string, g: THREE.BufferGeometry, cap: number): Layer => {
      const mesh = new THREE.InstancedMesh(g, TOY_INST, cap);
      mesh.name = `city-${name}`;
      mesh.count = 0;
      mesh.receiveShadow = true;
      mesh.castShadow = false;
      mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.setColorAt(0, C('#ffffff'));
      this.group.add(mesh);
      return { mesh, ids: [], born: new Float32Array(cap), scale: new Float32Array(cap), cap };
    };
    this.layers = {
      round: layer('trees', geo(roundTree), CAP.tree),
      cypress: layer('cypress', geo(cypress), 160),
      pine: layer('pines', geo(pine), 160),
      palm: layer('palms', geo(palm), 120),
      lolli: layer('lollipops', geo(lollipop), CAP.lolli),
      lamp: layer('lamps', geo(lampPost), CAP.lamp),
    };
    // night light: a warm halo + a hot core per lamp, and a pool on the paving
    const hg = new THREE.PlaneGeometry(1, 1);
    const data = new Float32Array(CAP.lamp * 2 * 3);
    for (let i = 0; i < CAP.lamp * 2; i++) { data[i * 3] = i % 2 ? 0.6 : 3.2; data[i * 3 + 1] = (i * 0.618) % 1; data[i * 3 + 2] = 0; }
    hg.setAttribute('aHalo', new THREE.InstancedBufferAttribute(data, 3));
    this.halos = new THREE.InstancedMesh(hg, HALO, CAP.lamp * 2);
    this.halos.name = 'city-lamp-halos';
    this.halos.count = 0;
    this.halos.frustumCulled = false;
    this.halos.renderOrder = 10;
    for (let i = 0; i < CAP.lamp * 2; i++) this.halos.setColorAt(i, i % 2 ? new THREE.Color(1.5, 1.25, 0.95) : new THREE.Color(1.0, 0.74, 0.42));
    this.pools = new THREE.InstancedMesh(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), POOL, CAP.lamp);
    this.pools.name = 'city-lamp-pools';
    this.pools.count = 0;
    this.pools.frustumCulled = false;
    this.pools.renderOrder = 1;
    this.group.add(this.halos, this.pools);
  }

  /** Props of a resident chunk (key) arrive / leave. */
  setSource(key: number, p: PropArrays | null) {
    if (p) this.sources.set(key, p); else this.sources.delete(key);
    this.dirty = true;
  }

  get sourceCount() { return this.sources.size; }

  private caps: PropCaps = propCaps(0);

  private select(fx: number, fz: number, now: number) {
    const cap = this.caps;
    const trees: Pick[] = [], lamps: Pick[] = [];
    for (const [key, p] of this.sources) {
      for (let i = 0; i < p.count; i++) {
        const x = p.xyzr[i * 4], z = p.xyzr[i * 4 + 2];
        const d = Math.hypot(x - fx, z - fz);
        const k = p.kind[i];
        const pick = { d, x, y: p.xyzr[i * 4 + 1], z, rot: p.xyzr[i * 4 + 3], kind: k, variant: p.variant[i], id: key * 8192 + i };
        if (k === K.lamp) { if (d < cap.rLamp) lamps.push(pick); } else if (d < cap.rLolli) trees.push(pick);
      }
    }
    trees.sort((a, b) => a.d - b.d);
    lamps.sort((a, b) => a.d - b.d);
    const want: Record<keyof typeof this.layers, Pick[]> = { round: [], cypress: [], pine: [], palm: [], lolli: [], lamp: lamps.slice(0, cap.lamp) };
    let full = 0;
    for (const t of trees) {
      if (t.d < cap.rFull && full < cap.tree) {
        const layer = t.kind === K.palm ? 'palm' : t.kind === K.pine ? (t.variant === 0 ? 'cypress' : 'pine') : 'round';
        if (want[layer].length < this.layers[layer].cap) { want[layer].push(t); full++; continue; }
      }
      if (want.lolli.length < cap.lolli) want.lolli.push(t);
    }
    let n = 0;
    for (const name of Object.keys(this.layers) as (keyof typeof this.layers)[]) {
      const L = this.layers[name], list = want[name];
      const prev = new Map<number, number>();
      L.ids.forEach((pid, i) => prev.set(pid, L.born[i]));
      L.ids = list.map(p => p.id);
      list.forEach((p, i) => {
        L.born[i] = prev.get(p.id) ?? now;
        const hue = ((p.id * 2654435761) >>> 0) / 4294967296;
        const s = name === 'round' ? (p.variant === 1 ? 1.25 : p.variant === 2 ? 0.75 : 1) * (0.9 + hue * 0.25) : 0.85 + hue * 0.3;
        L.scale[i] = s;
        if (name !== 'lamp') L.mesh.setColorAt(i, this.col.setRGB(0.92 + hue * 0.16, 0.95 + ((hue * 7) % 1) * 0.1, 0.9 + ((hue * 13) % 1) * 0.12));
        else L.mesh.setColorAt(i, this.col.setRGB(1, 1, 1));
      });
      L.mesh.count = list.length;
      if (L.mesh.instanceColor) L.mesh.instanceColor.needsUpdate = true;
      this.place(name, list, now);
      n += list.length;
    }
    // lamp light
    this.halos.count = want.lamp.length * 2;
    this.pools.count = want.lamp.length;
    want.lamp.forEach((p, i) => {
      this.halos.setMatrixAt(i * 2, this.m4.makeTranslation(p.x, p.y + 3.8, p.z));
      this.halos.setMatrixAt(i * 2 + 1, this.m4.makeTranslation(p.x, p.y + 3.78, p.z));
      this.pools.setMatrixAt(i, this.m4.makeScale(3.4, 1, 3.4).setPosition(p.x, p.y + 0.09, p.z));
    });
    this.halos.instanceMatrix.needsUpdate = true;
    this.pools.instanceMatrix.needsUpdate = true;
    this.picks = want;
    this.selected = n;
  }

  private picks: Record<string, Pick[]> = {};

  /** Write instance matrices (grow-in scale for the young ones). Returns true while something still grows. */
  private place(name: keyof typeof this.layers, list: Pick[], now: number): boolean {
    const L = this.layers[name];
    let growing = false;
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      const age = (now - L.born[i]) / GROW;
      let g = 1;
      if (age < 1) { growing = true; const t = Math.max(0, age); g = 1 - (1 - t) ** 3 * (1 - 1.4 * t); g = Math.max(0.02, Math.min(1.08, g)); }
      const s = L.scale[i] * g;
      this.q.setFromAxisAngle(this.up, p.rot);
      this.m4.compose(this.v.set(p.x, p.y - 0.02, p.z), this.q, this.s.set(s, s, s));
      L.mesh.setMatrixAt(i, this.m4);
    }
    L.mesh.instanceMatrix.needsUpdate = true;
    return growing;
  }

  /** Per frame: re-select after 12 u of focus movement, a new source or a new height step (camH = camera height above the ground). */
  update(fx: number, fz: number, now: number, camH = 0) {
    const caps = propCaps(camH);
    if (caps.step !== this.caps.step) { this.caps = caps; this.dirty = true; }
    if (this.dirty || Math.hypot(fx - this.lastX, fz - this.lastZ) > RESELECT) {
      this.lastX = fx; this.lastZ = fz; this.dirty = false;
      this.select(fx, fz, now);
      this.growing = true;
    } else if (this.growing) {
      let any = false;
      for (const name of Object.keys(this.layers) as (keyof typeof this.layers)[]) if (this.place(name, this.picks[name] ?? [], now)) any = true;
      this.growing = any;
    }
    const night = U.uNight.value > 0.02;
    this.halos.visible = night;
    this.pools.visible = night;
  }

  counts() {
    const out: Record<string, number> = {};
    for (const [k, L] of Object.entries(this.layers)) out[k] = L.mesh.count;
    return out;
  }

  dispose() {
    for (const L of Object.values(this.layers)) { L.mesh.geometry.dispose(); L.mesh.dispose(); }
    this.halos.geometry.dispose(); this.halos.dispose();
    this.pools.geometry.dispose(); this.pools.dispose();
  }
}
