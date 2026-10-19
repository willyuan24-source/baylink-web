import { eventDateChip, eventWhenLine, readerMonthDay, type Copy, type EventFactsInput } from '../../lib/event-facts';
import type { IndexEvent } from './events-index-types';

/**
 * Line 1 in a one-day list (UI9-EVENTS content arrangement §3: a single day chip, a calendar day, a day group): the day is
 * already in the chip or the head above, so the line prints the time window only ("11:00–16:00" / "11am–4pm"). A long run
 * (a week or more, no listed days) reads "至 12/6" / "Through Dec 6", with its hours when that day has one window. A day
 * with no stated time keeps eventWhenLine's date ("周一 10/19"), so the line is never empty. event-facts.ts is frozen
 * after UI9-C, so this helper lives here.
 */
export function dayWhenLine(event: IndexEvent, today: string, day: string): Copy {
  const facts = event as unknown as EventFactsInput;
  const full = eventWhenLine(facts, today, [day]);
  const chip = eventDateChip(facts, today, [day]);
  if (chip.kind !== 'day' || chip.date !== day) return full;
  const time = (line: string) => line.split(' · ')[1];
  const long = event.occurrenceDates === undefined && !event.sessions?.length && daysBetween(event.startDate, event.endDate) > 6 && event.endDate > day;
  if (long) {
    const until: Copy = { zh: `至 ${readerMonthDay(event.endDate)}`, en: `Through ${readerMonthDay(event.endDate, true)}` };
    return { zh: time(full.zh) ? `${until.zh} · ${time(full.zh)}` : until.zh, en: time(full.en) ? `${until.en} · ${time(full.en)}` : until.en };
  }
  return { zh: time(full.zh) ?? full.zh, en: time(full.en) ?? full.en };
}

const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000);
