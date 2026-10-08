import { Link } from 'react-router-dom';
import { MonthlyEdition } from './MonthlyEdition';
import { translateText, useLocale } from '../i18n/locale';
import { getBayAreaToday, getMonthlyDateRange } from '../lib/monthly';

/**
 * 活动 (plan D3): the events column opens on 本周末. First cut (WEB-ROUTES): its own H1 and the four views over the
 * existing weekend list; WEB-EVENTS replaces the body in wave 2. 日历·地图 stays at /calendar through R1; 免费与优惠
 * and 新店 jump to their sections below until they become views. Styles: pages/events-page.css (loaded with the route).
 */
export function EventsView({ today }: { today?: string }) {
  const locale = useLocale();
  const t = (zh: string, en: string) => locale === 'en' ? en : translateText(zh, locale);
  const weekend = getMonthlyDateRange('weekend', today || getBayAreaToday())!;
  const day = (value: string) => new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : locale, { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`));
  const masthead = <header className="events-masthead">
    <h1>{t('活动', 'Events')}</h1>
    <p className="events-masthead-range">{t('本周末', 'This weekend')} · <time dateTime={weekend.start}>{day(weekend.start)}</time> – <time dateTime={weekend.end}>{day(weekend.end)}</time></p>
    <nav className="events-segments" aria-label={t('活动分区', 'Event views')}>
      <Link to="/events" aria-current="page">{t('本周末', 'This weekend')}</Link>
      <Link to="/calendar">{t('日历·地图', 'Calendar & map')}</Link>
      <a href="#monthly-perks">{t('免费与优惠', 'Free & deals')}</a>
      <a href="#monthly-openings">{t('新店', 'New openings')}</a>
    </nav>
  </header>;
  return <MonthlyEdition today={today} defaultDateFilter="weekend" masthead={masthead} />;
}
