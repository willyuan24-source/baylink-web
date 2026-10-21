import { useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button, ChipRow, FilterChip, IconButton, Sheet } from '../../components/ui';
import { useUiCopy } from '../../components/ui/ui-copy';
import { calendarCells, calendarPeriod, shiftCalendarPeriod, validCalendarDay } from '../../lib/calendar-days';
import { nextOccurrence } from '../../lib/monthly';
import { ALL_REGIONS, REGIONS, saveRegion, WEEKDAYS } from './events-model';
import { useIndexEvents } from './events-later';
import type { MonthlyRegion } from './events-index-types';

export type CalendarSheetProps = {
  open: boolean; onClose: () => void;
  date: string; today: string; region: MonthlyRegion | 'all';
  /** CalendarView's URL update (a date is its own history entry, a region replaces it). */
  update: (values: Record<string, string>) => void;
  /** The polite status line and the footer's primary label (看 10/19 的 9 场). */
  status: string; done: string;
  longDate: (day: string) => string;
  /** The day's cities by count, the chosen one, and how the sheet names a city ("圣何塞 San Jose"). */
  cities: string[]; city: string; onCity: (name: string) => void; cityLabel: (name: string) => string;
};

/**
 * The calendar's 选日期、地区和城市 sheet (CalendarView): the month grid (its weeks load when the sheet opens; dots appear
 * once they are in), the region and the day's cities. Its own chunk, loaded when the page is idle or the sheet first opens,
 * so /calendar's first load leaves it out (UI9-EVENTS budgets).
 */
export default function CalendarSheet({ open, onClose, date, today, region, update, status, done, longDate, cities, city, onCity, cityLabel }: CalendarSheetProps) {
  const { t, pick, english } = useUiCopy();
  const cells = calendarCells(date, 'month');
  const month = useIndexEvents(cells[0], cells[cells.length - 1], open);
  const pool = useMemo(() => (month.events ?? []).filter(event => region === 'all' || event.region === region), [region, month.events]);
  const countOn = (day: string) => pool.filter(event => nextOccurrence(event, day) === day).length;
  const period = calendarPeriod(date, 'month');
  const monthLabel = english ? new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`)) : `${date.slice(0, 4)}年${Number(date.slice(5, 7))}月`;
  const shift = (step: number) => shiftCalendarPeriod(date, 'month', step);
  const setRegion = (value: MonthlyRegion | 'all') => { saveRegion(value); update({ region: value }); };

  return <Sheet open={open} onClose={onClose} title={t('选日期、地区和城市', 'Pick a date, region and city')} status={status}
    footer={<Button variant="primary" onClick={onClose}>{done}</Button>}>
    <section className="ev-sheet-section">
      <div className="ev-month__nav">
        <IconButton label={t('上个月', 'Previous month')} disabled={!validCalendarDay(shift(-1))} onClick={() => update({ date: shift(-1) })}><ChevronLeft aria-hidden="true" strokeWidth={1.75} /></IconButton>
        <h3 aria-live="polite">{monthLabel}</h3>
        <IconButton label={t('下个月', 'Next month')} disabled={!validCalendarDay(shift(1))} onClick={() => update({ date: shift(1) })}><ChevronRight aria-hidden="true" strokeWidth={1.75} /></IconButton>
      </div>
      <div className="ev-month" role="group" aria-label={monthLabel} aria-busy={!month.events && !month.failed ? true : undefined}>
        {[1, 2, 3, 4, 5, 6, 0].map(weekday => <span key={weekday} className="ev-month__weekday" aria-hidden="true">{pick(WEEKDAYS[weekday].char)}</span>)}
        {cells.map(day => {
          const count = countOn(day);
          const outside = day < period.start || day > period.end;
          return <button key={day} type="button" className="ev-month__day" aria-pressed={day === date} aria-current={day === today ? 'date' : undefined} data-outside={outside ? '' : undefined}
            aria-label={month.events ? `${longDate(day)} · ${t(`${count} 场`, `${count} events`)}` : longDate(day)} onClick={() => update({ date: day })}>
            <span className="ev-month__num" aria-hidden="true">{Number(day.slice(8, 10))}</span>
            <span className="ev-week__dot" aria-hidden="true" data-on={count ? '' : undefined} />
          </button>;
        })}
      </div>
      {/* Until the month's weeks are in, the grid has no dots: say so, so an empty grid does not read as "no events". */}
      {!month.events && <p className="ev-calendar__note" role="status">
        {month.failed ? <>{t('这个月的活动没能加载，日期仍可以选。', "This month's events did not load; you can still pick a date.")}{' '}
          <Button variant="text" onClick={month.retry}>{t('重试', 'Retry')}</Button></>
        : t('正在加载这个月的活动…', "Loading this month's events…")}
      </p>}
    </section>
    <section className="ev-sheet-section">
      <h3>{t('地区', 'Region')}</h3>
      <ChipRow label={t('地区', 'Region')}>
        <FilterChip selected={region === 'all'} onClick={() => setRegion('all')}>{pick(ALL_REGIONS)}</FilterChip>
        {REGIONS.map(item => <FilterChip key={item.id} selected={region === item.id} onClick={() => setRegion(item.id)}>{pick(item.label)}</FilterChip>)}
      </ChipRow>
    </section>
    {cities.length > 1 && <section className="ev-sheet-section">
      <h3>{t('当天的城市', 'Cities that day')}</h3>
      <ChipRow label={t('当天的城市', 'Cities that day')}>
        <FilterChip selected={!city} onClick={() => onCity('')}>{t('全部', 'All')}</FilterChip>
        {cities.map(name => <FilterChip key={name} selected={city === name} onClick={() => onCity(name)}>{cityLabel(name)}</FilterChip>)}
      </ChipRow>
    </section>}
  </Sheet>;
}
