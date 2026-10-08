import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { FIRST_VISIT_PATHS } from '../data/first-visit-paths';
import { handleGuideLinkClick } from './GuideCard';

export function FirstVisitStart({ onOpenGuide }: { onOpenGuide: (slug: string) => void }) {
  return <section className="daily-guide-topics" aria-labelledby="first-visit-title">
    <div className="daily-guide-heading"><div>
      <span className="bl-guide-eyebrow">YOUR FIRST DAYS IN THE BAY</span>
      <h2 id="first-visit-title">第一次来，从这里开始</h2>
      <p>短住几天，或准备安家，按眼前要做的事一步步看。</p>
      <p>十月更新 · 每篇附核对日期与官方来源</p>
    </div></div>
    <div className="daily-guide-grid">{FIRST_VISIT_PATHS.map((path, index) => <Link key={path.slug} to={`/guides/${path.slug}`} onClick={event => handleGuideLinkClick(event, () => onOpenGuide(path.slug))}>
      <span className="daily-guide-number">0{index + 1}</span>
      <span><h3>{path.label}</h3><p>{path.text}</p></span>
      <ChevronRight size={17} aria-hidden="true" />
    </Link>)}</div>
  </section>;
}
