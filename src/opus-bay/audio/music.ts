/**
 * Gentle generative background music: Karplus–Strong plucks (rendered once per pitch into small
 * buffers and replayed), a soft three-voice pad with voice leading, a bass pluck and the odd
 * glockenspiel sparkle. Pentatonic, 72–84 bpm, mood follows time of day and game mode.
 */
import type { AudioEngine } from './engine';
import {
  chordPitchClasses, clamp, makeMotif, midiToFreq, mulberry32, musicMoodFor, progressionFor, rand, renderPluck,
  scaleMidi, varyMotif, voiceLead, type Chord, type ModeName, type MusicMood, type TimeOfDayName,
} from './logic';

const PLUCK_RATE = 22050;
const LOOKAHEAD = 0.45;

interface PadVoice { oscs: OscillatorNode[]; gain: GainNode }

export class Music {
  private readonly e: AudioEngine;
  private readonly out: GainNode;
  private readonly padBus: GainNode;
  private readonly padFilter: BiquadFilterNode;
  private pad: PadVoice[] = [];
  private padNotes: number[] | null = null;
  private readonly plucks = new Map<string, { buffer: AudioBuffer; baseFreq: number }>();
  private readonly rng = mulberry32((Date.now() & 0xffff) ^ 0x5eed);
  private mood: MusicMood;
  private pending: MusicMood | null = null;
  private enabled = false;
  private nextStep = 0;
  private step = 0;
  private bar = 0;
  private variant = 0;
  private progression: Chord[];
  private motif: (number | null)[];
  private motifB: (number | null)[];
  private chord: Chord;

  constructor(e: AudioEngine, time: TimeOfDayName, mode: ModeName) {
    this.e = e;
    const ctx = e.ctx;
    this.out = ctx.createGain();
    this.out.gain.value = 1;
    const highpass = ctx.createBiquadFilter();
    highpass.type = 'highpass'; highpass.frequency.value = 55; highpass.Q.value = 0.6;
    this.out.connect(highpass).connect(e.buses.music.input);
    this.padFilter = ctx.createBiquadFilter();
    this.padFilter.type = 'lowpass';
    this.padFilter.frequency.value = 1100;
    this.padFilter.Q.value = 0.5;
    this.padBus = ctx.createGain();
    this.padBus.gain.value = 0;
    this.padFilter.connect(this.padBus).connect(this.out);
    // a little of the pad goes to the reverb
    const padSend = ctx.createGain();
    padSend.gain.value = 0.35;
    this.padBus.connect(padSend).connect(e.buses.music.send);
    this.mood = musicMoodFor(time, mode);
    this.progression = progressionFor(this.mood.minor, 0);
    this.chord = this.progression[0];
    this.motif = makeMotif(this.rng, this.mood.density);
    this.motifB = makeMotif(this.rng, this.mood.density);
  }

  setMood(time: TimeOfDayName, mode: ModeName) {
    const next = musicMoodFor(time, mode);
    const cur = this.pending ?? this.mood;
    if (next.rootMidi === cur.rootMidi && next.bpm === cur.bpm && next.brightness === cur.brightness && next.lift === cur.lift) return;
    this.pending = next;
  }

  setEnabled(on: boolean) {
    if (on === this.enabled) return;
    this.enabled = on;
    this.e.log(on ? 'music:on' : 'music:off', on ? { bpm: this.mood.bpm, root: this.mood.rootMidi, minor: this.mood.minor } : undefined);
    const t = this.e.now;
    if (on) {
      this.ensurePad();
      this.nextStep = t + 0.2;
      this.step = 0;
      this.bar = 0;
      this.padBus.gain.cancelScheduledValues(t);
      this.padBus.gain.setTargetAtTime(0.065 * this.mood.padLevel, t, 2.5);
    } else {
      this.padBus.gain.cancelScheduledValues(t);
      this.padBus.gain.setTargetAtTime(0, t, 0.4);
      const pad = this.pad;
      this.pad = [];
      this.padNotes = null;
      window.setTimeout(() => { for (const v of pad) for (const o of v.oscs) { try { o.stop(); } catch { /* ignore */ } } }, 2500);
    }
  }

  private ensurePad() {
    if (this.pad.length) return;
    const ctx = this.e.ctx;
    for (let i = 0; i < 3; i++) {
      const gain = ctx.createGain();
      gain.gain.value = 0.33;
      gain.connect(this.padFilter);
      const oscs: OscillatorNode[] = [];
      for (const detune of [-6, 6]) {
        const o = ctx.createOscillator();
        o.setPeriodicWave(this.e.waves.warm);
        o.detune.value = detune + (i - 1) * 2;
        o.frequency.value = 220;
        o.connect(gain);
        o.start();
        oscs.push(o);
      }
      this.pad.push({ oscs, gain });
    }
  }

  private pluck(midi: number, brightness: number) {
    const b = Math.round(clamp(brightness) * 4);
    // one rendered buffer per 3 semitones; replay with playbackRate for the rest
    const anchor = Math.round(midi / 3) * 3;
    const key = `${anchor}:${b}`;
    let entry = this.plucks.get(key);
    if (!entry) {
      const f = midiToFreq(anchor);
      const seconds = clamp(2.6 - (anchor - 40) * 0.035, 0.8, 2.6);
      const r = renderPluck(f, PLUCK_RATE, seconds, 0.2 + b * 0.18, 0.9965 + (anchor < 50 ? 0.002 : 0), mulberry32(anchor * 31 + b));
      const buffer = this.e.ctx.createBuffer(1, r.data.length, PLUCK_RATE);
      buffer.getChannelData(0).set(r.data);
      entry = { buffer, baseFreq: r.baseFreq };
      this.plucks.set(key, entry);
    }
    return { buffer: entry.buffer, rate: midiToFreq(midi) / entry.baseFreq };
  }

  private playPluck(midi: number, at: number, gain: number, pan: number, brightness: number) {
    const p = this.pluck(midi, brightness);
    const v = this.e.voice({ bus: 'music', at, dur: p.buffer.duration / p.rate, gain, pan, reverb: 0.3, priority: 1 });
    if (!v) return;
    this.e.buffer(v, p.buffer, { rate: p.rate, filter: { type: 'lowpass', freq: 1800 + brightness * 4200, Q: 0.5 } });
  }

  private sparkle(midi: number, at: number) {
    const v = this.e.voice({ bus: 'music', at, dur: 1.4, gain: 0.07, pan: rand(this.rng, -0.5, 0.5), reverb: 0.6, priority: 1 });
    if (!v) return;
    const f = midiToFreq(midi);
    this.e.tone(v, { type: 'sine', freq: f, decay: 1.2, peak: 0.5, attack: 0.002 });
    this.e.tone(v, { type: 'sine', freq: f * 3.99, decay: 0.3, peak: 0.12, attack: 0.002 });
  }

  private applyChord(at: number) {
    const pcs = chordPitchClasses(this.mood.rootMidi, this.chord).slice(0, 3);
    const first = this.padNotes === null;
    const notes = voiceLead(this.padNotes, pcs, 52, 67);
    this.padNotes = notes;
    this.pad.forEach((v, i) => {
      const m = notes[i] ?? notes[notes.length - 1];
      if (m === undefined) return;
      for (const o of v.oscs) {
        if (first) o.frequency.setValueAtTime(midiToFreq(m), at);
        else o.frequency.setTargetAtTime(midiToFreq(m), at, 0.3);
      }
    });
    // breathing swell across the chord
    const level = 0.065 * this.mood.padLevel;
    this.padBus.gain.setTargetAtTime(level, at, 0.8);
    this.padBus.gain.setTargetAtTime(level * 0.7, at + this.stepDur() * 10, 1.2);
    this.padFilter.frequency.setTargetAtTime(700 + this.mood.brightness * 900, at, 1.5);
  }

  private stepDur() { return 60 / this.mood.bpm / 2; }

  private scheduleStep(at: number): void {
    const m = this.mood;
    const inBar = this.step % 8;
    const phraseBar = this.bar % 8;
    if (inBar === 0) {
      // mood changes land on a 4-bar boundary; a key change restarts the 8-bar cycle
      if (this.pending && (phraseBar === 0 || phraseBar === 4)) {
        const keyChange = this.pending.rootMidi !== this.mood.rootMidi || this.pending.minor !== this.mood.minor;
        this.mood = this.pending;
        this.pending = null;
        this.e.log('music:mood', { bpm: this.mood.bpm, root: this.mood.rootMidi, minor: this.mood.minor });
        if (keyChange && phraseBar === 4) { this.bar -= 4; this.scheduleStep(at); return; }
      }
      if (phraseBar === 0) {
        this.variant++;
        if (this.variant % 2 === 0) this.progression = progressionFor(this.mood.minor, Math.floor(this.rng() * 4));
        if (this.variant % 3 === 0) { this.motif = makeMotif(this.rng, m.density); this.motifB = makeMotif(this.rng, m.density); }
      }
      if (this.bar % 2 === 0) {
        this.chord = this.progression[Math.floor(phraseBar / 2) % this.progression.length];
        this.applyChord(at);
      }
      // bass: chord root on beat one
      const root = this.mood.rootMidi + this.chord.offset;
      const bass = root - 24 + (root - 24 < 36 ? 12 : 0);
      this.playPluck(bass, at, 0.3, 0, 0.15);
    } else if (inBar === 4 && this.rng() < 0.45) {
      const root = this.mood.rootMidi + this.chord.offset;
      const bass = root - 24 + (root - 24 < 36 ? 12 : 0) + 7;
      this.playPluck(bass, at, 0.2, 0, 0.12);
    }

    // melody: A A' B A' over 8 bars; every third cycle rests more to breathe
    const phrase = Math.floor(phraseBar / 2);
    const slot = (this.bar % 2) * 8 + inBar;
    const base = phrase === 2 ? this.motifB : phrase === 0 ? this.motif : varyMotif(this.motif, mulberry32(this.variant * 7 + phrase));
    const deg = base[slot];
    const resting = this.variant % 3 === 0;
    if (deg !== null && deg !== undefined && (!resting || this.rng() < 0.35)) {
      const midi = scaleMidi(this.mood.rootMidi + 12 + m.lift, m.minor, deg);
      const accent = inBar === 0 || inBar === 4 ? 1 : 0.8;
      this.playPluck(midi, at, 0.3 * accent * rand(this.rng, 0.85, 1), 0.18, m.brightness);
    }
    if (inBar === 0 && this.bar % 2 === 1 && this.rng() < m.sparkle) {
      this.sparkle(scaleMidi(this.mood.rootMidi + 36, m.minor, Math.floor(this.rng() * 5)), at + this.stepDur() * 2);
    }
  }

  tick() {
    if (!this.enabled) return;
    const now = this.e.now;
    if (this.nextStep < now - 0.05) this.nextStep = now + 0.05; // skip what we missed (tab jank)
    while (this.nextStep < now + LOOKAHEAD) {
      const swing = this.step % 2 === 1 ? this.mood.swing * this.stepDur() : 0;
      this.scheduleStep(this.nextStep + swing);
      this.nextStep += this.stepDur();
      this.step++;
      if (this.step % 8 === 0) this.bar++;
    }
  }

  dispose() {
    this.setEnabled(false);
    try { this.out.disconnect(); } catch { /* ignore */ }
  }
}
