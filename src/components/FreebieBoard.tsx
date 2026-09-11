import { useEffect, useId, useState } from 'react';
import { ArrowUpRight, CalendarDays, ChevronDown, Expand, Gift, MapPin, Ticket } from 'lucide-react';
import { GUIDE_IMAGES } from '../data/guide-media';
import { getBayAreaToday } from '../lib/monthly';
import { GuideImageLightbox } from './GuideVisuals';

export type FreebieOffer = {
  id: string;
  brand: string;
  title: string;
  dateLabel: string;
  startDate?: string;
  endDate?: string;
  availability: 'dated' | 'ongoing' | 'check-local';
  kind: 'no-purchase' | 'reservation' | 'purchase';
  requirement: string;
  description: string;
  imageKey: string;
  sourceUrl: string;
  sourceLabel: string;
  storeUrl?: string;
  imageNote?: string;
};

type OfferFilter = 'all' | FreebieOffer['kind'];
const FILTERS: { value: OfferFilter; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'no-purchase', label: '无需购物' },
  { value: 'reservation', label: '需预约' },
  { value: 'purchase', label: '消费优惠' },
];
const KIND_LABELS = { 'no-purchase': '无需购物', reservation: '需预约', purchase: '需消费' };
const safeUrl = (value?: string): value is string => {
  if (!value) return false;
  try { return ['https:', 'http:'].includes(new URL(value).protocol); } catch { return false; }
};
const validDate = (value?: string): value is string => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().startsWith(value);
};
function dateRange(offer: FreebieOffer): [string, string] | null {
  const start = offer.startDate || offer.endDate;
  const end = offer.endDate || offer.startDate;
  return validDate(start) && validDate(end) && start <= end ? [start, end] : null;
}
const nextMonth = (today: string) => {
  const first = new Date(`${today.slice(0, 7)}-01T12:00:00Z`);
  first.setUTCMonth(first.getUTCMonth() + 1);
  return first.toISOString().slice(0, 7);
};
function offerStatus(offer: FreebieOffer, today: string) {
  if (offer.availability === 'check-local') return { key: 'local', label: '查本店场次' };
  if (offer.availability === 'ongoing') return { key: 'ongoing', label: '长期福利' };
  const range = dateRange(offer);
  if (!range) return { key: 'unverified', label: '日期待核对' };
  if (range[1] < today) return { key: 'ended', label: '已结束' };
  if (range[0].slice(0, 7) === nextMonth(today)) return { key: 'preview', label: '下月预告' };
  return range[0] > today ? { key: 'upcoming', label: '即将开始' } : { key: 'active', label: '有效期内' };
}

function orderedOffers(offers: FreebieOffer[], today: string) {
  const position = (offer: FreebieOffer): [number, string] => {
    if (offer.availability === 'ongoing') return [1, ''];
    const range = offer.availability === 'dated' ? dateRange(offer) : null;
    if (!range) return [2, ''];
    return [range[1] < today ? 3 : 0, range[0]];
  };
  return [...offers].sort((left, right) => {
    const [leftGroup, leftDate] = position(left);
    const [rightGroup, rightDate] = position(right);
    return leftGroup - rightGroup || leftDate.localeCompare(rightDate);
  });
}

function FreebieCard({ offer, today }: { offer: FreebieOffer; today: string }) {
  const [zoomed, setZoomed] = useState(false);
  const headingId = useId();
  const image = GUIDE_IMAGES[offer.imageKey];
  const status = offerStatus(offer, today);
  const pictureLabel = image?.kind === 'poster' ? '官方宣传图' : image?.kind === 'illustration' ? 'AI 原创插图' : image?.credit.includes('官方') ? '官方宣传照片' : image?.caption.includes('资料') ? '资料照片' : '实景照片';
  return <article id={`offer-${offer.id}`} className={`bl-freebie-card bl-freebie-card--${status.key}`} aria-labelledby={headingId}>
    <div className="bl-freebie-card-brand"><strong>{offer.brand}</strong><Ticket size={16} aria-hidden="true" /></div>
    {image ? <figure className="bl-freebie-picture">
      <button type="button" className={`bl-freebie-picture-open${image.kind === 'poster' || image.fullFrame ? ' bl-freebie-picture-open--contain' : ''}`} onClick={() => setZoomed(true)} aria-label={`放大${offer.brand}配图：${image.alt}`} aria-haspopup="dialog">
        <img src={image.src} srcSet={image.srcSet} sizes="(max-width: 479px) calc(100vw - 40px), (max-width: 639px) calc((100vw - 54px) / 2), (min-width: 1280px) 260px, 360px" alt={image.alt} width={image.width} height={image.height} loading="lazy" decoding="async" />
        <span className="bl-freebie-picture-zoom"><Expand size={13} aria-hidden="true" /><span className="sr-only">查看大图</span></span>
      </button>
      <figcaption>{pictureLabel}{offer.imageNote && <span> · {offer.imageNote}</span>}</figcaption>
    </figure> : <div className="bl-freebie-picture-missing"><Gift size={28} aria-hidden="true" /><span>配图整理中</span></div>}
    <div className="bl-freebie-card-body">
      <div className="bl-freebie-card-date"><CalendarDays size={14} aria-hidden="true" /><span>{offer.dateLabel}</span></div>
      <div className="bl-freebie-card-tags"><span className={`bl-freebie-kind bl-freebie-kind--${offer.kind}`}>{KIND_LABELS[offer.kind]}</span><span className={`bl-freebie-status bl-freebie-status--${status.key}`}>{status.label}</span></div>
      <h3 id={headingId}>{offer.title}</h3>
      <p className="bl-freebie-requirement"><strong>领取条件</strong>{offer.requirement}</p>
      <p className="bl-freebie-description">{offer.description}</p>
      <div className="bl-freebie-card-actions">
        {safeUrl(offer.sourceUrl) && <a href={offer.sourceUrl} target="_blank" rel="noopener noreferrer" aria-label={`${offer.brand}：${offer.sourceLabel}`}>官方入口<ArrowUpRight size={15} aria-hidden="true" /></a>}
        {safeUrl(offer.storeUrl) && <a href={offer.storeUrl} target="_blank" rel="noopener noreferrer" aria-label={`${offer.brand}：查询本地门店`}><MapPin size={13} aria-hidden="true" />本地门店</a>}
      </div>
      {image && <details className="bl-freebie-image-source"><summary>图片说明与来源<ChevronDown size={12} aria-hidden="true" /></summary><p>{image.caption}</p>{safeUrl(image.creditUrl) ? <a href={image.creditUrl} target="_blank" rel="noopener noreferrer">{image.credit}</a> : <span>{image.credit}</span>}{safeUrl(image.licenseUrl) && <a href={image.licenseUrl} target="_blank" rel="noopener noreferrer">查看图片授权</a>}</details>}
    </div>
    {zoomed && image && <GuideImageLightbox image={image} onClose={() => setZoomed(false)} />}
  </article>;
}

export function FreebieBoard({ offers, today: suppliedToday, title = '先看条件，再挑一份小惊喜。', description = '一张卡看懂日期、门槛和官方入口。' }: { offers: FreebieOffer[]; today?: string; title?: string; description?: string }) {
  const [filter, setFilter] = useState<OfferFilter>('all');
  const [localToday, setLocalToday] = useState(getBayAreaToday);
  const headingId = useId();
  useEffect(() => {
    const refresh = () => setLocalToday(getBayAreaToday());
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);
  const today = suppliedToday || localToday;
  const month = today.slice(0, 7);
  const confirmed = offers.filter(offer => {
    const range = dateRange(offer);
    return offer.availability === 'dated' && range && range[1] >= today && range[0].slice(0, 7) <= month && range[1].slice(0, 7) >= month;
  }).length;
  const ongoing = offers.filter(offer => offer.availability === 'ongoing').length;
  const local = offers.filter(offer => offer.availability === 'check-local').length;
  const previews = offers.filter(offer => offer.availability === 'dated' && dateRange(offer)?.[0].slice(0, 7) === nextMonth(today)).length;
  const stats = [
    { value: confirmed, label: '本月已确认' },
    ...ongoing ? [{ value: ongoing, label: '长期福利' }] : [],
    ...previews ? [{ value: previews, label: '下月预告' }] : [],
    ...local ? [{ value: local, label: '需查本店' }] : [],
  ];
  const visible = orderedOffers(offers, today).filter(offer => filter === 'all' || offer.kind === filter);
  return <section className="bl-freebie-board" aria-labelledby={headingId}>
    <header className="bl-freebie-board-heading"><span><Gift size={16} aria-hidden="true" />BAYLINK · LITTLE PERKS</span><h2 id={headingId}>{title}</h2>{description && <p>{description}</p>}</header>
    <div className="bl-freebie-board-stats" aria-label="领取信息概况" style={{ gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))` }}>{stats.map(item => <span key={item.label}><strong>{item.value}</strong>{item.label}</span>)}</div>
    <p className="bl-freebie-board-count-note">本月已确认仅计入有效期明确、尚未结束的条目；下月预告与待查场次分列。</p>
    <div className="bl-freebie-filters" role="group" aria-label="按领取条件筛选">{FILTERS.map(item => <button key={item.value} type="button" aria-pressed={filter === item.value} onClick={() => setFilter(item.value)}>{item.label}</button>)}</div>
    <p className="bl-freebie-results" role="status" aria-live="polite">显示 {visible.length} 项 · 日期按湾区当地时间</p>
    {visible.length ? <div className="bl-freebie-grid">{visible.map(offer => <FreebieCard key={`${offer.id}:${offer.imageKey}`} offer={offer} today={today} />)}</div> : <div className="bl-freebie-empty"><Gift size={24} aria-hidden="true" /><p>{offers.length ? '这个条件下暂时没有条目，换个条件看看。' : '这期领取信息正在整理。'}</p>{filter !== 'all' && <button type="button" onClick={() => setFilter('all')}>查看全部</button>}</div>}
  </section>;
}
