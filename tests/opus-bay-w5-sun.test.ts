import assert from 'node:assert/strict';
import test from 'node:test';

// Wave 5 · lane R (W5-R1): San Francisco's real sun (game/qa.ts, realsf/sun.ts), the city-only time bands, the Bay
// clock's ?date= shift for tests (game/bayNow.ts __setBayNowForTests), the fire-ring season, the moon, Karl by month.

const g = globalThis as unknown as Record<string, unknown>;
g.window ??= globalThis;

const { __setBayNowForTests, bayParts, parseBayDate } = await import('../src/opus-bay/game/bayNow');
const { bayTimeOfDay, fixedHourBand, sunDay } = await import('../src/opus-bay/game/qa');
const { bayHm, sunBandAt, sunPosition, sunTimes, sunsetLine } = await import('../src/opus-bay/realsf/sun');
const { FIRE_RINGS, fireRingSeason, isFireRingLit, karlMonthFactor, KARL_BY_MONTH, FIRE_SEASON_LAST_DAY } = await import('../src/opus-bay/realsf/seasons');
const { moonPhase, SYNODIC_DAYS } = await import('../src/opus-bay/realsf/moon');
const { game } = await import('../src/opus-bay/core/store');

const bay = (spec: string) => { const d = parseBayDate(spec); assert.ok(d, spec); return d!; };
const zhLen = (s: string) => [...s].length;

/**
 * US Naval Observatory, "Sun and Moon rise/set/transit for one day" (aa.usno.navy.mil/api/rstt/oneday, coords
 * 37.7749,-122.4194, tz −8), fetched 2026-09-28. USNO gives Pacific STANDARD time: + 1 h here for dates in PDT.
 * Columns: civil dawn, sunrise, sunset, civil dusk, in Bay wall-clock time (PDT / PST as the date has it).
 */
const USNO: [string, string, string, string, string][] = [
  ['2026-09-28', '06:37', '07:03', '18:57', '19:23'],
  ['2026-10-02', '06:40', '07:06', '18:51', '19:17'],
  ['2026-10-04', '06:42', '07:08', '18:48', '19:14'],
  ['2026-10-09', '06:46', '07:13', '18:40', '19:07'],
  ['2026-10-31', '07:07', '07:34', '18:12', '18:39'],
  ['2026-11-01', '06:08', '06:35', '17:11', '17:38'],
  ['2026-11-02', '06:09', '06:36', '17:10', '17:37'],
  ['2026-12-21', '06:52', '07:21', '16:54', '17:24'],
  ['2027-01-15', '06:55', '07:24', '17:15', '17:43'],
  ['2027-03-13', '05:58', '06:24', '18:15', '18:41'],
  ['2027-03-14', '06:56', '07:22', '19:16', '19:42'],
  ['2027-03-20', '06:47', '07:13', '19:22', '19:48'],
  ['2027-06-21', '05:17', '05:48', '20:35', '21:06'],
  ['2027-06-27', '05:18', '05:50', '20:36', '21:07'],
];

test('W5-R1 sun: dawn, sunrise, sunset and dusk within 1 minute of the US Naval Observatory on 14 dates (Sep 2026 – Jun 2027, both DST edges, both solstices)', () => {
  for (const [day, ...want] of USNO) {
    const s = sunDay(day);
    const got = [s.dawn, s.sunrise, s.sunset, s.dusk];
    want.forEach((hm, i) => {
      const ref = bay(`${day}T${hm}`).getTime();
      const off = Math.abs(got[i] - ref) / 60_000;
      assert.ok(off <= 1.0, `${day} #${i}: computed ${bayHm(new Date(got[i]))} vs USNO ${hm} (${off.toFixed(2)} min)`);
    });
    assert.equal(bayParts(new Date(s.dusk)).dateKey, day, `${day}: the evening events fall on the same Bay date`);
    assert.ok(s.golden > s.sunrise && s.golden < s.sunset && s.sunset - s.golden > 25 * 60_000 && s.sunset - s.golden < 60 * 60_000, `${day}: golden light starts 25–60 min before sunset`);
  }
});

test('W5-R1 sun: the bands follow the real sun in city mode — night · morning (to sunrise + 3 h) · day (to the 6° mark) · golden (to civil dusk)', () => {
  const band = (spec: string) => bayTimeOfDay(bay(spec), 'city');
  // winter solstice: golden → night at civil dusk 17:24 (not 19:00)
  assert.equal(band('2026-12-21T16:05'), 'day');
  assert.equal(band('2026-12-21T16:20'), 'golden');
  assert.equal(band('2026-12-21T17:10'), 'golden');
  assert.equal(band('2026-12-21T17:30'), 'night');
  assert.equal(band('2026-12-21T06:45'), 'night');
  assert.equal(band('2026-12-21T07:00'), 'morning');
  assert.equal(band('2026-12-21T10:15'), 'morning');
  assert.equal(band('2026-12-21T10:30'), 'day');
  // DST ends 2026-11-01: dusk 17:38 PST
  assert.equal(band('2026-11-01T17:00'), 'golden');
  assert.equal(band('2026-11-01T17:45'), 'night');
  assert.equal(band('2026-11-01T06:05'), 'night');
  assert.equal(band('2026-11-01T06:15'), 'morning');
  // DST starts 2027-03-14: dawn 06:56 PDT, sunrise 07:22 → morning until ≈ 10:22
  assert.equal(band('2027-03-14T06:50'), 'night');
  assert.equal(band('2027-03-14T07:00'), 'morning');
  assert.equal(band('2027-03-14T10:15'), 'morning');
  assert.equal(band('2027-03-14T10:30'), 'day');
  assert.equal(band('2027-03-14T19:30'), 'golden');
  assert.equal(band('2027-03-14T19:45'), 'night');
  // summer solstice: long golden hour, night after 21:06
  assert.equal(band('2027-06-21T19:30'), 'day');
  assert.equal(band('2027-06-21T20:00'), 'golden');
  assert.equal(band('2027-06-21T21:03'), 'golden');
  assert.equal(band('2027-06-21T21:10'), 'night');
  // this week (Hardly Strictly Sunday): golden from ≈ 18:13
  assert.equal(band('2026-10-04T18:00'), 'day');
  assert.equal(band('2026-10-04T18:30'), 'golden');
  assert.equal(band('2026-10-04T19:20'), 'night');
});

test('W5-R1 sun: district mode keeps its fixed hour bands (unchanged); the default world reads the store', () => {
  for (const [spec, want] of [['2026-09-25T08:00', 'morning'], ['2026-09-25T13:00', 'day'], ['2026-09-25T18:00', 'golden'], ['2026-09-25T23:00', 'night'], ['2026-12-21T18:30', 'golden'], ['2026-12-21T05:30', 'night']] as const) {
    assert.equal(bayTimeOfDay(bay(spec), 'district'), want, spec);
    assert.equal(fixedHourBand(bay(spec)), want, spec);
  }
  const was = game.get().worldMode;
  try {
    game.set({ worldMode: 'district' });
    assert.equal(bayTimeOfDay(bay('2026-12-21T18:30')), 'golden', 'district: 18:30 is golden');
    game.set({ worldMode: 'city' });
    assert.equal(bayTimeOfDay(bay('2026-12-21T18:30')), 'night', 'city: 18:30 on the solstice is night');
  } finally { game.set({ worldMode: was }); }
});

test('W5-R1 sun: the Bay clock shift moves the bands (the ?date= path of bayNow), and sunBandAt / sunTimes read it by default', () => {
  try {
    assert.ok(__setBayNowForTests('2026-12-21T17:10'));
    assert.equal(sunBandAt(), 'golden');
    assert.equal(bayTimeOfDay(undefined, 'city'), 'golden');
    assert.equal(sunTimes().dateKey, '2026-12-21');
    assert.ok(__setBayNowForTests('2026-12-21T17:30'));
    assert.equal(sunBandAt(), 'night');
    assert.equal(bayTimeOfDay(undefined, 'city'), 'night');
    assert.equal(bayTimeOfDay(undefined, 'district'), 'golden', 'the district keeps 16–19 golden');
  } finally { __setBayNowForTests(null); }
});

test('W5-R1 sun: position (noon due south at 90° − lat + declination; about −0.83° at the computed sunset) and the sunset line', () => {
  const s = sunDay('2026-10-04');
  const noon = new Date((s.sunrise + s.sunset) / 2);
  const p = sunPosition(noon);
  assert.ok(Math.abs(p.azimuth - 180) < 1.5, `noon azimuth ${p.azimuth.toFixed(2)}`);
  assert.ok(p.elevation > 47 && p.elevation < 49, `noon elevation ${p.elevation.toFixed(2)} (Oct 4: ≈ 47.9°)`);
  const set = sunPosition(new Date(s.sunset));
  assert.ok(Math.abs(set.elevation + 0.833) < 0.15, `sunset elevation ${set.elevation.toFixed(3)}`);
  assert.ok(set.azimuth > 255 && set.azimuth < 270, `sunset azimuth ${set.azimuth.toFixed(1)} (west-south-west in October)`);
  const line = sunsetLine(bay('2026-09-28T17:00'));
  assert.equal(line.zh, '今天旧金山日落 18:57，找个坡坐下来看吧。');
  assert.ok(zhLen(line.zh) <= 45 && line.en.includes('18:57'));
});

test('W5-R1 seasons: Ocean Beach fire rings only 1 March – 31 October, 06:00 – 21:30 (NPS, checked 2026-09-28)', () => {
  assert.match(FIRE_RINGS.sourceUrl, /^https:\/\/www\.nps\.gov\//);
  assert.equal(FIRE_RINGS.verifiedAt, '2026-09-28');
  const cases: [string, boolean, boolean][] = [
    ['2026-09-28T20:00', true, true],
    ['2026-10-31T21:29', true, true],
    ['2026-10-31T21:30', true, false],
    ['2026-11-01T12:00', false, false],
    ['2026-12-21T19:00', false, false],
    ['2027-02-28T19:00', false, false],
    ['2027-03-01T05:59', true, false],
    ['2027-03-01T06:00', true, true],
    ['2027-07-04T21:00', true, true],
    ['2027-07-04T23:00', true, false],
  ];
  for (const [spec, season, lit] of cases) {
    assert.equal(fireRingSeason(bay(spec)), season, `${spec} season`);
    assert.equal(isFireRingLit(bay(spec)), lit, `${spec} lit`);
  }
  try {
    __setBayNowForTests('2026-11-01T19:00');
    assert.equal(isFireRingLit(), false, 'the default reads the Bay clock');
  } finally { __setBayNowForTests(null); }
  assert.ok(zhLen(FIRE_SEASON_LAST_DAY.zh) <= 45);
});

test('W5-R1 moon: the phase lands within 6 h of the 16 USNO phases of Sep – Dec 2026; the names follow', () => {
  // aa.usno.navy.mil/api/moon/phases/date?date=2026-09-01&nump=16, fetched 2026-09-28 (UT)
  const usno: [string, number][] = [
    ['2026-09-04T07:51Z', 0.75], ['2026-09-11T03:27Z', 0], ['2026-09-18T20:44Z', 0.25], ['2026-09-26T16:49Z', 0.5],
    ['2026-10-03T13:25Z', 0.75], ['2026-10-10T15:50Z', 0], ['2026-10-18T16:12Z', 0.25], ['2026-10-26T04:12Z', 0.5],
    ['2026-11-01T20:28Z', 0.75], ['2026-11-09T07:02Z', 0], ['2026-11-17T11:48Z', 0.25], ['2026-11-24T14:53Z', 0.5],
    ['2026-12-01T06:08Z', 0.75], ['2026-12-09T00:52Z', 0], ['2026-12-17T05:42Z', 0.25], ['2026-12-24T01:28Z', 0.5],
  ];
  for (const [iso, want] of usno) {
    const m = moonPhase(new Date(iso));
    let d = (m.phase - want) * SYNODIC_DAYS;
    d -= Math.round(d / SYNODIC_DAYS) * SYNODIC_DAYS;
    assert.ok(Math.abs(d) < 0.25, `${iso}: ${d.toFixed(2)} days off`);
  }
  assert.equal(moonPhase(new Date('2026-10-10T20:00Z')).name, 'new');
  const full = moonPhase(bay('2026-10-25T21:00'));
  assert.equal(full.name, 'full');
  assert.ok(full.illumination > 0.97);
  assert.equal(moonPhase(new Date('2026-10-18T16:12Z')).name, 'first-quarter');
  assert.ok(moonPhase(new Date('2026-10-14T00:00Z')).waxing);
});

test('W5-R1 Karl by month: July the foggiest, October the clearest of summer–autumn, all in 0..1', () => {
  assert.equal(KARL_BY_MONTH.length, 12);
  assert.ok(KARL_BY_MONTH.every(v => v >= 0 && v <= 1));
  assert.equal(Math.max(...KARL_BY_MONTH), karlMonthFactor(bay('2027-07-10T12:00')));
  assert.ok(karlMonthFactor(bay('2026-10-10T12:00')) < karlMonthFactor(bay('2026-09-10T12:00')) + 1e-9);
  assert.ok(karlMonthFactor(bay('2026-10-10T12:00')) < karlMonthFactor(bay('2027-06-10T12:00')));
  assert.ok(karlMonthFactor(bay('2027-08-10T12:00')) > 0.8);
});
