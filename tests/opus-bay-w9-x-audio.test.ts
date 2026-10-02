/**
 * Wave 9 · lane X: the player's sound levels (audio/levels.ts, lane A's Settings contract), the music's start in a public
 * place (audio/audio.ts: after the player's own first gesture, from silence, lower), and one voice at a time
 * (audio/voice.ts: a line whose bubble is gone never plays; a newer line cuts the old one; no bark over a line).
 */
import assert from 'node:assert/strict';
import test from 'node:test';

// ---------------------------------------------------------------------------------------------------------------
// levels
// ---------------------------------------------------------------------------------------------------------------

function memStorage() {
  const m = new Map<string, string>();
  return { m, getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); }, removeItem: (k: string) => { m.delete(k); } };
}

test('W9-X1 levels: defaults (music 60 %), clamped setters, a listener per change, stored under opus-bay:audio:v1 and read back', async () => {
  const L = await import('../src/opus-bay/audio/levels');
  const st = memStorage();
  L.setAudioLevelsStorageForTests(st);
  assert.deepEqual({ ...L.getAudioLevels() }, { music: 0.6, effects: 1, voice: 1, voiceMuted: false });
  const seen: number[] = [];
  const off = L.onAudioLevels(l => seen.push(l.music));
  L.setMusicVolume(0.3);
  L.setMusicVolume(0.3); // no change: no call
  L.setMusicVolume(7);
  L.setMusicVolume(Number.NaN); // ignored
  L.setEffectsVolume(-1);
  L.setVoiceVolume(0.45);
  L.setVoiceMuted(true);
  off();
  L.setMusicVolume(0.5); // after off: not seen
  assert.deepEqual(seen, [0.3, 1, 1, 1, 1]);
  assert.deepEqual({ ...L.getAudioLevels() }, { music: 0.5, effects: 0, voice: 0.45, voiceMuted: true });
  assert.deepEqual(JSON.parse(st.m.get(L.AUDIO_LEVELS_KEY)!), { v: 1, music: 0.5, effects: 0, voice: 0.45, voiceMuted: true });
  // a fresh page reads them back
  L.setAudioLevelsStorageForTests(st);
  assert.deepEqual({ ...L.getAudioLevels() }, { music: 0.5, effects: 0, voice: 0.45, voiceMuted: true });
  // the snapshot is stable between changes (useSyncExternalStore)
  assert.equal(L.getAudioLevels(), L.getAudioLevels());
  L.resetAudioLevels();
  assert.deepEqual({ ...L.getAudioLevels() }, { ...L.DEFAULT_AUDIO_LEVELS });
  L.setAudioLevelsStorageForTests(null);
});

test('W9-X1 levels: a damaged or foreign value reads as the defaults field by field; no storage (?save=off) keeps them for the page', async () => {
  const L = await import('../src/opus-bay/audio/levels');
  assert.deepEqual(L.parseAudioLevels(null), { ...L.DEFAULT_AUDIO_LEVELS });
  assert.deepEqual(L.parseAudioLevels('{oops'), { ...L.DEFAULT_AUDIO_LEVELS });
  assert.deepEqual(L.parseAudioLevels('{"music":0.2}'), { ...L.DEFAULT_AUDIO_LEVELS }, 'no version: not ours');
  assert.deepEqual(L.parseAudioLevels('{"v":1,"music":"loud","effects":2,"voice":0.5,"voiceMuted":"yes"}'), { music: 0.6, effects: 1, voice: 0.5, voiceMuted: false });
  L.setAudioLevelsStorageForTests(null);
  L.setVoiceVolume(0.2);
  assert.equal(L.getAudioLevels().voice, 0.2, 'kept in memory');
  const throwing = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); }, removeItem() {} };
  L.setAudioLevelsStorageForTests(throwing);
  assert.equal(L.getAudioLevels().voice, 1, 'a blocked storage reads the defaults');
  L.setVoiceVolume(0.7);
  assert.equal(L.getAudioLevels().voice, 0.7, 'and a write that throws still applies for the page');
  L.setAudioLevelsStorageForTests(null);
  L.resetAudioLevels();
});

test('W9-X1 levels: the bus gains — effects scale sfx + ambience, music its bus, voice its bus; 只关语音 silences the voice bus only', async () => {
  const { busGains, DEFAULT_AUDIO_LEVELS } = await import('../src/opus-bay/audio/levels');
  const { BUS_LEVELS } = await import('../src/opus-bay/audio/engine');
  const d = busGains({ ...DEFAULT_AUDIO_LEVELS }, BUS_LEVELS);
  assert.equal(d.music, BUS_LEVELS.music * 0.6, 'music starts lower than wave 8 (0.26 → 0.156)');
  assert.equal(d.sfx, BUS_LEVELS.sfx);
  assert.equal(d.ambience, BUS_LEVELS.ambience);
  assert.equal(d.voice, BUS_LEVELS.voice);
  const g = busGains({ music: 1, effects: 0.5, voice: 0.8, voiceMuted: true }, BUS_LEVELS);
  assert.deepEqual(g, { ambience: BUS_LEVELS.ambience * 0.5, sfx: BUS_LEVELS.sfx * 0.5, music: BUS_LEVELS.music, voice: 0 });
});

// ---------------------------------------------------------------------------------------------------------------
// one voice at a time (audio/voice.ts with a fake engine)
// ---------------------------------------------------------------------------------------------------------------

function fakeEngine() {
  const made: { name: string; at: number; end: number; stopped: number | null; done: boolean; sources: { stop: (t: number) => void }[]; input: { gain: Record<string, (...a: number[]) => void> } }[] = [];
  const logs: string[] = [];
  const e = {
    now: 10,
    log: (n: string) => { logs.push(n); },
    voice(o: { name?: string; at: number; dur: number }) {
      const v = { name: o.name ?? '', at: o.at, end: o.at + o.dur, stopped: null as number | null, done: false, sources: [] as { stop: (t: number) => void }[], input: { gain: { cancelScheduledValues() {}, setTargetAtTime() {}, setValueAtTime() {}, linearRampToValueAtTime() {} } } };
      made.push(v);
      return v;
    },
    buffer(v: (typeof made)[number]) { v.sources.push({ stop: (t: number) => { v.stopped = t; } }); },
  };
  return { e, made, logs };
}
const fakeBuffer = (duration: number) => ({ duration, length: Math.round(duration * 48000), numberOfChannels: 1, sampleRate: 48000 });

async function playerWith(clips: Record<string, number>) {
  const { VoicePlayer } = await import('../src/opus-bay/audio/voice');
  const f = fakeEngine();
  const p = new VoicePlayer(f.e as never);
  // the clips are in the cache (no fetch in a test): VoicePlayer.keep is the cache's own write
  for (const [id, s] of Object.entries(clips)) (p as unknown as { keep(id: string, b: unknown): void }).keep(id, fakeBuffer(s));
  return { p, ...f };
}

test('W9-X3 a dropped bubble never plays its voice: the line plays only while its bubble is still the one on screen', async () => {
  const L = await import('../src/opus-bay/audio/levels');
  L.setAudioLevelsStorageForTests(null); L.resetAudioLevels();
  const { p, made, logs } = await playerWith({ 'zh-w9-a': 3, 'zh-w9-b': 2 });
  p.line('w9-a', 'hi', () => false);
  assert.equal(made.length, 0, 'its bubble was gone: no clip');
  assert.equal(p.lineStats.dropped, 1);
  assert.ok(logs.includes('voice-line:dropped'));
  p.line('w9-b', 'hi', () => true);
  assert.deepEqual(made.map(v => v.name), ['voice-clip:zh-w9-b'], 'its bubble is up: it plays');
  // a line with no bubble (a card or a dialogue box carries the words) is not gated
  const q = await playerWith({ 'zh-w9-c': 1 });
  q.p.line('w9-c', 'hi', null);
  assert.equal(q.made.length, 1);
});

test('W9-X3 one voice at a time: a newer line fades the older one out; no bark or chirp starts over a line', async () => {
  const L = await import('../src/opus-bay/audio/levels');
  L.setAudioLevelsStorageForTests(null); L.resetAudioLevels();
  const { p, e, made } = await playerWith({ 'zh-w9-a': 4, 'zh-w9-b': 2, 'zh-yay': 1 });
  p.line('w9-a', 'hi', () => true);
  assert.ok(p.lineSpeaking());
  e.now = 11; // a second later the next bubble's line starts
  p.line('w9-b', 'hi', () => true);
  assert.equal(made.length, 2);
  assert.ok(made[0].stopped !== null && made[0].stopped < 11.5, 'the first line was stopped at once (a short fade)');
  assert.equal(made[1].stopped, null, 'the new line plays on');
  assert.equal(p.lineStats.cut, 1);
  // a bark while the line speaks: nothing (no recorded bark, no synth chirp)
  e.now = 11.5;
  p.bark('yay');
  assert.equal(made.length, 2, 'no bark over a line');
  // stopLine (its bubble was replaced by another): it fades; nothing is left speaking
  assert.equal(p.stopLine(), true);
  assert.equal(p.lineSpeaking(), false);
  assert.equal(p.stopLine(), false, 'nothing to stop twice');
});

test('W9-X1 只关语音: no clip is fetched or played, no bark, no blips; the line is counted as muted', async () => {
  const L = await import('../src/opus-bay/audio/levels');
  L.setAudioLevelsStorageForTests(null);
  L.setVoiceMuted(true);
  try {
    const { p, made } = await playerWith({ 'zh-w9-a': 2, 'zh-hi': 1 });
    p.line('w9-a', 'hi', () => true);
    p.bark('hi');
    p.speak('baybay', 'no-such-node');
    p.loadStop(['zh-w9-z']);
    await p.preload();
    assert.equal(made.length, 0);
    assert.equal(p.lineStats.muted, 1);
  } finally { L.resetAudioLevels(); }
});

// ---------------------------------------------------------------------------------------------------------------
// the music's start (audio/audio.ts with a fake AudioContext, as tests/opus-bay-audio.test.ts)
// ---------------------------------------------------------------------------------------------------------------

function fakeAudio() {
  const log: { op: string; frames?: number }[] = [];
  const param = () => ({ value: 0, setValueAtTime() {}, setTargetAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, cancelScheduledValues() {} });
  const node = (kind: string): Record<string, unknown> => {
    log.push({ op: kind });
    const target: Record<string, unknown> = { connect: (next: unknown) => next, disconnect() {}, start() {}, stop() {}, setPeriodicWave() {}, addEventListener() {}, buffer: null, onended: null, type: '', loop: false };
    return new Proxy(target, { get: (t, k: string) => (k in t ? t[k] : (t[k] = param())) });
  };
  class FakeContext {
    state: 'suspended' | 'running' | 'closed' = 'suspended';
    sampleRate = 48000;
    currentTime = 0;
    destination = node('destination');
    createBuffer(channels: number, frames: number) {
      log.push({ op: 'createBuffer', frames });
      const data = Array.from({ length: channels }, () => new Float32Array(frames));
      return { numberOfChannels: channels, length: frames, sampleRate: this.sampleRate, duration: frames / this.sampleRate, getChannelData: (c: number) => data[c] };
    }
    resume() { this.state = 'running'; return Promise.resolve(); }
    suspend() { this.state = 'suspended'; return Promise.resolve(); }
    close() { this.state = 'closed'; return Promise.resolve(); }
    addEventListener() {}
    createGain() { return node('gain'); }
    createBiquadFilter() { return node('biquad'); }
    createDynamicsCompressor() { return node('compressor'); }
    createConvolver() { return node('convolver'); }
    createStereoPanner() { return node('panner'); }
    createOscillator() { return node('oscillator'); }
    createBufferSource() { return node('bufferSource'); }
    createPeriodicWave() { return {}; }
  }
  const listeners = new Map<string, ((ev?: unknown) => void)[]>();
  const on = (type: string, fn: (ev?: unknown) => void) => { listeners.set(type, [...(listeners.get(type) ?? []), fn]); };
  const win = { AudioContext: FakeContext, addEventListener: on, removeEventListener() {}, setTimeout, clearTimeout, setInterval, clearInterval };
  const doc = { visibilityState: 'visible', addEventListener: on, removeEventListener() {} };
  return { log, win, doc, fire: (type: string) => (listeners.get(type) ?? []).forEach(fn => fn({})) };
}

async function withAudio(run: (h: { fire: (t: string) => void; probe: { wanted: boolean; started: boolean } }) => Promise<void>) {
  const fake = fakeAudio();
  const g = globalThis as unknown as Record<string, unknown>;
  const saved = { window: g.window, document: g.document };
  g.window = fake.win;
  g.document = fake.doc;
  const { startAudio, musicProbe } = await import('../src/opus-bay/audio/audio');
  const stop = startAudio();
  try {
    // the rig is built in idle slices (the ambience's oscillators exist once it is)
    const bigBuffers = () => fake.log.filter(e => e.op === 'createBuffer' && (e.frames ?? 0) > 1000).length;
    for (let i = 0; i < 1000 && !(bigBuffers() >= 4 && fake.log.some(e => e.op === 'oscillator')); i++) await new Promise(r => setTimeout(r, 5));
    await new Promise(r => setTimeout(r, 30));
    await run({ fire: fake.fire, probe: musicProbe });
  } finally {
    stop();
    g.window = saved.window;
    g.document = saved.document;
  }
}

test('W9-X1 the music waits for the player\'s own first gesture after Start (not the Start tap, not 2.2 s later), then begins', async () => {
  const { game } = await import('../src/opus-bay/core/store');
  const { emit } = await import('../src/opus-bay/core/events');
  await withAudio(async ({ fire, probe }) => {
    game.set({ phase: 'arrival' } as never);
    emit({ type: 'start' } as never);
    fire('pointerdown'); // the Start tap's own events, right after
    fire('touchend');
    await new Promise(r => setTimeout(r, 2500)); // wave 8 began the music 2.2 s after Start
    assert.equal(probe.started, false, 'no music on its own after Start');
    fire('keydown'); // the player's first own gesture (Esc to skip the intro, a choice, a step)
    assert.equal(probe.wanted, true);
    assert.equal(probe.started, true, 'the music begins');
  });
  game.set({ phase: 'title' } as never);
});

test('W9-X1 ?start= (title skipped): the gesture that turns sound on is the player\'s own — the music begins with it', async () => {
  const { game } = await import('../src/opus-bay/core/store');
  await withAudio(async ({ fire, probe }) => {
    game.set({ phase: 'playing' } as never);
    fire('keydown');
    assert.equal(probe.started, true);
  });
  game.set({ phase: 'title' } as never);
});
