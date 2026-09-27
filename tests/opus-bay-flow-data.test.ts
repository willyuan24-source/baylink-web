import assert from 'node:assert/strict';
import test from 'node:test';
import type { Catalog, CatalogEvent } from '../src/opus-bay/core/types';
import {
  addDays, eventDaysInWindow, eventNextDate, eventsNear, nextSaturday, placesByRegion, recommendEvents, sanitizeCatalog,
  scoreEvents, upcomingEvents, guideTitle, loadCatalog, getCatalog, setCatalogForTests,
} from '../src/opus-bay/data/catalog';
import { mapsUrl, planUrl, safeHref, validPlanStops, withLang, guideUrl, eventUrl } from '../src/opus-bay/data/links';
import { PROGRESS_KEY, WISHLIST_KEY, initPersistence, keepSetting, readProgress, readWishlist, setSessionSettings, setStorageForTests, wishlist } from '../src/opus-bay/data/wishlist';
import { game, initialGameState } from '../src/opus-bay/core/store';

const TODAY = '2026-09-25'; // a Friday

const ev = (id: string, patch: Partial<CatalogEvent> = {}): CatalogEvent => ({ id, title: id, startDate: TODAY, region: 'sf', category: 'culture', cost: 'paid', ...patch });

const catalog: Catalog = {
  events: [
    ev('expired', { startDate: '2026-09-01', endDate: '2026-09-24' }),
    ev('today-only', { category: 'family', cost: 'free', audience: ['亲子家庭'] }),
    ev('long-run', { startDate: '2026-09-01', endDate: '2026-10-31', category: 'outdoors', region: 'north-bay' }),
    ev('next-month', { startDate: '2026-10-20', endDate: '2026-10-21' }),
    ev('occ-outside', { startDate: '2026-09-20', endDate: '2026-10-12', occurrenceDates: ['2026-09-21', '2026-10-10'] }),
    ev('occ-inside', { startDate: '2026-09-20', endDate: '2026-10-12', occurrenceDates: ['2026-09-21', '2026-09-27'], category: 'food' }),
    ev('occ-past-only', { startDate: '2026-09-20', endDate: '2026-10-12', occurrenceDates: ['2026-09-21', '2026-09-24'] }),
    ev('east-food', { startDate: '2026-09-27', region: 'east-bay', category: 'food', cost: 'free', audience: ['朋友聚会'], location: { lat: 37.8, lng: -122.27 } }),
    ev('pier-free', { startDate: '2026-09-26', endDate: '2026-09-27', category: 'outdoors', cost: 'free', location: { lat: 37.8087, lng: -122.4098 } }),
    ev('in-ten-days', { startDate: '2026-10-05', category: 'family', region: 'south-bay' }),
  ],
  places: [
    { id: 'pier39', title: 'PIER 39', region: 'sf' },
    { id: 'alcatraz', title: '恶魔岛', region: 'sf' },
    { id: 'berkeley', title: '伯克利', region: 'east-bay' },
    { id: 'muir-woods', title: '缪尔森林', region: 'north-bay' },
  ],
  guides: [{ slug: 'sf-pier-39', title: 'PIER 39 攻略' }],
};

test('date helpers work on Bay calendar days', () => {
  assert.equal(addDays('2026-09-30', 1), '2026-10-01');
  assert.equal(addDays('2026-11-01', 7), '2026-11-08'); // across DST
  assert.equal(nextSaturday('2026-09-25'), '2026-09-26');
  assert.equal(nextSaturday('2026-09-26'), '2026-09-26');
  assert.equal(nextSaturday('2026-09-27'), '2026-10-03');
});

test('window filtering respects start/end, occurrenceDates and never shows expired events', () => {
  const ids = upcomingEvents(catalog, TODAY, 7).map(item => item.event.id);
  assert.ok(!ids.includes('expired'));
  assert.ok(!ids.includes('next-month'));
  assert.ok(!ids.includes('occ-outside'), 'occurrence dates outside the window do not count');
  assert.ok(!ids.includes('occ-past-only'), 'past occurrences are expired');
  assert.ok(!ids.includes('in-ten-days'));
  for (const id of ['today-only', 'long-run', 'occ-inside', 'east-food', 'pier-free']) assert.ok(ids.includes(id), id);
  const occ = upcomingEvents(catalog, TODAY, 7).find(item => item.event.id === 'occ-inside')!;
  assert.equal(occ.nextDate, '2026-09-27');
  assert.deepEqual(occ.days, ['2026-09-27']);
  const longRun = upcomingEvents(catalog, TODAY, 7).find(item => item.event.id === 'long-run')!;
  assert.equal(longRun.nextDate, TODAY, 'ongoing events start today, not in the past');
  assert.equal(eventNextDate(catalog.events[0], TODAY), null);
  assert.equal(eventNextDate(catalog.events[4], TODAY), '2026-10-10');
  assert.deepEqual(eventDaysInWindow(catalog.events[4], TODAY, addDays(TODAY, 20)), ['2026-10-10']);
  // sorted soonest first
  const dates = upcomingEvents(catalog, TODAY, 7).map(item => item.nextDate);
  assert.deepEqual(dates, [...dates].sort());
});

test('scoring maps companions, vibe and region', () => {
  const items = upcomingEvents(catalog, TODAY, 7);
  const kids = scoreEvents(items, { companions: 'kids', vibe: 'any', region: 'any' }, TODAY);
  assert.equal(kids[0].event.id, 'today-only');
  const free = scoreEvents(items, { companions: null, vibe: 'free', region: 'east-bay' }, TODAY);
  assert.equal(free[0].event.id, 'east-food');
  assert.ok(free[0].reasons.some(reason => reason.en === 'Free'));
  const food = scoreEvents(items, { companions: 'date', vibe: 'food', region: 'sf' }, TODAY);
  assert.equal(food[0].event.id, 'occ-inside');
});

test('recommendations relax filters step by step and say what was relaxed', () => {
  const strict = recommendEvents(catalog, { companions: 'friends', vibe: 'any', region: 'any' }, TODAY);
  assert.deepEqual(strict.relaxed, []);
  assert.ok(strict.events.length >= 3 && strict.events.length <= 5);

  const narrow = recommendEvents(catalog, { companions: 'kids', vibe: 'food', region: 'east-bay' }, TODAY);
  assert.equal(narrow.strictCount, 0);
  assert.ok(narrow.events.length >= 1);
  assert.ok(!narrow.relaxed.includes('companions'), 'with kids is never relaxed');
  assert.ok(narrow.relaxed.includes('vibe') && narrow.relaxed.includes('region'));
  for (const item of narrow.events) assert.ok(item.event.category === 'family' || (item.event.audience ?? []).some(a => /亲子|儿童|家庭/.test(a)), item.event.id);
  assert.ok(narrow.note && /吃喝/.test(narrow.note.zh), 'the note says what was swapped');
  for (const item of narrow.events) assert.ok(!['expired', 'next-month', 'occ-past-only'].includes(item.event.id));

  const southBay = recommendEvents(catalog, { companions: 'kids', vibe: 'any', region: 'south-bay' }, TODAY);
  assert.ok(southBay.relaxed.includes('region') || southBay.relaxed.includes('window'));

  const empty = recommendEvents({ events: [], places: [], guides: [] }, { companions: null, vibe: null, region: null }, TODAY);
  assert.deepEqual(empty.events, []);
  assert.deepEqual(recommendEvents(null, { companions: null, vibe: null, region: null }, TODAY).events, []);
});

test('places by region, guide titles and nearby events', () => {
  const groups = placesByRegion(catalog);
  assert.deepEqual(groups.map(group => group.region), ['sf', 'east-bay', 'north-bay']);
  assert.equal(guideTitle(catalog, 'sf-pier-39'), 'PIER 39 攻略');
  assert.equal(guideTitle(catalog, 'nope'), undefined);
  const near = eventsNear(catalog, { lat: 37.8087, lng: -122.4098 }, TODAY).map(item => item.event.id);
  assert.deepEqual(near, ['pier-free']);
});

test('catalog sanitizing drops malformed rows; loading caches and survives errors', async () => {
  const clean = sanitizeCatalog({ events: [null, { id: 'x' }, { id: 'ok', title: 'ok', startDate: '2026-09-30' }, { id: 'bad', title: 'b', startDate: '2026-02-30' }], places: [{ id: 'p', title: 'P' }, 7], guides: 'nope' });
  assert.deepEqual(clean.events.map(event => event.id), ['ok']);
  assert.equal(clean.places.length, 1);
  assert.deepEqual(clean.guides, []);

  setCatalogForTests(null);
  game.set(initialGameState());
  const failing = (() => Promise.reject(new Error('offline'))) as unknown as typeof fetch;
  assert.equal(await loadCatalog(failing), null);
  assert.equal(game.get().catalogStatus, 'error');
  let calls = 0;
  const ok = (() => { calls++; return Promise.resolve(new Response(JSON.stringify(catalog))); }) as unknown as typeof fetch;
  const [a, b] = await Promise.all([loadCatalog(ok), loadCatalog(ok)]);
  assert.equal(calls, 1);
  assert.equal(a, b);
  assert.equal(getCatalog()?.events.length, catalog.events.length);
  assert.equal(game.get().catalogStatus, 'ready');
  await loadCatalog(ok);
  assert.equal(calls, 1, 'cached');
  setCatalogForTests(null);
});

test('planUrl only emits ids that exist in the catalog, capped at 3, next Saturday by default', () => {
  const url = new URL(planUrl({ stops: [{ kind: 'place', id: 'pier39' }, { kind: 'place', id: 'invented' }, { kind: 'event', id: 'pier-free' }, { kind: 'event', id: 'ghost' }, { kind: 'place', id: 'pier39' }] }, catalog, 'zh-Hans', TODAY), 'https://x.test');
  assert.equal(url.pathname, '/plan');
  assert.equal(url.searchParams.get('date'), '2026-09-26');
  assert.equal(url.searchParams.get('stops'), 'place:pier39,event:pier-free');
  assert.equal(url.searchParams.get('lang'), null);
  const many = validPlanStops([{ kind: 'place', id: 'pier39' }, { kind: 'place', id: 'alcatraz' }, { kind: 'place', id: 'berkeley' }, { kind: 'place', id: 'muir-woods' }], catalog);
  assert.equal(many.length, 3);
  assert.deepEqual(validPlanStops([{ kind: 'place', id: 'pier39' }], null), []);
  const en = new URL(planUrl({ date: '2026-10-03', stops: [{ kind: 'guide' as never, id: 'x' }] }, catalog, 'en', TODAY), 'https://x.test');
  assert.equal(en.searchParams.get('date'), '2026-10-03');
  assert.equal(en.searchParams.get('stops'), null);
  assert.equal(en.searchParams.get('lang'), 'en');
  const badDate = new URL(planUrl({ date: '2026-02-30', stops: [] }, catalog, 'zh-Hant', TODAY), 'https://x.test');
  assert.equal(badDate.searchParams.get('date'), '2026-09-26');
  assert.equal(badDate.searchParams.get('lang'), 'zh-Hant');
});

test('site links keep the reader language; external links are safe', () => {
  assert.equal(guideUrl('a b', 'zh-Hans'), '/guides/a%20b');
  assert.equal(guideUrl('pier', 'en'), '/guides/pier?lang=en');
  assert.equal(eventUrl('e1', 'zh-Hant'), '/events/e1?lang=zh-Hant');
  assert.equal(withLang('/plan?date=2026-09-26#x', 'en'), '/plan?date=2026-09-26&lang=en#x');
  assert.equal(mapsUrl(37.8087, -122.4098, 'Pier 39'), 'https://www.google.com/maps/search/?api=1&query=37.80870%2C-122.40980');
  assert.ok(mapsUrl(undefined, undefined, 'Pier 39').endsWith('query=Pier%2039'));
  assert.equal(safeHref('javascript:alert(1)'), undefined);
  assert.equal(safeHref('//evil.test'), undefined);
  assert.equal(safeHref('/guides/x'), '/guides/x');
  assert.equal(safeHref('https://www.ferrybuildingmarketplace.com/'), 'https://www.ferrybuildingmarketplace.com/');
});

function fakeStorage() {
  const data = new Map<string, string>();
  return { data, getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); }, removeItem: (key: string) => { data.delete(key); } };
}

test('wishlist persists to localStorage and syncs the store', () => {
  const store = fakeStorage();
  setStorageForTests(store);
  game.set(initialGameState());
  assert.equal(wishlist.add({ kind: 'poi', id: 'ferry-building', title: '渡轮大厦' }), true);
  assert.equal(wishlist.add({ kind: 'poi', id: 'ferry-building', title: '渡轮大厦' }), false, 'no duplicates');
  wishlist.add({ kind: 'event', id: 'pier-free', title: 'Pier free' });
  assert.equal(game.get().wishlist.length, 2);
  assert.ok(wishlist.has('event', 'pier-free'));
  const saved = JSON.parse(store.data.get(WISHLIST_KEY)!);
  assert.equal(saved.items.length, 2);
  assert.equal(wishlist.toggle({ kind: 'event', id: 'pier-free', title: 'Pier free' }), false);
  assert.equal(readWishlist().length, 1);
  store.data.set(WISHLIST_KEY, JSON.stringify({ v: 1, items: [{ kind: 'hack', id: 'x', title: 't' }, { kind: 'place', id: 'pier39', title: 'P' }, { kind: 'place', id: 'pier39', title: 'P' }] }));
  assert.deepEqual(readWishlist().map(item => item.id), ['pier39']);
  store.data.set(WISHLIST_KEY, '{not json');
  assert.deepEqual(readWishlist(), []);
  setStorageForTests(null);
  assert.deepEqual(readWishlist(), [], 'no storage available is fine');
  assert.equal(wishlist.add({ kind: 'place', id: 'alcatraz', title: 'A' }), true, 'still works in memory');
  setStorageForTests(undefined);
});

test('progress hydrates the store, respects URL-locked settings and saves changes', async () => {
  const store = fakeStorage();
  setStorageForTests(store);
  game.set(initialGameState());
  store.data.set(PROGRESS_KEY, JSON.stringify({ v: 1, postcards: ['postcard-a', 5], goalsDone: ['taste'], tour: { stop: 2, completed: ['a', 'b'] }, viewpointUnlocked: true, settings: { sound: false, quality: 'low', cameraDistance: 999 } }));
  const stop = initPersistence({ lockedSettings: ['quality'] });
  const state = game.get();
  assert.deepEqual(state.postcards, ['postcard-a']);
  assert.equal(state.tour.stop, 2);
  assert.equal(state.viewpointUnlocked, true);
  assert.equal(state.settings.sound, false);
  assert.equal(state.settings.quality, 'high', 'URL-locked quality is kept');
  assert.equal(state.settings.cameraDistance, 15, 'out-of-range values are ignored');
  game.set(s => ({ postcards: [...s.postcards, 'postcard-b'] }));
  await new Promise(resolve => setTimeout(resolve, 300));
  assert.deepEqual(readProgress()?.postcards, ['postcard-a', 'postcard-b']);
  stop();
  setStorageForTests(undefined);
});

test('URL-forced and automatic settings apply to this visit only; explicit choices are saved', async () => {
  const store = fakeStorage();
  setStorageForTests(store);
  game.set(initialGameState());
  store.data.set(PROGRESS_KEY, JSON.stringify({ v: 1, postcards: [], goalsDone: [], tour: { stop: 0, completed: [] }, viewpointUnlocked: false, settings: { timeOfDay: 'auto', quality: 'high' } }));
  const stop = initPersistence({ lockedSettings: ['timeOfDay'] });
  const wait = () => new Promise(resolve => setTimeout(resolve, 300));
  // ?time=night (URL) and an adaptive-quality step down
  game.set(s => ({ settings: { ...s.settings, timeOfDay: 'night' } }));
  setSessionSettings({ quality: 'mid' });
  assert.equal(game.get().settings.quality, 'mid');
  await wait();
  assert.equal(readProgress()?.settings.timeOfDay, 'auto', 'a QA link does not change the saved time of day');
  assert.equal(readProgress()?.settings.quality, 'high', 'an automatic downgrade is not saved');
  // the player picks a quality in Settings
  keepSetting('quality');
  game.set(s => ({ settings: { ...s.settings, quality: 'low' } }));
  await wait();
  assert.equal(readProgress()?.settings.quality, 'low');
  stop();
  setStorageForTests(undefined);
});

// ---------------------------------------------------------------------------
// Polish round 1 · F4: real catalog rows (read-only) — adult-only and professional events
// ---------------------------------------------------------------------------

import { readFileSync } from 'node:fs';
import { categoryLabel, isAdultOnly, isProfessional, kidsAudience, relaxNote } from '../src/opus-bay/data/catalog';

const REAL = sanitizeCatalog(JSON.parse(readFileSync(new URL('../public/planner-catalog.json', import.meta.url), 'utf8')));
const REAL_TODAY = '2026-09-25';
const realEvent = (id: string) => { const event = REAL.events.find(item => item.id === id); assert.ok(event, `catalog has ${id}`); return event!; };
const ADULT_IDS = ['portola-2026', 'tiburon-wine-festival-2026', 'napa-harvest-after-dark-2026'];
const TECH_IDS = ['ai-conference-sf-2026', 'llmday-san-francisco-q4-2026', 'runtime-modal-sf-2026'];

test('F4: 21+ rows are adult-only and never kid-friendly; tech rows are professional and labelled 科技', () => {
  for (const id of ADULT_IDS) {
    const event = realEvent(id);
    assert.ok(isAdultOnly(event), `${id} is adult-only`);
    assert.ok(!kidsAudience(event), `${id}: "21 岁及以上" is not a kids audience`);
  }
  for (const id of TECH_IDS) {
    const event = realEvent(id);
    assert.ok(isProfessional(event), `${id} is professional`);
    assert.equal(categoryLabel(event)?.zh, '科技');
  }
  assert.ok(!isProfessional(realEvent('hardly-strictly-bluegrass-2026')));
  assert.ok(!isAdultOnly(realEvent('sf-halloween-hoopla-2026')));
  assert.ok(kidsAudience(realEvent('sf-halloween-hoopla-2026')), '"10 岁以下儿童" is a kids audience');
  assert.equal(categoryLabel(realEvent('hardly-strictly-bluegrass-2026'))?.zh, '文化');
});

test('F4: kids + culture + SF never shows Portola; relaxing never brings an adult-only event back', () => {
  const kids = recommendEvents(REAL, { companions: 'kids', vibe: 'culture', region: 'sf' }, REAL_TODAY);
  assert.ok(kids.events.length > 0);
  for (const item of kids.events) {
    assert.ok(!isAdultOnly(item.event), item.event.id);
    assert.ok(!isProfessional(item.event), item.event.id);
  }
  assert.ok(!kids.events.some(item => item.event.id === 'portola-2026'));
});

test('F4: friends + food + SF never falls back to tech conferences; the note says what was swapped', () => {
  const food = recommendEvents(REAL, { companions: 'friends', vibe: 'food', region: 'sf' }, REAL_TODAY);
  for (const item of food.events) assert.ok(!isProfessional(item.event), item.event.id);
  if (food.relaxed.includes('vibe')) assert.ok(food.note && /吃喝/.test(food.note.zh), JSON.stringify(food.note));
  const date = recommendEvents(REAL, { companions: 'date', vibe: 'free', region: 'sf' }, REAL_TODAY);
  for (const item of date.events) assert.ok(!isProfessional(item.event), `${item.event.id} is not a date pick`);
  // solo + culture is the one combination that may show professional events
  const solo = recommendEvents(REAL, { companions: 'solo', vibe: 'culture', region: 'sf' }, REAL_TODAY, { max: 20 });
  assert.ok(solo.events.some(item => isProfessional(item.event)), 'solo + culture can include tech talks');
  assert.equal(relaxNote({ events: [], relaxed: ['vibe'], windowDays: 7 }, { companions: null, vibe: 'food', region: null }), null);
});

test('F4: sweep all 120 answer combinations — no adult-only for kids, no professional tagged 适合约会 / 适合带娃', () => {
  const companions = ['solo', 'friends', 'date', 'kids'];
  const vibes = ['free', 'food', 'outdoors', 'culture', 'any'];
  const regions = ['sf', 'east-bay', 'peninsula', 'south-bay', 'north-bay', 'any'];
  let combos = 0;
  for (const c of companions) for (const v of vibes) for (const r of regions) {
    combos++;
    const result = recommendEvents(REAL, { companions: c, vibe: v, region: r }, REAL_TODAY);
    for (const item of result.events) {
      if (c === 'kids') assert.ok(!isAdultOnly(item.event), `${c}/${v}/${r}: ${item.event.id} is adult-only`);
      if (isProfessional(item.event)) {
        assert.ok(c === 'solo' && v === 'culture', `${c}/${v}/${r}: professional ${item.event.id}`);
        assert.ok(!item.reasons.some(reason => reason.zh === '适合约会' || reason.zh === '适合带娃'), `${item.event.id} tagged ${item.reasons.map(x => x.zh)}`);
      }
      if (item.reasons.some(reason => reason.zh === '适合带娃')) assert.ok(kidsAudience(item.event), `${item.event.id} tagged kids without a kids audience`);
      if (item.reasons.some(reason => reason.zh === '适合约会')) assert.ok((item.event.audience ?? []).some(a => /约会|情侣/.test(a)), `${item.event.id} tagged date without a date audience`);
    }
    if (result.relaxed.length) assert.ok(result.note, `${c}/${v}/${r}: relaxed without a note`);
  }
  assert.equal(combos, 120);
});

test('F4: 附近这周 keeps to ~1 km, drops adult-only / professional events and says how far', () => {
  const ferry = { lat: 37.79555, lng: -122.39347 };
  const near = eventsNear(REAL, ferry, REAL_TODAY);
  for (const item of near) {
    assert.ok(item.km <= 1.0, `${item.event.id} ${item.km}`);
    assert.ok(!isAdultOnly(item.event) && !isProfessional(item.event), item.event.id);
    assert.ok(item.walkMin >= 5);
  }
  assert.ok(!near.some(item => item.event.id === 'llmday-san-francisco-q4-2026'));
});

// ---------------------------------------------------------------------------
// Polish round 1 · F5 / F6: honest hand-off links
// ---------------------------------------------------------------------------

import { pickPlanDate, planStopTitles, walkingRouteUrl } from '../src/opus-bay/data/links';

test('F5: walkingRouteUrl builds a Google Maps walking-directions URL through every stop (≤ 9 waypoints)', () => {
  const pts = Array.from({ length: 7 }, (_, i) => ({ lat: 37.795 + i * 0.002, lng: -122.393 - i * 0.003 }));
  const url = new URL(walkingRouteUrl(pts)!);
  assert.equal(url.origin + url.pathname, 'https://www.google.com/maps/dir/');
  assert.equal(url.searchParams.get('api'), '1');
  assert.equal(url.searchParams.get('travelmode'), 'walking');
  assert.equal(url.searchParams.get('origin'), '37.79500,-122.39300');
  assert.equal(url.searchParams.get('destination'), '37.80700,-122.41100');
  assert.equal(url.searchParams.get('waypoints')!.split('|').length, 5, '7 stops = origin + 5 waypoints + destination');
  const many = new URL(walkingRouteUrl(Array.from({ length: 15 }, (_, i) => ({ lat: 37.79 + i * 0.001, lng: -122.39 })))!);
  assert.equal(many.searchParams.get('waypoints')!.split('|').length, 9, 'Google allows 9 waypoints');
  const one = new URL(walkingRouteUrl([{ lat: 37.8, lng: -122.4 }])!);
  assert.equal(one.searchParams.get('origin'), null);
  assert.equal(one.searchParams.get('destination'), '37.80000,-122.40000');
  assert.equal(walkingRouteUrl([]), null);
  assert.equal(walkingRouteUrl([{ lat: NaN, lng: 1 }]), null);
});

test('F6: pickPlanDate chooses a day every event is on; otherwise keeps the soonest day and lists the rest', () => {
  // Hardly Strictly Bluegrass (Oct 2–4) must not be planned on Saturday Sep 26
  const hsb = pickPlanDate([{ kind: 'event', id: 'hardly-strictly-bluegrass-2026' }, { kind: 'place', id: 'pier39' }], REAL, REAL_TODAY);
  assert.equal(hsb.date, '2026-10-02');
  assert.deepEqual(hsb.stops, [{ kind: 'event', id: 'hardly-strictly-bluegrass-2026' }, { kind: 'place', id: 'pier39' }]);
  const url = new URL(planUrl({ stops: hsb.stops }, REAL, 'zh-Hans', REAL_TODAY), 'https://x.test');
  assert.equal(url.searchParams.get('date'), '2026-10-02', 'planUrl uses the event day');
  assert.equal(url.hash, '#outing-plan', 'lands on the handed-off stops');
  // two events on different days: soonest kept, the other listed with its own date
  const split = pickPlanDate([{ kind: 'event', id: 'hardly-strictly-bluegrass-2026' }, { kind: 'event', id: 'portola-2026' }], REAL, REAL_TODAY);
  assert.equal(split.date, '2026-09-26');
  assert.deepEqual(split.stops.map(stop => stop.id), ['portola-2026']);
  assert.deepEqual(split.rest, [{ id: 'hardly-strictly-bluegrass-2026', date: '2026-10-02' }]);
  // ended events are dropped from the stops
  const ended = pickPlanDate([{ kind: 'event', id: 'portola-2026' }, { kind: 'place', id: 'pier39' }], REAL, '2026-09-30');
  assert.deepEqual(ended.stops, [{ kind: 'place', id: 'pier39' }]);
  assert.deepEqual(ended.rest, [{ id: 'portola-2026', date: null }]);
  assert.equal(ended.date, '2026-10-03', 'places only → the coming Saturday');
  assert.deepEqual(planStopTitles([{ kind: 'place', id: 'pier39' }], REAL), [REAL.places.find(place => place.id === 'pier39')!.title]);
});

import { nextShowing, labelEndHour } from '../src/opus-bay/data/catalog';

test('F6: after 18:00 Bay time "today" is honest — finished events move on or drop out, running ones say 今晚', () => {
  const evening = new Date('2026-09-27T04:52:00Z'); // Sat Sep 26, 21:52 in San Francisco
  const day = '2026-09-26';
  const items = upcomingEvents(REAL, day, 7, evening);
  const byId = new Map(items.map(item => [item.event.id, item]));
  assert.ok(!byId.has('presidio-chuseok-festival-2026'), 'one-day 11:00–16:00 event is over tonight');
  assert.ok(!byId.has('cupertino-fall-bike-fest-2026'));
  assert.equal(byId.get('pacific-coast-fog-fest-2026')?.nextDate, '2026-09-27', 'two-day festival moves on to Sunday');
  assert.equal(byId.get('portola-2026')?.nextDate, '2026-09-27');
  assert.equal(labelEndHour(realEvent('cupertino-fall-bike-fest-2026')), 13);
  assert.equal(labelEndHour(realEvent('clayton-oktoberfest-2026')), 20);
  // a Friday 17:00–22:00 session at 19:30 is still on tonight
  const friday = new Date('2026-10-03T02:30:00Z'); // Fri Oct 2, 19:30
  const tonight = upcomingEvents(REAL, '2026-10-02', 7, friday).find(item => item.event.id === 'san-jose-first-friday-ballet-2026');
  assert.ok(tonight?.tonight, '18:00–21:00 at 19:30 is tonight');
  const picks = recommendEvents(REAL, { companions: 'friends', vibe: 'any', region: 'any' }, '2026-10-02', { now: friday });
  assert.ok(!picks.events[0]?.tonight, 'a tonight-only event never scores best');
  assert.equal(nextShowing(realEvent('presidio-chuseok-festival-2026'), evening), null);
  assert.deepEqual(nextShowing(realEvent('hardly-strictly-bluegrass-2026'), evening), { date: '2026-10-02', tonight: false });
});
