// 指南详情页
import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../app/context';
import { GuideDetail } from '../components/GuideDetail';
import { ErrorState } from '../components/ui/States';
import { useUiCopy } from '../components/ui/ui-copy';
import { getCategoryFromSlug } from '../routing';
import NotFoundPage from './NotFoundPage';
import { setPageMetadata } from '../lib/seo';
import { readGuide, retryGuide } from '../features/guides/guide-store';

export default function GuideDetailPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const savedLibrary = location.state?.guideLibrary;
  const returnTo = typeof savedLibrary === 'string' && /^\/guides(?:\?[^#]*)?$/.test(savedLibrary) ? savedLibrary : '/guides';
  const { slug } = useParams();
  const { user, setShowLogin, openCreate, openBayBay } = useApp();
  const { t } = useUiCopy();
  const [pendingPost, setPendingPost] = useState<{ type: 'client' | 'provider'; categorySlug: string } | null>(null);
  const [, setAttempt] = useState(0);
  // The guide's own record (WEB-DATA-SPLIT): loaded with the page at boot (route-loaders.ts), else suspends until it is in.
  const { record, missing, failed } = readGuide(slug);

  useEffect(() => {
    if (!user || !pendingPost) return;
    const category = getCategoryFromSlug(pendingPost.categorySlug);
    setPendingPost(null);
    openCreate(pendingPost.type, category === '全部' ? undefined : category);
  }, [user, pendingPost, openCreate]);

  useEffect(() => {
    if (record) setPageMetadata(record.metadata);
  }, [record]);

  const navigateBack = () => {
    navigate(returnTo);
  };

  if (!slug || missing) return <NotFoundPage />;
  if (failed || !record) return <div className="gd-page"><ErrorState title={t('这篇指南暂时没能加载', 'This guide didn’t load')}
    onRetry={() => { retryGuide(slug); setAttempt(count => count + 1); }} /></div>;
  // "这条信息有误？" sits in the article's source list (GuideDetail).
  return (
    <GuideDetail
      slug={slug}
      record={record}
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
