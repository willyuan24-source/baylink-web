import assert from 'node:assert/strict';
import test from 'node:test';

/**
 * Wave 7 · lane S (W7-S2): real dates of October – November 2026 in realsf/calendar.ts (each row with its own source and
 * check date), BAYBAY's lines of rows without a dressing (calendarLines), the Blue Angels hedge on Fleet Week's show days
 * (realsf/jets.ts), and the map's 明天 on the DST days (ui/mapEvents.ts whenLabel: the next Bay date, not now + 24 h).
 */

const g = globalThis as unknown as Record<string, unknown>;
g.location = { search: '?world=city&save=off', href: 'http://localhost/opus-bay?world=city&save=off', pathname: '/opus-bay', hostname: 'localhost' };
g.window ??= globalThis;
const noop = () => undefined;
const ctx2d = new Proxy({}, {
  get: (_t, k) => (k === 'measureText' ? () => ({ width: 10 }) : k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop: noop }) : k === 'getImageData' ? (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }) : noop),
  set: () => true,
});
g.document ??= { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => ctx2d }) };

const { parseBayDate } = await import('../src/opus-bay/game/bayNow');
const cal = await import('../src/opus-bay/realsf/calendar');
const { whenLabel } = await import('../src/opus-bay/ui/mapEvents');
const J = await import('../src/opus-bay/realsf/jets');
const { sunTimes, sunHm } = await import('../src/opus-bay/realsf/sun');

const bay = (spec: string) => { const d = parseBayDate(spec); assert.ok(d, spec); return d!; };
const zhLen = (s: string) => [...s].length;
const FAR = { x: 5000, z: 5000 };
const ids = (spec: string, p: { x: number; z: number }) => cal.calendarLines(bay(spec), p).map(l => l.key);

test('W7-S2 calendar rows: DST ends 1 Nov, Día de los Muertos on 2 Nov (usually, 以官网为准), the Chinatown Halloween Festival, the Alcatraz sunrise, the Parade of Ships — each with its own source checked 2026-09-29', () => {
  const W7 = ['dst-end-2026', 'dia-de-los-muertos-2026', 'chinatown-halloween-festival-2026', 'alcatraz-sunrise-2026-10', 'fleet-week-parade-of-ships-2026'];
  for (const id of W7) {
    const r = cal.CALENDAR.find(x => x.id === id);
    assert.ok(r, id);
    // (W8-S) the Parade of Ships was re-read on 2026-09-30 (its toy ships)
    assert.ok(['2026-09-29', '2026-09-30'].includes(r!.source.verifiedAt), id);
    assert.match(r!.source.url, /^https:\/\//);
    assert.ok(!r!.hidden && !r!.later, `${id} is shown`);
    assert.ok(zhLen(r!.note.zh) <= 40 && (!r!.line || zhLen(r!.line.zh) <= 45), id);
    // a fixed line (lane X voices it by its exact text): the zh has no number that could change, no template
    if (r!.line) { assert.doesNotMatch(r!.line.zh + r!.line.en, /\$\{|undefined/, `${id}: a fixed line`); assert.doesNotMatch(r!.line.zh, /\d/, id); }
  }
  assert.deepEqual(cal.calendarOn('2026-11-01').map(r => r.id), ['dst-end-2026']);
  assert.deepEqual(cal.calendarOn('2026-11-02').map(r => r.id), ['dia-de-los-muertos-2026']);
  assert.deepEqual(cal.calendarOn('2026-10-31').map(r => r.id).sort(), ['chinatown-halloween-festival-2026', 'halloween-2026']);
  assert.deepEqual(cal.calendarOn('2026-10-12').map(r => r.id), ['alcatraz-sunrise-2026-10']);
  assert.deepEqual(cal.calendarOn('2026-10-09').map(r => r.id), ['fleet-week-parade-of-ships-2026', 'fleet-week-blue-angels-2026'], 'W8-S: the Blue Angels row on the three air-show days');
  // 这周 a week ahead: on Oct 25 the Halloween rows and the DST change; on Oct 26 the muertos row too
  assert.deepEqual(cal.calendarAhead('2026-10-25', 7).map(r => r.id).sort(), ['chinatown-halloween-festival-2026', 'dst-end-2026', 'halloween-2026']);
  assert.ok(cal.calendarAhead('2026-10-26', 7).some(r => r.id === 'dia-de-los-muertos-2026'));
  // Día de los Muertos: the procession's corner, 19:00, a custom (usually), never Garfield Square again
  const dia = cal.CALENDAR.find(r => r.id === 'dia-de-los-muertos-2026')!;
  assert.equal(dia.grade, 'usually');
  assert.equal(dia.at, 19 * 60);
  assert.deepEqual(dia.xz, cal.BRYANT_22);
  assert.match(dia.note.zh, /以官网为准/);
  assert.match(dia.where.en, /Bryant/);
  // the DST row: official, today's sunset read from sun.ts at runtime (17:11 on 1 Nov 2026, standard time)
  const dst = cal.CALENDAR.find(r => r.id === 'dst-end-2026')!;
  assert.equal(dst.grade, 'official');
  assert.equal(dst.sunsetNote, true);
  assert.equal(sunHm(sunTimes(bay('2026-11-01T10:00')).sunset), '17:11');
  assert.equal(sunHm(sunTimes(bay('2026-10-31T10:00')).sunset), '18:12', 'the day before, still daylight time');
  // the Alcatraz gathering is a secondary-source row: its note or grade says 以官网为准
  const alc = cal.CALENDAR.find(r => r.id === 'alcatraz-sunrise-2026-10')!;
  assert.equal(alc.grade, 'secondary');
});

test('W7-S2 calendarLines: DST anywhere on 1 Nov; Chinatown near Waverly 11:00–15:00; the Alcatraz line near Pier 33 in the morning; the dressing rows keep their own lines', () => {
  assert.deepEqual(ids('2026-11-01T09:00', FAR), ['calendar-dst-end-2026'], 'anywhere in the city');
  assert.deepEqual(ids('2026-10-31T23:30', FAR), [], 'not the night before');
  assert.deepEqual(ids('2026-10-31T12:00', cal.WAVERLY_PLACE), ['calendar-chinatown-halloween-festival-2026']);
  assert.deepEqual(ids('2026-10-31T10:30', cal.WAVERLY_PLACE), [], 'before 11:00');
  assert.deepEqual(ids('2026-10-31T15:00', cal.WAVERLY_PLACE), [], 'over at 15:00');
  assert.deepEqual(ids('2026-10-31T12:00', FAR), [], 'far from Chinatown');
  assert.deepEqual(ids('2026-10-12T08:00', cal.PIER_33), ['calendar-alcatraz-sunrise-2026-10']);
  assert.deepEqual(ids('2026-10-12T13:00', cal.PIER_33), [], 'a morning line');
  // Halloween's pumpkins and the king tides say their lines through realsf/dressing.ts, not twice
  assert.ok(!ids('2026-10-31T12:00', { x: 8.7, z: 572.4 }).includes('calendar-halloween-2026'));
  assert.deepEqual(ids('2026-11-24T12:00', { x: 131.5, z: 15.1 }), []);
  // Día de los Muertos: lane H's world says the procession lines; the calendar row has none
  assert.deepEqual(ids('2026-11-02T18:30', cal.BRYANT_22), []);
});

test('W7-S2 Fleet Week: the Blue Angels line on a show day until 15:00 (usually ≈ 3 pm, 以官网为准), a fixed line', () => {
  assert.equal(J.blueLineOn(bay('2026-10-09T10:00')), true);
  assert.equal(J.blueLineOn(bay('2026-10-10T14:30')), true);
  assert.equal(J.blueLineOn(bay('2026-10-11T15:00')), false, 'from 3 pm the jets line says the rest');
  assert.equal(J.blueLineOn(bay('2026-10-08T14:00')), false, 'not the practice day');
  assert.equal(J.blueLineOn(bay('2026-10-12T12:00')), false);
  assert.match(J.JETS_BLUE_LINE.zh, /通常.*以官网为准/);
  assert.doesNotMatch(J.JETS_BLUE_LINE.zh + J.JETS_BLUE_LINE.en, /\$\{/);
  assert.ok(zhLen(J.JETS_BLUE_LINE.zh) <= 45);
});

test('W7-S2 the map’s 明天 is the next Bay date on the DST days (red before: now + 24 h)', () => {
  const at = (spec: string) => bay(spec).getTime();
  // 1 Nov 2026 00:30 PDT: now + 24 h was 1 Nov 23:30 PST — "tomorrow" was today, and the Nov 2 muertos evening read 11/2 周一
  const now = at('2026-11-01T00:30');
  assert.deepEqual(whenLabel(at('2026-11-02T19:00'), at('2026-11-02T21:00'), now), { zh: '明天 19:00–21:00', en: 'Tomorrow 19:00–21:00' });
  assert.equal(whenLabel(at('2026-11-01T12:00'), at('2026-11-01T15:00'), now).zh, '今天 12:00–15:00');
  // 13 Mar 2027 23:30 PST: now + 24 h was 15 Mar 00:30 PDT
  const spring = at('2027-03-13T23:30');
  assert.equal(whenLabel(at('2027-03-14T10:00'), at('2027-03-14T12:00'), spring).zh, '明天 10:00–12:00');
  assert.match(whenLabel(at('2027-03-15T10:00'), at('2027-03-15T12:00'), spring).zh, /^3\/15 /);
  // an ordinary day is unchanged
  assert.equal(whenLabel(at('2026-10-11T12:30'), at('2026-10-11T16:30'), at('2026-10-10T09:00')).zh, '明天 12:30–16:30');
});
