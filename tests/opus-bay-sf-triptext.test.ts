import assert from 'node:assert/strict';
import test from 'node:test';

// Wave 4 · lane C · part 2: the one set of trip words (game/tripText.ts: the time rule, the island trip ends, the
// arrival toast; lane G's review O2 / O4, lane C's review O8) and BAYBAY's line pacing (game/linePacer.ts: no next
// tour line before the previous clip has finished, lane V's review item 4; once per stop, lane C's review O6).

const text = await import('../src/opus-bay/game/tripText');
const { timeLabel, timeParts, minutesLabel, arrivalToast, PENDING_TIME } = text;
const pacerMod = await import('../src/opus-bay/game/linePacer');
const { LinePacer, readSeconds, LINE_TTL, PACER_GAP, REPEAT_GAP, PACER_MAX, HELD_GAP } = pacerMod;
const { tripTimeLabel } = await import('../src/opus-bay/game/tripPlan');
const { tripSecondsLabel } = await import('../src/opus-bay/ui/tripRows');
const { arrivalToastText, tripPillText } = await import('../src/opus-bay/ui/guideText');
const { ATTRACTIONS, ARRIVAL_PLACES, tripDestination } = await import('../src/opus-bay/data/sf/attractions');
const { freeLeadTrip } = await import('../src/opus-bay/game/trips');
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
  // lane P switched at the integration (sf-w4-C.md part 2 step 2: tripSecondsLabel = timeLabel): the same words now
  assert.equal(tripSecondsLabel(6).en, '~6s');
  assert.deepEqual(tripSecondsLabel(3700), timeLabel(3700));
  assert.equal(timeLabel(6).en, '~6s');
});

// ---------------------------------------------------------------------------------------------------------------
// Where a trip ends: the islands
// ---------------------------------------------------------------------------------------------------------------

test('the island trips end at ONE named pier (lane P\'s ARRIVAL_PLACES / tripDestination, lane G review O2); the pill never says the island', () => {
  // one source: lane P's tripDestination (game/tripText.ts has no island table of its own)
  assert.equal('tripDestination' in text, false);
  const off = ATTRACTIONS.filter(a => a.offWalk).map(a => a.id).sort();
  assert.deepEqual(Object.keys(ARRIVAL_PLACES).sort(), off, 'every island has its pier');
  const alca = ATTRACTIONS.find(a => a.id === 'alcatraz')!;
  const d = tripDestination(alca);
  assert.equal(d.name.zh, '恶魔岛渡轮码头 · 33 号码头');
  assert.deepEqual({ x: d.x, z: d.z }, { x: alca.arrival!.x, z: alca.arrival!.z }, 'the trip ends at the telescope');
  const trip = freeLeadTrip({ x: d.x + 200, z: d.z }, { x: d.x, z: d.z, place: d.placeId, name: d.name }, 0);
  assert.deepEqual(trip.legs[0].to.name, d.name, 'the leg carries the pier name');
  // lane G's pill: the desktop shows the whole name; a phone fits "下一站 恶魔岛渡轮…" + the time (Request to lane P:
  // a short "33 号码头" for the phone pill); passing Attraction.short would say the island — never do that for islands
  assert.equal(tripPillText(trip, 240, { destination: d.name }).title.zh, '下一站 恶魔岛渡轮码头 · 33 号码头');
  assert.equal(tripPillText(trip, 240, { compact: true, destination: d.name }).title.zh, '下一站 恶魔岛渡轮…');
  assert.equal(tripPillText(trip, 240, { compact: true, destination: d.name, short: alca.short }).title.zh, '下一站 恶魔岛', 'what not to pass');
  assert.equal(tripPillText(trip, 240, { compact: true }).time.zh, timeLabel(240).zh, 'the pill time = the one time rule');
  assert.equal(tripDestination(ATTRACTIONS.find(a => a.id === 'treasure-island')!).name.zh, '14 号码头');
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
  // (W9-F, P-7) a breath of HELD_GAP after the hold before what waited under it
  assert.equal(b.step(2), null, 'HELD_GAP after the hold');
  assert.equal(b.step(1 + HELD_GAP)!.text.zh, '跟我来！');
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
  // (lane V recorded metro-sfsu-next-2 at the integration, W4-V-I8: the lookup here leaves it out, as before a recording)
  const p = new LinePacer(id => (id === 'metro-sfsu-next-2' ? undefined : clipsOf('zh')(id)));
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

test('the whole Grand Tour through the pacer: every chapter / stop line is said, in order, never over another clip', async () => {
  const { stopSay, chapterSay } = await import('../src/opus-bay/data/sf/tours');
  for (const express of [false, true]) for (const lang of ['zh', 'en'] as const) {
    const p = new LinePacer(clipsOf(lang));
    const said: { id: string; at: number; end: number }[] = [];
    let offered = 0, t = 0;
    const offer = (l: ReturnType<typeof stopSay>) => { if (l && p.offer(l, t)) offered++; };
    const run = (until: number) => {
      for (; t <= until; t += 0.1) { const s = p.step(t); if (s) said.push({ id: s.voice ?? s.text.zh, at: s.at, end: s.at + s.seconds }); }
    };
    SF_GRAND.chapters.forEach((c, ci) => {
      offer(chapterSay(c, 'intro'));
      for (const { stop } of tourStops(SF_GRAND, { express }).filter(f => f.chapter === ci)) {
        offer(stopSay(stop, 'lead', express));
        run(t + (express ? stop.expressMinutes : stop.minutes) * 60);
        offer(stopSay(stop, 'arrive', express));
        offer(stopSay(stop, 'done', express));
        run(t + 1);
      }
      offer(chapterSay(c, 'outro'));
      run(t + 1);
    });
    run(t + 60);
    assert.equal(said.length, offered, `${express ? 'express' : 'full'} ${lang}: nothing dropped (${said.length} / ${offered})`);
    for (let i = 1; i < said.length; i++) assert.ok(said[i].at >= said[i - 1].end + PACER_GAP - 1e-6, `${said[i - 1].id} → ${said[i].id} overlap`);
    // express rides that get off early say their own arrival
    if (express) assert.ok(said.some(s => s.id === 'loop-ocean-beach-windmill-arrive'));
  }
});

// ---------------------------------------------------------------------------------------------------------------
// Review 2: repeats beyond 25 s, the transit narration in one place, the clip lookup without the audio module
// ---------------------------------------------------------------------------------------------------------------

test('review 2 · transitSay: the loop / Metro line of a transit event with its ttl and the narration repeat window', async () => {
  const { transitSay } = await import('../src/opus-bay/data/sf/tours');
  const { NARRATION_REPEAT } = pacerMod;
  const ap = transitSay({ what: 'approach', line: 'sf-loop', station: 'loop-castro' })!;
  assert.equal(ap.voice, LOOP_STOP_LINES['loop-castro'].approach.id);
  assert.equal(ap.ttl, LINE_TTL.approach);
  assert.equal(ap.repeatGap, NARRATION_REPEAT);
  assert.equal(transitSay({ what: 'arrive', line: 'sf-loop', station: 'loop-castro' })!.ttl, LINE_TTL.arrive);
  const board = transitSay({ what: 'board', line: 'n-judah', station: 'muni-judah-la-playa' })!;
  assert.equal(board.voice, 'metro-board-n');
  assert.equal(board.ttl, LINE_TTL.board);
  assert.equal(transitSay({ what: 'approach', line: 'm-ocean-view', station: 'muni-19th-holloway' })!.voice, 'metro-sfsu-next-2');
  assert.equal(transitSay({ what: 'board', line: 'sf-loop', station: 'loop-castro' }), null, 'the loop says nothing on board');
  assert.equal(transitSay({ what: 'arrive', line: 'cable-california', station: 'x' }), null);
  assert.ok(NARRATION_REPEAT > 157 && NARRATION_REPEAT < 13.5 * 60, 'longer than the tour\'s second N / M boarding, shorter than a loop lap');
});

test('review 2 · pacer: a line\'s own repeat window; a stop\'s lead said again on board after a long wait stays quiet', async () => {
  const { transitSay } = await import('../src/opus-bay/data/sf/tours');
  const p = new LinePacer(clipsOf('zh'));
  // the N ride's lead is the board line (n-ride-9th-irving: lead 'metro-board-n'); the train comes 40 s later
  p.offer(sayLine('metro-board-n', LINE_TTL.stop)!, 0);
  assert.equal(p.step(0)!.voice, 'metro-board-n');
  const board = transitSay({ what: 'board', line: 'n-judah', station: 'muni-judah-la-playa' })!;
  assert.equal(p.offer(board, 40), false, 'said 40 s ago: not again on board (was said twice with the 25 s window)');
  assert.equal(p.offer(board, 200), false, 'the second N boarding of the tour, 135 s later: quiet');
  assert.equal(p.offer(board, 301), true, 'five minutes later she may say it again');
  // a plain line keeps the 25 s window
  const q = new LinePacer();
  q.offer({ text: bi('跟我来！', 'Follow me!') }, 0);
  q.step(0);
  assert.equal(q.offer({ text: bi('跟我来！', 'Follow me!') }, 26), true);
  // the same line waiting twice keeps the later deadline (the stop's copy has the longer ttl)
  const r = new LinePacer(clipsOf('zh'));
  assert.equal(r.offer(sayLine('loop-golden-gate-bridge-arrive', LINE_TTL.arrive)!, 0.1), true);
  assert.equal(r.offer(sayLine('loop-golden-gate-bridge-arrive', LINE_TTL.stop)!, 0.2), false, 'already waiting');
  // held (a dialogue) past the transit copy's 8 s (W9-F: + HELD_GAP's breath after the hold)
  assert.equal(r.step(0.1 + LINE_TTL.arrive + 2, true), null);
  assert.equal(r.step(0.1 + LINE_TTL.arrive + 2 + HELD_GAP)!.voice, 'loop-golden-gate-bridge-arrive', 'kept by the stop copy\'s ttl');
  // step() drops expired lines in place: no new array per call
  const s = new LinePacer();
  const queue = Reflect.get(s, 'queue');
  s.offer({ text: bi('一', 'one'), ttl: 1 }, 0);
  s.offer({ text: bi('二', 'two') }, 0);
  s.step(5, true);
  s.step(5.1, true);
  assert.equal(Reflect.get(s, 'queue'), queue, 'the same array');
  assert.equal(s.pending(), 1);
});

test('review 2 · the clip lookup: TOUR_VOICE_CLIPS in the voice language without importing audio/voice.ts', async () => {
  const { clipSecondsFrom, voiceLang } = pacerMod;
  // audio/voice.ts VoicePlayer.lang() = getLocale() === 'en' ? 'en' : 'zh'; the audio chunk is lazy, game code must not import it
  assert.equal(voiceLang('en'), 'en');
  assert.equal(voiceLang('zh-Hans'), 'zh');
  assert.equal(voiceLang('zh-Hant'), 'zh');
  let lang: 'zh' | 'en' = 'zh';
  const clip = clipSecondsFrom(TOUR_VOICE_CLIPS, () => lang);
  assert.equal(clip('grand-bay-intro'), TOUR_VOICE_CLIPS['zh-grand-bay-intro'].duration);
  lang = 'en';
  assert.equal(clip('grand-bay-intro'), TOUR_VOICE_CLIPS['en-grand-bay-intro'].duration, 'a language switch times the next line by its clip');
  assert.equal(clip('no-such-line'), undefined, 'no clip: text only');
  // linePacer stays light: type imports only
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../src/opus-bay/game/linePacer.ts', import.meta.url), 'utf8');
  assert.deepEqual(src.split('\n').filter(l => /^import /.test(l) && !/^import type /.test(l)), []);
});

test('review 2 · the whole Grand Tour with the transit narration of every station passed: no line twice, no overlap, no tour line dropped', async () => {
  const { stopSay, chapterSay, transitSay, TOUR_GEO, rideArc, rideSeconds, TOUR_MODEL, expressRide } = await import('../src/opus-bay/data/sf/tours');
  type Say = NonNullable<ReturnType<typeof stopSay>>;
  // lane T: the approach ≈ 7.3 s before the vehicle stands; the wait for a train up to ≈ 35 s (dispatch 20 + 15 s)
  for (const wait of [5, 20, 40]) for (const express of [false, true]) for (const lang of ['zh', 'en'] as const) {
    const p = new LinePacer(clipsOf(lang));
    const events: { t: number; l: Say; tour: boolean }[] = [];
    let t = 0, lastChapter = -1;
    const at = (dt: number, l: Say | null, tour = true) => { if (l) events.push({ t: t + dt, l, tour }); };
    for (const { stop, chapter } of tourStops(SF_GRAND, { express })) {
      if (chapter !== lastChapter) {
        if (lastChapter >= 0) at(0, chapterSay(SF_GRAND.chapters[lastChapter], 'outro'));
        at(0.1, chapterSay(SF_GRAND.chapters[chapter], 'intro'));
        lastChapter = chapter;
      }
      at(0.2, stopSay(stop, 'lead', express));
      let dur = (express ? stop.expressMinutes : stop.minutes) * 60;
      if (stop.leg.via === 'line') {
        const ride = express ? expressRide(SF_GRAND, stop.id)! : { line: stop.leg.line, from: stop.leg.from, to: stop.leg.to };
        const geo = TOUR_GEO[ride.line], r = rideArc(ride.line, ride.from, ride.to)!;
        const veiled = express && !stop.goal && r.arc > TOUR_MODEL.veilOver && TOUR_MODEL.veilKinds.includes(geo.kind);
        const t0 = wait + 3, ev = { line: ride.line, dir: r.dir };
        at(t0, transitSay({ ...ev, what: 'board', station: ride.from }), false);
        const end = t0 + rideSeconds(ride.line, ride.from, ride.to, veiled);
        if (veiled) at(end, transitSay({ ...ev, what: 'arrive', station: ride.to }), false);
        else {
          for (const [id, s] of Object.entries(geo.stations)) {
            if (id === ride.from) continue;
            const d = ((s.at - r.a) % geo.length + geo.length) % geo.length;
            if (geo.loop ? !(d > 0 && d <= r.arc + 1e-6) : !(s.at >= r.a - 1e-6 && s.at <= r.b + 1e-6)) continue;
            const secs = rideSeconds(ride.line, ride.from, id);
            at(t0 + secs - 7.3, transitSay({ ...ev, what: 'approach', station: id }), false);
            at(t0 + secs, transitSay({ ...ev, what: 'arrive', station: id }), false);
          }
        }
        at(end + 1, stopSay(stop, 'arrive', express));
        at(end + 3, stopSay(stop, 'done', express));
        dur = Math.max(dur, end + 5);
      } else {
        at(Math.max(1, dur - (stop.moment ? TOUR_MODEL.moment[stop.moment] : 0)), stopSay(stop, 'arrive', express));
        at(Math.max(2, dur - 2), stopSay(stop, 'done', express));
      }
      t += dur;
    }
    at(1, chapterSay(SF_GRAND.chapters[lastChapter], 'outro'));
    events.sort((a, b) => a.t - b.t);
    const accepted: { l: Say; tour: boolean; now: number }[] = [], said: { key: string; at: number; end: number }[] = [];
    let k = 0;
    for (let now = 0; now < t + 120; now += 0.1) {
      while (k < events.length && events[k].t <= now) { const e = events[k++]; if (p.offer(e.l, now)) accepted.push({ ...e, now }); }
      const s = p.step(now);
      if (s) said.push({ key: LinePacer.keyOf(s), at: now, end: now + s.seconds });
    }
    const tag = `wait ${wait} ${express ? 'express' : 'full'} ${lang}`;
    const lost = accepted.filter(e => !said.some(s => s.key === LinePacer.keyOf(e.l) && s.at >= e.now - 1e-6));
    assert.deepEqual(lost.filter(e => e.tour).map(e => e.l.key), [], `${tag}: every chapter / stop line is said`);
    const keys = said.map(s => s.key);
    assert.deepEqual(keys.filter((key, i) => keys.indexOf(key) !== i), [], `${tag}: no line twice (metro-board-n / -m and metro-stonestown-next were)`);
    for (let i = 1; i < said.length; i++) assert.ok(said[i].at >= said[i - 1].end + PACER_GAP - 1e-6, `${tag}: ${said[i - 1].key} → ${said[i].key} overlap`);
    assert.ok(said.length > 55, `${tag}: ${said.length} lines`);
  }
});
