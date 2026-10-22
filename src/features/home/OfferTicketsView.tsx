import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Cover, FeedCard, OfferCardMeta, OfferWhen, offerBrandLine } from '../../components/ui';
import { useUiCopy } from '../../components/ui/ui-copy';
import { SaveToWeek } from '../../components/SaveToWeek';
import type { ResolvedCover } from '../../lib/cover';
import { offerKindLabel, readerMonthDay } from '../../lib/event-facts';
import type { HomeOffer } from '../../lib/home-offers';
import { dateScope } from '../../lib/date-guard';

const TICKET_SIZES = '(max-width: 767px) 50vw, 290px';
/** The first ticket when it is a photo: the full width of a phone, two columns on a desktop (H19). */
const WIDE_SIZES = '(max-width: 767px) 100vw, 600px';

/**
 * ⑦ 免费与优惠 (1007 §4.2 ⑦, SV-03): 1:1 cards, each a picture (the brand's own image, its venue's photo or a ③ 示意图;
 * UI9-IMAGES DECISIONS 21/22) — what ends soonest first (H19, src/lib/home-offers.ts). Four in a 2 × 2 grid on a phone, four
 * across on a desktop (UI9-HOME); when the first is a landscape photo and the deadline offers still fit beside it
 * (`offerRailOpensWide`) it is the wide card (3:2, the full width on a phone, two columns on a desktop) and two more follow.
 * Under each: the deadline, the brand, the kind, the source check (as on the event cards) and ♡ (one save model). Rows at
 * 大 / 特大, hidden in 简洁.
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
  return <section className="home-offers" aria-labelledby="home-offers-title" data-simple="hide" {...dateScope('day')}>
    <div className="home-section-head">
      <h2 id="home-offers-title">{t('免费与优惠', 'Free & deals')}</h2>
      <Link to="/events?view=perks" className="home-section-head__more">{t('全部优惠', 'All deals')}<ArrowRight aria-hidden="true" strokeWidth={1.75} /></Link>
    </div>
    <ul className="home-offers__rail" aria-label={t('近期可用的免费与优惠', 'Free days and deals you can use soon')}>
      {offers.map((offer, index) => <li key={offer.id} data-wide={wide && index === 0 ? '' : undefined}>
        <FeedCard title={offer.title} to={`/offers/${offer.id}`}
          cover={<Cover cover={covers[index]} kind="offer" decorative {...(wide && index === 0 ? { ratio: '3:2' as const, sizes: WIDE_SIZES } : { ratio: '1:1' as const, sizes: TICKET_SIZES })} />}
          when={<OfferWhen offer={offer} today={today} />} meta={<OfferCardMeta brand={brands[index]} kind={pick(offerKindLabel(offer))} />}
          trust={offer.verifiedAt ? (offer.press ? t(`媒体报道 · ${readerMonthDay(offer.verifiedAt)} 核对`, `News report · checked ${readerMonthDay(offer.verifiedAt, true)}`)
            : `${t('官网核对', 'Source checked')} ${readerMonthDay(offer.verifiedAt, english)}`) : undefined}
          save={<SaveToWeek favorite={{ kind: 'offer', id: offer.id }} compact title={offer.title} />} />
      </li>)}
    </ul>
  </section>;
}
