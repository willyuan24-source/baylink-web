import { Fragment, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronDown, SlidersHorizontal, X } from 'lucide-react';
import { Button, ChipRow, EmptyState, FeedGrid, FeedItem, FilterChip, SkeletonFeed, SkeletonRow, useFeedLayout } from '../../components/ui';
import { DayChips } from '../../components/ui/Segmented';
import { Disclosure } from '../../components/ui/Disclosure';
import { MoreLink } from '../../components/ui/TextLink';
import { useUiCopy } from '../../components/ui/ui-copy';
import { translateText } from '../../i18n/locale';
import { coverItemFor, createCoverPage, resolveCovers, type ResolvedCover } from '../../lib/cover';
import { normalizeSearchText } from '../../lib/search-synonyms';
import { recordIcsDownload, recordProductEvent } from '../../lib/product-events';
import { dateScope } from '../../lib/date-guard';
import { featurePhotos, getMonthlyDateRange, nextOccurrence, type WeekendDayTab } from '../../lib/monthly';
import { addCalendarDays } from '../../lib/calendar-days';
import { useReadingSize, useSimpleDisplay } from '../../lib/reading-preferences';
import {
  ALL_REGIONS, RAIL_TAGS, REGIONS, SCOPES, TAGS, WHEN_OPTIONS, activeBulletins, cardRegionOf, coverContext,
  hasRealCover, inRange, listEvents, listWindow, matchesFilters, monthDay, regionLabel, saveRegion, sheetFilterCount, weekdayIndex, weekendPicks, weekendRanked, weekendTabs, weeklyCardHref, WEEKDAYS,
  type CardRegion, type EventsFilters, type EventsWhen,
} from './events-model';
import { prefetchLaterEvents, useIndexEvents } from './events-later';
import { ChunkBoundary, ChunkError } from './ChunkBoundary';
import { loadWhenIdle, parts, retryableLazy, useOnDemand } from './lazy-view';
import type { IndexEvent } from './events-index-types';
import { EventFeedCard, EventLeadCard, EventRowCard } from './EventCards';
import type { StripProps, StripState } from './ShareLandingStrip';
import { ImageCredits } from './ImageCredits';
import { arrangePicks, homeLeadFor, leadImageKey } from './weekend-lead';
import { useViewHold } from './view-hold';

/** Cards per page: 12; in 简洁显示 6 and in 家人版 (简洁 + 特大) 4 (content arrangement §6). */
const PAGE = 12, SIMPLE_PAGE = 6, FAMILY_PAGE = 4;
/** The editor's block shows the lead and up to three pick rows (two on a phone: one 2-up row). */
const PICK_ROWS = 3;
// The share-card strip shows only on a share card's landing (?from=card-…): its chunk (lazy-view `parts`) loads with the
// card's manifest.
const shareStrip = retryableLazy<StripProps>(() => parts.load().then(module => ({ default: module.ShareLandingStrip })));
/** The strip's loading shape while its chunk loads (the same as while the manifest loads): the heading's line, three rows. */
const stripFallback = <section className="ev-strip" data-testid="share-landing-strip">
  <p className="ev-section-title" aria-hidden="true">{'\u00a0'}</p><div aria-busy="true"><SkeletonRow /><SkeletonRow /><SkeletonRow /></div>
</section>;
const eventItem = (event: IndexEvent) => coverItemFor('event', event);

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

/** Day subheads for the date lists (next7, 全部日期, 今天, the months): each card under its next day from `from`. */
function groupByDay(events: readonly IndexEvent[], from: string): { day: string; events: IndexEvent[] }[] {
  const groups: { day: string; events: IndexEvent[] }[] = [];
  for (const event of events) {
    const day = nextOccurrence(event, from) ?? event.endDate;
    const last = groups[groups.length - 1];
    if (last?.day === day) last.events.push(event); else groups.push({ day, events: [event] });
  }
  return groups;
}

/**
 * The 本周末 view and the other date lists (UI9-EVENTS content arrangement §2 + §4, G15 + G17):
 * A · 编辑精选 — the lead (EventLeadCard: never home's lead, never a close-up face) and the pick rows (2-up on phones, rows in
 *     the span-4 column on desktop); hidden in 简洁显示.
 * B · 本周末全部活动 — the H2 and "找到 n 场" on one line; rail 1: one radio group of dates — the scopes (本周末 = the whole
 *     weekend, checked on arrival | 未来 7 天 | 全部日期) and the weekend's days — then 免费 · 亲子 · 长辈友好, a removable chip per sheet choice and
 *     筛选 (n); rail 2: the regions (H23; at 大 / 特大 / 简洁 the 整个湾区 ▾ chip instead). The feed 12 at a time (6 in 简洁, 4
 *     in 家人版), grouped under day subheads on the date lists; the list end says what is shown, offers 再看 N 场 and the next day.
 * C · page end — 出行提醒 (Disclosure), one quiet list of links, 本页图片来源.
 */
export function WeekendView({ today, filters, defaultWhen }: { today: string; filters: EventsFilters; defaultWhen: EventsWhen }) {
  const { t, pick, locale, english } = useUiCopy();
  const [params, setParams] = useSearchParams();
  const readingSize = useReadingSize(), simple = useSimpleDisplay();
  const roomy = readingSize !== 'standard' || simple;
  const pageSize = simple ? readingSize === 'extra-large' ? FAMILY_PAGE : SIMPLE_PAGE : PAGE;
  // Pages beyond the first (再看 N 场); any filter change starts over.
  const [extra, setExtra] = useState(0);
  // The 筛选 sheet: undefined until it first opens (its chunk loads when the page is idle, or then).
  const [sheetOpen, setSheetOpen, loaded] = useOnDemand(parts);
  useEffect(() => loadWhenIdle(parts.load), []);
  const FilterSheet = loaded?.FilterSheet;
  const { layout } = useFeedLayout();
  const card = cardRegionOf(params.get('from'));
  const strip = useCardIds(card);

  const update = (changes: Record<string, string | null>) => {
    setExtra(0);
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
  // WEB-PERF-2: the days this view reads (and a share card's weekend); past the route's own events they load first. The
  // filter Sheet starts that load when it opens, before a later date is picked.
  const listDays = listWindow(range, today);
  const cardDays = card ? listWindow(getMonthlyDateRange('weekend', today), today) : listDays;
  const { events, failed, retry } = useIndexEvents(listDays.start < cardDays.start ? listDays.start : cardDays.start,
    listDays.end === null || cardDays.end === null ? null : listDays.end > cardDays.end ? listDays.end : cardDays.end);
  useEffect(() => { if (sheetOpen) prefetchLaterEvents(locale); }, [sheetOpen, locale]);
  // The date range and region: what the other filters narrow.
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
  // The day chips: none checked is the whole weekend (the default on arrival, so the list matches the facts line's count and
  // home's 看本周末全部 N 场); 周六 / 周日 / 两天都开放 narrow it. Days already past are dropped.
  const dayParam = params.get('day');
  const day: WeekendDayTab | '' = dayParam === 'sat' || dayParam === 'sun' || dayParam === 'open' ? dayParam : '';
  const narrowed = filters.free || !!filters.tag || !!filters.category || !!filters.q;
  // A card whose manifest did not load lists nothing, so the page falls back to the plain 本周末.
  const listsCard = !!card && strip.status !== 'error';
  const picks = useMemo(() => weekend && !narrowed && !listsCard ? weekendPicks(base, today, { limit: 5 }) : [], [weekend, narrowed, listsCard, base, today]);
  // G15 + the cross-page critic: home's lead is neither the lead nor a pick row here (it returns to the feed below).
  const homeLead = homeLeadFor(today, picks);
  // The weekend in its ranking: the feed below, and where the lead comes from when no pick has a ① or ② picture (DECISIONS 26).
  const order = useMemo(() => weekend ? weekendRanked(matching, today) : [], [weekend, matching, today]);
  const arranged = useMemo(() => arrangePicks(picks, today, homeLead, order), [picks, today, homeLead, order]);
  // Until the card's manifest arrives, the same rule the card used stands in for its ids (they match on the build day).
  const cardIds = useMemo(() => {
    if (!card || strip.status === 'error') return [];
    if (strip.status === 'ready') return strip.ids;
    const all = events ?? [];
    return weekendPicks(card === 'all' ? all : all.filter(event => event.region === card), today, { limit: 3 }).map(item => item.event.id);
  }, [card, strip, today, events]);
  const stripEvents = cardIds.flatMap(id => (events ?? []).filter(event => event.id === id && nextOccurrence(event, today)));
  // 本周末 is ranked, so its best real photos take the first screen's diagonal slots; the date lists stay in date order.
  const ranked = useMemo(() => !weekend ? listEvents(matching, filters.when, today)
    : featurePhotos(day ? tabs[day] : order, event => hasRealCover('event', event, today)),
  [weekend, matching, filters.when, today, day, tabs, order]);
  // Pick rows fill from the feed's first items when the editor's list runs short, so page 1 never repeats a pick. Only the
  // picks the page shows leave the feed: up to PICK_ROWS (a standard phone shows picks 1–2 as cards and the third as a row),
  // none in 简洁显示 (the pick rows step aside there, so they stay in the feed) — every event is on the page, counted once.
  const showRows = !simple;
  const pickEvents = showRows ? arranged.rows.slice(0, PICK_ROWS).map(item => item.event) : [];
  const fill = showRows ? Math.max(0, (arranged.lead ? PICK_ROWS : 0) - pickEvents.length) : 0;
  const excludedBase = new Set([...(listsCard ? cardIds : []), ...(arranged.lead ? [arranged.lead.event.id] : []), ...pickEvents.map(event => event.id)]);
  const fillers = fill ? ranked.filter(event => !excludedBase.has(event.id) && event.id !== homeLead).slice(0, fill) : [];
  const rows = [...pickEvents, ...fillers].slice(0, PICK_ROWS);
  const excluded = new Set([...excludedBase, ...fillers.map(event => event.id)]);
  const list = ranked.filter(event => !excluded.has(event.id));
  // What the picks above already show of the chosen list: the list end counts them ("已显示 16 / 53 场").
  const above = ranked.length - list.length;
  const visible = list.slice(0, pageSize * (1 + extra));
  const feedDays = weekend ? (day === 'sat' ? [days[0]] : day === 'sun' ? [days[1]] : days.filter(item => item >= today)) : [];
  const oneDay = weekend && (day === 'sat' || day === 'sun') ? feedDays[0] : undefined;

  // One page context in display order — share strip, lead, picks, feed — so an image appears once per page (VISUAL-10).
  const context = { ...coverContext(today), page: createCoverPage() };
  const covers = {
    strip: card && strip.status === 'ready' ? resolveCovers(stripEvents.map(eventItem), context) : [],
    // DECISIONS 15/26: a lead never shows a close-up face photo; it takes its next candidate (never an information card).
    lead: arranged.lead ? resolveCovers([coverItemFor('event', arranged.lead.event, { imageKey: leadImageKey(arranged.lead.event.imageKey), lead: true })], context) : [],
    rows: resolveCovers(rows.map(eventItem), context),
    feed: resolveCovers(visible.map(eventItem), context),
  };

  // The status line names the chosen list; while the dates load it says so, and a failed load says that (the retry sits below).
  const status = events ? t(`找到 ${ranked.length} 场活动`, `${ranked.length} ${ranked.length === 1 ? 'event' : 'events'}`)
    : failed ? t('这些日期的活动没能加载', 'Events for these dates did not load') : t('正在加载这些日期的活动…', 'Loading events for these dates…');
  const sheetCount = events ? t(`显示 ${ranked.length} 场`, `Show ${ranked.length}`) : failed ? t('关闭', 'Close') : t('正在加载…', 'Loading…');
  const sheetStatus = events || !failed ? sheetCount : t('这些日期的活动没能加载', 'Events for these dates did not load');
  const filterCount = sheetFilterCount(filters);
  // At 大 / 特大 and in 简洁显示 the day chips get short names (周六 · 周日 · 两天): the weekend's dates are in the range line.
  const dayLabel = (value: string) => {
    const name = value === today ? t('今天', 'Today') : pick(WEEKDAYS[weekdayIndex(value)].short);
    if (roomy) return name;
    const date = `${pick(WEEKDAYS[weekdayIndex(value)].short)}${english ? ',' : ''} ${monthDay(value, english)}`;
    return value === today ? `${name} · ${date}` : date;
  };
  const alerts = activeBulletins(today, filters.region);
  const more = Math.min(pageSize, list.length - visible.length);
  const whenOption = WHEN_OPTIONS.find(option => option.id === filters.when);
  // A choice made in the 筛选 sheet shows on rail 1 as a removable chip ("下雨也行 ✕"), not only as 筛选 (1).
  const sheetChips: { key: string; label: string; clear: Record<string, null> }[] = [
    ...(!SCOPES.includes(filters.when) && whenOption ? [{ key: 'when', label: pick(whenOption.label), clear: { when: null, day: null } }] : []),
    ...(filters.tag && !RAIL_TAGS.includes(filters.tag) ? [{ key: 'tag', label: pick(TAGS.find(tag => tag.id === filters.tag)!.label), clear: { tag: null } }] : []),
    ...(filters.q ? [{ key: 'q', label: `「${filters.q}」`, clear: { q: null } }] : []),
  ];

  // Loading another date range keeps the last list on screen, dimmed, and after 300 ms a skeleton in its place (P28).
  const [held, setHeld] = useState<{ events: IndexEvent[]; covers: ResolvedCover[] }>();
  const visibleKey = visible.map(event => event.id).join();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (events && visible.length) setHeld({ events: visible, covers: covers.feed }); }, [events, visibleKey]);
  const listRef = useRef<HTMLDivElement>(null);
  const hold = useViewHold(!events && !failed && !!held, listRef);

  // One radio group of dates: the scopes (本周末 is the whole weekend, checked on arrival, so the list matches the facts
  // line's count and home's 看本周末全部 N 场), then on the weekend its days (周六 / 周日 / 两天都开放; days already past are
  // dropped) in their own .ev-days wrapper. A date the sheet chose (今天, a month) checks none: its removable chip says it.
  // 简洁显示 keeps 本周末 (the whole weekend) and the checked scope only.
  const scopes = SCOPES.filter(id => !simple || id === 'weekend' || id === filters.when);
  const dateItems = [
    ...scopes.map(id => ({ id, label: pick(WHEN_OPTIONS.find(option => option.id === id)!.label) })),
    ...(weekend ? [
      ...(days[0] >= today ? [{ id: 'sat', label: dayLabel(days[0]) }] : []),
      { id: 'sun', label: dayLabel(days[1]) },
      { id: 'open', label: roomy ? t('两天', 'Both') : t('两天都开放', 'Both days') },
    ] : []),
  ];
  const dateValue = weekend ? day || 'weekend' : SCOPES.includes(filters.when) ? filters.when : '';
  const rail = <div className="ev-rail" role="group" aria-label={t('选择日期和筛选', 'Dates and filters')}>
    <DayChips className="ev-rail__group ev-rail__dates" label={t('选择日期', 'Choose dates')} items={dateItems} value={dateValue}
      part={weekend ? { from: scopes.length, className: 'ev-days-bar ev-days' } : undefined}
      onChange={id => (SCOPES as readonly string[]).includes(id) ? update({ when: id === defaultWhen ? null : id, day: null }) : update({ day: id })} />
    <div className="ev-rail__group">
      <FilterChip selected={filters.free} onClick={() => update({ cost: filters.free ? null : 'free' })}>{t('免费', 'Free')}</FilterChip>
      {/* 简洁显示 keeps 免费 only, and a tag that is on (home's 亲子 / 长辈友好 links), so it can be seen and cleared. */}
      {RAIL_TAGS.map(id => <FilterChip key={id} data-simple={filters.tag === id ? undefined : 'hide'} selected={filters.tag === id} onClick={() => update({ tag: filters.tag === id ? null : id, category: null })}>{pick(TAGS.find(tag => tag.id === id)!.label)}</FilterChip>)}
      {sheetChips.map(chip => <FilterChip key={chip.key} selected aria-label={t(`清除：${chip.label}`, `Clear ${chip.label}`)} onClick={() => update(chip.clear)}>{chip.label}<X aria-hidden="true" strokeWidth={1.75} /></FilterChip>)}
      <FilterChip className="ev-region-chip" selected={filters.region !== 'all'} aria-haspopup="dialog" onClick={() => setSheetOpen(true)}>{pick(regionLabel(filters.region))}<ChevronDown aria-hidden="true" strokeWidth={1.75} /></FilterChip>
      <FilterChip selected={filterCount > 0} aria-haspopup="dialog" onClick={() => setSheetOpen(true)} count={filterCount || undefined}
        icon={<SlidersHorizontal aria-hidden="true" strokeWidth={1.75} />}>{t('筛选', 'Filters')}</FilterChip>
    </div>
  </div>;

  // The day a row links to and prints: the day group's, the chosen day chip's, else the event's first weekend day.
  // The one-tap regions (rail 2 and the sheet).
  const regionChips = [{ id: 'all' as const, label: ALL_REGIONS }, ...REGIONS].map(region => <FilterChip key={region.id} selected={filters.region === region.id} onClick={() => setRegion(region.id)}>{pick(region.label)}</FilterChip>);
  const rowDay = (event: IndexEvent, onDay?: string) => onDay ?? oneDay ?? feedDays.find(item => nextOccurrence(event, item) === item) ?? nextOccurrence(event, today) ?? today;
  // The feed's first photo is the page's fetchpriority="high" image when no lead picture is (H60).
  const feedCard = (event: IndexEvent, cover: ResolvedCover, onDay?: string) => <EventFeedCard event={event} cover={cover} today={today}
    days={onDay ? [onDay] : feedDays} oneDay={onDay ?? oneDay} priority={event === visible[0] && (!arranged.lead || covers.lead[0]?.tier === 'type') && !listsCard} />;
  // At 大 / 特大 and in 简洁显示 the feed is a list of rows (a 112px 4:3 thumbnail); ♡ at its end, except in 简洁显示 and
  // 家人版, where saving happens on the detail page (DECISIONS 16, owner confirmed).
  const rowCard = (event: IndexEvent, cover: ResolvedCover, onDay?: string) => <EventRowCard key={event.id} event={event} cover={cover} today={today}
    day={rowDay(event, onDay)} oneDay={!!(onDay ?? oneDay)} save={!simple} />;
  const groups = weekend ? [] : groupByDay(visible, listDays.start);
  const groupCount = (groupDay: string) => list.filter(event => (nextOccurrence(event, listDays.start) ?? event.endDate) === groupDay).length;
  const dayHead = (groupDay: string) => {
    const weekdayName = pick(WEEKDAYS[weekdayIndex(groupDay)].short);
    const date = english ? `${weekdayName}, ${monthDay(groupDay, true)}` : `${weekdayName} ${monthDay(groupDay)}`;
    const count = groupCount(groupDay);
    return `${groupDay === today ? `${t('今天', 'Today')} · ` : ''}${date} · ${t(`${count} 场`, `${count} ${count === 1 ? 'event' : 'events'}`)}`;
  };
  const sort = weekend ? t('按推荐排列', 'in recommended order') : t('按日期排列', 'by date');
  const sundayParams = new URLSearchParams(params);
  sundayParams.set('day', 'sun');
  const sunday = english ? `${pick(WEEKDAYS[weekdayIndex(days[1])].short)}, ${monthDay(days[1], true)}` : `${pick(WEEKDAYS[weekdayIndex(days[1])].short)} ${monthDay(days[1])}`;
  const listEnd = list.length > 0 && <div className="ev-list-end">
    <p className="ev-list-end__count">{t(`已显示 ${above + visible.length} / ${ranked.length} 场 · ${sort}`, `Showing ${above + visible.length} of ${ranked.length} · ${sort}`)}</p>
    {more > 0 && <Button variant="secondary" className="ev-list-end__more" onClick={() => setExtra(count => count + 1)}>{t(`再看 ${more} 场`, `Show ${more} more`)}</Button>}
    {weekend ? day === 'sat' && days[1] >= today
      ? <MoreLink to={`/events?${sundayParams}`} onClick={event => { event.preventDefault(); update({ day: 'sun' }); }}>{t(`${sunday} 的活动`, `Events on ${sunday}`)}</MoreLink>
      : <MoreLink to={`/calendar?date=${addCalendarDays(days[1], 6)}`}>{t('下周末', 'Next weekend')}</MoreLink>
      : <MoreLink to="/calendar">{t('按日期找：日历', 'Find by date: calendar')}</MoreLink>}
  </div>;

  // The list as cards, or as rows at 大 / 特大 and in 简洁显示 (the live list and the one held while another range loads).
  const cards = (events: readonly IndexEvent[], label: string, onDay?: string, coverOf = (event: IndexEvent) => covers.feed[visible.indexOf(event)]) => roomy
    ? <div className="ev-rows" role="list" aria-label={label}>{events.map(event => <div key={event.id} role="listitem">{rowCard(event, coverOf(event), onDay)}</div>)}</div>
    : <FeedGrid label={label} layout={layout} className="ev-cards">
      {events.map(event => <FeedItem key={event.id}>{feedCard(event, coverOf(event), onDay)}</FeedItem>)}
    </FeedGrid>;
  const feed = !visible.length ? null : weekend ? cards(visible, t('本周末活动', 'Events this weekend'))
    : groups.map(group => <section key={group.day} className="ev-day" aria-labelledby={`ev-day-${group.day}`}>
      <h3 id={`ev-day-${group.day}`} className="ev-day__head">{dayHead(group.day)}</h3>
      {cards(group.events, dayHead(group.day), group.day)}
    </section>);
  const emptyTitle = filters.q ? t(`没有找到「${filters.q}」`, `Nothing found for “${filters.q}”`)
    : t('这组条件下暂时没有活动', 'Nothing matches these filters yet');

  return <>
    {card && <ChunkBoundary>{attempt => { const Strip = shareStrip(attempt); return <Suspense fallback={stripFallback}>
      <Strip region={card} state={strip} events={stripEvents} covers={covers.strip} today={today} />
    </Suspense>; }}</ChunkBoundary>}

    {/* H26 / HOMEIA13-03: 编辑精选 only when the lead is from the editor's list (src/data/weekend-picks.ts, with its reason);
        a lead from the ranking (DECISIONS 26: no pick has a ① or ② picture) heads the block as 本周末先看. */}
    {arranged.lead && <section className="ev-picks" aria-labelledby="ev-picks-heading">
      <h2 id="ev-picks-heading" className="ev-section-title ev-picks__title">{arranged.lead.reason ? t('编辑精选', 'Editor’s picks') : t('本周末先看', 'This weekend, start here')}</h2>
      <div className="ev-picks__grid">
        <EventLeadCard event={arranged.lead.event} cover={covers.lead[0]} today={today} days={[arranged.lead.date]}
          kicker={arranged.lead.reason ? t('编辑推荐', 'Editor’s pick') : t('本周末先看', 'This weekend, start here')} reason={arranged.lead.reason ? pick(arranged.lead.reason) : undefined} />
        {/* The other picks: on a standard phone picks 1–2 as one 2-up row of cards and the third as a row (events.css shows
            only that one of the rows there); rows in the span-4 column on desktop and at 大 / 特大. */}
        {rows.length > 0 && <div className="ev-picks__more" data-simple="hide">
          {!roomy && <ul className="ev-picks__cards" aria-label={t('另外几件', 'More picks')}>
            {rows.slice(0, 2).map((event, index) => <li key={event.id}><EventFeedCard event={event} cover={covers.rows[index]} today={today} days={feedDays} /></li>)}
          </ul>}
          <div className="ev-picks__rows" role="list" aria-label={t('另外几件', 'More picks')}>
            {rows.map((event, index) => <div key={event.id} role="listitem"><EventRowCard event={event} cover={covers.rows[index]} today={today} day={rowDay(event)} save={!simple} /></div>)}
          </div>
        </div>}
      </div>
    </section>}

    <section id="monthly-events" className="ev-feed" aria-labelledby="ev-feed-heading">
      <div className="ev-feed__head">
        <h2 id="ev-feed-heading" className={weekend ? 'ev-section-title' : 'ev-section-title ui-visually-hidden'}>{weekend ? t('本周末全部活动', 'All events this weekend') : t('活动', 'Events')}</h2>
        <p className="ev-count" role="status" aria-live="polite">{status}</p>
      </div>
      <div className="ev-toolbar">
        {rail}
        {/* H23 / HOMEIA13-02: 本周末旧金山免费亲子 in three taps from home — the region applies on one tap, no Sheet. */}
        <ChipRow className="ev-regions" label={t('地区', 'Region')}>
          {regionChips}
        </ChipRow>
      </div>

      <div ref={listRef} className="ev-list" data-hold={hold.phase === 'idle' ? undefined : hold.phase} style={hold.phase === 'idle' ? undefined : { minHeight: hold.height }} aria-busy={!events && !failed ? true : undefined}>
        {hold.phase === 'skeleton' ? <SkeletonFeed count={4} />
        : !events ? failed ? <ChunkError onRetry={retry} />
          : hold.phase === 'dim' && held ? cards(held.events, t('活动', 'Events'), undefined, event => held.covers[held.events.indexOf(event)])
          : <SkeletonFeed count={4} rows={roomy} />
        : visible.length ? [<Fragment key="feed">{feed}</Fragment>, <Fragment key="end">{listEnd}</Fragment>]
        : <EmptyState headingLevel="h3" title={emptyTitle}
          body={filters.q ? t('换个关键词，或把这句话交给 BayBay。', 'Try another word, or ask BayBay.') : t('换一天、换个地区，或清除筛选再看看。', 'Try another day or region, or clear the filters.')}
          actions={filters.tag === 'seniors' && !filters.q ? <>
            {/* H06: no 长辈友好 event in this range — the 长辈与家属 guides and BayBay instead of only "clear" (HOMEIA13-01). */}
            <Button variant="primary" to="/guides?topic=elders">{t('看长辈与家属指南', 'Guides for seniors and family')}</Button>
            <Button variant="text" to={`/plan?q=${encodeURIComponent(t('这周末带爸妈去哪？', 'Where can I take my parents this weekend?'))}`}>{t('问 BayBay：这周末带爸妈去哪', 'Ask BayBay where to take your parents')}</Button>
            <Button variant="text" onClick={clear}>{t('清除筛选', 'Clear filters')}</Button>
          </> : <>
            {filters.q ? <Button variant="primary" onClick={() => update({ q: null })}>{t('清除搜索', 'Clear the search')}</Button>
              : <Button variant="primary" onClick={clear}>{t('清除筛选', 'Clear filters')}</Button>}
            <MoreLink to={`/plan?q=${encodeURIComponent(filters.q || t('这周末去哪？', 'Where should we go this weekend?'))}`}>{t('问 BayBay', 'Ask BayBay')}</MoreLink>
          </>} />}
      </div>
    </section>

    {/* CW-02: the alerts and the share card are keyed to the day, inside a 本周末 list that keeps all week (date-guard.ts). */}
    {alerts.length > 0 && <div className="ev-alerts" {...dateScope('day')}>
      <Disclosure id="monthly-news" summary={t(`出行提醒 ${alerts.length} 条`, `Travel and local updates · ${alerts.length}`)}>
        <ul>{alerts.map(item => <li key={item.id}>
          <strong>{item.title}</strong>
          <span>{item.label} · {item.dateLabel}</span>
          <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">{t('官方', 'Official')} · {item.sourceLabel}</a>
        </li>)}</ul>
      </Disclosure>
    </div>}

    {(!events || visible.length > 0) && <EventsPageEnd region={filters.region} today={today} weekend={weekend} />}
    <ImageCredits covers={[...covers.strip, ...covers.lead, ...covers.rows, ...covers.feed]} />

    {/* The 筛选 sheet loads on its own (idle, or the first tap), then stays mounted for its exit animation. */}
    {sheetOpen !== undefined && FilterSheet && <FilterSheet open={sheetOpen} onClose={() => setSheetOpen(false)} count={sheetCount} status={sheetStatus}
      filters={filters} defaultWhen={defaultWhen} query={params.get('q') || ''} regions={regionChips} update={update} clear={clear} />}
  </>;
}

/**
 * The end of the list (VISUAL-18 → G10): one quiet list of links at 400 — save the weekend as an image (本周末 only),
 * subscribe, and one link each to the rest. In 简洁显示 only the first two stay.
 */
export function EventsPageEnd({ region, today, weekend = true }: { region: EventsFilters['region']; today: string; weekend?: boolean }) {
  const { t } = useUiCopy();
  return <nav className="ev-end" aria-label={t('更多活动入口', 'More from Events')}>
    <ul>
      {weekend && <li><a className="ev-end__item" href={weeklyCardHref(region, today)} target="_blank" rel="noopener" onClick={() => recordProductEvent('share_card_download')} {...dateScope('day')}>{t('存成一张图：本周末精选', 'Save this weekend’s picks as an image')}</a></li>}
      <li><a className="ev-end__item" href={`webcal://www.baylink.us/calendars/${region}.ics`} onClick={recordIcsDownload}>{t('订阅到手机日历（只含活动日期）', 'Subscribe in your phone calendar (dates only)')}</a></li>
      <li data-simple="hide"><Link className="ev-end__item" to="/events?view=perks">{t('免费与优惠', 'Free & deals')}</Link></li>
      <li data-simple="hide"><Link className="ev-end__item" to="/events?view=openings">{t('新店', 'New shops')}</Link></li>
      <li data-simple="hide"><Link className="ev-end__item" to="/explore">{t('半日慢游去处', 'Half-day outings')}</Link></li>
      <li data-simple="hide"><Link className="ev-end__item" to="/guides">{t('出门前读一篇指南', 'Read a guide before you go')}</Link></li>
    </ul>
  </nav>;
}

export type { ResolvedCover };
