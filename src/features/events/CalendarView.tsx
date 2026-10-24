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
// The lead cover (the day's LCP image): a phone's 2-up cell, the full width on a tablet, the 6-column span on desktop
// (events.css). A day with one event shows it phone-wide, so it takes the 800w rung at most there (PHONE_COVER_CAP).
const LEAD_SIZES = '(max-width: 767px) calc(50vw - 22px), (max-width: 1023px) calc(100vw - 48px), 596px';
const ONE_SIZES = `${PHONE_COVER_CAP}, (max-width: 1023px) calc(100vw - 48px), 596px`;
/** The other events: a phone's 2-up cell, a 112px 4:3 row thumbnail from 768px. */
const CARD_SIZES = '(max-width: 767px) calc(50vw - 22px), 112px';
const occursOn = (event: IndexEvent, day: string) => nextOccurrence(event, day) === day;
/** Rows per page: 12; 6 in 简洁显示 and 4 in 家人版 (content arrangement §6). The city rail names the top 4 cities. */
const PAGE = 12, SIMPLE_PAGE = 6, FAMILY_PAGE = 4, TOP_CITIES = 4;

/**
 * 日历·地图 (design.md §4.11 ④; UI9-EVENTS content arrangement §5; UI9-R1 AFTER-A1): the week strip (‹ 10/19–25 ›, the
 * range opens the month grid and the region in a Sheet, then the 7 days with dots), then a section gap (N15), the day head
 * (H2 10/19 周一 · 9 场 in the site's date pattern, N06, with 列表 | 地图 always on its row, J2 P7), a city rail (全部, the
 * day's top 4 cities, 更多城市), then the day's list in ONE anatomy (UI9-R2 R2-10): at the standard size the feed card —
 * on a phone the same 2-up card as 未来 7 天, the first one the day's lead (the first picture that can lead); from 768px the
 * lead card (span 6 beside four rows on desktop, the full width under 40vh on a tablet) and the others as rows, the same
 * cards restyled (events.css) — and at 大 / 特大 / 简洁 every event a row. Every listed event has one 加入这天计划 control,
 * the 加入 pill (D7: no wall of outline buttons), under the meta on a phone, beside the title or at the row's end from
 * 768px, never on a picture. 12 at a time after the lead. The list end names what is shown, the next day and BayBay. The
 * map loads when opened.
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
  // At 大 / 特大 and in 简洁显示 every event is a row, the first one too (as the events feeds there): a lead card at those
  // sizes never ended on the first screen (N18).
  const roomy = readingSize !== 'standard' || simple;
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
  // 加入这天计划 (WEB-SAVES, plan D19) on every listed event of today or a later day: saves into that day's plan at once. The
  // icon variant (D7) as the 加入 pill: under the meta on a phone (a card's last line, or a row's), beside the lead's title
  // or at a row's end from 768px (events.css), never on a picture; its name stays 加入这天计划：<title>.
  const addToDay = (event: IndexEvent) => past ? undefined : <AddToDayPlan className="ev-add-day" stop={{ kind: 'event', id: event.id }} date={date} title={event.title} today={today} variant="icon" />;
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
      {/* The range opens the sheet of dates, regions and cities. At 大 / 特大 on a phone, where the city rail steps aside, its
          second line says so (选日期、地区和城市, the sheet's title; events.css), so the cities stay in sight. */}
      <button type="button" className="ev-week__range" aria-haspopup="dialog" onClick={() => setSheetOpen(true)}
        aria-label={t(`${weekRange}，选日期、地区和城市：${pick(regionLabel(region))}`, `${weekRange}, pick a date, region, city: ${pick(regionLabel(region))}`)}>
        <CalendarDays aria-hidden="true" strokeWidth={1.75} /><span className="ev-week__label">{weekRange}{region !== 'all' && <span className="ev-week__region"> · {pick(regionLabel(region))}</span>}</span>
        <span className="ev-week__hint" aria-hidden="true">{t('选日期、地区和城市', 'Date, region, city')}</span>
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
      {/* The day in the site's one date pattern (N06: 10/19 周一, Mon, Oct 19). 列表 | 地图 keeps the head's row at every size
          (J2 P7): the H2 wraps instead, its count on a line of its own at 大 / 特大 (events.css). */}
      <h2 id="ev-calendar-day" className="ev-section-title"><span className="ev-calendar__date">{shortDate(date)}</span>{events && <span className="ev-calendar__count"><span className="ev-calendar__sep">{'\u00a0· '}</span>{t(`${dayEvents.length} 场`, `${dayEvents.length} ${dayEvents.length === 1 ? 'event' : 'events'}`)}</span>}</h2>
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
        {/* One list, one anatomy (R2-10): the feed cards — a phone's 2-up grid (the first card the lead), from 768px the lead
            card and the others restyled as rows (events.css) — or, at 大 / 特大 and in 简洁显示, every event a row. A day with
            one event shows its card phone-wide (2:1, events.css). */}
        {roomy ? shownEvents.map((event, index) => <EventRowCard key={event.id} event={event} cover={covers[index]} today={today} day={date} oneDay action={addToDay(event)} />)
          : <FeedGrid label={t('这一天的活动', 'Events this day')} single={shownEvents.length === 1} className="ev-cards ev-calendar__cards">
            {shownEvents.map((event, index) => <FeedItem key={event.id}><EventFeedCard event={event} cover={covers[index]} today={today} days={[date]} day={date} oneDay={date}
              sizes={index ? CARD_SIZES : shownEvents.length === 1 ? ONE_SIZES : LEAD_SIZES} priority={!index} action={addToDay(event)} /></FeedItem>)}
          </FeedGrid>}
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
