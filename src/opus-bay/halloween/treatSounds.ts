import type { AudioEngine } from '../audio/engine';
import { registerSound, type SoundOpts } from '../audio/hooks';

/**
 * Wave 6 · lane G (W6-G2) · trick-or-treat's sounds, synthesized with the engine's primitives (no files; lane X may hand
 * recorded ones later, requests-G.md): registered through audio/hooks.ts, one-shots on the sfx bus.
 *
 *   g-knock   three soft knocks on a wooden door
 *   g-creak   the door creaking open
 *   g-candy   sweets dropping into a paper bag, and a little twinkle
 */

const R = Math.random;
const rand = (a: number, b: number) => a + (b - a) * R();
const g0 = (o: SoundOpts | undefined, base: number) => base * Math.max(0, Math.min(1.5, o?.gain ?? 1));
const pan = (o: SoundOpts | undefined) => Math.max(-1, Math.min(1, o?.pan ?? 0));
const midi = (m: number) => 440 * 2 ** ((m - 69) / 12);

function knock(e: AudioEngine, o?: SoundOpts) {
  const v = e.voice({ bus: 'sfx', dur: 1.0, gain: g0(o, 0.5), pan: pan(o), priority: 4, reverb: 0.2, name: 'g-knock' });
  if (!v) return;
  [0, 0.2, 0.4].forEach((at, i) => {
    const f = rand(150, 175) * (i === 2 ? 0.94 : 1);
    e.tone(v, { type: 'sine', freq: f * 1.6, freqTo: f, glide: 0.04, decay: 0.09, peak: 0.7, offset: at, attack: 0.002 });
    e.noiseBurst(v, { color: 'pink', decay: 0.05, peak: 0.35, offset: at, attack: 0.001, filter: { type: 'bandpass', freq: rand(700, 900), Q: 1.4 } });
  });
}

function creak(e: AudioEngine, o?: SoundOpts) {
  const v = e.voice({ bus: 'sfx', dur: 1.0, gain: g0(o, 0.16), pan: pan(o), priority: 3, reverb: 0.3, name: 'g-creak' });
  if (!v) return;
  const f = rand(210, 250);
  e.tone(v, { type: 'sawtooth', freq: f, freqTo: f * 1.45, glide: 0.7, decay: 0.75, peak: 0.5, attack: 0.05,
    filter: { type: 'bandpass', freq: 1100, Q: 5 }, vibrato: { rate: 23, depth: 0.03 } });
}

function candy(e: AudioEngine, o?: SoundOpts) {
  const v = e.voice({ bus: 'sfx', dur: 1.0, gain: g0(o, 0.3), pan: pan(o), priority: 4, reverb: 0.35, name: 'g-candy' });
  if (!v) return;
  e.noiseBurst(v, { color: 'white', decay: 0.18, peak: 0.25, attack: 0.01, filter: { type: 'highpass', freq: 2500, Q: 0.7 } });
  e.noiseBurst(v, { color: 'white', decay: 0.12, peak: 0.18, offset: 0.12, attack: 0.01, filter: { type: 'highpass', freq: 3200, Q: 0.7 } });
  [76, 79, 84].forEach((m, i) => e.tone(v, { type: 'triangle', freq: midi(m), decay: 0.4, peak: 0.22, offset: 0.2 + i * 0.08, attack: 0.004 }));
}

/** Register the three; returns the off. */
export function registerTreatSounds(): () => void {
  const offs = [registerSound('g-knock', knock), registerSound('g-creak', creak), registerSound('g-candy', candy)];
  return () => { for (const off of offs) off(); };
}
