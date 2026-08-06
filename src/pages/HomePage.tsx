// 首页 feed（也作为 /posts/:id、/users/:id 深链的背景页）
import { useNavigate, useParams } from 'react-router-dom';
import { Search, Loader2, BookOpen } from 'lucide-react';
import { useApp } from '../app/context';
import { CATEGORIES, REGIONS } from '../lib/constants';
import type { PostData } from '../lib/types';
import { BayBayAssistantEntry } from '../components/BayBayAssistantEntry';
import { CategoryGuideStrip } from '../components/CategoryGuideStrip';
import {
  BayHero, CategoryChip, ChannelShortcuts, EmptyFeed, FeedSwitch, FilterTag, HotRecommend,
} from '../features/home/HomeSections';
import { PostCard } from '../features/posts/PostCard';
import { FeedSkeleton } from '../components/ui/Skeleton';

export default function HomePage() {
  const navigate = useNavigate();
  const { categorySlug } = useParams();
  const {
    user, setShowLogin,
    posts, feedType, setFeedType, keyword, setKeyword, searchPostsNow,
    regionFilter, setRegionFilter, categoryFilter,
    feedError, isInitialLoading, isLoadingMore, hasMore, handleLoadMore, retryFeed,
    blockedUserIds, navigateToPost, navigateToCategory, handleChannelClick,
    openCreate, openEditPost, handleDeletePost, handleToggleFeature, handleToggleLike,
    handleToggleBlockUser, openReportTarget, openChat, openUserProfile,
    setViewingImage, setSharingPost, setBaybayPanelOpen, featuredRefreshKey,
  } = useApp();

  return (
    <div className="px-4 pt-1 sm:px-5 sm:pt-2 pb-40 lg:pb-8 max-w-full overflow-x-hidden">
        <div className="relative mb-1 sm:mb-2 group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-baylink-muted/70 group-focus-within:text-baylink-green/80 transition pointer-events-none" size={16} />
          <input className="search-input" placeholder="搜索房源、服务、二手、接送..." value={keyword} onChange={e => setKeyword(e.target.value)} onKeyDown={e => e.key === 'Enter' && searchPostsNow()} />
        </div>

        {!keyword && (
          <>
            <BayHero
              onPublishNeed={() => openCreate('client')}
              onBrowseResources={() => {
                setFeedType('provider');
                document.getElementById('home-feed-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
            />
            <div id="baybay-home-entry">
              <BayBayAssistantEntry
                variant="inline"
                onNavigate={navigate}
                onCreatePostClick={(opts) => openCreate(opts?.postType || 'client', opts?.category)}
                categoryHint={categorySlug}
              />
            </div>
            <div className="hidden md:block">
              <ChannelShortcuts onChannel={handleChannelClick} />
            </div>
            <HotRecommend
              onOpenPost={navigateToPost}
              refreshKey={featuredRefreshKey}
              onViewMore={() => navigate('/recommend')}
              onAskBayBay={() => document.getElementById('baybay-home-entry')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
              onPublish={() => openCreate('client')}
            />
          </>
        )}

        <div id="home-feed-section">
        <FeedSwitch feedType={feedType} onClient={() => setFeedType('client')} onProvider={() => setFeedType('provider')} />
        </div>

        <div className="hidden lg:flex gap-1.5 overflow-x-auto hide-scrollbar mb-2">{['全部', ...REGIONS].map(r => <FilterTag key={r} label={r === '全部' ? '全部地区' : r} active={regionFilter === r} onClick={() => setRegionFilter(r)} />)}</div>

        <div className="lg:hidden mb-1.5">
            <div className="flex gap-1.5 overflow-x-auto hide-scrollbar -mx-1 px-1"><FilterTag label="全部" active={regionFilter === '全部'} onClick={() => setRegionFilter('全部')} />{REGIONS.map(r => <FilterTag key={r} label={r} active={regionFilter === r} onClick={() => setRegionFilter(r)} />)}</div>
        </div>
        {/* 分类 chips 仅移动端展示；桌面端由左侧栏「探索分类」承担，避免重复 */}
        <div className="mb-2 lg:hidden">
            <div className="flex gap-1.5 overflow-x-auto hide-scrollbar -mx-1 px-1">
              <CategoryChip label="全部" active={categoryFilter==='全部'} onClick={() => navigateToCategory('全部')} />
              {CATEGORIES.map(c => <CategoryChip key={c} label={c} active={categoryFilter===c} onClick={() => navigateToCategory(c)} />)}
            </div>
        </div>

        {categorySlug && categoryFilter !== '全部' && !keyword && (
          <CategoryGuideStrip
            categorySlug={categorySlug}
            onOpenGuide={(slug) => navigate(`/guides/${slug}`)}
          />
        )}

        <div className="flex items-center justify-between mb-2 px-0.5">
          <h3 className="text-xs font-semibold text-baylink-text">社区动态</h3>
          <span className="text-[11px] text-baylink-muted">{feedType === 'provider' ? '本地资源' : '邻里需求'}</span>
        </div>

        {feedError && posts.length === 0 && !isInitialLoading ? (
          <div className="py-14 text-center space-y-4 px-4">
            <p className="text-sm text-baylink-text-secondary">加载失败，可能是网络较慢，请稍后重试。</p>
            <button type="button" onClick={retryFeed} className="rounded-xl bg-baylink-green px-5 py-2.5 text-sm font-semibold text-white shadow-rest hover:bg-baylink-green-hover active:scale-95 transition">重新加载</button>
          </div>
        ) : isInitialLoading && posts.length === 0 ? (
          <div>
            <FeedSkeleton count={4} />
            <p className="pb-3 pt-1 text-center text-[11px] text-baylink-muted/80">首次加载可能需要几秒钟，请稍候。</p>
          </div>
        ) : posts.length === 0 ? (
          <EmptyFeed
            feedType={feedType}
            keyword={keyword}
            onPublishService={() => openCreate('provider')}
            onPublishInfo={() => openCreate('client')}
            onOpenGuides={() => navigate('/guides')}
            onAskBayBay={() => setBaybayPanelOpen(true)}
          />
        ) : (
          <>
            {posts.map(p => <PostCard key={p.id} post={p} currentUser={user} onEdit={openEditPost} onDelete={handleDeletePost} onToggleFeature={handleToggleFeature} onReport={(post: PostData) => openReportTarget({ targetType: 'post', targetId: post.id, authorId: post.authorId })} onToggleBlockUser={handleToggleBlockUser} blockedUserIds={blockedUserIds} onClick={()=>navigateToPost(p)} onContactClick={()=>{if(!user)return setShowLogin(true); openChat(p.authorId, p.author.nickname);}} onAvatarClick={openUserProfile} onImageClick={(src:string) => setViewingImage(src)} onShare={(post: PostData) => setSharingPost(post)} onLike={handleToggleLike} />)}
            {!isInitialLoading && hasMore && <button onClick={handleLoadMore} disabled={isLoadingMore} className="w-full py-3 mt-3 bg-white text-baylink-text text-sm font-semibold rounded-2xl border border-baylink-border shadow-card hover:border-baylink-green/30 transition disabled:opacity-50">{isLoadingMore ? <Loader2 className="animate-spin mx-auto w-5 h-5 text-baylink-green"/> : '加载更多'}</button>}
            {!hasMore && (
              <div className="py-6 text-center">
                <p className="text-xs text-baylink-muted">已看完当前内容</p>
                <button
                  type="button"
                  onClick={() => navigate('/guides')}
                  className="mt-2 inline-flex items-center gap-1 rounded-lg border border-baylink-border/60 bg-white px-3 py-1.5 text-[11px] font-medium text-baylink-text-secondary transition hover:border-baylink-green/30 hover:text-baylink-green"
                >
                  <BookOpen size={12} /> 看看湾区生活指南
                </button>
              </div>
            )}
          </>
        )}

    </div>
  );
}
