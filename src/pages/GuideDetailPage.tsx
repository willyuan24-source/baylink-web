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
import { LazyReportErrorLink } from '../features/feedback/LazyEntryLinks';

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

  const guide = slug ? getGuideBySlug(slug) : undefined;
  if (!slug || !guide) return <NotFoundPage />;
  // "这条信息有误？" sits after the article until WEB-GUIDES moves it next to the sources (GuideDetail is its file).
  return (<>
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
    <LazyReportErrorLink key={`report-guide-${slug}`} className="feedback-report-row--guide" entity={{ kind: 'guide', id: slug }} title={guide.title} />
  </>);
}
