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
import { stationRideOption, stationRides, stationWalkSeconds, tripLineInfos } from './mapTrips';

/**
 * Wave 4 · the tapped station on the city map (lane P, W4-P7; plan §4.1 "Lines and stations"): lane P's StationActions
 * card. The loop / N / M rides are lane T's (`game/transit.ts stationRides`: next stops each way, ★ stops, termini,
 * 坐一圈, the sims' own ride times) with the system's 下一班 ETA; the cable-car rides come from lane G's line models.
 * A ride from where you stand opens lane T's pre-filled boarding ("上车 · 坐到 …"); from elsewhere it starts a trip
 * (lane C's runner walks you to the stop and boards); 带我去车站 walks there; 飞过去 once the station was discovered
 * (stations are places: data/sf/stationPlaces.ts).
 */

const HERE_R = 12;

export function StationPanel({ station, lines, pos, walk, routeSeconds = null }: {
  station: MapStation; lines: readonly MapLine[]; pos: Vec2; walk: WalkInfo | null; placeId: string | null;
  /** the walking route's time to the station once the map found it (G1-8), else null */
  routeSeconds?: number | null;
}) {
  const { t } = useT();
  useDiscoveryEpoch();
  const infos = useMemo(() => tripLineInfos(lines), [lines]);
  // lane T's rides for the wave-4 lines at any of the station's stops, the planner's for the cable cars
  const rides = useMemo((): StationRide[] => {
    // a line is offered from the first of the station's stops that serves it (ids come primary first, then nearest):
    // Embarcadero holds California & Davis and California & Drumm, which would list the line twice (lane P's review 2)
    const w4: StationRide[] = [];
    const taken = new Set<string>();
    for (const id of station.ids) {
      const rides = lineStationRides(id);
      for (const r of rides) if (!taken.has(r.line)) w4.push({ line: r.line, to: { stop: r.to, name: r.toName }, seconds: r.seconds, ...(r.kind === 'lap' ? { lap: true } : {}), boardAt: id, dir: r.dir });
      for (const r of rides) taken.add(r.line);
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
  const walkSeconds = stationWalkSeconds(walk, routeSeconds, d);
  const goStation = () => {
    const it = interactableById(`place:${station.id}`) ?? station.ids.map(id => interactableById(`transit-${id}`)).find(Boolean);
    if (it) navigateTo(it.id);
  };
  const onRide = (r: StationRide) => {
    // standing at the stop: lane T's boarding with the ride pre-filled
    if (here && r.boardAt) { closePanel(); boardLine(r.boardAt, { line: r.line, ...(r.lap ? {} : { to: r.to.stop }) }); return; }
    // from elsewhere: a trip that rides this line to the chosen stop (lane G's planner, lane C's runner); when the
    // planner offers no ride on this line (walking there is as quick, four rows, boarding past 150 u), the ride the
    // player tapped from this station (integration review: it only walked them to the stop and forgot the ride)
    const info = infos.get(r.line);
    const alight = info?.stops.find(s => s.id === r.to.stop);
    const dest = { placeId: r.to.stop, x: alight?.x ?? station.x, z: alight?.z ?? station.z, name: r.to.name };
    const from = { x: runtime.player.x, z: runtime.player.z };
    const boardAt = r.boardAt ?? station.ids.find(id => info?.stops.some(s => s.id === id));
    const opt = r.lap ? null : planTrips(from, dest, tripProviders()).find(o => o.legs.some(l => l.via === 'line' && l.line === r.line))
      ?? (info && boardAt ? stationRideOption(from, info, boardAt, r.to.stop, { dir: r.dir, wait: nextArrival(boardAt, r.line, r.dir), rideSeconds: r.seconds }) : null);
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
