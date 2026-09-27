import type { AudioEngine } from './engine';
import { clamp, midiToFreq, mulberry32, rand, renderPluck } from './logic';

/**
 * A Mission street-music hint (lane F10): somewhere on 24th Street, in Clarion Alley or up in Dolores Park a busker's
 * nylon-string guitar plays a lilting 3/4 ranchera strum — bass on one, a chord on two and three, I · I · V · V ·
 * V · V · I · I (then IV for a turn now and then) in G, 104 bpm. It is heard within 40 u of a spot, panned from it,
 * quieter at night, and the background music makes a little room while it plays. Karplus–Strong plucks like the
 * music's (audio/logic renderPluck), rendered once per pitch; ambience bus (it is part of the street, not the score).
 */

/** Where the buskers play (world x, z: places.json 'mission-24th-valencia', Clarion Alley, Dolores Park, 24th & York). */
export const BUSKER_SPOTS: readonly { id: string; x: number; z: number }[] = [
  { id: 'valencia-24th', x: 347, z: 588 },
  { id: 'clarion-alley', x: 261.4, z: 606 },
  { id: 'dolores-park', x: 242, z: 698 },
  { id: '24th-york', x: 475, z: 605.7 },
];

const RATE = 22050;
const BPM = 104;
const LOOKAHEAD = 0.4;
/** G major: chord roots (midi) and triads */
const CHORDS: Record<'I' | 'IV' | 'V', { bass: number; alt: number; tones: number[] }> = {
  I: { bass: 43, alt: 50, tones: [55, 59, 62, 67] },
  IV: { bass: 48, alt: 55, tones: [55, 60, 64, 67] },
  V: { bass: 50, alt: 45, tones: [54, 57, 62, 66] },
};
const FORM: ('I' | 'IV' | 'V')[] = ['I', 'I', 'V', 'V', 'V', 'V', 'I', 'I'];
const TURN: ('I' | 'IV' | 'V')[] = ['IV', 'IV', 'I', 'I', 'V', 'V', 'I', 'I'];

export class StreetMusic {
  private readonly e: AudioEngine;
  private readonly plucks = new Map<number, { buffer: AudioBuffer; baseFreq: number }>();
  private readonly rng = mulberry32(0x6a17a2);
  private level = 0;
  private panValue = 0;
  private next = 0;
  private beat = 0;
  private bar = 0;
  private form = FORM;

  constructor(e: AudioEngine) {
    this.e = e;
  }

  /** Called at 10 Hz: how loud (0 = nobody near a busker) and where from; schedules the next notes. */
  update(level: number, pan: number) {
    const now = this.e.now;
    const was = this.level;
    this.level = level;
    this.panValue = clamp(pan, -0.8, 0.8);
    if (level < 0.01) return;
    if (was < 0.01 || this.next < now - 0.05) { this.next = now + 0.1; this.beat = 0; }
    // the score makes a little room while a busker plays close by
    if (level > 0.2) this.e.buses.music.duck(1 - 0.45 * level, now + 0.5);
    const beatDur = 60 / BPM;
    while (this.next < now + LOOKAHEAD) {
      this.play(this.next);
      this.next += beatDur * (this.beat % 3 === 0 ? 1.04 : 0.98); // a little lilt on the one
      this.beat++;
      if (this.beat % 3 === 0) {
        this.bar++;
        if (this.bar % 8 === 0) this.form = this.rng() < 0.35 ? TURN : FORM;
      }
    }
  }

  private play(at: number) {
    const chord = CHORDS[this.form[this.bar % 8]];
    const inBar = this.beat % 3;
    if (inBar === 0) {
      // bass: root, the fifth below on even bars
      this.pluck(this.bar % 2 ? chord.alt : chord.bass, at, 0.55, 0.25);
      return;
    }
    // strum: down on two, up on three (a few ms between strings), sometimes a skipped upstroke
    if (inBar === 2 && this.rng() < 0.15) return;
    const tones = inBar === 1 ? chord.tones : [...chord.tones].reverse();
    tones.forEach((m, i) => this.pluck(m, at + i * rand(this.rng, 0.012, 0.02), inBar === 1 ? 0.3 : 0.22, 0.55));
  }

  private pluck(midi: number, at: number, gain: number, brightness: number) {
    let p = this.plucks.get(midi);
    if (!p) {
      const r = renderPluck(midiToFreq(midi), RATE, 1.6, brightness, 0.996, mulberry32(midi * 13));
      const buffer = this.e.ctx.createBuffer(1, r.data.length, RATE);
      buffer.getChannelData(0).set(r.data);
      p = { buffer, baseFreq: r.baseFreq };
      this.plucks.set(midi, p);
    }
    const rate = midiToFreq(midi) / p.baseFreq;
    // level and pan are taken per note (they change slowly: the listener walking by)
    const v = this.e.voice({ bus: 'ambience', at, dur: p.buffer.duration / rate, gain: gain * this.level * 0.55, pan: this.panValue, priority: 0, reverb: 0.22, name: 'busker' });
    if (!v) return;
    this.e.buffer(v, p.buffer, { rate, filter: { type: 'lowpass', freq: 2600, Q: 0.4 } });
  }
}
