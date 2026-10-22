import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { BookOpen, CalendarDays, Heart, MapPin, Search } from 'lucide-react';
import { setPageMetadata } from '../lib/seo';
import { translateText, useLocale } from '../i18n/locale';
import { useApp } from '../app/context';
import { LazyFeedbackLink } from '../features/feedback/LazyEntryLinks';
import { Button } from '../components/ui/Button';
import '../components/not-found.css';

/**
 * A friendly 404 in three languages (WEB-SECONDARY-B; UI9-NAV content arrangement §9): on the 1216 frame at x = 112, left
 * aligned in columns 1-8 — "404" as a 14px caption, the H1, one help line, a search, the four places people usually want
 * (2 x 2 on a desktop), 回到首页 / 问 BayBay, 反馈与报错. No illustration (P32).
 * The event, offer, opening and guide pages render it for a missing id, so it stays inside their budgeted JS graphs: its
 * only primitive is the site Button (UI9-R1 N12), which those pages already load; not-found.css draws the rest with tokens.
 */
export default function NotFoundPage() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const locale = useLocale();
  const t = (zh: string, en: string) => locale === 'en' ? en : translateText(zh, locale);
  // The prerendered 404.html has no app context; BayBay is offered once the app is running.
  const app = useApp() as ReturnType<typeof useApp> | undefined;
  const [query, setQuery] = useState('');
  // Written in the reader's language here (the dictionary has no English for the description), so preserveText.
  const metaTitle = t('页面不存在｜BAYLINK', 'Page not found | BAYLINK');
  const metaDescription = t('没有找到这个页面。请检查链接，或返回 BAYLINK 首页和生活指南。', 'We couldn’t find this page. Check the link, or go back to the BAYLINK home page or the guides.');
  useEffect(() => {
    setPageMetadata({ title: metaTitle, description: metaDescription, path: pathname, noindex: true, preserveText: true });
  }, [pathname, metaTitle, metaDescription]);
  const links = [
    { to: '/events', icon: CalendarDays, label: t('本周末活动', 'This weekend'), note: t('活动、免费福利和新店', 'Events, free benefits, new shops') },
    { to: '/guides', icon: BookOpen, label: t('办事指南', 'Guides'), note: t('医疗、证件、住房、出行', 'Health, IDs, housing, transport') },
    { to: '/guides?topic=elders', icon: Heart, label: t('长辈与家属', 'Seniors and families'), note: t('长者服务、Medicare、免费交通', 'Senior services, Medicare, free rides') },
    { to: '/explore', icon: MapPin, label: t('按地区找景点', 'Places by area'), note: t('旧金山、东湾、半岛、南湾、北湾', 'SF, East Bay, Peninsula, South Bay, North Bay') },
  ];
  return <div className="nf-page">
    <section className="nf-hero" aria-labelledby="nf-title">
      <p className="nf-code">404</p>
      <h1 id="nf-title">{t('没有找到这个页面', 'We couldn’t find this page')}</h1>
      <p className="nf-body">{t('链接可能有误，或内容已经移除。可以搜索一下，或从下面几个常用入口继续。', 'The link may be wrong, or the page was removed. Try a search, or pick up from one of the places below.')}</p>
      <form role="search" className="nf-search" onSubmit={event => { event.preventDefault(); if (query.trim()) navigate(`/guides?${new URLSearchParams({ q: query.trim() })}`); }}>
        <label htmlFor="missing-page-search" className="sr-only">{t('搜索生活指南', 'Search guides')}</label>
        <span className="nf-search-field"><Search aria-hidden="true" strokeWidth={1.75} /><input id="missing-page-search" type="search" value={query} onChange={event => setQuery(event.target.value)} maxLength={200} placeholder={t('搜指南或生活问题', 'A guide or a question')} /></span>
        <Button type="submit" variant="primary">{t('搜索', 'Search')}</Button>
      </form>
    </section>
    <nav className="nf-links" aria-label={t('常用入口', 'Popular places')}>
      <ul>
        {links.map(({ to, icon: Icon, label, note }) => <li key={to}><Link to={to}><span className="nf-link-icon" aria-hidden="true"><Icon strokeWidth={1.75} /></span><span><strong>{label}</strong><small>{note}</small></span></Link></li>)}
      </ul>
    </nav>
    <div className="nf-actions">
      <Button to="/">{t('回到首页', 'Back to home')}</Button>
      {app?.openBayBay && <Button onClick={() => app.openBayBay()} onPointerEnter={app.warmBayBay} onFocus={app.warmBayBay}>{t('问 BayBay', 'Ask BayBay')}</Button>}
    </div>
    {/* A broken link someone followed is exactly what we want to hear about. */}
    <div className="nf-feedback"><LazyFeedbackLink /></div>
  </div>;
}
