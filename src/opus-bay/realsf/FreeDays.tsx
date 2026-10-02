import { useEffect, useSyncExternalStore } from 'react';
import { CalendarPlus, ExternalLink, Gift } from 'lucide-react';
import type { Vec2 } from '../core/types';
import { offerUrl } from '../data/links';
import { bayNow, bayParts } from '../game/bayNow';
import { useT } from '../i18n';
import { addToCalendar } from './addCal';
import { alwaysFreeAt, dayLabel, freeDaysAt } from './freeWeek';
import { liveOffers, loadLive, subscribeLive } from './live';
import { hm } from './todayRows';
import './realsf.css';

/**
 * Wave 9 · lane R (W9-R3) · a place card's 「近 7 天免费」 (review R§5 #10: the zoo's card said 需要买票 with the resident free
 * day three days away): BAYLINK's offers at this place (within NEAR_PLACE u of the card's point) on the next 7 Bay days,
 * each with its hours, who it is for, 加到日历 and its BAYLINK page; a place free on most days gets one 常年免费 line.
 * Nothing when the place has none. Its own lazy chunk (ui/PoiCardBody.tsx, ui/PlaceCard.tsx; city mode).
 */
export default function FreeDays({ point, ids = [] }: { point: Vec2; ids?: readonly string[] }) {
  const { t, locale } = useT();
  const offers = useSyncExternalStore(subscribeLive, liveOffers, liveOffers);
  useEffect(() => { void loadLive(); }, []);
  const today = bayParts(bayNow()).dateKey;
  const days = freeDaysAt(point, today, 7, offers, ids);
  const always = alwaysFreeAt(point, offers, ids);
  if (!days.length && !always.length) return null;
  return (
    <section className="ob-block ob-free-place" aria-label={t('近 7 天免费', 'Free in the next 7 days')}>
      <h3 className="ob-h3"><Gift size={15} aria-hidden />{days.length ? t('近 7 天免费', 'Free in the next 7 days') : t('免费', 'Free')}</h3>
      <ul className="ob-today-rows">
        {days.map(item => item.kind === 'offer' && (
          <li key={`${item.offer.id}-${item.day}`} className="ob-today-row ob-free-row">
            <span className="ob-today-ico" aria-hidden><Gift size={15} /></span>
            <div className="ob-today-main">
              <strong>{item.day === today ? t('今天', 'Today') : t(dayLabel(item.day))}{item.hours ? ` · ${hm(item.hours[0])}–${hm(item.hours[1])}` : ''}</strong>
              <small>{t(item.offer.title)} · {t(item.offer.who)}</small>
              <small className="ob-today-src">
                <a href={offerUrl(item.offer.id, locale)} target="_blank" rel="noopener">{t('BAYLINK 福利详情', 'BAYLINK offer')}<ExternalLink size={11} aria-hidden /></a>
                {' · '}{t('查证于', 'checked')} {item.offer.source.verifiedAt} · {t('以官网为准', 'check before you go')}
              </small>
            </div>
            <div className="ob-today-side">
              <button type="button" className="ob-btn ob-btn-ghost ob-btn-sm ob-free-cal" onClick={() => addToCalendar(item)}
                aria-label={t('加到日历（提前一天提醒）', 'Add to calendar (a reminder the day before)')}>
                <CalendarPlus size={15} aria-hidden /><span>{t('加到日历', 'Calendar')}</span>
              </button>
            </div>
          </li>
        ))}
        {always.map(o => (
          <li key={o.id} className="ob-today-row">
            <span className="ob-today-ico" aria-hidden><Gift size={15} /></span>
            <div className="ob-today-main">
              <strong>{t('常年免费', 'Free most days')}</strong>
              <small>{t(o.title)} · {t(o.who)}</small>
              <small className="ob-today-src"><a href={offerUrl(o.id, locale)} target="_blank" rel="noopener">{t('BAYLINK 福利详情', 'BAYLINK offer')}<ExternalLink size={11} aria-hidden /></a> · {t('查证于', 'checked')} {o.source.verifiedAt}</small>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
