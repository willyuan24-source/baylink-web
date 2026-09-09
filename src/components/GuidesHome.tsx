import { useMemo } from "react";
import {
  Search,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Compass,
  X,
  Bookmark,
} from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import {
  guides,
  GUIDE_CATEGORY_TABS,
  getGuideBySlug,
  type Guide,
  type GuideCategory,
} from "../data/guides";
import { GuideCard, handleGuideLinkClick } from "./GuideCard";
import { EditorialCollections } from "./EditorialCollections";
import { searchGuides } from "../lib/guide-search";
import { getGuideMedia } from '../data/guide-media';
import { GuideExplorer, GuideImageCredits } from './GuideExplorer';
import { MonthlySpotlight } from './MonthlySpotlight';
import { MonthlyDealsSpotlight } from './MonthlyDealsSpotlight';
import { ReadingShelf } from './ReaderLibrary';

type GuidesHomeProps = { onOpenGuide: (slug: string) => void };
const NEWCOMER_SPOTLIGHT_SLUGS = [
  "bay-area-newcomer-first-month-checklist",
  "bay-area-rental-scam-guide",
  "bay-area-commute-guide",
];

export const GuidesHome = ({ onOpenGuide }: GuidesHomeProps) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryParam = searchParams.get('category');
  const tab = GUIDE_CATEGORY_TABS.some(({ id }) => id === categoryParam) ? categoryParam as 'all' | GuideCategory : 'all';
  const query = (searchParams.get('q') || '').slice(0, 200);
  const savedOnly = searchParams.get('view') === 'saved';
  const updateSearch = (values: { q?: string; category?: 'all' | GuideCategory }, replace = false) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (values.q !== undefined) {
        if (values.q) { next.set('q', values.q); next.delete('view'); } else next.delete('q');
      }
      if (values.category !== undefined) {
        if (values.category !== 'all') next.set('category', values.category); else next.delete('category');
      }
      return next;
    }, { replace, preventScrollReset: true });
  };
  const spotlightGuides = NEWCOMER_SPOTLIGHT_SLUGS.map(getGuideBySlug).filter(
    Boolean,
  ) as Guide[];
  const results = useMemo(() => searchGuides(guides, { query, category: tab }), [tab, query]);
  const filtered = useMemo(() => results.map(({ guide }) => guide), [results]);
  const grouped = useMemo(() => {
    if (tab !== "all" || query.trim()) return null;
    const byCat = new Map<string, Guide[]>();
    for (const { id } of GUIDE_CATEGORY_TABS) {
      if (id === 'all') continue;
      const categoryGuides = filtered.filter((g) => g.category === id);
      if (categoryGuides.length) byCat.set(categoryGuides[0].categoryLabel, categoryGuides);
    }
    return byCat;
  }, [tab, query, filtered]);
  const hero = spotlightGuides[0];

  return (
    <div className="bl-guides-page">
      <header className="bl-guides-intro">
        <span className="bl-guide-eyebrow">
          <span /> THE BAYLINK JOURNAL
        </span>
        <div className="bl-guides-intro-row">
          <div>
            <h1>
              {savedOnly ? '留住喜欢的，' : '把湾区，'}
              <br />
              <em>{savedOnly ? '下次接着看。' : '过成你的生活。'}</em>
            </h1>
            <p>
              {savedOnly ? '想去的地方、实用的攻略，先为自己留一份。' : '从第一份租约，到周末的新去处。'}
              <br className="bl-guides-mobile-break" />{" "}
              {savedOnly ? '无需登录，也能慢慢收集生活灵感。' : '给每一步，一个更清晰的开始。'}
            </p>
          </div>
          <div className="bl-guides-edition">
            <BookOpen size={22} strokeWidth={1.3} aria-hidden="true" />
            <strong>{guides.length} 篇</strong>
            <span>湾区生活指南</span>
            {savedOnly ? <Link to="/guides" className="bl-guide-library-jump">发现更多 <ArrowRight size={14} aria-hidden="true" /></Link> : <a href="#guide-library-title" className="bl-guide-library-jump">查找指南 <ArrowRight size={14} aria-hidden="true" /></a>}
          </div>
        </div>
      </header>
      <div className="reader-library-find">
        <label><Search size={19} aria-hidden="true" /><input type="search" aria-label="搜索生活指南" placeholder="想去哪、想省什么？试试 Target、亲子、海边…" value={query} maxLength={200} onChange={event => updateSearch({ q: event.target.value }, true)} />{query && <button type="button" aria-label="清除指南搜索" onClick={() => updateSearch({ q: '' }, true)}><X size={17} /></button>}</label>
        <Link to={savedOnly ? '/guides' : '/guides?view=saved'}><Bookmark size={16} />{savedOnly ? '继续发现攻略' : '我的收藏'}</Link>
      </div>
      {!query.trim() && (savedOnly || tab === 'all') && <ReadingShelf />}
      {!savedOnly && !query.trim() && tab === 'all' && <><MonthlySpotlight /><MonthlyDealsSpotlight onOpenGuide={onOpenGuide} /></>}
      {!savedOnly && !query.trim() && tab === "all" && hero && (
        <section className="bl-guides-spotlights" aria-label="新来湾区先看">
          <Link
            to={`/guides/${hero.slug}`}
            onClick={(event) =>
              handleGuideLinkClick(event, () => onOpenGuide(hero.slug))
            }
            className="bl-guides-feature"
          >
            <img className="bl-guides-feature-photo" src={getGuideMedia(hero).cover.src} srcSet={getGuideMedia(hero).cover.srcSet} sizes="(max-width:639px) 100vw, 720px" width={1536} height={1024} alt="" />
            <div className="bl-guides-feature-top">
              <span>
                <Compass size={15} aria-hidden="true" /> 新来湾区先看
              </span>
              <span>START HERE</span>
            </div>
            <div className="bl-guides-feature-content">
              <h2>
                新的城市，
                <br />
                从容开始。
              </h2>
              <p>{hero.title}</p>
              <span className="bl-guides-feature-link">
                打开第一份生活清单 <ArrowRight size={17} aria-hidden="true" />
              </span>
            </div>
            <span className="bl-guides-feature-photo-note">BAYLINK 原创 · AI 情境插图</span>
          </Link>
          <div className="bl-guides-starter-list">
            {spotlightGuides.slice(1).map((g, index) => (
              <Link
                key={g.slug}
                to={`/guides/${g.slug}`}
                onClick={(event) =>
                  handleGuideLinkClick(event, () => onOpenGuide(g.slug))
                }
                className="bl-guides-starter"
              >
                <img className="bl-guides-starter-photo" src={getGuideMedia(g).cover.src} srcSet={getGuideMedia(g).cover.srcSet} sizes="240px" width={480} height={320} alt="" loading="lazy" />
                <div className="bl-guides-starter-top">
                  <span>0{index + 2} / 必读指南</span>
                  <ArrowUpRight size={19} aria-hidden="true" />
                </div>
                <h3>{g.title}</h3>
                <p>
                  {g.categoryLabel} <span>·</span> {g.readMinutes} 分钟阅读
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}
      {!savedOnly && !query.trim() && tab === 'all' && <GuideExplorer onOpenGuide={onOpenGuide} />}
      {!savedOnly && !query.trim() && tab === "all" && <EditorialCollections />}
      {!savedOnly && <section
        className="bl-guides-library"
        aria-labelledby="guide-library-title"
      >
        <div className="bl-guides-library-heading">
          <div>
            <span className="bl-guide-eyebrow">YOUR LOCAL HANDBOOK</span>
            <h2 id="guide-library-title">生活的答案，在这里。</h2>
          </div>
          <span className="bl-guides-count" aria-live="polite">
            {filtered.length} 篇指南
          </span>
        </div>
        <div className="bl-guides-controls">
          <div className="bl-guide-tabs" role="group" aria-label="指南分类">
            {GUIDE_CATEGORY_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => updateSearch({ category: t.id })}
                aria-pressed={tab === t.id}
                className={tab === t.id ? "is-active" : ""}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        {filtered.length === 0 ? (
          <div className="bl-guide-empty">
            <Search size={28} strokeWidth={1.3} aria-hidden="true" />
            <h3>还没有找到相关指南</h3>
            <p>试试更简短的关键词，或看看其他分类。</p>
            <button
              type="button"
              onClick={() => {
                updateSearch({ q: '', category: 'all' });
              }}
            >
              查看全部指南 <ArrowRight size={15} aria-hidden="true" />
            </button>
          </div>
        ) : grouped ? (
          Array.from(grouped.entries()).map(([label, items]) => (
            <section
              className="bl-guide-category-group"
              key={label}
              aria-label={label}
            >
              <div className="bl-guide-group-title">
                <h3>{label}</h3>
                <span>{String(items.length).padStart(2, "0")}</span>
              </div>
              <div className="bl-guide-grid">
                {items.map((g) => (
                  <GuideCard
                    key={g.slug}
                    guide={g}
                    onClick={() => onOpenGuide(g.slug)}
                  />
                ))}
              </div>
            </section>
          ))
        ) : (
          <div className="bl-guide-grid bl-guide-filter-results">
            {results.map(({ guide: g, snippet, section }) => (
              <GuideCard
                key={g.slug}
                guide={g}
                searchSnippet={snippet}
                searchSection={section}
                onClick={() => onOpenGuide(g.slug)}
              />
            ))}
          </div>
        )}
      </section>}
      <footer className="bl-guides-bottom">
        <Compass size={20} strokeWidth={1.4} aria-hidden="true" />
        <p>慢慢熟悉，也慢慢喜欢上这里。</p>
        <span>BAYLINK · CONNECTED BY THE BAY</span>
      </footer>
      <GuideImageCredits />
    </div>
  );
};
