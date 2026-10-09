import './events.css';
import { Suspense, useEffect, useState, type ReactNode } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { PageContainer, PageHeader, SegmentedTabs, SkeletonFeed } from '../../components/ui';
import { useUiCopy } from '../../components/ui/ui-copy';
import { useBayAreaToday } from '../../lib/useBayAreaToday';
import { getMonthlyDateRange, isFreeToAttend } from '../../lib/monthly';
import { EVENTS_INDEX, INDEX_EVENTS, INDEX_OFFERS, INDEX_OPENINGS, columnFor, inRange, liveOffers, monthDay, readFilters, readSavedRegion, regionLabel, type EventsWhen } from './events-model';
import { WeekendView } from './WeekendView';
import { ChunkBoundary } from './ChunkBoundary';
import { retryableLazy } from './lazy-view';

// The two other boards load on demand: /events itself stays small (RC-33), and their skeleton and retry states are real.
const perksView = retryableLazy(() => import('./PerksView'));
const openingsView = retryableLazy(() => import('./OpeningsView'));

const WEEKDAYS_ZH = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const WEEKDAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * 活动 (plan D3, design.md §4.11): one header — H1 活动, a range line that follows `when` (本周末 · 10/10–11, 今天 · 10/9
 * 周五, 全部日期 …), the counts and the source promise — then the four views as one sticky row: 本周末 | 日历·地图 | 免费与优惠
 * | 新店. /events opens on 本周末, /this-month on 全部日期, /calendar on its day view.
 */
export function EventsShell({ today: suppliedToday, defaultWhen = 'weekend', calendar }: {
  today?: string; defaultWhen?: EventsWhen;
  /** /calendar passes its view (imported by CalendarPage, so the prerender renders it and /events does not load it). */
  calendar?: (today: string) => ReactNode;
}) {
  const { t, pick, english } = useUiCopy();
  const today = useBayAreaToday(suppliedToday);
  const [params] = useSearchParams();
  const { hash } = useLocation();
  // The saved region applies after mount, so the prerendered page and the first render agree.
  const [savedRegion, setSavedRegion] = useState<ReturnType<typeof readSavedRegion>>();
  useEffect(() => setSavedRegion(readSavedRegion()), []);
  const column = columnFor(params, hash, !!calendar);
  const filters = readFilters(params, defaultWhen, savedRegion);

  const md = monthDay;
  const weekday = (day: string) => (english ? WEEKDAYS_EN : WEEKDAYS_ZH)[new Date(`${day}T12:00:00Z`).getUTCDay()];
  const range = getMonthlyDateRange(filters.when, today);
  const span = (start: string, end: string) => start === end ? `${md(start)} ${weekday(start)}`
    : start.slice(0, 7) === end.slice(0, 7) ? `${md(start)}–${Number(end.slice(8, 10))}` : `${md(start)}–${md(end)}`;
  const whenLine = filters.when === 'weekend' ? `${t('本周末', 'This weekend')} · ${span(range!.start, range!.end)}`
    : filters.when === 'today' ? `${t('今天', 'Today')} · ${span(today, today)}`
    : filters.when === 'next7' ? `${t('未来 7 天', 'Next 7 days')} · ${span(range!.start, range!.end)}`
    : filters.when === 'october' ? t('十月', 'October') : filters.when === 'november' ? t('十一月', 'November')
    : `${t('全部日期', 'All dates')} · ${t(`收录至 ${md(EVENTS_INDEX.edition.throughDate)}`, `through ${md(EVENTS_INDEX.edition.throughDate)}`)}`;
  const region = filters.region === 'all' ? '' : ` · ${pick(regionLabel(filters.region))}`;
  const inScope = INDEX_EVENTS.filter(event => inRange(event, range, today) && (filters.region === 'all' || event.region === filters.region));
  const free = inScope.filter(event => isFreeToAttend(event)).length;
  const offers = column === 'perks' ? liveOffers(INDEX_OFFERS, today, 'all', filters.region).length : 0;
  const checked = t(`核对于 ${md(EVENTS_INDEX.edition.checkedAt)}`, `checked ${md(EVENTS_INDEX.edition.checkedAt)}`);
  const promise = t('逐条附官方来源', 'every listing links its official source');

  const rangeLine = column === 'perks' ? t('免费与优惠', 'Free & deals') + region
    : column === 'openings' ? t('新店', 'New shops') + region
    : column === 'calendar' ? t('日历·地图', 'Calendar & map') + region : whenLine + region;
  const counts = column === 'perks' ? t(`${offers} 条优惠与免费福利`, `${offers} offers and free perks`)
    : column === 'openings' ? t(`${INDEX_OPENINGS.length} 家新店与开业消息`, `${INDEX_OPENINGS.length} new shops and openings`)
    : column === 'calendar' ? t('按日期看全部活动，点开当天', 'Every event by date; open a day')
    : english ? `${inScope.length} ${inScope.length === 1 ? 'event' : 'events'} · ${free} free` : t(`${inScope.length} 场 · ${free} 场免费`, `${inScope.length} events · ${free} free`);

  const tabs = [
    { id: 'list', label: t('本周末', 'Weekend'), to: '/events' },
    { id: 'calendar', label: t('日历·地图', 'Calendar'), to: '/calendar' },
    { id: 'perks', label: t('免费与优惠', 'Free & deals'), to: '/events?view=perks' },
    { id: 'openings', label: t('新店', 'New shops'), to: '/events?view=openings' },
  ];
  // 本周末 is current only while the list shows the weekend; other dates leave the row unmarked (the range line says which).
  const current = column === 'list' && filters.when !== 'weekend' ? '' : column;

  let body: ReactNode;
  if (column === 'list') body = <WeekendView today={today} filters={filters} defaultWhen={defaultWhen} />;
  else if (column === 'calendar') body = calendar!(today);
  else body = <ChunkBoundary>{attempt => {
    const View = (column === 'perks' ? perksView : openingsView)(attempt);
    return <Suspense fallback={<SkeletonFeed count={4} />}><View today={today} region={filters.region} /></Suspense>;
  }}</ChunkBoundary>;

  return <div className="ev-page">
    <PageContainer>
      <PageHeader title={t('活动', 'Events')} size="display" className="ev-header"
        lede={<><strong className="ev-range">{rangeLine}</strong><span className="ev-lede-facts">{[counts, promise, checked].filter(Boolean).join(' · ')}</span></>} />
    </PageContainer>
    <div className="ev-tabs-bar"><PageContainer><SegmentedTabs label={t('活动分区', 'Event views')} items={tabs} value={current} /></PageContainer></div>
    <PageContainer className="ev-body">{body}</PageContainer>
  </div>;
}
