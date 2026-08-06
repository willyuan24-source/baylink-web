// 指南详情页
import { useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../app/context';
import { GuideDetail } from '../components/GuideDetail';

export default function GuideDetailPage() {
  const navigate = useNavigate();
  const { slug } = useParams();
  const { user, setShowLogin, openCreate } = useApp();

  const navigateBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/');
  };

  if (!slug) return null;
  return (
    <GuideDetail
      slug={slug}
      onBack={navigateBack}
      onOpenGuide={(next) => navigate(`/guides/${next}`)}
      onNavigate={navigate}
      onOpenPost={() => {
        if (!user) { setShowLogin(true); return; }
        openCreate('client');
      }}
    />
  );
}
