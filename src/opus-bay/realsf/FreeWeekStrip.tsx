import { useEffect, useState, useSyncExternalStore } from 'react';
import { CalendarPlus, ExternalLink, Gift, Navigation, Newspaper } from 'lucide-react';
import type { Bilingual } from '../core/types';
import { useCatalog } from '../data/catalog';
import { offerUrl } from '../data/links';
import { bayNow, bayParts } from '../game/bayNow';
import { openEvent } from '../game/flow';
import { goTo } from '../game/goTo';
import { catalogText, useT } from '../i18n';
import { addToCalendar } from './addCal';
import { dayLabel, eventDayHours, freeWeek, type FreeItem } from './freeWeek';
import { liveOffers, loadLive, subscribeLive } from './live';
import { hm } from './todayRows';
import './realsf.css';

/**
 * Wave 9 · lane R (W9-R3) · 「这周免费」 (review R§5 #10): the next 7 Bay days as day chips, each with how many free things
 * it has (BAYLINK's offers that day — the zoo's resident day, Asian Art's first Sunday … — and the catalog's free San
 * Francisco events); the chosen day's list with 带我去 (N's goTo), 看看 (the event card), 加到日历 (an .ics with a
 * reminder the day before: realsf/ics.ts, loaded on the tap) and the offer's BAYLINK page. The first day with something
 * is chosen. Its own lazy chunk (ui/WeekPanel.tsx, city mode).
 *
 *   <FreeWeekStrip limit={2} />   the 这周去哪 questions: two rows under the chips
 *   <FreeWeekStrip limit={6} />   「免费就好」's board: the offers merged in above the flyers
 */

const HEAD: Bilingual = { zh: '这周免费', en: 'Free this week' };

export default function FreeWeekStrip({ limit = 3, title = HEAD, companions = null }: { limit?: number; title?: Bilingual; companions?: string | null }) {
  const { t } = useT();
  const catalog = useCatalog();
  const offers = useSyncExternalStore(subscribeLive, liveOffers, liveOffers);
  useEffect(() => { void loadLive(); }, []);
  const today = bayParts(bayNow()).dateKey;
  const week = freeWeek(today, 7, offers, catalog, companions);
  const first = Math.max(0, week.findIndex(d => d.items.length > 0));
  const [picked, setPicked] = useState<number | null>(null);
  const k = picked ?? first;
  const day = week[k];
  if (!offers && !catalog) return null;
  const shown = day.items.slice(0, limit);
  const more = day.items.length - shown.length;
  return (
    <section className="ob-free" aria-label={t(title)}>
      <h3 className="ob-h3"><Gift size={15} aria-hidden />{t(title)}<small className="ob-free-sub">{t('未来 7 天 · 以官网为准', 'Next 7 days')}</small></h3>
      <div className="ob-free-days" role="tablist" aria-label={t('选一天', 'Pick a day')}>
        {week.map((d, i) => {
          const l = dayLabel(d.day);
          const n = d.items.length;
          return (
            <button key={d.day} type="button" role="tab" aria-selected={i === k} className={`ob-free-day${i === k ? ' is-on' : ''}${n ? '' : ' is-empty'}`}
              onClick={() => setPicked(i)} aria-label={t(`${l.zh}，${n} 个免费`, `${l.en}, ${n} free`)}>
              <small>{i === 0 ? t('今天', 'Today') : t(l.zh.split(' ')[1], l.en.split(' ')[0])}</small>
              <strong>{l.zh.split(' ')[0]}</strong>
              <em aria-hidden>{n || '·'}</em>
            </button>
          );
        })}
      </div>
      {shown.length === 0 ? (
        <p className="ob-muted ob-free-none">{t('这天 BAYLINK 还没收录免费的活动或福利。', 'Nothing free listed on BAYLINK for this day yet.')}</p>
      ) : (
        <ul className="ob-today-rows ob-free-items" role="tabpanel">
          {shown.map(item => <FreeRow key={item.kind === 'offer' ? `o-${item.offer.id}` : `e-${item.event.id}`} item={item} />)}
        </ul>
      )}
      {more > 0 && <p className="ob-muted ob-free-more">{t(`这天还有 ${more} 个免费的，旅行本「今天」和 BAYLINK 日历里都有`, `${more} more free that day — in the journal’s Today page and the BAYLINK calendar`)}</p>}
      <small className="ob-today-src">{t('来自 BAYLINK 的优惠和活动库，每条都有来源和查证日期', 'From BAYLINK’s offers and events, each with its source and check date')}</small>
    </section>
  );
}

function FreeRow({ item }: { item: FreeItem }) {
  const { t, locale } = useT();
  const calendar = (
    <button type="button" className="ob-btn ob-btn-ghost ob-btn-sm ob-free-cal" onClick={() => addToCalendar(item)}
      aria-label={t('加到日历（提前一天提醒）', 'Add to calendar (a reminder the day before)')}>
      <CalendarPlus size={15} aria-hidden /><span>{t('加到日历', 'Calendar')}</span>
    </button>
  );
  if (item.kind === 'offer') {
    const { offer, hours } = item;
    const place = offer.place;
    return (
      <li className="ob-today-row ob-free-row">
        <span className="ob-today-ico" aria-hidden><Gift size={15} /></span>
        <div className="ob-today-main">
          <strong>{t(offer.title)}</strong>
          <small>{hours ? `${hm(hours[0])}–${hm(hours[1])} · ` : ''}{t(offer.who)}</small>
          <small className="ob-today-src">
            <a href={offerUrl(offer.id, locale)} target="_blank" rel="noopener">{t('BAYLINK 福利详情', 'BAYLINK offer')}<ExternalLink size={11} aria-hidden /></a>
            {' · '}<a href={offer.source.url} target="_blank" rel="noopener noreferrer">{t('官网', 'official')}<ExternalLink size={11} aria-hidden /></a>
            {' · '}{t('查证于', 'checked')} {offer.source.verifiedAt}
          </small>
        </div>
        <div className="ob-today-side">
          {place && (
            <button type="button" className="ob-btn ob-btn-soft ob-btn-sm ob-today-go" aria-label={t(`带我去${place.name.zh}`, `Take me to ${place.name.en}`)}
              onClick={() => { void goTo({ ...(place.id ? { placeId: place.id } : {}), point: { x: place.x, z: place.z }, name: place.name }, { source: 'realsf:free' }); }}>
              <Navigation size={14} aria-hidden /><span>{t('带我去', 'Go')}</span>
            </button>
          )}
          {calendar}
        </div>
      </li>
    );
  }
  const { event } = item;
  // the day's hours as numbers (the catalog's date label is Chinese: never in an English row)
  const hours = eventDayHours(event, item.day);
  return (
    <li className="ob-today-row ob-free-row">
      <span className="ob-today-ico" aria-hidden><Newspaper size={15} /></span>
      <div className="ob-today-main">
        <strong>{event.title}</strong>
        <small>{[hours ? `${hm(hours[0])}–${hm(hours[1])}` : null, event.venue ? catalogText(event.venue.split(' · ')[0], locale) : null].filter(Boolean).join(' · ')}</small>
      </div>
      <div className="ob-today-side">
        <button type="button" className="ob-btn ob-btn-soft ob-btn-sm ob-today-go" onClick={() => openEvent(event.id)}>
          <span>{t('看看', 'See')}</span>
        </button>
        {calendar}
      </div>
    </li>
  );
}
