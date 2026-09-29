import type { AudioEngine } from './engine';

/**
 * Wave 5 (API FROZEN at day 0, plan sf-w5-plan.md §4.2 W5-0d; lane T owns the internals) · sounds for the new lanes.
 *
 *   registerSound(id, recipe)       a one-shot recipe (synthesized with the engine's primitives, like audio/sfx.ts)
 *   playSound(id, opts?)            play it now (nothing before audio is live, while sound is off, or for an unknown id)
 *   registerLoop(id, recipe)        a continuous layer: the recipe builds it and returns { setGain, stop }
 *   setLoop(id, gain, fadeMs?)      the loop's target gain 0..1 (fade over fadeMs, default 400 ms); it is built on the
 *                                   first gain > 0 while audio is live and stopped (its nodes released) after fading to 0
 *   audioNow()                      AudioContext.currentTime (s) while audio is running; the performance clock before
 *                                   (the base changes once, at the first gesture: compare times read in the same state)
 *   duck(bus, amount, ms)           lower the music or ambience bus to `amount` (0..1) for `ms` (the jets' roar, a reveal)
 *
 * Recipes run inside audio's own guard (a throwing recipe is logged in DEV and dropped for that play). Keep recipes on
 * the sfx bus (one-shots) or the ambience bus (loops), cheap, and synthesized: no files, no real songs.
 *
 * audio/audio.ts binds the live engine with `bindAudioHooks` and steps the loop fades with `stepAudioHooks` from its
 * 10 Hz tick (lane T may change both; they are not part of the frozen API).
 *
 * Internals (W5-T6, lane T) — what the frozen API promises, made safe for ten lanes calling it on a phone:
 * - **Options** reach the recipe with only the keys the caller gave, finite and clamped (gain 0..2, pan −1..1, pitch
 *   0.25..4); a bad value is left out, never NaN into an AudioParam.
 * - **Rate limits**: one id plays at most SOUND_RATE a second (bursts of SOUND_BURST: a coin trail picked up at a run is
 *   ≈ 7 a second) and every id together at most ALL_RATE a second — a runaway caller (a play every frame) cannot steal the
 *   engine's 32 voices from footsteps and dialogue. Dropped plays are counted (`audioHooksStats().throttled`).
 * - **A recipe that throws** RECIPE_STRIKES times is switched off until it is registered again (one DEV error each time,
 *   not one a frame).
 * - **Loops**: `setLoop` before `registerLoop` is remembered (the feature chunks load in parallel); at most MAX_LOOPS are
 *   built at once — the loudest targets first, the others wait for a free place (a phone keeps its audio thread light);
 *   sound off, the tab hidden or audio unbound: they fade / stop and come back at their targets.
 * - **duck** lowers the bus through the engine's own ducks (audio/engine.ts Bus: several ducks, each ending on its own,
 *   the lowest in force applies); `ms` is capped at MAX_DUCK_MS.
 */

export interface SoundOpts { gain?: number; pan?: number; pitch?: number }
export type SoundRecipe = (e: AudioEngine, opts?: SoundOpts) => void;
export interface LoopHandle { setGain(g: number): void; stop(): void }
export type LoopRecipe = (e: AudioEngine) => LoopHandle;
export type DuckBus = 'music' | 'ambience';

interface LoopState { recipe: LoopRecipe; target: number; current: number; fadeMs: number; handle: LoopHandle | null }
interface SoundState { recipe: SoundRecipe; tokens: number; last: number; strikes: number; plays: number }

/** one id: plays a second, and the burst it may spend at once */
export const SOUND_RATE = 16;
export const SOUND_BURST = 6;
/** every id together: plays a second, and the burst */
export const ALL_RATE = 40;
export const ALL_BURST = 16;
/** a recipe that throws this many times is switched off until registered again */
export const RECIPE_STRIKES = 3;
/** loops built at once */
export const MAX_LOOPS = 6;
/** the longest duck (ms) */
export const MAX_DUCK_MS = 60_000;
/** remembered setLoop targets for ids not registered yet */
const MAX_PENDING = 32;

const sounds = new Map<string, SoundState>();
const loops = new Map<string, LoopState>();
const pendingLoops = new Map<string, { target: number; fadeMs: number }>();
let engine: AudioEngine | null = null;
let isLive: () => boolean = () => false;
const all = { tokens: ALL_BURST, last: -Infinity };
const counts = { throttled: 0, errors: 0 };
const DEV = import.meta.env?.DEV;

const clamp01 = (v: number) => (Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0);
const report = (what: string, id: string, error: unknown) => { counts.errors++; if (DEV) console.error(`[opus-audio hooks] ${what} ${id}`, error); };
const wallSeconds = () => (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;

/** The options the caller gave, finite and in range (only those keys: a recipe's own defaults still apply). */
function cleanOpts(o: SoundOpts | undefined): SoundOpts | undefined {
  if (!o || typeof o !== 'object') return undefined;
  const out: SoundOpts = {};
  const put = (k: keyof SoundOpts, lo: number, hi: number) => { const v = o[k]; if (typeof v === 'number' && Number.isFinite(v)) out[k] = Math.max(lo, Math.min(hi, v)); };
  put('gain', 0, 2);
  put('pan', -1, 1);
  put('pitch', 0.25, 4);
  return out;
}

/** a token bucket: refilled at `rate` a second up to `burst`; true (and one spent) when a token is there */
function take(b: { tokens: number; last: number }, rate: number, burst: number, now: number): boolean {
  if (b.last !== -Infinity) b.tokens = Math.min(burst, b.tokens + Math.max(0, now - b.last) * rate);
  b.last = now;
  if (b.tokens < 1) return false;
  b.tokens -= 1;
  return true;
}

export function registerSound(id: string, recipe: SoundRecipe): () => void {
  const state: SoundState = { recipe, tokens: SOUND_BURST, last: -Infinity, strikes: 0, plays: 0 };
  sounds.set(id, state);
  return () => { if (sounds.get(id) === state) sounds.delete(id); };
}

/** (W6-X3) Whether a feature registered this sound (audio.ts leaves a moment a lane voices itself to that lane). */
export function soundRegistered(id: string): boolean {
  return sounds.has(id);
}

export function playSound(id: string, opts?: SoundOpts): void {
  const state = sounds.get(id);
  if (!state || !engine || !isLive() || state.strikes >= RECIPE_STRIKES) return;
  const now = wallSeconds();
  // (the id's own bucket first: a flood from one caller never empties the shared one)
  if (!take(state, SOUND_RATE, SOUND_BURST, now) || !take(all, ALL_RATE, ALL_BURST, now)) { counts.throttled++; return; }
  try {
    state.recipe(engine, cleanOpts(opts));
    state.plays++;
  } catch (error) {
    state.strikes++;
    report(state.strikes >= RECIPE_STRIKES ? 'sound (switched off)' : 'sound', id, error);
  }
}

export function registerLoop(id: string, recipe: LoopRecipe): () => void {
  const prev = loops.get(id);
  if (prev?.handle) stopHandle(id, prev);
  const pending = pendingLoops.get(id);
  pendingLoops.delete(id);
  const state: LoopState = { recipe, target: prev?.target ?? pending?.target ?? 0, current: 0, fadeMs: prev?.fadeMs ?? pending?.fadeMs ?? 400, handle: null };
  loops.set(id, state);
  return () => {
    if (loops.get(id) !== state) return;
    if (state.handle) stopHandle(id, state);
    loops.delete(id);
  };
}

export function setLoop(id: string, gain: number, fadeMs = 400): void {
  const target = clamp01(gain), fade = Number.isFinite(fadeMs) ? Math.max(0, fadeMs) : 400;
  const state = loops.get(id);
  if (!state) {
    // (a feature may ask before its loop is registered: remembered, a few ids at most)
    if (pendingLoops.size >= MAX_PENDING && !pendingLoops.has(id)) pendingLoops.delete(pendingLoops.keys().next().value!);
    pendingLoops.set(id, { target, fadeMs: fade });
    return;
  }
  state.target = target;
  state.fadeMs = fade;
}

export function audioNow(): number {
  const ctx = engine?.ctx;
  if (ctx && ctx.state === 'running') return ctx.currentTime;
  return wallSeconds();
}

export function duck(bus: DuckBus, amount: number, ms: number): void {
  if (!engine || !isLive() || (bus !== 'music' && bus !== 'ambience')) return;
  const len = Math.min(MAX_DUCK_MS, Math.max(0, Number.isFinite(ms) ? ms : 0));
  engine.buses[bus].duck(clamp01(amount), engine.now + len / 1000);
}

function stopHandle(id: string, state: LoopState) {
  try { state.handle?.stop(); } catch (error) { report('loop stop', id, error); }
  state.handle = null;
  state.current = 0;
}

// --- internals for audio/audio.ts (lane T) ------------------------------------------------------------------------

/** audio.ts: the live engine (null on teardown: every loop is stopped) and its "may sound play now" test. */
export function bindAudioHooks(next: AudioEngine | null, live?: () => boolean): void {
  if (!next) for (const [id, state] of loops) if (state.handle) stopHandle(id, state);
  engine = next;
  isLive = next && live ? live : () => false;
}

/** audio.ts tick (≈ 10 Hz while running): move each loop toward its target, build / stop it at the ends. */
export function stepAudioHooks(dt: number): void {
  if (!engine) return;
  const live = isLive();
  let running = 0;
  for (const state of loops.values()) if (state.handle) running++;
  // the loops waiting to be built, loudest first (at most MAX_LOOPS at once)
  let waiting: [string, LoopState][] | null = null;
  for (const [id, state] of loops) {
    const target = live ? state.target : 0;
    if (!state.handle) {
      if (target <= 0 || !live) continue;
      (waiting ??= []).push([id, state]);
      continue;
    }
    fade(id, state, target, dt);
    if (!state.handle) running--;
  }
  if (!waiting) return;
  waiting.sort((a, b) => b[1].target - a[1].target);
  for (const [id, state] of waiting) {
    if (running >= MAX_LOOPS) break;
    try { state.handle = state.recipe(engine); } catch (error) { report('loop', id, error); state.target = 0; continue; }
    state.current = 0;
    running++;
    fade(id, state, state.target, dt);
  }
}

/** One fade step toward `target`; stopped (released) once it reaches 0 with the target at 0. */
function fade(id: string, state: LoopState, target: number, dt: number) {
  if (!state.handle) return;
  const step = state.fadeMs <= 0 ? 1 : Math.max(0, dt) * 1000 / state.fadeMs;
  const next = state.current < target ? Math.min(target, state.current + step) : Math.max(target, state.current - step);
  if (next !== state.current) {
    state.current = next;
    try { state.handle.setGain(next); } catch (error) { report('loop gain', id, error); }
  }
  if (state.current <= 0 && target <= 0) stopHandle(id, state);
}

/** tests / QA: what is registered and running, plays per id, what the limits dropped, errors */
export function audioHooksStats(): { sounds: number; loops: number; running: string[]; waiting: string[]; plays: Record<string, number>; throttled: number; errors: number; off: string[]; pending: string[] } {
  const plays: Record<string, number> = {};
  for (const [id, s] of sounds) if (s.plays) plays[id] = s.plays;
  return {
    sounds: sounds.size,
    loops: loops.size,
    running: [...loops].filter(([, s]) => s.handle).map(([id]) => id),
    waiting: [...loops].filter(([, s]) => !s.handle && s.target > 0).map(([id]) => id),
    plays,
    throttled: counts.throttled,
    errors: counts.errors,
    off: [...sounds].filter(([, s]) => s.strikes >= RECIPE_STRIKES).map(([id]) => id),
    pending: [...pendingLoops.keys()],
  };
}
