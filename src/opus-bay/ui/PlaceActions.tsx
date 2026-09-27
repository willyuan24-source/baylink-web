import { Bike, Bird, Car, ExternalLink, Info, Lock, Navigation } from 'lucide-react';
import { unproject } from '../core/geo';
import { useGame } from '../core/store';
import type { Bilingual } from '../core/types';
import { landmarkAreaAt, zoneName } from '../data/cityZones';
import { mapsUrl } from '../data/links';
import type { CityPlace } from '../data/sf/places';
import { isDiscovered, useDiscoveryEpoch } from '../game/discovery';
import { openPanel } from '../game/flow';
import { driveOption, driveThere, flyTo, takeMeTo } from '../game/placeTrips';
import { cityTravelLabel } from '../game/travel';
import { useT } from '../i18n';

/** The walking route to the place as the map knows it (G1-8): being found, found (its honest label), or none. */
export type WalkInfo = { state: 'pending' } | { state: 'ok'; label: Bilingual } | { state: 'none' };

/**
 * The actions under a selected city place (lane G1, G1-6 / G1-8):
 *   飞过去    fast travel, for places you have been to (discovered)
 *   带我去    walk there over the graph (hidden when the place is off the walking network or no route exists); the
 *             time is the route's own (travel.ts routeTravelLabel) once the map has it. While 带我去 is taking you
 *             to this place the button goes (the map's trip strip has 不去了).
 *   骑车去 / 开车去   while riding, or with a bike / the toy car within 60 u
 *   详情      the district POI card for hero places merged with a POI, G2's `sf:<id>` card otherwise (landmark or place)
 *   Maps      the real place in Google Maps (coordinates, DESIGN §8)
 */
export function PlaceActions({ place, walk = null, onTrip = false }: { place: CityPlace; walk?: WalkInfo | null; onTrip?: boolean }) {
  const { t } = useT();
  useDiscoveryEpoch();
  const pos = useGame(s => s.playerPos);
  useGame(s => s.move.mode); // re-render when mounting / leaving a vehicle
  const found = isDiscovered(place.id);
  // 详情: the district POI card for merged hero places, G2's SF card (`sf:<landmarkId>` / `sf:<placeId>`) otherwise
  const detail = place.poi ?? `sf:${place.landmark ?? place.id}`;
  const drive = driveOption();
  const ll = unproject({ x: place.x, z: place.z });
  const zone = landmarkAreaAt(place.x, place.z)?.name ?? (place.zone ? zoneName(place.zone) : null);
  const noWay = place.walkable && walk?.state === 'none';
  const time: Bilingual = !place.walkable || !walk ? cityTravelLabel(pos, place.arrival)
    : walk.state === 'ok' ? walk.label
      : walk.state === 'pending' ? { zh: '找路中…', en: 'Finding the way…' }
        : { zh: '走不过去', en: 'No walking way there' };
  return (
    <div className="ob-map-pop ob-place-pop" role="group" aria-label={t(place.name)}>
      <div className="ob-map-pop-text">
        <strong>{t(place.name)}</strong>
        <small>{zone ? `${t(zone)} · ` : ''}{t(time)}</small>
      </div>
      <div className="ob-place-actions">
        {found ? (
          <button type="button" className="ob-btn ob-btn-primary ob-btn-sm" onClick={() => flyTo(place)}><Bird size={15} aria-hidden /><span>{t('飞过去', 'Fly there')}</span></button>
        ) : (
          <span className="ob-place-locked" title={t('去过的地方才能飞过去', 'Visit a place once to fly there')}><Lock size={13} aria-hidden />{t('去过才能飞', 'Visit to unlock')}</span>
        )}
        {/* while 带我去 is taking you here, the map's trip strip above holds 不去了 */}
        {!onTrip && place.walkable && !noWay && (
          <button type="button" className={`ob-btn ob-btn-sm ${found ? 'ob-btn-ghost' : 'ob-btn-primary'}`} onClick={() => takeMeTo(place)}><Navigation size={15} aria-hidden /><span>{t('带我去', 'Take me')}</span></button>
        )}
        {drive && place.walkable && !noWay && (
          <button type="button" className="ob-btn ob-btn-ghost ob-btn-sm" onClick={() => driveThere(place)}>
            {drive.vehicle === 'car' ? <Car size={15} aria-hidden /> : <Bike size={15} aria-hidden />}
            <span>{drive.vehicle === 'car' ? t('开车去', 'Drive') : t('骑车去', 'Ride')}</span>
          </button>
        )}
        <button type="button" className="ob-icon-btn" onClick={() => openPanel('poi', detail)} aria-label={t('查看介绍', 'Details')}><Info size={18} aria-hidden /></button>
        <a className="ob-icon-btn" href={mapsUrl(ll.lat, ll.lng, place.name.en)} target="_blank" rel="noopener noreferrer" aria-label={t('在地图 App 里打开', 'Open in Maps')}><ExternalLink size={17} aria-hidden /></a>
      </div>
    </div>
  );
}
