import type { CSSProperties } from 'react';
import { TypeFrame, latinLang, type CoverLayout } from './CoverImage';
import { useUiCopy } from './ui-copy';
import { translateText } from '../../i18n/locale';
import { chooseCover } from '../../lib/cover-family';
import { displayUnits, eventDateChip, eventPlace, eventPriceChip, eventTimeWindow, eventTone, eventWhenLine, formatDateChip, type DateChipText, type EventFactsInput } from '../../lib/event-facts';

// The date family's faces (UI9-C), split from cover-date.tsx (UI9-IMG-A0) so a production page loads them after the page:
// cover-date.tsx's EventTypeCover is the deferred wrapper every page uses. UI9-IMAGES DECISIONS 21 retires the family from
// cards and heroes in A1.

/** The 6–24 h bar (G20): the window's start and length as shares of 18 hours. */
function TimeBar({ open, close }: { open: number; close: number }) {
  const at = (minutes: number) => Math.min(1, Math.max(0, (minutes - 360) / 1080));
  const style = { '--tb-from': `${(at(open) * 100).toFixed(1)}%`, '--tb-span': `${((at(close) - at(open)) * 100).toFixed(1)}%` } as CSSProperties;
  return <div aria-hidden="true">
    <div className="tc-bar" style={style}><b /></div>
    <p className="tc-bar__ticks tc-num">{[6, 12, 18, 24].map(hour => <span key={hour}>{hour}</span>)}</p>
  </div>;
}

export type DateFaceProps = { day: DateChipText; time?: string; bar?: { open: number; close: number }; eyebrow?: string; thumb?: string; mini: boolean };
/** Family date: the venue, an upright calendar page (weekday band in the category's deep shade, the day, the time), the bar. */
export function DateFace({ day, time, bar, eyebrow, thumb, mini }: DateFaceProps) {
  if (mini) return <p className="tc-thumb tc-num">{thumb || day.label}</p>;
  return <>
    {eyebrow && <p className="tc-eyebrow" lang={latinLang(eyebrow)}>{eyebrow}</p>}
    <p className="tc-cal">
      {day.small && <span className="tc-cal__top">{day.small}</span>}
      <span className="tc-cal__day tc-num">{day.big || day.label}</span>
      {time && <span className="tc-cal__time tc-num">{time}</span>}
    </p>
    {bar && <TimeBar {...bar} />}
  </>;
}

/**
 * Family date (events): the venue, the calendar page (weekday, day, time) and, when the page shows one day with one
 * structured window, the 6–24 h bar (G20). A thumbnail shows the time (the row already prints the date), else the city, else
 * the price. The caption prints the title, so the cover never does.
 */
export function EventTypeCover({ event, today, days, ...layout }: CoverLayout & { event: EventFactsInput; today: string; days?: readonly string[] }) {
  const { english, pick, locale } = useUiCopy();
  const chip = eventDateChip(event, today, days);
  const zh = formatDateChip(chip, false);
  const day = english ? formatDateChip(chip, true) : { ...zh, small: translateText(zh.small, locale), label: translateText(zh.label, locale) };
  const [, time] = chip.kind === 'day' ? pick(eventWhenLine(event, today, days)).split(' · ') : [];
  const place = translateText(eventPlace(event), locale);
  const price = eventPriceChip(event);
  // A thumbnail's key fact: the time (the row prints the date), else the venue or the city when it fits the tile at 特大 /
  // 家人版 (short, and no Latin word over 9 letters: "Library / Parks and Recreation Center" would clip, "Pleasanton" would break
  // mid-word), else the price, else the date label (DateFace). A row of free events must not repeat "免费" when it has a place.
  const fits = (text: string) => !!text && displayUnits(text) <= 8 && !/[A-Za-z]{10}/.test(text);
  const thumb = time || [place, translateText(event.city, locale)].find(fits) || (price ? pick(price.text) : '');
  const choice = chooseCover('event', { tier: 'type' }, { id: event.id, date: day.label, time, place });
  return <TypeFrame {...layout} {...choice} keyFact={layout.size === 'mini' ? thumb : choice.keyFact} kind="event" tone={eventTone(event)}>
    <DateFace day={day} time={time} bar={chip.kind === 'day' ? eventTimeWindow(event, chip.date) : undefined} eyebrow={place} thumb={thumb} mini={layout.size === 'mini'} />
  </TypeFrame>;
}
