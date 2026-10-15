import { useEffect, useState, useSyncExternalStore } from 'react';
import { chunkLoader } from '../../lib/chunk-recovery';
import { isLocaleReadyForFeature, loadLocaleForFeature, useLocale, type Locale } from '../../i18n/locale';
import { getBayAreaToday, getMonthlyDateRange } from '../../lib/monthly';
import { calendarPeriod, validCalendarDay } from '../../lib/calendar-days';
import { INDEX_EVENTS, installLaterEvents, isLaterInstalled, listWindow, nearCovers, resolveWhen, subscribeLater } from './events-model';
import type { EventsLater, IndexEvent } from './events-index-types';

/**
 * WEB-PERF-2: the events column's route carries the events of its first screens only (events-index.json `near`), so a
 * batch of far-off events adds nothing to /events and /calendar. A view that reaches past those days (十二月, 全部日期,
 * another week or month of the calendar, the nearest day after an empty one) loads the rest of the catalog here, with its
 * English pack on /en, and shows a fixed-height skeleton until it is in. Node has it installed already (events-model.ts).
 */
const loadChunk = chunkLoader(() => import('../../data/generated/events-later.json'), module => module.default as unknown as EventsLater);
const englishReady = () => isLocaleReadyForFeature('en', 'events-later');

/** Whether the whole catalog can render in this language. */
export const isLaterReady = (locale: Locale): boolean => isLaterInstalled() && (locale !== 'en' || englishReady());

const pending = new Map<Locale, Promise<void>>();
/** Load what is missing of events-later.json and, in English, its text. A failed load rejects; the next call tries again. */
export function loadLaterEvents(locale: Locale): Promise<void> {
  if (isLaterReady(locale)) return Promise.resolve();
  let promise = pending.get(locale);
  if (!promise) {
    promise = Promise.all([
      isLaterInstalled() ? undefined : loadChunk().then(installLaterEvents),
      locale === 'en' && !englishReady() ? loadLocaleForFeature('en', 'events-later') : undefined,
    ]).then(() => undefined).finally(() => { pending.delete(locale); });
    pending.set(locale, promise);
  }
  return promise;
}

/** Start loading the rest ahead of a tap that will need it (the filter and date Sheets open). Errors wait for the view. */
export const prefetchLaterEvents = (locale: Locale): void => { void loadLaterEvents(locale).catch(() => undefined); };

export type IndexEventsState = {
  /** INDEX_EVENTS once it lists every event of the days asked for, else null (show the skeleton). */
  events: readonly IndexEvent[] | null;
  /** The rest of the catalog did not load (offline, a lost chunk): show the retry state. */
  failed: boolean;
  retry: () => void;
};
/**
 * The events for the days [start, end] (`end` null: every day from `start` on). The route's own events answer at once when
 * they cover those days; otherwise the rest of the catalog loads (unless `enabled` is false) and the view re-renders.
 */
export function useIndexEvents(start: string, end: string | null, enabled = true): IndexEventsState {
  const locale = useLocale();
  useSyncExternalStore(subscribeLater, isLaterInstalled, isLaterInstalled);
  const [attempt, setAttempt] = useState(0);
  const [failedAt, setFailedAt] = useState<string>();
  const [, setLoaded] = useState(0);
  const ready = nearCovers(start, end) || isLaterReady(locale);
  const key = `${locale}:${attempt}`;
  useEffect(() => {
    if (ready || !enabled) return;
    let live = true;
    loadLaterEvents(locale).then(() => { if (live) setLoaded(count => count + 1); }, () => { if (live) setFailedAt(key); });
    return () => { live = false; };
  }, [ready, enabled, locale, key]);
  return { events: ready ? INDEX_EVENTS : null, failed: !ready && failedAt === key, retry: () => setAttempt(count => count + 1) };
}

/**
 * At boot (route-loaders.ts): a URL whose first view reaches past the route's own days (a shared 十二月 or 全部日期 link,
 * /calendar?date= another month) waits for the rest of the catalog too, so the app replaces the prerender in one pass
 * instead of with a skeleton. A failed load does not hold the page: the view shows its retry state.
 */
export function loadForLocation(page: 'events' | 'calendar', search: string, locale: Locale, today = getBayAreaToday()): Promise<void> {
  const params = new URLSearchParams(search);
  let days: { start: string; end: string | null };
  if (page === 'calendar') {
    const date = params.get('date') || '';
    days = calendarPeriod(validCalendarDay(date) ? date : today, 'week');
  } else {
    const view = params.get('view');
    if (view === 'perks' || view === 'openings') return Promise.resolve();
    days = listWindow(getMonthlyDateRange(resolveWhen(params.get('when'), 'weekend'), today), today);
  }
  return nearCovers(days.start, days.end) ? Promise.resolve() : loadLaterEvents(locale).catch(() => undefined);
}
