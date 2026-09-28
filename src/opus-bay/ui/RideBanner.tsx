import { useEffect, useState } from 'react';
import { BellRing, Bus, CableCar, Ellipsis, Ship, TrainFront, TramFront, type LucideIcon } from 'lucide-react';
import { requestHopOff } from '../actors/moveApi';
import { cancelRide, finishRide } from '../game/flow';
import { useFlow } from '../game/flowStore';
import { requestNextStop, rideLabel } from '../game/transit';
import { useT } from '../i18n';
import { hopOffNote } from './rideHop';
import { useMedia } from './hooks';

/**
 * The ride banner (line, destination, 提前下车 / 直接到站), rendered in the Overlay's top stack (ui/Hud.tsx mounts it
 * lazily during a ride: its own chunk, so GameRoot does not carry it). Words and glyph come from lane F / T
 * (game/transit.ts rideLabel; wave 4 adds 'bus' / 'metro').
 *
 * Wave 4 integration (lane G): 提前下车 says why it cannot be done instead of offering what the rider will refuse — on
 * a ferry under way "到站再下" (lane F's review request), in a Metro tunnel or under a portal hood "隧道里不能下车" /
 * "马上出隧道…" (lane T's review open 1; moveSystem refuses the hop-off there too). W4-G3: on a bus or Metro ride under way
 * (lane T's `label.nextStop`) 下一站下车 rings for the next stop; on phones the row is 下一站下车 · 直接到站 · ⋯ (the ⋯
 * holds 提前下车), the line and destination on the row above.
 */

/** The banner glyph per `RideLabel.icon` (an unknown icon falls back to the tram, like the district F-line). */
const RIDE_ICONS: Readonly<Record<string, LucideIcon>> = { ferry: Ship, 'cable-car': CableCar, tram: TramFront, bus: Bus, metro: TrainFront };

export default function RideBanner() {
  const { t } = useT();
  const ride = useFlow(s => s.ride);
  // on board the hop-off rule follows the vehicle (a ferry docking, a train leaving the tunnel): look twice a second
  const [, setTick] = useState(0);
  const onBoard = !!ride && ride.stage !== 'waiting';
  const narrow = useMedia('(max-width: 600px)');
  const [more, setMore] = useState(false);
  // the stop the bell was rung for (the button then says so until the ride ends)
  const [rung, setRung] = useState<string | null>(null);
  const rideKey = ride ? `${ride.line ?? ''}:${ride.from}` : '';
  useEffect(() => { setRung(null); setMore(false); }, [rideKey]);
  useEffect(() => {
    if (!onBoard) return;
    const id = window.setInterval(() => setTick(n => (n + 1) % 1e6), 500);
    return () => window.clearInterval(id);
  }, [onBoard]);
  if (!ride) return null;
  const label = rideLabel(ride);
  const Icon = RIDE_ICONS[label.icon] ?? TramFront;
  const note = onBoard ? hopOffNote(ride, label) : null;
  const bell = onBoard && !!label.nextStop;
  // phones with the bell: 提前下车 folds into ⋯ (the row keeps 下一站下车 · 直接到站 · ⋯)
  const fold = bell && narrow;
  // lane E2's hop-off request (actors/moveApi): the same path as Space / pad B
  const hopOff = note
    ? <span className="ob-ride-note">{t(note)}</span>
    : <button type="button" className="ob-btn ob-btn-ghost ob-btn-sm" onClick={requestHopOff}>{t('提前下车', 'Hop off here')}</button>;
  return (
    <div className="ob-ride" role="status">
      <Icon size={20} aria-hidden />
      <span>{ride.stage === 'waiting' ? t(label.waiting) : <>{t(label.lineTo)} <strong>{label.dest ? t(label.dest) : ''}</strong></>}</span>
      {ride.stage === 'waiting'
        ? <>
            <button type="button" className="ob-btn ob-btn-soft ob-btn-sm" onClick={cancelRide}>{t('不坐了', 'Cancel')}</button>
            {/* (integration review; lane T's request, verify-phone m5) the ferry can be 80–140 s away: 直接到站 while waiting
                puts the rider on the other quay (lane T's finishRide, under the veil; never counted as a ride) */}
            {label.skipWhileWaiting && <button type="button" className="ob-btn ob-btn-soft ob-btn-sm" onClick={finishRide}>{t('直接到站', 'Skip to stop')}</button>}
          </>
        : <>
            {bell && (rung
              ? <span className="ob-ride-note is-rung"><BellRing size={14} aria-hidden />{t('下一站停', 'Stopping next')}</span>
              : <button type="button" className="ob-btn ob-btn-primary ob-btn-sm" onClick={() => setRung(requestNextStop() ?? 'next')}><BellRing size={14} aria-hidden />{t('下一站下车', 'Stop at the next')}</button>)}
            {(!fold || more) && hopOff}
            <button type="button" className="ob-btn ob-btn-soft ob-btn-sm" onClick={finishRide}>{t('直接到站', 'Skip to stop')}</button>
            {fold && !more && <button type="button" className="ob-icon-btn ob-icon-sm" onClick={() => setMore(true)} aria-label={t('更多：提前下车', 'More: hop off here')}><Ellipsis size={16} aria-hidden /></button>}
          </>}
    </div>
  );
}
