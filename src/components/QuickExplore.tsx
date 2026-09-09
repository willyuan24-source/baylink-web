import { useMemo, useRef, useState } from 'react';
import { ArrowRight, BookOpen, Home, Search, Sparkles, Wrench, X } from 'lucide-react';
import { CATEGORIES } from '../lib/constants';
import { guides } from '../data/guides';
import { searchGuides } from '../lib/guide-search';
import { getSlugFromCategory } from '../routing';
import { ModalShell } from './ui/Modal';

export function QuickExplore({ onClose, onSearch, onNavigate, onAsk }: {
  onClose: () => void; onSearch: (value: string) => void;
  onNavigate: (path: string) => void; onAsk: (question?: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const composing = useRef(false);
  const term = query.trim();
  const matches = useMemo(() => term ? searchGuides(guides, { query: term }).slice(0, 5) : [], [term]);
  const run = (action: () => void) => { onClose(); action(); };
  const results = [
    ...matches.map(({ guide, snippet }) => ({
      id: guide.slug, title: guide.title, detail: snippet && snippet !== guide.title ? snippet : guide.summary, icon: BookOpen,
      group: '站内指南', run: () => onNavigate(`/guides/${guide.slug}`),
    })),
    ...(term ? [{ id: 'posts', title: `搜索邻里信息「${term}」`, detail: '继续查找房源、服务和邻里帖子', icon: Search, group: '继续探索', run: () => onSearch(term) }] : []),
    { id: 'baybay', title: term ? `问 BayBay「${term}」` : '问问 BayBay', detail: '一起安排周末、比较优惠、整理生活需求', icon: Sparkles, group: '继续探索', run: () => onAsk(term || undefined) },
    ...(!term ? [
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
          <input maxLength={80} aria-label="快速搜索" role="combobox" aria-expanded="true" aria-controls="quick-explore-results"
            aria-autocomplete="list" aria-activedescendant={`quick-result-${selected}`} autoFocus placeholder="搜索攻略、免费福利、房源或服务…"
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
          {term && matches.length === 0 && <p className="quick-empty">暂未找到匹配的指南，试试「免费」「亲子」或「租房」。也可以继续搜索帖子或问 BayBay。</p>}
          <div id="quick-explore-results" role="listbox" aria-label="搜索结果">
            {results.map((result, index) => <div key={result.id} role="presentation">
              {(index === 0 || results[index - 1].group !== result.group) && <p className="site-nav-label" role="presentation">{result.group}{result.group === '站内指南' ? ` · ${matches.length} 篇` : ''}</p>}
              <button id={`quick-result-${index}`} type="button" role="option" aria-selected={selected === index}
                onMouseMove={() => setActive(index)} onClick={() => run(result.run)}
                className={`quick-result ${selected === index ? 'is-highlighted' : ''}`}>
                <result.icon size={19} /><span>{result.title}<small className="quick-result-snippet">{result.detail}</small></span><ArrowRight size={17} />
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
