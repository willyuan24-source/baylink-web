/**
 * Wave 7 · lane X (W7-X2): BAYBAY's wave-7 voice — the fixed lines no earlier batch had (data/sf/voiceW7.ts, matched by
 * the binder game/voiceW5.ts by exact zh + en), and the retakes of wave-6 clips (they replace the wave-6 takes).
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '..');

test('W7-X2 · every wave-7 line is recorded in zh and en (files on disk) and BAYBAY\'s bubble with its exact text finds it', async () => {
  const { W7_VOICE_LINES, W7_VOICE_CHECK, W7_VOICE_CLIPS } = await import('../src/opus-bay/data/sf/voiceW7');
  const { W5_VOICE_LINES } = await import('../src/opus-bay/data/sf/voiceW5');
  const { W6_VOICE_LINES } = await import('../src/opus-bay/data/sf/voiceW6');
  const { w5VoiceFor } = await import('../src/opus-bay/game/voiceW5');
  assert.ok(W7_VOICE_LINES.length >= 50, `${W7_VOICE_LINES.length} lines`);
  const key = (l: { zh: string; en: string }) => `${l.zh}\n${l.en}`;
  const earlier = new Set([...W5_VOICE_LINES, ...W6_VOICE_LINES].map(key));
  const ids = new Set<string>();
  for (const l of W7_VOICE_LINES) {
    assert.ok(!ids.has(l.id), `${l.id} unique`);
    ids.add(l.id);
    assert.ok(!earlier.has(key(l)), `${l.id}: an earlier batch already has these words`);
    assert.ok(!/\$\{/.test(l.zh + l.en), `${l.id} is not a template`);
    assert.equal(w5VoiceFor({ zh: l.zh, en: l.en }), l.own ? null : l.id, l.id);
  }
  for (const [clip, c] of Object.entries(W7_VOICE_CLIPS)) {
    for (const f of [c.m4a, c.ogg]) {
      const disk = path.join(ROOT, 'public', f!);
      assert.ok(fs.existsSync(disk) && fs.statSync(disk).size > 2000, `${clip}: ${f}`);
    }
    assert.ok(c.duration > 0.3 && c.duration < 10.5, `${clip} ${c.duration} s`);
  }
  assert.ok(W7_VOICE_CHECK.every(c => c in W7_VOICE_CLIPS));
  // the chip hints (not bubbles) are left out
  for (const zh of ['影子变金色时点它，或按 E', '点海狮，或按 E']) assert.ok(!W7_VOICE_LINES.some(l => l.zh === zh), zh);
  // the lines wave 6 left without a voice: hide & seek and the Lyon Street Steps' top fact
  for (const zh of ['等一下再玩捉迷藏吧～', '我在这儿呢～下次再来找我！', '里昂街台阶大约 300 级，一路修剪整齐的树篱，正对着艺术宫！']) {
    assert.ok(W7_VOICE_LINES.some(l => l.zh === zh), zh);
  }
});

test('W7-X2 · a retake replaces its wave-6 take (registered first, under the wave-6 clip id); the others keep wave 6', async () => {
  const { W7_RETAKE_CLIPS } = await import('../src/opus-bay/data/sf/voiceW7');
  await import('../src/opus-bay/game/voiceW5');
  const { ASSETS } = await import('../src/opus-bay/data/assets');
  const { W6_VOICE_CLIPS } = await import('../src/opus-bay/data/sf/voiceW6');
  const retakes = Object.keys(W7_RETAKE_CLIPS);
  assert.ok(retakes.length >= 1);
  for (const clip of retakes) {
    assert.ok(clip in W6_VOICE_CLIPS, `${clip} is a wave-6 clip`);
    assert.equal(W7_RETAKE_CLIPS[clip].text, W6_VOICE_CLIPS[clip].text, `${clip} says the same words`);
    assert.match(ASSETS.voice[clip] ?? '', /\/opus-bay\/w7\/voice\//, `${clip} plays the retake`);
    for (const f of [W7_RETAKE_CLIPS[clip].m4a, W7_RETAKE_CLIPS[clip].ogg]) assert.ok(fs.existsSync(path.join(ROOT, 'public', f!)), f);
  }
  const kept = Object.keys(W6_VOICE_CLIPS).find(c => !retakes.includes(c))!;
  assert.match(ASSETS.voice[kept] ?? '', /\/opus-bay\/w6\/voice\//, `${kept} keeps its wave-6 take`);
  // the binder imports wave 7's table before wave 6's (the retakes win the registration)
  const src = fs.readFileSync(path.join(ROOT, 'src/opus-bay/game/voiceW5.ts'), 'utf8');
  assert.ok(src.indexOf("from '../data/sf/voiceW7'") < src.indexOf("from '../data/sf/voiceW6'"));
});
