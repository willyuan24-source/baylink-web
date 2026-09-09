import { useEffect, useState } from 'react';
import { ArrowUpRight, CalendarDays } from 'lucide-react';
import { Link } from 'react-router-dom';
import { MONTHLY_EDITION, MONTHLY_EVENTS, MONTHLY_PLACES } from '../data/monthly-edition';
import { GUIDE_IMAGES } from '../data/guide-media';
import { getBayAreaToday, getEventStatus, isEditionCurrent } from '../lib/monthly';

export function MonthlySpotlight({ today: suppliedToday, compact = false }: { today?: string; compact?: boolean } = {}) {
  const [localToday, setLocalToday] = useState(getBayAreaToday);
  useEffect(() => {
    const refresh = () => setLocalToday(getBayAreaToday());
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, []);
  const today = suppliedToday || localToday;
  const current = isEditionCurrent(today);
  const count = current ? MONTHLY_EVENTS.filter(event => getEventStatus(event, today) !== 'ended').length : MONTHLY_EVENTS.length;
  const image = GUIDE_IMAGES['september-edition'];
  return <Link className={`bl-monthly-spotlight${compact ? ' bl-monthly-spotlight-compact' : ''}`} to="/this-month" aria-label={`阅读${MONTHLY_EDITION.label}湾区月刊`}><div className="bl-monthly-spotlight-art"><img src={image.src} srcSet={image.srcSet} sizes="(max-width: 639px) 110px, 230px" width={image.width} height={image.height} alt="" loading="lazy" decoding="async" /><span>AI 原创插图</span></div><div className="bl-monthly-spotlight-copy"><span className="bl-monthly-eyebrow"><CalendarDays size={13} aria-hidden="true" />{MONTHLY_EDITION.label} · {current ? '本月精选' : '往期精选'}</span><h2>{current ? '把这个月，过得有点不一样。' : '翻翻这期，留一点出游灵感。'}</h2><p>{current ? `${count} 场可赴的活动，${MONTHLY_PLACES.length} 个慢游提案。花园、街区与海岸，总有一个值得出门的理由。` : `${MONTHLY_EDITION.label} 的活动记录与去处推荐。往期活动以记录为主，最新安排请查主办方。`}</p><span className="bl-monthly-spotlight-link">打开湾区月刊 <ArrowUpRight size={15} aria-hidden="true" /></span></div><span className="bl-monthly-spotlight-number" aria-hidden="true">{MONTHLY_EDITION.month.slice(-2)}</span></Link>;
}
