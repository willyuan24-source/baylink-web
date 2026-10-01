import * as THREE from 'three';
import type { Vec2 } from '../../core/types';
import { ROCK_JITTER, westBall } from './westBall';

/**
 * Wave 8 · lane W2 · the west side's sea life (sf-w8-lead §3 W2 (1)): Ocean Beach's toy surfers out on the break by day
 * and Seal Rocks off the Cliff House with their sea lions and cormorants. Pure data and the pose writer (node tests);
 * world/sf/westSea.ts is the city WorldSystem that draws it as ONE InstancedMesh (a unit ball painted per instance on the
 * tinted instanced toy program, like the kites: no new program).
 *
 *   OB_SHORE     Ocean Beach's waterline from Point Lobos south past Lawton St (world x, z): the first water along the
 *                beach's seaward normal on the published far map's land / water areas (sampled every 0.0015° of
 *                latitude, 37.7765 → 37.7540; the two Golden Gate Park pond hits at 37.7705 / 37.7690 interpolated)
 *   SEAL_ROCKS   the two islets of OSM ways 969197372 / 969197373 ("Seal Rocks", natural=coastline, place=islet, ele 23;
 *                https://www.openstreetmap.org/way/969197373 , the project's OSM snapshot of 2026-09-26, read
 *                2026-09-30): the published map has no land there (open sea): stacks of overlapping jittered boulders,
 *                white-capped (Brandt's cormorants nest there "turning the rocks bright white with their strong-smelling
 *                guano" — https://nps.gov/goga/learn/nature/birds.htm , read 2026-09-30), sea lions on the low ledges
 *                (Steller and California sea lions haul out there — https://en.wikipedia.org/wiki/Seal_Rocks_(San_Francisco) ,
 *                read 2026-09-30), cormorants standing on the tops, gulls wheeling over them
 *   SURFERS      eleven toy surfers in two groups: Kelly's Cove south of the Cliff House ("In the 1940s, surfing first
 *                began at Kelly's Cove") and off Judah / Lawton St in front of the N Judah terminus; each sits on the
 *                swell waiting, paddles for a wave, rides it in a few metres and paddles back out (a fixed 36 s cycle,
 *                phased) — Ocean Beach has "strong, dangerous currents and powerful waves" and is "one of the Bay Area's
 *                top surfing spots" (https://en.wikipedia.org/wiki/Ocean_Beach,_San_Francisco , read 2026-09-30). By day
 *                only; never a player activity (the game never suggests going in the water there)
 *   FOAM         white crests rolling in on the break in front of each group, and the wash on the sand
 */

/** the city's sea plane (world/sf/water.ts WATER_Y) */
export const SEA_Y = -0.6;

export const OB_SHORE: readonly Vec2[] = [
  { x: -673.3, z: 1288.1 }, { x: -655.0, z: 1302.3 }, { x: -637.1, z: 1316.8 }, { x: -618.3, z: 1330.2 },
  { x: -600.6, z: 1345.0 }, { x: -582.7, z: 1359.7 }, { x: -564.8, z: 1374.3 }, { x: -547.2, z: 1389.2 },
  { x: -530.5, z: 1405.3 }, { x: -511.9, z: 1419.1 }, { x: -493.7, z: 1433.2 }, { x: -476.1, z: 1448.2 },
  { x: -457.8, z: 1462.3 }, { x: -439.3, z: 1476.1 }, { x: -420.1, z: 1489.1 }, { x: -402.2, z: 1503.6 },
];

const SEG: number[] = [0];
for (let i = 1; i < OB_SHORE.length; i++) SEG.push(SEG[i - 1] + Math.hypot(OB_SHORE[i].x - OB_SHORE[i - 1].x, OB_SHORE[i].z - OB_SHORE[i - 1].z));
/** the waterline's length (u) */
export const SHORE_LEN = SEG[SEG.length - 1];

export interface ShorePoint { x: number; z: number; tx: number; tz: number; nx: number; nz: number }
/** The waterline at arc length `s` (u from its north end): the point, the tangent (south-east) and the seaward normal. */
export function shoreAt(s: number, out: ShorePoint = { x: 0, z: 0, tx: 0, tz: 0, nx: 0, nz: 0 }): ShorePoint {
  const c = Math.max(0, Math.min(SHORE_LEN, s));
  let i = 1;
  while (i < SEG.length - 1 && SEG[i] < c) i++;
  const a = OB_SHORE[i - 1], b = OB_SHORE[i], L = SEG[i] - SEG[i - 1], f = L > 0 ? (c - SEG[i - 1]) / L : 0;
  out.x = a.x + (b.x - a.x) * f; out.z = a.z + (b.z - a.z) * f;
  out.tx = (b.x - a.x) / L; out.tz = (b.z - a.z) / L;
  out.nx = -out.tz; out.nz = out.tx;
  return out;
}

/** A point `d` u out to sea from the waterline at `s` (the seaward normal). */
export function seaPoint(s: number, d: number): Vec2 {
  const p = shoreAt(s);
  return { x: p.x + p.nx * d, z: p.z + p.nz * d };
}

// ---------------------------------------------------------------------------------------------------------------
// Seal Rocks
// ---------------------------------------------------------------------------------------------------------------

/** OSM 969197372 (the inshore islet) and 969197373 (the bigger stack), world x, z */
export const SEAL_ROCK_OUTLINES: readonly Vec2[][] = [
  [{ x: -719.39, z: 1285.1 }, { x: -719.55, z: 1283.38 }, { x: -720.17, z: 1282.78 }, { x: -721.39, z: 1283 }, { x: -721.66, z: 1284.43 }, { x: -721.42, z: 1286.3 }, { x: -720.05, z: 1286.09 }],
  [{ x: -727.16, z: 1291.23 }, { x: -727.46, z: 1287.98 }, { x: -730.61, z: 1286.01 }, { x: -731.45, z: 1287.7 }, { x: -730.41, z: 1288.06 }, { x: -730.31, z: 1288.87 }, { x: -731.26, z: 1290.02 }, { x: -731.76, z: 1289.38 }, { x: -732.34, z: 1290.59 }, { x: -732.24, z: 1291.57 }, { x: -731.59, z: 1292.07 }, { x: -730.46, z: 1291.72 }, { x: -730.75, z: 1291.1 }, { x: -729.96, z: 1290.54 }, { x: -728.47, z: 1292.31 }],
];

/** a boulder: centre x, z, size (x, y, z: the unit ball's diameters), its top (world y), yaw, tilt, colour */
export interface Boulder { x: number; z: number; sx: number; sy: number; sz: number; top: number; yaw: number; tilt: number; color: string }
const ROCK = ['#6f665c', '#7b7064', '#5f574e'], GUANO = '#e6e3d9', GUANO2 = '#d6d2c6';
const bd = (x: number, z: number, sx: number, sy: number, sz: number, top: number, yaw: number, tilt: number, color: string): Boulder => ({ x, z, sx, sy, sz, top, yaw, tilt, color });

/**
 * The stacks: OSM's `ele` 23 m for both islets; the landmark rule (H = 3.2 + 0.155·h, the toy city's heights) makes
 * that ≈ 6.8 u — the big stack's crag stands 5.4 u over the sea, the inshore one 3.6 u (both read against the Cliff
 * House's 4.5 u block from the terrace). Each stack is a tall leaning crag on wide flat ledges (where the sea lions haul
 * out) with lower shoulders, loose boulders at the waterline; the guano is a few flattened white patches tilted on the
 * summits and shoulders (never one round cap: one white dome with two birds on it read as a face in the first try).
 */
const CRAG = bd(-728.9, 1289.4, 3.6, 10.0, 3.3, 5.4, 0.5, 0.1, ROCK[0]);
const BUTTRESS = bd(-727.7, 1291.0, 2.2, 6.4, 2.5, 3.2, 1.1, -0.18, ROCK[1]);
const SHOULDER = bd(-729.9, 1287.4, 2.8, 5.2, 2.3, 2.5, 2.2, 0.22, ROCK[2]);
const WEST_CRAG = bd(-731.5, 1290.7, 2.2, 6.6, 2.5, 3.6, 0.9, 0.16, ROCK[1]);
const ISLET = bd(-720.6, 1284.7, 2.2, 7.0, 2.8, 3.6, 0.3, 0.14, ROCK[0]);
/**
 * A guano skin: the same ellipsoid a little narrower (k) and raised by dy, so it shows only above a line on the rock's
 * upper slopes and follows their shape; nudged (ox, oz) toward one side, so that line runs lower on that side (an
 * uneven white top, never a round cap: one white dome with two birds on it read as a face in the first try).
 */
const skin = (r: Boulder, dy: number, k: number, ox: number, oz: number, color: string): Boulder => bd(r.x + ox, r.z + oz, r.sx * k, r.sy, r.sz * k, r.top + dy, r.yaw, r.tilt, color);
export const SEAL_BOULDERS: readonly Boulder[] = [
  // the big stack (969197373): the main crag on the east mass, a buttress, the south shoulder, the west lobe's crag
  CRAG, BUTTRESS, SHOULDER, WEST_CRAG,
  bd(-732.0, 1291.7, 1.6, 2.8, 1.8, 1.3, 0.3, 0.2, ROCK[2]),
  // the ledges round its foot (flat, wide: the haul-out) and loose boulders at the waterline
  bd(-730.6, 1286.5, 2.9, 1.4, 2.0, 0.45, 0.4, 0.04, ROCK[1]),
  bd(-727.3, 1288.3, 2.0, 1.2, 2.7, 0.4, 0.2, 0.05, ROCK[2]),
  bd(-729.7, 1291.9, 2.6, 1.2, 1.6, 0.3, 1.6, 0.04, ROCK[0]),
  bd(-732.6, 1289.3, 1.9, 1.0, 1.7, 0.2, 0.7, 0.06, ROCK[2]),
  bd(-726.9, 1292.4, 1.1, 0.9, 1.0, 0.05, 1.7, 0.2, ROCK[0]),
  bd(-733.2, 1290.5, 0.9, 0.8, 1.1, 0.0, 0.5, 0.2, ROCK[2]),
  bd(-726.8, 1286.9, 0.8, 0.7, 0.9, -0.05, 0.9, 0.15, ROCK[1]),
  // the inshore islet (969197372): a leaning crag, its shoulder, a ledge and a boulder at its foot
  ISLET,
  bd(-721.3, 1285.9, 1.4, 3.8, 1.6, 1.9, 1.0, 0.3, ROCK[1]),
  bd(-719.8, 1283.3, 1.9, 1.1, 1.7, 0.3, 0.4, 0.05, ROCK[2]),
  bd(-719.5, 1285.7, 1.0, 1.5, 1.1, 0.55, 2.1, -0.3, ROCK[2]),
  // the guano (the skins last: they draw over the stone they whiten)
  skin(CRAG, 0.25, 0.95, -0.15, 0.08, GUANO),
  skin(BUTTRESS, 0.14, 0.95, 0.1, 0.12, GUANO2),
  skin(SHOULDER, 0.12, 0.95, -0.1, -0.1, GUANO),
  skin(WEST_CRAG, 0.18, 0.95, -0.12, 0.05, GUANO),
  skin(ISLET, 0.13, 0.95, -0.07, -0.06, GUANO2),
];

/** the stacks' instances, posed once (world matrices) and inverted for the ray test of rockTop */
const ROCK_INV: THREE.Matrix4[] = [];
/** A boulder's world matrix (the unit ball → its ellipsoid, tilted). */
export function boulderMatrix(b: Boulder, out = new THREE.Matrix4()): THREE.Matrix4 {
  return out.compose(new THREE.Vector3(b.x, b.top - b.sy / 2, b.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(b.tilt, b.yaw, b.tilt * 0.6, 'YXZ')), new THREE.Vector3(b.sx, b.sy, b.sz));
}
for (const b of SEAL_BOULDERS) ROCK_INV.push(boulderMatrix(b).invert());

const ro = new THREE.Vector3(), rd = new THREE.Vector3();
/**
 * The highest boulder surface over (x, z): a vertical ray against every (tilted) ellipsoid, or null over open water.
 * The rock geometry is the unit ball with only a sideways jitter (world/sf/westSea.ts rockBall), so the tops are true.
 */
export function rockTop(x: number, z: number): number | null {
  let best: number | null = null;
  for (const inv of ROCK_INV) {
    ro.set(x, 50, z).applyMatrix4(inv);
    rd.set(x, 49, z).applyMatrix4(inv).sub(ro);
    const a = rd.dot(rd), bb = ro.dot(rd), c = ro.dot(ro) - 0.25, disc = bb * bb - a * c;
    if (disc < 0) continue;
    const t = (-bb - Math.sqrt(disc)) / a;
    const y = 50 - t;
    if (best === null || y > best) best = y;
  }
  return best;
}

/** sea lions hauled out on the ledges: x, z, heading, colour, head-lift phase */
export const SEA_LIONS: readonly [number, number, number, string, number][] = [
  [-731.2, 1286.1, 2.6, '#6e5038', 0.0],
  [-729.8, 1285.9, -1.9, '#7d5a3e', 2.1],
  [-727.1, 1287.6, 0.2, '#5e4430', 4.0],
  [-726.7, 1288.7, 2.9, '#7d5a3e', 1.3],
  [-732.9, 1289.0, -0.3, '#6e5038', 5.2],
  [-730.2, 1292.2, 1.4, '#5e4430', 3.0],
  [-719.6, 1283.0, 2.2, '#6e5038', 3.3],
];
/** sea lions swimming off the rocks (only the head shows): x, z, phase */
export const SWIMMERS: readonly [number, number, number][] = [[-725.0, 1281.5, 0.7], [-734.6, 1293.4, 2.9], [-723.4, 1289.6, 4.4]];
/** a summit: the top of a (tilted) ellipsoid, world x, z */
function summit(b: Boulder): Vec2 {
  const p = new THREE.Vector3(0, 0.5, 0).applyMatrix4(boulderMatrix(b));
  return { x: p.x, z: p.z };
}
/** cormorants standing on the white tops (offsets from a summit, where the rock is near flat), never in a pair */
const BIRDS: [Boulder, number, number][] = [
  [CRAG, 0.3, -0.2], [CRAG, -0.38, 0.22], [CRAG, 0.12, 0.3], [CRAG, -0.5, -0.32], [CRAG, -0.1, -0.05],
  [WEST_CRAG, 0.1, 0.02], [WEST_CRAG, -0.28, -0.22], [BUTTRESS, 0.3, 0.25], [SHOULDER, -0.22, 0.12], [ISLET, 0.16, -0.22],
];
export const CORMORANTS: readonly Vec2[] = BIRDS.map(([b, dx, dz]) => { const s = summit(b); return { x: s.x + dx, z: s.z + dz }; });
/** gulls wheeling over the rocks: radius, height over the sea, speed (rad / s), phase */
export const GULLS: readonly [number, number, number, number][] = [[6.5, 8.0, 0.42, 0], [8.5, 9.5, -0.33, 2.1], [5.0, 7.2, 0.5, 4.2], [10.0, 11.0, 0.28, 1.0]];
export const SEAL_ROCKS_CENTRE: Vec2 = { x: -726.5, z: 1287.6 };
/**
 * W8-W2-review (C1): the top of the DRAWN rock over (x, z) — the 80-face jittered ball's flat facets lie up to ≈ 0.3 u
 * under the true ellipsoid near the summits (rockTop), so the birds stood on air: a vertical ray against the stacks'
 * triangles as drawn (westBall(ROCK_JITTER) under each boulderMatrix), or null over open water.
 */
let drawn: Float32Array | null = null;
function drawnTris(): Float32Array {
  if (drawn) return drawn;
  const g = westBall(ROCK_JITTER), p = g.getAttribute('position'), n = p.count;
  const out = new Float32Array(SEAL_BOULDERS.length * n * 3), v = new THREE.Vector3(), m = new THREE.Matrix4();
  let o = 0;
  for (const b of SEAL_BOULDERS) {
    boulderMatrix(b, m);
    for (let i = 0; i < n; i++) { v.fromBufferAttribute(p, i).applyMatrix4(m); out[o++] = v.x; out[o++] = v.y; out[o++] = v.z; }
  }
  g.dispose();
  return (drawn = out);
}
export function drawnTop(x: number, z: number): number | null {
  const t = drawnTris();
  let best: number | null = null;
  for (let i = 0; i < t.length; i += 9) {
    const x0 = t[i], z0 = t[i + 2], x1 = t[i + 3], z1 = t[i + 5], x2 = t[i + 6], z2 = t[i + 8];
    const d = (z1 - z2) * (x0 - x2) + (x2 - x1) * (z0 - z2);
    if (Math.abs(d) < 1e-12) continue;
    const a = ((z1 - z2) * (x - x2) + (x2 - x1) * (z - z2)) / d, b = ((z2 - z0) * (x - x2) + (x0 - x2) * (z - z2)) / d, c = 1 - a - b;
    if (a < -1e-9 || b < -1e-9 || c < -1e-9) continue;
    const y = a * t[i + 1] + b * t[i + 4] + c * t[i + 7];
    if (best === null || y > best) best = y;
  }
  return best;
}
const top = (x: number, z: number) => drawnTop(x, z) ?? rockTop(x, z) ?? SEA_Y;
/** the heights the hauled-out sea lions and the cormorants stand at, on the drawn rock (static: measured once) */
export const SEA_LION_Y: readonly number[] = SEA_LIONS.map(([x, z]) => top(x, z));
/** each sea lion's body follows its ledge (nose down where the rock falls away in front: + pitch), ± 0.4 rad */
export const SEA_LION_PITCH: readonly number[] = SEA_LIONS.map(([x, z, h]) => {
  const fx = Math.sin(h) * 0.5, fz = Math.cos(h) * 0.5;
  return Math.max(-0.4, Math.min(0.4, Math.atan2(top(x - fx, z - fz) - top(x + fx, z + fz), 1)));
});
export const CORMORANT_Y: readonly number[] = CORMORANTS.map(c => top(c.x, c.z));

// ---------------------------------------------------------------------------------------------------------------
// Surfers and the break
// ---------------------------------------------------------------------------------------------------------------

/** a surfer: arc length along OB_SHORE where they wait, how far out (u), the cycle phase (s), board colour, skin, which way they ride */
export interface Surfer { s: number; d: number; phase: number; board: string; skin: string; dir: 1 | -1 }
const BOARDS = ['#f4f1e8', '#f2c14e', '#e8483c', '#3fae9a', '#7fb3e0', '#f08fb0'];
const SKIN = ['#e0b08c', '#a8724e', '#f0c9a4', '#6b4630', '#c98e66'];
const sf = (s: number, d: number, phase: number, k: number, dir: 1 | -1): Surfer => ({ s, d, phase, board: BOARDS[k % BOARDS.length], skin: SKIN[k % SKIN.length], dir });
export const SURFERS: readonly Surfer[] = [
  // Kelly's Cove, south of the Cliff House (the north end of the beach)
  sf(20, 12, 0, 0, 1), sf(28, 16.5, 13, 1, -1), sf(36, 11, 24, 2, 1), sf(45, 18, 7, 3, 1),
  // off Judah St (in front of the N Judah terminus) and Lawton St (the Ocean Beach site)
  sf(222, 13, 4, 4, 1), sf(231, 17, 19, 5, -1), sf(241, 12, 29, 1, 1), sf(252, 15, 10, 2, -1), sf(262, 19, 22, 0, 1),
  sf(283, 14, 15, 3, -1), sf(293, 17.5, 31, 4, 1),
];
/** the break in front of each group: centre arc length, crest length (u) */
export const BREAKS: readonly [number, number][] = [[32, 22], [240, 30], [288, 18]];
export const CREST_COUNT = 3;
/** clumps of white water in a crest, and in the wash on the sand */
export const CREST_PARTS = 5, WASH_PARTS = 3;
/** the crest's path: it breaks FOAM_OUT u out (just inside where the surfers wait) and dies on the wash at FOAM_IN */
export const FOAM_OUT = 10, FOAM_IN = 2.5;

/** the swell (u): a slow wave rolling in, a little higher further out */
export const SWELL = { amp: 0.1, length: 9, period: 8 } as const;
export function swellY(d: number, t: number): number {
  return SEA_Y + SWELL.amp * (0.7 + Math.min(1, d / 20) * 0.5) * Math.sin(((2 * Math.PI) / SWELL.length) * d + ((2 * Math.PI) / SWELL.period) * t);
}

/** The surf cycle (s): wait on the board, paddle for a wave, ride it in, paddle back out. */
export const CYCLE = { wait: 18, catch: 3, ride: 5, back: 10 } as const;
export const CYCLE_LEN = CYCLE.wait + CYCLE.catch + CYCLE.ride + CYCLE.back;
export type SurfPose = 'sit' | 'paddle' | 'stand';
/** a surfer's state: along-shore offset, distance out, the board's heading in the shore frame (vd > 0: seaward), the pose */
export interface SurfState { ds: number; d: number; vs: number; vd: number; pose: SurfPose }
const RIDE_IN = 7.5;
/** Where a surfer is at time t (written into `out`: no allocation per frame). */
export function surfState(f: Surfer, t: number, out: SurfState = { ds: 0, d: 0, vs: 0, vd: 0, pose: 'sit' }): SurfState {
  const c = (((t + f.phase) % CYCLE_LEN) + CYCLE_LEN) % CYCLE_LEN;
  const RIDE_S = 4 * f.dir;
  if (c < CYCLE.wait) { out.ds = 0; out.d = f.d; out.vs = 0; out.vd = 1; out.pose = 'sit'; return out; }
  if (c < CYCLE.wait + CYCLE.catch) {
    const k = (c - CYCLE.wait) / CYCLE.catch;
    out.ds = 0; out.d = f.d - k; out.vs = 0.3 * f.dir; out.vd = -1; out.pose = 'paddle';
    return out;
  }
  if (c < CYCLE.wait + CYCLE.catch + CYCLE.ride) {
    const k = (c - CYCLE.wait - CYCLE.catch) / CYCLE.ride, e = k * (2 - k);
    out.ds = RIDE_S * e; out.d = f.d - 1 - (RIDE_IN - 1) * e; out.vs = RIDE_S / CYCLE.ride; out.vd = -(RIDE_IN - 1) / CYCLE.ride; out.pose = 'stand';
    return out;
  }
  const k = (c - CYCLE.wait - CYCLE.catch - CYCLE.ride) / CYCLE.back, e = k * k * (3 - 2 * k);
  out.ds = RIDE_S * (1 - e); out.d = f.d - RIDE_IN + RIDE_IN * e; out.vs = -0.25 * f.dir; out.vd = 1; out.pose = 'paddle';
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// Instances
// ---------------------------------------------------------------------------------------------------------------

/** instances per surfer: the board, the body, the head, the spray behind a rider, two arms (W8-W2-review P5: without arms
 * a black egg with a ball on top read as a penguin on a board) */
export const SURFER_PARTS = 6;
/** the toy surfers' size over a 1:1 sitting figure (they read from the promenade 40–60 u away) */
export const SURFER_SCALE = 1.35;
export const STATIC_COUNT = SEAL_BOULDERS.length;
export const LIFE_COUNT = SEA_LIONS.length * 2 + SWIMMERS.length + CORMORANTS.length + GULLS.length;
export const FOAM_COUNT = BREAKS.length * (CREST_COUNT * CREST_PARTS + WASH_PARTS);
export const SURFERS_FROM = STATIC_COUNT + LIFE_COUNT + FOAM_COUNT;
export const WEST_SEA_CAPACITY = SURFERS_FROM + SURFERS.length * SURFER_PARTS;
/** surfers are out by day: the sky's night factor (0 day … 1 night) below this */
export const SURF_NIGHT_MAX = 0.35;
/**
 * W8-W2-review (P4): at dusk they go in one by one, never all in one frame: each has its own point of the night factor
 * (spread over DUSK_SPREAD below the max, neighbours not in turn) and shrinks into the water over DUSK_FADE (the same
 * for the lake's boats, westLakePose.ts). 1 = out, 0 = gone.
 */
export const DUSK_SPREAD = 0.15, DUSK_FADE = 0.012;
export function duskOut(n: number, count: number, night: number, max: number): number {
  const order = count > 1 ? ((n * 7) % count) / (count - 1) : 0;
  const th = max - DUSK_FADE - (DUSK_SPREAD - DUSK_FADE) * order;
  return Math.min(1, Math.max(0, (th + DUSK_FADE - night) / DUSK_FADE));
}

/** What the pose writer needs of an InstancedMesh (a fake one in tests). */
export interface InstanceSink {
  setMatrixAt(i: number, m: THREE.Matrix4): void;
  setColorAt(i: number, c: THREE.Color): void;
}

const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e3 = new THREE.Euler(0, 0, 0, 'YXZ'), p3 = new THREE.Vector3(), s3 = new THREE.Vector3();
const col = new THREE.Color();
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
function put(sink: InstanceSink, i: number, x: number, y: number, z: number, sx: number, sy: number, sz: number, yaw: number, pitch = 0, roll = 0) {
  e3.set(pitch, yaw, roll);
  sink.setMatrixAt(i, m4.compose(p3.set(x, y, z), q.setFromEuler(e3), s3.set(sx, sy, sz)));
}

/** Paint every instance once (colours never change after this). */
export function paintWestSea(sink: InstanceSink) {
  let i = 0;
  for (const b of SEAL_BOULDERS) sink.setColorAt(i++, col.set(b.color));
  for (const l of SEA_LIONS) { sink.setColorAt(i++, col.set(l[3])); sink.setColorAt(i++, col.set(l[3]).offsetHSL(0, 0, -0.04)); }
  for (let k = 0; k < SWIMMERS.length; k++) sink.setColorAt(i++, col.set('#5e4430'));
  for (let k = 0; k < CORMORANTS.length; k++) sink.setColorAt(i++, col.set('#2b2f33'));
  for (let k = 0; k < GULLS.length; k++) sink.setColorAt(i++, col.set('#f7f7f2'));
  for (let k = 0; k < FOAM_COUNT; k++) sink.setColorAt(i++, col.set('#f8fbfb'));
  for (const f of SURFERS) {
    sink.setColorAt(i++, col.set(f.board));
    sink.setColorAt(i++, col.set('#1f2328'));
    sink.setColorAt(i++, col.set(f.skin));
    sink.setColorAt(i++, col.set('#f8fbfb'));
    sink.setColorAt(i++, col.set('#2a2f35'));
    sink.setColorAt(i++, col.set('#2a2f35'));
  }
}

/** The stacks (static: written once). */
export function poseRocks(sink: InstanceSink) {
  SEAL_BOULDERS.forEach((b, i) => sink.setMatrixAt(i, boulderMatrix(b, m4)));
}

const sp: ShorePoint = { x: 0, z: 0, tx: 0, tz: 0, nx: 0, nz: 0 };
const st: SurfState = { ds: 0, d: 0, vs: 0, vd: 0, pose: 'sit' };
/** a stable pseudo-random 0 … 1 per (a, b) (the crests' clumps keep their shape from frame to frame) */
const hash01 = (a: number, b: number) => { const h = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return h - Math.floor(h); };

/**
 * One frame of the sea life at time `t` (s) and the sky's `night` (0 … 1); writes every moving instance and returns
 * the count to draw: the surfers are the last block, left out at night. No allocation.
 */
export function poseWestSea(sink: InstanceSink, t: number, night: number): number {
  let i = STATIC_COUNT;
  // sea lions: a long body on the ledge, the small head at its front, lifted now and then
  for (let k = 0; k < SEA_LIONS.length; k++) {
    const l = SEA_LIONS[k], x = l[0], z = l[1], h = l[2], ph = l[4], y = SEA_LION_Y[k], pb = SEA_LION_PITCH[k];
    const fx = Math.sin(h), fz = Math.cos(h);
    const lift = Math.max(0, Math.sin(t * 0.45 + ph) - 0.55) * 0.55;
    put(sink, i++, x, y + 0.14, z, 0.55, 0.38, 1.35, h, pb - 0.06);
    put(sink, i++, x + fx * 0.62, y + 0.28 - Math.sin(pb) * 0.62 + lift * 0.8, z + fz * 0.62, 0.3, 0.3, 0.36, h, -0.25 - lift + pb * 0.5);
  }
  for (let k = 0; k < SWIMMERS.length; k++) {
    const x = SWIMMERS[k][0], z = SWIMMERS[k][1], ph = SWIMMERS[k][2];
    const dx = Math.sin(t * 0.12 + ph) * 1.6, dz = Math.cos(t * 0.09 + ph) * 1.2;
    put(sink, i++, x + dx, SEA_Y + 0.08 + Math.sin(t * 1.3 + ph) * 0.05, z + dz, 0.28, 0.28, 0.36, t * 0.12 + ph);
  }
  // cormorants standing upright on the white tops and the ledges, turning their heads now and then
  for (let k = 0; k < CORMORANTS.length; k++) {
    const c = CORMORANTS[k];
    put(sink, i++, c.x, CORMORANT_Y[k] + 0.15, c.z, 0.15, 0.38, 0.19, k * 1.7 + Math.sin(t * 0.3 + k) * 0.4);
  }
  // gulls wheeling over the stacks, banking into the turn
  for (let k = 0; k < GULLS.length; k++) {
    const r = GULLS[k][0], h = GULLS[k][1], w = GULLS[k][2], ph = GULLS[k][3];
    const a = t * w + ph, x = SEAL_ROCKS_CENTRE.x + Math.cos(a) * r, z = SEAL_ROCKS_CENTRE.z + Math.sin(a) * r;
    const yaw = Math.atan2(-Math.sin(a) * Math.sign(w), Math.cos(a) * Math.sign(w));
    put(sink, i++, x, SEA_Y + h + Math.sin(t * 0.8 + ph) * 0.4, z, 0.62, 0.07, 0.22, yaw, 0, 0.35 * Math.sign(w));
  }
  // the break: each crest a line of long, thin, overlapping clumps of white water (staggered, of different lengths)
  // rolling in and thinning out on the sand; the wash along the waterline pulsing with the swell
  for (let b = 0; b < BREAKS.length; b++) {
    const s0 = BREAKS[b][0], len = BREAKS[b][1];
    for (let c = 0; c < CREST_COUNT; c++) {
      const k = (((t / (SWELL.period * 1.2) + c / CREST_COUNT + s0 * 0.013) % 1) + 1) % 1;
      const d = FOAM_OUT - (FOAM_OUT - FOAM_IN) * k;
      const grow = k < 0.15 ? k / 0.15 : 1 - ((k - 0.15) / 0.85) ** 1.5;
      for (let j = 0; j < CREST_PARTS; j++) {
        const r = hash01(c + b * 7, j + s0);
        const along = (j / (CREST_PARTS - 1) - 0.5) * len * 0.8 + (r - 0.5) * 1.5;
        const seg = (len / CREST_PARTS) * (1.35 + 0.5 * r);
        shoreAt(s0 + along, sp);
        const dd = d + (r - 0.5) * 0.9;
        put(sink, i++, sp.x + sp.nx * dd, SEA_Y + 0.03, sp.z + sp.nz * dd, (0.16 + 0.34 * grow) * (0.8 + 0.4 * r), 0.12 * grow + 0.02, seg * (0.6 + 0.4 * grow), Math.atan2(sp.tx, sp.tz) + (r - 0.5) * 0.08);
      }
    }
    const wash = 0.5 + 0.5 * Math.sin(((2 * Math.PI) / SWELL.period) * t + s0);
    for (let j = 0; j < WASH_PARTS; j++) {
      shoreAt(s0 + (j - 1) * len * 0.33, sp);
      const dd = 0.8 + wash * 1.2 + j * 0.3;
      put(sink, i++, sp.x + sp.nx * dd, SEA_Y + 0.03, sp.z + sp.nz * dd, 0.3 + 0.4 * wash, 0.04, len * 0.36, Math.atan2(sp.tx, sp.tz));
    }
  }
  if (night >= SURF_NIGHT_MAX) return i;
  // the surfers (toy size: K × a sitting figure, so they read from the promenade; at dusk each shrinks into the water in turn)
  for (let n = 0; n < SURFERS.length; n++) {
    const f = SURFERS[n];
    const K = SURFER_SCALE * duskOut(n, SURFERS.length, night, SURF_NIGHT_MAX);
    surfState(f, t, st);
    shoreAt(f.s + st.ds, sp);
    const x = sp.x + sp.nx * st.d, z = sp.z + sp.nz * st.d;
    const vx = sp.tx * st.vs + sp.nx * st.vd, vz = sp.tz * st.vs + sp.nz * st.vd;
    const yaw = Math.atan2(vx, vz), fx = Math.sin(yaw), fz = Math.cos(yaw), rx = fz, rz = -fx;
    const yb = swellY(st.d, t) + 0.06 * K;
    const slope = SWELL.amp * ((2 * Math.PI) / SWELL.length) * Math.cos(((2 * Math.PI) / SWELL.length) * st.d + ((2 * Math.PI) / SWELL.period) * t);
    const pitch = -slope * Math.sign(st.vd) * 0.8 + (st.pose === 'stand' ? -0.08 : 0);
    put(sink, i++, x, yb, z, 0.46 * K, 0.1 * K, 1.7 * K, yaw, pitch);
    if (st.pose === 'sit') {
      put(sink, i++, x - fx * 0.15 * K, yb + 0.36 * K, z - fz * 0.15 * K, 0.32 * K, 0.6 * K, 0.26 * K, yaw, 0, Math.sin(t * 0.7 + f.phase) * 0.06);
      put(sink, i++, x - fx * 0.12 * K, yb + 0.8 * K, z - fz * 0.12 * K, 0.3 * K, 0.3 * K, 0.3 * K, yaw);
      sink.setMatrixAt(i++, ZERO);
      // the arms: hands resting on the board in front, a little out to the sides
      for (let side = -1; side <= 1; side += 2) put(sink, i++, x - fx * 0.02 * K + rx * side * 0.2 * K, yb + 0.36 * K, z - fz * 0.02 * K + rz * side * 0.2 * K, 0.09 * K, 0.46 * K, 0.09 * K, yaw, 0.45, side * 0.25);
    } else if (st.pose === 'paddle') {
      const stroke = Math.sin(t * 4 + f.phase) * 0.03;
      put(sink, i++, x - fx * 0.12 * K, yb + (0.14 + stroke) * K, z - fz * 0.12 * K, 0.34 * K, 0.22 * K, 0.78 * K, yaw, pitch);
      put(sink, i++, x + fx * 0.42 * K, yb + 0.24 * K, z + fz * 0.42 * K, 0.28 * K, 0.28 * K, 0.3 * K, yaw);
      sink.setMatrixAt(i++, ZERO);
      // the arms paddling by the board's rails, in turn
      for (let side = -1; side <= 1; side += 2) {
        const sw = Math.sin(t * 4 + f.phase + (side > 0 ? Math.PI : 0)) * 0.22;
        put(sink, i++, x + fx * (0.3 + sw) * K + rx * side * 0.28 * K, yb + 0.06 * K, z + fz * (0.3 + sw) * K + rz * side * 0.28 * K, 0.09 * K, 0.09 * K, 0.5 * K, yaw, 0.35);
      }
    } else {
      const lean = 0.18 * f.dir;
      put(sink, i++, x, yb + 0.5 * K, z, 0.3 * K, 0.74 * K, 0.26 * K, yaw, 0.12, lean);
      put(sink, i++, x + fx * 0.06 * K, yb + 0.98 * K, z + fz * 0.06 * K, 0.28 * K, 0.28 * K, 0.28 * K, yaw);
      // the white water the board throws up behind it
      put(sink, i++, x - fx * 1.0 * K, SEA_Y + 0.05, z - fz * 1.0 * K, 1.3 * K, 0.18 * K, 1.4 * K, yaw);
      // the arms held out for balance (the toy surfer's T), drooping a little
      for (let side = -1; side <= 1; side += 2) put(sink, i++, x + rx * side * 0.36 * K, yb + 0.74 * K, z + rz * side * 0.36 * K, 0.1 * K, 0.1 * K, 0.52 * K, yaw + Math.PI / 2, side * 0.3, 0);
    }
  }
  return i;
}
