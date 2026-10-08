import { recordProductEvent } from '../lib/product-events';
import { useEffect, useId, useState } from 'react';
import { ArrowRight, ArrowUpRight, CalendarDays, Check, MapPin, Search, ShieldCheck, Ticket, TramFront } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { getGuideBySlug, guideCount, getGuideMedia, GUIDE_IMAGES, MONTHLY_EVENTS, currentFreebies } from '../lib/home-catalog';
import { HOME_FEATURED_GUIDE, HOME_PATHWAYS as pathways } from '../data/home-pathways';
import { getBayAreaToday } from '../lib/monthly';
import { getHomeWeekend, getWeeklyCardHref } from '../lib/home-weekend';
import { useLocale } from '../i18n/locale';
import { getImageProvenance } from '../lib/image-provenance';
import { isHomeQuestion } from '../lib/home-query';

const INTENT_KEY = 'baylink.home-intent.v1';
const getSavedIntent = () => {
  try { const saved = window.localStorage.getItem(INTENT_KEY); return pathways.find(path => path.id === saved)?.id || 'weekend'; }
  catch { return 'weekend' as const; }
};

export function HomeDiscovery({ onAskBayBay, onBrowseCommunity, onSearch, today: suppliedToday }: {
  onAskBayBay: (question?: string) => void; onBrowseCommunity: () => void;
  onSearch?: (query: string) => void; today?: string;
}) {
  const english = useLocale() === 'en';
  const navigate = useNavigate();
  const [intent, setIntent] = useState<(typeof pathways)[number]['id']>(getSavedIntent);
  const [query, setQuery] = useState('');
  const [localToday, setLocalToday] = useState(getBayAreaToday);
  const panelId = useId();
  useEffect(() => {
    const refresh = () => setLocalToday(getBayAreaToday());
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener('focus', refresh); document.addEventListener('visibilitychange', refresh);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, []);
  const today = suppliedToday || localToday;
  const weekend = getHomeWeekend(today, MONTHLY_EVENTS);
  const selection = pathways.find(path => path.id === intent)!;
  const picks = selection.slugs.map(getGuideBySlug).filter(guide => !!guide);
  const featuredGuide = getGuideBySlug(HOME_FEATURED_GUIDE);
  const featuredImage = featuredGuide && getGuideMedia(featuredGuide).cover;
  const offers = currentFreebies.filter(offer => offer.availability === 'dated' && offer.verificationStatus !== 'needs-confirmation' && !!offer.startDate && (offer.endDate || offer.startDate!) >= today)
    .sort((a, b) => (a.endDate || a.startDate!).localeCompare(b.endDate || b.startDate!)).slice(0, 3);
  const dateLabel = (day: string) => new Intl.DateTimeFormat(english ? 'en-US' : 'zh-CN', { month: 'short', day: 'numeric', weekday: 'short', timeZone: 'UTC' }).format(new Date(`${day}T12:00:00Z`));
  const choose = (next: typeof intent) => { setIntent(next); try { window.localStorage.setItem(INTENT_KEY, next); } catch { /* Session selection still works. */ } };
  const submit = () => {
    const value = query.trim(); if (!value) return;
    if (isHomeQuestion(value)) onAskBayBay(value);
    else if (onSearch) onSearch(value);
    else navigate(`/guides?q=${encodeURIComponent(value)}`);
  };
  return <section className="home-discovery home-discovery--focused" aria-label={english ? 'Discover Bay Area life' : '湾区阅读与探索'}>
    <header className="home-discovery-heading">
      <div className="home-hero-copy">
        <p className="home-discovery-location"><MapPin size={16} aria-hidden="true" />San Francisco Bay Area</p>
        <h1>{english ? 'Good days start' : '湾区的好去处，'}<span>{english ? 'closer to home.' : '从这里出发。'}</span></h1>
        <p>{english ? 'Discover a day out, a new favorite spot, or a useful answer to everyday life.' : '找一个周末好去处，发现一家新店，让湾区生活多一点灵感。'}</p>
        <form className="home-search" role="search" onSubmit={event => { event.preventDefault(); submit(); }}>
          <label htmlFor={`${panelId}-search`} className="sr-only">{english ? 'Search events and guides, or ask BayBay' : '搜索活动、指南，或问 BayBay'}</label>
          <Search size={22} aria-hidden="true" />
          <input id={`${panelId}-search`} value={query} maxLength={500} placeholder={english ? 'Places, events, or a question…' : '搜地点、活动，或问一个生活问题'} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && event.nativeEvent.isComposing) event.preventDefault(); }} />
          <button type="submit" disabled={!query.trim()}>{isHomeQuestion(query) ? english ? 'Ask BayBay' : '问 BayBay' : english ? 'Search' : '搜索'}</button>
        </form>
        <nav className="home-search-suggestions" aria-label={english ? 'Quick discoveries' : '快速发现'}>
          <Link to="/this-month?when=today">{english ? 'Today' : '今天去哪'}</Link>
          <Link to="/this-month?when=weekend&cost=free">{english ? 'Free this weekend' : '本周末免费'}</Link>
          <Link to="/guides?q=%E6%97%A0%E8%BD%A6">{english ? 'Without a car' : '不开车也能去'}</Link>
        </nav>
        <p className="home-search-help">{english ? 'Keywords find events and guides. Questions go to BayBay.' : '关键词找活动与指南，完整问题问 BayBay。'}</p>
      </div>
      {featuredGuide && featuredImage && <figure className="home-hero-feature">
        <Link to={`/guides/${featuredGuide.slug}`} className="home-hero-feature-image">
          <img src={featuredImage.src} srcSet={featuredImage.srcSet} sizes="(max-width:767px) calc(100vw - 40px), (max-width:1279px) 48vw, 620px" width={featuredImage.width} height={featuredImage.height} alt={featuredImage.alt} loading="eager" decoding="async" />
        </Link>
        <figcaption>
          <Link to={`/guides/${featuredGuide.slug}`}><strong>{english ? 'A fresh view of the Golden Gate' : '换个角度，重新认识金门大桥'}</strong><ArrowUpRight size={22} aria-hidden="true" /></Link>
          <div className="home-feature-meta"><span className="home-feature-kicker">{english ? 'San Francisco · A coastal half-day' : 'San Francisco · 海岸半日游'}</span>
          <details className="home-image-credit"><summary>{getImageProvenance(featuredImage, english)} · {english ? 'Source' : '来源'}</summary><p>{featuredImage.caption}</p><p>{featuredImage.creditUrl ? <a href={featuredImage.creditUrl} target="_blank" rel="noopener noreferrer">{featuredImage.credit}</a> : featuredImage.credit}{featuredImage.licenseUrl && <> · <a href={featuredImage.licenseUrl} target="_blank" rel="noopener noreferrer">{english ? 'License' : '授权说明'}</a></>}</p></details></div>
        </figcaption>
      </figure>}
    </header>
    <nav className="home-destinations" aria-label={english ? 'Explore Bay Area life' : '发现湾区生活'}>
      <Link to="/explore"><span>{english ? 'Places to explore' : '景点与路线'}</span><ArrowUpRight size={18} aria-hidden="true" /></Link>
      <Link to="/this-month#monthly-openings"><span>{english ? 'New around the corner' : '街角新店'}</span><ArrowUpRight size={18} aria-hidden="true" /></Link>
      <Link to="/this-month#monthly-perks"><span>{english ? 'Free & good-value finds' : '免费与优惠'}</span><ArrowUpRight size={18} aria-hidden="true" /></Link>
      <Link to="/guides"><span>{english ? 'Make everyday life easier' : '生活办事指南'}</span><ArrowUpRight size={18} aria-hidden="true" /></Link>
    </nav>

    <section className="home-weekend" aria-labelledby={`${panelId}-weekend`}><div className="home-section-heading"><div><span className="home-section-kicker">{dateLabel(weekend.start)} — {dateLabel(weekend.end)}</span><h2 id={`${panelId}-weekend`}>{english ? 'Three ideas for this weekend' : '本周末，先看这三件事'}</h2></div><Link to="/this-month?when=weekend">{english ? `All ${weekend.total} events` : `全部 ${weekend.total} 场`}<ArrowRight size={18} aria-hidden="true" /></Link></div>
      {weekend.picks.length ? <div className="home-weekend-list">{weekend.picks.map(({ event, date, editorial }) => {
        const image = GUIDE_IMAGES[event.imageKey];
        return <article key={event.id} className="home-weekend-card">{image && <Link to={`/events/${event.id}`} className={`home-weekend-image${image.kind === 'poster' || image.fullFrame ? ' home-weekend-image--full' : ''}`}><img src={image.src} srcSet={image.srcSet} sizes="(max-width:767px) calc(100vw - 40px), (max-width:1279px) 31vw, 410px" alt={image.alt} width={image.width} height={image.height} loading="lazy" decoding="async" /><span>{getImageProvenance(image, english)}</span></Link>}<header className="home-weekend-card-heading"><div className="home-weekend-dateline"><time dateTime={date}><CalendarDays size={16} aria-hidden="true" />{dateLabel(date)}</time></div><h3><Link to={`/events/${event.id}`}>{event.title}</Link></h3>{editorial && <p className="home-weekend-pick"><span>{english ? "Editor's pick" : '编辑精选'}</span><span className="sr-only">{english ? ': ' : '：'}</span>{english ? editorial.reason.en : editorial.reason.zh}</p>}</header><div className="home-weekend-copy"><p className="home-weekend-facts"><MapPin size={16} aria-hidden="true" />{event.city}</p><p className="home-weekend-facts"><Ticket size={16} aria-hidden="true" />{event.costLabel}</p><div className="home-weekend-actions"><Link className="home-tonal-button" to={`/plan?date=${date}&stops=${encodeURIComponent(`event:${event.id}`)}`}>{english ? 'Plan this day' : '加入这天计划'}<ArrowRight size={16} aria-hidden="true" /></Link><a href={event.officialUrl} target="_blank" rel="noopener noreferrer">{english ? 'Official details' : '官方详情'}<ArrowUpRight size={16} aria-hidden="true" /></a></div><details className="home-event-details"><summary>{english ? 'Before you go & sources' : '行前信息与来源'}</summary><p>{event.venue}</p><p>{event.dateLabel}</p><p className="home-source">{event.sourceLabel} · {english ? 'Checked' : '核对'} {event.verifiedAt}</p>{image && <div className="home-event-image-credit"><p>{image.caption}</p><p>{image.creditUrl ? <a href={image.creditUrl} target="_blank" rel="noopener noreferrer">{image.credit}</a> : image.credit}{image.licenseUrl && <> · <a href={image.licenseUrl} target="_blank" rel="noopener noreferrer">{english ? 'License' : '授权说明'}</a></>}</p></div>}</details></div></article>;
      })}</div> : <div className="home-empty"><p>{english ? 'No confirmed events for this weekend yet. Try a year-round place or check the calendar.' : '这个周末暂没有已确认的活动，先看常设去处或换个日期。'}</p><Link to="/explore">{english ? 'Explore places' : '按地区找景点'}</Link></div>}
    </section>

    <p className="home-trust"><ShieldCheck size={18} aria-hidden="true" /><span>{english ? 'Official sources. Dates checked individually. A starting point for your plans.' : '官方来源 · 逐条标注核对日期 · 出发前再确认'}</span><Link to="/about">{english ? 'Our approach' : '了解核验方法'}<ArrowUpRight size={15} aria-hidden="true" /></Link></p>
    <section className="home-guide-selection" aria-labelledby={`${panelId}-guides`}><div className="home-section-heading"><h2 id={`${panelId}-guides`}>{english ? 'A guide for your next step' : '为你的下一步，选一篇指南'}</h2><Link to="/guides">{english ? `${guideCount} guides` : `${guideCount} 篇指南`}<ArrowRight size={18} aria-hidden="true" /></Link></div><div className="home-discovery-intents" role="group" aria-label={english ? 'Your next step' : '你想怎么发现湾区'}>{pathways.map(path => <button type="button" key={path.id} aria-pressed={intent === path.id} aria-controls={panelId} onClick={() => choose(path.id)}>{intent === path.id && <Check size={16} aria-hidden="true" />}{english ? path.en : path.label}</button>)}</div><div id={panelId} className="home-discovery-picks">{picks.map(guide => {
      const image = getGuideMedia(guide).cover;
      const provenance = getImageProvenance(image, english);
      return <article key={guide.slug} className="home-guide-card"><Link to={`/guides/${guide.slug}`} className="home-discovery-pick"><div className={`home-discovery-image${image.kind === 'poster' || image.fullFrame ? ' home-discovery-image--full' : ''}`}><img src={image.src} srcSet={image.srcSet} sizes="(max-width:767px) calc(100vw - 40px), (max-width:1279px) 31vw, 410px" alt={image.alt} width={image.width} height={image.height} loading="lazy" decoding="async" /><span className="home-discovery-image-label">{provenance}</span></div><div><span>{guide.categoryLabel} · {guide.readMinutes} {english ? 'min read' : '分钟'}</span><h3>{guide.title}</h3><p>{guide.summary}</p></div></Link><details className="home-discovery-credits"><summary>{english ? 'Image source' : '图片来源'}</summary><p>{image.caption}</p><p>{image.creditUrl ? <a href={image.creditUrl} target="_blank" rel="noopener noreferrer">{image.credit}</a> : image.credit}{image.licenseUrl && <> · <a href={image.licenseUrl} target="_blank" rel="noopener noreferrer">{english ? 'License' : '授权说明'}</a></>}</p></details></article>;
    })}</div></section>

    {offers.length > 0 && <section className="home-offers" aria-labelledby={`${panelId}-offers`}><div className="home-section-heading"><h2 id={`${panelId}-offers`}>{english ? 'Offers with a date' : '免费与优惠，先看日期与条件'}</h2><Link to="/this-month#monthly-perks">{english ? 'All offers' : '查看全部'}<ArrowRight size={18} aria-hidden="true" /></Link></div><div className="home-offer-list">{offers.map(offer => <article key={offer.id}><span className="home-section-kicker">{offer.brand}</span><h3><Link to={`/offers/${offer.id}`}>{offer.title}</Link></h3><p className="home-weekend-facts">{offer.dateLabel}</p><p>{offer.requirement}</p><a href={offer.sourceUrl} target="_blank" rel="noopener noreferrer">{english ? 'Official conditions' : '官方领取条件'}<ArrowUpRight size={16} aria-hidden="true" /></a></article>)}</div></section>}
    <section className="home-weekly-share"><a href={getWeeklyCardHref(today)} download onClick={() => recordProductEvent('share_card_download')}>{english ? 'Share three ideas for this weekend' : '分享本周三件事'}</a><a href="webcal://www.baylink.us/calendars/all.ics">{english ? 'Subscribe to Bay Area event dates' : '订阅区域活动日历'}</a><p>{english ? 'Calendars update with site releases. Listings without confirmed times use all-day reminders, not reservations. In WeChat, open the card and press and hold to save it.' : '日历随网站发布更新；没有确认时段的活动使用全天提醒，不代表预约。在微信中打开分享图后，可长按保存。'}</p></section>
    <nav className="home-useful-links" aria-label={english ? 'Useful next steps' : '办事与下一步'}><Link to="/guides/bay-area-rental-scam-guide">{english ? 'Avoid rental scams' : '租房防骗'}</Link><Link to="/tools">{english ? 'Messages, costs and conversions' : '英文消息、算账与换算'}</Link><Link to="/my-week">{english ? 'My saved plans' : '我的收藏与计划'}</Link><button type="button" onClick={onBrowseCommunity}>{english ? 'Neighborhood board' : '查看邻里信息'}</button></nav>
    <Link to="/opus-bay?from=home" reloadDocument className="home-world-link"><TramFront size={28} aria-hidden="true" /><span><strong>{english ? '3D San Francisco' : '3D 旧金山 · 湾区小旅'}</strong><small>{english ? 'Explore the city, then read local guides. Opens a separate 3D experience.' : '先逛一座城，再读当地攻略。打开独立 3D 体验。'}</small></span><ArrowRight size={20} aria-hidden="true" /></Link>
  </section>;
}
