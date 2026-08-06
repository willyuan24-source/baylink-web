// 湾区指南首页
import { useNavigate } from 'react-router-dom';
import { GuidesHome } from '../components/GuidesHome';

export default function GuidesPage() {
  const navigate = useNavigate();
  return <GuidesHome onOpenGuide={(slug) => navigate(`/guides/${slug}`)} />;
}
