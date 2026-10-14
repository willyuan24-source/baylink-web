import { eventTimeLabel, weekdayOf, type EventFactsInput } from '../../lib/event-facts';

/**
 * H58 (EVT13-12): the 何时 cell of the facts card, short enough that the card ends above the phone's action bar. Sessions
 * that share a time collapse into one line ("周六 10/17、10/24、10/31 · 08:30–12:00"); at most two lines show, then
 * "另有 N 场". Nothing is invented: every date shown is a session date, every time the record's own (eventTimeLabel).
 *
 * One line per time, in the order of its first date. Its dates, compact and never guessed:
 * - one weekday for all (≤3 dates): "周六 10/17、10/24、10/31"; strictly weekly and more: "每周六 10/17–11/28"
 * - consecutive days: "周四至周日 10/15–18" (alone) or "10/22–25" (among others)
 * - otherwise up to three dates or runs, then "等 5 场" (en "+ 2 more") for the rest of that line
 */
export const MAX_SESSION_LINES = 2;
const MAX_ITEMS = 3;
const WEEKDAYS_ZH = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const WEEKDAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_MS = 86_400_000;

const monthDay = (day: string) => `${Number(day.slice(5, 7))}/${Number(day.slice(8, 10))}`;
const dayIndex = (day: string) => Math.round(Date.parse(`${day}T12:00:00Z`) / DAY_MS);
/** "10/15–18" in one month, "10/30–11/1" across two. */
const span = (start: string, end: string) => `${monthDay(start)}–${start.slice(0, 7) === end.slice(0, 7) ? Number(end.slice(8, 10)) : monthDay(end)}`;

type Item = { days: string[] };
/** Consecutive calendar days become one run. */
function runs(days: readonly string[]): Item[] {
  const items: Item[] = [];
  for (const day of days) {
    const last = items.at(-1);
    if (last && dayIndex(day) - dayIndex(last.days.at(-1)!) === 1) last.days.push(day);
    else items.push({ days: [day] });
  }
  return items;
}

export type SessionLines = { lines: string[]; more: number };

/** The 何时 lines for an event's session days on or after `today` (all of them when none is left), and the days not shown. */
export function sessionLines(event: Pick<EventFactsInput, 'sessions' | 'planning'>, today: string, english: boolean): SessionLines {
  const weekdays = english ? WEEKDAYS_EN : WEEKDAYS_ZH;
  const all = [...new Set((event.sessions ?? []).map(session => session.date))].sort();
  const upcoming = all.filter(day => day >= today);
  const days = upcoming.length ? upcoming : all;
  // One group per time, in the order of its first date (the days are sorted).
  const groups = new Map<string, string[]>();
  for (const day of days) {
    const time = eventTimeLabel(event, day, english) ?? '';
    groups.set(time, [...(groups.get(time) ?? []), day]);
  }
  const join = (parts: string[]) => parts.join(english ? ', ' : '、');
  const format = (group: string[]): string => {
    const weekday = weekdayOf(group[0]);
    const sameWeekday = group.every(day => weekdayOf(day) === weekday);
    const weekly = group.length > MAX_ITEMS && group.every((day, index) => !index || dayIndex(day) - dayIndex(group[index - 1]) === 7);
    if (weekly) return english ? `Every ${weekdays[weekday]} ${span(group[0], group.at(-1)!)}` : `每${weekdays[weekday]} ${span(group[0], group.at(-1)!)}`;
    const items = runs(group);
    if (items.length === 1 && group.length > 1) {
      const range = english ? `${weekdays[weekday]}–${weekdays[weekdayOf(group.at(-1)!)]}` : `${weekdays[weekday]}至${weekdays[weekdayOf(group.at(-1)!)]}`;
      return `${range} ${span(group[0], group.at(-1)!)}`;
    }
    const shown = items.slice(0, MAX_ITEMS);
    const listed = shown.reduce((sum, item) => sum + item.days.length, 0);
    const text = join(shown.map(item => item.days.length > 1 ? span(item.days[0], item.days.at(-1)!) : monthDay(item.days[0])));
    const prefix = sameWeekday && items.every(item => item.days.length === 1) ? `${weekdays[weekday]} ` : '';
    const rest = group.length - listed;
    return `${prefix}${text}${rest > 0 ? english ? ` + ${rest} more` : ` 等 ${group.length} 场` : ''}`;
  };
  const entries = [...groups.entries()];
  const lines = entries.slice(0, MAX_SESSION_LINES).map(([time, group]) => time ? `${format(group)} · ${time}` : format(group));
  const more = entries.slice(MAX_SESSION_LINES).reduce((sum, [, group]) => sum + group.length, 0);
  return { lines, more };
}
