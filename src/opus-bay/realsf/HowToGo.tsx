import { useEffect, useState } from 'react';
import { ExternalLink, TramFront } from 'lucide-react';
import type { Vec2 } from '../core/types';
import { loadTransit } from '../data/transit';
import { bayNow, bayParts } from '../game/bayNow';
import { useT } from '../i18n';
import { CHECK_511, loadedRealStops, nearestRealStops, serviceLabel, URL_511, type RealStop } from './transitReal';
import './realsf.css';

/**
 * Wave 5 · lane R (W5-R7) · 现实中怎么去: under an event card (and any card that passes a point, lane C's place cards
 * by request), the nearest stop of each real Muni line the game also runs (N, M, F, the three cable-car lines; never
 * the game's own sightseeing loop), the real walking minutes, the line's real hours and daytime headway from sfmta.com,
 * and 出发前查 SFMTA / 511 确认. Lazy: ui/EventCardBody.tsx imports it with React.lazy, city mode only.
 */

export default function HowToGo({ point }: { point: Vec2 }) {
  const { t } = useT();
  const [stops, setStops] = useState<RealStop[]>(() => loadedRealStops());
  useEffect(() => {
    let on = true;
    if (!stops.length) void loadTransit().then(() => { if (on) setStops(loadedRealStops()); });
    return () => { on = false; };
  }, [stops.length]);
  const now = bayNow(), p = bayParts(now);
  const near = nearestRealStops(point, stops);
  if (!near.length) return null;
  const checked = near[0].line.verifiedAt;
  return (
    <section className="ob-block ob-howto">
      <h3 className="ob-h3"><TramFront size={15} aria-hidden />{t('现实中怎么去', 'Getting there for real')}</h3>
      <ul className="ob-howto-rows">
        {near.map(n => (
          <li key={n.line.id}>
            <strong>{t(n.line.name)}</strong>
            <span>{t(n.stop.name)} · {t(`步行约 ${n.walkMin} 分钟`, `~${n.walkMin} min walk`)}</span>
            <small>{t(serviceLabel(n.line, p.dateKey, p.hour * 60 + p.minute))}</small>
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
