import * as THREE from 'three';
import { game } from '../core/store';
import { heightAt } from '../core/terrain';
import { CBOX, CYL, ICO, M, Batch, type Info } from '../world/builder';
import { TOY_INST, TOY_INST_TINT } from '../world/materials';
import { PROCESSION } from './muertosSpots';
import type { HaloSpot } from './worldHalos';

/**
 * Wave 7 · lane H (W7-H6) · the Día de los Muertos procession, 2 November (halloween/muertos.ts muertosSchedule): toy
 * walkers in long robes with calavera-white faces, marigold crowns and a lit candle each —
 *
 *   18:00 – 19:00  they gather at 22nd & Bryant (standing about on Bryant just NORTH of 22nd, candles lit: SFMTA's
 *                  2025 notice stages the procession "on Bryant, between 19th and 22nd streets" — W7-H-review)
 *   19:00 – 21:00  they walk the route in two files in the curb lane — south on Bryant, west on 24th, north on Mission, east
 *                  on 22nd back to Bryant (muertosSpots.ts PROCESSION, SFMTA's 2025 route) — at a slow walk, and at every
 *                  corner the head stops for a moment (the real procession pauses at the main corners for the Aztec
 *                  dancers' ritual dance: NBC Bay Area / funcheap on the 2025 procession); around and around until 21:00
 *
 * Quiet and respectful: no sound of their own, no reward, no costume play. Two InstancedMeshes (the robes on
 * TOY_INST_TINT: the instance colour is the robe; the faces, crowns, hands and candles on TOY_INST), both receiveShadow
 * like the city's instanced props (their programs are warmed at boot): 2 calls, only in the Mission and only then.
 * WALKERS_BY_QUALITY walkers (≈ 330 triangles each). The toy traffic stops for them (world/sf/roadPeople.ts).
 *
 * W8-H: the robe stops above the ankles and two legs swing under it while they walk (still at the corners and while they
 * gather); the robes' InstancedMesh carries FOUR instances a walker — the robe, the candle arm's sleeve and the two legs,
 * all one unit cylinder scaled by the instance matrix (the legs pivot at the hip) — so still 2 calls (WALKER_PARTS).
 * And they step aside for the player (and BAYBAY): a walker whose place in the files comes within ASIDE.radius of one slides
 * sideways off the player's line (smoothly, ASIDE.rate), the two files part round someone standing in their lane and
 * close again behind; BAYBAY then says w8-h-procession-aside (muertos.ts near()).
 */

export const WALKERS_BY_QUALITY: Readonly<Record<'low' | 'mid' | 'high', number>> = { low: 14, mid: 26, high: 40 };
/** u/s along the route; the rows' spacing (u); the two files' half spread (u); the head's pause at each corner (s) */
export const WALK = { speed: 0.7, row: 1.25, spread: 0.34, pause: 18 } as const;
/**
 * (W8-H) stepping aside: a walker whose spot in the files is within `radius` (u) of the player (and within `ahead` along
 * the walking direction) slides sideways until it clears the player by `radius`; `rate` (1/s) the smoothing, `max` (u)
 * the farthest it goes off its file; (W8-H-review) `pair` (u) the least gap across between the two walkers of a row
 */
export const ASIDE = { radius: 1.0, ahead: 1.6, rate: 5, max: 1.4, pair: 0.6 } as const;
/** (W8-H) the legs: the hip's height, the half gap between the legs, the swing (rad) while walking, its rate (rad/s) */
export const LEGS = { hip: 0.3, gap: 0.075, swing: 0.5, rate: 6.5 } as const;
/** (W8-H) instances a walker in the robes' mesh: the robe, the sleeve, the left leg, the right leg */
export const WALKER_PARTS = 4;

const ROBES = ['#26212c', '#f1ece2', '#6c3483', '#b8245e', '#e0761f', '#1f7a74', '#8e2a2a', '#3b3f7a'];
/** (W8-H) the legs under the robe: dark trousers / stockings */
const LEG = '#2b2530';
const FACE = '#f4efe6', SOCKET = '#1f1b24', SKIN = '#c98f66', WAX = '#f6efe0', FLAME = '#ffcf6a';
const MARIGOLD = ['#f39c12', '#f5b041', '#e67e22'];
const NONE: Info = [0, 0, 0, 0];
const FLAME_GLOW: Info = [0, 0, 0, 1.8];
const CANDLE_HALO = new THREE.Color(1.0, 0.66, 0.3);
/** where the candle's flame is on a walker (local: x right, y up, z forward) */
const FLAME_AT = { x: 0.13, y: 0.83, z: 0.3 } as const;

// --- the route ------------------------------------------------------------------------------------------------------

interface Route { x: Float32Array; z: Float32Array; y: Float32Array; s: Float32Array; length: number }
let route: Route | null = null;
/** The procession's closed route (muertosSpots.ts PROCESSION) with the arc length of every sample. */
export function processionRoute(): Route {
  if (route) return route;
  const n = PROCESSION.length / 3;
  const x = new Float32Array(n), z = new Float32Array(n), y = new Float32Array(n), s = new Float32Array(n + 1);
  for (let i = 0; i < n; i++) { x[i] = PROCESSION[i * 3]; z[i] = PROCESSION[i * 3 + 1]; y[i] = PROCESSION[i * 3 + 2]; }
  for (let i = 1; i <= n; i++) { const j = i % n; s[i] = s[i - 1] + Math.hypot(x[j] - x[i - 1], z[j] - z[i - 1]); }
  return (route = { x, z, y, s, length: s[n] });
}

/** A point of the route at arc length `at` (wraps): position, ground y, the heading (sin, cos of the walking direction). */
export function routeAt(at: number, out = { x: 0, y: 0, z: 0, hx: 0, hz: 1 }): typeof out {
  const r = processionRoute(), n = r.x.length;
  let s = at % r.length;
  if (s < 0) s += r.length;
  // binary search the segment
  let lo = 0, hi = n;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (r.s[m] <= s) lo = m; else hi = m; }
  const j = (lo + 1) % n, len = r.s[lo + 1] - r.s[lo] || 1, t = (s - r.s[lo]) / len;
  out.x = r.x[lo] + (r.x[j] - r.x[lo]) * t;
  out.z = r.z[lo] + (r.z[j] - r.z[lo]) * t;
  out.y = r.y[lo] + (r.y[j] - r.y[lo]) * t;
  out.hx = (r.x[j] - r.x[lo]) / len;
  out.hz = (r.z[j] - r.z[lo]) / len;
  return out;
}

/** The corners' arc lengths (the route's sharpest turns: 22nd & Bryant, 24th & Bryant, 24th & Mission, 22nd & Mission). */
let cornerCache: number[] | null = null;
export function processionCorners(): readonly number[] {
  if (cornerCache) return cornerCache;
  const r = processionRoute(), n = r.x.length;
  const turn: { s: number; a: number }[] = [];
  for (let i = 0; i < n; i++) {
    const p = (i + n - 1) % n, q = (i + 1) % n;
    const a0 = Math.atan2(r.x[i] - r.x[p], r.z[i] - r.z[p]), a1 = Math.atan2(r.x[q] - r.x[i], r.z[q] - r.z[i]);
    let d = Math.abs(a1 - a0);
    if (d > Math.PI) d = 2 * Math.PI - d;
    turn.push({ s: r.s[i], a: d });
  }
  return (cornerCache = turn.sort((a, b) => b.a - a.a).slice(0, 4).map(t => t.s).sort((a, b) => a - b));
}

/**
 * (W7-H-review) The head's arc length while gathering: GATHER_BACK u BEFORE the route's start — the rows stand on Bryant
 * north of 22nd (SFMTA, the 2025 procession: "staging at approximately 6 p.m. on Bryant, between 19th and 22nd streets";
 * https://www.sfmta.com/travel-updates/dia-de-los-muertos-procession-sunday-november-2-2025, checked 2026-09-30), the
 * tail further up Bryant; at 19:00 the column walks south through 22nd & Bryant onto the route. Lane H first stood them
 * on the route's first leg, south of 22nd.
 */
export const GATHER_BACK = 6;
export const gatherHead = (): number => -GATHER_BACK;

/** the lead-in's ground is sampled every 1 u up to this far before the route's start */
const LEAD_MAX = 48;
/**
 * A point at arc length `at`, where `at` < 0 is the lead-in: on Bryant north of 22nd & Bryant, the route's first heading
 * (south) extended backwards, facing south; its ground y from `leadY` (sampled once by createWalkers: y[i] at −i u), else
 * the route's y at the start. `at` ≥ 0 is routeAt.
 */
export function placeAt(at: number, out = { x: 0, y: 0, z: 0, hx: 0, hz: 1 }, leadY: Float32Array | null = null): typeof out {
  if (at >= 0) return routeAt(at, out);
  routeAt(0, out);
  out.x += out.hx * at;
  out.z += out.hz * at;
  if (leadY) {
    const f = Math.min(LEAD_MAX, -at), i = Math.min(LEAD_MAX - 1, Math.floor(f)), t = f - i;
    out.y = leadY[i] + (leadY[i + 1] - leadY[i]) * t;
  }
  return out;
}

/** The lead-in's ground (the published city's terrain in the game), every 1 u; a sample far off the start's y keeps it. */
function leadGround(ground: (x: number, z: number) => number): Float32Array {
  const p = routeAt(0), y = new Float32Array(LEAD_MAX + 1);
  for (let i = 0; i <= LEAD_MAX; i++) {
    const h = ground(p.x - p.hx * i, p.z - p.hz * i);
    y[i] = Number.isFinite(h) && Math.abs(h - p.y) < 3 ? h : p.y;
  }
  return y;
}

/**
 * The head's arc length `walkS` seconds after 19:00 (it leaves the gathering at WALK.speed — first the lead-in down Bryant to
 * 22nd, no stop there: the procession sets off — and stops WALK.pause s each time it reaches a corner), and whether it
 * stands in a pause. Pure; `out` is filled and returned (one object a frame: no allocation).
 */
export function headAt(walkS: number, _count: number, out = { s: 0, paused: false }): { s: number; paused: boolean } {
  const L = processionRoute().length, corners = processionCorners(), v = WALK.speed, P = WALK.pause;
  let s = gatherHead(), t = Math.max(0, walkS);
  out.paused = false;
  if (s < 0) {
    const lead = -s / v;
    if (t <= lead) { out.s = s + t * v; return out; }
    t -= lead;
    s = 0;
  }
  const lap = L / v + corners.length * P;
  const laps = Math.floor(t / lap);
  s += laps * L;
  t -= laps * lap;
  for (let k = 0; k < corners.length * 2 + 1; k++) {
    // the next corner ahead of s (a corner exactly at s is behind: its pause is over)
    const base = Math.floor(s / L) * L;
    let next = Infinity;
    for (let c = 0; c < corners.length; c++) {
      const a = base + corners[c], b = a + L;
      if (a > s + 1e-6) { if (a < next) next = a; } else if (b > s + 1e-6 && b < next) next = b;
    }
    const dt = (next - s) / v;
    if (t <= dt) { out.s = s + t * v; return out; }
    t -= dt;
    s = next;
    if (t <= P) { out.s = s; out.paused = true; return out; }
    t -= P;
  }
  out.s = s;
  return out;
}

// --- the figures ------------------------------------------------------------------------------------------------------

let geo: { robe: THREE.BufferGeometry; rest: THREE.BufferGeometry } | null = null;
/**
 * The two halves of a walker (feet at the origin, facing +z): `robe` — W8-H: ONE unit cylinder (base radius 1, top 0.55,
 * height 1 from y 0; white: the instance colour paints it) that the robes' mesh draws WALKER_PARTS times a walker, scaled
 * by `partMatrix` into the robe, the sleeve and the two legs — and `rest` (face, crown, hand, candle: one instance).
 */
export function walkerGeometry(): { robe: THREE.BufferGeometry; rest: THREE.BufferGeometry } {
  if (geo) return geo;
  const a = new Batch();
  a.add(CYL(10, 0.55), M(0, 0, 0, 0), '#ffffff', NONE);
  const b = new Batch();
  b.add(ICO(1), M(0, 0.95, 0, 0, 0.15, 0.16, 0.15), FACE, NONE);
  // the calavera's painted eye sockets and nose
  for (const sx of [-0.055, 0.055]) b.add(CBOX(), M(sx, 0.97, 0.135, 0, 0.055, 0.05, 0.02), SOCKET, NONE);
  b.add(CBOX(), M(0, 0.925, 0.145, 0, 0.025, 0.025, 0.015), SOCKET, NONE);
  // the marigold crown
  for (let i = 0; i < 5; i++) {
    const ang = -1.2 + i * 0.6;
    b.add(ICO(0), M(Math.sin(ang) * 0.13, 1.06, Math.cos(ang) * 0.1, ang, 0.055, 0.045, 0.055), MARIGOLD[i % 3], NONE);
  }
  // the hand and the candle
  b.add(ICO(0), M(FLAME_AT.x, 0.64, FLAME_AT.z, 0, 0.045, 0.04, 0.045), SKIN, NONE);
  b.add(CYL(5), M(FLAME_AT.x, 0.64, FLAME_AT.z, 0, 0.028, 0.15, 0.028), WAX, NONE);
  b.add(ICO(0), M(FLAME_AT.x, FLAME_AT.y, FLAME_AT.z, 0, 0.024, 0.045, 0.024), FLAME, FLAME_GLOW);
  return (geo = { robe: a.build(), rest: b.build() });
}

/** (W8-H) the robe's hem (u above the feet) — the legs show below it */
const HEM = 0.24;
const _pq = new THREE.Quaternion(), _pp = new THREE.Vector3(), _ps = new THREE.Vector3(), _px = new THREE.Vector3(1, 0, 0);
/** the sleeve: from the shoulder forward and a little down to the candle hand (local), fixed */
const SLEEVE = (() => {
  const from = new THREE.Vector3(0.12, 0.7, 0.04), to = new THREE.Vector3(FLAME_AT.x, 0.63, FLAME_AT.z);
  const d = to.clone().sub(from), len = d.length();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  return new THREE.Matrix4().compose(from, q, new THREE.Vector3(0.05, len, 0.05));
})();
const ROBE = new THREE.Matrix4().compose(new THREE.Vector3(0, HEM, 0), new THREE.Quaternion(), new THREE.Vector3(0.26, 0.8 - HEM, 0.26));
/**
 * (W8-H) A part's local matrix (feet at the origin, facing +z): 0 the robe, 1 the sleeve, 2 / 3 the left / right leg
 * swung `swing` rad about the hip (forward +); `out` is filled and returned.
 */
export function partMatrix(part: number, swing: number, out = new THREE.Matrix4()): THREE.Matrix4 {
  if (part === 0) return out.copy(ROBE);
  if (part === 1) return out.copy(SLEEVE);
  // a leg: a cylinder from the foot (y 0) up to the hip, turned about the hip's x axis: T(hip) · Rx · T(0, −hip) · S
  const side = part === 2 ? 1 : -1, a = part === 2 ? swing : -swing;
  _pq.setFromAxisAngle(_px, -a);
  _pp.set(0, -LEGS.hip, 0).applyQuaternion(_pq).add(_ps.set(side * LEGS.gap, LEGS.hip, 0));
  return out.compose(_pp, _pq, _ps.set(0.05, LEGS.hip + 0.02, 0.05));
}

/** (W8-H) triangles a walker draws: the unit cylinder WALKER_PARTS times and the rest once */
export function walkerTriangles(): number {
  const g = walkerGeometry();
  return (WALKER_PARTS * (g.robe.index?.count ?? 0) + (g.rest.index?.count ?? 0)) / 3;
}

const hash = (i: number) => { let h = (i + 0x51ed) | 0; h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d); h = Math.imul(h ^ (h >>> 12), 0x297a2d39); return ((h ^ (h >>> 15)) >>> 0) / 4294967296; };

export interface Walkers {
  group: THREE.Group;
  /**
   * per frame while the procession is on (`phase` 'gather' | 'walk'), `walkS` since 19:00, `clock` any running seconds;
   * (W8-H) the player at (px, pz) and BAYBAY at (gx, gz) — the walkers step aside for both — and `dt` the frame's
   * seconds (the step-aside smoothing)
   */
  step(phase: 'gather' | 'walk', walkS: number, clock: number, px?: number, pz?: number, dt?: number, gx?: number, gz?: number): void;
  /** (W8-H) some walker is stepping round the player right now */
  aside(): boolean;
  /** the candles' halos while they stand (gathering); none while walking (the flames glow) */
  halos(): readonly HaloSpot[];
  count(): number;
  /** the nearest walker within `max` of (x, z) */
  near(x: number, z: number, max: number): boolean;
  /** where each walker stands (the traffic's people) */
  each(fn: (x: number, z: number) => void): void;
  dispose(): void;
}

export function createWalkers(ground: (x: number, z: number) => number = heightAt): Walkers {
  const q = game.get().settings.quality;
  const count = WALKERS_BY_QUALITY[q] ?? WALKERS_BY_QUALITY.mid;
  const g = walkerGeometry();
  // W8-H: the robes' mesh draws WALKER_PARTS instances a walker: [robes][sleeves][left legs][right legs]
  const robes = new THREE.InstancedMesh(g.robe, TOY_INST_TINT, count * WALKER_PARTS);
  const rest = new THREE.InstancedMesh(g.rest, TOY_INST, count);
  const c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    c.set(ROBES[Math.floor(hash(i * 7 + 3) * ROBES.length)]);
    robes.setColorAt(i, c);
    robes.setColorAt(count + i, c);
    c.set(LEG);
    robes.setColorAt(2 * count + i, c);
    robes.setColorAt(3 * count + i, c);
  }
  for (const m of [robes, rest]) {
    m.receiveShadow = true;
    m.castShadow = false;
    m.matrixAutoUpdate = false;
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    // the whole route's circle: culled as one when the camera looks away
    const r = processionRoute();
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (let i = 0; i < r.x.length; i++) { x0 = Math.min(x0, r.x[i]); x1 = Math.max(x1, r.x[i]); z0 = Math.min(z0, r.z[i]); z1 = Math.max(z1, r.z[i]); }
    m.boundingSphere = new THREE.Sphere(new THREE.Vector3((x0 + x1) / 2, 4, (z0 + z1) / 2), Math.hypot(x1 - x0, z1 - z0) / 2 + 4);
  }
  robes.name = 'muertos-procession-robes';
  rest.name = 'muertos-procession';
  const group = new THREE.Group();
  group.name = 'halloween-procession';
  group.add(robes, rest);
  const px = new Float32Array(count), pz = new Float32Array(count);
  // W8-H: each walker's sideways slide off its file (u, + = left of the walking direction), smoothed toward its target
  const dodge = new Float32Array(count);
  // W8-H-review: each walker's wanted slide this frame (the pair rule below reads both of a row before either moves)
  const wants = new Float32Array(count);
  let asideNow = false;
  const m4 = new THREE.Matrix4(), pm = new THREE.Matrix4(), part = new THREE.Matrix4(), qt = new THREE.Quaternion(), qr = new THREE.Quaternion(), pos = new THREE.Vector3(), scl = new THREE.Vector3(1, 1, 1);
  const up = new THREE.Vector3(0, 1, 0), fwd = new THREE.Vector3(0, 0, 1), f = new THREE.Vector3();
  const at = { x: 0, y: 0, z: 0, hx: 0, hz: 1 };
  const head = { s: 0, paused: false };
  // the lead-in's ground on Bryant north of 22nd (W7-H-review: they gather there), sampled once
  const leadY = leadGround(ground);
  let halos: HaloSpot[] = [];
  let gathered = false;
  // walker i's place along the route (row behind the head, a little jitter) and across it (its file, + = left)
  const sOf = (i: number, gather: boolean) => head.s - (i >> 1) * WALK.row + (hash(i) - 0.5) * (gather ? 0.7 : 0.3);
  const latOf = (i: number, gather: boolean) => (i & 1 ? 1 : -1) * WALK.spread + (hash(i + 101) - 0.5) * (gather ? 0.5 : 0.14);
  return {
    group,
    step: (phase, walkS, clock, playerX, playerZ, dt = 0, guideX, guideZ) => {
      if (phase === 'walk') headAt(walkS, count, head);
      else { head.s = gatherHead(); head.paused = true; }
      const gather = phase === 'gather';
      const k = 1 - Math.exp(-ASIDE.rate * Math.max(0, Math.min(dt, 0.1)));
      const player = playerX !== undefined && playerZ !== undefined && Number.isFinite(playerX) && Number.isFinite(playerZ);
      const guide = guideX !== undefined && guideZ !== undefined && Number.isFinite(guideX) && Number.isFinite(guideZ);
      asideNow = false;
      wants.fill(0);
      if (player || guide) {
        for (let i = 0; i < count; i++) {
          const side = i & 1 ? 1 : -1;
          placeAt(sOf(i, gather), at, leadY);
          const lat = latOf(i, gather);
          // W8-H: step aside for the player and BAYBAY — their place in this walker's frame (along / across its file); the
          // stronger push wins
          let want = 0;
          const bx = at.x - at.hz * lat, bz = at.z + at.hx * lat;
          for (let o = 0; o < 2; o++) {
            if (o === 0 ? !player : !guide) continue;
            const dx = (o === 0 ? playerX! : guideX!) - bx, dz = (o === 0 ? playerZ! : guideZ!) - bz;
            const along = dx * at.hx + dz * at.hz, across = dx * -at.hz + dz * at.hx;
            if (Math.abs(along) >= ASIDE.ahead || Math.abs(across) >= ASIDE.radius) continue;
            // slide away from its side (exactly on the line: each file keeps its own side)
            const away = across > 0.02 ? -1 : across < -0.02 ? 1 : side;
            const w = away * (ASIDE.radius - Math.abs(across)) * (1 - (Math.abs(along) / ASIDE.ahead) * 0.5);
            if (Math.abs(w) > Math.abs(want)) want = Math.max(-ASIDE.max, Math.min(ASIDE.max, w));
          }
          wants[i] = want;
        }
        // W8-H-review: the two walkers of a row part as a pair. Pushed one by one, a player standing just beside a file
        // sent that file's walker across onto the other file's line (0.14 u apart: two robes merged into one); now the
        // walker stepping round someone harder keeps its place and its row-mate makes room beyond it, on its own side
        for (let a = 0; a + 1 < count; a += 2) {
          const b = a + 1, ta = latOf(a, gather) + wants[a], tb = latOf(b, gather) + wants[b];
          if (Math.abs(tb - ta) >= ASIDE.pair || (wants[a] === 0 && wants[b] === 0)) continue;
          const keep = Math.abs(wants[a]) >= Math.abs(wants[b]) ? a : b, move = keep === a ? b : a;
          const at2 = (keep === a ? ta : tb) + (move & 1 ? 1 : -1) * ASIDE.pair;
          wants[move] = Math.max(-ASIDE.max, Math.min(ASIDE.max, at2 - latOf(move, gather)));
        }
      }
      for (let i = 0; i < count; i++) {
        const h3 = hash(i + 202);
        placeAt(sOf(i, gather), at, leadY);
        // left of the walking direction is (−hz, hx)… the files either side of the line
        const lat = latOf(i, gather);
        const want = wants[i];
        dodge[i] += (want - dodge[i]) * (dt > 0 ? k : 1);
        if (Math.abs(dodge[i]) > 0.15) asideNow = true;
        const latD = lat + dodge[i];
        const x = at.x - at.hz * latD, z = at.z + at.hx * latD;
        let yaw = Math.atan2(at.hx, at.hz);
        let bob = 0;
        if (gather) yaw += (h3 - 0.5) * 2.2 + Math.sin(clock * 0.3 + i) * 0.15;
        else if (head.paused) bob = 0.05 * Math.abs(Math.sin(clock * 3.2 + i * 0.7));
        else bob = 0.03 * Math.abs(Math.sin(clock * 6.5 + i * 1.3));
        const roll = gather ? 0 : Math.sin(clock * (head.paused ? 3.2 : 6.5) + i * 1.3) * 0.04;
        qt.setFromAxisAngle(up, yaw);
        if (roll) qt.multiply(qr.setFromAxisAngle(fwd, roll));
        pos.set(x, at.y + bob, z);
        m4.compose(pos, qt, scl);
        rest.setMatrixAt(i, m4);
        // W8-H: the robe, the sleeve and the two legs (swinging while they walk; still at a corner pause or gathering)
        const swing = gather || head.paused ? 0 : LEGS.swing * Math.sin(clock * LEGS.rate + i * 1.3);
        for (let p = 0; p < WALKER_PARTS; p++) robes.setMatrixAt(p * count + i, pm.multiplyMatrices(m4, partMatrix(p, swing, part)));
        px[i] = x; pz[i] = z;
      }
      robes.instanceMatrix.needsUpdate = true;
      rest.instanceMatrix.needsUpdate = true;
      // the candles' halos while gathering (they stand: the halos stay put); none while walking
      if (gather && !gathered) {
        halos = [];
        for (let i = 0; i < count; i++) {
          rest.getMatrixAt(i, m4);
          f.set(FLAME_AT.x, FLAME_AT.y + 0.02, FLAME_AT.z).applyMatrix4(m4);
          halos.push({ x: f.x, y: f.y, z: f.z, size: 0.5, color: CANDLE_HALO });
        }
      } else if (!gather && gathered) halos = [];
      gathered = gather;
    },
    halos: () => halos,
    aside: () => asideNow,
    count: () => count,
    near: (x, z, max) => { for (let i = 0; i < count; i++) if (Math.hypot(px[i] - x, pz[i] - z) <= max) return true; return false; },
    each: fn => { for (let i = 0; i < count; i++) fn(px[i], pz[i]); },
    dispose: () => {
      group.remove(robes, rest);
      robes.dispose();
      rest.dispose();
    },
  };
}
