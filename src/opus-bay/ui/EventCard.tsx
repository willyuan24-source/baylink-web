import { Suspense } from 'react';
import { lazyChunk } from '../game/lazyChunk';
import { importRetry } from '../game/importRetry';

/**
 * A BAYLINK event's card (the week board, 附近这周 on a place card). Lazy since wave 4 (lane C): the card body
 * (ui/EventCardBody.tsx) loads the first time an event opens, so it is not in the main graph (GameRoot).
 */
const EventCardBody = lazyChunk(() => importRetry(() => import('./EventCardBody')));

export function EventCard({ id }: { id?: string }) {
  return <Suspense fallback={null}><EventCardBody id={id} /></Suspense>;
}
