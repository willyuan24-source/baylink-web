import { Armchair, BellRing, Bike, Bus, CableCar, Camera, CarFront, Fish, Info, Mail, MessageCircle, Mountain, Newspaper, Ship, Telescope, TrainFront, TramFront, UtensilsCrossed } from 'lucide-react';
import type { InteractionKind } from '../core/types';
import type { TransitGlyph } from './transitGlyph';

/**
 * `ride` overrides the icon of the movement interactables (their action is 'info'): parked bike / toy car, a seat.
 * `transit` (lane F's city stations, ui/transitGlyph.ts): the line's own vehicle instead of the F-line tram — the ferry,
 * the cable car, the F-line streetcar, and (wave 4, lane T's lines) the sightseeing bus and the Metro train.
 */
export function InteractIcon({ kind, size = 18, ride, transit }: { kind: InteractionKind; size?: number; ride?: 'bike' | 'car' | 'seat'; transit?: TransitGlyph }) {
  const props = { size, 'aria-hidden': true as const, strokeWidth: 2.1 };
  if (ride) return ride === 'bike' ? <Bike {...props} /> : ride === 'car' ? <CarFront {...props} /> : <Armchair {...props} />;
  if (transit) {
    switch (transit) {
      case 'ferry': return <Ship {...props} />;
      case 'cable-car': return <CableCar {...props} />;
      case 'bus': return <Bus {...props} />;
      case 'metro': return <TrainFront {...props} />;
      default: return <TramFront {...props} />;
    }
  }
  switch (kind) {
    case 'bell': return <BellRing {...props} />;
    case 'taste': return <UtensilsCrossed {...props} />;
    case 'fish': return <Fish {...props} />;
    case 'telescope': return <Telescope {...props} />;
    case 'photo': return <Camera {...props} />;
    case 'board': return <Newspaper {...props} />;
    case 'streetcar': return <TramFront {...props} />;
    case 'postcard': return <Mail {...props} />;
    case 'viewpoint': return <Mountain {...props} />;
    case 'talk': return <MessageCircle {...props} />;
    default: return <Info {...props} />;
  }
}
