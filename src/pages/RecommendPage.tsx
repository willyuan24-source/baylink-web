// 推荐页：编辑专题、精选帖子与推广信息，保留原有广告和管理行为。
import { Sparkles, Megaphone } from 'lucide-react';
import { useApp } from '../app/context';
import { FeaturedPostsSection } from '../features/home/HomeSections';
import { OfficialAds } from '../features/ads/OfficialAds';
import { EditorialCollections } from '../components/EditorialCollections';
import { MonthlySpotlight } from '../components/MonthlySpotlight';

export default function RecommendPage() {
  const {
    user, showToast, navigateToPost, featuredRefreshKey, handleToggleFeature,
    openUserProfile, handleToggleLike, openAdDetail, adsRefreshKey,
  } = useApp();

  return (
    <div className="editorial-recommend-page">
      <header className="editorial-recommend-heading">
        <span className="editorial-collections__eyebrow">SELECTED FOR LOCAL LIFE</span>
        <h1>值得了解的，放在这里。</h1>
        <p>从主题指南到邻里信息，为你的湾区生活提供一些参考。编辑精选与推广信息不代表资质认证或交易担保，联系前请核实详情。</p>
      </header>
      <EditorialCollections />
      <MonthlySpotlight />
      <section className="editorial-recommend-section" aria-label="编辑精选帖子">
        <div className="editorial-recommend-section__heading"><h2><Sparkles size={20} aria-hidden="true" />编辑精选帖子</h2><p>编辑选择展示的社区信息，请联系发布者确认当前状态。</p></div>
        <FeaturedPostsSection onOpenPost={navigateToPost} refreshKey={featuredRefreshKey} compact currentUser={user} onToggleFeature={handleToggleFeature} onOpenProfile={openUserProfile} onLike={handleToggleLike} />
      </section>
      <section className="editorial-recommend-section" aria-label="推广信息">
        <div className="editorial-recommend-section__heading"><h2><Megaphone size={20} aria-hidden="true" />推广信息</h2><p>本地服务与商业推广。展示不代表平台对服务资质、实际效果或交易安全作出保证。</p></div>
        <div className="editorial-recommend-ad-list"><OfficialAds isAdmin={user?.role === 'admin'} showToast={showToast} onOpenDetail={openAdDetail} refreshKey={adsRefreshKey} layout="list" /></div>
      </section>
    </div>
  );
}
