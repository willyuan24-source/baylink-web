import { frameAt, stationOf } from '../data/district';
import type * as DeckSteer from './deckSteer';
import type * as ViewField from './viewField';

/**
 * W7-P1 · two city-only actor modules leave GameRoot's chunk (lane P, sf-w6-P.md Request 1: GameRoot ≤ 265 KB gzip).
 *
 * The per-frame code in GameRoot's graph (actors/camera.ts, CameraRig.tsx, controller.ts, feet.ts) imports these
 * same-named stand-ins instead of the modules themselves. Each module registers itself here when it loads, and until
 * then the stand-ins answer exactly what the module answers in district mode:
 *
 *   deckSteer (the Golden Gate Bridge's deck: W5-F6)   no deck is registered outside the city — `deckAt` null, `onDeck`
 *                                                      / `heroRelaxed` false, `deckDip` null. The module comes with the
 *                                                      city camera data (actors/cityViews.ts registers the deck and
 *                                                      imports it), so it is in whenever a deck exists.
 *   viewField (the city's openness field: E2-5)        the hero rule (`heroView` true: out over the Bay along the
 *                                                      promenade normal, data/district frameAt) — what it answers until
 *                                                      the city terrain is in. The city chunk (world/sf/cityMode.ts)
 *                                                      imports it, before the city terrain exists.
 *
 * District mode never fetches either module.
 */
export type { Deck, DeckAt, DeckWish } from './deckSteer';

type DeckMod = Pick<typeof DeckSteer, 'deckAt' | 'deckDip' | 'deckWish' | 'onDeck' | 'heroRelaxed' | 'deckCameraYaw'>;
type ViewMod = Pick<typeof ViewField, 'heroView' | 'preferredViewDir' | 'preferredCameraYaw'>;

let deck: DeckMod | null = null;
let view: ViewMod | null = null;

/** deckSteer.ts calls this when it loads. */
export function registerDeckSteer(m: DeckMod): void { deck = m; }
/** viewField.ts calls this when it loads. */
export function registerViewField(m: ViewMod): void { view = m; }
/** tests / QA: which modules are in */
export const citySlots = () => ({ deck: !!deck, view: !!view });

// --- deckSteer ---------------------------------------------------------------------------------------------------

export const deckAt: DeckMod['deckAt'] = (x, z, y, out) => (deck ? deck.deckAt(x, z, y, out) : null);
export const onDeck: DeckMod['onDeck'] = (x, z, y) => (deck ? deck.onDeck(x, z, y) : false);
export const heroRelaxed: DeckMod['heroRelaxed'] = (id, x, z) => (deck ? deck.heroRelaxed(id, x, z) : false);
export const deckDip: DeckMod['deckDip'] = (x0, z0, y0, x1, z1, out) => (deck ? deck.deckDip(x0, z0, y0, x1, z1, out) : null);
/** (only ever asked with a deck from deckAt, so the module is in; the input wish otherwise) */
export const deckWish: DeckMod['deckWish'] = (at, wx, wz, r, out) => {
  if (deck) return deck.deckWish(at, wx, wz, r, out);
  if (!out) return { x: wx, z: wz, steered: false };
  out.x = wx; out.z = wz; out.steered = false;
  return out;
};
/** (only ever asked with a deck; the same formula otherwise) */
export const deckCameraYaw: DeckMod['deckCameraYaw'] = (d, dir) => {
  if (deck) return deck.deckCameraYaw(d, dir);
  const h = d.heading + (dir >= 0 ? 0 : Math.PI);
  return Math.atan2(-Math.sin(h), -Math.cos(h));
};

// --- viewField ---------------------------------------------------------------------------------------------------

export const heroView: ViewMod['heroView'] = (x, z) => (view ? view.heroView(x, z) : true);
export const preferredViewDir: ViewMod['preferredViewDir'] = (x, z) => {
  if (view) return view.preferredViewDir(x, z);
  const f = frameAt(stationOf({ x, z }).st);
  return Math.atan2(f.nx, f.nz);
};
export const preferredCameraYaw: ViewMod['preferredCameraYaw'] = (x, z) => {
  if (view) return view.preferredCameraYaw(x, z);
  const f = frameAt(stationOf({ x, z }).st);
  return Math.atan2(-f.nx, -f.nz);
};
