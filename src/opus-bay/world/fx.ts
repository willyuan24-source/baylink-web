import * as THREE from 'three';
import { onEvent } from '../core/events';
import { runtime } from '../core/runtime';
import { game } from '../core/store';
import { registerWarmup } from './warmup';

/**
 * Toy feedback particles: one instanced billboard pool (256 quads, one draw call while anything is alive,
 * none otherwise), a shape atlas, premultiplied blending so additive (rings, flares) and alpha-blended (dust, splash,
 * sparkle stars, hearts) particles share the draw. Simulated on the CPU with preallocated typed arrays (no per-frame
 * allocations).
 *
 * Wave 7 (lane V, W7-V2): the shapes are hand-painted gouache sprites (public/opus-bay/w7v/fx-atlas.webp, 44 KB, drawn
 * with Higgsfield, ledger/w7-V.md batch 1; built by scripts/opus-sf/assets/w7v/fx_atlas.py): a 4 × 4 grid of 128 px
 * cells, alpha = coverage, R = the paint's own shading (the brush strokes survive the tint). Until the file is in (or
 * where it cannot load) a canvas atlas with the same layout draws plain shapes. New presets — `coin`, `confetti`,
 * `wake`, `wisp`, `leaves` — and richer old ones (a flash under every sparkle, twinkling glints, foam rings and water
 * drops in a splash, painted puffs of dust), all in the same pool and draw.
 *
 * `spawnFx` is the public entry (C4); the pool also listens to existing gameplay events by itself:
 * `land` (impact > 0.3) / `bump` → dust at the player, `footstep` on sand or dirt → a small puff at the feet,
 * `postcard` / `goal` / `stamp` → sparkle at the player (+ confetti for a postcard), `coins` (paid, not a pickup of a
 * coin that sparkles by itself) → a coin pop, `play` end ★ → confetti / ◆ → a bigger sparkle, a first `arrival` at a
 * top place → confetti, `glide:land` → a dust ring, `sea-lion` → splash at the K-Dock. City mode only: soft fog wisps
 * drift through the Golden Gate Bridge while the player is near it (a few at a time, never at quality low).
 */

export type FxPreset = 'dust' | 'splash' | 'sparkle' | 'rings' | 'hearts' | 'notes' | 'coin' | 'confetti' | 'wake' | 'wisp' | 'leaves';
export interface FxOpts { count?: number; scale?: number; color?: string }

const MAX = 256;
/** the atlas cells (column k % 4, row k / 4 from the top) — the order of fx_atlas.py */
export const FX_SHAPE = { dot: 0, ring: 1, star: 2, heart: 3, note: 4, puff: 5, drop: 6, confetti: 7, flare: 8, leaf: 9, foam: 10, cloud: 11, wisp: 12 } as const;
const SHAPE = FX_SHAPE;
const GRID = 4;
/** code = shape + ADD (additive) + FLAT (lies on the ground plane) */
const ADD = 16, FLAT = 32;
/** the painted atlas (ledger/w7-V.md batch 1) */
export const FX_ATLAS_URL = '/opus-bay/w7v/fx-atlas.webp';

/** The fallback atlas: the same 4 × 4 layout drawn on a canvas (plain shapes), used until the painted one loads. */
function canvasAtlas(): THREE.CanvasTexture {
  const S = 128;
  const c = document.createElement('canvas');
  c.width = S * GRID; c.height = S * GRID;
  const g = c.getContext('2d')!;
  const cell = (i: number, draw: () => void) => { g.save(); g.translate((i % GRID) * S + S / 2, Math.floor(i / GRID) * S + S / 2); g.scale(2, 2); draw(); g.restore(); };
  const radial = (r: number, stops: [number, number][]) => {
    const grad = g.createRadialGradient(0, 0, 0, 0, 0, r);
    for (const [o, a] of stops) grad.addColorStop(o, `rgba(255,255,255,${a})`);
    g.fillStyle = grad;
    g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill();
  };
  const star = () => {
    radial(12, [[0, 1], [1, 0]]);
    g.fillStyle = '#fff';
    g.beginPath();
    for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2, r = k % 2 ? 6 : 29; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    g.closePath(); g.fill();
  };
  const ring = () => { g.strokeStyle = '#fff'; g.lineWidth = 5; g.shadowColor = '#fff'; g.shadowBlur = 6; g.beginPath(); g.arc(0, 0, 25, 0, Math.PI * 2); g.stroke(); };
  const puff = () => { radial(30, [[0, 0.9], [0.6, 0.55], [1, 0]]); radial(14, [[0, 0.5], [1, 0]]); };
  cell(SHAPE.dot, () => radial(30, [[0, 1], [0.5, 0.85], [1, 0]]));
  cell(SHAPE.ring, ring);
  cell(SHAPE.star, star);
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
  cell(SHAPE.puff, puff);
  cell(SHAPE.drop, () => radial(18, [[0, 1], [0.7, 0.9], [1, 0]]));
  cell(SHAPE.confetti, () => { g.fillStyle = '#fff'; g.fillRect(-10, -5, 20, 10); });
  cell(SHAPE.flare, () => radial(30, [[0, 1], [0.25, 0.8], [1, 0]]));
  cell(SHAPE.leaf, () => { g.fillStyle = '#fff'; g.beginPath(); g.ellipse(0, 0, 16, 24, 0.5, 0, Math.PI * 2); g.fill(); });
  cell(SHAPE.foam, ring);
  cell(SHAPE.cloud, puff);
  cell(SHAPE.wisp, () => { g.scale(1, 0.42); puff(); });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

const VERT = /* glsl */ `
attribute vec3 aPos;
attribute vec4 aFx;   // size, alpha, code (shape + 16·additive + 32·flat), rotation
attribute vec3 aCol;
varying vec2 vUv;
varying vec3 vCol;
varying float vA;
varying float vAdd;
void main() {
  float code = aFx.z;
  float flatK = step(31.5, code); code -= flatK * 32.0;
  float add = step(15.5, code); code -= add * 16.0;
  float shape = floor(code + 0.5);
  float col = mod(shape, ${GRID.toFixed(1)}), row = floor(shape / ${GRID.toFixed(1)});
  vUv = vec2((uv.x + col) / ${GRID.toFixed(1)}, (uv.y + ${(GRID - 1).toFixed(1)} - row) / ${GRID.toFixed(1)});
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
  vec4 t = texture2D(uAtlas, vUv);
  float a = t.a * vA;
  if (a < 0.004) discard;
  // the paint's shading (R) keeps the brush strokes under the particle's colour
  gl_FragColor = vec4(vCol * (0.62 + 0.5 * t.r), 1.0);
  // (W7-V2) the output colour space first, then premultiply: converting an already premultiplied colour to sRGB (the
  // canvas pass at quality mid / low) brightened every faint texel into a hard white blob
  #include <colorspace_fragment>
  // premultiplied: additive particles write no alpha (pure add), the others blend over
  gl_FragColor = vec4(gl_FragColor.rgb * a, vAdd > 0.5 ? 0.0 : a);
}`;

const _c = new THREE.Color();
const _c2 = new THREE.Color();
const WHITE = new THREE.Color('#ffffff');
/** the confetti colours (the game's palette: terracotta, teal, gold, cream, rose, sky) */
const CONFETTI = ['#e0704f', '#2f9e93', '#f0c14b', '#fff4dc', '#e98fa6', '#6fb3dd'];
const LEAVES = ['#8fb35a', '#b9c46a', '#d9a441', '#c9713f'];

/**
 * The Golden Gate Bridge (world/sf/landmarks/golden-gate-bridge.ts): mid-span, the unit direction south → north tower,
 * half the main span, deck and tower-top heights.
 */
export const GGB = { x: -865.81, z: 508.555, ax: -0.7806, az: -0.6251, half: 89.29, deck: 15.2, top: 42.2 } as const;
/** fog wisps: how near (u) the player must be, how many at most, how often one starts (s) */
export const WISP = { near: 420, max: 16, every: 0.9 } as const;
/** a coin that sparkles by itself where it is picked up (economy/coins.ts): no second pop at the player */
const SELF_SPARKLING = /^(trail|cache|ring):/;
/**
 * (W8-X3) One burst per moment: a reward that already bursts at the player (a sparkle or confetti within POP_NEAR u of
 * them: a postcard, a stamp, an egg, a crest, the hunt…) and pays coins in the same moment showed two bursts. A coin pop
 * now starts POP_DELAY s late and is dropped when such a burst comes within that beat, and no pop starts within
 * POP_MERGE s after one. Paid coins alone still pop.
 */
export const POP_MERGE = 0.6;
export const POP_DELAY = 0.2;
export const POP_NEAR = 4;

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
  /** twinkle frequency (rad/s, 0 = steady) and the fade-in share of the life */
  private tw = new Float32Array(MAX); private fin = new Float32Array(MAX);
  /** 1 = an ambient wisp (counted, faded near the player) */
  private amb = new Uint8Array(MAX);
  private cr = new Float32Array(MAX); private cg = new Float32Array(MAX); private cb = new Float32Array(MAX);
  /** (W8-X3) the coin pop a particle belongs to (0 = none) */
  private tag = new Float32Array(MAX);
  /** (W8-X3) the pool's clock, the last burst at the player, the pending coin pop (id, until) */
  private clock = 0;
  private lastBurst = -99;
  private popId = 0;
  private popUntil = -99;
  private alive = 0;
  private wisps = 0;
  private wispIn = 0;
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
      uniforms: { uAtlas: { value: canvasAtlas() } },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
    });
    this.loadAtlas();
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
      else if (e.type === 'footstep' && (e.surface === 'sand' || e.surface === 'dirt')) {
        this.spawn('dust', p.x, p.y - 0.05, p.z, { count: e.run ? 3 : 2, scale: e.run ? 0.55 : 0.42, color: e.surface === 'sand' ? '#efdcb4' : '#c4a47c' });
      } else if (e.type === 'postcard' || e.type === 'goal' || e.type === 'stamp') {
        this.spawn('sparkle', p.x, p.y + 1.1, p.z);
        if (e.type === 'postcard') this.spawn('confetti', p.x, p.y + 1.4, p.z, { count: 18 });
      } else if (e.type === 'coins' && e.delta > 0 && !SELF_SPARKLING.test(e.source)) this.coinPop(Math.min(10, 4 + Math.round(e.delta / 5)));
      else if (e.type === 'play' && e.what === 'end' && e.tier === 3) this.spawn('confetti', p.x, p.y + 1.4, p.z);
      else if (e.type === 'play' && e.what === 'end' && e.tier === 2) this.spawn('sparkle', p.x, p.y + 1.2, p.z, { count: 16 });
      else if (e.type === 'arrival' && e.first && e.tier === 1) this.spawn('confetti', p.x, p.y + 1.4, p.z, { count: 14, scale: 0.9 });
      else if (e.type === 'glide:land') {
        this.spawn('rings', e.x, p.y + 0.05, e.z, { scale: 0.45, color: '#f2e8d8', count: 2 });
        this.spawn('dust', e.x, p.y, e.z, { count: 8, scale: 1.1 });
      } else if (e.type === 'sea-lion' && this.kdock.length && e.intensity > 0.35) {
        const k = this.kdock[Math.floor(Math.random() * this.kdock.length)];
        this.spawn('splash', k.x + (Math.random() - 0.5) * 2, k.y - 0.2, k.z + (Math.random() - 0.5) * 2, { scale: 0.8 });
      }
    });
  }

  /** Swap in the painted atlas once it is in (browsers only; the canvas atlas stays on a failure). */
  private loadAtlas() {
    if (typeof window === 'undefined' || typeof Image === 'undefined') return;
    try {
      new THREE.TextureLoader().load(FX_ATLAS_URL, tex => {
        tex.colorSpace = THREE.NoColorSpace;
        tex.anisotropy = 2;
        const u = this.material.uniforms.uAtlas;
        (u.value as THREE.Texture).dispose();
        u.value = tex;
      }, undefined, () => { /* keep the canvas atlas */ });
    } catch { /* keep the canvas atlas */ }
  }

  private add(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, s0: number, s1: number, a0: number, shape: number, additive: boolean, flat: boolean, color: THREE.Color, grav = 0, drag = 0, delay = 0, spin = 0, tw = 0, fin = 0.125, rot = Math.random() * Math.PI * 2): number {
    if (this.alive >= MAX) return -1;
    const i = this.alive++;
    this.px[i] = x; this.py[i] = y; this.pz[i] = z;
    this.vx[i] = vx; this.vy[i] = vy; this.vz[i] = vz;
    this.age[i] = -delay; this.life[i] = life;
    this.s0[i] = s0; this.s1[i] = s1; this.a0[i] = a0;
    this.grav[i] = grav; this.drag[i] = drag;
    this.rot[i] = rot; this.spin[i] = spin;
    this.tw[i] = tw; this.fin[i] = fin; this.amb[i] = 0; this.tag[i] = 0;
    this.code[i] = shape + (additive ? ADD : 0) + (flat ? FLAT : 0);
    this.cr[i] = color.r; this.cg[i] = color.g; this.cb[i] = color.b;
    return i;
  }

  /** (W8-X3) paid coins: a pop at the player's head, a beat late, unless the moment already has its burst */
  private coinPop(count: number) {
    if (this.clock - this.lastBurst < POP_MERGE) return;
    const p = runtime.player, from = this.alive;
    this.spawn('coin', p.x, p.y + 1.7, p.z, { count });
    this.popId++;
    for (let i = from; i < this.alive; i++) { this.age[i] -= POP_DELAY; this.tag[i] = this.popId; }
    this.popUntil = this.clock + POP_DELAY;
  }

  spawn(preset: FxPreset, x: number, y: number, z: number, opts: FxOpts = {}) {
    if ((preset === 'sparkle' || preset === 'confetti') && Math.hypot(x - runtime.player.x, z - runtime.player.z) < POP_NEAR) {
      // (W8-X3) a burst at the player: a coin pop still waiting for its beat goes (it dies at the next update)
      this.lastBurst = this.clock;
      if (this.clock <= this.popUntil) for (let i = 0; i < this.alive; i++) if (this.tag[i] === this.popId) this.life[i] = -1;
      this.popUntil = -99;
    }
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
          this.add(x + Math.cos(a) * 0.25, y + 0.15, z + Math.sin(a) * 0.25, Math.cos(a) * sp, 0.45 + R() * 0.35, Math.sin(a) * sp, 0.42 + R() * 0.16, 0.36 * k, 0.95 * k, 0.78, SHAPE.puff, false, false, _c, -0.5, 5, 0, (R() - 0.5) * 1.6);
        }
        break;
      }
      case 'splash': {
        _c.set(opts.color ?? '#eef7f6');
        // a foam ring on the water, a second one a beat later, a puff of spray and the drops
        this.add(x, y + 0.03, z, 0, 0, 0, 0.9, 0.5 * k, 2.8 * k, 0.85, SHAPE.foam, false, true, _c);
        this.add(x, y + 0.04, z, 0, 0, 0, 0.8, 0.3 * k, 1.7 * k, 0.6, SHAPE.foam, false, true, _c, 0, 0, 0.18);
        this.add(x, y + 0.3 * k, z, 0, 0.8, 0, 0.55, 0.6 * k, 1.6 * k, 0.35, SHAPE.cloud, false, false, _c, 0, 1.5);
        for (let j = 0, m = n(9); j < m; j++) {
          const a = (j / m) * Math.PI * 2 + R() * 0.5, sp = (0.9 + R() * 0.9) * k;
          this.add(x, y + 0.1, z, Math.cos(a) * sp, (3 + R() * 1.6) * Math.sqrt(k), Math.sin(a) * sp, 0.6 + R() * 0.15, 0.24 * k, 0.16 * k, 0.95, SHAPE.drop, false, false, _c, 12, 0.5, 0, 0, 0, 0.1, (R() - 0.5) * 0.5);
        }
        break;
      }
      case 'sparkle': {
        _c.set(opts.color ?? '#e0a94a').multiplyScalar(1.5);
        // a soft flash where it starts, twinkling glints flying out, a few specks drifting up
        _c2.copy(_c).lerp(WHITE, 0.4);
        this.add(x, y + 0.3, z, 0, 0.2, 0, 0.32, 0.3 * k, 1.9 * k, 0.9, SHAPE.flare, true, false, _c2);
        for (let j = 0, m = n(12); j < m; j++) {
          const a = R() * Math.PI * 2, e = (R() - 0.3) * 1.2, sp = (1.6 + R() * 1.8) * k;
          this.add(x, y + 0.3, z, Math.cos(a) * Math.cos(e) * sp, Math.sin(e) * sp + 0.8, Math.sin(a) * Math.cos(e) * sp, 0.85 + R() * 0.4, 0.62 * k, 0.12 * k, 1.0, SHAPE.star, false, false, _c, -0.6, 2.6, 0, (R() - 0.5) * 6, 16 + R() * 10);
        }
        for (let j = 0, m = n(5); j < m; j++) {
          const a = R() * Math.PI * 2;
          this.add(x + Math.cos(a) * 0.4, y + 0.1 + R() * 0.5, z + Math.sin(a) * 0.4, Math.cos(a) * 0.2, 0.7 + R() * 0.5, Math.sin(a) * 0.2, 1.1 + R() * 0.4, 0.14 * k, 0.05 * k, 0.9, SHAPE.dot, true, false, _c2, 0, 0.8, 0.1 + R() * 0.2, 0, 12 + R() * 8);
        }
        break;
      }
      case 'coin': {
        // a coin pop: a gold flash, a ring and a little fountain of glints that fall back
        _c.set(opts.color ?? '#ffd66b').multiplyScalar(1.4);
        _c2.copy(_c).lerp(WHITE, 0.5);
        this.add(x, y, z, 0, 0.3, 0, 0.28, 0.2 * k, 1.3 * k, 0.9, SHAPE.flare, true, false, _c2);
        this.add(x, y, z, 0, 0, 0, 0.5, 0.3 * k, 1.6 * k, 0.55, SHAPE.ring, true, false, _c);
        for (let j = 0, m = n(7); j < m; j++) {
          const a = (j / m) * Math.PI * 2 + R() * 0.4, sp = (0.8 + R() * 0.7) * k;
          this.add(x, y, z, Math.cos(a) * sp, 2.6 + R() * 1.2, Math.sin(a) * sp, 0.75 + R() * 0.2, 0.34 * k, 0.16 * k, 1, SHAPE.star, false, false, _c, 6.5, 0.6, 0, (R() - 0.5) * 8, 18 + R() * 8);
        }
        break;
      }
      case 'confetti': {
        // paper curls in the game's colours bursting up and fluttering down, with a flash
        _c2.set('#fff1c9');
        this.add(x, y, z, 0, 0.3, 0, 0.3, 0.3 * k, 1.8 * k, 0.8, SHAPE.flare, true, false, _c2);
        for (let j = 0, m = n(22); j < m; j++) {
          const a = R() * Math.PI * 2, sp = (0.8 + R() * 1.6) * k;
          _c.set(opts.color ?? CONFETTI[j % CONFETTI.length]);
          this.add(x, y, z, Math.cos(a) * sp, (3.2 + R() * 2.2) * Math.sqrt(k), Math.sin(a) * sp, 1.5 + R() * 0.6, 0.3 * k, 0.26 * k, 1, SHAPE.confetti, false, false, _c, 4.2, 1.8, R() * 0.06, (R() - 0.5) * 9, 9 + R() * 6, 0.05);
        }
        break;
      }
      case 'wake': {
        // flat foam behind a boat: foam puffs spreading on the water (y = the water); (W8-X5) denser and a little longer
        // so the trail reads on the bright day water (it was faint: W7-V's note), softer at night
        _c.set(opts.color ?? (night ? '#9fb0b8' : '#f4fbf9'));
        for (let j = 0, m = n(2); j < m; j++) {
          this.add(x + (R() - 0.5) * 0.8 * k, y + 0.04, z + (R() - 0.5) * 0.8 * k, 0, 0, 0, 3.0 + R() * 0.9, 0.9 * k, 3.6 * k, night ? 0.55 : 0.75, j ? SHAPE.foam : SHAPE.cloud, false, true, _c, 0, 0, 0, (R() - 0.5) * 0.3, 0, 0.1);
        }
        break;
      }
      case 'wisp': {
        _c.set(opts.color ?? (night ? '#8f99aa' : '#f6f3ec'));
        this.add(x, y, z, 0, 0, 0, 12, 7 * k, 11 * k, 0.3, SHAPE.wisp, false, false, _c, 0, 0, 0, (R() - 0.5) * 0.02, 0, 0.35, (R() - 0.5) * 0.25);
        break;
      }
      case 'leaves': {
        for (let j = 0, m = n(8); j < m; j++) {
          const a = R() * Math.PI * 2, sp = (0.6 + R() * 1.0) * k;
          _c.set(opts.color ?? LEAVES[j % LEAVES.length]);
          this.add(x, y + 0.2, z, Math.cos(a) * sp, 1.8 + R() * 1.2, Math.sin(a) * sp, 1.4 + R() * 0.5, 0.28 * k, 0.24 * k, 1, SHAPE.leaf, false, false, _c, 2.4, 2.2, 0, (R() - 0.5) * 5, 0, 0.06);
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
          this.add(x + Math.cos(a) * 0.3, y, z + Math.sin(a) * 0.3, Math.cos(a) * 0.35, 1.3 + R() * 0.6, Math.sin(a) * 0.35, 0.8 + R() * 0.2, 0.36 * k, 0.3 * k, 1, SHAPE.heart, false, false, _c, 0, 1.2, j * 0.08, (R() - 0.5) * 0.8, 0, 0.125, (R() - 0.5) * 0.4);
        }
        break;
      }
      case 'notes': {
        _c.set(opts.color ?? '#2f8f88');
        for (let j = 0, m = n(4); j < m; j++) {
          const a = R() * Math.PI * 2;
          this.add(x + Math.cos(a) * 0.4, y, z + Math.sin(a) * 0.4, Math.cos(a) * 0.5, 1.1 + R() * 0.5, Math.sin(a) * 0.5, 1.2, 0.44 * k, 0.38 * k, 1, SHAPE.note, false, false, _c, 0, 1.0, j * 0.18, (R() - 0.5) * 1.2, 0, 0.125, (R() - 0.5) * 0.5);
        }
        break;
      }
    }
  }

  /** City mode: fog wisps through the Golden Gate while the player is near (quality mid / high). */
  private ambient(dt: number) {
    const s = game.get();
    if (s.worldMode !== 'city' || s.settings.quality === 'low') return;
    const p = runtime.player;
    const dx = p.x - GGB.x, dz = p.z - GGB.z;
    if (dx * dx + dz * dz > WISP.near * WISP.near) return;
    const cap = s.settings.reducedMotion ? WISP.max / 2 : WISP.max;
    if ((this.wispIn -= dt) > 0 || this.wisps >= cap) return;
    this.wispIn = WISP.every * (0.6 + Math.random() * 0.8);
    // along the span, clear of the towers (a billboard through a tower leg would show its cut), under or over the deck;
    // started on the ocean side, drifting in toward the Bay (the fog's summer way: west → east)
    const R = Math.random;
    let t = (R() * 2.6 - 1.3) * GGB.half;
    if (Math.abs(Math.abs(t) - GGB.half) < 10) t += t > 0 ? -12 : 12;
    const ex = -GGB.az, ez = GGB.ax; // the span's normal toward the Bay (east)
    const off = -26 + R() * 18;
    // (clear of the water and the deck by more than a wisp's half height: its billboard never cuts a hard line in them)
    const y = R() < 0.45 ? 5 + R() * 5 : GGB.deck + 6 + R() * (GGB.top - GGB.deck - 4);
    const sp = 1.1 + R() * 0.8;
    _c.set(s.timeOfDay === 'night' ? '#8f99aa' : '#f6f3ec');
    const k = 0.8 + R() * 0.6;
    const i = this.add(GGB.x + GGB.ax * t + ex * off, y, GGB.z + GGB.az * t + ez * off, ex * sp, 0.05, ez * sp, 20 + R() * 8, 8 * k, 13 * k, 0.26 + R() * 0.1, SHAPE.wisp, false, false, _c, 0, 0, 0, (R() - 0.5) * 0.015, 0, 0.3, (R() - 0.5) * 0.3);
    if (i < 0) return;
    this.amb[i] = 1;
    this.wisps++;
  }

  update(dt: number) {
    this.clock += dt;
    this.ambient(dt);
    if (!this.alive) { if (this.mesh.visible) { this.mesh.visible = false; this.mesh.count = 0; } return; }
    const pos = this.aPos.array as Float32Array, fx = this.aFx.array as Float32Array, col = this.aCol.array as Float32Array;
    const pl = runtime.player;
    let w = 0, wisps = 0;
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
        this.tw[w] = this.tw[i]; this.fin[w] = this.fin[i]; this.amb[w] = this.amb[i]; this.tag[w] = this.tag[i];
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
      let alpha = t < 0 ? 0 : this.a0[w] * Math.min(1, k / this.fin[w]) * (1 - k * k);
      if (this.tw[w] > 0) alpha *= 0.55 + 0.45 * Math.sin(t * this.tw[w] + this.rot[w] * 3);
      if (this.amb[w]) {
        wisps++;
        // a wisp thins out as the player walks into it (the deck), so it never fills the screen
        const d = Math.hypot(this.px[w] - pl.x, this.py[w] - pl.y, this.pz[w] - pl.z);
        alpha *= Math.min(1, Math.max(0, (d - 4) / 14));
      }
      pos[w * 3] = this.px[w]; pos[w * 3 + 1] = this.py[w]; pos[w * 3 + 2] = this.pz[w];
      fx[w * 4] = size; fx[w * 4 + 1] = alpha; fx[w * 4 + 2] = this.code[w]; fx[w * 4 + 3] = this.rot[w];
      col[w * 3] = this.cr[w]; col[w * 3 + 1] = this.cg[w]; col[w * 3 + 2] = this.cb[w];
      w++;
    }
    this.alive = w;
    this.wisps = wisps;
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
  /** live ambient wisps (QA) */
  get wispCount() { return this.wisps; }

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

/** QA / tests: the live pool (null before the world mounts). */
export function fxPool(): FxPool | null { return POOL; }
