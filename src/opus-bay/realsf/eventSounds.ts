import type { AudioEngine } from '../audio/engine';
import { registerLoop, setLoop, type LoopHandle } from '../audio/hooks';
import type { KitKind } from './eventVenues';

/**
 * Wave 5 · lane R (W5-R3) · the sound of an event near you (plan §3.3 item 2), through the frozen audio/hooks.ts: an
 * original, synthesized loop on the ambience bus — never a real song. Music (a bluegrass-ish banjo forward roll over
 * G · C · D, with a thumped upright-bass root), parade (a small brass march with a tuba and a snare on 2 and 4), fair /
 * festival (a marimba wandering the pentatonic over a soft hand drum). realsf/presence.ts sets each loop's gain from
 * the distance to the nearest open event of its kind (full within 30 u, silent beyond 150 u).
 */

export const LOOP_IDS: Record<Exclude<KitKind, 'board'>, string> = {
  music: 'realsf-banjo', parade: 'realsf-brass', fair: 'realsf-market', festival: 'realsf-market', street: 'realsf-market',
};
export const HEAR_FULL = 30;
export const HEAR_FAR = 150;

/** Gain for a distance: 1 within HEAR_FULL, 0 beyond HEAR_FAR, eased between. */
export function hearGain(d: number): number {
  if (!Number.isFinite(d) || d >= HEAR_FAR) return 0;
  if (d <= HEAR_FULL) return 1;
  const t = 1 - (d - HEAR_FULL) / (HEAR_FAR - HEAR_FULL);
  return t * t;
}

const midi = (n: number) => 440 * 2 ** ((n - 69) / 12);

/** A step sequencer on the AudioContext clock: `beat(i, at)` schedules step i at time `at`; 25 ms timer, 120 ms lookahead. */
function sequencer(e: AudioEngine, stepSec: number, beat: (i: number, at: number, gain: number) => void): LoopHandle {
  let gain = 0;
  let next = e.now + 0.08;
  let i = 0;
  const id = setInterval(() => {
    const until = e.now + 0.12;
    if (next < e.now - 0.5) next = e.now + 0.05; // the tab slept: skip ahead instead of catching up
    while (next < until) {
      if (gain > 0.001) { try { beat(i, next, gain); } catch { /* one bad step never stops the loop */ } }
      i++;
      next += stepSec;
    }
  }, 25);
  return { setGain: g => { gain = g; }, stop: () => clearInterval(id) };
}

function pluck(e: AudioEngine, at: number, note: number, gain: number, bright = 1) {
  const v = e.voice({ bus: 'ambience', at, dur: 0.6, gain: 0.16 * gain, priority: 1, reverb: 0.18 });
  if (!v) return;
  e.tone(v, { type: 'triangle', freq: midi(note), decay: 0.42, attack: 0.002, peak: 0.9, fm: { ratio: 3, index: 1.6 * bright, indexTo: 0.1 } });
}

/** G · C · D banjo forward roll (thumb–index–middle) with the bass on the downbeats. */
function banjo(e: AudioEngine): LoopHandle {
  // eighth notes at ≈ 112 bpm; two bars per chord
  const chords = [[55, 59, 62, 67], [60, 64, 67, 72], [62, 66, 69, 74], [55, 59, 62, 67]];
  const roll = [0, 1, 3, 0, 1, 3, 0, 2];
  return sequencer(e, 60 / 112 / 2, (i, at, g) => {
    const chord = chords[Math.floor(i / 16) % chords.length];
    pluck(e, at, chord[roll[i % 8]] + 12, g, i % 8 === 0 ? 1.2 : 0.9);
    if (i % 4 === 0) {
      const v = e.voice({ bus: 'ambience', at, dur: 0.5, gain: 0.2 * g, priority: 1 });
      if (v) e.tone(v, { type: 'sine', freq: midi(chord[0] - 12 - (i % 8 === 4 ? 5 : 0)), decay: 0.35, attack: 0.004, peak: 0.8 });
    }
  });
}

/** A small brass march in B♭: a trumpet line on the beat, a tuba on 1 and 3, a snare on 2 and 4. */
function brass(e: AudioEngine): LoopHandle {
  const line = [70, 74, 77, 74, 75, 72, 74, 70, 70, 74, 77, 82, 81, 77, 74, 72];
  const bass = [46, 53, 51, 46];
  return sequencer(e, 60 / 116, (i, at, g) => {
    const v = e.voice({ bus: 'ambience', at, dur: 0.5, gain: 0.12 * g, priority: 1, reverb: 0.2 });
    if (v) e.tone(v, { type: 'sawtooth', freq: midi(line[i % line.length]), decay: 0.34, attack: 0.03, peak: 0.55, filter: { type: 'lowpass', freq: 1500, freqTo: 900, Q: 1.1 } });
    if (i % 2 === 0) {
      const b = e.voice({ bus: 'ambience', at, dur: 0.6, gain: 0.18 * g, priority: 1 });
      if (b) e.tone(b, { type: 'sawtooth', freq: midi(bass[(i / 2) % bass.length]), decay: 0.45, attack: 0.02, peak: 0.6, filter: { type: 'lowpass', freq: 420, Q: 0.9 } });
    } else {
      const s = e.voice({ bus: 'ambience', at, dur: 0.25, gain: 0.1 * g, priority: 1 });
      if (s) e.noiseBurst(s, { color: 'white', decay: 0.14, peak: 0.6, filter: { type: 'bandpass', freq: 2200, Q: 0.8 } });
    }
  });
}

/** A marimba wandering the C-major pentatonic over a soft hand drum (fair / festival). */
function market(e: AudioEngine): LoopHandle {
  const scale = [60, 62, 64, 67, 69, 72, 74, 76];
  let pos = 3;
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  return sequencer(e, 60 / 100 / 2, (i, at, g) => {
    if (i % 8 !== 7 && rnd() > 0.28) {
      pos = Math.max(0, Math.min(scale.length - 1, pos + (rnd() < 0.5 ? -1 : 1) * (rnd() < 0.8 ? 1 : 2)));
      const v = e.voice({ bus: 'ambience', at, dur: 0.5, gain: 0.13 * g, priority: 1, reverb: 0.22 });
      if (v) e.tone(v, { type: 'sine', freq: midi(scale[pos]), decay: 0.3, attack: 0.002, peak: 0.85, fm: { ratio: 4, index: 0.9, indexTo: 0 } });
    }
    if (i % 4 === 0 || i % 8 === 3) {
      const d = e.voice({ bus: 'ambience', at, dur: 0.3, gain: 0.12 * g, priority: 1 });
      if (d) e.tone(d, { type: 'sine', freq: i % 4 === 0 ? 110 : 165, freqTo: 70, glide: 0.08, decay: 0.18, attack: 0.002, peak: 0.8 });
    }
  });
}

/** Register the three loops (idempotent per id); returns the undo (the loops stop). */
export function registerEventLoops(): () => void {
  const offs = [registerLoop(LOOP_IDS.music, banjo), registerLoop(LOOP_IDS.parade, brass), registerLoop(LOOP_IDS.fair, market)];
  return () => { for (const id of new Set(Object.values(LOOP_IDS))) setLoop(id, 0, 0); offs.forEach(off => off()); };
}
