import { displayUnits, eventTimeLabel, weekdayOf, type EventFactsInput } from '../../lib/event-facts';

/**
 * H58 (EVT13-12): the 何时 cell of the facts card, short enough that the card ends above the phone's action bar. Sessions
 * that share a time collapse into one line ("周六 10/17、10/24、10/31 · 08:30–12:00"); at most two lines show, then
 * "另有 N 场". Nothing is invented: every date shown is a session date, every time the record's own (eventTimeLabel).
 *
 * One line per time, in the order of its first date. Its dates, compact and never guessed:
 * - one weekday for all: "周六 10/17、10/24、10/31"; strictly weekly and four or more: "每周六 10/17–11/28"
 * - consecutive days: "周四至周日 10/15–18" (alone; a week or more is "每天 10/15–24") or "10/22–25" (among others)
 * - otherwise as many dates or runs as fit one phone line with the time (LINE_BUDGET); a later date in the same month drops
 *   its month only when that lets more dates show ("10/15、21、24、27、30"); the rest of the line is "等 8 场" (en "+ 2 more")
 * Counts are days: a line whose days each have several times ("11:30、13:30、14:30") says "等 6 天", not 场, and
 * `moreDays` tells the card to say "另有 N 天" for the same reason.
 */
export const MAX_SESSION_LINES = 2;
/** Display units (CJK 1, other ½) of one line, dates and time: the 390px facts card's 326px at the 17px reading size. */
const LINE_BUDGET = 19;
const WEEKLY_MIN = 4;
/** A run of this many days or more is "每天 10/15–24": "周四至周三 10/15–21" would read as a range of weekdays. */
const DAILY_MIN = 7;
const WEEKDAYS_ZH = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const WEEKDAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_MS = 86_400_000;

const monthDay = (day: string) => `${Number(day.slice(5, 7))}/${Number(day.slice(8, 10))}`;
const dayIndex = (day: string) => Math.round(Date.parse(`${day}T12:00:00Z`) / DAY_MS);
/** "10/15–18" in one month, "10/30–11/1" across two. */
const span = (start: string, end: string) => `${monthDay(start)}–${start.slice(0, 7) === end.slice(0, 7) ? Number(end.slice(8, 10)) : monthDay(end)}`;

/** Consecutive calendar days become one run. */
function runs(days: readonly string[]): string[][] {
  const items: string[][] = [];
  for (const day of days) {
    const last = items.at(-1);
    if (last && dayIndex(day) - dayIndex(last.at(-1)!) === 1) last.push(day);
    else items.push([day]);
  }
  return items;
}

export type SessionLines = { lines: string[]; more: number; moreDays?: true };

/** The 何时 lines for an event's session days on or after `today` (all of them when none is left), and the days not shown. */
export function sessionLines(event: Pick<EventFactsInput, 'sessions' | 'planning'>, today: string, english: boolean): SessionLines {
  const weekdays = english ? WEEKDAYS_EN : WEEKDAYS_ZH;
  const all = [...new Set((event.sessions ?? []).map(session => session.date))].sort();
  const upcoming = all.filter(day => day >= today);
  const days = upcoming.length ? upcoming : all;
  const perDay = new Map<string, number>();
  for (const session of event.sessions ?? []) perDay.set(session.date, (perDay.get(session.date) ?? 0) + 1);
  /** Some of these days have several sessions, so a count of them is days (天), not sessions (场). */
  const several = (group: readonly string[]) => group.some(day => (perDay.get(day) ?? 0) > 1);
  // One group per time, in the order of its first date (the days are sorted).
  const groups = new Map<string, string[]>();
  for (const day of days) {
    const time = eventTimeLabel(event, day, english) ?? '';
    groups.set(time, [...(groups.get(time) ?? []), day]);
  }
  const separator = english ? ', ' : '、';
  /** The first `count` items as text; `short` drops the month of a single date that follows one in the same month. */
  const listed = (items: string[][], count: number, short: boolean) => items.slice(0, count).map((item, index) => {
    if (item.length > 1) return span(item[0], item.at(-1)!);
    const previous = items[index - 1]?.at(-1);
    return short && previous && previous.slice(0, 7) === item[0].slice(0, 7) ? String(Number(item[0].slice(8, 10))) : monthDay(item[0]);
  }).join(separator);
  const format = (group: string[], time: string): string => {
    const at = time ? ` · ${time}` : '';
    const first = group[0], last = group.at(-1)!;
    const weekday = weekdayOf(first);
    if (group.length >= WEEKLY_MIN && group.every((day, index) => !index || dayIndex(day) - dayIndex(group[index - 1]) === 7)) {
      return `${english ? `Every ${weekdays[weekday]}` : `每${weekdays[weekday]}`} ${span(first, last)}${at}`;
    }
    const items = runs(group);
    if (items.length === 1 && group.length >= DAILY_MIN) return `${english ? 'Daily' : '每天'} ${span(first, last)}${at}`;
    if (items.length === 1 && group.length > 1) {
      return `${english ? `${weekdays[weekday]}–${weekdays[weekdayOf(last)]}` : `${weekdays[weekday]}至${weekdays[weekdayOf(last)]}`} ${span(first, last)}${at}`;
    }
    const prefix = items.every(item => item.length === 1) && group.every(day => weekdayOf(day) === weekday) ? `${weekdays[weekday]} ` : '';
    const line = (count: number, short: boolean) => {
      const rest = group.length - items.slice(0, count).reduce((sum, item) => sum + item.length, 0);
      return `${prefix}${listed(items, count, short)}${rest > 0 ? english ? ` + ${rest} more` : ` 等 ${group.length} ${several(group) ? '天' : '场'}` : ''}${at}`;
    };
    /** The most items that fit one line (at least one); the full list has no count, so it can fit where a shorter one does not. */
    const fitting = (short: boolean) => {
      let count = items.length;
      while (count > 1 && displayUnits(line(count, short)) > LINE_BUDGET) count--;
      return count;
    };
    const full = fitting(false);
    const short = full < items.length && fitting(true) > full;
    return line(short ? fitting(true) : full, short);
  };
  const entries = [...groups.entries()];
  const lines = entries.slice(0, MAX_SESSION_LINES).map(([time, group]) => format(group, time));
  const hidden = entries.slice(MAX_SESSION_LINES).flatMap(([, group]) => group);
  return { lines, more: hidden.length, ...(several(hidden) ? { moreDays: true as const } : {}) };
}
