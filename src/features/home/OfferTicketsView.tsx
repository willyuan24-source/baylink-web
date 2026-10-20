import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Cover, CoverCredit, FeedCard, OfferCardMeta, OfferWhen, offerBrandLine } from '../../components/ui';
import { DeferredOfferTypeCover } from '../../components/ui/cover-defer';
import { useUiCopy } from '../../components/ui/ui-copy';
import { SaveToWeek } from '../../components/SaveToWeek';
import type { ResolvedCover } from '../../lib/cover';
import { offerKindLabel, readerMonthDay, type OfferFactsInput } from '../../lib/event-facts';
import type { HomeOffer } from '../../lib/home-offers';
import { dateScope } from '../../lib/date-guard';

const TICKET_SIZES = '(max-width: 767px) 50vw, 290px';
/** The first ticket when it is a photo: the full width of a phone, two columns on a desktop (H19). */
const WIDE_SIZES = '(max-width: 767px) 100vw, 600px';

/**
 * ⑦ 免费与优惠 (1007 §4.2 ⑦, SV-03): 1:1 tickets — the brand's own image with its deadline, or the B information card with
 * the value large ("免费", "8 折") — what ends soonest first (H19, src/lib/home-offers.ts). Four in a 2 × 2 grid on a
 * phone, four across on a desktop (UI9-HOME); when the first is a landscape photo and the deadline offers still fit beside
 * it (`offerRailOpensWide`) it is the wide ticket (3:2, the full width on a phone, two columns on a desktop) and two more
 * follow. Under each: the brand, the kind, the source check (as on the event cards) and ♡ (one save model). An information
 * card among them drops its badge; the page's credits line says once what it is (H12). Rows at 大 / 特大, hidden in 简洁.
 *
 * `count` is src/lib/home-offers.ts homeOfferCount (3 after a wide ticket, else 4), passed in (OfferTickets.tsx, HomeDiscovery):
 * the home loads this view after the page in production, and a view that imported the home's own modules would make the
 * home's chunk export them, which drops its manifest entry (scripts/verify-release.mjs reads src/pages/HomePage.tsx).
 */
export type OfferTicketsProps = { offers: readonly HomeOffer[]; covers: readonly ResolvedCover[]; today: string };

export function OfferTicketsView({ offers: selected, covers, today, count }: OfferTicketsProps & { count: number }) {
  const { t, pick, locale, english } = useUiCopy();
  if (!selected.length) return null;
  const wide = count === 3;
  const offers = selected.slice(0, count);
  const brands = offers.map(offer => offerBrandLine(offer.brand, locale));
  // A credited ticket drops the info-card badge: the line under the tickets says what it is (on the home it is printed
  // once, in the credits line; home-discovery.css hides this one).
  const typed = offers.some((_, index) => covers[index]?.tier === 'type');
  return <section className="home-offers" aria-labelledby="home-offers-title" data-cover-credit={typed ? '' : undefined} data-simple="hide" {...dateScope('day')}>
    <div className="home-section-head">
      <h2 id="home-offers-title">{t('免费与优惠', 'Free & deals')}</h2>
      <Link to="/events?view=perks" className="home-section-head__more">{t('全部优惠', 'All deals')}<ArrowRight aria-hidden="true" strokeWidth={1.75} /></Link>
    </div>
    <ul className="home-offers__rail" aria-label={t('近期可用的免费与优惠', 'Free days and deals you can use soon')}>
      {offers.map((offer, index) => <li key={offer.id} data-wide={wide && index === 0 ? '' : undefined}>
        <FeedCard title={offer.title} to={`/offers/${offer.id}`}
          cover={<Cover cover={covers[index]} kind="offer" decorative {...(wide && index === 0 ? { ratio: '3:2' as const, sizes: WIDE_SIZES } : { ratio: '1:1' as const, sizes: TICKET_SIZES })}
            fallback={<DeferredOfferTypeCover offer={offer as OfferFactsInput} today={today} ratio={wide && index === 0 ? '3:2' : '1:1'} ariaHidden />} />}
          when={<OfferWhen offer={offer} today={today} />} meta={<OfferCardMeta brand={brands[index]} kind={pick(offerKindLabel(offer))} onCover={covers[index].tier === 'type'} />}
          trust={offer.verifiedAt ? <>{t('官网核对', 'Source checked')} {readerMonthDay(offer.verifiedAt, english)}</> : undefined}
          save={<SaveToWeek favorite={{ kind: 'offer', id: offer.id }} compact title={offer.title} />} />
      </li>)}
    </ul>
    {typed && <CoverCredit />}
  </section>;
}
