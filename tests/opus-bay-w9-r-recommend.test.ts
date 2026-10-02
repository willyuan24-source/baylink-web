import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

/**
 * Wave 9 · lane R (W9-R4): 这周去哪 in city mode (review R§5 #12). Red before: 带娃 / 户外 / 旧金山 on 1 Oct said
 * 「旧金山这几天不多，也放了别的地区的」 and pinned Santa Rosa and Vacaville (the North Bay, an hour+ away) while San
 * Francisco had free family festivals; the order was region → vibe → companions and 户外 meant category === outdoors.
 * Now: city mode relaxes vibe → companions → region (a part of the city → all of SF → the Bay); 户外 by what the event is
 * (setting, an open-air venue, a park / lawn / street); the third question offers four parts of San Francisco; 带长辈
 * exists; the notes count what the place really had. District mode keeps its old order (tests/opus-bay-flow-data).
 */

const g = globalThis as unknown as Record<string, unknown>;
g.location = { search: '?world=city&save=off', href: 'http://localhost/opus-bay?world=city&save=off', pathname: '/opus-bay', hostname: 'localhost' };
g.window ??= globalThis;

const C = await import('../src/opus-bay/data/catalog');
const { worldEvent } = await import('../src/opus-bay/realsf/events');
const { venueLatLng } = await import('../src/opus-bay/realsf/eventVenues');

const CATALOG = C.sanitizeCatalog(JSON.parse(fs.readFileSync(path.resolve('public/planner-catalog.json'), 'utf8')));
const TODAY = '2026-10-01';
const hooks = () => C.setEventVenueHooks({
  locate: e => { const v = worldEvent(e); return v ? { x: v.x, z: v.z, ...venueLatLng(v), name: v.name, outdoor: v.kit !== 'board' } : null; },
  go: () => {},
});
const rec = (companions: string, vibe: string, region: string, cityFirst = true) => C.recommendEvents(CATALOG, { companions, vibe, region }, TODAY, { cityFirst });

test('W9-R4 带娃 / 户外 / 旧金山 (the planner’s case, 1 Oct): San Francisco family picks, no North Bay; the note does not call SF quiet', () => {
  const off = hooks();
  try {
    const r = rec('kids', 'outdoors', 'sf');
    assert.ok(r.events.length >= 3, r.events.map(e => e.event.id).join(' '));
    for (const item of r.events) assert.equal(item.event.region, 'sf', `${item.event.id} (${item.event.region}) — the region holds longest in city mode`);
    assert.ok(!r.events.some(item => /santa-rosa|vacaville/i.test(item.event.id)), 'no Santa Rosa / Vacaville');
    for (const item of r.events) assert.ok(C.companionFit(item.event, 'kids'), `${item.event.id} is for kids (never relaxed)`);
    assert.ok(!r.relaxed.includes('region'), r.relaxed.join());
    if (r.note) assert.doesNotMatch(r.note.zh, /旧金山这几天不多/);
    // the old order (district mode) is unchanged: it still goes to other regions first
    const old = rec('kids', 'outdoors', 'sf', false);
    assert.ok(old.events.length >= 1);
  } finally { off(); }
});

test('W9-R4 户外 by what it is: Hardly Strictly Bluegrass (Hellman Hollow, a stage) and the African Arts Festival (YBG’s Great Lawn) are 户外; a library talk is not', () => {
  const off = hooks();
  try {
    const byId = (id: string) => CATALOG.events.find(e => e.id === id)!;
    assert.equal(byId('hardly-strictly-bluegrass-2026').category, 'culture');
    assert.ok(C.isOutdoor(byId('hardly-strictly-bluegrass-2026')));
    assert.ok(C.isOutdoor(byId('sf-african-arts-festival-2026')));
    assert.ok(!C.isOutdoor(byId('sfpl-omi-history-day-oct17-2026')), 'an indoor library meeting room');
    assert.ok(C.vibeFit(byId('hardly-strictly-bluegrass-2026'), 'outdoors'));
  } finally { off(); }
});

test('W9-R4 the city’s parts: venues land in the right part; a part relaxes to the whole city before the Bay; 湾区其他地方 is never San Francisco', () => {
  const off = hooks();
  try {
    const area = (id: string) => C.eventArea(CATALOG.events.find(e => e.id === id)!);
    assert.equal(area('hardly-strictly-bluegrass-2026'), 'sf-west', 'Golden Gate Park');
    assert.equal(area('sf-african-arts-festival-2026'), 'sf-central', 'Yerba Buena Gardens');
    assert.equal(area('sf-castro-street-fair-2026'), 'sf-south', 'the Castro');
    assert.equal(C.sfAreaAt({ lat: 37.8080, lng: -122.4177 }), 'sf-north', 'Fisherman’s Wharf');
    assert.equal(C.sfAreaAt({ lat: 37.7955, lng: -122.3935 }), 'sf-north', 'the Ferry Building');
    assert.equal(C.sfAreaAt({ lat: 37.7793, lng: -122.4193 }), 'sf-central', 'City Hall');
    assert.equal(C.sfAreaAt({ lat: 37.7599, lng: -122.4148 }), 'sf-south', 'the Mission at 20th');
    assert.equal(C.sfAreaAt({ lat: 37.7680, lng: -122.3877 }), 'sf-central', 'the Chase Center');
    assert.equal(C.sfAreaAt({ lat: 37.7841, lng: -122.4376 }), 'sf-central', 'the Western Addition library');
    assert.equal(C.sfAreaAt({ lat: 37.7520, lng: -122.4180 }), 'sf-south', 'the Mission at 24th');
    for (const a of C.SF_AREAS) {
      const r = rec('friends', 'any', a);
      assert.ok(r.events.length >= 1, a);
      const first = r.events.filter(item => C.regionFit(item.event, a));
      // the asked part first; anything else comes from the rest of San Francisco before the Bay
      if (first.length < r.events.length && r.events.some(item => item.event.region !== 'sf')) {
        assert.ok(r.events.filter(item => item.event.region === 'sf').length >= 3 || r.relaxed.includes('region'), `${a}: ${r.events.map(i => i.event.id).join(' ')}`);
      }
      if (r.relaxed.includes('region')) assert.match(r.note!.zh, /旧金山别处/, `${a}: ${r.note?.zh}`);
    }
    const bay = rec('friends', 'any', 'bay');
    for (const item of bay.events) assert.notEqual(item.event.region, 'sf', item.event.id);
    assert.deepEqual(C.CITY_REGION_OPTIONS.map(o => o.value), ['sf-north', 'sf-central', 'sf-west', 'sf-south', 'sf', 'bay']);
    assert.equal(C.regionLabel('sf-west')?.zh, '金门公园 · 西边');
  } finally { off(); }
});

test('W9-R4 the notes are honest: a vibe relaxed in SF names the place and the week; a region relaxed counts what the place had', () => {
  const off = hooks();
  try {
    const food = rec('friends', 'food', 'sf');
    if (food.relaxed.includes('vibe')) assert.match(food.note!.zh, /旧金山合适的吃喝类这(两)?周只有 \d+ 个|这(两)?周旧金山没有合适的吃喝类/, food.note!.zh);
    // relaxNote alone: the counts say how many the place had
    const ev = CATALOG.events.find(e => e.region === 'north-bay')!;
    const item = { event: ev, nextDate: TODAY, days: [TODAY], score: 0, reasons: [] };
    const note = C.relaxNote({ events: [item], relaxed: ['region'], windowDays: 7, counts: { inRegion: 2 } }, { companions: 'kids', vibe: 'outdoors', region: 'sf' });
    assert.equal(note?.zh, '旧金山这周合适的只有 2 个，也放了别的地区的。');
    assert.equal(note?.en, 'Only 2 picks in San Francisco fit this week, so I added other areas.');
    const none = C.relaxNote({ events: [item], relaxed: ['region'], windowDays: 7, counts: { inRegion: 0 } }, { companions: 'kids', vibe: null, region: 'sf-north' });
    assert.equal(none?.zh, '北岸一带这周没有完全合适的，放了旧金山别处和湾区其他地方的。');
  } finally { off(); }
});

test('W9-R4 带长辈: daytime outings for everyone (no night starts, no 18+, no tech); relaxing it says so', () => {
  const off = hooks();
  try {
    const r = rec('seniors', 'any', 'sf');
    assert.ok(r.events.length >= 3);
    for (const item of r.events) {
      assert.ok(!C.isAdultOnly(item.event) && !C.isProfessional(item.event), item.event.id);
      if (!r.relaxed.includes('companions')) assert.ok(!C.startsAtNight(item.event), `${item.event.id}: ${item.event.dateLabel}`);
    }
    assert.equal(C.SENIORS_OPTION.value, 'seniors');
    assert.ok(C.startsAtNight({ id: 'x', title: 'x', startDate: TODAY, region: 'sf', dateLabel: '10/19 · 19:30' }));
    assert.ok(!C.startsAtNight({ id: 'x', title: 'x', startDate: TODAY, region: 'sf', dateLabel: '10/3 · 16:00–19:00' }), 'a range ending at 19:00 is a day outing');
    // the 120-answer sweep's guarantees hold for the new answers too
    for (const c of ['seniors', 'kids', 'solo']) for (const v of ['free', 'food', 'outdoors', 'culture', 'any']) for (const reg of C.CITY_REGION_OPTIONS.map(o => o.value)) {
      const x = rec(c, v, reg);
      for (const item of x.events) {
        if (c === 'kids') assert.ok(!C.isAdultOnly(item.event), `${c}/${v}/${reg}: ${item.event.id}`);
        if (C.isProfessional(item.event)) assert.ok(c === 'solo' && v === 'culture', `${c}/${v}/${reg}: ${item.event.id}`);
      }
      if (x.relaxed.length) assert.ok(x.note, `${c}/${v}/${reg}: relaxed without a note`);
    }
  } finally { off(); }
});

test('W9-R4 the travel profile in today’s three: with 带娃 the event task is a kids / free open-air daytime one (never the symphony or the opera); with 带长辈 never a night start', async () => {
  const { daySignals, dailyThree, eventFitsProfile } = await import('../src/opus-bay/realsf/daily');
  const off = hooks();
  C.setCatalogForTests(CATALOG);
  try {
    let changed = 0, kidsDays = 0;
    for (let d = 0; d < 61; d++) {
      const day = C.addDays(TODAY, d);
      const plain = dailyThree(day, daySignals(day, CATALOG, null)).find(t => t.kind === 'event');
      const kids = dailyThree(day, daySignals(day, CATALOG, 'kids')).find(t => t.kind === 'event');
      const seniors = dailyThree(day, daySignals(day, CATALOG, 'seniors')).find(t => t.kind === 'event');
      if (kids) {
        kidsDays++;
        const e = CATALOG.events.find(x => x.id === kids.eventId)!;
        assert.ok(eventFitsProfile(e, 'kids'), `${day}: ${e.id}`);
        assert.doesNotMatch(e.id, /symphony|opera|doja|rod-wave|chayanne|young-miko|phoebe/, `${day}: ${e.id} with kids`);
      }
      if (seniors) assert.ok(!C.startsAtNight(CATALOG.events.find(x => x.id === seniors.eventId)!), `${day}: ${seniors.eventId}`);
      if (plain?.eventId !== kids?.eventId) changed++;
    }
    assert.ok(kidsDays >= 10, `kids still get an event task on many days (${kidsDays})`);
    assert.ok(changed >= 1, 'the profile changes the pick on some days (red before: it never did)');
  } finally { off(); C.setCatalogForTests(null); }
});
