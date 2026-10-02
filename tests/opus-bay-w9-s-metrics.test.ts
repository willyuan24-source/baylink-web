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
  assert.equal(M.OPUS_METRICS_LIVE, false, 'the opus_* names wait for the API (docs/opus-bay/w9-backend-metrics.patch)');
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
  // the dev server's own origin counts as the site
  assert.equal(M.linkAction('http://127.0.0.1:5905/plan', 'http://127.0.0.1:5905'), 'plan');
});

test('withGameFrom: from=opus-bay on the site\'s links only (relative stays relative), never on other sites or the game', () => {
  assert.equal(M.withGameFrom('/events/x?lang=en', ORIGIN), '/events/x?lang=en&from=opus-bay');
  assert.equal(M.withGameFrom('/plan#top', ORIGIN), '/plan?from=opus-bay#top');
  assert.equal(M.withGameFrom('https://www.baylink.us/guides/a', 'http://127.0.0.1:5905'), 'https://www.baylink.us/guides/a?from=opus-bay');
  assert.equal(M.withGameFrom('/plan?from=home', ORIGIN), '/plan?from=home', 'a link that says where it came from');
  assert.equal(M.withGameFrom('/opus-bay?at=x', ORIGIN), '/opus-bay?at=x');
  const official = 'https://www.sfmta.com/fares/free-muni-seniors-ages-65';
  assert.equal(M.withGameFrom(official, ORIGIN), official);
  assert.equal(M.withGameFrom('https://www.google.com/maps/search/?api=1&query=1,2', ORIGIN), 'https://www.google.com/maps/search/?api=1&query=1,2');
  assert.equal(M.withGameFrom('mailto:a@b.c', ORIGIN), 'mailto:a@b.c');
});
