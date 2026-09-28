import { useMemo } from 'react';
import { Bird } from 'lucide-react';
import { runtime } from '../core/runtime';
import type { Vec2 } from '../core/types';
import { placeById } from '../data/sf/places';
import { isDiscovered, useDiscoveryEpoch } from '../game/discovery';
import { navigateTo, say } from '../game/flow';
import { interactableById } from '../game/interactables';
import { flyTo, startPlaceTrip } from '../game/placeTrips';
import { planTrips } from '../game/tripPlan';
import { tripProviders } from '../game/tripProviders';
import { useT } from '../i18n';
import type { WalkInfo } from './PlaceActions';
import { type StationRide, StationActions } from './StationActions';
import type { MapLine, MapStation } from './mapLines';
import { stationRides, tripLineInfos } from './mapTrips';

/**
 * Wave 4 · the tapped station on the city map (lane P, W4-P7; plan §4.1 "Lines and stations"): lane P's StationActions
 * card with the rides from this station (per line: the next ★ stop and the terminus each way; on the loop 坐一圈 and
 * the next two ★ stops), their honest ride times (lane G's line models: lane T's systems answer once they run), 带我去车站
 * with the walk, and 飞过去 once the station was discovered (stations are places: data/sf/stationPlaces.ts).
 */

export function StationPanel({ station, lines, pos, walk }: { station: MapStation; lines: readonly MapLine[]; pos: Vec2; walk: WalkInfo | null; placeId: string | null }) {
  const { t } = useT();
  useDiscoveryEpoch();
  const infos = useMemo(() => tripLineInfos(lines), [lines]);
  const rides = useMemo(() => stationRides(station, infos), [station, infos]);
  const place = placeById(station.id);
  const d = Math.hypot(station.x - pos.x, station.z - pos.z);
  const here = d < 12;
  const walkSeconds = walk?.state === 'ok' ? null : (d * 1.25) / 4.2;
  const goStation = () => {
    const it = interactableById(`place:${station.id}`) ?? station.ids.map(id => interactableById(`transit-${id}`)).find(Boolean);
    if (it) navigateTo(it.id);
  };
  const onRide = (r: StationRide) => {
    // a trip that rides this line to r.to (lane G's planner; lane C's runner takes it at the integration)
    const alight = infos.get(r.line)?.stops.find(s => s.id === r.to.stop);
    const dest = { placeId: r.to.stop, x: alight?.x ?? station.x, z: alight?.z ?? station.z, name: r.to.name };
    const opt = r.lap ? null : planTrips({ x: runtime.player.x, z: runtime.player.z }, dest, tripProviders()).find(o => o.legs.some(l => l.via === 'line' && l.line === r.line));
    if (opt && place) { startPlaceTrip(opt, dest, place); return; }
    goStation();
    if (!here) say(`先去${station.name.zh}上车～`, `To ${station.name.en} first, then we ride`, 'info', 2600);
  };
  return (
    <div className="mw-station-wrap">
      <StationActions station={station} rides={rides} walkSeconds={walkSeconds} here={here} onRide={onRide} onGo={goStation} />
      {place && isDiscovered(station.id) && !here && (
        <button type="button" className="ob-btn ob-btn-ghost ob-btn-sm mw-fly" onClick={() => flyTo(place)}><Bird size={15} aria-hidden /><span>{t('飞过去', 'Fly there')}</span></button>
      )}
    </div>
  );
}
