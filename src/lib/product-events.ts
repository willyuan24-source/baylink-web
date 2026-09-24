import { API_BASE_URL } from './api';
import { getLocale } from '../i18n/locale';

export type ProductEvent = 'planner_recommendation' | 'plan_saved' | 'plan_shared' | 'official_source_click' | 'favorite_saved' | 'planner_map_opened';

/** Aggregate action counts only. Never send auth, referrers, URLs or user content. */
export function recordProductEvent(event: ProductEvent): void {
  if (typeof window === 'undefined' || navigator.doNotTrack === '1' || (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl) return;
  void fetch(`${API_BASE_URL}/product-events`, {
    method: 'POST', credentials: 'omit', referrerPolicy: 'no-referrer', keepalive: true,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event, locale: getLocale() }),
  }).catch(() => { /* Optional counters must never interrupt a user action. */ });
}
