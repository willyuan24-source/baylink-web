import assert from 'node:assert/strict';
import { test } from 'node:test';

/**
 * Wave 8 · lane H · BAYBAY's new fixed lines (lane X records them into data/sf/voiceW8.ts, matched by exact text):
 * halloween/worldLines.ts W8_WORLD_LINES (w8-h-*: the Chinatown Halloween Festival, the procession stepping aside) and
 * halloween/lines.ts W8_HALLOWEEN_LINES (w8h-*: the pelican's pumpkin bow). Short, bilingual, never templated, no
 * clock times, ids unique across every Halloween table; the older recording lists unchanged.
 */

const WL = await import('../src/opus-bay/halloween/worldLines');
const HL = await import('../src/opus-bay/halloween/lines');

const hasZh = (s: string) => /[一-鿿]/.test(s);
const zhLen = (s: string) => [...s].length;

test('W8-H lines: the wave-8 lines are fixed, short, bilingual, unique; wave 6 / 7 lists unchanged', () => {
  const all = [...WL.EVERY_WORLD_LINE, ...HL.HALLOWEEN_LINES, ...HL.W7_HALLOWEEN_LINES, ...HL.W8_HALLOWEEN_LINES];
  assert.equal(new Set(all.map(l => l.id)).size, all.length, 'ids unique across the Halloween tables');
  assert.equal(new Set(all.map(l => l.zh)).size, all.length, 'texts unique (the voice matches by text)');
  const w8 = [...WL.W8_WORLD_LINES, ...HL.W8_HALLOWEEN_LINES];
  assert.ok(WL.W8_WORLD_LINES.length >= 3 && HL.W8_HALLOWEEN_LINES.length >= 1);
  for (const l of WL.W8_WORLD_LINES) assert.match(l.id, /^w8-h-[a-z0-9-]+$/, l.id);
  for (const l of HL.W8_HALLOWEEN_LINES) assert.match(l.id, /^w8h-[a-z0-9-]+$/, l.id);
  for (const l of w8) {
    assert.ok(hasZh(l.zh) && !hasZh(l.en) && l.en.trim().length > 0, `${l.id}: bilingual`);
    assert.ok(zhLen(l.zh) <= 45 && l.en.length <= 110, `${l.id}: short`);
    assert.doesNotMatch(l.zh + l.en, /\$\{|undefined|NaN|\d{1,2}:\d{2}|\d/, `${l.id}: fixed text, no number`);
  }
  assert.ok(WL.ALL_WORLD_LINES.every(l => l.id.startsWith('w6-h-')) && WL.W7_WORLD_LINES.every(l => l.id.startsWith('w7-h-')));
  assert.equal(WL.EVERY_WORLD_LINE.length, WL.ALL_WORLD_LINES.length + WL.W7_WORLD_LINES.length + WL.W8_WORLD_LINES.length + WL.W9_WORLD_LINES.length); // W9-H: + wave 9's
  assert.deepEqual(HL.hLine('w8h-costume-pumpkin-bow'), { zh: HL.W8_HALLOWEEN_LINES[0].zh, en: HL.W8_HALLOWEEN_LINES[0].en });
  for (const k of ['chinatownContest', 'chinatownLanterns', 'processionAside'] as const) assert.ok(WL.lineText(k).zh.length > 0, k);
});
