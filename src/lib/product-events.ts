import { API_BASE_URL } from './api';
import { getLocale } from '../i18n/locale';
import { currentRouteTemplate } from './route-template';
import type { OpusEvent } from '../opus-bay/game/metricNames';

/** BayBay answer time in the buckets of the latency target: <3 s, 3–8 s, 8–15 s, >15 s. */
export type BayBayLatencyEvent = 'baybay_latency_lt3' | 'baybay_latency_3to8' | 'baybay_latency_8to15' | 'baybay_latency_gt15';
export type ProductEvent = 'nav_click' | 'home_module_click' | 'search_submitted' | 'search_zero_result' | 'event_detail_open' | 'ics_download' | 'share_card_download' | 'baybay_ask' | 'baybay_degraded' | 'baybay_fast' | 'baybay_slow' | 'baybay_helpful' | 'baybay_unhelpful' | 'signup_gate' | 'contact_click' | 'message_first_sent' | 'site_arrival_from_card' | 'site_arrival_from_opus' | 'client_error' | 'newsletter_signup' | 'planner_recommendation' | 'plan_saved' | 'plan_shared' | 'official_source_click' | 'favorite_saved' | 'planner_map_opened' | 'planner_outing_adopted' | 'planner_edit_applied' | 'planner_web_search' | 'feedback_open' | 'feedback_sent' | BayBayLatencyEvent | OpusProductEvent;
/**
 * The 3D game's counters (/opus-bay). Its exact allowlist is src/opus-bay/game/metricNames.ts `OPUS_EVENTS`; the game
 * sends them only while its `OPUS_METRICS_LIVE` is on, i.e. once the API accepts them
 * (docs/opus-bay/w9-backend-metrics.patch) — an unknown name is rejected and spends the visitor's write limit, so the type
 * is that exact list (a type-only import: nothing of the game enters the site's bundle), not any `opus_` string.
 */
export type OpusProductEvent = OpusEvent;
export type VisitEvent = 'page_view' | 'site_source_direct' | 'site_source_search' | 'site_source_wechat' | 'site_source_social' | 'site_source_card' | 'site_source_opus' | 'site_source_other';

/** Optional counters and beacons are skipped in development and when the browser asks not to be tracked (DNT, GPC). */
export const trackingAllowed = (): boolean => !(import.meta.env?.DEV || typeof window === 'undefined' || navigator.doNotTrack === '1' || (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl);

/**
 * Aggregate action counts only. Never send auth, referrers, URLs or user content. `route` is the page's route-table
 * template ('/events/:id'), never the path itself; it defaults to the current page.
 */
export function recordProductEvent(event: ProductEvent | VisitEvent, options: { route?: string } = {}): void {
  if (!trackingAllowed()) return;
  void fetch(`${API_BASE_URL}/product-events`, {
    method: 'POST', credentials: 'omit', referrerPolicy: 'no-referrer', keepalive: true,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event, locale: getLocale(), route: options.route ?? currentRouteTemplate() }),
  }).catch(() => { /* Optional counters must never interrupt a user action. */ });
}

/** A calendar file (.ics) or calendar subscription (webcal:) the reader took away. */
export const recordIcsDownload = () => recordProductEvent('ics_download');
/** An event, offer or opening detail page opened; its kind and id are never sent. */
export const recordDetailOpen = () => recordProductEvent('event_detail_open');

/** BayBay latency buckets: src/lib/baybay-latency.ts (in BayBay's own chunk, not the boot graph). */
