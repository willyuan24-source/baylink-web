import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Baby, ChevronDown, Gift, HeartHandshake, Leaf, Music, SlidersHorizontal, Store, Trees, Umbrella, type LucideIcon } from 'lucide-react';
import { Button, Carousel, ChipRow, EmptyState, FeedGrid, FeedItem, FilterChip, SegmentedControl, Sheet, SkeletonFeed, useFeedLayout } from '../../components/ui';
import { useUiCopy } from '../../components/ui/ui-copy';
import { translateText } from '../../i18n/locale';
import { createCoverPage, resolveCovers, type ResolvedCover } from '../../lib/cover';
import { normalizeSearchText } from '../../lib/search-synonyms';
import { recordIcsDownload, recordProductEvent } from '../../lib/product-events';
import { dateScope } from '../../lib/date-guard';
import { featurePhotos, getMonthlyDateRange, nextOccurrence, type WeekendDayTab } from '../../lib/monthly';
import { useReadingSize, useSimpleDisplay } from '../../lib/reading-preferences';
import {
  ALL_REGIONS, REGIONS, TAGS, WHEN_OPTIONS, activeBulletins, activeFilterCount, cardRegionOf, coverContext, defaultDayTab,
  hasRealCover, inRange, listEvents, listWindow, matchesFilters, monthDay, saveRegion, weekdayIndex, weekendPicks, weekendTabs, weeklyCardHref, WEEKDAYS, type CardRegion, type EventTag, type EventsFilters, type EventsWhen,
} from './events-model';
import { prefetchLaterEvents, useIndexEvents } from './events-later';
import { ChunkError } from './ChunkBoundary';
import type { IndexEvent } from './events-index-types';
import { EventFeedCard, EventHeroCard } from './EventCards';
import { ShareLandingStrip, type StripState } from './ShareLandingStrip';
import { ImageCredits } from './ImageCredits';

const PAGE = 12;
const STORY_ICONS: Record<EventTag | 'free', LucideIcon> = { free: Gift, kids: Baby, seniors: HeartHandshake, outdoors: Trees, shows: Music, markets: Store, pumpkin: Leaf, indoor: Umbrella };
const eventItem = (event: IndexEvent) => ({ kind: 'event' as const, id: event.id, imageKey: event.imageKey });

/**
 * The ids printed on a weekly share card, read from the card's own manifest (/weekly/{region}.json, written by the same
 * build step as the PNG), so the landing strip lists exactly what the reader scanned (plan WEB-EVENTS accept).
 */
function useCardIds(card: CardRegion | undefined): StripState {
  const [state, setState] = useState<StripState>({ status: 'idle' });
  useEffect(() => {
    if (!card) { setState({ status: 'idle' }); return; }
    let live = true;
    setState({ status: 'loading' });
    fetch(`/weekly/${card}.json`).then(response => {
      if (!response.ok) throw new Error(String(response.status));
      return response.json() as Promise<{ day?: string; range?: { start: string; end: string }; picks?: { id: string }[] }>;
    }).then(manifest => {
      if (live) setState({ status: 'ready', ids: (manifest.picks ?? []).map(pick => pick.id), range: manifest.range });
    }).catch(() => { if (live) setState({ status: 'error' }); });
    return () => { live = false; };
  }, [card]);
  return state;
}

/**
 * The 本周末 view (design.md §4.11 ③) and the other date lists: story chips, the editor's picks (4:5 rail), the 周六 /
 * 周日 / 整个周末都开放 toggle, a one-tap region row, one filter row (免费 · 筛选 n) with the rest in a Sheet that announces its count, a
 * two-column cover feed 12 at a time, the folded travel alerts, and one link each to the rest of the column.
 */
export function WeekendView({ today, filters, defaultWhen }: { today: string; filters: EventsFilters; defaultWhen: EventsWhen }) {
  const { t, pick, locale, english } = useUiCopy();
  const [params, setParams] = useSearchParams();
  const [shown, setShown] = useState(PAGE);
  const [sheetOpen, setSheetOpen] = useState(false);
  const { layout } = useFeedLayout();
  const card = cardRegionOf(params.get('from'));
  const strip = useCardIds(card);

  const update = (changes: Record<string, string | null>) => {
    setShown(PAGE);
    setParams(previous => {
      const next = new URLSearchParams(previous);
      for (const [name, value] of Object.entries(changes)) if (value === null) next.delete(name); else next.set(name, value);
      return next;
    }, { replace: true, preventScrollReset: true });
  };
  const setRegion = (region: EventsFilters['region']) => { saveRegion(region); update({ region }); };
  const clear = () => update({ when: null, cost: null, tag: null, category: null, q: null, day: null });

  const weekend = filters.when === 'weekend';
  const range = getMonthlyDateRange(filters.when, today);
  const weekendDays = weekend ? [range!.start, range!.end].filter(day => day >= today) : [];
  // WEB-PERF-2: the days this view reads (and a share card's weekend); past the route's own events they load first, under a
  // fixed-height skeleton. The filter Sheet starts that load when it opens, before a later date is picked.
  const listDays = listWindow(range, today);
  const cardDays = card ? listWindow(getMonthlyDateRange('weekend', today), today) : listDays;
  const { events, failed, retry } = useIndexEvents(listDays.start < cardDays.start ? listDays.start : cardDays.start,
    listDays.end === null || cardDays.end === null ? null : listDays.end > cardDays.end ? listDays.end : cardDays.end);
  useEffect(() => { if (sheetOpen) prefetchLaterEvents(locale); }, [sheetOpen, locale]);
  // The date range and region: what the story chips count and the other filters narrow.
  const base = useMemo(() => (events ?? []).filter(event => (filters.region === 'all' || event.region === filters.region)
    && (weekend ? weekendDays.some(day => nextOccurrence(event, day) === day) : inRange(event, range, today))),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [events, filters.region, filters.when, today]);
  const normalize = normalizeSearchText;
  const translate = (value: string) => translateText(value, locale);
  const matching = useMemo(() => base.filter(event => matchesFilters(event, { ...filters, region: 'all' }, normalize, translate)),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [base, filters.free, filters.tag, filters.category, filters.q, locale]);

  const { days, tabs } = useMemo(() => weekendTabs(matching, today), [matching, today]);
  const dayParam = params.get('day');
  const day: WeekendDayTab = dayParam === 'sat' || dayParam === 'sun' || dayParam === 'open' ? dayParam : defaultDayTab(tabs, today, days);
  const narrowed = filters.free || !!filters.tag || !!filters.category || !!filters.q;
  // A card whose manifest did not load lists nothing, so the page falls back to the plain 本周末: picks rail and full feed.
  const listsCard = !!card && strip.status !== 'error';
  const picks = useMemo(() => weekend && !narrowed && !listsCard ? weekendPicks(base, today) : [], [weekend, narrowed, listsCard, base, today]);
  // H26 / HOMEIA13-03: only picks from the editor's list (src/data/weekend-picks.ts, each with its reason) are 编辑精选.
  const editorPicks = picks.some(item => item.reason);
  // Until the card's manifest arrives, the same rule the card used stands in for its ids (they match on the build day).
  const cardIds = useMemo(() => {
    if (!card || strip.status === 'error') return [];
    if (strip.status === 'ready') return strip.ids;
    const all = events ?? [];
    return weekendPicks(card === 'all' ? all : all.filter(event => event.region === card), today, { limit: 3 }).map(item => item.event.id);
  }, [card, strip, today, events]);
  const stripEvents = cardIds.flatMap(id => (events ?? []).filter(event => event.id === id && nextOccurrence(event, today)));
  const excluded = new Set(listsCard ? cardIds : picks.map(item => item.event.id));
  // 本周末 is ranked, so its best real photos take the first screen's diagonal slots; the date lists stay in date order.
  const list = useMemo(() => weekend ? featurePhotos(tabs[day].filter(event => !excluded.has(event.id)), event => hasRealCover('event', event, today))
    : listEvents(matching, filters.when, today).filter(event => !excluded.has(event.id)),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [weekend, tabs, day, matching, filters.when, today, cardIds, picks]);
  const visible = list.slice(0, shown);
  const feedDays = weekend ? (day === 'sat' ? [days[0]] : day === 'sun' ? [days[1]] : days.filter(item => item >= today)) : [];

  // One page context in display order — share strip, picks, feed — so an image appears once per page (VISUAL-10).
  const covers = useMemo(() => {
    const context = { ...coverContext(today), page: createCoverPage() };
    const stripCovers = card && strip.status === 'ready' ? resolveCovers(stripEvents.map(eventItem), context) : [];
    const pickCovers = resolveCovers(picks.map(item => eventItem(item.event)), context);
    const feedCovers = resolveCovers(visible.map(eventItem), context);
    return { strip: stripCovers, picks: pickCovers, feed: feedCovers };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card, strip, picks, visible, today]);

  // The Sheet announces what closing it shows: the chosen day's list (the status line's number), not the weekend's union.
  // While the dates load they say so; a failed load says that (the retry state sits right below), never "loading" over it.
  const status = events ? t(`找到 ${list.length} 场活动`, `${list.length} ${list.length === 1 ? 'event' : 'events'}`)
    : failed ? t('这些日期的活动没能加载', 'Events for these dates did not load') : t('正在加载这些日期的活动…', 'Loading events for these dates…');
  const sheetCount = events ? t(`显示 ${list.length} 场`, `Show ${list.length}`) : failed ? t('关闭', 'Close') : t('正在加载…', 'Loading…');
  const sheetStatus = events || !failed ? sheetCount : t('这些日期的活动没能加载', 'Events for these dates did not load');
  const filterCount = activeFilterCount(filters, defaultWhen);
  // At 大 / 特大 and in 简洁显示 the three day buttons get short names (周六 · 周日 · 两天): with the date the labels wrapped
  // as 两天都开 / 放 and 周日 / 10/18. The weekend's dates stay in the page's range line right above.
  const readingSize = useReadingSize(), simple = useSimpleDisplay();
  const roomy = readingSize !== 'standard' || simple;
  const dayLabel = (value: string) => roomy ? pick(WEEKDAYS[weekdayIndex(value)].short) : `${pick(WEEKDAYS[weekdayIndex(value)].short)}${english ? ',' : ''} ${monthDay(value, english)}`;
  const alerts = activeBulletins(today, filters.region);
  const countFor = (next: Pick<EventsFilters, 'free' | 'tag'>) => base.filter(event => matchesFilters(event, { region: 'all', q: '', ...next }, normalize, translate)).length;
  const stories = [{ id: 'free' as const, label: { zh: '免费', en: 'Free' } }, ...TAGS]
    .map(story => ({ ...story, pressed: story.id === 'free' ? filters.free : filters.tag === story.id, count: countFor(story.id === 'free' ? { free: true } : { free: false, tag: story.id }) }))
    // while the dates load, every story keeps its place (no row that shrinks, then grows back)
    .filter(story => !events || story.count > 0 || story.pressed);
  const more = Math.min(PAGE, list.length - visible.length);

  return <>
    {card && <ShareLandingStrip region={card} state={strip} events={stripEvents} covers={covers.strip} today={today} />}

    <div className="ev-stories" role="group" aria-label={t('快速挑选', 'Quick picks')}>
      {stories.map(story => {
        const Icon = STORY_ICONS[story.id];
        return <button key={story.id} type="button" className="ev-story" data-story={story.id} aria-pressed={story.pressed}
          onClick={() => story.id === 'free' ? update({ cost: story.pressed ? null : 'free' }) : update({ tag: story.pressed ? null : story.id, category: null })}>
          <span className="ev-story__icon" aria-hidden="true"><Icon strokeWidth={1.75} /></span>
          <span className="ev-story__label">{pick(story.label)}</span>
        </button>;
      })}
    </div>

    {picks.length > 0 && <section className="ev-picks" aria-labelledby="ev-picks-heading">
      <h2 id="ev-picks-heading" className="ev-section-title">{editorPicks ? t('编辑精选', 'Editor’s picks') : t('本周末先看', 'This weekend, start here')}</h2>
      <Carousel variant="rail" label={editorPicks ? t('本周末编辑精选', 'This weekend’s editor’s picks') : t('本周末先看这几件', 'This weekend, start with these')}>
        {picks.map((item, index) => <EventHeroCard key={item.event.id} event={item.event} cover={covers.picks[index]} today={today} date={item.date} reason={item.reason} priority={index === 0} />)}
      </Carousel>
    </section>}

    <section id="monthly-events" className="ev-feed" aria-labelledby="ev-feed-heading">
      <h2 id="ev-feed-heading" className="ev-section-title">{weekend ? t('本周末全部活动', 'All events this weekend') : t('活动', 'Events')}</h2>
      {weekend && <div className="ev-days-bar"><SegmentedControl className="ev-days" label={t('选择哪一天', 'Choose a day')} value={day} onChange={value => update({ day: value })}
        items={[
          ...(days[0] >= today ? [{ id: 'sat', label: dayLabel(days[0]) }] : []),
          { id: 'sun', label: dayLabel(days[1]) },
          { id: 'open', label: roomy ? t('两天', 'Both') : t('两天都开放', 'Both days') },
        ]} /></div>}
      {/* H23 / HOMEIA13-02: 本周末旧金山免费亲子 in three taps from home — the region applies on one tap, no Sheet. */}
      <ChipRow className="ev-regions" label={t('地区', 'Region')}>
        <FilterChip selected={filters.region === 'all'} onClick={() => setRegion('all')}>{pick(ALL_REGIONS)}</FilterChip>
        {REGIONS.map(region => <FilterChip key={region.id} selected={filters.region === region.id} onClick={() => setRegion(region.id)}>{pick(region.label)}</FilterChip>)}
      </ChipRow>
      <div className="ev-filter-row">
        <FilterChip selected={filters.free} onClick={() => update({ cost: filters.free ? null : 'free' })}>{t('免费', 'Free')}</FilterChip>
        <FilterChip selected={filterCount > 0} aria-haspopup="dialog" onClick={() => setSheetOpen(true)} count={filterCount || undefined}
          icon={<SlidersHorizontal aria-hidden="true" strokeWidth={1.75} />}>{t('筛选', 'Filters')}</FilterChip>
        <p className="ev-count" role="status" aria-live="polite">{status}</p>
      </div>

      {!events ? failed ? <ChunkError onRetry={retry} /> : <SkeletonFeed count={4} />
      : visible.length ? <>
        <FeedGrid label={weekend ? t('本周末活动', 'Events this weekend') : t('活动', 'Events')} layout={layout}>
          {visible.map((event, index) => <FeedItem key={event.id}>
            <EventFeedCard event={event} cover={covers.feed[index]} today={today} days={feedDays}
              priority={!picks.length && !listsCard && index === 0} />
          </FeedItem>)}
        </FeedGrid>
        {more > 0 && <div className="ev-more">
          <Button variant="secondary" block onClick={() => setShown(count => count + PAGE)}>{t(`再看 ${more} 场`, `Show ${more} more`)}</Button>
          <p className="ev-more__note">{t(`已显示 ${visible.length} / ${list.length} 场`, `${visible.length} of ${list.length}`)}</p>
        </div>}
      </> : <EmptyState headingLevel="h3" title={t('这组条件下暂时没有活动', 'Nothing matches these filters yet')}
        body={filters.q ? t('换个关键词，或把这句话交给 BayBay。', 'Try another word, or ask BayBay.') : t('换一天、换个地区，或清除筛选再看看。', 'Try another day or region, or clear the filters.')}
        actions={filters.tag === 'seniors' && !filters.q ? <>
          {/* H06: no 长辈友好 event in this range — the 长辈与家属 guides and BayBay instead of only "clear" (HOMEIA13-01). */}
          <Button variant="primary" to="/guides?topic=elders">{t('看长辈与家属指南', 'Guides for seniors and family')}</Button>
          <Button variant="text" to={`/plan?q=${encodeURIComponent(t('这周末带爸妈去哪？', 'Where can I take my parents this weekend?'))}`}>{t('问 BayBay：这周末带爸妈去哪', 'Ask BayBay where to take your parents')}</Button>
          <Button variant="text" onClick={clear}>{t('清除筛选', 'Clear filters')}</Button>
        </> : <>
          <Button variant="primary" onClick={clear}>{t('清除筛选', 'Clear filters')}</Button>
          {filters.q ? <Button variant="text" to={`/plan?q=${encodeURIComponent(filters.q)}`}>{t('问 BayBay', 'Ask BayBay')}</Button>
            : weekend ? <Button variant="text" to="/events?when=next7">{t('看未来 7 天', 'See the next 7 days')}</Button> : null}
        </>} />}
    </section>

    {/* CW-02: the alerts and the share card are keyed to the day, inside a 本周末 list that keeps all week (date-guard.ts). */}
    {alerts.length > 0 && <details className="ev-alerts" id="monthly-news" {...dateScope('day')}>
      <summary>{t(`出行提醒 ${alerts.length} 条`, `Travel and local updates · ${alerts.length}`)}<ChevronDown aria-hidden="true" strokeWidth={1.75} /></summary>
      <ul>{alerts.map(item => <li key={item.id}>
        <strong>{item.title}</strong>
        <span>{item.label} · {item.dateLabel}</span>
        <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">{t('官方', 'Official')} · {item.sourceLabel}</a>
      </li>)}</ul>
    </details>}

    <EventsPageEnd region={filters.region} today={today} />
    <ImageCredits covers={[...covers.strip, ...covers.picks, ...covers.feed]} />

    <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title={t('筛选活动', 'Filter events')} status={sheetStatus}
      footer={<>
        <Button variant="text" onClick={clear}>{t('清除', 'Clear')}</Button>
        <Button variant="primary" onClick={() => setSheetOpen(false)}>{sheetCount}</Button>
      </>}>
      <SheetSection title={t('什么时候', 'When')}>
        {WHEN_OPTIONS.map(option => <FilterChip key={option.id} selected={filters.when === option.id}
          onClick={() => update({ when: option.id === defaultWhen ? null : option.id, day: null })}>{pick(option.label)}</FilterChip>)}
      </SheetSection>
      <SheetSection title={t('地区', 'Region')}>
        <FilterChip selected={filters.region === 'all'} onClick={() => setRegion('all')}>{pick(ALL_REGIONS)}</FilterChip>
        {REGIONS.map(region => <FilterChip key={region.id} selected={filters.region === region.id} onClick={() => setRegion(region.id)}>{pick(region.label)}</FilterChip>)}
      </SheetSection>
      <SheetSection title={t('想找什么', 'What kind')}>
        <FilterChip selected={filters.free} onClick={() => update({ cost: filters.free ? null : 'free' })}>{t('免费', 'Free')}</FilterChip>
        {TAGS.map(tag => <FilterChip key={tag.id} selected={filters.tag === tag.id} onClick={() => update({ tag: filters.tag === tag.id ? null : tag.id, category: null })}>{pick(tag.label)}</FilterChip>)}
      </SheetSection>
      <label className="ev-search">
        <span>{t('关键词', 'Keyword')}</span>
        <input type="search" value={params.get('q') || ''} maxLength={200} placeholder={t('活动名、城市或场馆', 'Event, city or venue')}
          onChange={event => update({ q: event.target.value || null })} />
      </label>
    </Sheet>
  </>;
}

function SheetSection({ title, children }: { title: string; children: ReactNode }) {
  return <section className="ev-sheet-section"><h3>{title}</h3><ChipRow label={title}>{children}</ChipRow></section>;
}

/** The end of the list: save the weekend as an image, subscribe, and one link each to the rest (VISUAL-18). */
export function EventsPageEnd({ region, today }: { region: EventsFilters['region']; today: string }) {
  const { t } = useUiCopy();
  return <nav className="ev-end" aria-label={t('更多活动入口', 'More from Events')}>
    <a className="ev-end__item ev-end__item--wide" href={weeklyCardHref(region, today)} target="_blank" rel="noopener" onClick={() => recordProductEvent('share_card_download')} {...dateScope('day')}>{t('存成一张图：本周末精选', 'Save this weekend’s picks as an image')}</a>
    <a className="ev-end__item ev-end__item--wide" href={`webcal://www.baylink.us/calendars/${region}.ics`} onClick={recordIcsDownload}>{t('订阅到手机日历（只含活动日期）', 'Subscribe in your phone calendar (dates only)')}</a>
    <Link className="ev-end__item" to="/events?view=perks">{t('免费与优惠', 'Free & deals')}</Link>
    <Link className="ev-end__item" to="/events?view=openings">{t('新店与开业', 'New shops')}</Link>
    <Link className="ev-end__item" to="/explore">{t('半日慢游去处', 'Half-day outings')}</Link>
    <Link className="ev-end__item" to="/guides">{t('出门前读一篇指南', 'Read a guide before you go')}</Link>
  </nav>;
}

export type { ResolvedCover };
