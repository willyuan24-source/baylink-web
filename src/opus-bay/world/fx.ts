import * as THREE from 'three';
import { onEvent } from '../core/events';
import { runtime } from '../core/runtime';
import { game } from '../core/store';
import { registerWarmup } from './warmup';

/**
 * Toy feedback particles: one instanced billboard pool (256 quads, one draw call while anything is alive,
 * none otherwise), a small shape atlas (puff, ring, sparkle, heart, note), premultiplied blending so
 * additive (rings) and alpha-blended (dust, splash, sparkle stars, hearts) particles share the draw. Simulated on the CPU
 * with preallocated typed arrays (no per-frame allocations).
 *
 * `spawnFx` is the public entry (C4); the pool also listens to existing gameplay events by itself:
 * `land` (impact > 0.3) / `bump` → dust at the player, `postcard` / `goal` / `stamp` → sparkle at the player,
 * `sea-lion` → splash at the K-Dock.
 */

export type FxPreset = 'dust' | 'splash' | 'sparkle' | 'rings' | 'hearts' | 'notes';
export interface FxOpts { count?: number; scale?: number; color?: string }

const MAX = 256;
const SHAPE = { dot: 0, ring: 1, star: 2, heart: 3, note: 4, puff: 5 } as const;
const CELLS = 8;

function atlas(): THREE.CanvasTexture {
  const S = 64;
  const c = document.createElement('canvas');
  c.width = S * CELLS; c.height = S;
  const g = c.getContext('2d')!;
  const cell = (i: number, draw: () => void) => { g.save(); g.translate(i * S + S / 2, S / 2); draw(); g.restore(); };
  const radial = (r: number, stops: [number, number][]) => {
    const grad = g.createRadialGradient(0, 0, 0, 0, 0, r);
    for (const [o, a] of stops) grad.addColorStop(o, `rgba(255,255,255,${a})`);
    g.fillStyle = grad;
    g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill();
  };
  cell(SHAPE.dot, () => radial(30, [[0, 1], [0.5, 0.85], [1, 0]]));
  cell(SHAPE.ring, () => { g.strokeStyle = '#fff'; g.lineWidth = 5; g.shadowColor = '#fff'; g.shadowBlur = 6; g.beginPath(); g.arc(0, 0, 25, 0, Math.PI * 2); g.stroke(); });
  cell(SHAPE.star, () => {
    radial(12, [[0, 1], [1, 0]]);
    g.fillStyle = '#fff';
    g.beginPath();
    for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2, r = k % 2 ? 6 : 29; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    g.closePath(); g.fill();
  });
  cell(SHAPE.heart, () => {
    g.fillStyle = '#fff';
    g.beginPath();
    g.moveTo(0, 22);
    g.bezierCurveTo(-30, 2, -22, -24, 0, -9);
    g.bezierCurveTo(22, -24, 30, 2, 0, 22);
    g.fill();
  });
  cell(SHAPE.note, () => {
    g.fillStyle = '#fff';
    g.beginPath(); g.ellipse(-7, 16, 11, 8, -0.4, 0, Math.PI * 2); g.fill();
    g.fillRect(2, -24, 5, 40);
    g.beginPath(); g.moveTo(7, -24); g.quadraticCurveTo(24, -14, 18, 2); g.quadraticCurveTo(18, -10, 7, -12); g.fill();
  });
  cell(SHAPE.puff, () => { radial(30, [[0, 0.9], [0.6, 0.55], [1, 0]]); radial(14, [[0, 0.5], [1, 0]]); });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

const VERT = /* glsl */ `
attribute vec3 aPos;
attribute vec4 aFx;   // size, alpha, code (shape + 8·additive + 16·flat), rotation
attribute vec3 aCol;
varying vec2 vUv;
varying vec3 vCol;
varying float vA;
varying float vAdd;
void main() {
  float code = aFx.z;
  float flatK = step(15.5, code); code -= flatK * 16.0;
  float add = step(7.5, code); code -= add * 8.0;
  vUv = vec2((uv.x + floor(code + 0.5)) / ${CELLS.toFixed(1)}, uv.y);
  float c = cos(aFx.w), s = sin(aFx.w);
  vec2 p = vec2(c * position.x - s * position.y, s * position.x + c * position.y) * aFx.x;
  vec4 mv;
  if (flatK > 0.5) mv = viewMatrix * vec4(aPos + vec3(p.x, 0.0, p.y), 1.0);
  else { mv = viewMatrix * vec4(aPos, 1.0); mv.xy += p; }
  vCol = aCol;
  vA = aFx.y;
  vAdd = add;
  gl_Position = projectionMatrix * mv;
}`;
const FRAG = /* glsl */ `
uniform sampler2D uAtlas;
varying vec2 vUv;
varying vec3 vCol;
varying float vA;
varying float vAdd;
void main() {
  float a = texture2D(uAtlas, vUv).a * vA;
  if (a < 0.004) discard;
  // premultiplied: additive particles write no alpha (pure add), the others blend over
  gl_FragColor = vec4(vCol * a, vAdd > 0.5 ? 0.0 : a);
  #include <colorspace_fragment>
}`;

const _c = new THREE.Color();

export class FxPool {
  readonly mesh: THREE.InstancedMesh;
  private material: THREE.ShaderMaterial;
  // simulation state (struct of arrays)
  private px = new Float32Array(MAX); private py = new Float32Array(MAX); private pz = new Float32Array(MAX);
  private vx = new Float32Array(MAX); private vy = new Float32Array(MAX); private vz = new Float32Array(MAX);
  private age = new Float32Array(MAX); private life = new Float32Array(MAX);
  private s0 = new Float32Array(MAX); private s1 = new Float32Array(MAX);
  private a0 = new Float32Array(MAX);
  private grav = new Float32Array(MAX); private drag = new Float32Array(MAX);
  private rot = new Float32Array(MAX); private spin = new Float32Array(MAX);
  private code = new Float32Array(MAX);
  private cr = new Float32Array(MAX); private cg = new Float32Array(MAX); private cb = new Float32Array(MAX);
  private alive = 0;
  private aPos: THREE.InstancedBufferAttribute;
  private aFx: THREE.InstancedBufferAttribute;
  private aCol: THREE.InstancedBufferAttribute;
  private off: () => void;
  private kdock: { x: number; y: number; z: number }[];

  constructor(kdock: { x: number; y: number; z: number }[] = []) {
    this.kdock = kdock;
    const geo = new THREE.PlaneGeometry(1, 1);
    this.aPos = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 3), 3);
    this.aFx = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 4), 4);
    this.aCol = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 3), 3);
    for (const a of [this.aPos, this.aFx, this.aCol]) a.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aPos', this.aPos);
    geo.setAttribute('aFx', this.aFx);
    geo.setAttribute('aCol', this.aCol);
    this.material = new THREE.ShaderMaterial({
      name: 'ob-fx',
      uniforms: { uAtlas: { value: atlas() } },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
    });
    this.mesh = new THREE.InstancedMesh(geo, this.material, MAX);
    this.mesh.name = 'fx';
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    this.mesh.renderOrder = 12;
    // the first dust puff (usually the first walk) must not link its program on the spot (wave 3, P5)
    registerWarmup('c2-fx', () => {
      const m = new THREE.InstancedMesh(this.mesh.geometry, this.material, 1);
      m.frustumCulled = false;
      m.renderOrder = 12;
      return { objects: [m], dispose: () => m.dispose() };
    });
    this.off = onEvent(e => {
      const p = runtime.player;
      if (e.type === 'land' && e.impact > 0.3) this.spawn('dust', p.x, p.y, p.z, { count: e.impact > 0.7 ? 8 : 6 });
      else if (e.type === 'bump') this.spawn('dust', p.x, p.y, p.z, { count: 4, scale: 0.8 });
      else if (e.type === 'postcard' || e.type === 'goal' || e.type === 'stamp') this.spawn('sparkle', p.x, p.y + 1.1, p.z);
      else if (e.type === 'sea-lion' && this.kdock.length && e.intensity > 0.35) {
        const k = this.kdock[Math.floor(Math.random() * this.kdock.length)];
        this.spawn('splash', k.x + (Math.random() - 0.5) * 2, k.y - 0.2, k.z + (Math.random() - 0.5) * 2, { scale: 0.8 });
      }
    });
  }

  private add(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, s0: number, s1: number, a0: number, shape: number, additive: boolean, flat: boolean, color: THREE.Color, grav = 0, drag = 0, delay = 0, spin = 0) {
    if (this.alive >= MAX) return;
    const i = this.alive++;
    this.px[i] = x; this.py[i] = y; this.pz[i] = z;
    this.vx[i] = vx; this.vy[i] = vy; this.vz[i] = vz;
    this.age[i] = -delay; this.life[i] = life;
    this.s0[i] = s0; this.s1[i] = s1; this.a0[i] = a0;
    this.grav[i] = grav; this.drag[i] = drag;
    this.rot[i] = Math.random() * Math.PI * 2; this.spin[i] = spin;
    this.code[i] = shape + (additive ? 8 : 0) + (flat ? 16 : 0);
    this.cr[i] = color.r; this.cg[i] = color.g; this.cb[i] = color.b;
  }

  spawn(preset: FxPreset, x: number, y: number, z: number, opts: FxOpts = {}) {
    const reduced = game.get().settings.reducedMotion;
    const k = opts.scale ?? 1;
    const n = (base: number) => Math.max(1, Math.round((opts.count ?? base) * (reduced ? 0.5 : 1)));
    const R = Math.random;
    const night = game.get().timeOfDay === 'night';
    switch (preset) {
      case 'dust': {
        _c.set(opts.color ?? (night ? '#8a8494' : '#f2e8d8'));
        for (let j = 0, m = n(6); j < m; j++) {
          const a = (j / m) * Math.PI * 2 + R() * 0.6, sp = (1.2 + R() * 0.9) * k;
          this.add(x + Math.cos(a) * 0.25, y + 0.15, z + Math.sin(a) * 0.25, Math.cos(a) * sp, 0.45 + R() * 0.35, Math.sin(a) * sp, 0.38 + R() * 0.14, 0.34 * k, 0.85 * k, 0.8, SHAPE.puff, false, false, _c, -0.5, 5);
        }
        break;
      }
      case 'splash': {
        _c.set(opts.color ?? '#eef7f6');
        this.add(x, y + 0.03, z, 0, 0, 0, 0.75, 0.4 * k, 2.6 * k, 0.8, SHAPE.ring, false, true, _c);
        for (let j = 0, m = n(8); j < m; j++) {
          const a = (j / m) * Math.PI * 2 + R() * 0.5, sp = (0.9 + R() * 0.9) * k;
          this.add(x, y + 0.1, z, Math.cos(a) * sp, (3 + R() * 1.6) * Math.sqrt(k), Math.sin(a) * sp, 0.6 + R() * 0.15, 0.2 * k, 0.12 * k, 0.9, SHAPE.dot, false, false, _c, 12, 0.5);
        }
        break;
      }
      case 'sparkle': {
        _c.set(opts.color ?? '#e0a94a').multiplyScalar(1.5);
        for (let j = 0, m = n(12); j < m; j++) {
          const a = R() * Math.PI * 2, e = (R() - 0.3) * 1.2, sp = (1.6 + R() * 1.8) * k;
          this.add(x, y + 0.3, z, Math.cos(a) * Math.cos(e) * sp, Math.sin(e) * sp + 0.8, Math.sin(a) * Math.cos(e) * sp, 0.8 + R() * 0.35, 0.6 * k, 0.1 * k, 1.0, SHAPE.star, false, false, _c, -0.6, 2.6, 0, (R() - 0.5) * 6);
        }
        break;
      }
      case 'rings': {
        _c.set(opts.color ?? '#ffe7b8');
        for (let j = 0, m = n(3); j < m; j++) this.add(x, y, z, 0, 0, 0, 1.2, 0.6 * k, 7 * k, 0.75, SHAPE.ring, true, false, _c, 0, 0, j * 0.22);
        break;
      }
      case 'hearts': {
        _c.set(opts.color ?? '#e8665a');
        for (let j = 0, m = n(5); j < m; j++) {
          const a = R() * Math.PI * 2;
          this.add(x + Math.cos(a) * 0.3, y, z + Math.sin(a) * 0.3, Math.cos(a) * 0.35, 1.3 + R() * 0.6, Math.sin(a) * 0.35, 0.8 + R() * 0.2, 0.34 * k, 0.28 * k, 1, SHAPE.heart, false, false, _c, 0, 1.2, j * 0.08);
        }
        break;
      }
      case 'notes': {
        _c.set(opts.color ?? '#2f8f88');
        for (let j = 0, m = n(4); j < m; j++) {
          const a = R() * Math.PI * 2;
          this.add(x + Math.cos(a) * 0.4, y, z + Math.sin(a) * 0.4, Math.cos(a) * 0.5, 1.1 + R() * 0.5, Math.sin(a) * 0.5, 1.2, 0.42 * k, 0.36 * k, 1, SHAPE.note, false, false, _c, 0, 1.0, j * 0.18, (R() - 0.5) * 1.2);
        }
        break;
      }
    }
  }

  update(dt: number) {
    if (!this.alive) { if (this.mesh.visible) { this.mesh.visible = false; this.mesh.count = 0; } return; }
    const pos = this.aPos.array as Float32Array, fx = this.aFx.array as Float32Array, col = this.aCol.array as Float32Array;
    let w = 0;
    for (let i = 0; i < this.alive; i++) {
      this.age[i] += dt;
      if (this.age[i] >= this.life[i]) continue;
      // compact live particles to the front (swap-free: copy i → w)
      if (w !== i) {
        this.px[w] = this.px[i]; this.py[w] = this.py[i]; this.pz[w] = this.pz[i];
        this.vx[w] = this.vx[i]; this.vy[w] = this.vy[i]; this.vz[w] = this.vz[i];
        this.age[w] = this.age[i]; this.life[w] = this.life[i];
        this.s0[w] = this.s0[i]; this.s1[w] = this.s1[i]; this.a0[w] = this.a0[i];
        this.grav[w] = this.grav[i]; this.drag[w] = this.drag[i];
        this.rot[w] = this.rot[i]; this.spin[w] = this.spin[i]; this.code[w] = this.code[i];
        this.cr[w] = this.cr[i]; this.cg[w] = this.cg[i]; this.cb[w] = this.cb[i];
      }
      const t = this.age[w];
      if (t >= 0) {
        const fr = Math.exp(-this.drag[w] * dt);
        this.vx[w] *= fr; this.vz[w] *= fr;
        this.vy[w] = this.vy[w] * fr - this.grav[w] * dt;
        this.px[w] += this.vx[w] * dt; this.py[w] += this.vy[w] * dt; this.pz[w] += this.vz[w] * dt;
        this.rot[w] += this.spin[w] * dt;
      }
      const k = Math.max(0, t) / this.life[w];
      const size = t < 0 ? 0 : this.s0[w] + (this.s1[w] - this.s0[w]) * (1 - (1 - k) * (1 - k));
      const alpha = t < 0 ? 0 : this.a0[w] * Math.min(1, k * 8) * (1 - k * k);
      pos[w * 3] = this.px[w]; pos[w * 3 + 1] = this.py[w]; pos[w * 3 + 2] = this.pz[w];
      fx[w * 4] = size; fx[w * 4 + 1] = alpha; fx[w * 4 + 2] = this.code[w]; fx[w * 4 + 3] = this.rot[w];
      col[w * 3] = this.cr[w]; col[w * 3 + 1] = this.cg[w]; col[w * 3 + 2] = this.cb[w];
      w++;
    }
    this.alive = w;
    this.mesh.count = w;
    this.mesh.visible = w > 0;
    for (const a of [this.aPos, this.aFx, this.aCol]) {
      a.clearUpdateRanges();
      a.addUpdateRange(0, w * a.itemSize);
      a.needsUpdate = true;
    }
  }

  /** live particle count (QA) */
  get count() { return this.alive; }

  dispose() {
    this.off();
    this.mesh.geometry.dispose();
    (this.material.uniforms.uAtlas.value as THREE.Texture).dispose();
    this.material.dispose();
  }
}

let POOL: FxPool | null = null;

/** Register the world's pool (world.ts). */
export function attachFx(pool: FxPool | null) { POOL = pool; }

/** Spawn a positioned particle burst (C4). No-op before the world mounts. */
export function spawnFx(preset: FxPreset, x: number, y: number, z: number, opts?: FxOpts): void {
  POOL?.spawn(preset, x, y, z, opts);
}
