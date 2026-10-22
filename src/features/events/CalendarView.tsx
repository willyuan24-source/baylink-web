import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button, ChipRow, EmptyState, FeedGrid, FeedItem, FilterChip, IconButton, SegmentedControl, SkeletonFeed } from '../../components/ui';
import { MoreLink } from '../../components/ui/TextLink';
import { useUiCopy } from '../../components/ui/ui-copy';
import { translateText } from '../../i18n/locale';
import { useApp } from '../../app/context';
import { addCalendarDays, calendarPeriod, validCalendarDay } from '../../lib/calendar-days';
import { coverItemFor, createCoverPage, resolveCovers } from '../../lib/cover';
import { nextOccurrence, orderByNextDay } from '../../lib/monthly';
import { useReadingSize, useSimpleDisplay } from '../../lib/reading-preferences';
import { EVENTS_INDEX, coverContext, hasRealCover, isRegion, monthDay, readSavedRegion, regionLabel, weekdayIndex, WEEKDAYS } from './events-model';
import { useIndexEvents } from './events-later';
import type { IndexEvent, MonthlyRegion } from './events-index-types';
import { EventFeedCard, EventRowCard, PHONE_COVER_CAP } from './EventCards';
import { ChunkBoundary, ChunkError } from './ChunkBoundary';
import { loadWhenIdle, parts, retryableLazy, useOnDemand } from './lazy-view';
import { ImageCredits } from './ImageCredits';
import { canLead, leadImageKey } from './weekend-lead';
import { AddToDayPlan } from '../../components/AddToDayPlan';

const calendarMap = retryableLazy(() => import('./CalendarMap'));
// The lead cover is the phone width, or the 6-column span on desktop (events.css). It is the day's LCP image, so on phones
// it takes the 800w rung at most (PHONE_COVER_CAP).
const LEAD_SIZES = `${PHONE_COVER_CAP}, (max-width: 1023px) calc(100vw - 48px), 596px`;
const occursOn = (event: IndexEvent, day: string) => nextOccurrence(event, day) === day;
/** Rows per page: 12; 6 in 简洁显示 and 4 in 家人版 (content arrangement §6). The city rail names the top 4 cities. */
const PAGE = 12, SIMPLE_PAGE = 6, FAMILY_PAGE = 4, TOP_CITIES = 4;

/**
 * 日历·地图 (design.md §4.11 ④; UI9-EVENTS content arrangement §5): the week strip (‹ 10/19–25 ›, the range opens the
 * month grid and the region in a Sheet, then the 7 days with dots), the day head (H2 10月19日 周一 · 9 场 with 列表 | 地图),
 * a city rail (全部, the day's top 4 cities, 更多城市), the day's lead (the first picture that can lead) and rows 12 at a
 * time, each with one + 计划 control; the list end names what is shown, the next day and BayBay. The map loads when opened.
 */
export default function CalendarView({ today }: { today: string }) {
  const { t, pick, english, locale } = useUiCopy();
  const app = useApp();
  const [params, setParams] = useSearchParams();
  // The 选日期 sheet: undefined until it first opens (its chunk loads when the page is idle, or then).
  const [sheetOpen, setSheetOpen, loaded] = useOnDemand(parts);
  useEffect(() => loadWhenIdle(parts.load), []);
  const CalendarSheet = loaded?.CalendarSheet;
  const [mode, setMode] = useState<'list' | 'map'>('list');
  const [focus, setFocus] = useState<{ scope: string; city: string; ids?: string[]; point?: string }>({ scope: '', city: '' });
  const [pages, setPages] = useState({ scope: '', count: 1 });
  const [savedRegion, setSavedRegion] = useState<MonthlyRegion>();
  useEffect(() => setSavedRegion(readSavedRegion()), []);
  const readingSize = useReadingSize(), simple = useSimpleDisplay();
  const pageSize = simple ? readingSize === 'extra-large' ? FAMILY_PAGE : SIMPLE_PAGE : PAGE;
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
  // loads the rest of the catalog first, the rows showing a skeleton. The month grid in the Sheet reads its own weeks
  // (CalendarSheet): it starts that load when the Sheet opens, while the day's rows stay as they are.
  const { events, failed, retry } = useIndexEvents(week[0], week[6]);
  const pool = useMemo(() => (events ?? []).filter(event => region === 'all' || event.region === region), [region, events]);
  const countOn = (day: string) => pool.filter(event => occursOn(event, day)).length;
  // One-offs before long-running series, a real photo first within them.
  const dayEvents = orderByNextDay(pool.filter(event => occursOn(event, date)), date, event => hasRealCover('event', event, today));
  const scope = `${date}:${region}`;
  const city = focus.scope === scope ? focus.city : '';
  const pointIds = focus.scope === scope ? focus.ids : undefined;
  const cityCount = (name: string) => dayEvents.filter(event => event.city === name).length;
  const cities = [...new Set(dayEvents.map(event => event.city))].sort((a, b) => cityCount(b) - cityCount(a) || a.localeCompare(b));
  // The rail: 全部, the top 4 cities, and a chosen city past them, so the choice stays visible.
  const railCities = [...cities.slice(0, TOP_CITIES), ...(city && cities.indexOf(city) >= TOP_CITIES ? [city] : [])];
  const filtered = dayEvents.filter(event => (!city || event.city === city) && (!pointIds || pointIds.includes(event.id)));
  // The lead is the first event whose picture can lead (a real photo or poster, never a close-up face), else the first one.
  const leadIndex = Math.max(0, filtered.findIndex(event => canLead(event, today)));
  const ordered = filtered.length ? [filtered[leadIndex], ...filtered.filter((_, index) => index !== leadIndex)] : filtered;
  const shownCount = pageSize * (pages.scope === `${scope}:${city}` ? pages.count : 1);
  const shownEvents = ordered.slice(0, shownCount + 1);
  const more = Math.min(pageSize, ordered.length - shownEvents.length);
  // DECISIONS 15/26: a lead never shows a close-up face photo; it takes its next candidate (never an information card).
  const covers = resolveCovers(shownEvents.map((event, index) => coverItemFor('event', event, { imageKey: index ? event.imageKey : leadImageKey(event.imageKey), lead: !index })), { ...coverContext(today), page: createCoverPage() });
  // The nearest days with events after an empty one can be past the route's own days: they read the whole catalog.
  const after = useIndexEvents(date > today ? date : today, null, !!events && !dayEvents.length);
  const counts = new Map<string, number>();
  for (const event of after.events ?? []) {
    if (region !== 'all' && event.region !== region) continue;
    const day = nextOccurrence(event, date > today ? date : today);
    if (day && day !== date) counts.set(day, (counts.get(day) ?? 0) + 1);
  }
  const nearest = [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(0, 3);
  const past = date < today;
  // 加入这天计划 (WEB-SAVES, plan D19) on every listed event of today or a later day: saves into that day's plan at once.
  const addToDay = (event: IndexEvent) => past ? undefined : <AddToDayPlan className="ev-add-day" stop={{ kind: 'event', id: event.id }} date={date} title={event.title} today={today} compact />;
  const beforeIndex = date < EVENTS_INDEX.edition.checkedAt;

  const weekdayShort = (day: string) => pick(WEEKDAYS[weekdayIndex(day)].char);
  const longDate = (day: string) => english ? new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${day}T12:00:00Z`))
    : `${Number(day.slice(5, 7))}月${Number(day.slice(8, 10))}日 ${WEEKDAYS[weekdayIndex(day)].short.zh}`;
  const shortDate = (day: string) => english ? `${pick(WEEKDAYS[weekdayIndex(day)].short)}, ${monthDay(day, true)}` : `${monthDay(day)} ${pick(WEEKDAYS[weekdayIndex(day)].short)}`;
  // The sheet names a city in both languages ("圣何塞 San Jose"); the rail, short of room, in the reader's own.
  const cityLabel = (name: string, short = false) => {
    const zh = EVENTS_INDEX.cityNames[name];
    return english || !zh ? name : short ? translateText(zh, locale) : `${translateText(zh, locale)} ${name}`;
  };
  const askAboutDay = () => {
    const area = region === 'all' ? t('湾区', 'the Bay Area') : pick(regionLabel(region));
    app?.openBayBay(t(`请帮我安排 ${date} 在${area}${city ? ` · ${city}` : ''}的出游。`, `Help me plan an outing on ${date} in ${area}${city ? ` · ${city}` : ''}.`), { mode: 'draft' });
  };
  const tomorrow = addCalendarDays(date, 1);
  const weekRange = `${monthDay(week[0], english)}–${english && week[0].slice(0, 7) === week[6].slice(0, 7) ? Number(week[6].slice(8, 10)) : monthDay(week[6], english)}`;

  return <section className="ev-calendar" aria-labelledby="ev-calendar-day">
    <div className="ev-week" role="group" aria-label={t('这一周', 'This week')}>
      <IconButton className="ev-week__prev" label={t('上一周', 'Previous week')} onClick={() => update({ date: addCalendarDays(date, -7) })}><ChevronLeft aria-hidden="true" strokeWidth={1.75} /></IconButton>
      <button type="button" className="ev-week__range" aria-haspopup="dialog" onClick={() => setSheetOpen(true)}
        aria-label={t(`${weekRange}，选日期和地区：${pick(regionLabel(region))}`, `${weekRange}, pick a date and region: ${pick(regionLabel(region))}`)}>
        <CalendarDays aria-hidden="true" strokeWidth={1.75} />{weekRange}{region !== 'all' && <span className="ev-week__region"> · {pick(regionLabel(region))}</span>}
      </button>
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
      {/* English names the day as the weekend view does ("Mon, Oct 19"), so 列表 | 地图 stays on the head's line at 390. */}
      <h2 id="ev-calendar-day" className="ev-section-title">{english ? shortDate(date) : longDate(date)}{events && <span className="ev-calendar__count"> · {t(`${dayEvents.length} 场`, `${dayEvents.length} ${dayEvents.length === 1 ? 'event' : 'events'}`)}</span>}</h2>
      <SegmentedControl className="ev-calendar__mode" label={t('显示方式', 'Show as')} value={mode} onChange={value => setMode(value as 'list' | 'map')}
        items={[{ id: 'list', label: t('列表', 'List') }, { id: 'map', label: t('地图', 'Map') }]} />
    </div>

    {cities.length > 1 && <ChipRow label={t('当天的城市', 'Cities that day')} className="ev-cities">
      <FilterChip selected={!city} onClick={() => setFocus({ scope, city: '' })}>{t('全部', 'All')}</FilterChip>
      {railCities.map(name => <FilterChip key={name} className="ev-cities__top" selected={city === name} onClick={() => setFocus({ scope, city: name })} aria-label={cityLabel(name)}>{cityLabel(name, true)}</FilterChip>)}
      {cities.length > TOP_CITIES && <FilterChip selected={false} aria-haspopup="dialog" onClick={() => setSheetOpen(true)}>{t('更多城市', 'More cities')}</FilterChip>}
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
          <FeedItem><EventFeedCard event={shownEvents[0]} cover={covers[0]} today={today} days={[date]} day={date} oneDay={date} sizes={LEAD_SIZES} priority action={addToDay(shownEvents[0])} /></FeedItem>
        </FeedGrid>
        {shownEvents.slice(1).map((event, index) => <EventRowCard key={event.id} event={event} cover={covers[index + 1]} today={today} day={date} oneDay action={addToDay(event)} />)}
        <div className="ev-list-end ev-calendar__end">
          <p className="ev-list-end__count">{t(`已显示 ${shownEvents.length} / ${ordered.length} 场`, `Showing ${shownEvents.length} of ${ordered.length}`)}</p>
          {more > 0 && <Button variant="secondary" className="ev-list-end__more" onClick={() => setPages(current => ({ scope: `${scope}:${city}`, count: (current.scope === `${scope}:${city}` ? current.count : 1) + 1 }))}>{t(`再看 ${more} 场`, `Show ${more} more`)}</Button>}
          {/* 明天 only from today's list; from another day the next one by its date ("10/26 周一"). */}
          <MoreLink to={`/calendar?date=${tomorrow}`} onClick={event => { event.preventDefault(); update({ date: tomorrow }); }}>{date === today ? t(`明天 ${monthDay(tomorrow)}`, `Tomorrow, ${monthDay(tomorrow, true)}`) : shortDate(tomorrow)}</MoreLink>
          {!past && <button type="button" className="ui-more ev-calendar__ask" onClick={askAboutDay}>{t('让 BayBay 帮我安排这一天', 'Ask BayBay to plan this day')}</button>}
        </div>
      </>
        : <EmptyState headingLevel="h3" icon={CalendarDays}
          title={beforeIndex ? t('这一天在本期收录之前', 'This day is before this edition') : past ? t('这一天没有收录的活动', 'No events recorded that day') : t(`${shortDate(date)}还没有收录活动`, `Nothing listed for ${shortDate(date)} yet`)}
          body={t('没有标记不代表当地没有活动。可以看最近有活动的日子。', 'No listing does not mean nothing is on. Try the nearest days with events.')}
          actions={<>
            {nearest.map(([day, count], index) => <Button key={day} variant={index === 0 ? 'primary' : 'secondary'} onClick={() => update({ date: day })}>{t(`${shortDate(day)} · ${count} 场`, `${shortDate(day)} · ${count}`)}</Button>)}
            <MoreLink to="/events?when=next7">{t('未来 7 天', 'Next 7 days')}</MoreLink>
          </>} />}
    </div>
    <p className="ev-calendar__note">{t('日期按湾区当地时间；多日活动按已公布的日期列出，具体时段以主办方为准。', 'Dates are Bay Area local; multi-day events list their published dates — check times with the organizer.')}</p>
    <ImageCredits covers={covers} />

    {/* The 选日期 sheet loads on its own (idle, or the first tap), then stays mounted for its exit animation. */}
    {sheetOpen !== undefined && CalendarSheet && <CalendarSheet open={sheetOpen} onClose={() => setSheetOpen(false)} date={date} today={today} region={region} update={update} longDate={longDate}
        status={events ? t(`${dayEvents.length} 场`, `${dayEvents.length} events`) : failed ? t('这一天的活动没能加载', 'Events for this day did not load') : t('正在加载…', 'Loading…')}
        done={events ? t(`看 ${monthDay(date)} 的 ${dayEvents.length} 场`, `Show ${dayEvents.length} on ${monthDay(date, true)}`) : t(`看 ${monthDay(date)}`, `Show ${monthDay(date, true)}`)}
        cities={cities} city={city} onCity={name => setFocus({ scope, city: name })} cityLabel={cityLabel} />}
  </section>;
}
