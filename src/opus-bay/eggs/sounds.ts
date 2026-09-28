import type { AudioEngine } from '../audio/engine';
import { registerSound, type SoundOpts } from '../audio/hooks';
import { seaLionBark } from '../audio/sfx';

/**
 * Wave 5 · lane D (W5-D2) · the eggs' sounds, synthesized with the engine's primitives (no files, no recordings, no
 * historic laugh record): registered through audio/hooks.ts, played with `playSound('egg:…', { gain, pan, pitch })`.
 * One-shots on the sfx bus; the foghorns and the Wave Organ on the ambience bus (Karl's world sounds). Each recipe is a
 * handful of oscillators / noise bursts and randomised a little on every play.
 */

const R = Math.random;
const rand = (a: number, b: number) => a + (b - a) * R();
const midi = (m: number) => 440 * 2 ** ((m - 69) / 12);
const g0 = (o: SoundOpts | undefined, base: number) => base * Math.max(0, Math.min(1.5, o?.gain ?? 1));
const pan = (o: SoundOpts | undefined) => Math.max(-1, Math.min(1, o?.pan ?? 0));
const pitch = (o: SoundOpts | undefined) => Math.max(0.5, Math.min(2, o?.pitch ?? 1));

/** A find: a soft rising pentatonic sparkle over a warm "pop" (not the stamp, not the postcard). */
function find(e: AudioEngine, o?: SoundOpts) {
  const v = e.voice({ bus: 'sfx', dur: 1.6, gain: g0(o, 0.32), pan: pan(o), priority: 4, reverb: 0.45, name: 'egg:find' });
  if (!v) return;
  e.tone(v, { type: 'sine', freq: 330, freqTo: 520, glide: 0.08, decay: 0.25, peak: 0.5, attack: 0.005 });
  [67, 71, 74, 79, 83, 86].forEach((m, i) => {
    e.tone(v, { type: 'triangle', freq: midi(m) * pitch(o), decay: 0.55, peak: 0.22, offset: 0.08 + i * 0.075, attack: 0.004 });
    e.tone(v, { type: 'sine', freq: midi(m + 12) * pitch(o), decay: 0.3, peak: 0.07, offset: 0.08 + i * 0.075, attack: 0.004 });
  });
}

/** Wild conures: a bright, scratchy chorus of short calls from several birds. */
function parrots(e: AudioEngine, o?: SoundOpts) {
  const v = e.voice({ bus: 'ambience', dur: 3.2, gain: g0(o, 0.3), pan: pan(o), priority: 3, reverb: 0.25, name: 'egg:parrots' });
  if (!v) return;
  const n = 9 + Math.floor(R() * 5);
  for (let i = 0; i < n; i++) {
    const f = rand(1900, 3100) * pitch(o), at = rand(0, 2.6), len = rand(0.07, 0.16);
    e.tone(v, { type: 'sawtooth', freq: f, freqTo: f * rand(0.7, 1.25), glide: len, decay: len, peak: rand(0.18, 0.32), offset: at, attack: 0.006,
      fm: { ratio: rand(0.45, 0.6), index: 0.35 }, filter: { type: 'bandpass', freq: f * 1.3, Q: 2.4 } });
  }
}

function seaLions(e: AudioEngine, o?: SoundOpts) {
  const k = Math.max(0.1, Math.min(1, o?.gain ?? 1));
  seaLionBark(e, pan(o), 0.35 * k, 2 + Math.round(3 * k));
  if (k > 0.5) seaLionBark(e, -pan(o) * 0.6, 0.25 * k, 2, rand(0.5, 0.9));
}

/** The arcade's laughing lady: our own cackle — a warm "ha-ha-ha-ha" falling in pitch, a breath, one more "ha!". */
function cackle(e: AudioEngine, o?: SoundOpts) {
  const v = e.voice({ bus: 'sfx', dur: 3.4, gain: g0(o, 0.28), pan: pan(o), priority: 3, reverb: 0.35, name: 'egg:cackle' });
  if (!v) return;
  const base = rand(300, 340) * pitch(o);
  const has = [0, 0.2, 0.39, 0.57, 0.74, 0.9, 1.05, 1.19];
  has.forEach((at, i) => {
    const f = base * (1.25 - i * 0.045);
    e.tone(v, { type: 'sawtooth', freq: f * 1.08, freqTo: f * 0.92, glide: 0.12, decay: 0.15, peak: 0.36, offset: at, attack: 0.012,
      filter: { type: 'bandpass', freq: 900 + 300 * R(), Q: 1.6 }, vibrato: { rate: 9, depth: 0.02 } });
    e.noiseBurst(v, { color: 'pink', decay: 0.08, peak: 0.12, offset: at, attack: 0.004, filter: { type: 'bandpass', freq: 1800, Q: 1.1 } });
  });
  // the breath and the last big "HA!"
  e.noiseBurst(v, { color: 'pink', decay: 0.35, peak: 0.1, offset: 1.5, attack: 0.08, filter: { type: 'bandpass', freq: 1200, Q: 0.7 } });
  e.tone(v, { type: 'sawtooth', freq: base * 1.4, freqTo: base * 0.95, glide: 0.35, decay: 0.45, peak: 0.42, offset: 2.0, attack: 0.02,
    filter: { type: 'bandpass', freq: 1000, Q: 1.4 }, vibrato: { rate: 7, depth: 0.03 } });
}

/** BAYBAY giggling along: quick high otter blips. */
function giggle(e: AudioEngine, o?: SoundOpts) {
  const v = e.voice({ bus: 'voice', dur: 1.3, gain: g0(o, 0.2), pan: pan(o), priority: 3, reverb: 0.12, name: 'egg:giggle' });
  if (!v) return;
  const b = 1150 * pitch(o) * rand(0.97, 1.03);
  for (let i = 0; i < 6; i++) {
    const f = b * (1 + 0.08 * Math.sin(i * 1.7));
    e.tone(v, { type: 'sine', freq: f, freqTo: f * 1.3, glide: 0.06, decay: 0.09, peak: 0.45, offset: i * 0.13, attack: 0.008, fm: { ratio: 2, index: 0.2 } });
  }
}

/** An old desk telephone: two bell rings (a fast hammer between two bells). */
function phone(e: AudioEngine, o?: SoundOpts) {
  const v = e.voice({ bus: 'sfx', dur: 3.2, gain: g0(o, 0.2), pan: pan(o), priority: 3, reverb: 0.2, name: 'egg:phone' });
  if (!v) return;
  for (const start of [0, 1.7]) {
    for (let k = 0; k < 22; k++) {
      const at = start + k * 0.045;
      const f = (k % 2 ? 1760 : 1480) * pitch(o);
      e.tone(v, { type: 'triangle', freq: f, decay: 0.09, peak: 0.28, offset: at, attack: 0.001 });
      e.tone(v, { type: 'sine', freq: f * 2.76, decay: 0.05, peak: 0.07, offset: at, attack: 0.001 });
    }
  }
}

/** The switchboard: a plug going in, two clicks. */
function plug(e: AudioEngine, o?: SoundOpts) {
  const v = e.voice({ bus: 'sfx', dur: 0.6, gain: g0(o, 0.3), pan: pan(o), priority: 2, name: 'egg:plug' });
  if (!v) return;
  e.noiseBurst(v, { attack: 0.001, decay: 0.03, peak: 0.6, filter: { type: 'bandpass', freq: 2600, Q: 2 } });
  e.tone(v, { type: 'sine', freq: 180, freqTo: 120, glide: 0.05, decay: 0.06, peak: 0.4 });
  e.noiseBurst(v, { attack: 0.001, decay: 0.02, peak: 0.45, offset: 0.16, filter: { type: 'bandpass', freq: 3400, Q: 2 } });
}

/** A fortune cookie cracking, then the paper slip. */
function cookie(e: AudioEngine, o?: SoundOpts) {
  const v = e.voice({ bus: 'sfx', dur: 1, gain: g0(o, 0.32), pan: pan(o), priority: 3, name: 'egg:cookie' });
  if (!v) return;
  for (let i = 0; i < 3; i++) e.noiseBurst(v, { attack: 0.0008, decay: rand(0.02, 0.04), peak: 0.6, offset: i * rand(0.025, 0.05), filter: { type: 'bandpass', freq: rand(2800, 4200), Q: 1.6 } });
  e.noiseBurst(v, { color: 'pink', attack: 0.08, decay: 0.3, peak: 0.2, offset: 0.35, filter: { type: 'highpass', freq: 3000 } });
}

/** A tiny toy-trumpet flourish (the proclamation). */
function fanfare(e: AudioEngine, o?: SoundOpts) {
  const v = e.voice({ bus: 'sfx', dur: 1.6, gain: g0(o, 0.22), pan: pan(o), priority: 3, reverb: 0.3, name: 'egg:fanfare' });
  if (!v) return;
  [[67, 0, 0.12], [72, 0.14, 0.12], [76, 0.28, 0.12], [79, 0.44, 0.55]].forEach(([m, at, len]) => {
    const f = midi(m) * pitch(o);
    e.tone(v, { type: 'sawtooth', freq: f, decay: len + 0.15, peak: 0.3, offset: at, attack: 0.02, filter: { type: 'lowpass', freq: f * 3.2, Q: 1.2 }, vibrato: { rate: 5.5, depth: 0.006 } });
  });
}

/**
 * The Wave Organ: gurgles, hums and sighs from the pipes (the waves push water and air through them). `gain` carries
 * the tide (louder near high tide); ≈ 8 s.
 */
function organ(e: AudioEngine, o?: SoundOpts) {
  const v = e.voice({ bus: 'ambience', dur: 8.5, gain: g0(o, 0.55), pan: pan(o), priority: 3, reverb: 0.55, name: 'egg:organ' });
  if (!v) return;
  const pipes = [98, 131, 147, 175, 196, 220, 262];
  for (let i = 0; i < 9; i++) {
    const f = pipes[Math.floor(R() * pipes.length)] * rand(0.97, 1.03);
    const at = rand(0, 6.5), len = rand(0.9, 2.2);
    e.noiseBurst(v, { color: 'pink', attack: rand(0.2, 0.5), decay: len, peak: rand(0.25, 0.45), offset: at, filter: { type: 'bandpass', freq: f, Q: 14 } });
    e.tone(v, { type: 'sine', freq: f, freqTo: f * rand(0.96, 1.04), glide: len, decay: len, peak: rand(0.06, 0.12), offset: at + 0.1, attack: 0.3 });
  }
  // the gurgle of water in the pipe mouths
  for (let i = 0; i < 14; i++) e.tone(v, { type: 'sine', freq: rand(220, 520), freqTo: rand(520, 900), glide: 0.05, decay: 0.07, peak: 0.12, offset: rand(0, 7.5), attack: 0.004 });
  e.noiseBurst(v, { color: 'brown', attack: 1.2, decay: 6, peak: 0.25, filter: { type: 'lowpass', freq: 380 } });
}

/** A toy biplane's propeller buzzing past, then a little cheer (Crissy Field). */
function propeller(e: AudioEngine, o?: SoundOpts) {
  const v = e.voice({ bus: 'sfx', dur: 2.6, gain: g0(o, 0.22), pan: pan(o), priority: 3, reverb: 0.2, name: 'egg:propeller' });
  if (!v) return;
  e.tone(v, { type: 'sawtooth', freq: 120, freqTo: 95, glide: 1.8, decay: 1.9, peak: 0.35, attack: 0.3, vibrato: { rate: 28, depth: 0.08 }, filter: { type: 'lowpass', freq: 900, Q: 0.8 } });
  [72, 76, 79].forEach((m, i) => e.tone(v, { type: 'triangle', freq: midi(m), decay: 0.4, peak: 0.2, offset: 1.5 + i * 0.1, attack: 0.004 }));
}

/** A small splash (BAYBAY rolling onto her back). */
function splash(e: AudioEngine, o?: SoundOpts) {
  const v = e.voice({ bus: 'sfx', dur: 0.9, gain: g0(o, 0.3), pan: pan(o), priority: 2, name: 'egg:splash' });
  if (!v) return;
  e.noiseBurst(v, { color: 'pink', attack: 0.004, decay: 0.35, peak: 0.55, filter: { type: 'bandpass', freq: 1300, freqTo: 600, Q: 0.8 } });
  e.tone(v, { type: 'sine', freq: 600, freqTo: 1300, glide: 0.04, decay: 0.06, peak: 0.3, offset: 0.05 });
}

/** A tin lid creaking open, then paper. */
function tin(e: AudioEngine, o?: SoundOpts) {
  const v = e.voice({ bus: 'sfx', dur: 1.3, gain: g0(o, 0.26), pan: pan(o), priority: 3, name: 'egg:tin' });
  if (!v) return;
  e.tone(v, { type: 'sawtooth', freq: 620, freqTo: 480, glide: 0.4, decay: 0.45, peak: 0.12, attack: 0.05, filter: { type: 'bandpass', freq: 1500, Q: 4 }, vibrato: { rate: 23, depth: 0.04 } });
  e.noiseBurst(v, { attack: 0.001, decay: 0.03, peak: 0.4, offset: 0.46, filter: { type: 'bandpass', freq: 3000, Q: 2 } });
  e.noiseBurst(v, { color: 'pink', attack: 0.1, decay: 0.35, peak: 0.18, offset: 0.62, filter: { type: 'highpass', freq: 2800 } });
}

/** The pelican's wings: a big soft whoosh (the wing-waggle). */
function whoosh(e: AudioEngine, o?: SoundOpts) {
  const v = e.voice({ bus: 'sfx', dur: 1.2, gain: g0(o, 0.3), pan: pan(o), priority: 2, name: 'egg:whoosh' });
  if (!v) return;
  for (let i = 0; i < 2; i++) e.noiseBurst(v, { color: 'pink', attack: 0.12, decay: 0.35, peak: 0.45, offset: i * 0.3, filter: { type: 'bandpass', freq: 500, freqTo: 1400, glide: 0.3, Q: 0.9 } });
}

/**
 * The Golden Gate Bridge's foghorns (goldengate.org, read 2026-09-28): the south tower pier's pair sounds as one low
 * 2-second tone; mid-span's horns give 1-second blasts (the host schedules the rhythm). Distance and direction come in
 * `gain` / `pan`; a higher `pitch` never goes above the toy range.
 */
function hornSouth(e: AudioEngine, o?: SoundOpts) {
  const v = e.voice({ bus: 'ambience', dur: 4, gain: g0(o, 0.8), pan: pan(o), priority: 3, reverb: 0.7, name: 'egg:horn-south' });
  if (!v) return;
  for (const d of [-6, 6]) e.tone(v, { type: 'sawtooth', freq: 146, decay: 2.3, peak: 0.28, attack: 0.16, detune: d, filter: { type: 'lowpass', freq: 520, Q: 0.9 }, vibrato: { rate: 4.5, depth: 0.003 } });
  e.tone(v, { type: 'sine', freq: 73, decay: 2.3, peak: 0.3, attack: 0.25 });
}
function hornMid(e: AudioEngine, o?: SoundOpts) {
  const v = e.voice({ bus: 'ambience', dur: 2.2, gain: g0(o, 0.7), pan: pan(o), priority: 3, reverb: 0.65, name: 'egg:horn-mid' });
  if (!v) return;
  for (const [f, p] of [[233, 0.22], [277, 0.16]] as const) for (const d of [-5, 5]) {
    e.tone(v, { type: 'sawtooth', freq: f, decay: 1.15, peak: p, attack: 0.08, detune: d, filter: { type: 'lowpass', freq: 800, Q: 1 } });
  }
}

// --- part b (W5-D4) -------------------------------------------------------------------------------------------------

/** A humpback's blow: a deep breathy rush with a low body under it (on the ambience bus: it carries across the water). */
function spout(e: AudioEngine, o?: SoundOpts) {
  const v = e.voice({ bus: 'ambience', dur: 2.4, gain: g0(o, 0.5), pan: pan(o), priority: 3, reverb: 0.45, name: 'egg:spout' });
  if (!v) return;
  e.noiseBurst(v, { color: 'pink', attack: 0.05, decay: 1.3, peak: 0.6, filter: { type: 'bandpass', freq: 900, freqTo: 500, glide: 1.2, Q: 0.7 } });
  e.noiseBurst(v, { color: 'brown', attack: 0.08, decay: 1.6, peak: 0.45, filter: { type: 'lowpass', freq: 260 } });
  e.tone(v, { type: 'sine', freq: 62, freqTo: 48, glide: 1.4, decay: 1.5, peak: 0.25, attack: 0.1 });
}

/** Shorebirds over a salt marsh: a few rising whistles and a soft chatter (Heron's Head). */
function marsh(e: AudioEngine, o?: SoundOpts) {
  const v = e.voice({ bus: 'ambience', dur: 3.2, gain: g0(o, 0.3), pan: pan(o), priority: 3, reverb: 0.35, name: 'egg:marsh' });
  if (!v) return;
  for (let i = 0; i < 4; i++) {
    const at = rand(0, 2.2), f = rand(1700, 2300) * pitch(o);
    e.tone(v, { type: 'sine', freq: f, freqTo: f * 1.45, glide: 0.18, decay: 0.24, peak: 0.3, offset: at, attack: 0.02 });
    e.tone(v, { type: 'sine', freq: f * 1.4, freqTo: f * 1.1, glide: 0.2, decay: 0.2, peak: 0.22, offset: at + 0.26, attack: 0.02 });
  }
  for (let i = 0; i < 7; i++) e.tone(v, { type: 'triangle', freq: rand(3000, 3800), decay: 0.05, peak: 0.12, offset: rand(0.4, 2.8), attack: 0.004 });
  e.noiseBurst(v, { color: 'pink', attack: 0.8, decay: 2.2, peak: 0.1, filter: { type: 'highpass', freq: 2500 } });
}

/** The Tiled Steps, bottom third: the sea — bubbles rising. */
function bubbles(e: AudioEngine, o?: SoundOpts) {
  const v = e.voice({ bus: 'sfx', dur: 1.8, gain: g0(o, 0.26), pan: pan(o), priority: 3, reverb: 0.3, name: 'egg:bubbles' });
  if (!v) return;
  for (let i = 0; i < 10; i++) { const f = rand(380, 900) * pitch(o); e.tone(v, { type: 'sine', freq: f, freqTo: f * 1.8, glide: 0.07, decay: 0.09, peak: 0.3, offset: i * 0.13 + rand(0, 0.05), attack: 0.004 }); }
}

/** The Tiled Steps, middle: the sky — two little birds. */
function birds(e: AudioEngine, o?: SoundOpts) {
  const v = e.voice({ bus: 'sfx', dur: 1.8, gain: g0(o, 0.22), pan: pan(o), priority: 3, reverb: 0.25, name: 'egg:birds' });
  if (!v) return;
  for (let i = 0; i < 6; i++) { const f = rand(2600, 3600) * pitch(o); e.tone(v, { type: 'sine', freq: f, freqTo: f * rand(0.8, 1.25), glide: 0.06, decay: 0.08, peak: 0.26, offset: i * 0.2 + rand(0, 0.06), attack: 0.004, vibrato: { rate: 30, depth: 0.03 } }); }
}

/** The Tiled Steps, top: the stars — a high, slow chime. */
function stars(e: AudioEngine, o?: SoundOpts) {
  const v = e.voice({ bus: 'sfx', dur: 2.6, gain: g0(o, 0.24), pan: pan(o), priority: 3, reverb: 0.6, name: 'egg:stars' });
  if (!v) return;
  [84, 88, 91, 96, 91].forEach((m, i) => e.tone(v, { type: 'sine', freq: midi(m) * pitch(o), decay: 1.1, peak: 0.2, offset: i * 0.22, attack: 0.004 }));
}

/** A small bell (the labyrinth's centre, a 1776 stop). */
function chime(e: AudioEngine, o?: SoundOpts) {
  const v = e.voice({ bus: 'sfx', dur: 2.2, gain: g0(o, 0.24), pan: pan(o), priority: 3, reverb: 0.5, name: 'egg:chime' });
  if (!v) return;
  for (const [m, at] of [[79, 0], [86, 0.18]] as const) {
    e.tone(v, { type: 'sine', freq: midi(m) * pitch(o), decay: 1.4, peak: 0.28, offset: at, attack: 0.003 });
    e.tone(v, { type: 'sine', freq: midi(m) * 2.76 * pitch(o), decay: 0.5, peak: 0.06, offset: at, attack: 0.003 });
  }
}

/** A knuckle on the golden hydrant: a bright metal ting. */
function ting(e: AudioEngine, o?: SoundOpts) {
  const v = e.voice({ bus: 'sfx', dur: 1.4, gain: g0(o, 0.22), pan: pan(o), priority: 2, reverb: 0.3, name: 'egg:ting' });
  if (!v) return;
  for (const [f, p] of [[1760, 0.3], [2640, 0.12], [4130, 0.06]] as const) e.tone(v, { type: 'sine', freq: f * pitch(o), decay: 0.9, peak: p, attack: 0.002 });
}

/** A paintbrush stroke. */
function brush(e: AudioEngine, o?: SoundOpts) {
  const v = e.voice({ bus: 'sfx', dur: 0.9, gain: g0(o, 0.22), pan: pan(o), priority: 2, name: 'egg:brush' });
  if (!v) return;
  e.noiseBurst(v, { color: 'pink', attack: 0.06, decay: 0.35, peak: 0.4, filter: { type: 'bandpass', freq: 2200, freqTo: 3200, glide: 0.3, Q: 1.2 } });
  e.noiseBurst(v, { color: 'pink', attack: 0.05, decay: 0.3, peak: 0.3, offset: 0.4, filter: { type: 'bandpass', freq: 3000, freqTo: 2000, glide: 0.3, Q: 1.2 } });
}

/** BAYBAY yawning (the sundial at night). */
function yawn(e: AudioEngine, o?: SoundOpts) {
  const v = e.voice({ bus: 'voice', dur: 1.8, gain: g0(o, 0.2), pan: pan(o), priority: 3, reverb: 0.15, name: 'egg:yawn' });
  if (!v) return;
  const b = 620 * pitch(o);
  e.tone(v, { type: 'sine', freq: b, freqTo: b * 1.5, glide: 0.5, decay: 0.7, peak: 0.35, attack: 0.15, fm: { ratio: 2, index: 0.15 } });
  e.tone(v, { type: 'sine', freq: b * 1.45, freqTo: b * 0.8, glide: 0.7, decay: 0.8, peak: 0.3, offset: 0.6, attack: 0.05 });
  e.noiseBurst(v, { color: 'pink', attack: 0.2, decay: 0.8, peak: 0.08, offset: 0.2, filter: { type: 'bandpass', freq: 1400, Q: 0.8 } });
}

/** A toy car / bike stopping politely: a small squeak and a tick. */
function squeak(e: AudioEngine, o?: SoundOpts) {
  const v = e.voice({ bus: 'sfx', dur: 0.8, gain: g0(o, 0.2), pan: pan(o), priority: 2, name: 'egg:squeak' });
  if (!v) return;
  e.tone(v, { type: 'triangle', freq: 1250, freqTo: 900, glide: 0.25, decay: 0.3, peak: 0.3, attack: 0.01, vibrato: { rate: 26, depth: 0.03 } });
  e.noiseBurst(v, { attack: 0.001, decay: 0.03, peak: 0.3, offset: 0.34, filter: { type: 'bandpass', freq: 2600, Q: 2 } });
}

/** Old sails in the wind: a soft gust and a wooden creak (China Beach). */
function sails(e: AudioEngine, o?: SoundOpts) {
  const v = e.voice({ bus: 'ambience', dur: 3, gain: g0(o, 0.26), pan: pan(o), priority: 3, reverb: 0.5, name: 'egg:sails' });
  if (!v) return;
  e.noiseBurst(v, { color: 'pink', attack: 0.6, decay: 1.8, peak: 0.4, filter: { type: 'bandpass', freq: 600, freqTo: 1100, glide: 1.2, Q: 0.6 } });
  for (const at of [0.7, 1.5]) e.tone(v, { type: 'sawtooth', freq: 190, freqTo: 150, glide: 0.4, decay: 0.45, peak: 0.1, offset: at, attack: 0.08, filter: { type: 'bandpass', freq: 700, Q: 3 } });
}

export const EGG_SOUNDS = {
  'egg:find': find, 'egg:parrots': parrots, 'egg:sealions': seaLions, 'egg:cackle': cackle, 'egg:giggle': giggle, 'egg:phone': phone,
  'egg:plug': plug, 'egg:cookie': cookie, 'egg:fanfare': fanfare, 'egg:organ': organ, 'egg:propeller': propeller, 'egg:splash': splash,
  'egg:tin': tin, 'egg:whoosh': whoosh, 'egg:horn-south': hornSouth, 'egg:horn-mid': hornMid,
  'egg:spout': spout, 'egg:marsh': marsh, 'egg:bubbles': bubbles, 'egg:birds': birds, 'egg:stars': stars, 'egg:chime': chime,
  'egg:ting': ting, 'egg:brush': brush, 'egg:yawn': yawn, 'egg:squeak': squeak, 'egg:sails': sails,
} as const satisfies Record<string, (e: AudioEngine, o?: SoundOpts) => void>;
export type EggSound = keyof typeof EGG_SOUNDS;

/** Register every egg sound; returns the unregister. */
export function registerEggSounds(): () => void {
  const offs = Object.entries(EGG_SOUNDS).map(([id, recipe]) => registerSound(id, recipe));
  return () => { for (const off of offs) off(); };
}
