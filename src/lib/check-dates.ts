import { readerMonthDay } from './event-facts';

/**
 * The check dates a list header states (H02 / EVT13-04, HOMEIA13-09): the day most of the listed items were last checked against
 * their official pages (`verifiedAt`, never the monitor) and the most recent one, instead of the edition's date, which said 10/7 above
 * a weekend whose 73 events were mostly checked on 9/29. Only real dates on or before today count. `earliest` tells a list that
 * was all checked on one day from one whose most common day is merely the latest (snapshots written before it lack it).
 */
export type CheckSummary = { mostly: string; latest: string; earliest?: string };

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const monthDay = (day: string) => readerMonthDay(day);
/** The English line writes days in US style ("mostly checked Sep 29 · latest Oct 12"). */
const usDay = (day: string) => readerMonthDay(day, true);

export function checkSummary(dates: readonly (string | undefined)[], today: string): CheckSummary | null {
  const counts = new Map<string, number>();
  for (const day of dates) if (day && DAY.test(day) && day <= today) counts.set(day, (counts.get(day) ?? 0) + 1);
  if (!counts.size) return null;
  const days = [...counts.keys()].sort();
  // The most common day; on a tie the later one (the reader's list is no older than that).
  const mostly = days.reduce((best, day) => counts.get(day)! >= counts.get(best)! ? day : best, days[0]);
  return { mostly, latest: days[days.length - 1], earliest: days[0] };
}

/**
 * "多数核对于 9/29 · 最近 10/12"; "多数核对于 10/15 · 最早 9/28" when most were checked on the latest day but not all of them;
 * "核对于 10/12" only when every listed item was checked that one day. English in US style: "mostly checked Sep 29 · latest Oct 12".
 */
export function checkLine(summary: CheckSummary, t: (zh: string, en: string) => string): string {
  const { mostly, latest } = summary;
  const earliest = summary.earliest ?? mostly;
  if (earliest === latest) return t(`核对于 ${monthDay(latest)}`, `checked ${usDay(latest)}`);
  if (mostly === latest) return t(`多数核对于 ${monthDay(mostly)} · 最早 ${monthDay(earliest)}`, `mostly checked ${usDay(mostly)} · earliest ${usDay(earliest)}`);
  return t(`多数核对于 ${monthDay(mostly)} · 最近 ${monthDay(latest)}`, `mostly checked ${usDay(mostly)} · latest ${usDay(latest)}`);
}
