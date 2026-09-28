import { useEffect, useMemo, useState } from 'react';
import { Bird } from 'lucide-react';
import { runtime } from '../core/runtime';
import type { Vec2 } from '../core/types';
import { placeById } from '../data/sf/places';
import { isDiscovered, useDiscoveryEpoch } from '../game/discovery';
import { closePanel, navigateTo, say } from '../game/flow';
import { interactableById } from '../game/interactables';
import { flyTo, startPlaceTrip } from '../game/placeTrips';
import { boardLine, nextArrival, stationRides as lineStationRides } from '../game/transit';
import { planTrips } from '../game/tripPlan';
import { tripProviders } from '../game/tripProviders';
import { useT } from '../i18n';
import type { WalkInfo } from './PlaceActions';
import { type StationRide, StationActions } from './StationActions';
import type { MapLine, MapStation } from './mapLines';
import { stationRides, tripLineInfos } from './mapTrips';

/**
 * Wave 4 · the tapped station on the city map (lane P, W4-P7; plan §4.1 "Lines and stations"): lane P's StationActions
 * card. The loop / N / M rides are lane T's (`game/transit.ts stationRides`: next stops each way, ★ stops, termini,
 * 坐一圈, the sims' own ride times) with the system's 下一班 ETA; the cable-car rides come from lane G's line models.
 * A ride from where you stand opens lane T's pre-filled boarding ("上车 · 坐到 …"); from elsewhere it starts a trip
 * (lane C's runner walks you to the stop and boards); 带我去车站 walks there; 飞过去 once the station was discovered
 * (stations are places: data/sf/stationPlaces.ts).
 */

const HERE_R = 12;

export function StationPanel({ station, lines, pos, walk }: { station: MapStation; lines: readonly MapLine[]; pos: Vec2; walk: WalkInfo | null; placeId: string | null }) {
  const { t } = useT();
  useDiscoveryEpoch();
  const infos = useMemo(() => tripLineInfos(lines), [lines]);
  // lane T's rides for the wave-4 lines at any of the station's stops, the planner's for the cable cars
  const rides = useMemo((): StationRide[] => {
    const w4: StationRide[] = [];
    for (const id of station.ids) for (const r of lineStationRides(id)) {
      if (!w4.some(x => x.line === r.line && x.to.stop === r.to && !!x.lap === (r.kind === 'lap'))) w4.push({ line: r.line, to: { stop: r.to, name: r.toName }, seconds: r.seconds, ...(r.kind === 'lap' ? { lap: true } : {}), boardAt: id });
    }
    const w4Lines = new Set(w4.map(r => r.line));
    const other = stationRides(station, infos).filter(r => !w4Lines.has(r.line) && infos.get(r.line)?.kind === 'cable-car');
    return [...w4, ...other];
  }, [station, infos]);
  // 下一班: the running systems' ETA (1 Hz while the card is open)
  const [nextIn, setNextIn] = useState<number | null>(null);
  useEffect(() => {
    const read = () => { let best: number | null = null; for (const id of station.ids) { const s = nextArrival(id); if (s !== null && (best === null || s < best)) best = s; } setNextIn(best); };
    read();
    const iv = window.setInterval(read, 1000);
    return () => window.clearInterval(iv);
  }, [station]);
  const place = placeById(station.id);
  const d = Math.hypot(station.x - pos.x, station.z - pos.z);
  const here = d < HERE_R;
  const walkSeconds = walk?.state === 'ok' ? null : (d * 1.25) / 4.2;
  const goStation = () => {
    const it = interactableById(`place:${station.id}`) ?? station.ids.map(id => interactableById(`transit-${id}`)).find(Boolean);
    if (it) navigateTo(it.id);
  };
  const onRide = (r: StationRide) => {
    // standing at the stop: lane T's boarding with the ride pre-filled
    if (here && r.boardAt) { closePanel(); boardLine(r.boardAt, { line: r.line, ...(r.lap ? {} : { to: r.to.stop }) }); return; }
    // from elsewhere: a trip that rides this line to the chosen stop (lane G's planner, lane C's runner)
    const alight = infos.get(r.line)?.stops.find(s => s.id === r.to.stop);
    const dest = { placeId: r.to.stop, x: alight?.x ?? station.x, z: alight?.z ?? station.z, name: r.to.name };
    const opt = r.lap ? null : planTrips({ x: runtime.player.x, z: runtime.player.z }, dest, tripProviders()).find(o => o.legs.some(l => l.via === 'line' && l.line === r.line));
    if (opt) { startPlaceTrip(opt, dest); return; }
    goStation();
    say(`先去${station.name.zh}上车～`, `To ${station.name.en} first, then we ride`, 'info', 2600);
  };
  return (
    <div className="mw-station-wrap">
      <StationActions station={station} rides={rides} nextIn={nextIn} walkSeconds={walkSeconds} here={here} onRide={onRide} onGo={goStation} />
      {place && isDiscovered(station.id) && !here && (
        <button type="button" className="ob-btn ob-btn-ghost ob-btn-sm mw-fly" onClick={() => flyTo(place)}><Bird size={15} aria-hidden /><span>{t('飞过去', 'Fly there')}</span></button>
      )}
    </div>
  );
}
