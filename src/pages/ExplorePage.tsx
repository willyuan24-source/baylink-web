import { AttractionExplorer } from '../components/AttractionExplorer';
import { useApp } from '../app/context';
import { Link } from 'react-router-dom';
import { useLocale } from '../i18n/locale';
import '../styles/attractions.css';

export default function ExplorePage() {
  const { openBayBay } = useApp();
  const locale = useLocale();
  return <><Link to="/together" className="member-menu-row"><strong>{locale === 'en' ? 'Go together' : locale === 'zh-Hant' ? '找搭子，一起出門' : '找搭子，一起出门'}</strong><span>{locale === 'en' ? 'Choose a day · Join a small group' : locale === 'zh-Hant' ? '選一天 · 約一支小隊' : '选一天 · 约一支小队'} ↗</span></Link><AttractionExplorer onAsk={openBayBay} /></>;
}
