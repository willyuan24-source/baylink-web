import type { AudioEngine } from '../audio/engine';
import type { SoundOpts } from '../audio/hooks';
import { addSf8Sound } from './sfgames8Sounds';

/**
 * Wave 8 · lane M · the busker jam's sounds, synthesized (one chunk with play/busk.ts; registered through
 * sfgames8Sounds' addSf8Sound before the jam's first ensureSf8Sounds):
 *
 *   m8-busk-beat   one beat of the busker's song, scheduled ahead on the audio clock (busk.ts sets `nextBeat` first):
 *                  Haight St — a steel-string strum (down, down-up, up, down-up) over a stomp box on 1 and 3;
 *                  24th St — a cumbia: the bass on 1 and 3 (root, fifth), the nylon guitar's chop on the off-beats
 *   m8-tambourine  the player's tambourine on Haight St (jingles and a skin tap)
 *   m8-maracas     the player's maracas on 24th St (two quick shakes of seeds)
 *   m8-clink       a coin dropped into the open guitar case
 *
 * Chords are named on the song (busk.ts SONGS) and voiced here; no melody of any real song is used.
 */

const hz = (semi: number) => 440 * 2 ** (semi / 12);

/** strum voicings (semitones from A4) and the bass note of each chord */
export const CHORDS: Readonly<Record<string, { strum: readonly number[]; bass: number; fifth: number }>> = {
  G: { strum: [-14, -10, -7, -2, 2], bass: -26, fifth: -19 },
  C: { strum: [-21, -17, -14, -9, -5], bass: -33, fifth: -26 },
  D: { strum: [-19, -12, -7, -3, 0], bass: -31, fifth: -24 },
  Am: { strum: [-12, -9, -5, 0, 3], bass: -24, fifth: -17 },
  Dm: { strum: [-19, -12, -7, -4, 0], bass: -31, fifth: -24 },
  E: { strum: [-17, -13, -10, -5, -1], bass: -29, fifth: -22 },
};

/** What the next m8-busk-beat plays (busk.ts sets it right before playSound: the recipe runs synchronously). */
export const nextBeat = { at: 0, style: 'haight' as 'haight' | 'mission', chord: 'G', beat: 0, len: 0.5, level: 1 };

type V = NonNullable<ReturnType<AudioEngine['voice']>>;

function strum(e: AudioEngine, v: V, offset: number, chord: string, up: boolean, decay: number, level: number, nylon = false) {
  const c = CHORDS[chord] ?? CHORDS.G;
  const notes = up ? [...c.strum].reverse().slice(0, 4) : c.strum;
  notes.forEach((s, i) => {
    e.tone(v, { type: nylon ? 'sine' : 'triangle', freq: hz(s), decay, peak: (0.16 - i * 0.012) * level, attack: 0.002, offset: offset + i * (up ? 0.008 : 0.013), detune: (i % 2 ? 4 : -3) });
    if (!nylon) e.tone(v, { type: 'sine', freq: hz(s + 12), decay: decay * 0.5, peak: 0.04 * level, attack: 0.001, offset: offset + i * 0.013 });
  });
  e.noiseBurst(v, { attack: 0.001, decay: 0.03, peak: 0.12 * level, offset, filter: { type: 'highpass', freq: 3500 } });
}

function beatHaight(e: AudioEngine, v: V, b: typeof nextBeat) {
  const L = b.len, k = b.beat % 4;
  // the strum pattern of a bar: D · D U · U · D U (beats 0, 1, 1.5, 2.5, 3, 3.5)
  if (k === 0) strum(e, v, 0, b.chord, false, 0.9, b.level);
  if (k === 1) { strum(e, v, 0, b.chord, false, 0.5, 0.8 * b.level); strum(e, v, L / 2, b.chord, true, 0.4, 0.6 * b.level); }
  if (k === 2) strum(e, v, L / 2, b.chord, true, 0.4, 0.6 * b.level);
  if (k === 3) { strum(e, v, 0, b.chord, false, 0.5, 0.85 * b.level); strum(e, v, L / 2, b.chord, true, 0.4, 0.6 * b.level); }
  // the stomp box on 1 and 3
  if (k === 0 || k === 2) {
    e.tone(v, { type: 'sine', freq: 85, freqTo: 48, glide: 0.12, decay: 0.22, peak: 0.55 * b.level, attack: 0.002 });
    e.noiseBurst(v, { color: 'brown', attack: 0.001, decay: 0.05, peak: 0.25 * b.level, filter: { type: 'lowpass', freq: 400 } });
  }
}

function beatMission(e: AudioEngine, v: V, b: typeof nextBeat) {
  const L = b.len, k = b.beat % 4, c = CHORDS[b.chord] ?? CHORDS.Am;
  // the bass: root on 1, fifth on 3 (a little pickup before 1)
  if (k === 0 || k === 2) e.tone(v, { type: 'triangle', freq: hz(k === 0 ? c.bass : c.fifth), decay: L * 0.9, peak: 0.5 * b.level, attack: 0.006 });
  if (k === 3) e.tone(v, { type: 'triangle', freq: hz(c.fifth), decay: L * 0.4, peak: 0.3 * b.level, attack: 0.006, offset: L / 2 });
  // the guitar's chop on the off-beat
  strum(e, v, L / 2, b.chord, false, 0.14, 0.9 * b.level, true);
  // a soft güiro scrape on 2 and 4
  if (k === 1 || k === 3) e.noiseBurst(v, { attack: 0.03, decay: 0.09, peak: 0.12 * b.level, filter: { type: 'bandpass', freq: 3200, Q: 3 }, rate: 0.8 });
}

function beat(e: AudioEngine, o?: SoundOpts) {
  const b = nextBeat;
  const v = e.voice({ bus: 'sfx', at: b.at, dur: b.len + 1, gain: 0.32 * (o?.gain ?? 1), priority: 3, reverb: 0.18, name: 'm8:busk-beat' });
  if (!v) return;
  if (b.style === 'mission') beatMission(e, v, b); else beatHaight(e, v, b);
}

function tambourine(e: AudioEngine, o?: SoundOpts) {
  const v = e.voice({ bus: 'sfx', dur: 0.4, gain: 0.3 * (o?.gain ?? 1), priority: 3, reverb: 0.1, name: 'm8:tambourine' });
  if (!v) return;
  for (const [f, d] of [[7200, 0.18], [9300, 0.14], [5600, 0.2]] as const) e.noiseBurst(v, { attack: 0.001, decay: d, peak: 0.35, filter: { type: 'bandpass', freq: f * (o?.pitch ?? 1), Q: 6 } });
  e.tone(v, { type: 'sine', freq: 190, freqTo: 120, glide: 0.05, decay: 0.07, peak: 0.25, attack: 0.001 });
}

function maracas(e: AudioEngine, o?: SoundOpts) {
  const v = e.voice({ bus: 'sfx', dur: 0.3, gain: 0.3 * (o?.gain ?? 1), priority: 3, reverb: 0.08, name: 'm8:maracas' });
  if (!v) return;
  for (const t of [0, 0.045]) e.noiseBurst(v, { attack: 0.004, decay: 0.05, peak: 0.45, offset: t, filter: { type: 'bandpass', freq: 5200 * (o?.pitch ?? 1), Q: 1.4 } });
}

function clink(e: AudioEngine, o?: SoundOpts) {
  const v = e.voice({ bus: 'sfx', dur: 0.5, gain: 0.18 * (o?.gain ?? 1), priority: 1, name: 'm8:clink' });
  if (!v) return;
  const p = o?.pitch ?? 1;
  e.tone(v, { type: 'sine', freq: 2900 * p, decay: 0.25, peak: 0.3, attack: 0.001 });
  e.tone(v, { type: 'sine', freq: 4400 * p, decay: 0.12, peak: 0.15, attack: 0.001, offset: 0.06 });
}

/** busk.ts calls it once before its first ensureSf8Sounds() */
export function addBuskSounds() {
  addSf8Sound('m8-busk-beat', beat);
  addSf8Sound('m8-tambourine', tambourine);
  addSf8Sound('m8-maracas', maracas);
  addSf8Sound('m8-clink', clink);
}
