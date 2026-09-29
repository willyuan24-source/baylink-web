import { useMemo, useRef, useState } from 'react';
import { ArrowRight, BookOpen, CalendarDays, Home, MapPin, Search, Sparkles, Store, Ticket, Wrench, X, type LucideIcon } from 'lucide-react';
import { CATEGORIES } from '../lib/constants';
import { guides } from '../data/guides';
import { searchGuides } from '../lib/guide-search';
import { getSlugFromCategory } from '../routing';
import { ModalShell } from './ui/Modal';
import { translateText, useLocale } from '../i18n/locale';
import { searchQuickDestinations } from '../lib/quick-search';
import { getGuideMedia, GUIDE_IMAGES } from '../data/guide-media';
import { openingStatusLabel } from '../lib/opening-status';

type QuickResult = { id: string; title: string; detail: string; icon: LucideIcon; group: string; run: () => void; image?: string };

export function QuickExplore({ onClose, onSearch, onNavigate, onAsk }: {
  onClose: () => void; onSearch: (value: string) => void;
  onNavigate: (path: string) => void; onAsk: (question?: string) => void;
}) {
  const [query, setQuery] = useState('');
  const locale = useLocale();
  const copy = (zh: string, en: string) => locale === 'en' ? en : translateText(zh, locale);
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
  const run = (action: () => void) => { onClose(); action(); };
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
  const results: QuickResult[] = [
    ...destinations.tools.map(tool => ({
      id: `tool-${tool.id}`, title: tool.title, detail: tool.short, icon: Wrench, group: '即用工具',
      run: () => onNavigate(`/tools?tool=${tool.id}#tool-workspace`),
    })),
    ...destinations.events.map(event => ({
      id: `event-${event.id}`, title: event.title, detail: `${event.dateLabel} · ${event.city}`, icon: CalendarDays,
      group: '近期活动', image: GUIDE_IMAGES[event.imageKey]?.src,
      run: () => onNavigate(`/events/${event.id}`),
    })),
    ...destinations.offers.map(offer => ({
      id: `offer-${offer.id}`, title: `${offer.brand} · ${offer.title}`, detail: `${offer.dateLabel} · ${offer.requirement}`, icon: Ticket,
      group: '优惠与福利', image: GUIDE_IMAGES[offer.imageKey]?.src,
      run: () => onNavigate(`/offers/${offer.id}`),
    })),
    ...destinations.openings.map(shop => ({
      id: `opening-${shop.id}`, title: shop.name, detail: `${openingStatusLabel(shop.status)} · ${shop.city} · ${shop.dateLabel}`, icon: Store,
      group: '新店与预告', image: GUIDE_IMAGES[shop.imageKey]?.src,
      run: () => onNavigate(`/openings/${shop.id}`),
    })),
    ...destinations.attractions.map(place => {
      const guide = guides.find(item => item.slug === place.slug);
      return { id: `place-${place.id}`, title: place.title, detail: `${place.city} · ${place.duration}`, icon: MapPin,
        group: '景点与出游', image: guide ? getGuideMedia(guide).cover.src : undefined,
        run: () => onNavigate(`/guides/${place.slug}`) };
    }),
    ...destinations.unverified.offers.map(offer => ({
      id: `reference-offer-${offer.id}`, title: `${offer.brand} · ${offer.title}`, detail: `${referenceLabel} · ${offer.dateLabel} · ${offer.requirement}`, icon: Ticket,
      group: copy('参考福利 · 适用日期待确认', 'Reference benefits · dates unconfirmed'), run: () => onNavigate(`/offers/${offer.id}`),
    })),
    ...destinations.unverified.openings.map(shop => ({
      id: `reference-opening-${shop.id}`, title: shop.name, detail: `${referenceLabel} · ${openingStatusLabel(shop.status)} · ${shop.city} · ${shop.dateLabel}`, icon: Store,
      group: copy('参考新店 · 营业时间待确认', 'Reference openings · hours unconfirmed'), run: () => onNavigate(`/openings/${shop.id}`),
    })),
    ...destinations.unverified.attractions.map(place => ({
      id: `reference-place-${place.id}`, title: place.title, detail: `${referenceLabel} · ${place.city}`, icon: MapPin,
      group: copy('参考去处 · 开放时间待确认', 'Reference places · hours unconfirmed'), run: () => onNavigate(`/guides/${place.slug}`),
    })),
    ...matches.map(({ guide, snippet }) => ({
      id: guide.slug, title: guide.title, detail: `${info.structured ? copy('攻略参考，不代表符合全部条件。', 'Guide reference; not confirmation of every condition. ') : ''}${snippet && snippet !== guide.title ? snippet : guide.summary}`, icon: BookOpen,
      group: '站内指南', image: getGuideMedia(guide).cover.src, run: () => onNavigate(`/guides/${guide.slug}`),
    })),
    ...(term ? [{ id: 'posts', title: `搜索邻里信息「${term}」`, detail: '继续查找房源、服务和邻里帖子', icon: Search, group: '继续探索', run: () => onSearch(term) }] : []),
    { id: 'baybay', title: term ? copy('交给 BayBay 继续安排', 'Continue planning with BayBay') : '问问 BayBay', detail: term || '一起安排周末、比较优惠、整理生活需求', icon: Sparkles, group: '继续探索', run: () => onAsk(term || undefined) },
    ...(!term ? [
      { id: 'calendar', title: '活动日历', detail: '按月、按周查看活动与当天地图。', icon: CalendarDays, group: '快速前往', run: () => onNavigate('/calendar') },
      { id: 'month', title: '这个周末有什么？', detail: '按日期、地区与费用挑选湾区活动', icon: CalendarDays, group: '快速前往', run: () => onNavigate('/this-month?when=weekend#monthly-events') },
      { id: 'explore', title: '按地区找景点', detail: '找到想去的地方，存进出游清单', icon: MapPin, group: '快速前往', run: () => onNavigate('/explore') },
      { id: 'tools', title: '生活工具箱', detail: '贷款计算、分账、换算与生活清单', icon: Wrench, group: '快速前往', run: () => onNavigate('/tools') },
      { id: 'guides', title: '湾区生活指南', detail: '当月活动、免费福利和本地攻略', icon: BookOpen, group: '快速前往', run: () => onNavigate('/guides') },
      { id: 'home', title: '发现湾区', detail: '浏览本地资源与需求', icon: Home, group: '快速前往', run: () => onNavigate('/') },
    ] : []),
  ];
  const selected = Math.min(active, results.length - 1);
  return (
    <ModalShell onClose={onClose} label="快速搜索与导航" className="quick-explore-overlay">
      <div className="quick-explore" onClick={(event) => event.stopPropagation()}>
        <form onSubmit={(event) => { event.preventDefault(); if (!composing.current) run(results[selected].run); }} className="quick-search-form">
          <Search size={22} />
          <input ref={inputRef} maxLength={200} aria-label="快速搜索" role="combobox" aria-expanded="true" aria-controls="quick-explore-results"
            aria-autocomplete="list" aria-activedescendant={`quick-result-${selected}`} autoFocus placeholder="搜索活动、优惠、新店或生活问题…"
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
          <button type="button" aria-label="关闭搜索" onClick={onClose}><X size={20} /></button>
        </form>
        <div className="quick-explore-body">
          {!term && <div className="quick-suggestions" aria-label="试试这些搜索"><span>试试搜索</span>{[
            ['小费', 'Tips'], ['这个周末旧金山免费活动', 'Free events in San Francisco this weekend'], ['南湾新店', 'New shops in the South Bay'], ['雨天室内亲子活动', 'Indoor family events for a rainy day'],
          ].map(([zh, en]) => <button type="button" key={zh} onClick={() => { setQuery(copy(zh, en)); setActive(0); inputRef.current?.focus(); }}>{copy(zh, en)}</button>)}</div>}
          {term && <div aria-live="polite">
            {!!conditions.length && <p className="quick-empty"><strong>{copy('已识别：', 'Understood: ')}</strong>{conditions.join(' · ')}</p>}
            {notices.map(notice => <p className="quick-empty" key={notice}>{notice}</p>)}
            <p className="quick-empty" role="status">{found ? copy('以下是站内匹配与相关攻略；参考条目的条件仍需核实。', 'Local matches and related guides follow. Conditions on reference items still need checking.') : copy('没有已核实的匹配结果。可调整条件，或让 BayBay 继续安排；不相关活动不会补入结果。', 'No verified matches. Adjust the conditions or continue with BayBay; unrelated events are not used as substitutes.')}</p>
          </div>}
          <div id="quick-explore-results" role="listbox" aria-label="搜索结果">
            {results.map((result, index) => <div key={result.id} role="presentation">
              {(index === 0 || results[index - 1].group !== result.group) && <p className="site-nav-label" role="presentation">{result.group}{result.group === '站内指南' ? ` · ${matches.length} 篇` : ''}</p>}
              <button id={`quick-result-${index}`} type="button" role="option" aria-selected={selected === index}
                onMouseMove={() => setActive(index)} onClick={() => run(result.run)}
                className={`quick-result ${selected === index ? 'is-highlighted' : ''}`}>
                {result.image ? <img className="quick-result-image" src={result.image.replace('.webp', '-small.webp')} alt="" width={52} height={48} loading="lazy" /> : <result.icon size={19} />}<span>{result.title}<small className="quick-result-snippet">{result.detail}</small></span><ArrowRight size={17} />
              </button>
            </div>)}
          </div>
          {!term && <><p className="site-nav-label">按分类探索</p><div className="quick-categories">{CATEGORIES.map((item) => <button type="button" key={item} onClick={() => run(() => onNavigate(`/category/${getSlugFromCategory(item)}`))}>{item}</button>)}</div></>}
        </div>
        <footer><span><kbd>↑ ↓</kbd> 选择 · <kbd>Enter</kbd> 打开</span><span><kbd>Esc</kbd> 关闭</span></footer>
      </div>
    </ModalShell>
  );
}
