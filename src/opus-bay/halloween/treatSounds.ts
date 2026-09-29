import type { AudioEngine } from '../audio/engine';
import { registerSound, type SoundOpts } from '../audio/hooks';

/**
 * Wave 6 · lane G (W6-G2) · the knock on a door nobody answers today (registered through audio/hooks.ts, a one-shot on
 * the sfx bus). A door that answers plays lane X's whole treat vignette instead (audio/halloween.ts: knock, creak,
 * candies, chime — for the `halloween` treat event), so G plays nothing else.
 *
 *   g-knock   three soft knocks on a wooden door
 */

const R = Math.random;
const rand = (a: number, b: number) => a + (b - a) * R();
const g0 = (o: SoundOpts | undefined, base: number) => base * Math.max(0, Math.min(1.5, o?.gain ?? 1));
const pan = (o: SoundOpts | undefined) => Math.max(-1, Math.min(1, o?.pan ?? 0));

function knock(e: AudioEngine, o?: SoundOpts) {
  const v = e.voice({ bus: 'sfx', dur: 1.0, gain: g0(o, 0.5), pan: pan(o), priority: 4, reverb: 0.2, name: 'g-knock' });
  if (!v) return;
  [0, 0.2, 0.4].forEach((at, i) => {
    const f = rand(150, 175) * (i === 2 ? 0.94 : 1);
    e.tone(v, { type: 'sine', freq: f * 1.6, freqTo: f, glide: 0.04, decay: 0.09, peak: 0.7, offset: at, attack: 0.002 });
    e.noiseBurst(v, { color: 'pink', decay: 0.05, peak: 0.35, offset: at, attack: 0.001, filter: { type: 'bandpass', freq: rand(700, 900), Q: 1.4 } });
  });
}

/** Register the knock; returns the off. */
export function registerTreatSounds(): () => void {
  return registerSound('g-knock', knock);
}
