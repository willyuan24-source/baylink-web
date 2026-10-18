import type { MonthlyEvent } from '../data/monthly-types';
import type { WeekendPickEntry } from '../data/weekend-picks';
import { addCalendarDays, eventOccursOn } from './event-calendar';
import { isSeniorFriendly, type SeniorFriendlyInput } from './senior-friendly';

/**
 * public/weekend-picks.json (scripts/export-weekend-picks.ts): the editor's weekend picks from src/data/weekend-picks.ts,
 * for the API, which cannot read the site's TypeScript (BayBay's 周末去哪 answers; lanes/API-SYNC-3G review). It is the
 * editor's full ranked list per weekend, standbys included, minus what the site would never show:
 * - weekends whose Sunday is on or after the build day (passed weekends are not offered again);
 * - picks whose event is in the catalog and occurs on that Saturday or Sunday (the home, /weekly and /events skip the
 *   others at runtime), in the editor's order. Ranks 1–3 are what the home and the card show; 4–5 are standbys that move
 *   up on a day a higher pick does not run.
 * - rank is the position among the exported picks of that weekend (what the API sorts by). The site's own editorial rank
 *   (lib/home-weekend.ts editorialFor) counts the editor's list as written, so the two differ only after a dropped pick.
 * - the editor's reason as written (zh-Hans and en; zh-Hant is converted on the site), the days of that weekend the
 *   event runs, and 长辈友好 by the site's shared rule (lib/senior-friendly.ts, the /events chip and the home circle).
 * Nothing is added that the picks file or the event entry does not state. Regenerate with `npm run export:picks`.
 */
export type WeekendPickExport = {
  id: string;
  kind: 'event';
  rank: number;
  dates: string[];
  reason_zh: string;
  reason_en: string;
  elderFriendly: boolean;
};
export type WeekendPicksFile = { generatedAt: string; weekends: { start: string; end: string; picks: WeekendPickExport[] }[] };

type PlanningOf = (id: string) => SeniorFriendlyInput['planning'] | undefined;

export function buildWeekendPicksExport(
  today: string,
  picks: Readonly<Record<string, readonly WeekendPickEntry[]>>,
  events: readonly MonthlyEvent[],
  planningOf: PlanningOf = () => undefined,
): WeekendPicksFile {
  const byId = new Map(events.map(event => [event.id, event]));
  const weekends = Object.entries(picks)
    .map(([start, list]) => ({ start, end: addCalendarDays(start, 1), list }))
    .filter(({ end }) => end >= today)
    .sort((a, b) => a.start.localeCompare(b.start))
    .map(({ start, end, list }) => ({
      start,
      end,
      picks: list.flatMap(({ id, reason }) => {
        const event = byId.get(id);
        const dates = event ? [start, end].filter(day => eventOccursOn(event, day)) : [];
        if (!event || !dates.length) return [];
        return [{ id, dates, reason, elderFriendly: isSeniorFriendly({ ...event, planning: planningOf(id) }) }];
      }).map(({ id, dates, reason, elderFriendly }, index): WeekendPickExport => ({
        id, kind: 'event', rank: index + 1, dates, reason_zh: reason.zh, reason_en: reason.en, elderFriendly,
      })),
    }))
    .filter(weekend => weekend.picks.length);
  return { generatedAt: today, weekends };
}
