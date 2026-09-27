import * as THREE from 'three';
import type { TimeOfDay } from '../../core/store';
import { KARL, KARL_GEO, type KarlFlag } from '../fogShader';

// the shader side of Karl (uniforms, GLSL, patchFog, the ?karl flag) lives in the main graph (world/fogShader.ts, wave 3
// P7: materials / environment need it in both modes); everything else here is city-only (the lazy city chunk)
export { KARL, KARL_GEO, KARL_GLSL, parseKarlFlag, patchFog } from '../fogShader';
export type { FogPatchable, KarlFlag } from '../fogShader';

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
 *               golden hour rolls in over the outer half of the Sunset, by day it waits offshore
 *   gate lobe   a tongue through the Golden Gate along the strait (towards Alcatraz), `gate` × (across 95 → 175 u),
 *               out to `gateLen` u from the strait mouth (the bridge sits at ≈ 520)
 *   height      under `top` (≈ 32–40 u; the Twin Peaks summit ≈ 55 and the GGB towers 42 stay above it)
 * and a fragment inside it is whitened by 1 − exp(−(L − 15) / 80), L = the length of the view ray inside the layer
 * (M3, wave 3: from above, only the part below the top): walking in the Sunset ≈ 65 % is gone at 100 u (the first 15 u
 * stay clear: the player and BAYBAY), from Twin Peaks the Sunset lies under an opaque white sea with a lumpy top (the
 * hills stand out of it), and downtown (≈ 1,340 u inland) is never covered.
 */

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
 * The time table (checkpoint C2-8: morning 1, day 0.15, golden 0.6, night 0.35; M3, wave 3: golden 0.9, whiter, rolling in
 * over the outer half of the Sunset). Morning pools over the Sunset and the Richmond up to the Sutro slopes and fills the
 * Gate; golden hour pours through the Gate (the deck in it, the towers above) while the bank rolls in over the outer
 * avenues; by day it waits offshore; at night a thinner bank lit warm by the streets.
 */
export const KARL_TIME: Record<TimeOfDay, KarlTarget> = {
  morning: { level: 1, front: 680, gate: 0.85, gateLen: 760, top: 40, color: '#e2e6e9' },
  day: { level: 0.15, front: -330, gate: 0, gateLen: 0, top: 30, color: '#eceeef' },
  golden: { level: 0.9, front: 380, gate: 1, gateLen: 860, top: 35, color: '#f5e7dd' },
  night: { level: 0.35, front: 450, gate: 0.7, gateLen: 700, top: 32, color: '#57525e' },
};


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
  const west = 1 - smooth(t.front - G.edge[0], t.front + G.edge[1], a);
  const gx = x - G.gate.x, gz = z - G.gate.z;
  const along = gx * G.gate.dx + gz * G.gate.dz, across = Math.abs(-gx * G.gate.dz + gz * G.gate.dx);
  const lobe = t.gate * (1 - smooth(95, 175, across)) * (1 - smooth(t.gateLen - 160, t.gateLen, along)) * smooth(-420, -300, along);
  return Math.max(west, lobe) * (1 - smooth(t.top - G.topSoft[0], t.top + G.topSoft[1], y));
}

/**
 * How much of Karl's colour lies over a world point seen from `cam` at view depth `depth` (pure; the shader's obKarl with
 * the noise at its mean, before `level`): the length of the view ray inside the layer over the extinction length
 * (from above the top only the part below it; from inside the bank the whole ray, and the camera's own ground counts).
 */
export function karlAmount(p: { x: number; y: number; z: number }, cam: { x: number; y: number; z: number }, depth: number, t: KarlTarget): number {
  let c = karlCover(p.x, p.y, p.z, t);
  let portion: number, len: number = KARL_GEO.depth;
  if (cam.y > t.top) { portion = Math.min(1, Math.max(0, (t.top - p.y) / Math.max(cam.y - p.y, 0.5))); len = KARL_GEO.depthAbove; }
  else {
    c = Math.max(c, 0.6 * karlCover(cam.x, -1e3, cam.z, t));
    portion = p.y <= t.top ? 1 : Math.min(1, Math.max(0, (t.top - cam.y) / Math.max(p.y - cam.y, 0.5)));
  }
  return c * (1 - Math.exp(-Math.max(depth - KARL_GEO.clear, 0) * portion / len));
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
