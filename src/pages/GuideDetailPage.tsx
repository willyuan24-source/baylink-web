// 指南详情页
import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../app/context';
import { GuideDetail } from '../components/GuideDetail';
import { getGuideBySlug } from '../data/guides';
import { getCategoryFromSlug } from '../routing';
import NotFoundPage from './NotFoundPage';
import { setPageMetadata } from '../lib/seo';
import { getGuideMetadata } from '../lib/guide-metadata';

export default function GuideDetailPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const savedLibrary = location.state?.guideLibrary;
  const returnTo = typeof savedLibrary === 'string' && /^\/guides(?:\?[^#]*)?$/.test(savedLibrary) ? savedLibrary : '/guides';
  const { slug } = useParams();
  const { user, setShowLogin, openCreate, openBayBay } = useApp();
  const [pendingPost, setPendingPost] = useState<{ type: 'client' | 'provider'; categorySlug: string } | null>(null);

  useEffect(() => {
    if (!user || !pendingPost) return;
    const category = getCategoryFromSlug(pendingPost.categorySlug);
    setPendingPost(null);
    openCreate(pendingPost.type, category === '全部' ? undefined : category);
  }, [user, pendingPost, openCreate]);

  useEffect(() => {
    const guide = slug ? getGuideBySlug(slug) : undefined;
    if (guide) setPageMetadata(getGuideMetadata(guide));
  }, [slug]);

  const navigateBack = () => {
    navigate(returnTo);
  };

  if (!slug || !getGuideBySlug(slug)) return <NotFoundPage />;
  return (
    <GuideDetail
      slug={slug}
      returnTo={returnTo}
      onBack={navigateBack}
      onOpenGuide={(next) => navigate(`/guides/${next}`, { state: { guideLibrary: returnTo } })}
      onNavigate={navigate}
      onAsk={openBayBay}
      onOpenPost={({ type, categorySlug }) => {
        if (!user) { setPendingPost({ type, categorySlug }); setShowLogin(true); return; }
        const category = getCategoryFromSlug(categorySlug);
        openCreate(type, category === '全部' ? undefined : category);
      }}
    />
  );
}
