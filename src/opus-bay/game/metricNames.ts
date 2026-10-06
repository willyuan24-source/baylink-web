import { unprefixedPath } from '../../lib/language-path';

/**
 * Wave 9 · lane S · the metrics' fixed words (review docs/opus-bay/review-2026-10-01-first-use.md §9; R§5 #9). Pure:
 * node-tested (tests/opus-bay-w9-s-metrics.test.ts); game/metricsRun.ts is the only reader at runtime.
 *
 * The site's counter (src/lib/product-events.ts recordProductEvent → the API's /product-events) stores one number per
 * Bay day × event name × language — no user id, no referrer, no URL, nothing typed, and nothing at all under DNT / GPC.
 * So every dimension of the funnel is part of the NAME, and every name is in OPUS_EVENTS below.
 *
 * Sent today: only `official_source_click` (a name the API already accepts) for an official / source page opened from
 * the game. The `opus_*` names wait behind OPUS_METRICS_LIVE: the API rejects a name it does not know (HTTP 400) and
 * still spends the visitor's write limit, so they are counted in memory only (metricsLog(), the QA hook) until the owner
 * applies docs/opus-bay/w9-backend-metrics.patch to the API and flips the flag.
 */

/** Flip to true once the API accepts the opus_* names (docs/opus-bay/w9-backend-metrics.patch is deployed). */
export const OPUS_METRICS_LIVE = true;

/** Where a visit came from (lane E's ui/entrySource.ts `entrySource()`; `from=` on the URL). */
export const ENTRY_SOURCES = ['home', 'nav', 'play', 'photo', 'family', 'share', 'guide', 'promo', 'direct'] as const;
export type EntrySourceWord = (typeof ENTRY_SOURCES)[number];
export const START_MODES = ['tour', 'week', 'free', 'local', 'resume'] as const;
export const COLD_BUCKETS = ['lt10', '10to30', 'gt30'] as const;
/** real-world actions: the review's north star ("每周由小旅带出的真实行动") */
export const REAL_ACTIONS = ['plan', 'official', 'maps', 'guide', 'offer', 'ics', 'event', 'wish'] as const;
export type RealAction = (typeof REAL_ACTIONS)[number];
export const SHARE_KINDS = ['photo', 'card'] as const;
export const VISIT_BUCKETS = ['new', '1d', '7d', '30d'] as const;
export const TOUR_STEPS = ['ch1', 'ch2', 'ch3', 'ch4', 'ch5', 'done'] as const;

/** Every counter the game may send (the API's allowlist in docs/opus-bay/w9-backend-metrics.patch is this list). */
export const OPUS_EVENTS = [
  'opus_title',
  ...ENTRY_SOURCES.map(s => `opus_start_${s}` as const),
  ...COLD_BUCKETS.map(b => `opus_cold_start_${b}` as const),
  ...START_MODES.map(m => `opus_mode_${m}` as const),
  'opus_first_card',
  ...REAL_ACTIONS.map(a => `opus_real_action_${a}` as const),
  ...SHARE_KINDS.map(k => `opus_share_${k}` as const),
  'opus_visit_new',
  ...VISIT_BUCKETS.filter(b => b !== 'new').map(b => `opus_returning_${b}` as const),
  ...TOUR_STEPS.map(s => `opus_tour_${s}` as const),
] as const;
export type OpusEvent = (typeof OPUS_EVENTS)[number];
const KNOWN = new Set<string>(OPUS_EVENTS);
export const isOpusEvent = (name: string): name is OpusEvent => KNOWN.has(name);

/** A `{ type: 'metric' }` step → its counter name (null: an unknown bucket — dropped, never sent). */
export function metricName(what: string, bucket: string | undefined): OpusEvent | null {
  const name = what === 'real' ? `opus_real_action_${bucket}` : what === 'share' ? `opus_share_${bucket}` : what === 'tour' ? `opus_tour_${bucket}` : what === 'card' ? 'opus_first_card' : '';
  return isOpusEvent(name) ? name : null;
}

/** Start → the first moment the player can act (the welcome's choice, or play), in ms → the review's three buckets. */
export function coldBucket(ms: number): (typeof COLD_BUCKETS)[number] {
  return ms < 10_000 ? 'lt10' : ms <= 30_000 ? '10to30' : 'gt30';
}

/**
 * The visit bucket from the Bay day of the previous visit (YYYY-MM-DD, kept on this device; null: none) and today's:
 * new · 1d (the previous visit was yesterday) · 7d (2–7 days ago) · 30d (8–30 days ago); null = the same day again, or
 * more than 30 days (counted as neither: the review's buckets stop at 30 days).
 */
export function visitBucket(previous: string | null, today: string): (typeof VISIT_BUCKETS)[number] | null {
  if (!previous || !/^\d{4}-\d{2}-\d{2}$/.test(previous)) return 'new';
  const days = Math.round((Date.parse(`${today}T12:00:00Z`) - Date.parse(`${previous}T12:00:00Z`)) / 864e5);
  if (!Number.isFinite(days) || days <= 0) return null;
  return days === 1 ? '1d' : days <= 7 ? '7d' : days <= 30 ? '30d' : null;
}

const MAPS_HOST = /^(maps\.google\.[a-z.]+|maps\.apple\.com|goo\.gl|maps\.app\.goo\.gl)$/;
/** credits and licences (a photo's author page, a licence, the map's copyright): not a real-world action */
const CREDIT_HOST = /(^|\.)(wikimedia\.org|wikipedia\.org|creativecommons\.org|openstreetmap\.org|flickr\.com|unsplash\.com)$/;
const SITE_HOST = /(^|\.)baylink\.(us|app)$/;

/**
 * What opening a link from the game is, by its URL (null: not a real-world action — a credit, the game itself, the
 * site's home, a non-http link). `origin` = the page's own origin (a relative link is the site's).
 *   plan  /plan · event  /events/… /calendar · guide  /guides… /this-month · offer  /offers/… · ics  a .ics file
 *   maps  Google / Apple Maps · official  any other http(s) page (an organiser, a venue, SFMTA, NOAA …)
 */
export function linkAction(href: string, origin: string, download?: string | null): RealAction | null {
  if (download && /\.ics$/i.test(download)) return 'ics';
  let url: URL;
  try { url = new URL(href, origin); } catch { return null; }
  if (/\.ics$/i.test(url.pathname)) return 'ics';
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  const host = url.hostname.toLowerCase();
  const site = url.origin === origin || SITE_HOST.test(host);
  if (site) {
    const p = unprefixedPath(url.pathname);
    if (p === '/plan' || p.startsWith('/plan/')) return 'plan';
    if (p.startsWith('/events/') || p === '/calendar' || p.startsWith('/calendar/')) return 'event';
    if (p === '/guides' || p.startsWith('/guides/') || p === '/this-month' || p === '/this-week') return 'guide';
    if (p.startsWith('/offers/')) return 'offer';
    if (p === '/my-week') return 'plan';
    return null;
  }
  if (MAPS_HOST.test(host) || ((host === 'www.google.com' || host === 'google.com') && url.pathname.startsWith('/maps'))) return 'maps';
  if (CREDIT_HOST.test(host)) return null;
  return 'official';
}

/**
 * The site link with `from=opus-bay` (so /plan, /events … can count visits from the game), else the href unchanged:
 * other sites' links are never decorated (an official page's address stays exactly as its source gave it), nor the
 * game's own (/opus-bay), nor one that already says where it came from.
 */
export function withGameFrom(href: string, origin: string): string {
  let url: URL;
  try { url = new URL(href, origin); } catch { return href; }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return href;
  if (!(url.origin === origin || SITE_HOST.test(url.hostname.toLowerCase()))) return href;
  const path = unprefixedPath(url.pathname);
  if (path === '/opus-bay' || path.startsWith('/opus-bay/') || path === '/play' || url.searchParams.has('from')) return href;
  url.searchParams.set('from', 'opus-bay');
  return url.origin === origin && !/^https?:/i.test(href) ? `${url.pathname}${url.search}${url.hash}` : url.href;
}

/** At most this many sends of one name per page (funnel steps count once; actions and shares a few times). */
export const SEND_CAP = { step: 1, action: 5, total: 40 } as const;
