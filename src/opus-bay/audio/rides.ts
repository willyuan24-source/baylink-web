/**
 * Ride sounds (movement lane): one-shots for the new movement events (bike bell, toy horn, glide whoosh, seat pops,
 * the crest pant) and two continuous layers updated from the audio tick — wind while gliding (louder with speed,
 * breathier up high) and the toy car's little electric motor (pitch follows speed). Synthesized like sfx.ts.
 */
import type { AudioEngine } from './engine';
import { clamp, rand } from './logic';

const R = Math.random;
const vary = (amount: number) => 1 + (R() * 2 - 1) * amount;

/** "Ring-ring": a thumb bell, two bright strikes. */
export function bikeBell(e: AudioEngine) {
  const v = e.voice({ bus: 'sfx', dur: 1.1, gain: 0.3, priority: 3, reverb: 0.12, name: 'bike-bell' });
  if (!v) return;
  for (const offset of [0, 0.13]) {
    for (const [ratio, g, d] of [[1, 0.45, 0.5], [2.76, 0.22, 0.3], [5.4, 0.1, 0.16]] as const) {
      e.tone(v, { type: 'sine', freq: 2150 * ratio * vary(0.004), decay: d, peak: g, offset, attack: 0.001 });
    }
    e.noiseBurst(v, { attack: 0.0005, decay: 0.01, peak: 0.2, offset, filter: { type: 'highpass', freq: 4000 } });
  }
}

/** "Meep-meep": a squeezy toy horn. */
export function toyHorn(e: AudioEngine) {
  const v = e.voice({ bus: 'sfx', dur: 0.8, gain: 0.26, priority: 3, reverb: 0.1, name: 'toy-horn' });
  if (!v) return;
  const p = vary(0.03);
  for (const [offset, f] of [[0, 520], [0.2, 580]] as const) {
    e.tone(v, { type: 'square', freq: f * p, freqTo: f * p * 0.97, glide: 0.12, decay: 0.16, peak: 0.28, offset, attack: 0.012, filter: { type: 'bandpass', freq: 1300, Q: 1.4 } });
    e.tone(v, { type: 'triangle', freq: f * 2 * p, decay: 0.12, peak: 0.08, offset, attack: 0.01 });
  }
}

/** Getting in / out: a soft seat "boing" (up = in). */
export function seatPop(e: AudioEngine, up: boolean) {
  const v = e.voice({ bus: 'sfx', dur: 0.4, gain: 0.22, priority: 2, name: 'seat-pop' });
  if (!v) return;
  const a = up ? 330 : 520, b = up ? 520 : 300;
  e.tone(v, { type: 'sine', freq: a, freqTo: b, glide: 0.09, decay: 0.16, peak: 0.5, vibrato: { rate: 16, depth: 0.02 } });
  e.noiseBurst(v, { color: 'pink', attack: 0.004, decay: 0.05, peak: 0.12, filter: { type: 'lowpass', freq: 900 } });
}

/** The pelican scoops you up: a rising air whoosh and two wing beats. */
export function glideWhoosh(e: AudioEngine) {
  const v = e.voice({ bus: 'sfx', dur: 1.6, gain: 0.34, priority: 3, reverb: 0.2, name: 'glide-whoosh' });
  if (!v) return;
  e.noiseBurst(v, { color: 'pink', attack: 0.25, decay: 0.9, peak: 0.6, filter: { type: 'bandpass', freq: 400, freqTo: 1600, glide: 0.8, Q: 0.8 } });
  for (const offset of [0.05, 0.42]) e.noiseBurst(v, { color: 'brown', attack: 0.03, decay: 0.16, peak: 0.5, offset, filter: { type: 'lowpass', freq: 520 } });
}

/** A short out-of-breath "haa-haa" after a long uphill run. */
export function pant(e: AudioEngine) {
  const v = e.voice({ bus: 'sfx', dur: 1.9, gain: 0.16, priority: 1, name: 'pant' });
  if (!v) return;
  for (let i = 0; i < 4; i++) {
    const offset = i * 0.42 + rand(R, 0, 0.04);
    e.noiseBurst(v, { color: 'pink', attack: 0.05, decay: 0.2, peak: 0.45, offset, filter: { type: 'bandpass', freq: i % 2 ? 1250 : 950, Q: 2.2 } });
  }
}

/** A bench / step creak when sitting down. */
export function sitCreak(e: AudioEngine) {
  const v = e.voice({ bus: 'sfx', dur: 0.35, gain: 0.16, priority: 1, name: 'sit' });
  if (!v) return;
  e.tone(v, { type: 'sawtooth', freq: 190, freqTo: 150, glide: 0.2, decay: 0.2, peak: 0.12, attack: 0.02, filter: { type: 'bandpass', freq: 700, Q: 4 } });
  e.noiseBurst(v, { color: 'brown', attack: 0.004, decay: 0.08, peak: 0.3, filter: { type: 'lowpass', freq: 500 } });
}

/**
 * Continuous layers: wind while gliding, the toy car's motor while driving. update() is called from the audio tick
 * (every 100 ms) with the current state; gains glide with setTargetAtTime (no clicks), nodes are built lazily.
 */
export class RideLoops {
  private readonly e: AudioEngine;
  private wind: { src: AudioBufferSourceNode; filter: BiquadFilterNode; gain: GainNode } | null = null;
  private motor: { osc: OscillatorNode; sub: OscillatorNode; filter: BiquadFilterNode; gain: GainNode } | null = null;

  constructor(e: AudioEngine) { this.e = e; }

  update(state: { gliding: boolean; glideSpeed: number; glideHeight: number; driving: boolean; carSpeed: number }) {
    const ctx = this.e.ctx, t = ctx.currentTime;
    // wind
    const windOn = state.gliding;
    if (windOn && !this.wind) {
      const src = this.e.loopNoise('pink', 1);
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass'; filter.Q.value = 0.7; filter.frequency.value = 500;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      src.connect(filter).connect(gain).connect(this.e.buses.ambience.input);
      this.wind = { src, filter, gain };
    }
    if (this.wind) {
      const k = clamp((state.glideSpeed - 8) / 12, 0, 1);
      this.wind.gain.gain.setTargetAtTime(windOn ? 0.25 + 0.45 * k : 0, t, windOn ? 0.4 : 0.6);
      this.wind.filter.frequency.setTargetAtTime(380 + 900 * k + Math.min(400, state.glideHeight * 4), t, 0.5);
    }
    // toy motor
    const motorOn = state.driving;
    if (motorOn && !this.motor) {
      const osc = ctx.createOscillator(), sub = ctx.createOscillator();
      osc.type = 'sawtooth'; sub.type = 'square';
      osc.frequency.value = 70; sub.frequency.value = 35;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass'; filter.frequency.value = 600; filter.Q.value = 2;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      osc.connect(filter); sub.connect(filter);
      filter.connect(gain).connect(this.e.buses.sfx.input);
      osc.start(); sub.start();
      this.motor = { osc, sub, filter, gain };
    }
    if (this.motor) {
      const k = clamp(Math.abs(state.carSpeed) / 14, 0, 1.3);
      this.motor.gain.gain.setTargetAtTime(motorOn ? 0.035 + 0.06 * k : 0, t, 0.2);
      this.motor.osc.frequency.setTargetAtTime(70 + 170 * k, t, 0.15);
      this.motor.sub.frequency.setTargetAtTime(35 + 85 * k, t, 0.15);
      this.motor.filter.frequency.setTargetAtTime(500 + 1100 * k, t, 0.2);
    }
  }

  dispose() {
    try { this.wind?.src.stop(); this.wind?.gain.disconnect(); } catch { /* ignore */ }
    try { this.motor?.osc.stop(); this.motor?.sub.stop(); this.motor?.gain.disconnect(); } catch { /* ignore */ }
    this.wind = null; this.motor = null;
  }
}
