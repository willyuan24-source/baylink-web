import * as THREE from 'three';
import type { Vec2 } from '../../core/types';
import { U } from '../materials';
import { registerWarmup } from '../warmup';
import type { WorldSystem } from '../world';
import { KARL, KARL_GLSL } from './fog';
import { type FarData, ROAD_CLASSES, ROAD_FLAG } from './format';
import { GGB, goldenGateBridge } from './landmarks/golden-gate-bridge';
import { LAMP_STEP, STREET_LAMP } from './look';
import { inPoly } from './raster';

/**
 * The night light field (lane C2-9, city chunk; CS-12): ONE THREE.Points draw for the lights of the whole city, so it
 * reads at night from Twin Peaks while the far city (L2) is only prisms:
 *
 *   street lamps   a lamp every LAMP_STEP u on alternate sides of every motorway … tertiary street (far.lines), lamp
 *                  level primary 1 / secondary 0.7 / tertiary 0.5 (look.ts STREET_LAMP), mostly sodium, some LED
 *   Golden Gate    the deck's railing lamps, the floodlit tower bases and the blinking red aviation lights on the tower
 *                  tops (the towers were floating red bars at night: now the deck strings them together)
 *   landmarks      CitySites.siteLights() (D2's SiteHooks.lights), refreshed while the city streams
 *
 * Round additive dots of 1.5–4.5 px (a fixed world size, clamped), faded out within ≈ 60–150 u of the camera (the real
 * lamps, halos and the GROUND street glow take over there), dimmed under Karl the Fog, hidden by day (0 calls). The
 * street glow on the asphalt itself is in materials.ts (GROUND), from the lamp level the city ground bakes in.
 */
export interface LightSpec { x: number; y: number; z: number; level: number; color: readonly [number, number, number] }

const SODIUM = [1.0, 0.6, 0.28] as const;
const LED = [1.0, 0.84, 0.62] as const;
const RED = [1.0, 0.12, 0.08] as const;
const FLOOD = [1.0, 0.8, 0.55] as const;
/** a lamp head this high above the centreline */
const LAMP_Y = 3.4;
/** aLevel ≥ 2: blinking aviation light, fract = phase */
const BLINK = 2;

const hash = (x: number, z: number) => { const h = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453; return h - Math.floor(h); };

/**
 * Street lamps along far.lines (pure): every LAMP_STEP u (first at half a step), alternate sides 0.42 × the right of
 * way off the centreline, skipped where `skip(x, z)` (the hero slab: its own lamps) and in tunnels.
 */
export function streetLamps(lines: FarData['lines'], skip?: (x: number, z: number) => boolean, step: number = LAMP_STEP): LightSpec[] {
  const out: LightSpec[] = [];
  const tunnel = (ROAD_FLAG as Record<string, number>).tunnel ?? 0;
  for (let i = 0; i < lines.count; i++) {
    const level = STREET_LAMP[ROAD_CLASSES[lines.cls[i]]] ?? 0;
    if (!(level > 0) || (lines.flags[i] & tunnel)) continue;
    const off = lines.width[i] * 0.42;
    let next = step / 2, s = 0, side = 1;
    for (let k = lines.pStart[i] + 1; k < lines.pStart[i + 1]; k++) {
      const ax = lines.xyz[k * 3 - 3], ay = lines.xyz[k * 3 - 2], az = lines.xyz[k * 3 - 1];
      const bx = lines.xyz[k * 3], by = lines.xyz[k * 3 + 1], bz = lines.xyz[k * 3 + 2];
      const L = Math.hypot(bx - ax, bz - az);
      if (L < 1e-6) continue;
      const nx = -(bz - az) / L, nz = (bx - ax) / L;
      while (next <= s + L) {
        const f = (next - s) / L;
        const x = ax + (bx - ax) * f + nx * off * side, z = az + (bz - az) * f + nz * off * side;
        next += step;
        side = -side;
        if (skip?.(x, z)) continue;
        out.push({ x, y: ay + (by - ay) * f + LAMP_Y, z, level, color: hash(x, z) < 0.72 ? SODIUM : LED });
      }
      s += L;
    }
  }
  return out;
}

/** The Golden Gate Bridge's night lights in world space (pure; from D2's GGB stations and placement). */
export function ggbLights(): LightSpec[] {
  const { DECK, TOWER, TOP, END_S, END_N } = GGB;
  const L = goldenGateBridge, c = Math.cos(L.yaw), sn = Math.sin(L.yaw), base = typeof L.base === 'number' ? L.base : 0;
  const at = (lx: number, y: number, lz: number, level: number, color: LightSpec['color']): LightSpec => ({ x: L.x + lx * c + lz * sn, y: base + y, z: L.z - lx * sn + lz * c, level, color });
  const out: LightSpec[] = [];
  // railing lamps (the model's own are 15 u apart and sub-pixel from the hills)
  for (let s = END_S + 4; s < END_N - 2; s += 7.5) for (const zs of [-1, 1]) out.push(at(s, DECK + 2.3, zs * 2.6, 0.9, SODIUM));
  for (const sx of [-TOWER, TOWER]) for (const zs of [-1, 1]) {
    out.push(at(sx, TOP + 0.5, zs * 2.55, BLINK + (sx > 0 ? 0.5 : 0), RED));
    out.push(at(sx, TOP * 0.62, zs * 2.55, 0.55, RED));
    out.push(at(sx, 3.5, zs * 4.3, 1, FLOOD));
  }
  return out;
}

const VERT = /* glsl */ `
attribute float aLevel;
attribute vec3 aColor;
uniform float uNight;
uniform float uTime;
uniform float uPx;
varying vec3 vCol;
${KARL_GLSL}
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vec4 mv = viewMatrix * wp;
  float d = max(-mv.z, 1.0);
  float lvl = aLevel, blink = 1.0;
  if (aLevel >= ${BLINK.toFixed(1)}) { lvl = 1.0; blink = 0.12 + 0.88 * step(0.55, fract(uTime * 0.5 + fract(aLevel))); }
  float a = uNight * smoothstep(60.0, 150.0, d) * blink * (0.4 + 0.6 * lvl);
  a *= 1.0 - 0.85 * obKarl(wp.xyz, d);
  vCol = aColor * a;
  gl_PointSize = clamp(1.6 * uPx / d, 1.5, 4.5) * (0.75 + 0.35 * lvl);
  gl_Position = projectionMatrix * mv;
  if (a < 0.004) gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
}`;
const FRAG = /* glsl */ `
varying vec3 vCol;
void main() {
  float r = length(gl_PointCoord - 0.5) * 2.0;
  float k = pow(max(0.0, 1.0 - r), 1.4);
  if (k < 0.01) discard;
  gl_FragColor = vec4(vCol * k * 1.7, 1.0);
  #include <colorspace_fragment>
}`;

export const LIGHT_FIELD = new THREE.ShaderMaterial({
  name: 'ob-light-field',
  uniforms: { uNight: U.uNight, uTime: U.uTime, uPx: { value: 600 }, ...KARL },
  vertexShader: VERT,
  fragmentShader: FRAG,
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
});

function pointsGeometry(specs: readonly LightSpec[]): THREE.BufferGeometry {
  const n = specs.length;
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), lvl = new Float32Array(n);
  specs.forEach((p, i) => { pos.set([p.x, p.y, p.z], i * 3); col.set(p.color, i * 3); lvl[i] = p.level; });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aLevel', new THREE.BufferAttribute(lvl, 1));
  g.computeBoundingSphere();
  return g;
}

// the Points program is new: compile it with the city's variants (warmup.ts), so the first night never stalls
registerWarmup('c2-light-field', () => {
  const g = pointsGeometry([{ x: 0, y: 0, z: 0, level: 1, color: SODIUM }]);
  return { objects: [new THREE.Points(g, LIGHT_FIELD)], dispose: () => g.dispose() };
});

/** CitySites.siteLights() (hex colours, size ≈ brightness) as light specs. */
export function siteLightSpecs(list: readonly { x: number; y: number; z: number; size: number; color: string }[]): LightSpec[] {
  const c = new THREE.Color();
  return list.map(l => { c.set(l.color); return { x: l.x, y: l.y, z: l.z, level: Math.min(1, Math.max(0.3, l.size)), color: [c.r, c.g, c.b] as const }; });
}

/** The light field as a world system (world.ts adds it in city mode; `setFar` once the far data is in). */
export class LightField implements WorldSystem {
  readonly name = 'light-field';
  readonly group = new THREE.Group();
  private points: THREE.Points | null = null;
  private street: LightSpec[] = [];
  private siteCount = -1;
  private siteAt = 0;
  private size = new THREE.Vector2();

  private renderer: THREE.WebGLRenderer;
  private opts: { slab?: readonly Vec2[]; siteLights?: () => LightSpec[] };

  constructor(renderer: THREE.WebGLRenderer, opts: { slab?: readonly Vec2[]; siteLights?: () => LightSpec[] } = {}) {
    this.renderer = renderer;
    this.opts = opts;
    this.group.name = 'light-field';
  }

  /** the far data arrived: build the street lamps (≈ 13k points, a few ms) */
  setFar(far: FarData) {
    const slab = this.opts.slab;
    this.street = [...streetLamps(far.lines, slab ? (x, z) => inPoly(x, z, slab) : undefined), ...ggbLights()];
    this.rebuild([]);
  }

  get count(): number { return this.points?.geometry.getAttribute('position').count ?? 0; }
  get visible(): boolean { return !!this.points?.visible; }

  private rebuild(sites: LightSpec[]) {
    const g = pointsGeometry([...this.street, ...sites]);
    if (this.points) { this.points.geometry.dispose(); this.points.geometry = g; }
    else {
      this.points = new THREE.Points(g, LIGHT_FIELD);
      this.points.name = 'light-field';
      this.points.frustumCulled = false;
      this.points.renderOrder = 2;
      this.group.add(this.points);
    }
    this.points.updateMatrixWorld(true);
  }

  update(dt: number, _t: number, camera: THREE.Camera, night: number) {
    const p = this.points;
    if (!p) return;
    // on from dusk (golden hour's 0.05 would cost a call for lamps nobody can see)
    p.visible = night > 0.15;
    if (!p.visible) return;
    // landmark lights settle as the city streams in: pick up new ones every few seconds
    this.siteAt -= dt;
    if (this.opts.siteLights && this.siteAt <= 0) {
      this.siteAt = 4;
      const sites = this.opts.siteLights();
      if (sites.length !== this.siteCount) { this.siteCount = sites.length; this.rebuild(sites); }
    }
    // uPx: pixels per world unit at distance 1 (a lamp keeps its world size until the clamp)
    if ((camera as THREE.PerspectiveCamera).isPerspectiveCamera) {
      const fov = THREE.MathUtils.degToRad((camera as THREE.PerspectiveCamera).fov);
      (LIGHT_FIELD.uniforms.uPx as THREE.IUniform<number>).value = this.renderer.getDrawingBufferSize(this.size).y / (2 * Math.tan(fov / 2));
    }
  }

  dispose() {
    this.points?.geometry.dispose();
    this.group.clear();
    this.points = null;
  }
}
