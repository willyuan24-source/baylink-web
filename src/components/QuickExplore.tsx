import { useMemo, useRef, useState } from 'react';
import { ArrowRight, BookOpen, CalendarDays, Home, MapPin, Search, Sparkles, Wrench, X, type LucideIcon } from 'lucide-react';
import { CATEGORIES } from '../lib/constants';
import { guides } from '../data/guides';
import { searchGuides } from '../lib/guide-search';
import { getSlugFromCategory } from '../routing';
import { ModalShell } from './ui/Modal';
import { translateText, useLocale } from '../i18n/locale';
import { searchQuickDestinations } from '../lib/quick-search';
import { getGuideMedia, GUIDE_IMAGES } from '../data/guide-media';

type QuickResult = { id: string; title: string; detail: string; icon: LucideIcon; group: string; run: () => void; image?: string };

export function QuickExplore({ onClose, onSearch, onNavigate, onAsk }: {
  onClose: () => void; onSearch: (value: string) => void;
  onNavigate: (path: string) => void; onAsk: (question?: string) => void;
}) {
  const [query, setQuery] = useState('');
  const locale = useLocale();
  const [active, setActive] = useState(0);
  const composing = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const term = query.trim();
  const destinations = useMemo(() => searchQuickDestinations(term, locale), [term, locale]);
  const matches = useMemo(() => term ? searchGuides(guides, { query: term, locale })
    .filter(({ guide }) => !destinations.attractions.some(place => place.slug === guide.slug)).slice(0, 4) : [], [term, locale, destinations]);
  const found = matches.length + destinations.tools.length + destinations.events.length + destinations.attractions.length;
  const run = (action: () => void) => { onClose(); action(); };
  const results: QuickResult[] = [
    ...destinations.tools.map(tool => ({
      id: `tool-${tool.id}`, title: tool.title, detail: tool.short, icon: Wrench, group: '即用工具',
      run: () => onNavigate(`/tools?tool=${tool.id}#tool-workspace`),
    })),
    ...destinations.events.map(event => ({
      id: `event-${event.id}`, title: event.title, detail: `${event.dateLabel} · ${event.city}`, icon: CalendarDays,
      group: '近期活动', image: GUIDE_IMAGES[event.imageKey]?.src,
      run: () => onNavigate(`/this-month?q=${encodeURIComponent(event.title)}#monthly-events`),
    })),
    ...destinations.attractions.map(place => {
      const guide = guides.find(item => item.slug === place.slug);
      return { id: `place-${place.id}`, title: place.title, detail: `${place.city} · ${place.duration}`, icon: MapPin,
        group: '景点与出游', image: guide ? getGuideMedia(guide).cover.src : undefined,
        run: () => onNavigate(`/guides/${place.slug}`) };
    }),
    ...matches.map(({ guide, snippet }) => ({
      id: guide.slug, title: guide.title, detail: snippet && snippet !== guide.title ? snippet : guide.summary, icon: BookOpen,
      group: '站内指南', image: getGuideMedia(guide).cover.src, run: () => onNavigate(`/guides/${guide.slug}`),
    })),
    ...(term ? [{ id: 'posts', title: `搜索邻里信息「${term}」`, detail: '继续查找房源、服务和邻里帖子', icon: Search, group: '继续探索', run: () => onSearch(term) }] : []),
    { id: 'baybay', title: term ? `问 BayBay「${term}」` : '问问 BayBay', detail: '一起安排周末、比较优惠、整理生活需求', icon: Sparkles, group: '继续探索', run: () => onAsk(term || undefined) },
    ...(!term ? [
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
          <input ref={inputRef} maxLength={80} aria-label="快速搜索" role="combobox" aria-expanded="true" aria-controls="quick-explore-results"
            aria-autocomplete="list" aria-activedescendant={`quick-result-${selected}`} autoFocus placeholder="搜索景点、活动、工具或生活问题…"
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
          {!term && <div className="quick-suggestions" aria-label="试试这些搜索"><span>试试搜索</span>{['小费', '免费', '钢琴', '金门大桥'].map(value => <button type="button" key={value} onClick={() => { setQuery(translateText(value, locale)); setActive(0); inputRef.current?.focus(); }}>{value}</button>)}</div>}
          {term && <p className="quick-empty" role="status">{found ? '已找到相关内容，可直接打开；也可以继续搜索邻里信息。' : '暂未找到匹配内容，试试「免费」「亲子」「小费」或「租房」。'}</p>}
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
