import { useSyncExternalStore } from 'react';
import { game } from '../core/store';
import type { Vec2 } from '../core/types';
import { cityStreamerLazy } from '../world/cityLoader';
import { NO_NAME, ROAD_CLASSES, type RoadSet, fetchChunk, versionBase } from '../world/sf/format';

/**
 * HUD street name (lane G1, plan §5.9 / G1-9), city mode only (the district HUD is unchanged).
 *
 * At 2 Hz (from brain's 10 Hz focus hook) the nearest NAMED road centreline within 6 u of the player: the resident
 * chunk's RoadSet (fetched on the main thread at most once a second, the HTTP cache already has it from the stream
 * workers; the 6 most recent chunks stay decoded), else the far city's main streets (far.lines) while a chunk is on
 * its way. 1.5 u hysteresis: the current name stays until another street is 1.5 u nearer (no flicker at corners).
 */

export const STREET_R = 6;
export const STREET_HYST = 1.5;
const TICK_MS = 500;
const FETCH_GAP_MS = 1000;
const LRU = 6;
const CHUNK = 128;
const SKIP = new Set<number>([ROAD_CLASSES.indexOf('tram'), ROAD_CLASSES.indexOf('rail')]);

export interface StreetHit { name: string; d: number }

/** Distance from (x, z) to segment (ax, az)–(bx, bz). */
function segDist(x: number, z: number, ax: number, az: number, bx: number, bz: number): number {
  const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
  const t = l2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2)) : 0;
  return Math.hypot(x - (ax + t * dx), z - (az + t * dz));
}

/** Every named road within r of (x, z) with its distance (one entry per name, the nearest), nearest first. Pure. */
export function namedRoadsNear(roads: RoadSet, names: readonly string[], x: number, z: number, r = STREET_R): StreetHit[] {
  const best = new Map<string, number>();
  const xyz = roads.xyz;
  for (let i = 0; i < roads.count; i++) {
    const ni = roads.nameIdx[i];
    if (ni === NO_NAME || SKIP.has(roads.cls[i])) continue;
    const name = names[ni];
    if (!name) continue;
    const p0 = roads.pStart[i], p1 = roads.pStart[i + 1];
    for (let k = p0; k < p1 - 1; k++) {
      const ax = xyz[k * 3], az = xyz[k * 3 + 2], bx = xyz[k * 3 + 3], bz = xyz[k * 3 + 5];
      // cheap reject on the segment's box
      if (x < Math.min(ax, bx) - r || x > Math.max(ax, bx) + r || z < Math.min(az, bz) - r || z > Math.max(az, bz) + r) continue;
      const d = segDist(x, z, ax, az, bx, bz);
      if (d < r && d < (best.get(name) ?? Infinity)) best.set(name, d);
    }
  }
  return [...best].map(([name, d]) => ({ name, d })).sort((a, b) => a.d - b.d);
}

/** Hysteresis: keep `prev` while it is still in range and no other street is `hyst` nearer. Pure. */
export function chooseStreet(prev: string | null, hits: readonly StreetHit[], hyst = STREET_HYST): string | null {
  if (!hits.length) return null;
  const kept = prev ? hits.find(h => h.name === prev) : undefined;
  if (kept && kept.d <= hits[0].d + hyst) return prev;
  return hits[0].name;
}

// ---------------------------------------------------------------------------
// Runtime
// ---------------------------------------------------------------------------

let current: string | null = null;
const subs = new Set<() => void>();
function setStreet(name: string | null) {
  if (name === current) return;
  current = name;
  for (const fn of subs) fn();
}
const subscribe = (fn: () => void) => { subs.add(fn); return () => { subs.delete(fn); }; };
const snapshot = () => current;
/** The HUD's street name (null: none within 6 u, or district mode). */
export function useStreetName(): string | null { return useSyncExternalStore(subscribe, snapshot, snapshot); }
export const streetName = () => current;

type Slot = RoadSet | 'loading' | 'none';
const chunks = new Map<string, Slot>();
let lastTick = 0, lastFetch = 0;

function chunkRoads(cx: number, cz: number, now: number): RoadSet | null {
  const k = `${cx}_${cz}`;
  const hit = chunks.get(k);
  if (hit !== undefined) {
    chunks.delete(k); chunks.set(k, hit); // LRU touch
    return typeof hit === 'object' ? hit : null;
  }
  const s = cityStreamerLazy();
  const m = s?.manifest;
  if (!m || now - lastFetch < FETCH_GAP_MS) return null;
  if (!m.chunks.some(c => c.k === k)) { chunks.set(k, 'none'); return null; }
  lastFetch = now;
  chunks.set(k, 'loading');
  fetchChunk(versionBase(m.version), cx, cz).then(
    c => { chunks.set(k, c.roads); },
    () => { chunks.delete(k); },
  );
  while (chunks.size > LRU) chunks.delete(chunks.keys().next().value as string);
  return null;
}

/** Focus-hook tick (10 Hz; runs at 2 Hz inside). */
export function tickStreet(p: Vec2, now: number) {
  if (now - lastTick < TICK_MS) return;
  lastTick = now;
  if (game.get().worldMode !== 'city') { setStreet(null); return; }
  const far = cityStreamerLazy()?.far;
  if (!far) return;
  const cx = Math.floor(p.x / CHUNK), cz = Math.floor(p.z / CHUNK);
  // the chunk under the player plus a neighbour whose edge is within reach
  const keys: [number, number][] = [[cx, cz]];
  const fx = p.x - cx * CHUNK, fz = p.z - cz * CHUNK;
  const nx = fx < STREET_R ? -1 : fx > CHUNK - STREET_R ? 1 : 0, nz = fz < STREET_R ? -1 : fz > CHUNK - STREET_R ? 1 : 0;
  if (nx) keys.push([cx + nx, cz]);
  if (nz) keys.push([cx, cz + nz]);
  if (nx && nz) keys.push([cx + nx, cz + nz]);
  let hits: StreetHit[] = [];
  let missing = false;
  for (const [x, z] of keys) {
    const roads = chunkRoads(x, z, now);
    if (roads) hits.push(...namedRoadsNear(roads, far.names, p.x, p.z));
    else if (chunks.get(`${x}_${z}`) !== 'none') missing = true;
  }
  // a chunk still on its way: the far city's main streets meanwhile
  if (missing && !hits.length) hits = namedRoadsNear(far.lines, far.names, p.x, p.z);
  hits.sort((a, b) => a.d - b.d);
  setStreet(chooseStreet(current, hits));
}
