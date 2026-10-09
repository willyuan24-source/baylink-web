import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button, ChipRow, EmptyState, FilterChip, IconButton, SegmentedControl, Sheet, SkeletonFeed } from '../../components/ui';
import { useUiCopy } from '../../components/ui/ui-copy';
import { translateText } from '../../i18n/locale';
import { useApp } from '../../app/context';
import { addCalendarDays, calendarCells, calendarPeriod, shiftCalendarPeriod, validCalendarDay } from '../../lib/calendar-days';
import { createCoverPage, resolveCovers } from '../../lib/cover';
import { nextOccurrence } from '../../lib/monthly';
import { ALL_REGIONS, EVENTS_INDEX, INDEX_EVENTS, REGIONS, coverContext, isRegion, monthDay, readSavedRegion, regionLabel, saveRegion } from './events-model';
import type { IndexEvent, MonthlyRegion } from './events-index-types';
import { EventRowCard } from './EventCards';
import { ChunkBoundary } from './ChunkBoundary';
import { retryableLazy } from './lazy-view';
import { ImageCredits } from './ImageCredits';

const calendarMap = retryableLazy(() => import('./CalendarMap'));
const WEEKDAY_ZH = ['日', '一', '二', '三', '四', '五', '六'];
const WEEKDAY_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const occursOn = (event: IndexEvent, day: string) => nextOccurrence(event, day) === day;
const weekdayOf = (day: string) => new Date(`${day}T12:00:00Z`).getUTCDay();

/**
 * 日历·地图 (design.md §4.11 ④; EVT-10): a 7-day week strip on screen 1 (weekday, date, a dot per day with events), the
 * month grid in a Sheet, the day's cities in one bilingual row ("圣何塞 San Jose"), image rows for the day, and a
 * 列表 | 地图 switch whose map loads only when opened.
 */
export default function CalendarView({ today }: { today: string }) {
  const { t, pick, english, locale } = useUiCopy();
  const app = useApp();
  const [params, setParams] = useSearchParams();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [mode, setMode] = useState<'list' | 'map'>('list');
  const [focus, setFocus] = useState<{ scope: string; city: string; ids?: string[]; point?: string }>({ scope: '', city: '' });
  const [savedRegion, setSavedRegion] = useState<MonthlyRegion>();
  useEffect(() => setSavedRegion(readSavedRegion()), []);
  const dateParam = params.get('date') || '';
  const date = validCalendarDay(dateParam) ? dateParam : today;
  const regionParam = params.get('region');
  const region: MonthlyRegion | 'all' = isRegion(regionParam) ? regionParam : regionParam === 'all' ? 'all' : savedRegion ?? 'all';
  const update = (values: Record<string, string>) => setParams(previous => {
    const next = new URLSearchParams(previous);
    for (const [key, value] of Object.entries(values)) next.set(key, value);
    if (values.date === today) next.delete('date');
    return next;
  }, { replace: true, preventScrollReset: true });

  const pool = useMemo(() => INDEX_EVENTS.filter(event => region === 'all' || event.region === region), [region]);
  const week = calendarPeriod(date, 'week').days;
  const countOn = (day: string) => pool.filter(event => occursOn(event, day)).length;
  const dayEvents = pool.filter(event => occursOn(event, date));
  const scope = `${date}:${region}`;
  const city = focus.scope === scope ? focus.city : '';
  const pointIds = focus.scope === scope ? focus.ids : undefined;
  const cities = [...new Set(dayEvents.map(event => event.city))].sort((a, b) => dayEvents.filter(event => event.city === b).length - dayEvents.filter(event => event.city === a).length || a.localeCompare(b));
  const shownEvents = dayEvents.filter(event => (!city || event.city === city) && (!pointIds || pointIds.includes(event.id)));
  const covers = resolveCovers(shownEvents.map(event => ({ kind: 'event' as const, id: event.id, imageKey: event.imageKey })), { ...coverContext(today), page: createCoverPage() });
  const nearest = pool.flatMap(event => { const day = nextOccurrence(event, date > today ? date : today); return day ? [day] : []; }).filter(day => day !== date).sort()[0];
  const past = date < today;
  const beforeIndex = date < EVENTS_INDEX.edition.checkedAt;

  const weekdayShort = (day: string) => (english ? WEEKDAY_EN : WEEKDAY_ZH)[weekdayOf(day)];
  const longDate = (day: string) => english ? new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${day}T12:00:00Z`))
    : `${Number(day.slice(5, 7))}月${Number(day.slice(8, 10))}日 周${WEEKDAY_ZH[weekdayOf(day)]}`;
  const cityLabel = (name: string) => {
    const zh = EVENTS_INDEX.cityNames[name];
    return english || !zh ? name : `${translateText(zh, locale)} ${name}`;
  };
  const askAboutDay = () => {
    const area = region === 'all' ? t('湾区', 'the Bay Area') : pick(regionLabel(region));
    app?.openBayBay(t(`请帮我安排 ${date} 在${area}${city ? ` · ${city}` : ''}的出游。`, `Help me plan an outing on ${date} in ${area}${city ? ` · ${city}` : ''}.`), { mode: 'draft' });
  };
  const period = calendarPeriod(date, 'month');
  const monthLabel = english ? new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`)) : `${date.slice(0, 4)}年${Number(date.slice(5, 7))}月`;

  return <section className="ev-calendar" aria-labelledby="ev-calendar-day">
    <div className="ev-week" role="group" aria-label={t('这一周', 'This week')}>
      <IconButton label={t('上一周', 'Previous week')} onClick={() => update({ date: addCalendarDays(date, -7) })}><ChevronLeft aria-hidden="true" strokeWidth={1.75} /></IconButton>
      <ol className="ev-week__days">{week.map(day => {
        const count = countOn(day);
        return <li key={day}><button type="button" className="ev-week__day" aria-pressed={day === date} aria-current={day === today ? 'date' : undefined}
          aria-label={`${longDate(day)} · ${t(`${count} 场`, `${count} ${count === 1 ? 'event' : 'events'}`)}`} onClick={() => update({ date: day })} data-past={day < today ? '' : undefined}>
          <span className="ev-week__weekday" aria-hidden="true">{weekdayShort(day)}</span>
          <span className="ev-week__date" aria-hidden="true">{Number(day.slice(8, 10))}</span>
          <span className="ev-week__dot" aria-hidden="true" data-on={count ? '' : undefined} />
        </button></li>;
      })}</ol>
      <IconButton label={t('下一周', 'Next week')} onClick={() => update({ date: addCalendarDays(date, 7) })}><ChevronRight aria-hidden="true" strokeWidth={1.75} /></IconButton>
    </div>

    <div className="ev-calendar__head">
      <h2 id="ev-calendar-day" className="ev-section-title">{longDate(date)}<span className="ev-calendar__count">{t(`${dayEvents.length} 场`, `${dayEvents.length} ${dayEvents.length === 1 ? 'event' : 'events'}`)}</span></h2>
      <div className="ev-calendar__tools">
        <FilterChip selected={region !== 'all'} aria-haspopup="dialog" icon={<CalendarDays aria-hidden="true" strokeWidth={1.75} />} onClick={() => setSheetOpen(true)}>
          {t('选日期', 'Pick a date')} · {pick(regionLabel(region))}
        </FilterChip>
        <SegmentedControl className="ev-calendar__mode" label={t('显示方式', 'Show as')} value={mode} onChange={value => setMode(value as 'list' | 'map')}
          items={[{ id: 'list', label: t('列表', 'List') }, { id: 'map', label: t('地图', 'Map') }]} />
      </div>
    </div>

    {cities.length > 1 && <ChipRow label={t('当天的城市', 'Cities that day')} className="ev-cities">
      <FilterChip selected={!city} count={dayEvents.length} onClick={() => setFocus({ scope, city: '' })}>{t('全部', 'All')}</FilterChip>
      {cities.map(name => <FilterChip key={name} selected={city === name} count={dayEvents.filter(event => event.city === name).length} onClick={() => setFocus({ scope, city: name })}>
        {cityLabel(name)}
      </FilterChip>)}
    </ChipRow>}

    {mode === 'map' && <div className="ev-calendar__map">
      <ChunkBoundary>{attempt => { const Map = calendarMap(attempt); return <Suspense fallback={<SkeletonFeed count={2} rows />}>
        <Map events={dayEvents.filter(event => !city || event.city === city)} selectedId={focus.scope === scope ? focus.point ?? '' : ''} onSelect={(id, ids) => setFocus({ scope, city, point: id, ids })} />
      </Suspense>; }}</ChunkBoundary>
      {pointIds && <Button variant="text" onClick={() => setFocus({ scope, city })}>{t('看这一天全部活动', 'Show every event that day')}</Button>}
    </div>}

    <div className="ev-calendar__rows" aria-live="polite">
      {shownEvents.length ? shownEvents.map((event, index) => <EventRowCard key={event.id} event={event} cover={covers[index]} today={today} day={date} />)
        : <EmptyState headingLevel="h3" icon={CalendarDays}
          title={beforeIndex ? t('这一天在本期收录之前', 'This day is before this edition') : past ? t('这一天没有收录的活动', 'No events recorded that day') : t('这一天暂未收录活动', 'No events listed that day yet')}
          body={t('没有标记不代表当地没有活动。可以看最近有活动的一天。', 'No listing does not mean nothing is on. Try the nearest day with events.')}
          actions={nearest ? <Button variant="primary" onClick={() => update({ date: nearest })}>{t(`看 ${monthDay(nearest)}`, `See ${monthDay(nearest)}`)}</Button> : undefined} />}
    </div>

    <div className="ev-calendar__foot">
      {!past && <Button variant="secondary" onClick={askAboutDay}>{t('让 BayBay 帮我安排这一天', 'Ask BayBay to plan this day')}</Button>}
      <p className="ev-calendar__note">{t('日期按湾区当地时间；多日活动按已公布的日期列出，具体时段以主办方为准。', 'Dates are Bay Area local; multi-day events list their published dates — check times with the organiser.')}</p>
    </div>
    <ImageCredits covers={covers} />

    <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title={t('选日期和地区', 'Pick a date and region')} status={t(`${dayEvents.length} 场`, `${dayEvents.length} events`)}
      footer={<Button variant="primary" onClick={() => setSheetOpen(false)}>{t(`看 ${monthDay(date)} 的 ${dayEvents.length} 场`, `Show ${dayEvents.length} on ${monthDay(date)}`)}</Button>}>
      <section className="ev-sheet-section">
        <div className="ev-month__nav">
          <IconButton label={t('上个月', 'Previous month')} disabled={!validCalendarDay(shiftCalendarPeriod(date, 'month', -1))} onClick={() => update({ date: shiftCalendarPeriod(date, 'month', -1) })}><ChevronLeft aria-hidden="true" strokeWidth={1.75} /></IconButton>
          <h3 aria-live="polite">{monthLabel}</h3>
          <IconButton label={t('下个月', 'Next month')} disabled={!validCalendarDay(shiftCalendarPeriod(date, 'month', 1))} onClick={() => update({ date: shiftCalendarPeriod(date, 'month', 1) })}><ChevronRight aria-hidden="true" strokeWidth={1.75} /></IconButton>
        </div>
        <div className="ev-month" role="group" aria-label={monthLabel}>
          {[1, 2, 3, 4, 5, 6, 0].map(weekday => <span key={weekday} className="ev-month__weekday" aria-hidden="true">{(english ? WEEKDAY_EN : WEEKDAY_ZH)[weekday]}</span>)}
          {calendarCells(date, 'month').map(day => {
            const count = countOn(day);
            const outside = day < period.start || day > period.end;
            return <button key={day} type="button" className="ev-month__day" aria-pressed={day === date} aria-current={day === today ? 'date' : undefined} data-outside={outside ? '' : undefined}
              aria-label={`${longDate(day)} · ${t(`${count} 场`, `${count} events`)}`} onClick={() => update({ date: day })}>
              <span aria-hidden="true">{Number(day.slice(8, 10))}</span>
              <span className="ev-week__dot" aria-hidden="true" data-on={count ? '' : undefined} />
            </button>;
          })}
        </div>
      </section>
      <section className="ev-sheet-section">
        <h3>{t('地区', 'Region')}</h3>
        <ChipRow label={t('地区', 'Region')}>
          <FilterChip selected={region === 'all'} onClick={() => { saveRegion('all'); update({ region: 'all' }); }}>{pick(ALL_REGIONS)}</FilterChip>
          {REGIONS.map(item => <FilterChip key={item.id} selected={region === item.id} onClick={() => { saveRegion(item.id); update({ region: item.id }); }}>{pick(item.label)}</FilterChip>)}
        </ChipRow>
      </section>
    </Sheet>
  </section>;
}
