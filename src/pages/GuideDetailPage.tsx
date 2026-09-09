// 指南详情页
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../app/context';
import { GuideDetail } from '../components/GuideDetail';
import { getGuideBySlug } from '../data/guides';
import { getCategoryFromSlug } from '../routing';
import NotFoundPage from './NotFoundPage';
import { setPageMetadata } from '../lib/seo';

export default function GuideDetailPage() {
  const navigate = useNavigate();
  const { slug } = useParams();
  const { user, setShowLogin, openCreate } = useApp();
  const [pendingPost, setPendingPost] = useState<{ type: 'client' | 'provider'; categorySlug: string } | null>(null);

  useEffect(() => {
    if (!user || !pendingPost) return;
    const category = getCategoryFromSlug(pendingPost.categorySlug);
    setPendingPost(null);
    openCreate(pendingPost.type, category === '全部' ? undefined : category);
  }, [user, pendingPost, openCreate]);

  useEffect(() => {
    const guide = slug ? getGuideBySlug(slug) : undefined;
    if (guide) setPageMetadata({ title: `${guide.title}｜BAYLINK`, description: guide.summary, path: `/guides/${guide.slug}`, image: guide.cover, type: 'article' });
  }, [slug]);

  const navigateBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/');
  };

  if (!slug || !getGuideBySlug(slug)) return <NotFoundPage />;
  return (
    <GuideDetail
      slug={slug}
      onBack={navigateBack}
      onOpenGuide={(next) => navigate(`/guides/${next}`)}
      onNavigate={navigate}
      onOpenPost={({ type, categorySlug }) => {
        if (!user) { setPendingPost({ type, categorySlug }); setShowLogin(true); return; }
        const category = getCategoryFromSlug(categorySlug);
        openCreate(type, category === '全部' ? undefined : category);
      }}
    />
  );
}
