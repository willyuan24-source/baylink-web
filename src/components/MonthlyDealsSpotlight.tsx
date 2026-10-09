import { ChevronRight, Ticket } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getGuideBySlug } from '../data/guides';
import { getGuideMedia } from '../data/guide-media';
import { useBayAreaToday } from '../lib/useBayAreaToday';
import { handleGuideLinkClick } from './GuideCard';
import { useLocale } from '../i18n/locale';
import { editionCoverageLabel } from '../lib/edition-label';
import { getImageProvenance } from '../lib/image-provenance';

export { GuideEditionNotice } from './GuideEditionNotice';

export const DEALS_SLUG = 'bay-area-freebies-deals-2026-11';

export function MonthlyDealsSpotlight({ today: suppliedToday, onOpenGuide }: { today?: string; onOpenGuide?: (slug: string) => void } = {}) {
  const today = useBayAreaToday(suppliedToday);
  const locale = useLocale();
  const guide = getGuideBySlug(DEALS_SLUG);
  if (!guide?.editionMonth) return null;
  const label = editionCoverageLabel(guide, locale);
  const archived = guide.editionThroughDate ? today > guide.editionThroughDate : today.slice(0, 7) > guide.editionMonth;
  const { cover } = getGuideMedia(guide);
  return <Link className={`bl-monthly-deals${archived ? ' bl-monthly-deals--archive' : ''}`} to={`/guides/${guide.slug}`} aria-label={`阅读${guide.title}`} onClick={onOpenGuide ? event => handleGuideLinkClick(event, () => onOpenGuide(guide.slug)) : undefined}>
    <div className="bl-monthly-deals-art"><img src={cover.src} srcSet={cover.srcSet} sizes="(max-width: 639px) 82px, 120px" width={cover.width} height={cover.height} alt="" loading="lazy" decoding="async" /><span>{cover.kind === 'illustration' ? 'AI 原创插图' : cover.kind === 'poster' ? '官方宣传图' : getImageProvenance(cover, locale === 'en')}</span></div>
    <div className="bl-monthly-deals-copy"><span className="bl-monthly-deals-eyebrow"><Ticket size={13} aria-hidden="true" />{label} · {archived ? '往期优惠攻略' : '优惠领取指南'}</span><h2>{guide.title}</h2><p>{archived ? '保留领取条件供回顾；往期内容不能当作实时优惠。' : '从十月零售活动到十一月免费日、亲子手作与长期福利，按日期、地区和条件挑。'}</p><span className="bl-monthly-deals-checked">核对 <time dateTime={guide.updatedAt}>{guide.updatedAt}</time></span></div>
    <span className="bl-monthly-deals-action">{archived ? '查看往期' : '看看怎么领'}<ChevronRight size={18} aria-hidden="true" /></span>
  </Link>;
}
