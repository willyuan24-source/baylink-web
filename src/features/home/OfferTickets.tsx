import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { FeedCard, OfferCover } from '../../components/ui';
import { useUiCopy } from '../../components/ui/ui-copy';
import { SaveToWeek } from '../../components/SaveToWeek';
import type { ResolvedCover } from '../../lib/cover';
import { brandCase, offerKindLabel, type OfferFactsInput } from '../../lib/event-facts';
import type { HomeOffer } from '../../lib/home-offers';

const TICKET_SIZES = '(max-width: 767px) 160px, 200px';

/**
 * ⑦ 免费与优惠 (1007 §4.2 ⑦, SV-03): a rail of 1:1 tickets — the brand's own image with its deadline, or the B information
 * card with the value large ("免费", "8 折") — ending soonest first, then public benefits. ♡ saves the offer (one save model).
 */
export function OfferTickets({ offers, covers, today }: { offers: readonly HomeOffer[]; covers: readonly ResolvedCover[]; today: string }) {
  const { t, pick } = useUiCopy();
  if (!offers.length) return null;
  return <section className="home-offers" aria-labelledby="home-offers-title">
    <div className="home-section-head">
      <h2 id="home-offers-title">{t('免费与优惠', 'Free & deals')}</h2>
      <Link to="/events?view=perks" className="home-section-head__more">{t('全部优惠', 'All deals')}<ArrowRight aria-hidden="true" strokeWidth={1.75} /></Link>
    </div>
    <ul className="home-offers__rail" aria-label={t('近期可用的免费与优惠', 'Free days and deals you can use soon')}>
      {offers.map((offer, index) => <li key={offer.id}>
        <FeedCard title={offer.title} to={`/offers/${offer.id}`}
          cover={<OfferCover offer={offer as OfferFactsInput} cover={covers[index]} today={today} sizes={TICKET_SIZES} decorative />}
          meta={<><span translate="no">{brandCase(offer.brand)}</span> · {pick(offerKindLabel(offer))}</>}
          save={<SaveToWeek favorite={{ kind: 'offer', id: offer.id }} compact title={offer.title} />} />
      </li>)}
    </ul>
  </section>;
}
