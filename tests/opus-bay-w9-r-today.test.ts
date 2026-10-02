import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

/**
 * Wave 9 · lane R (W9-R1): the two contract APIs of sf-w9-lead.md §4 — `todayHeadline(now, locale)` (one real-SF line at
 * a time: a calendar day on now, the sunset within 30 min → Twin Peaks by pelican, a calendar day later today, today's
 * dated free offer, today's event in the world, a calendar day in the next 3 days; null otherwise) and the travel
 * profile `realsf/prefs.ts` (its own key, ?save=off honoured, malformed values dropped, the profile derived).
 */

const g = globalThis as unknown as Record<string, unknown>;
g.location = { search: '?world=city&save=off', href: 'http://localhost/opus-bay?world=city&save=off', pathname: '/opus-bay', hostname: 'localhost' };
g.window ??= globalThis;

const { parseBayDate } = await import('../src/opus-bay/game/bayNow');
const { sanitizeCatalog } = await import('../src/opus-bay/data/catalog');
const { parseLive } = await import('../src/opus-bay/realsf/live');
const { todayHeadline, SUNSET_SOON_MIN } = await import('../src/opus-bay/realsf/todayLine');
const { sunTimes } = await import('../src/opus-bay/realsf/sun');
const prefs = await import('../src/opus-bay/realsf/prefs');

const bay = (spec: string) => { const d = parseBayDate(spec); assert.ok(d, spec); return d!; };
const CATALOG = sanitizeCatalog(JSON.parse(fs.readFileSync(path.resolve('public/planner-catalog.json'), 'utf8')));
const OFFERS = parseLive(JSON.parse(fs.readFileSync(path.resolve('public/opus-bay/sf/v1/live.json'), 'utf8')));
const NONE = { catalog: null, offers: null };
const ALL = { catalog: CATALOG, offers: OFFERS };

test('W9-R1 todayHeadline: Fleet Week — the parade at 11, the air show 12–16 with the Blue Angels “usually around 3”, Marina Green to go to', () => {
  const morning = todayHeadline(bay('2026-10-09T09:00'), 'zh', NONE);
  assert.equal(morning?.id, 'cal:fleet-week-parade-of-ships-2026');
  assert.equal(morning?.zh, '今天 11:00 舰队周 · 舰船巡游 · 码头绿地看台');
  assert.equal(morning?.en, 'Today at 11:00: Fleet Week · Parade of Ships at the Marina Green reviewing stand');
  assert.deepEqual(morning?.action && morning.action.kind === 'go' ? morning.action.placeId : null, 'marina-green');
  const parade = todayHeadline(bay('2026-10-09T11:20'), 'zh', NONE);
  assert.equal(parade?.zh, '舰队周 · 舰船巡游正在进行 · 码头绿地看台');
  const show = todayHeadline(bay('2026-10-09T13:00'), 'zh', NONE);
  assert.equal(show?.id, 'cal:fleet-week-blue-angels-2026');
  assert.equal(show?.zh, '舰队周飞行表演正在进行 · 蓝天使通常 3 点左右');
  assert.match(show!.en, /usually fly around 3 pm/);
  // the other two show days: before noon the show's hours, during it the line above
  assert.equal(todayHeadline(bay('2026-10-10T10:00'), 'zh', NONE)?.zh, '今天 12:00–16:00 舰队周飞行表演 · 码头绿地');
  assert.equal(todayHeadline(bay('2026-10-11T15:59'), 'zh', NONE)?.id, 'cal:fleet-week-blue-angels-2026');
  assert.notEqual(todayHeadline(bay('2026-10-11T16:00'), 'zh', NONE)?.id, 'cal:fleet-week-blue-angels-2026', 'over at 16:00');
  // two days before: the 3-day look-ahead names it
  const ahead = todayHeadline(bay('2026-10-07T09:00'), 'zh', NONE);
  assert.equal(ahead?.zh, '10月9日 舰队周 · 舰船巡游 · 码头绿地看台');
  assert.equal(ahead?.en, 'Oct 9: Fleet Week · Parade of Ships at the Marina Green reviewing stand');
});

test('W9-R1 todayHeadline: the sunset within 30 minutes → 「日落还有 n 分钟 · 飞去双峰」, by pelican; never after sunset', () => {
  const sunset = sunTimes(bay('2026-10-14T12:00')).sunset.getTime();
  const at = (minBefore: number) => todayHeadline(new Date(sunset - minBefore * 60_000), 'zh', NONE);
  const h = at(12);
  assert.equal(h?.zh, '日落还有 12 分钟 · 飞去双峰');
  assert.equal(h?.en, 'Sunset in 12 min · fly to Twin Peaks');
  assert.ok(h?.action?.kind === 'go' && h.action.placeId === 'twin-peaks' && h.action.prefer === 'fly');
  assert.equal(at(SUNSET_SOON_MIN)?.id, 'sunset');
  assert.notEqual(at(SUNSET_SOON_MIN + 1)?.id, 'sunset');
  assert.notEqual(at(-1)?.id, 'sunset', 'after sunset: no sunset line');
});

test('W9-R1 todayHeadline: today’s dated free offer (the zoo’s resident day on 7 Oct, Asian Art on 4 Oct) with its hours and who; an every-day offer is not news', () => {
  assert.ok(OFFERS && OFFERS.length >= 10, 'live.json parses');
  const zoo = todayHeadline(bay('2026-10-07T09:00'), 'zh', { catalog: null, offers: OFFERS });
  assert.equal(zoo?.id, 'free:sf-zoo-resident-free-oct7-2026');
  assert.match(zoo!.zh, /^今天免费：.*10:00–16:00 · SF 居民/);
  assert.match(zoo!.en, /^Free today: .*10:00–16:00/);
  assert.ok(zoo?.action?.kind === 'go' && zoo.action.placeId === 'sf-zoo');
  // over at 16:00: the zoo leaves, the look-ahead (Fleet Week on the 9th) speaks
  assert.notEqual(todayHeadline(bay('2026-10-07T16:05'), 'zh', { catalog: null, offers: OFFERS })?.id, 'free:sf-zoo-resident-free-oct7-2026');
  assert.equal(todayHeadline(bay('2026-10-04T10:30'), 'zh', { catalog: null, offers: OFFERS })?.id, 'free:asian-art-free-oct4');
  // 2 Oct (a Friday): only every-day offers (the tea garden's free hour, the cable car museum …) — no free line
  const fri = todayHeadline(bay('2026-10-02T09:30'), 'zh', { catalog: null, offers: OFFERS });
  assert.ok(!fri || !fri.id.startsWith('free:'), fri?.id);
});

test('W9-R1 todayHeadline: an event in the world today when nothing else; null on a quiet day; every line short enough for one strip', () => {
  const hsb = todayHeadline(bay('2026-10-03T09:00'), 'zh', { catalog: CATALOG, offers: null });
  assert.ok(hsb && hsb.id.startsWith('event:'), hsb?.id);
  assert.equal(hsb?.action?.kind, 'event');
  assert.equal(todayHeadline(bay('2026-12-15T10:00'), 'zh', NONE), null, 'a quiet December morning: no line');
  // one strip: every headline of the next two months at three hours of the day stays ≤ 32 zh characters
  for (let d = 0; d < 61; d++) {
    const day = new Date(Date.UTC(2026, 9, 1 + d)).toISOString().slice(0, 10);
    for (const hh of ['08:00', '12:30', '17:30']) {
      const h = todayHeadline(bay(`${day}T${hh}`), 'zh', ALL);
      if (!h) continue;
      assert.ok([...h.zh].length <= 32, `${day} ${hh}: ${h.zh} (${[...h.zh].length})`);
      assert.ok(h.en.length <= 90, `${day} ${hh}: ${h.en}`);
      assert.doesNotMatch(h.en, /[一-鿿]/, `${day} ${hh}: English has no Chinese: ${h.en}`);
    }
  }
});

test('W9-R1 prefs: its own key, the profile from the companions, malformed values dropped, ?save=off / no storage keeps them in memory', () => {
  const mem = new Map<string, string>();
  const store = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => { mem.set(k, v); } };
  prefs.__resetPrefsForTests(store);
  assert.deepEqual(prefs.getPrefs(), { companions: null, vibe: null, region: null, profile: null, at: null });
  let calls = 0;
  const off = prefs.subscribePrefs(() => { calls++; });
  const p = prefs.setPrefs({ companions: 'kids', vibe: 'outdoors', region: 'sf', at: '2026-10-01' });
  assert.equal(p.profile, 'kids');
  assert.equal(calls, 1);
  assert.equal(prefs.getPrefs(), p, 'the same object until it changes (useSyncExternalStore)');
  assert.equal(prefs.setPrefs({ companions: 'kids' }), p, 'no change → no write, no notify');
  assert.equal(calls, 1);
  assert.deepEqual(JSON.parse(mem.get(prefs.PREFS_KEY)!), { companions: 'kids', vibe: 'outdoors', region: 'sf', at: '2026-10-01' }, 'no profile, nothing else stored');
  // a reload reads it back
  prefs.__resetPrefsForTests(store);
  assert.equal(prefs.getPrefs().profile, 'kids');
  assert.equal(prefs.setPrefs({ companions: 'seniors' }).profile, 'seniors');
  assert.equal(prefs.setPrefs({ companions: 'date' }).profile, 'pair');
  assert.equal(prefs.setPrefs({ companions: 'solo' }).profile, 'solo');
  assert.equal(prefs.setPrefs({ companions: 'friends' }).profile, null);
  // untrusted input
  assert.equal(prefs.setPrefs({ companions: '<script>' }).companions, 'friends', 'a malformed value is ignored');
  mem.set(prefs.PREFS_KEY, '{"companions":"kids","vibe":42,"region":"sf-north","at":"yesterday","x":"y"}');
  prefs.__resetPrefsForTests(store);
  assert.deepEqual(prefs.getPrefs(), { companions: 'kids', vibe: null, region: 'sf-north', profile: 'kids', at: null });
  mem.set(prefs.PREFS_KEY, 'not json');
  prefs.__resetPrefsForTests(store);
  assert.equal(prefs.getPrefs().companions, null);
  off();
  // no storage (?save=off, blocked): memory only, never throws
  prefs.__resetPrefsForTests(null);
  assert.equal(prefs.setPrefs({ companions: 'kids' }).profile, 'kids');
  assert.equal(prefs.getPrefs().profile, 'kids');
  const throwing = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
  prefs.__resetPrefsForTests(throwing);
  assert.equal(prefs.getPrefs().companions, null);
  assert.equal(prefs.setPrefs({ companions: 'seniors' }).profile, 'seniors');
  prefs.__resetPrefsForTests(null);
});
