import { lazy, Suspense, useState } from 'react';
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, BookOpen, Compass, LayoutGrid, List, Loader2, MapPin, Plus, RotateCw, Search, ShieldCheck, SlidersHorizontal, Sparkles, X } from 'lucide-react';
import { useApp } from '../app/context';
import { BRAND } from '../brandAssets';
import { CATEGORIES, REGIONS, SERVICE_CATEGORIES } from '../lib/constants';
import type { PostData } from '../lib/types';
const CategoryGuideStrip = lazy(() => import('../components/CategoryGuideStrip').then(m => ({ default: m.CategoryGuideStrip })));
const EditorialCollections = lazy(() => import('../components/EditorialCollections').then(m => ({ default: m.EditorialCollections })));
import { HomeDiscovery } from '../components/HomeDiscovery';
import { CategoryChip, EmptyFeed, FeedSwitch, FilterTag, HotRecommend } from '../features/home/HomeSections';
import { RegionExplorer } from '../features/home/RegionExplorer';
import { PostCard } from '../features/posts/PostCard';
import { OfficialAds } from '../features/ads/OfficialAds';
import { PostCardSkeleton } from '../components/ui/Skeleton';

const VIEW_KEY = 'baylink.feed-view.v2';
const getSavedView = (): 'grid' | 'list' => {
  try {
    if (typeof window === 'undefined') return 'grid';
    const saved = window.localStorage.getItem(VIEW_KEY);
    if (saved === 'grid' || saved === 'list') return saved;
    return window.matchMedia('(max-width: 639px)').matches ? 'list' : 'grid';
  } catch { return 'grid'; }
};

export default function HomePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const includeUnconfirmed = new URLSearchParams(location.search).get('older') === '1';
  const changeUnconfirmed = (checked: boolean) => {
    const query = new URLSearchParams(location.search);
    if (checked) query.set('older', '1'); else query.delete('older');
    navigate({ pathname: location.pathname, search: query.toString() ? `?${query}` : '', hash: location.hash });
  };
  const { categorySlug } = useParams();
  const [view, setView] = useState<'grid' | 'list'>(getSavedView);
  const [loadedAt] = useState(Date.now);
  const [communityExpanded, setCommunityExpanded] = useState(false);
  const {
    user, showToast, posts, feedType, setFeedType, keyword, setKeyword, searchPostsNow,
    regionFilter, setRegionFilter, categoryFilter, feedError, isInitialLoading, isLoadingMore, hasMore, handleLoadMore, retryFeed,
    blockedUserIds, navigateToPost, navigateToCategory, openCreate, openEditPost, handleDeletePost,
    handleToggleFeature, handleToggleLike, handleToggleBlockUser, openReportTarget, requestPostContact, openUserProfile,
    setViewingImage, setSharingPost, openBayBay, openSearch, featuredRefreshKey, openAdDetail, adsRefreshKey,
  } = useApp();
  const changeView = (next: 'grid' | 'list') => {
    setView(next);
    try { window.localStorage.setItem(VIEW_KEY, next); } catch { /* The selected view still works when storage is unavailable. */ }
  };
  const scrollToFeed = () => { setCommunityExpanded(true); requestAnimationFrame(() => document.getElementById('home-feed-section')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' })); };
  const selectRegion = (region: string) => { setRegionFilter(region); scrollToFeed(); };
  const hasFilters = !!keyword || regionFilter !== '全部' || !!categorySlug;
  const isDiscovery = !keyword && !categorySlug;
  const recentLoadedCount = posts.filter(post => post.createdAt >= loadedAt - 30 * 24 * 60 * 60 * 1000).length;
  const communityUnavailable = !!feedError && posts.length === 0 && !isInitialLoading;
  const clearFilters = () => {
    const query = new URLSearchParams(location.search);
    for (const key of ['q', 'region', 'older']) query.delete(key);
    navigate({ pathname: '/', search: query.size ? `?${query}` : '', hash: location.hash });
  };

  return (
    <div className={`bay-home${isDiscovery ? ' bay-home-editorial' : ''}`}>
      {isDiscovery && <>
        <HomeDiscovery onAskBayBay={openBayBay} onBrowseCommunity={scrollToFeed} onSearch={openSearch} />
        <div className="bay-community-intro"><div><h2>邻里信息</h2><p>{isInitialLoading ? '正在读取当前邻里信息…' : communityUnavailable ? '邻里信息暂时无法读取，请稍后重试。' : `当前${hasMore ? '已加载' : '筛选结果'} ${posts.length} 条，近 30 天发布 ${recentLoadedCount} 条。`}{recentLoadedCount < 4 && !isInitialLoading && !communityUnavailable && '这里还在起步，旧帖请先联系发布者确认有效。'}</p></div><div><button type="button" onClick={scrollToFeed}>浏览邻里信息</button><button type="button" onClick={() => openCreate('client')}><Plus size={18} />发布需求</button></div></div>
      </>}
      {categorySlug && <header className="bay-category-header"><Link to="/"><Compass size={15} /> 发现湾区</Link><span className="bay-section-kicker">LOCAL CONNECTIONS</span><div><h1>{categoryFilter}<span>，就在你身边。</span></h1><button type="button" onClick={() => openCreate('client', categoryFilter === '本地服务' ? undefined : categoryFilter)} className="bay-button-dark"><Plus size={17} />发布需求</button></div><p>从一条信息开始，找到合适的人、物与服务。</p></header>}
      {keyword && !categorySlug && <header className="bay-search-heading"><span className="bay-section-kicker">FIND SOMETHING GOOD</span><h1>找到你需要的，<span>刚刚好。</span></h1></header>}
      {(!isDiscovery || recentLoadedCount >= 4 || communityExpanded || location.hash === '#home-feed-section' || communityUnavailable) && <div className="bay-home-columns">
        <section className="bay-feed-column" aria-label="本地信息">
          <div className="bay-feed-heading" id="home-feed-section"><div><span className="bay-section-kicker">THE NEIGHBORHOOD BOARD</span><h2>{keyword ? '搜索本地信息' : categorySlug ? `${categoryFilter}信息` : '发现身边的好信息'}<span className="bay-heading-mark" /></h2></div><div className="bay-view-toggle" role="group" aria-label="浏览方式"><button type="button" aria-label="图卡视图" aria-pressed={view === 'grid'} onClick={() => changeView('grid')} className={view === 'grid' ? 'is-active' : ''}><LayoutGrid size={17} /></button><button type="button" aria-label="列表视图" aria-pressed={view === 'list'} onClick={() => changeView('list')} className={view === 'list' ? 'is-active' : ''}><List size={19} /></button></div></div>
          <form className="bay-feed-search" onSubmit={(event) => { event.preventDefault(); searchPostsNow(); }} role="search"><Search size={19} /><input aria-label="搜索本地信息" type="search" placeholder="试试「San Mateo 租房」或「周末搬家」" value={keyword} onChange={(event) => setKeyword(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && event.nativeEvent.isComposing) event.preventDefault(); }} /><button type="submit" aria-label="搜索"><ArrowRight size={19} /></button></form>
          <FeedSwitch feedType={feedType} onClient={() => setFeedType('client')} onProvider={() => setFeedType('provider')} />
          <label className="bay-confirmation-filter"><input type="checkbox" checked={includeUnconfirmed} onChange={event => changeUnconfirmed(event.target.checked)} />也看待确认的旧信息</label>
          <p className="bay-confirmation-note">默认显示近期由发布者确认的信息。租屋、闲置和兼职 30 天，其他信息 60 天；超过期限保留原页，需再次确认。</p>
          <div className="bay-feed-filters"><MapPin size={15} /><div>{['全部', ...REGIONS].map((region) => <FilterTag key={region} label={region === '全部' ? '全部地区' : region} active={regionFilter === region} onClick={() => setRegionFilter(region)} />)}</div></div>
          <details className="bay-extra-filters"><summary><SlidersHorizontal size={15} /><span>更多分类与地区地图</span><Plus size={15} /></summary>
          <div className="bay-mobile-categories"><SlidersHorizontal size={15} /><div><CategoryChip label="全部" active={categoryFilter === '全部'} onClick={() => navigateToCategory('全部')} />{CATEGORIES.map((category) => <CategoryChip key={category} label={category} active={categoryFilter === category} onClick={() => navigateToCategory(category)} />)}</div></div>
          {categoryFilter === '本地服务' && <div className="bay-service-categories">{SERVICE_CATEGORIES.map((category) => <CategoryChip key={category} label={category} active={false} onClick={() => navigateToCategory(category)} />)}</div>}
          <details className="bay-mobile-explorer"><summary><MapPin size={16} /><span>用地区示意图探索</span><Plus size={16} /></summary><RegionExplorer selected={regionFilter} onSelect={selectRegion} /></details>
          </details>
          {categorySlug && !keyword && <Suspense fallback={null}><CategoryGuideStrip categorySlug={categorySlug} onOpenGuide={(slug) => navigate(`/guides/${slug}`)} /></Suspense>}
          <div className="bay-results-meta"><span>{isInitialLoading ? '正在发现附近的信息…' : communityUnavailable ? '邻里信息暂时无法读取，请稍后重试。' : `${hasMore ? '已加载' : '共'} ${posts.length} 条信息`}<i />按最新发布排序</span><button type="button" onClick={retryFeed} disabled={isInitialLoading} aria-label="刷新信息"><RotateCw size={13} className={isInitialLoading ? 'animate-spin' : ''} /> 刷新</button></div>
          {hasFilters && <div className="bay-active-filters">{keyword && <button type="button" onClick={() => setKeyword('')}>关键词：{keyword}<X size={12} /></button>}{regionFilter !== '全部' && <button type="button" onClick={() => setRegionFilter('全部')}>{regionFilter}<X size={12} /></button>}{categorySlug && <button type="button" onClick={() => navigateToCategory('全部')}>{categoryFilter}<X size={12} /></button>}<button type="button" onClick={clearFilters} className="bay-clear-filters">清除筛选</button></div>}
          {feedError && posts.length > 0 && <div role="status" className="bay-feed-error"><p>更新失败，当前保留已加载信息。</p><button type="button" onClick={retryFeed}>重新加载当前结果 <RotateCw size={14} /></button></div>}
          {feedError && posts.length === 0 && !isInitialLoading ? <div className="bay-feed-empty"><Compass size={34} /><h3>连接暂时慢了一点</h3><p>信息未能加载，请稍后重试。</p><button type="button" onClick={retryFeed} className="bay-button-dark">重新加载<RotateCw size={16} /></button></div>
            : isInitialLoading && posts.length === 0 ? <div className={view === 'grid' ? 'bay-feed-grid' : 'bay-feed-list'} aria-busy="true" aria-label="内容加载中">{Array.from({ length: 4 }, (_, index) => <PostCardSkeleton key={index} />)}</div>
              : posts.length === 0 ? <div className="bay-feed-empty"><Compass size={34} /><EmptyFeed feedType={feedType} keyword={keyword} onPublishService={() => openCreate('provider', ['全部', '本地服务'].includes(categoryFilter) ? undefined : categoryFilter)} onPublishInfo={() => openCreate('client', ['全部', '本地服务'].includes(categoryFilter) ? undefined : categoryFilter)} onOpenGuides={() => navigate('/guides')} onAskBayBay={() => openBayBay()} />{hasFilters && <button type="button" onClick={clearFilters} className="bay-button-text">清除筛选，发现更多 <ArrowRight size={15} /></button>}{hasMore && <button type="button" onClick={handleLoadMore} disabled={isLoadingMore} className="bay-button-dark">{isLoadingMore ? '继续查找中…' : '继续查找更多信息'}</button>}</div>
                : <>
                  <div className={view === 'grid' ? 'bay-feed-grid' : 'bay-feed-list'}>{posts.map((post) => <PostCard key={post.id} layout={view} post={post} currentUser={user} onEdit={openEditPost} onDelete={handleDeletePost} onToggleFeature={handleToggleFeature} onReport={(item: PostData) => openReportTarget({ targetType: 'post', targetId: item.id, authorId: item.authorId })} onToggleBlockUser={handleToggleBlockUser} blockedUserIds={blockedUserIds} onClick={() => navigateToPost(post)} onContactClick={() => requestPostContact(post)} onAvatarClick={openUserProfile} onImageClick={(src: string) => setViewingImage(src)} onShare={(item: PostData) => setSharingPost(item)} onLike={handleToggleLike} />)}</div>
                  {!isInitialLoading && hasMore && <button type="button" onClick={handleLoadMore} disabled={isLoadingMore} className="bay-load-more">{isLoadingMore ? <><Loader2 size={17} className="animate-spin" />加载中…</> : <>继续发现更多<ArrowRight size={17} /></>}</button>}
                  {!hasMore && <div className="bay-feed-end"><span /><p>当前信息已全部展示<br /><Link to="/guides">去生活指南里逛逛 <ArrowUpRight size={13} /></Link></p><span /></div>}
                </>}
          {!keyword && !categorySlug && <div className="bay-featured-wrap"><HotRecommend onOpenPost={navigateToPost} refreshKey={featuredRefreshKey} onViewMore={() => navigate('/recommend')} /></div>}
        </section>
        <aside className="bay-home-rail" aria-label="湾区探索与生活帮助">
          <div className="bay-desktop-explorer"><RegionExplorer selected={regionFilter} onSelect={selectRegion} /></div>
          {!isDiscovery && <section className="bay-assistant-card"><div className="bay-assistant-header"><img src={BRAND.baybayAvatar} alt="BayBay" width="54" height="54" /><span><strong>嗨，我是 BayBay</strong><small>你的 AI 湾区生活助手</small></span><Sparkles size={19} /></div><h2>生活的小问号，<br />我们一起解开。</h2><p>找信息、理思路、写帖子，<br />从你的一句话开始。</p><div className="bay-assistant-prompts"><button type="button" onClick={() => openBayBay('我想在湾区找个家。请先问我通勤地点、预算和入住时间，再帮我整理找房范围与看房清单。')}>想在湾区找个家<ArrowUpRight size={14} /></button><button type="button" onClick={() => openBayBay('帮我整理一份清楚的发布需求。请先了解我要找什么、地点、预算和时间，再写成可以核对的帖子草稿。')}>帮我整理发布需求<ArrowUpRight size={14} /></button></div><button type="button" onClick={() => openBayBay()} className="bay-assistant-cta">和 BayBay 聊聊<ArrowRight size={17} /></button><span className="bay-ai-note">AI 提供参考，重要信息请再核实</span></section>}
          {!isDiscovery && <section className="bay-start-guide"><span className="bay-section-kicker">A LITTLE LOCAL KNOW-HOW</span><h2>新来湾区？从这里开始。</h2><p>把陌生的地方，慢慢过成熟悉的日常。</p>{[{ n: '01', title: '安顿好第一个月', slug: 'bay-area-newcomer-first-month-checklist', text: '从落地到日常，逐步安排' }, { n: '02', title: '找到适合自己的家', slug: 'bay-area-rental-scam-guide', text: '看房、签约前的安全功课' }, { n: '03', title: '摸清湾区的出行方式', slug: 'bay-area-commute-guide', text: '通勤路线和交通选择' }].map((item) => <Link key={item.slug} to={`/guides/${item.slug}`}><span>{item.n}</span><div><strong>{item.title}</strong><small>{item.text}</small></div><ArrowUpRight size={15} /></Link>)}<Link className="bay-guides-all" to="/guides"><BookOpen size={15} /> 查看全部生活指南<ArrowRight size={15} /></Link></section>}
          {!isDiscovery && <Suspense fallback={null}><EditorialCollections compact /></Suspense>}
          <section className="bay-start-guide"><span className="bay-section-kicker">A LITTLE EASIER, EVERY DAY</span><h2>顺手解决，生活小事。</h2><p>一句英文、一笔账、一个陌生的单位。</p><Link to="/tools?tool=communication"><span>AI</span><div><strong>中英文沟通助手</strong><small>把你的意思，表达得更清楚</small></div><ArrowUpRight size={15} /></Link><Link to="/tools?tool=dining#tool-workspace"><span>$</span><div><strong>餐厅小费与分账</strong><small>税、小费、每人多少，一次算清</small></div><ArrowUpRight size={15} /></Link><Link to="/tools?tool=units"><span>↔</span><div><strong>日常单位换算</strong><small>华氏、英里、平方英尺，一键换算</small></div><ArrowUpRight size={15} /></Link><Link to="/tools" className="bay-guides-all">打开生活工具箱<ArrowRight size={15} /></Link></section>
          <div className="bay-home-ads"><OfficialAds isAdmin={user?.role === 'admin'} showToast={showToast} onOpenDetail={openAdDetail} refreshKey={adsRefreshKey} /></div>
          <div className="bay-community-note"><ShieldCheck size={20} /><p><strong>友好连接，谨慎交易。</strong>手机号验证与资料审核不代表交易担保。看房、面交和付款前，请核实对方信息。</p></div>
        </aside>
      </div>}
      <footer className="bay-home-footer"><span>BAYLINK<span>让生活的连接，更近一点。</span></span><nav aria-label="关于与帮助"><Link to="/about">认识 BAYLINK<ArrowUpRight size={14} /></Link><Link to="/guides/baylink-safety-guide">社区安全指南<ArrowUpRight size={14} /></Link><Link to="/archive">已发布内容目录<ArrowUpRight size={14} /></Link></nav></footer>
    </div>
  );
}
