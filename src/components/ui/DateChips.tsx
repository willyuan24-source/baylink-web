import { useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import './select.css';
import { FilterChip, ChipRow } from './Chip';
import { IconButton } from './Button';
import { Sheet } from './Sheet';
import { cx, useUiCopy } from './ui-copy';
import { DAY, dateWords, iso, monthGrid, parse } from './date-words';

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

/**
 * The one date picker for the form lanes (UI9-R1): three quick chips — 今天 · 本周末 · 未来 7 天 — and a fourth that opens a
 * localized month sheet (the site's Sheet: bottom sheet on phones, drawer on desktops). The fourth chip shows the chosen
 * day in words. No <input type=date>, so no mm/dd/yyyy. Chips are the ui-chip look; the selected day is the one selected
 * pair (--selected-bg / --selected-fg). Route-local: import it from a lazily loaded form, never from the entry.
 */
export function DateChips({ value, onChange, today, label, max, className }: DateChipsProps) {
  const { locale, t } = useUiCopy();
  const words = useMemo(() => dateWords(locale), [locale]);
  const weekdays = useMemo(() => ({ narrow: words.weekdays(), long: words.weekdays('long') }), [words]);
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
        <thead><tr>{weekdays.narrow.map((name, index) => <th key={index} scope="col" abbr={weekdays.long[index]}>{name}</th>)}</tr></thead>
        <tbody>{monthGrid(shown.year, shown.month).map((week, row) => <tr key={row}>{week.map((day, column) => <td key={column}>
          {day && <button type="button" className="ui-date-grid__day" aria-label={words.full(day)} aria-pressed={day === chosen}
            aria-current={day === today ? 'date' : undefined} disabled={day < today || day > last}
            onClick={() => { onChange({ kind: 'date', date: day }); setOpen(false); }}>{Number(day.slice(8))}</button>}
        </td>)}</tr>)}</tbody>
      </table>
    </Sheet>
  </>;
}
