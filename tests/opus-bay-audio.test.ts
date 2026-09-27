import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FOOTSTEPS, blipPlan, bumpVoice, buildShoreField, chordPitchClasses, createRateLimiter, distToPolyline, isMarketDay,
  makeMotif, mulberry32, musicMoodFor, normaliseImpact, panFor, progressionFor, proximity, renderPluck, scaleMidi,
  syllableCount, varyMotif, voiceClipForMood, voiceLead, type ShoreSource,
} from '../src/opus-bay/audio/logic';

const rect = (x0: number, z0: number, x1: number, z1: number) => [{ x: x0, z: z0 }, { x: x1, z: z0 }, { x: x1, z: z1 }, { x: x0, z: z1 }];

// water to the north (−z), promenade along x, one pier sticking out into the bay, a hill in the city
const toy: ShoreSource = {
  slab: rect(-100, -60, 100, 60),
  walk: [
    { polygon: rect(-80, 0, 80, 10), surface: 'pavement' },
    { polygon: rect(-8, -35, 8, 0), surface: 'wood', height: 1 },
  ],
  piers: [{ deck: rect(-8, -35, 8, 0) }],
  hills: [{ center: { x: 30, z: 40 }, radiusX: 20, radiusZ: 15 }],
  roads: [{ points: [{ x: -90, z: 14 }, { x: 90, z: 14 }], width: 6 }],
  blocks: [],
};

test('shore field: piers are over water, the city is filled inland, open columns are water', () => {
  const f = buildShoreField(toy, 2);
  assert.ok(f.distanceAt(0, -20) < 1.5, 'on the pier deck you are over water');
  const promenade = f.distanceAt(50, 5);
  assert.ok(promenade > 2 && promenade < 9, `promenade ≈ 5u from the water, got ${promenade}`);
  const inland = f.distanceAt(-50, 45);
  assert.ok(inland > 35, `city is filled south of the waterfront, got ${inland}`);
  assert.ok(f.distanceAt(95, 30) < 1.5, 'columns without land are open water');
  const dir = f.waterDirAt(50, 20);
  assert.ok(dir.z < -0.9, `water lies north, got ${JSON.stringify(dir)}`);
});

test('panning follows the camera yaw convention and centres nearby sources', () => {
  const me = { x: 0, z: 0 };
  // yaw 0: looking north (−z), east (+x) is on the right
  assert.ok(panFor(me, 0, { x: 30, z: 0 }) > 0.7);
  assert.ok(panFor(me, 0, { x: -30, z: 0 }) < -0.7);
  // turned around (yaw π): east is now on the left
  assert.ok(panFor(me, Math.PI, { x: 30, z: 0 }) < -0.7);
  assert.equal(panFor(me, 0, { x: 0.1, z: 0 }), 0);
  assert.equal(proximity(1, 2, 10), 1);
  assert.equal(proximity(12, 2, 10), 0);
  assert.ok(proximity(6, 2, 10) > 0.3 && proximity(6, 2, 10) < 0.7);
  assert.ok(Math.abs(distToPolyline(5, 3, [{ x: 0, z: 0 }, { x: 10, z: 0 }]) - 3) < 1e-9);
});

test('rate limiter caps bursts (footsteps ≤ 6/s)', () => {
  const ok = createRateLimiter(6, 2);
  let played = 0;
  for (let i = 0; i < 100; i++) if (ok(i * 0.02)) played++; // 50 requests/s for 2 s
  assert.ok(played <= 6 * 2 + 2 && played >= 10, `played ${played}`);
});

test('footstep recipes exist for every surface; bump kinds map to voices', () => {
  for (const s of ['pavement', 'wood', 'grass', 'sand', 'plaza', 'stairs', 'dirt'] as const) assert.ok(FOOTSTEPS[s].noiseGain > 0);
  assert.equal(bumpVoice('cone'), 'plastic');
  assert.equal(bumpVoice('crate'), 'wood');
  assert.equal(bumpVoice('buoy'), 'rubber');
  assert.equal(bumpVoice('lamp'), 'metal');
  assert.equal(bumpVoice('baybay'), 'squeak');
  assert.equal(bumpVoice('slab-edge'), 'thud');
  assert.equal(normaliseImpact(0.5), 0.5);
  assert.equal(normaliseImpact(12), 1);
  assert.ok(normaliseImpact(6) > 0.4 && normaliseImpact(6) < 0.6);
});

test('dialogue blips: syllables, caps, question rise', () => {
  assert.equal(syllableCount('嗨！欢迎来到湾区'), 7);
  assert.equal(syllableCount('Hello there'), 3);
  const long = blipPlan('这就是渡轮大厦，钟楼是海湾边最好认的地标。', { voicing: 'baybay', seed: 1 });
  assert.ok(long.length <= 14 && long.length >= 10);
  for (let i = 1; i < long.length; i++) assert.ok(long[i].at > long[i - 1].at);
  const q = blipPlan('第一次来吗？', { voicing: 'baybay', seed: 3 });
  assert.ok(q[q.length - 1].semi > q[0].semi, 'questions end high');
  assert.deepEqual(blipPlan('   ', { voicing: 'npc' }), []);
  assert.equal(voiceClipForMood('wave', 'zh'), 'zh-hi');
  assert.equal(voiceClipForMood('excited', 'en'), 'en-yay');
  assert.equal(voiceClipForMood('thinking', 'en'), null);
  assert.equal(voiceClipForMood('happy', 'zh'), null);
});

test('music: moods stay in the 72–84 bpm band, tour is brighter, harmony helpers are sane', () => {
  for (const t of ['morning', 'day', 'golden', 'night'] as const) {
    for (const m of ['onboarding', 'tour', 'week', 'free'] as const) {
      const mood = musicMoodFor(t, m);
      assert.ok(mood.bpm >= 72 && mood.bpm <= 84, `${t}/${m} bpm ${mood.bpm}`);
    }
    assert.ok(musicMoodFor(t, 'tour').brightness > musicMoodFor(t, 'free').brightness);
  }
  assert.equal(musicMoodFor('night', 'free').minor, true);
  assert.equal(scaleMidi(60, false, 0), 60);
  assert.equal(scaleMidi(60, false, 5), 72);
  assert.equal(scaleMidi(60, false, -1), 57);
  assert.deepEqual(chordPitchClasses(60, { offset: 9, minor: true }), [9, 0, 4, 11]);
  assert.equal(progressionFor(false, 5).length, 4);
  const a = voiceLead(null, [0, 4, 7], 52, 67);
  assert.equal(a.length, 3);
  const b = voiceLead(a, [5, 9, 0], 52, 67);
  const move = b.reduce((s, n, i) => s + Math.abs(n - a[i]), 0);
  assert.ok(move <= 8, `smooth voice leading, moved ${move}`);
  const rng = mulberry32(42);
  const motif = makeMotif(rng, 1);
  assert.equal(motif.length, 16);
  assert.ok(motif.some(d => d !== null));
  assert.equal(varyMotif(motif, rng).length, 16);
});

test('Karplus–Strong render is tuned, normalised and decays', () => {
  const r = renderPluck(220, 22050, 1, 0.6, 0.996, mulberry32(7));
  assert.ok(Math.abs(r.baseFreq - 220) / 220 < 0.03);
  let peak = 0;
  for (const v of r.data) peak = Math.max(peak, Math.abs(v));
  assert.ok(peak <= 0.91 && peak > 0.3);
  const rms = (from: number, to: number) => { let s = 0; for (let i = from; i < to; i++) s += r.data[i] ** 2; return Math.sqrt(s / (to - from)); };
  assert.ok(rms(0, 2000) > rms(18000, 20000) * 3, 'energy decays');
});

test('farmers market days follow the Bay Area calendar', () => {
  assert.equal(isMarketDay(new Date('2026-09-26T18:00:00Z')), true); // Saturday in SF
  assert.equal(isMarketDay(new Date('2026-09-27T18:00:00Z')), false); // Sunday
});

test('F14: the three mis-heard Chinese barks stay muted until re-recorded (synth chirp + text instead)', async () => {
  const { MUTED_CLIPS } = await import('../src/opus-bay/audio/voice');
  // (wave 2: a re-record the owner approved is unmuted through lane H2b's data/voiceLinesSf.ts SF_VOICE_UNMUTE)
  const { SF_VOICE_UNMUTE } = await import('../src/opus-bay/data/voiceLinesSf');
  for (const id of ['zh-yay', 'zh-think', 'zh-arrived']) assert.ok(MUTED_CLIPS.has(id) || SF_VOICE_UNMUTE.includes(id), id);
  assert.ok(!MUTED_CLIPS.has('zh-hi') && !MUTED_CLIPS.has('en-yay'));
});

test('city cable cars: bell, grip clank and turntable creak from transit events; nothing for other kinds', async () => {
  const { transitSound } = await import('../src/opus-bay/audio/logic');
  assert.deepEqual(transitSound('bell', 'cable-car', 1), { kind: 'cable-bell', gain: 1, strikes: 3 });
  assert.equal(transitSound('bell', 'cable-car', 0.3)!.strikes, 2, 'a far car rings shorter');
  assert.ok(transitSound('bell', 'cable-car', 0)!.gain >= 0.15, 'never inaudible');
  assert.equal(transitSound('grip', 'cable-car')!.kind, 'grip-clank');
  assert.equal(transitSound('push', 'cable-car')!.kind, 'turntable-creak');
  assert.equal(transitSound('board', 'cable-car'), null);
  assert.equal(transitSound('bell', 'ferry'), null, 'the ferry has its own sounds (later)');
});

// ---------------------------------------------------------------------------
// P1 (wave-3 lead note): nothing heavy inside the first gesture
// ---------------------------------------------------------------------------

/** A Web Audio stand-in that records what it is asked to do (every node / param accepts any call). */
function fakeAudio() {
  const log: { op: string; frames?: number; channels?: number }[] = [];
  const param = () => ({ value: 0, setValueAtTime() {}, setTargetAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, cancelScheduledValues() {} });
  const node = (kind: string): Record<string, unknown> => {
    log.push({ op: kind });
    const target: Record<string, unknown> = {
      connect: (next: unknown) => next, disconnect() {}, start() {}, stop() {}, setPeriodicWave() {},
      addEventListener() {}, buffer: null, onended: null, type: '', loop: false,
    };
    return new Proxy(target, { get: (t, k: string) => (k in t ? t[k] : (t[k] = param())) });
  };
  class FakeContext {
    static made = 0;
    state: 'suspended' | 'running' | 'closed' = 'suspended';
    sampleRate = 48000;
    currentTime = 0;
    destination = node('destination');
    constructor() { FakeContext.made++; log.push({ op: 'new AudioContext' }); }
    createBuffer(channels: number, frames: number) {
      log.push({ op: 'createBuffer', frames, channels });
      const data = Array.from({ length: channels }, () => new Float32Array(frames));
      return { numberOfChannels: channels, length: frames, sampleRate: this.sampleRate, duration: frames / this.sampleRate, getChannelData: (c: number) => data[c] };
    }
    resume() { log.push({ op: 'resume' }); this.state = 'running'; return Promise.resolve(); }
    suspend() { log.push({ op: 'suspend' }); this.state = 'suspended'; return Promise.resolve(); }
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
  const win = {
    AudioContext: FakeContext,
    addEventListener: on, removeEventListener() {},
    setTimeout, clearTimeout, setInterval, clearInterval,
  };
  const doc = { visibilityState: 'visible', addEventListener: on, removeEventListener() {} };
  return { log, FakeContext, win, doc, fire: (type: string) => (listeners.get(type) ?? []).forEach(fn => fn({})) };
}

test('P1: preparation runs in slices before any gesture; the first gesture only resumes and plays the unlock sample', async () => {
  const fake = fakeAudio();
  const g = globalThis as unknown as Record<string, unknown>;
  const saved = { window: g.window, document: g.document };
  g.window = fake.win;
  g.document = fake.doc;
  const { startAudio } = await import('../src/opus-bay/audio/audio');
  const { game } = await import('../src/opus-bay/core/store');
  const stop = startAudio();
  try {
    assert.equal(fake.FakeContext.made, 0, 'mount does nothing synchronously');
    // idle slices open the context and synthesise everything (node has no requestIdleCallback: setTimeout slices)
    const bigBuffers = () => fake.log.filter(e => e.op === 'createBuffer' && (e.frames ?? 0) > 1000).length;
    // done when the rig exists (the ambience starts its streetcar whine oscillator)
    for (let i = 0; i < 1000 && !(bigBuffers() >= 4 && fake.log.some(e => e.op === 'oscillator')); i++) await new Promise(r => setTimeout(r, 5));
    assert.equal(fake.FakeContext.made, 1);
    const big = fake.log.filter(e => e.op === 'createBuffer' && (e.frames ?? 0) > 1000);
    assert.equal(big.length, 4, 'white, pink, brown noise and the reverb impulse were made before the gesture');
    assert.ok(!fake.log.some(e => e.op === 'resume'), 'the context stays suspended until the player acts');

    // the gesture: the title is skipped (?start=free), the first key press activates audio
    game.set({ phase: 'free' } as never);
    const before = fake.log.length;
    const t0 = performance.now();
    fake.fire('keydown');
    const ms = performance.now() - t0;
    const during = fake.log.slice(before);
    assert.equal(fake.FakeContext.made, 1, 'no new context in the gesture');
    assert.deepEqual(during.filter(e => e.op === 'createBuffer').map(e => e.frames), [1], 'only the 1-sample unlock buffer');
    assert.ok(during.some(e => e.op === 'resume'), 'resumed inside the gesture');
    assert.ok(ms < 30, `the gesture took ${ms.toFixed(1)} ms`);
    // a later key press does no setup at all
    const again = fake.log.length;
    fake.fire('keydown');
    assert.ok(fake.log.slice(again).every(e => e.op !== 'createBuffer' && e.op !== 'new AudioContext'));
  } finally {
    stop();
    g.window = saved.window;
    g.document = saved.document;
  }
});

test('P1: the sliced jobs keep every unit of work small (4 ms slices hold on a 4x slower phone)', async () => {
  const { runSliced, drain } = await import('../src/opus-bay/audio/slices');
  const { engineBuffersJob } = await import('../src/opus-bay/audio/engine');
  const { shoreJob, describeWorld } = await import('../src/opus-bay/audio/ambience');
  const { DISTRICT } = await import('../src/opus-bay/data/district');
  // the runner stops a slice once the budget is spent (fake clock: every step costs 1 ms)
  let clock = 0;
  const queue: (() => void)[] = [];
  const host = { now: () => clock, next: (run: () => void) => { queue.push(run); return () => {}; } };
  function* job() { for (let i = 0; i < 10; i++) { clock += 1; yield; } return 'done'; }
  const sliced = runSliced(job(), host, 4);
  while (queue.length) queue.shift()!();
  assert.equal(await sliced.done, 'done');
  assert.equal(sliced.stats.slices, 3, '10 steps of 1 ms in 4 ms slices');
  assert.ok(sliced.stats.longest <= 4);

  const timeSteps = (it: Generator<void, unknown, void>) => {
    const steps: number[] = [];
    for (;;) {
      const t = performance.now();
      const r = it.next();
      steps.push(performance.now() - t);
      if (r.done) return steps.sort((a, b) => a - b);
    }
  };
  const fake = fakeAudio();
  const ctx = new fake.FakeContext() as unknown as BaseAudioContext;
  const p95 = (s: number[]) => s[Math.floor(s.length * 0.95)];
  // best of three runs (the machine may be busy): p95 of a unit < 0.5 ms here (< 2 ms at 4x CPU), so a 4 ms slice
  // overruns by one small unit at most
  let synth = Infinity, shore = Infinity, steps = 0;
  for (let run = 0; run < 3; run++) {
    const a = timeSteps(engineBuffersJob(ctx)), b = timeSteps(shoreJob(DISTRICT));
    synth = Math.min(synth, p95(a));
    shore = Math.min(shore, p95(b));
    steps = a.length + b.length;
  }
  assert.ok(steps > 500, `the jobs yield often (${steps} units)`);
  assert.ok(synth < 0.5, `buffer synthesis p95 step ${synth.toFixed(3)} ms`);
  assert.ok(shore < 0.5, `shore field p95 step ${shore.toFixed(3)} ms`);
  // the sliced shore field is the same field as the one-shot build
  const a = drain(shoreJob(DISTRICT))!;
  const b = describeWorld(DISTRICT, true).shore!;
  assert.deepEqual([a.cols, a.rows, a.distanceAt(60, 120)], [b.cols, b.rows, b.distanceAt(60, 120)]);
});
