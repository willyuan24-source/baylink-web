import { Suspense, useDeferredValue, useEffect, useRef, useState, type ReactNode } from 'react';
import { useViewHold } from './view-hold';
import { useLocation, useSearchParams } from 'react-router-dom';
import { PageContainer, SegmentedTabs, SkeletonFeed } from '../../components/ui';
import { MoreLink } from '../../components/ui/TextLink';
// After the primitives, so the column's few overrides of ui.css come later in the cascade.
import './events.css';
import { useUiCopy } from '../../components/ui/ui-copy';
import { useBayAreaToday } from '../../lib/useBayAreaToday';
import { dateScope } from '../../lib/date-guard';
import { validCalendarDay } from '../../lib/calendar-days';
import { checkSummary, METHOD_HREF, OFFICIAL_LINKS, officialCheckLine } from '../../lib/check-dates';
import { getMonthlyDateRange, isFreeToAttend, nextOccurrence } from '../../lib/monthly';
import { isPressSource } from './source-kind';
import { EVENTS_INDEX, INDEX_OFFERS, INDEX_OPENINGS, columnFor, inRange, listWindow, liveOffers, monthDay, readFilters, readSavedRegion, regionLabel, weekdayIndex, WEEKDAYS, type EventsColumn, type EventsWhen } from './events-model';
import { useIndexEvents } from './events-later';
import { loadBoards, useBoards } from './events-boards';
import { getLocale } from '../../i18n/locale';
import type { EventsFilters } from './events-model';
import { ChunkBoundary } from './ChunkBoundary';
import { retryableLazy } from './lazy-view';

// The two other boards load on demand with their records (events-boards.ts, UI9-IMG-A1b): /events itself stays small
// (RC-33), and their skeleton and retry states are real.
const withBoards = <M,>(load: () => Promise<M>) => async () => (await Promise.all([load(), loadBoards(getLocale())]))[0];
const perksView = retryableLazy(withBoards(() => import('./PerksView')));
const openingsView = retryableLazy(withBoards(() => import('./OpeningsView')));

/**
 * 活动 (plan D3, design.md §4.11; UI9-EVENTS G17 + G12): one head — H1 活动 with the range on its baseline (本周末 · 10/24–25,
 * 今天 · 10/19 周一, 全部日期 · 收录至 2/28 …), a 14px facts line (counts · 每条附官方链接 · 官网核对 … · 我们怎么核对 →) —
 * then the four views as D3's segmented control (not sticky): 本周末 | 日历·地图 | 免费与优惠 | 新店. /events opens on 本周末,
 * /this-month on 全部日期, /calendar on its day view. A switch keeps the previous body, dimmed, until the next view is in.
 */
export type EventsFrameProps = {
  today?: string; defaultWhen?: EventsWhen;
  /** /calendar passes its view (imported by CalendarPage, so the prerender renders it and /events does not load it). */
  calendar?: (today: string) => ReactNode;
  /** The date lists' view (本周末 and the others): EventsShell passes WeekendView, so /calendar's graph leaves it out. */
  list?: (props: { today: string; filters: EventsFilters; defaultWhen: EventsWhen }) => ReactNode;
};

export function EventsFrame({ today: suppliedToday, defaultWhen = 'weekend', calendar, list }: EventsFrameProps) {
  const { t, pick, english } = useUiCopy();
  const today = useBayAreaToday(suppliedToday);
  const [params] = useSearchParams();
  const { hash, key: locationKey } = useLocation();
  // The saved region applies after mount, so the prerendered page and the first render agree.
  const [savedRegion, setSavedRegion] = useState<ReturnType<typeof readSavedRegion>>();
  useEffect(() => setSavedRegion(readSavedRegion()), []);
  const column = columnFor(params, hash, !!calendar);
  const filters = readFilters(params, defaultWhen, savedRegion);

  const md = (day: string) => monthDay(day, english);
  const weekday = (day: string) => pick(WEEKDAYS[weekdayIndex(day)].short);
  const range = getMonthlyDateRange(filters.when, today);
  const span = (start: string, end: string) => start === end ? english ? `${weekday(start)}, ${md(start)}` : `${md(start)} ${weekday(start)}`
    : start.slice(0, 7) === end.slice(0, 7) ? `${md(start)}–${Number(end.slice(8, 10))}` : `${md(start)}–${md(end)}`;
  const through = t(`收录至 ${md(EVENTS_INDEX.edition.throughDate)}`, `through ${md(EVENTS_INDEX.edition.throughDate)}`);
  const whenLine = filters.when === 'weekend' ? `${t('本周末', 'This weekend')} · ${span(range!.start, range!.end)}`
    : filters.when === 'today' ? `${t('今天', 'Today')} · ${span(today, today)}`
    : filters.when === 'next7' ? `${t('未来 7 天', 'Next 7 days')} · ${span(range!.start, range!.end)}`
    : filters.when === 'october' ? t('十月', 'October') : filters.when === 'november' ? t('十一月', 'November')
    : filters.when === 'december' ? t('十二月', 'December')
    : `${t('全部日期', 'All dates')} · ${through}`;
  const region = filters.region === 'all' ? '' : ` · ${pick(regionLabel(filters.region))}`;
  // The counts read the same days as the list (/calendar: the chosen day, CalendarView's own rule); past the route's own days
  // they wait with it for the rest (WEB-PERF-2).
  const dateParam = params.get('date') ?? '';
  const calendarDay = validCalendarDay(dateParam) ? dateParam : today;
  const days = column === 'calendar' ? { start: calendarDay, end: calendarDay } : listWindow(range, today);
  const { events } = useIndexEvents(days.start, days.end, column === 'list' || column === 'calendar');
  const inScope = (events ?? []).filter(event => inRange(event, range, today) && (filters.region === 'all' || event.region === filters.region));
  const free = inScope.filter(event => isFreeToAttend(event)).length;
  // The boards' counts wait for their records (events-boards.json loads with the board).
  const boards = useBoards(column === 'perks' || column === 'openings');
  const offerList = column === 'perks' ? liveOffers(INDEX_OFFERS, today, 'all', filters.region) : [];
  const offers = offerList.length;
  // H02: the check dates of what this view lists (/calendar: the chosen day's events), said as checks against the official
  // pages (PREP's 官网核对 line). DECISIONS 17: an item from a press report is never said to be checked on an official page —
  // the line then summarises the others and counts the reports instead of saying 每条附官方链接.
  const listed: readonly { verifiedAt?: string; press?: true; sourceLabel?: string }[] = column === 'perks' ? offerList : column === 'openings' ? INDEX_OPENINGS
    : column === 'calendar' ? (events ?? []).filter(event => nextOccurrence(event, calendarDay) === calendarDay && (filters.region === 'all' || event.region === filters.region)) : inScope;
  const official = listed.filter(item => !item.press && !isPressSource(item.sourceLabel));
  const press = listed.length - official.length;
  const summary = checkSummary(official.map(item => item.verifiedAt), today);
  const checked = summary ? officialCheckLine(summary, t) : '';
  // The listing card is one link to the detail page, which links the official source; a view that lists nothing (an empty
  // calendar day, a list still loading) promises nothing. The promise is HOME's wording (check-dates OFFICIAL_LINKS).
  const promise = !listed.length ? '' : press ? t(`${press} 条来自媒体报道`, `${press} from news reports`) : pick(OFFICIAL_LINKS);

  const rangeLine = column === 'perks' ? t('免费与优惠', 'Free & deals') + region
    : column === 'openings' ? t('新店', 'New shops') + region
    : column === 'calendar' ? `${t('按日期看', 'By date')} · ${through}` : whenLine + region;
  const counts = (column === 'perks' || column === 'openings') && !boards.ready ? ''
    : column === 'perks' ? t(`${offers} 条优惠与免费福利`, `${offers} offers and free perks`)
    : column === 'openings' ? t(`${INDEX_OPENINGS.length} 家新店与开业消息`, `${INDEX_OPENINGS.length} new shops and openings`)
    : column === 'calendar' || !events ? ''
    : english ? `${inScope.length} ${inScope.length === 1 ? 'event' : 'events'} · ${free} free` : t(`${inScope.length} 场 · ${free} 场免费`, `${inScope.length} events · ${free} free`);

  const facts = [counts, promise, checked].filter(Boolean).join('\u00a0· ').replace(/\b([A-Z][a-z]{2}) (\d)/g, '$1\u00a0$2').replace(/^[a-z]/, letter => letter.toUpperCase());

  const tabs = [
    { id: 'list', label: t('本周末', 'Weekend'), to: '/events' },
    { id: 'calendar', label: t('日历·地图', 'Calendar'), to: '/calendar' },
    { id: 'perks', label: t('免费与优惠', 'Free & deals'), to: '/events?view=perks' },
    { id: 'openings', label: t('新店', 'New shops'), to: '/events?view=openings' },
  ];
  // CW-02 stale-date guard: the prerendered range line, counts and body show a skeleton on a later day until the app renders
  // (src/lib/date-guard.ts). The 本周末 list keeps from Monday to Saturday; every other view is keyed to the day.
  const scope = dateScope(column === 'list' && filters.when === 'weekend' ? 'weekend' : 'day');
  // 本周末 is current only while the list shows the weekend; other dates leave the row unmarked (the range line says which).
  const current = column === 'list' && filters.when !== 'weekend' ? '' : column;

  // A view switch: the router's navigation is a transition, so React keeps the previous view on screen while the next board's
  // chunk loads; the tap (urgent) marks it pending, which dims it and after 300 ms holds its height under a skeleton.
  // useDeferredValue covers a switch that is not a transition the same way.
  const [pending, setPending] = useState<string>();
  const shown: EventsColumn = useDeferredValue(column);
  // A switch that lands (the column or the location changes) ends it; a tap on the view already shown, or a new-tab click
  // (SegmentedTabs does not report it), never starts one.
  useEffect(() => { setPending(undefined); }, [column, locationKey]);
  const bodyRef = useRef<HTMLDivElement>(null);
  const hold = useViewHold(shown !== column || (pending !== undefined && pending !== column), bodyRef);
  let body: ReactNode;
  if (shown === 'list') body = list?.({ today, filters, defaultWhen }) ?? null;
  else if (shown === 'calendar') body = calendar!(today);
  // Keyed by board, so switching straight from one board to the other never carries the first one's failure over.
  else body = <ChunkBoundary key={shown}>{attempt => {
    const View = (shown === 'perks' ? perksView : openingsView)(attempt);
    return <View today={today} region={filters.region} />;
  }}</ChunkBoundary>;

  return <div className="ev-page" data-view={column}>
    <PageContainer>
      <header className="ui-page-header ev-header" data-size="display">
        <div className="ev-head">
          <h1 className="ui-page-header__title">{t('活动', 'Events')}</h1>
          <p className="ev-range" {...scope}>{rangeLine}</p>
        </div>
        <p className="ev-lede-facts" {...scope}>
          {/* a no-break space before each "·", so a wrapped line never starts with one (N06), and in English one inside a date
              ("Oct 16"), so a wrap never splits it; an English line that opens on the promise (/calendar) starts with a capital */}
          {facts}
          <span className="ev-lede-facts__how">{facts && <span aria-hidden="true">{'\u00a0· '}</span>}<MoreLink to={METHOD_HREF}>{t('我们怎么核对', 'How we check')}</MoreLink></span>
        </p>
      </header>
      <div className="ev-tabs-bar"><SegmentedTabs className="ev-tabs" label={t('活动分区', 'Event views')} items={tabs} value={current} onChange={id => setPending(id === column ? undefined : id)} /></div>
    </PageContainer>
    <PageContainer className="ev-body">
      <div {...scope} ref={bodyRef} className="ev-view" data-hold={hold.phase === 'idle' ? undefined : hold.phase} aria-busy={hold.phase === 'idle' ? undefined : true}
        style={hold.phase === 'idle' ? undefined : { minHeight: hold.height }}>
        {hold.phase === 'skeleton' && <div className="ev-view__skeleton"><SkeletonFeed count={4} /></div>}
        <Suspense fallback={<SkeletonFeed count={4} />}>{body}</Suspense>
      </div>
    </PageContainer>
  </div>;
}
