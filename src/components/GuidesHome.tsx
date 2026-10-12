import { lazy, Suspense, useMemo, useState, type MouseEvent } from 'react';
import { Bookmark, Search, X } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { guides, GUIDE_CATEGORY_TABS, type Guide, type GuideCategory } from '../data/guides';
import { GUIDE_TOPICS, guideSlugsForTopic, guideTopicOf, type GuideTopicId } from '../data/guide-topics';
import { searchGuides } from '../lib/guide-search';
import { createCoverPage, distinctNeighbourTones, type ResolvedCover } from '../lib/cover';
import type { CoverTone } from '../lib/event-facts';
import { useBayAreaToday } from '../lib/useBayAreaToday';
import { translateText } from '../i18n/locale';
import { useUiCopy } from './ui/ui-copy';
import { PageHeader } from './ui/HeroCard';
import { FilterChip, ChipRow } from './ui/Chip';
import { FeedGrid, FeedItem } from './ui/FeedGrid';
import { FeedCard, RowCard } from './ui/Card';
import { Carousel } from './ui/Carousel';
import { Button } from './ui/Button';
import { EmptyState } from './ui/States';
import { SkeletonFeed } from './ui/SkeletonCard';
import { COVER_SIZES } from './ui/cover-sizes';
import { GuideCover } from '../features/guides/GuideCover';
import { handleGuideLinkClick } from './GuideCard';
import { GUIDE_REGIONS, guideCardMeta, guideCover, guideRegionsOf, isGuideRegion, isGuideTopic, TOPIC_COVER, type GuideRegionId } from '../features/guides/guide-facts';
import { guideEditorialAnswer } from '../data/guide-editorial/answers';
import '../features/guides/guide-library.css';

// The saved shelf reads the save store; it loads only for ?view=saved, outside the index's JS budget.
const ReadingShelf = lazy(() => import('./ReaderLibrary').then(module => ({ default: module.ReadingShelf })));

type GuidesHomeProps = { onOpenGuide: (slug: string) => void; onAsk?: (question: string) => void; onSearch?: (query: string) => void };
type Listed = { guide: Guide; snippet?: string; section?: string };
const PAGE_SIZE = 24;
const RAIL_SIZE = 6;
const PREVIEW_SIZE = 4;
const bySlug = (slug: string) => guides.find(guide => guide.slug === slug);

/**
 * 指南 (T2, design.md §4.7.4, 1007 §4.4): two-column 3:4 covers, the seven task topics with 长辈与家属 first (D22), a region
 * row, the "长辈与家属先看" rail and shareable topic URLs (/guides?topic=elders). Covers follow the honesty ladder: a photo
 * with its provenance badge, else a coded cover; never an AI illustration.
 */
export const GuidesHome = ({ onOpenGuide, onAsk, onSearch }: GuidesHomeProps) => {
  const { t, pick, english, locale } = useUiCopy();
  const today = useBayAreaToday();
  const [params, setParams] = useSearchParams();
  const topicParam = params.get('topic');
  const regionParam = params.get('region');
  const categoryParam = params.get('category');
  const topic: GuideTopicId | null = isGuideTopic(topicParam) ? topicParam : null;
  const region: GuideRegionId | null = isGuideRegion(regionParam) ? regionParam : null;
  const category = GUIDE_CATEGORY_TABS.some(item => item.id === categoryParam && item.id !== 'all') ? categoryParam as GuideCategory : null;
  const query = (params.get('q') || '').slice(0, 200);
  const searching = !!query.trim();
  const savedOnly = params.get('view') === 'saved';
  const browsing = !topic && !region && !category && !searching;
  const [page, setPage] = useState({ key: '', count: PAGE_SIZE });
  const resultKey = `${topic}:${region}:${category}:${query}`;
  const visibleCount = page.key === resultKey ? page.count : PAGE_SIZE;
  const [directoryOpen, setDirectoryOpen] = useState(false);

  const update = (values: { topic?: GuideTopicId | null; region?: GuideRegionId | null; q?: string; category?: null }) => setParams(previous => {
    const next = new URLSearchParams(previous);
    const set = (key: string, value: string | null | undefined) => { if (value === undefined) return; if (value) next.set(key, value); else next.delete(key); };
    set('topic', values.topic);
    set('region', values.region);
    set('q', values.q);
    if (values.category === null || values.topic !== undefined) next.delete('category');
    next.delete('view');
    next.delete('audience');
    return next;
  }, { replace: true, preventScrollReset: true });

  const listed = useMemo((): Listed[] => {
    const inRegion = (guide: Guide) => !region || guideRegionsOf(guide).includes(region);
    // Search inside a topic keeps that topic's list: the 长辈与家属 hub gathers guides whose primary topic is elsewhere.
    const inTopic = topic ? new Set(guideSlugsForTopic(topic, guides)) : null;
    if (searching) return searchGuides(guides, { query, category: category ?? 'all', locale }).filter(result => inRegion(result.guide) && (!inTopic || inTopic.has(result.guide.slug)));
    let list: Guide[] = topic ? guideSlugsForTopic(topic, guides).map(bySlug).filter((guide): guide is Guide => !!guide) : guides;
    if (category) list = list.filter(guide => guide.category === category);
    return list.filter(inRegion).map(guide => ({ guide }));
  }, [searching, query, topic, region, category, locale]);

  const topicCounts = useMemo(() => Object.fromEntries(GUIDE_TOPICS.map(item => [item.id, guideSlugsForTopic(item.id, guides).length])) as Record<GuideTopicId, number>, []);
  const elderRail = useMemo(() => guideSlugsForTopic('elders', guides).slice(0, RAIL_SIZE).map(bySlug).filter((guide): guide is Guide => !!guide), []);
  const sections = useMemo(() => {
    const shown = new Set(elderRail.map(guide => guide.slug));
    return GUIDE_TOPICS.filter(item => item.id !== 'elders').map(item => {
      const all = guides.filter(guide => guideTopicOf(guide) === item.id);
      // Skip guides the rail already shows, unless that would leave the topic with fewer than two covers (医疗保险 has three).
      const others = all.filter(guide => !shown.has(guide.slug));
      return { topic: item, total: all.length, preview: (others.length >= 2 ? others : all).slice(0, PREVIEW_SIZE) };
    });
  }, [elderRail]);

  // One cover page in reading order, so an image never appears twice and two coded covers side by side change colour.
  const covers = useMemo(() => {
    const coverPage = createCoverPage();
    const order: Guide[] = browsing ? [...elderRail, ...sections.flatMap(section => section.preview)] : listed.slice(0, visibleCount).map(result => result.guide);
    const resolved = new Map<string, { cover: ResolvedCover; tone?: CoverTone }>();
    const tones = distinctNeighbourTones(order.map(guide => {
      const cover = guideCover(guide, today, coverPage);
      resolved.set(guide.slug, { cover });
      return cover.tier === 'type' ? TOPIC_COVER[guideTopicOf(guide)].tone : null;
    }));
    order.forEach((guide, index) => { resolved.get(guide.slug)!.tone = tones[index] ?? undefined; });
    return resolved;
  }, [browsing, elderRail, sections, listed, visibleCount, today]);

  const guideTitle = (guide: Guide) => translateText(guide.title, locale);
  const meta = (guide: Guide) => pick(guideCardMeta(guide));
  const coverOf = (guide: Guide, options: { priority?: boolean; thumb?: boolean } = {}) => {
    const entry = covers.get(guide.slug);
    if (!entry) return null;
    return <GuideCover guide={guide} cover={entry.cover} tone={entry.tone} priority={options.priority} ratio={options.thumb ? '1:1' : undefined} mini={options.thumb}
      sizes={options.thumb ? COVER_SIZES.thumb : COVER_SIZES.feed} answer={options.thumb ? undefined : guideEditorialAnswer(guide.slug, locale)} />;
  };
  // A plain click opens through the app (keeping this list's URL for the way back); modified clicks stay native links.
  const open = (slug: string) => (event?: MouseEvent<HTMLAnchorElement>) => { if (event) handleGuideLinkClick(event, () => onOpenGuide(slug)); else onOpenGuide(slug); };
  const card = (guide: Guide, priority = false) => <FeedCard title={guideTitle(guide)} titleLang={english ? 'en' : undefined} to={`/guides/${guide.slug}`}
    onOpen={open(guide.slug)} cover={coverOf(guide, { priority })} meta={meta(guide)} />;
  const topicName = (id: GuideTopicId) => pick(GUIDE_TOPICS.find(item => item.id === id)!);
  const summaryOf = (id: GuideTopicId) => pick(GUIDE_TOPICS.find(item => item.id === id)!.summary);
  const categoryLabel = category ? translateText(GUIDE_CATEGORY_TABS.find(item => item.id === category)!.label, locale) : '';
  const regionLabel = region ? pick(GUIDE_REGIONS.find(item => item.id === region)!) : '';
  const heading = searching ? t('搜索结果', 'Search results') : topic ? topicName(topic) : category ? categoryLabel : regionLabel;

  return <div className="gl-page" data-testid="guides-home">
    <PageHeader className="gl-header" title={savedOnly ? t('我的指南收藏', 'Your saved guides') : t('湾区生活指南', 'Bay Area guides')}
      lede={t(`办事步骤、适用条件与官方入口。${guides.length} 篇指南，每篇附官方来源。`, `Steps, eligibility and the official way in. ${guides.length} guides, each with its official sources.`)} />
    <div className="gl-find">
      <label className="gl-search"><Search aria-hidden="true" strokeWidth={1.75} />
        <input type="search" aria-label={t(`在 ${guides.length} 篇指南中搜索`, `Search ${guides.length} guides`)} placeholder={t('搜：看医生、学校、考驾照、租房防骗…', 'Doctors, schools, driving, rental scams…')}
          value={query} maxLength={200} onChange={event => update({ q: event.target.value })} />
        {query && <button type="button" className="gl-search__clear" aria-label={t('清除指南搜索', 'Clear search')} onClick={() => update({ q: '' })}><X aria-hidden="true" strokeWidth={1.75} /></button>}
      </label>
      <Link className="gl-saved-link" to={savedOnly ? '/guides' : '/guides?view=saved'}><Bookmark aria-hidden="true" strokeWidth={1.75} />{savedOnly ? t('继续发现', 'Discover guides') : t('我的收藏', 'Saved')}</Link>
    </div>
    {!savedOnly && <nav className="gl-filters" aria-label={t('指南筛选', 'Guide filters')}>
      <ChipRow className="gl-topics" label={t('指南主题', 'Guide topics')}>
        <FilterChip selected={!topic && !category} onClick={() => update({ topic: null, category: null })}>{t('全部', 'All')}</FilterChip>
        {GUIDE_TOPICS.map(item => <FilterChip key={item.id} selected={topic === item.id} count={topicCounts[item.id]} onClick={() => update({ topic: topic === item.id ? null : item.id })}>{pick(item)}</FilterChip>)}
        {category && <FilterChip selected onClick={() => update({ category: null })} aria-label={t(`取消筛选：${categoryLabel}`, `Clear filter: ${categoryLabel}`)}>{categoryLabel}<X aria-hidden="true" strokeWidth={1.75} /></FilterChip>}
      </ChipRow>
      <ChipRow className="gl-regions" label={t('地区', 'Region')}>
        <FilterChip selected={!region} onClick={() => update({ region: null })}>{t('全湾区', 'All Bay Area')}</FilterChip>
        {GUIDE_REGIONS.map(item => <FilterChip key={item.id} selected={region === item.id} onClick={() => update({ region: region === item.id ? null : item.id })}>{pick(item)}</FilterChip>)}
      </ChipRow>
    </nav>}
    {savedOnly ? <Suspense fallback={<SkeletonFeed count={4} rows />}><ReadingShelf /></Suspense>
      : browsing ? <>
        <section className="gl-section gl-section--rail" aria-labelledby="gl-elders-title">
          <div className="gl-section__head">
            <div><h2 id="gl-elders-title">{t('长辈与家属先看', 'Start here for seniors and family')}</h2><p>{summaryOf('elders')}</p></div>
            <Button variant="text" onClick={() => update({ topic: 'elders' })}>{t(`看全部 ${topicCounts.elders} 篇`, `All ${topicCounts.elders}`)}</Button>
          </div>
          <Carousel className="gl-rail" variant="rail" label={t(`长辈与家属先看：${elderRail.length} 篇，左右滑动`, `Seniors and family: ${elderRail.length} guides, swipe for more`)}>
            {elderRail.map((guide, index) => <div key={guide.slug}>{card(guide, index === 0)}</div>)}
          </Carousel>
        </section>
        {sections.map(({ topic: item, total, preview }) => <section key={item.id} className="gl-section" aria-labelledby={`gl-topic-${item.id}`}>
          <div className="gl-section__head">
            <div><h2 id={`gl-topic-${item.id}`}>{pick(item)}</h2><p>{pick(item.summary)}</p></div>
            <Button variant="text" onClick={() => update({ topic: item.id })}>{t(`看全部 ${total} 篇`, `All ${total}`)}</Button>
          </div>
          <FeedGrid label={pick(item)}>{preview.map(guide => <FeedItem key={guide.slug}>{card(guide)}</FeedItem>)}</FeedGrid>
        </section>)}
      </> : <section className="gl-section" aria-labelledby="gl-results-title">
        <div className="gl-section__head">
          <div><h2 id="gl-results-title">{heading}</h2>{topic && !searching && <p>{summaryOf(topic)}</p>}</div>
          <span className="gl-count" role="status" aria-live="polite">{t(`${listed.length} 篇`, `${listed.length} guide${listed.length === 1 ? '' : 's'}`)}</span>
        </div>
        {listed.length === 0 ? <EmptyState icon={Search} title={t('还没有找到相关指南', 'No matching guides yet')} body={t('换个关键词或地区，也可以搜全站，或把问题交给 BayBay。', 'Try another word or region, search the whole site, or ask BayBay.')}
          actions={<>
            <Button variant="primary" onClick={() => update({ q: '', topic: null, region: null, category: null })}>{t('查看全部指南', 'Browse all guides')}</Button>
            {searching && onAsk ? <Button variant="text" onClick={() => onAsk(query)}>{t('问 BayBay', 'Ask BayBay')}</Button>
              : searching && onSearch ? <Button variant="text" onClick={() => onSearch(query)}>{t('搜全站', 'Search the whole site')}</Button> : null}
          </>} />
          : searching ? <ul className="gl-results" aria-label={heading}>{listed.slice(0, visibleCount).map(({ guide, snippet, section }) => <li key={guide.slug}>
            <RowCard title={guideTitle(guide)} titleLang={english ? 'en' : undefined} to={`/guides/${guide.slug}`} onOpen={open(guide.slug)}
              thumb={coverOf(guide, { thumb: true })} date={section ? t(`文内匹配 · ${section}`, `Match in · ${section}`) : topicName(guideTopicOf(guide))} meta={snippet || meta(guide)} />
          </li>)}</ul>
            : <FeedGrid label={heading}>{listed.slice(0, visibleCount).map(({ guide }, index) => <FeedItem key={guide.slug}>{card(guide, index === 0)}</FeedItem>)}</FeedGrid>}
        {listed.length > visibleCount && <div className="gl-more"><Button onClick={() => setPage({ key: resultKey, count: visibleCount + PAGE_SIZE })}>{t(`继续查看（${visibleCount}/${listed.length}）`, `Show more (${visibleCount}/${listed.length})`)}</Button></div>}
      </section>}
    {!savedOnly && <div className="gl-directory">
      <button type="button" aria-expanded={directoryOpen} aria-controls="guide-complete-directory" onClick={() => setDirectoryOpen(open => !open)}>{t(`查看全部 ${guides.length} 篇指南目录`, `Browse all ${guides.length} guide titles`)}</button>
      <nav id="guide-complete-directory" hidden={!directoryOpen} aria-label={t('完整指南目录', 'Complete guide directory')}><ul>{guides.map(guide => <li key={guide.slug}><Link to={`/guides/${guide.slug}`}>{guide.title}</Link></li>)}</ul></nav>
    </div>}
    <footer className="gl-footer"><p>{t('每篇指南保留官方来源、核对日期与图片授权。', 'Each guide keeps its official sources, check dates and image credits.')}</p><Link to="/about">{t('了解核验方法', 'How we check sources')}</Link></footer>
  </div>;
};
