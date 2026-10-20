import { homeOfferCount } from '../../lib/home-offers';
import { OfferTicketsView, type OfferTicketsProps } from './OfferTicketsView';

/**
 * ⑦ 免费与优惠 with the home's ticket count (homeOfferCount: three after a wide ticket, else four; OfferTicketsView.tsx draws
 * it). HomeDiscovery renders the view itself, after the page in production, and passes the same count in.
 */
export function OfferTickets(props: OfferTicketsProps) {
  return props.offers.length ? <OfferTicketsView {...props} count={homeOfferCount(props.offers, props.covers, props.today)} /> : null;
}
