/**
 * Save v2 (lane G1, plan §6.11 / G1-3). DEPENDENCY-FREE (no three, no game modules): the title screen imports it, so
 * it must stay a few KB in the title chunk.
 *
 *   readSave()             the validated save or null (decoded as untrusted input, ≤ 64 KB, version 2)
 *   decodeSave(raw)        the pure decoder behind it (tests fuzz it): bad rows are dropped, never thrown
 *   patchSave(fn)          change the save in memory; a debounced 1 s write (plus a flush on pagehide) persists it
 *   noteRide(lineId)       lane F, after a counted stop-to-stop ride (save v2 `rides`)
 *   reconcileRides(log)    the sampler reads lane F's transit.rideLog() (this visit) into `rides`: a ride F counted
 *                          without a noteRide is added once, a noted one never twice
 *   requestResume() / takeResumeRequest()   the title's "继续上次的位置" → game/resume.ts startOrResume
 *   clearSave()            Settings → reset progress
 *
 * Progress v1 (`opus-bay:progress:v1`) and the wishlist key are untouched. `?save=off` disables every write (QA).
 */

export const SAVE_KEY = 'opus-bay:save:v2';
export const SAVE_MAX_BYTES = 64 * 1024;
export const MAX_DISCOVERED = 2000;
export const MAX_ZONES = 64;
export const MAX_RIDE_LINES = 32;
/** ids: place / landmark / zone / line ids (`sf:`-style prefixes allowed) */
export const SAVE_ID = /^[a-z0-9:-]{1,80}$/;
/** the published city bbox (manifest.json bbox); positions a little outside are clamped, far outside dropped */
export const SAVE_BOUNDS = { minX: -1024, minZ: -896, maxX: 1536, maxZ: 2176 } as const;
const CLAMP_SLACK = 64;

export type SaveWorld = 'district' | 'city';
export interface SavePose { x: number; z: number; heading: number }

export interface SaveV2 {
  version: 2;
  /** last safe spot (on foot, standable), per world mode it was taken in */
  lastSafe?: { world: SaveWorld; x: number; z: number; heading: number; zone?: string };
  discovered?: string[];
  zones?: string[];
  rides?: Record<string, number>;
  vehicles?: { bike?: { id: string; x: number; z: number; heading: number }; car?: { x: number; z: number; heading: number } };
  unlocked?: { glide?: boolean };
  /** ms since epoch of the last write */
  savedAt?: number;
}

// ---------------------------------------------------------------------------
// Pure decoding (untrusted input)
// ---------------------------------------------------------------------------

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const fin = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isId = (v: unknown): v is string => typeof v === 'string' && SAVE_ID.test(v);

/** Clamp a coordinate to the bbox (slightly outside → the edge; far outside or not finite → null). */
function coord(v: unknown, lo: number, hi: number): number | null {
  if (!fin(v)) return null;
  if (v < lo - CLAMP_SLACK || v > hi + CLAMP_SLACK) return null;
  return Math.min(hi, Math.max(lo, v));
}

/** heading wrapped to (−π, π] */
function wrapHeading(v: unknown): number {
  if (!fin(v)) return 0;
  const t = Math.PI * 2;
  let h = v % t;
  if (h > Math.PI) h -= t;
  if (h <= -Math.PI) h += t;
  return h;
}

export function decodePose(v: unknown): SavePose | null {
  if (!isObj(v)) return null;
  const x = coord(v.x, SAVE_BOUNDS.minX, SAVE_BOUNDS.maxX), z = coord(v.z, SAVE_BOUNDS.minZ, SAVE_BOUNDS.maxZ);
  return x === null || z === null ? null : { x, z, heading: wrapHeading(v.heading) };
}

function idList(v: unknown, max: number): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out = new Set<string>();
  for (const item of v) {
    if (out.size >= max) break;
    if (isId(item)) out.add(item);
  }
  return [...out];
}

/** The pure decoder: JSON text (or a parsed value) → a clean SaveV2, or null when it is not a v2 save. Never throws. */
export function decodeSave(raw: unknown): SaveV2 | null {
  let v: unknown = raw;
  if (typeof raw === 'string') {
    if (raw.length > SAVE_MAX_BYTES) return null;
    try { v = JSON.parse(raw); } catch { return null; }
  }
  if (!isObj(v) || v.version !== 2) return null;
  const out: SaveV2 = { version: 2 };
  if (isObj(v.lastSafe)) {
    const p = decodePose(v.lastSafe), world = v.lastSafe.world;
    if (p && (world === 'district' || world === 'city')) {
      out.lastSafe = { world, ...p };
      if (isId(v.lastSafe.zone)) out.lastSafe.zone = v.lastSafe.zone;
    }
  }
  const discovered = idList(v.discovered, MAX_DISCOVERED);
  if (discovered) out.discovered = discovered;
  const zones = idList(v.zones, MAX_ZONES);
  if (zones) out.zones = zones;
  if (isObj(v.rides)) {
    const rides: Record<string, number> = {};
    let n = 0;
    for (const [k, c] of Object.entries(v.rides)) {
      if (n >= MAX_RIDE_LINES) break;
      if (!isId(k) || !fin(c) || c < 0) continue;
      rides[k] = Math.min(1e6, Math.floor(c));
      n++;
    }
    out.rides = rides;
  }
  if (isObj(v.vehicles)) {
    const veh: NonNullable<SaveV2['vehicles']> = {};
    const bike = v.vehicles.bike, car = v.vehicles.car;
    if (isObj(bike) && isId(bike.id)) { const p = decodePose(bike); if (p) veh.bike = { id: bike.id, ...p }; }
    if (isObj(car)) { const p = decodePose(car); if (p) veh.car = p; }
    if (veh.bike || veh.car) out.vehicles = veh;
  }
  if (isObj(v.unlocked) && typeof v.unlocked.glide === 'boolean') out.unlocked = { glide: v.unlocked.glide };
  if (fin(v.savedAt) && v.savedAt > 0) out.savedAt = v.savedAt;
  return out;
}

/** Serialise; drops the oldest discoveries if the text would pass the size cap (the id caps keep it far below). */
export function encodeSave(s: SaveV2): string {
  let text = JSON.stringify(s);
  if (text.length <= SAVE_MAX_BYTES) return text;
  text = JSON.stringify({ ...s, discovered: (s.discovered ?? []).slice(-500) });
  return text.length <= SAVE_MAX_BYTES ? text : JSON.stringify({ version: 2, lastSafe: s.lastSafe });
}

// ---------------------------------------------------------------------------
// Storage (browser)
// ---------------------------------------------------------------------------

const hasWindow = () => typeof window !== 'undefined';
/** ?save=off: QA runs never touch the player's save */
export const savesOff = () => hasWindow() && /[?&]save=off(?:&|$)/.test(window.location?.search ?? '');

let cache: SaveV2 | null | undefined;
let timer: ReturnType<typeof setTimeout> | null = null;
let flushHooked = false;

function storage(): Storage | null {
  try { return hasWindow() ? window.localStorage : null; } catch { return null; }
}

/** The validated save or null. Read once, then served from memory (patchSave keeps it current). */
export function readSave(): SaveV2 | null {
  if (cache !== undefined) return cache;
  let raw: string | null;
  try { raw = storage()?.getItem(SAVE_KEY) ?? null; } catch { raw = null; }
  cache = raw ? decodeSave(raw) : null;
  return cache;
}

/** Write now (pagehide, tab hidden). */
export function flushSave() {
  if (timer) { clearTimeout(timer); timer = null; }
  if (!cache || savesOff()) return;
  try { storage()?.setItem(SAVE_KEY, encodeSave({ ...cache, savedAt: Date.now() })); } catch { /* quota / private mode: keep playing */ }
}

/** Change the save in memory (`fn` edits a shallow copy); written after 1 s of quiet. */
export function patchSave(fn: (s: SaveV2) => void) {
  const draft: SaveV2 = { ...(readSave() ?? { version: 2 }) };
  fn(draft);
  cache = draft;
  // no storage (node tests with a stub window, blocked storage): memory only
  if (savesOff() || !storage()) return;
  if (!flushHooked && typeof window.addEventListener === 'function') {
    flushHooked = true;
    window.addEventListener('pagehide', flushSave);
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushSave(); });
  }
  if (timer) clearTimeout(timer);
  timer = setTimeout(flushSave, 1000);
}

/** Settings → reset progress. */
export function clearSave() {
  if (timer) { clearTimeout(timer); timer = null; }
  cache = null;
  try { storage()?.removeItem(SAVE_KEY); } catch { /* ignore */ }
}

/** rides noted this visit, per line (reconcileRides compares lane F's rideLog with it) */
const notedThisVisit: Record<string, number> = {};

/** lane F: one counted ride on `lineId` */
export const noteRide: (lineId: string) => void = lineId => {
  if (!isId(lineId)) return;
  notedThisVisit[lineId] = (notedThisVisit[lineId] ?? 0) + 1;
  patchSave(s => {
    const rides = { ...(s.rides ?? {}) };
    if (!(lineId in rides) && Object.keys(rides).length >= MAX_RIDE_LINES) return;
    rides[lineId] = Math.min(1e6, (rides[lineId] ?? 0) + 1);
    s.rides = rides;
  });
};

/**
 * Lane F's request (wave 3): `transit.rideLog()` (rides per line this visit) into save v2 `rides`. F already calls
 * noteRide per counted ride; anything the log holds beyond what was noted this visit is added (so a ride is never
 * counted twice). Returns how many rides were added.
 */
export function reconcileRides(log: Readonly<Record<string, number>>): number {
  let added = 0;
  for (const [line, n] of Object.entries(log)) {
    if (!isId(line) || !fin(n)) continue;
    const extra = Math.floor(n) - (notedThisVisit[line] ?? 0);
    for (let i = 0; i < Math.min(extra, 1000); i++) { noteRide(line); added++; }
  }
  return added;
}

/** The spot to offer "继续上次的位置" in this world mode (null: nothing saved there). */
export function resumeSpot(world: SaveWorld): NonNullable<SaveV2['lastSafe']> | null {
  const s = readSave()?.lastSafe;
  return s && s.world === world ? s : null;
}

let resumeRequested = false;
export function requestResume() { resumeRequested = true; }
/** true once after requestResume() (game/resume.ts reads it) */
export function takeResumeRequest(): boolean { const r = resumeRequested; resumeRequested = false; return r; }

/** tests: forget the in-memory copy (and this visit's noted rides) */
export function resetSaveCache() { cache = undefined; if (timer) { clearTimeout(timer); timer = null; } for (const k of Object.keys(notedThisVisit)) delete notedThisVisit[k]; }
