import type { AudioEngine } from '../audio/engine';
import { registerSound, type SoundOpts } from '../audio/hooks';

/**
 * Wave 5 · lane A · the part-b sounds, synthesized (audio/hooks registerSound; silent before audio is live or with sound
 * off — every activity also shows its beats):
 *
 *   play-tick      a wood-block tick (countdowns, the bell riff's beat)
 *   play-go        a bright two-note "go"
 *   play-whoosh    cardboard on concrete, ≈ 3 s (the Seward slides; `gain` louder when tucked)
 *   play-bell      ONE strike of a cable-car bell (the rider's taps; `pitch` 0.84 = the gripman's call)
 *   play-riff-<n>  one call-and-response round of the bell riff (n = 1–3): the gripman's call in the first bar, a tick on
 *                  every beat of both bars, so the answer bar has its own count (sample-accurate: the judge reads the
 *                  beats from the moment the round starts)
 *   play-groove    ten seconds of a swung toy-jazz groove for the riff's freestyle (walking bass, ride, brushes)
 */

/** The bell riff's beat (s) and its three calls (in beats from the round's start; the answer repeats them one bar later). */
export const RIFF_BEAT = 0.55;
export const RIFF_BAR = 4;
export const RIFF_CALLS: readonly (readonly number[])[] = [[0, 1, 2], [0, 0.5, 1, 2], [0, 1, 1.5, 2.5, 3]];
export const GROOVE_SECONDS = 10;

const hz = (semi: number) => 440 * 2 ** (semi / 12);

function strike(e: AudioEngine, v: ReturnType<AudioEngine['voice']>, offset: number, pitch: number, level = 1) {
  if (!v) return;
  for (const [ratio, g, d] of [[1, 0.42, 0.5], [2.02, 0.22, 0.34], [2.76, 0.15, 0.24], [3.9, 0.07, 0.16]] as const) {
    e.tone(v, { type: 'sine', freq: 880 * ratio * pitch, decay: d, peak: g * level, attack: 0.001, offset });
  }
  e.noiseBurst(v, { attack: 0.001, decay: 0.012, peak: 0.3 * level, offset, filter: { type: 'highpass', freq: 3000 } });
}

function tickAt(e: AudioEngine, v: ReturnType<AudioEngine['voice']>, offset: number, level = 1) {
  if (!v) return;
  e.tone(v, { type: 'triangle', freq: 1250, decay: 0.05, peak: 0.5 * level, attack: 0.001, offset });
  e.noiseBurst(v, { color: 'pink', attack: 0.001, decay: 0.018, peak: 0.3 * level, offset, filter: { type: 'bandpass', freq: 2400, Q: 2 } });
}

function tick(e: AudioEngine, o?: SoundOpts) {
  const v = e.voice({ bus: 'sfx', dur: 0.2, gain: 0.3 * (o?.gain ?? 1), priority: 2, name: 'play:tick' });
  tickAt(e, v, 0, 1);
}

function go(e: AudioEngine, o?: SoundOpts) {
  const v = e.voice({ bus: 'sfx', dur: 0.9, gain: 0.26 * (o?.gain ?? 1), priority: 3, reverb: 0.2, name: 'play:go' });
  if (!v) return;
  e.tone(v, { type: 'triangle', freq: hz(3), decay: 0.3, peak: 0.45, attack: 0.004 });
  e.tone(v, { type: 'triangle', freq: hz(10), decay: 0.6, peak: 0.5, attack: 0.004, offset: 0.09 });
}

function whoosh(e: AudioEngine, o?: SoundOpts) {
  const v = e.voice({ bus: 'sfx', dur: 3.4, gain: 0.34 * (o?.gain ?? 1), priority: 3, name: 'play:whoosh' });
  if (!v) return;
  e.noiseBurst(v, { color: 'pink', attack: 0.35, decay: 2.9, peak: 0.55, filter: { type: 'bandpass', freq: 380, Q: 0.9, freqTo: 1500, glide: 2.4 } });
  e.noiseBurst(v, { color: 'brown', attack: 0.2, decay: 2.6, peak: 0.45, filter: { type: 'lowpass', freq: 260 } });
}

function bell(e: AudioEngine, o?: SoundOpts) {
  const v = e.voice({ bus: 'sfx', dur: 0.8, gain: 0.26 * (o?.gain ?? 1), pan: o?.pan, priority: 3, reverb: 0.22, name: 'play:bell' });
  strike(e, v, 0, o?.pitch ?? 1);
}

function round(n: number) {
  return (e: AudioEngine, o?: SoundOpts) => {
    const call = RIFF_CALLS[n] ?? RIFF_CALLS[0];
    const v = e.voice({ bus: 'sfx', dur: RIFF_BEAT * RIFF_BAR * 2 + 0.6, gain: 0.26 * (o?.gain ?? 1), priority: 3, reverb: 0.2, name: `play:riff-${n + 1}` });
    if (!v) return;
    for (const b of call) strike(e, v, b * RIFF_BEAT, 0.84);
    // a soft tick on every beat; the answer bar's downbeat a little louder (your turn)
    for (let k = 0; k < RIFF_BAR * 2; k++) tickAt(e, v, k * RIFF_BEAT, k === RIFF_BAR ? 0.75 : 0.4);
  };
}

/** Ten swung seconds at the riff's beat: a walking bass, the ride's "ding, ding-da-ding", brushes on 2 and 4. */
function groove(e: AudioEngine, o?: SoundOpts) {
  const B = RIFF_BEAT, beats = Math.floor(GROOVE_SECONDS / B);
  const v = e.voice({ bus: 'sfx', dur: GROOVE_SECONDS + 0.8, gain: 0.2 * (o?.gain ?? 1), priority: 2, reverb: 0.15, name: 'play:groove' });
  if (!v) return;
  const walk = [-24, -20, -17, -15, -12, -15, -17, -19, -22, -19, -17, -14, -12, -14, -17, -20];
  for (let k = 0; k < beats; k++) {
    const at = k * B;
    e.tone(v, { type: 'triangle', freq: hz(walk[k % walk.length] - 3), decay: B * 0.9, peak: 0.55, attack: 0.01, offset: at });
    // ride: every beat, plus the swung "da" before beats 2 and 4
    e.noiseBurst(v, { attack: 0.001, decay: 0.16, peak: 0.16, offset: at, filter: { type: 'highpass', freq: 6500 } });
    if (k % 2 === 0) e.noiseBurst(v, { attack: 0.001, decay: 0.1, peak: 0.11, offset: at + B * (2 / 3), filter: { type: 'highpass', freq: 7000 } });
    if (k % 2 === 1) e.noiseBurst(v, { color: 'pink', attack: 0.02, decay: 0.12, peak: 0.2, offset: at, filter: { type: 'bandpass', freq: 1800, Q: 0.7 } });
  }
}

/** Register them all; returns the unregister. */
export function registerPlaySounds2(): () => void {
  const offs = [
    registerSound('play-tick', tick), registerSound('play-go', go), registerSound('play-whoosh', whoosh), registerSound('play-bell', bell),
    registerSound('play-groove', groove), ...RIFF_CALLS.map((_, n) => registerSound(`play-riff-${n + 1}`, round(n))),
  ];
  return () => { for (const off of offs) off(); };
}

let registered = false;
/** The activities call this as they start (once: the ids stay registered for the session). */
export function ensurePlaySounds2() {
  if (registered) return;
  registered = true;
  registerPlaySounds2();
}
