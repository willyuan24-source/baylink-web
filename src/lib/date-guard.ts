/**
 * Stale-date guard (CW-02, EVT11-05; docs/daily-rebuild.md). Home's 本周末, /events and /calendar are prerendered for the
 * Pacific day of the build. Every prerendered page names that day (`<html data-built-for>`, scripts/prerender.tsx).
 * public/reading-init.js, which runs before the first paint, compares it with today and marks
 * `<html data-date-stale="day">` or `"day weekend"`; the stylesheet (source-monitor.css) then paints a skeleton of the
 * same size over the prerendered blocks marked with `dateScope()`, and over the boot snapshot SHELL2 keeps on screen
 * while the route settles, until the app renders today's result. Blocks the app renders are never covered.
 *
 * Scopes nest: a `day` block inside a `weekend` list (the /events travel alerts and its share-card link) is covered on
 * its own from the next day, while the list itself keeps until Sunday. Known trade-off: inside the 本周末 list, the order
 * of the cards (photos first, by a photo-age rule that reads only today's year) and the day tabs that drop a past Saturday are not
 * marked separately — the first is cosmetic, the second is the `weekend` key's Sunday rule. Crawlers and no-JS readers see
 * the build day until the daily rebuild runs.
 *
 * This module is the TypeScript statement of reading-init's rule (tests/date-guard.test.tsx runs the script against it)
 * and the one way a component marks a date block.
 */
export type DateScope = 'day' | 'weekend';

/** Spread on a block whose content depends on today: `weekend` for a 本周末 list, `day` for anything keyed to the day. */
export const dateScope = (scope: DateScope) => ({ 'data-date-scope': scope }) as const;

const DAY = /^\d{4}-\d{2}-\d{2}$/u;

/**
 * Which weekend a 本周末 list shows on `day`: Monday to Friday show the coming Saturday's weekend and do not change from
 * day to day; on Saturday and Sunday the list drops the days that have passed, so each is its own key.
 */
export function weekendKey(day: string): string {
  const date = new Date(`${day}T12:00:00Z`);
  const weekday = date.getUTCDay();
  if (weekday === 0 || weekday === 6) return day;
  date.setUTCDate(date.getUTCDate() + 6 - weekday);
  return date.toISOString().slice(0, 10);
}

/** The scopes a page built for `builtFor` shows out of date on `today` (both Pacific days). */
export function staleScopes(builtFor: string | null | undefined, today: string): DateScope[] {
  if (!builtFor || !DAY.test(builtFor) || !DAY.test(today) || builtFor === today) return [];
  return weekendKey(builtFor) === weekendKey(today) ? ['day'] : ['day', 'weekend'];
}
