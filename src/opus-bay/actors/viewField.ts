import { CHUNK } from '../core/geo';
import { cityChunkEpoch, cityTerrain, forEachBlockerNear, heightAt, inSlab, inWorld, isWater, type Blocker } from '../core/terrain';
import { frameAt, stationOf } from '../data/district';

/**
 * Where the view is (lane E2, wave 3, E2-5): the direction worth looking toward from a spot, for the follow camera's
 * arrival yaw (camera.ts chooseYaw), the side a city transit ride's camera takes and the sit rig.
 *
 * - Hero slab (district mode everywhere, city mode on the Embarcadero slab): today's rule, unchanged — out over the Bay
 *   along the promenade normal (data/district frameAt).
 * - City: a lazy openness field on a 16 u lattice. Each cell scores 16 directions at 24 / 48 / 96 u: open water counts
 *   for it (the far rings most), ground lower than the cell counts for it and higher ground against it (a hill in the
 *   face), roofs above the eye line count against it (the near rings most); the outside of the model is a mild minus.
 *   The circular scores are smoothed [¼ ½ ¼] and the best direction wins. A cell is computed on first use (48 samples,
 *   ≈ 0.1 ms) and kept until a chunk under its samples attaches or detaches (roofs and heights refine as they stream).
 *
 * The field is coarse on purpose: it says where the scenery is (the Bay, downhill, the ocean), not which street is open
 * right here — the camera's occlusion scoring picks the clear yaw near it.
 */

export const VIEW_CELL = 16;
export const VIEW_DIRS = 16;
/** sample rings (u) and their weights: water / drop (the view: far counts most) and roofs (the block: near counts most) */
export const VIEW_RINGS = [24, 48, 96] as const;
const W_WATER = [0.5, 0.8, 1] as const;
const W_DROP = [0.35, 0.5, 0.6] as const;
const W_ROOF = [1, 0.7, 0.4] as const;
/** eye line above the cell's ground (the follow camera sits ≈ 5.5 u over the ground at its default zoom) */
export const VIEW_EYE = 6;
/** roof search radius around a sample (u) */
const ROOF_R = 3;
/** outside the model: a mild minus (nothing to see, the model's edge) */
const OUTSIDE = -0.25;

/** What the field samples (the game's core/terrain; tests pass synthetic worlds). */
export interface ViewWorld {
  heightAt(x: number, z: number): number;
  inWorld(x: number, z: number): boolean;
  isWater(x: number, z: number): boolean;
  /** highest roof (world y) within r of (x, z), −Infinity when none is known */
  roofNear(x: number, z: number, r: number): number;
}

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

/**
 * The 16 smoothed direction scores at (x, z) (index k = world yaw k·2π/16, the direction (sin, cos)). Pure: the
 * caller's world, the caller's output array.
 */
export function viewScores(x: number, z: number, w: ViewWorld, out = new Float32Array(VIEW_DIRS)): Float32Array {
  const g = w.heightAt(x, z), eye = g + VIEW_EYE;
  const raw = RAW;
  for (let k = 0; k < VIEW_DIRS; k++) {
    const a = (k / VIEW_DIRS) * Math.PI * 2, dx = Math.sin(a), dz = Math.cos(a);
    let s = 0;
    for (let i = 0; i < VIEW_RINGS.length; i++) {
      const d = VIEW_RINGS[i], sx = x + dx * d, sz = z + dz * d;
      if (!w.inWorld(sx, sz)) { s += OUTSIDE; continue; }
      if (w.isWater(sx, sz)) s += W_WATER[i];
      s += clamp((g - w.heightAt(sx, sz)) / 12, -1, 1) * W_DROP[i];
      const roof = w.roofNear(sx, sz, ROOF_R);
      if (roof > eye) s -= clamp((roof - eye) / 8, 0, 1) * W_ROOF[i];
    }
    raw[k] = s;
  }
  for (let k = 0; k < VIEW_DIRS; k++) out[k] = raw[(k + VIEW_DIRS - 1) % VIEW_DIRS] * 0.25 + raw[k] * 0.5 + raw[(k + 1) % VIEW_DIRS] * 0.25;
  return out;
}
const RAW = new Float32Array(VIEW_DIRS);

/** Index of the best direction (the first of equals, so the answer is stable). */
export function bestDir(scores: Float32Array): number {
  let best = 0;
  for (let k = 1; k < scores.length; k++) if (scores[k] > scores[best] + 1e-6) best = k;
  return best;
}

// ---------------------------------------------------------------------------
// The game's field (core/terrain), cached per 16 u cell
// ---------------------------------------------------------------------------

let roofTop = -Infinity;
const roofOf = (b: Blocker) => { if (b.top !== undefined && b.top > roofTop) roofTop = b.top; };
/** core/terrain as a ViewWorld: only blockers with a known top (city buildings, landmarks) are roofs */
export const TERRAIN_VIEW: ViewWorld = {
  heightAt,
  inWorld,
  isWater,
  roofNear(x, z, r) { roofTop = -Infinity; forEachBlockerNear(x, z, r, roofOf); return roofTop; },
};

interface Cell { dir: number; score: number; epoch: number }
const cells = new Map<number, Cell>();
let cellsOf: unknown = null;
const SCORES = new Float32Array(VIEW_DIRS);
const REACH = VIEW_RINGS[VIEW_RINGS.length - 1] + ROOF_R;
const cellKey = (i: number, j: number) => (i + 4096) * 8192 + (j + 4096);

/** newest attach / detach epoch of the chunks the cell's samples touch */
function epochAround(cx: number, cz: number): number {
  let e = 0;
  for (let j = Math.floor((cz - REACH) / CHUNK); j <= Math.floor((cz + REACH) / CHUNK); j++) {
    for (let i = Math.floor((cx - REACH) / CHUNK); i <= Math.floor((cx + REACH) / CHUNK); i++) e = Math.max(e, cityChunkEpoch(i, j));
  }
  return e;
}

/** The city field's cell at (x, z): computed on first use, again when a chunk under it changed. */
function cityCell(x: number, z: number): Cell {
  const city = cityTerrain();
  if (cellsOf !== city || cells.size > 4096) { cells.clear(); cellsOf = city; }
  const i = Math.floor(x / VIEW_CELL), j = Math.floor(z / VIEW_CELL), key = cellKey(i, j);
  const cx = (i + 0.5) * VIEW_CELL, cz = (j + 0.5) * VIEW_CELL;
  const epoch = epochAround(cx, cz);
  let c = cells.get(key);
  if (c && c.epoch === epoch) return c;
  const s = viewScores(cx, cz, TERRAIN_VIEW, SCORES);
  const k = bestDir(s);
  c ??= { dir: 0, score: 0, epoch };
  c.dir = (k / VIEW_DIRS) * Math.PI * 2; c.score = s[k]; c.epoch = epoch;
  cells.set(key, c);
  return c;
}

/** True where the hero rule applies: district mode, or the hero slab in city mode. */
export function heroView(x: number, z: number): boolean { return !cityTerrain() || inSlab(x, z); }

/**
 * The direction to look toward from (x, z): world yaw of the view direction ((sin, cos) points at the scenery).
 * Hero slab: out over the Bay (the promenade normal); city: the openness field.
 */
export function preferredViewDir(x: number, z: number): number {
  if (heroView(x, z)) { const f = frameAt(stationOf({ x, z }).st); return Math.atan2(f.nx, f.nz); }
  return cityCell(x, z).dir;
}

/**
 * The follow camera's yaw for that view (actors/camera.ts convention: the camera sits toward (sin yaw, cos yaw) from
 * the player, so it looks along the view past them). Hero slab: exactly the old `atan2(−nx, −nz)`.
 */
export function preferredCameraYaw(x: number, z: number): number {
  if (heroView(x, z)) { const f = frameAt(stationOf({ x, z }).st); return Math.atan2(-f.nx, -f.nz); }
  const d = cityCell(x, z).dir + Math.PI;
  return Math.atan2(Math.sin(d), Math.cos(d));
}

/** QA / tests: forget the cached city cells. */
export function resetViewField() { cells.clear(); cellsOf = null; }
