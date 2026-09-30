import { Binoculars, Wind } from 'lucide-react';
import { game } from '../core/store';
import { registerAskItem } from '../ui/slots';
import { currentActivity } from './kit';

/**
 * Wave 7 · lane W2 · the ways into lane W2's games (play/index.ts registers them with the other ask items). Kept tiny: it
 * is part of the play core (≤ 6 KB, tests/opus-bay-w5-play-acts W5-A1); everything else loads behind it:
 *   - 放风筝: play/kiteZone.ts (loaded at init: where the item shows, Marina Green's ambient kites) and play/kite.ts (the
 *     activity, on the tap);
 *   - 那是什么？: play/skyline.ts on the tap (whether a landmark is in sight is checked then: a ray per landmark is too
 *     much for a menu that re-renders; with none in sight BAYBAY says so and names the nearest lookout).
 */
let zone: typeof import('./kiteZone') | null = null;

export function registerKites(): () => void {
  let gone = false, offZone: (() => void) | null = null;
  void import('./kiteZone').then(m => { if (gone) return; zone = m; offZone = m.startKiteZone(); }).catch(() => { /* the item stays hidden */ });
  const offKite = registerAskItem({
    id: 'play-kite', order: -6, label: { zh: '放风筝', en: 'Kite flying' }, icon: Wind,
    visible: () => !!zone && zone.kiteHere(),
    onSelect: () => { void import('./kite').then(m => { m.startKite(); }); },
  });
  const offSky = registerAskItem({
    id: 'play-skyline', order: -7, label: { zh: '那是什么？', en: 'What’s that?' }, icon: Binoculars,
    visible: () => !currentActivity() && game.get().mode === 'free' && game.get().phase === 'playing',
    onSelect: () => { void import('./skyline').then(m => { m.startSkyline(); }); },
  });
  return () => { gone = true; offKite(); offSky(); offZone?.(); };
}
