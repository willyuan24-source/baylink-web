import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test, { after } from 'node:test';

/**
 * Wave 9 · lane R's adversarial review (W9-R-review): the fixes of the lens findings, each red before its fix —
 *   R-RC-2 / R-RP-2  加到日历 in English writes English (the title, the venue, the cost line, the reminder)
 *   R-RP-6           the .ics LOCATION never repeats the city
 *   R-RC-4 / R-RP-1  这周免费 / 近 7 天免费 never list today's slots that are already over
 *   R-RC-1           today's three keep their slots after a reload once one is paid, whatever the new travel profile
 *   R-RC-3           district 这周去哪 keeps 户外 = the catalog's category (district mode never changes)
 *   R-RP-3           金门公园 · 西边 is not the south-west (Ocean View / Ingleside are the south)
 */

const g = globalThis as unknown as Record<string, unknown>;
g.location = { search: '?world=city&save=off', href: 'http://localhost/opus-bay?world=city&save=off', pathname: '/opus-bay', hostname: 'localhost' };
g.window ??= globalThis;
const noop = () => undefined;
const ctx2d = new Proxy({}, {
  get: (_t, k) => (k === 'measureText' ? () => ({ width: 10 }) : k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop: noop }) : k === 'getImageData' ? (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }) : noop),
  set: () => true,
});
g.document ??= { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => ctx2d }), documentElement: { lang: 'zh-Hans', setAttribute: noop, style: {} } };

const Loc = await import('../src/i18n/locale');
const C = await import('../src/opus-bay/data/catalog');
const { parseLive } = await import('../src/opus-bay/realsf/live');
const fw = await import('../src/opus-bay/realsf/freeWeek');
const ics = await import('../src/opus-bay/realsf/ics');
const { __setBayNowForTests } = await import('../src/opus-bay/game/bayNow');
const { game } = await import('../src/opus-bay/core/store');
const { emit } = await import('../src/opus-bay/core/events');
const daily = await import('../src/opus-bay/realsf/daily');
const prefs = await import('../src/opus-bay/realsf/prefs');
const save = await import('../src/opus-bay/data/save');
const L = await import('../src/opus-bay/economy/ledger');

const CATALOG = C.sanitizeCatalog(JSON.parse(fs.readFileSync(path.resolve('public/planner-catalog.json'), 'utf8')));
const OFFERS = parseLive(JSON.parse(fs.readFileSync(path.resolve('public/opus-bay/sf/v1/live.json'), 'utf8')))!;
const byId = (id: string) => { const e = CATALOG.events.find(x => x.id === id); assert.ok(e, id); return e!; };
const HAN = /[㐀-鿿]/;
const field = (text: string, name: string) => (text.replace(/\r\n /g, '').split('\r\n').find(l => l.startsWith(`${name}:`)) ?? '').slice(name.length + 1);

after(async () => { await Loc.setLocale('zh-Hans', false); __setBayNowForTests(null); });

test('R-RC-2 / R-RP-2 加到日历 in English: SUMMARY, LOCATION, the cost line and the reminder are English (zh unchanged)', async () => {
  const fleming = byId('sf-symphony-fleming-strauss-2026');
  const zh = ics.eventIcs(fleming, '2026-10-03', 0);
  assert.match(field(zh, 'SUMMARY'), HAN, 'zh keeps the catalog title');
  await Loc.setLocale('en', false);
  try {
    for (const id of ['sf-symphony-fleming-strauss-2026', 'sfpl-richmond-lego-oct7-2026', 'sf-african-arts-festival-2026']) {
      const ev = byId(id);
      const day = C.eventDaysInWindow(ev, ev.startDate, ev.endDate ?? ev.startDate, ev.startDate)[0] ?? ev.startDate;
      const text = ics.eventIcs(ev, day, 0, 'en');
      for (const name of ['SUMMARY', 'LOCATION']) assert.doesNotMatch(field(text, name), HAN, `${id} ${name}: ${field(text, name)}`);
      const unfolded = text.replace(/\r\n /g, '');
      const alarm = unfolded.split('BEGIN:VALARM')[1];
      assert.doesNotMatch(alarm, HAN, `${id} reminder: ${alarm}`);
      const desc = field(text, 'DESCRIPTION').split('\\n').slice(1).join(' ');
      assert.doesNotMatch(desc, HAN, `${id} description: ${desc}`);
    }
    const zoo = OFFERS.find(o => o.id === 'sf-zoo-resident-free-oct7-2026')!;
    const o = ics.offerIcs(zoo, '2026-10-07', [600, 960], 0, 'en').replace(/\r\n /g, '');
    assert.doesNotMatch(o, /明天免费/, 'the offer reminder in English');
  } finally { await Loc.setLocale('zh-Hans', false); }
});

test('R-RP-6 the .ics LOCATION: the city only when the venue does not already name it', () => {
  assert.equal(ics.icsLocation('Davies Symphony Hall · 201 Van Ness Avenue, San Francisco, CA', 'San Francisco'), 'Davies Symphony Hall · 201 Van Ness Avenue, San Francisco, CA');
  assert.equal(ics.icsLocation('Great Lawn · Yerba Buena Gardens', 'San Francisco'), 'Great Lawn · Yerba Buena Gardens, San Francisco');
  const text = ics.eventIcs(byId('sf-symphony-fleming-strauss-2026'), '2026-10-03', 0);
  assert.equal((field(text, 'LOCATION').match(/San Francisco/g) ?? []).length, 1, field(text, 'LOCATION'));
});

test('R-RC-4 / R-RP-1 这周免费 and 近 7 天免费 drop today’s slots that are over (the tea garden’s 9–10 hour at 15:00; the zoo at 18:30)', () => {
  const ended = (d: { items: ReturnType<typeof fw.freeOffersOn> }, now: number) => d.items.filter(i => {
    const h = i.kind === 'offer' ? i.hours : fw.eventDayHours(i.event, i.day);
    return !!h && h[1] <= now;
  });
  const morning = fw.freeWeek('2026-10-02', 7, OFFERS, CATALOG, null, 8 * 60);
  assert.ok(morning[0].items.some(i => i.kind === 'offer' && i.offer.id === 'japanese-tea-garden-free-hour'), 'at 8:00 the tea garden hour is still ahead');
  const week = fw.freeWeek('2026-10-02', 7, OFFERS, CATALOG, null, 15 * 60);
  assert.deepEqual(ended(week[0], 15 * 60).map(i => (i.kind === 'offer' ? i.offer.id : i.event.id)), [], 'nothing over on today’s chip');
  assert.ok(week[0].items.every(i => !(i.kind === 'offer' && i.offer.id === 'japanese-tea-garden-free-hour')));
  // later days are whole days
  assert.deepEqual(week.slice(1).map(d => d.items.length), fw.freeWeek('2026-10-02', 7, OFFERS, CATALOG, null).slice(1).map(d => d.items.length));
  const zoo = OFFERS.find(o => o.id === 'sf-zoo-resident-free-oct7-2026')!.place!;
  assert.equal(fw.freeDaysAt(zoo, '2026-10-07', 7, OFFERS, [], 11 * 60).filter(i => i.day === '2026-10-07').length, 1, 'open at 11:00');
  assert.equal(fw.freeDaysAt(zoo, '2026-10-07', 7, OFFERS, [], 18 * 60 + 30).filter(i => i.day === '2026-10-07').length, 0, 'closed at 18:30');
});

test('R-RC-1 today’s three keep their slots after a reload once one is paid, whatever the new travel profile', () => {
  save.resetSaveCache();
  save.clearSave();
  L.__resetLedgerForTests();
  daily.__resetDailyForTests();
  prefs.__resetPrefsForTests(null);
  const offLedger = L.initLedger();
  C.setCatalogForTests(CATALOG);
  // a day of October whose three change with a profile, with a ride among them (the lens found 15 such pairs)
  const kinds = (d: string, pr: 'kids' | 'seniors' | null) => daily.dailyThree(d, daily.daySignals(d, CATALOG, pr)).map(t => t.kind);
  let DAY = '', PROFILE: 'kids' | 'seniors' = 'kids';
  for (let i = 0; i < 31 && !DAY; i++) {
    const d = C.addDays('2026-10-01', i);
    for (const pr of ['kids', 'seniors'] as const) if (!DAY && kinds(d, null).includes('ride') && kinds(d, pr).join() !== kinds(d, null).join()) { DAY = d; PROFILE = pr; }
  }
  assert.ok(DAY, 'a day whose pick changes with a profile');
  __setBayNowForTests(`${DAY}T10:00`);
  const saved = { phase: game.get().phase, mode: game.get().mode };
  game.set({ phase: 'playing', mode: 'free' });
  let rt = daily.initDaily({ introAfter: 9999 });
  try {
    assert.equal(game.get().worldMode, 'city');
    const before = rt.tasks()!.map(t => t.kind);
    const ride = rt.tasks()!.find(t => t.kind === 'ride');
    assert.ok(ride, `a ride task on ${DAY}: ${before.join()}`);
    emit({ type: 'transit', what: 'ride', line: 'powell-hyde', kind: 'cable-car', real: true });
    assert.ok(L.isPaid(ride!.source), ride!.source);
    // 这周去哪: 带娃 / 带长辈 — a profile that would pick another three for the day
    prefs.setPrefs({ companions: PROFILE, at: DAY });
    assert.notDeepEqual(kinds(DAY, PROFILE), before, 'the profile changes the slots');
    // reload: a new runtime, the page's own marks gone, the ledger and the prefs kept
    rt.off();
    daily.__resetDailyForTests();
    rt = daily.initDaily({ introAfter: 9999 });
    const after = rt.tasks()!;
    assert.deepEqual(after.map(t => t.kind), before, 'the same three in the same slots');
    assert.deepEqual(after.filter(t => rt.done(t)).map(t => t.kind), ['ride'], 'only the ride shows done');
    // a new day follows the profile again
    const NEXT = C.addDays(DAY, 1);
    __setBayNowForTests(`${NEXT}T10:00`);
    assert.deepEqual(rt.tasks()!.map(t => t.kind), kinds(NEXT, PROFILE));
  } finally {
    rt.off(); offLedger(); C.setCatalogForTests(null); game.set(saved); prefs.__resetPrefsForTests(null); __setBayNowForTests(null);
  }
});

test('R-RC-3 district 这周去哪: 户外 is the catalog’s category (district mode never changes); city mode keeps 户外 by what it is', () => {
  const hsb = byId('hardly-strictly-bluegrass-2026');
  assert.equal(C.isOutdoor(hsb), true, 'city: a meadow stage is 户外');
  assert.equal(C.isOutdoor(hsb, false), false, 'district: category culture');
  assert.equal(C.vibeFit(hsb, 'outdoors', false), false);
  const r = C.recommendEvents(CATALOG, { companions: 'friends', vibe: 'outdoors', region: 'sf' }, '2026-10-02', { cityFirst: false });
  const offVibe = r.events.filter(item => item.event.category !== 'outdoors').map(item => item.event.id);
  if (offVibe.length) assert.ok(r.relaxed.includes('vibe'), `district picks ${offVibe.join()} without saying the vibe was relaxed`);
});

test('R-RP-3 the parts of San Francisco: Ocean View and Ingleside are the south; the park, the Sunset, the zoo and Lake Merced the west', async () => {
  assert.equal(C.sfAreaAt({ lat: 37.7142, lng: -122.4640 }), 'sf-south', 'Ocean View branch, 345 Randolph St');
  assert.equal(C.sfAreaAt({ lat: 37.7236, lng: -122.4557 }), 'sf-south', 'Ingleside branch, 1298 Ocean Ave');
  assert.equal(C.sfAreaAt({ lat: 37.7694, lng: -122.4862 }), 'sf-west', 'Golden Gate Park');
  assert.equal(C.sfAreaAt({ lat: 37.7450, lng: -122.4800 }), 'sf-west', 'the Sunset');
  assert.equal(C.sfAreaAt({ lat: 37.7330, lng: -122.5030 }), 'sf-west', 'the zoo');
  assert.equal(C.sfAreaAt({ lat: 37.7190, lng: -122.4930 }), 'sf-west', 'Lake Merced');
  const { worldEvent } = await import('../src/opus-bay/realsf/events');
  const { venueLatLng } = await import('../src/opus-bay/realsf/eventVenues');
  const off = C.setEventVenueHooks({ locate: e => { const v = worldEvent(e); return v ? { x: v.x, z: v.z, ...venueLatLng(v), name: v.name, outdoor: v.kit !== 'board' } : null; }, go: () => {} });
  try {
    assert.equal(C.eventArea(byId('sfpl-ocean-view-stem-oct8-2026')), 'sf-south', 'the Ocean View STEM free play');
    assert.equal(C.eventArea(byId('hardly-strictly-bluegrass-2026')), 'sf-west');
  } finally { off(); }
});

test('R-RC-5 带娃 keeps Fleet Week (free general areas, open air, by day); never an 18+ or a night start', () => {
  const fleet = byId('san-francisco-fleet-week-2026');
  assert.equal(fleet.cost, 'mixed');
  assert.ok(daily.eventFitsProfile(fleet, 'kids'), 'Fleet Week with kids');
  for (const e of CATALOG.events) if (daily.eventFitsProfile(e, 'kids')) assert.ok(!C.isAdultOnly(e) && (C.companionFit(e, 'kids') || !C.startsAtNight(e)), e.id);
});
