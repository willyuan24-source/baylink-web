import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Baby, ChevronDown, Gift, HeartHandshake, Leaf, Music, SlidersHorizontal, Store, Trees, Umbrella, type LucideIcon } from 'lucide-react';
import { Button, Carousel, ChipRow, EmptyState, FeedGrid, FeedItem, FilterChip, SegmentedControl, Sheet, useFeedLayout } from '../../components/ui';
import { useUiCopy } from '../../components/ui/ui-copy';
import { translateText } from '../../i18n/locale';
import { createCoverPage, distinctNeighbourTones, resolveCovers, type ResolvedCover } from '../../lib/cover';
import { eventTone } from '../../lib/event-facts';
import { normalizeSearchText } from '../../lib/search-synonyms';
import { featurePhotos, getMonthlyDateRange, nextOccurrence, type WeekendDayTab } from '../../lib/monthly';
import {
  ALL_REGIONS, INDEX_EVENTS, REGIONS, TAGS, WHEN_OPTIONS, activeBulletins, activeFilterCount, cardRegionOf, coverContext, defaultDayTab,
  hasRealCover, inRange, listEvents, matchesFilters, monthDay, regionLabel, saveRegion, weekendPicks, weekendTabs, type CardRegion, type EventTag, type EventsFilters, type EventsWhen,
} from './events-model';
import type { IndexEvent } from './events-index-types';
import { EventFeedCard, EventHeroCard } from './EventCards';
import { ShareLandingStrip, type StripState } from './ShareLandingStrip';
import { ImageCredits } from './ImageCredits';

const PAGE = 12;
const STORY_ICONS: Record<EventTag | 'free', LucideIcon> = { free: Gift, kids: Baby, seniors: HeartHandshake, outdoors: Trees, shows: Music, markets: Store, pumpkin: Leaf, indoor: Umbrella };
const WEEKDAY_ZH = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const WEEKDAY_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
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
 * 周日 / 整个周末都开放 toggle, one filter row (免费 · 地区 · 筛选 n) with the rest in a Sheet that announces its count, a
 * two-column cover feed 12 at a time, the folded travel alerts, and one link each to the rest of the column.
 */
export function WeekendView({ today, filters, defaultWhen }: { today: string; filters: EventsFilters; defaultWhen: EventsWhen }) {
  const { t, pick, english, locale } = useUiCopy();
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
  // The date range and region: what the story chips count and the other filters narrow.
  const base = useMemo(() => INDEX_EVENTS.filter(event => (filters.region === 'all' || event.region === filters.region)
    && (weekend ? weekendDays.some(day => nextOccurrence(event, day) === day) : inRange(event, range, today))),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [filters.region, filters.when, today]);
  const normalize = normalizeSearchText;
  const translate = (value: string) => translateText(value, locale);
  const matching = useMemo(() => base.filter(event => matchesFilters(event, { ...filters, region: 'all' }, normalize, translate)),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [base, filters.free, filters.tag, filters.category, filters.q, locale]);

  const { days, tabs } = useMemo(() => weekendTabs(matching, today), [matching, today]);
  const dayParam = params.get('day');
  const day: WeekendDayTab = dayParam === 'sat' || dayParam === 'sun' || dayParam === 'open' ? dayParam : defaultDayTab(tabs, today, days);
  const narrowed = filters.free || !!filters.tag || !!filters.category || !!filters.q;
  const picks = useMemo(() => weekend && !narrowed && !card ? weekendPicks(base, today) : [], [weekend, narrowed, card, base, today]);
  // Until the card's manifest arrives, the same rule the card used stands in for its ids (they match on the build day).
  const cardIds = useMemo(() => {
    if (!card) return [];
    if (strip.status === 'ready') return strip.ids;
    return weekendPicks(card === 'all' ? INDEX_EVENTS : INDEX_EVENTS.filter(event => event.region === card), today, { limit: 3 }).map(item => item.event.id);
  }, [card, strip, today]);
  const stripEvents = cardIds.flatMap(id => INDEX_EVENTS.filter(event => event.id === id && nextOccurrence(event, today)));
  const excluded = new Set(card ? cardIds : picks.map(item => item.event.id));
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
  const tones = distinctNeighbourTones(visible.map((event, index) => covers.feed[index].tier === 'type' ? eventTone(event) : null));

  const resultCount = weekend ? new Set([...tabs.sat, ...tabs.sun, ...tabs.open].map(event => event.id)).size : matching.length;
  const status = t(`找到 ${list.length} 场活动`, `${list.length} ${list.length === 1 ? 'event' : 'events'}`);
  const sheetCount = t(`显示 ${resultCount} 场`, `Show ${resultCount}`);
  const filterCount = activeFilterCount(filters, defaultWhen);
  const dayLabel = (value: string) => `${(english ? WEEKDAY_EN : WEEKDAY_ZH)[new Date(`${value}T12:00:00Z`).getUTCDay()]} ${monthDay(value)}`;
  const alerts = activeBulletins(today, filters.region);
  const countFor = (next: Pick<EventsFilters, 'free' | 'tag'>) => base.filter(event => matchesFilters(event, { region: 'all', q: '', ...next }, normalize, translate)).length;
  const stories = [{ id: 'free' as const, label: { zh: '免费', en: 'Free' } }, ...TAGS]
    .map(story => ({ ...story, pressed: story.id === 'free' ? filters.free : filters.tag === story.id, count: countFor(story.id === 'free' ? { free: true } : { free: false, tag: story.id }) }))
    .filter(story => story.count > 0 || story.pressed);
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
      <h2 id="ev-picks-heading" className="ev-section-title">{t('编辑精选', 'Editor’s picks')}</h2>
      <Carousel variant="rail" label={t('本周末编辑精选', 'This weekend’s editor’s picks')}>
        {picks.map((item, index) => <EventHeroCard key={item.event.id} event={item.event} cover={covers.picks[index]} today={today} date={item.date} reason={item.reason} priority={index === 0} />)}
      </Carousel>
    </section>}

    <section id="monthly-events" className="ev-feed" aria-labelledby="ev-feed-heading">
      <h2 id="ev-feed-heading" className="ev-section-title">{weekend ? t('本周末全部活动', 'All events this weekend') : t('活动', 'Events')}</h2>
      {weekend && <SegmentedControl className="ev-days" label={t('选择哪一天', 'Choose a day')} value={day} onChange={value => update({ day: value })}
        items={[
          ...(days[0] >= today ? [{ id: 'sat', label: dayLabel(days[0]) }] : []),
          { id: 'sun', label: dayLabel(days[1]) },
          { id: 'open', label: t('两天都开放', 'Both days') },
        ]} />}
      <div className="ev-filter-row">
        <FilterChip selected={filters.free} onClick={() => update({ cost: filters.free ? null : 'free' })}>{t('免费', 'Free')}</FilterChip>
        <FilterChip selected={filters.region !== 'all'} aria-haspopup="dialog" onClick={() => setSheetOpen(true)}>
          {pick(regionLabel(filters.region))}<ChevronDown className="ev-chip-caret" aria-hidden="true" strokeWidth={1.75} />
        </FilterChip>
        <FilterChip selected={filterCount > 0} aria-haspopup="dialog" onClick={() => setSheetOpen(true)} count={filterCount || undefined}
          icon={<SlidersHorizontal aria-hidden="true" strokeWidth={1.75} />}>{t('筛选', 'Filters')}</FilterChip>
        <p className="ev-count" role="status" aria-live="polite">{status}</p>
      </div>

      {visible.length ? <>
        <FeedGrid label={weekend ? t('本周末活动', 'Events this weekend') : t('活动', 'Events')} layout={layout}>
          {visible.map((event, index) => <FeedItem key={event.id}>
            <EventFeedCard event={event} cover={covers.feed[index]} tone={tones[index] ?? undefined} today={today} days={feedDays}
              priority={!picks.length && !card && index === 0} />
          </FeedItem>)}
        </FeedGrid>
        {more > 0 && <div className="ev-more">
          <Button variant="secondary" block onClick={() => setShown(count => count + PAGE)}>{t(`再看 ${more} 场`, `Show ${more} more`)}</Button>
          <p className="ev-more__note">{t(`已显示 ${visible.length} / ${list.length} 场`, `${visible.length} of ${list.length}`)}</p>
        </div>}
      </> : <EmptyState headingLevel="h3" title={t('这组条件下暂时没有活动', 'Nothing matches these filters yet')}
        body={filters.q ? t('换个关键词，或把这句话交给 BayBay。', 'Try another word, or ask BayBay.') : t('换一天、换个地区，或清除筛选再看看。', 'Try another day or region, or clear the filters.')}
        actions={<>
          <Button variant="primary" onClick={clear}>{t('清除筛选', 'Clear filters')}</Button>
          {filters.q ? <Button variant="text" to={`/plan?q=${encodeURIComponent(filters.q)}`}>{t('问 BayBay', 'Ask BayBay')}</Button>
            : weekend ? <Button variant="text" to="/events?when=next7">{t('看未来 7 天', 'See the next 7 days')}</Button> : null}
        </>} />}
    </section>

    {alerts.length > 0 && <details className="ev-alerts" id="monthly-news">
      <summary>{t(`出行提醒 ${alerts.length} 条`, `Travel alerts · ${alerts.length}`)}<ChevronDown aria-hidden="true" strokeWidth={1.75} /></summary>
      <ul>{alerts.map(item => <li key={item.id}>
        <strong>{item.title}</strong>
        <span>{item.label} · {item.dateLabel}</span>
        <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">{t('官方', 'Official')} · {item.sourceLabel}</a>
      </li>)}</ul>
    </details>}

    <EventsPageEnd region={filters.region} />
    <ImageCredits covers={[...covers.strip, ...covers.picks, ...covers.feed]} />

    <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title={t('筛选活动', 'Filter events')} status={sheetCount}
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
export function EventsPageEnd({ region }: { region: EventsFilters['region'] }) {
  const { t } = useUiCopy();
  const card = region === 'all' ? 'all' : region;
  return <nav className="ev-end" aria-label={t('更多活动入口', 'More from Events')}>
    <a className="ev-end__item" href={`/weekly/${card}.png`} target="_blank" rel="noopener">{t('存成一张图：本周末精选', 'Save this weekend’s picks as an image')}</a>
    <a className="ev-end__item" href={`webcal://www.baylink.us/calendars/${card}.ics`}>{t('订阅到手机日历（只含活动日期）', 'Subscribe in your phone calendar (dates only)')}</a>
    <Link className="ev-end__item" to="/events?view=perks">{t('免费与优惠', 'Free & deals')}</Link>
    <Link className="ev-end__item" to="/events?view=openings">{t('新店与开业', 'New shops')}</Link>
    <Link className="ev-end__item" to="/explore">{t('半日慢游去处', 'Half-day outings')}</Link>
    <Link className="ev-end__item" to="/guides">{t('出门前读一篇指南', 'Read a guide before you go')}</Link>
  </nav>;
}

export type { ResolvedCover };
