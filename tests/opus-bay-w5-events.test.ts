import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import type { Catalog, CatalogEvent } from '../src/opus-bay/core/types';

// Wave 5 · lane R (W5-R2 / R3): the venue table (realsf/eventVenues.ts), events in their real window
// (realsf/events.ts), the catalog's venue hooks ("附近这周" by mapped venue, 带我去, the playable city first), and the
// rule that no runtime fetch leaves the site.

// --- headless canvas stub (world modules create label atlases at import time; same as the content test) ---
const g = globalThis as unknown as Record<string, unknown>;
const noop = () => undefined;
const ctx2d = new Proxy({}, {
  get: (_t, k) => (k === 'measureText' ? () => ({ width: 10 }) : k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop: noop }) : k === 'getImageData' ? (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }) : noop),
  set: () => true,
});
g.window ??= globalThis;
g.document ??= { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => ctx2d }) };

const { parseBayDate, __setBayNowForTests } = await import('../src/opus-bay/game/bayNow');
const catalogMod = await import('../src/opus-bay/data/catalog');
const { eventsNear, recommendEvents, sanitizeCatalog, setCatalogForTests, setEventVenueHooks, eventSpot, todayInBay } = catalogMod;
const { EVENT_VENUES, eventVenue, venueForEvent, venueLatLng } = await import('../src/opus-bay/realsf/eventVenues');
const { activeEventsAt, eventHours, labelHours, weekEvents, worldEvent } = await import('../src/opus-bay/realsf/events');
const { projectCity } = await import('../src/opus-bay/core/geo');

const bay = (spec: string) => { const d = parseBayDate(spec); assert.ok(d, spec); return d!; };
const dist = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);

/** The San Francisco rows of the 2026-09-27 catalog these tests need (copied from public/planner-catalog.json). */
const ev = (id: string, startDate: string, endDate: string, dateLabel: string, venue: string, extra: Partial<CatalogEvent> = {}): CatalogEvent =>
  ({ id, title: id, startDate, endDate, dateLabel, region: 'sf', city: 'San Francisco', venue, category: 'culture', cost: 'free', ...extra });
const FIXTURE: Catalog = {
  checkedAt: '2026-09-27',
  places: [], guides: [],
  events: [
    ev('portola-2026', '2026-09-26', '2026-09-27', '9 月 26–27 日 · 周末', 'Pier 80 · San Francisco', { title: '21+ · Portola：把月底留给现场音乐', cost: 'paid' }),
    ev('ai-conference-sf-2026', '2026-09-29', '2026-10-01', '9 月 29 日–10 月 1 日', 'Pier 48 · Shed A & B', { title: 'The AI Conference：从研究到实际产品', location: { lat: 37.7758086, lng: -122.3853487 } }),
    ev('hardly-strictly-bluegrass-2026', '2026-10-02', '2026-10-04', '10 月 2–4 日 · 连续三天', 'Hellman Hollow, Lindley & Marx Meadows · Golden Gate Park'),
    ev('sf-african-arts-festival-2026', '2026-10-03', '2026-10-03', '10 月 3 日 · 11:00–16:00', 'Great Lawn · Yerba Buena Gardens'),
    ev('litquake-out-loud-2026', '2026-10-04', '2026-10-04', '10 月 4 日 · 11:00–16:00', 'Yerba Buena Gardens · Esplanade stage · 750 Howard Street'),
    ev('san-francisco-fleet-week-2026', '2026-10-04', '2026-10-12', '10 月 4–12 日 · 各项目日期不同', "San Francisco waterfront · Fisherman's Wharf / Pier 27 and other venues", { category: 'outdoors', cost: 'mixed' }),
    ev('sf-castro-street-fair-2026', '2026-10-04', '2026-10-04', '10 月 4 日 · 11:00–18:00', 'Castro & Market Streets'),
    ev('sf-italian-heritage-parade-2026', '2026-10-11', '2026-10-11', '10 月 11 日 · 12:30 开始', 'Jefferson & Powell Streets → Columbus Avenue → Washington Square'),
    ev('sf-apature-literary-2026', '2026-10-21', '2026-10-21', '10 月 21 日 · 18:00–21:00', 'Arc Gallery & Studios · 1246 Folsom Street', { cost: 'paid' }),
    ev('sf-halloween-hoopla-2026', '2026-10-31', '2026-10-31', '10 月 31 日 · 12:00–15:00', "Children's Garden, Yerba Buena Gardens · 799 Howard Street", { category: 'family' }),
    ev('oakland-thing-2026', '2026-10-03', '2026-10-03', '10 月 3 日 · 10:00–14:00', 'Lake Merritt', { region: 'east-bay', city: 'Oakland' }),
  ],
};

const hooks = () => setEventVenueHooks({
  locate: e => { const v = worldEvent(e); return v ? { x: v.x, z: v.z, ...venueLatLng(v), name: v.name } : null; },
  go: () => {},
});

test('W5-R2 venues: the table — unique ids, real OSM sources checked on a date, points inside the city, each catalog id at one venue, hours only with their organiser source', () => {
  const ids = new Set<string>();
  const events = new Set<string>();
  for (const v of EVENT_VENUES) {
    assert.ok(!ids.has(v.id), v.id); ids.add(v.id);
    assert.match(v.sourceUrl, /^https:\/\/www\.openstreetmap\.org\/(way|node|relation)\/\d+$/, v.id);
    assert.match(v.verifiedAt, /^2026-\d{2}-\d{2}$/, v.id);
    assert.ok(v.name.zh && v.name.en, v.id);
    assert.ok(v.x > -1100 && v.x < 1100 && v.z > -600 && v.z < 1700, `${v.id} inside the city`);
    for (const e of v.events) { assert.ok(!events.has(e), `${e} listed once`); events.add(e); }
    if (v.hours) {
      assert.match(v.hoursSource ?? '', /^https:\/\//, `${v.id}: hours carry their source`);
      for (const days of Object.values(v.hours)) for (const [day, [a, b]] of Object.entries(days)) { assert.match(day, /^\d{4}-\d{2}-\d{2}$/); assert.ok(a < b && b <= 24 * 60); }
    }
    // the point is the real place: back to lat / lng and forward again lands on it
    const ll = venueLatLng(v);
    assert.ok(dist(projectCity(ll.lat, ll.lng), v) < 0.5, v.id);
  }
});

test('W5-R2 venues: mapping — listed ids, venue text for SF events, no pin for unmapped venues, other regions, adult-only or professional events', () => {
  setCatalogForTests(FIXTURE);
  try {
    assert.equal(eventVenue('hardly-strictly-bluegrass-2026')?.id, 'hellman-hollow');
    assert.equal(eventVenue('sf-african-arts-festival-2026')?.id, 'yerba-buena-gardens');
    assert.equal(eventVenue('sf-castro-street-fair-2026')?.id, 'castro-market');
    assert.equal(eventVenue('sf-apature-literary-2026'), null, 'Arc Gallery is not in the table: no pin, never a guess');
    // a new SF event at a known venue maps by its venue text; the same text in another region does not
    assert.equal(venueForEvent({ id: 'new-ybg-thing', region: 'sf', venue: 'Esplanade · Yerba Buena Gardens' })?.id, 'yerba-buena-gardens');
    assert.equal(venueForEvent({ id: 'x', region: 'east-bay', venue: 'Yerba Buena Gardens' }), null);
    const byId = (id: string) => FIXTURE.events.find(e => e.id === id)!;
    assert.equal(worldEvent(byId('portola-2026')), null, '21+ never in the world');
    assert.equal(worldEvent(byId('ai-conference-sf-2026')), null, 'professional / tech never in the world');
    assert.equal(worldEvent(byId('oakland-thing-2026')), null, 'East Bay: not in the city');
  } finally { setCatalogForTests(null); }
});

test('W5-R3 windows: hours from the organiser table, the label, or 08:00–21:00; HSB Fri 11–19 / Sat–Sun 9–19; the Castro fair 11–18; Fleet Week only on air-show days', () => {
  assert.deepEqual(labelHours('10 月 3 日 · 11:00–16:00'), [660, 960]);
  assert.deepEqual(labelHours('10 月 11 日 · 12:30 开始'), [750, 990]);
  assert.deepEqual(labelHours('10 月 1 日 · 08:30–18:30 PDT'), [510, 1110]);
  assert.equal(labelHours('10 月 2–4 日 · 连续三天'), null);
  const on = (spec: string) => activeEventsAt(bay(spec), FIXTURE).map(w => w.event.id);
  assert.deepEqual(on('2026-10-02T10:30'), [], 'HSB gates open at 11 on Friday');
  assert.deepEqual(on('2026-10-02T11:00'), ['hardly-strictly-bluegrass-2026']);
  assert.deepEqual(on('2026-10-03T10:30'), ['hardly-strictly-bluegrass-2026'], 'Saturday from 9; the African Arts Festival from 11');
  assert.deepEqual(on('2026-10-03T12:00').sort(), ['hardly-strictly-bluegrass-2026', 'sf-african-arts-festival-2026']);
  assert.deepEqual(on('2026-10-04T13:00').sort(), ['hardly-strictly-bluegrass-2026', 'litquake-out-loud-2026', 'sf-castro-street-fair-2026']);
  assert.deepEqual(on('2026-10-04T18:30'), ['hardly-strictly-bluegrass-2026'], 'the fair ends at 18:00, the music at 19:00');
  assert.deepEqual(on('2026-10-04T19:00'), []);
  assert.deepEqual(on('2026-10-05T13:00'), [], 'Fleet Week runs Oct 4–12 in the catalog, but only its air-show days show in the world');
  assert.deepEqual(on('2026-10-09T12:40'), ['san-francisco-fleet-week-2026']);
  assert.deepEqual(on('2026-10-11T12:40').sort(), ['san-francisco-fleet-week-2026', 'sf-italian-heritage-parade-2026']);
  assert.deepEqual(on('2026-10-21T19:00'), [], 'unmapped: never in the world');
  const hsb = FIXTURE.events.find(e => e.id === 'hardly-strictly-bluegrass-2026')!;
  assert.equal(eventHours(hsb, EVENT_VENUES.find(v => v.id === 'hellman-hollow')!, '2026-10-05'), null);
});

test('W5-R2 week: ?date=2026-10-03T10:30 — this week lists the African Arts Festival at YBG ("附近这周" by mapped venue), HSB is on; 2026-11-05 shows nothing expired', () => {
  setCatalogForTests(FIXTURE);
  const off = hooks();
  try {
    __setBayNowForTests('2026-10-03T10:30');
    const week = weekEvents(undefined, 7, FIXTURE).map(w => w.event.id);
    assert.ok(week.includes('sf-african-arts-festival-2026') && week.includes('hardly-strictly-bluegrass-2026') && week.includes('sf-castro-street-fair-2026'));
    assert.ok(!week.includes('portola-2026') && !week.includes('ai-conference-sf-2026') && !week.includes('oakland-thing-2026'));
    assert.deepEqual(activeEventsAt(undefined, FIXTURE).map(w => w.event.id), ['hardly-strictly-bluegrass-2026']);
    const ybg = EVENT_VENUES.find(v => v.id === 'yerba-buena-gardens')!;
    const near = eventsNear(FIXTURE, venueLatLng(ybg), todayInBay(), 1.0, 7).map(n => n.event.id);
    assert.ok(near.includes('sf-african-arts-festival-2026') && near.includes('litquake-out-loud-2026'), `YBG card: ${near.join(', ')}`);
    assert.ok(!near.includes('hardly-strictly-bluegrass-2026'), 'Golden Gate Park is not within 1 km of YBG');
    __setBayNowForTests('2026-11-05T10:30');
    assert.deepEqual(weekEvents(undefined, 7, FIXTURE), []);
    assert.deepEqual(activeEventsAt(undefined, FIXTURE), []);
    assert.deepEqual(eventsNear(FIXTURE, venueLatLng(ybg), todayInBay(), 1.0, 7), [], 'nothing expired shows');
  } finally { __setBayNowForTests(null); off(); setCatalogForTests(null); }
  // without the hooks (district mode) the mapped venues are unknown: nothing near YBG (no event carries a location)
  const ybg = EVENT_VENUES.find(v => v.id === 'yerba-buena-gardens')!;
  assert.deepEqual(eventsNear(FIXTURE, venueLatLng(ybg), '2026-10-03', 1.0, 7), []);
  assert.equal(eventSpot(FIXTURE.events[2]), null);
});

test('W5-R2 board: city mode ranks the playable city first (no region asked); a player who asks for the East Bay still gets it', () => {
  const off = hooks();
  try {
    const any = recommendEvents(FIXTURE, { companions: 'friends', vibe: 'any', region: 'any' }, '2026-10-03', { cityFirst: true, max: 5 });
    assert.ok(any.events.length >= 3);
    assert.ok(any.events.slice(0, 3).every(item => item.event.region === 'sf'), any.events.map(i => i.event.id).join(', '));
    const flat = recommendEvents(FIXTURE, { companions: 'friends', vibe: 'any', region: 'any' }, '2026-10-03', { cityFirst: false, max: 5 });
    assert.ok(flat.events.length === any.events.length);
    const east = recommendEvents(FIXTURE, { companions: 'friends', vibe: 'any', region: 'east-bay' }, '2026-10-03', { cityFirst: true, max: 5 });
    assert.equal(east.events[0]?.event.region, 'east-bay');
  } finally { off(); }
});

test('W5-R2 venues: every point and kit spot stands in the published city and joins the walking network of ferry-gate', async () => {
  const { sfDisk } = await import('./opus-bay-sf-disk');
  const { createCityTerrain, landmarkWalkInputs } = await import('../src/opus-bay/core/sfTerrain');
  const { canStand, setCityTerrain } = await import('../src/opus-bay/core/terrain');
  const { SF_SITES } = await import('../src/opus-bay/world/sf/landmarks/index');
  const { DISTRICT } = await import('../src/opus-bay/data/district');
  const sf = sfDisk();
  const lms = landmarkWalkInputs(SF_SITES);
  const city = createCityTerrain(sf.manifest, { landmarks: lms });
  city.setFar(await sf.far());
  const spots = EVENT_VENUES.flatMap(v => [{ id: v.id, x: v.x, z: v.z }, ...(v.kitAt ? [{ id: `${v.id} kit`, x: v.kitAt.x, z: v.kitAt.z }] : [])]);
  for (const s of spots) await sf.attachAround(city, s.x, s.z, 24, lms);
  setCityTerrain(city, { heroDropLots: new Set(sf.manifest.heroDropLots) });
  try {
    const ix = await sf.graphIndex();
    const ferry = DISTRICT.anchors['ferry-gate'];
    const home = ix.component(ix.nearestNode(ferry.x, ferry.z, 60));
    for (const s of spots) {
      assert.ok(canStand(s.x, s.z), `${s.id}: standable`);
      const n = ix.nearestNode(s.x, s.z, 16);
      assert.ok(n >= 0, `${s.id}: a walking-graph node within 16 u`);
      assert.equal(ix.component(n), home, `${s.id}: reachable from ferry-gate`);
    }
  } finally { setCityTerrain(null); }
});

test('W5-R: no runtime fetch in lane R leaves the site (same-site paths and the catalog only)', () => {
  const root = path.resolve('src/opus-bay/realsf');
  const files = fs.readdirSync(root).filter(f => /\.(ts|tsx)$/.test(f));
  assert.ok(files.length >= 5);
  for (const f of files) {
    const src = fs.readFileSync(path.join(root, f), 'utf8');
    for (const m of src.matchAll(/\bfetch\s*\(\s*([^,)]+)/g)) assert.match(m[1].trim(), /^['"`]\//, `${f}: fetch(${m[1]}) must be a same-site path`);
    assert.doesNotMatch(src, /new\s+(WebSocket|EventSource)\s*\(/, f);
    assert.doesNotMatch(src, /https?:\/\/[^'"`\s]*['"`]\s*\)\s*;?\s*$/m, `${f}: no request to an absolute URL`);
  }
  // the catalog itself is same-site
  assert.match(fs.readFileSync(path.resolve('src/opus-bay/data/catalog.ts'), 'utf8'), /fetcher\('\/planner-catalog\.json'/);
  assert.ok(sanitizeCatalog({}).events.length === 0);
});
