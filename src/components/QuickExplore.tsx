import { recordProductEvent } from '../lib/product-events';
import { getListingImage } from '../lib/offer-media';
import { useMemo, useRef, useState } from 'react';
import { BookOpen, CalendarDays, ChevronRight, Heart, MapPin, Search, Store, Ticket, Wrench, type LucideIcon } from 'lucide-react';
import { guides } from '../data/guides';
import { searchGuides } from '../lib/guide-search';
import { Sheet } from './ui/Sheet';
import { Button } from './ui/Button';
import { EmptyState } from './ui/States';
import { StatusChip } from './ui/Status';
import { OtterIcon } from './SiteNavigation';
import { preloadBayBay } from '../app/baybay-preload';
import { eventWhenLine } from '../lib/event-facts';
import { getBayAreaToday } from '../lib/monthly';
import { useSimpleDisplay } from '../lib/reading-preferences';
import { LocaleFeatureGate } from './LocaleContentGate';
import './site-dialogs.css';
import { translateText, useLocale } from '../i18n/locale';
import { searchQuickDestinations } from '../lib/quick-search';
import { getGuideMedia } from '../data/guide-media';
import { openingStatusLabel } from '../lib/opening-status';
import { COMMUNITY_VISIBLE } from '../data/site-flags';

/** One row: a title and one detail line; an event adds its date line and a status · venue line (C's card meta). */
type QuickResult = { id: string; title: string; detail: string; icon?: LucideIcon; group: string; run: () => void; image?: string; when?: string; status?: string; ask?: boolean };

type QuickExploreProps = {
  /** false plays the sheet's exit (OverlayHost keeps the search mounted for it). */
  open?: boolean;
  initialQuery?: string;
  onClose: () => void; onSearch: (value: string) => void;
  onNavigate: (path: string) => void; onAsk: (question?: string) => void;
  restoreFocusRef?: React.RefObject<HTMLElement>;
};

/** The search dialog searches guides' full text, events and places in the reader's language: it waits for the search
 * feature's dictionaries (WEB-DATA-SPLIT; the page under it may have loaded only its own). */
export function QuickExplore(props: QuickExploreProps) {
  return <LocaleFeatureGate feature="search"><QuickExploreDialog {...props} /></LocaleFeatureGate>;
}

function QuickExploreDialog({ open = true, onClose, onSearch, onNavigate, onAsk, initialQuery = '', restoreFocusRef }: QuickExploreProps) {
  const [query, setQuery] = useState(initialQuery);
  const locale = useLocale();
  const english = locale === 'en';
  const copy = (zh: string, en: string) => english ? en : translateText(zh, locale);
  // 简洁显示 subtracts: 3 suggestions, two rows before typing, at most 3 rows per group and no reference group.
  const simple = useSimpleDisplay();
  const today = getBayAreaToday();
  const [active, setActive] = useState(0);
  const composing = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const term = query.trim();
  const destinations = useMemo(() => searchQuickDestinations(term, locale), [term, locale]);
  const info = destinations.queryInfo;
  const guideQuery = info.structured ? [...info.cities, ...info.tokens].join(' ') || term : term;
  const matches = useMemo(() => {
    if (!term || destinations.queryInfo.invalidDate) return [];
    const originalMatches = searchGuides(guides, { query: term, locale });
    const related = originalMatches.length ? originalMatches : searchGuides(guides, { query: guideQuery, locale });
    return related.filter(({ guide }) => ![...destinations.attractions, ...destinations.unverified.attractions].some(place => place.slug === guide.slug)).slice(0, 4);
  }, [term, locale, destinations, guideQuery]);
  const found = (info.structured ? 0 : matches.length) + destinations.tools.length + destinations.events.length + destinations.attractions.length + destinations.offers.length + destinations.openings.length;
  const run = (action: () => void) => { if (term) { recordProductEvent('search_submitted'); if (!found) recordProductEvent('search_zero_result'); } onClose(); action(); };
  const referenceLabel = copy('适用日期 / 营业时间待核实', 'Date / opening hours unconfirmed');
  const regionNames = { 'sf': '旧金山', 'east-bay': '东湾', 'south-bay': '南湾', 'north-bay': '北湾', 'peninsula': '半岛' };
  const conditions = [
    ...(info.intent !== 'mixed' ? [copy({ events: '活动', offers: '优惠', openings: '新店', attractions: '景点', places: '店铺与去处', guides: '攻略' }[info.intent], { events: 'Events', offers: 'Offers', openings: 'Openings', attractions: 'Attractions', places: 'Shops and places', guides: 'Guides' }[info.intent])] : []),
    ...info.cities, ...info.regions.map(region => translateText(regionNames[region], locale)),
    ...(info.dateRange ? [info.dateRange.start === info.dateRange.end ? info.dateRange.start : `${info.dateRange.start} – ${info.dateRange.end}`] : []),
    ...(info.freeOnly ? [copy('免费入场 / 免费福利', 'Free admission / free benefits')] : []),
    ...(info.maxAdmissionUsd !== undefined ? [`$${info.maxAdmissionUsd} ${copy(info.admissionBudget ? '入场费上限' : '预算', info.admissionBudget ? 'admission cap' : 'budget')}`] : []),
    ...(info.totalBudgetUsd !== undefined ? [`$${info.totalBudgetUsd} ${copy('总预算 · 待确认人数与范围', 'total budget · group size and scope unconfirmed')}`] : []),
    ...(info.family ? [copy('亲子', 'Family')] : []),
    ...info.childAges.map(age => copy(`${age} 岁`, `Age ${age}`)),
    ...(info.setting ? [copy(info.setting === 'indoor' ? '室内' : '户外', info.setting === 'indoor' ? 'Indoors' : 'Outdoors')] : []),
    ...(info.evening ? [copy('晚间', 'Evening')] : []),
  ];
  const notices = [
    ...(info.invalidDate ? [copy('日期无效或范围倒置，请检查日期。', 'Check the date: it is invalid or the range is reversed.')] : []),
    ...(info.unsupported.includes('negative-preference') ? [copy('检测到排除偏好，目前不能可靠执行这类否定筛选。请改写成想要的条件，或交给 BayBay；不会反向当成正向推荐。', 'An exclusion was detected, but this search cannot reliably apply it. State what you want or ask BayBay; excluded preferences are not treated as positive filters.')] : []),
    ...(info.unsupported.includes('multiple-dates') ? [copy('检测到多个不同日期，尚未选择其中一天。请写一个日期或明确连续范围（如 10/3–10/5），或交给 BayBay。', 'Several different dates were detected; none has been silently selected. Enter one date or an explicit continuous range, such as 10/3–10/5, or ask BayBay.')] : []),
    ...(info.unsupported.includes('total-budget') ? [copy('总预算尚未用于金额筛选，也没有换算成每人票价。请交给 BayBay 确认人数，以及是否包含餐饮和交通。', 'The total budget is not applied as a price filter or converted to a per-person ticket price. Ask BayBay to confirm group size and whether food and transport are included.')] : []),
    ...(info.unsupported.includes('free-extras') ? [copy('免费停车或餐饮不等于免费入场；这些附加条件目前尚未核实。', 'Free parking or food does not mean free admission; these extra conditions have not been verified.')] : []),
    ...(info.freeOnly || info.maxAdmissionUsd !== undefined ? [copy('只筛已知入场费或免费福利；餐饮、交通、附加项目与资格限制另看详情。未知价格不按免费处理。', 'Checks known admission prices or free benefits only. Food, transport, extras and eligibility are separate. Unknown prices are not treated as free.')] : []),
    ...(info.setting ? [copy('只列已有明确场地信息的活动；资料尚不完整，雨天偏好不代表天气预报。', 'Only events with a confirmed indoor/outdoor setting are listed. Coverage is incomplete; this is not a weather forecast.')] : []),
    ...(info.family ? [copy('按亲子标签及已知年龄限制筛选；具体年龄、陪同与预约要求请看详情。', 'Uses family labels and known age restrictions. Check details for ages, adult supervision and reservations.')] : []),
    ...(info.evening ? [copy('晚间按已刊时段筛选；完整营业与结束时间仍需确认。', 'Evening matches use published times; full hours and end times still need checking.')] : []),
    ...(info.distanceRequested ? [copy('尚未计算距离或通行时间；“附近”不能保证在指定路程内。', 'Distances and travel times have not been calculated; nearby results are not a verified travel radius.')] : []),
  ];
  const references: QuickResult[] = [
    ...destinations.unverified.offers.map(offer => ({
      id: `reference-offer-${offer.id}`, title: `${offer.brand} · ${offer.title}`, detail: `${offer.verificationStatus === 'needs-confirmation' ? copy('当前优惠待确认', 'Current offer unconfirmed') : referenceLabel} · ${offer.dateLabel} · ${offer.requirement}`, icon: Ticket,
      group: 'references', run: () => onNavigate(`/offers/${offer.id}`),
    })),
    ...destinations.unverified.openings.map(shop => ({
      id: `reference-opening-${shop.id}`, title: shop.name, detail: `${referenceLabel} · ${openingStatusLabel(shop.status)} · ${shop.city} · ${shop.dateLabel}`, icon: Store,
      group: 'references', run: () => onNavigate(`/openings/${shop.id}`),
    })),
    ...destinations.unverified.attractions.map(place => ({
      id: `reference-place-${place.id}`, title: place.title, detail: `${referenceLabel} · ${place.city}`, icon: MapPin,
      group: 'references', run: () => onNavigate(`/guides/${place.slug}`),
    })),
  ];
  const when = (line: { zh: string; en: string }) => english ? line.en : translateText(line.zh, locale);
  // Typed results in reading order (content arrangement §6): 近期活动 → 优惠与福利 → 新店 → 站内指南 → 景点 → 工具 →
  // 参考 · 待确认, then 继续探索.
  const typed: QuickResult[] = [
    // Events (C's card meta): the date line, then status · venue; never cut (site-dialogs.css).
    ...destinations.events.map(event => ({
      id: `event-${event.id}`, title: event.title, detail: [event.venue, event.city].filter(Boolean).join(' · '), icon: CalendarDays,
      group: 'events', image: getListingImage(event.imageKey)?.src, when: when(eventWhenLine(event, today)),
      status: event.cost === 'free' ? copy('免费', 'Free') : event.cost === 'mixed' ? copy('部分免费', 'Partly free') : undefined,
      run: () => onNavigate(`/events/${event.id}`),
    })),
    ...destinations.offers.map(offer => ({
      id: `offer-${offer.id}`, title: `${offer.brand} · ${offer.title}`, detail: `${offer.dateLabel} · ${offer.requirement}`, icon: Ticket,
      group: 'offers', image: getListingImage(offer.imageKey)?.src,
      run: () => onNavigate(`/offers/${offer.id}`),
    })),
    ...destinations.openings.map(shop => ({
      id: `opening-${shop.id}`, title: shop.name, detail: `${openingStatusLabel(shop.status)} · ${shop.city} · ${shop.dateLabel}`, icon: Store,
      group: 'openings', image: getListingImage(shop.imageKey)?.src,
      run: () => onNavigate(`/openings/${shop.id}`),
    })),
    ...matches.map(({ guide, snippet }) => ({
      id: guide.slug, title: guide.title, detail: `${info.structured ? copy('攻略参考，不代表符合全部条件。', 'Guide reference; not confirmation of every condition. ') : ''}${snippet && snippet !== guide.title ? snippet : guide.summary}`, icon: BookOpen,
      group: 'guides', image: getGuideMedia(guide).cover.src, run: () => onNavigate(`/guides/${guide.slug}`),
    })),
    ...destinations.attractions.map(place => {
      const guide = guides.find(item => item.slug === place.slug);
      return { id: `place-${place.id}`, title: place.title, detail: `${place.city} · ${place.duration}`, icon: MapPin,
        group: 'places', image: guide ? getGuideMedia(guide).cover.src : undefined,
        run: () => onNavigate(`/guides/${place.slug}`) };
    }),
    ...destinations.tools.map(tool => ({
      id: `tool-${tool.id}`, title: tool.title, detail: tool.short, icon: Wrench, group: 'tools',
      run: () => onNavigate(`/tools?tool=${tool.id}#tool-workspace`),
    })),
    ...(simple ? [] : references),
  ].filter((row, index, rows) => !simple || rows.slice(0, index).filter(other => other.group === row.group).length < 3);
  const askRow: QuickResult = { id: 'baybay', title: term ? copy('交给 BayBay 继续安排', 'Continue planning with BayBay') : copy('问 BayBay（AI 助手）', 'Ask BayBay (AI helper)'), detail: term || copy('一起安排周末、比较优惠、整理生活需求', 'Plan a weekend, compare offers, sort out everyday questions'), group: term ? 'more' : '', ask: true, run: () => onAsk(term || undefined) };
  const results: QuickResult[] = term ? [
    ...typed,
    ...(COMMUNITY_VISIBLE ? [{ id: 'posts', title: `搜索邻里信息「${term}」`, detail: '继续查找房源、服务和邻里帖子', icon: Search, group: 'more', run: () => onSearch(term) }] : []),
    askRow,
  ] : [
    askRow,
    // Content arrangement §6: four shortcuts (简洁显示: 长辈与家属 only). 这个周末 and 发现湾区 repeated the 活动 and 首页 tabs.
    ...(simple ? [] : [{ id: 'calendar', title: copy('活动日历', 'Event calendar'), detail: copy('按月、按周查看活动与当天地图。', 'Events by month or week, with the day’s map.'), icon: CalendarDays, group: 'go', run: () => onNavigate('/calendar') }]),
    { id: 'elders', title: copy('长辈与家属', 'Seniors and families'), detail: copy('长者服务、Medicare、免费交通', 'Senior services, Medicare, free rides'), icon: Heart, group: 'go', run: () => onNavigate('/guides?topic=elders') },
    ...(simple ? [] : [
      { id: 'explore', title: copy('按地区找景点', 'Places by area'), detail: copy('找到想去的地方，存进出游清单', 'Find places to go and save them for an outing'), icon: MapPin, group: 'go', run: () => onNavigate('/explore') },
      { id: 'tools', title: copy('生活工具箱', 'Everyday tools'), detail: copy('贷款计算、分账、换算与生活清单', 'Loans, bill splitting, conversions and checklists'), icon: Wrench, group: 'go', run: () => onNavigate('/tools') },
    ]),
  ];
  // Nothing at all to show (not even a guide reference): F's EmptyState instead of the list.
  const noMatch = !!term && typed.length === 0;
  const selected = Math.min(active, results.length - 1);
  const groupLabel = (group: string) => ({
    events: copy('近期活动', 'Upcoming events'), offers: copy('优惠与福利', 'Offers and benefits'), openings: copy('新店', 'New shops'),
    guides: `${copy('站内指南', 'Guides')} · ${english ? matches.length : `${matches.length} 篇`}`, places: copy('景点', 'Places'), tools: copy('工具', 'Tools'),
    references: copy('参考 · 待确认', 'For reference · unconfirmed'), more: copy('继续探索', 'Keep exploring'), go: copy('快速前往', 'Go to'),
  } as Record<string, string>)[group] ?? group;
  return (
    // RC-24: search on the WEB-UI Sheet (bottom sheet on phones, drawer on desktop), its ✕ and Esc close it; `open` false
    // plays its exit.
    <Sheet open={open} onClose={onClose} title={copy('搜索', 'Search')} className="quick-sheet" initialFocusRef={inputRef} restoreFocusRef={restoreFocusRef}>
      <div className="quick-explore quick-explore--sheet">
        <form role="search" onSubmit={(event) => { event.preventDefault(); if (!composing.current) run(results[selected].run); }} className="quick-search-form">
          <Search size={20} aria-hidden="true" strokeWidth={1.75} />
          <input ref={inputRef} maxLength={200} aria-label={copy('快速搜索', 'Quick search')} role="combobox" aria-expanded="true" aria-controls="quick-explore-results"
            aria-autocomplete="list" aria-activedescendant={`quick-result-${selected}`} placeholder={copy('搜活动、优惠、新店或生活问题', 'Events, offers, new shops or a question')}
            value={query} onChange={(event) => { setQuery(event.target.value); setActive(0); }}
            onCompositionStart={() => { composing.current = true; }} onCompositionEnd={() => { composing.current = false; }}
            onKeyDown={(event) => {
              if (composing.current || event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) {
                if (event.key === 'Enter') event.preventDefault();
                return;
              }
              if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault();
                const next = (selected + (event.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length;
                setActive(next);
                document.getElementById(`quick-result-${next}`)?.scrollIntoView?.({ block: 'nearest' });
              }
            }} />
        </form>
        <div className="quick-explore-body">
          {!term && <div className="quick-suggestions" aria-label={copy('试试这些搜索', 'Try these searches')}><span className="quick-group">{copy('试试搜索', 'Try')}</span>{[
            ['小费', 'Tips'], ['这个周末旧金山免费活动', 'Free events in San Francisco this weekend'], ['南湾新店', 'New shops in the South Bay'], ['雨天室内亲子活动', 'Indoor family events for a rainy day'],
          ].slice(0, simple ? 3 : 4).map(([zh, en]) => <button type="button" className="ui-chip" key={zh} onClick={() => { setQuery(copy(zh, en)); setActive(0); inputRef.current?.focus(); }}>{copy(zh, en)}</button>)}</div>}
          {term && <div aria-live="polite">
            {!!conditions.length && <p className="quick-empty"><strong>{copy('已识别：', 'Understood: ')}</strong>{conditions.join(' · ')}</p>}
            {notices.map(notice => <p className="quick-empty" key={notice}>{notice}</p>)}
            {!noMatch ? <p className="quick-empty" role="status">{found ? copy('以下是站内匹配与相关攻略；参考条目的条件仍需核实。', 'Local matches and related guides follow. Conditions on reference items still need checking.') : copy('没有已核实的匹配结果。可调整条件，或让 BayBay 继续安排；不相关活动不会补入结果。', 'No verified matches. Adjust the conditions or continue with BayBay; unrelated events are not used as substitutes.')}</p>
              : <div className="quick-no-match"><EmptyState headingLevel="h3" icon={Search} title={copy(`没找到「${term}」`, `Nothing found for “${term}”`)} body={copy('没有已核实的匹配结果。可调整条件，或让 BayBay 继续安排；不相关活动不会补入结果。', 'No verified matches. Adjust the conditions or continue with BayBay; unrelated events are not used as substitutes.')}
                actions={<Button variant="primary" onClick={() => run(() => onNavigate('/events'))}>{copy('看本周末全部活动', 'See all events this weekend')}</Button>} /></div>}
          </div>}
          {/* No match keeps the list: under the EmptyState's recovery, 继续探索 offers the 邻里 search and BayBay (second). */}
          <div id="quick-explore-results" role="listbox" aria-label={copy('搜索结果', 'Search results')}>
            {results.map((result, index) => <div key={result.id} role="presentation">
              {result.group && (index === 0 || results[index - 1].group !== result.group) && <p className="quick-group" role="presentation">{groupLabel(result.group)}</p>}
              <button id={`quick-result-${index}`} type="button" role="option" aria-selected={selected === index}
                onMouseMove={() => setActive(index)} onClick={() => run(result.run)} {...(result.ask ? { onPointerEnter: preloadBayBay, onFocus: preloadBayBay } : {})}
                className={`quick-result${result.ask ? ' quick-result--ask' : ''}${selected === index ? ' is-highlighted' : ''}`}>
                {result.ask ? <span className="quick-result-otter"><OtterIcon size={28} /><span className="site-ai-tag" aria-hidden="true" translate="no">AI</span></span>
                  : result.image ? <img className="quick-result-image" src={result.image.replace('.webp', '-small.webp')} alt="" width={48} height={48} loading="lazy" />
                  : result.icon ? <span className="quick-result-icon" aria-hidden="true"><result.icon size={20} strokeWidth={1.75} /></span> : null}
                <span className="quick-result-text"><span className="quick-result-title">{result.title}</span>
                  {result.when && <span className="quick-result-when">{result.when}</span>}
                  <span className="quick-result-snippet">{result.status && <StatusChip>{result.status}</StatusChip>}{result.status && result.detail && ' · '}{result.detail}</span>
                </span>
                <ChevronRight className="quick-result-arrow" size={18} aria-hidden="true" strokeWidth={1.75} />
              </button>
            </div>)}
          </div>
        </div>
        <footer><span><kbd>↑ ↓</kbd> {copy('选择', 'Select')} · <kbd>Enter</kbd> {copy('打开', 'Open')}</span><span><kbd>Esc</kbd> {copy('关闭', 'Close')}</span></footer>
      </div>
    </Sheet>
  );
}
