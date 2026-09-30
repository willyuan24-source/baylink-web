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
const { eventDaysInWindow, sanitizeCatalog, setCatalogForTests } = await import('../src/opus-bay/data/catalog');
const { EVENT_VENUES, EVENT_SAY, SOUVENIR_IDS, VENUE_SAY, WORLD_SKIP } = await import('../src/opus-bay/realsf/eventVenues');
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
