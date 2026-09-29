import eventData from './autumn-release-events.json';
import offerData from './autumn-release-offers.json';
import openingData from './autumn-release-openings.json';
import type { MonthlyEvent } from './monthly-types';
import type { FreebieOffer } from '../components/FreebieBoard';
import type { SeptemberOpening } from './september-openings';

export const reviewedAutumnEvents = eventData as MonthlyEvent[];
export const reviewedAutumnOffers = offerData as FreebieOffer[];
export const reviewedAutumnOpenings = openingData as SeptemberOpening[];

/** Canonical IDs preserve published links. Latest source review wins over old overrides. */
export function mergeReviewedEvents(previous: MonthlyEvent[]): MonthlyEvent[] {
  const events = new Map(previous.map(event => [event.id, event]));
  for (const event of reviewedAutumnEvents) events.set(event.id, event);
  return [...events.values()];
}
export function mergeReviewedOffers(previous: FreebieOffer[]): FreebieOffer[] {
  return [...new Map([...previous, ...reviewedAutumnOffers].map(offer => [offer.id, offer])).values()];
}
export function mergeReviewedOpenings(previous: SeptemberOpening[]): SeptemberOpening[] {
  return [...new Map([...previous, ...reviewedAutumnOpenings].map(shop => [shop.id, shop])).values()];
}
