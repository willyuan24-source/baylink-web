import { API_BASE_URL } from './api';
import { getLocale } from '../i18n/locale';
import type { OpusEvent } from '../opus-bay/game/metricNames';

export type ProductEvent = 'nav_click' | 'home_module_click' | 'search_submitted' | 'search_zero_result' | 'event_detail_open' | 'ics_download' | 'share_card_download' | 'baybay_ask' | 'baybay_degraded' | 'baybay_fast' | 'baybay_slow' | 'baybay_helpful' | 'baybay_unhelpful' | 'signup_gate' | 'contact_click' | 'message_first_sent' | 'site_arrival_from_card' | 'site_arrival_from_opus' | 'client_error' | 'newsletter_signup' | 'planner_recommendation' | 'plan_saved' | 'plan_shared' | 'official_source_click' | 'favorite_saved' | 'planner_map_opened' | 'planner_outing_adopted' | 'planner_edit_applied' | 'planner_web_search' | OpusProductEvent;
/**
 * The 3D game's counters (/opus-bay). Its exact allowlist is src/opus-bay/game/metricNames.ts `OPUS_EVENTS`; the game
 * sends them only while its `OPUS_METRICS_LIVE` is on, i.e. once the API accepts them
 * (docs/opus-bay/w9-backend-metrics.patch) — an unknown name is rejected and spends the visitor's write limit, so the type
 * is that exact list (a type-only import: nothing of the game enters the site's bundle), not any `opus_` string.
 */
export type OpusProductEvent = OpusEvent;
export type VisitEvent = 'page_view' | 'site_source_direct' | 'site_source_search' | 'site_source_wechat' | 'site_source_social' | 'site_source_card' | 'site_source_opus' | 'site_source_other';

/** Aggregate action counts only. Never send auth, referrers, URLs or user content. */
export function recordProductEvent(event: ProductEvent | VisitEvent): void {
  if (import.meta.env?.DEV || typeof window === 'undefined' || navigator.doNotTrack === '1' || (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl) return;
  void fetch(`${API_BASE_URL}/product-events`, {
    method: 'POST', credentials: 'omit', referrerPolicy: 'no-referrer', keepalive: true,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event, locale: getLocale() }),
  }).catch(() => { /* Optional counters must never interrupt a user action. */ });
}
