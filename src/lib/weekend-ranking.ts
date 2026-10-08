import type { MonthlyEvent, MonthlyRegion } from '../data/monthly-types';

// Automatic weekend ranking for weekends without editor picks. It has no data
// imports: callers pass the eligible entries and, at build time, a photo check
// against the full image catalog.
export type WeekendEntry = { event: MonthlyEvent; date: string };
export type WeekendRankingOptions = { hasPhoto?: (imageKey: string) => boolean; flagships?: ReadonlySet<string> };

const CHINESE = /中英|中文|华人|华裔|普通话|国语|粤语|中华|中秋|Chinese|Mandarin|Cantonese/i;
const FAMILY = /亲子|家庭|全龄|全年龄|所有年龄|儿童|长者|长辈/;
// 18/21+ audiences only; a drinks note such as 饮酒21+ does not make the event adult-only.
const ADULT_ONLY = /(?:^|[^酒饮])(?:18|21)\s*(?:岁及?以上|\+)/;

export const isAdultOnly = (event: MonthlyEvent): boolean => event.audience.some(label => ADULT_ONLY.test(label));

export function scoreWeekendEvent(event: MonthlyEvent, { hasPhoto = () => false, flagships = new Set<string>() }: WeekendRankingOptions = {}): number {
  let score = 0;
  if (CHINESE.test([event.title, ...(event.aliases || []), ...event.audience].join(' '))) score += 3;
  score += event.cost === 'free' ? 2 : event.cost === 'mixed' ? 1 : event.cost === 'unknown' ? -1 : 0;
  if (event.category === 'family' || event.audience.some(label => FAMILY.test(label))) score += 2;
  if (hasPhoto(event.imageKey)) score += 2;
  if (flagships.has(event.id)) score += 2;
  return score;
}

// FNV-1a over "weekend:id": equal scores rotate from one weekend to the next
// instead of following the alphabet or the end date.
const weekendHash = (text: string): number => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index++) hash = Math.imul(hash ^ text.charCodeAt(index), 0x01000193) >>> 0;
  return hash;
};

/** Highest score first, then the most recently checked, then a per-weekend hash. Adult-only events go last. */
export function rankWeekendFallback<T extends WeekendEntry>(entries: readonly T[], weekendStart: string, options: WeekendRankingOptions = {}): T[] {
  const keyed = entries.map(entry => ({ entry, adult: isAdultOnly(entry.event), score: scoreWeekendEvent(entry.event, options), hash: weekendHash(`${weekendStart}:${entry.event.id}`) }));
  return keyed.sort((a, b) => Number(a.adult) - Number(b.adult) || b.score - a.score
    || b.entry.event.verifiedAt.localeCompare(a.entry.event.verifiedAt) || a.hash - b.hash
    // Only a hash collision reaches the id; it keeps the order independent of input order.
    || a.entry.event.id.localeCompare(b.entry.event.id)).map(({ entry }) => entry);
}

/** Fills `count` slots: one per region not yet shown first, then by rank. Adult-only events only when nothing else is left. */
export function selectWeekendFallback<T extends WeekendEntry>(entries: readonly T[], { weekendStart, count, usedRegions = [], ...options }: WeekendRankingOptions & { weekendStart: string; count: number; usedRegions?: readonly MonthlyRegion[] }): T[] {
  const ranked = rankWeekendFallback(entries, weekendStart, options);
  const selected: T[] = [];
  for (const tier of [ranked.filter(entry => !isAdultOnly(entry.event)), ranked.filter(entry => isAdultOnly(entry.event))]) {
    for (const entry of tier) if (selected.length < count && ![...usedRegions, ...selected.map(pick => pick.event.region)].includes(entry.event.region)) selected.push(entry);
    for (const entry of tier) if (selected.length < count && !selected.includes(entry)) selected.push(entry);
  }
  return selected;
}
