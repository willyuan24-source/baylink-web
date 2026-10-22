import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { useUiCopy } from '../../components/ui/ui-copy';
import { HOME_TILES } from '../../lib/home-catalog';

type Mood = { id: string; to: string; zh: string; en: string; blurb: { zh: string; en: string; hant?: string } };
/**
 * Each tile opens a filtered list that exists today: the events column's own filters, the calendar, a guide search.
 * 长辈友好 follows the /events rule for its story chips (shown only with a count above 0): with no 长辈友好 event this
 * weekend (or an unknown count) it opens the 长辈与家属 guides instead of an empty list (H06 / HOMEIA13-01).
 */
const SENIOR_GUIDES = '/guides?topic=elders';
const SENIORS = '/events?tag=seniors';
// The names and the one-line blurbs of UI9-IMAGES CATEGORIES.json `tiles` (DECISIONS 27).
const MOODS: readonly Mood[] = [
  { id: 'today', to: '/events?when=today', zh: '今天去哪', en: 'Today', blurb: { zh: '今天就能去', en: 'Go today' } },
  { id: 'free', to: '/events?cost=free', zh: '免费', en: 'Free', blurb: { zh: '不花钱也好玩', en: 'Fun for free' } },
  { id: 'kids', to: '/events?tag=kids', zh: '亲子', en: 'Kids', blurb: { zh: '带孩子的好去处', en: 'Out with kids' } },
  { id: 'seniors', to: SENIORS, zh: '长辈友好', en: 'Seniors', blurb: { zh: '长辈走得轻松', en: 'Easy for elders' } },
  { id: 'rainy-day', to: '/events?tag=indoor', zh: '下雨也行', en: 'Rainy day', blurb: { zh: '室内也有得逛', en: 'Indoor picks' } },
  { id: 'no-car', to: '/guides?q=%E6%97%A0%E8%BD%A6', zh: '不开车', en: 'No car', blurb: { zh: '坐公交也能到', en: 'By transit', hant: '坐公車也能到' } },
  { id: 'new-shops', to: '/events?view=openings', zh: '街角新店', en: 'New shops', blurb: { zh: '附近新开的店', en: 'Just opened' } },
  // OPUS contract: an eager, client-side link to /calendar (tests/opus-bay-w9-e-switch.test.tsx).
  { id: 'calendar', to: '/calendar', zh: '按日历看', en: 'Calendar view', blurb: { zh: '按日子挑活动', en: 'Plan by date' } },
];

/**
 * ③ 按需要找 (UI9-HOME; UI9-IMAGES DECISIONS 27): eight photo tiles, each a navigation photo (home-tile-photos.json, the
 * 480 w file, lazy, a fixed frame) under a warm scrim with the entry's name and one short line — no counts (decision 19),
 * no 示意图 badge (the photos are credited in 本页图片来源). 2 × 4 on a phone, 4 × 2 in the masthead column on a desktop, a
 * grid at 大 / 特大 (no sideways row, N25); 简洁 hides the block. New .home-mood rules; the shared .ui-chip is untouched.
 */
export function MoodCircles({ seniors }: { /** 长辈友好 events this weekend; null when the build did not count this day. */ seniors?: number | null }) {
  const { t } = useUiCopy();
  return <nav className="home-moods" aria-label={t('按需要找', 'Browse by need')} data-simple="hide">
    <ul>{MOODS.map(({ id, zh, en, to, blurb }) => {
      const photo = Object.hasOwn(HOME_TILES, id) ? HOME_TILES[id] : undefined;
      const focal = photo?.focal ?? [50, 50];
      return <li key={id}>
        <Link to={to === SENIORS && !seniors ? SENIOR_GUIDES : to} className="home-mood" data-tile={id} style={{ '--ui-lqip': photo?.lqip } as CSSProperties}>
          {photo && <img className="home-mood__img" src={photo.src} alt="" width={photo.width} height={photo.height} loading="lazy" decoding="async" style={{ objectPosition: `${focal[0]}% ${focal[1]}%` }} />}
          {/* The link is named by the entry alone (按日历看, the OPUS contract's name); its line is what the eye reads with it. */}
          <span className="home-mood__text"><span className="home-mood__label">{t(zh, en)}</span><span className="home-mood__blurb" aria-hidden="true">{t(blurb.zh, blurb.en, blurb.hant)}</span></span>
        </Link>
      </li>;
    })}</ul>
  </nav>;
}
