import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import zlib from 'node:zlib';

/**
 * Wave 5 · lane R (W5-R7, the shoulds): the verified calendar (realsf/calendar.ts) and its dressings (realsf/dressing.ts:
 * Halloween's pumpkins on the published city, the king tides' spray), the baked tides (scripts/opus-sf/export-tides.ts →
 * tides.json → realsf/tides.ts), BAYLINK's offers (scripts/opus-sf/export-live.ts → live.json → realsf/live.ts), 现实中怎么去
 * (realsf/transitReal.ts), the full-moon line, and the 今天 tab's new rows (the tides, today's offers, the calendar,
 * 我的周末, 走走看). City mode, like the game.
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

const { parseBayDate, bayParts, __setBayNowForTests } = await import('../src/opus-bay/game/bayNow');
const tides = await import('../src/opus-bay/realsf/tides');
const live = await import('../src/opus-bay/realsf/live');
const cal = await import('../src/opus-bay/realsf/calendar');
const dressing = await import('../src/opus-bay/realsf/dressing');
const real = await import('../src/opus-bay/realsf/transitReal');

const V1 = path.resolve('public/opus-bay/sf/v1');
const bay = (spec: string) => { const d = parseBayDate(spec); assert.ok(d, spec); return d!; };
const zhLen = (s: string) => [...s].length;
const TIDES_RAW = JSON.parse(fs.readFileSync(path.join(V1, 'tides.json'), 'utf8')) as unknown;
const LIVE_RAW = JSON.parse(fs.readFileSync(path.join(V1, 'live.json'), 'utf8')) as unknown;

test('W5-R7 tides: the baked NOAA file (9414290, MLLW, 15 months, ≤ 8 KB gzip), alternating highs and lows, the cosine between them, nothing past the end', () => {
  const buf = fs.readFileSync(path.join(V1, 'tides.json'));
  assert.ok(zlib.gzipSync(buf, { level: 9 }).length <= 8 * 1024, `tides.json gzip ${zlib.gzipSync(buf, { level: 9 }).length} B`);
  const t = tides.parseTides(TIDES_RAW);
  assert.ok(t, 'parses');
  assert.equal(t!.station, '9414290');
  assert.match(t!.source, /^https:\/\/tidesandcurrents\.noaa\.gov\//);
  const raw = TIDES_RAW as { datum: string; units: string; from: string; to: string; api: string };
  assert.equal(raw.datum, 'MLLW');
  assert.equal(raw.units, 'ft');
  assert.match(raw.api, /application=/, 'NOAA asks for the application parameter');
  const ex = t!.ex;
  assert.ok(ex.length > 1600 && ex.length < 2000, `${ex.length} extremes`);
  assert.ok(ex[0].ms <= Date.parse('2026-09-01T12:00:00Z') && ex[ex.length - 1].ms >= Date.parse('2027-11-30T00:00:00Z'), 'Sep 2026 … Nov 2027');
  for (let i = 1; i < ex.length; i++) {
    assert.notEqual(ex[i].kind, ex[i - 1].kind, `alternates at ${i}`);
    const gap = (ex[i].ms - ex[i - 1].ms) / 3600_000;
    assert.ok(gap > 1 && gap < 11, `gap ${gap.toFixed(1)} h at ${i}`);
    if (ex[i].kind === 'H') assert.ok(ex[i].ft > ex[i - 1].ft, `a high above the low before it at ${i}`);
  }
  for (const e of ex) assert.ok(e.ft > -3 && e.ft < 8.5, `${e.ft} ft`);
  // two predictions read from NOAA's API on 2026-09-28 (UTC): 2026-10-01 11:24 H 4.416, 2026-10-02 05:04 L −0.188
  const at = (iso: string) => ex.find(e => e.ms === Date.parse(iso));
  assert.deepEqual(at('2026-10-01T11:24:00Z'), { ms: Date.parse('2026-10-01T11:24:00Z'), ft: 4.42, kind: 'H' });
  assert.deepEqual(at('2026-10-02T05:04:00Z'), { ms: Date.parse('2026-10-02T05:04:00Z'), ft: -0.19, kind: 'L' });
  // the cosine: exact at the extremes, between them inside their range, monotone
  const [a, b] = [ex[100], ex[101]];
  assert.equal(tides.tideAt(a.ms, t), a.ft);
  let last = a.ft;
  for (let k = 1; k <= 20; k++) {
    const v = tides.tideAt(a.ms + ((b.ms - a.ms) * k) / 20, t)!;
    assert.ok(v >= Math.min(a.ft, b.ft) - 1e-9 && v <= Math.max(a.ft, b.ft) + 1e-9);
    assert.ok(b.ft > a.ft ? v >= last - 1e-9 : v <= last + 1e-9, 'monotone');
    last = v;
  }
  assert.ok(Math.abs(tides.tideAt(b.ms, t)! - b.ft) < 1e-9);
  // the Bay date's extremes, the next one, past the end
  const oct3 = tides.tidesOnDay('2026-10-03', t);
  assert.ok(oct3.length >= 3 && oct3.length <= 4, `${oct3.length} on Oct 3`);
  for (const e of oct3) assert.equal(bayParts(new Date(e.ms)).dateKey, '2026-10-03');
  assert.ok(tides.nextTide(bay('2026-10-03T10:30').getTime(), 'L', t)!.ms > bay('2026-10-03T10:30').getTime());
  assert.equal(tides.tideAt(Date.parse('2028-01-01T00:00:00Z'), t), null, 'past the file: nothing');
  assert.deepEqual(tides.tidesOnDay('2028-01-01', t), []);
  assert.equal(tides.tideAt(Date.now(), null), null);
  // loudness for the Wave Organ: 0.25 … 1, the neutral 0.7 without a table
  assert.equal(tides.tideLoudness(0, null), 0.7);
  const hi = ex.filter(e => e.kind === 'H').reduce((p, q) => (q.ft > p.ft ? q : p)), lo = ex.filter(e => e.kind === 'L').reduce((p, q) => (q.ft < p.ft ? q : p));
  assert.equal(tides.tideLoudness(hi.ms, t), 1);
  assert.equal(tides.tideLoudness(lo.ms, t), 0.25);
  // untrusted input
  for (const bad of [null, 1, {}, { t0: 1, dt: [0], h: [1], k: 'X' }, { t0: 1, dt: [0, 0], h: [1, 2], k: 'HL' }, { t0: 1, dt: [0, 5], h: [1], k: 'HL' }]) assert.equal(tides.parseTides(bad), null);
});

test('W5-R7 king tides: the calendar\'s three official spans; the spray only within 100 min of the day\'s highest tide; its points on the seawall', async () => {
  const t = tides.parseTides(TIDES_RAW)!;
  const kt = cal.CALENDAR.filter(r => r.dress === 'king-tide');
  assert.deepEqual(kt.map(r => [r.from, r.to]), [['2026-11-24', '2026-11-26'], ['2026-12-23', '2026-12-25'], ['2027-01-21', '2027-01-22']]);
  for (const r of kt) { assert.equal(r.grade, 'official'); assert.equal(r.source.url, 'https://www.coastal.ca.gov/kingtides/'); }
  const day = '2026-11-25';
  const top = dressing.highestTide(day, tides.tidesOnDay(day, t))!;
  assert.ok(top && top.kind === 'H' && top.ft > 6.5, `the king tide ${top?.ft} ft`);
  const rows = cal.dressingOn(day);
  assert.ok(dressing.sprayUp(new Date(top.ms + 30 * 60_000), rows, tides.tidesOnDay(day, t)));
  assert.ok(!dressing.sprayUp(new Date(top.ms + 3 * 3600_000), rows, tides.tidesOnDay(day, t)), 'not hours later');
  const plain = '2026-11-18';
  const topPlain = dressing.highestTide(plain, tides.tidesOnDay(plain, t))!;
  assert.ok(!dressing.sprayUp(new Date(topPlain.ms), cal.dressingOn(plain), tides.tidesOnDay(plain, t)), 'not on an ordinary day');
  // the spray's base points: on the published city's land, water within 4 u (the seawall behind the Ferry Building)
  const { sfDisk } = await import('./opus-bay-sf-disk');
  const { createCityTerrain, landmarkWalkInputs } = await import('../src/opus-bay/core/sfTerrain');
  const { canStand, isWater, setCityTerrain } = await import('../src/opus-bay/core/terrain');
  const { SF_SITES } = await import('../src/opus-bay/world/sf/landmarks/index');
  const sf = sfDisk();
  const lms = landmarkWalkInputs(SF_SITES);
  const city = createCityTerrain(sf.manifest, { landmarks: lms });
  city.setFar(await sf.far());
  await sf.attachAround(city, 132, -24, 40, lms);
  setCityTerrain(city, { heroDropLots: new Set(sf.manifest.heroDropLots) });
  try {
    for (const p of dressing.SPRAY_BASES) {
      assert.ok(canStand(p.x, p.z, 0.2), `${p.x},${p.z} on land`);
      let near = false;
      for (let k = 0; k < 16 && !near; k++) for (let d = 0.25; d <= 4 && !near; d += 0.25) near = isWater(p.x + Math.sin(k / 16 * Math.PI * 2) * d, p.z + Math.cos(k / 16 * Math.PI * 2) * d);
      assert.ok(near, `${p.x},${p.z}: water within 4 u`);
      assert.ok(Math.hypot(p.x - cal.EMBARCADERO_SEAWALL.x, p.z - cal.EMBARCADERO_SEAWALL.z) < 60, 'by the Ferry Building');
    }
  } finally { setCityTerrain(null); }
});

test('W5-R7 the calendar: sources checked on a date, Día de los Muertos hidden, later rows kept as data only, Halloween on Oct 31, notes and lines short', () => {
  const ids = new Set<string>();
  for (const r of cal.CALENDAR) {
    assert.ok(!ids.has(r.id), r.id); ids.add(r.id);
    assert.match(r.source.url, /^https:\/\//, r.id);
    assert.match(r.source.verifiedAt, /^2026-\d{2}-\d{2}$/, r.id);
    assert.ok(r.from <= r.to, r.id);
    assert.ok(zhLen(r.note.zh) <= 40, `${r.id}: ${r.note.zh}`);
    if (r.line) assert.ok(zhLen(r.line.zh) <= 45, `${r.id}: ${r.line.zh}`);
    if (r.grade !== 'official') assert.match(r.note.zh + (cal.GRADE_SAY[r.grade].zh), /以官网为准|通常/, `${r.id}: a date not from an organiser says so`);
  }
  const dia = cal.CALENDAR.find(r => r.id === 'dia-de-los-muertos-2026')!;
  assert.ok(dia.hidden, 'the 2026 date is not posted');
  assert.deepEqual(cal.calendarOn('2026-11-02').map(r => r.id), [], 'hidden: nothing on Nov 2');
  for (const r of cal.CALENDAR.filter(x => x.later)) assert.deepEqual(cal.calendarOn(r.from).map(x => x.id), [], `${r.id}: data only`);
  assert.deepEqual(cal.calendarOn('2026-10-31').map(r => r.id), ['halloween-2026']);
  assert.deepEqual(cal.calendarOn('2026-10-30').map(r => r.id), []);
  assert.deepEqual(cal.calendarOn('2026-11-01').map(r => r.id), [], 'the day after: nothing');
  assert.deepEqual(cal.calendarAhead('2026-10-25', 7).map(r => r.id), ['halloween-2026'], 'in 这周 a week ahead');
  assert.deepEqual(cal.calendarAhead('2026-11-20', 7).map(r => r.id), ['king-tides-2026-11']);
  assert.deepEqual(cal.dressingOn('2026-10-31').map(r => r.dress), ['pumpkins']);
  // the calendar never makes an event card: no row claims a catalog id it does not have
  for (const r of cal.CALENDAR) assert.equal(r.catalogId, undefined);
});

test('W5-R7 Halloween: the pumpkins stand on the published city (the Painted Ladies\' stoops, Waller St between Scott and Steiner), off the roadway, one geometry ≤ 1.6k triangles with glowing faces', async () => {
  const { paintedLadies, PAINTED_LADIES } = await import('../src/opus-bay/world/sf/landmarks/painted-ladies');
  const { rot } = await import('../src/opus-bay/world/sf/landmarks/kit');
  const spots = dressing.HALLOWEEN_SPOTS;
  // the stoops follow lane L's landmark (a moved landmark fails here: re-run scripts/opus-sf/realsf-place.mts)
  const stoops = spots.filter(s => s.y !== undefined);
  assert.equal(stoops.length, PAINTED_LADIES.length * 2);
  const zf = 3.4 / 2 - 0.4;
  PAINTED_LADIES.forEach((h, i) => {
    const hx = (3 - i) * 1.6;
    const r = rot({ x: hx - 0.38 - 0.13, z: zf + 0.42 }, paintedLadies.yaw);
    const s = stoops[i * 2];
    assert.ok(Math.hypot(s.x - (paintedLadies.x + r.x), s.z - (paintedLadies.z + r.z)) < 0.02, `stoop ${h.n}`);
    assert.ok(Math.abs(s.y! - (paintedLadies.base + h.y + 0.18)) < 0.02, `stoop ${h.n}: on the middle step`);
    assert.equal(s.f, +paintedLadies.yaw.toFixed(3));
  });
  const { sfDisk } = await import('./opus-bay-sf-disk');
  const { createCityTerrain, landmarkWalkInputs } = await import('../src/opus-bay/core/sfTerrain');
  const { canStand, heightAt, setCityTerrain, surfaceAt } = await import('../src/opus-bay/core/terrain');
  const { SF_SITES } = await import('../src/opus-bay/world/sf/landmarks/index');
  const sf = sfDisk();
  const lms = landmarkWalkInputs(SF_SITES);
  const city = createCityTerrain(sf.manifest, { landmarks: lms });
  city.setFar(await sf.far());
  await sf.attachAround(city, dressing.PUMPKINS_AT.x, dressing.PUMPKINS_AT.z, 90, lms);
  setCityTerrain(city, { heroDropLots: new Set(sf.manifest.heroDropLots) });
  try {
    for (const s of spots) {
      assert.ok(Math.hypot(s.x - dressing.PUMPKINS_AT.x, s.z - dressing.PUMPKINS_AT.z) < 80, 'near the build centre');
      if (s.y !== undefined) continue;
      assert.ok(canStand(s.x, s.z, 0.2), `${s.x},${s.z}: standable`);
      assert.notEqual(surfaceAt(s.x, s.z), 'road', `${s.x},${s.z}: off the roadway`);
      // next to a wall: 1 u further toward the house (−facing) is not standable
      const back = { x: s.x - Math.sin(s.f) * 1.0, z: s.z - Math.cos(s.f) * 1.0 };
      assert.ok(!canStand(back.x, back.z, 0.2), `${s.x},${s.z}: against a building`);
    }
    for (let i = 0; i < spots.length; i++) for (let j = i + 1; j < spots.length; j++) assert.ok(Math.hypot(spots[i].x - spots[j].x, spots[i].z - spots[j].z) > 0.3, 'apart');
    const geo = dressing.buildPumpkinGeometry(spots, heightAt);
    const tris = (geo.index?.count ?? 0) / 3;
    assert.ok(tris > 500 && tris <= dressing.PUMPKIN_TRIS_MAX, `${tris} triangles`);
    for (const a of ['position', 'normal', 'color', 'aInfo']) assert.ok(geo.getAttribute(a), a);
    const info = geo.getAttribute('aInfo');
    let glow = 0;
    for (let v = 0; v < info.count; v++) if (info.getW(v) > 0.5) glow++;
    assert.ok(glow > 0, 'the carved faces glow at night');
  } finally { setCityTerrain(null); }
  const halloween = cal.CALENDAR.find(r => r.id === 'halloween-2026')!;
  assert.equal(halloween.dress, 'pumpkins');
  assert.match(halloween.source.url, /localnewsmatters\.org/);
});

test('W5-R7 live.json: BAYLINK\'s own San Francisco offers (museums, parks, transit), each with its source and /offers/:id; the day rules by date', async () => {
  const buf = fs.readFileSync(path.join(V1, 'live.json'));
  assert.ok(zlib.gzipSync(buf).length < 6 * 1024, 'small');
  const offers = live.parseLive(LIVE_RAW)!;
  assert.equal(offers.length, 13, 'the 11 of wave 5 + the two MoAD days of the autumn release (W6-S)');
  const { currentFreebies } = await import('../src/data/october-offers');
  for (const o of offers) {
    const site = currentFreebies.find(x => x.id === o.id);
    assert.ok(site, `${o.id} is a BAYLINK offer`);
    assert.equal(o.title.zh, site!.title);
    assert.equal(o.requirement.zh, site!.requirement);
    assert.ok(o.title.en.trim() && o.requirement.en.trim(), `${o.id}: English title and conditions are present`);
    assert.doesNotMatch(o.title.en, /\p{Script=Han}/u, `${o.id}: the English title must not fall back to Chinese`);
    assert.doesNotMatch(o.requirement.en, /\p{Script=Han}/u, `${o.id}: the English conditions must not fall back to Chinese`);
    assert.equal(o.source.url, site!.sourceUrl);
    assert.equal(o.href, `/offers/${o.id}`);
    assert.ok(['museum', 'park', 'transit'].includes(o.kind), o.id);
    if (o.free) assert.notEqual(site!.kind, 'purchase', `${o.id}: a free row is never a purchase deal`);
    assert.match(o.source.verifiedAt, /^2026-09-\d{2}$/);
    if (o.rule) assert.match(o.rule.verifiedAt, /^2026-09-2[89]$/);
    if (o.place) assert.ok(Number.isFinite(o.place.x) && Number.isFinite(o.place.z));
  }
  const ids = (day: string) => live.offersOn(day, offers).map(t => t.offer.id).sort();
  // Sun Oct 4: the Asian Art Museum's first Sunday (dated), the Museo's first Sunday, the Cable Car Museum (open Sunday); the Randall closed
  assert.deepEqual(ids('2026-10-04'), ['asian-art-free-oct4', 'cable-car-museum-free', 'museo-italo-free-days']);
  // Mon Oct 5: the Tea Garden's free hour; the Cable Car Museum closed on Mondays
  assert.deepEqual(ids('2026-10-05'), ['japanese-tea-garden-free-hour']);
  // Tue Oct 6: the Conservatory's first Tuesday, the Cable Car Museum 10–16, the Randall
  assert.deepEqual(ids('2026-10-06'), ['cable-car-museum-free', 'conservatory-free-oct6', 'randall-museum-free']);
  // Thu Oct 8: the Museo's Thursday 12–16
  const thu = live.offersOn('2026-10-08', offers).find(t => t.offer.id === 'museo-italo-free-days')!;
  assert.deepEqual(thu.hours, [12 * 60, 16 * 60]);
  assert.deepEqual(live.offersOn('2026-10-04', offers).find(t => t.offer.id === 'cable-car-museum-free')!.hours, [600, 1020]);
  assert.deepEqual(live.offersOn('2026-10-06', offers).find(t => t.offer.id === 'cable-car-museum-free')!.hours, [600, 960]);
  assert.ok(ids('2026-10-25').includes('sfmoma-family-oct25'));
  // (W6-S) MoAD, reopened Sep 30: the first-Thursday night Oct 1 16–20, THRIVE on the second Saturday Oct 10 11–17
  assert.deepEqual(live.offersOn('2026-10-01', offers).find(t => t.offer.id === 'sf-moad-free-thursday-oct1-2026')?.hours, [960, 1200]);
  assert.deepEqual(live.offersOn('2026-10-10', offers).find(t => t.offer.id === 'sf-moad-thrive-second-saturday-oct2026')?.hours, [660, 1020]);
  assert.ok(!ids('2026-10-08').some(id => id.startsWith('sf-moad')), 'dated: only on their own days');
  assert.ok(!ids('2026-11-04').includes('asian-art-free-oct4'), 'a dated offer only on its date');
  assert.deepEqual(live.standingOffers(offers).map(o => o.id).sort(), ['exploratorium-for-all-five', 'muni-youth-free', 'sfmoma-museums-for-all']);
  assert.deepEqual(live.offersForPlace('sfmoma', '2026-10-25', offers).today.map(t => t.offer.id), ['sfmoma-family-oct25']);
  assert.deepEqual(live.offersForPlace('sfmoma', '2026-10-25', offers).standing.map(o => o.id), ['sfmoma-museums-for-all']);
  // the hand rows it belongs to exist
  const { rowsOn } = await import('../src/opus-bay/realsf/todayRows');
  for (const o of offers.filter(x => x.hand)) {
    const day = o.from ?? '2026-10-05';
    assert.ok(rowsOn(day, 19 * 60).some(r => r.id === o.hand), `${o.id} → ${o.hand} on ${day}`);
  }
  assert.equal(live.parseLive(null), null);
  assert.deepEqual(live.parseLive({ offers: [{ id: 'x', kind: 'shop' }] }), []);
});

test('W5-R7 现实中怎么去: the real lines\' hours and headways (sfmta.com), the nearest real stops with walking minutes, never the game\'s own loop', () => {
  const file = JSON.parse(fs.readFileSync(path.join(V1, 'transit.json'), 'utf8')) as { lines: { id: string; stops: { id: string; name: { zh: string; en: string }; x: number; z: number }[] }[] };
  const stops = real.realStopsOf(file.lines);
  assert.deepEqual([...new Set(stops.map(s => s.line))].sort(), ['california', 'f-line', 'm-ocean-view', 'n-judah', 'powell-hyde', 'powell-mason']);
  assert.ok(!stops.some(s => s.line === 'sf-loop'), 'the sightseeing loop is the game\'s own');
  for (const l of Object.values(real.REAL_LINES)) {
    assert.match(l.sourceUrl, /^https:\/\/www\.sfmta\.com\/routes\//);
    assert.equal(l.verifiedAt, '2026-09-28');
  }
  assert.equal(real.REAL_LINES['n-judah'].hours, null, 'N Judah: 24 hours');
  assert.deepEqual(real.REAL_LINES['powell-hyde'].hours, [7 * 60, 23 * 60]);
  assert.deepEqual(real.REAL_LINES.california.hours, [7 * 60, 21 * 60]);
  // Hardly Strictly (Hellman Hollow): the N Judah on Judah / 9th-ish, a walk
  const hsb = real.nearestRealStops({ x: -378.2, z: 1118.8 }, stops);
  assert.equal(hsb[0]?.line.id, 'n-judah');
  assert.ok(hsb[0].walkMin >= 5 && hsb[0].walkMin <= 20, `${hsb[0].walkMin} min`);
  // the Castro fair: the F line's terminal and the M at Castro
  const castro = real.nearestRealStops({ x: 143.3, z: 739.1 }, stops).map(n => n.line.id).sort();
  assert.deepEqual(castro, ['f-line', 'm-ocean-view']);
  // the Ferry Building: the F line and the California cable car
  assert.ok(real.nearestRealStops({ x: 131.5, z: 15.1 }, stops).some(n => n.line.id === 'f-line'));
  // far from every line: nothing
  assert.deepEqual(real.nearestRealStops({ x: -564.8, z: 1363.7 }, stops, 2, 0.3), []);
  // the service line
  assert.match(real.serviceLabel(real.REAL_LINES['n-judah'], '2026-10-05', 10 * 60).zh, /全天 24 小时 · 白天约 10 分钟一班/);
  assert.match(real.serviceLabel(real.REAL_LINES['n-judah'], '2026-10-04', 10 * 60).zh, /约 12 分钟/, 'weekend');
  assert.match(real.serviceLabel(real.REAL_LINES['m-ocean-view'], '2026-10-05', 3 * 60).zh, /现在停运 · 运营 6:00–24:00/);
  assert.match(real.serviceLabel(real.REAL_LINES['powell-hyde'], '2026-10-05', 23 * 60).zh, /现在停运/);
  assert.equal(real.CHECK_511.zh, '出发前查 SFMTA / 511 确认');
});

test('W5-R7 the moon: BAYBAY\'s 今晚差不多满月 only near Twin Peaks or Ocean Beach, in the golden or night sky, around the full moon (Oct 25–26)', async () => {
  const { fullMoonNear, FULL_MOON_LINE, MOON_SPOTS } = await import('../src/opus-bay/realsf/index');
  const peaks = MOON_SPOTS[0], beach = MOON_SPOTS[1];
  assert.ok(fullMoonNear(bay('2026-10-25T20:00'), peaks), 'the evening of Oct 25 on Twin Peaks');
  assert.ok(fullMoonNear(bay('2026-10-25T20:00'), beach));
  assert.ok(!fullMoonNear(bay('2026-10-25T13:00'), peaks), 'not by day');
  assert.ok(!fullMoonNear(bay('2026-10-25T20:00'), { x: 131.5, z: 15.1 }), 'not at the Ferry Building');
  assert.ok(!fullMoonNear(bay('2026-10-10T20:00'), peaks), 'not at the new moon');
  assert.ok(zhLen(FULL_MOON_LINE.zh) <= 45);
});

test('W5-R7 the 今天 tab: the tides row, today\'s offers with /offers/:id and their conditions, the calendar, 我的周末 → BAYLINK /plan and /my-week, the walks', async () => {
  const { createElement: h } = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { registerHooks } = await import('node:module');
  const styles = registerHooks({ load(url, context, next) { return url.endsWith('.css') ? { format: 'module', shortCircuit: true, source: 'export {}' } : next(url, context); } });
  const { default: TodayTab } = await import('../src/opus-bay/realsf/TodayTab');
  styles.deregister();
  const { sanitizeCatalog, setCatalogForTests } = await import('../src/opus-bay/data/catalog');
  const { game } = await import('../src/opus-bay/core/store');
  const catalog = sanitizeCatalog(JSON.parse(fs.readFileSync(path.resolve('public/planner-catalog.json'), 'utf8')));
  setCatalogForTests(catalog);
  tides.setTidesForTests(tides.parseTides(TIDES_RAW));
  live.setLiveForTests(live.parseLive(LIVE_RAW));
  const wish = game.get().wishlist;
  game.set({ wishlist: [{ kind: 'event', id: 'hardly-strictly-bluegrass-2026', title: 'HSB', addedAt: '2026-09-28' }] });
  __setBayNowForTests('2026-10-01T10:30');
  try {
    const html = renderToStaticMarkup(h(TodayTab));
    // the tides (a daylight low still ahead at 10:30 on Oct 1? the row says one or the other, with the safety line)
    assert.match(html, /潮汐 · (低|高) \d{1,2}:\d{2}/);
    assert.match(html, /天涯海角下能看到老沉船的发动机|涨潮时海浪风琴唱得最响|今天的潮水都过了/);
    assert.match(html, /海水冰冷、水流危险：别下水，别爬礁石/);
    assert.match(html, /tidesandcurrents\.noaa\.gov/);
    // Thu Oct 1: the Cable Car Museum (10–16) and the Randall (10–17) are free; the Museo's Thursday from 12
    assert.match(html, /缆车博物馆 · 免费/);
    assert.match(html, /兰德尔博物馆 · 免费/);
    assert.match(html, /意大利裔美国人博物馆 · 免费/);
    assert.match(html, /12:00 起/);
    assert.match(html, /href="\/offers\/cable-car-museum-free"/);
    assert.match(html, /cablecarmuseum\.org/);
    assert.match(html, /长期福利（需符合条件）/);
    assert.match(html, /href="\/offers\/muni-youth-free"/);
    // 我的周末: the coming Sat–Sun (Oct 3–4), the wished HSB on both days, the plan link and /my-week
    assert.match(html, /我的周末/);
    assert.match(html, /Hardly Strictly/);
    assert.match(html, /href="\/plan\?date=2026-10-03&amp;stops=event%3Ahardly-strictly-bluegrass-2026#outing-plan"/);
    assert.match(html, /href="\/my-week"/);
    // 走走看: October's Sunset Dunes walk and the two new guides, each by its place
    assert.match(html, /走走看 · BAYLINK 攻略/);
    assert.match(html, /href="\/guides\/sf-sunset-dunes-october-coastal-walk-2026"/);
    assert.match(html, /href="\/guides\/sf-lands-end-sutro-baths-walk-guide"/);
    assert.match(html, /href="\/guides\/sf-mission-dolores-murals-walk-guide"/);
    // Halloween: a week ahead in 这周, on the day in 今天
    __setBayNowForTests('2026-10-25T10:00');
    assert.match(renderToStaticMarkup(h(TodayTab)), /万圣节 · 维多利亚老房子的台阶/);
    __setBayNowForTests('2026-10-31T10:00');
    const hw = renderToStaticMarkup(h(TodayTab));
    assert.match(hw, /万圣节 · 维多利亚老房子的台阶/);
    assert.match(hw, /localnewsmatters\.org/);
    assert.match(hw, /通常如此/);
    // November: the October walk is gone
    __setBayNowForTests('2026-11-03T10:00');
    assert.doesNotMatch(renderToStaticMarkup(h(TodayTab)), /sf-sunset-dunes-october-coastal-walk-2026/);
  } finally {
    __setBayNowForTests(null); setCatalogForTests(null); tides.setTidesForTests(null); live.setLiveForTests(null); game.set({ wishlist: wish });
  }
});

test('W5-R7 the baked files are same-site: realsf/sameSite.ts fetches only /opus-bay/sf/ paths; the export scripts are the only callers of NOAA', () => {
  const src = fs.readFileSync(path.resolve('src/opus-bay/realsf/sameSite.ts'), 'utf8');
  const calls = [...src.matchAll(/\bget\(\s*([^)]+)\)/g)].map(m => m[1].trim());
  assert.ok(calls.length >= 2);
  for (const c of calls) assert.match(c, /^['`]\/opus-bay\/sf\//, c);
  for (const f of fs.readdirSync(path.resolve('src/opus-bay/realsf'))) {
    const s = fs.readFileSync(path.resolve('src/opus-bay/realsf', f), 'utf8');
    assert.doesNotMatch(s, /api\.tidesandcurrents|datagetter/, `${f}: never NOAA's API at runtime`);
  }
  assert.match(fs.readFileSync(path.resolve('scripts/opus-sf/export-tides.ts'), 'utf8'), /application:/);
});

test('W5-R7 the Lands End wrecks: in the surf off Mile Rock Beach, shown only at a low tide of +1 ft or less (lower tide, more shows), ≤ 800 triangles', async () => {
  assert.match(fs.readFileSync(path.resolve('src/opus-bay/world/sf/water.ts'), 'utf8'), new RegExp(`const WATER_Y = ${dressing.SEA_SURFACE_Y};`), 'the sea surface');
  assert.equal(dressing.wreckExposure(null), 0);
  assert.equal(dressing.wreckExposure(1.2), 0);
  assert.ok(dressing.wreckExposure(1.0) > 0);
  assert.ok(dressing.wreckExposure(-1.5) > dressing.wreckExposure(0.5));
  assert.equal(dressing.wreckExposure(-3), 1);
  const geo = dressing.buildWreckGeometry();
  const tris = (geo.index?.count ?? 0) / 3;
  assert.ok(tris > 50 && tris <= dressing.WRECK_TRIS_MAX, `${tris} triangles`);
  assert.ok(zhLen(dressing.WRECKS_LINE.zh) <= 45);
  const { sfDisk } = await import('./opus-bay-sf-disk');
  const { createCityTerrain, landmarkWalkInputs } = await import('../src/opus-bay/core/sfTerrain');
  const { canStand, isWater, setCityTerrain } = await import('../src/opus-bay/core/terrain');
  const { SF_SITES } = await import('../src/opus-bay/world/sf/landmarks/index');
  const { projectCity } = await import('../src/opus-bay/core/geo');
  const sf = sfDisk();
  const lms = landmarkWalkInputs(SF_SITES);
  const city = createCityTerrain(sf.manifest, { landmarks: lms });
  city.setFar(await sf.far());
  await sf.attachAround(city, -750, 1100, 60, lms);
  setCityTerrain(city, { heroDropLots: new Set(sf.manifest.heroDropLots) });
  try {
    const beach = projectCity(37.7873971, -122.5062227);
    for (const w of dressing.WRECKS) {
      assert.ok(isWater(w.x, w.z), `${w.id}: in the water`);
      assert.ok(Math.hypot(w.x - beach.x, w.z - beach.z) < 20, `${w.id}: off Mile Rock Beach`);
      let shore = false;
      for (let k = 0; k < 16 && !shore; k++) for (let r = 1; r <= 12 && !shore; r++) shore = canStand(w.x + Math.sin(k / 16 * Math.PI * 2) * r, w.z + Math.cos(k / 16 * Math.PI * 2) * r, 0.3);
      assert.ok(shore, `${w.id}: land within 12 u (seen from the shore)`);
    }
  } finally { setCityTerrain(null); }
  // a real low tide shows them: 2026-11-25 17:52 PST −1.65 ft
  const t = tides.parseTides(TIDES_RAW)!;
  assert.ok(dressing.wreckExposure(tides.tideAt(bay('2026-11-25T17:50').getTime(), t)) > 0.9);
  assert.equal(dressing.wreckExposure(tides.tideAt(bay('2026-11-25T10:49').getTime(), t)), 0, 'the king tide hides them');
});
