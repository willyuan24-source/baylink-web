import { useMemo, useState } from 'react';
import { Search, ArrowRight, X, Bookmark } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { guides, GUIDE_CATEGORY_TABS, type Guide, type GuideCategory } from '../data/guides';
import { GuideCard } from './GuideCard';
import { searchGuides } from '../lib/guide-search';
import { ReadingShelf } from './ReaderLibrary';
import { ReaderPaths } from './ReaderPaths';
import { useLocale } from '../i18n/locale';

type GuidesHomeProps = { onOpenGuide: (slug: string) => void; onAsk?: (question: string) => void; onSearch?: (query: string) => void };
export const GuidesHome = ({ onOpenGuide, onAsk, onSearch }: GuidesHomeProps) => {
  const locale = useLocale();
  const english = locale === 'en';
  const [searchParams, setSearchParams] = useSearchParams();
  const category = searchParams.get('category');
  const tab = GUIDE_CATEGORY_TABS.some(({ id }) => id === category) ? category as 'all' | GuideCategory : 'all';
  const query = (searchParams.get('q') || '').slice(0, 200);
  const savedOnly = searchParams.get('view') === 'saved';
  const resultKey = `${tab}:${query}`;
  const [page, setPage] = useState({ key: '', count: 24 });
  const visibleCount = page.key === resultKey ? page.count : 24;
  const updateSearch = (values: { q?: string; category?: 'all' | GuideCategory }) => setSearchParams(previous => {
    const next = new URLSearchParams(previous);
    if (values.q !== undefined) { if (values.q) next.set('q', values.q); else next.delete('q'); next.delete('view'); }
    if (values.category !== undefined) { if (values.category === 'all') next.delete('category'); else next.set('category', values.category); }
    return next;
  }, { replace: true, preventScrollReset: true });
  const results = useMemo(() => searchGuides(guides, { query, category: tab, locale }), [tab, query, locale]);
  const grouped = useMemo(() => tab === 'all' && !query.trim() ? GUIDE_CATEGORY_TABS.filter(item => item.id !== 'all').map(item => ({ ...item, items: results.map(result => result.guide).filter(guide => guide.category === item.id) })).filter(item => item.items.length) : null, [tab, query, results]);
  return <div className="bl-guides-page bl-guides-page--compact">
    <header className="bl-guides-intro"><div className="bl-guides-intro-row"><div><h1>{savedOnly ? english ? 'Your saved guides' : '我的指南收藏' : english ? 'Guides for Bay Area life' : '湾区生活指南'}</h1><p>{english ? 'Practical steps, eligibility and official sources. Start with what you need today.' : '办事步骤、适用条件与官方入口，从今天需要的一件事开始。'}</p></div><span className="bl-guides-count">{guides.length} {english ? 'guides' : '篇指南'}</span></div></header>
    <div className="reader-library-find"><label><Search size={20} aria-hidden="true" /><input type="search" aria-label={english ? `Search ${guides.length} guides` : `在 ${guides.length} 篇指南中搜索`} placeholder={english ? 'Doctors, schools, driving, rental scams…' : '搜：看医生、学校、考驾照、租房防骗…'} value={query} maxLength={200} onChange={event => updateSearch({ q: event.target.value })} />{query && <button type="button" aria-label={english ? 'Clear search' : '清除指南搜索'} onClick={() => updateSearch({ q: '' })}><X size={20} /></button>}</label><Link to={savedOnly ? '/guides' : '/guides?view=saved'}><Bookmark size={18} />{savedOnly ? english ? 'Discover guides' : '继续发现' : english ? 'Saved' : '我的收藏'}</Link></div>
    {!savedOnly && <div className="bl-guides-controls bl-guides-controls--top"><div className="bl-guide-tabs" role="group" aria-label={english ? 'Guide topics' : '指南分类'}>{GUIDE_CATEGORY_TABS.map(item => <button type="button" key={item.id} aria-pressed={tab === item.id} className={tab === item.id ? 'is-active' : ''} onClick={() => updateSearch({ category: item.id })}>{item.label}</button>)}</div></div>}
    {savedOnly ? <ReadingShelf /> : <section className="bl-guides-library" aria-labelledby="guide-library-title"><div className="bl-guides-library-heading"><h2 id="guide-library-title">{tab === 'education' ? english ? 'Schools across the five Bay Area regions' : '五区学校与学区指南' : query.trim() ? english ? 'Search results' : '搜索结果' : tab === 'all' ? english ? 'Find your next step' : '按主题，找到下一步' : GUIDE_CATEGORY_TABS.find(item => item.id === tab)?.label}</h2><span role="status" aria-live="polite">{results.length} {english ? 'guides' : '篇指南'}</span></div>
      {results.length === 0 ? <div className="bl-guide-empty"><h3>{english ? 'No matching guides yet' : '还没有找到相关指南'}</h3><p>{english ? 'Try another keyword, search the whole site, or ask BayBay.' : '换个关键词，也可以搜全站或把问题交给 BayBay。'}</p><div className="guide-empty-actions"><button type="button" onClick={() => updateSearch({ q: '', category: 'all' })}>{english ? 'Browse all topics' : '查看全部主题'}</button>{onSearch ? <button type="button" onClick={() => onSearch(query)}>{english ? 'Search the whole site' : '搜全站'}</button> : <Link to={`/this-month?q=${encodeURIComponent(query)}`}>{english ? 'Search local events' : '查找本地活动'}</Link>}{onAsk ? <button type="button" onClick={() => onAsk(query)}>{english ? 'Ask BayBay' : '问 BayBay'}</button> : <Link to={`/plan?q=${encodeURIComponent(query)}`}>{english ? 'Ask BayBay' : '问 BayBay'}</Link>}</div></div>
        : grouped ? grouped.map(({ id, label, items }) => <section className="bl-guide-category-group" key={id} aria-label={label}><div className="bl-guide-group-title"><h3>{label}</h3><button type="button" onClick={() => updateSearch({ category: id as GuideCategory })}>{english ? `All ${items.length}` : `看全部 ${items.length} 篇`}<ArrowRight size={16} aria-hidden="true" /></button></div><div className="bl-guide-grid">{items.slice(0, 4).map((guide: Guide) => <GuideCard key={guide.slug} guide={guide} compact onClick={() => onOpenGuide(guide.slug)} />)}</div></section>)
          : <><div className="bl-guide-grid bl-guide-filter-results">{results.slice(0, visibleCount).map(({ guide, snippet, section }) => <GuideCard key={guide.slug} guide={guide} compact searchSnippet={snippet} searchSection={section} onClick={() => onOpenGuide(guide.slug)} />)}</div>{results.length > visibleCount && <button type="button" className="guide-load-more" onClick={() => setPage({ key: resultKey, count: visibleCount + 24 })}>{english ? `Show more (${visibleCount}/${results.length})` : `继续查看（${visibleCount}/${results.length}）`}</button>}</>}
    </section>}
    {!savedOnly && tab === 'all' && !query.trim() && <details className="guide-paths-details" open={!!searchParams.get('audience')}><summary>{english ? 'Choose a path for your life stage' : '按生活阶段找一条阅读路径'}</summary><ReaderPaths onOpenGuide={onOpenGuide} /></details>}
    {!savedOnly && <details className="guide-complete-index"><summary>{english ? `Browse all ${guides.length} guide titles` : `查看全部 ${guides.length} 篇指南目录`}</summary><nav aria-label={english ? 'Complete guide directory' : '完整指南目录'}><ul>{guides.map(guide => <li key={guide.slug}><Link to={`/guides/${guide.slug}`}>{guide.title}</Link></li>)}</ul></nav></details>}
    <footer className="bl-guides-bottom"><p>{english ? 'Each guide keeps its official references and image credits.' : '每篇指南保留官方来源、核对日期与图片授权。'}</p><Link to="/about">{english ? 'How we check sources' : '了解核验方法'}</Link></footer>
  </div>;
};
