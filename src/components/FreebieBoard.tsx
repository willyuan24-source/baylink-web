import { useEffect, useId, useRef, useState } from 'react';
import { EnglishOnly } from './EnglishOnly';
import { ArrowUpRight, CalendarDays, ChevronDown, Expand, Gift, MapPin, Ticket } from 'lucide-react';
import { getOfferImage } from '../lib/offer-media';
import { getBayAreaToday } from '../lib/monthly';
import { GuideImageLightbox } from './GuideVisuals';
import { getImageProvenance } from '../lib/image-provenance';
import { EditorialShareActions } from './EditorialShareActions';
import { offerShare } from '../lib/editorial-share';
import { SaveToWeek } from './SaveToWeek';
import { PhoneText } from '../lib/phone-links';
import { dateRange, validDate, validThisWeek, weekEndOf } from '../lib/offer-week';
import type { EditorialStatus, MonthlyRegion } from '../data/monthly-types';
import { simplifySearch, translateText, useLocale } from '../i18n/locale';

export type FreebieOffer = {
  id: string;
  region?: MonthlyRegion;
  verifiedAt?: string;
  brand: string;
  title: string;
  dateLabel: string;
  startDate?: string;
  endDate?: string;
  /** Published recurring days, using 0 = Sunday through 6 = Saturday. */
  weekdays?: (0 | 1 | 2 | 3 | 4 | 5 | 6)[];
  availability: 'dated' | 'ongoing' | 'check-local';
  verificationStatus?: 'needs-confirmation';
  /** From the editorial overlay (`OfferEditorial.status`): `sold_out` means nothing is on sale right now. */
  status?: EditorialStatus;
  kind: 'no-purchase' | 'reservation' | 'purchase' | 'check-terms';
  requirement: string;
  description: string;
  imageKey: string;
  sourceUrl: string;
  sourceLabel: string;
  storeUrl?: string;
  imageNote?: string;
};

type OfferFilter = 'all' | FreebieOffer['kind'];
type DateWindow = 'week' | 'all';
const FILTERS: { value: OfferFilter; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'no-purchase', label: '无需购物' },
  { value: 'reservation', label: '需预约' },
  { value: 'purchase', label: '消费优惠' },
  { value: 'check-terms', label: '条件待核对' },
];
const KINDS = FILTERS.filter((item): item is { value: FreebieOffer['kind']; label: string } => item.value !== 'all');
const KIND_LABELS = { 'no-purchase': '无需购物', reservation: '需预约', purchase: '需消费', 'check-terms': '条件待核对' };
/** G26: a long board opens on six cards per kind, each kind with its own 看全部 N 条. */
export const FREEBIE_SECTION_SIZE = 6;
const searchText = (value: string) => simplifySearch(value).toLowerCase().replace(/[‘’']/g, '');
const safeUrl = (value?: string): value is string => {
  if (!value) return false;
  try { return ['https:', 'http:'].includes(new URL(value).protocol); } catch { return false; }
};
const nextMonth = (today: string) => {
  const first = new Date(`${today.slice(0, 7)}-01T12:00:00Z`);
  first.setUTCMonth(first.getUTCMonth() + 1);
  return first.toISOString().slice(0, 7);
};

function offerStatus(offer: FreebieOffer, today: string, english: boolean) {
  if (offer.verificationStatus === 'needs-confirmation') return { key: 'unverified', label: '当前优惠待确认' };
  // The overlay's word wins over the source dates: a sold-out batch is not 限量供应 · 查询余票 (its date label says what is next).
  if (offer.status === 'sold_out') return { key: 'ended', label: english ? 'Sold out' : '已售罄' };
  if (offer.availability === 'check-local' && offer.startDate && !offer.endDate) return { key: offer.startDate > today ? 'upcoming' : 'local', label: offer.startDate > today ? '即将开售' : '限量供应 · 查询余票' };
  if (offer.availability === 'check-local') return { key: 'local', label: '查本店场次' };
  if (offer.availability === 'ongoing') return { key: 'ongoing', label: '长期福利' };
  const range = dateRange(offer);
  if (!range) return { key: 'unverified', label: '日期待核对' };
  if (range[1] < today) return { key: 'ended', label: '已结束' };
  if (range[0].slice(0, 7) === nextMonth(today)) return { key: 'preview', label: '下月预告' };
  return range[0] > today ? { key: 'upcoming', label: '即将开始' } : { key: 'active', label: '有效期内' };
}

/** An offer whose own end date has passed, whatever its availability (dated, ongoing or check-local). */
const endedBy = (offer: FreebieOffer, today: string) => validDate(offer.endDate) && offer.endDate < today;

function orderedOffers(offers: FreebieOffer[], today: string) {
  const position = (offer: FreebieOffer): [number, string] => {
    if (offer.availability === 'ongoing') return [1, ''];
    const range = offer.availability === 'dated' ? dateRange(offer) : null;
    if (!range) return [2, ''];
    return [range[1] < today ? 3 : 0, range[0]];
  };
  // A stated end date ends any offer, also a check-local or ongoing one (the last Poppy & Claro dog dinner is by 10/30;
  // CNT-SUPPLY freebie-guard). Ongoing items without an end date stay listed.
  return offers.filter(offer => offer.verificationStatus !== 'needs-confirmation' && (offer.availability !== 'dated' || (dateRange(offer)?.[1] || '') >= today) && !endedBy(offer, today)).sort((left, right) => {
    const [leftGroup, leftDate] = position(left);
    const [rightGroup, rightDate] = position(right);
    return leftGroup - rightGroup || leftDate.localeCompare(rightDate);
  });
}

function FreebieCard({ offer, today, showImage }: { offer: FreebieOffer; today: string; showImage: boolean }) {
  const locale = useLocale();
  const [zoomed, setZoomed] = useState(false);
  const headingId = useId();
  const [imageFailed, setImageFailed] = useState(false);
  const image = imageFailed || !showImage ? undefined : getOfferImage(offer);
  const status = offerStatus(offer, today, locale === 'en');
  const pictureLabel = image ? getImageProvenance(image, locale === 'en') : '';
  return <article id={`offer-${offer.id}`} className={`bl-freebie-card bl-freebie-card--${status.key}`} aria-labelledby={headingId}>
    <div className="bl-freebie-card-brand"><strong>{offer.brand}</strong><Ticket size={16} aria-hidden="true" /></div>
    {image ? <figure className="bl-freebie-picture">
      <button type="button" className={`bl-freebie-picture-open${image.kind === 'poster' || image.fullFrame ? ' bl-freebie-picture-open--contain' : ''}${image.kind === 'photo' && image.fullFrame ? ' bl-freebie-picture-open--full-photo' : ''}`} style={image.kind === 'photo' && image.fullFrame ? { aspectRatio: `${image.width} / ${image.height}` } : undefined} onClick={() => setZoomed(true)} aria-label={`放大${offer.brand}配图：${image.alt}`} aria-haspopup="dialog">
        <img src={image.src} srcSet={image.srcSet} sizes="(max-width: 479px) calc(100vw - 40px), (max-width: 639px) calc((100vw - 54px) / 2), (min-width: 1280px) 260px, 360px" alt={image.alt} width={image.width} height={image.height} loading="lazy" decoding="async" onError={() => setImageFailed(true)} />
        <span className="bl-freebie-picture-zoom"><Expand size={13} aria-hidden="true" /><span className="sr-only">查看大图</span></span>
      </button>
      <figcaption>{pictureLabel}{offer.imageNote && <span> · {offer.imageNote}</span>}</figcaption>
    </figure> : null}
    <div className="bl-freebie-card-body">
      <div className="bl-freebie-card-date"><CalendarDays size={14} aria-hidden="true" /><span>{offer.dateLabel}</span></div>
      <div className="bl-freebie-card-tags"><span className={`bl-freebie-kind bl-freebie-kind--${offer.kind}`}>{KIND_LABELS[offer.kind]}</span><span className={`bl-freebie-status bl-freebie-status--${status.key}`}>{status.label}</span></div>
      <h4 id={headingId}><a href={`/offers/${offer.id}`}>{offer.title}</a></h4>
      {/* Tap-to-call on any number in the merchant's own words (translated first, then split: RC-11 i). */}
      <p className="bl-freebie-requirement"><strong>领取条件</strong><PhoneText text={offer.requirement} /></p>
      <p className="bl-freebie-description"><PhoneText text={offer.description} /></p>
      {validDate(offer.verifiedAt) && <p className="bl-freebie-verified">核对 <time dateTime={offer.verifiedAt}>{offer.verifiedAt}</time></p>}
      <EditorialShareActions item={offerShare(offer)} />
      <div className="bl-freebie-card-actions">
        {safeUrl(offer.sourceUrl) && <a href={offer.sourceUrl} target="_blank" rel="noopener noreferrer" aria-label={`${offer.brand}：${translateText(offer.sourceLabel, locale)}`}>官方入口<ArrowUpRight size={15} aria-hidden="true" /></a>}
        {safeUrl(offer.storeUrl) && <a href={offer.storeUrl} target="_blank" rel="noopener noreferrer" aria-label={`${offer.brand}：查询本地门店`}><MapPin size={13} aria-hidden="true" />本地门店</a>}
      </div>
      <SaveToWeek favorite={{ kind: 'offer', id: offer.id }} compact title={offer.title} />
      {image && <details className="bl-freebie-image-source"><summary>图片说明与来源<ChevronDown size={12} aria-hidden="true" /></summary><p>{image.caption}</p>{safeUrl(image.creditUrl) ? <a href={image.creditUrl} target="_blank" rel="noopener noreferrer">{image.credit}</a> : <span>{image.credit}</span>}{safeUrl(image.licenseUrl) && <a href={image.licenseUrl} target="_blank" rel="noopener noreferrer">查看图片授权</a>}</details>}
    </div>
    {zoomed && image && <GuideImageLightbox image={image} onClose={() => setZoomed(false)} />}
  </article>;
}

/**
 * The deals board on the freebies guides (G26). It opens on 本周有效 (what a reader can still use by this Sunday; 全部日期
 * when nothing is) and shows six cards per kind with 看全部 N 条, so a 200-offer month is a few screens, not 150. A
 * search lists every match. A picture already on the page (an earlier card, or the guide's own cover: `skipImages`) is
 * not shown again; the card keeps its text.
 */
export function FreebieBoard({ offers, today: suppliedToday, title = '先看条件，再挑一份小惊喜。', description = '一张卡看懂日期、门槛和官方入口。', skipImages = [], initialDates, sectionSize = FREEBIE_SECTION_SIZE }: {
  offers: FreebieOffer[]; today?: string; title?: string; description?: string; skipImages?: string[];
  /** Which dates the board opens on; by default 本周有效 when anything on it is, else every date. */
  initialDates?: DateWindow;
  /** Cards per kind before 看全部 (Infinity lists every card). */
  sectionSize?: number;
}) {
  const [filter, setFilter] = useState<OfferFilter>('all');
  const [query, setQuery] = useState('');
  const locale = useLocale();
  const english = locale === 'en';
  const t = (zh: string, en: string) => english ? en : translateText(zh, locale);
  const [localToday, setLocalToday] = useState(getBayAreaToday);
  const [expanded, setExpanded] = useState<FreebieOffer['kind'][]>([]);
  const headingId = useId();
  const sectionId = useId();
  const resultsRef = useRef<HTMLParagraphElement>(null);
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
  const weekEnd = weekEndOf(today);
  const month = today.slice(0, 7);
  const reviewed = offers.filter(offer => offer.verificationStatus !== 'needs-confirmation' && !endedBy(offer, today));
  const thisWeek = reviewed.filter(offer => validThisWeek(offer, today, weekEnd)).length;
  // Opens on 本周有效 unless nothing on the board is (a next-month board read early): then on every date.
  const [chosenWindow, setWindow] = useState<DateWindow | null>(null);
  const window_: DateWindow = chosenWindow ?? initialDates ?? (thisWeek ? 'week' : 'all');
  const confirmed = reviewed.filter(offer => {
    const range = dateRange(offer);
    return offer.availability === 'dated' && range && range[1] >= today && range[0].slice(0, 7) <= month && range[1].slice(0, 7) >= month;
  }).length;
  const ongoing = reviewed.filter(offer => offer.availability === 'ongoing').length;
  const local = reviewed.filter(offer => offer.availability === 'check-local').length;
  const previews = reviewed.filter(offer => offer.availability === 'dated' && dateRange(offer)?.[0].slice(0, 7) === nextMonth(today)).length;
  const stats = [
    { value: confirmed, label: '本月已确认' },
    ...ongoing ? [{ value: ongoing, label: '长期福利' }] : [],
    ...previews ? [{ value: previews, label: '下月预告' }] : [],
    ...local ? [{ value: local, label: '需查本店' }] : [],
  ];
  const terms = searchText(query).split(/\s+/).filter(Boolean);
  const inWindow = orderedOffers(offers, today).filter(offer => window_ !== 'week' || validThisWeek(offer, today, weekEnd));
  const kindCounts = Object.fromEntries(FILTERS.map(item => [item.value, item.value === 'all' ? inWindow.length : inWindow.filter(offer => offer.kind === item.value).length])) as Record<OfferFilter, number>;
  const pickKind = (value: OfferFilter) => {
    setFilter(value);
    const results = resultsRef.current;
    if (results && typeof results.getBoundingClientRect === 'function' && results.getBoundingClientRect().top < 0) results.scrollIntoView({ block: 'start' });
  };
  const visible = orderedOffers(offers, today).filter(offer => {
    if (window_ === 'week' && !validThisWeek(offer, today, weekEnd)) return false;
    if (filter !== 'all' && offer.kind !== filter) return false;
    const values = [offer.brand, offer.title, offer.dateLabel, offer.requirement, offer.description];
    const haystack = searchText([...values, ...values.map(value => translateText(value, locale))].join(' '));
    return terms.every(term => haystack.includes(term));
  });
  // A search lists every match in one list; otherwise one section per kind, six cards each until 看全部.
  const sections = terms.length
    ? [{ kind: null, label: t(`找到 ${visible.length} 项`, `${visible.length} found`), offers: visible }]
    : KINDS.filter(item => filter === 'all' || item.value === filter)
      .map(item => ({ kind: item.value, label: item.label, offers: visible.filter(offer => offer.kind === item.value) }))
      .filter(section => section.offers.length);
  const shown = sections.map(section => section.kind && !expanded.includes(section.kind) ? section.offers.slice(0, sectionSize) : section.offers);
  // Same-page de-duplication (plan §3.0 rule 6): the first card with a picture shows it; later ones keep their text.
  const seen = new Set(skipImages);
  const pictured = new Set<string>();
  for (const offer of shown.flat()) {
    const src = getOfferImage(offer)?.src;
    if (src && !seen.has(src)) { seen.add(src); pictured.add(offer.id); }
  }
  const [weekEndMonth, weekEndDay] = [Number(weekEnd.slice(5, 7)), Number(weekEnd.slice(8))];
  const weekEndLabel = t(`${weekEndMonth}/${weekEndDay} 周日`, `Sun ${weekEndMonth}/${weekEndDay}`);
  const reset = () => { setFilter('all'); setQuery(''); setWindow('all'); };
  return <section className="bl-freebie-board" aria-labelledby={headingId}>
    <header className="bl-freebie-board-heading"><EnglishOnly><span><Gift size={16} aria-hidden="true" />BAYLINK · LITTLE PERKS</span></EnglishOnly><h2 id={headingId}>{title}</h2>{description && <p>{description}</p>}</header>
    <div className="bl-freebie-board-stats" aria-label="领取信息概况">{stats.map(item => <span key={item.label}><strong>{item.value}</strong>{item.label}</span>)}</div>
    <p className="bl-freebie-board-count-note">本月已确认仅计入有效期明确、尚未结束的条目；下月预告与待查场次分列。</p>
    <div className="bl-freebie-filters" role="group" aria-label={t('按日期筛选', 'Filter by date')}>
      <button type="button" aria-pressed={window_ === 'week'} onClick={() => setWindow('week')}>{t(`本周有效 ${thisWeek}`, `Valid this week ${thisWeek}`)}</button>
      <button type="button" aria-pressed={window_ === 'all'} onClick={() => setWindow('all')}>{t('全部日期', 'All dates')}</button>
    </div>
    {/* H66: the kind tabs stay under the site header while the cards scroll, each with its count for the chosen dates (also in
        its name, "无需购物，49 条"); picking one brings the list's start back into view. A kind with nothing in the chosen dates
        is left out unless it is the one picked, so no tab leads to an empty list. */}
    <div className="bl-freebie-filters bl-freebie-kinds" role="group" aria-label="按领取条件筛选">{FILTERS.filter(item => item.value === 'all' || kindCounts[item.value] > 0 || filter === item.value).map(item => <button key={item.value} type="button" aria-pressed={filter === item.value} aria-label={t(`${item.label}，${kindCounts[item.value]} 条`, `${translateText(item.label, 'en')}, ${kindCounts[item.value]}`)} onClick={() => pickKind(item.value)}>
      {item.label}<span className="bl-freebie-kinds__count" aria-hidden="true">{kindCounts[item.value]}</span>
    </button>)}</div>
    <label className="bl-freebie-search"><span>搜索品牌、城市或福利</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="例如 Target、Lowe’s、手作、生日" /></label>
    <p ref={resultsRef} className="bl-freebie-results" role="status" aria-live="polite"><span>显示 {visible.length} 项 · 日期按湾区当地时间</span>{window_ === 'week' && <span> · {t(`本周有效至 ${weekEndLabel}`, `valid through ${weekEndLabel}`)}</span>}</p>
    {visible.length ? sections.map((section, index) => {
      const id = `${sectionId}-${section.kind || 'search'}`;
      const more = section.kind && section.offers.length > sectionSize;
      const open = !!section.kind && expanded.includes(section.kind);
      return <section key={section.kind || 'search'} className="bl-freebie-section" aria-labelledby={`${id}-heading`}>
        <h3 id={`${id}-heading`} className="bl-freebie-section-heading">{section.label}{section.kind && <span> · {t(`${section.offers.length} 条`, `${section.offers.length}`)}</span>}</h3>
        <div id={`${id}-grid`} className="bl-freebie-grid">{shown[index].map(offer => <FreebieCard key={`${offer.id}:${offer.imageKey}`} offer={offer} today={today} showImage={pictured.has(offer.id)} />)}</div>
        {more && <button type="button" className="bl-freebie-more" aria-expanded={open} aria-controls={`${id}-grid`} onClick={() => setExpanded(open ? expanded.filter(kind => kind !== section.kind) : [...expanded, section.kind!])}>
          {open ? t('收起', 'Show fewer') : t(`看全部 ${section.offers.length} 条`, `See all ${section.offers.length}`)}<ChevronDown size={16} aria-hidden="true" />
        </button>}
      </section>;
    }) : <div className="bl-freebie-empty"><Gift size={24} aria-hidden="true" /><p>{offers.length ? window_ === 'week' && !query && filter === 'all' ? t('本周没有可用的条目，看看全部日期。', 'Nothing on this board is valid this week; see all dates.') : '这个条件下暂时没有条目，换个条件看看。' : '这期领取信息正在整理。'}</p>{(filter !== 'all' || query || window_ === 'week') && <button type="button" onClick={reset}>查看全部</button>}</div>}
  </section>;
}
