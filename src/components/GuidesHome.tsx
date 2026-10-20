import { lazy, Suspense, useEffect, useMemo, useState, type MouseEvent } from 'react';
import { ChevronDown, ChevronRight, Heart, Phone, Search, X } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import type { Guide, GuideCategory } from '../data/guides';
import { GUIDE_TOPICS, guideSlugsForTopic, guideTopicOf, type GuideTopicId } from '../data/guide-topics';
import { searchGuides } from '../lib/guide-search';
import guidesIndex from '../data/generated/guides-index.json';
import type { GuideIndexCard, GuidesIndex } from '../features/guides/guide-records';
import { createCoverPage, type ResolvedCover } from '../lib/cover';
import { useBayAreaToday } from '../lib/useBayAreaToday';
import { loadLocaleForFeature, translateText } from '../i18n/locale';
import { useUiCopy } from './ui/ui-copy';
import { PageHeader } from './ui/PageHeader';
import { FilterChip, ChipRow } from './ui/Chip';
import { FeedGrid, FeedItem } from './ui/FeedGrid';
import { FeedCard, RowCard } from './ui/Card';
import { Button } from './ui/Button';
import { Disclosure } from './ui/Disclosure';
import { Sheet } from './ui/Sheet';
import { EmptyState, ErrorState } from './ui/States';
import { SkeletonFeed } from './ui/SkeletonCard';
import { COVER_SIZES } from './ui/cover-sizes';
import { GuideCover, guideCaption } from '../features/guides/GuideCover';
import { GuideTypeCover } from './ui/cover-guide';
import type { GuideAsk } from '../features/guides/GuideActions';
import { handleGuideLinkClick } from '../features/guides/guide-link';
import { GUIDE_REGIONS, guideCardLines, guideCover, inSeason, isGuideRegion, isGuideTopic, type GuideRegionId } from '../features/guides/guide-facts';
import '../features/guides/guide-library.css';

// The saved shelf reads the save store; it loads only for ?view=saved, outside the index's JS budget.
const ReadingShelf = lazy(() => import('./ReaderLibrary').then(module => ({ default: module.ReadingShelf })));

type GuidesHomeProps = { onOpenGuide: (slug: string) => void; onAsk?: GuideAsk; onSearch?: (query: string) => void };
type Listed = { guide: GuideIndexCard; snippet?: string; section?: string };
const PAGE_SIZE = 24;
/** The 长辈与家属先看 band: three rows on every screen (a D2 .band, three across on a desktop). */
const BAND_SIZE = 3;
const PREVIEW_SIZE = 4;
// The generated slim index (WEB-DATA-SPLIT, ENGSEC-01): cards only, no article bodies. Full-text search loads the corpus.
const INDEX = guidesIndex as GuidesIndex;
const guides = INDEX.guides;
const GUIDE_CATEGORY_TABS = INDEX.categoryTabs;
const cardsBySlug = new Map(guides.map(guide => [guide.slug, guide]));
const bySlug = (slug: string) => cardsBySlug.get(slug);
const isCard = (guide: GuideIndexCard | undefined): guide is GuideIndexCard => !!guide;

/**
 * The full guide corpus for full-text search: a chunk of its own, loaded on the first search. English also needs the guides'
 * full-text pack ('guide-search') before it matches, in whichever language the reader searches first.
 */
let corpus: Guide[] | undefined;
let corpusLoad: Promise<Guide[]> | undefined;
const searchReady = new Set<string>();
const loadCorpus = () => corpusLoad ||= import('../features/guides/guide-search-corpus').then(module => (corpus = module.guides))
  .catch((error: unknown) => { corpusLoad = undefined; throw error; });
const loadSearch = (locale: string) => Promise.all([loadCorpus(), locale === 'en' ? loadLocaleForFeature('en', 'guide-search').catch(() => undefined) : undefined])
  .then(() => { searchReady.add(locale); });
function useSearchCorpus(active: boolean, locale: string): { guides?: Guide[]; failed: boolean; retry: () => void } {
  const [, setLoaded] = useState(0);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!active || searchReady.has(locale)) return;
    let live = true;
    loadSearch(locale).then(() => { if (live) setLoaded(count => count + 1); }, () => { if (live) setFailed(true); });
    return () => { live = false; };
  }, [active, locale, attempt]);
  const ready = searchReady.has(locale);
  return { guides: ready ? corpus : undefined, failed: failed && !ready, retry: () => { setFailed(false); setAttempt(count => count + 1); } };
}

/**
 * 指南 (T2, design.md §4.7.4; UI9-GUIDES content arrangement): H1 with ♡ 我的指南收藏 → search → one chip row (全部, the seven
 * topics, 地区 ▾ in a sheet) → the 长辈与家属先看 band (three rows, D22) → six topic sections of at most four guides each, current
 * monthly editions first and past ones left out of the previews → the complete directory → how we check. Row cards on a phone
 * (C's mini cover, the full title, two meta lines); 3:2 covers four across on a desktop; 2-up photo cards when a section's
 * preview is mostly photos. 简洁显示 keeps the H1, the search, the band (its rows print a 48 px 拨打 <number> when the guide has
 * one) and one row per topic. Covers follow the honesty ladder: a photo with its provenance badge, else a coded cover.
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
  const [regionsOpen, setRegionsOpen] = useState(false);
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

  const search = useSearchCorpus(searching, locale);
  const searchLoading = searching && !search.guides;
  const listed = useMemo((): Listed[] => {
    const inRegion = (guide: GuideIndexCard) => !region || (guide.regions ?? []).includes(region);
    // Search inside a topic keeps that topic's list: the 长辈与家属 hub gathers guides whose primary topic is elsewhere.
    const inTopic = topic ? new Set(guideSlugsForTopic(topic, guides)) : null;
    if (searching) return (search.guides ? searchGuides(search.guides, { query, category: category ?? 'all', locale }) : []).flatMap(result => {
      const card = bySlug(result.guide.slug);
      return card && inRegion(card) && (!inTopic || inTopic.has(card.slug)) ? [{ guide: card, snippet: result.snippet, section: result.section }] : [];
    });
    let list: GuideIndexCard[] = topic ? guideSlugsForTopic(topic, guides).map(bySlug).filter(isCard) : guides;
    if (category) list = list.filter(guide => guide.category === category);
    return list.filter(inRegion).map(guide => ({ guide }));
  }, [searching, query, topic, region, category, locale, search.guides]);

  const topicCounts = useMemo(() => Object.fromEntries(GUIDE_TOPICS.map(item => [item.id, guideSlugsForTopic(item.id, guides).length])) as Record<GuideTopicId, number>, []);
  // Season (UI9-GUIDES): this month's editions first, past editions out of every preview (they stay in their topic's list).
  const elderBand = useMemo(() => inSeason(guideSlugsForTopic('elders', guides).map(bySlug).filter(isCard), today).slice(0, BAND_SIZE), [today]);
  const sections = useMemo(() => {
    const shown = new Set(elderBand.map(guide => guide.slug));
    return GUIDE_TOPICS.filter(item => item.id !== 'elders').map(item => {
      const all = guides.filter(guide => guideTopicOf(guide) === item.id);
      // Skip guides the band already shows, unless that would leave the topic with fewer than two (医疗保险 has three).
      const others = all.filter(guide => !shown.has(guide.slug));
      return { topic: item, total: all.length, preview: inSeason(others.length >= 2 ? others : all, today).slice(0, PREVIEW_SIZE) };
    });
  }, [elderBand, today]);

  // One cover page in reading order, so an image never appears twice; each coded cover keeps its own family (cover-family.ts).
  const covers = useMemo(() => {
    const coverPage = createCoverPage();
    const order: GuideIndexCard[] = browsing ? [...elderBand, ...sections.flatMap(section => section.preview)] : listed.slice(0, visibleCount).map(result => result.guide);
    return new Map<string, ResolvedCover>(order.map(guide => [guide.slug, guideCover(guide, today, coverPage)]));
  }, [browsing, elderBand, sections, listed, visibleCount, today]);
  const photo = (guide: GuideIndexCard) => { const cover = covers.get(guide.slug); return !!cover && cover.tier !== 'type'; };

  const guideTitle = (guide: GuideIndexCard) => translateText(guide.title, locale);
  // A plain click opens through the app (keeping this list's URL for the way back); modified clicks stay native links.
  const open = (slug: string) => (event?: MouseEvent<HTMLAnchorElement>) => { if (event) handleGuideLinkClick(event, () => onOpenGuide(slug)); else onOpenGuide(slug); };
  const lines = (guide: GuideIndexCard) => { const { when, meta } = guideCardLines(guide, today); return { when: pick(when), meta: meta && pick(meta) }; };
  /** A row: C's mini cover (its key fact only), the full title (never clamped), the time line and the sources line. */
  const row = (guide: GuideIndexCard, options: { snippet?: string; section?: string; call?: boolean } = {}) => {
    const cover = covers.get(guide.slug);
    const { when, meta } = lines(guide);
    return <>
      <RowCard title={guideTitle(guide)} titleLang={english ? 'en' : undefined} to={`/guides/${guide.slug}`} onOpen={open(guide.slug)}
        thumb={cover ? <GuideCover guide={guide} cover={cover} ratio="1:1" mini sizes={COVER_SIZES.thumb} /> : null}
        when={options.section ? t(`文内匹配 · ${options.section}`, `Match in · ${options.section}`) : when} meta={options.snippet || meta} />
      {/* G16: in 简洁显示 a guide with a number prints it as a 48 px 拨打 under its row (the reader's bar calls the same number). */}
      {options.call && guide.call && <Button variant="secondary" className="gl-call" href={`tel:${guide.call.tel}`} data-simple="show"
        aria-label={t(`拨打 ${guide.call.label.zh} ${guide.call.number}`, `Call ${guide.call.label.en} ${guide.call.number}`)} icon={<Phone aria-hidden="true" strokeWidth={1.75} />}>
        {t('拨打', 'Call')} <span className="gl-call__number">{guide.call.number}</span></Button>}
    </>;
  };
  /** A cover card (desktop, and 2-up photo cards on a phone): 3:2, C's hook sentence on a coded cover. */
  const feed = (guide: GuideIndexCard, priority = false) => {
    const cover = covers.get(guide.slug);
    const { when, meta } = lines(guide);
    return <FeedCard title={guideTitle(guide)} titleShown={cover ? guideCaption(guide, locale, cover) : undefined} titleLang={english ? 'en' : undefined} to={`/guides/${guide.slug}`}
      onOpen={open(guide.slug)} cover={cover ? <GuideCover guide={guide} cover={cover} priority={priority} sizes={COVER_SIZES.feed} /> : null} when={when} meta={meta} />;
  };
  const rows = (list: readonly GuideIndexCard[], label: string, options: { call?: boolean; className?: string } = {}) =>
    <ul className={`gl-rows${options.className ? ` ${options.className}` : ''}`} aria-label={label}>{list.map(guide => <li key={guide.slug}>{row(guide, { call: options.call })}</li>)}</ul>;
  /** A list: rows on a phone and 3:2 covers on a desktop, or 2-up photo cards everywhere when most of it is photos (3 of a
   *  4-guide preview; three quarters of a longer list). */
  const list = (items: readonly GuideIndexCard[], label: string, firstPriority = false) => items.filter(photo).length >= Math.max(3, Math.ceil(items.length * 0.75))
    ? <FeedGrid label={label}>{items.map((guide, index) => <FeedItem key={guide.slug}>{feed(guide, firstPriority && index === 0)}</FeedItem>)}</FeedGrid>
    : <>
      <div className="gl-view" data-view="phone">{rows(items, label, { call: topic === 'elders' })}</div>
      <div className="gl-view" data-view="desk"><FeedGrid label={label}>{items.map(guide => <FeedItem key={guide.slug}>{feed(guide)}</FeedItem>)}</FeedGrid></div>
    </>;
  const topicName = (id: GuideTopicId) => pick(GUIDE_TOPICS.find(item => item.id === id)!);
  const summaryOf = (id: GuideTopicId) => pick(GUIDE_TOPICS.find(item => item.id === id)!.summary);
  const categoryLabel = category ? translateText(GUIDE_CATEGORY_TABS.find(item => item.id === category)!.label, locale) : '';
  const regionLabel = region ? pick(GUIDE_REGIONS.find(item => item.id === region)!) : '';
  const heading = searching ? t('搜索结果', 'Search results') : topic ? topicName(topic) : category ? categoryLabel : regionLabel;
  const band = <section className="gl-band" aria-labelledby="gl-elders-title">
    <div className="gl-section__head">
      <div><h2 id="gl-elders-title">{t('长辈与家属先看', 'Start here for seniors and family')}</h2><p data-simple="hide">{summaryOf('elders')}</p></div>
    </div>
    {rows(elderBand, t('长辈与家属先看', 'Start here for seniors and family'), { call: true, className: 'gl-band__rows' })}
    <Button className="gl-band__all" block onClick={() => update({ topic: 'elders' })}>{t(`看全部 ${topicCounts.elders} 篇`, `All ${topicCounts.elders} guides for seniors and family`)}</Button>
  </section>;

  return <div className="gl-page" data-testid="guides-home">
    <PageHeader className="gl-header" title={savedOnly ? t('我的指南收藏', 'Your saved guides') : topic && !searching ? `${topicName(topic)} · ${t('办事与生活指南', 'How-to guides')}` : t('办事与生活指南', 'How-to guides for Bay Area life')}
      lede={t(`办事步骤、适用条件与官方入口。${guides.length} 篇指南，每篇附官方来源。`, `Steps, who qualifies and the official way in. ${guides.length} guides, each with its official sources.`)}
      actions={<Button className="gl-saved-link" to={savedOnly ? '/guides' : '/guides?view=saved'} icon={<Heart aria-hidden="true" strokeWidth={1.75} />}><span className="gl-saved-link__label">{savedOnly ? t('继续发现', 'Discover guides') : t('我的指南收藏', 'Saved guides')}</span></Button>} />
    <div className="gl-find">
      <label className="gl-search"><Search aria-hidden="true" strokeWidth={1.75} />
        <input type="search" aria-label={t(`在 ${guides.length} 篇指南中搜索`, `Search ${guides.length} guides`)} placeholder={t('看医生、考驾照、防骗…', 'Doctors, driving, scams…')}
          value={query} maxLength={200} onChange={event => update({ q: event.target.value })} />
        {query && <button type="button" className="gl-search__clear" aria-label={t('清除指南搜索', 'Clear search')} onClick={() => update({ q: '' })}><X aria-hidden="true" strokeWidth={1.75} /></button>}
      </label>
    </div>
    {!savedOnly && <nav className="gl-filters" aria-label={t('指南筛选', 'Guide filters')} data-simple={topic ? undefined : 'hide'}>
      <ChipRow className="gl-topics" label={t('指南主题', 'Guide topics')}>
        <FilterChip selected={!topic && !category} onClick={() => update({ topic: null, category: null })}>{t('全部', 'All')}</FilterChip>
        {GUIDE_TOPICS.map(item => <FilterChip key={item.id} selected={topic === item.id} onClick={() => update({ topic: topic === item.id ? null : item.id })}>{pick(item)}</FilterChip>)}
        {category && <FilterChip selected onClick={() => update({ category: null })} aria-label={t(`取消筛选：${categoryLabel}`, `Clear filter: ${categoryLabel}`)}>{categoryLabel}<X aria-hidden="true" strokeWidth={1.75} /></FilterChip>}
        {/* 地区 shows its current value, like the deals board's ("整个湾区 ▾" / "东湾 ▾"), and opens F's sheet. */}
        <FilterChip selected={!!region} className="gl-region-chip" aria-haspopup="dialog" aria-label={t(`地区：${region ? regionLabel : '整个湾区'}`, `Region: ${region ? regionLabel : 'whole Bay Area'}`)}
          onClick={() => setRegionsOpen(true)}>{region ? regionLabel : t('整个湾区', 'Whole Bay Area')}<ChevronDown aria-hidden="true" strokeWidth={1.75} /></FilterChip>
      </ChipRow>
    </nav>}
    <Sheet open={regionsOpen} onClose={() => setRegionsOpen(false)} title={t('地区', 'Region')} bodyClassName="gl-regions">
      <ul className="gl-regions__list">{[{ id: null, label: t('整个湾区', 'Whole Bay Area') }, ...GUIDE_REGIONS.map(item => ({ id: item.id, label: pick(item) }))].map(item => <li key={item.id ?? 'all'}>
        <button type="button" className="gl-regions__option" aria-pressed={region === item.id} onClick={() => { update({ region: item.id }); setRegionsOpen(false); }}>{item.label}</button>
      </li>)}</ul>
    </Sheet>
    {savedOnly ? <Suspense fallback={<SkeletonFeed count={3} rows />}><ReadingShelf /></Suspense>
      : browsing ? <>
        {band}
        {sections.map(({ topic: item, total, preview }) => <section key={item.id} className="gl-section" data-simple="hide" aria-labelledby={`gl-topic-${item.id}`}>
          <div className="gl-section__head">
            <div><h2 id={`gl-topic-${item.id}`}>{pick(item)}</h2><p>{pick(item.summary)}</p></div>
            <Button variant="quiet" onClick={() => update({ topic: item.id })}>{t(`看全部 ${total} 篇`, `All ${total}`)}</Button>
          </div>
          {list(preview, pick(item))}
        </section>)}
        {/* 简洁显示: one row per topic instead of the six sections. */}
        <nav className="gl-section gl-topic-rows" data-simple="show" aria-labelledby="gl-topic-rows-title">
          <h2 id="gl-topic-rows-title">{t('按主题找', 'Browse by topic')}</h2>
          <ul>{GUIDE_TOPICS.filter(item => item.id !== 'elders').map(item => <li key={item.id}>
            <Link to={`/guides?topic=${item.id}`} onClick={event => { if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return; event.preventDefault(); update({ topic: item.id }); }}>
              <span>{pick(item)}</span><span className="gl-topic-rows__count">{t(`${topicCounts[item.id]} 篇`, `${topicCounts[item.id]}`)}</span><ChevronRight aria-hidden="true" strokeWidth={1.75} /></Link>
          </li>)}</ul>
        </nav>
      </> : <section className="gl-section" aria-labelledby="gl-results-title">
        <div className="gl-section__head">
          <div><h2 id="gl-results-title">{heading}</h2>{topic && !searching && <p>{summaryOf(topic)}</p>}</div>
          <span className="gl-count" role="status" aria-live="polite">{searchLoading ? t('正在搜索…', 'Searching…') : t(`${listed.length} 篇`, `${listed.length} guide${listed.length === 1 ? '' : 's'}`)}</span>
        </div>
        {searchLoading ? (search.failed ? <ErrorState headingLevel="h3" title={t('搜索暂时没能加载', 'Search didn’t load')} onRetry={search.retry} homeTo={null} /> : <SkeletonFeed count={3} rows />)
          : listed.length === 0 ? <>
            <EmptyState icon={Search} title={t('还没有找到相关指南', 'No matching guides yet')} body={t('换个关键词或地区，也可以把问题交给 BayBay。', 'Try another word or region, or ask BayBay.')}
              actions={<>
                <Button variant="primary" onClick={() => update({ q: '', topic: null, region: null, category: null })}>{t('查看全部指南', 'Browse all guides')}</Button>
                {searching && onAsk ? <Button variant="secondary" onClick={() => onAsk(query, { mode: 'draft' })}>{t('问 BayBay', 'Ask BayBay')}</Button>
                  : searching && onSearch ? <Button variant="secondary" onClick={() => onSearch(query)}>{t('搜全站', 'Search the whole site')}</Button> : null}
              </>} />
            {band}
          </>
          : searching ? <ul className="gl-rows gl-results" aria-label={heading}>{listed.slice(0, visibleCount).map(({ guide, snippet, section }) => <li key={guide.slug}>{row(guide, { snippet, section })}</li>)}</ul>
            : list(listed.slice(0, visibleCount).map(({ guide }) => guide), heading, true)}
        {listed.length > visibleCount && <div className="gl-more"><Button onClick={() => setPage({ key: resultKey, count: visibleCount + PAGE_SIZE })}>{t(`继续查看（${visibleCount}/${listed.length}）`, `Show more (${visibleCount}/${listed.length})`)}</Button></div>}
      </section>}
    {/* Every guide is linked in the prerendered page; closed, the list is out of the accessibility tree as well as the view. */}
    {!savedOnly && <Disclosure className="gl-directory" onToggle={setDirectoryOpen} summary={t(`查看全部 ${guides.length} 篇指南目录`, `Browse all ${guides.length} guide titles`)}>
      <nav id="guide-complete-directory" hidden={!directoryOpen} aria-label={t('完整指南目录', 'Complete guide directory')}><ul>{guides.map(guide => <li key={guide.slug}><Link to={`/guides/${guide.slug}`}>{guide.title}</Link></li>)}</ul></nav>
    </Disclosure>}
    <footer className="gl-footer"><p>{t('每篇指南保留官方来源、核对日期与图片授权。', 'Each guide keeps its official sources, check dates and image credits.')}</p><Link to="/about#about-method-title">{t('了解核验方法', 'How we check sources')}</Link></footer>
  </div>;
};
