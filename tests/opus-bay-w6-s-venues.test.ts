import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import type { CatalogEvent } from '../src/opus-bay/core/types';

/**
 * Wave 6 · lane S (W6-S1): GPT's autumn catalog (public/planner-catalog.json, originally 267 events at W6-0c;
 * 293 after the Sep 29 website refresh) in the world.
 * Every San Francisco event of 29 Sep – 30 Nov is either at a venue of realsf/eventVenues.ts (an OpenStreetMap point on
 * the walking network: tests/opus-bay-w5-events.test.ts walks every row) or kept out for a stated reason (18+ /
 * professional, no single verified point, or an explicitly pending world import). The autumn labels' hours per date (realsf/events.ts labelHoursOn), and the
 * Ferry Plaza market (now a catalog event) is one row / one task in the 今天 tab, not two.
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
const { isAdultOnly, isProfessional, sanitizeCatalog, setCatalogForTests } = await import('../src/opus-bay/data/catalog');
const { EVENT_VENUES, EVENT_SAY, SOUVENIR_IDS } = await import('../src/opus-bay/realsf/eventVenues');
const { activeEventsAt, eventHours, handRowOf, labelHours, labelHoursOn, worldEvent } = await import('../src/opus-bay/realsf/events');
const { daySignals, dailyThree } = await import('../src/opus-bay/realsf/daily');

const CATALOG = sanitizeCatalog(JSON.parse(fs.readFileSync(path.resolve('public/planner-catalog.json'), 'utf8')));
const bay = (spec: string) => { const d = parseBayDate(spec); assert.ok(d, spec); return d!; };
const H = (h: number, m = 0) => h * 60 + m;
const byId = (id: string) => { const e = CATALOG.events.find(x => x.id === id); assert.ok(e, id); return e!; };
const sfWindow = (e: CatalogEvent) => e.region === 'sf' && (e.endDate ?? e.startDate) >= '2026-09-29' && e.startDate <= '2026-11-30';

/** SF events of the window kept out of the world although they are for everyone (the reason is in the report). */
const NOT_PLACED: Readonly<Record<string, string>> = {
  // a street party along 2nd St between Market and Howard, 17:00–22:00, billed to adults; no single point to pin
  'sf-downtown-first-thursday-oct-2026': 'street segment, adults',
  // These two Sep 29 website additions still need a world venue import and walking-network point acceptance.
  'sf-bay-beats-bandshell-oct24-2026': 'website/calendar/planner only; Golden Gate Bandshell event import and navigation-point acceptance pending',
  'sf-marina-library-open-house-oct17-2026': 'website/calendar/planner only; Marina Branch open-house import and navigation-point acceptance pending',
  // W7-0h: five more Sep 29 website additions (GPT's b4f71de8) wait for wave 7 lane S's venue rows (OSM point on the
  // walking network, or a stated reason); the sixth, sf-foodwise-latine-makers-oct3-2026, matches the Ferry Building.
  'sf-nexus-party-oct1-2026': 'wave 7 lane S: Yerba Buena Center for the Arts venue row pending',
  'sf-inner-sunset-flea-oct11-2026': 'wave 7 lane S: Irving St 9th–11th Ave street segment pending',
  'sf-fall-show-oct15-18-2026': 'wave 7 lane S: Fort Mason Festival Pavilion venue row pending',
  'sf-potrero-hill-festival-oct17-2026': 'wave 7 lane S: 20th St Wisconsin–Missouri street segment pending',
  'sf-sunday-streets-excelsior-oct18-2026': 'wave 7 lane S: Mission St Avalon–Geneva street segment pending',
};

test('W6-S1 labels: the autumn catalog’s hours per date — named dates, weekdays, 其余, doors, several ranges joined; the old labels unchanged', () => {
  // the market: Tue / Thu 10–14, Sat 8–14
  const market = '9/26–10/31 · 周二、四10:00–14:00；周六08:00–14:00';
  assert.deepEqual(labelHoursOn(market, '2026-10-03'), [H(8), H(14)], 'Saturday');
  assert.deepEqual(labelHoursOn(market, '2026-10-06'), [H(10), H(14)], 'Tuesday');
  assert.deepEqual(labelHoursOn(market, '2026-10-08'), [H(10), H(14)], 'Thursday');
  // the opera: 9/29, 10/2 at 19:30, the 10/4 matinee at 14:00; a start runs 4 h, never past 21:00
  const mary = '9/29–10/4 · 9/29、10/2 19:30；10/4 14:00；节目页时长约 2 小时 51 分钟';
  assert.deepEqual(labelHoursOn(mary, '2026-10-04'), [H(14), H(18)]);
  assert.deepEqual(labelHoursOn(mary, '2026-10-02'), [H(19, 30), H(21)]);
  const manon = '10/15–10/30 · 10/18 14:00；其余所列日期 19:30；约 3 小时 25 分钟';
  assert.deepEqual(labelHoursOn(manon, '2026-10-18'), [H(14), H(18)]);
  assert.deepEqual(labelHoursOn(manon, '2026-10-21'), [H(19, 30), H(21)], '其余 = the other dates');
  // doors open before the start
  assert.deepEqual(labelHoursOn('10/23 · 19:00；17:30 开门', '2026-10-23'), [H(17, 30), H(21)]);
  assert.deepEqual(labelHoursOn('10/3 · 19:00 开始；18:00 开门', '2026-10-03'), [H(18), H(21)]);
  assert.deepEqual(labelHoursOn('10/6 · 19:00', '2026-10-06'), [H(19), H(21)], 'a plain time is the start');
  assert.deepEqual(labelHoursOn('10/11 · 场馆日历 19:00；另有售票平台显示 20:00，出发前须再次核对', '2026-10-11'), [H(19), H(21)]);
  assert.deepEqual(labelHoursOn('10/25 · 10:00 开始；结束时间未核实', '2026-10-25'), [H(10), H(14)]);
  // several programmes on one day: the earliest start to the latest end
  assert.deepEqual(labelHoursOn('10/24 · 蝴蝶手作11:00–14:00；乐团11:00–16:00；末节乐器体验16:00–16:30', '2026-10-24'), [H(11), H(16, 30)]);
  assert.deepEqual(labelHoursOn('10/17–10/18 · 10/17 10:00–17:30；10/18 12:00–17:30', '2026-10-18'), [H(12), H(17, 30)]);
  assert.deepEqual(labelHoursOn('10/21 · 18:00–21:00；18:00开门，18:30朗读', '2026-10-21'), [H(18), H(21)]);
  assert.equal(labelHoursOn('10/1 · 21:30', '2026-10-01'), null, 'starting at 21:00 or later: not in the world');
  // the wave-5 labels read as before
  for (const [label, day] of [['10 月 3 日 · 11:00–16:00', '2026-10-03'], ['10 月 11 日 · 12:30 开始', '2026-10-11'], ['10 月 1 日 · 08:30–18:30 PDT', '2026-10-01'], ['10 月 2–4 日 · 连续三天', '2026-10-03']] as const) {
    assert.deepEqual(labelHoursOn(label, day), labelHours(label), label);
  }
});

test('W6-S1 venues: every San Francisco event of 29 Sep – 30 Nov is in the world, 18+ / professional, or not placed for a stated reason (38 + 3 existing-venue matches + 1 Ferry Building match shown)', () => {
  setCatalogForTests(CATALOG);
  try {
    const sf = CATALOG.events.filter(sfWindow);
    assert.equal(sf.length, 68, 'the autumn catalog including the eleven Sep 29 website additions');
    const shown = sf.filter(e => worldEvent(e));
    const out = sf.filter(e => !worldEvent(e));
    for (const e of out) assert.ok(isAdultOnly(e) || isProfessional(e) || NOT_PLACED[e.id], `${e.id} (${e.venue}) is for everyone and has no venue row`);
    assert.equal(shown.length, 42, shown.map(e => e.id).join(' '));
    assert.equal(worldEvent(byId('sf-foodwise-latine-makers-oct3-2026'))?.id, 'ferry-building', 'the Foodwise makers market stands at the Ferry Building');
    // The existing Main Library matcher admits three additions. The other two retain specific pending-import reasons.
    // None may disappear behind an accidental audience/title classification.
    for (const [id, venue] of [
      ['sf-bay-beats-bandshell-oct24-2026', null],
      ['sf-financial-planning-day-oct24-2026', 'main-library'],
      ['sf-marina-library-open-house-oct17-2026', null],
      ['sf-halloween-broadside-printing-oct17-2026', 'main-library'],
      ['sf-main-halloween-costume-swap-oct15-2026', 'main-library'],
    ] as const) {
      const event = byId(id);
      assert.equal(isAdultOnly(event), false, `${id} has no adult-only admission rule`);
      assert.equal(isProfessional(event), false, `${id} is not a professional/tech-industry event`);
      if (venue) {
        assert.equal(worldEvent(event)?.id, venue, `${id} matches the existing Main Library venue`);
        assert.equal(NOT_PLACED[id], undefined, `${id} is visible through the existing venue matcher`);
      } else {
        assert.ok(NOT_PLACED[id], `${id} retains its explicit pending-import reason`);
        assert.equal(worldEvent(event), null, `${id} awaits world venue and navigation acceptance`);
      }
    }
    // Halloween first: all four family Halloween events stand at their venues
    for (const [id, venue] of [['sf-halloween-hoopla-2026', 'yerba-buena-gardens'], ['sf-sunnydale-pumpkin-fest-2026', 'sunnydale-hub'], ['sf-family-connections-halloween-2026', 'portola-family-connections'], ['sf-thrive-thrill-o-ween-2026', 'thrive-city']] as const) {
      assert.equal(worldEvent(byId(id))?.id, venue, id);
    }
    // the 18+ After Dark nights at the Exploratorium stay out although the museum has a row
    assert.equal(worldEvent(byId('sf-exploratorium-after-dark-01-oct2026')), null);
    assert.equal(worldEvent(byId('sf-exploratorium-family-science-oct24-2026'))?.id, 'exploratorium');
    // every listed id has a souvenir id and a short name for BAYBAY's lines
    for (const v of EVENT_VENUES) for (const id of v.events) { assert.ok(SOUVENIR_IDS.includes(id), id); assert.ok(EVENT_SAY[id], id); }
    // a catalog id listed at one row exists in today's catalog (no stale ids after the autumn release)
    for (const v of EVENT_VENUES) for (const id of v.events) assert.ok(CATALOG.events.some(e => e.id === id), `${v.id}: ${id} is in the catalog`);
  } finally { setCatalogForTests(null); }
});

test('W6-S1 windows on the owner’s dates with the autumn catalog: Halloween events at their hours, the arena at night, the opera matinee', () => {
  setCatalogForTests(CATALOG);
  try {
    const on = (spec: string) => activeEventsAt(bay(spec), CATALOG).map(w => w.event.id).sort();
    assert.ok(on('2026-10-17T12:30').includes('sf-sunnydale-pumpkin-fest-2026'));
    assert.ok(!on('2026-10-17T15:00').includes('sf-sunnydale-pumpkin-fest-2026'), 'the Pumpkin Fest ends at 15:00');
    assert.ok(on('2026-10-23T16:45').includes('sf-family-connections-halloween-2026'));
    assert.ok(on('2026-10-23T17:45').includes('sf-warriors-grizzlies-2026'), 'doors 17:30');
    assert.ok(on('2026-10-24T12:00').includes('sf-thrive-thrill-o-ween-2026'));
    assert.ok(on('2026-10-24T12:00').includes('sf-exploratorium-family-science-oct24-2026'));
    assert.ok(on('2026-10-24T12:00').includes('ferry-plaza-farmers-market-2026-autumn'), 'Saturday market');
    assert.ok(!on('2026-10-24T16:59').includes('ferry-plaza-farmers-market-2026-autumn'));
    assert.deepEqual(on('2026-10-31T12:30').filter(id => id.includes('halloween')), ['sf-halloween-hoopla-2026']);
    assert.ok(on('2026-10-04T14:30').includes('sf-opera-mary-queen-scots-2026'), 'the Sunday matinee');
    assert.ok(!on('2026-10-02T14:30').includes('sf-opera-mary-queen-scots-2026'), 'Friday is an evening show');
    const market = byId('ferry-plaza-farmers-market-2026-autumn'), ferry = EVENT_VENUES.find(v => v.id === 'ferry-building')!;
    assert.deepEqual(eventHours(market, ferry, '2026-10-03'), [H(8), H(14)]);
    assert.deepEqual(eventHours(market, ferry, '2026-10-06'), [H(10), H(14)]);
    assert.equal(eventHours(market, ferry, '2026-10-05'), null, 'no market on Monday');
    assert.deepEqual(on('2026-11-15T12:00'), [], 'no San Francisco event of the catalog runs in November');
  } finally { setCatalogForTests(null); }
});

test('W6-S1 the Ferry Plaza market is the 今天 tab’s market row and the daily market task, never a second row or an event task', () => {
  const market = byId('ferry-plaza-farmers-market-2026-autumn');
  assert.equal(handRowOf(market), 'market');
  assert.equal(handRowOf(byId('sf-world-of-dumplings-2026')), null, 'the dumpling festival at the Ferry Building is an event');
  setCatalogForTests(CATALOG);
  try {
    const s = daySignals('2026-10-03', CATALOG);
    assert.ok(s.market, 'Saturday: the market signal');
    assert.ok(!s.events.some(w => w.event.id === market.id), 'not also an event signal');
    assert.ok(s.events.some(w => w.event.id === 'hardly-strictly-bluegrass-2026'));
  } finally { setCatalogForTests(null); }
  const tab = fs.readFileSync(path.resolve('src/opus-bay/realsf/TodayTab.tsx'), 'utf8');
  assert.match(tab, /todaysAll\.filter\(w => !handRowOf\(w\.event\)\)/);
});

test('W6-S3 the daily three: a free event of the day wins the event task over a paid arena or opera night', () => {
  setCatalogForTests(CATALOG);
  try {
    for (const day of ['2026-10-03', '2026-10-04', '2026-10-11', '2026-10-17', '2026-10-24', '2026-10-31']) {
      const s = daySignals(day, CATALOG);
      assert.ok(s.events.some(w => w.event.cost === 'free'), `${day} has a free event`);
      const t = dailyThree(day, s).find(x => x.kind === 'event');
      assert.ok(t, `${day}: an event task`);
      assert.equal(byId(t!.eventId!).cost, 'free', `${day}: ${t!.eventId}`);
    }
    // a day with only paid nights still gets its event task (Oct 20: The Ring with the symphony)
    const t = dailyThree('2026-10-20', daySignals('2026-10-20', CATALOG)).find(x => x.kind === 'event');
    assert.equal(t?.eventId, 'sf-symphony-ring-film-2026');
  } finally { setCatalogForTests(null); }
});
