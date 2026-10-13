import type { MonthlyEvent } from '../data/monthly-types';
import { WEEKEND_FLAGSHIP_IDS, WEEKEND_PICKS, type WeekendPickEntry } from '../data/weekend-picks';
import { MONTHLY_EVENTS, HOME_WEEKENDS, HOME_GENERATED_AT, GUIDE_IMAGES } from './home-catalog';
import { featurePhotos, filterMonthlyEvents, getMonthlyDateRange } from './monthly';
import { addCalendarDays, eventOccursOn } from './event-calendar';
import { rankWeekendFallback, selectWeekendFallback } from './weekend-ranking';

export type WeekendEditorial = { rank: number; reason: WeekendPickEntry['reason'] };
export type HomeWeekendPick = { event: MonthlyEvent; date: string; editorial?: WeekendEditorial };
export type HomeWeekendOptions = {
  picks?: Readonly<Record<string, readonly WeekendPickEntry[]>>;
  hasPhoto?: (imageKey: string) => boolean;
  flagships?: ReadonlySet<string>;
  limit?: number;
  /** Cards in the home's two-column 本周末 feed after the picks (1007 §4.2 ④). */
  feedLimit?: number;
};
/** One published day: the picks (the weekly share card's three), the feed after them, and the weekend's event count. */
export type HomeWeekendSnapshot = { ids: string[]; feed?: string[]; total: number };

export const HOME_FEED_SIZE = 8;
/** The feed's real photos sit on the two-column grid's diagonal (cards 1, 4, 5, 8), as on /events. */
const FEED_PHOTO_SLOTS = [0, 3, 4, 7] as const;

// The client only holds the compact image subset. Builds pass a resolver over
// the full image catalog instead (src/lib/home-weekend-build.ts).
const compactPhoto = (imageKey: string) => Object.hasOwn(GUIDE_IMAGES, imageKey) && GUIDE_IMAGES[imageKey].kind !== 'illustration';
const editorialFor = (list: readonly WeekendPickEntry[], id: string): WeekendEditorial | undefined => {
  const rank = list.findIndex(entry => entry.id === id);
  return rank < 0 ? undefined : { rank: rank + 1, reason: list[rank].reason };
};

export function getHomeWeekend(today: string, catalog: MonthlyEvent[] = MONTHLY_EVENTS, options: HomeWeekendOptions = {}) {
  const { picks: editorialPicks = WEEKEND_PICKS, hasPhoto = compactPhoto, flagships = WEEKEND_FLAGSHIP_IDS, limit = 3, feedLimit = HOME_FEED_SIZE } = options;
  const range = getMonthlyDateRange('weekend', today)!;
  const days = [range.start, range.end].filter(day => day >= today);
  const events = filterMonthlyEvents(catalog, { date: 'weekend' }, today).map(event => ({
    event, date: days.find(day => eventOccursOn(event, day)),
  })).filter((entry): entry is { event: MonthlyEvent; date: string } => !!entry.date)
    .sort((a, b) => a.date.localeCompare(b.date));
  // On Sunday the range still starts on Saturday, so the weekend's editor list applies.
  const list = editorialPicks[range.start] || [];
  // The published snapshot answers only the default call; any option asks for a fresh selection.
  const custom = Object.values(options).some(value => value !== undefined);
  const published = catalog === MONTHLY_EVENTS ? (HOME_WEEKENDS as Record<string, HomeWeekendSnapshot>)[today] : undefined;
  // The weekend's event count. The compact pool holds only the events some snapshot day shows, so on a day past the
  // snapshots (no deploy for four weeks) counting it would undercount: the count is unknown (null) and the home says
  // "全部活动" without a number.
  const total: number | null = catalog !== MONTHLY_EVENTS ? events.length : published ? published.total : null;
  const byIds = (ids: readonly string[]) => ids.flatMap(id => events.filter(entry => entry.event.id === id));
  if (published && !custom) {
    const picks = byIds(published.ids).map((entry): HomeWeekendPick => ({ ...entry, editorial: editorialFor(list, entry.event.id) }));
    return { ...range, events, picks, feed: byIds(published.feed ?? []), total };
  }
  const picks: HomeWeekendPick[] = [];
  // Editor picks first, in their order. An id this catalog does not hold for the
  // remaining days (ended, Saturday-only on Sunday, another region) is skipped.
  for (const { id } of list) {
    const entry = events.find(item => item.event.id === id);
    if (entry && picks.length < limit && !picks.some(pick => pick.event.id === id)) picks.push({ ...entry, editorial: editorialFor(list, id) });
  }
  picks.push(...selectWeekendFallback(events.filter(entry => !picks.some(pick => pick.event.id === entry.event.id)), {
    weekendStart: range.start, count: limit - picks.length, usedRegions: picks.map(pick => pick.event.region), hasPhoto, flagships,
  }));
  // The feed: the rest of the weekend in the home ranking (Chinese-language, free, family, real photo, flagship), with
  // the best real photos on the grid's diagonal.
  const rest = rankWeekendFallback(events.filter(entry => !picks.some(pick => pick.event.id === entry.event.id)), range.start, { hasPhoto, flagships });
  const feed = featurePhotos(rest, entry => hasPhoto(entry.event.imageKey), FEED_PHOTO_SLOTS).slice(0, feedLimit);
  return { ...range, events, picks, feed, total };
}

/** Days with a dated /weekly card: each home snapshot day in the week after the home catalog was generated. */
export const getWeeklyCardDays = (generatedAt: string = HOME_GENERATED_AT, snapshots: Record<string, unknown> = HOME_WEEKENDS): string[] =>
  Array.from({ length: 7 }, (_, offset) => addCalendarDays(generatedAt, offset)).filter(day => Object.hasOwn(snapshots, day));

/** The share card that matches the home page on `today`, or the build-day card outside that week. */
export const getWeeklyCardHref = (today: string, generatedAt: string = HOME_GENERATED_AT, snapshots: Record<string, unknown> = HOME_WEEKENDS): string =>
  getWeeklyCardDays(generatedAt, snapshots).includes(today) ? `/weekly/all-${today}.png` : '/weekly/all.png';
