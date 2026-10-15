import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { CoverCredit, FeedCard, OfferCardMeta, OfferCover, offerBrandLine } from '../../components/ui';
import { useUiCopy } from '../../components/ui/ui-copy';
import { SaveToWeek } from '../../components/SaveToWeek';
import type { ResolvedCover } from '../../lib/cover';
import { offerKindLabel, type OfferFactsInput } from '../../lib/event-facts';
import type { HomeOffer } from '../../lib/home-offers';
import { monthDay } from './home-model';
import { dateScope } from '../../lib/date-guard';
import { offerRailOpensWide } from '../../lib/home-offers';

const TICKET_SIZES = '(max-width: 767px) 176px, 300px';
/** The first ticket when it is a photo: the full width of a phone, two columns on a desktop (H19). */
const WIDE_SIZES = '(max-width: 767px) calc(100vw - 32px), 600px';

/**
 * ⑦ 免费与优惠 (1007 §4.2 ⑦, SV-03): 1:1 tickets — the brand's own image with its deadline, or the B information card with
 * the value large ("免费", "8 折") — what ends soonest first (H19, src/lib/home-offers.ts). When the first is a landscape
 * photo and the deadline offers still fit beside it (`offerRailOpensWide`) it is the wide ticket (3:2, the full width on a
 * phone, two columns on a desktop) and the rest sit in a two-column grid on a phone. Under each: the brand, the kind, the
 * source check (as on the event cards) and ♡ (one save model). An information card among them drops its badge and the rail
 * ends with one line that says what it is (H12, as FeedGrid).
 */
export function OfferTickets({ offers, covers, today }: { offers: readonly HomeOffer[]; covers: readonly ResolvedCover[]; today: string }) {
  const { t, pick, locale } = useUiCopy();
  if (!offers.length) return null;
  const brands = offers.map(offer => offerBrandLine(offer.brand, locale));
  const wide = offerRailOpensWide(offers, covers[0], today);
  // The credit line speaks only for tickets every layout shows: a narrow desktop rail shows three after a wide ticket and
  // four otherwise (home-discovery.css); one further back keeps its own badge instead.
  const typed = covers.slice(0, wide ? 3 : 4).some(cover => cover?.tier === 'type');
  return <section className="home-offers" aria-labelledby="home-offers-title" data-cover-credit={typed ? '' : undefined} {...dateScope('day')}>
    <div className="home-section-head">
      <h2 id="home-offers-title">{t('免费与优惠', 'Free & deals')}</h2>
      <Link to="/events?view=perks" className="home-section-head__more">{t('全部优惠', 'All deals')}<ArrowRight aria-hidden="true" strokeWidth={1.75} /></Link>
    </div>
    <ul className="home-offers__rail" aria-label={t('近期可用的免费与优惠', 'Free days and deals you can use soon')}>
      {offers.map((offer, index) => <li key={offer.id} data-wide={wide && index === 0 ? '' : undefined}>
        <FeedCard title={offer.title} to={`/offers/${offer.id}`}
          cover={<OfferCover offer={offer as OfferFactsInput} cover={covers[index]} today={today} {...(wide && index === 0 ? { ratio: '3:2' as const, sizes: WIDE_SIZES } : { sizes: TICKET_SIZES })} decorative />}
          meta={<OfferCardMeta brand={brands[index]} kind={pick(offerKindLabel(offer))} onCover={covers[index].tier === 'type'} />}
          trust={offer.verifiedAt ? <>{t('官网核对', 'Source checked')} {monthDay(offer.verifiedAt)}</> : undefined}
          save={<SaveToWeek favorite={{ kind: 'offer', id: offer.id }} compact title={offer.title} />} />
      </li>)}
    </ul>
    {typed && <CoverCredit />}
  </section>;
}
