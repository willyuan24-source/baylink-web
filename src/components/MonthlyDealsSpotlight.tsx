import { useEffect, useState } from 'react';
import { ArrowUpRight, CalendarDays, Ticket } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getGuideBySlug } from '../data/guides';
import { getGuideMedia } from '../data/guide-media';
import { getBayAreaToday } from '../lib/monthly';
import { handleGuideLinkClick } from './GuideCard';

const DEALS_SLUG = 'bay-area-freebies-deals-2026-09';
const monthLabel = (month: string) => `${month.slice(0, 4)} 年 ${Number(month.slice(5, 7))} 月`;

function useBayAreaToday(suppliedToday?: string) {
  const [localToday, setLocalToday] = useState(getBayAreaToday);
  useEffect(() => {
    const refresh = () => setLocalToday(getBayAreaToday());
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
      window.clearInterval(timer);
    };
  }, []);
  return suppliedToday || localToday;
}

export function MonthlyDealsSpotlight({ today: suppliedToday, onOpenGuide }: { today?: string; onOpenGuide?: (slug: string) => void } = {}) {
  const today = useBayAreaToday(suppliedToday);
  const guide = getGuideBySlug(DEALS_SLUG);
  if (!guide?.editionMonth) return null;
  const label = monthLabel(guide.editionMonth);
  const archived = today.slice(0, 7) > guide.editionMonth;
  const { cover } = getGuideMedia(guide);
  return <Link className={`bl-monthly-deals${archived ? ' bl-monthly-deals--archive' : ''}`} to={`/guides/${guide.slug}`} aria-label={`阅读${guide.title}`} onClick={onOpenGuide ? event => handleGuideLinkClick(event, () => onOpenGuide(guide.slug)) : undefined}>
    <div className="bl-monthly-deals-art"><img src={cover.src} srcSet={cover.srcSet} sizes="(max-width: 639px) 82px, 120px" width={cover.width} height={cover.height} alt="" loading="lazy" decoding="async" /><span>{cover.kind === 'illustration' ? 'AI 原创插图' : cover.kind === 'poster' ? '官方宣传图' : '实景照片'}</span></div>
    <div className="bl-monthly-deals-copy"><span className="bl-monthly-deals-eyebrow"><Ticket size={13} aria-hidden="true" />{label} · {archived ? '往期优惠攻略' : '优惠领取指南'}</span><h2>{guide.title}</h2><p>{archived ? '保留领取条件供回顾；往期内容不能当作实时优惠。' : '从免费小蛋糕到 $1 冷萃，连同 Target、亲子手工和会员折扣，按日期与条件挑。'}</p><span className="bl-monthly-deals-checked">核对 <time dateTime={guide.updatedAt}>{guide.updatedAt}</time></span></div>
    <span className="bl-monthly-deals-action">{archived ? '查看往期' : '看看怎么领'}<ArrowUpRight size={18} aria-hidden="true" /></span>
  </Link>;
}

export function GuideEditionNotice({ editionMonth, checkedAt, today: suppliedToday }: { editionMonth: string; checkedAt: string; today?: string }) {
  const today = useBayAreaToday(suppliedToday);
  const archived = today.slice(0, 7) > editionMonth;
  const label = monthLabel(editionMonth);
  return <aside className={`bl-guide-edition-notice${archived ? ' bl-guide-edition-notice--archive' : ''}`} aria-label="攻略期次与核对日期">
    <CalendarDays size={21} aria-hidden="true" /><div><strong>{archived ? `往期攻略 · ${label}` : `${label} · 本期攻略`}</strong><p>{archived ? '这篇攻略记录的是该月份核对的优惠，不能当作实时优惠。活动可能已结束或条件已变更，领取前请查看品牌官网和门店说明。' : '这篇攻略按本期资料整理。优惠有领取条件与有效期，是否可领请以品牌官方页面和参与门店为准。'}</p><span>核对日期：<time dateTime={checkedAt}>{checkedAt}</time> · 月份按湾区当地时间判断</span></div>
  </aside>;
}
