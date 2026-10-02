import type { AudioEngine } from '../audio/engine';
import { registerSound, type SoundOpts } from '../audio/hooks';

/**
 * Wave 8 · lane M · the second set of mini-games' sounds, synthesized (audio/hooks registerSound; silent before audio is
 * live or with sound off — every game also shows what it hears). Registered once, by the first game chunk that needs
 * them:
 *
 *   m8-grip-on    the grip's jaws closing on the cable (a heavy iron clank and the cable's hum taking hold)
 *   m8-grip-off   the lever thrown forward (a lighter clack)
 *   m8-take       taking the rope again (a clunk, a jolt)
 *   m8-coast      wheels clattering over the crossing's rails
 *   m8-alarm      the crossing's alarm (a quick electric bell)
 *
 * The busker's and the foghorns' sounds are registered by their own chunks (busk.ts, foghorn.ts) through the same
 * `ensureSf8Sounds` set below, so one guard keeps them all once.
 */

const g = (o?: SoundOpts) => o?.gain ?? 1;

function gripOn(e: AudioEngine, o?: SoundOpts) {
  const v = e.voice({ bus: 'sfx', dur: 0.6, gain: 0.3 * g(o), priority: 2, name: 'm8:grip-on' });
  if (!v) return;
  e.noiseBurst(v, { color: 'brown', attack: 0.002, decay: 0.08, peak: 0.8, filter: { type: 'lowpass', freq: 900 } });
  e.tone(v, { type: 'triangle', freq: 210, freqTo: 140, decay: 0.12, peak: 0.45, attack: 0.001 });
  e.tone(v, { type: 'square', freq: 72, decay: 0.45, peak: 0.12, attack: 0.03, filter: { type: 'lowpass', freq: 300 } });
}

function gripOff(e: AudioEngine, o?: SoundOpts) {
  const v = e.voice({ bus: 'sfx', dur: 0.3, gain: 0.24 * g(o), priority: 2, name: 'm8:grip-off' });
  if (!v) return;
  e.noiseBurst(v, { attack: 0.001, decay: 0.035, peak: 0.6, filter: { type: 'bandpass', freq: 1600, Q: 1.5 } });
  e.tone(v, { type: 'triangle', freq: 520, freqTo: 380, decay: 0.05, peak: 0.3 });
}

function take(e: AudioEngine, o?: SoundOpts) {
  const v = e.voice({ bus: 'sfx', dur: 0.5, gain: 0.3 * g(o), priority: 2, name: 'm8:take' });
  if (!v) return;
  e.noiseBurst(v, { color: 'brown', attack: 0.002, decay: 0.14, peak: 0.9, filter: { type: 'lowpass', freq: 520 } });
  e.tone(v, { type: 'sine', freq: 95, freqTo: 60, decay: 0.2, peak: 0.5 });
}

function coast(e: AudioEngine, o?: SoundOpts) {
  const v = e.voice({ bus: 'sfx', dur: 1.2, gain: 0.22 * g(o), priority: 1, name: 'm8:coast' });
  if (!v) return;
  // two pairs of wheel clicks over the other line's rails
  for (const t of [0, 0.11, 0.55, 0.66]) e.noiseBurst(v, { attack: 0.001, decay: 0.03, peak: 0.6, offset: t, filter: { type: 'bandpass', freq: 2400, Q: 2.5 } });
  e.noiseBurst(v, { color: 'pink', attack: 0.1, decay: 0.9, peak: 0.25, filter: { type: 'lowpass', freq: 700 } });
}

function alarm(e: AudioEngine, o?: SoundOpts) {
  const v = e.voice({ bus: 'sfx', dur: 1.1, gain: 0.2 * g(o), priority: 3, name: 'm8:alarm' });
  if (!v) return;
  for (let k = 0; k < 14; k++) e.tone(v, { type: 'square', freq: 1480, decay: 0.035, peak: 0.35, attack: 0.001, offset: k * 0.065, filter: { type: 'bandpass', freq: 1900, Q: 1.2 } });
}

const extra: [string, (e: AudioEngine, o?: SoundOpts) => void][] = [];
/** A game chunk adds its own recipes (busk.ts, foghorn.ts) before its first ensureSf8Sounds(). */
export function addSf8Sound(id: string, recipe: (e: AudioEngine, o?: SoundOpts) => void) {
  if (registered.has(id)) return;
  extra.push([id, recipe]);
}

const registered = new Set<string>();
/** Register the wave-8 games' sounds once each (every game chunk calls it as it starts). */
export function ensureSf8Sounds() {
  const all: [string, (e: AudioEngine, o?: SoundOpts) => void][] = [
    ['m8-grip-on', gripOn], ['m8-grip-off', gripOff], ['m8-take', take], ['m8-coast', coast], ['m8-alarm', alarm], ...extra,
  ];
  for (const [id, recipe] of all) {
    if (registered.has(id)) continue;
    registered.add(id);
    registerSound(id, recipe);
  }
}
