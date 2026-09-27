/**
 * Wave 4 · lane T (plan §3.6): the sounds of the sightseeing bus and the Muni Metro, synthesized like sfx.ts / rides.ts
 * (no samples; generated SFX only if these sound cheap on the owner's listening pass, lane V, ≤ 5 credits):
 *
 *   one-shots   busAirBrake (the hiss as the bus stops), doorChime (two-note chime, bus + LRV doors), stopBell (the
 *               "ding" of a stop request / 下一站下车), lrvGong (the LRV's double gong on H and for someone on the track),
 *               stationChime (at a Market St kiosk as the train comes in), portalWhoosh (the train diving into / out
 *               of a tunnel mouth);
 *   LineLoops   continuous layers from the audio tick (every 100 ms): the bus's diesel hum (pitch and grit follow the
 *               speed), the LRV motor whine (rises with speed), the low tunnel rumble under the subway overlay.
 *
 * Integration (audio/audio.ts, lane T owns it then): `transit` events with kind 'bus' / 'light-rail' → arrive:
 * busAirBrake (+ doorChime after 0.5 s) / doorChime; depart: doorChime; bell: stopBell (bus) / lrvGong (light rail);
 * horn: the existing toyHorn at a lower pitch; the subway overlay's on / off → LineLoops.update({ tunnel }).
 */
import type { AudioEngine } from './engine';
import { clamp } from './logic';

const R = Math.random;
const vary = (amount: number) => 1 + (R() * 2 - 1) * amount;

/** The air brake: a short pink-noise hiss falling in pitch, a soft thunk under it. */
export function busAirBrake(e: AudioEngine, strength = 1) {
  const v = e.voice({ bus: 'sfx', dur: 1.2, gain: 0.26 * strength, priority: 2, reverb: 0.08, name: 'bus-air-brake' });
  if (!v) return;
  e.noiseBurst(v, { color: 'white', attack: 0.02, decay: 0.75, peak: 0.5, filter: { type: 'bandpass', freq: 3800 * vary(0.05), freqTo: 1600, glide: 0.6, Q: 1.2 } });
  e.noiseBurst(v, { color: 'brown', attack: 0.005, decay: 0.12, peak: 0.35, filter: { type: 'lowpass', freq: 240 } });
}

/** Doors: a bright two-note chime (up for opening, down for closing). */
export function doorChime(e: AudioEngine, opening = true, strength = 1) {
  const v = e.voice({ bus: 'sfx', dur: 0.9, gain: 0.18 * strength, priority: 2, reverb: 0.15, name: 'door-chime' });
  if (!v) return;
  const [a, b] = opening ? [659, 880] : [880, 659];
  e.tone(v, { type: 'sine', freq: a, decay: 0.45, peak: 0.5, attack: 0.004 });
  e.tone(v, { type: 'sine', freq: b, decay: 0.55, peak: 0.45, attack: 0.004, offset: 0.2 });
  e.tone(v, { type: 'triangle', freq: b * 2, decay: 0.25, peak: 0.08, offset: 0.2 });
}

/** A stop request: one clear "ding". */
export function stopBell(e: AudioEngine) {
  const v = e.voice({ bus: 'sfx', dur: 0.9, gain: 0.22, priority: 3, reverb: 0.1, name: 'stop-bell' });
  if (!v) return;
  for (const [ratio, g, d] of [[1, 0.5, 0.7], [2.4, 0.18, 0.35], [4.1, 0.07, 0.2]] as const) e.tone(v, { type: 'sine', freq: 1320 * ratio * vary(0.004), decay: d, peak: g, attack: 0.001 });
}

/** The LRV's gong: two low metallic strikes. */
export function lrvGong(e: AudioEngine, strength = 1) {
  const v = e.voice({ bus: 'sfx', dur: 1.8, gain: 0.3 * clamp(strength, 0.2, 1), priority: 3, reverb: 0.2, name: 'lrv-gong' });
  if (!v) return;
  for (const offset of [0, 0.32]) {
    for (const [ratio, g, d] of [[1, 0.5, 1.1], [2.76, 0.2, 0.6], [5.4, 0.08, 0.3]] as const) e.tone(v, { type: 'sine', freq: 392 * ratio * vary(0.003), decay: d, peak: g, offset, attack: 0.002 });
    e.noiseBurst(v, { attack: 0.001, decay: 0.02, peak: 0.12, offset, filter: { type: 'highpass', freq: 2500 } });
  }
}

/** A Market St kiosk: a soft three-note station chime as the train comes in. */
export function stationChime(e: AudioEngine) {
  const v = e.voice({ bus: 'sfx', dur: 1.4, gain: 0.16, priority: 2, reverb: 0.35, name: 'station-chime' });
  if (!v) return;
  [523, 659, 784].forEach((f, i) => e.tone(v, { type: 'sine', freq: f, decay: 0.6, peak: 0.45, attack: 0.01, offset: i * 0.18 }));
}

/** Diving into (or out of) a tunnel mouth: a pressure whoosh. */
export function portalWhoosh(e: AudioEngine, into = true) {
  const v = e.voice({ bus: 'sfx', dur: 1.3, gain: 0.3, priority: 2, reverb: 0.25, name: 'portal-whoosh' });
  if (!v) return;
  e.noiseBurst(v, { color: 'pink', attack: into ? 0.3 : 0.05, decay: into ? 0.7 : 0.9, peak: 0.6, filter: { type: 'bandpass', freq: into ? 1400 : 500, freqTo: into ? 300 : 1200, glide: 0.8, Q: 0.9 } });
}

export interface LineLoopState {
  /** riding the sightseeing bus (or standing next to one), its speed u/s */
  bus: boolean;
  busSpeed: number;
  /** riding a Metro train on the surface, its speed */
  lrv: boolean;
  lrvSpeed: number;
  /** the subway overlay is up */
  tunnel: boolean;
}

/** Continuous layers (the bus hum, the LRV whine, the tunnel rumble); update() from the audio tick, nodes built lazily. */
export class LineLoops {
  private readonly e: AudioEngine;
  private hum: { osc: OscillatorNode; sub: OscillatorNode; filter: BiquadFilterNode; gain: GainNode } | null = null;
  private whine: { osc: OscillatorNode; filter: BiquadFilterNode; gain: GainNode } | null = null;
  private rumble: { src: AudioBufferSourceNode; filter: BiquadFilterNode; gain: GainNode } | null = null;

  constructor(e: AudioEngine) { this.e = e; }

  update(s: LineLoopState) {
    const ctx = this.e.ctx, t = ctx.currentTime;
    if (s.bus && !this.hum) {
      const osc = ctx.createOscillator(), sub = ctx.createOscillator();
      osc.type = 'sawtooth'; sub.type = 'triangle';
      osc.frequency.value = 48; sub.frequency.value = 24;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass'; filter.frequency.value = 320; filter.Q.value = 1.4;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      osc.connect(filter); sub.connect(filter);
      filter.connect(gain).connect(this.e.buses.sfx.input);
      osc.start(); sub.start();
      this.hum = { osc, sub, filter, gain };
    }
    if (this.hum) {
      const k = clamp(s.busSpeed / 12, 0, 1.2);
      this.hum.gain.gain.setTargetAtTime(s.bus ? 0.03 + 0.045 * k : 0, t, 0.3);
      this.hum.osc.frequency.setTargetAtTime(48 + 46 * k, t, 0.25);
      this.hum.sub.frequency.setTargetAtTime(24 + 23 * k, t, 0.25);
      this.hum.filter.frequency.setTargetAtTime(300 + 520 * k, t, 0.3);
    }
    if (s.lrv && !this.whine) {
      const osc = ctx.createOscillator();
      osc.type = 'square'; osc.frequency.value = 180;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass'; filter.frequency.value = 900; filter.Q.value = 6;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      osc.connect(filter).connect(gain).connect(this.e.buses.sfx.input);
      osc.start();
      this.whine = { osc, filter, gain };
    }
    if (this.whine) {
      const k = clamp(s.lrvSpeed / 12, 0, 1.2);
      this.whine.gain.gain.setTargetAtTime(s.lrv ? 0.012 + 0.03 * k : 0, t, 0.3);
      this.whine.osc.frequency.setTargetAtTime(180 + 420 * k, t, 0.35);
      this.whine.filter.frequency.setTargetAtTime(700 + 1300 * k, t, 0.35);
    }
    if (s.tunnel && !this.rumble) {
      const src = this.e.loopNoise('brown', 0.8);
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass'; filter.frequency.value = 220; filter.Q.value = 0.8;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      src.connect(filter).connect(gain).connect(this.e.buses.ambience.input);
      this.rumble = { src, filter, gain };
    }
    if (this.rumble) this.rumble.gain.gain.setTargetAtTime(s.tunnel ? 0.5 : 0, t, s.tunnel ? 0.5 : 0.8);
  }

  dispose() {
    try { this.hum?.osc.stop(); this.hum?.sub.stop(); this.hum?.gain.disconnect(); } catch { /* ignore */ }
    try { this.whine?.osc.stop(); this.whine?.gain.disconnect(); } catch { /* ignore */ }
    try { this.rumble?.src.stop(); this.rumble?.gain.disconnect(); } catch { /* ignore */ }
    this.hum = null; this.whine = null; this.rumble = null;
  }
}
