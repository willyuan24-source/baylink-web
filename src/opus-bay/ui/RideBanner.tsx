import { useEffect, useState } from 'react';
import { Bus, CableCar, Ship, TrainFront, TramFront, type LucideIcon } from 'lucide-react';
import { requestHopOff } from '../actors/moveApi';
import type { Bilingual } from '../core/types';
import { cancelRide, finishRide } from '../game/flow';
import { useFlow } from '../game/flowStore';
import { rideLabel } from '../game/transit';
import { useT } from '../i18n';
import { hopOffNote } from './rideHop';

/**
 * The ride banner (line, destination, 提前下车 / 直接到站), rendered in the Overlay's top stack (ui/Hud.tsx mounts it
 * lazily during a ride: its own chunk, so GameRoot does not carry it). Words and glyph come from lane F / T
 * (game/transit.ts rideLabel; wave 4 adds 'bus' / 'metro').
 *
 * Wave 4 integration (lane G): 提前下车 says why it cannot be done instead of offering what the rider will refuse — on
 * a ferry under way "到站再下" (lane F's review request), in a Metro tunnel or under a portal hood "隧道里不能下车" /
 * "马上出隧道…" (lane T's review open 1; moveSystem refuses the hop-off there too).
 */

/** The banner glyph per `RideLabel.icon` (an unknown icon falls back to the tram, like the district F-line). */
const RIDE_ICONS: Readonly<Record<string, LucideIcon>> = { ferry: Ship, 'cable-car': CableCar, tram: TramFront, bus: Bus, metro: TrainFront };

export default function RideBanner() {
  const { t } = useT();
  const ride = useFlow(s => s.ride);
  // on board the hop-off rule follows the vehicle (a ferry docking, a train leaving the tunnel): look twice a second
  const [, setTick] = useState(0);
  const onBoard = !!ride && ride.stage !== 'waiting';
  useEffect(() => {
    if (!onBoard) return;
    const id = window.setInterval(() => setTick(n => (n + 1) % 1e6), 500);
    return () => window.clearInterval(id);
  }, [onBoard]);
  if (!ride) return null;
  const label = rideLabel(ride) as ReturnType<typeof rideLabel> & { canHopOff?: boolean; hopOffNote?: Bilingual | null };
  const Icon = RIDE_ICONS[label.icon] ?? TramFront;
  const note = onBoard ? hopOffNote(ride, label) : null;
  return (
    <div className="ob-ride" role="status">
      <Icon size={20} aria-hidden />
      <span>{ride.stage === 'waiting' ? t(label.waiting) : <>{t(label.lineTo)} <strong>{label.dest ? t(label.dest) : ''}</strong></>}</span>
      {ride.stage === 'waiting'
        ? <button type="button" className="ob-btn ob-btn-soft ob-btn-sm" onClick={cancelRide}>{t('不坐了', 'Cancel')}</button>
        : <>
            {/* lane E2's hop-off request (actors/moveApi): the same path as Space / pad B */}
            {note
              ? <span className="ob-ride-note">{t(note)}</span>
              : <button type="button" className="ob-btn ob-btn-ghost ob-btn-sm" onClick={requestHopOff}>{t('提前下车', 'Hop off here')}</button>}
            <button type="button" className="ob-btn ob-btn-soft ob-btn-sm" onClick={finishRide}>{t('直接到站', 'Skip to stop')}</button>
          </>}
    </div>
  );
}
