/**
 * Wave 9 · lane X (W9-X2): BAYBAY's voice coverage — every fixed BAYBAY line (zh + en) and whether it has a clip
 * (scripts/opus-sf/voice/w9/coverage.ts; the number of record is in docs/opus-bay/sf-w9-X.md).
 */
import assert from 'node:assert/strict';
import test from 'node:test';

test('W9-X2 · voice coverage: ≥ 95 % of BAYBAY\'s fixed lines are voiced (zh + en, not muted); every unvoiced / muted / reworded line is listed', async (t) => {
  const { coverage } = await import('../scripts/opus-sf/voice/w9/coverage');
  const c = await coverage();
  t.diagnostic(`BAYBAY fixed lines ${c.lines}: voiced ${c.voiced} (${c.pct} %), muted ${c.muted}, unvoiced ${c.unvoiced}; recorded but reworded ${c.dead.length}`);
  for (const r of c.rows) if (r.status !== 'voiced') t.diagnostic(`${r.status} ${r.id} ${r.zh} | ${r.en}`);
  for (const d of c.dead) t.diagnostic(`reworded (silent until re-recorded) ${d.id} (${d.table}) ${d.zh}`);
  assert.ok(c.lines >= 590, `${c.lines} lines: the inventory lost lines (a scan broke?)`);
  assert.equal(c.lines, c.voiced + c.muted + c.unvoiced);
  // a lane may add a line after lane X's last batch (it plays as text only until recorded): a floor, not 100 %
  assert.ok(c.pct >= 95, `voice coverage ${c.pct} % < 95 %`);
  // the two families: the bubbles the binder matches by text, the lines the lanes play by id (tour, city lines)
  assert.ok(c.byFamily.text.lines >= 440 && c.byFamily.id.lines >= 140, JSON.stringify(c.byFamily));
  assert.equal(c.byFamily.id.unvoiced, 0, 'every tour / city line played by id has both clips');
});

test('W9-X2 · coverage rows: a recorded line counts once (the earliest table wins, as in the binder); no row is a template', async () => {
  const { coverage } = await import('../scripts/opus-sf/voice/w9/coverage');
  const c = await coverage();
  const seen = new Set<string>();
  for (const r of c.rows.filter(x => x.family === 'text')) {
    const k = `${r.zh}\n${r.en}`;
    assert.ok(!seen.has(k), `${r.id}: counted twice`);
    seen.add(k);
    assert.ok(!/\$\{/.test(r.zh + r.en), `${r.id} is a template`);
  }
});

test('W9-X3 · every wave-9 line is recorded in zh and en (files on disk), said verbatim by the game, new words under a new id, and BAYBAY\'s bubble with its exact text finds it', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { W9_VOICE_LINES, W9_VOICE_CLIPS, W9_VOICE_CHECK } = await import('../src/opus-bay/data/sf/voiceW9');
  const { W5_VOICE_LINES } = await import('../src/opus-bay/data/sf/voiceW5');
  const { W6_VOICE_LINES } = await import('../src/opus-bay/data/sf/voiceW6');
  const { W7_VOICE_LINES } = await import('../src/opus-bay/data/sf/voiceW7');
  const { W8_VOICE_LINES } = await import('../src/opus-bay/data/sf/voiceW8');
  const { w5VoiceFor, w5VoiceMuted } = await import('../src/opus-bay/game/voiceW5');
  const { gameSources, saidIn } = await import('../scripts/opus-sf/voice/w9/coverage');
  const said = saidIn(gameSources());
  const key = (l: { zh: string; en: string }) => `${l.zh}\n${l.en}`;
  const earlier = [...W5_VOICE_LINES, ...W6_VOICE_LINES, ...W7_VOICE_LINES, ...W8_VOICE_LINES];
  const earlierText = new Set(earlier.map(key)), earlierIds = new Set(earlier.map(l => l.id));
  const ids = new Set<string>();
  assert.ok(W9_VOICE_LINES.length >= 5);
  for (const l of W9_VOICE_LINES) {
    assert.ok(!ids.has(l.id) && !earlierIds.has(l.id), `${l.id}: a new id`);
    ids.add(l.id);
    assert.ok(!earlierText.has(key(l)), `${l.id}: an earlier batch already has these words`);
    assert.ok(!/\$\{/.test(l.zh + l.en), `${l.id} is not a template`);
    assert.ok(said(l.zh) && said(l.en), `${l.id}: the game says it verbatim`);
    assert.equal(w5VoiceFor({ zh: l.zh, en: l.en }), l.own ? null : l.id, l.id);
  }
  const root = path.resolve('public');
  for (const [clip, c] of Object.entries(W9_VOICE_CLIPS)) {
    for (const f of [c.m4a, c.ogg]) assert.ok(fs.existsSync(path.join(root, f!)) && fs.statSync(path.join(root, f!)).size > 2000, `${clip}: ${f}`);
    assert.ok(c.duration > 0.3 && c.duration < 10.5, `${clip} ${c.duration} s`);
  }
  for (const c of W9_VOICE_CHECK) assert.equal(w5VoiceMuted(c), true, `${c} stays text only until approved`);
});

test('W9-X3 · w8 NEXT #10: the grip / sled "too short" lines, the boathouse since 1893 (not "this building"), the pagodas without an unsourced colour and the Alcatraz return boarding line are voiced', async () => {
  const { w5VoiceFor } = await import('../src/opus-bay/game/voiceW5');
  const { GRIP_LINES } = await import('../src/opus-bay/play/sfgames8Lines');
  const { SLED_LINES } = await import('../src/opus-bay/play/sled');
  const { LAKE_LINES } = await import('../src/opus-bay/world/sf/westLines');
  const { W8_W1_LINES } = await import('../src/opus-bay/world/sf/cornersSights');
  const { ALCA_LINES } = await import('../src/opus-bay/world/sf/alcatrazLines');
  const pagodas = W8_W1_LINES.find(l => l.id === 'w8w1-pagodas-ahead')!;
  assert.doesNotMatch(pagodas.zh + pagodas.en, /黄|yellow/i, 'Sing Fat\'s roof colour has no source');
  assert.match(pagodas.zh, /Sing Fat/);
  assert.equal(LAKE_LINES.since.text.zh, '船屋从1893年起就租船给游客。');
  for (const l of [GRIP_LINES.short, SLED_LINES.short, LAKE_LINES.since.text, { zh: pagodas.zh, en: pagodas.en }, ALCA_LINES.boardBack]) {
    assert.ok(w5VoiceFor(l), `${l.zh} is voiced`);
  }
});

test('W9-X4 · the today line and the pelican\'s later line are fixed (voiceable) lines; the names, the time and the control go on a toast', async () => {
  const T = await import('../src/opus-bay/realsf/todayLine');
  // the Bay clock pinned: a morning (before sunset, no event in an empty catalog) and a night
  const empty = { events: [], venues: [] } as never;
  const morning = new Date('2026-10-03T17:30:00Z'); // 10:30 PDT
  const night = new Date('2026-10-04T05:30:00Z'); // 22:30 PDT
  const m = T.todaySpoken(morning, empty);
  assert.deepEqual(m.line, T.TODAY_SUNSET_LINE);
  assert.match(m.toast!.zh, /^今天旧金山日落 \d\d:\d\d$/);
  assert.match(m.toast!.en, /^Sunset in San Francisco today: \d\d:\d\d$/);
  const n = T.todaySpoken(night, empty);
  assert.deepEqual(n.line, T.TODAY_PLAIN_LINE);
  assert.equal(n.toast, null);
  for (const l of [T.TODAY_EVENT_LINE, T.TODAY_SUNSET_LINE, T.TODAY_PLAIN_LINE]) assert.ok(!/\d/.test(l.zh + l.en) && [...l.zh].length <= 45, l.zh);
  const P = await import('../src/opus-bay/game/pelicanFirst');

  // voiced (W9-X4 batch 2)
  const { w5VoiceFor } = await import('../src/opus-bay/game/voiceW5');
  for (const l of [T.TODAY_EVENT_LINE, T.TODAY_SUNSET_LINE, T.TODAY_PLAIN_LINE, P.PELICAN_LATER_LINE]) assert.ok(w5VoiceFor(l), `${l.zh} is voiced`);
  for (const d of ['touch', 'keyboard', 'gamepad'] as const) {
    assert.deepEqual(P.PELICAN_LINES.laterBubble(P.takeOffKey(d)), P.PELICAN_LATER_LINE, `${d}: the same words on every device`);
    assert.ok(P.PELICAN_LINES.laterToast(P.takeOffKey(d)).zh.includes(P.takeOffKey(d).zh), `${d}: the control on the toast`);
  }
});

test('W9-X6 · BAYBAY\'s dialogue box says its recorded words: her node with recorded text emits its line; an NPC\'s node, unrecorded words, an unknown node do not; no static node has recorded words', async () => {
  const { defineNode } = await import('../src/opus-bay/game/flow');
  const V = await import('../src/opus-bay/game/voiceW5');
  const { emit, onEvent } = await import('../src/opus-bay/core/events');
  const T = await import('../src/opus-bay/realsf/todayLine');
  defineNode({ id: 'w9x6.rec', speaker: 'baybay', text: T.TODAY_PLAIN_LINE });
  defineNode({ id: 'w9x6.npc', speaker: 'npc', text: T.TODAY_PLAIN_LINE });
  defineNode({ id: 'w9x6.new', speaker: 'baybay', text: { zh: '没录过的话', en: 'Never recorded.' } });
  const want = V.w5VoiceFor(T.TODAY_PLAIN_LINE);
  assert.ok(want, 'the plain today line is recorded (W9-X4)');
  assert.equal(V.w5VoiceForNode('baybay', 'w9x6.rec'), want);
  assert.equal(V.w5VoiceForNode('npc', 'w9x6.npc'), null);
  assert.equal(V.w5VoiceForNode('baybay', 'w9x6.new'), null);
  assert.equal(V.w5VoiceForNode('baybay', 'no-such-node'), null);
  const got: string[] = [];
  const offE = onEvent(e => { if (e.type === 'voice-line') got.push(e.id); });
  const off = V.initW5Voice();
  try {
    emit({ type: 'dialogue', speaker: 'baybay', nodeId: 'w9x6.rec' });
    emit({ type: 'dialogue', speaker: 'npc', nodeId: 'w9x6.npc' });
    emit({ type: 'dialogue', speaker: 'baybay', nodeId: 'w9x6.new' });
  } finally { off(); offE(); }
  assert.deepEqual(got, [want], 'one line, for her recorded node only');
  // the script's static nodes (103 of BAYBAY's): none has recorded words today, so no other dialogue starts talking
  const { NODES } = await import('../src/opus-bay/data/script');
  const talking = Object.values(NODES).filter(n => n.speaker === 'baybay' && V.w5VoiceFor(n.text));
  assert.deepEqual(talking.map(n => n.id), []);
});

test('W9-X7 · batch 3: lane H\'s big-day greetings, lane G\'s crossing line and lane N\'s stuck question are voiced (the stuck card is BAYBAY\'s dialogue node: W9-X6 says it)', async () => {
  const fs = await import('node:fs');
  const { w5VoiceFor } = await import('../src/opus-bay/game/voiceW5');
  const { W9_WORLD_LINES } = await import('../src/opus-bay/halloween/worldLines');
  for (const l of W9_WORLD_LINES) assert.equal(w5VoiceFor(l), l.id, `${l.id} voiced under its own id`);
  // lane G (play/hideSeek.ts HIDE_LINES.crosswalk) and lane N (game/tripRun.ts STUCK_LINE): the words as the files say them
  const g = { zh: '马路这里过不去，从斑马线过去吧！', en: 'You can’t cross here. Use the zebra crossing!' };
  const n = { zh: '这段路被挡住了，我们怎么走？', en: 'This way is blocked. How shall we go?' };
  assert.ok(fs.readFileSync('src/opus-bay/play/hideSeek.ts', 'utf8').includes(`zh: '${g.zh}', en: '${g.en}'`), 'hideSeek says the recorded words');
  assert.ok(fs.readFileSync('src/opus-bay/game/tripRun.ts', 'utf8').includes(`STUCK_LINE: Bilingual = { zh: '${n.zh}', en: '${n.en}' }`), 'tripRun says the recorded words');
  for (const l of [g, n]) assert.ok(w5VoiceFor(l), `${l.zh} voiced`);
});
