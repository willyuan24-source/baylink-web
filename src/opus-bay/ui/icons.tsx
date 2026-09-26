import { Armchair, BellRing, Bike, Camera, CarFront, Fish, Info, Mail, MessageCircle, Mountain, Newspaper, Telescope, TramFront, UtensilsCrossed } from 'lucide-react';
import type { InteractionKind } from '../core/types';

/** `ride` overrides the icon of the movement interactables (their action is 'info'): parked bike / toy car, a seat. */
export function InteractIcon({ kind, size = 18, ride }: { kind: InteractionKind; size?: number; ride?: 'bike' | 'car' | 'seat' }) {
  const props = { size, 'aria-hidden': true as const, strokeWidth: 2.1 };
  if (ride) return ride === 'bike' ? <Bike {...props} /> : ride === 'car' ? <CarFront {...props} /> : <Armchair {...props} />;
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
