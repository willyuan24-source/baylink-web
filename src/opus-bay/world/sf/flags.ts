import * as THREE from 'three';
import { FLAG_GLYPHS, type FlagGlyph, type FlagPick } from '../../game/flags';
import { registerWarmup } from '../warmup';
import { FLAG_GLYPH_NODES, type GlyphNode } from './flagGlyphs';

/**
 * Wave 4 · the attraction flags in the world (lane G, W4-G7; plan sf-w4-plan.md §4.2 "Attraction flags"). What stands
 * is game/flags.ts pickFlags; this file only draws it:
 *
 *   ONE InstancedMesh (capacity 16, 32 triangles a flag), ONE draw call, ONE program (its own ShaderMaterial, warmed by
 *   'g-flags'), no shadow, fog: false, toneMapped: false, frustumCulled off (the vertex shader places everything).
 *   A flag = a gold six-sided pole (r 0.35 u) up to `h` (28–70 u above the ground at its foot), a ball finial, and a
 *   7 × 4.5 u pennant (4 × 1 segments, a swallowtail notch) in the category colour with a cream disc carrying the glyph
 *   (one 256² canvas atlas drawn from the lucide paths, world/sf/flagGlyphs.ts). The pennant turns to face the camera
 *   around the pole (a cylindrical billboard), waves in the vertex shader (uTime) and scales by max(1, d / uScaleDist) so
 *   it never shrinks under ≈ 25 CSS px (uScaleDist from the viewport: `flagScaleDistance`); the pole top rises with it so
 *   a big far pennant never touches the ground. Alpha (vertex shader): smoothstep(140, 200, d) × (1 − smoothstep(1500,
 *   1800, d)) for T1 flags, smoothstep(60, 90, d) up to the 3,000 u far plane for the target, 2,000 u for a panorama,
 *   times the slot's 0.4 s fade in / out (`FlagSlots`).
 *
 * Use (integration phase, lane G): `const layer = new FlagLayer({ ground })`, add `layer.mesh` to the city scene, call
 * `layer.setPicks(pickFlags(…), now)` at ≤ 4 Hz and `layer.update(camera, now, viewportH)` every frame; `dispose()`.
 * Nothing here runs until someone builds a FlagLayer; importing the module only registers the warm-up factory.
 */

export const FLAG_CAPACITY = 16;
/** fade in / out of a flag (s) */
export const FLAG_FADE_S = 0.4;
/** pennant size (u) at scale 1 */
export const PENNANT = { w: 7, h: 4.5, segments: 4 } as const;
/** pole radius (u) and sides; finial radius (u) */
export const POLE = { r: 0.35, sides: 6, finial: 0.8 } as const;
/** colours (sRGB hex): pole gold, finial, disc cream */
export const FLAG_COLORS = { pole: '#d9a441', finial: '#f2cf7a', cream: '#fffaf1' } as const;
/** the atlas: 256² canvas, 4 × 4 cells of 64 px, a glyph 48 px inside each */
export const ATLAS = { size: 256, cells: 4, cell: 64, pad: 8, stroke: 2.4 } as const;

/** role codes for the shader (aInst.w) */
export const ROLE_CODE = { tier1: 0, target: 1, panorama: 2 } as const;

// ---------------------------------------------------------------------------------------------------------------
// Pure helpers (node tests)
// ---------------------------------------------------------------------------------------------------------------

/**
 * The distance beyond which the pennant grows (u): below it the pennant keeps its 7 u width, beyond it its screen width
 * stays at `minPx` CSS px (px per unit at distance d = viewportH / (2 d tan(vfov / 2))). A 390 × 844 phone (vfov 62°)
 * gives ≈ 197 u, a 1440 × 900 desktop (vfov 42°) ≈ 328 u.
 */
export function flagScaleDistance(viewportH: number, vfovDeg: number, minPx = 25, pennantW: number = PENNANT.w): number {
  const t = Math.tan(((vfovDeg * Math.PI) / 180) / 2);
  return Math.max(60, (pennantW * Math.max(1, viewportH)) / (2 * minPx * Math.max(1e-3, t)));
}

/** The pennant scale at distance d (the vertex shader does the same). */
export const pennantScale = (d: number, scaleDist: number) => Math.max(1, d / scaleDist);

/** The atlas cell of a glyph (FLAG_GLYPHS order). */
export const glyphCell = (g: FlagGlyph) => Math.max(0, FLAG_GLYPHS.indexOf(g));

/** Where a cell sits in the atlas canvas (px, y down): its glyph box. */
export function atlasCellRect(cell: number): { x: number; y: number; size: number } {
  const col = cell % ATLAS.cells, row = Math.floor(cell / ATLAS.cells);
  return { x: col * ATLAS.cell + ATLAS.pad, y: row * ATLAS.cell + ATLAS.pad, size: ATLAS.cell - 2 * ATLAS.pad };
}

/**
 * The flag geometry: position + aPart (0 pole, 1 finial, 2 pennant) + uv. The pole is a unit open cylinder (x, z on the
 * unit circle, y 0…1), the finial a unit six-sided bipyramid, the pennant a (u, v) grid (x = u 0…1 along, y = v 0…1 up).
 * The vertex shader sizes and places all three per instance.
 */
export function flagGeometry(): THREE.BufferGeometry {
  const pos: number[] = [], part: number[] = [], uv: number[] = [], idx: number[] = [];
  const v = (x: number, y: number, z: number, p: number, u = 0, w = 0) => { pos.push(x, y, z); part.push(p); uv.push(u, w); return pos.length / 3 - 1; };
  const n = POLE.sides;
  // pole: n sides, 2 triangles each (flat-ish shading from the normal direction in the shader: uv.x = side angle / 2π)
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2;
    const b0 = v(Math.cos(a0), 0, Math.sin(a0), 0, (i + 0.5) / n, 0), b1 = v(Math.cos(a1), 0, Math.sin(a1), 0, (i + 0.5) / n, 0);
    const t0 = v(Math.cos(a0), 1, Math.sin(a0), 0, (i + 0.5) / n, 1), t1 = v(Math.cos(a1), 1, Math.sin(a1), 0, (i + 0.5) / n, 1);
    idx.push(b0, t0, b1, b1, t0, t1);
  }
  // finial: a six-sided bipyramid
  const top = v(0, 1, 0, 1, 0.5, 1), bottom = v(0, -1, 0, 1, 0.5, 0);
  const ring: number[] = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; ring.push(v(Math.cos(a), 0, Math.sin(a), 1, i / n, 0.5)); }
  for (let i = 0; i < n; i++) { const a = ring[i], b = ring[(i + 1) % n]; idx.push(a, top, b, a, b, bottom); }
  // pennant: segments × 1 quads
  const S = PENNANT.segments;
  const grid: number[][] = [];
  for (let i = 0; i <= S; i++) { const u = i / S; grid.push([v(u, 0, 0, 2, u, 0), v(u, 1, 0, 2, u, 1)]); }
  for (let i = 0; i < S; i++) { const [a, b] = grid[i], [c, d] = grid[i + 1]; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aPart', new THREE.Float32BufferAttribute(part, 1));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

/** Triangles of one flag (the budget check: ≤ 60 a flag, ≤ 1k for all). */
export const FLAG_TRIS = POLE.sides * 2 + POLE.sides * 2 + PENNANT.segments * 2;

/** A minimal 2D context (the canvas API the atlas uses; tests pass a recorder). */
export interface GlyphCtx {
  save(): void; restore(): void; translate(x: number, y: number): void; scale(x: number, y: number): void;
  beginPath(): void; moveTo(x: number, y: number): void; lineTo(x: number, y: number): void; closePath(): void;
  arc(x: number, y: number, r: number, a0: number, a1: number): void;
  ellipse?(x: number, y: number, rx: number, ry: number, rot: number, a0: number, a1: number): void;
  rect(x: number, y: number, w: number, h: number): void;
  roundRect?(x: number, y: number, w: number, h: number, r: number): void;
  stroke(path?: Path2D): void; fill(path?: Path2D): void; clearRect(x: number, y: number, w: number, h: number): void;
  lineWidth: number; lineCap: CanvasLineCap; lineJoin: CanvasLineJoin; strokeStyle: string | CanvasGradient | CanvasPattern; fillStyle: string | CanvasGradient | CanvasPattern;
}

const num = (v: string | number | undefined, d = 0) => (v === undefined ? d : typeof v === 'number' ? v : parseFloat(v));
const pts = (s: string | number | undefined) => String(s ?? '').trim().split(/[\s,]+/).map(Number).filter(Number.isFinite);

/** Draw one lucide node list (24 × 24 units) into a size × size box at (x, y). `makePath` = Path2D (browser) or null. */
export function drawGlyph(ctx: GlyphCtx, nodes: readonly GlyphNode[], x: number, y: number, size: number, makePath: ((d: string) => Path2D) | null, stroke: number = ATLAS.stroke) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 24, size / 24);
  ctx.lineWidth = stroke;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#ffffff';
  ctx.fillStyle = '#ffffff';
  for (const [tag, a] of nodes) {
    const filled = a.fill === 'currentColor';
    if (tag === 'path') {
      if (!makePath) continue;
      const p = makePath(String(a.d));
      ctx.stroke(p);
      if (filled) ctx.fill(p);
      continue;
    }
    ctx.beginPath();
    if (tag === 'circle') ctx.arc(num(a.cx), num(a.cy), num(a.r), 0, Math.PI * 2);
    else if (tag === 'ellipse' && ctx.ellipse) ctx.ellipse(num(a.cx), num(a.cy), num(a.rx), num(a.ry), 0, 0, Math.PI * 2);
    else if (tag === 'rect') {
      const rx = num(a.rx, 0);
      if (rx > 0 && ctx.roundRect) ctx.roundRect(num(a.x), num(a.y), num(a.width), num(a.height), rx);
      else ctx.rect(num(a.x), num(a.y), num(a.width), num(a.height));
    } else if (tag === 'line') { ctx.moveTo(num(a.x1), num(a.y1)); ctx.lineTo(num(a.x2), num(a.y2)); }
    else if (tag === 'polyline' || tag === 'polygon') {
      const p = pts(a.points);
      for (let i = 0; i + 1 < p.length; i += 2) (i ? ctx.lineTo : ctx.moveTo).call(ctx, p[i], p[i + 1]);
      if (tag === 'polygon') ctx.closePath();
    }
    ctx.stroke();
    if (filled) ctx.fill();
  }
  ctx.restore();
}

/** Draw every flag glyph into its atlas cell (white ink on transparent: the shader tints it). */
export function drawGlyphAtlas(ctx: GlyphCtx, makePath: ((d: string) => Path2D) | null) {
  ctx.clearRect(0, 0, ATLAS.size, ATLAS.size);
  FLAG_GLYPHS.forEach((g, i) => {
    const r = atlasCellRect(i);
    drawGlyph(ctx, FLAG_GLYPH_NODES[g] ?? [], r.x, r.y, r.size, makePath);
  });
}

/** The atlas texture: a CanvasTexture in the browser, a 1 × 1 blank without a DOM (node; the flags still draw, glyph-less). */
export function makeGlyphAtlasTexture(): THREE.Texture {
  if (typeof document !== 'undefined' && typeof Path2D !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = ATLAS.size;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      drawGlyphAtlas(ctx, d => new Path2D(d));
      const tex = new THREE.CanvasTexture(canvas);
      tex.name = 'ob-flag-glyphs';
      tex.anisotropy = 2;
      return tex;
    }
  }
  const tex = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1);
  tex.needsUpdate = true;
  return tex;
}

// ---------------------------------------------------------------------------------------------------------------
// Slots: stable instances with a 0.4 s fade in / out
// ---------------------------------------------------------------------------------------------------------------

interface Slot { pick: FlagPick; since: number; out: number | null; dirty: boolean }

/**
 * Stable instance slots for the picks: a flag keeps its slot while it stays picked (its geometry is written once), a new
 * one takes a free slot (else the faintest fading one), a dropped one fades out over FLAG_FADE_S and frees its slot. A
 * flag that comes back while fading out fades back in from where it was. `now` in seconds.
 */
export class FlagSlots {
  readonly slots: (Slot | null)[];
  constructor(capacity: number = FLAG_CAPACITY) { this.slots = Array.from({ length: capacity }, () => null); }

  alpha(i: number, now: number): number {
    const s = this.slots[i];
    if (!s) return 0;
    const fin = Math.min(1, Math.max(0, (now - s.since) / FLAG_FADE_S));
    if (s.out === null) return fin;
    const at = Math.min(1, Math.max(0, (s.out - s.since) / FLAG_FADE_S));
    return at * (1 - Math.min(1, Math.max(0, (now - s.out) / FLAG_FADE_S)));
  }

  /** Assign the picks; returns true when any slot's content changed (the instance data must be rewritten). */
  update(picks: readonly FlagPick[], now: number): boolean {
    let changed = false;
    const want = new Map(picks.map(p => [p.key, p] as const));
    // keep / update / fade out
    this.slots.forEach((s, i) => {
      if (!s) return;
      const p = want.get(s.pick.key);
      if (p) {
        want.delete(s.pick.key);
        if (s.out !== null) { const a = this.alpha(i, now); s.out = null; s.since = now - a * FLAG_FADE_S; changed = true; }
        if (!samePick(s.pick, p)) { s.pick = p; s.dirty = true; changed = true; }
      } else if (s.out === null) { s.out = now; changed = true; }
    });
    // new picks: a free slot, else the faintest fading one
    for (const p of picks) {
      if (!want.has(p.key)) continue;
      let i = this.slots.indexOf(null);
      if (i < 0) {
        let best = -1, bestA = Infinity;
        this.slots.forEach((s, j) => { if (s && s.out !== null) { const a = this.alpha(j, now); if (a < bestA) { bestA = a; best = j; } } });
        i = best;
      }
      if (i < 0) break;
      this.slots[i] = { pick: p, since: now, out: null, dirty: true };
      want.delete(p.key);
      changed = true;
    }
    return changed;
  }

  /** Free the slots whose fade-out has finished; returns true when any was freed. */
  sweep(now: number): boolean {
    // (every frame: a plain loop, no closure)
    let freed = false;
    for (let i = 0; i < this.slots.length; i++) {
      const s = this.slots[i];
      if (s && s.out !== null && now - s.out >= FLAG_FADE_S) { this.slots[i] = null; freed = true; }
    }
    return freed;
  }

  /** Any slot mid-fade (the alpha attribute must be rewritten this frame)? */
  fading(now: number): boolean {
    for (const s of this.slots) if (s && (s.out !== null || now - s.since < FLAG_FADE_S)) return true;
    return false;
  }

  /** Instances to draw: the highest used slot + 1. */
  get count(): number { for (let i = this.slots.length - 1; i >= 0; i--) if (this.slots[i]) return i + 1; return 0; }
}

const samePick = (a: FlagPick, b: FlagPick) => a.x === b.x && a.z === b.z && a.h === b.h && a.color === b.color && a.glyph === b.glyph && a.role === b.role;

// ---------------------------------------------------------------------------------------------------------------
// Material (one instance, one program)
// ---------------------------------------------------------------------------------------------------------------

const VERT = /* glsl */ `
attribute float aPart;
attribute vec4 aInst;   // h, glyph cell, alpha (fade), role (0 tier1, 1 target, 2 panorama)
attribute vec3 aTint;
uniform float uTime;
uniform float uScaleDist;
varying vec2 vUv;
varying float vPart;
varying vec3 vTint;
varying float vAlpha;
varying float vGlyph;
varying float vShade;
void main() {
  vec3 foot = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  vec2 toCam = cameraPosition.xz - foot.xz;
  float d = length(toCam);
  toCam = d > 1e-3 ? toCam / d : vec2(0.0, 1.0);
  float k = max(1.0, d / uScaleDist);
  float kp = min(k, 6.0);
  float W = ${PENNANT.w.toFixed(1)} * k, H = ${PENNANT.h.toFixed(1)} * k;
  float top = max(aInst.x, H + 1.6 * kp + 4.0);
  vec3 right = vec3(toCam.y, 0.0, -toCam.x);
  vec3 away = vec3(-toCam.x, 0.0, -toCam.y);
  vec3 p;
  vShade = 1.0;
  if (aPart < 0.5) {
    float r = ${POLE.r.toFixed(2)} * kp;
    p = foot + vec3(position.x * r, position.y * top, position.z * r);
    // light from the upper left of the view: sides facing the camera's right are brighter
    vShade = 0.72 + 0.28 * clamp(dot(normalize(vec3(position.x, 0.0, position.z)), normalize(right - away * 0.4)) * 0.5 + 0.5, 0.0, 1.0);
  } else if (aPart < 1.5) {
    p = foot + vec3(0.0, top + 0.45 * kp, 0.0) + position * ${POLE.finial.toFixed(2)} * kp;
    vShade = 0.85 + 0.15 * position.y;
  } else {
    float u = position.x, v = position.y;
    float ph = uTime * 2.6 - u * 5.0 + foot.x * 0.05 + foot.z * 0.03;
    float wave = sin(ph) * u;
    float droop = u * u * 0.08 * H;
    p = foot + vec3(0.0, top - 0.25 * kp - (1.0 - v) * H - droop + wave * 0.06 * H, 0.0) + right * (u * W + 0.3 * kp) + away * (wave * 0.22 * H);
    vShade = 0.86 + 0.14 * cos(ph);
  }
  vUv = uv;
  vPart = aPart;
  vTint = aTint;
  vGlyph = aInst.y;
  float role = aInst.w;
  float nearFade = role > 0.5 && role < 1.5 ? smoothstep(60.0, 90.0, d) : smoothstep(140.0, 200.0, d);
  float farFade = role > 0.5 && role < 1.5 ? 1.0 - smoothstep(2800.0, 3000.0, d) : role > 1.5 ? 1.0 - smoothstep(1850.0, 2050.0, d) : 1.0 - smoothstep(1500.0, 1800.0, d);
  vAlpha = aInst.z * nearFade * farFade;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
  // an invisible flag costs no fragments
  if (vAlpha < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}
`;

const FRAG = /* glsl */ `
uniform sampler2D uAtlas;
uniform vec3 uPole;
uniform vec3 uFinial;
uniform vec3 uCream;
uniform float uDim;
varying vec2 vUv;
varying float vPart;
varying vec3 vTint;
varying float vAlpha;
varying float vGlyph;
varying float vShade;
void main() {
  vec3 col;
  if (vPart < 0.5) col = uPole * vShade;
  else if (vPart < 1.5) col = uFinial * vShade;
  else {
    vec2 q = vec2(vUv.x * ${PENNANT.w.toFixed(1)}, vUv.y * ${PENNANT.h.toFixed(1)});
    // swallowtail notch at the fly end
    if (q.x > ${PENNANT.w.toFixed(1)} - 1.3 * (1.0 - abs(vUv.y - 0.5) * 2.0)) discard;
    col = vTint * vShade;
    // a slightly darker hem top and bottom
    col *= 1.0 - 0.12 * (1.0 - smoothstep(0.0, 0.35, min(q.y, ${PENNANT.h.toFixed(1)} - q.y)));
    vec2 c = vec2(2.35, 2.25);
    float r = 1.7;
    float dd = length(q - c);
    float aa = max(fwidth(dd), 1e-3);
    float disc = 1.0 - smoothstep(r - aa, r + aa, dd);
    col = mix(col, uCream, disc);
    vec2 g = (q - c) / (r * 1.45) * 0.5 + 0.5;
    if (g.x >= 0.0 && g.x <= 1.0 && g.y >= 0.0 && g.y <= 1.0) {
      float cell = floor(vGlyph + 0.5);
      vec2 cuv = vec2((mod(cell, ${ATLAS.cells.toFixed(1)}) + g.x) / ${ATLAS.cells.toFixed(1)}, (${(ATLAS.cells - 1).toFixed(1)} - floor(cell / ${ATLAS.cells.toFixed(1)}) + g.y) / ${ATLAS.cells.toFixed(1)});
      float ink = texture2D(uAtlas, cuv).a;
      col = mix(col, vTint * 0.78, ink * disc);
    }
  }
  gl_FragColor = vec4(col * uDim, vAlpha);
  #include <colorspace_fragment>
}
`;

export type FlagMaterial = THREE.ShaderMaterial & { uniforms: { uTime: { value: number }; uScaleDist: { value: number }; uAtlas: { value: THREE.Texture | null }; uPole: { value: THREE.Color }; uFinial: { value: THREE.Color }; uCream: { value: THREE.Color }; uDim: { value: number } } };

/** A new flag material (its own instance: "one material instance per object kind"). */
export function makeFlagMaterial(atlas: THREE.Texture | null = null): FlagMaterial {
  const m = new THREE.ShaderMaterial({
    name: 'ob-flags',
    uniforms: {
      uTime: { value: 0 }, uScaleDist: { value: 300 }, uAtlas: { value: atlas },
      uPole: { value: new THREE.Color(FLAG_COLORS.pole) }, uFinial: { value: new THREE.Color(FLAG_COLORS.finial) }, uCream: { value: new THREE.Color(FLAG_COLORS.cream) },
      uDim: { value: 1 },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: false,
    toneMapped: false,
  });
  return m as FlagMaterial;
}

let shared: FlagMaterial | null = null;
/** The one flag material of the page (the warm-up compiles this very instance's program). */
export function flagMaterial(): FlagMaterial { return (shared ??= makeFlagMaterial()); }

/** An InstancedMesh built exactly like the real one (the warm-up uses it with capacity 1). */
export function flagMesh(capacity: number = FLAG_CAPACITY, material: FlagMaterial = flagMaterial()): THREE.InstancedMesh<THREE.BufferGeometry, FlagMaterial> {
  const geo = flagGeometry();
  geo.setAttribute('aInst', new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aTint', new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3));
  const mesh = new THREE.InstancedMesh(geo, material, capacity);
  mesh.name = 'ob-flags';
  mesh.count = 0;
  mesh.frustumCulled = false;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.renderOrder = 8;
  mesh.matrixAutoUpdate = false;
  return mesh;
}

/** Warm-up factory (plan §5.5): the flag program on an InstancedMesh with the real material. */
export function flagWarmupSet() {
  const mesh = flagMesh(1);
  mesh.count = 1;
  (mesh.geometry.getAttribute('aInst') as THREE.InstancedBufferAttribute).setXYZW(0, 30, 0, 1, 0);
  return { objects: [mesh as THREE.Object3D], dispose: () => { mesh.geometry.dispose(); } };
}
registerWarmup('g-flags', flagWarmupSet);

// ---------------------------------------------------------------------------------------------------------------
// The layer
// ---------------------------------------------------------------------------------------------------------------

export interface FlagLayerOptions {
  /** ground height at (x, z), or null while that ground is not streamed in (the flag waits hidden) */
  ground: (x: number, z: number) => number | null;
  capacity?: number;
}

/**
 * The flags as one InstancedMesh. `setPicks` (≤ 4 Hz) assigns slots; `update` (every frame) moves time, the pennant scale
 * and the fades. Draw calls: 1 while any flag is visible, 0 otherwise (mesh.visible off when nothing is drawn).
 */
export class FlagLayer {
  readonly mesh: THREE.InstancedMesh<THREE.BufferGeometry, FlagMaterial>;
  readonly slots: FlagSlots;
  private readonly ground: FlagLayerOptions['ground'];
  private readonly grounds: (number | null)[];
  private atlas: THREE.Texture | null = null;
  private groundCheck = 0;
  private readonly m4 = new THREE.Matrix4();
  private readonly color = new THREE.Color();

  constructor(opts: FlagLayerOptions) {
    const cap = opts.capacity ?? FLAG_CAPACITY;
    this.ground = opts.ground;
    this.slots = new FlagSlots(cap);
    this.grounds = Array.from({ length: cap }, () => null);
    this.mesh = flagMesh(cap);
    this.mesh.visible = false;
  }

  /** The picks of this moment (game/flags.ts pickFlags); `now` in seconds. */
  setPicks(picks: readonly FlagPick[], now: number) {
    this.now = now;
    if (!this.slots.update(picks, now)) return;
    this.writeInstances();
  }

  /** Per frame: time, pennant scale (viewport height in CSS px, the camera's vertical fov), fades, grounds. */
  update(camera: THREE.PerspectiveCamera, now: number, viewportH: number, dim = 1) {
    this.now = now;
    const mat = this.mesh.material;
    if (!this.atlas) { this.atlas = makeGlyphAtlasTexture(); mat.uniforms.uAtlas.value = this.atlas; }
    mat.uniforms.uTime.value = now;
    mat.uniforms.uScaleDist.value = flagScaleDistance(viewportH, camera.fov);
    mat.uniforms.uDim.value = dim;
    let rewrite = false;
    if (this.slots.sweep(now)) rewrite = true;
    // grounds still unknown (streaming): look again twice a second
    if (now >= this.groundCheck) {
      this.groundCheck = now + 0.5;
      const slots = this.slots.slots;
      for (let i = 0; i < slots.length; i++) {
        const s = slots[i];
        if (s && this.grounds[i] === null && this.ground(s.pick.x, s.pick.z) !== null) { s.dirty = true; rewrite = true; }
      }
    }
    if (rewrite) this.writeInstances();
    // the fades: an upload only on frames where an alpha really changed
    else this.writeAlpha();
    this.mesh.count = this.slots.count;
    this.mesh.visible = this.mesh.count > 0;
  }

  private writeInstances() {
    const geo = this.mesh.geometry;
    const inst = geo.getAttribute('aInst') as THREE.InstancedBufferAttribute;
    const tint = geo.getAttribute('aTint') as THREE.InstancedBufferAttribute;
    let matrices = false;
    this.slots.slots.forEach((s, i) => {
      if (!s) { inst.setXYZW(i, 0, 0, 0, 0); return; }
      if (s.dirty || this.grounds[i] === null) {
        const y = this.ground(s.pick.x, s.pick.z);
        this.grounds[i] = y;
        this.m4.makeTranslation(s.pick.x, y ?? 0, s.pick.z);
        this.mesh.setMatrixAt(i, this.m4);
        this.color.set(s.pick.color);
        tint.setXYZ(i, this.color.r, this.color.g, this.color.b);
        s.dirty = false;
        matrices = true;
      }
      inst.setXYZW(i, s.pick.h, glyphCell(s.pick.glyph), 0, ROLE_CODE[s.pick.role]);
    });
    if (matrices) { this.mesh.instanceMatrix.needsUpdate = true; tint.needsUpdate = true; }
    inst.needsUpdate = true;
    this.writeAlpha();
  }

  /** the caller's clock (s): the last setPicks / update time */
  private now = 0;
  /** every frame: plain loops, no closures (review) */
  private writeAlpha() {
    const inst = this.mesh.geometry.getAttribute('aInst') as THREE.InstancedBufferAttribute;
    const slots = this.slots.slots;
    let changed = false;
    for (let i = 0; i < slots.length; i++) {
      const a = slots[i] && this.grounds[i] !== null ? this.slots.alpha(i, this.now) : 0;
      if (Math.abs(inst.getZ(i) - a) > 1e-4) { inst.setZ(i, a); changed = true; }
    }
    if (changed) inst.needsUpdate = true;
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.atlas?.dispose();
    this.atlas = null;
    this.mesh.removeFromParent();
  }
}
