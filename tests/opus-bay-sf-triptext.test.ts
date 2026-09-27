import assert from 'node:assert/strict';
import test from 'node:test';

// Wave 4 · lane C · part 2: the one set of trip words (game/tripText.ts: the time rule, the island trip ends, the
// arrival toast; lane G's review O2 / O4, lane C's review O8) and BAYBAY's line pacing (game/linePacer.ts: no next
// tour line before the previous clip has finished, lane V's review item 4; once per stop, lane C's review O6).

const text = await import('../src/opus-bay/game/tripText');
const { timeLabel, timeParts, minutesLabel, tripDestination, arrivalToast, OFF_WALK_POINTS, PENDING_TIME } = text;
const pacerMod = await import('../src/opus-bay/game/linePacer');
const { LinePacer, readSeconds, LINE_TTL, PACER_GAP, REPEAT_GAP, PACER_MAX } = pacerMod;
const { tripTimeLabel } = await import('../src/opus-bay/game/tripPlan');
const { tripSecondsLabel } = await import('../src/opus-bay/ui/tripRows');
const { arrivalToastText, tripPillText } = await import('../src/opus-bay/ui/guideText');
const { ATTRACTIONS } = await import('../src/opus-bay/data/sf/attractions');
const { attractionTripEnd, freeLeadTrip } = await import('../src/opus-bay/game/trips');
const { TOUR_VOICE_CLIPS } = await import('../src/opus-bay/data/sf/voiceTour');
const lines = await import('../src/opus-bay/data/sf/tourLines');
const { LOOP_STOP_LINES, CHAPTER_LINES, GRAND_CHAPTER_IDS, TOUR_LINES, sayLine, loopNarration } = lines;
const { lineMs } = await import('../src/opus-bay/data/sf/lines');
const { SF_GRAND, tourStops } = await import('../src/opus-bay/data/sf/tours');
const { arrivalPaced, arrivalBeats, ArrivalWatcher, arrivalAnchors } = await import('../src/opus-bay/game/arrival');

const bi = (zh: string, en: string) => ({ zh, en });

// ---------------------------------------------------------------------------------------------------------------
// The time rule
// ---------------------------------------------------------------------------------------------------------------

test('timeLabel: one rule for trip pills, rows, waypoints and tours (seconds, 5-s steps, minutes, hours)', () => {
  const zh = (s: number) => timeLabel(s).zh;
  assert.deepEqual(timeLabel(6), bi('约 6 秒', '~6s'));
  assert.equal(zh(0.2), '约 1 秒');
  assert.equal(zh(-3), '约 1 秒');
  assert.equal(zh(19.4), '约 19 秒');
  assert.equal(zh(20), '约 20 秒');
  assert.equal(zh(42), '约 40 秒');
  assert.equal(zh(47), '约 45 秒');
  assert.equal(zh(57.4), '约 55 秒');
  assert.equal(zh(57.5), '约 1 分钟', 'never "约 60 秒"');
  assert.equal(zh(61), '约 1 分钟');
  assert.equal(zh(88), '约 1 分钟', 'minutes from the real seconds (1.47 min)');
  assert.equal(zh(90), '约 2 分钟');
  assert.deepEqual(timeLabel(245), bi('约 4 分钟', '~4 min'));
  assert.equal(zh(3569), '约 59 分钟');
  assert.deepEqual(timeLabel(3570), bi('约 1 小时', '~1 h'));
  assert.deepEqual(timeLabel(3700), bi('约 1 小时 2 分钟', '~1 h 2 min'));
  assert.deepEqual(timeLabel(NaN), PENDING_TIME);
  assert.deepEqual(timeLabel(Infinity), PENDING_TIME);
  assert.equal(timeParts(NaN), null);
  // styles: the zh is the same in pills and sentences; bare drops 约 / ~ for lists that say it once
  assert.deepEqual(timeLabel(245, 'prose'), bi('约 4 分钟', 'about 4 min'));
  assert.deepEqual(timeLabel(42, 'prose'), bi('约 40 秒', 'about 40 sec'));
  assert.deepEqual(timeLabel(245, 'bare'), bi('4 分钟', '4 min'));
  assert.deepEqual(timeLabel(15, 'bare'), bi('15 秒', '15s'));
  assert.deepEqual(minutesLabel(25.9), bi('约 26 分钟', 'about 26 min'));
  assert.deepEqual(minutesLabel(18.3, 'compact'), bi('约 18 分钟', '~18 min'));
});

test('timeLabel agrees with lane G\'s tripTimeLabel and lane P\'s tripSecondsLabel (the switch changes little on purpose)', () => {
  // lane G: identical below a minute; above, one minute apart only in the 2.5 s before each half minute, where G
  // rounded the minutes from its 5-s steps (87.5–89.5 s: G "约 2 分钟", the rule "约 1 分钟" = 1.47 min)
  for (let s = 0; s < 3570; s += 0.5) {
    const a = timeLabel(s), g = tripTimeLabel(s);
    if (s < 57.5) { assert.deepEqual(a, g, `${s} s`); continue; }
    if (a.zh === g.zh) continue;
    const n = (x: string) => Number(x.replace(/\D+/g, ' ').trim().split(' ')[0]);
    assert.equal(n(g.zh) - n(a.zh), 1, `${s} s: ${a.zh} vs ${g.zh}`);
    assert.ok(s % 60 >= 27.5 && s % 60 < 30, `${s} s: only just before a half minute`);
  }
  // lane G's own test values stay the same
  for (const [s, zh] of [[8, '约 8 秒'], [47, '约 45 秒'], [58, '约 1 分钟'], [245, '约 4 分钟'], [0.2, '约 1 秒']] as const) assert.equal(timeLabel(s).zh, zh);
  // lane P: the same zh up to an hour; the English loses its space ("~6 s" → "~6s") and hours read "1 小时 2 分钟"
  for (let s = 1; s < 3570; s++) assert.equal(timeLabel(s).zh, tripSecondsLabel(s).zh.replace(/分$/, '分钟'), `${s} s`);
  assert.equal(tripSecondsLabel(6).en, '~6 s');
  assert.equal(timeLabel(6).en, '~6s');
});

// ---------------------------------------------------------------------------------------------------------------
// Where a trip ends: the islands
// ---------------------------------------------------------------------------------------------------------------

test('tripDestination: a trip "to Alcatraz" ends at 恶魔岛渡轮码头 · 33 号码头 and says so (lane G review O2)', () => {
  const alca = ATTRACTIONS.find(a => a.id === 'alcatraz')!;
  const d = tripDestination(alca);
  assert.deepEqual(d.name, bi('恶魔岛渡轮码头 · 33 号码头', 'Pier 33 Alcatraz Landing'));
  assert.deepEqual(d.short, bi('33 号码头', 'Pier 33'));
  assert.ok(d.note && /望远镜/.test(d.note.zh));
  // every island of lane P has its pier; every other attraction keeps its own name and short
  const off = ATTRACTIONS.filter(a => a.offWalk).map(a => a.id).sort();
  assert.deepEqual(Object.keys(OFF_WALK_POINTS).sort(), off);
  for (const a of ATTRACTIONS.filter(x => !x.offWalk)) {
    const n = tripDestination(a);
    assert.equal(n.name, a.name);
    assert.equal(n.short, a.short ?? null);
    assert.equal(n.note, null);
  }
  // an attraction id with a pier but not off the walk (never happens today) keeps its name
  assert.deepEqual(tripDestination({ id: 'alcatraz', name: bi('恶魔岛', 'Alcatraz') }).name, bi('恶魔岛', 'Alcatraz'));
  // the pier names fit lane G's phone pill with the time: "下一站 33 号码头 · 约 4 分钟"
  const end = attractionTripEnd(alca);
  assert.deepEqual({ x: end.x, z: end.z }, { x: alca.arrival!.x, z: alca.arrival!.z }, 'the trip ends at the telescope');
  assert.equal(end.place, alca.placeId);
  const trip = freeLeadTrip({ x: end.x + 200, z: end.z }, end, 0);
  assert.deepEqual(trip.legs[0].to.name, d.name, 'the leg carries the pier name');
  const pill = tripPillText(trip, 240, { compact: true, destination: end.name, short: end.short });
  assert.equal(pill.title.zh, '下一站 33 号码头');
  assert.equal(pill.time.zh, '约 4 分钟');
  // Treasure Island: the Pier 14 telescope
  assert.deepEqual(tripDestination(ATTRACTIONS.find(a => a.id === 'treasure-island')!).short, bi('14 号码头', 'Pier 14'));
});

test('arrivalToast: one wording for lane C\'s arrival beats and lane G\'s toast (review O8)', () => {
  for (const name of [bi('艺术宫', 'Palace of Fine Arts'), bi('圣依纳爵堂', 'St Ignatius Church')]) {
    for (const quiet of [false, true]) assert.deepEqual(arrivalToast(name, quiet), arrivalToastText(name, quiet));
  }
  assert.deepEqual(arrivalToast(bi('圣依纳爵堂', 'St Ignatius Church'), true), bi('到了 · 圣依纳爵堂', 'Here: St Ignatius Church'));
});

// ---------------------------------------------------------------------------------------------------------------
// Pacing BAYBAY's lines
// ---------------------------------------------------------------------------------------------------------------

const clipsOf = (lang: 'zh' | 'en') => (id: string) => TOUR_VOICE_CLIPS[`${lang}-${id}`]?.duration;

test('pacer: the next tour line waits for the previous clip (TOUR_VOICE_CLIPS duration + gap)', () => {
  for (const lang of ['zh', 'en'] as const) {
    const p = new LinePacer(clipsOf(lang));
    const outro = CHAPTER_LINES.bay.outro, intro = CHAPTER_LINES.coast.intro;
    assert.ok(p.offer(sayLine(outro.id, LINE_TTL.chapter)!, 0));
    assert.ok(p.offer(sayLine(intro.id, LINE_TTL.chapter)!, 0));
    const a = p.step(0)!;
    assert.equal(a.voice, outro.id);
    const d = TOUR_VOICE_CLIPS[`${lang}-${outro.id}`].duration;
    assert.equal(a.seconds, d);
    assert.equal(a.voiced, true);
    assert.ok(a.bubbleMs >= d * 1000, 'the bubble stays while she speaks');
    assert.equal(p.step(d - 0.01), null, `${lang}: still speaking`);
    assert.equal(p.step(d + PACER_GAP - 0.01), null, 'the gap');
    assert.equal(p.step(d + PACER_GAP)!.voice, intro.id, 'then the intro');
    assert.ok(Math.abs(p.busyUntil - (d + PACER_GAP + TOUR_VOICE_CLIPS[`${lang}-${intro.id}`].duration + PACER_GAP)) < 1e-9);
  }
});

test('pacer: a loop stop\'s approach clip always ends before the bus stands (the arrive line is on time)', () => {
  // lane V's review: the approach fires ≈ 60 u before the stop ≈ 7.3 s before the bus stands (12 u/s, 2.6 u/s² brake)
  const APPROACH_TO_STOP = 7.3;
  for (const lang of ['zh', 'en'] as const) {
    for (const [station, s] of Object.entries(LOOP_STOP_LINES)) {
      const p = new LinePacer(clipsOf(lang));
      const approach = loopNarration({ what: 'approach', line: 'sf-loop', station })!;
      p.offer(sayLine(approach.id, LINE_TTL.approach)!, 0);
      assert.equal(p.step(0)!.voice, s.approach.id);
      const arrive = loopNarration({ what: 'arrive', line: 'sf-loop', station })!;
      p.offer(sayLine(arrive.id, LINE_TTL.arrive)!, APPROACH_TO_STOP);
      const said = p.step(APPROACH_TO_STOP);
      assert.equal(said?.voice, s.arrive.id, `${lang} ${station}: the approach clip (${TOUR_VOICE_CLIPS[`${lang}-${s.approach.id}`].duration} s) + gap ends by the stop`);
    }
  }
});

test('pacer: once per stop (review O6), late lines dropped by their ttl, busy holds, the queue is capped', () => {
  const p = new LinePacer(clipsOf('zh'));
  // the tour stop's arrive and the loop narration pick the same frozen line: said once
  const ggb = tourStops(SF_GRAND).find(f => f.stop.id === 'bay-ride-ggb')!.stop;
  assert.equal(ggb.lines.arrive, 'loop-golden-gate-bridge-arrive');
  assert.equal(p.offer(sayLine(loopNarration({ what: 'arrive', line: 'sf-loop', station: 'loop-golden-gate-bridge' })!.id, LINE_TTL.arrive)!, 0), true);
  assert.equal(p.offer(sayLine(ggb.lines.arrive as string, LINE_TTL.stop)!, 0.1), false, 'already waiting');
  p.step(0.2);
  assert.equal(p.offer(sayLine(ggb.lines.arrive as string)!, 5), false, 'said moments ago');
  assert.equal(p.offer(sayLine(ggb.lines.arrive as string)!, 0.2 + REPEAT_GAP), true, 'a later lap may say it again');
  p.clear();
  // ttl: an approach line that cannot start within 5 s is dropped, not said after the stop
  const q = new LinePacer(clipsOf('zh'));
  q.offer(sayLine('grand-bay-intro')!, 0);
  q.step(0);
  q.offer(sayLine('loop-pier-39-approach', LINE_TTL.approach)!, 0.5);
  const introEnds = q.busyUntil;
  assert.ok(introEnds > 0.5 + LINE_TTL.approach, 'the intro is longer than the approach may wait');
  assert.equal(q.step(introEnds), null, 'the stale approach is dropped');
  assert.equal(q.pending(), 0);
  // busy (a dialogue): lines wait, their ttl runs
  const b = new LinePacer();
  b.offer({ text: bi('跟我来！', 'Follow me!'), ttl: 3 }, 0);
  assert.equal(b.step(1, true), null);
  assert.equal(b.step(2)!.text.zh, '跟我来！');
  b.offer({ text: bi('再来一句', 'One more'), ttl: 3 }, 10);
  assert.equal(b.step(11, true), null);
  assert.equal(b.step(14), null, 'expired while blocked');
  // capped: the oldest waiting line goes
  const c = new LinePacer();
  for (let i = 0; i < PACER_MAX + 2; i++) c.offer({ text: bi(`第 ${i} 句`, `line ${i}`) }, 0);
  assert.equal(c.pending(), PACER_MAX);
  assert.equal(c.step(0)!.text.zh, '第 2 句');
});

test('pacer: a line without a clip (added after the freeze, plain bubbles) is text only and holds its reading time', () => {
  const p = new LinePacer(clipsOf('zh'));
  p.offer(sayLine('metro-sfsu-next-2')!, 0);
  const s = p.step(0)!;
  assert.equal(s.voiced, false, 'no recorded clip yet: no voice-line event (no chirp)');
  assert.equal(s.seconds, readSeconds(s.text));
  // the reading time is data/sf/lines.ts lineMs
  for (const l of [...TOUR_LINES.slice(0, 20), { zh: '短', en: 'x' }, { zh: '长'.repeat(60), en: 'y'.repeat(200) }]) assert.equal(readSeconds(l), lineMs(l) / 1000);
  // every frozen line has its clip in both languages (so the pacer times them by the clip)
  for (const l of TOUR_LINES) for (const lang of ['zh', 'en'] as const) assert.ok(clipsOf(lang)(l.id)! > 0, `${lang}-${l.id}`);
  // chapter intros / outros never overlap across the whole tour
  const q = new LinePacer(clipsOf('en'));
  for (const id of GRAND_CHAPTER_IDS) { q.offer(sayLine(CHAPTER_LINES[id].intro.id)!, 0); q.offer(sayLine(CHAPTER_LINES[id].outro.id)!, 0); }
  let t = 0, last = -Infinity, n = 0;
  while (q.pending() && t < 200) { const said = q.step(t); if (said) { assert.ok(said.at >= last, 'in order'); last = said.at + said.seconds; n++; } t += 0.05; }
  assert.equal(n, Math.min(PACER_MAX, GRAND_CHAPTER_IDS.length * 2));
});

test('arrival lines go through the pacer: the voice id, the ttl, the postcard hint after it', () => {
  const anchors = arrivalAnchors(ATTRACTIONS);
  const sfsu = anchors.find(a => a.attraction === 'sf-state-university')!;
  const w = new ArrivalWatcher(anchors);
  const beats = arrivalBeats(w.step({ x: sfsu.x, z: sfsu.z, now: 0, onFoot: true, busy: false, travelling: false })!, { postcardNear: true });
  const paced = arrivalPaced(beats, 'sf-state-university');
  assert.equal(paced.length, 2);
  assert.equal(paced[0].voice, 'arrive-sf-state-university');
  assert.equal(paced[0].ttl, LINE_TTL.arrival);
  assert.equal(paced[1].text.zh, '这附近藏着一张明信片哦');
  // an arrival right after a tour line waits for it
  const p = new LinePacer(clipsOf('zh'));
  p.offer(sayLine('loop-castro-arrive')!, 0);
  p.step(0);
  for (const l of paced) p.offer(l, 0.5);
  assert.equal(p.step(1), null);
  const next = p.step(p.busyUntil)!;
  assert.equal(next.voice, 'arrive-sf-state-university');
  assert.deepEqual(arrivalPaced({ line: null, voice: null, mood: 'happy', postcardHint: null }, 'x'), []);
});
