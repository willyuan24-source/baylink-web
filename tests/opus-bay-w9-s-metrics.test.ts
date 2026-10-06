import assert from 'node:assert/strict';
import test from 'node:test';

// Wave 9 · lane S (R§5 #9, review §9): the metrics' fixed words — the contract `track()`, the counter names the API
// would accept (docs/opus-bay/w9-backend-metrics.patch), what a link opened from the game is, `from=opus-bay` on the
// site's links only, the cold-start and visit buckets.

const { onEvent } = await import('../src/opus-bay/core/events');
const { track } = await import('../src/opus-bay/game/metrics');
const M = await import('../src/opus-bay/game/metricNames');

const ORIGIN = 'https://www.baylink.us';

test('track() is an emit of { type: metric } on the bus and never throws', () => {
  const seen: unknown[] = [];
  const off = onEvent(e => { if (e.type === 'metric') seen.push(e); });
  track('real', 'ics');
  track('tour', 'ch3');
  off();
  const offBad = onEvent(() => { throw new Error('a listener'); });
  assert.doesNotThrow(() => track('share', 'card'));
  offBad();
  assert.deepEqual(seen, [{ type: 'metric', what: 'real', bucket: 'ics' }, { type: 'metric', what: 'tour', bucket: 'ch3' }]);
});

test('OPUS_EVENTS: 39 unique lower-case names, all opus_*, the review §9 funnel; metricName maps steps and drops the rest', () => {
  assert.equal(new Set(M.OPUS_EVENTS).size, M.OPUS_EVENTS.length);
  assert.equal(M.OPUS_EVENTS.length, 39);
  for (const name of M.OPUS_EVENTS) assert.match(name, /^opus_[a-z0-9_]{2,40}$/);
  for (const s of ['home', 'nav', 'play', 'photo', 'family', 'share', 'guide', 'promo', 'direct']) assert.ok(M.isOpusEvent(`opus_start_${s}`), s);
  for (const n of ['opus_title', 'opus_cold_start_lt10', 'opus_cold_start_10to30', 'opus_cold_start_gt30', 'opus_mode_tour', 'opus_mode_week', 'opus_mode_free', 'opus_mode_local', 'opus_mode_resume', 'opus_first_card', 'opus_share_photo', 'opus_share_card', 'opus_visit_new', 'opus_returning_1d', 'opus_returning_7d', 'opus_returning_30d', 'opus_tour_ch1', 'opus_tour_ch5', 'opus_tour_done']) assert.ok(M.isOpusEvent(n), n);
  assert.equal(M.metricName('real', 'ics'), 'opus_real_action_ics');
  assert.equal(M.metricName('share', 'card'), 'opus_share_card');
  assert.equal(M.metricName('tour', 'ch2'), 'opus_tour_ch2');
  assert.equal(M.metricName('card', undefined), 'opus_first_card');
  // ids, free text and unknown words never become a name
  for (const [w, b] of [['real', 'golden-gate-bridge'], ['real', undefined], ['share', 'Hi Mom'], ['tour', 'ch6'], ['nope', 'ics'], ['real', 'ics?x=1']] as const) assert.equal(M.metricName(w, b), null, `${w} ${b}`);
  assert.equal(M.OPUS_METRICS_LIVE, true, 'the production API now accepts the exact 39 allowlisted names');
});

test('coldBucket: < 10 s, 10–30 s, > 30 s', () => {
  assert.equal(M.coldBucket(0), 'lt10');
  assert.equal(M.coldBucket(9_999), 'lt10');
  assert.equal(M.coldBucket(10_000), '10to30');
  assert.equal(M.coldBucket(30_000), '10to30');
  assert.equal(M.coldBucket(30_001), 'gt30');
});

test('visitBucket: new, yesterday = 1d, 2–7 days = 7d, 8–30 = 30d; the same day and > 30 days count as neither', () => {
  assert.equal(M.visitBucket(null, '2026-10-02'), 'new');
  assert.equal(M.visitBucket('garbage', '2026-10-02'), 'new');
  assert.equal(M.visitBucket('2026-10-02', '2026-10-02'), null);
  assert.equal(M.visitBucket('2026-10-01', '2026-10-02'), '1d');
  assert.equal(M.visitBucket('2026-10-31', '2026-11-01'), '1d', 'across a month');
  assert.equal(M.visitBucket('2026-11-01', '2026-11-02'), '1d', 'across the DST change (1 Nov 2026)');
  assert.equal(M.visitBucket('2026-09-25', '2026-10-02'), '7d');
  assert.equal(M.visitBucket('2026-09-24', '2026-10-02'), '30d');
  assert.equal(M.visitBucket('2026-09-02', '2026-10-02'), '30d');
  assert.equal(M.visitBucket('2026-09-01', '2026-10-02'), null);
  assert.equal(M.visitBucket('2026-10-05', '2026-10-02'), null, 'a clock moved back');
});

test('linkAction: the site\'s plan / event / guide / offer pages, Maps, official pages; credits and the home are not actions', () => {
  const cases: [string, string | null, string?][] = [
    ['/plan?date=2026-10-03&stops=event:x', 'plan'],
    ['https://www.baylink.us/plan', 'plan'],
    ['/my-week?lang=en', 'plan'],
    ['/events/fleet-week-2026?lang=en', 'event'],
    ['/calendar?date=2026-10-03', 'event'],
    ['/guides/golden-gate-park', 'guide'],
    ['/guides', 'guide'],
    ['/this-month', 'guide'],
    ['/offers/sf-zoo-resident-free-day', 'offer'],
    ['https://www.google.com/maps/search/?api=1&query=37.8,-122.4', 'maps'],
    ['https://www.google.com/maps/dir/?api=1&destination=37.8,-122.4', 'maps'],
    ['https://maps.apple.com/?q=x', 'maps'],
    ['https://www.sfmta.com/fares/free-muni-seniors-ages-65', 'official'],
    ['https://www.nps.gov/goga/planyourvisit/hours.htm', 'official'],
    ['https://tidesandcurrents.noaa.gov/', 'official'],
    ['https://commons.wikimedia.org/wiki/File:x.jpg', null],
    ['https://creativecommons.org/licenses/by-sa/4.0/', null],
    ['https://www.openstreetmap.org/copyright', null],
    ['/', null],
    ['/?lang=en', null],
    ['/opus-bay?at=x', null],
    ['javascript:alert(1)', null],
    ['blob:https://www.baylink.us/abc', 'ics', 'baylink-x.ics'],
  ];
  for (const [href, want, dl] of cases) assert.equal(M.linkAction(href, ORIGIN, dl), want, href);
  for (const prefix of ['/en', '/zh-Hant']) for (const [path, want] of [
    ['/plan?date=2026-10-03', 'plan'], ['/my-week', 'plan'], ['/events/fleet-week-2026', 'event'],
    ['/calendar', 'event'], ['/guides', 'guide'], ['/guides/golden-gate-park', 'guide'],
    ['/this-month', 'guide'], ['/this-week', 'guide'], ['/offers/sf-zoo-resident-free-day', 'offer'], ['/opus-bay?at=x', null], ['/play', null],
  ] as const) assert.equal(M.linkAction(prefix + path, ORIGIN), want, prefix + path);
  // the dev server's own origin counts as the site
  assert.equal(M.linkAction('http://127.0.0.1:5905/plan', 'http://127.0.0.1:5905'), 'plan');
});

test('withGameFrom: from=opus-bay on the site\'s links only (relative stays relative), never on other sites or the game', () => {
  assert.equal(M.withGameFrom('/events/x?lang=en', ORIGIN), '/events/x?lang=en&from=opus-bay');
  assert.equal(M.withGameFrom('/plan#top', ORIGIN), '/plan?from=opus-bay#top');
  assert.equal(M.withGameFrom('https://www.baylink.us/guides/a', 'http://127.0.0.1:5905'), 'https://www.baylink.us/guides/a?from=opus-bay');
  assert.equal(M.withGameFrom('/plan?from=home', ORIGIN), '/plan?from=home', 'a link that says where it came from');
  assert.equal(M.withGameFrom('/opus-bay?at=x', ORIGIN), '/opus-bay?at=x');
  for (const prefix of ['/en', '/zh-Hant']) {
    assert.equal(M.withGameFrom(`${prefix}/plan#top`, ORIGIN), `${prefix}/plan?from=opus-bay#top`);
    assert.equal(M.withGameFrom(`${prefix}/opus-bay?at=x`, ORIGIN), `${prefix}/opus-bay?at=x`);
    assert.equal(M.withGameFrom(`${prefix}/opus-bay/`, ORIGIN), `${prefix}/opus-bay/`);
    assert.equal(M.withGameFrom(`${prefix}/play`, ORIGIN), `${prefix}/play`);
  }
  const official = 'https://www.sfmta.com/fares/free-muni-seniors-ages-65';
  assert.equal(M.withGameFrom(official, ORIGIN), official);
  assert.equal(M.withGameFrom('https://www.google.com/maps/search/?api=1&query=1,2', ORIGIN), 'https://www.google.com/maps/search/?api=1&query=1,2');
  assert.equal(M.withGameFrom('mailto:a@b.c', ORIGIN), 'mailto:a@b.c');
});

// --- the runner's counting core (game/metricsRun.ts) ---------------------------------------------------------------

const R = await import('../src/opus-bay/game/metricsRun');

const funnel = (o: { live?: boolean; privacy?: boolean } = {}) => {
  let t = 0; const sent: string[] = [];
  const f = R.createFunnel({ now: () => t, send: n => { sent.push(n); }, live: o.live ?? false, privacy: o.privacy ?? false });
  return { f, sent, at: (ms: number) => { t = ms; } };
};

test('createFunnel: OPUS_METRICS_LIVE off = opus_* counted in memory only; official_source_click goes out today', () => {
  const { f, sent } = funnel();
  f.count('opus_title');
  f.started(1000, 'home');
  f.controls(9000);
  f.official();
  assert.deepEqual(sent, ['official_source_click']);
  const log = Object.fromEntries(f.log().map(r => [r.name, r]));
  assert.deepEqual(log.opus_title, { name: 'opus_title', n: 1, sent: 0 });
  assert.equal(log.opus_start_home.n, 1);
  assert.equal(log.opus_cold_start_lt10.n, 1, 'Start → play in 8 s');
  assert.equal(log.official_source_click.sent, 1);
});

test('createFunnel live: steps once a page, actions ≤ 5 each, ≤ 40 sends a page; DNT / GPC sends nothing', () => {
  const { f, sent } = funnel({ live: true });
  for (let i = 0; i < 3; i++) f.count('opus_title');
  for (let i = 0; i < 9; i++) f.count('opus_real_action_maps');
  f.count('nope' as never);
  assert.deepEqual(sent.filter(n => n === 'opus_title').length, 1);
  assert.deepEqual(sent.filter(n => n === 'opus_real_action_maps').length, 5);
  assert.ok(!sent.includes('nope'));
  for (const a of ['plan', 'official', 'guide', 'offer', 'ics', 'event', 'wish']) for (let i = 0; i < 6; i++) f.count(`opus_real_action_${a}` as never);
  assert.equal(sent.length, 40, 'the page cap');
  const quiet = funnel({ live: true, privacy: true });
  quiet.f.count('opus_title'); quiet.f.official(); quiet.f.started(0, 'nav');
  assert.deepEqual(quiet.sent, []);
  assert.equal(quiet.f.log().find(r => r.name === 'opus_title')?.n, 1, 'still counted in memory (QA)');
});

test('createFunnel: cold-start buckets; the first card only within 60 s of the first control, once; Start once', () => {
  const a = funnel(); a.f.started(0, 'photo'); a.f.controls(15_000);
  assert.ok(a.f.log().some(r => r.name === 'opus_cold_start_10to30'));
  const b = funnel(); b.f.started(0, 'family'); b.f.started(5, 'home'); b.f.controls(31_000);
  assert.ok(b.f.log().some(r => r.name === 'opus_cold_start_gt30'));
  assert.ok(!b.f.log().some(r => r.name === 'opus_start_home'), 'Start counts once');
  const c = funnel(); c.f.card(1); assert.ok(!c.f.log().some(r => r.name === 'opus_first_card'), 'no card before play');
  c.f.started(0, 'direct'); c.f.controls(5000); c.f.card(5000 + 61_000);
  assert.ok(!c.f.log().some(r => r.name === 'opus_first_card'), 'too late');
  const d = funnel(); d.f.started(0, 'direct'); d.f.controls(5000); d.f.card(30_000); d.f.card(31_000);
  assert.equal(d.f.log().find(r => r.name === 'opus_first_card')?.n, 1);
  const e = funnel(); e.f.controls(5000); assert.ok(!e.f.log().length, 'no control without a Start (a ?start= deep link)');
});

test('eventStep: metric steps by name (unknown dropped), a wish added (not removed), a first arrival as the first card', () => {
  const { f, at } = funnel();
  f.started(0, 'direct'); f.controls(1000); at(2000);
  R.eventStep(f, { type: 'metric', what: 'real', bucket: 'ics' }, 2000);
  R.eventStep(f, { type: 'metric', what: 'share', bucket: 'card' }, 2000);
  R.eventStep(f, { type: 'metric', what: 'tour', bucket: 'ch9' }, 2000);
  R.eventStep(f, { type: 'wish', added: true }, 2000);
  R.eventStep(f, { type: 'wish', added: false }, 2000);
  R.eventStep(f, { type: 'arrival', place: 'coit-tower', tier: 1, first: true }, 2000);
  const names = f.log().map(r => `${r.name}:${r.n}`).sort();
  assert.deepEqual(names, ['opus_cold_start_lt10:1', 'opus_first_card:1', 'opus_real_action_ics:1', 'opus_real_action_wish:1', 'opus_share_card:1', 'opus_start_direct:1']);
});

test('chaptersDone: the Grand Tour\'s chapters by their non-optional stops; not a city tour = null', async () => {
  const { SF_GRAND, tourStops } = await import('../src/opus-bay/data/sf/tours');
  assert.equal(R.chaptersDone('nope', []), null);
  assert.equal(R.chaptersDone(undefined, []), null);
  const flat = tourStops(SF_GRAND);
  const ch0 = flat.filter(x => x.chapter === 0).map(x => x.stop.id);
  const none = R.chaptersDone(SF_GRAND.id, []);
  assert.equal(none!.total, SF_GRAND.chapters.length);
  assert.ok(none!.done.every(d => !d));
  assert.deepEqual(R.chaptersDone(SF_GRAND.id, ch0)!.done.map(Boolean), SF_GRAND.chapters.map((_, i) => i === 0));
  assert.ok(R.chaptersDone(SF_GRAND.id, flat.map(x => x.stop.id))!.done.every(Boolean));
});
