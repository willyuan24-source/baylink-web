import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button, ChipRow, EmptyState, FeedGrid, FeedItem, FilterChip, IconButton, SegmentedControl, Sheet, SkeletonFeed } from '../../components/ui';
import { useUiCopy } from '../../components/ui/ui-copy';
import { translateText } from '../../i18n/locale';
import { useApp } from '../../app/context';
import { addCalendarDays, calendarCells, calendarPeriod, shiftCalendarPeriod, validCalendarDay } from '../../lib/calendar-days';
import { createCoverPage, resolveCovers } from '../../lib/cover';
import { nextOccurrence, orderByNextDay } from '../../lib/monthly';
import { ALL_REGIONS, EVENTS_INDEX, REGIONS, coverContext, hasRealCover, isRegion, monthDay, readSavedRegion, regionLabel, saveRegion, weekdayIndex, WEEKDAYS } from './events-model';
import { useIndexEvents } from './events-later';
import type { IndexEvent, MonthlyRegion } from './events-index-types';
import { EventFeedCard, EventRowCard, PHONE_COVER_CAP } from './EventCards';
import { ChunkBoundary, ChunkError } from './ChunkBoundary';
import { retryableLazy } from './lazy-view';
import { ImageCredits } from './ImageCredits';
import { AddToDayPlan } from '../../components/AddToDayPlan';

const calendarMap = retryableLazy(() => import('./CalendarMap'));
// The lead cover is one column wide: the phone width, or the left of the two desktop columns (events.css). It is the
// day's LCP image, so on phones it takes the 800w rung at most (PHONE_COVER_CAP).
const LEAD_SIZES = `${PHONE_COVER_CAP}, (max-width: 1023px) calc(100vw - 32px), 592px`;
const occursOn = (event: IndexEvent, day: string) => nextOccurrence(event, day) === day;

/**
 * 日历·地图 (design.md §4.11 ④; EVT-10): a 7-day week strip on screen 1 (weekday, date, a dot per day with events), the
 * month grid in a Sheet, the day's cities in one bilingual row ("圣何塞 San Jose"), the day led by one wide cover (the first
 * real photo of the day) and image rows for the rest, and a 列表 | 地图 switch whose map loads only when opened.
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
  // Each day is its own history entry (Back returns to the previous day); the region choice replaces the entry.
  const update = (values: Record<string, string>) => setParams(previous => {
    const next = new URLSearchParams(previous);
    for (const [key, value] of Object.entries(values)) next.set(key, value);
    if (values.date === today) next.delete('date');
    return next;
  }, { replace: !('date' in values), preventScrollReset: true });

  const week = calendarPeriod(date, 'week').days;
  // WEB-PERF-2: the week strip and the day's rows come from the route's own events while they cover the week; another week
  // loads the rest of the catalog first, the rows showing a skeleton. The month grid in the Sheet reads its own weeks: it
  // starts that load when the Sheet opens, and its dots appear once the rest is in, while the day's rows stay as they are.
  const cells = calendarCells(date, 'month');
  const { events, failed, retry } = useIndexEvents(week[0], week[6]);
  const month = useIndexEvents(cells[0], cells[cells.length - 1], sheetOpen);
  const pool = useMemo(() => (events ?? []).filter(event => region === 'all' || event.region === region), [region, events]);
  const monthPool = useMemo(() => (month.events ?? []).filter(event => region === 'all' || event.region === region), [region, month.events]);
  const countOn = (day: string) => pool.filter(event => occursOn(event, day)).length;
  const monthCountOn = (day: string) => monthPool.filter(event => occursOn(event, day)).length;
  // One-offs before long-running series, a real photo first within them.
  const dayEvents = orderByNextDay(pool.filter(event => occursOn(event, date)), date, event => hasRealCover('event', event, today));
  const scope = `${date}:${region}`;
  const city = focus.scope === scope ? focus.city : '';
  const pointIds = focus.scope === scope ? focus.ids : undefined;
  const cities = [...new Set(dayEvents.map(event => event.city))].sort((a, b) => dayEvents.filter(event => event.city === b).length - dayEvents.filter(event => event.city === a).length || a.localeCompare(b));
  const filtered = dayEvents.filter(event => (!city || event.city === city) && (!pointIds || pointIds.includes(event.id)));
  // The lead is the first event with a real photo (else the first one); the rest keep their order as rows.
  const leadIndex = Math.max(0, filtered.findIndex(event => hasRealCover('event', event, today)));
  const shownEvents = filtered.length ? [filtered[leadIndex], ...filtered.filter((_, index) => index !== leadIndex)] : filtered;
  const covers = resolveCovers(shownEvents.map(event => ({ kind: 'event' as const, id: event.id, imageKey: event.imageKey })), { ...coverContext(today), page: createCoverPage() });
  // The nearest day with events after an empty one can be past the route's own days: it reads the whole catalog.
  const after = useIndexEvents(date > today ? date : today, null, !!events && !dayEvents.length);
  const nearest = after.events?.filter(event => region === 'all' || event.region === region)
    .flatMap(event => { const day = nextOccurrence(event, date > today ? date : today); return day ? [day] : []; }).filter(day => day !== date).sort()[0];
  const past = date < today;
  // 加入这天计划 (WEB-SAVES, plan D19) on every listed event of today or a later day: saves into that day's plan at once.
  const addToDay = (event: IndexEvent) => past ? undefined : <AddToDayPlan stop={{ kind: 'event', id: event.id }} date={date} title={event.title} today={today} compact />;
  const beforeIndex = date < EVENTS_INDEX.edition.checkedAt;

  const weekdayShort = (day: string) => pick(WEEKDAYS[weekdayIndex(day)].char);
  const longDate = (day: string) => english ? new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${day}T12:00:00Z`))
    : `${Number(day.slice(5, 7))}月${Number(day.slice(8, 10))}日 ${WEEKDAYS[weekdayIndex(day)].short.zh}`;
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
      <IconButton className="ev-week__prev" label={t('上一周', 'Previous week')} onClick={() => update({ date: addCalendarDays(date, -7) })}><ChevronLeft aria-hidden="true" strokeWidth={1.75} /></IconButton>
      {/* Shown only at 大/特大 on phones, where ‹ › move above the days so each date keeps its circle (no overlap). */}
      <span className="ev-week__range" aria-hidden="true">{monthDay(week[0], english)}–{english && week[0].slice(0, 7) === week[6].slice(0, 7) ? Number(week[6].slice(8, 10)) : monthDay(week[6], english)}</span>
      <ol className="ev-week__days">{week.map(day => {
        const count = countOn(day);
        // While another week's events load, a day names its date only (no "0 场" before the count is known).
        return <li key={day}><button type="button" className="ev-week__day" aria-pressed={day === date} aria-current={day === today ? 'date' : undefined}
          aria-label={events ? `${longDate(day)} · ${t(`${count} 场`, `${count} ${count === 1 ? 'event' : 'events'}`)}` : longDate(day)} onClick={() => update({ date: day })} data-past={day < today ? '' : undefined}>
          <span className="ev-week__weekday" aria-hidden="true">{weekdayShort(day)}</span>
          <span className="ev-week__date" aria-hidden="true">{Number(day.slice(8, 10))}</span>
          <span className="ev-week__dot" aria-hidden="true" data-on={count ? '' : undefined} />
        </button></li>;
      })}</ol>
      <IconButton className="ev-week__next" label={t('下一周', 'Next week')} onClick={() => update({ date: addCalendarDays(date, 7) })}><ChevronRight aria-hidden="true" strokeWidth={1.75} /></IconButton>
    </div>

    <div className="ev-calendar__head">
      <h2 id="ev-calendar-day" className="ev-section-title">{longDate(date)}{events && <span className="ev-calendar__count">{t(`${dayEvents.length} 场`, `${dayEvents.length} ${dayEvents.length === 1 ? 'event' : 'events'}`)}</span>}</h2>
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

    {beforeIndex && <p className="ev-calendar__note ev-calendar__before">{t(`这一天在本期收录（${monthDay(EVENTS_INDEX.edition.checkedAt)} 起）之前，只列出当时还在进行、现在仍可去的活动。`, `This day is before this edition (from ${monthDay(EVENTS_INDEX.edition.checkedAt, true)}): only events still running now are listed.`)}</p>}
    <div className="ev-calendar__rows" aria-live="polite">
      {!events ? failed ? <ChunkError onRetry={retry} /> : <SkeletonFeed count={3} rows />
      : shownEvents.length ? <>
        <FeedGrid single label={t('这一天的活动', 'Events this day')} className="ev-calendar__lead">
          <FeedItem><EventFeedCard event={shownEvents[0]} cover={covers[0]} today={today} days={[date]} day={date} sizes={LEAD_SIZES} priority action={addToDay(shownEvents[0])} /></FeedItem>
        </FeedGrid>
        {shownEvents.slice(1).map((event, index) => <EventRowCard key={event.id} event={event} cover={covers[index + 1]} today={today} day={date} action={addToDay(event)} />)}
      </>
        : <EmptyState headingLevel="h3" icon={CalendarDays}
          title={beforeIndex ? t('这一天在本期收录之前', 'This day is before this edition') : past ? t('这一天没有收录的活动', 'No events recorded that day') : t('这一天暂未收录活动', 'No events listed that day yet')}
          body={t('没有标记不代表当地没有活动。可以看最近有活动的一天。', 'No listing does not mean nothing is on. Try the nearest day with events.')}
          actions={nearest ? <Button variant="primary" onClick={() => update({ date: nearest })}>{t(`看 ${monthDay(nearest)}`, `See ${monthDay(nearest, true)}`)}</Button> : undefined} />}
    </div>

    <div className="ev-calendar__foot">
      {!past && <Button variant="secondary" onClick={askAboutDay}>{t('让 BayBay 帮我安排这一天', 'Ask BayBay to plan this day')}</Button>}
      <p className="ev-calendar__note">{t('日期按湾区当地时间；多日活动按已公布的日期列出，具体时段以主办方为准。', 'Dates are Bay Area local; multi-day events list their published dates — check times with the organizer.')}</p>
    </div>
    <ImageCredits covers={covers} />

    <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title={t('选日期和地区', 'Pick a date and region')}
      status={events ? t(`${dayEvents.length} 场`, `${dayEvents.length} events`) : failed ? t('这一天的活动没能加载', 'Events for this day did not load') : t('正在加载…', 'Loading…')}
      footer={<Button variant="primary" onClick={() => setSheetOpen(false)}>{events ? t(`看 ${monthDay(date)} 的 ${dayEvents.length} 场`, `Show ${dayEvents.length} on ${monthDay(date, true)}`) : t(`看 ${monthDay(date)}`, `Show ${monthDay(date, true)}`)}</Button>}>
      <section className="ev-sheet-section">
        <div className="ev-month__nav">
          <IconButton label={t('上个月', 'Previous month')} disabled={!validCalendarDay(shiftCalendarPeriod(date, 'month', -1))} onClick={() => update({ date: shiftCalendarPeriod(date, 'month', -1) })}><ChevronLeft aria-hidden="true" strokeWidth={1.75} /></IconButton>
          <h3 aria-live="polite">{monthLabel}</h3>
          <IconButton label={t('下个月', 'Next month')} disabled={!validCalendarDay(shiftCalendarPeriod(date, 'month', 1))} onClick={() => update({ date: shiftCalendarPeriod(date, 'month', 1) })}><ChevronRight aria-hidden="true" strokeWidth={1.75} /></IconButton>
        </div>
        <div className="ev-month" role="group" aria-label={monthLabel} aria-busy={!month.events && !month.failed ? true : undefined}>
          {[1, 2, 3, 4, 5, 6, 0].map(weekday => <span key={weekday} className="ev-month__weekday" aria-hidden="true">{pick(WEEKDAYS[weekday].char)}</span>)}
          {cells.map(day => {
            const count = monthCountOn(day);
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
          <FilterChip selected={region === 'all'} onClick={() => { saveRegion('all'); update({ region: 'all' }); }}>{pick(ALL_REGIONS)}</FilterChip>
          {REGIONS.map(item => <FilterChip key={item.id} selected={region === item.id} onClick={() => { saveRegion(item.id); update({ region: item.id }); }}>{pick(item.label)}</FilterChip>)}
        </ChipRow>
      </section>
    </Sheet>
  </section>;
}
