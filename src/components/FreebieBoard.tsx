import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
// The board's sheet, and the guide's 看免费领取图鉴 link above it, load with this chunk: GuideDetail shows that link only on
// a guide with a freebies block, whose page loads this chunk first (features/guides/guide-blocks.tsx).
import './freebie-board.css';
import { EnglishOnly } from './EnglishOnly';
import { ArrowUpRight, Check, ChevronDown, Expand, Gift } from 'lucide-react';
import type { StatusLook } from './ui/Status';
// The controls are drawn with the primitives' own classes (.ui-button[data-variant], .ui-chip, .ui-status; ui.css and
// covers.css load with the guide page) instead of importing Button, Chip or Segmented: each import would add a chunk to
// the guide's preload list or split one out of the events shell (UI9-FREE budgets: guide detail JS at or under the base).
import { brandCase, offerDeadline, readerMonthDay } from '../lib/event-facts';
import { SEP, glueSeparators, pressSourced } from '../features/events/board-status';
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

/**
 * The card's one status (UI9-FREE, N08): C's status map through board-status.ts, so a sold-out or ending offer looks the same
 * here as on the 免费与优惠 board. 已售罄 and 今天/明天截止 solid red, 还剩 N 天 a red outline, 已结束 sunken; the board's
 * other states (有效期内, 长期福利, 下月预告, 查本店场次 …) are neutral.
 */
function cardStatus(offer: FreebieOffer, status: ReturnType<typeof offerStatus>, today: string, english: boolean): { tone: StatusLook; text: string } {
  if (offer.status === 'sold_out') return { tone: 'urgent', text: english ? 'Sold out' : '已售罄' };
  if (status.key === 'ended') return { tone: 'ended', text: status.label };
  // Under way (有效期内): ≤ 1 day left is 今天/明天截止 (solid red), ≤ 7 days 还剩 N 天 (red outline), as on the 免费与优惠 board.
  const deadline = status.key === 'active' ? offerDeadline(offer, today) : null;
  const tone: StatusLook | null = deadline?.tone === 'danger' ? 'urgent' : deadline?.tone === 'warning' ? 'soon' : null;
  return deadline && tone ? { tone, text: english ? deadline.text.en : deadline.text.zh } : { tone: 'neutral', text: status.label };
}

/**
 * One deals card (UI9-FREE): the picture with one 13 px credit line under it (what it is: "官方图", "资料图 · 2017"; G13), then the brand (400),
 * the title (600), line 1 the record's own date words, line 2 the one status chip · what it asks, the conditions, the
 * description and the source line ("官网核对 10/7"; "媒体报道 · 10/7 核对" for a press source, DECISIONS 17). 官方入口 is a
 * secondary button (≤ 1 primary per section), 本地门店 a quiet link.
 */
function FreebieCard({ offer, today, showImage }: { offer: FreebieOffer; today: string; showImage: boolean }) {
  const locale = useLocale();
  const english = locale === 'en';
  const t = (zh: string, en: string) => english ? en : translateText(zh, locale);
  const [zoomed, setZoomed] = useState(false);
  const headingId = useId();
  const [imageFailed, setImageFailed] = useState(false);
  const image = imageFailed || !showImage ? undefined : getOfferImage(offer);
  const status = offerStatus(offer, today, english);
  const chip = cardStatus(offer, status, today, english);
  // A credit line only under a real picture: never on a 3D postcard or an AI illustration (none is on this board).
  const credited = !!image && !(image as { scene3d?: boolean }).scene3d && image.kind !== 'illustration';
  const pictureLabel = image ? getImageProvenance(image, english) : '';
  // The record's own " · " in the brand, the title, the date words and a status are glued (SEP), so no wrapped line starts
  // with "·" (N06). Translated first: the JSX layer would translate a glued Chinese string again, with ordinary spaces.
  const shown = (text: string) => glueSeparators(translateText(text, locale));
  const brand = shown(brandCase(offer.brand));
  const checked = validDate(offer.verifiedAt) ? readerMonthDay(offer.verifiedAt, english) : '';
  return <article id={`offer-${offer.id}`} className={`bl-freebie-card bl-freebie-card--${status.key}`} aria-labelledby={headingId}>
    {image ? <figure className="bl-freebie-picture">
      <button type="button" className={`bl-freebie-picture-open${image.kind === 'poster' || image.fullFrame ? ' bl-freebie-picture-open--contain' : ''}${image.kind === 'photo' && image.fullFrame ? ' bl-freebie-picture-open--full-photo' : ''}`} style={image.kind === 'photo' && image.fullFrame ? { aspectRatio: `${image.width} / ${image.height}` } : undefined} onClick={() => setZoomed(true)} aria-label={`放大${offer.brand}配图：${image.alt}`} aria-haspopup="dialog">
        <img src={image.src} srcSet={image.srcSet} sizes="(max-width: 479px) calc(100vw - 40px), (max-width: 639px) calc((100vw - 54px) / 2), (min-width: 1280px) 260px, 360px" alt={image.alt} width={image.width} height={image.height} loading="lazy" decoding="async" onError={() => setImageFailed(true)} />
        <span className="bl-freebie-picture-zoom"><Expand aria-hidden="true" /><span className="sr-only">查看大图</span></span>
      </button>
      {/* G13: what the picture is ("官方图", "资料图 · 2017", getImageProvenance) on one line; who made it, the note and the
          licence are in 图片说明与来源 below, so the brand is not printed three times. */}
      {credited && <figcaption className="bl-freebie-credit">{glueSeparators(pictureLabel)}</figcaption>}
    </figure> : null}
    <div className="bl-freebie-card-body">
      <p className="bl-freebie-card-brand" translate="no">{brand}</p>
      <h4 id={headingId}><a href={`/offers/${offer.id}`}>{shown(offer.title)}</a></h4>
      <p className="bl-freebie-card-date">{shown(offer.dateLabel)}</p>
      {/* C's status map (covers.css .ui-status[data-tone]) set directly, as OfferWhen does: no Status chunk in the guide's preload list. */}
      <p className="bl-freebie-card-tags"><span className={`ui-status bl-freebie-status bl-freebie-status--${status.key}`} data-tone={chip.tone}>{shown(chip.text)}</span>{SEP}<span className="bl-freebie-kind">{translateText(KIND_LABELS[offer.kind], locale)}</span></p>
      {/* Tap-to-call on any number in the merchant's own words (translated first, then split: RC-11 i). */}
      <p className="bl-freebie-requirement"><strong>领取条件</strong><PhoneText text={offer.requirement} /></p>
      <p className="bl-freebie-description"><PhoneText text={offer.description} /></p>
      {checked && <p className="bl-freebie-verified"><Check aria-hidden="true" /><time dateTime={offer.verifiedAt}>{pressSourced(offer.sourceLabel) ? t(`媒体报道${SEP}${checked} 核对`, `News report${SEP}checked ${checked}`) : t(`官网核对 ${checked}`, `Source checked ${checked}`)}</time></p>}
      <EditorialShareActions item={offerShare(offer)} />
      <div className="bl-freebie-card-actions">
        {safeUrl(offer.sourceUrl) && <a className="ui-button" data-variant="secondary" href={offer.sourceUrl} target="_blank" rel="noopener noreferrer" aria-label={`${offer.brand}：${translateText(offer.sourceLabel, locale)}`}>{t('官方入口', 'Official page')}<ArrowUpRight aria-hidden="true" /></a>}
        {safeUrl(offer.storeUrl) && <a className="ui-button" data-variant="quiet" href={offer.storeUrl} target="_blank" rel="noopener noreferrer" aria-label={`${offer.brand}：查询本地门店`}>{t('本地门店', 'Local stores')}</a>}
      </div>
      <SaveToWeek favorite={{ kind: 'offer', id: offer.id }} compact title={shown(offer.title)} />
      {image && <details className="bl-freebie-image-source"><summary>图片说明与来源<ChevronDown aria-hidden="true" /></summary><p>{image.caption}</p>{offer.imageNote && <p>{offer.imageNote}</p>}{safeUrl(image.creditUrl) ? <a href={image.creditUrl} target="_blank" rel="noopener noreferrer">{image.credit}</a> : <span>{image.credit}</span>}{safeUrl(image.licenseUrl) && <a href={image.licenseUrl} target="_blank" rel="noopener noreferrer">查看图片授权</a>}</details>}
    </div>
    {zoomed && image && <GuideImageLightbox image={image} onClose={() => setZoomed(false)} />}
  </article>;
}

/**
 * 本周有效 | 全部日期: one choice of two, a radio group of F's chips (`.ui-chip[aria-checked]` is their selected look) with
 * the SegmentedControl's keys (←/→/Home/End move and select). SegmentedControl itself lives in the events shell's chunk.
 */
function DateChoice({ label, value, items, onChange }: { label: string; value: DateWindow; items: { id: DateWindow; label: string }[]; onChange: (value: DateWindow) => void }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKeyDown = (event: KeyboardEvent, index: number) => {
    const next = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? (index + 1) % items.length
      : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? (index - 1 + items.length) % items.length
      : event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : -1;
    if (next < 0) return;
    event.preventDefault();
    refs.current[next]?.focus();
    onChange(items[next].id);
  };
  return <div role="radiogroup" aria-label={label} className="bl-freebie-dates">
    {items.map((item, index) => <button key={item.id} ref={element => { refs.current[index] = element; }} type="button" role="radio" className="ui-chip"
      aria-checked={item.id === value} tabIndex={item.id === value ? 0 : -1} onClick={() => onChange(item.id)} onKeyDown={event => onKeyDown(event, index)}>{item.label}</button>)}
  </div>;
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
    <header className="bl-freebie-board-heading"><EnglishOnly><span><Gift aria-hidden="true" />Little perks</span></EnglishOnly><h2 id={headingId}>{title}</h2>{description && <p>{description}</p>}</header>
    <div className="bl-freebie-board-stats" aria-label="领取信息概况">{stats.map(item => <span key={item.label}><strong>{item.value}</strong>{item.label}</span>)}</div>
    <p className="bl-freebie-board-count-note">本月已确认仅计入有效期明确、尚未结束的条目；下月预告与待查场次分列。</p>
    <DateChoice label={t('按日期筛选', 'Filter by date')} value={window_} onChange={setWindow}
      items={[{ id: 'week', label: t(`本周有效 ${thisWeek}`, `Valid this week ${thisWeek}`) }, { id: 'all', label: t('全部日期', 'All dates') }]} />
    {/* H66: the kind tabs stay under the site header while the cards scroll, each with its count for the chosen dates (also in
        its name, "无需购物，49 条"); picking one brings the list's start back into view. A kind with nothing in the chosen dates
        is left out unless it is the one picked, so no tab leads to an empty list. At 特大 / 简洁 they wrap and do not stick. */}
    <div role="group" aria-label="按领取条件筛选" className="ui-chip-row bl-freebie-kinds">{FILTERS.filter(item => item.value === 'all' || kindCounts[item.value] > 0 || filter === item.value).map(item => <button key={item.value} type="button" className="ui-chip" aria-pressed={filter === item.value} aria-label={t(`${item.label}，${kindCounts[item.value]} 条`, `${translateText(item.label, 'en')}, ${kindCounts[item.value]}`)} onClick={() => pickKind(item.value)}>
      {item.label} <span className="ui-chip__count">{kindCounts[item.value]}</span>
    </button>)}</div>
    <label className="bl-freebie-search"><span>搜索品牌、城市或福利</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="例如 Target、Lowe’s、手作、生日" /></label>
    <p ref={resultsRef} className="bl-freebie-results" role="status" aria-live="polite"><span>显示 {visible.length} 项 · 日期按湾区当地时间</span>{window_ === 'week' && <span>{SEP}{t(`本周有效至 ${weekEndLabel}`, `valid through ${weekEndLabel}`)}</span>}</p>
    {visible.length ? sections.map((section, index) => {
      const id = `${sectionId}-${section.kind || 'search'}`;
      const more = section.kind && section.offers.length > sectionSize;
      const open = !!section.kind && expanded.includes(section.kind);
      return <section key={section.kind || 'search'} className="bl-freebie-section" aria-labelledby={`${id}-heading`}>
        <h3 id={`${id}-heading`} className="bl-freebie-section-heading">{section.label}{section.kind && <span> · {t(`${section.offers.length} 条`, `${section.offers.length}`)}</span>}</h3>
        <div id={`${id}-grid`} className="bl-freebie-grid">{shown[index].map(offer => <FreebieCard key={`${offer.id}:${offer.imageKey}`} offer={offer} today={today} showImage={pictured.has(offer.id)} />)}</div>
        {more && <button type="button" className="ui-button bl-freebie-more" data-variant="secondary" data-block="" aria-expanded={open} aria-controls={`${id}-grid`} onClick={() => setExpanded(open ? expanded.filter(kind => kind !== section.kind) : [...expanded, section.kind!])}>
          {open ? t('收起', 'Show fewer') : t(`看全部 ${section.offers.length} 条`, `See all ${section.offers.length}`)}
        </button>}
      </section>;
    }) : <div className="bl-freebie-empty"><Gift aria-hidden="true" /><p>{offers.length ? window_ === 'week' && !query && filter === 'all' ? t('本周没有可用的条目，看看全部日期。', 'Nothing on this board is valid this week; see all dates.') : '这个条件下暂时没有条目，换个条件看看。' : '这期领取信息正在整理。'}</p>{(filter !== 'all' || query || window_ === 'week') && <button type="button" className="ui-button" data-variant="secondary" onClick={reset}>{t('查看全部', 'Show all')}</button>}</div>}
  </section>;
}
