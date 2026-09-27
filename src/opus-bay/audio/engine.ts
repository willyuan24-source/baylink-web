/**
 * Web Audio core: master chain, four buses (ambience / sfx / music / voice) with a shared reverb send,
 * reusable noise buffers, voice budget with stealing, and tiny synthesis primitives used by recipes.
 */
import { clamp } from './logic';

export type BusName = 'ambience' | 'sfx' | 'music' | 'voice';
export type NoiseColor = 'white' | 'pink' | 'brown';

const DEV = import.meta.env.DEV;

/** Default bus levels (music is intentionally low). */
export const BUS_LEVELS: Record<BusName, number> = { ambience: 0.36, sfx: 0.8, music: 0.26, voice: 0.9 };
const MAX_VOICES = 32;

/** A mix bus: input → level (mute × duck × level) → master, and send → same gain → reverb. */
export class Bus {
  readonly input: GainNode;
  readonly send: GainNode;
  private readonly out: GainNode;
  private readonly sendOut: GainNode;
  private readonly ctx: BaseAudioContext;
  level: number;
  private duckAmount = 1;
  private duckUntil = 0;
  /** sustained attenuation (e.g. while a dialogue box is open), 1 = none */
  private holdAmount = 1;
  private applied = 1;
  private enabled = true;

  constructor(ctx: BaseAudioContext, master: AudioNode, reverb: AudioNode, level: number) {
    this.ctx = ctx;
    this.level = level;
    this.input = ctx.createGain();
    this.send = ctx.createGain();
    this.out = ctx.createGain();
    this.sendOut = ctx.createGain();
    this.out.gain.value = level;
    this.sendOut.gain.value = level;
    this.input.connect(this.out).connect(master);
    this.send.connect(this.sendOut).connect(reverb);
  }

  private factor() { return Math.min(this.holdAmount, this.duckAmount); }

  private apply(tau: number) {
    this.applied = this.factor();
    const v = this.enabled ? this.level * this.applied : 0;
    const t = this.ctx.currentTime;
    for (const node of [this.out, this.sendOut]) {
      node.gain.cancelScheduledValues(t);
      node.gain.setTargetAtTime(v, t, tau);
    }
  }

  setEnabled(on: boolean, tau = 0.25) {
    if (this.enabled === on) return;
    this.enabled = on;
    this.apply(tau);
  }

  setLevel(level: number, tau = 0.4) {
    this.level = level;
    this.apply(tau);
  }

  /** Lower this bus to `amount` until `until` (ctx time), then recover. */
  duck(amount: number, until: number) {
    this.duckUntil = Math.max(this.duckUntil, until);
    if (amount < this.duckAmount - 1e-3) { this.duckAmount = amount; if (this.factor() < this.applied - 1e-3) this.apply(0.08); }
  }

  /** Sustained attenuation until released with hold(1). */
  hold(amount: number) {
    if (Math.abs(amount - this.holdAmount) < 1e-3) return;
    this.holdAmount = amount;
    if (Math.abs(this.factor() - this.applied) > 1e-3) this.apply(amount < 1 ? 0.2 : 0.8);
  }

  update(now: number) {
    if (this.duckAmount < 1 && now > this.duckUntil) {
      this.duckAmount = 1;
      if (Math.abs(this.factor() - this.applied) > 1e-3) this.apply(0.5);
    }
  }
}

export interface Voice {
  /** connect sources (via their own envelopes) here */
  input: GainNode;
  at: number;
  end: number;
  priority: number;
  sources: AudioScheduledSourceNode[];
  nodes: AudioNode[];
  done: boolean;
  /** sources still playing (graph is torn down when it reaches 0) */
  pending: number;
}

export interface VoiceOptions {
  bus: BusName;
  /** ctx time; defaults to now */
  at?: number;
  /** total length in seconds (sources are stopped at at + dur) */
  dur: number;
  gain?: number;
  pan?: number;
  /** 0..1 amount sent to reverb */
  reverb?: number;
  /** 0 = footsteps/hover … 4 = collectibles */
  priority?: number;
  name?: string;
}

export interface ToneOptions {
  type?: OscillatorType;
  wave?: PeriodicWave;
  freq: number;
  /** glide target and glide time */
  freqTo?: number;
  glide?: number;
  at?: number;
  attack?: number;
  /** time to fade to ~ -60 dB */
  decay: number;
  peak?: number;
  detune?: number;
  /** simple FM: modulator frequency = freq * ratio, deviation = freq * index */
  fm?: { ratio: number; index: number; indexTo?: number };
  vibrato?: { rate: number; depth: number };
  filter?: { type: BiquadFilterType; freq: number; Q?: number; freqTo?: number };
  /** delay before the envelope starts, relative to the voice start */
  offset?: number;
}

export interface NoiseOptions {
  color?: NoiseColor;
  offset?: number;
  attack?: number;
  decay: number;
  peak?: number;
  filter?: { type: BiquadFilterType; freq: number; Q?: number; freqTo?: number; glide?: number };
  /** playback rate (pitch of the noise character) */
  rate?: number;
}

export interface AudioStats {
  counts: Record<string, number>;
  last: string;
  lastAt: number;
  voices: number;
  stolen: number;
  dropped: number;
}

function makeNoise(ctx: BaseAudioContext, seconds: number, color: NoiseColor): AudioBuffer {
  const sr = ctx.sampleRate;
  const n = Math.floor(seconds * sr);
  const xf = Math.floor(sr * 0.05);
  const raw = new Float32Array(n + xf);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
  for (let i = 0; i < raw.length; i++) {
    const w = Math.random() * 2 - 1;
    if (color === 'white') raw[i] = w * 0.5;
    else if (color === 'pink') {
      b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
      raw[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
    } else {
      last = (last + 0.02 * w) / 1.02;
      raw[i] = last * 3.5;
    }
  }
  // seamless loop: crossfade the tail into the head
  const buffer = ctx.createBuffer(1, n, sr);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < n; i++) data[i] = raw[i];
  for (let i = 0; i < xf; i++) { const t = i / xf; data[i] = raw[i] * t + raw[n + i] * (1 - t); }
  return buffer;
}

function makeImpulse(ctx: BaseAudioContext, seconds: number): AudioBuffer {
  const sr = ctx.sampleRate;
  const n = Math.floor(seconds * sr);
  const pre = Math.floor(sr * 0.012);
  const ir = ctx.createBuffer(2, n, sr);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    let lp = 0;
    for (let i = pre; i < n; i++) {
      const t = (i - pre) / (n - pre);
      // damping: highs die faster than lows
      const coeff = 0.75 - 0.6 * t;
      lp += coeff * ((Math.random() * 2 - 1) - lp);
      d[i] = lp * Math.pow(1 - t, 2.2) * Math.exp(-t * 2.5);
    }
  }
  return ir;
}

export class AudioEngine {
  readonly ctx: BaseAudioContext;
  readonly master: GainNode;
  readonly muffle: BiquadFilterNode;
  readonly reverb: ConvolverNode;
  readonly buses: Record<BusName, Bus>;
  readonly noise: Record<NoiseColor, AudioBuffer>;
  readonly waves: { soft: PeriodicWave; warm: PeriodicWave; reed: PeriodicWave };
  readonly stats: AudioStats = { counts: {}, last: '', lastAt: 0, voices: 0, stolen: 0, dropped: 0 };
  private voices: Voice[] = [];
  private masterLevel = 0.9;

  constructor(ctx: BaseAudioContext) {
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.muffle = ctx.createBiquadFilter();
    this.muffle.type = 'lowpass';
    this.muffle.frequency.value = 20000;
    this.muffle.Q.value = 0.5;
    const glue = ctx.createDynamicsCompressor();
    glue.threshold.value = -20; glue.knee.value = 12; glue.ratio.value = 2.5; glue.attack.value = 0.012; glue.release.value = 0.25;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -3; limiter.knee.value = 0; limiter.ratio.value = 20; limiter.attack.value = 0.002; limiter.release.value = 0.12;
    this.master.connect(this.muffle).connect(glue).connect(limiter).connect(ctx.destination);

    this.reverb = ctx.createConvolver();
    this.reverb.buffer = makeImpulse(ctx, 2.3);
    const reverbReturn = ctx.createGain();
    reverbReturn.gain.value = 0.42;
    this.reverb.connect(reverbReturn).connect(this.master);

    this.buses = {
      ambience: new Bus(ctx, this.master, this.reverb, BUS_LEVELS.ambience),
      sfx: new Bus(ctx, this.master, this.reverb, BUS_LEVELS.sfx),
      music: new Bus(ctx, this.master, this.reverb, BUS_LEVELS.music),
      voice: new Bus(ctx, this.master, this.reverb, BUS_LEVELS.voice),
    };
    this.noise = { white: makeNoise(ctx, 2, 'white'), pink: makeNoise(ctx, 4, 'pink'), brown: makeNoise(ctx, 4, 'brown') };
    const wave = (harmonics: number[]) => {
      const real = new Float32Array(harmonics.length + 1), imag = new Float32Array(harmonics.length + 1);
      harmonics.forEach((h, i) => { imag[i + 1] = h; });
      return ctx.createPeriodicWave(real, imag);
    };
    this.waves = {
      soft: wave([1, 0.18, 0.06, 0.02]),
      warm: wave([1, 0.45, 0.22, 0.12, 0.06, 0.03]),
      reed: wave([1, 0.7, 0.5, 0.36, 0.25, 0.18, 0.12, 0.08, 0.05]),
    };
  }

  get now() { return this.ctx.currentTime; }

  setMaster(on: boolean, tau = 0.3) {
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setTargetAtTime(on ? this.masterLevel : 0, t, tau);
  }

  setMuffled(on: boolean) {
    const t = this.ctx.currentTime;
    this.muffle.frequency.cancelScheduledValues(t);
    this.muffle.frequency.setTargetAtTime(on ? 850 : 20000, t, on ? 0.12 : 0.3);
  }

  log(name: string, detail?: unknown) {
    this.stats.counts[name] = (this.stats.counts[name] ?? 0) + 1;
    this.stats.last = name;
    this.stats.lastAt = this.ctx.currentTime;
    if (DEV) console.debug('[opus-audio]', name, detail ?? '');
  }

  private prune(now: number) {
    if (this.voices.length === 0) return;
    for (const v of this.voices) {
      // backstop for voices that never got a source
      if (!v.done && v.pending === 0 && v.end <= now) {
        v.done = true;
        for (const n of v.nodes) { try { n.disconnect(); } catch { /* ignore */ } }
      }
    }
    this.voices = this.voices.filter(v => !v.done && v.end > now);
    this.stats.voices = this.voices.length;
  }

  private kill(v: Voice) {
    if (v.done) return;
    v.done = true;
    const t = this.ctx.currentTime;
    try {
      v.input.gain.cancelScheduledValues(t);
      v.input.gain.setTargetAtTime(0, t, 0.012);
    } catch { /* already gone */ }
    for (const s of v.sources) { try { s.stop(t + 0.06); } catch { /* not started / stopped */ } }
  }

  /** Allocate a one-shot voice (returns null when over budget and nothing lower-priority can be stolen). */
  voice(o: VoiceOptions): Voice | null {
    const now = this.ctx.currentTime;
    const at = Math.max(now, o.at ?? now);
    const priority = o.priority ?? 2;
    this.prune(now);
    if (this.voices.length >= MAX_VOICES) {
      let victim: Voice | null = null;
      for (const v of this.voices) {
        if (v.priority > priority) continue;
        if (!victim || v.priority < victim.priority || (v.priority === victim.priority && v.at < victim.at)) victim = v;
      }
      if (!victim) { this.stats.dropped++; return null; }
      this.kill(victim);
      this.voices.splice(this.voices.indexOf(victim), 1);
      this.stats.stolen++;
    }
    const input = this.ctx.createGain();
    input.gain.value = o.gain ?? 1;
    const bus = this.buses[o.bus];
    const nodes: AudioNode[] = [input];
    let head: AudioNode = input;
    if (o.pan) {
      const panner = this.ctx.createStereoPanner();
      panner.pan.value = clamp(o.pan, -1, 1);
      input.connect(panner);
      head = panner;
      nodes.push(panner);
    }
    head.connect(bus.input);
    if (o.reverb && o.reverb > 0) {
      const send = this.ctx.createGain();
      send.gain.value = o.reverb;
      head.connect(send).connect(bus.send);
      nodes.push(send);
    }
    const v: Voice = { input, at, end: at + o.dur + 0.1, priority, sources: [], nodes, done: false, pending: 0 };
    this.voices.push(v);
    this.stats.voices = this.voices.length;
    if (o.name) this.log(o.name);
    return v;
  }

  /** Register a started source with a voice; the voice's graph is released when its last source ends. */
  track(v: Voice, ...sources: AudioScheduledSourceNode[]) {
    for (const src of sources) {
      v.sources.push(src);
      v.pending++;
      src.onended = () => {
        v.pending--;
        if (v.pending > 0) return;
        v.done = true;
        for (const n of v.nodes) { try { n.disconnect(); } catch { /* ignore */ } }
      };
    }
  }

  private envelope(param: AudioParam, at: number, attack: number, peak: number, decay: number) {
    param.setValueAtTime(0, at);
    param.linearRampToValueAtTime(peak, at + Math.max(0.001, attack));
    param.setTargetAtTime(0, at + Math.max(0.001, attack), Math.max(0.004, decay / 6.9));
  }

  /** An enveloped oscillator into the voice. */
  tone(v: Voice, o: ToneOptions): OscillatorNode {
    const ctx = this.ctx;
    const at = v.at + (o.offset ?? 0);
    const attack = o.attack ?? 0.004;
    const osc = ctx.createOscillator();
    if (o.wave) osc.setPeriodicWave(o.wave); else osc.type = o.type ?? 'sine';
    osc.frequency.setValueAtTime(o.freq, at);
    if (o.freqTo !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.freqTo), at + (o.glide ?? o.decay * 0.5));
    if (o.detune) osc.detune.value = o.detune;
    const env = ctx.createGain();
    this.envelope(env.gain, at, attack, o.peak ?? 0.5, o.decay);
    let head: AudioNode = osc;
    if (o.filter) {
      const f = ctx.createBiquadFilter();
      f.type = o.filter.type;
      f.frequency.setValueAtTime(o.filter.freq, at);
      if (o.filter.freqTo !== undefined) f.frequency.exponentialRampToValueAtTime(Math.max(20, o.filter.freqTo), at + o.decay * 0.7);
      f.Q.value = o.filter.Q ?? 0.8;
      osc.connect(f);
      head = f;
    }
    head.connect(env).connect(v.input);
    const stopAt = at + attack + o.decay + 0.05;
    if (o.fm) {
      const mod = ctx.createOscillator();
      const depth = ctx.createGain();
      mod.frequency.setValueAtTime(o.freq * o.fm.ratio, at);
      if (o.freqTo !== undefined) mod.frequency.exponentialRampToValueAtTime(Math.max(1, o.freqTo * o.fm.ratio), at + (o.glide ?? o.decay * 0.5));
      depth.gain.setValueAtTime(o.freq * o.fm.index, at);
      if (o.fm.indexTo !== undefined) depth.gain.linearRampToValueAtTime(o.freq * o.fm.indexTo, at + o.decay);
      mod.connect(depth).connect(osc.frequency);
      mod.start(at);
      mod.stop(stopAt);
      this.track(v, mod);
    }
    if (o.vibrato) {
      const lfo = ctx.createOscillator();
      const depth = ctx.createGain();
      lfo.frequency.value = o.vibrato.rate;
      depth.gain.value = o.freq * o.vibrato.depth;
      lfo.connect(depth).connect(osc.frequency);
      lfo.start(at);
      lfo.stop(stopAt);
      this.track(v, lfo);
    }
    osc.start(at);
    osc.stop(stopAt);
    this.track(v, osc);
    return osc;
  }

  /** An enveloped, filtered burst from a shared noise buffer. */
  noiseBurst(v: Voice, o: NoiseOptions): AudioBufferSourceNode {
    const ctx = this.ctx;
    const at = v.at + (o.offset ?? 0);
    const attack = o.attack ?? 0.002;
    const buffer = this.noise[o.color ?? 'white'];
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    if (o.rate) src.playbackRate.value = o.rate;
    const env = ctx.createGain();
    this.envelope(env.gain, at, attack, o.peak ?? 0.5, o.decay);
    let head: AudioNode = src;
    if (o.filter) {
      const f = ctx.createBiquadFilter();
      f.type = o.filter.type;
      f.frequency.setValueAtTime(o.filter.freq, at);
      if (o.filter.freqTo !== undefined) f.frequency.exponentialRampToValueAtTime(Math.max(20, o.filter.freqTo), at + (o.filter.glide ?? o.decay * 0.7));
      f.Q.value = o.filter.Q ?? 0.8;
      src.connect(f);
      head = f;
    }
    head.connect(env).connect(v.input);
    src.start(at, Math.random() * (buffer.duration - 0.5));
    src.stop(at + attack + o.decay + 0.05);
    this.track(v, src);
    return src;
  }

  /** Play an AudioBuffer (clip or rendered pluck) into the voice. */
  buffer(v: Voice, buffer: AudioBuffer, o: { offset?: number; rate?: number; gain?: number; filter?: { type: BiquadFilterType; freq: number; Q?: number } } = {}) {
    const ctx = this.ctx;
    const at = v.at + (o.offset ?? 0);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    if (o.rate) src.playbackRate.value = o.rate;
    const g = ctx.createGain();
    g.gain.value = o.gain ?? 1;
    let head: AudioNode = src;
    if (o.filter) {
      const f = ctx.createBiquadFilter();
      f.type = o.filter.type;
      f.frequency.value = o.filter.freq;
      f.Q.value = o.filter.Q ?? 0.7;
      src.connect(f);
      head = f;
    }
    head.connect(g).connect(v.input);
    src.start(at);
    this.track(v, src);
    return src;
  }

  /** A looping noise source (for persistent ambience layers). */
  loopNoise(color: NoiseColor, rate = 1): AudioBufferSourceNode {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise[color];
    src.loop = true;
    src.playbackRate.value = rate;
    src.start(this.ctx.currentTime, Math.random() * (src.buffer.duration - 0.5));
    return src;
  }

  update(now: number) {
    for (const bus of Object.values(this.buses)) bus.update(now);
    this.prune(now);
  }

  dispose() {
    for (const v of this.voices) this.kill(v);
    this.voices = [];
    try { this.master.disconnect(); } catch { /* ignore */ }
  }
}
