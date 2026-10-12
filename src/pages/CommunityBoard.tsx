// 邻里信息（测试中）: category boards /category/:slug, searches /?q=, the home page's expanded board, and the page under
// /posts/:id and /users/:id deep links. Its own chunk (WEB-HOMEPREP); HomePage decides when to mount it.
// WEB-COMMUNITY (T15): one H1 (the board's name) with 测试中, region chips, the 1:1 post cards in the WEB-UI feed grid,
// every post by default (FC3-04: the older ones say so, and a quiet board says 近 30 天 0 条新信息 instead of "empty"),
// one publish button that does not preset 提供 / 需求 (E2E+2), and the safety note and guides under the feed.
import { lazy, Suspense, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Loader2, Plus, RotateCw, Search, ShieldCheck } from 'lucide-react';
import '../components/ui/ui.css';
import '../features/posts/community.css';
import { useApp } from '../app/context';
import { Button } from '../components/ui/Button';
import { ChipRow, FilterChip } from '../components/ui/Chip';
import { FeedGrid, FeedItem, FeedLayoutToggle } from '../components/ui/FeedGrid';
import { useFeedLayout } from '../components/ui/feed-layout';
import { SegmentedControl } from '../components/ui/Segmented';
import { SkeletonCard } from '../components/ui/SkeletonCard';
import { EmptyState, ErrorState } from '../components/ui/States';
import { StatusChip } from '../components/ui/Badges';
import { useUiCopy } from '../components/ui/ui-copy';
import { REGIONS } from '../lib/constants';
import type { PostData } from '../lib/types';
import { CategorySafetyNotice } from '../components/CategorySafetyNotice';
import { PostCard } from '../features/posts/PostCard';
import { BoardLinks } from '../features/posts/BoardLinks';
import { categoryName, feedTypeNames, isNewPost, publishLabel, showCount } from '../features/posts/community-copy';
import { OfficialAds } from '../features/ads/OfficialAds';
const CategoryGuideStrip = lazy(() => import('../components/CategoryGuideStrip').then(m => ({ default: m.CategoryGuideStrip })));

export interface CommunityBoardProps {
  /** Scroll the feed heading into view (HomePage's "浏览邻里信息"; a region picked on the map). */
  onScrollToFeed: () => void;
  /** Counts the scroll requests: each new value scrolls once, after the board is on the page (it may mount on the request). */
  scrollRequest: number;
}

const REGION_NAMES: Record<string, { zh: string; en: string }> = {
  旧金山: { zh: '旧金山', en: 'San Francisco' }, 中半岛: { zh: '半岛', en: 'Peninsula' }, 东湾: { zh: '东湾', en: 'East Bay' },
  南湾: { zh: '南湾', en: 'South Bay' }, 北湾: { zh: '北湾', en: 'North Bay' },
};

export default function CommunityBoard({ scrollRequest }: CommunityBoardProps) {
  const { t, pick } = useUiCopy();
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

  const setRecentOnly = (on: boolean) => {
    const query = new URLSearchParams(location.search);
    query.delete('older');
    if (on) query.set('recent', '1'); else query.delete('recent');
    navigate({ pathname: location.pathname, search: query.size ? `?${query}` : '', hash: location.hash }, { replace: true, state: location.state, preventScrollReset: true });
  };
  const clearFilters = () => {
    const query = new URLSearchParams(location.search);
    for (const key of ['q', 'region', 'older', 'recent']) query.delete(key);
    navigate({ pathname: categorySlug ? location.pathname : '/', search: query.size ? `?${query}` : '', hash: location.hash });
  };
  const isSearch = !!keyword && !categorySlug;
  const isDiscovery = !keyword && !categorySlug;
  const board = categorySlug ? categoryFilter : '全部';
  const name = pick(categoryName(board));
  const types = feedTypeNames(board);
  const publish = () => openCreate(undefined, ['全部', '本地服务'].includes(board) ? undefined : board);
  const unavailable = !!feedError && posts.length === 0 && !isInitialLoading;
  const loadingFirst = isInitialLoading && posts.length === 0;
  const newCount = posts.filter(post => isNewPost(post, now)).length;
  // Posts arrive newest first, so a first page without a new post means none in 30 days.
  const quiet = !recentOnly && !loadingFirst && !unavailable && posts.length > 0 && newCount === 0;
  const hasFilters = regionFilter !== '全部' || recentOnly || (isSearch && !!keyword);
  const Heading = isDiscovery ? 'h2' : 'h1';

  const resultsLine = loadingFirst ? t('正在读取邻里信息…', 'Loading posts…')
    : unavailable ? null
      : quiet ? t(`近 30 天 0 条新信息 · 下面是较早的信息，联系前请先向发布者确认是否仍有效`, 'No new posts in the last 30 days · These are older posts; check with the poster that they still stand')
        : showCount(newCount) ? t(`近 30 天 ${newCount}${hasMore ? '+' : ''} 条新信息 · 按发布时间排列`, `${newCount}${hasMore ? '+' : ''} new in the last 30 days · Newest first`)
          : posts.length ? t('按发布时间排列，最新的在前', 'Newest first') : null;

  const emptyState = recentOnly
    ? <EmptyState headingLevel="h3" title={t('近 30 天 0 条新信息', 'No new posts in the last 30 days')} body={t('较早的信息还在，联系前请先向发布者确认。', 'Older posts are still here; check with the poster before you contact them.')}
      actions={<><Button variant="primary" onClick={() => setRecentOnly(false)}>{t('查看较早信息', 'See older posts')}</Button><Button variant="text" onClick={publish}>{pick(publishLabel(board))}</Button></>} />
    : isSearch ? <EmptyState headingLevel="h3" icon={Search} title={t('没有找到相关信息', 'No posts match')} body={t('换个关键词，或去掉地区筛选再试。', 'Try another word, or remove the area filter.')}
      actions={<Button variant="primary" onClick={clearFilters}>{t('清除筛选', 'Clear filters')}</Button>} />
      : regionFilter !== '全部' ? <EmptyState headingLevel="h3" title={t(`${pick(REGION_NAMES[regionFilter] || { zh: regionFilter, en: regionFilter })}暂时没有${name}信息`, `No ${name.toLowerCase()} posts in ${pick(REGION_NAMES[regionFilter] || { zh: regionFilter, en: regionFilter })} yet`)}
        body={t('看看整个湾区的信息，或换个地区。', 'See the whole Bay Area, or pick another area.')} actions={<Button variant="primary" onClick={() => setRegionFilter('全部')}>{t('看整个湾区', 'Whole Bay Area')}</Button>} />
        : <EmptyState headingLevel="h3" title={t(`${name}还没有信息`, `No ${name.toLowerCase()} posts yet`)} body={t('邻里信息还在测试中。发布前可以先看看下面的安全提醒和指南。', 'The neighborhood board is still in testing. The safety notes and guides below are a good start.')}
          actions={<Button variant="primary" icon={<Plus aria-hidden="true" strokeWidth={1.75} />} onClick={publish}>{pick(publishLabel(board))}</Button>} />;

  return <section className="cm-board" aria-labelledby="cm-board-title" data-mode={isDiscovery ? 'home' : isSearch ? 'search' : 'category'}>
    <header className="ui-page-header cm-board__header" id="home-feed-section">
      {categorySlug && <nav className="ui-page-header__crumbs" aria-label={t('当前位置', 'Breadcrumb')}><Link to="/">{t('首页', 'Home')}</Link> › {t('邻里信息（测试中）', 'Neighborhood board (testing)')}</nav>}
      <div className="cm-board__title-row">
        <Heading id="cm-board-title" className="ui-page-header__title">{isSearch ? t('搜索邻里信息', 'Search the neighborhood board') : name}</Heading>
        <StatusChip tone="info">{t('测试中', 'Testing')}</StatusChip>
      </div>
      <p className="ui-page-header__lede">{t('湾区邻居发布的房源、二手和服务。平台不核实每条信息，联系和付款前请自己确认。', 'Rentals, secondhand items and services posted by Bay Area neighbors. BAYLINK does not verify each post; check before you contact or pay.')}</p>
      <div className="ui-page-header__actions"><Button variant="primary" icon={<Plus aria-hidden="true" strokeWidth={1.75} />} onClick={publish}>{pick(publishLabel(board))}</Button></div>
    </header>

    <form className="cm-search" role="search" onSubmit={(event) => { event.preventDefault(); searchPostsNow(); }}>
      <Search aria-hidden="true" strokeWidth={1.75} />
      <input aria-label={t('搜索邻里信息', 'Search the neighborhood board')} type="search" maxLength={80} placeholder={t('试试「San Mateo 租房」或「搬家」', 'Try “San Mateo room” or “moving”')} value={keyword}
        onChange={(event) => setKeyword(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && event.nativeEvent.isComposing) event.preventDefault(); }} />
      <button type="submit" className="cm-search__submit">{t('搜索', 'Search')}</button>
    </form>

    <div className="cm-board__filters">
      <ChipRow label={t('地区', 'Area')}>
        <FilterChip selected={regionFilter === '全部'} onClick={() => setRegionFilter('全部')}>{t('全部地区', 'All areas')}</FilterChip>
        {REGIONS.map(region => <FilterChip key={region} selected={regionFilter === region} onClick={() => setRegionFilter(regionFilter === region ? '全部' : region)}>{pick(REGION_NAMES[region] || { zh: region, en: region })}</FilterChip>)}
      </ChipRow>
      <div className="cm-board__switches">
        <SegmentedControl label={t('信息类型', 'Type of post')} value={feedType} onChange={(id) => setFeedType(id === 'client' ? 'client' : 'provider')}
          items={[{ id: 'provider', label: pick(types.provider) }, { id: 'client', label: pick(types.client) }]} />
        <FilterChip selected={recentOnly} onClick={() => setRecentOnly(!recentOnly)}>{t('只看近期确认', 'Recently confirmed only')}</FilterChip>
      </div>
    </div>

    {categorySlug && !keyword && <Suspense fallback={null}><CategoryGuideStrip categorySlug={categorySlug} /></Suspense>}

    <div className="cm-board__results">
      {resultsLine && <p className="cm-board__count" role="status" data-quiet={quiet ? '' : undefined}>{resultsLine}</p>}
      <div className="cm-board__tools">
        {hasFilters && <Button variant="text" onClick={clearFilters}>{t('清除筛选', 'Clear filters')}</Button>}
        <FeedLayoutToggle effective={feedLayout.effective} onChange={feedLayout.setLayout} />
      </div>
    </div>

    {feedError && posts.length > 0 && <div role="status" className="cm-board__stale"><p>{t('更新失败，下面是已加载的信息。', 'Could not refresh; showing what was already loaded.')}</p><Button variant="text" icon={<RotateCw aria-hidden="true" strokeWidth={1.75} />} onClick={retryFeed}>{t('重试', 'Try again')}</Button></div>}
    {unavailable ? <ErrorState headingLevel="h3" title={t('邻里信息暂时没能加载', 'The board didn’t load')} body={t('可能是网络不稳或服务暂时繁忙。稍后再试一次。', 'The connection or our service may be busy. Please try again in a moment.')} onRetry={retryFeed} homeTo={null} />
      : loadingFirst ? <div aria-busy="true" aria-label={t('内容加载中', 'Loading')}><FeedGrid label={t('正在加载', 'Loading')} ratio="1:1" layout={feedLayout.layout}>{Array.from({ length: 4 }, (_, index) => <FeedItem key={index}><SkeletonCard /></FeedItem>)}</FeedGrid></div>
        : posts.length === 0 ? <div className="cm-board__empty">{emptyState}</div>
          : <>
            <FeedGrid label={t(`${name}信息`, `${name} posts`)} ratio="1:1" layout={feedLayout.layout}>
              {posts.map((post, index) => <FeedItem key={post.id}><PostCard post={post} priority={index === 0 && !isDiscovery} currentUser={user} blockedUserIds={blockedUserIds}
                onClick={() => navigateToPost(post)} onEdit={openEditPost} onDelete={handleDeletePost} onToggleFeature={handleToggleFeature}
                onReport={(item: PostData) => openReportTarget({ targetType: 'post', targetId: item.id, authorId: item.authorId })} onToggleBlockUser={handleToggleBlockUser} /></FeedItem>)}
            </FeedGrid>
            {hasMore ? <div className="cm-board__more"><Button variant="secondary" onClick={handleLoadMore} disabled={isLoadingMore} icon={isLoadingMore ? <Loader2 className="animate-spin" aria-hidden="true" /> : undefined}>{isLoadingMore ? t('加载中…', 'Loading…') : t('加载更多', 'Load more')}</Button></div>
              : <p className="cm-board__end">{t('已经是全部信息', 'That’s everything for now')}</p>}
          </>}

    <div className="cm-board__notes">
      <section className="cm-board__safety" aria-label={t('交易安全', 'Trading safety')}>
        <h2 className="cm-board__subhead"><ShieldCheck aria-hidden="true" strokeWidth={1.75} />{t('联系和付款前', 'Before you contact or pay')}</h2>
        <CategorySafetyNotice category={categorySlug ? categoryFilter : null} />
        <p className="cm-board__fineprint">{t('手机号验证和资料审核不代表交易担保。看房、面交和付款前，请核实对方信息。', 'A verified phone or profile is not a guarantee. Check the other person before a viewing, a meetup or a payment.')}</p>
      </section>
      <nav className="cm-board__boards" aria-label={t('其他分类', 'Other boards')}>
        <h2 className="cm-board__subhead">{t('其他分类', 'Other boards')}</h2>
        <BoardLinks current={categorySlug ? categoryFilter : undefined} />
      </nav>
      <div className="cm-board__ads"><OfficialAds isAdmin={user?.role === 'admin'} showToast={showToast} onOpenDetail={openAdDetail} refreshKey={adsRefreshKey} /></div>
    </div>
  </section>;
}
