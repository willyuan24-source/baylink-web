import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ExternalLink, Footprints, Info, Navigation } from 'lucide-react';
import { unproject } from '../core/geo';
import { runtime } from '../core/runtime';
import { useGame } from '../core/store';
import type { Bilingual } from '../core/types';
import { landmarkAreaAt, zoneName } from '../data/cityZones';
import { mapsUrl } from '../data/links';
import type { Attraction } from '../data/sf/attractionTypes';
import { ATTRACTION_INDEX } from '../data/sf/attractions';
import { attractionCardId } from '../data/sf/cityPois';
import type { CityPlace } from '../data/sf/places';
import { SF_ROUTES, type SfRouteId } from '../data/sf/routes';
import { isDiscovered, useDiscoveryEpoch } from '../game/discovery';
import { openPanel } from '../game/flow';
import { type PlaceTripDest, startPlaceTrip } from '../game/placeTrips';
import { planTrips } from '../game/tripPlan';
import { tripProviders, tripRouteCache } from '../game/tripProviders';
import type { TripOption } from '../game/tripTypes';
import { cityTravelLabel } from '../game/travel';
import { useT } from '../i18n';
import { TripOptions } from './TripOptions';
import { LINE_ICONS, MODE_ICONS } from './mapIcons';
import { placeTripDest } from './mapTrips';
import { goButtonLabel, optionAria, optionLineGlyph, tripSecondsLabel } from './tripRows';

/** W5-N3 · the go button's glyph: the way it takes (the pelican, BAYBAY's arrow on foot, a bike, the line's vehicle). */
function GoIcon({ o }: { o: TripOption }) {
  const glyph = optionLineGlyph(o);
  const Icon = glyph ? LINE_ICONS[glyph] : o.mode === 'walk' || o.mode === 'run' ? Navigation : MODE_ICONS[o.mode];
  return <Icon size={16} aria-hidden />;
}

/** The walking route to the place as the map knows it (G1-8): being found, found (its honest label), or none. */
export type WalkInfo = { state: 'pending' } | { state: 'ok'; label: Bilingual } | { state: 'none' };

/**
 * Every honest way to the destination (lane G's planTrips with the live providers), planned from where the player
 * stood when the card opened (lane G's review O5: re-reading the position on every landing would start new searches
 * while a ride moves you), again each time a route search lands (计算中… until then). W5-N2: the map (ui/CityMap) uses it
 * too, so its pin chip says what the card's go button says (one ETA source).
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useTripOptions(dest: PlaceTripDest | null): { options: TripOption[]; busy: boolean } {
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
 * While a trip to this place is on, 跟 BAYBAY 去 goes (the map's trip strip has the end button) and 其他方式 becomes
 * 换个方式: the ways from here, a pick changes the running trip's way (onReplan).
 */
export function PlaceActions({ place, attraction = null, walk = null, onTrip = false, tripTime = null, onReplan, changeTo = null, tripMode = null, startOpen = false, onRoute, hideGo = false }: {
  place: CityPlace; attraction?: Attraction | null; walk?: WalkInfo | null; onTrip?: boolean;
  /**
   * lane C's trip to this place is running: its way and time left ("跑过去 约 2 分钟", as the trip strip and the ETA
   * chip say; integration review: the card said "游戏里约 50 秒 · 现实约 2.0 公里" beside the strip's "约 1 分钟")
   */
  tripTime?: Bilingual | null;
  /**
   * lane C's trip to this place is running: 换个方式 lists the ways from here and a pick changes the running trip's way
   * (flow.replanTrip). The trip card's 换个方式 (lane G) opens the map on its destination; the card then offered nothing
   * (integration review: a dead end). `tripMode` = the running way (its row shows pressed); `startOpen`: the list open.
   */
  onReplan?: ((o: TripOption) => void) | null;
  /** where the running trip ends (the ways to change it are planned there: a Grand Tour stop's bus stop) */
  changeTo?: PlaceTripDest | null;
  tripMode?: TripOption['mode'] | null;
  startOpen?: boolean;
  onRoute?: (id: SfRouteId) => void;
  /** W5-N4: the go button is on the card pinned over the phone map (ui/MapGoCard): this card keeps the other ways */
  hideGo?: boolean;
}) {
  const { t } = useT();
  useDiscoveryEpoch();
  const pos = useGame(s => s.playerPos);
  useGame(s => s.move.mode); // re-plan when mounting / leaving a vehicle
  const [more, setMore] = useState(startOpen);
  const [picked, setPicked] = useState<TripOption['mode'] | null>(null);
  useEffect(() => { setMore(startOpen); setPicked(null); }, [place.id, attraction?.id, startOpen]);
  const dest = useMemo(() => placeTripDest(place, attraction), [place, attraction]);
  // on a trip here: the ways only to change it (换个方式), never a second trip
  const changing = onTrip && !!onReplan;
  const { options, busy } = useTripOptions(onTrip && !changing ? null : changing && changeTo ? changeTo : dest);
  const rec = options.find(o => o.recommended) ?? options[0] ?? null;
  // 详情: the district POI card for merged hero places, lane C / G2's SF card (`sf:<landmarkId>` / `sf:<placeId>`) otherwise;
  // an attraction that shares another's row (Japan Center on the Peace Pagoda's) opens its own card (`sf:<attraction>`)
  const shares = !!attraction && ATTRACTION_INDEX.primary(place.id) !== attraction;
  // (lane C's attractionCardId: the landmark card, else the attraction's own wave-4 card once the cards are loaded)
  const detail = shares ? attractionCardId(attraction!) : place.poi ?? (attraction ? attractionCardId(attraction) : `sf:${place.landmark ?? place.id}`);
  // the walking routes this stop is on (lane D2's SF_ROUTES): chips that show the route on the map
  const routes = SF_ROUTES.filter(r => r.stops.some(s => (attraction && s.attraction === attraction.id) || s.placeId === place.id));
  const ll = unproject({ x: place.x, z: place.z });
  const zone = landmarkAreaAt(place.x, place.z)?.name ?? (place.zone ? zoneName(place.zone) : null);
  const name = attraction?.name ?? place.name;
  const time: Bilingual = tripTime ?? (rec ? tripSecondsLabel(rec.seconds)
    : !place.walkable || !walk ? cityTravelLabel(pos, dest)
      : walk.state === 'ok' ? walk.label
        : walk.state === 'pending' ? { zh: '找路中…', en: 'Finding the way…' }
          : { zh: '走不过去', en: 'No walking way there' });
  const go = (o: TripOption) => { setPicked(o.mode); if (changing) onReplan!(o); else startPlaceTrip(o, dest); };
  return (
    <div className="ob-map-pop ob-place-pop mw-place" role="group" aria-label={t(name)}>
      <div className="mw-place-head">
        <strong className="mw-place-title">{t(name)}</strong>
        <small>{zone ? `${t(zone)} · ` : ''}{t(time)}{isDiscovered(place.id) ? ` · ${t('去过', 'visited')}` : ''}</small>
        {attraction?.visitNote && <small className="mw-place-note">{t(attraction.visitNote)}</small>}
      </div>
      <div className="ob-place-actions mw-place-actions">
        {!onTrip && rec && !hideGo && (
          // W5-N3: the way and its time on the button; one tap closes the map and BAYBAY carries you
          <button type="button" className="ob-btn ob-btn-primary mw-go" onClick={() => go(rec)} aria-label={t(optionAria(rec))}>
            <GoIcon o={rec} /><span>{t(goButtonLabel(rec))}</span>
          </button>
        )}
        {(changing ? options.length > 0 : !onTrip && options.length > (hideGo ? 0 : 1)) && (
          <button type="button" className={`ob-btn ob-btn-ghost mw-more${more ? ' is-on' : ''}`} onClick={() => setMore(m => !m)} aria-expanded={more}>
            <span>{changing ? t('换个方式', 'Another way') : t('其他方式', 'Other ways')}</span><ChevronDown size={15} aria-hidden />
          </button>
        )}
        <button type="button" className="ob-icon-btn mw-44" onClick={() => openPanel('poi', detail)} aria-label={t('查看介绍', 'Details')}><Info size={18} aria-hidden /></button>
        <a className="ob-icon-btn mw-44" href={mapsUrl(ll.lat, ll.lng, place.name.en)} target="_blank" rel="noopener noreferrer" aria-label={t('在地图 App 里打开', 'Open in Maps')}><ExternalLink size={17} aria-hidden /></a>
      </div>
      {!onTrip && !options.length && place.walkable && walk?.state === 'none' && <small className="mw-place-note">{t('这里走不过去，换个地方试试', 'No way there on foot')}</small>}
      {onRoute && routes.length > 0 && (
        <div className="mw-route-chips">
          {routes.map(r => <button key={r.id} type="button" className="mw-chip mw-route-chip" onClick={() => onRoute(r.id)}><Footprints size={14} aria-hidden /><span>{t({ zh: `步行路线 · ${r.name.zh}`, en: `Walk · ${r.name.en}` })}</span></button>)}
        </div>
      )}
      {more && (!onTrip || changing) && <TripOptions options={options} busy={busy} onPick={go} picked={picked ?? (changing ? tripMode : null)} />}
    </div>
  );
}

/**
 * 换个方式 for a running trip whose destination is a station (a Grand Tour stop at a bus stop; integration review): the
 * trip card's 换个方式 (lane G) opens the map on that stop, whose card only offered new rides. The ways from here to
 * where the trip ends, planned once the list is open, the running one pressed; `onPick` changes the trip's way.
 */
export function ChangeWay({ to, tripTime = null, tripMode = null, startOpen = false, onPick }: {
  to: PlaceTripDest; tripTime?: Bilingual | null; tripMode?: TripOption['mode'] | null; startOpen?: boolean; onPick: (o: TripOption) => void;
}) {
  const { t } = useT();
  const [open, setOpen] = useState(startOpen);
  const { options, busy } = useTripOptions(open ? to : null);
  return (
    <div className="mw-change" role="group" aria-label={t('换个方式', 'Another way')}>
      <div className="mw-change-head">
        {tripTime && <small>{t('当前：', 'Now: ')}{t(tripTime)}</small>}
        <button type="button" className={`ob-btn ob-btn-ghost mw-more${open ? ' is-on' : ''}`} onClick={() => setOpen(o => !o)} aria-expanded={open}>
          <span>{t('换个方式', 'Another way')}</span><ChevronDown size={15} aria-hidden />
        </button>
      </div>
      {open && <TripOptions options={options} busy={busy} onPick={onPick} picked={tripMode} />}
    </div>
  );
}
