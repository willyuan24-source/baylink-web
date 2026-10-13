/**
 * The check dates a list header states (H02 / EVT13-04, HOMEIA13-09): the day most of the listed items were last checked by
 * an editor (`verifiedAt`, never the monitor) and the most recent one, instead of the edition's date, which said 10/7 above
 * a weekend whose 73 events were mostly checked on 9/29. Only real dates on or before today count.
 */
export type CheckSummary = { mostly: string; latest: string };

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const monthDay = (day: string) => `${Number(day.slice(5, 7))}/${Number(day.slice(8, 10))}`;

export function checkSummary(dates: readonly (string | undefined)[], today: string): CheckSummary | null {
  const counts = new Map<string, number>();
  for (const day of dates) if (day && DAY.test(day) && day <= today) counts.set(day, (counts.get(day) ?? 0) + 1);
  if (!counts.size) return null;
  const days = [...counts.keys()].sort();
  // The most common day; on a tie the later one (the reader's list is no older than that).
  const mostly = days.reduce((best, day) => counts.get(day)! >= counts.get(best)! ? day : best, days[0]);
  return { mostly, latest: days[days.length - 1] };
}

/** "多数核对于 9/29 · 最近 10/12", or "核对于 10/12" when they are one day. */
export function checkLine(summary: CheckSummary, t: (zh: string, en: string) => string): string {
  const { mostly, latest } = summary;
  return mostly === latest ? t(`核对于 ${monthDay(latest)}`, `checked ${monthDay(latest)}`)
    : t(`多数核对于 ${monthDay(mostly)} · 最近 ${monthDay(latest)}`, `mostly checked ${monthDay(mostly)} · latest ${monthDay(latest)}`);
}
