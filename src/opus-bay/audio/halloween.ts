/**
 * Wave 6 · lane X · W6-X3: the Halloween sounds — synthesized like every other sound here (no samples, no files):
 *
 *   treat    a trick-or-treat door: knock-knock-knock on a wooden door, the door creaks open, a handful of wrapped candies
 *            rustles into the bucket, a small happy chime (≈ 1.7 s; the whole vignette starts with the knock, so lane G can
 *            emit the event at the knock or when the door answers)
 *   pumpkin  a hidden jack-o'-lantern found: a friendly "ooo-OOO" ghost glide under a celesta run in A minor that resolves
 *            to a bright major chord (spooky, then cosy)
 *   costume  a costume put on: a magic poof (a filtered swell) and a rising twinkle; taking it off (`id` '') a small pop
 *   phase    the big night begins (`night`): one low, far clock-tower toll with a breath of wind; other phases are silent
 *
 * `halloweenSound(event)` is the pure choice (tested); `playHalloween(e, what)` plays it. audio/audio.ts routes the frozen
 * `{ type: 'halloween' }` event (core/events.ts) here, so lanes H and G play nothing themselves.
 */
import type { AudioEngine } from './engine';
import { midiToFreq, rand } from './logic';

const R = Math.random;
const vary = (amount: number) => 1 + (R() * 2 - 1) * amount;

export type HalloweenSound = 'treat' | 'pumpkin' | 'costume-on' | 'costume-off' | 'night-toll';

/** The sound of a `halloween` event, or null (a phase other than the big night is silent). */
export function halloweenSound(ev: { what: 'pumpkin' | 'treat' | 'costume' | 'phase'; id: string }): HalloweenSound | null {
  switch (ev.what) {
    case 'treat': return 'treat';
    case 'pumpkin': return 'pumpkin';
    case 'costume': return ev.id ? 'costume-on' : 'costume-off';
    case 'phase': return ev.id === 'night' ? 'night-toll' : null;
    default: return null;
  }
}

/** Seconds each sound lasts (the voice budget's `dur`), exported for the tests. */
export const HALLOWEEN_DUR: Record<HalloweenSound, number> = { 'treat': 2.2, 'pumpkin': 2.4, 'costume-on': 1.5, 'costume-off': 0.4, 'night-toll': 5 };

let tolled = false;

/** Tests / QA: the session's toll not yet played. */
export function resetNightToll() { tolled = false; }

/**
 * Play a Halloween sound (the big night's toll once a session: the phase can be announced again on a world switch; W6-X
 * review: a toll the voice budget dropped is not counted, so the next announcement still tolls).
 */
export function playHalloween(e: AudioEngine, sound: HalloweenSound) {
  switch (sound) {
    case 'treat': treat(e); break;
    case 'pumpkin': pumpkin(e); break;
    case 'costume-on': costume(e, true); break;
    case 'costume-off': costume(e, false); break;
    case 'night-toll': if (!tolled) tolled = nightToll(e); break;
  }
}

/** knock-knock-knock → creak → candies → chime */
function treat(e: AudioEngine) {
  const v = e.voice({ bus: 'sfx', dur: HALLOWEEN_DUR.treat, gain: 0.5, priority: 4, reverb: 0.16, name: 'halloween:treat' });
  if (!v) return;
  // three knuckle knocks on a panelled door: a hollow low body, a woody mid and the knuckle's click
  const knocks = [0, 0.17, 0.34];
  knocks.forEach((t, i) => {
    const p = vary(0.04) * (i === 2 ? 0.94 : 1);
    e.tone(v, { type: 'sine', freq: 128 * p, freqTo: 104 * p, glide: 0.05, decay: 0.12, peak: 0.7, offset: t });
    e.tone(v, { type: 'sine', freq: 236 * p, decay: 0.06, peak: 0.3, offset: t });
    e.noiseBurst(v, { color: 'pink', attack: 0.001, decay: 0.05, peak: 0.55, offset: t, filter: { type: 'bandpass', freq: 900 * p, Q: 1.8 } });
    e.noiseBurst(v, { attack: 0.0005, decay: 0.012, peak: 0.1, offset: t, filter: { type: 'highpass', freq: 3200 } });
  });
  // the door creaks open: a slow, wobbling squeal of an old hinge (a bandpassed sawtooth whose pitch drifts up)
  const c = 0.62;
  e.tone(v, { type: 'sawtooth', freq: 190 * vary(0.05), freqTo: 330, glide: 0.5, attack: 0.05, decay: 0.55, peak: 0.24, offset: c,
    vibrato: { rate: 11, depth: 0.05 }, filter: { type: 'bandpass', freq: 1100, Q: 5, freqTo: 1600 } });
  e.tone(v, { type: 'sawtooth', freq: 410 * vary(0.05), freqTo: 520, glide: 0.35, attack: 0.03, decay: 0.3, peak: 0.12, offset: c + 0.1,
    vibrato: { rate: 17, depth: 0.04 }, filter: { type: 'bandpass', freq: 2000, Q: 6 } });
  // wrapped candies: a crinkly rustle of little bright noise grains, then a few plastic taps into the bucket
  const k = 1.08;
  for (let i = 0; i < 14; i++) {
    e.noiseBurst(v, { attack: 0.001, decay: rand(R, 0.008, 0.02), peak: rand(R, 0.12, 0.28), offset: k + i * rand(R, 0.012, 0.03),
      filter: { type: 'bandpass', freq: rand(R, 3500, 7500), Q: 1.2 } });
  }
  for (const t of [0.05, 0.13, 0.19]) {
    e.tone(v, { type: 'square', freq: 1250 * vary(0.12), decay: 0.035, peak: 0.07, offset: k + 0.22 + t, filter: { type: 'bandpass', freq: 1800, Q: 2.5 } });
  }
  // the happy chime (a sweet treat): G5 · C6 · E6
  [79, 84, 88].forEach((m, i) => e.tone(v, { type: 'triangle', freq: midiToFreq(m), decay: 0.5, peak: 0.16, attack: 0.003, offset: 1.5 + i * 0.07 }));
}

/** the friendly ghost glide under a minor celesta run that resolves bright */
function pumpkin(e: AudioEngine) {
  const v = e.voice({ bus: 'sfx', dur: HALLOWEEN_DUR.pumpkin, gain: 0.34, priority: 4, reverb: 0.5, name: 'halloween:pumpkin' });
  if (!v) return;
  // "ooo-OOO": a soft, breathy sine that slides up a sixth and wobbles like a cartoon ghost
  e.tone(v, { type: 'sine', freq: midiToFreq(64), freqTo: midiToFreq(72), glide: 0.55, attack: 0.18, decay: 0.9, peak: 0.28,
    vibrato: { rate: 5.5, depth: 0.025 }, filter: { type: 'lowpass', freq: 1600 } });
  e.noiseBurst(v, { color: 'pink', attack: 0.25, decay: 0.6, peak: 0.05, filter: { type: 'bandpass', freq: 700, Q: 1.2, freqTo: 1400, glide: 0.6 } });
  // the celesta: A minor pentatonic up (A C E G A), then the lift to C major (C E G C)
  const run = [69, 72, 76, 79, 81];
  run.forEach((m, i) => {
    const f = midiToFreq(m + 12);
    e.tone(v, { type: 'sine', freq: f, decay: 0.45, peak: 0.2, attack: 0.002, offset: 0.35 + i * 0.09 });
    e.tone(v, { type: 'sine', freq: f * 4.01, decay: 0.12, peak: 0.04, attack: 0.001, offset: 0.35 + i * 0.09 });
  });
  for (const m of [84, 88, 91, 96]) {
    e.tone(v, { type: 'triangle', freq: midiToFreq(m), decay: 1.1, peak: 0.12, attack: 0.004, offset: 0.9 });
  }
}

/** a magic poof and a rising twinkle (on), or a small pop (off) */
function costume(e: AudioEngine, on: boolean) {
  const v = e.voice({ bus: 'sfx', dur: on ? HALLOWEEN_DUR['costume-on'] : HALLOWEEN_DUR['costume-off'], gain: on ? 0.5 : 0.6, priority: 3, reverb: on ? 0.35 : 0.1, name: on ? 'halloween:costume' : 'halloween:costume-off' });
  if (!v) return;
  if (!on) {
    e.tone(v, { type: 'triangle', freq: 760, freqTo: 400, glide: 0.07, decay: 0.14, peak: 0.9 });
    e.noiseBurst(v, { attack: 0.001, decay: 0.035, peak: 0.45, filter: { type: 'bandpass', freq: 2500, Q: 1.5 } });
    return;
  }
  // the poof: a pink-noise swell whose lowpass opens, like a puff of glitter smoke
  e.noiseBurst(v, { color: 'pink', attack: 0.06, decay: 0.35, peak: 0.45, filter: { type: 'lowpass', freq: 500, freqTo: 5000, glide: 0.25 } });
  e.tone(v, { type: 'sine', freq: 180, freqTo: 90, glide: 0.2, decay: 0.25, peak: 0.35 });
  // the twinkle: E major pentatonic up, quick and light
  [76, 78, 80, 83, 85, 88, 90, 92].forEach((m, i) => {
    e.tone(v, { type: 'sine', freq: midiToFreq(m + 12) * vary(0.003), decay: 0.25, peak: 0.13, attack: 0.002, offset: 0.18 + i * 0.045 });
  });
}

/** the big night: one far, low clock-tower toll and a breath of night wind */
function nightToll(e: AudioEngine): boolean {
  const v = e.voice({ bus: 'sfx', dur: HALLOWEEN_DUR['night-toll'], gain: 0.16, priority: 3, reverb: 0.7, name: 'halloween:night' });
  if (!v) return false;
  const base = 147; // D3
  for (const [ratio, g, d] of [[0.5, 0.4, 3.6], [1, 0.55, 3], [1.19, 0.28, 2.2], [1.5, 0.2, 1.8], [2, 0.16, 1.4], [2.52, 0.09, 1]] as const) {
    e.tone(v, { type: 'sine', freq: base * ratio, decay: d, peak: g, attack: 0.003 });
  }
  e.noiseBurst(v, { color: 'pink', attack: 0.8, decay: 2.4, peak: 0.12, offset: 0.4, filter: { type: 'bandpass', freq: 380, Q: 0.8, freqTo: 900, glide: 1.8 } });
  return true;
}
