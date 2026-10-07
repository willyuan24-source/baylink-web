import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import type { CatalogEvent } from '../src/opus-bay/core/types';

/**
 * Wave 7 · lane S (W7-S1): GPT's Sep 29 website refresh in the world.
 *
 *   - the guard: every San Francisco event of 29 Sep – 30 Nov that the world shows (worldEvent) has a souvenir id
 *     (SOUVENIR_IDS: its bit in the save — `event:<id>` of a catalog id is often over the ledger's 40-character one-off
 *     limit, and then pay() returned 0, the stamp never saved and the souvenir line came back every day), a short name
 *     for BAYBAY (EVENT_SAY) and a venue name (VENUE_SAY); its lines fit (≤ 45 zh characters) at its real windows
 *   - the six new venue rows' hours on their days (the organiser's Fall Show table, the Potrero Hill start-only label)
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

const { parseBayDate, __setBayNowForTests } = await import('../src/opus-bay/game/bayNow');
const { eventDaysInWindow, sanitizeCatalog, setCatalogForTests, upcomingEvents } = await import('../src/opus-bay/data/catalog');
const { EVENT_VENUES, EVENT_SAY, SOUVENIR_IDS, VENUE_SAY, WORLD_SKIP, venueForEvent } = await import('../src/opus-bay/realsf/eventVenues');
const { activeEventsAt, eventWindow, windowEndKnown, worldEvent } = await import('../src/opus-bay/realsf/events');
const { eventLine, souvenirLine } = await import('../src/opus-bay/realsf/presence');
const save = await import('../src/opus-bay/data/save');
const L = await import('../src/opus-bay/economy/ledger');
const { MAX_ONE_OFF_CHARS } = await import('../src/opus-bay/data/playSave');

const CATALOG = sanitizeCatalog(JSON.parse(fs.readFileSync(path.resolve('public/planner-catalog.json'), 'utf8')));
const sfWindow = (e: CatalogEvent) => e.region === 'sf' && (e.endDate ?? e.startDate) >= '2026-09-29' && e.startDate <= '2026-11-30';
const byId = (id: string) => { const e = CATALOG.events.find(x => x.id === id); assert.ok(e, id); return e!; };
const bay = (spec: string) => { const d = parseBayDate(spec); assert.ok(d, spec); return d!; };
const H = (h: number, m = 0) => h * 60 + m;

test('new public events at a known venue remain discoverable without automatically creating an unregistered world experience', () => {
  const event: CatalogEvent = { ...byId('nov2026-sf-renegade-craft-winter'), id: 'future-pavilion-family-fair' };
  const catalog = { ...CATALOG, events: [event] };
  assert.equal(venueForEvent(event)?.id, 'fort-mason-festival-pavilion', 'the venue can still be recognized');
  assert.equal(worldEvent(event), null, 'a matching venue is not a reviewed world event registration');
  assert.deepEqual(activeEventsAt(bay('2026-11-15T12:00'), catalog), [], 'no unregistered pennant or reward interaction');
  assert.ok(upcomingEvents(catalog, '2026-11-15', 1).some(row => row.event.id === event.id), 'the confirmed public program is retained in the catalog list');
  const venue = EVENT_VENUES.find(row => row.id === 'fort-mason-festival-pavilion')!;
  const registeredIds = venue.events as string[];
  registeredIds.push(event.id);
  try {
    assert.equal(worldEvent(event), null, 'venue registration alone cannot bypass missing reward and dialogue metadata');
  } finally { registeredIds.pop(); }
});

test('W7-S1 guard: every event the world shows has a souvenir bit, a short name and a venue name; its lines fit on every day it is on', () => {
  setCatalogForTests(CATALOG);
  try {
    const shown = CATALOG.events.filter(sfWindow).filter(e => worldEvent(e));
    assert.ok(shown.length >= 47, `${shown.length}`);
    assert.deepEqual([...new Set(SOUVENIR_IDS)], [...SOUVENIR_IDS], 'unique (append-only)');
    for (const e of shown) {
      const v = worldEvent(e)!;
      assert.ok(SOUVENIR_IDS.includes(e.id), `${e.id}: a souvenir id (event:${e.id} is ${`event:${e.id}`.length} characters; the one-off limit is ${MAX_ONE_OFF_CHARS})`);
      assert.ok(EVENT_SAY[e.id], `${e.id}: a short name for BAYBAY`);
      assert.ok(VENUE_SAY[v.id], `${v.id}: a venue name for BAYBAY`);
      assert.ok(v.events.includes(e.id), `${e.id} is listed at ${v.id} (not only caught by its venue text)`);
      for (const day of eventDaysInWindow(e, '2026-09-29', '2026-11-30')) {
        const w = eventWindow(e, v, day);
        if (!w) continue;
        const line = eventLine(w), stamp = souvenirLine(w);
        assert.ok([...line.zh].length <= 45, `${e.id} ${day}: ${line.zh} (${[...line.zh].length})`);
        assert.ok([...stamp.zh].length <= 45, stamp.zh);
        assert.ok(!/undefined|NaN|活动纪念章|an event/.test(line.zh + line.en + stamp.zh + stamp.en), `${e.id}: named, not the fallback`);
      }
    }
    // the skip list names catalog events that exist and stay out
    for (const id of Object.keys(WORLD_SKIP)) assert.equal(worldEvent(byId(id)), null, id);
  } finally { setCatalogForTests(null); }
});

test('W7-S1 the souvenir of an event with a long id is stored: pay() pays 15 once and isPaid() stays true (red before: 0, never saved)', () => {
  save.resetSaveCache();
  save.clearSave();
  L.__resetLedgerForTests();
  __setBayNowForTests('2026-10-15T16:30');
  const off = L.registerRewardIds('event', SOUVENIR_IDS);
  try {
    for (const id of ['sf-main-halloween-costume-swap-oct15-2026', 'sf-halloween-broadside-printing-oct17-2026', 'sf-foodwise-latine-makers-oct3-2026', 'sf-sunday-streets-excelsior-oct18-2026']) {
      const source = `event:${id}`;
      assert.ok(source.length > MAX_ONE_OFF_CHARS, `${source} is too long for the one-off list`);
      assert.equal(L.isPaid(source), false);
      assert.equal(L.pay(source, 15), 15, `${source} pays`);
      assert.equal(L.isPaid(source), true, `${source} is kept`);
      assert.equal(L.pay(source, 15), 0, 'once');
    }
  } finally { off(); __setBayNowForTests(null); L.__resetLedgerForTests(); save.clearSave(); }
});

test('November Chase additions have explicit venue mappings, append-only saved souvenirs, and official starts without an invented end time', () => {
  setCatalogForTests(CATALOG);
  save.resetSaveCache();
  save.clearSave();
  L.__resetLedgerForTests();
  __setBayNowForTests('2026-11-05T18:00');
  const ids = ['sf-warriors-heat-november-2026', 'sf-journey-final-frontier-november-2026'];
  const off = L.registerRewardIds('event', SOUVENIR_IDS);
  try {
    const afterBranchImports = SOUVENIR_IDS.indexOf('sfpl-western-addition-open-house-oct24-2026') + 1;
    assert.deepEqual(SOUVENIR_IDS.slice(afterBranchImports, afterBranchImports + 2), ids, 'Chase bits retain their original positions after the branch-library imports');
    for (const [id, day, doors, start, before] of [
      [ids[0], '2026-11-05', '17:30', '19:00', '18:59'],
      [ids[1], '2026-11-28', '18:00', '19:30', '19:29'],
    ]) {
      const event = byId(id), venue = worldEvent(event)!;
      assert.equal(venue.id, 'chase-center');
      assert.ok(venue.events.includes(id));
      assert.ok(EVENT_SAY[id].zh && EVENT_SAY[id].en);
      assert.ok(event.dateLabel?.includes(start), 'the verified performance/tipoff time remains in the catalog');
      assert.ok(event.dateLabel?.includes(`${doors}开门`), 'the separate doors time remains available in the event details');
      const window = eventWindow(event, venue, day)!;
      // The named-date label resolves to its start; its unscoped doors clause
      // remains event detail, rather than an invented verified hours override.
      assert.equal(window.open, bay(`${day}T${start}`).getTime(), 'the world activates at the verified performance/tipoff time');
      assert.equal(windowEndKnown(window), false, 'no official end time was published');
      assert.equal(venue.hours?.[id], undefined, 'do not turn the game close into official venue hours');
      assert.ok(!/21:00/.test(eventLine(window).zh + eventLine(window).en));
      assert.ok(!activeEventsAt(bay(`${day}T${before}`), CATALOG).some(row => row.event.id === id));
      assert.ok(activeEventsAt(bay(`${day}T${start}`), CATALOG).some(row => row.event.id === id));
      assert.equal(eventWindow(event, venue, '2026-11-15'), null, 'the event does not spill onto another date');
      const source = `event:${id}`;
      assert.equal(L.pay(source, 15), 15);
      assert.equal(L.isPaid(source), true);
      assert.equal(L.pay(source, 15), 0, 'the new souvenir is saved and paid only once');
    }
  } finally {
    off(); __setBayNowForTests(null); L.__resetLedgerForTests(); save.clearSave(); setCatalogForTests(null);
  }
});

test('October 5 Foodwise imports reuse the front-plaza venue, keep official programme windows, and save appended souvenirs once', () => {
  setCatalogForTests(CATALOG);
  save.resetSaveCache();
  save.clearSave();
  L.__resetLedgerForTests();
  __setBayNowForTests('2026-10-10T11:00');
  const ids = ['oct2026-foodwise-flour-craft-demo', 'oct2026-foodwise-fall-fruit'];
  const off = L.registerRewardIds('event', SOUVENIR_IDS);
  try {
    const afterBranchImports = SOUVENIR_IDS.indexOf('sfpl-western-addition-open-house-oct24-2026') + 1;
    assert.deepEqual(SOUVENIR_IDS.slice(afterBranchImports, afterBranchImports + 4), ['sf-warriors-heat-november-2026', 'sf-journey-final-frontier-november-2026', ...ids], 'existing Chase and Foodwise souvenir bits keep their original positions');
    for (const [id, day, close, cost] of [
      [ids[0], '2026-10-10', '11:45', 'free'],
      [ids[1], '2026-10-31', '13:00', 'mixed'],
    ]) {
      const event = byId(id), venue = worldEvent(event)!;
      assert.equal(venue.id, 'ferry-building');
      assert.ok(venue.events.includes(id), 'reviewed registration, not accidental text matching');
      assert.match(event.venue!, /in front of 1 Ferry Building/);
      const window = eventWindow(event, venue, day)!;
      assert.equal(window.open, bay(`${day}T11:00`).getTime());
      assert.equal(window.close, bay(`${day}T${close}`).getTime(), 'the short demo does not truncate the wider fruit celebration');
      assert.equal(windowEndKnown(window), true);
      assert.equal(event.cost, cost, 'shopping at the celebration is not labelled free');
      assert.ok(!activeEventsAt(bay(`${day}T10:59`), CATALOG).some(row => row.event.id === id));
      assert.ok(activeEventsAt(bay(`${day}T11:00`), CATALOG).some(row => row.event.id === id));
      assert.ok(!activeEventsAt(bay(`${day}T${close}`), CATALOG).some(row => row.event.id === id));
      assert.equal(eventWindow(event, venue, '2026-11-01'), null);
      assert.equal(L.pay(`event:${id}`, 15), 15);
      assert.equal(L.isPaid(`event:${id}`), true);
      assert.equal(L.pay(`event:${id}`, 15), 0);
    }
    for (const id of ['oct2026-mission-dia-muertos-market', 'nov2026-mission-market-season-final', 'nov2026-presidio-dia-muertos-diwali', 'nov2026-botanical-one-day-choir']) {
      assert.ok(byId(id), 'the public website event is retained');
      assert.match(WORLD_SKIP[id], /no independently verified world venue point/);
      assert.equal(worldEvent(byId(id)), null, 'no invented programme pin or unrelated Mission Street venue');
      assert.ok(!EVENT_VENUES.some(venue => venue.events.includes(id)));
      assert.ok(!SOUVENIR_IDS.includes(id));
    }
  } finally {
    off(); __setBayNowForTests(null); L.__resetLedgerForTests(); save.clearSave(); setCatalogForTests(null);
  }
});

test('October 7 existing-venue imports retain exact published windows and append souvenirs after the earlier Foodwise bits', () => {
  setCatalogForTests(CATALOG);
  save.resetSaveCache();
  save.clearSave();
  L.__resetLedgerForTests();
  const ids = ['nov2026-sf-renegade-craft-winter', 'nov2026-foodwise-market-memories-demo'];
  const off = L.registerRewardIds('event', SOUVENIR_IDS);
  try {
    const afterPriorImports = SOUVENIR_IDS.indexOf('oct2026-foodwise-fall-fruit') + 1;
    assert.deepEqual(SOUVENIR_IDS.slice(afterPriorImports, afterPriorImports + 2), ids, 'append new bits without shifting any saved earlier reward');
    for (const [id, venueId, days, close] of [
      [ids[0], 'fort-mason-festival-pavilion', ['2026-11-14', '2026-11-15'], '17:00'],
      [ids[1], 'ferry-building', ['2026-11-21'], '11:45'],
    ] as const) {
      const event = byId(id), venue = worldEvent(event)!;
      assert.equal(venue.id, venueId);
      assert.ok(venue.events.includes(id));
      assert.deepEqual(eventDaysInWindow(event, '2026-11-01', '2026-11-30'), days, 'only published dates are admitted');
      assert.equal(venue.hours?.[id], undefined, 'the new event reads its own date label, never a previous event override');
      for (const day of days) {
        const window = eventWindow(event, venue, day)!;
        assert.equal(window.open, bay(`${day}T11:00`).getTime());
        assert.equal(window.close, bay(`${day}T${close}`).getTime());
        assert.equal(windowEndKnown(window), true, 'both close times are explicitly published');
        assert.ok(!activeEventsAt(bay(`${day}T10:59`), CATALOG).some(row => row.event.id === id));
        assert.ok(activeEventsAt(bay(`${day}T11:00`), CATALOG).some(row => row.event.id === id));
        assert.ok(!activeEventsAt(bay(`${day}T${close}`), CATALOG).some(row => row.event.id === id));
      }
      assert.equal(eventWindow(event, venue, '2026-11-16'), null, 'a range label must not leak into an unlisted day');
      __setBayNowForTests(`${days[0]}T11:00`);
      assert.equal(L.pay(`event:${id}`, 15), 15);
      assert.equal(L.isPaid(`event:${id}`), true);
      assert.equal(L.pay(`event:${id}`, 15), 0, 'the registered souvenir pays only once');
    }
  } finally {
    off(); __setBayNowForTests(null); L.__resetLedgerForTests(); save.clearSave(); setCatalogForTests(null);
  }
});

test('W7-S1 the new rows on their days: the Fall Show by the organiser, the flea, the festival’s start only, Sunday Streets, Bay Beats, the library', () => {
  setCatalogForTests(CATALOG);
  try {
    const on = (spec: string) => activeEventsAt(bay(spec), CATALOG).map(w => w.event.id);
    const win = (id: string, day: string) => { const e = byId(id); return eventWindow(e, worldEvent(e)!, day); };
    const mins = (id: string, day: string) => { const w = win(id, day)!; const p = (t: number) => { const d = new Date(t); return new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Los_Angeles', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d).split(':').map(Number).reduce((h, m) => h * 60 + m); }; return [p(w.open), p(w.close)]; };
    // the Fall Show: 10:30–19:00 Thu–Sat, 11:00–17:00 Sunday (sffallshow.org/about, the venue table)
    assert.deepEqual(mins('sf-fall-show-oct15-18-2026', '2026-10-15'), [H(10, 30), H(19)]);
    assert.deepEqual(mins('sf-fall-show-oct15-18-2026', '2026-10-17'), [H(10, 30), H(19)]);
    assert.deepEqual(mins('sf-fall-show-oct15-18-2026', '2026-10-18'), [H(11), H(17)]);
    assert.equal(win('sf-fall-show-oct15-18-2026', '2026-10-14'), null, 'not the gala night');
    assert.ok(windowEndKnown(win('sf-fall-show-oct15-18-2026', '2026-10-16')!));
    // the flea 10–16, Sunday Streets 11–16, Bay Beats 14–18, the library 11–15: the organisers' ranges
    assert.deepEqual(mins('sf-inner-sunset-flea-oct11-2026', '2026-10-11'), [H(10), H(16)]);
    assert.deepEqual(mins('sf-sunday-streets-excelsior-oct18-2026', '2026-10-18'), [H(11), H(16)]);
    assert.deepEqual(mins('sf-bay-beats-bandshell-oct24-2026', '2026-10-24'), [H(14), H(18)]);
    assert.deepEqual(mins('sf-marina-library-open-house-oct17-2026', '2026-10-17'), [H(11), H(15)]);
    // Potrero Hill: 10:00, its end unconfirmed (16:00 or 17:00 on the organiser's two pages): "10:00 起", never a range
    const potrero = win('sf-potrero-hill-festival-oct17-2026', '2026-10-17')!;
    assert.equal(windowEndKnown(potrero), false);
    assert.match(eventLine(potrero).zh, /10:00起/);
    // Oct 11: the flea joins the jets, the parade and YBG Dance Day; Oct 17: the festival, the library, the Fall Show,
    // the Pumpkin Fest and the broadside printing
    assert.ok(on('2026-10-11T12:40').includes('sf-inner-sunset-flea-oct11-2026'));
    const oct17 = on('2026-10-17T12:30');
    for (const id of ['sf-potrero-hill-festival-oct17-2026', 'sf-marina-library-open-house-oct17-2026', 'sf-fall-show-oct15-18-2026', 'sf-sunnydale-pumpkin-fest-2026']) assert.ok(oct17.includes(id), id);
    assert.ok(on('2026-10-17T14:30').includes('sf-halloween-broadside-printing-oct17-2026'));
    assert.ok(on('2026-10-24T15:00').includes('sf-bay-beats-bandshell-oct24-2026'));
    assert.ok(!on('2026-10-24T11:00').includes('sf-financial-planning-day-oct24-2026'), 'the finance day stays out');
    // every new row is listed once and names its OSM source
    for (const id of ['golden-gate-bandshell', 'marina-library', 'fort-mason-festival-pavilion', 'irving-11th', 'potrero-20th', 'mission-excelsior']) {
      const v = EVENT_VENUES.find(x => x.id === id)!;
      assert.equal(v.verifiedAt, '2026-09-29', id);
      assert.match(v.sourceUrl, /^https:\/\/www\.openstreetmap\.org\/(way|node)\/\d+$/);
    }
    assert.equal(EVENT_VENUES.find(v => v.id === 'golden-gate-bandshell')!.ownStage, true, 'the bandshell model is the stage');
  } finally { setCatalogForTests(null); }
});
