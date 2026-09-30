/**
 * W7-Q2 · the decoded voice clips are capped (audio/voice.ts: an LRU by count and bytes). Before: every clip played or
 * preloaded stayed decoded for the page's life (100–300 MB of native PCM in a long iPhone session).
 */
import assert from 'node:assert/strict';
import test from 'node:test';

const SECONDS = 4;
const RATE = 48000;

async function player() {
  const { VoicePlayer, CLIP_CACHE_BYTES, CLIP_CACHE_MAX, clipBytes } = await import('../src/opus-bay/audio/voice');
  const { ASSETS } = await import('../src/opus-bay/data/assets');
  const decoded: string[] = [];
  let lastUrl = '';
  const g = globalThis as unknown as Record<string, unknown>;
  const savedFetch = g.fetch;
  g.fetch = async (url: string) => { lastUrl = url; return { ok: true, headers: { get: () => 'audio/mp4' }, arrayBuffer: async () => new ArrayBuffer(8) }; };
  const engine = {
    ctx: { decodeAudioData: async () => { decoded.push(lastUrl); return { length: SECONDS * RATE, numberOfChannels: 1, duration: SECONDS, sampleRate: RATE }; } },
    log() {}, now: 0, voice: () => null, buffer() {}, buses: { music: { duck() {} }, ambience: { duck() {} } },
  };
  const v = new VoicePlayer(engine as never);
  const list = (ids: string[]) => { for (const id of ids) (ASSETS.voice as Record<string, string>)[id] ??= `/test/${id}.m4a`; return ids; };
  return { v, decoded, list, CLIP_CACHE_BYTES, CLIP_CACHE_MAX, clipBytes, restore: () => { g.fetch = savedFetch; } };
}

test('W7-Q2 100 clips loaded: the cache holds at most CLIP_CACHE_MAX clips and CLIP_CACHE_BYTES; the barks stay', async () => {
  const { v, list, CLIP_CACHE_BYTES, CLIP_CACHE_MAX, restore } = await player();
  try {
    const barks = list(['zh-hi', 'zh-wow', 'zh-this-way', 'en-hi', 'en-yay']);
    for (const id of barks) await v.load(id);
    const ids = list(Array.from({ length: 100 }, (_, i) => `zh-w7q-line-${i}`));
    for (const id of ids) await v.load(id);
    const s = v.cacheStats();
    assert.ok(s.clips <= CLIP_CACHE_MAX, `${s.clips} clips`);
    assert.ok(s.bytes <= CLIP_CACHE_BYTES, `${(s.bytes / 2 ** 20).toFixed(1)} MB`);
    assert.ok(s.evicted >= 100 + barks.length - CLIP_CACHE_MAX, `${s.evicted} evicted`);
    // 4 s clips are 0.73 MB: the byte cap binds first (≈ 43 clips)
    assert.equal(s.clips, Math.floor(32 * 1024 * 1024 / (SECONDS * RATE * 4)));
    const { audioProbe } = await import('../src/opus-bay/audio/unlock');
    assert.equal(audioProbe.clips, s.clips, 'the ?debug line reads the same numbers');
    assert.equal(audioProbe.clipBytes, s.bytes);
    // the barks were loaded first, yet none was evicted
    const internal = (v as unknown as { clips: Map<string, unknown> }).clips;
    for (const id of barks) assert.ok(internal.get(id), `${id} pinned`);
    // the newest lines are there, the oldest went
    assert.ok(internal.get('zh-w7q-line-99'));
    assert.ok(!internal.has('zh-w7q-line-0'));
  } finally { restore(); }
});

test('W7-Q2 least recently USED goes first; the current stop\'s clips and the null markers are never evicted', async () => {
  const { v, decoded, list, restore } = await player();
  try {
    const stop = list(['zh-w7q-stop-a', 'zh-w7q-stop-b']);
    v.loadStop(stop);
    await v.load(stop[0]); await v.load(stop[1]);
    // a muted id is a null marker (MUTED_CLIPS: zh-yay until re-recorded) — kept, free
    await v.load('zh-yay');
    const early = list(['zh-w7q-early'])[0];
    await v.load(early);
    const fill = list(Array.from({ length: 80 }, (_, i) => `zh-w7q-fill-${i}`));
    for (let i = 0; i < fill.length; i++) {
      await v.load(fill[i]);
      await v.load(early); // used again every time: the most recently used, never the one evicted
    }
    const internal = (v as unknown as { clips: Map<string, unknown> }).clips;
    assert.ok(internal.get(early), 'a clip in use stays');
    for (const id of stop) assert.ok(internal.get(id), `${id}: the stop's clip stays`);
    assert.ok(internal.has('zh-yay') && internal.get('zh-yay') === null, 'the null marker stays');
    assert.ok(v.cacheStats().markers >= 1);
    // an evicted clip is fetched and decoded again when wanted
    const n = decoded.length;
    assert.ok(!internal.has(fill[0]));
    assert.ok(await v.load(fill[0]));
    assert.equal(decoded.length, n + 1);
    // the next stop replaces the pins: the old stop's clips are ordinary LRU entries again
    v.loadStop(list(['zh-w7q-stop-c']));
    for (let i = 0; i < 60; i++) await v.load(list([`zh-w7q-more-${i}`])[0]);
    assert.ok(!internal.has(stop[0]), 'the previous stop\'s clip could go');
    assert.ok(internal.get('zh-w7q-stop-c'));
    v.dispose();
    assert.equal(v.cacheStats().clips, 0, 'dispose drops the buffers');
  } finally { restore(); }
});
