/**
 * Synthesized one-shot sounds. Every recipe is a handful of oscillators / noise bursts with
 * envelopes — no samples. Randomised slightly on every play so nothing sounds copy-pasted.
 */
import type { InteractionKind, SurfaceKind } from '../core/types';
import type { AudioEngine, Voice } from './engine';
import { FOOTSTEPS, bumpVoice, clamp, midiToFreq, normaliseImpact, pickOne, rand } from './logic';

const R = Math.random;
const vary = (amount: number) => 1 + (R() * 2 - 1) * amount;

// C major pentatonic for sparkles / arpeggios (ui sounds live in their own key-agnostic space)
const PENTA_HI = [72, 74, 76, 79, 81, 84, 86, 88, 91, 93, 96];

let foot = 0;

export function footstep(e: AudioEngine, surface: SurfaceKind, run: boolean) {
  const r = FOOTSTEPS[surface] ?? FOOTSTEPS.pavement;
  const loud = (run ? 1.25 : 0.9) * vary(0.15);
  const pitch = vary(0.08) * (surface === 'stairs' ? (foot % 2 ? 1.06 : 0.97) : 1);
  foot++;
  const v = e.voice({ bus: 'sfx', dur: 0.22, gain: 0.6 * loud, pan: (foot % 2 ? -1 : 1) * 0.07, priority: 0, reverb: surface === 'wood' || surface === 'stairs' ? 0.05 : 0, name: `step:${surface}` });
  if (!v) return;
  const short = run ? 0.85 : 1;
  if (r.tone > 0) {
    e.tone(v, { type: 'sine', freq: r.tone * pitch * 1.25, freqTo: r.tone * pitch, glide: 0.02, decay: r.toneDecay * short, peak: r.toneGain, attack: 0.002 });
  }
  if (r.grains > 0) {
    for (let i = 0; i < r.grains; i++) {
      e.noiseBurst(v, {
        color: r.color, offset: i * rand(R, 0.008, 0.02), attack: 0.001, decay: rand(R, 0.015, 0.035),
        peak: r.noiseGain * rand(R, 0.5, 1), filter: { type: 'bandpass', freq: r.noiseFreq * pitch * rand(R, 0.7, 1.4), Q: 1.4 },
      });
    }
  }
  e.noiseBurst(v, {
    color: r.color, attack: r.attack, decay: r.noiseDecay * short, peak: r.noiseGain,
    filter: { type: r.noiseType, freq: r.noiseFreq * pitch, Q: r.noiseQ },
  });
}

export function jump(e: AudioEngine) {
  const v = e.voice({ bus: 'sfx', dur: 0.3, gain: 0.3, priority: 2, name: 'jump' });
  if (!v) return;
  const p = vary(0.05);
  e.tone(v, { type: 'sine', freq: 300 * p, freqTo: 680 * p, glide: 0.09, decay: 0.16, peak: 0.55, attack: 0.004 });
  e.tone(v, { type: 'triangle', freq: 600 * p, freqTo: 1360 * p, glide: 0.09, decay: 0.1, peak: 0.12, attack: 0.004 });
  e.noiseBurst(v, { color: 'pink', attack: 0.02, decay: 0.12, peak: 0.25, filter: { type: 'bandpass', freq: 700, freqTo: 2200, Q: 1.2 } });
}

export function land(e: AudioEngine, impactRaw: number, surface: SurfaceKind) {
  const impact = normaliseImpact(impactRaw);
  const v = e.voice({ bus: 'sfx', dur: 0.4, gain: 0.2 + impact * 0.35, priority: 2, name: 'land' });
  if (!v) return;
  e.tone(v, { type: 'sine', freq: 120 * vary(0.05), freqTo: 48, glide: 0.12, decay: 0.16 + impact * 0.12, peak: 0.7, attack: 0.002 });
  e.noiseBurst(v, { color: 'brown', attack: 0.002, decay: 0.1 + impact * 0.1, peak: 0.6, filter: { type: 'lowpass', freq: 500 + impact * 900, Q: 0.6 } });
  const r = FOOTSTEPS[surface] ?? FOOTSTEPS.pavement;
  if (r.tone > 0) e.tone(v, { type: 'sine', freq: r.tone, decay: r.toneDecay * 1.6, peak: r.toneGain * 0.6, attack: 0.002, offset: 0.005 });
  e.noiseBurst(v, { color: r.color, attack: 0.002, decay: r.noiseDecay * 1.4, peak: r.noiseGain * 0.8, filter: { type: r.noiseType, freq: r.noiseFreq, Q: r.noiseQ } });
  // a tiny toy "squish" on bigger landings
  if (impact > 0.45) e.tone(v, { type: 'triangle', freq: 520, freqTo: 330, glide: 0.08, decay: 0.12, peak: 0.1 * impact, offset: 0.03 });
}

export function bump(e: AudioEngine, kind: string, strengthRaw: number) {
  const strength = clamp(Number.isFinite(strengthRaw) ? (strengthRaw > 1.5 ? strengthRaw / 8 : strengthRaw) : 0.5, 0.15, 1);
  const voice = bumpVoice(kind);
  const v = e.voice({ bus: 'sfx', dur: voice === 'metal' ? 0.9 : 0.45, gain: 0.2 + strength * 0.5, pan: (R() - 0.5) * 0.3, priority: 1, reverb: 0.08, name: `bump:${voice}` });
  if (!v) return;
  const p = vary(0.07);
  switch (voice) {
    case 'plastic': {
      // hollow cone clack + a little topple bounce
      e.tone(v, { type: 'square', freq: 820 * p, decay: 0.05, peak: 0.16, filter: { type: 'bandpass', freq: 1400, Q: 2 } });
      e.noiseBurst(v, { attack: 0.001, decay: 0.04, peak: 0.5, filter: { type: 'bandpass', freq: 2400 * p, Q: 2.2 } });
      e.tone(v, { type: 'square', freq: 700 * p, decay: 0.04, peak: 0.08 * strength, offset: rand(R, 0.1, 0.16), filter: { type: 'bandpass', freq: 1300, Q: 2 } });
      e.noiseBurst(v, { attack: 0.001, decay: 0.03, peak: 0.25 * strength, offset: rand(R, 0.1, 0.16), filter: { type: 'bandpass', freq: 2100, Q: 2 } });
      break;
    }
    case 'wood': {
      e.tone(v, { type: 'sine', freq: 165 * p, decay: 0.14, peak: 0.6 });
      e.tone(v, { type: 'sine', freq: 262 * p, decay: 0.09, peak: 0.3 });
      e.noiseBurst(v, { color: 'pink', attack: 0.001, decay: 0.08, peak: 0.45, filter: { type: 'bandpass', freq: 700 * p, Q: 2 } });
      break;
    }
    case 'rubber': {
      e.tone(v, { type: 'sine', freq: 430 * p, freqTo: 250 * p, glide: 0.15, decay: 0.22, peak: 0.55, vibrato: { rate: 18, depth: 0.03 } });
      e.noiseBurst(v, { color: 'pink', attack: 0.004, decay: 0.05, peak: 0.2, filter: { type: 'lowpass', freq: 900 } });
      break;
    }
    case 'metal': {
      for (const [ratio, gain, decay] of [[1, 0.35, 0.7], [2.56, 0.16, 0.45], [4.1, 0.08, 0.3]] as const) {
        e.tone(v, { type: 'sine', freq: 520 * p * ratio, decay, peak: gain });
      }
      e.noiseBurst(v, { attack: 0.001, decay: 0.02, peak: 0.3, filter: { type: 'highpass', freq: 3000 } });
      break;
    }
    case 'squeak': {
      e.tone(v, { type: 'sine', freq: 900 * p, freqTo: 1350 * p, glide: 0.06, decay: 0.16, peak: 0.4, fm: { ratio: 2, index: 0.3 } });
      break;
    }
    default: {
      e.tone(v, { type: 'sine', freq: 95 * p, freqTo: 60, glide: 0.08, decay: 0.14, peak: 0.6 });
      e.noiseBurst(v, { color: 'brown', attack: 0.002, decay: 0.09, peak: 0.6, filter: { type: 'lowpass', freq: 420 } });
    }
  }
}

/** generic "you did a thing" pop, plus a small flavour per interaction kind */
export function interact(e: AudioEngine, kind: InteractionKind) {
  const v = e.voice({ bus: 'sfx', dur: 1.2, gain: 0.42, priority: 2, reverb: 0.12, name: `interact:${kind}` });
  if (!v) return;
  e.tone(v, { type: 'sine', freq: 660, freqTo: 990, glide: 0.04, decay: 0.12, peak: 0.4 });
  e.tone(v, { type: 'sine', freq: 1320, decay: 0.25, peak: 0.18, offset: 0.06 });
  switch (kind) {
    case 'telescope': {
      // coin clink + focusing ratchet
      e.tone(v, { type: 'sine', freq: 2900, decay: 0.3, peak: 0.12, offset: 0.1 });
      e.tone(v, { type: 'sine', freq: 4100, decay: 0.2, peak: 0.06, offset: 0.1 });
      for (let i = 0; i < 5; i++) e.noiseBurst(v, { attack: 0.001, decay: 0.012, peak: 0.22, offset: 0.35 + i * 0.05, filter: { type: 'bandpass', freq: 3200, Q: 3 } });
      break;
    }
    case 'taste': {
      // two soft "nom" bites and a happy up-chirp
      for (let i = 0; i < 2; i++) e.noiseBurst(v, { color: 'pink', attack: 0.004, decay: 0.07, peak: 0.35, offset: 0.12 + i * 0.16, filter: { type: 'bandpass', freq: 1800, Q: 1.5 } });
      e.tone(v, { type: 'sine', freq: 880, freqTo: 1320, glide: 0.1, decay: 0.2, peak: 0.2, offset: 0.5 });
      break;
    }
    case 'fish': {
      // cast whoosh, reel click, plop
      e.noiseBurst(v, { color: 'pink', attack: 0.05, decay: 0.25, peak: 0.3, offset: 0.05, filter: { type: 'bandpass', freq: 900, freqTo: 3200, Q: 1.2 } });
      for (let i = 0; i < 6; i++) e.noiseBurst(v, { attack: 0.001, decay: 0.01, peak: 0.12, offset: 0.2 + i * 0.035, filter: { type: 'highpass', freq: 4000 } });
      e.tone(v, { type: 'sine', freq: 300, freqTo: 900, glide: 0.05, decay: 0.12, peak: 0.25, offset: 0.62 });
      e.noiseBurst(v, { color: 'pink', attack: 0.004, decay: 0.2, peak: 0.25, offset: 0.62, filter: { type: 'lowpass', freq: 1200 } });
      break;
    }
    case 'viewpoint': {
      e.noiseBurst(v, { color: 'pink', attack: 0.35, decay: 0.8, peak: 0.25, filter: { type: 'bandpass', freq: 500, freqTo: 1800, Q: 0.8, glide: 0.9 } });
      break;
    }
    case 'board': {
      // paper rustle
      for (let i = 0; i < 3; i++) e.noiseBurst(v, { attack: 0.01, decay: 0.06, peak: 0.18, offset: 0.08 + i * 0.07, filter: { type: 'highpass', freq: 2500 + i * 700 } });
      break;
    }
    default: break;
  }
}

export function ui(e: AudioEngine, action: 'open' | 'close' | 'hover' | 'select' | 'error') {
  const pr = action === 'hover' ? 0 : 2;
  const v = e.voice({ bus: 'sfx', dur: 0.4, gain: action === 'hover' ? 0.12 : 0.34, priority: pr, reverb: action === 'hover' ? 0 : 0.06, name: `ui:${action}` });
  if (!v) return;
  switch (action) {
    case 'open':
      e.noiseBurst(v, { color: 'pink', attack: 0.03, decay: 0.12, peak: 0.25, filter: { type: 'bandpass', freq: 900, freqTo: 2600, Q: 1.1 } });
      e.tone(v, { type: 'sine', freq: 740, freqTo: 1110, glide: 0.06, decay: 0.16, peak: 0.35, offset: 0.02 });
      break;
    case 'close':
      e.noiseBurst(v, { color: 'pink', attack: 0.02, decay: 0.1, peak: 0.2, filter: { type: 'bandpass', freq: 2400, freqTo: 800, Q: 1.1 } });
      e.tone(v, { type: 'sine', freq: 990, freqTo: 620, glide: 0.07, decay: 0.14, peak: 0.3 });
      break;
    case 'hover':
      e.tone(v, { type: 'sine', freq: 2350 * vary(0.03), decay: 0.035, peak: 0.5 });
      break;
    case 'select':
      e.tone(v, { type: 'triangle', freq: 880, decay: 0.08, peak: 0.35 });
      e.tone(v, { type: 'sine', freq: 1320, decay: 0.16, peak: 0.3, offset: 0.045 });
      break;
    case 'error':
      e.tone(v, { type: 'triangle', freq: 233, decay: 0.12, peak: 0.45, filter: { type: 'lowpass', freq: 1200 } });
      e.tone(v, { type: 'triangle', freq: 196, decay: 0.16, peak: 0.45, offset: 0.13, filter: { type: 'lowpass', freq: 1200 } });
      break;
  }
}

export function choice(e: AudioEngine) {
  const v = e.voice({ bus: 'sfx', dur: 0.6, gain: 0.26, priority: 2, reverb: 0.15, name: 'choice' });
  if (!v) return;
  e.tone(v, { type: 'triangle', freq: 1046, decay: 0.2, peak: 0.35 });
  e.tone(v, { type: 'sine', freq: 1568, decay: 0.3, peak: 0.25, offset: 0.06 });
  e.tone(v, { type: 'sine', freq: 2093, decay: 0.35, peak: 0.12, offset: 0.12 });
}

function sparkle(e: AudioEngine, count: number, offset: number, gain: number) {
  const v = e.voice({ bus: 'sfx', dur: offset + count * 0.05 + 0.6, gain, priority: 3, reverb: 0.45 });
  if (!v) return;
  for (let i = 0; i < count; i++) {
    const f = midiToFreq(pickOne(R, PENTA_HI.slice(4)));
    e.tone(v, { type: 'sine', freq: f, decay: rand(R, 0.18, 0.35), peak: rand(R, 0.12, 0.22), offset: offset + i * rand(R, 0.035, 0.06), attack: 0.002 });
  }
}

export function stamp(e: AudioEngine) {
  const v = e.voice({ bus: 'sfx', dur: 0.5, gain: 0.55, priority: 3, reverb: 0.1, name: 'stamp' });
  if (!v) return;
  e.tone(v, { type: 'sine', freq: 150, freqTo: 58, glide: 0.1, decay: 0.2, peak: 0.8 });
  e.noiseBurst(v, { color: 'brown', attack: 0.002, decay: 0.09, peak: 0.7, filter: { type: 'lowpass', freq: 900 } });
  e.noiseBurst(v, { attack: 0.001, decay: 0.02, peak: 0.25, filter: { type: 'bandpass', freq: 2200, Q: 1.5 } });
  sparkle(e, 7, 0.14, 0.35);
}

export function postcard(e: AudioEngine) {
  const v = e.voice({ bus: 'sfx', dur: 1.8, gain: 0.34, priority: 4, reverb: 0.5, name: 'postcard' });
  if (!v) return;
  const notes = [72, 76, 79, 81, 84, 88, 91];
  notes.forEach((m, i) => {
    const f = midiToFreq(m);
    e.tone(v, { type: 'triangle', freq: f, decay: 0.7, peak: 0.26, offset: i * 0.07, attack: 0.003 });
    e.tone(v, { type: 'sine', freq: f * 2, decay: 0.4, peak: 0.08, offset: i * 0.07, attack: 0.003 });
  });
  e.noiseBurst(v, { attack: 0.3, decay: 0.8, peak: 0.08, filter: { type: 'highpass', freq: 6000 } });
  sparkle(e, 5, 0.55, 0.25);
}

export function goal(e: AudioEngine) {
  const v = e.voice({ bus: 'sfx', dur: 2, gain: 0.34, priority: 4, reverb: 0.4, name: 'goal' });
  if (!v) return;
  const lead = [67, 72, 76];
  lead.forEach((m, i) => {
    e.tone(v, { wave: e.waves.warm, freq: midiToFreq(m), decay: 0.28, peak: 0.3, offset: i * 0.11, attack: 0.006, filter: { type: 'lowpass', freq: 3200 } });
  });
  for (const m of [72, 76, 79, 84]) {
    e.tone(v, { wave: e.waves.warm, freq: midiToFreq(m), decay: 1.3, peak: 0.16, offset: 0.36, attack: 0.02, filter: { type: 'lowpass', freq: 2800 } });
  }
  sparkle(e, 6, 0.4, 0.22);
}

export function wish(e: AudioEngine, added: boolean) {
  const v = e.voice({ bus: 'sfx', dur: 0.6, gain: 0.3, priority: 3, reverb: 0.12, name: added ? 'wish:add' : 'wish:remove' });
  if (!v) return;
  if (added) {
    e.tone(v, { type: 'sine', freq: 560, freqTo: 1250, glide: 0.045, decay: 0.12, peak: 0.6 });
    e.noiseBurst(v, { attack: 0.001, decay: 0.015, peak: 0.25, filter: { type: 'highpass', freq: 3000 } });
    e.tone(v, { type: 'sine', freq: 1568, decay: 0.35, peak: 0.25, offset: 0.08 });
    e.tone(v, { type: 'sine', freq: 2093, decay: 0.3, peak: 0.15, offset: 0.14 });
  } else {
    e.tone(v, { type: 'sine', freq: 900, freqTo: 420, glide: 0.08, decay: 0.14, peak: 0.5 });
    e.noiseBurst(v, { attack: 0.001, decay: 0.015, peak: 0.15, filter: { type: 'highpass', freq: 2500 } });
  }
}

/** inharmonic bell strike (church-ish partial set) */
function bellStrike(e: AudioEngine, v: Voice, base: number, offset: number, gain: number, length: number) {
  const partials: [number, number, number][] = [[0.5, 0.35, 1.3], [1, 0.5, 1], [1.19, 0.25, 0.7], [1.5, 0.2, 0.6], [2, 0.18, 0.45], [2.52, 0.1, 0.35], [3.01, 0.06, 0.25]];
  for (const [ratio, g, d] of partials) {
    e.tone(v, { type: 'sine', freq: base * ratio * vary(0.002), decay: length * d, peak: g * gain, offset, attack: 0.002 });
  }
  e.noiseBurst(v, { attack: 0.001, decay: 0.02, peak: 0.12 * gain, offset, filter: { type: 'bandpass', freq: base * 4, Q: 2 } });
}

export function bell(e: AudioEngine) {
  const v = e.voice({ bus: 'sfx', dur: 4.5, gain: 0.3, priority: 3, reverb: 0.55, name: 'bell' });
  if (!v) return;
  bellStrike(e, v, 392, 0, 1, 3.2);
  bellStrike(e, v, 294, 0.85, 0.9, 3.6);
}

export function streetcarBell(e: AudioEngine) {
  const v = e.voice({ bus: 'sfx', dur: 1.6, gain: 0.3, priority: 3, reverb: 0.2, name: 'streetcar-bell' });
  if (!v) return;
  for (const offset of [0, 0.16]) {
    for (const [ratio, g, d] of [[1, 0.4, 0.6], [1.52, 0.25, 0.45], [2.13, 0.18, 0.35], [2.94, 0.12, 0.25], [4.1, 0.06, 0.18]] as const) {
      e.tone(v, { type: 'sine', freq: 1180 * ratio * vary(0.003), decay: d, peak: g, offset, attack: 0.001 });
    }
    e.noiseBurst(v, { attack: 0.001, decay: 0.015, peak: 0.25, offset, filter: { type: 'highpass', freq: 3500 } });
  }
}

/** The cable-car gripman's bell (lane F): a lower, brighter clang than the F-line gong, rung in quick strikes. */
export function cableBell(e: AudioEngine, gain = 1, strikes = 3) {
  const v = e.voice({ bus: 'sfx', dur: 1.4, gain: 0.26 * gain, priority: 3, reverb: 0.25, name: 'cable-bell' });
  if (!v) return;
  for (let i = 0; i < strikes; i++) {
    const offset = i * 0.13 + (i === strikes - 1 && strikes > 2 ? 0.09 : 0);
    for (const [ratio, g, d] of [[1, 0.42, 0.42], [2.02, 0.22, 0.3], [2.76, 0.16, 0.22], [3.9, 0.08, 0.14]] as const) {
      e.tone(v, { type: 'sine', freq: 880 * ratio * vary(0.004), decay: d, peak: g, offset, attack: 0.001 });
    }
    e.noiseBurst(v, { attack: 0.001, decay: 0.012, peak: 0.3, offset, filter: { type: 'highpass', freq: 3000 } });
  }
}

/** distant two-tone diaphone: "beeee-ohhh" */
export function foghorn(e: AudioEngine, distance = 1, pan = 0) {
  const far = clamp(distance);
  const v = e.voice({ bus: 'ambience', dur: 5, gain: 0.8 - far * 0.25, pan, priority: 3, reverb: 0.75, name: 'foghorn' });
  if (!v) return;
  const lp = 700 - far * 250;
  for (const d of [-7, 7]) {
    e.tone(v, { type: 'sawtooth', freq: 178, decay: 2.2, peak: 0.24, attack: 0.18, detune: d, filter: { type: 'lowpass', freq: lp, Q: 0.9 }, vibrato: { rate: 5, depth: 0.004 } });
    e.tone(v, { type: 'sawtooth', freq: 140, freqTo: 128, glide: 1.6, decay: 2.6, peak: 0.3, attack: 0.12, detune: d, offset: 1.55, filter: { type: 'lowpass', freq: lp * 0.8, Q: 0.9 } });
  }
  e.tone(v, { type: 'sine', freq: 70, decay: 2.2, peak: 0.25, attack: 0.3, offset: 1.55 });
}

export function shutter(e: AudioEngine) {
  const v = e.voice({ bus: 'sfx', dur: 0.5, gain: 0.35, priority: 3, name: 'shutter' });
  if (!v) return;
  e.noiseBurst(v, { attack: 0.0005, decay: 0.015, peak: 0.8, filter: { type: 'highpass', freq: 3000 } });
  e.noiseBurst(v, { attack: 0.001, decay: 0.035, peak: 0.4, filter: { type: 'bandpass', freq: 1200, Q: 1.5 } });
  e.noiseBurst(v, { attack: 0.0005, decay: 0.02, peak: 0.7, offset: 0.075, filter: { type: 'highpass', freq: 2600 } });
  e.tone(v, { type: 'sawtooth', freq: 95, decay: 0.18, peak: 0.1, offset: 0.12, attack: 0.02, filter: { type: 'bandpass', freq: 1800, Q: 5 } });
}

export function arrive(e: AudioEngine) {
  const v = e.voice({ bus: 'sfx', dur: 1.6, gain: 0.3, priority: 3, reverb: 0.45, name: 'arrive' });
  if (!v) return;
  [76, 79, 84].forEach((m, i) => {
    const f = midiToFreq(m);
    e.tone(v, { type: 'triangle', freq: f, decay: 0.9, peak: 0.28, offset: i * 0.12, attack: 0.004 });
    e.tone(v, { type: 'sine', freq: f * 2.01, decay: 0.5, peak: 0.07, offset: i * 0.12, attack: 0.004 });
  });
}

/** pet-call whistle "fwee-fwoo" (audio.ts adds BAYBAY's reply bark) */
export function guideCall(e: AudioEngine) {
  const v = e.voice({ bus: 'sfx', dur: 1.3, gain: 0.26, priority: 3, reverb: 0.2, name: 'guide-call' });
  if (!v) return;
  e.tone(v, { type: 'sine', freq: 1500, freqTo: 2350, glide: 0.16, decay: 0.26, peak: 0.5, attack: 0.03, vibrato: { rate: 7, depth: 0.01 } });
  e.tone(v, { type: 'sine', freq: 2350, freqTo: 1450, glide: 0.28, decay: 0.38, peak: 0.5, attack: 0.03, offset: 0.3 });
  e.noiseBurst(v, { color: 'pink', attack: 0.03, decay: 0.3, peak: 0.05, filter: { type: 'bandpass', freq: 2000, Q: 2 } });
}

export function areaChime(e: AudioEngine) {
  const v = e.voice({ bus: 'sfx', dur: 1.2, gain: 0.12, priority: 1, reverb: 0.35, name: 'area' });
  if (!v) return;
  for (const [m, off] of [[79, 0], [84, 0.1]] as const) {
    const f = midiToFreq(m);
    e.tone(v, { type: 'sine', freq: f, decay: 0.6, peak: 0.4, offset: off });
    e.tone(v, { type: 'sine', freq: f * 4, decay: 0.08, peak: 0.08, offset: off });
  }
}

export function emote(e: AudioEngine, who: 'player' | 'baybay', name: string) {
  if (name === 'hop') {
    const v = e.voice({ bus: 'sfx', dur: 0.3, gain: 0.18, priority: 1, name: `emote:${who}:hop` });
    if (v) e.tone(v, { type: 'sine', freq: 520, freqTo: 1040, glide: 0.08, decay: 0.14, peak: 0.5 });
  } else if (name === 'bite') {
    // a fish takes the bait: a bright plip + a short splash
    const v = e.voice({ bus: 'sfx', dur: 0.6, gain: 0.34, priority: 2, name: `emote:${who}:bite` });
    if (v) {
      e.tone(v, { type: 'sine', freq: 620, freqTo: 1500, glide: 0.05, decay: 0.09, peak: 0.45 });
      e.noiseBurst(v, { color: 'pink', attack: 0.004, decay: 0.28, peak: 0.55, offset: 0.03, filter: { type: 'bandpass', freq: 1200, Q: 0.9 } });
    }
  } else if (name === 'clap') {
    const v = e.voice({ bus: 'sfx', dur: 0.5, gain: 0.25, priority: 1, name: `emote:${who}:clap` });
    if (v) for (let i = 0; i < 3; i++) e.noiseBurst(v, { color: 'pink', attack: 0.001, decay: 0.05, peak: 0.5, offset: i * 0.13, filter: { type: 'bandpass', freq: 1300 * vary(0.1), Q: 1.4 } });
  }
}

export type ChirpKind = 'hi' | 'yay' | 'wow' | 'this-way' | 'arrived' | 'think';

/** Synth stand-ins for the voice barks: a cute otter squeak phrase. */
export function otterChirp(e: AudioEngine, kind: ChirpKind, offset = 0) {
  const v = e.voice({ bus: 'voice', at: e.now + offset, dur: 0.9, gain: 0.2, priority: 3, reverb: 0.1, name: `chirp:${kind}` });
  if (!v) return;
  const b = 980 * vary(0.03);
  const blip = (f0: number, f1: number, at: number, dur: number, peak = 0.5) =>
    e.tone(v, { type: 'sine', freq: f0, freqTo: f1, glide: dur * 0.7, decay: dur, peak, offset: at, attack: 0.01, fm: { ratio: 2, index: 0.25, indexTo: 0.05 } });
  switch (kind) {
    case 'hi': blip(b * 0.8, b * 1.1, 0, 0.1); blip(b * 1.1, b * 1.5, 0.12, 0.16); break;
    case 'yay': blip(b, b * 1.2, 0, 0.08); blip(b * 1.2, b * 1.5, 0.09, 0.08); blip(b * 1.5, b * 2, 0.18, 0.2); break;
    case 'wow': blip(b * 0.8, b * 1.4, 0, 0.18); blip(b * 1.4, b * 0.9, 0.18, 0.22); break;
    case 'this-way': blip(b * 1.1, b * 1.3, 0, 0.09); blip(b * 1.3, b, 0.13, 0.15); break;
    case 'arrived': blip(b * 1.5, b * 1.3, 0, 0.08); blip(b * 1.3, b * 1.1, 0.1, 0.08); blip(b * 1.1, b * 1.6, 0.2, 0.2); break;
    case 'think':
      e.tone(v, { type: 'sine', freq: 440, freqTo: 400, glide: 0.4, decay: 0.5, peak: 0.35, attack: 0.05, vibrato: { rate: 6, depth: 0.015 } });
      break;
  }
}

// ---------------------------------------------------------------------------
// Ambient one-shots (called by the ambience scheduler)
// ---------------------------------------------------------------------------

/** herring gull "kee-ow" call, 1–4 notes */
export function gull(e: AudioEngine, pan: number, gain: number, at = 0) {
  const n = 1 + Math.floor(R() * 3.5);
  const v = e.voice({ bus: 'ambience', at: e.now + at, dur: n * 0.3 + 0.4, gain, pan, priority: 1, reverb: 0.25, name: 'gull' });
  if (!v) return;
  let t = 0;
  const base = rand(R, 1150, 1500);
  for (let i = 0; i < n; i++) {
    const f = base * (1 - i * 0.06) * vary(0.04);
    const len = i === 0 ? rand(R, 0.2, 0.3) : rand(R, 0.12, 0.2);
    e.tone(v, {
      type: 'sawtooth', freq: f * 0.72, freqTo: f * 0.55, glide: len, decay: len, peak: 0.34, offset: t, attack: 0.025,
      fm: { ratio: 0.5, index: 0.08 }, vibrato: { rate: rand(R, 22, 30), depth: 0.035 }, filter: { type: 'bandpass', freq: f * 1.7, Q: 2.2 },
    });
    e.tone(v, { type: 'sine', freq: f * 0.72, freqTo: f * 1.08, glide: 0.05, decay: 0.06, peak: 0.12, offset: t, attack: 0.005 });
    t += len + rand(R, 0.05, 0.1);
  }
}

/** California sea lion bark: rough, formant-filtered "ARF" */
export function seaLionBark(e: AudioEngine, pan: number, gain: number, count: number, at = 0) {
  const n = Math.max(1, Math.min(5, Math.round(count)));
  const v = e.voice({ bus: 'ambience', at: e.now + at, dur: n * 0.34 + 0.4, gain, pan, priority: 2, reverb: 0.2, name: 'sea-lion' });
  if (!v) return;
  const ctx = e.ctx;
  let t = v.at;
  const base = rand(R, 210, 300);
  for (let i = 0; i < n; i++) {
    const f = base * vary(0.06) * (i === n - 1 ? 1.12 : 1);
    const len = rand(R, 0.16, 0.24);
    const osc = ctx.createOscillator();
    osc.setPeriodicWave(e.waves.reed);
    osc.frequency.setValueAtTime(f * 0.85, t);
    osc.frequency.linearRampToValueAtTime(f * 1.12, t + 0.04);
    osc.frequency.exponentialRampToValueAtTime(f * 0.7, t + len);
    // growl: amplitude roughness
    const am = ctx.createGain();
    am.gain.value = 0.6;
    const lfo = ctx.createOscillator();
    lfo.type = 'square';
    lfo.frequency.value = rand(R, 32, 48);
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = 0.4;
    lfo.connect(lfoDepth).connect(am.gain);
    const f1 = ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = rand(R, 650, 800); f1.Q.value = 3;
    const f2 = ctx.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = rand(R, 1250, 1500); f2.Q.value = 4;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.9, t + 0.02);
    env.gain.setTargetAtTime(0, t + len * 0.55, len * 0.18);
    osc.connect(am);
    am.connect(f1).connect(env);
    am.connect(f2).connect(env);
    env.connect(v.input);
    osc.start(t); lfo.start(t);
    osc.stop(t + len + 0.1); lfo.stop(t + len + 0.1);
    e.track(v, osc, lfo);
    t += len + rand(R, 0.08, 0.16);
  }
  e.noiseBurst(v, { color: 'pink', attack: 0.01, decay: 0.15, peak: 0.12, filter: { type: 'bandpass', freq: 900, Q: 1 } });
}

export function bellBuoy(e: AudioEngine, pan: number, gain: number) {
  const v = e.voice({ bus: 'ambience', dur: 3.5, gain, pan, priority: 1, reverb: 0.6, name: 'bell-buoy' });
  if (!v) return;
  const strikes = 1 + Math.floor(R() * 2);
  for (let s = 0; s < strikes; s++) {
    const off = s * rand(R, 0.5, 0.9);
    for (const [ratio, g, d] of [[1, 0.4, 2.6], [2.32, 0.2, 1.6], [3.63, 0.1, 1.1], [5.1, 0.05, 0.7]] as const) {
      e.tone(v, { type: 'sine', freq: 690 * ratio * vary(0.004), decay: d, peak: g * (s ? 0.7 : 1), offset: off });
    }
  }
}

export function carPass(e: AudioEngine, gain: number, dir: 1 | -1) {
  const len = rand(R, 1.6, 2.4);
  const v = e.voice({ bus: 'ambience', dur: len + 0.2, gain, priority: 1, name: 'car' });
  if (!v) return;
  const ctx = e.ctx;
  const panner = ctx.createStereoPanner();
  panner.pan.setValueAtTime(-0.75 * dir, v.at);
  panner.pan.linearRampToValueAtTime(0.75 * dir, v.at + len);
  const src = ctx.createBufferSource();
  src.buffer = e.noise.pink;
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass'; f.Q.value = 0.9;
  f.frequency.setValueAtTime(500, v.at);
  f.frequency.linearRampToValueAtTime(1300, v.at + len * 0.5);
  f.frequency.linearRampToValueAtTime(420, v.at + len);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0, v.at);
  env.gain.linearRampToValueAtTime(0.7, v.at + len * 0.5);
  env.gain.linearRampToValueAtTime(0, v.at + len);
  src.connect(f).connect(env).connect(panner).connect(v.input);
  src.start(v.at, R() * 3);
  src.stop(v.at + len + 0.05);
  e.track(v, src);
}

export function splash(e: AudioEngine, pan: number, gain: number) {
  const v = e.voice({ bus: 'ambience', dur: 0.6, gain, pan, priority: 0, reverb: 0.1 });
  if (!v) return;
  e.noiseBurst(v, { color: 'pink', attack: rand(R, 0.02, 0.06), decay: rand(R, 0.2, 0.4), peak: 0.5, filter: { type: 'bandpass', freq: rand(R, 700, 1600), Q: 0.9 } });
  if (R() < 0.35) e.tone(v, { type: 'sine', freq: rand(R, 350, 500), freqTo: rand(R, 900, 1400), glide: 0.05, decay: 0.07, peak: 0.12, offset: rand(R, 0.05, 0.2) });
}

export function railClack(e: AudioEngine, gain: number) {
  const v = e.voice({ bus: 'ambience', dur: 0.25, gain, priority: 0 });
  if (!v) return;
  for (const off of [0, 0.075]) {
    e.noiseBurst(v, { attack: 0.001, decay: 0.03, peak: 0.5, offset: off, filter: { type: 'bandpass', freq: 1500, Q: 1.2 } });
    e.tone(v, { type: 'sine', freq: 95, decay: 0.05, peak: 0.4, offset: off });
  }
}

/** distant chatter grain for the crowd layer */
export function chatter(e: AudioEngine, pan: number, gain: number) {
  const v = e.voice({ bus: 'ambience', dur: 0.4, gain, pan, priority: 0 });
  if (!v) return;
  const f = rand(R, 170, 320);
  e.tone(v, { wave: e.waves.reed, freq: f, freqTo: f * rand(R, 0.8, 1.25), glide: 0.15, decay: rand(R, 0.1, 0.22), peak: 0.3, attack: 0.02, filter: { type: 'bandpass', freq: rand(R, 600, 1400), Q: 2.5 } });
}

