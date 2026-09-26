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
  for (const id of ['zh-yay', 'zh-think', 'zh-arrived']) assert.ok(MUTED_CLIPS.has(id), id);
  assert.ok(!MUTED_CLIPS.has('zh-hi') && !MUTED_CLIPS.has('en-yay'));
});
