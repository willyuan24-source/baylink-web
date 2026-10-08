import { ArrowRight, ChevronRight, GraduationCap } from 'lucide-react';
import { EnglishOnly } from './EnglishOnly';
import { Link } from 'react-router-dom';
import { getGuideBySlug } from '../data/guides';
import { getGuideMedia } from '../data/guide-media';
import { handleGuideLinkClick } from './GuideCard';
import { SCHOOL_REGIONS } from '../data/school-regions';



export function SchoolGuideTopics({ onOpenGuide }: { onOpenGuide: (slug: string) => void }) {
  return <section className="school-guide-topics" aria-labelledby="school-guide-title">
    <div className="school-guide-heading"><div><EnglishOnly><span className="bl-guide-eyebrow"><GraduationCap size={17} aria-hidden="true" /> SCHOOLS & CAMPUS LIFE</span></EnglishOnly><h2 id="school-guide-title">学校与学区，从所在地区开始。</h2><p>K–12 入学、学区核验、转学步骤，以及大学和社区学院入口。</p></div><Link to="/guides?category=education">学校专题 <ArrowRight size={15} aria-hidden="true" /></Link></div>
    <div className="school-guide-grid">{SCHOOL_REGIONS.map(region => {
      const guide = getGuideBySlug(region.slug);
      if (!guide) return null;
      const image = getGuideMedia(guide).cover;
      return <Link key={region.slug} to={`/guides/${region.slug}`} onClick={event => handleGuideLinkClick(event, () => onOpenGuide(region.slug))}>
        <img src={image.src} srcSet={image.srcSet} sizes="(max-width:599px) 90vw, (max-width:1023px) 45vw, 240px" width={image.width} height={image.height} alt={image.alt} loading="lazy" />
        <span><strong>{region.label}<ChevronRight size={16} aria-hidden="true" /></strong><small>{region.note}</small></span>
      </Link>;
    })}</div>
    <p className="school-guide-note">AI 原创主题插图 · 不代表实际学校。学区边界、录取和学年安排请通过文中官方入口核验。</p>
  </section>;
}
