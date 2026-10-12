import { Baby, CalendarDays, Gift, HeartHandshake, Store, Sun, TramFront, Umbrella, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useUiCopy } from '../../components/ui/ui-copy';

type Mood = { to: string; zh: string; en: string; icon: LucideIcon; tone: string };
/** Each circle opens a filtered list that exists today: the events column's own filters, the calendar, a guide search. */
const MOODS: readonly Mood[] = [
  { to: '/events?when=today', zh: '今天去哪', en: 'Today', icon: Sun, tone: 'food' },
  { to: '/events?cost=free', zh: '免费', en: 'Free', icon: Gift, tone: 'free' },
  { to: '/events?tag=kids', zh: '亲子', en: 'Kids', icon: Baby, tone: 'family' },
  { to: '/events?tag=seniors', zh: '长辈友好', en: 'Seniors', icon: HeartHandshake, tone: 'seniors' },
  { to: '/events?tag=indoor', zh: '下雨也行', en: 'Rainy day', icon: Umbrella, tone: 'culture' },
  { to: '/guides?q=%E6%97%A0%E8%BD%A6', zh: '不开车', en: 'No car', icon: TramFront, tone: 'outdoors' },
  { to: '/events?view=openings', zh: '街角新店', en: 'New shops', icon: Store, tone: 'food' },
  // OPUS contract: an eager, client-side link to /calendar (tests/opus-bay-w9-e-switch.test.tsx).
  { to: '/calendar', zh: '按日历看', en: 'Calendar view', icon: CalendarDays, tone: 'culture' },
];

/** ③ 按心情找 (1007 §4.2 ③): one swipeable row of round entries, replacing the text links that were scattered in three places. */
export function MoodCircles() {
  const { t } = useUiCopy();
  return <nav className="home-moods" aria-label={t('按心情找', 'Browse by mood')}>
    <ul>{MOODS.map(({ to, zh, en, icon: Icon, tone }) => <li key={to}>
      <Link to={to} className="home-mood" data-tone={tone}>
        <span className="home-mood__icon" aria-hidden="true"><Icon strokeWidth={1.75} /></span>
        <span className="home-mood__label">{t(zh, en)}</span>
      </Link>
    </li>)}</ul>
  </nav>;
}
