// 推荐页：热门推荐（精选帖）+ 官方推荐（广告）
import { Sparkles, BadgeCheck } from 'lucide-react';
import { useApp } from '../app/context';
import { FeaturedPostsSection } from '../features/home/HomeSections';
import { OfficialAds } from '../features/ads/OfficialAds';

export default function RecommendPage() {
  const {
    user, showToast, navigateToPost, featuredRefreshKey, handleToggleFeature,
    openUserProfile, handleToggleLike, openAdDetail, adsRefreshKey,
  } = useApp();

  return (
    <div className="flex flex-col h-full w-full pb-[calc(env(safe-area-inset-bottom,0px)+6rem)] lg:pb-0">
      <div className="px-5 pt-safe-top pb-3 bg-baylink-bg/95 backdrop-blur-sm sticky top-0 z-10 border-b border-baylink-border/40">
        <h2 className="text-lg font-bold text-baylink-text">推荐</h2>
        <p className="text-[11px] text-baylink-muted mt-0.5 leading-relaxed">热门推荐为精选帖子，官方推荐为认证服务与广告</p>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <h3 className="mb-2 flex items-center gap-1 text-sm font-bold text-baylink-text"><Sparkles size={14} className="text-baylink-green" /> 热门推荐</h3>
        <FeaturedPostsSection onOpenPost={navigateToPost} refreshKey={featuredRefreshKey} compact currentUser={user} onToggleFeature={handleToggleFeature} onOpenProfile={openUserProfile} onLike={handleToggleLike} />
        <h3 className="mb-2 mt-2 flex items-center gap-1 text-sm font-bold text-baylink-text"><BadgeCheck size={14} className="text-baylink-green" /> 官方推荐</h3>
        <OfficialAds isAdmin={user?.role === 'admin'} showToast={showToast} onOpenDetail={openAdDetail} refreshKey={adsRefreshKey} layout="list" />
      </div>
    </div>
  );
}
