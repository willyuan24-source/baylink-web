/**
 * Wave 9 · lane X (W9-X1): the player's sound levels — the contract for lane A's Settings (sf-w9-lead.md §3 A(4) / X(4)).
 *
 *   getAudioLevels()                         { music, effects, voice: 0..1, voiceMuted }
 *   setMusicVolume(v) / setEffectsVolume(v) / setVoiceVolume(v)     0..1 (clamped; NaN ignored)
 *   setVoiceMuted(on)                        「只关语音」: BAYBAY's voice (her recorded lines, barks, chirps and the
 *                                            dialogue blips) is silent, music and effects play on; no clip is fetched
 *   onAudioLevels(cb) → off                  every change (audio/audio.ts applies them live; Settings re-renders)
 *   useAudioLevels()                         the same as a React hook (useSyncExternalStore)
 *   resetAudioLevels()                       the defaults (a progress reset may call it; not required)
 *
 * The master switch stays `settings.sound` and the music switch `settings.music` (core/store.ts, frozen): these are
 * the levels under them. "Effects" = the sound effects and the city's soundscape (the sfx + ambience buses); "voice" =
 * the voice bus. Music defaults to 60 % of wave 8's level (the review's risk: music on by default in a public place;
 * audio/audio.ts also holds it until the player's first own gesture after Start and fades it in).
 *
 * Stored in its own key `opus-bay:audio:v1` (no save bit; `?save=off` or a blocked storage keeps it for this page).
 * A tiny module with no game imports: Settings (its own lazy chunk) and audio/audio.ts (its own lazy chunk) share it;
 * nothing here is in GameRoot's static graph.
 */
import { useSyncExternalStore } from 'react';

export interface AudioLevels {
  /** the music bus, 0..1 of its mix level (default 0.6) */
  music: number;
  /** sound effects + the soundscape (sfx and ambience buses), 0..1 (default 1) */
  effects: number;
  /** BAYBAY's voice (the voice bus), 0..1 (default 1) */
  voice: number;
  /** 「只关语音」: the voice bus is silent and no voice clip is fetched */
  voiceMuted: boolean;
}

export const DEFAULT_AUDIO_LEVELS: Readonly<AudioLevels> = Object.freeze({ music: 0.6, effects: 1, voice: 1, voiceMuted: false });
export const AUDIO_LEVELS_KEY = 'opus-bay:audio:v1';

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const clamp01 = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : d);
const savesOff = () => typeof window !== 'undefined' && /[?&]save=off(?:&|$)/.test(window.location?.search ?? '');
function defaultStorage(): Store | null {
  try { return typeof window !== 'undefined' && !savesOff() ? window.localStorage : null; } catch { return null; }
}

/** A stored value read back, every field validated (anything else: the default). */
export function parseAudioLevels(raw: string | null | undefined): AudioLevels {
  let v: Partial<Record<keyof AudioLevels, unknown>> & { v?: unknown } = {};
  try { const p = raw ? JSON.parse(raw) as unknown : null; if (p && typeof p === 'object') v = p as typeof v; } catch { /* unreadable: defaults */ }
  if (v.v !== 1) return { ...DEFAULT_AUDIO_LEVELS };
  const d = DEFAULT_AUDIO_LEVELS;
  return { music: clamp01(v.music, d.music), effects: clamp01(v.effects, d.effects), voice: clamp01(v.voice, d.voice), voiceMuted: v.voiceMuted === true };
}

let storage: Store | null | undefined;
let levels: AudioLevels | null = null;
const listeners = new Set<(l: AudioLevels) => void>();

/** (tests) a fake storage, or `null` for none; resets the cached levels so the next read uses it */
export function setAudioLevelsStorageForTests(s: Store | null | undefined): void { storage = s; levels = null; }

const store = () => (storage === undefined ? (storage = defaultStorage()) : storage);

export function getAudioLevels(): AudioLevels {
  if (!levels) {
    let raw: string | null = null;
    try { raw = store()?.getItem(AUDIO_LEVELS_KEY) ?? null; } catch { /* blocked */ }
    levels = Object.freeze(parseAudioLevels(raw)) as AudioLevels;
  }
  return levels;
}

function patch(p: Partial<AudioLevels>): void {
  const cur = getAudioLevels();
  const next: AudioLevels = Object.freeze({ ...cur, ...p }) as AudioLevels;
  if (next.music === cur.music && next.effects === cur.effects && next.voice === cur.voice && next.voiceMuted === cur.voiceMuted) return;
  levels = next;
  try { store()?.setItem(AUDIO_LEVELS_KEY, JSON.stringify({ v: 1, ...next })); } catch { /* full or blocked: this page only */ }
  for (const cb of [...listeners]) { try { cb(next); } catch { /* a listener's error is its own */ } }
}

const level = (v: number, key: 'music' | 'effects' | 'voice') => {
  if (typeof v !== 'number' || Number.isNaN(v)) return;
  patch({ [key]: clamp01(v, DEFAULT_AUDIO_LEVELS[key]) });
};
export const setMusicVolume = (v: number): void => level(v, 'music');
export const setEffectsVolume = (v: number): void => level(v, 'effects');
export const setVoiceVolume = (v: number): void => level(v, 'voice');
export const setVoiceMuted = (on: boolean): void => patch({ voiceMuted: !!on });
export const resetAudioLevels = (): void => patch({ ...DEFAULT_AUDIO_LEVELS });

/** Every change of the levels; returns the off. */
export function onAudioLevels(cb: (l: AudioLevels) => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

/** The levels as React state (lane A's Settings sliders). */
export function useAudioLevels(): AudioLevels {
  return useSyncExternalStore(onAudioLevels, getAudioLevels, getAudioLevels);
}

/**
 * The bus gains the engine applies (audio/audio.ts): each bus's wave-8 mix level × the player's level. Pure (tests).
 * `voiceMuted` silences the voice bus whatever its level.
 */
export function busGains(l: AudioLevels, base: { ambience: number; sfx: number; music: number; voice: number }): { ambience: number; sfx: number; music: number; voice: number } {
  return { ambience: base.ambience * l.effects, sfx: base.sfx * l.effects, music: base.music * l.music, voice: l.voiceMuted ? 0 : base.voice * l.voice };
}
