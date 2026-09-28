import { lazy, Suspense, useSyncExternalStore } from 'react';
import { placeCardTarget } from '../data/sf/cityPois';
import { onPlaces, placeById as cityPlaceById, placeIndex } from '../data/sf/places';
import { poiById } from '../game/interactables';

/**
 * Real-info card for a landmark (the body: ui/PoiCardBody.tsx, its own chunk since wave 4 part b; fetched at idle so
 * the first card opens at once). City mode (lane G2, G2-1): `openPanel('poi', 'sf:<landmarkId>')` renders the SF
 * landmark card the same way, and `openPanel('poi', 'sf:<placeId>')` a city place (G1's data/sf/places.ts): a place
 * standing for a landmark or merged with a district POI opens that card, any other place its own short card
 * (ui/PlaceCard.tsx: lazy, city only).
 */
export function PoiCard({ id }: { id?: string }) {
  const poi = poiById(id);
  // re-render once G1's place index is in (it loads on idle)
  const places = useSyncExternalStore(subscribePlaces, placeIndex, placeIndex);
  if (poi) return <Suspense fallback={null}><PoiCardBody poi={poi} /></Suspense>;
  const target = places ? placeCardTarget(id, cityPlaceById) : null;
  if (!target) return null;
  if ('poi' in target) { const other = poiById(target.poi); return other ? <Suspense fallback={null}><PoiCardBody poi={other} /></Suspense> : null; }
  return <Suspense fallback={null}><PlaceCard place={target.place} /></Suspense>;
}
const loadBody = () => import('./PoiCardBody');
const PoiCardBody = lazy(loadBody);
/** Wave 4 · lane C: the generic place card is city-only, so it loads with its first use (not in the main graph). */
const PlaceCard = lazy(() => import('./PlaceCard'));
const subscribePlaces = (fn: () => void) => onPlaces(() => fn());

// the browser fetches the card body once the game is up (never in node tests: no vite env there)
if (import.meta.env && typeof document !== 'undefined') {
  const idle = (window as Window & { requestIdleCallback?: (fn: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
  const fetchBody = () => { void loadBody().catch(() => { /* offline: the card loads when opened */ }); };
  if (idle) idle(fetchBody, { timeout: 6000 }); else setTimeout(fetchBody, 3000);
}
