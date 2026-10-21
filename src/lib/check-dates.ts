import { readerMonthDay } from './event-facts';

/**
 * The check dates a list header states (H02 / EVT13-04, HOMEIA13-09): the day most of the listed items were last checked against
 * their official pages (`verifiedAt`, never the monitor) and the most recent one, instead of the edition's date, which said 10/7 above
 * a weekend whose 73 events were mostly checked on 9/29. Only real dates on or before today count. `earliest` tells a list that
 * was all checked on one day from one whose most common day is merely the latest (snapshots written before it lack it).
 */
export type CheckSummary = {
  mostly: string;
  latest: string;
  earliest?: string;
  /** false when some listed item was checked on another day, or has no check date: the line then never says one date for all. */
  all?: boolean;
};

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const monthDay = (day: string) => readerMonthDay(day);
/** The English line writes days in US style ("mostly checked Sep 29 · latest Oct 12"). */
const usDay = (day: string) => readerMonthDay(day, true);

export function checkSummary(dates: readonly (string | undefined)[], today: string): CheckSummary | null {
  const counts = new Map<string, number>();
  let counted = 0;
  for (const day of dates) if (day && DAY.test(day) && day <= today) { counts.set(day, (counts.get(day) ?? 0) + 1); counted++; }
  if (!counts.size) return null;
  const days = [...counts.keys()].sort();
  // The most common day; on a tie the later one (the reader's list is no older than that).
  const mostly = days.reduce((best, day) => counts.get(day)! >= counts.get(best)! ? day : best, days[0]);
  return { mostly, latest: days[days.length - 1], earliest: days[0], all: counts.size === 1 && counted === dates.length };
}

/**
 * "多数核对于 9/29 · 最近 10/12"; "多数核对于 10/15 · 最早 9/28" when most were checked on the latest day but not all of them;
 * "核对于 10/12" only when every listed item was checked that one day; "多数核对于 10/15" when every dated item shares the day but
 * some item has no check date (or one after today). English in US style: "mostly checked Sep 29 · latest Oct 12".
 */
export function checkLine(summary: CheckSummary, t: (zh: string, en: string) => string): string {
  const { mostly, latest } = summary;
  const earliest = summary.earliest ?? mostly;
  if (earliest === latest) {
    // One date among the dated items, but not every item shares it (no date, or a date after today): "多数核对于 10/15".
    return summary.all === false ? t(`多数核对于 ${monthDay(latest)}`, `mostly checked ${usDay(latest)}`)
      : t(`核对于 ${monthDay(latest)}`, `checked ${usDay(latest)}`);
  }
  if (mostly === latest) return t(`多数核对于 ${monthDay(mostly)} · 最早 ${monthDay(earliest)}`, `mostly checked ${usDay(mostly)} · earliest ${usDay(earliest)}`);
  return t(`多数核对于 ${monthDay(mostly)} · 最近 ${monthDay(latest)}`, `mostly checked ${usDay(mostly)} · latest ${usDay(latest)}`);
}

/**
 * One wording for the site's promise (UI9-HOME, G12): HOME's masthead and trust line, EVENTS' facts line and NAV's footer
 * print these. SITE_IDENTITY, FREE_NO_SIGN_IN and METHOD_HREF live in lib/site-promise.ts, which the shell loads (one copy
 * in the entry); OFFICIAL_LINKS is said only by the home and the events pages. METHOD_HREF is the only "我们怎么核对" target
 * (AboutContent.tsx, decision 10). FREE_NO_SIGN_IN is printed only because a guest can browse, ♡ save (kept in the browser)
 * and ask BayBay (guest mode).
 */
export { FREE_NO_SIGN_IN, METHOD_HREF, SITE_IDENTITY } from './site-promise';
export const OFFICIAL_LINKS = { zh: '每条附官方链接', en: 'An official link on every item' } as const;

/**
 * The same dates said as checks against the official pages (UI9-PREP; HOME's trust line, EVENTS' lede): 官网核对, never
 * 人工核对. `order: 'lead'` (the default) leads with it, like a card's "官网核对 10/2": "官网核对 10/15" (every item that day),
 * "官网核对 多数 10/15" (one dated day, some item undated), "官网核对 多数 10/15 · 最早 9/28", "官网核对 多数 9/29 · 最近 10/12".
 * `order: 'trail'` puts it after the main date: "10/15 官网核对", "多数 10/15 官网核对 · 最早 9/28". English reads the same
 * either way, in US style: "Source checked Oct 15", "Source checked: mostly Sep 29 · latest Oct 12".
 */
export function officialCheckLine(summary: CheckSummary, t: (zh: string, en: string) => string, { order = 'lead' }: { order?: 'lead' | 'trail' } = {}): string {
  const { mostly, latest } = summary;
  const earliest = summary.earliest ?? mostly;
  const zh = (main: string, extra = '') => order === 'trail' ? `${main} 官网核对${extra}` : `官网核对 ${main}${extra}`;
  if (earliest === latest) {
    return summary.all === false ? t(zh(`多数 ${monthDay(latest)}`), `Source checked: mostly ${usDay(latest)}`)
      : t(zh(monthDay(latest)), `Source checked ${usDay(latest)}`);
  }
  if (mostly === latest) return t(zh(`多数 ${monthDay(mostly)}`, ` · 最早 ${monthDay(earliest)}`), `Source checked: mostly ${usDay(mostly)} · earliest ${usDay(earliest)}`);
  return t(zh(`多数 ${monthDay(mostly)}`, ` · 最近 ${monthDay(latest)}`), `Source checked: mostly ${usDay(mostly)} · latest ${usDay(latest)}`);
}
