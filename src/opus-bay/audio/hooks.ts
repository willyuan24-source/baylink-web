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
 */

export interface SoundOpts { gain?: number; pan?: number; pitch?: number }
export type SoundRecipe = (e: AudioEngine, opts?: SoundOpts) => void;
export interface LoopHandle { setGain(g: number): void; stop(): void }
export type LoopRecipe = (e: AudioEngine) => LoopHandle;
export type DuckBus = 'music' | 'ambience';

interface LoopState { recipe: LoopRecipe; target: number; current: number; fadeMs: number; handle: LoopHandle | null }

const sounds = new Map<string, SoundRecipe>();
const loops = new Map<string, LoopState>();
let engine: AudioEngine | null = null;
let isLive: () => boolean = () => false;
const DEV = import.meta.env?.DEV;

const clamp01 = (v: number) => (Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0);
const report = (what: string, id: string, error: unknown) => { if (DEV) console.error(`[opus-audio hooks] ${what} ${id}`, error); };

export function registerSound(id: string, recipe: SoundRecipe): () => void {
  sounds.set(id, recipe);
  return () => { if (sounds.get(id) === recipe) sounds.delete(id); };
}

export function playSound(id: string, opts?: SoundOpts): void {
  const recipe = sounds.get(id);
  if (!recipe || !engine || !isLive()) return;
  try { recipe(engine, opts); } catch (error) { report('sound', id, error); }
}

export function registerLoop(id: string, recipe: LoopRecipe): () => void {
  const prev = loops.get(id);
  if (prev?.handle) stopHandle(id, prev);
  const state: LoopState = { recipe, target: prev?.target ?? 0, current: 0, fadeMs: prev?.fadeMs ?? 400, handle: null };
  loops.set(id, state);
  return () => {
    if (loops.get(id) !== state) return;
    if (state.handle) stopHandle(id, state);
    loops.delete(id);
  };
}

export function setLoop(id: string, gain: number, fadeMs = 400): void {
  const state = loops.get(id);
  if (!state) return;
  state.target = clamp01(gain);
  state.fadeMs = Number.isFinite(fadeMs) ? Math.max(0, fadeMs) : 400;
}

export function audioNow(): number {
  const ctx = engine?.ctx;
  if (ctx && ctx.state === 'running') return ctx.currentTime;
  return (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;
}

export function duck(bus: DuckBus, amount: number, ms: number): void {
  if (!engine || !isLive() || (bus !== 'music' && bus !== 'ambience')) return;
  engine.buses[bus].duck(clamp01(amount), engine.now + Math.max(0, Number.isFinite(ms) ? ms : 0) / 1000);
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
  for (const [id, state] of loops) {
    const target = live ? state.target : 0;
    if (!state.handle) {
      if (target <= 0 || !live) continue;
      try { state.handle = state.recipe(engine); } catch (error) { report('loop', id, error); state.target = 0; continue; }
      state.current = 0;
    }
    const step = state.fadeMs <= 0 ? 1 : Math.max(0, dt) * 1000 / state.fadeMs;
    const next = state.current < target ? Math.min(target, state.current + step) : Math.max(target, state.current - step);
    if (next !== state.current) {
      state.current = next;
      try { state.handle.setGain(next); } catch (error) { report('loop gain', id, error); }
    }
    if (state.current <= 0 && target <= 0) stopHandle(id, state);
  }
}

/** tests / QA: what is registered and running */
export function audioHooksStats(): { sounds: number; loops: number; running: string[] } {
  return { sounds: sounds.size, loops: loops.size, running: [...loops].filter(([, s]) => s.handle).map(([id]) => id) };
}
