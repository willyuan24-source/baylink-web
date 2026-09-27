/**
 * Character voices: per-syllable "blip speech" (BAYBAY = soft otter chirps, NPCs = mumbly reed,
 * player = muted hum) and optional recorded barks (/opus-bay/voice/<id>.m4a|.ogg or ASSETS.voice),
 * feature-detected at runtime with synthesized fallbacks.
 */
import type { Mood, Speaker } from '../core/types';
import { ASSETS } from '../data/assets';
import { NODES } from '../data/script';
import { SF_VOICE_LINES, SF_VOICE_UNMUTE } from '../data/voiceLinesSf';
import { getLocale } from '../../i18n/locale';
import type { AudioEngine, Voice } from './engine';
import { CLIP_MOODS, blipPlan, hashString, mulberry32, voiceClipForMood, type VoiceLang, type Voicing } from './logic';
import { otterChirp, type ChirpKind } from './sfx';

const CLIP_GAP = 6;
const SAME_CLIP_GAP = 25;

/**
 * Recorded barks that listeners mis-hear (zh-yay → "讨厌", zh-think untranscribable, zh-arrived → "到了"): muted
 * until they are re-recorded — the synth chirp and the text bubble carry the moment instead (polish round 1, F14).
 */
export const MUTED_CLIPS: ReadonlySet<string> = new Set(['zh-yay', 'zh-think', 'zh-arrived'].filter(id => !SF_VOICE_UNMUTE.includes(id)));

/** How long voice.line waits for a clip still loading before it falls back to the chirp (s). */
export const LINE_WAIT = 0.7;

type ProbeState = 'unknown' | 'present' | 'absent';

export class VoicePlayer {
  private readonly e: AudioEngine;
  private readonly clips = new Map<string, AudioBuffer | null>();
  private readonly loading = new Map<string, Promise<AudioBuffer | null>>();
  private probe: ProbeState = 'unknown';
  private lastClip = -Infinity;
  private readonly lastById: Record<string, number> = {};
  private utterance: Voice | null = null;
  private lines = 0;
  private disposed = false;

  constructor(e: AudioEngine) { this.e = e; }

  static lang(): VoiceLang { return getLocale() === 'en' ? 'en' : 'zh'; }

  private manifest(): Record<string, string> {
    return (ASSETS.voice ?? {}) as Record<string, string>;
  }

  private candidates(id: string): string[] {
    const listed = this.manifest()[id];
    if (listed) return [listed];
    let m4a = true;
    try { m4a = new Audio().canPlayType('audio/mp4; codecs="mp4a.40.2"') !== ''; } catch { /* no media element */ }
    const exts = m4a ? ['m4a', 'ogg'] : ['ogg', 'm4a'];
    return exts.map(ext => `/opus-bay/voice/${id}.${ext}`);
  }

  private async fetchClip(id: string): Promise<AudioBuffer | null> {
    const listed = !!this.manifest()[id];
    const hasManifest = Object.keys(this.manifest()).length > 0;
    if (!listed && (hasManifest || this.probe === 'absent')) return null;
    for (const url of this.candidates(id)) {
      try {
        const res = await fetch(url, { headers: { Accept: 'audio/*' } });
        const type = res.headers.get('content-type') ?? '';
        if (!res.ok || type.includes('text/html')) continue;
        const data = await res.arrayBuffer();
        if (this.disposed) return null;
        const buffer = await this.e.ctx.decodeAudioData(data);
        if (!listed) this.probe = 'present';
        return buffer;
      } catch {
        /* try the next container */
      }
    }
    if (!listed && this.probe === 'unknown') this.probe = 'absent';
    return null;
  }

  load(id: string): Promise<AudioBuffer | null> {
    if (MUTED_CLIPS.has(id)) { this.clips.set(id, null); return Promise.resolve(null); }
    if (this.clips.has(id)) return Promise.resolve(this.clips.get(id) ?? null);
    let p = this.loading.get(id);
    if (!p) {
      p = this.fetchClip(id).then(buffer => {
        this.clips.set(id, buffer);
        this.loading.delete(id);
        if (buffer) this.e.log('voice-clip:ready', id);
        return buffer;
      });
      this.loading.set(id, p);
    }
    return p;
  }

  /** Warm up the barks for the current language (sequential, low priority). */
  async preload() {
    const lang = VoicePlayer.lang();
    const ids = ['hi', 'yay', 'wow', 'this-way', 'arrived', 'think'].map(s => `${lang}-${s}`)
      .filter(id => (lang === 'zh' || !/wow|think/.test(id)) && !MUTED_CLIPS.has(id));
    for (const id of ids) {
      if (this.disposed) return;
      await this.load(id);
      if (this.probe === 'absent') return;
    }
  }

  /** Play a recorded bark if it is loaded and not rate-limited; returns its duration or 0. */
  private playClip(id: string, delay = 0): number {
    if (MUTED_CLIPS.has(id)) return 0;
    const buffer = this.clips.get(id);
    if (!buffer) { if (!this.clips.has(id)) void this.load(id); return 0; }
    const now = this.e.now;
    if (now - this.lastClip < CLIP_GAP || now - (this.lastById[id] ?? -Infinity) < SAME_CLIP_GAP) return 0;
    const v = this.e.voice({ bus: 'voice', at: now + delay, dur: buffer.duration, gain: 0.95, priority: 3, reverb: 0.06, name: `voice-clip:${id}` });
    if (!v) return 0;
    this.e.buffer(v, buffer);
    this.lastClip = now;
    this.lastById[id] = now;
    return buffer.duration;
  }

  /**
   * Day-0 contract (lane H2b's recorded city lines, `voice-line` event): play `<lang>-<id>`. Bypasses CLIP_GAP (a line is
   * a deliberate moment) but keeps SAME_CLIP_GAP; waits up to LINE_WAIT for a clip still loading; otherwise (missing,
   * muted, rate-limited) plays the `fallback` chirp. Volume and mute follow the voice bus like every clip.
   */
  line(id: string, fallback: ChirpKind = 'hi') {
    const clipId = `${VoicePlayer.lang()}-${id}`;
    const chirp = () => {
      const now = this.e.now;
      if (now - (this.lastById[`chirp:${fallback}`] ?? -Infinity) < 3) return;
      this.lastById[`chirp:${fallback}`] = now;
      otterChirp(this.e, fallback);
    };
    const play = (buffer: AudioBuffer | null) => {
      if (this.disposed) return;
      if (!buffer || MUTED_CLIPS.has(clipId)) { chirp(); return; }
      const now = this.e.now;
      if (now - (this.lastById[clipId] ?? -Infinity) < SAME_CLIP_GAP) { chirp(); return; }
      const v = this.e.voice({ bus: 'voice', at: now, dur: buffer.duration, gain: 0.95, priority: 3, reverb: 0.06, name: `voice-clip:${clipId}` });
      if (!v) return;
      this.e.buffer(v, buffer);
      this.lastClip = now;
      this.lastById[clipId] = now;
    };
    if (this.clips.has(clipId)) { play(this.clips.get(clipId) ?? null); return; }
    let settled = false;
    const timer = setTimeout(() => { if (!settled) { settled = true; chirp(); } }, LINE_WAIT * 1000);
    void this.load(clipId).then(buffer => { if (settled) return; settled = true; clearTimeout(timer); play(buffer); });
  }

  /** City mode: warm the current language's line clips (after preload(); sequential, low priority). */
  async preloadLines() {
    const lang = VoicePlayer.lang();
    for (const id of Object.keys(SF_VOICE_LINES)) {
      if (this.disposed) return;
      await this.load(`${lang}-${id}`);
    }
  }

  /** A short bark (recorded if available, synth chirp otherwise). */
  bark(kind: ChirpKind, delay = 0) {
    const lang = VoicePlayer.lang();
    const id = `${lang}-${kind}`;
    if (this.playClip(id, delay) > 0) return;
    const now = this.e.now;
    if (now - (this.lastById[`chirp:${kind}`] ?? -Infinity) < 3) return;
    this.lastById[`chirp:${kind}`] = now;
    otterChirp(this.e, kind, delay);
  }

  cancel() {
    const v = this.utterance;
    this.utterance = null;
    if (!v || v.done) return;
    const t = this.e.now;
    v.input.gain.cancelScheduledValues(t);
    v.input.gain.setTargetAtTime(0, t, 0.02);
    for (const s of v.sources) { try { s.stop(t + 0.1); } catch { /* ignore */ } }
  }

  /** Blip-speak a dialogue node. */
  speak(speakerRaw: string, nodeId: string) {
    const node = NODES[nodeId];
    const speaker = (node?.speaker ?? speakerRaw) as Speaker | string;
    this.cancel();
    if (speaker === 'narrator') return;
    const lang = VoicePlayer.lang();
    const text = node ? (lang === 'en' ? node.text.en : node.text.zh) : '';
    const voicing: Voicing = speaker === 'baybay' ? 'baybay' : speaker === 'player' ? 'player' : 'npc';
    const mood: Mood | undefined = node?.mood;
    this.lines++;
    // unknown node (content changed): a short friendly phrase instead of silence
    const plan = blipPlan(text || 'la la la la la', { voicing, mood, seed: hashString(nodeId) + this.lines });
    if (plan.length === 0) return;

    let delay = 0;
    let blipGain = 1;
    if (voicing === 'baybay' && mood && CLIP_MOODS.includes(mood)) {
      const id = voiceClipForMood(mood, lang, mulberry32(this.lines));
      const kind = id ? (id.slice(3) as ChirpKind) : null;
      const clipDur = id ? this.playClip(id) : 0;
      if (clipDur > 0) { delay = Math.min(0.5, clipDur * 0.8); blipGain = 0.55; }
      else if (kind) { this.bark(kind); delay = 0.32; }
    }

    const total = plan[plan.length - 1].at + plan[plan.length - 1].dur + 0.1;
    const v = this.e.voice({ bus: 'voice', at: this.e.now + delay, dur: total, gain: 0.1 * blipGain, priority: 3, reverb: 0.05, name: `blips:${voicing}` });
    if (!v) return;
    this.utterance = v;
    const ctx = this.e.ctx;
    const t0 = v.at;
    const seed = hashString(node?.npcName?.en ?? nodeId);
    const base = voicing === 'baybay' ? 720 : voicing === 'player' ? 420 : 210 + (seed % 9) * 22;

    const carrier = ctx.createOscillator();
    const env = ctx.createGain();
    env.gain.value = 0;
    const tone = ctx.createBiquadFilter();
    if (voicing === 'npc') {
      carrier.setPeriodicWave(this.e.waves.reed);
      tone.type = 'bandpass'; tone.frequency.value = 900 + (seed % 5) * 120; tone.Q.value = 1.1;
    } else {
      carrier.type = voicing === 'baybay' ? 'sine' : 'triangle';
      tone.type = 'lowpass'; tone.frequency.value = voicing === 'baybay' ? 3400 : 1400; tone.Q.value = 0.4;
    }
    carrier.connect(tone).connect(env).connect(v.input);
    let mod: OscillatorNode | null = null;
    let depth: GainNode | null = null;
    if (voicing === 'baybay') {
      mod = ctx.createOscillator();
      depth = ctx.createGain();
      mod.connect(depth).connect(carrier.frequency);
    }

    for (const b of plan) {
      const t = t0 + b.at;
      const f = base * Math.pow(2, b.semi / 12);
      const peak = b.gain * (voicing === 'player' ? 0.5 : 1);
      const attack = voicing === 'npc' ? 0.014 : 0.008;
      if (mod && depth) {
        // BAYBAY: little upward scoop, bright FM chirp that mellows within the syllable
        carrier.frequency.setValueAtTime(f * 0.9, t);
        carrier.frequency.exponentialRampToValueAtTime(f, t + 0.03);
        mod.frequency.setValueAtTime(f * 2, t);
        depth.gain.setValueAtTime(f * 0.35, t);
        depth.gain.linearRampToValueAtTime(f * 0.08, t + b.dur);
      } else {
        carrier.frequency.setValueAtTime(f, t);
        carrier.frequency.exponentialRampToValueAtTime(f * 0.94, t + b.dur);
      }
      // chained exponential segments: each blip starts from wherever the last one decayed to (no clicks)
      env.gain.setTargetAtTime(peak, t, attack / 2.5);
      env.gain.setTargetAtTime(0, t + attack + b.dur * 0.35, b.dur * 0.25);
    }
    carrier.start(t0);
    carrier.stop(t0 + total);
    this.e.track(v, carrier);
    if (mod) { mod.start(t0); mod.stop(t0 + total); this.e.track(v, mod); }

    // music ducks under dialogue, ambience a touch
    const until = t0 + total + 0.6;
    this.e.buses.music.duck(0.4, until);
    this.e.buses.ambience.duck(0.78, until);
  }

  dispose() {
    this.disposed = true;
    this.cancel();
  }
}
