import assert from 'node:assert/strict';
import test from 'node:test';
import type { Bilingual } from '../src/opus-bay/core/types';

// Lane G2, wave 3, part a: BAYBAY's event and neighbourhood lines (G2-4): the frozen BARK_SCRIPT against lane H2b's
// recordings, the line texts, and the scheduler rules with a fake clock (60 s per key, ≥ 8 s between lines, never over a
// bubble, silent in dialogue / travel, greetings held while gliding, once per save).

// --- headless canvas stub (world modules create label atlases at import time; same as the contracts test) ---
const g = globalThis as unknown as Record<string, unknown>;
const noop = () => undefined;
const ctx2d = new Proxy({}, {
  get: (_t, k) => (k === 'measureText' ? () => ({ width: 10 }) : k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop: noop }) : k === 'getImageData' ? (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }) : noop),
  set: () => true,
});
g.window ??= globalThis;
g.document ??= { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => ctx2d }) };

const lines = await import('../src/opus-bay/data/sf/lines');
const { BARK_SCRIPT, BARK_SCRIPT_RECORDED, BARK_SCRIPT_TODO, EVENT_LINES, NEIGHBOURHOOD_LINES, barkLine, lineMs, neighbourhoodGreeting, neighbourhoodLine } = lines;
const { SF_VOICE_CLIPS, SF_VOICE_LINES, SF_VOICE_ZONES } = await import('../src/opus-bay/data/voiceLinesSf');
const { LINE_GAP, KEY_COOLDOWN, BUBBLE_SETTLE, LineScheduler, createLineMemory, lineEventOf, zoneKey, LINE_MEMORY_KEY } = await import('../src/opus-bay/game/baybayLines');
const { sfLandmark } = await import('../src/opus-bay/world/sf/landmarks/index');
const { ZH_GLOSSARY } = await import('../src/opus-bay/data/sf/cityPois');

type LineEvent = keyof typeof EVENT_LINES;
const bubbleWidth = (text: string) => [...text].reduce((sum, ch) => sum + (ch === ' ' ? 0 : ch.charCodeAt(0) < 128 ? 0.5 : 1), 0);
const filled = (text: Bilingual, where: string) => {
  assert.ok(text.zh.trim() && text.en.trim(), `${where}: bilingual text`);
  assert.ok(/[一-鿿]/.test(text.zh), `${where}: zh has Chinese`);
  assert.ok(!/[一-鿿]/.test(text.en), `${where}: en has no Chinese`);
  assert.ok(bubbleWidth(text.zh) <= 45, `${where}: zh ≤ 45 (${text.zh})`);
  assert.ok(text.en.length <= 110, `${where}: en ≤ 110`);
};
/** a bubble that speaks line `voice` starts with its phrase, in both languages */
const startsWithPhrase = (text: Bilingual, voice: string, where: string) => {
  const b = barkLine(voice);
  assert.ok(b, `${where}: ${voice} is in BARK_SCRIPT`);
  assert.ok(text.zh.startsWith(b.zh), `${where}: zh starts with "${b.zh}" (${text.zh})`);
  assert.ok(text.en.startsWith(b.en), `${where}: en starts with "${b.en}" (${text.en})`);
};

// ---------------------------------------------------------------------------
// BARK_SCRIPT (frozen) vs H2b's recordings
// ---------------------------------------------------------------------------

test('G2-4: BARK_SCRIPT recorded block is exactly H2b’s recorded lines; ids unique; phrases short', () => {
  const ids = BARK_SCRIPT.map(l => l.id);
  assert.equal(new Set(ids).size, ids.length, 'unique ids');
  assert.deepEqual(BARK_SCRIPT_RECORDED.map(l => l.id).sort(), Object.keys(SF_VOICE_LINES).sort(), 'the recorded block = SF_VOICE_LINES');
  for (const l of BARK_SCRIPT) {
    const rec = SF_VOICE_LINES[l.id];
    if (rec) {
      assert.equal(l.zh, rec.zh, `${l.id} zh as recorded`);
      assert.equal(l.en, rec.en, `${l.id} en as recorded`);
      assert.equal(l.mood, rec.mood, `${l.id} mood as recorded`);
      for (const lang of ['zh', 'en']) {
        const clip = SF_VOICE_CLIPS[`${lang}-${l.id}`];
        assert.ok(clip && clip.duration > 0 && clip.duration <= 2.0, `${lang}-${l.id}: a clip ≤ 2 s`);
      }
    }
    // ≤ 2 s spoken: ~5 zh syllables a second, ~2.8 en words a second
    const syllables = [...l.zh].filter(ch => /[一-鿿]/.test(ch)).length;
    assert.ok(syllables >= 1 && syllables <= 9, `${l.id}: zh phrase ≤ 9 syllables`);
    assert.ok(l.en.split(/\s+/).length <= 6, `${l.id}: en phrase ≤ 6 words`);
  }
  assert.ok(BARK_SCRIPT_TODO.length >= 8, 'a not-recorded-yet block for the next H2b pass');
  for (const l of BARK_SCRIPT_TODO) assert.ok(!SF_VOICE_LINES[l.id] || SF_VOICE_LINES[l.id].zh === l.zh, `${l.id}: once recorded, recorded as written`);
});

test('G2-4: every event line speaks a BARK_SCRIPT line and its bubble starts with the phrase', () => {
  const used = new Set<string>();
  const onceKeys = new Set<string>();
  for (const [event, list] of Object.entries(EVENT_LINES) as [LineEvent, typeof EVENT_LINES[LineEvent]][]) {
    assert.ok(list.length >= 1, `${event} has a line`);
    list.forEach((line, i) => {
      const where = `${event}[${i}]`;
      filled(line.text, where);
      startsWithPhrase(line.text, line.voice, where);
      used.add(line.voice);
      assert.ok(line.ttl > 0 && line.priority > 0, `${where}: ttl and priority`);
      if (line.once) { assert.ok(!onceKeys.has(line.key), `${where}: once key unique`); onceKeys.add(line.key); }
      if (i > 0) assert.ok(!line.once, `${where}: only the first entry is a "first time" line`);
      if (line.source) assert.match(line.source.url, /^https:\/\//);
    });
  }
  // the recorded firsts are all spoken by an event
  for (const id of ['first-bike', 'first-car', 'first-cable-car', 'first-streetcar', 'first-ferry', 'first-glide', 'first-hill', 'first-crest']) assert.ok(used.has(id), `${id} is used`);
  assert.equal(EVENT_LINES.bump[0].key, 'bump');
});

test('G2-4: 20 neighbourhood lines on real far.zones ids, starting with their greeting; the template', async () => {
  const { sfDisk } = await import('./opus-bay-sf-disk');
  const far = await sfDisk().far();
  const zones = new Map(far.zones.map(z => [z.id, z]));
  assert.ok(NEIGHBOURHOOD_LINES.length >= 20, '≈ 20 authored');
  assert.equal(new Set(NEIGHBOURHOOD_LINES.map(l => l.zone)).size, NEIGHBOURHOOD_LINES.length, 'one per zone');
  for (const l of NEIGHBOURHOOD_LINES) {
    const z = zones.get(l.zone);
    assert.ok(z, `${l.zone} is a far.zones id`);
    assert.equal(l.voice, `zone-${l.zone}`);
    filled(l.text, l.zone);
    startsWithPhrase(l.text, l.voice, l.zone);
    if (l.zone !== 'haight-ashbury' && l.zone !== 'twin-peaks') {
      // the greeting names the zone as the HUD does (far.zones zh, first part of a "A · B" label)
      const hud = z.zh.split(' · ')[0];
      assert.ok(l.text.zh.includes(hud), `${l.zone}: names ${hud}`);
    }
    if (l.near) assert.ok(sfLandmark(l.near.landmark), `${l.zone}: near landmark exists`);
    if (l.source) { assert.match(l.source.url, /^https:\/\//); assert.match(l.source.verifiedAt, /^\d{4}-\d{2}-\d{2}$/); }
  }
  for (const id of SF_VOICE_ZONES) assert.ok(neighbourhoodLine(id), `recorded greeting ${id} has an authored line`);
  const t = neighbourhoodGreeting('portola', { zh: zones.get('portola')!.zh, en: zones.get('portola')!.en });
  startsWithPhrase(t.text, t.voice, 'template');
  assert.ok(t.text.zh.includes('波托拉') && t.text.en.includes('Portola'));
  // glossary: no word the HUD does not use
  const all = [...NEIGHBOURHOOD_LINES.map(l => l.text.zh), ...Object.values(EVENT_LINES).flat().map(l => l.text.zh), ...BARK_SCRIPT.map(l => l.zh)];
  for (const [from] of ZH_GLOSSARY) for (const zh of all) assert.ok(!zh.includes(from), `"${from}" not in ${zh}`);
});

test('G2-4: bubble time grows with the text, 2.6–5.6 s', () => {
  assert.equal(lineMs({ zh: '哎呀！', en: 'Oops!' }), 2600);
  const long = lineMs({ zh: '你好，海斯谷！1989 年地震后拆了高架路，才有这条林荫大道。', en: 'x'.repeat(100) });
  assert.ok(long > 4000 && long <= 5600);
});

// ---------------------------------------------------------------------------
// The scheduler (fake clock, seconds)
// ---------------------------------------------------------------------------

const memStore = () => {
  const data = new Map<string, string>();
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => { data.set(k, v); }, removeItem: (k: string) => { data.delete(k); }, data };
};
const open = { silent: false, bubble: false, gliding: false, quiet: false };
const mk = () => new LineScheduler(createLineMemory(null));
const hood = (id: string) => neighbourhoodLine(id)!;

test('G2-4 scheduler: a first line plays once per save; the voice id goes with it', () => {
  const store = memStore();
  const s = new LineScheduler(createLineMemory(store));
  assert.equal(s.offer('bike', 0), true);
  const line = s.step(0, open);
  assert.equal(line?.voice, 'first-bike');
  assert.ok(line?.text.zh.startsWith('骑车出发！'));
  assert.equal(s.offer('bike', 100), false, 'said: never again this save');
  const again = new LineScheduler(createLineMemory(store));
  assert.equal(again.offer('bike', 0), false, 'the memory survives a reload');
  assert.ok(JSON.parse(store.data.get(LINE_MEMORY_KEY)!).said.includes('first-bike'));
});

test('G2-4 scheduler: ≥ 8 s between lines, never over a bubble, 1 s settle after one', () => {
  const s = mk();
  s.offer('bike', 0);
  s.offer('car', 0);
  assert.equal(s.step(0, open)?.key, 'first-bike');
  assert.equal(s.step(LINE_GAP - 0.1, open), null, 'global gap');
  assert.equal(s.step(LINE_GAP, { ...open, bubble: true }), null, 'a bubble is up');
  assert.equal(s.step(LINE_GAP + 0.5, open), null, 'settle after the bubble');
  assert.equal(s.step(LINE_GAP + BUBBLE_SETTLE + 0.1, open)?.key, 'first-car');
});

test('G2-4 scheduler: 60 s per key; reactions go stale; silent holds', () => {
  const s = mk();
  s.offer('bump', 0);
  assert.equal(s.step(0, open)?.voice, 'bump-hard');
  assert.equal(s.offer('bump', 30), false, 'cooling down');
  assert.equal(s.offer('bump', KEY_COOLDOWN + 1), true);
  assert.equal(s.step(KEY_COOLDOWN + 1, open)?.key, 'bump');
  // a reaction waits at most its ttl (3 s) through a dialogue
  s.offer('stairs', 100);
  assert.equal(s.step(101, { ...open, silent: true }), null);
  assert.equal(s.step(104, open), null, 'stale after 3 s');
  // a first waits longer (12 s)
  s.offer('hill', 200);
  assert.equal(s.step(205, { ...open, silent: true }), null);
  assert.equal(s.step(209, { ...open, quiet: true }), null, 'quiet start holds too');
  assert.equal(s.step(210, open)?.voice, 'first-hill');
});

test('G2-4 scheduler: first time, then the repeat line with its own cooldown', () => {
  const s = mk();
  s.offer('crest', 0);
  assert.equal(s.step(0, open)?.voice, 'first-crest');
  s.offer('crest', 20);
  assert.equal(s.step(20, open)?.voice, 'crest-again');
  assert.equal(s.offer('crest', 20 + KEY_COOLDOWN + 1), false, 'crest repeats every 3 min at most');
  assert.equal(s.offer('crest', 20 + 181), true);
});

test('G2-4 scheduler: neighbourhood greetings: once, while you stay; held while gliding, only where you land', () => {
  const s = mk();
  s.zone('mission', hood('mission'));
  const g1 = s.step(0, open);
  assert.equal(g1?.key, zoneKey('mission'));
  assert.equal(g1?.voice, 'zone-mission');
  s.zone(null, null);
  s.zone('mission', hood('mission'));
  assert.equal(s.step(20, open), null, 'greeted once');
  // waits through a dialogue while you stay; dropped when you leave before it could be said
  s.zone('castro-upper-market', hood('castro-upper-market'));
  assert.equal(s.step(40, { ...open, silent: true }), null);
  assert.equal(s.step(60, open)?.zone, 'castro-upper-market');
  s.zone('marina', hood('marina'));
  s.zone('presidio', hood('presidio'));
  assert.equal(s.waiting().zone, 'presidio', 'only the zone you are in');
  // gliding over the Marina and the Presidio, landing in the Presidio
  const t = mk();
  t.zone('marina', hood('marina'));
  assert.equal(t.step(0, { ...open, gliding: true }), null, 'held while gliding');
  t.zone('presidio', hood('presidio'));
  assert.equal(t.step(5, { ...open, gliding: true }), null);
  assert.equal(t.step(6, open)?.zone, 'presidio', 'the zone you land in');
  t.zone('marina', hood('marina'));
  assert.equal(t.step(20, open)?.zone, 'marina', 'the Marina waits for a real visit');
});

test('G2-4 scheduler: a first beats a greeting beats a reaction; while gliding the glide lines still play', () => {
  const s = mk();
  s.zone('chinatown', hood('chinatown'));
  s.offer('pant', 0);
  s.offer('car', 0);
  assert.equal(s.step(0, open)?.key, 'first-car');
  assert.equal(s.step(LINE_GAP + 0.5, open)?.zone, 'chinatown');
  assert.equal(s.waiting().keys.length, 0, 'the pant line went stale meanwhile');
  const t = mk();
  t.offer('glide', 0);
  t.zone('marina', hood('marina'));
  assert.equal(t.step(0, { ...open, gliding: true })?.voice, 'first-glide');
  t.offer('glide-no-landing', 9);
  assert.equal(t.step(9, { ...open, gliding: true })?.voice, 'glide-no-landing');
});

test('G2-4: core events map to line events (hard bumps only, stairs, crests, transit)', () => {
  assert.equal(lineEventOf({ type: 'vehicle:bump', vehicle: 'car', strength: 0.9, hard: true, kind: 'wall' }, false), 'bump');
  assert.equal(lineEventOf({ type: 'vehicle:bump', vehicle: 'car', strength: 0.3, hard: false, kind: 'wall' }, false), null);
  assert.equal(lineEventOf({ type: 'vehicle:refuse', vehicle: 'bike', surface: 'stairs' }, false), 'stairs');
  assert.equal(lineEventOf({ type: 'vehicle:refuse', vehicle: 'car', surface: 'water' }, false), null);
  assert.equal(lineEventOf({ type: 'vehicle:hop', vehicle: 'bike', crest: true }, false), 'crest');
  assert.equal(lineEventOf({ type: 'vehicle:hop', vehicle: 'bike', crest: false }, false), null);
  assert.equal(lineEventOf({ type: 'vehicle:enter', vehicle: 'car', id: 'c', baybay: 'hop' }, true), 'car');
  assert.equal(lineEventOf({ type: 'glide:no-landing' }, false), 'glide-no-landing');
  assert.equal(lineEventOf({ type: 'transit', what: 'bell', line: 'powell-hyde', kind: 'cable-car', strength: 0.8 }, true), 'cable-bell');
  assert.equal(lineEventOf({ type: 'transit', what: 'bell', line: 'powell-hyde', kind: 'cable-car', strength: 1 }, false), null, 'your own car');
  assert.equal(lineEventOf({ type: 'transit', what: 'bell', line: 'powell-hyde', kind: 'cable-car', strength: 0.2 }, true), null, 'too far');
  assert.equal(lineEventOf({ type: 'transit', what: 'depart', line: 'powell-hyde', kind: 'cable-car' }, false), 'cable-ride');
  assert.equal(lineEventOf({ type: 'transit', what: 'push', line: 'powell-hyde', kind: 'cable-car', strength: 1 }, true), 'push');
  assert.equal(lineEventOf({ type: 'transit', what: 'board', line: 'ferry', kind: 'ferry' }, false), 'ferry');
  assert.equal(lineEventOf({ type: 'goal', id: 'x' }, true), null);
});

test('G2-4: the line memory is untrusted input and can be cleared', () => {
  const store = memStore();
  store.setItem(LINE_MEMORY_KEY, '{bad json');
  assert.equal(createLineMemory(store).has('first-bike'), false);
  store.setItem(LINE_MEMORY_KEY, JSON.stringify({ v: 1, said: ['first-bike', 42, '<script>', 'zone-mission'] }));
  const m = createLineMemory(store);
  assert.equal(m.has('first-bike'), true);
  assert.equal(m.has('<script>'), false);
  assert.equal(m.has('zone-mission'), true);
  m.clear();
  assert.equal(store.data.has(LINE_MEMORY_KEY), false);
  assert.equal(createLineMemory(store).has('first-bike'), false);
  const blocked = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); }, removeItem: () => { throw new Error('blocked'); } };
  const b = createLineMemory(blocked);
  b.add('first-car');
  assert.equal(b.has('first-car'), true, 'blocked storage: this page only');
});
