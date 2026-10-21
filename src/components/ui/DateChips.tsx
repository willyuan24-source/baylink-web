import { useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import './select.css';
import { FilterChip, ChipRow } from './Chip';
import { IconButton } from './Button';
import { Sheet } from './Sheet';
import { cx, useUiCopy } from './ui-copy';
import type { Locale } from '../../i18n/locale';

/** A date choice: one of the three quick ranges, or one day (YYYY-MM-DD, the Bay Area calendar day). */
export type DateChoice = { kind: 'today' } | { kind: 'weekend' } | { kind: 'next7' } | { kind: 'date'; date: string };

export type DateChipsProps = {
  value: DateChoice | null;
  onChange: (value: DateChoice) => void;
  /** Today as YYYY-MM-DD, from the caller (the chips never read the clock, so prerender and tests are stable). */
  today: string;
  /** The group's accessible name, e.g. 「什么时候」. */
  label: string;
  /** The last day the sheet offers (YYYY-MM-DD); default today + 90 days. Days before today are never offered. */
  max?: string;
  className?: string;
};

const DAY = 86_400_000;
const parse = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return Date.UTC(y, m - 1, d); };
const iso = (time: number) => new Date(time).toISOString().slice(0, 10);
const intlLocale = (locale: Locale) => locale === 'en' ? 'en-US' : locale === 'zh-Hant' ? 'zh-TW' : 'zh-CN';

/**
 * Localized date words, never mm/dd/yyyy: zh 「10月24日周六」 / 「2026年10月」, en "Sat, Oct 24" / "October 2026". Dates are
 * calendar days, formatted in UTC so no time zone can move them a day.
 */
export function dateWords(locale: Locale) {
  const tag = intlLocale(locale);
  const english = locale === 'en';
  const day = new Intl.DateTimeFormat(tag, { timeZone: 'UTC', month: english ? 'short' : 'long', day: 'numeric', weekday: 'short' });
  const full = new Intl.DateTimeFormat(tag, { timeZone: 'UTC', year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
  const month = new Intl.DateTimeFormat(tag, { timeZone: 'UTC', year: 'numeric', month: 'long' });
  const weekday = new Intl.DateTimeFormat(tag, { timeZone: 'UTC', weekday: 'narrow' });
  return {
    day: (value: string) => day.format(parse(value)),
    full: (value: string) => full.format(parse(value)),
    month: (year: number, monthIndex: number) => month.format(Date.UTC(year, monthIndex, 1)),
    /** Sunday first, as US calendars. */
    weekdays: () => Array.from({ length: 7 }, (_, index) => weekday.format(Date.UTC(2026, 0, 4 + index))),
  };
}

/** The weeks of one month (Sunday first), as YYYY-MM-DD or null for the blanks before the 1st and after the last day. */
export function monthGrid(year: number, monthIndex: number): (string | null)[][] {
  const first = Date.UTC(year, monthIndex, 1);
  const days = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const cells: (string | null)[] = [...Array(new Date(first).getUTCDay()).fill(null), ...Array.from({ length: days }, (_, index) => iso(first + index * DAY))];
  while (cells.length % 7) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, week) => cells.slice(week * 7, week * 7 + 7));
}

/**
 * The one date picker for the form lanes (UI9-R1): three quick chips — 今天 · 本周末 · 未来 7 天 — and a fourth that opens a
 * localized month sheet (the site's Sheet: bottom sheet on phones, drawer on desktops). The fourth chip shows the chosen
 * day in words. No <input type=date>, so no mm/dd/yyyy. Chips are the ui-chip look; the selected day is the one selected
 * pair (--selected-bg / --selected-fg). Route-local: import it from a lazily loaded form, never from the entry.
 */
export function DateChips({ value, onChange, today, label, max, className }: DateChipsProps) {
  const { locale, t } = useUiCopy();
  const words = useMemo(() => dateWords(locale), [locale]);
  const [open, setOpen] = useState(false);
  const last = max ?? iso(parse(today) + 90 * DAY);
  const chosen = value?.kind === 'date' ? value.date : undefined;
  const start = new Date(parse(chosen ?? today));
  const [shown, setShown] = useState({ year: start.getUTCFullYear(), month: start.getUTCMonth() });
  const todayMonth = new Date(parse(today));
  const lastMonth = new Date(parse(last));
  const canPrev = shown.year * 12 + shown.month > todayMonth.getUTCFullYear() * 12 + todayMonth.getUTCMonth();
  const canNext = shown.year * 12 + shown.month < lastMonth.getUTCFullYear() * 12 + lastMonth.getUTCMonth();
  const step = (delta: number) => setShown(({ year, month }) => { const next = new Date(Date.UTC(year, month + delta, 1)); return { year: next.getUTCFullYear(), month: next.getUTCMonth() }; });
  const quick: { kind: 'today' | 'weekend' | 'next7'; text: string }[] = [
    { kind: 'today', text: t('今天', 'Today') },
    { kind: 'weekend', text: t('本周末', 'This weekend') },
    { kind: 'next7', text: t('未来 7 天', 'Next 7 days') },
  ];
  const sheetTitle = t('选日期', 'Pick a date');
  return <>
    <ChipRow label={label} className={cx('ui-date-chips', className)}>
      {quick.map(chip => <FilterChip key={chip.kind} selected={value?.kind === chip.kind} onClick={() => onChange({ kind: chip.kind })}>{chip.text}</FilterChip>)}
      <FilterChip selected={!!chosen} aria-haspopup="dialog" icon={<CalendarDays aria-hidden="true" strokeWidth={1.75} />}
        onClick={() => { const at = new Date(parse(chosen ?? today)); setShown({ year: at.getUTCFullYear(), month: at.getUTCMonth() }); setOpen(true); }}>
        {chosen ? words.day(chosen) : t('选日期', 'Pick a date')}
      </FilterChip>
    </ChipRow>
    <Sheet open={open} onClose={() => setOpen(false)} title={sheetTitle} className="ui-date-sheet">
      <div className="ui-date-sheet__nav">
        <IconButton label={t('上个月', 'Previous month')} disabled={!canPrev} onClick={() => step(-1)}><ChevronLeft aria-hidden="true" strokeWidth={1.75} /></IconButton>
        <p className="ui-date-sheet__month" aria-live="polite">{words.month(shown.year, shown.month)}</p>
        <IconButton label={t('下个月', 'Next month')} disabled={!canNext} onClick={() => step(1)}><ChevronRight aria-hidden="true" strokeWidth={1.75} /></IconButton>
      </div>
      <table className="ui-date-grid" aria-label={words.month(shown.year, shown.month)}>
        <thead><tr>{words.weekdays().map((name, index) => <th key={index} scope="col" abbr={name}>{name}</th>)}</tr></thead>
        <tbody>{monthGrid(shown.year, shown.month).map((week, row) => <tr key={row}>{week.map((day, column) => <td key={column}>
          {day && <button type="button" className="ui-date-grid__day" aria-label={words.full(day)} aria-pressed={day === chosen}
            aria-current={day === today ? 'date' : undefined} disabled={day < today || day > last}
            onClick={() => { onChange({ kind: 'date', date: day }); setOpen(false); }}>{Number(day.slice(8))}</button>}
        </td>)}</tr>)}</tbody>
      </table>
    </Sheet>
  </>;
}
