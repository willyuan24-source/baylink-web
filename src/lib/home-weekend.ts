import type { MonthlyEvent } from '../data/monthly-types';
import { WEEKEND_FLAGSHIP_IDS, WEEKEND_PICKS, type WeekendPickEntry } from '../data/weekend-picks';
import { MONTHLY_EVENTS, HOME_WEEKENDS, HOME_GENERATED_AT, GUIDE_IMAGES } from './home-catalog';
import { filterMonthlyEvents, getMonthlyDateRange } from './monthly';
import { addCalendarDays, eventOccursOn } from './event-calendar';
import { selectWeekendFallback } from './weekend-ranking';

export type WeekendEditorial = { rank: number; reason: WeekendPickEntry['reason'] };
export type HomeWeekendPick = { event: MonthlyEvent; date: string; editorial?: WeekendEditorial };
export type HomeWeekendOptions = {
  picks?: Readonly<Record<string, readonly WeekendPickEntry[]>>;
  hasPhoto?: (imageKey: string) => boolean;
  flagships?: ReadonlySet<string>;
  limit?: number;
};

// The client only holds the compact image subset. Builds pass a resolver over
// the full image catalog instead (src/lib/home-weekend-build.ts).
const compactPhoto = (imageKey: string) => Object.hasOwn(GUIDE_IMAGES, imageKey) && GUIDE_IMAGES[imageKey].kind !== 'illustration';
const editorialFor = (list: readonly WeekendPickEntry[], id: string): WeekendEditorial | undefined => {
  const rank = list.findIndex(entry => entry.id === id);
  return rank < 0 ? undefined : { rank: rank + 1, reason: list[rank].reason };
};

export function getHomeWeekend(today: string, catalog: MonthlyEvent[] = MONTHLY_EVENTS, options: HomeWeekendOptions = {}) {
  const { picks: editorialPicks = WEEKEND_PICKS, hasPhoto = compactPhoto, flagships = WEEKEND_FLAGSHIP_IDS, limit = 3 } = options;
  const range = getMonthlyDateRange('weekend', today)!;
  const days = [range.start, range.end].filter(day => day >= today);
  const events = filterMonthlyEvents(catalog, { date: 'weekend' }, today).map(event => ({
    event, date: days.find(day => eventOccursOn(event, day)),
  })).filter((entry): entry is { event: MonthlyEvent; date: string } => !!entry.date)
    .sort((a, b) => a.date.localeCompare(b.date));
  // On Sunday the range still starts on Saturday, so the weekend's editor list applies.
  const list = editorialPicks[range.start] || [];
  const snapshot = catalog === MONTHLY_EVENTS && !options.picks && !options.hasPhoto ? (HOME_WEEKENDS as Record<string, { ids: string[]; total: number }>)[today] : undefined;
  if (snapshot) {
    const picks = snapshot.ids.flatMap(id => events.filter(entry => entry.event.id === id).map((entry): HomeWeekendPick => ({ ...entry, editorial: editorialFor(list, id) })));
    return { ...range, events, picks, total: snapshot.total };
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
  return { ...range, events, picks, total: events.length };
}

/** Days with a dated /weekly card: each home snapshot day in the week after the home catalog was generated. */
export const getWeeklyCardDays = (generatedAt: string = HOME_GENERATED_AT, snapshots: Record<string, unknown> = HOME_WEEKENDS): string[] =>
  Array.from({ length: 7 }, (_, offset) => addCalendarDays(generatedAt, offset)).filter(day => Object.hasOwn(snapshots, day));

/** The share card that matches the home page on `today`, or the build-day card outside that week. */
export const getWeeklyCardHref = (today: string, generatedAt: string = HOME_GENERATED_AT, snapshots: Record<string, unknown> = HOME_WEEKENDS): string =>
  getWeeklyCardDays(generatedAt, snapshots).includes(today) ? `/weekly/all-${today}.png` : '/weekly/all.png';
