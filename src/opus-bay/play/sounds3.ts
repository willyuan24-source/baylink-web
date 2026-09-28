import type { AudioEngine } from '../audio/engine';
import { registerSound, type SoundOpts } from '../audio/hooks';

/**
 * Wave 5 · lane A · the part-c sounds, synthesized (audio/hooks registerSound; silent before audio is live or with sound
 * off — every activity also shows what it hears). Registered once, by the first activity chunk that needs them:
 *
 *   play-crackle   a few pops of a beach fire (the marshmallow, while held in the flame)
 *   play-flare     a marshmallow catching fire (a soft whoomp)
 *   play-chomp     two squishy bites and a happy note
 *   play-heave     BAYBAY's 嘿—咻 (a low "hey", a high "ho": the turntable push beat)
 *   play-pop       a light plastic pop (a caught frisbee / ball, a counted sea lion's bark is its own)
 */

function crackle(e: AudioEngine, o?: SoundOpts) {
  const v = e.voice({ bus: 'sfx', dur: 0.6, gain: 0.22 * (o?.gain ?? 1), priority: 1, name: 'play:crackle' });
  if (!v) return;
  for (let i = 0; i < 4; i++) {
    e.noiseBurst(v, { attack: 0.001, decay: 0.012 + Math.random() * 0.02, peak: 0.25 + Math.random() * 0.35, offset: Math.random() * 0.45, filter: { type: 'highpass', freq: 1800 + Math.random() * 2400 } });
  }
  e.noiseBurst(v, { color: 'brown', attack: 0.05, decay: 0.45, peak: 0.18, filter: { type: 'lowpass', freq: 420 } });
}

function flare(e: AudioEngine, o?: SoundOpts) {
  const v = e.voice({ bus: 'sfx', dur: 1, gain: 0.3 * (o?.gain ?? 1), priority: 3, name: 'play:flare' });
  if (!v) return;
  e.noiseBurst(v, { color: 'pink', attack: 0.12, decay: 0.7, peak: 0.55, filter: { type: 'lowpass', freq: 300, freqTo: 1600, glide: 0.35 } });
}

function chomp(e: AudioEngine, o?: SoundOpts) {
  const v = e.voice({ bus: 'sfx', dur: 0.6, gain: 0.28 * (o?.gain ?? 1), priority: 2, name: 'play:chomp' });
  if (!v) return;
  for (const t of [0, 0.17]) {
    e.noiseBurst(v, { color: 'brown', attack: 0.004, decay: 0.08, peak: 0.6, offset: t, filter: { type: 'lowpass', freq: 700 } });
    e.tone(v, { type: 'sine', freq: 190, freqTo: 140, decay: 0.09, peak: 0.25, offset: t });
  }
  e.tone(v, { type: 'triangle', freq: 523, freqTo: 660, decay: 0.2, peak: 0.18, offset: 0.34 });
}

function heave(e: AudioEngine, o?: SoundOpts) {
  const v = e.voice({ bus: 'sfx', dur: 0.7, gain: 0.24 * (o?.gain ?? 1), priority: 2, name: 'play:heave' });
  if (!v) return;
  // "嘿" a short low vowel, "咻" a bright rising one on the beat (o.pitch > 1: the beat itself)
  const hi = (o?.pitch ?? 1) > 1;
  e.tone(v, { type: 'triangle', freq: hi ? 392 : 262, freqTo: hi ? 523 : 247, decay: hi ? 0.22 : 0.14, peak: 0.5, attack: 0.01, filter: { type: 'lowpass', freq: 1400 } });
  e.noiseBurst(v, { color: 'pink', attack: 0.004, decay: 0.05, peak: 0.2, filter: { type: 'bandpass', freq: hi ? 2600 : 1500, Q: 1.5 } });
}

function pop(e: AudioEngine, o?: SoundOpts) {
  const v = e.voice({ bus: 'sfx', dur: 0.3, gain: 0.22 * (o?.gain ?? 1), pan: o?.pan, priority: 2, name: 'play:pop' });
  if (!v) return;
  e.tone(v, { type: 'sine', freq: 620 * (o?.pitch ?? 1), freqTo: 980 * (o?.pitch ?? 1), decay: 0.09, peak: 0.45, attack: 0.002 });
  e.noiseBurst(v, { attack: 0.001, decay: 0.02, peak: 0.25, filter: { type: 'highpass', freq: 2500 } });
}

let done = false;
/** Register the part-c sounds once (each activity chunk calls it as it loads). */
export function ensurePlaySounds3() {
  if (done) return;
  done = true;
  registerSound('play-crackle', crackle);
  registerSound('play-flare', flare);
  registerSound('play-chomp', chomp);
  registerSound('play-heave', heave);
  registerSound('play-pop', pop);
}
