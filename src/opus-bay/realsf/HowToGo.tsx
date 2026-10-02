import { useEffect, useState } from 'react';
import { ExternalLink, Ticket, TramFront } from 'lucide-react';
import type { CatalogEvent, Vec2 } from '../core/types';
import { offerUrl } from '../data/links';
import { loadTransit } from '../data/transit';
import { bayNow, bayParts } from '../game/bayNow';
import { useT } from '../i18n';
import { formatDay } from '../ui/format';
import { eventDayHours } from './freeWeek';
import { CHASE_MUNI, CHASE_MUNI_NOTE, chaseMuniAt } from './chaseMuni';
import { CHECK_511, loadedRealStops, nearestRealStops, serviceLabel, URL_511, type RealStop } from './transitReal';
import './realsf.css';

/**
 * Wave 5 · lane R (W5-R7) · 现实中怎么去: under an event card (and any card that passes a point, lane C's place cards
 * by request), the nearest stop of each real Muni line the game also runs (N, M, F, the three cable-car lines; never
 * the game's own sightseeing loop), the real walking minutes, the line's real hours and daytime headway from sfmta.com,
 * and 出发前查 SFMTA / 511 确认. Lazy: ui/EventCardBody.tsx imports it with React.lazy, city mode only.
 *
 * W7-S: a card at Chase Center (its events, its place card) adds one line: an event ticket there includes that day's
 * Muni buses and light rail (BAYLINK's offer page `chase-center-ticket-muni-included`, SFMTA's rule).
 */


/** `day` / `event` (W9-R7): an event card's next day and the event — the rows show that day's headways at its start, not now's. */
export default function HowToGo({ point, day, event }: { point: Vec2; day?: string; event?: CatalogEvent }) {
  const { t, locale } = useT();
  const [stops, setStops] = useState<RealStop[]>(() => loadedRealStops());
  useEffect(() => {
    let on = true;
    if (!stops.length) void loadTransit().then(() => { if (on) setStops(loadedRealStops()); });
    return () => { on = false; };
  }, [stops.length]);
  const now = bayNow(), p = bayParts(now);
  const onDay = !!day;
  const dateKey = day ?? p.dateKey;
  // the event's start; a day without a time: midday (its daytime headway); today without a time: now
  const minute = day && event ? eventDayHours(event, day)?.[0] : undefined;
  const at = minute ?? (day && day !== p.dateKey ? 12 * 60 : p.hour * 60 + p.minute);
  const near = nearestRealStops(point, stops);
  const chase = chaseMuniAt(point);
  const muni = chase && (
    <p className="ob-howto-offer">
      <Ticket size={14} aria-hidden />
      <span>{t(CHASE_MUNI_NOTE)} · <a href={offerUrl(CHASE_MUNI.offerId, locale)} target="_blank" rel="noopener">{t('BAYLINK 优惠详情', 'BAYLINK offer')}<ExternalLink size={11} aria-hidden /></a></span>
    </p>
  );
  if (!near.length) return muni ? <section className="ob-block ob-howto">{muni}</section> : null;
  const checked = near[0].line.verifiedAt;
  return (
    <section className="ob-block ob-howto">
      <h3 className="ob-h3"><TramFront size={15} aria-hidden />{t('现实中怎么去', 'Getting there for real')}{onDay && day !== p.dateKey ? ` · ${formatDay(dateKey, locale)}` : ''}</h3>
      {muni}
      <ul className="ob-howto-rows">
        {near.map(n => (
          <li key={n.line.id}>
            <strong>{t(n.line.name)}</strong>
            <span>{t(n.stop.name)} · {t(`步行约 ${n.walkMin} 分钟`, `~${n.walkMin} min walk`)}</span>
            <small>{t(serviceLabel(n.line, dateKey, at, onDay))}</small>
          </li>
        ))}
      </ul>
      <p className="ob-source">
        {t(CHECK_511)} · {near.map((n, i) => (
          <span key={n.line.id}>{i > 0 && ' · '}<a href={n.line.sourceUrl} target="_blank" rel="noopener noreferrer">{t(`sfmta.com · ${n.line.name.zh}`, `sfmta.com · ${n.line.name.en}`)}<ExternalLink size={11} aria-hidden /></a></span>
        ))} · <a href={URL_511} target="_blank" rel="noopener noreferrer">511<ExternalLink size={11} aria-hidden /></a> · {t('查证于', 'checked')} {checked}
      </p>
    </section>
  );
}
