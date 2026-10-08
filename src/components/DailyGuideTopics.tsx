import { ArrowRight, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { DAILY_GUIDE_TOPICS } from '../data/daily-guide-topics';
import { handleGuideLinkClick } from './GuideCard';
import { EnglishOnly } from './EnglishOnly';

export function DailyGuideTopics({ onOpenGuide }: { onOpenGuide: (slug: string) => void }) {
  return <section className="daily-guide-topics" aria-labelledby="daily-guide-title">
    <div className="daily-guide-heading">
      <div><EnglishOnly><span className="bl-guide-eyebrow">EVERYDAY ESSENTIALS</span></EnglishOnly><h2 id="daily-guide-title">日常办事速查</h2><p>从停车缴费到学英语，把入口和步骤先找齐。</p></div>
      <Link to="/guides?q=日常办事">查看全部 <ArrowRight size={15} aria-hidden="true" /></Link>
    </div>
    <div className="daily-guide-grid">
      {DAILY_GUIDE_TOPICS.map((topic, index) => <Link key={topic.slug} to={`/guides/${topic.slug}`} onClick={event => handleGuideLinkClick(event, () => onOpenGuide(topic.slug))}>
        <span className="daily-guide-number">{String(index + 1).padStart(2, '0')}</span><span><h3>{topic.label}</h3><p>{topic.text}</p></span><ChevronRight size={17} aria-hidden="true" />
      </Link>)}
    </div>
  </section>;
}
