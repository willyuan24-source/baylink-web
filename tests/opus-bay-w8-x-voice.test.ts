/**
 * Wave 8 · lane X (W8-X1): BAYBAY's wave-8 voice — the fixed lines no earlier batch had (data/sf/voiceW8.ts: lane M's
 * wave-7 game lines, lane K's plain bubbles, wave 8's new lines), matched by the binder game/voiceW5.ts by exact zh + en,
 * and the faster retakes of wave 7's muted clips (W8_RETAKE_CLIPS: registered under the wave-7 ids, unmuted).
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '..');

/** every source file of the game, read once (a recorded line must be said somewhere, verbatim) */
function sources(): string {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.tsx?$/.test(e.name) && !/[\\/]data[\\/]sf[\\/]voiceW\d\.ts$/.test(p)) out.push(fs.readFileSync(p, 'utf8'));
    }
  };
  walk(path.join(ROOT, 'src/opus-bay'));
  return out.join('\n');
}

test('W8-X1 · every wave-8 line is recorded in zh and en (files on disk) and BAYBAY\'s bubble with its exact text finds it; a line the game no longer says is reported', async (t) => {
  const { W8_VOICE_LINES, W8_VOICE_CHECK, W8_VOICE_CLIPS } = await import('../src/opus-bay/data/sf/voiceW8');
  const { W5_VOICE_LINES } = await import('../src/opus-bay/data/sf/voiceW5');
  const { W6_VOICE_LINES } = await import('../src/opus-bay/data/sf/voiceW6');
  const { W7_VOICE_LINES } = await import('../src/opus-bay/data/sf/voiceW7');
  const { w5VoiceFor, w5VoiceMuted } = await import('../src/opus-bay/game/voiceW5');
  assert.ok(W8_VOICE_LINES.length >= 50, `${W8_VOICE_LINES.length} lines`);
  const key = (l: { zh: string; en: string }) => `${l.zh}\n${l.en}`;
  const earlier = new Set([...W5_VOICE_LINES, ...W6_VOICE_LINES, ...W7_VOICE_LINES].map(key));
  const earlierIds = new Set([...W5_VOICE_LINES, ...W6_VOICE_LINES, ...W7_VOICE_LINES].map(l => l.id));
  const src = sources();
  const lit = (s: string) => [s, JSON.stringify(s).slice(1, -1), s.replace(/'/g, "\\'")].some(v => src.includes(v));
  const ids = new Set<string>(), dead: string[] = [];
  for (const l of W8_VOICE_LINES) {
    assert.ok(!ids.has(l.id), `${l.id} unique`);
    ids.add(l.id);
    assert.ok(!earlierIds.has(l.id), `${l.id}: an earlier table has this id`);
    assert.ok(!earlier.has(key(l)), `${l.id}: an earlier batch already has these words`);
    assert.ok(!/\$\{/.test(l.zh + l.en), `${l.id} is not a template`);
    // a lane may still reword a line after it was recorded (the clip then simply stays unmatched: text only); the review /
    // the next batch's post.py --prune drops it — reported here, not a failure for the other lanes
    if (!(lit(l.zh) && lit(l.en))) dead.push(l.id);
    assert.equal(w5VoiceFor({ zh: l.zh, en: l.en }), l.own ? null : l.id, l.id);
  }
  if (dead.length) t.diagnostic(`recorded but no longer said verbatim: ${dead.join(', ')}`);
  for (const [clip, c] of Object.entries(W8_VOICE_CLIPS)) {
    for (const f of [c.m4a, c.ogg]) {
      const disk = path.join(ROOT, 'public', f!);
      assert.ok(fs.existsSync(disk) && fs.statSync(disk).size > 2000, `${clip}: ${f}`);
    }
    assert.ok(c.duration > 0.3 && c.duration < 10.5, `${clip} ${c.duration} s`);
  }
  assert.ok(W8_VOICE_CHECK.every(c => c in W8_VOICE_CLIPS));
  for (const c of W8_VOICE_CHECK) assert.equal(w5VoiceMuted(c), true, `${c} stays text only until approved`);
  // lane M's wave-7 games (play/sfgamesLines.ts): the claw, the crab nets and the sourdough
  const { CLAW_LINES, CRAB_LINES, DOUGH_LINES } = await import('../src/opus-bay/play/sfgamesLines');
  for (const l of [...Object.values(CLAW_LINES), ...Object.values(CRAB_LINES), ...Object.values(DOUGH_LINES)]) {
    assert.ok(w5VoiceFor(l), `${l.zh} is voiced`);
  }
  // the fortune teller's printed card is not a bubble: never recorded
  assert.ok(!W8_VOICE_LINES.some(l => l.zh === '你会在一个意想不到的地方找到宝藏。'));
});

test('W8-X1 · a kept retake plays a muted wave-7 clip (registered under the wave-7 id, from /w8/voice/, unmuted); the others stay muted', async () => {
  const { W8_RETAKE_CLIPS } = await import('../src/opus-bay/data/sf/voiceW8');
  const { w5VoiceMuted } = await import('../src/opus-bay/game/voiceW5');
  const { ASSETS } = await import('../src/opus-bay/data/assets');
  const { W7_VOICE_CHECK, W7_VOICE_CLIPS } = await import('../src/opus-bay/data/sf/voiceW7');
  for (const [clip, c] of Object.entries(W8_RETAKE_CLIPS)) {
    assert.ok(W7_VOICE_CHECK.includes(clip), `${clip} was a muted wave-7 clip`);
    assert.equal(c.text, W7_VOICE_CLIPS[clip].text, `${clip} says the same words`);
    assert.match(ASSETS.voice[clip] ?? '', /\/opus-bay\/w8\/voice\//, `${clip} plays the retake`);
    assert.equal(w5VoiceMuted(clip), false, `${clip} is no longer muted`);
    for (const f of [c.m4a, c.ogg]) assert.ok(fs.existsSync(path.join(ROOT, 'public', f!)) && fs.statSync(path.join(ROOT, 'public', f!)).size > 2000, f);
  }
  for (const clip of W7_VOICE_CHECK.filter(c => !(c in W8_RETAKE_CLIPS))) {
    assert.equal(w5VoiceMuted(clip), true, `${clip} stays muted`);
    assert.equal(ASSETS.voice[clip], undefined, `${clip} has no file registered`);
  }
  // the binder imports wave 8's table before wave 7's
  const src = fs.readFileSync(path.join(ROOT, 'src/opus-bay/game/voiceW5.ts'), 'utf8');
  assert.ok(src.indexOf("from '../data/sf/voiceW8'") < src.indexOf("from '../data/sf/voiceW7'"));
});

test('W8-X-review · BAYBAY\'s bubble stays up while her clip plays: a matched line and a lane\'s own voice-line hold it to the clip\'s length (never shorter, never past the cap)', async () => {
  const { bubble } = await import('../src/opus-bay/game/flow');
  const { flow } = await import('../src/opus-bay/game/flowStore');
  const { emit } = await import('../src/opus-bay/core/events');
  const { initW5Voice, w5VoiceSeconds, VOICE_HOLD_MAX } = await import('../src/opus-bay/game/voiceW5');
  const { W8_VOICE_LINES } = await import('../src/opus-bay/data/sf/voiceW8');
  const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
  const off = initW5Voice();
  try {
    // the Alcatraz landing line (≈ 8–9 s) given a 4.6 s bubble by its lane: here 80 ms, read back at 300 ms
    const ashore = W8_VOICE_LINES.find(l => l.id === 'w5-al-ae4cef3d')!;
    assert.ok(w5VoiceSeconds(ashore.id) > 7 && w5VoiceSeconds(ashore.id) * 1000 < VOICE_HOLD_MAX);
    assert.equal(bubble({ zh: ashore.zh, en: ashore.en }, 80), true);
    await wait(300);
    assert.equal(flow.get().bubble?.text.zh, ashore.zh, 'the words stay while she says them');
    // a lane's own line (lane S's parade): its voice-line event holds the bubble it just showed
    const parade = W8_VOICE_LINES.find(l => l.id === 'realsf-parade-near')!;
    assert.equal(bubble({ zh: parade.zh, en: parade.en }, 80), true);
    emit({ type: 'voice-line', id: parade.id });
    await wait(300);
    assert.equal(flow.get().bubble?.text.zh, parade.zh);
    // an unrecorded text keeps its own ms
    bubble({ zh: '测试一句没有录音的话', en: 'A test line with no recording' }, 80);
    await wait(300);
    assert.equal(flow.get().bubble, null);
  } finally {
    off();
    bubble({ zh: '清', en: 'clear' }, 1);
    await wait(20);
  }
});
