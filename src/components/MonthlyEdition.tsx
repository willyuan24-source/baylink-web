import { useEffect, useState } from 'react';
import { ArrowRight, ArrowUpRight, CalendarDays, Check, ChevronDown, Expand, MapPin, Search, SlidersHorizontal } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { MONTHLY_EDITION, MONTHLY_EVENTS, MONTHLY_PLACES } from '../data/monthly-edition';
import type { MonthlyEvent, MonthlyPlace, MonthlyRegion } from '../data/monthly-types';
import { GUIDE_IMAGES } from '../data/guide-media';
import { downloadEventCalendar, filterMonthlyEvents, getBayAreaToday, getEventStatus, getMonthlyDateRange, isEditionCurrent, resolveMonthlyDateFilter } from '../lib/monthly';
import type { MonthlyDateFilter } from '../lib/monthly';
import { GuideImageCredits } from './GuideExplorer';
import { GuideImageCaption, GuideImageLightbox } from './GuideVisuals';
import { MonthlyDealsSpotlight } from './MonthlyDealsSpotlight';
import { translateText, useLocale } from '../i18n/locale';

const REGIONS: { value: MonthlyRegion | 'all'; label: string }[] = [
  { value: 'all', label: '整个湾区' }, { value: 'sf', label: '旧金山' },
  { value: 'east-bay', label: '东湾' }, { value: 'south-bay', label: '南湾' },
  { value: 'peninsula', label: '半岛' }, { value: 'north-bay', label: '北湾' },
];
const CATEGORIES = { culture: '艺术与文化', outdoors: '户外时光', food: '吃逛市集', family: '亲子出游' };
const STATUS_LABELS = { upcoming: '即将开始', ongoing: '活动日期内', ended: '已结束' };
const DATE_FILTERS: { value: MonthlyDateFilter; label: string }[] = [
  { value: 'all', label: '全部日期' }, { value: 'today', label: '今天' },
  { value: 'weekend', label: '这个周末' }, { value: 'next7', label: '未来 7 天' },
];

type EditionPictureProps = { imageKey: string; className?: string; eager?: boolean };

export function EditionPicture(props: EditionPictureProps) {
  return <EditionPictureSession key={props.imageKey} {...props} />;
}

function EditionPictureSession({ imageKey, className = '', eager = false }: EditionPictureProps) {
  const [open, setOpen] = useState(false);
  const image = GUIDE_IMAGES[imageKey];
  if (!image) return null;
  const label = image.kind === 'poster' ? '官方宣传图' : image.kind === 'illustration' ? 'BAYLINK 主题插图 · AI 创作' : image.caption.includes('资料') ? '资料照片' : '实景照片';
  return <><figure className={`bl-monthly-picture bl-monthly-picture--${image.kind}${image.fullFrame ? ' bl-monthly-picture--full-frame' : ''} ${className}`}>
    <button type="button" className="bl-monthly-picture-frame" aria-label={`放大图片：${image.alt}`} aria-haspopup="dialog" onClick={() => setOpen(true)}>
      <img src={image.src} srcSet={image.srcSet} sizes="(max-width: 639px) calc(100vw - 40px), (max-width: 1023px) 50vw, 560px" width={image.width} height={image.height} alt={image.alt} loading={eager ? 'eager' : 'lazy'} decoding="async" />
      <span className="bl-monthly-picture-kind">{label}</span>
      <span className="bl-monthly-picture-zoom"><Expand size={14} aria-hidden="true" /><span>查看大图</span></span>
    </button>
    <GuideImageCaption image={image} showKind={false} />
  </figure>{open && <GuideImageLightbox image={image} onClose={() => setOpen(false)} />}</>;
}

function EventCard({ event, today }: { event: MonthlyEvent; today: string }) {
  const status = getEventStatus(event, today);
  return <article className={`bl-monthly-event bl-monthly-event-${status}`} aria-labelledby={`event-${event.id}`}>
    <EditionPicture imageKey={event.imageKey} />
    <div className="bl-monthly-event-body">
      <div className="bl-monthly-event-topline"><span><CalendarDays size={14} aria-hidden="true" />{event.dateLabel}</span><span className={`bl-monthly-status bl-monthly-status-${status}`}>{STATUS_LABELS[status]}</span></div>
      <h3 id={`event-${event.id}`}>{event.title}</h3>
      <p className="bl-monthly-location"><MapPin size={14} aria-hidden="true" />{event.city} · {event.venue}</p>
      <p className="bl-monthly-event-summary">{event.summary}</p>
      <div className="bl-monthly-event-tags"><span>{CATEGORIES[event.category]}</span><span className={event.cost === 'free' ? 'bl-monthly-free' : ''}>{event.costLabel}</span></div>
      <p className="bl-monthly-audience">{`${translateText('适合：')} ${event.audience.map(item => translateText(item)).join(' / ')}`}</p>
      <details className="bl-monthly-plan"><summary>去之前，先安排这三件事 <ChevronDown size={15} aria-hidden="true" /></summary><ol>{event.plan.map((tip, index) => <li key={tip}><span aria-hidden="true">0{index + 1}</span><p>{tip}</p></li>)}</ol></details>
      <div className="bl-monthly-event-actions"><a href={event.officialUrl} target="_blank" rel="noopener noreferrer" aria-label={`查看${event.title}官方详情`}>官方详情 <ArrowUpRight size={15} aria-hidden="true" /></a>{status !== 'ended' && <button type="button" onClick={() => downloadEventCalendar(event)} aria-label={`下载${event.title}日期提醒`}><CalendarDays size={14} aria-hidden="true" />日期提醒</button>}{event.relatedGuideSlug && <Link to={`/guides/${event.relatedGuideSlug}`}>搭配一篇攻略 <ArrowRight size={14} aria-hidden="true" /></Link>}</div>
      <p className="bl-monthly-source"><Check size={12} aria-hidden="true" /><span>已核对 {event.verifiedAt} · {event.sourceLabel}</span></p>
    </div>
  </article>;
}

function PlaceCard({ place, index }: { place: MonthlyPlace; index: number }) {
  return <article className="bl-monthly-place">
    <EditionPicture imageKey={place.imageKey} />
    <div className="bl-monthly-place-body"><span className="bl-monthly-place-number">0{index + 1} <span>{place.area}</span></span><h3>{place.title}</h3><p>{place.summary}</p><details className="bl-monthly-plan"><summary>半天可以这样过 <ChevronDown size={15} aria-hidden="true" /></summary><ol>{place.plan.map((tip, step) => <li key={tip}><span aria-hidden="true">0{step + 1}</span><p>{tip}</p></li>)}</ol></details><div className="bl-monthly-place-links"><Link to={`/guides/${place.relatedGuideSlug}`}>读实用攻略 <ArrowRight size={15} aria-hidden="true" /></Link><a href={place.officialUrl} target="_blank" rel="noopener noreferrer">{place.sourceLabel} <ArrowUpRight size={13} aria-hidden="true" /></a></div></div>
  </article>;
}

export function MonthlyEdition({ today: suppliedToday }: { today?: string } = {}) {
  const locale = useLocale();
  const [localToday, setLocalToday] = useState(getBayAreaToday);
  const [searchParams, setSearchParams] = useSearchParams();
  const today = suppliedToday || localToday;
  const current = isEditionCurrent(today);
  useEffect(() => {
    const refresh = () => setLocalToday(getBayAreaToday());
    window.addEventListener('focus', refresh);
    const interval = window.setInterval(refresh, 60_000);
    return () => { window.removeEventListener('focus', refresh); window.clearInterval(interval); };
  }, []);
  const selectedRegion = searchParams.get('region') || 'all';
  const region = REGIONS.some(item => item.value === selectedRegion) ? selectedRegion : 'all';
  const cost = searchParams.get('cost') === 'free' ? 'free' : 'all';
  const date = resolveMonthlyDateFilter(searchParams.get('when'));
  const dateRange = getMonthlyDateRange(date, today);
  const formatDate = (value: string) => new Intl.DateTimeFormat(locale, { timeZone: 'UTC', year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(`${value}T12:00:00Z`));
  const query = (searchParams.get('q') || '').slice(0, 200);
  const includeEnded = searchParams.get('includeEnded') === '1' || (searchParams.get('includeEnded') !== '0' && !current);
  const filtered = filterMonthlyEvents(MONTHLY_EVENTS, { region, cost, date, includeEnded }, today).filter(event => !query.trim() || [event.title, event.city, event.venue, event.summary, ...event.audience].flatMap(text => [text, translateText(text, locale)]).join(' ').toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const activeCount = MONTHLY_EVENTS.filter(event => getEventStatus(event, today) !== 'ended').length;
  const changeFilter = (name: string, value: string) => {
    setSearchParams(previous => {
      const next = new URLSearchParams(previous);
      if (!value || value === 'all') next.delete(name); else next.set(name, value);
      return next;
    }, { replace: true, preventScrollReset: true });
  };
  const clearFilters = () => setSearchParams(previous => {
    const next = new URLSearchParams(previous);
    for (const name of ['region', 'cost', 'when', 'q', 'includeEnded']) next.delete(name);
    return next;
  }, { replace: true, preventScrollReset: true });

  return <div className="bl-monthly">
    <nav className="bl-monthly-breadcrumb" aria-label="当前位置"><Link to="/guides">生活指南</Link><span aria-hidden="true">/</span><span>{MONTHLY_EDITION.label} · 湾区月刊</span></nav>
    <header className="bl-monthly-hero">
      <div className="bl-monthly-hero-copy"><div className="bl-monthly-eyebrow"><span className="bl-monthly-edition-dot" />BAYLINK · THE MONTHLY EDIT</div><div className="bl-monthly-edition-line"><span>{MONTHLY_EDITION.label}</span><span>{current ? '本月湾区精选' : '往期月刊'}</span></div><h1><span className="bl-monthly-title-opening">{MONTHLY_EDITION.title.slice(0, MONTHLY_EDITION.title.indexOf('，') + 1)}</span>{locale === 'en' ? ' ' : null}{MONTHLY_EDITION.title.slice(MONTHLY_EDITION.title.indexOf('，') + 1)}</h1><p>{MONTHLY_EDITION.intro}</p><div className="bl-monthly-hero-links"><a href="#monthly-events">{current ? '挑一个本月活动' : '浏览本期活动'} <ArrowRight size={17} aria-hidden="true" /></a><a href="#monthly-places">看看慢游提案 <ArrowRight size={16} aria-hidden="true" /></a></div><div className="bl-monthly-hero-stats"><span><strong>{current ? activeCount : MONTHLY_EVENTS.length}</strong>{current ? '场待赴的约' : '场活动记录'}</span><span><strong>{MONTHLY_PLACES.length}</strong>个慢游提案</span><span className="bl-monthly-checked"><Check size={14} aria-hidden="true" />已核对 {MONTHLY_EDITION.checkedAt}</span></div></div>
      <div className="bl-monthly-hero-art"><EditionPicture imageKey="september-edition" eager /><span className="bl-monthly-hero-stamp">给日历<br />留一点期待</span></div>
    </header>

    <MonthlyDealsSpotlight today={today} />

    {!current && <aside className="bl-monthly-archive" aria-label="往期内容提示"><CalendarDays size={18} aria-hidden="true" /><div><strong>你正在阅读 {MONTHLY_EDITION.label} 月刊</strong><p>这是按出版时资料整理的往期精选，不是当前月份的最新活动。日期已过的活动仅供回顾，新的安排请查看主办方公告。</p></div></aside>}

    <section className="bl-monthly-events" id="monthly-events" aria-labelledby="monthly-events-heading">
      <div className="bl-monthly-section-heading"><div><span className="bl-monthly-eyebrow">ON THE CALENDAR</span><h2 id="monthly-events-heading">{current ? '这个月，值得出门的理由' : `${MONTHLY_EDITION.label} · 活动记录`}</h2></div><p>从主办方资料出发，帮你把一个周末安排得更轻松。</p></div>
      <div className="bl-monthly-filters">
        <div className="bl-monthly-date-filter" role="group" aria-label="按活动日期筛选">
          <span className="bl-monthly-date-label"><CalendarDays size={16} aria-hidden="true" />什么时候出门？</span>
          <div className="bl-monthly-date-options">{DATE_FILTERS.map(item => <button type="button" key={item.value} aria-pressed={date === item.value} onClick={() => changeFilter('when', item.value)}>{item.label}</button>)}</div>
        </div>
        {dateRange && <p className="bl-monthly-date-range"><span>湾区当地日期</span><strong><time dateTime={dateRange.start}>{formatDate(dateRange.start)}</time>{dateRange.start !== dateRange.end && <> — <time dateTime={dateRange.end}>{formatDate(dateRange.end)}</time></>}</strong>{date === 'next7' && <span>包含今天</span>}</p>}
        <div className="bl-monthly-region-filter" role="group" aria-label="按湾区地区筛选">{REGIONS.map(item => <button type="button" key={item.value} aria-pressed={region === item.value} onClick={() => changeFilter('region', item.value)}>{item.label}</button>)}</div><div className="bl-monthly-filter-row"><label className="bl-monthly-search"><Search size={17} aria-hidden="true" /><input type="search" aria-label="搜索当月活动" placeholder="搜活动、城市或关键词" maxLength={200} value={query} onChange={event => changeFilter('q', event.target.value)} /></label><label className="bl-monthly-cost"><SlidersHorizontal size={15} aria-hidden="true" /><span className="sr-only">活动入场费用</span><select aria-label="活动入场费用" value={cost} onChange={event => changeFilter('cost', event.target.value)}><option value="all">所有入场方式</option><option value="free">仅免费入场</option></select></label><label className="bl-monthly-ended"><input type="checkbox" checked={includeEnded} onChange={event => changeFilter('includeEnded', event.target.checked ? '1' : '0')} />也看已结束活动</label></div>
      </div>
      <div className="bl-monthly-results"><span role="status" aria-live="polite">{locale === 'en' ? <>Found <strong>{filtered.length}</strong> {filtered.length === 1 ? 'event' : 'events'}</> : <>找到 <strong>{filtered.length}</strong> 场活动</>}</span><span>日期按湾区当地时间 · 免费入场不代表餐饮、游乐或停车免费</span></div>
      {filtered.length ? <div className="bl-monthly-event-grid">{filtered.map(event => <EventCard key={event.id} event={event} today={today} />)}</div> : <div className="bl-monthly-empty"><CalendarDays size={30} aria-hidden="true" /><h3>这组条件下，暂时没有活动</h3><p>换个日期或地区，也可以看看下方的慢游提案。</p><button type="button" onClick={clearFilters}>清除筛选条件 <ArrowRight size={15} aria-hidden="true" /></button></div>}
      <p className="bl-monthly-calendar-note"><CalendarDays size={15} aria-hidden="true" /><span>“日期提醒”下载仅含活动日期的日历文件，不含具体场次与入场时间。票务、开放时段及临时变更，请在出发前查看官方详情。</span></p>
    </section>

    <section className="bl-monthly-places" id="monthly-places" aria-labelledby="monthly-places-heading"><div className="bl-monthly-section-heading"><div><span className="bl-monthly-eyebrow">A LITTLE LESS PLANNING</span><h2 id="monthly-places-heading">{current ? '这个月的慢游提案' : '本期的慢游提案'}</h2></div><p>这些是编辑推荐的常规去处，不是限时活动。空出半天，也能有一次小出走。</p></div><div className="bl-monthly-place-grid">{MONTHLY_PLACES.map((place, index) => <PlaceCard key={place.id} place={place} index={index} />)}</div><p className="bl-monthly-place-note">去处的参观规则核对于 {MONTHLY_EDITION.checkedAt}；实际开放、预约与费用以各场所官网为准。</p></section>

    <aside className="bl-monthly-guide-link"><div><span className="bl-monthly-eyebrow">BEFORE YOU HEAD OUT</span><h2>目的地选好了，准备也可以简单一点。</h2><p>海边怎么走、市集怎么买、带孩子如何安排——把实用攻略一起装进口袋。</p></div><Link to="/guides">翻翻生活指南 <ArrowRight size={18} aria-hidden="true" /></Link></aside>
    <GuideImageCredits imageKeys={['september-edition', ...filtered.map(event => event.imageKey), ...MONTHLY_PLACES.map(place => place.imageKey)]} />
  </div>;
}
