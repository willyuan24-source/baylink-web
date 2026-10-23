// 邻里信息（测试中）: category boards /category/:slug, searches /?q=, the home page's expanded board, and the page under
// /posts/:id and /users/:id deep links. Its own chunk (WEB-HOMEPREP); HomePage decides when to mount it.
// WEB-COMMUNITY (T15): one H1 (the board's name) with one quiet 测试中 chip (UI9-R1 J1: the breadcrumb no longer repeats it), region chips, the 1:1 post cards in the WEB-UI feed grid,
// every post by default (FC3-04: the older ones say so, a quiet board says 近 30 天 0 条新信息 instead of "empty", and an
// empty 出租 list says so and offers 求租 instead of calling the whole board empty; a keyword miss offers 清除筛选),
// one publish button that does not preset 提供 / 需求 (E2E+2), and the safety note and guides under the feed.
import { lazy, Suspense, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Link, Outlet, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Loader2, Plus, RotateCw, Search, ShieldCheck } from 'lucide-react';
import '../components/ui/ui.css';
import '../components/ui/covers.css';
import '../components/ui/cards.css';
import '../features/posts/community.css';
import { useApp, type AppContextValue } from '../app/context';
import { Button } from '../components/ui/Button';
import { ChipRow, FilterChip } from '../components/ui/Chip';
import { FeedGrid, FeedItem, FeedLayoutToggle } from '../components/ui/FeedGrid';
import { useFeedLayout } from '../components/ui/feed-layout';
import { EmptyState, ErrorState } from '../components/ui/States';
import { StatusChip } from '../components/ui/Badges';
import { useUiCopy } from '../components/ui/ui-copy';
import { REGIONS } from '../lib/constants';
import type { PostData, PostType } from '../lib/types';
import { CategorySafetyNotice } from '../components/CategorySafetyNotice';
import { PostCard } from '../features/posts/PostCard';
import { BoardLinks } from '../features/posts/BoardLinks';
import { categoryName, feedTypeNames, isNewPost, publishLabel, REGION_NAMES, showCount } from '../features/posts/community-copy';
import { OfficialAds } from '../features/ads/OfficialAds';
import { useOtherTypeHasPosts } from '../features/posts/useOtherTypeHasPosts';
import { CommunityPaused } from '../features/posts/CommunityPaused';
import { COMMUNITY_VISIBLE } from '../data/site-flags';
import { SLUG_TO_CATEGORY } from '../routing';
const CategoryGuideStrip = lazy(() => import('../components/CategoryGuideStrip').then(m => ({ default: m.CategoryGuideStrip })));

export interface CommunityBoardProps {
  /** Scroll the feed heading into view (HomePage's "浏览邻里信息"; a region picked on the map). */
  onScrollToFeed: () => void;
  /** Counts the scroll requests: each new value scrolls once, after the board is on the page (it may mount on the request). */
  scrollRequest: number;
}


/**
 * The search field's example (UI9-R1-POLISH-2): each board names a word its own readers search for, and the whole line stays
 * short enough to show in full on a 390px phone at 特大 (it was cut mid-character: 「搜标题或地点，如「搬」).
 */
const SEARCH_EXAMPLES: Record<string, { zh: string; en: string }> = {
  全部: { zh: '搬家', en: 'moving' }, 租屋: { zh: '单间', en: 'room' }, 闲置: { zh: '沙发', en: 'sofa' }, 本地服务: { zh: '维修', en: 'repair' },
  搬家: { zh: '搬家', en: 'moving' }, 清洁: { zh: '保洁', en: 'maid' }, 接送: { zh: '机场', en: 'SFO' }, 维修: { zh: '水管', en: 'pipes' },
  翻译: { zh: '驾照', en: 'DMV' }, 兼职: { zh: '餐馆', en: 'cafe' }, 其他: { zh: '家教', en: 'tutor' },
};
const searchExample = (board: string) => {
  const example = SEARCH_EXAMPLES[board] || SEARCH_EXAMPLES.全部;
  return { zh: `如「${example.zh}」或城市名`, en: `Try “${example.en}” or a city` };
};

/**
 * The board's loading card (UI9-R1-POLISH-2, /category CLS): a post card's own boxes — the cover at the feed's ratio, two title
 * lines, the price, the meta line, on /en the original-text line, and the status chip — in the card's own classes, so a row
 * of them is as tall as a row of posts and nothing under the feed moves when the posts arrive (the generic SkeletonCard was
 * 72px shorter on a 1440 desktop and brought the notes into view).
 */
function PostCardSkeleton({ english }: { english: boolean }) {
  return <div className="ui-feed-card cm-card cm-card--skeleton" aria-hidden="true">
    <p className="ui-feed-card__title cm-card__title"><span className="ui-skeleton" data-bar="long" /> <span className="ui-skeleton" data-bar="short" /></p>
    <div className="ui-feed-card__media"><span className="ui-skeleton" data-shape="cover" /></div>
    <p className="cm-card__price"><span className="ui-skeleton" data-bar="price" /></p>
    <p className="ui-feed-card__meta cm-card__meta"><span className="ui-skeleton" data-bar="meta" /></p>
    {english && <div className="cm-card__translation"><p className="post-translation"><span>{'\u00a0'}<span className="ui-skeleton" data-bar="note" /></span></p></div>}
    <p className="cm-status"><span className="ui-status">{'\u00a0'}</span></p>
  </div>;
}

/**
 * 出租 / 求租 (提供 / 需要): a radio group of WEB-UI chips — the same two chip styles as the area chips beside it, so the
 * board keeps to the SYS bar of ≤5 button styles. ←/→ move and select, like the WEB-UI SegmentedControl.
 */
function TypeSwitch({ label, value, items, onChange }: { label: string; value: PostType; items: { id: PostType; label: string }[]; onChange: (id: PostType) => void }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKeyDown = (event: KeyboardEvent, index: number) => {
    const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = (index + step + items.length) % items.length;
    refs.current[next]?.focus();
    onChange(items[next].id);
  };
  return <div role="radiogroup" aria-label={label} className="cm-type-switch">
    {items.map((item, index) => <button key={item.id} ref={element => { refs.current[index] = element; }} type="button" role="radio" className="ui-chip"
      aria-checked={item.id === value} tabIndex={item.id === value ? 0 : -1} onClick={() => onChange(item.id)} onKeyDown={event => onKeyDown(event, index)}>{item.label}</button>)}
  </div>;
}

/** COMMUNITY_VISIBLE = false (H04 fallback): no board on the home page; a category or a board search shows the paused page. */
export default function CommunityBoard(props: CommunityBoardProps) {
  const { categorySlug } = useParams();
  const { keyword } = useApp();
  if (COMMUNITY_VISIBLE) return <CommunityBoardView {...props} />;
  return categorySlug || keyword ? <CommunityPaused /> : null;
}

function CommunityBoardView({ scrollRequest, guideStrip }: CommunityBoardProps & { guideStrip?: ReactNode }) {
  const { t, pick, english } = useUiCopy();
  const navigate = useNavigate();
  const location = useLocation();
  const { categorySlug } = useParams();
  const params = new URLSearchParams(location.search);
  // Every post by default; ?recent=1 keeps only those the poster confirmed recently (the API's `current`).
  const recentOnly = params.get('recent') === '1';
  const [now] = useState(Date.now);
  const feedLayout = useFeedLayout();
  const {
    user, showToast, posts, feedType, setFeedType, keyword, setKeyword, searchPostsNow,
    regionFilter, setRegionFilter, categoryFilter, feedError, isInitialLoading, isLoadingMore, hasMore, handleLoadMore, retryFeed,
    blockedUserIds, navigateToPost, openCreate, openEditPost, handleDeletePost,
    handleToggleFeature, handleToggleBlockUser, openReportTarget, openAdDetail, adsRefreshKey,
  } = useApp();
  useEffect(() => {
    if (!scrollRequest) return;
    const frame = requestAnimationFrame(() => document.getElementById('home-feed-section')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }));
    return () => cancelAnimationFrame(frame);
  }, [scrollRequest]);
  // The post and profile sheets this board opens load 2.5 s after it shows, so a first tap opens at once (H44: only here,
  // not on every page).
  useEffect(() => {
    const id = window.setTimeout(() => {
      void import('../features/posts/PostDetailModal');
      void import('../features/users/UserProfileModal');
    }, 2500);
    return () => window.clearTimeout(id);
  }, []);

  // `?${query}` only when something is left. Not `query.size`: Safari before 17 (iOS 15/16, a build target) lacks it.
  const searchOf = (query: URLSearchParams) => { const text = query.toString(); return text ? `?${text}` : ''; };
  const setRecentOnly = (on: boolean) => {
    const query = new URLSearchParams(location.search);
    query.delete('older');
    if (on) query.set('recent', '1'); else query.delete('recent');
    navigate({ pathname: location.pathname, search: searchOf(query), hash: location.hash }, { replace: true, state: location.state, preventScrollReset: true });
  };
  const clearFilters = () => {
    const query = new URLSearchParams(location.search);
    for (const key of ['q', 'region', 'older', 'recent']) query.delete(key);
    navigate({ pathname: categorySlug ? location.pathname : '/', search: searchOf(query), hash: location.hash });
  };
  const hasKeyword = !!keyword.trim();
  const isSearch = !!keyword && !categorySlug;
  const isDiscovery = !keyword && !categorySlug;
  const board = categorySlug ? categoryFilter : '全部';
  const name = pick(categoryName(board));
  const types = feedTypeNames(board);
  const activeType: PostType = feedType === 'client' ? 'client' : 'provider';
  const otherType: PostType = activeType === 'client' ? 'provider' : 'client';
  const publish = () => openCreate(undefined, ['全部', '本地服务'].includes(board) ? undefined : board);
  const unavailable = !!feedError && posts.length === 0 && !isInitialLoading;
  const loadingFirst = isInitialLoading && posts.length === 0;
  const newCount = posts.filter(post => isNewPost(post, now)).length;
  // Posts arrive newest first, so a first page without a new post means none in 30 days.
  const quiet = !recentOnly && !loadingFirst && !unavailable && posts.length > 0 && newCount === 0;
  const hasFilters = regionFilter !== '全部' || recentOnly || hasKeyword;
  const Heading = isDiscovery ? 'h2' : 'h1';
  // FC3-04: an empty list is empty for the kind on screen (出租), not for the board: 求租 may hold every post. Only when
  // the other kind is empty too does the empty state speak for the whole board.
  const otherHasPosts = useOtherTypeHasPosts({
    enabled: !unavailable && !loadingFirst && posts.length === 0, type: otherType, recentOnly, keyword: keyword.trim(),
    categoryFilter: board, regionFilter, userId: user?.id, blockedUserIds,
  });
  const wholeBoard = otherHasPosts === false;
  // 租房信息; the home board is 邻里信息 itself (not 邻里信息信息).
  const feedLabel = board === '全部' ? t('邻里信息', 'Neighborhood posts') : t(`${name}信息`, `${name} posts`);

  const resultsLine = loadingFirst ? t('正在读取邻里信息…', 'Loading posts…')
    : unavailable ? null
      : quiet ? t(`近 30 天 0 条新信息 · 下面是较早的信息，联系前请先向发布者确认是否仍有效`, 'No new posts in the last 30 days · These are older posts; check with the poster that they still stand')
        : showCount(newCount) ? t(`近 30 天 ${newCount}${hasMore ? '+' : ''} 条新信息 · 按发布时间排列`, `${newCount}${hasMore ? '+' : ''} new in the last 30 days · Newest first`)
          : posts.length ? t('按发布时间排列，最新的在前', 'Newest first') : null;

  const kind = { zh: `「${types[activeType].zh}」`, en: `“${types[activeType].en}”` };
  const other = { zh: `「${types[otherType].zh}」`, en: `“${types[otherType].en}”` };
  const areaName = pick(REGION_NAMES[regionFilter] || { zh: regionFilter, en: regionFilter });
  const seeOther = (variant: 'primary' | 'text') => <Button variant={variant} onClick={() => setFeedType(otherType)}>{t(`看看${other.zh}`, `See ${other.en}`)}</Button>;
  const publishButton = (variant: 'primary' | 'text') => <Button variant={variant} icon={variant === 'primary' ? <Plus aria-hidden="true" strokeWidth={1.75} /> : undefined} onClick={publish}>{pick(publishLabel(board))}</Button>;
  const emptyState = hasKeyword
    ? <EmptyState headingLevel="h3" icon={Search}
      title={!wholeBoard ? t(`${kind.zh}里没有找到相关信息`, `Nothing under ${kind.en} matches`)
        : categorySlug ? t(`没有找到相关的${name}信息`, `No ${name.toLowerCase()} posts match`) : t('没有找到相关信息', 'No posts match')}
      body={otherHasPosts ? t(`${other.zh}里有相关的信息。`, `There are matches under ${other.en}.`) : t('换个关键词，或去掉筛选再试。', 'Try another word, or clear the filters.')}
      actions={otherHasPosts ? <>{seeOther('primary')}<Button variant="text" onClick={clearFilters}>{t('清除筛选', 'Clear filters')}</Button></>
        : <Button variant="primary" onClick={clearFilters}>{t('清除筛选', 'Clear filters')}</Button>} />
    : recentOnly ? <EmptyState headingLevel="h3"
      title={wholeBoard ? t('近 30 天 0 条新信息', 'No new posts in the last 30 days') : t(`近 30 天没有${kind.zh}的新信息`, `No new ${kind.en} posts in the last 30 days`)}
      body={t('较早的信息还在，联系前请先向发布者确认。', 'Older posts are still here; check with the poster before you contact them.')}
      actions={<><Button variant="primary" onClick={() => setRecentOnly(false)}>{t('查看较早信息', 'See older posts')}</Button>{otherHasPosts ? seeOther('text') : publishButton('text')}</>} />
      : regionFilter !== '全部' ? <EmptyState headingLevel="h3"
        title={wholeBoard ? t(`${areaName}暂时没有${name}信息`, `No ${name.toLowerCase()} posts in ${areaName} yet`) : t(`${areaName}暂时没有${kind.zh}的${name}信息`, `No ${kind.en} posts in ${areaName} yet`)}
        body={t('看看整个湾区的信息，或换个地区。', 'See the whole Bay Area, or pick another area.')}
        actions={<><Button variant="primary" onClick={() => setRegionFilter('全部')}>{t('看整个湾区', 'Whole Bay Area')}</Button>{otherHasPosts && seeOther('text')}</>} />
        : wholeBoard ? <EmptyState headingLevel="h3" title={t(`${name}还没有信息`, `No ${name.toLowerCase()} posts yet`)} body={t('邻里信息还在测试中。发布前可以先看看下面的安全提醒和指南。', 'The neighborhood board is still in testing. The safety notes and guides below are a good start.')}
          actions={publishButton('primary')} />
          : <EmptyState headingLevel="h3" title={categorySlug ? t(`还没有${kind.zh}的${name}信息`, `No ${kind.en} posts in ${name} yet`) : t(`还没有${kind.zh}的${name}信息`, `No ${kind.en} posts yet`)}
            body={otherHasPosts ? t(`${other.zh}里有信息，可以先看看。`, `There are posts under ${other.en}.`) : t('邻里信息还在测试中。发布前可以先看看下面的安全提醒和指南。', 'The neighborhood board is still in testing. The safety notes and guides below are a good start.')}
            actions={otherHasPosts ? <>{seeOther('primary')}{publishButton('text')}</> : publishButton('primary')} />;

  return <section className="cm-board" aria-labelledby="cm-board-title" data-mode={isDiscovery ? 'home' : isSearch ? 'search' : 'category'}>
    <header className="ui-page-header cm-board__header" id="home-feed-section">
      {categorySlug && <nav className="ui-page-header__crumbs" aria-label={t('当前位置', 'Breadcrumb')}><Link to="/">{t('首页', 'Home')}</Link> › {t('邻里信息', 'Neighborhood board')}</nav>}
      <div className="cm-board__title-row">
        <Heading id="cm-board-title" className="ui-page-header__title">{isSearch ? t('搜索邻里信息', 'Search the neighborhood board') : name}</Heading>
        <StatusChip tone="neutral">{t('测试中', 'Beta')}</StatusChip>
      </div>
      <p className="ui-page-header__lede">{t('邻居发布，平台不逐条核实；联系和付款前请先确认。', 'Posted by neighbors and not verified by BAYLINK. Check before you contact or pay.')}</p>
      <div className="ui-page-header__actions"><Button variant="primary" icon={<Plus aria-hidden="true" strokeWidth={1.75} />} onClick={publish}>{pick(publishLabel(board))}</Button></div>
    </header>

    <form className="cm-search" role="search" onSubmit={(event) => { event.preventDefault(); searchPostsNow(); }}>
      <Search aria-hidden="true" strokeWidth={1.75} />
      <input aria-label={t('搜索邻里信息', 'Search the neighborhood board')} type="search" maxLength={80} placeholder={pick(searchExample(board))} value={keyword}
        onChange={(event) => setKeyword(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && event.nativeEvent.isComposing) event.preventDefault(); }} />
      <Button type="submit" variant="text" className="cm-search__submit">{t('搜索', 'Search')}</Button>
    </form>

    <div className="cm-board__filters">
      <ChipRow label={t('地区', 'Area')}>
        <FilterChip selected={regionFilter === '全部'} onClick={() => setRegionFilter('全部')}>{t('全部地区', 'All areas')}</FilterChip>
        {REGIONS.map(region => <FilterChip key={region} selected={regionFilter === region} onClick={() => setRegionFilter(regionFilter === region ? '全部' : region)}>{pick(REGION_NAMES[region] || { zh: region, en: region })}</FilterChip>)}
      </ChipRow>
      <div className="cm-board__switches">
        <TypeSwitch label={t('信息类型', 'Type of post')} value={feedType === 'client' ? 'client' : 'provider'} onChange={setFeedType}
          items={[{ id: 'provider', label: pick(types.provider) }, { id: 'client', label: pick(types.client) }]} />
        <FilterChip selected={recentOnly} onClick={() => setRecentOnly(!recentOnly)}>{t('近期确认', 'Recently confirmed')}</FilterChip>
      </div>
    </div>

    {/* The feed's heading (H1 board name → h2 → card h3s); the home board's own heading is already an h2. */}
    {!isDiscovery && <h2 className="sr-only">{isSearch ? t('搜索结果', 'Results') : feedLabel}</h2>}
    <div className="cm-board__results">
      {resultsLine && <p className="cm-board__count" role="status">{resultsLine}</p>}
      <div className="cm-board__tools">
        {hasFilters && <Button variant="text" onClick={clearFilters}>{t('清除筛选', 'Clear filters')}</Button>}
        <FeedLayoutToggle effective={feedLayout.effective} onChange={feedLayout.setLayout} />
      </div>
    </div>

    {feedError && posts.length > 0 && <div role="status" className="cm-board__stale"><p>{t('更新失败，下面是已加载的信息。', 'Could not refresh; showing what was already loaded.')}</p><Button variant="text" icon={<RotateCw aria-hidden="true" strokeWidth={1.75} />} onClick={retryFeed}>{t('重试', 'Try again')}</Button></div>}
    {unavailable ? <ErrorState headingLevel="h3" title={t('邻里信息暂时没能加载', 'The board didn’t load')} body={t('可能是网络不稳或服务暂时繁忙。稍后再试一次。', 'The connection or our service may be busy. Please try again in a moment.')} onRetry={retryFeed} homeTo={null} />
      : loadingFirst ? <div aria-busy="true" aria-label={t('内容加载中', 'Loading')}><FeedGrid label={t('正在加载', 'Loading')} ratio="1:1" layout={feedLayout.layout}>{Array.from({ length: 4 }, (_, index) => <FeedItem key={index}><PostCardSkeleton english={english} /></FeedItem>)}</FeedGrid></div>
        : posts.length === 0 ? <div className="cm-board__empty">{emptyState}</div>
          : <>
            <FeedGrid label={feedLabel} ratio="1:1" layout={feedLayout.layout}>
              {posts.map((post, index) => <FeedItem key={post.id}><PostCard post={post} layout="grid" priority={index === 0 && !isDiscovery} currentUser={user} blockedUserIds={blockedUserIds}
                onClick={() => navigateToPost(post)} onEdit={openEditPost} onDelete={handleDeletePost} onToggleFeature={handleToggleFeature}
                onReport={(item: PostData) => openReportTarget({ targetType: 'post', targetId: item.id, authorId: item.authorId })} onToggleBlockUser={handleToggleBlockUser} /></FeedItem>)}
            </FeedGrid>
            {hasMore ? <div className="cm-board__more"><Button variant="secondary" onClick={handleLoadMore} disabled={isLoadingMore} icon={isLoadingMore ? <Loader2 className="animate-spin" aria-hidden="true" /> : undefined}>{isLoadingMore ? t('加载中…', 'Loading…') : t('加载更多', 'Load more')}</Button></div>
              : <p className="cm-board__end">{t('已经是全部信息', 'That’s everything for now')}</p>}
          </>}

    {categorySlug && !keyword && (guideStrip ?? <Suspense fallback={null}><CategoryGuideStrip categorySlug={categorySlug} /></Suspense>)}

    <div className="cm-board__notes">
      <section className="cm-board__safety" aria-label={t('交易安全', 'Trading safety')}>
        <h2 className="cm-board__subhead"><ShieldCheck aria-hidden="true" strokeWidth={1.75} />{t('联系和付款前', 'Before you contact or pay')}</h2>
        <CategorySafetyNotice category={categorySlug ? categoryFilter : null} />
        <p className="cm-board__fineprint">{t('手机号验证和资料审核不代表交易担保。看房、面交和付款前，请核实对方信息。', 'A verified phone or profile is not a guarantee. Check the other person before a viewing, a meetup or a payment.')}</p>
        {/* H53: this link was in the board's own small-print footer; the site footer now closes the page. */}
        <p className="cm-board__fineprint"><Link className="cm-board__guide-link" to="/guides/baylink-safety-guide">{t('社区安全指南', 'Community safety guide')}</Link></p>
      </section>
      <nav className="cm-board__boards" aria-label={t('其他分类', 'Other boards')}>
        <h2 className="cm-board__subhead">{t('其他分类', 'Other boards')}</h2>
        <BoardLinks current={categorySlug ? categoryFilter : undefined} />
      </nav>
      <div className="cm-board__ads"><OfficialAds isAdmin={user?.role === 'admin'} showToast={showToast} onOpenDetail={openAdDetail} refreshKey={adsRefreshKey} /></div>
    </div>
  </section>;
}

const noop = () => {};
/**
 * The prerendered first paint of /category/:slug (scripts/prerender.tsx; UI9-R1-POLISH-2): the board itself in its loading
 * state — the header, search, filters, results line and loading cards the app renders before the posts arrive, inside
 * HomePage's wrapper — so the app's first render replaces it box for box. The old text stand-in (its footer at y = 715 on a
 * 1440 × 900 desktop) was swapped about 0.7 s later for this board: desktop CLS 0.109 (rent) and 0.089 (used), and a
 * different page on screen meanwhile. `guideStrip` puts the board's guides in their place for readers and crawlers.
 */
export function CategoryBoardPrerender({ slug, guideStrip }: { slug: string; guideStrip?: ReactNode }) {
  const context = {
    user: null, posts: [], feedType: 'provider', keyword: '', regionFilter: '全部', categoryFilter: SLUG_TO_CATEGORY[slug] || '全部',
    feedError: false, isInitialLoading: true, isLoadingMore: false, hasMore: false, blockedUserIds: [], adsRefreshKey: 0,
    showToast: noop, setFeedType: noop, setKeyword: noop, searchPostsNow: noop, setRegionFilter: noop, handleLoadMore: noop, retryFeed: noop,
    navigateToPost: noop, openCreate: noop, openEditPost: noop, handleDeletePost: noop, handleToggleFeature: noop, handleToggleBlockUser: noop,
    openReportTarget: noop, openAdDetail: noop,
  } as unknown as AppContextValue;
  return <Routes><Route element={<Outlet context={context} />}>
    <Route path="/category/:categorySlug" element={<div className="bay-home"><CommunityBoardView onScrollToFeed={noop} scrollRequest={0} guideStrip={guideStrip} /></div>} />
  </Route></Routes>;
}
