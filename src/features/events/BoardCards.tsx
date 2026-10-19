import { FeedCard, OfferCardMeta, OfferCover, OpeningCover, offerBrandLine } from '../../components/ui';
import { useUiCopy } from '../../components/ui/ui-copy';
import { translateText } from '../../i18n/locale';
import type { ResolvedCover } from '../../lib/cover';
import { offerKindLabel, openingChip, type CoverTone } from '../../lib/event-facts';
import type { Favorite } from '../../lib/planner';
import { SaveToWeek } from '../../components/SaveToWeek';
import { TrustLine } from './EventCards';
import type { IndexOffer, IndexOpening } from './events-index-types';

/**
 * The 免费与优惠 and 新店 boards' cards (PerksView, OpeningsView). UI9-PREP moved them here from EventCards.tsx unchanged,
 * so the boards (UI9-FREE) and the event cards (UI9-EVENTS) live in different files. The source check line is the
 * event cards' TrustLine.
 */
const HAN = /[\u3400-\u9fff]/;

/** ♡ on the card's cover: the one save control, the same heart as the event cards (reader's name "收藏：<title>"). */
const CoverSave = ({ favorite, title }: { favorite: Favorite; title: string }) => <SaveToWeek favorite={favorite} compact title={title} />;

/**
 * Offer card (1:1): the brand's own image with a deadline sticker, or the B TypeCover with the value large. Its ♡ on the
 * cover saves the offer (the one save model, WEB-SAVES), as on event cards.
 */
export function OfferFeedCard({ offer, cover, today, tone }: { offer: IndexOffer; cover: ResolvedCover; today: string; tone?: CoverTone }) {
  const { pick, locale } = useUiCopy();
  const brand = offerBrandLine(offer.brand, locale);
  return <FeedCard title={offer.title} to={`/offers/${offer.id}`}
    cover={<OfferCover offer={offer} cover={cover} today={today} tone={tone} decorative />}
    meta={<OfferCardMeta brand={brand} kind={pick(offerKindLabel(offer))} onCover={cover.tier === 'type'} />}
    trust={<TrustLine day={offer.verifiedAt} />} save={<CoverSave favorite={{ kind: 'offer', id: offer.id }} title={offer.title} />} />;
}

/** New shop card: the shop's own image, or the opening TypeCover ("10 月开业" / "即将开业"). Its ♡ on the cover saves the opening. */
export function OpeningFeedCard({ opening, cover, today, tone }: { opening: IndexOpening; cover: ResolvedCover; today: string; tone?: CoverTone }) {
  const { pick, locale } = useUiCopy();
  return <FeedCard title={opening.name} to={`/openings/${opening.id}`} titleLang={HAN.test(opening.name) ? undefined : 'en'}
    cover={<OpeningCover opening={opening} cover={cover} today={today} tone={tone} decorative />}
    meta={<>{translateText(opening.city, locale)} · {pick(openingChip(opening, today))}</>}
    trust={<TrustLine day={opening.verifiedAt} />} save={<CoverSave favorite={{ kind: 'opening', id: opening.id }} title={opening.name} />} />;
}
