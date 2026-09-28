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
 *
 * Wave 5 (day 0, plan sf-w5-plan.md MF5): `play` (coins, finds, wearables, bests; the frozen format of data/playSave.ts,
 * written by lane E's ledger) is decoded here as untrusted input, and the encoder never loses progress to the 64 KB cap:
 * it trims `discovered` (→ 500, the newest kept), then `arrivals` (→ 128), and only then drops the re-learnable rows;
 * `play`, `unlocked`, `tours` and `lastSafe` are never dropped (encodeSave below).
 */
import { decodePlay, type PlaySaveV1 } from './playSave';

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
  /**
   * Wave 4 · lane C: city tour progress per tour id (`sf-grand`), ≤ 8 ids. Decoded here as untrusted input (shape and
   * caps); data/sf/tours.ts decodeTourSaves clamps it to the tour's own chapters and stop ids when a tour reads it.
   */
  tours?: Record<string, SaveTourProgress>;
  /** Wave 4 · lane C: arrival moments already had (`<attraction>` or `<attraction>@<spot>`, ≤ 512; game/arrival.ts) */
  arrivals?: string[];
  /** Wave 5 · lane E: coins, finds, wearables, bests, the daily three (frozen format: data/playSave.ts) */
  play?: PlaySaveV1;
  /** ms since epoch of the last write */
  savedAt?: number;
}

export interface SaveTourProgress { chapter: number; stop: number; completed: string[]; express?: boolean }
export const MAX_TOUR_SAVES = 8;
export const MAX_ARRIVALS = 512;
const TOUR_ID = /^[a-z0-9][a-z0-9-]{0,39}$/;
const ARRIVAL_KEY = /^[a-z0-9][a-z0-9-]{0,63}(@[a-z0-9-]{1,24})?$/;

/** Save v2 `tours`: well-formed ids only, chapter / stop integers in 0–32, ≤ 64 unique stop ids, express only when true. */
export function decodeTours(v: unknown): Record<string, SaveTourProgress> | undefined {
  if (!isObj(v)) return undefined;
  const out: Record<string, SaveTourProgress> = {};
  let n = 0;
  for (const [id, raw] of Object.entries(v)) {
    if (n >= MAX_TOUR_SAVES) break;
    if (!TOUR_ID.test(id) || !isObj(raw)) continue;
    const int = (x: unknown) => (fin(x) ? Math.max(0, Math.min(32, Math.floor(x))) : 0);
    const done = Array.isArray(raw.completed) ? [...new Set(raw.completed.filter((s): s is string => typeof s === 'string' && TOUR_ID.test(s)))].slice(0, 64) : [];
    out[id] = { chapter: int(raw.chapter), stop: int(raw.stop), completed: done, ...(raw.express === true ? { express: true } : {}) };
    n++;
  }
  return out;
}

/** Save v2 `arrivals`: well-formed seen keys, unique, ≤ 512 (game/arrival.ts decodeArrivalSeen applies the same rule). */
export function decodeArrivals(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  return [...new Set(v.filter((k): k is string => typeof k === 'string' && ARRIVAL_KEY.test(k)))].slice(0, MAX_ARRIVALS);
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
  const tours = decodeTours(v.tours);
  if (tours) out.tours = tours;
  const arrivals = decodeArrivals(v.arrivals);
  if (arrivals) out.arrivals = arrivals;
  const play = decodePlay(v.play);
  if (play) out.play = play;
  if (fin(v.savedAt) && v.savedAt > 0) out.savedAt = v.savedAt;
  return out;
}

/** encodeSave's trims, in order (wave 5, MF5): the newest `discovered` and `arrivals` are kept. */
export const SAVE_TRIM_DISCOVERED = 500;
export const SAVE_TRIM_ARRIVALS = 128;

/**
 * Serialise within SAVE_MAX_BYTES without ever losing progress that cannot be re-learned by walking (wave 5, MF5).
 * Steps, each only while the text is still over the cap: 1. `discovered` → the newest 500; 2. `arrivals` → the newest
 * 128; 3. drop `discovered` and `arrivals`; 4. drop `zones`, `rides` and `vehicles`. `version`, `lastSafe`, `unlocked`,
 * `tours`, `play` and `savedAt` are always written (their decode caps keep them far below 64 KB together; the contracts
 * size test builds every cap at its longest ids).
 */
export function encodeSave(s: SaveV2): string {
  let text = JSON.stringify(s);
  if (text.length <= SAVE_MAX_BYTES) return text;
  let t: SaveV2 = s.discovered && s.discovered.length > SAVE_TRIM_DISCOVERED ? { ...s, discovered: s.discovered.slice(-SAVE_TRIM_DISCOVERED) } : s;
  text = JSON.stringify(t);
  if (text.length <= SAVE_MAX_BYTES) return text;
  if (t.arrivals && t.arrivals.length > SAVE_TRIM_ARRIVALS) { t = { ...t, arrivals: t.arrivals.slice(-SAVE_TRIM_ARRIVALS) }; text = JSON.stringify(t); }
  if (text.length <= SAVE_MAX_BYTES) return text;
  t = { ...t };
  delete t.discovered;
  delete t.arrivals;
  text = JSON.stringify(t);
  if (text.length <= SAVE_MAX_BYTES) return text;
  const { version, lastSafe, unlocked, tours, play, savedAt } = t;
  return JSON.stringify({ version, lastSafe, unlocked, tours, play, savedAt });
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

/** Settings → reset progress. Modules that keep a copy of the save in memory drop it (`onSaveCleared`). */
export function clearSave() {
  if (timer) { clearTimeout(timer); timer = null; }
  cache = null;
  try { storage()?.removeItem(SAVE_KEY); } catch { /* ignore */ }
  for (const fn of [...clearedListeners]) { try { fn(); } catch (e) { if (import.meta.env?.DEV) console.error('[opus-bay save] reset listener', e); } }
}

const clearedListeners = new Set<() => void>();
/**
 * Wave-4 verify F5: a module holding save state in memory (lane C's arrival stamps, the Grand Tour's run; lane P's
 * discovery sets may join) forgets it when the player resets progress, so the next write cannot put it back.
 * Returns the unregister.
 */
export function onSaveCleared(fn: () => void): () => void {
  clearedListeners.add(fn);
  return () => { clearedListeners.delete(fn); };
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
