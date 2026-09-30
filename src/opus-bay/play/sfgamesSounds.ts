import type { AudioEngine } from '../audio/engine';
import { registerSound, type SoundOpts } from '../audio/hooks';

/**
 * Wave 7 · lane M · the mini-games' sounds, synthesized (audio/hooks registerSound; silent before audio is live or with
 * sound off — every game also shows what it hears). Registered once, by the first game chunk that needs them:
 *
 *   m-coin     a quarter dropping into an old machine (a bright clink, a rattle)
 *   m-whir     the claw's little motor going down
 *   m-grab     the claw closing / a crab measured (a soft click)
 *   m-splash   the hoop net hitting the water
 *   m-tug      the rope twitching (two tiny plucks)
 *   m-ding     an oven timer / a card sliding out of the fortune teller
 *   m-pat      dough folded and pressed (a soft thump)
 */

const g = (o?: SoundOpts) => o?.gain ?? 1;

function coin(e: AudioEngine, o?: SoundOpts) {
  const v = e.voice({ bus: 'sfx', dur: 0.7, gain: 0.26 * g(o), priority: 2, name: 'm:coin' });
  if (!v) return;
  e.tone(v, { type: 'sine', freq: 2350, decay: 0.18, peak: 0.4, attack: 0.001 });
  e.tone(v, { type: 'sine', freq: 3120, decay: 0.12, peak: 0.25, attack: 0.001, offset: 0.01 });
  for (const t of [0.12, 0.2, 0.26, 0.31]) e.noiseBurst(v, { attack: 0.001, decay: 0.02, peak: 0.25, offset: t, filter: { type: 'bandpass', freq: 3800, Q: 3 } });
}

function whir(e: AudioEngine, o?: SoundOpts) {
  const v = e.voice({ bus: 'sfx', dur: 1, gain: 0.16 * g(o), priority: 1, name: 'm:whir' });
  if (!v) return;
  e.tone(v, { type: 'sawtooth', freq: 180, freqTo: 120, decay: 0.85, peak: 0.3, attack: 0.05, filter: { type: 'lowpass', freq: 900 } });
}

function grab(e: AudioEngine, o?: SoundOpts) {
  const v = e.voice({ bus: 'sfx', dur: 0.25, gain: 0.22 * g(o), priority: 2, name: 'm:grab' });
  if (!v) return;
  e.noiseBurst(v, { attack: 0.001, decay: 0.03, peak: 0.5, filter: { type: 'bandpass', freq: 2200 * (o?.pitch ?? 1), Q: 2 } });
  e.tone(v, { type: 'triangle', freq: 440 * (o?.pitch ?? 1), freqTo: 330 * (o?.pitch ?? 1), decay: 0.06, peak: 0.3 });
}

function splash(e: AudioEngine, o?: SoundOpts) {
  const v = e.voice({ bus: 'sfx', dur: 0.9, gain: 0.3 * g(o), priority: 2, name: 'm:splash' });
  if (!v) return;
  e.noiseBurst(v, { color: 'pink', attack: 0.005, decay: 0.5, peak: 0.6, filter: { type: 'lowpass', freq: 2400, freqTo: 500, glide: 0.4 } });
  e.tone(v, { type: 'sine', freq: 300, freqTo: 120, decay: 0.2, peak: 0.25 });
}

function tug(e: AudioEngine, o?: SoundOpts) {
  const v = e.voice({ bus: 'sfx', dur: 0.4, gain: 0.2 * g(o), priority: 2, name: 'm:tug' });
  if (!v) return;
  for (const t of [0, 0.14]) e.tone(v, { type: 'triangle', freq: 196, freqTo: 180, decay: 0.08, peak: 0.45, offset: t });
}

function ding(e: AudioEngine, o?: SoundOpts) {
  const v = e.voice({ bus: 'sfx', dur: 1.2, gain: 0.22 * g(o), priority: 2, name: 'm:ding' });
  if (!v) return;
  e.tone(v, { type: 'sine', freq: 1318 * (o?.pitch ?? 1), decay: 1, peak: 0.5, attack: 0.002 });
  e.tone(v, { type: 'sine', freq: 2637 * (o?.pitch ?? 1), decay: 0.4, peak: 0.15, attack: 0.002 });
}

function pat(e: AudioEngine, o?: SoundOpts) {
  const v = e.voice({ bus: 'sfx', dur: 0.3, gain: 0.3 * g(o), priority: 2, name: 'm:pat' });
  if (!v) return;
  e.noiseBurst(v, { color: 'brown', attack: 0.003, decay: 0.09, peak: 0.7, filter: { type: 'lowpass', freq: 600 } });
  e.tone(v, { type: 'sine', freq: 150 * (o?.pitch ?? 1), freqTo: 90, decay: 0.08, peak: 0.3 });
}

let done = false;
/** Register the mini-games' sounds once (each game chunk calls it as it starts). */
export function ensureSfSounds() {
  if (done) return;
  done = true;
  registerSound('m-coin', coin);
  registerSound('m-whir', whir);
  registerSound('m-grab', grab);
  registerSound('m-splash', splash);
  registerSound('m-tug', tug);
  registerSound('m-ding', ding);
  registerSound('m-pat', pat);
}
