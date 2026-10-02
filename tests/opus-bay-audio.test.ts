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

// ---------------------------------------------------------------------------
// F10: the city's soundscape
// ---------------------------------------------------------------------------

test('F10: buildShoreField({bounds, cell, isLand}): distances and the way to the water from any land test', async () => {
  const { buildShoreField: build, shoreGridJob, SHORE_GRID_CHUNK } = await import('../src/opus-bay/audio/logic');
  // land east of x = 0 with a round island at (−60, 0) r 10 and a lake in the land at (60, 40) r 8
  const isLand = (x: number, z: number) => (x > 0 && Math.hypot(x - 60, z - 40) > 8) || Math.hypot(x + 60, z) < 10;
  const f = build({ bounds: { minX: -128, minZ: -128, maxX: 128, maxZ: 128 }, cell: 4, isLand });
  assert.equal(f.cols, 64);
  assert.ok(f.distanceAt(-30, -80) < 1, 'open water');
  const coast = f.distanceAt(20, -80);
  assert.ok(coast > 14 && coast < 26, `20 u inland from the coast: ${coast.toFixed(1)}`);
  // a lake inside the land is not the sea (no waves by a pond); the island in the sea is land
  const lake = f.distanceAt(60, 52);
  assert.ok(lake > 40, `by the lake, far from the sea: ${lake.toFixed(1)}`);
  assert.ok(f.distanceAt(-60, 0) > 4 && f.distanceAt(-60, 0) < 14, 'the island\'s middle');
  const dir = f.waterDirAt(20, -80);
  assert.ok(dir.x < -0.9, `the water lies west: ${JSON.stringify(dir)}`);
  // the job yields every SHORE_GRID_CHUNK land tests and every transform row
  let tests = 0, yields = 0, maxRun = 0, run = 0;
  const job = shoreGridJob({ bounds: { minX: -128, minZ: -128, maxX: 128, maxZ: 128 }, cell: 4, isLand: (x, z) => { tests++; run++; return isLand(x, z); } });
  for (let r = job.next(); !r.done; r = job.next()) { yields++; maxRun = Math.max(maxRun, run); run = 0; }
  assert.equal(tests, 64 * 64);
  assert.ok(maxRun <= SHORE_GRID_CHUNK && yields > 64, `≤ ${SHORE_GRID_CHUNK} tests between yields (${maxRun}), ${yields} yields`);
  // a unit of the job stays small (4 ms slices; the city's 128 × 128 window): p95 of the units, best of three runs (the
  // suite runs files in parallel: one GC pause must not fail it)
  const big = { bounds: { minX: -256, minZ: -256, maxX: 256, maxZ: 256 }, cell: 4, isLand };
  let p95 = Infinity;
  for (let run = 0; run < 3; run++) {
    const units: number[] = [];
    const it = shoreGridJob(big);
    for (;;) { const t = performance.now(); const r = it.next(); units.push(performance.now() - t); if (r.done) break; }
    units.sort((a, b) => a - b);
    p95 = Math.min(p95, units[Math.floor(units.length * 0.95)]);
  }
  assert.ok(p95 < 1, `p95 unit ${p95.toFixed(3)} ms`);
});

test('F10: the city shore window (±256 u, 4 u cells, rebuilt after 96 u)', async () => {
  const { CITY_SHORE, shoreWindow, shoreRebuildDue } = await import('../src/opus-bay/audio/logic');
  assert.deepEqual([CITY_SHORE.half, CITY_SHORE.cell, CITY_SHORE.rebuildAfter], [256, 4, 96]);
  const w = shoreWindow(101, -37);
  assert.deepEqual(w, { minX: 100 - 256, minZ: -36 - 256, maxX: 100 + 256, maxZ: -36 + 256 });
  assert.equal(shoreRebuildDue(null, 0, 0), true);
  assert.equal(shoreRebuildDue({ x: 0, z: 0 }, 60, 60), false);
  assert.equal(shoreRebuildDue({ x: 0, z: 0 }, 80, 60), true);
});

test('F10: the whole city\'s shore field on the published terrain; the Pacific side of the Golden Gate', async () => {
  const { sfDisk } = await import('./opus-bay-sf-disk');
  const { createCityTerrain, landmarkWalkInputs } = await import('../src/opus-bay/core/sfTerrain');
  const { isLand, setCityTerrain } = await import('../src/opus-bay/core/terrain');
  const { SF_LANDMARKS } = await import('../src/opus-bay/world/sf/landmarks/index');
  const { drain } = await import('../src/opus-bay/audio/slices');
  const { shoreGridJob, shoreWindow } = await import('../src/opus-bay/audio/logic');
  const { pacific, gateSide, GOLDEN_GATE } = await import('../src/opus-bay/audio/city');
  const sf = sfDisk();
  const city = createCityTerrain(sf.manifest, { landmarks: landmarkWalkInputs(SF_LANDMARKS) });
  city.setFar(await sf.far());
  setCityTerrain(city, { heroDropLots: new Set(sf.manifest.heroDropLots) });
  try {
    const at = (x: number, z: number) => drain(shoreGridJob({ bounds: shoreWindow(x, z), cell: 4, isLand })).distanceAt(x, z);
    // (far 8 u map: no chunk attached) Ocean Beach's sand by the surf, Twin Peaks far from any water, Crissy Field's shore
    const beach = at(-455, 1470), peaks = at(140, 947), crissy = at(-576, 546);
    assert.ok(beach < 40, `Ocean Beach ${beach.toFixed(0)} u from the water`);
    assert.ok(peaks > 200, `Twin Peaks ${peaks.toFixed(0)} u from the water`);
    assert.ok(crissy < 40, `Crissy Field ${crissy.toFixed(0)} u from the water`);
    // the ocean side of the bridge line
    assert.ok(Math.abs(gateSide(GOLDEN_GATE.mid.x, GOLDEN_GATE.mid.z)) < 1, 'the bridge is the line');
    for (const [name, x, z] of [['Ocean Beach', -431, 1475], ['Baker Beach', -614, 849], ['Lands End', -741, 1093]] as const) assert.equal(pacific(x, z), 1, name);
    for (const [name, x, z] of [['Crissy Field', -576, 546], ['Alcatraz', -468, -58], ['Ferry Building', 128, 15], ['Mission Bay', 427, 261]] as const) assert.equal(pacific(x, z), 0, name);
  } finally { setCityTerrain(null); }
});

test('F10: transit sounds for the city (ferry horn, hop-aside squeak, turntable rumble) and located events', async () => {
  const { transitSound, parkShare, cableHumLevel, buskerLevel, distToFlatPolyline } = await import('../src/opus-bay/audio/logic');
  const { emitAt, soundAt } = await import('../src/opus-bay/audio/cityHooks');
  const { onEvent } = await import('../src/opus-bay/core/events');
  assert.deepEqual(transitSound('horn', 'ferry', 0.5), { kind: 'ferry-horn', gain: 0.5, strikes: 1 });
  assert.equal(transitSound('horn', 'cable-car'), null);
  assert.equal(transitSound('hop-aside', 'bus', 1)!.kind, 'hop-squeak');
  assert.equal(transitSound('turned', 'cable-car')!.kind, 'turntable-rumble');
  assert.equal(transitSound('bell', 'ferry'), null);
  assert.equal(parkShare(['grass', 'grass', 'road', 'dirt']), 0.75);
  assert.equal(parkShare([]), 0);
  assert.equal(cableHumLevel(1), 1);
  assert.equal(cableHumLevel(20), 0);
  assert.ok(buskerLevel(30) > 0 && buskerLevel(30) < 0.3 && buskerLevel(45) === 0);
  assert.equal(distToFlatPolyline(5, 3, [0, 0, 0, 10, 0, 0]), 3);
  assert.equal(distToFlatPolyline(5, 3, [0, 0, 10, 0], 2), 3);
  // emitAt: listeners see where the event happened, only during the emit
  const seen: { x: number; z: number; set: boolean }[] = [];
  const off = onEvent(ev => { if (ev.type === 'foghorn') seen.push({ ...soundAt }); });
  emitAt({ type: 'foghorn' }, 12, -4);
  off();
  assert.deepEqual(seen, [{ x: 12, z: -4, set: true }]);
  assert.equal(soundAt.set, false);
});

test('F10: the city layers run on a context (surf, birds, buskers, cable hum, ferry engine, passes) and stay quiet in the district', async () => {
  const fake = fakeAudio();
  const { drain } = await import('../src/opus-bay/audio/slices');
  const { AudioEngine, engineBuffersJob } = await import('../src/opus-bay/audio/engine');
  const { Ambience, describeWorld } = await import('../src/opus-bay/audio/ambience');
  const { DISTRICT } = await import('../src/opus-bay/data/district');
  const { game } = await import('../src/opus-bay/core/store');
  const { runtime } = await import('../src/opus-bay/core/runtime');
  const { cityHooks, pushPass } = await import('../src/opus-bay/audio/cityHooks');
  const ctx = new fake.FakeContext() as unknown as BaseAudioContext & { currentTime: number };
  const engine = new AudioEngine(ctx, drain(engineBuffersJob(ctx)));
  const g = globalThis as unknown as Record<string, unknown>;
  const saved = g.window;
  g.window = fake.win;
  const prevMode = game.get().worldMode;
  try {
    // district: no city layers
    game.set({ worldMode: 'district', timeOfDay: 'day' } as never);
    const district = new Ambience(engine, describeWorld(DISTRICT, false));
    runtime.player.x = 345; runtime.player.z = 590;
    for (let i = 0; i < 20; i++) { ctx.currentTime += 0.1; district.update(0.1); }
    assert.equal(district['cityLayers'], null, 'the district builds no city layer');
    assert.equal(district.cityReady, null, 'nor loads their chunk');
    assert.equal(engine.stats.counts.busker ?? 0, 0);
    district.dispose();

    game.set({ worldMode: 'city', timeOfDay: 'day' } as never);
    const amb = new Ambience(engine, describeWorld(DISTRICT, false));
    const counts = () => engine.stats.counts;
    // a Mission busker's spot (Valencia & 24th); the city layers load with the first city tick
    runtime.player.x = 345; runtime.player.z = 590;
    amb.update(0.1);
    await amb.cityReady;
    for (let i = 0; i < 60; i++) { ctx.currentTime += 0.1; amb.update(0.1); }
    assert.ok((counts().busker ?? 0) > 10, `busker notes ${counts().busker}`);
    // a toy car passing close by → one pass-by sound
    const cars = counts().car ?? 0;
    pushPass({ x: 346, z: 592, heading: 0, v: 7, d: 2 });
    ctx.currentTime += 0.1; amb.update(0.1);
    assert.equal(counts().car ?? 0, cars + 1);
    assert.equal(cityHooks.passes.length, 0, 'drained');
    // the foghorn comes from the Golden Gate in city mode
    amb.foghorn();
    assert.ok((counts().foghorn ?? 0) >= 1);
    amb.dispose();
  } finally {
    game.set({ worldMode: prevMode } as never);
    g.window = saved;
  }
});

test('F10 (review): the ferry engine plays aboard only once the boat carries you, not while you wait on the quay', async () => {
  const fake = fakeAudio();
  const { drain } = await import('../src/opus-bay/audio/slices');
  const { AudioEngine, engineBuffersJob } = await import('../src/opus-bay/audio/engine');
  const { Ambience, describeWorld } = await import('../src/opus-bay/audio/ambience');
  const { DISTRICT } = await import('../src/opus-bay/data/district');
  const { game } = await import('../src/opus-bay/core/store');
  const { runtime } = await import('../src/opus-bay/core/runtime');
  const T = await import('../src/opus-bay/data/transit');
  const FL = await import('../src/opus-bay/data/ferryLine'); // (W9-P6) buildFerryLine's module
  const { FerrySystem } = await import('../src/opus-bay/world/ferry');
  const ctx = new fake.FakeContext() as unknown as BaseAudioContext & { currentTime: number };
  const engine = new AudioEngine(ctx, drain(engineBuffersJob(ctx)));
  const g = globalThis as unknown as Record<string, unknown>;
  const saved = g.window;
  g.window = fake.win;
  const prev = game.get();
  const sys = new FerrySystem(FL.buildFerryLine(T.FERRY_ROUTES.find(r => r.running)!));
  T.setActiveFerrySystem(sys);
  try {
    game.set({ worldMode: 'city', timeOfDay: 'day' } as never);
    const amb = new Ambience(engine, describeWorld(DISTRICT, false));
    amb.update(0.1);
    await amb.cityReady;
    const level = () => (amb.debugCity().city as { engine: number }).engine;
    // waiting at Pier 41 for the boat lying at Gate E (the ride's move mode is 'transit' from the start of the wait)
    const quay41 = T.FERRY_ROUTES.find(r => r.running)!.terminals.find(t => t.id === 'pier-41')!.quay;
    runtime.player.x = quay41.x; runtime.player.z = quay41.z;
    sys.request({ line: 'ferry', station: 'pier-41', dir: 1, to: 'ferry-building' });
    game.set({ move: { mode: 'transit', line: 'ferry', spot: 'deck' } } as never);
    for (let i = 0; i < 10; i++) { ctx.currentTime += 0.1; amb.update(0.1); }
    assert.equal(sys.rideStatus()?.phase, 'coming');
    assert.ok(level() < 0.05, `engine while waiting ${level()}`);
    // aboard: the engine is all round you
    sys.board();
    const b = sys.boat.pose;
    runtime.player.x = b.x; runtime.player.z = b.z;
    for (let i = 0; i < 3; i++) { ctx.currentTime += 0.1; amb.update(0.1); }
    assert.equal(level(), 1);
    amb.dispose();
  } finally {
    T.setActiveFerrySystem(null);
    game.set({ worldMode: prev.worldMode, move: prev.move } as never);
    g.window = saved;
  }
});
