import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

/**
 * Wave 8 · lane S (W8-S1): the game re-synced with the site after GPT's three day-0 commits (f3fa187f service booking,
 * 11ffcf60 small-group outings + BayBay planning drafts, f2f3f889 outing discovery / waitlist / AI drafts). Those
 * commits left the catalog, the offers and the openings as they were (the W6 / W7 S tests still hold); they added the
 * routes /together and /me/bookings. Here: every guide page the city links is prerendered, the plain pages the game
 * opens resolve, the game links no adult small-group page (the event page carries the site's own 一起去), and the
 * seniors' free Muni row links SFMTA's English page (the site's source is the Vietnamese copy).
 */

// --- headless canvas stub (world modules create label atlases at import time; same as the events test) ---
const g = globalThis as unknown as Record<string, unknown>;
const noop = () => undefined;
const ctx2d = new Proxy({}, {
  get: (_t, k) => (k === 'measureText' ? () => ({ width: 10 }) : k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop: noop }) : k === 'getImageData' ? (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }) : noop),
  set: () => true,
});
g.window ??= globalThis;
g.document ??= { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => ctx2d }) };

const vercel = JSON.parse(fs.readFileSync(path.resolve('vercel.json'), 'utf8')) as { routes: { src?: string; dest?: string }[] };
/** a prerendered page (`…/$1.html` or a fixed `/<name>.html`) */
const prerendered = (url: string) => vercel.routes.some(r => r.src && r.dest && /\.html$/.test(r.dest) && r.dest !== '/404.html' && new RegExp(r.src).test(url));
/** the SPA shell (index.html) */
const spa = (url: string) => vercel.routes.some(r => r.src && r.dest === '/index.html' && new RegExp(r.src).test(url));

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(p);
  }
  return out;
}

test('W8-S1 网站联动: every BAYLINK guide the city links is a prerendered page; the plain pages the game opens resolve', async () => {
  const { WALK_GUIDES } = await import('../src/opus-bay/realsf/todayRows');
  const { PLACE_CARDS } = await import('../src/opus-bay/data/sf/placeCards');
  const { PLACE_CARDS_2, CURATED_CARDS } = await import('../src/opus-bay/data/sf/placeCards2');
  const { SF_LANDMARK_INFO } = await import('../src/opus-bay/data/sf/landmarks');
  const places = JSON.parse(fs.readFileSync(path.resolve('public/opus-bay/sf/v1/places.json'), 'utf8')) as { places: { guideSlug?: string }[] };
  const slugs = new Map<string, string>();
  for (const p of places.places) if (p.guideSlug) slugs.set(p.guideSlug, 'places.json');
  for (const c of [...PLACE_CARDS, ...PLACE_CARDS_2, ...CURATED_CARDS]) if (c.guideSlug) slugs.set(c.guideSlug, `card ${c.id}`);
  for (const l of SF_LANDMARK_INFO) if (l.guideSlug) slugs.set(l.guideSlug, `landmark ${l.id}`);
  for (const w of WALK_GUIDES) slugs.set(w.slug, 'the 今天 tab');
  assert.ok(slugs.size >= 10, `${slugs.size} guides`);
  for (const [slug, from] of slugs) assert.ok(prerendered(`/guides/${slug}`), `/guides/${slug} (${from}) is a prerendered page`);
  // the plain pages (data/links.ts): the guides list, the month, the calendar, the planner; 我的一周 is the SPA's
  for (const p of ['/guides', '/this-month', '/calendar', '/plan']) assert.ok(prerendered(p), `${p} is prerendered`);
  assert.ok(spa('/my-week'), '/my-week opens the site');
  assert.ok(!prerendered('/guides/no-such-guide'), 'the check can fail');
});

test('W8-S1 the outings decision: the game opens no small-group page (/together, /me/bookings) — adults only, signed in; the event page links them', () => {
  // the routes exist on the site (GPT's day-0 commits) …
  assert.ok(spa('/together') && spa('/me/bookings'));
  // … and the game's sources never link them: the game hands an event to /events/:id, where the site's own 一起去 sheet
  // offers "查看或发起小队" (2–8 adults, host-approved) — the toy city does not send its players into strangers' meetups
  const hits = walk(path.resolve('src/opus-bay')).filter(f => /['"`]\/(together|me\/bookings)\b/.test(fs.readFileSync(f, 'utf8')));
  assert.deepEqual(hits, []);
});

test('W8-S1 the seniors’ free Muni row links SFMTA’s English page; no live.json source is a translated SFMTA copy; the export date is the Bay date', async () => {
  const live = await import('../src/opus-bay/realsf/live');
  const raw = JSON.parse(fs.readFileSync(path.resolve('public/opus-bay/sf/v1/live.json'), 'utf8')) as { exported: string };
  const offers = live.parseLive(raw)!;
  const seniors = offers.find(o => o.id === 'sfmta-free-muni-seniors')!;
  assert.equal(seniors.source.url, 'https://www.sfmta.com/fares/free-muni-seniors-ages-65');
  // (W9-L) the site's row cites that page itself now (the sourceEn override is gone): its own check date
  const site = (JSON.parse(fs.readFileSync(path.resolve('src/data/september-refresh-offers.json'), 'utf8')) as { id: string; sourceUrl: string; verifiedAt: string }[]).find(o => o.id === 'sfmta-free-muni-seniors')!;
  assert.equal(site.sourceUrl, seniors.source.url);
  assert.equal(seniors.source.verifiedAt, site.verifiedAt);
  for (const o of offers) assert.doesNotMatch(o.source.url, /sfmta\.com\/(vi|zh|zh-hant|es|tl|ru)\//, `${o.id}: an English source`);
  // the export script keeps the override honest: it fails once the site's own source changes
  const script = fs.readFileSync(path.resolve('scripts/opus-sf/export-live.ts'), 'utf8');
  assert.match(script, /drop the sourceEn override/);
  assert.match(script, /timeZone: 'America\/Los_Angeles'/, 'the export date is the Bay date');
  assert.match(raw.exported, /^2026-\d{2}-\d{2}$/);
});

test('W8-S1 Fleet Week: the Blue Angels row on the three air-show days — 12:00–16:00, usually ≈ 3 pm, 以官网为准 (secondary)', async () => {
  const cal = await import('../src/opus-bay/realsf/calendar');
  const row = cal.CALENDAR.find(r => r.id === 'fleet-week-blue-angels-2026')!;
  assert.ok(row);
  assert.equal(row.grade, 'secondary');
  assert.equal(cal.GRADE_SAY[row.grade].zh, '以官网为准');
  assert.match(row.note.zh, /12:00–16:00.*通常下午三点左右/);
  assert.ok([...row.note.zh].length <= 40);
  assert.equal(row.catalogId, undefined, 'a calendar row never makes an event card');
  for (const d of ['2026-10-09', '2026-10-10', '2026-10-11']) assert.ok(cal.calendarOn(d).some(r => r.id === row.id), d);
  for (const d of ['2026-10-08', '2026-10-12']) assert.ok(!cal.calendarOn(d).some(r => r.id === row.id), d);
  assert.equal(row.source.url, 'https://www.navyweek.org/fleetweek/san-francisco/');
  const parade = cal.CALENDAR.find(r => r.id === 'fleet-week-parade-of-ships-2026')!;
  assert.match(parade.note.zh, /^11:00–12:00/);
  assert.equal(parade.source.verifiedAt, '2026-09-30');
});
