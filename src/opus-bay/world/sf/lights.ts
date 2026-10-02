import * as THREE from 'three';
import { LAT0, LNG0, projectRaw } from '../../core/geo';
import type { Vec2 } from '../../core/types';
import { DISTRICT } from '../../data/district';
import type { BayStrand } from '../backdrop';
import { freezeStatic } from '../builder';
import { SALESFORCE_LEVELS } from '../landmarks';
import { U } from '../materials';
import { registerWarmup } from '../warmup';
import type { WorldSystem } from '../world';
import { FAR_FADE } from '../fogShader';
import { KARL, KARL_GLSL } from './fog';
import { type FarData, ROAD_CLASSES, ROAD_FLAG } from './format';
import { GGB, goldenGateBridge } from './landmarks/golden-gate-bridge';
import { LAMP_STEP, STREET_LAMP } from './look';
import { inPoly } from './raster';
import { importRetry } from '../../game/importRetry';

/**
 * The night light field (lane C2-9, city chunk; CS-12): ONE THREE.Points draw for the lights of the whole city, so it
 * reads at night from Twin Peaks while the far city (L2) is only prisms:
 *
 *   street lamps   a lamp every LAMP_STEP u on alternate sides of every motorway … tertiary street (far.lines), lamp
 *                  level primary 1 / secondary 0.7 / tertiary 0.5 (look.ts STREET_LAMP), mostly sodium, some LED
 *   Golden Gate    the deck's railing lamps, the floodlit tower bases and the blinking red aviation lights on the tower
 *                  tops (the towers were floating red bars at night: now the deck strings them together)
 *   landmarks      CitySites.siteLights() (D2's SiteHooks.lights), refreshed while the city streams
 *   Salesforce     the hero tower's crown (wave 4, W4-V8): a warm glow on its faces, readable across the city; wave 5
 *                  (W5-V10): it drifts slowly through a soft palette (CROWN_DRIFT)
 *   Bay Lights     W5-V10: LED dots up the Bay Bridge west span's northern suspender strands, a slow shimmer (BAY_LIGHTS)
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
    // the floodlights at each leg's foot (GGB_TOWER_LIGHT_SOURCE: the towers are washed from below, the fittings unseen
    // on the legs). (W8-X-review) W8-X6's rows of dots up every leg's edges read as strings of bulbs, not a wash: gone
    out.push(at(sx, 3.5, zs * 4.3, 1, FLOOD));
  }
  return out;
}

/**
 * The towers have been lit at night since 22 June 1987, with less light at the top so they seem to soar beyond the range
 * of illumination (the bridge district's Color & Art Deco Styling page; Irving Morrow's plan, Radiant History).
 * Checked 2026-10-01 (W8-X-review: W8-X6 cited the anniversaries page, which does not mention the lighting).
 */
export const GGB_TOWER_LIGHT_SOURCE = {
  sourceUrl: 'https://www.goldengate.org/bridge/history-research/bridge-features/color-art-deco-styling/',
  design: 'https://radianthistory.com/lighting-the-golden-gate-bridge-scale-and-dignity/',
  verifiedAt: '2026-10-01',
} as const;

/** Jim Campbell's LED crown ("Day for Night", 11,000 LEDs): a generic warm glow, no pictures (plan §2.4 row 32, W4-V8). */
const CROWN = [1.0, 0.9, 0.74] as const;
/**
 * aLevel ≥ CROWN_DRIFT (W5-V10, fract = height on the crown 0 … 1): the crown's slow colour drift — the warm glow
 * breathes through soft teal, rose and amber in a band that rises over ≈ 2 minutes. Our own abstract drift: the real
 * piece shows low-resolution moving pictures of the day in the city (salesforcetower.com/artwork, checked 2026-09-28),
 * never copied here (plan D24).
 */
export const CROWN_DRIFT = 5;
/**
 * aLevel ≥ BAY_LIGHTS (W5-V10, fract = position along the crossing 0 … 1): The Bay Lights — LEDs on the vertical
 * cables of the Bay Bridge's west span, on its northern cable plane (the side the San Francisco waterfront sees), lit
 * every night from dusk; relit on 20 March 2026 (illuminate.org, checked 2026-09-28). A slow generic shimmer of our
 * own (two soft waves drifting across the strands), never the installation's sequences (plan §3.6, D24).
 */
export const BAY_LIGHTS = 4;
/** an LED dot every this many u up a strand (the strands stand every 3 u: world/backdrop.ts BayStrand) */
export const BAY_DOT = 1;
/** cool LED white, a little over 1 (the small dots are additive: they read as the brightest lights on the Bay) */
const LED_WHITE = [1.1, 1.15, 1.25] as const;
export const BAY_LIGHTS_SOURCE = { sourceUrl: 'https://illuminate.org/projects/thebaylights/', verifiedAt: '2026-09-28' } as const;
/**
 * aLevel ≥ HALO_GLOW (W9-C6, review R§6 世界、镜头与美术: 「唐人街夜里…灯笼几乎不发光，没有霓虹」; fract = the glow's world
 * diameter / HALO_MAX_D): a soft round glow of a fixed WORLD size round a lit thing near the camera — a paper lantern, a
 * neon sign — from 1.5 u out to ≈ 160 u (the field's other lights fade in only beyond 60 u: near the camera the street
 * lamps have their own halos, a site's lanterns had none). A landmark asks for it with `halo` (u) on a site light
 * (world/sf/sites.ts SiteHooks.lights). A slow breath per light (its position's phase). Same Points draw: no call, no
 * program.
 */
export const HALO_GLOW = 6;
export const HALO_MAX_D = 4;

/** true north in the world frame (the map is turned 46°: core/geo.ts) */
function northXZ(): { x: number; z: number } {
  const a = projectRaw(LAT0, LNG0), b = projectRaw(LAT0 + 0.01, LNG0);
  const L = Math.hypot(b.x - a.x, b.z - a.z);
  return { x: (b.x - a.x) / L, z: (b.z - a.z) / L };
}

/**
 * The Bay Lights (pure; W5-V10): a dot every BAY_DOT u up each suspender strand of the west span's northern cable plane
 * (world/backdrop.ts `BridgeInfo.strands`, city mode), level BAY_LIGHTS + t. Empty without the bridge.
 */
export function bayLights(bridge: { strands?: readonly BayStrand[]; right?: { x: number; z: number } } | null | undefined): LightSpec[] {
  if (!bridge?.strands?.length || !bridge.right) return [];
  const n = northXZ();
  const north = bridge.right.x * n.x + bridge.right.z * n.z > 0 ? 1 : -1;
  const out: LightSpec[] = [];
  for (const s of bridge.strands) {
    if (s.side !== north) continue;
    const level = BAY_LIGHTS + Math.min(0.999, Math.max(0, s.t));
    for (let y = s.y0; y <= s.y1 + 1e-6; y += BAY_DOT) out.push({ x: s.x, y, z: s.z, level, color: LED_WHITE });
  }
  return out;
}

/**
 * Salesforce Tower's crown at night (pure; the hero tower of world/landmarks.ts, SALESFORCE_LEVELS): warm points on
 * the crown's faces at three heights between the lattice bands and one at the top, so the city's tallest building
 * reads at night from Twin Peaks or the glide like the Golden Gate's lamps (the hero's own crown is floodlit up close,
 * where the light field fades out).
 */
export function salesforceCrownLights(): LightSpec[] {
  const l = DISTRICT.landmarks.find(d => d.id === 'salesforce-tower');
  if (!l) return [];
  const c = Math.cos(l.rotationY), s = Math.sin(l.rotationY);
  const halfAt = (y: number) => {
    for (let i = 1; i < SALESFORCE_LEVELS.length; i++) {
      const a = SALESFORCE_LEVELS[i - 1], b = SALESFORCE_LEVELS[i];
      if (y <= b.y) return a.half + (b.half - a.half) * ((y - a.y) / (b.y - a.y));
    }
    return SALESFORCE_LEVELS[SALESFORCE_LEVELS.length - 1].half;
  };
  const out: LightSpec[] = [];
  // W5-V10: every crown point drifts (CROWN_DRIFT + its height on the crown, 46 → 58)
  const at = (lx: number, y: number, lz: number) => out.push({ x: l.position.x + lx * c + lz * s, y, z: l.position.z - lx * s + lz * c, level: CROWN_DRIFT + Math.min(0.999, (y - 46) / 12), color: CROWN });
  for (const y of [46.5, 49.5, 52]) {
    const h = halfAt(y) + 0.1;
    // two points on each face (the corners are rounded)
    for (const t of [-0.45, 0.45]) { at(t * h * 2, y, h); at(t * h * 2, y, -h); at(h, y, t * h * 2); at(-h, y, t * h * 2); }
  }
  at(0, 57.8, 0);
  return out;
}

/** The crown's drift palette (W5-V10) at time `t` (s, U.uTime) and height `h` on the crown (0 … 1): the light field's GLSL. */
export function crownDriftColor(t: number, h: number, out: [number, number, number] = [0, 0, 0]): [number, number, number] {
  const ph = t * 0.008 - h * 0.6;
  out[0] = 0.62 + 0.38 * Math.cos(6.2832 * ph);
  out[1] = 0.62 + 0.38 * Math.cos(6.2832 * (ph + 0.34));
  out[2] = 0.62 + 0.38 * Math.cos(6.2832 * (ph + 0.67));
  return out;
}
/** how much of the palette the crown takes (the light field mixes its points by the same amount) */
export const CROWN_MIX = 0.55;

/**
 * The hero Salesforce Tower's own crown (W5-V10, city mode): its glowing faces (world/landmarks.ts: the rings from y 44
 * up and the apex, glow at night) take the drift too, so it shows up close as well as in the light field from afar.
 * Vertex colours of that one mesh, rewritten at ≤ 5 Hz by night (mixed by the night level; by day the colours as
 * built): no program, no draw call. District mode never makes one (the hero regression).
 */
export class CrownDrift implements WorldSystem {
  readonly name = 'crown-drift';
  private attr: THREE.BufferAttribute | null = null;
  private idx: number[] = [];
  private base: number[] = [];
  private h: number[] = [];
  private range: [number, number] = [0, 0];
  private wait = 0;
  private mixed = 0;
  private c: [number, number, number] = [0, 0, 0];
  private time: () => number;

  constructor(mesh: THREE.Mesh | null | undefined, time: () => number = () => U.uTime.value) {
    this.time = time;
    const l = DISTRICT.landmarks.find(d => d.id === 'salesforce-tower');
    const g = mesh?.geometry;
    if (!l || !g) return;
    const pos = g.getAttribute('position'), col = g.getAttribute('color') as THREE.BufferAttribute | undefined, inf = g.getAttribute('aInfo');
    if (!pos || !col || !inf) return;
    for (let i = 0; i < pos.count; i++) {
      const w = inf.getW(i), y = pos.getY(i);
      if (!(w > 0 && w <= 1) || y < 44 || Math.hypot(pos.getX(i) - l.position.x, pos.getZ(i) - l.position.z) > 4.5) continue;
      this.idx.push(i);
      this.base.push(col.getX(i), col.getY(i), col.getZ(i));
      this.h.push(Math.min(1, Math.max(0, (y - 46) / 12)));
    }
    if (!this.idx.length) return;
    this.attr = col;
    this.range = [this.idx[0], this.idx[this.idx.length - 1]];
  }

  /** the crown vertices it drives (tests / QA) */
  get vertices(): number { return this.idx.length; }

  update(dt: number, _t: number, _camera: THREE.Camera, night: number) {
    const a = this.attr;
    if (!a) return;
    this.wait -= dt;
    if (this.wait > 0) return;
    this.wait = 0.2;
    const k = CROWN_MIX * Math.min(1, Math.max(0, (night - 0.15) / 0.5));
    if (k === 0 && this.mixed === 0) return;
    const t = this.time();
    for (let j = 0; j < this.idx.length; j++) {
      const c = crownDriftColor(t, this.h[j], this.c);
      const b = j * 3;
      a.setXYZ(this.idx[j], this.base[b] + (c[0] - this.base[b]) * k, this.base[b + 1] + (c[1] - this.base[b + 1]) * k, this.base[b + 2] + (c[2] - this.base[b + 2]) * k);
    }
    a.clearUpdateRanges();
    a.addUpdateRange(this.range[0] * 3, (this.range[1] - this.range[0] + 1) * 3);
    a.needsUpdate = true;
    this.mixed = k;
  }

  dispose() {
    const a = this.attr;
    if (!a) return;
    for (let j = 0; j < this.idx.length; j++) a.setXYZ(this.idx[j], this.base[j * 3], this.base[j * 3 + 1], this.base[j * 3 + 2]);
    a.needsUpdate = true;
    this.attr = null;
  }
}

/**
 * Coin glints at night (wave 5, lane V, W5-V5): GLINT_SLOTS points at the end of the field, moved at ≤ 5 Hz onto the
 * coins lane E draws (economy/coins.ts `coinWorld.visible`, nearest first), so a trail, a cache or a ring twinkles in
 * the dark. aLevel ≥ GLINT (fract = phase): a slow gold twinkle, a four-ray star of a fixed world size, shown from the
 * camera out to ≈ 170 u (the lamps fade in only beyond 60 u); unused slots have level 0 and are culled in the vertex
 * shader. Same Points draw: no call, no program.
 */
export const GLINT_SLOTS = 16;
const GLINT = 3;
const GOLD = [1.0, 0.82, 0.42] as const;
/** a glint sits this far above a coin's centre (its rim: the disc is 0.42 u across its radius) */
const GLINT_LIFT = 0.45;

const VERT = /* glsl */ `
attribute float aLevel;
attribute vec3 aColor;
uniform float uNight;
uniform float uTime;
uniform float uPx;
uniform vec2 uObFar;
varying vec3 vCol;
varying float vStar;
${KARL_GLSL}
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vec4 mv = viewMatrix * wp;
  float d = max(-mv.z, 1.0);
  float lvl = aLevel, blink = 1.0, reach = smoothstep(60.0, 150.0, d), star = 0.0, size = 1.6;
  vec3 col = aColor;
  if (aLevel >= ${HALO_GLOW.toFixed(1)}) {
    // W9-C6 a lantern's / a neon sign's glow: a world-sized soft disc near the camera, a slow breath
    lvl = 1.0; star = 2.0; size = fract(aLevel) * ${HALO_MAX_D.toFixed(1)};
    blink = 0.85 + 0.15 * sin(uTime * 1.6 + fract(wp.x * 0.37 + wp.z * 0.61) * 6.2832);
    reach = smoothstep(1.5, 3.0, d) * (1.0 - smoothstep(110.0, 160.0, d));
  } else if (aLevel >= ${CROWN_DRIFT.toFixed(1)}) {
    // W5-V10 the crown's slow colour drift: our own soft palette, one turn in ≈ 2 min, a band rising up the crown
    lvl = 1.0;
    float ph = uTime * 0.008 - fract(aLevel) * 0.6;
    col = mix(aColor, 0.62 + 0.38 * cos(6.2832 * (ph + vec3(0.0, 0.34, 0.67))), 0.55);
  } else if (aLevel >= ${BAY_LIGHTS.toFixed(1)}) {
    // W5-V10 The Bay Lights: two soft waves drifting across the north strands (our own pattern) and a faint sparkle;
    // small dots, seen from the waterfront out to the far fade
    lvl = 1.0; size = 0.9;
    float t = fract(aLevel) * 60.0;
    float w = 0.55 * (0.5 + 0.5 * sin(t * 0.9 - uTime * 0.45 + wp.y * 0.16)) + 0.45 * (0.5 + 0.5 * sin(t * 0.37 + uTime * 0.23 - wp.y * 0.07));
    blink = (0.3 + 0.7 * w * w) * (0.85 + 0.15 * sin(uTime * 2.7 + fract(t * 7.3 + wp.y * 3.1) * 40.0));
    // far away the dots (1 u apart) are smaller than the 1.5 px floor and overlap: keep their light, not their count
    blink *= clamp(size * uPx / d / 1.5, 0.35, 1.0);
    reach = smoothstep(6.0, 24.0, d);
  } else if (aLevel >= ${GLINT.toFixed(1)}) {
    lvl = 1.0; star = 1.0;
    blink = 0.3 + 0.7 * pow(0.5 + 0.5 * sin(uTime * 2.2 + fract(aLevel) * 6.2832), 3.0);
    reach = 1.0 - smoothstep(140.0, 180.0, d);
  } else if (aLevel >= ${BLINK.toFixed(1)}) { lvl = 1.0; blink = 0.12 + 0.88 * step(0.55, fract(uTime * 0.5 + fract(aLevel))); }
  float a = uNight * reach * blink * (0.4 + 0.6 * lvl);
  a *= (1.0 - 0.85 * obKarl(wp.xyz, d)) * (1.0 - smoothstep(uObFar.x, uObFar.y, d));
  vCol = col * a;
  vStar = star;
  gl_PointSize = star > 1.5
    ? clamp(size * uPx / d, 2.0, 0.09 * uPx)
    : star > 0.5
    ? clamp(1.3 * uPx / d, 0.01 * uPx, 0.034 * uPx) * (0.7 + 0.4 * blink)
    : clamp(size * uPx / d, 1.5, size > 1.0 ? 4.5 : 3.0) * (0.75 + 0.35 * lvl);
  gl_Position = projectionMatrix * mv;
  if (a < 0.004) gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
}`;
const FRAG = /* glsl */ `
varying vec3 vCol;
varying float vStar;
void main() {
  vec2 q = (gl_PointCoord - 0.5) * 2.0;
  float r = length(q);
  float k;
  if (vStar > 1.5) {
    // (W9-C6) a lantern's glow: a soft wide falloff round a warm core
    k = 0.6 * pow(max(0.0, 1.0 - r), 2.4) + 0.45 * pow(max(0.0, 1.0 - r * 3.0), 2.0);
  } else if (vStar > 0.5) {
    // a coin glint: a small hot core and four thin rays
    float core = pow(max(0.0, 1.0 - r * 2.2), 2.0);
    float rays = pow(max(0.0, 1.0 - abs(q.x) * 9.0), 2.0) * max(0.0, 1.0 - abs(q.y)) + pow(max(0.0, 1.0 - abs(q.y) * 9.0), 2.0) * max(0.0, 1.0 - abs(q.x));
    k = core * 1.2 + rays * 0.8;
  } else k = pow(max(0.0, 1.0 - r), 1.4);
  if (k < 0.01) discard;
  gl_FragColor = vec4(vCol * k * 1.7, 1.0);
  #include <colorspace_fragment>
}`;

export const LIGHT_FIELD = new THREE.ShaderMaterial({
  name: 'ob-light-field',
  uniforms: { uNight: U.uNight, uTime: U.uTime, uPx: { value: 600 }, ...KARL, ...FAR_FADE },
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

/**
 * CitySites.siteLights() (hex colours, size ≈ brightness) as light specs; (W9-C6) one with `halo` (u, the glow's world
 * diameter) is a near glow: aLevel HALO_GLOW + halo / HALO_MAX_D.
 */
export function siteLightSpecs(list: readonly { x: number; y: number; z: number; size: number; color: string; halo?: number }[]): LightSpec[] {
  const c = new THREE.Color();
  return list.map(l => {
    c.set(l.color);
    const level = l.halo ? HALO_GLOW + Math.min(0.999, Math.max(0.05, l.halo / HALO_MAX_D)) : Math.min(1, Math.max(0.3, l.size));
    return { x: l.x, y: l.y, z: l.z, level, color: [c.r, c.g, c.b] as const };
  });
}

/** A glint's position (world). */
export interface GlintSpot { x: number; y: number; z: number }

/**
 * The coins lane E draws right now, as glint spots (nearest first, at most `max`): economy/coins.ts `coinWorld` (null
 * outside city mode or before the economy feature starts). Pure; the rim lift is GLINT_LIFT.
 */
export function coinGlints(world: { items: readonly { kind: string; x: number; y: number; z: number; air: boolean }[]; visible: readonly number[] } | null, max = GLINT_SLOTS): GlintSpot[] {
  if (!world) return [];
  const out: GlintSpot[] = [];
  for (const i of world.visible) {
    const c = world.items[i];
    if (!c) continue;
    const centre = c.kind === 'ring' ? c.y : c.kind === 'cache' ? (c.air ? c.y - 0.6 : c.y) + 1.15 : c.y + 0.8;
    out.push({ x: c.x, y: centre + GLINT_LIFT, z: c.z });
    if (out.length >= max) break;
  }
  return out;
}

type CoinsModule = { coinWorld: Parameters<typeof coinGlints>[0] };

/** The light field as a world system (world.ts adds it in city mode; `setFar` once the far data is in). */
export class LightField implements WorldSystem {
  readonly name = 'light-field';
  readonly group = new THREE.Group();
  private points: THREE.Points | null = null;
  private street: LightSpec[] = [];
  /** the satellite boards' and the Bay Bridge east span's lights (setExtra, lane C2-7b) */
  private extra: LightSpec[] = [];
  private sites: LightSpec[] = [];
  private siteCount = -1;
  private siteAt = 0;
  private size = new THREE.Vector2();
  /** W5-V5: the first glint slot (the field's last GLINT_SLOTS points), the spots shown, the coins module once loaded */
  private glintBase = 0;
  private glints: GlintSpot[] = [];
  private glintAt = 0;
  private coins: CoinsModule | null = null;
  private coinsAsked = false;
  private disposed = false;

  private renderer: THREE.WebGLRenderer;
  private opts: { slab?: readonly Vec2[]; siteLights?: () => LightSpec[]; glints?: () => readonly GlintSpot[]; bayBridge?: Parameters<typeof bayLights>[0] };

  /**
   * `glints` (tests / QA): where the coin glints go; by default the coins of economy/coins.ts, imported on the first
   * night (the economy feature's own chunk: nothing is loaded by day, and nothing enters the main graph). `bayBridge`
   * (W5-V10): the Bay Bridge's strands (world/backdrop.ts, city mode) for The Bay Lights.
   */
  constructor(renderer: THREE.WebGLRenderer, opts: { slab?: readonly Vec2[]; siteLights?: () => LightSpec[]; glints?: () => readonly GlintSpot[]; bayBridge?: Parameters<typeof bayLights>[0] } = {}) {
    this.renderer = renderer;
    this.opts = opts;
    this.group.name = 'light-field';
    freezeStatic(this.group);
  }

  /** the coin glints drawn right now (QA / tests) */
  get glintCount(): number { return this.glints.length; }

  private glintSpots(): readonly GlintSpot[] {
    if (this.opts.glints) return this.opts.glints();
    if (!this.coins && !this.coinsAsked) {
      this.coinsAsked = true;
      importRetry(() => import('../../economy/coins')).then(m => { if (!this.disposed) this.coins = m as unknown as CoinsModule; }, () => { /* no economy: no glints */ });
    }
    return coinGlints(this.coins?.coinWorld ?? null);
  }

  /** Move the glint slots onto `spots` (the rest: level 0, culled). */
  private writeGlints(spots: readonly GlintSpot[]) {
    const p = this.points;
    if (!p) return;
    const pos = p.geometry.getAttribute('position') as THREE.BufferAttribute, lvl = p.geometry.getAttribute('aLevel') as THREE.BufferAttribute;
    const n = Math.min(spots.length, GLINT_SLOTS);
    for (let k = 0; k < GLINT_SLOTS; k++) {
      const i = this.glintBase + k, s = spots[k];
      if (k < n) { pos.setXYZ(i, s.x, s.y, s.z); lvl.setX(i, GLINT + (((s.x * 0.37 + s.z * 0.61) % 1) + 1) % 1 * 0.999); }
      else { pos.setXYZ(i, 0, -1e4, 0); lvl.setX(i, 0); }
    }
    pos.clearUpdateRanges(); pos.addUpdateRange(this.glintBase * 3, GLINT_SLOTS * 3); pos.needsUpdate = true;
    lvl.clearUpdateRanges(); lvl.addUpdateRange(this.glintBase, GLINT_SLOTS); lvl.needsUpdate = true;
    this.glints = spots.slice(0, n);
  }

  /** the far data arrived: build the street lamps (≈ 13k points, a few ms) */
  setFar(far: FarData) {
    const slab = this.opts.slab;
    this.street = [...streetLamps(far.lines, slab ? (x, z) => inPoly(x, z, slab) : undefined), ...ggbLights(), ...salesforceCrownLights(), ...bayLights(this.opts.bayBridge)];
    this.rebuild(this.sites);
  }

  /** more lights in the same draw (the satellite boards' towns, freeways, cranes and the Bay Bridge east span) */
  setExtra(specs: readonly LightSpec[]) {
    this.extra = [...specs];
    if (this.street.length) this.rebuild(this.sites);
  }

  /** the lights in the field (the glint slots not counted) */
  get count(): number { return this.points ? this.points.geometry.getAttribute('position').count - GLINT_SLOTS : 0; }
  get visible(): boolean { return !!this.points?.visible; }

  private rebuild(sites: LightSpec[]) {
    this.sites = sites;
    const lights = [...this.street, ...this.extra, ...sites];
    this.glintBase = lights.length;
    const g = pointsGeometry([...lights, ...Array.from({ length: GLINT_SLOTS }, (): LightSpec => ({ x: 0, y: -1e4, z: 0, level: 0, color: GOLD }))]);
    if (this.points) { this.points.geometry.dispose(); this.points.geometry = g; }
    else {
      this.points = new THREE.Points(g, LIGHT_FIELD);
      this.points.name = 'light-field';
      freezeStatic(this.points);
      this.points.frustumCulled = false;
      this.points.renderOrder = 2;
      this.group.add(this.points);
    }
    this.points.updateMatrixWorld(true);
    if (this.glints.length) this.writeGlints(this.glints);
  }

  update(dt: number, _t: number, camera: THREE.Camera, night: number) {
    const p = this.points;
    if (!p) return;
    // on from dusk (golden hour's 0.05 would cost a call for lamps nobody can see)
    p.visible = night > 0.15;
    if (!p.visible) { if (this.glints.length) this.writeGlints([]); return; }
    // coin glints: ≤ 5 Hz (coins do not move; lane E's draw list itself refreshes at ≤ 5 Hz)
    this.glintAt -= dt;
    if (this.glintAt <= 0) {
      this.glintAt = 0.2;
      const spots = this.glintSpots();
      if (spots.length || this.glints.length) this.writeGlints(spots);
    }
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
    this.disposed = true;
    this.points?.geometry.dispose();
    this.group.clear();
    this.points = null;
  }
}
