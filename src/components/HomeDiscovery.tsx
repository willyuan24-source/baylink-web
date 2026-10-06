import { recordProductEvent } from '../lib/product-events';
import { useEffect, useId, useState } from 'react';
import { ArrowRight, ArrowUpRight, CalendarDays, Check, Search, ShieldCheck, Ticket, TramFront } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { getGuideBySlug, guideCount, getGuideMedia, MONTHLY_EVENTS, currentFreebies } from '../lib/home-catalog';
import { HOME_PATHWAYS as pathways } from '../data/home-pathways';
import { getBayAreaToday } from '../lib/monthly';
import { getHomeWeekend } from '../lib/home-weekend';
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
    <header className="home-discovery-heading"><div><time className="home-discovery-eyebrow" dateTime={today}>{english ? 'Bay Area' : '湾区'} · {dateLabel(today)}</time><h1>{english ? 'Make room for a good weekend.' : '这个周末，'}{!english && <span>湾区去哪？</span>}</h1><p>{english ? 'Local events, practical guides and clear next steps, with official sources.' : '挑活动、读指南、理清下一步，每条都能查到官方来源。'}</p></div></header>
    <form className="home-search" role="search" onSubmit={event => { event.preventDefault(); submit(); }}><label htmlFor={`${panelId}-search`} className="sr-only">{english ? 'Search events and guides, or ask BayBay' : '搜索活动、指南，或问 BayBay'}</label><Search size={22} aria-hidden="true" /><input id={`${panelId}-search`} value={query} maxLength={500} placeholder={english ? 'Try “free museums” or “Where can I take my parents?”' : '搜「免费博物馆」，或问「带爸妈去哪？」'} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && event.nativeEvent.isComposing) event.preventDefault(); }} /><button type="submit" disabled={!query.trim()}>{isHomeQuestion(query) ? english ? 'Ask BayBay' : '问 BayBay' : english ? 'Search' : '搜索'}</button></form>
    <p className="home-search-help">{english ? 'Search with keywords; ask BayBay with a full question. AI answers are a reference.' : '关键词搜索全站，完整问题交给 BayBay。AI 回答供参考。'}</p>
    <nav className="home-search-suggestions" aria-label={english ? 'Quick discoveries' : '快速发现'}><Link to="/this-month?when=today">{english ? 'Today' : '今天'}</Link><Link to="/this-month?when=weekend&cost=free">{english ? 'Free this weekend' : '本周末免费'}</Link><Link to="/guides?q=%E6%97%A0%E8%BD%A6">{english ? 'Without a car' : '不开车也能去'}</Link></nav>
    <p className="home-trust"><ShieldCheck size={18} aria-hidden="true" />{english ? 'Official sources · Check dates and conditions before you go' : '官方来源 · 核对日期逐条标注 · 出发前再查条件'}</p>

    <section className="home-weekend" aria-labelledby={`${panelId}-weekend`}><div className="home-section-heading"><div><span className="home-section-kicker">{dateLabel(weekend.start)} — {dateLabel(weekend.end)}</span><h2 id={`${panelId}-weekend`}>{english ? 'Three ideas for this weekend' : '本周末，先看这三件事'}</h2></div><Link to="/this-month?when=weekend">{english ? `All ${weekend.total} events` : `全部 ${weekend.total} 场`}<ArrowRight size={18} aria-hidden="true" /></Link></div>
      {weekend.picks.length ? <div className="home-weekend-list">{weekend.picks.map(({ event, date }) => <article key={event.id} className="home-weekend-card"><time dateTime={date}><CalendarDays size={18} aria-hidden="true" />{dateLabel(date)}</time><h3><Link to={`/events/${event.id}`}>{event.title}</Link></h3><p className="home-weekend-facts">{event.city} · {event.venue}</p><p className="home-weekend-facts"><Ticket size={18} aria-hidden="true" />{event.costLabel}</p><p>{event.dateLabel}</p><p className="home-source">{event.sourceLabel} · {english ? 'Checked' : '核对'} {event.verifiedAt}</p><div className="home-weekend-actions"><Link className="home-tonal-button" to={`/plan?date=${date}&stops=${encodeURIComponent(`event:${event.id}`)}`}>{english ? 'Plan this day' : '加入这天计划'}</Link><a href={event.officialUrl} target="_blank" rel="noopener noreferrer">{english ? 'Official details' : '官方详情'}<ArrowUpRight size={16} aria-hidden="true" /></a></div></article>)}</div> : <div className="home-empty"><p>{english ? 'No confirmed events for this weekend yet. Try a year-round place or check the calendar.' : '这个周末暂没有已确认的活动，先看常设去处或换个日期。'}</p><Link to="/explore">{english ? 'Explore places' : '按地区找景点'}</Link></div>}
    </section>

    <section className="home-guide-selection" aria-labelledby={`${panelId}-guides`}><div className="home-section-heading"><h2 id={`${panelId}-guides`}>{english ? 'A guide for your next step' : '为你的下一步，选一篇指南'}</h2><Link to="/guides">{english ? `${guideCount} guides` : `${guideCount} 篇指南`}<ArrowRight size={18} aria-hidden="true" /></Link></div><div className="home-discovery-intents" role="group" aria-label={english ? 'Your next step' : '你想怎么发现湾区'}>{pathways.map(path => <button type="button" key={path.id} aria-pressed={intent === path.id} aria-controls={panelId} onClick={() => choose(path.id)}>{intent === path.id && <Check size={16} aria-hidden="true" />}{english ? path.en : path.label}</button>)}</div><div id={panelId} className="home-discovery-picks">{picks.map(guide => {
      const image = getGuideMedia(guide).cover;
      const provenance = getImageProvenance(image, english);
      return <article key={guide.slug} className="home-guide-card"><Link to={`/guides/${guide.slug}`} className="home-discovery-pick"><div className={`home-discovery-image${image.kind === 'poster' || image.fullFrame ? ' home-discovery-image--full' : ''}`}><img src={image.src} srcSet={image.srcSet} sizes="(max-width:639px) calc(100vw - 32px), 340px" alt={image.alt} width={image.width} height={image.height} loading="lazy" decoding="async" /><span className="home-discovery-image-label">{provenance}</span></div><div><span>{guide.categoryLabel} · {guide.readMinutes} {english ? 'min read' : '分钟'}</span><h3>{guide.title}</h3><p>{guide.summary}</p></div></Link><details className="home-discovery-credits"><summary>{english ? 'Image source' : '图片来源'}</summary><p>{image.caption}</p><p>{image.creditUrl ? <a href={image.creditUrl} target="_blank" rel="noopener noreferrer">{image.credit}</a> : image.credit}{image.licenseUrl && <> · <a href={image.licenseUrl} target="_blank" rel="noopener noreferrer">{english ? 'License' : '授权说明'}</a></>}</p></details></article>;
    })}</div></section>

    {offers.length > 0 && <section className="home-offers" aria-labelledby={`${panelId}-offers`}><div className="home-section-heading"><h2 id={`${panelId}-offers`}>{english ? 'Offers with a date' : '免费与优惠，先看日期与条件'}</h2><Link to="/this-month#monthly-perks">{english ? 'All offers' : '查看全部'}<ArrowRight size={18} aria-hidden="true" /></Link></div><div className="home-offer-list">{offers.map(offer => <article key={offer.id}><span className="home-section-kicker">{offer.brand}</span><h3><Link to={`/offers/${offer.id}`}>{offer.title}</Link></h3><p className="home-weekend-facts">{offer.dateLabel}</p><p>{offer.requirement}</p><a href={offer.sourceUrl} target="_blank" rel="noopener noreferrer">{english ? 'Official conditions' : '官方领取条件'}<ArrowUpRight size={16} aria-hidden="true" /></a></article>)}</div></section>}
    <section className="home-weekly-share"><a href="/weekly/all.png" download onClick={() => recordProductEvent('share_card_download')}>{english ? 'Share three ideas for this weekend' : '分享本周三件事'}</a><a href="webcal://www.baylink.us/calendars/all.ics">{english ? 'Subscribe to Bay Area event dates' : '订阅区域活动日历'}</a><p>{english ? 'Calendars update with site releases. Listings without confirmed times use all-day reminders, not reservations. In WeChat, open the card and press and hold to save it.' : '日历随网站发布更新；没有确认时段的活动使用全天提醒，不代表预约。在微信中打开分享图后，可长按保存。'}</p></section>
    <nav className="home-useful-links" aria-label={english ? 'Useful next steps' : '办事与下一步'}><Link to="/guides/bay-area-rental-scam-guide">{english ? 'Avoid rental scams' : '租房防骗'}</Link><Link to="/tools">{english ? 'Messages, costs and conversions' : '英文消息、算账与换算'}</Link><Link to="/my-week">{english ? 'My saved plans' : '我的收藏与计划'}</Link><button type="button" onClick={onBrowseCommunity}>{english ? 'Neighborhood board' : '查看邻里信息'}</button></nav>
    <Link to="/opus-bay?from=home" reloadDocument className="home-world-link"><TramFront size={28} aria-hidden="true" /><span><strong>{english ? '3D San Francisco' : '3D 旧金山 · 湾区小旅'}</strong><small>{english ? 'Explore the city, then read local guides. Opens a separate 3D experience.' : '先逛一座城，再读当地攻略。打开独立 3D 体验。'}</small></span><ArrowRight size={20} aria-hidden="true" /></Link>
  </section>;
}
