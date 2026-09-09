// 湾区指南首页
import { useLocation, useNavigate } from 'react-router-dom';
import { GuidesHome } from '../components/GuidesHome';

export default function GuidesPage() {
  const navigate = useNavigate();
  const location = useLocation();
  return <GuidesHome onOpenGuide={(slug) => navigate(`/guides/${slug}`, { state: { guideLibrary: `/guides${location.search}` } })} />;
}
