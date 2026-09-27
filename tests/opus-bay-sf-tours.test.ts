import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import test from 'node:test';

// Wave 4 · lane C · W4-C3 / W4-C4: BAYBAY's frozen tour lines (data/sf/tourLines.ts: 16 loop stops, the Metro, the
// Grand Tour chapters, arrival and quiet lines) and the Grand Tour data (data/sf/tours.ts `sf-grand`): every stop
// resolves, the legs are reachable in order, the declared minutes are the timing model's and the chapters add up,
// the goals are completed honestly on the way, the express version and the save decoder.

const ROOT = new URL('..', import.meta.url);
const readJson = (rel: string) => JSON.parse(fs.readFileSync(new URL(rel, ROOT), 'utf8'));
const lines = await import('../src/opus-bay/data/sf/tourLines');
const { TOUR_LINES, TOUR_LINES_FROZEN, LOOP_STOP_LINES, METRO_LINES, CHAPTER_LINES, GRAND_CHAPTER_IDS, ARRIVAL_LINES, QUIET_LINES, tourLine, loopNarration, loopHopOffTip } = lines;
const tours = await import('../src/opus-bay/data/sf/tours');
const { SF_GRAND, TOUR_GEO, TOUR_MODEL, targetAt, rideArc, rideSeconds, stopSeconds, tourStops, chapterMinutes, expressRide, decodeTourSaves, tourResumeLabel, cityTour, GRAND_TOUR_ID, TOUR_SAVE_MAX_IDS } = tours;
const { SF_LANDMARK_INFO } = await import('../src/opus-bay/data/sf/landmarks');

const zhWidth = (text: string) => [...text].reduce((sum, ch) => sum + (ch === ' ' ? 0 : ch.charCodeAt(0) < 128 ? 0.5 : 1), 0);
const ATTR: { id: string; mapRank: number; treatment: string }[] = readJson('docs/opus-bay/sf-w4-attractions.json').attractions;
const PLACES: { id: string }[] = readJson('public/opus-bay/sf/v1/places.json').places;
const placeIds = new Set([...PLACES.map(p => p.id), ...ATTR.filter(a => a.treatment !== 'stop').map(a => a.id)]);
const landmarkIds = new Set(SF_LANDMARK_INFO.map(l => l.id));
const attractionIds = new Set([...ATTR.map(a => a.id), ...landmarkIds, ...PLACES.map(p => p.id)]);
/** lane T's station ids (data/sf/stationNames.ts, draft 2026-09-27): the 16 loop stops */
const LOOP_IDS = ['ferry-building', 'pier-39', 'wharf-hyde', 'palace-of-fine-arts', 'golden-gate-bridge', 'legion-of-honor', 'lands-end-sutro', 'ocean-beach-windmill', 'golden-gate-park', 'haight-ashbury', 'painted-ladies', 'castro', 'twin-peaks', 'mission-dolores', 'civic-center', 'chinatown'].map(s => `loop-${s}`);

// ---------------------------------------------------------------------------------------------------------------
// tourLines (frozen)
// ---------------------------------------------------------------------------------------------------------------

test('tour lines: unique ids, one idea per bubble (zh ≤ 45, en ≤ 110), real facts carry a source', () => {
  const ids = TOUR_LINES.map(l => l.id);
  assert.equal(new Set(ids).size, ids.length, 'voice ids are unique');
  for (const l of TOUR_LINES) {
    assert.match(l.id, /^[a-z0-9-]+$/, `${l.id} kebab-case`);
    assert.ok(/[一-鿿]/.test(l.zh) && !/[一-鿿]/.test(l.en), `${l.id} zh / en`);
    assert.ok(zhWidth(l.zh) <= 45, `${l.id} zh ≤ 45 (${l.zh})`);
    assert.ok(l.en.length <= 110, `${l.id} en ≤ 110`);
    assert.ok(!/按 ?E|press E/i.test(l.zh + l.en), `${l.id}: no controller hints`);
    // a year in a line is a fact: it carries a source (arrival lines take theirs from the card, tested in sf-cards)
    if (/\b1[89]\d\d\b|20[12]\d/.test(l.zh) && !l.id.startsWith('arrive-')) assert.ok(l.source?.url.startsWith('https://'), `${l.id} has a source`);
    if (l.source) assert.equal(l.source.verifiedAt, TOUR_LINES_FROZEN);
  }
  assert.equal(tourLine('metro-subway')?.zh, METRO_LINES.subway.zh);
});

test('tour lines are FROZEN: the recorded texts match the snapshot lane V records (a new wording needs a new id)', () => {
  assert.equal(TOUR_LINES_FROZEN, '2026-09-27');
  const snapshot = createHash('sha256').update(TOUR_LINES.map(l => `${l.id}\u0001${l.zh}\u0001${l.en}`).join('\u0002')).digest('hex').slice(0, 16);
  assert.equal(TOUR_LINES.length, 48 + 14 + 10 + 31 + 4);
  assert.equal(snapshot, FROZEN_SNAPSHOT, 'the frozen tour lines changed: add new ids instead of editing recorded ones');
});

test('the loop: all 16 stops (lane T ids) with approach / arrive / hop-off tip; the side words match the measured side', () => {
  assert.deepEqual(Object.keys(LOOP_STOP_LINES), LOOP_IDS);
  for (const [id, s] of Object.entries(LOOP_STOP_LINES)) {
    assert.equal(s.approach.id, `${id}-approach`);
    assert.equal(s.arrive.id, `${id}-arrive`);
    assert.equal(s.hopOffTip.id, `${id}-tip`);
    assert.ok(attractionIds.has(s.look), `${id} looks at a known attraction / landmark / place (${s.look})`);
    const said = s.approach.zh;
    if (s.side === 'left') assert.ok(said.includes('左手边'), `${id} says left`);
    else if (s.side === 'right') assert.ok(said.includes('右手边'), `${id} says right`);
    else assert.ok(!/左手边|右手边/.test(said), `${id} says no side`);
  }
  // measured bearings (C:/Users/willy/opus-qa/w4/w4-c/sides.mjs): GGB right, windmill / de Young / Painted Ladies left
  assert.equal(LOOP_STOP_LINES['loop-golden-gate-bridge'].side, 'right');
  assert.equal(LOOP_STOP_LINES['loop-painted-ladies'].side, 'left');
  // narration hook for lane T's transit events
  assert.equal(loopNarration({ what: 'approach', line: 'sf-loop', station: 'loop-castro' })?.id, 'loop-castro-approach');
  assert.equal(loopNarration({ what: 'arrive', line: 'sf-loop', station: 'loop-castro' })?.id, 'loop-castro-arrive');
  assert.equal(loopNarration({ what: 'depart', line: 'sf-loop', station: 'loop-castro' }), null);
  assert.equal(loopNarration({ what: 'approach', line: 'n-judah', station: 'loop-castro' }), null);
  assert.equal(loopHopOffTip('loop-twin-peaks')?.id, 'loop-twin-peaks-tip');
  assert.equal(loopHopOffTip('nope'), null);
});

test('Metro, chapters, arrivals and quiet lines are complete', () => {
  assert.equal(Object.keys(METRO_LINES).length, 14);
  assert.deepEqual([...GRAND_CHAPTER_IDS], ['bay', 'coast', 'sunset-n', 'south-m', 'peaks-downtown']);
  for (const id of GRAND_CHAPTER_IDS) {
    assert.equal(CHAPTER_LINES[id].intro.id, `grand-${id}-intro`);
    assert.equal(CHAPTER_LINES[id].outro.id, `grand-${id}-outro`);
  }
  for (const [id, l] of Object.entries(ARRIVAL_LINES)) assert.equal(l.id, `arrive-${id}`);
  // quiet lines are said softly
  for (const l of Object.values(QUIET_LINES)) assert.equal(l.mood, 'thinking');
  assert.ok(QUIET_LINES['national-aids-memorial-grove']);
});

// ---------------------------------------------------------------------------------------------------------------
// The Grand Tour
// ---------------------------------------------------------------------------------------------------------------

const allStops = tourStops(SF_GRAND, { optional: true });

test('sf-grand: 5 chapters with the frozen intros / outros; stable unique stop ids; every target resolves', () => {
  assert.equal(SF_GRAND.id, GRAND_TOUR_ID);
  assert.equal(cityTour('sf-grand'), SF_GRAND);
  assert.deepEqual(SF_GRAND.chapters.map(c => c.id), [...GRAND_CHAPTER_IDS]);
  for (const c of SF_GRAND.chapters) {
    assert.ok(tourLine(c.intro) && tourLine(c.outro), `${c.id} intro / outro are frozen lines`);
    assert.ok(c.stops.length >= 4, `${c.id} has stops`);
  }
  const ids = allStops.map(f => f.stop.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const { stop } of allStops) {
    const t = stop.target;
    if (t.startsWith('transit-')) {
      const station = t.slice(8);
      assert.ok(Object.values(TOUR_GEO).some(l => l.stations[station]), `${stop.id}: station ${station} is on a tour line`);
      assert.match(station, /^(loop|muni)-[a-z0-9-]+$|^(powell|california)-[a-z-]+$/, `${stop.id}: station id form`);
    } else if (t.startsWith('sf:')) assert.ok(landmarkIds.has(t.slice(3)), `${stop.id}: landmark ${t}`);
    else if (t.startsWith('place:')) assert.ok(placeIds.has(t.slice(6)), `${stop.id}: place ${t}`);
    else assert.fail(`${stop.id}: target ${t} is not sf: / place: / transit-`);
    assert.ok(targetAt(t), `${stop.id}: position known`);
    if (stop.attraction) assert.ok(attractionIds.has(stop.attraction), `${stop.id}: attraction ${stop.attraction}`);
  }
});

test('the legs are reachable in order: walks stay short, rides board near the previous stop and run on their line', () => {
  let prev = targetAt('transit-loop-ferry-building')!;
  for (const { stop } of allStops) {
    const end = targetAt(stop.target)!;
    if (stop.leg.via === 'walk') {
      const d = Math.hypot(end.x - prev.x, end.z - prev.z);
      assert.ok(d <= 170, `${stop.id}: a BAYBAY-led walk of ${d.toFixed(0)} u`);
    } else {
      const { line, from, to } = stop.leg;
      const geo = TOUR_GEO[line];
      assert.ok(geo?.stations[from] && geo.stations[to], `${stop.id}: ${from} → ${to} on ${line}`);
      const board = geo.stations[from];
      assert.ok(Math.hypot(board.x - prev.x, board.z - prev.z) <= 170, `${stop.id}: the boarding station is a short walk away`);
      assert.equal(stop.target, `transit-${to}`, `${stop.id}: a ride ends at its alighting station`);
      const r = rideArc(line, from, to)!;
      assert.ok(r.arc > 0 && r.arc < geo.length, `${stop.id}: a real ride`);
    }
    if (!stop.optional) prev = end;
  }
  // the tour ends where it began
  assert.equal(allStops.at(-1)!.stop.target, 'place:ferry-building');
});

test('declared minutes are the timing model\'s; chapters add up to ≈ 26 min, express ≈ 17 min', () => {
  let prev = targetAt('transit-loop-ferry-building')!;
  for (const { stop } of allStops) {
    const s = stopSeconds(stop, prev);
    assert.ok(Number.isFinite(s), `${stop.id} models`);
    assert.ok(Math.abs(s / 60 - stop.minutes) <= 0.15, `${stop.id}: declared ${stop.minutes} vs model ${(s / 60).toFixed(2)}`);
    if (!stop.optional) prev = targetAt(stop.target)!;
  }
  prev = targetAt('transit-loop-ferry-building')!;
  for (const { stop } of tourStops(SF_GRAND, { express: true })) {
    const ride = expressRide(SF_GRAND, stop.id);
    const s = stopSeconds(stop, prev, { express: true, ...(ride ? { from: ride.from, to: ride.to } : {}) });
    assert.ok(Math.abs(s / 60 - stop.expressMinutes) <= 0.15, `${stop.id}: express declared ${stop.expressMinutes} vs model ${(s / 60).toFixed(2)}`);
    prev = ride ? targetAt(`transit-${ride.to}`)! : targetAt(stop.target)!;
  }
  for (const { stop } of allStops) if (stop.express === 'skip') assert.equal(stop.expressMinutes, 0, `${stop.id} skipped in express`);
  const chapters = SF_GRAND.chapters.map(c => chapterMinutes(c));
  assert.ok(Math.abs(chapters.reduce((a, b) => a + b, 0) - SF_GRAND.minutes) < 0.05, 'chapters add up to the total');
  assert.ok(SF_GRAND.minutes >= 23 && SF_GRAND.minutes <= 28, `full ≈ 26 min (${SF_GRAND.minutes})`);
  assert.ok(SF_GRAND.expressMinutes >= 15 && SF_GRAND.expressMinutes <= 21, `express ≈ 17 min (${SF_GRAND.expressMinutes})`);
  assert.ok(chapters.every(m => m >= 3 && m <= 9), `each chapter 3–9 min (${chapters.join(' / ')})`);
  assert.ok(SF_GRAND.subtitle.zh.includes(`约 ${Math.round(SF_GRAND.minutes)} 分钟`), 'the subtitle shows the honest total');
  // the model: a whole loop lap ≈ 14 min (plan §3.2), subway at the compressed speed
  const lap = rideSeconds('sf-loop', 'loop-ferry-building', 'loop-chinatown') + rideSeconds('sf-loop', 'loop-chinatown', 'loop-ferry-building') + TOUR_MODEL.bus.dwell;
  assert.ok(lap / 60 > 12.5 && lap / 60 < 14.5, `lap ${(lap / 60).toFixed(1)} min`);
  assert.equal(rideSeconds('m-ocean-view', 'muni-church', 'muni-19th-holloway', true), TOUR_MODEL.veil, 'express veils long Metro legs');
  assert.ok(rideSeconds('sf-loop', 'loop-ferry-building', 'loop-golden-gate-bridge', true) > 100, 'the bus keeps its narration in express');
});

test('goals are completed honestly on the way; postcards lie on the route', () => {
  const goals = new Set(allStops.map(f => f.stop.goal).filter(Boolean));
  for (const g of ['sightseeing', 'metro', 'campuses', 'twin-peaks', 'cable-car', 'painted-ladies', 'golden-gate']) assert.ok(goals.has(g), `goal ${g}`);
  const cable = allStops.find(f => f.stop.goal === 'cable-car')!.stop;
  assert.equal(cable.leg.via, 'line');
  if (cable.leg.via === 'line') assert.ok(rideArc(cable.leg.line, cable.leg.from, cable.leg.to)!.arc > 150, 'the cable-car ride is > 150 u');
  // Twin Peaks counts "on foot": BAYBAY leads the last ≈ 40 u from the bus stop
  const peak = allStops.find(f => f.stop.goal === 'twin-peaks')!.stop;
  assert.equal(peak.leg.via, 'walk');
  const bus = targetAt('transit-loop-twin-peaks')!, top = targetAt(peak.target)!;
  assert.ok(Math.hypot(bus.x - top.x, bus.z - top.z) >= 30, 'walked up');
  const postcardSrc = fs.readFileSync(new URL('src/opus-bay/data/sf/postcards.ts', ROOT), 'utf8');
  for (const { stop } of allStops) if (stop.postcard) assert.ok(postcardSrc.includes(`'${stop.postcard}'`), `${stop.id}: postcard ${stop.postcard}`);
  // the deck walk is optional and not counted; the express keeps GGB, Twin Peaks and SF State
  assert.equal(allStops.find(f => f.stop.id === 'bay-deck')!.stop.optional, true);
  const expressIds = tourStops(SF_GRAND, { express: true }).map(f => f.stop.id);
  for (const id of ['bay-vista', 'peaks-overlook', 'm-sfsu']) assert.ok(expressIds.includes(id), `express keeps ${id}`);
  for (const id of ['coast-sutro', 'n-tea-garden', 'n-painted-ladies', 'm-stonestown']) assert.ok(!expressIds.includes(id), `express skips ${id}`);
  assert.deepEqual(expressRide(SF_GRAND, 'n-ride-duboce'), { line: 'n-judah', from: 'muni-judah-la-playa', to: 'muni-duboce-church' });
  assert.deepEqual(expressRide(SF_GRAND, 'm-ride-winston'), { line: 'm-ocean-view', from: 'muni-church', to: 'muni-19th-holloway' });
});

test('stop lines: frozen ids resolve, plain bubbles keep the limits', () => {
  for (const { stop } of allStops) {
    for (const [k, say] of Object.entries(stop.lines)) {
      if (!say) continue;
      if (typeof say === 'string') assert.ok(tourLine(say), `${stop.id}.${k}: ${say} is a frozen line`);
      else {
        assert.ok(zhWidth(say.zh) <= 45, `${stop.id}.${k} zh ≤ 45 (${say.zh})`);
        assert.ok(say.en.length <= 110, `${stop.id}.${k} en ≤ 110`);
      }
    }
  }
});

test('save v2 `tours`: untrusted input is clamped and validated, never thrown', () => {
  assert.deepEqual(decodeTourSaves(null), {});
  assert.deepEqual(decodeTourSaves([1, 2]), {});
  assert.deepEqual(decodeTourSaves('x'), {});
  const d = decodeTourSaves({
    'sf-grand': { chapter: 99, stop: -4, completed: ['bay-start', 'nope', 'bay-start', 42, 'coast-sutro'], express: true },
    'BAD ID': { chapter: 1 },
    'future-tour': { chapter: 2.7, stop: 'x', completed: ['a-b', '../x'] },
    'broken': 5,
  });
  assert.deepEqual(d['sf-grand'], { chapter: 4, stop: 0, completed: ['bay-start', 'coast-sutro'], express: true });
  assert.deepEqual(d['future-tour'], { chapter: 2, stop: 0, completed: ['a-b'] });
  assert.equal(d['BAD ID'], undefined);
  assert.equal(d.broken, undefined);
  const many = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`t-${i}`, { chapter: 0, stop: 0, completed: [] }]));
  assert.equal(Object.keys(decodeTourSaves(many)).length, TOUR_SAVE_MAX_IDS);
  assert.equal(tourResumeLabel(SF_GRAND, { chapter: 2, stop: 1, completed: ['bay-start'] }).zh, '继续一日游 · 第 3 章');
  assert.match(tourResumeLabel(SF_GRAND, undefined).zh, /^环游旧金山 · 一日游（约 \d+ 分钟）$/);
});

/** Snapshot of the frozen tour lines (id + zh + en). Changing a recorded line fails here on purpose. */
const FROZEN_SNAPSHOT = 'a799f903365d56e8';
