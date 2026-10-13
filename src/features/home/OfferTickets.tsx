import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { FeedCard, OfferCardMeta, OfferCover, offerBrandLine } from '../../components/ui';
import { useUiCopy } from '../../components/ui/ui-copy';
import { SaveToWeek } from '../../components/SaveToWeek';
import type { ResolvedCover } from '../../lib/cover';
import { offerKindLabel, type OfferFactsInput } from '../../lib/event-facts';
import type { HomeOffer } from '../../lib/home-offers';
import { monthDay } from './home-model';
import { dateScope } from '../../lib/date-guard';

const TICKET_SIZES = '(max-width: 767px) 176px, 300px';

/**
 * ⑦ 免费与优惠 (1007 §4.2 ⑦, SV-03): a rail of 1:1 tickets — the brand's own image with its deadline, or the B information
 * card with the value large ("免费", "8 折") — ending soonest first, then public benefits. Under each: the brand, the kind,
 * the source check (as on the event cards) and ♡, which saves the offer (one save model).
 */
export function OfferTickets({ offers, covers, today }: { offers: readonly HomeOffer[]; covers: readonly ResolvedCover[]; today: string }) {
  const { t, pick, locale } = useUiCopy();
  if (!offers.length) return null;
  const brands = offers.map(offer => offerBrandLine(offer.brand, locale));
  return <section className="home-offers" aria-labelledby="home-offers-title" {...dateScope('day')}>
    <div className="home-section-head">
      <h2 id="home-offers-title">{t('免费与优惠', 'Free & deals')}</h2>
      <Link to="/events?view=perks" className="home-section-head__more">{t('全部优惠', 'All deals')}<ArrowRight aria-hidden="true" strokeWidth={1.75} /></Link>
    </div>
    <ul className="home-offers__rail" aria-label={t('近期可用的免费与优惠', 'Free days and deals you can use soon')}>
      {offers.map((offer, index) => <li key={offer.id}>
        <FeedCard title={offer.title} to={`/offers/${offer.id}`}
          cover={<OfferCover offer={offer as OfferFactsInput} cover={covers[index]} today={today} sizes={TICKET_SIZES} decorative />}
          meta={<OfferCardMeta brand={brands[index]} kind={pick(offerKindLabel(offer))} onCover={covers[index].tier === 'type'} />}
          trust={offer.verifiedAt ? <>{t('官网核对', 'Source checked')} {monthDay(offer.verifiedAt)}</> : undefined}
          save={<SaveToWeek favorite={{ kind: 'offer', id: offer.id }} compact title={offer.title} />} />
      </li>)}
    </ul>
  </section>;
}
