// 湾区指南首页
import { useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../app/context';
import { GuidesHome } from '../components/GuidesHome';

export default function GuidesPage() {
  const navigate = useNavigate();
  const { openBayBay, openSearch } = useApp();
  const location = useLocation();
  return <GuidesHome onAsk={openBayBay} onSearch={openSearch} onOpenGuide={(slug) => navigate(`/guides/${slug}`, { state: { guideLibrary: `/guides${location.search}` } })} />;
}
