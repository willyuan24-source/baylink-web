import * as THREE from 'three';
import type { TimeOfDay } from '../../core/store';

/**
 * City haze (lane C2-4, checkpoint §3.1 issue 2 / CS-2). The time presets' FogExp2 densities are tuned for the
 * district (≈ 300 u across): over the whole city, downtown seen from Twin Peaks (≈ 900 u) sat under a 62–98 % fog
 * factor, and the old thinning measured height above the *local* ground, so the summit (≈ 10 u above its own ground)
 * got none. `cityFogK` scales the preset density (a uniform: no program ever recompiles) by
 *
 *   altitude     camera y above the water, 20 → 70 u        ×1 → ×0.45   (the Twin Peaks summit is y ≈ 50–60)
 *   height       camera above the ground under it, 30 → 150 u ×1 → ×0.4   (the old FOG_HIGH: QA / glide views)
 *   time         a per-time city scale, blended in from y 15 to 45 (morning stays the softest, night the clearest)
 *
 * A walking camera below y 15 (the waterfront, downtown, the Mission, the Sunset flats) keeps exactly today's fog.
 */
export const CITY_FOG = {
  altitude: { y0: 20, y1: 70, k: 0.45 },
  height: { y0: 30, y1: 150, k: 0.4 },
  time: { y0: 15, y1: 45, k: { morning: 0.85, day: 1, golden: 0.9, night: 0.45 } as Record<TimeOfDay, number> },
} as const;

const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/** Density multiplier of the city fog for a camera at y `camY` over ground `groundY` (pure; 1 = the preset). */
export function cityFogK(camY: number, groundY: number, tod: TimeOfDay): number {
  const F = CITY_FOG;
  const a = 1 + (F.altitude.k - 1) * smooth(F.altitude.y0, F.altitude.y1, camY);
  const h = 1 + (F.height.k - 1) * smooth(F.height.y0, F.height.y1, camY - Math.max(0, groundY));
  const t = 1 + (F.time.k[tod] - 1) * smooth(F.time.y0, F.time.y1, camY);
  return a * h * t;
}

/** FogExp2 fog factor at distance d for density ρ (what the shader computes): 1 − exp(−(ρ·d)²). */
export const fogFactor = (density: number, d: number) => 1 - Math.exp(-((density * d) ** 2));

// ---------------------------------------------------------------------------
// Karl the Fog (lane C2-8)
// ---------------------------------------------------------------------------

/**
 * Karl the Fog: San Francisco's marine layer as a height-limited western fog term plus a cloud bank (world/sf/
 * cloudBank.ts, city chunk). The term is a second fog, blended with the haze as 1 − (1 − fog)(1 − karl): every
 * material that shows the city gets it through `patchFog` (a string replace of `#include <fog_fragment>` in that
 * material's own shader; THREE.ShaderChunk is never touched, the site's Little Bay shares three), so TOY, TOY_DYN,
 * TOY_INST, the hero and D2's model material (all through `patchToyShader`), GROUND and the city water; the sky gets
 * a band on the western horizon (environment.ts). District mode keeps `uKarl = 0` (the branch never runs).
 *
 * Coverage in world space (city frame; W = true east, N = true north):
 *   west bank   everything west of `front` (u inland of Ocean Beach along W), lumpy edge (drifting noise ±110 u):
 *               the morning front reaches the Sutro slopes (Richmond ≈ 360, Presidio ≈ 530, Sutro Tower ≈ 690),
 *               golden hour only the outer avenues, by day it waits offshore
 *   gate lobe   a tongue through the Golden Gate along the strait (towards Alcatraz), `gate` × (across 80 → 200 u),
 *               out to `gateLen` u from the strait mouth (the bridge sits at ≈ 520)
 *   height      under `top` (≈ 30–36 u; the Twin Peaks summit ≈ 55 and the GGB towers 42 stay above it)
 * and a fragment inside it is whitened by 1 − exp(−depth / 300): walking in the Sunset you see ≈ 30 % at 100 u,
 * from Twin Peaks the Sunset lies under a ≈ 80 % blanket, and downtown (≈ 1,340 u inland) is never covered.
 */
export const KARL_GEO = {
  /** Ocean Beach, middle of the shore (a = 0 along W) */
  origin: { x: -377, z: 1503 },
  /** true east / true north in the city frame (core/geo projectCity) */
  east: { x: 0.6947, z: -0.7193 },
  north: { x: -0.7193, z: -0.6947 },
  /** the strait mouth west of the bridge and the axis through the Golden Gate towards Alcatraz */
  gate: { x: -1167, z: 927, dx: 0.5819, dz: -0.8131 },
  /** view depth (u) of Karl's whitening: amount = 1 − exp(−depth / depth) */
  depth: 300,
} as const;

export interface KarlTarget {
  /** 0 … 1: strength of the whole term (the time table) */
  level: number;
  /** west bank edge, u inland of Ocean Beach along true east */
  front: number;
  /** gate lobe amount and length (u from the strait mouth) */
  gate: number;
  gateLen: number;
  /** fog top (world y) */
  top: number;
  color: string;
}

/**
 * The time table (checkpoint C2-8: morning 1, day 0.15, golden 0.6, night 0.35). Morning pools over the Sunset and the
 * Richmond up to the Sutro slopes and fills the Gate; golden hour pours through the Gate (the deck in it, the towers
 * above) with the bank on the beach; by day it waits offshore; at night a thinner bank lit warm by the streets.
 */
export const KARL_TIME: Record<TimeOfDay, KarlTarget> = {
  morning: { level: 1, front: 560, gate: 0.85, gateLen: 760, top: 36, color: '#e2e6e9' },
  day: { level: 0.15, front: -330, gate: 0, gateLen: 0, top: 30, color: '#eceeef' },
  golden: { level: 0.6, front: 150, gate: 1, gateLen: 860, top: 31, color: '#f1dccd' },
  night: { level: 0.35, front: 380, gate: 0.7, gateLen: 700, top: 32, color: '#57525e' },
};

/** `?karl=0|1`: 0 = off, 1 = forced on (≥ 0.6 at every time; by day it comes in like golden hour), null = the table. */
export type KarlFlag = 0 | 1 | null;
export const parseKarlFlag = (v: string | null | undefined): KarlFlag => (v === '0' ? 0 : v === '1' ? 1 : null);

/** What Karl does at `tod` with the `?karl` flag (pure). */
export function karlTarget(tod: TimeOfDay, flag: KarlFlag): KarlTarget {
  const t = KARL_TIME[tod];
  if (flag === 0) return { ...t, level: 0 };
  if (flag === 1) return tod === 'day' ? { ...KARL_TIME.golden, level: 0.6, color: t.color } : { ...t, level: Math.max(t.level, 0.6) };
  return { ...t };
}


/**
 * Karl's coverage 0 … 1 at a world point (pure; the shader's obKarlCover with the noise at its mean): west bank or
 * gate lobe, times the height term. For tests and the cloud bank layout.
 */
export function karlCover(x: number, y: number, z: number, t: KarlTarget): number {
  const G = KARL_GEO;
  const a = (x - G.origin.x) * G.east.x + (z - G.origin.z) * G.east.z;
  const west = 1 - smooth(t.front - 150, t.front + 30, a);
  const gx = x - G.gate.x, gz = z - G.gate.z;
  const along = gx * G.gate.dx + gz * G.gate.dz, across = Math.abs(-gx * G.gate.dz + gz * G.gate.dx);
  const lobe = t.gate * (1 - smooth(80, 200, across)) * (1 - smooth(t.gateLen - 160, t.gateLen, along)) * smooth(-420, -300, along);
  return Math.max(west, lobe) * (1 - smooth(t.top - 16, t.top + 6, y));
}

/** Karl's uniforms (shared by every patched material; the environment writes them, district leaves uKarl at 0). */
export const KARL = {
  uKarl: { value: 0 },
  uKarlColor: { value: new THREE.Color(KARL_TIME.golden.color) },
  /** front (u along true east), top (y), gate amount, gate length */
  uKarlA: { value: new THREE.Vector4(KARL_TIME.golden.front, KARL_TIME.golden.top, 0, 0) },
  /** noise drift (u, along true east) */
  uKarlDrift: { value: 0 },
};

const f1 = (v: number) => v.toFixed(4);
/** GLSL: Karl's uniforms, coverage and amount (usable in vertex and fragment shaders). */
export const KARL_GLSL = /* glsl */ `
uniform float uKarl;
uniform vec3 uKarlColor;
uniform vec4 uKarlA;
uniform float uKarlDrift;
float obKarlH(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float obKarlN(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(obKarlH(i), obKarlH(i + vec2(1.0, 0.0)), u.x), mix(obKarlH(i + vec2(0.0, 1.0)), obKarlH(i + vec2(1.0, 1.0)), u.x), u.y);
}
float obKarlCover(vec3 w) {
  const vec2 E = vec2(${f1(KARL_GEO.east.x)}, ${f1(KARL_GEO.east.z)});
  const vec2 O = vec2(${f1(KARL_GEO.origin.x)}, ${f1(KARL_GEO.origin.z)});
  const vec2 G = vec2(${f1(KARL_GEO.gate.x)}, ${f1(KARL_GEO.gate.z)});
  const vec2 GD = vec2(${f1(KARL_GEO.gate.dx)}, ${f1(KARL_GEO.gate.dz)});
  vec2 dr = w.xz - E * uKarlDrift;
  float n = obKarlN(dr * 0.006) * 0.65 + obKarlN(dr * 0.019 + 7.3) * 0.35 - 0.5;
  float a = dot(w.xz - O, E) + n * 220.0;
  float west = 1.0 - smoothstep(uKarlA.x - 150.0, uKarlA.x + 30.0, a);
  vec2 g = w.xz - G;
  float along = dot(g, GD) + n * 120.0, across = abs(dot(g, vec2(-GD.y, GD.x))) + n * 90.0;
  float lobe = uKarlA.z * (1.0 - smoothstep(80.0, 200.0, across)) * (1.0 - smoothstep(uKarlA.w - 160.0, uKarlA.w, along)) * smoothstep(-420.0, -300.0, along);
  float top = uKarlA.y + n * 12.0;
  return max(west, lobe) * (1.0 - smoothstep(top - 16.0, top + 6.0, w.y));
}
// 0 … 1: how much of Karl's colour lies over a point at world position w seen from depth (u) away
float obKarl(vec3 w, float depth) {
  if (uKarl <= 0.0) return 0.0;
  return uKarl * obKarlCover(w) * (1.0 - exp(-max(depth, 0.0) / ${KARL_GEO.depth.toFixed(1)}));
}
`;

/** The shader pieces patchFog edits: anything with the three strings and a uniforms map (onBeforeCompile's shader or a ShaderMaterial). */
export interface FogPatchable { vertexShader: string; fragmentShader: string; uniforms: Record<string, THREE.IUniform> }

/**
 * Karl the Fog for one material (call it from the material's onBeforeCompile, or on a ShaderMaterial before its first
 * compile): adds the Karl uniforms and replaces `#include <fog_fragment>` with Karl's term followed by the same include,
 * so three's own fog runs unchanged after it (1 − (1 − fog)(1 − karl)). `world` names a varying that already holds the
 * fragment's world position (TOY / GROUND: 'vWPos'); without it patchFog adds its own (from `mvPosition` next to
 * `#include <fog_vertex>`). No-op without a fog include, and applied at most once. THREE.ShaderChunk is never touched.
 * For lanes E2 / F: `patchFog(shader)` on their own non-TOY materials (C2 → E2, F in the contracts).
 */
export function patchFog(shader: FogPatchable, opts: { world?: string } = {}): void {
  if (!shader.fragmentShader.includes('#include <fog_fragment>') || shader.fragmentShader.includes('obKarlCover')) return;
  Object.assign(shader.uniforms, KARL);
  let w = opts.world;
  if (!w) {
    if (!shader.vertexShader.includes('#include <fog_vertex>')) return;
    w = 'vObKarlW';
    shader.vertexShader = shader.vertexShader
      .replace('#include <fog_pars_vertex>', '#include <fog_pars_vertex>\nvarying vec3 vObKarlW;')
      .replace('#include <fog_vertex>', '#include <fog_vertex>\nvObKarlW = cameraPosition + mvPosition.xyz * mat3(viewMatrix);');
    shader.fragmentShader = shader.fragmentShader.replace('#include <fog_pars_fragment>', '#include <fog_pars_fragment>\nvarying vec3 vObKarlW;');
  }
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <fog_pars_fragment>', `#include <fog_pars_fragment>\n${KARL_GLSL}`)
    .replace('#include <fog_fragment>', /* glsl */ `#ifdef USE_FOG
if (uKarl > 0.0) gl_FragColor.rgb = mix(gl_FragColor.rgb, uKarlColor, obKarl(${w}, vFogDepth));
#endif
#include <fog_fragment>`);
}

/** Seconds Karl takes to slide from one time's layout to the next (the cloud bank moves with it). */
export const KARL_SLIDE = 45;
/** Drift of the fog's lumpy edge and of the clouds (u/s, inland). */
export const KARL_WIND = 0.9;

type KarlValues = Omit<KarlTarget, 'color'>;
const KEYS = ['level', 'front', 'gate', 'gateLen', 'top'] as const;

/**
 * Karl's live state (city mode; the environment owns one): the time table, the `?karl` flag, a KARL_SLIDE-second slide
 * between layouts (morning: the bank rolls in from the Pacific), the drift, and the uniforms. `epoch` bumps on every
 * retarget and `t` runs 0 → 1, so the cloud bank moves its clusters from where they are to the new layout in step.
 */
export class KarlState {
  flag: KarlFlag = null;
  tod: TimeOfDay = 'golden';
  epoch = 0;
  /** slide progress 0 … 1 (eased with smoothstep) */
  t = 1;
  drift = 0;
  readonly cur: KarlValues = { ...karlTarget('golden', null) };
  readonly color = new THREE.Color(KARL_TIME.golden.color);
  private from: KarlValues = { ...this.cur };
  private to: KarlTarget = karlTarget('golden', null);
  private fromColor = new THREE.Color();
  private toColor = new THREE.Color();

  /** the layout the cloud bank heads for */
  get target(): KarlTarget { return this.to; }

  setTime(tod: TimeOfDay, instant: boolean) {
    this.tod = tod;
    this.retarget(instant);
  }

  setFlag(flag: KarlFlag) {
    this.flag = flag;
    this.retarget(true);
  }

  private retarget(instant: boolean) {
    this.to = karlTarget(this.tod, this.flag);
    this.from = { ...this.cur };
    this.fromColor.copy(this.color);
    this.toColor.set(this.to.color);
    this.t = instant ? 1 : 0;
    this.epoch++;
    this.step(0);
  }

  update(dt: number) {
    this.drift += dt * KARL_WIND;
    this.step(dt);
  }

  private step(dt: number) {
    if (this.t < 1) this.t = Math.min(1, this.t + dt / KARL_SLIDE);
    const e = smooth(0, 1, this.t);
    for (const k of KEYS) this.cur[k] = this.from[k] + (this.to[k] - this.from[k]) * e;
    // a bank that is coming in shows at once, one that leaves fades with the slide
    this.color.copy(this.fromColor).lerp(this.toColor, e);
    const u = KARL;
    u.uKarl.value = this.cur.level;
    u.uKarlColor.value.copy(this.color);
    u.uKarlA.value.set(this.cur.front, this.cur.top, this.cur.gate, this.cur.gateLen);
    u.uKarlDrift.value = this.drift;
  }
}
