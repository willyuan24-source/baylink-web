import { Baby, CalendarDays, Gift, HeartHandshake, Store, Sun, TramFront, Umbrella, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useUiCopy } from '../../components/ui/ui-copy';

type Mood = { to: string; zh: string; en: string; icon: LucideIcon };
/**
 * Each chip opens a filtered list that exists today: the events column's own filters, the calendar, a guide search.
 * 长辈友好 follows the /events rule for its story chips (shown only with a count above 0): with no 长辈友好 event this
 * weekend (or an unknown count) it opens the 长辈与家属 guides instead of an empty list (H06 / HOMEIA13-01).
 */
const SENIOR_GUIDES = '/guides?topic=elders';
const SENIORS = '/events?tag=seniors';
const MOODS: readonly Mood[] = [
  { to: '/events?when=today', zh: '今天去哪', en: 'Today', icon: Sun },
  { to: '/events?cost=free', zh: '免费', en: 'Free', icon: Gift },
  { to: '/events?tag=kids', zh: '亲子', en: 'Kids', icon: Baby },
  { to: SENIORS, zh: '长辈友好', en: 'Seniors', icon: HeartHandshake },
  { to: '/events?tag=indoor', zh: '下雨也行', en: 'Rainy day', icon: Umbrella },
  { to: '/guides?q=%E6%97%A0%E8%BD%A6', zh: '不开车', en: 'No car', icon: TramFront },
  { to: '/events?view=openings', zh: '街角新店', en: 'New shops', icon: Store },
  // OPUS contract: an eager, client-side link to /calendar (tests/opus-bay-w9-e-switch.test.tsx).
  { to: '/calendar', zh: '按日历看', en: 'Calendar view', icon: CalendarDays },
];

/**
 * ③ 按需要找 (UI9-HOME): eight neutral chips in two wrapped rows on a phone, 4 × 2 tiles in the masthead column on a
 * desktop; one look, the icon in brand green, no counts (decision 19).
 */
export function MoodCircles({ seniors }: { /** 长辈友好 events this weekend; null when the build did not count this day. */ seniors?: number | null }) {
  const { t } = useUiCopy();
  return <nav className="home-moods" aria-label={t('按需要找', 'Browse by need')} data-simple="hide">
    <ul>{MOODS.map(({ zh, en, to, icon: Icon }) => <li key={zh}>
      <Link to={to === SENIORS && !seniors ? SENIOR_GUIDES : to} className="ui-chip home-mood">
        <Icon aria-hidden="true" strokeWidth={1.75} /><span className="home-mood__label">{t(zh, en)}</span>
      </Link>
    </li>)}</ul>
  </nav>;
}
