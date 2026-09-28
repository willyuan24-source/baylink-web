import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ExternalLink, Info, Navigation } from 'lucide-react';
import { unproject } from '../core/geo';
import { runtime } from '../core/runtime';
import { useGame } from '../core/store';
import type { Bilingual } from '../core/types';
import { landmarkAreaAt, zoneName } from '../data/cityZones';
import { mapsUrl } from '../data/links';
import type { Attraction } from '../data/sf/attractionTypes';
import type { CityPlace } from '../data/sf/places';
import { isDiscovered, useDiscoveryEpoch } from '../game/discovery';
import { openPanel } from '../game/flow';
import { type PlaceTripDest, startPlaceTrip } from '../game/placeTrips';
import { planTrips } from '../game/tripPlan';
import { tripProviders, tripRouteCache } from '../game/tripProviders';
import type { TripOption } from '../game/tripTypes';
import { cityTravelLabel } from '../game/travel';
import { useT } from '../i18n';
import { TripOptions } from './TripOptions';
import { placeTripDest } from './mapTrips';
import { tripSecondsLabel } from './tripRows';

/** The walking route to the place as the map knows it (G1-8): being found, found (its honest label), or none. */
export type WalkInfo = { state: 'pending' } | { state: 'ok'; label: Bilingual } | { state: 'none' };

/**
 * Every honest way to the destination (lane G's planTrips with the live providers), planned from where the player
 * stood when the card opened (lane G's review O5: re-reading the position on every landing would start new searches
 * while a ride moves you), again each time a route search lands (计算中… until then).
 */
function useTripOptions(dest: PlaceTripDest | null): { options: TripOption[]; busy: boolean } {
  const from = useMemo(() => ({ x: runtime.player.x, z: runtime.player.z }), [dest?.placeId, dest?.x, dest?.z]); // eslint-disable-line react-hooks/exhaustive-deps
  const [rev, setRev] = useState(0);
  useEffect(() => tripRouteCache().subscribe(() => setRev(r => r + 1)), []);
  return useMemo(() => {
    if (!dest) return { options: [], busy: false };
    const options = planTrips(from, dest, tripProviders());
    return { options, busy: options.some(o => o.legs.some(l => l.estimate)) };
  }, [dest, from, rev]); // eslint-disable-line react-hooks/exhaustive-deps
}

/**
 * The card under a selected city place or attraction (lane G1 in wave 3; wave 4 lane P, W4-P11, plan §4.2 "带我去 →
 * 跟 BAYBAY 去"): the full name (never cut: it wraps), the area, the honest time, a visit note (closures, days);
 * one row of ≥ 44 px buttons:
 *   跟 BAYBAY 去   the recommended way (lane G's planTrips: fastest non-fly, or the one that completes an open goal)
 *   其他方式 ▾     the other ways as TripOptions rows (步行 / 跑过去 / 骑车 / 开车 / 观光巴士 2 站 / 飞过去 — fly once
 *                  discovered), each with its real play time
 *   ⓘ 详情         the card (the district POI for merged hero places, `sf:<id>` otherwise)
 *   ↗ Maps         the real place in a maps app
 * While a trip to this place is on, 跟 BAYBAY 去 goes (the map's trip strip has the end button).
 */
export function PlaceActions({ place, attraction = null, walk = null, onTrip = false }: { place: CityPlace; attraction?: Attraction | null; walk?: WalkInfo | null; onTrip?: boolean }) {
  const { t } = useT();
  useDiscoveryEpoch();
  const pos = useGame(s => s.playerPos);
  useGame(s => s.move.mode); // re-plan when mounting / leaving a vehicle
  const [more, setMore] = useState(false);
  const [picked, setPicked] = useState<TripOption['mode'] | null>(null);
  useEffect(() => { setMore(false); setPicked(null); }, [place.id, attraction?.id]);
  const dest = useMemo(() => placeTripDest(place, attraction), [place, attraction]);
  const { options, busy } = useTripOptions(onTrip ? null : dest);
  const rec = options.find(o => o.recommended) ?? options[0] ?? null;
  // 详情: the district POI card for merged hero places, lane C / G2's SF card (`sf:<landmarkId>` / `sf:<placeId>`) otherwise
  const detail = place.poi ?? `sf:${place.landmark ?? place.id}`;
  const ll = unproject({ x: place.x, z: place.z });
  const zone = landmarkAreaAt(place.x, place.z)?.name ?? (place.zone ? zoneName(place.zone) : null);
  const name = attraction?.name ?? place.name;
  const time: Bilingual = rec ? tripSecondsLabel(rec.seconds)
    : !place.walkable || !walk ? cityTravelLabel(pos, dest)
      : walk.state === 'ok' ? walk.label
        : walk.state === 'pending' ? { zh: '找路中…', en: 'Finding the way…' }
          : { zh: '走不过去', en: 'No walking way there' };
  const go = (o: TripOption) => { setPicked(o.mode); startPlaceTrip(o, dest, place); };
  return (
    <div className="ob-map-pop ob-place-pop mw-place" role="group" aria-label={t(name)}>
      <div className="mw-place-head">
        <strong className="mw-place-title">{t(name)}</strong>
        <small>{zone ? `${t(zone)} · ` : ''}{t(time)}{isDiscovered(place.id) ? ` · ${t('去过', 'visited')}` : ''}</small>
        {attraction?.visitNote && <small className="mw-place-note">{t(attraction.visitNote)}</small>}
      </div>
      <div className="ob-place-actions mw-place-actions">
        {!onTrip && rec && (
          <button type="button" className="ob-btn ob-btn-primary mw-go" onClick={() => go(rec)}>
            <Navigation size={16} aria-hidden /><span>{t('跟 BAYBAY 去', 'Go with BAYBAY')}</span>
          </button>
        )}
        {!onTrip && options.length > 1 && (
          <button type="button" className={`ob-btn ob-btn-ghost mw-more${more ? ' is-on' : ''}`} onClick={() => setMore(m => !m)} aria-expanded={more}>
            <span>{t('其他方式', 'Other ways')}</span><ChevronDown size={15} aria-hidden />
          </button>
        )}
        <button type="button" className="ob-icon-btn mw-44" onClick={() => openPanel('poi', detail)} aria-label={t('查看介绍', 'Details')}><Info size={18} aria-hidden /></button>
        <a className="ob-icon-btn mw-44" href={mapsUrl(ll.lat, ll.lng, place.name.en)} target="_blank" rel="noopener noreferrer" aria-label={t('在地图 App 里打开', 'Open in Maps')}><ExternalLink size={17} aria-hidden /></a>
      </div>
      {!onTrip && !options.length && place.walkable && walk?.state === 'none' && <small className="mw-place-note">{t('这里走不过去，换个地方试试', 'No way there on foot')}</small>}
      {more && !onTrip && <TripOptions options={options} busy={busy} onPick={go} picked={picked} />}
    </div>
  );
}
