import { currentFreebies } from '../data/october-offers';
import { PLANNER_PLACES } from '../data/planner-catalog';
import { todayInBay, validDay, type Stop } from './planner';
import type { FreebieOffer } from '../components/FreebieBoard';

/** Explicit venue links only. A displayed offer never automatically reduces a trip budget. */
export function offersForStop(stop: Stop, date: string, offers: FreebieOffer[] = currentFreebies, asOf = todayInBay()) {
  const ids = stop.kind === 'place' ? PLANNER_PLACES.find(place => place.id === stop.id)?.offerIds || [] : [];
  const day = validDay(date) ? date : asOf;
  return offers.filter(offer => ids.includes(offer.id)).filter(offer => {
    if (offer.verificationStatus === 'needs-confirmation') return false;
    if (offer.endDate && validDay(offer.endDate) && offer.endDate < day) return false;
    if (validDay(date) && offer.startDate && validDay(offer.startDate) && offer.startDate > date) return false;
    if (offer.availability === 'dated') return !!offer.startDate && !!offer.endDate && validDay(offer.startDate) && validDay(offer.endDate) && offer.startDate <= offer.endDate;
    return true;
  });
}
