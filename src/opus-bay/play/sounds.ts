import type { AudioEngine } from '../audio/engine';
import { registerSound, type SoundOpts } from '../audio/hooks';

/**
 * Wave 5 · lane A · PlayKit's sounds, synthesized (audio/hooks.ts registerSound; nothing plays before audio is live or
 * while sound is off). play-squeak (petting BAYBAY), play-ring (a ring caught: `pitch` rises along the course),
 * play-medal (the result card: `gain` by tier), play-dance (a 6 s toy-piano bounce while you dance).
 */

const hz = (semi: number) => 523.25 * 2 ** (semi / 12); // C5 + semitones

function squeak(e: AudioEngine, o?: SoundOpts) {
  const v = e.voice({ bus: 'sfx', dur: 0.5, gain: 0.22 * (o?.gain ?? 1), priority: 2, pan: o?.pan, name: 'play:squeak' });
  if (!v) return;
  const p = o?.pitch ?? 1;
  e.tone(v, { type: 'sine', freq: 900 * p, freqTo: 1500 * p, glide: 0.09, decay: 0.16, peak: 0.55, attack: 0.008, fm: { ratio: 2, index: 0.3, indexTo: 0.05 } });
  e.tone(v, { type: 'sine', freq: 1300 * p, freqTo: 1050 * p, glide: 0.1, decay: 0.2, peak: 0.4, attack: 0.01, offset: 0.13 });
}

function ring(e: AudioEngine, o?: SoundOpts) {
  const v = e.voice({ bus: 'sfx', dur: 0.9, gain: 0.26 * (o?.gain ?? 1), priority: 3, reverb: 0.2, pan: o?.pan, name: 'play:ring' });
  if (!v) return;
  const p = o?.pitch ?? 1;
  e.tone(v, { type: 'triangle', freq: hz(7) * p, decay: 0.5, peak: 0.5, attack: 0.004 });
  e.tone(v, { type: 'sine', freq: hz(12) * p, decay: 0.7, peak: 0.35, attack: 0.004, offset: 0.07 });
  e.tone(v, { type: 'sine', freq: hz(16) * p, decay: 0.6, peak: 0.25, attack: 0.004, offset: 0.14 });
}

function medal(e: AudioEngine, o?: SoundOpts) {
  const g = o?.gain ?? 1;
  const v = e.voice({ bus: 'sfx', dur: 1.6, gain: 0.24, priority: 3, reverb: 0.25, name: 'play:medal' });
  if (!v) return;
  const notes = g >= 1 ? [0, 4, 7, 12] : g >= 0.66 ? [0, 4, 7] : g > 0 ? [0, 7] : [7, 4];
  notes.forEach((n, i) => e.tone(v, { type: 'triangle', freq: hz(n), decay: 0.55, peak: 0.45, attack: 0.006, offset: i * 0.11 }));
}

/** a little bounce: 12 beats at 120 bpm, a pentatonic line over an oom-pah */
function dance(e: AudioEngine, o?: SoundOpts) {
  const v = e.voice({ bus: 'sfx', dur: 6.4, gain: 0.16 * (o?.gain ?? 1), priority: 2, reverb: 0.12, name: 'play:dance' });
  if (!v) return;
  const tune = [0, 4, 7, 9, 7, 4, 2, 4, 7, 12, 9, 7];
  tune.forEach((n, i) => {
    const at = i * 0.5;
    e.tone(v, { type: 'triangle', freq: hz(n), decay: 0.3, peak: 0.42, attack: 0.005, offset: at });
    e.tone(v, { type: 'sine', freq: hz(i % 2 ? -5 : -12), decay: 0.22, peak: 0.5, attack: 0.004, offset: at });
    if (i % 2) e.noiseBurst(v, { color: 'pink', attack: 0.001, decay: 0.05, peak: 0.25, offset: at + 0.25, filter: { type: 'highpass', freq: 5000 } });
  });
}

/** Register the four; returns the unregister. */
export function registerPlaySounds(): () => void {
  const offs = [registerSound('play-squeak', squeak), registerSound('play-ring', ring), registerSound('play-medal', medal), registerSound('play-dance', dance)];
  return () => { for (const off of offs) off(); };
}
