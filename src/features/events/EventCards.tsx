import { translateText } from '../../i18n/locale';
import { EventCover, FeedCard, HeroCard, OfferCover, OpeningCover, RowCard, TypeCover, Cover, COVER_SIZES } from '../../components/ui';
import { useUiCopy } from '../../components/ui/ui-copy';
import type { ResolvedCover } from '../../lib/cover';
import { eventDateChip, eventPlace, eventPriceChip, eventTimeLabel, formatDateChip, brandCase, offerKindLabel, openingChip, type CoverTone, type EventFactsInput } from '../../lib/event-facts';
import type { IndexEvent, IndexOffer, IndexOpening } from './events-index-types';
import { monthDay, regionLabel } from './events-model';

const facts = (event: IndexEvent) => event as unknown as EventFactsInput;
const HAN = /[\u3400-\u9fff]/;

/** "官网核对 10/2" / "Source checked 10/2": the record's own check date, never a bumped one (D12). */
export function TrustLine({ day }: { day?: string }) {
  const { t } = useUiCopy();
  if (!day) return null;
  return <>{t('官网核对', 'Source checked')} {monthDay(day)}</>;
}

/** The place and price line under a card: "Berkeley · 免费" (free in brand 600), or the place alone when the cost is unknown. */
export function EventMeta({ event }: { event: IndexEvent }) {
  const { pick, locale } = useUiCopy();
  const price = eventPriceChip(facts(event));
  const place = translateText(eventPlace(event), locale);
  return <>{place}{price && <> · {price.tone === 'free' ? <strong>{pick(price.text)}</strong> : pick(price.text)}</>}</>;
}

/** Two-column feed card (3:4): the cover from `resolveCovers`, title, place · price, and the source check. */
export function EventFeedCard({ event, cover, tone, today, days, priority, heading = 'h3' }: { event: IndexEvent; cover: ResolvedCover; tone?: CoverTone; today: string; days?: readonly string[]; priority?: boolean; heading?: 'h2' | 'h3' }) {
  return <FeedCard title={event.title} to={`/events/${event.id}`} heading={heading}
    cover={<EventCover event={facts(event)} cover={cover} tone={tone} today={today} days={days} priority={priority} decorative />}
    meta={<EventMeta event={event} />} trust={<TrustLine day={event.verifiedAt} />} />;
}

/** 4:5 editor's pick: photo with the title on the scrim, or the A2 TypeCover with the title below. */
export function EventHeroCard({ event, cover, today, date, reason, priority }: { event: IndexEvent; cover: ResolvedCover; today: string; date: string; reason?: { zh: string; en: string }; priority?: boolean }) {
  const { english, pick, t, locale } = useUiCopy();
  const chip = formatDateChip(eventDateChip(facts(event), today, [date]), english);
  const time = eventTimeLabel(facts(event), date, english);
  const price = eventPriceChip(facts(event));
  const photo = cover.tier !== 'type';
  const region = pick(regionLabel(event.region));
  const city = translateText(eventPlace(event), locale);
  return <HeroCard title={translateText(event.title, locale)} to={`/events/${event.id}`} heading="h3" overlay={photo}
    cover={<EventCover event={facts(event)} cover={cover} today={today} days={[date]} ratio="4:5" ratioLock priority={priority} sizes={COVER_SIZES.hero} decorative />}
    kicker={city === region || (event.city === 'San Francisco' && event.region === 'sf') ? region : `${city} · ${region}`}
    facts={[[chip.label, time].filter(Boolean).join(' · '), ...(price ? [pick(price.text)] : [])]}
    reason={reason ? { label: t('编辑推荐', 'Editor’s pick'), text: pick(reason) } : undefined}
    trust={<TrustLine day={event.verifiedAt} />} />;
}

/** Calendar and share-strip row (88×88 thumbnail): "周六 10/10 · 10:00–18:00", the title, "Fremont · $8–12". */
export function EventRowCard({ event, cover, today, day }: { event: IndexEvent; cover: ResolvedCover; today: string; day: string }) {
  const { english } = useUiCopy();
  const chip = formatDateChip(eventDateChip(facts(event), today, [day]), english);
  const time = eventTimeLabel(facts(event), day, english);
  const thumb = <Cover cover={cover} ratio="1:1" sizes={COVER_SIZES.thumb} decorative
    fallback={<TypeCover size="mini" tone={event.category} label="" date={chip} ariaHidden />} />;
  return <RowCard title={event.title} to={`/events/${event.id}?date=${day}`} thumb={thumb}
    date={[chip.label, time].filter(Boolean).join(' · ')} meta={<EventMeta event={event} />} />;
}

/** Offer card (1:1): the brand's own image with a deadline sticker, or the B TypeCover with the value large. */
export function OfferFeedCard({ offer, cover, today, tone }: { offer: IndexOffer; cover: ResolvedCover; today: string; tone?: CoverTone }) {
  const { pick } = useUiCopy();
  return <FeedCard title={offer.title} to={`/offers/${offer.id}`}
    cover={<OfferCover offer={offer} cover={cover} today={today} tone={tone} decorative />}
    meta={<><span translate="no">{brandCase(offer.brand)}</span> · {pick(offerKindLabel(offer))}</>}
    trust={<TrustLine day={offer.verifiedAt} />} />;
}

/** New shop card: the shop's own image, or the opening TypeCover ("10 月开业" / "即将开业"). */
export function OpeningFeedCard({ opening, cover, today, tone }: { opening: IndexOpening; cover: ResolvedCover; today: string; tone?: CoverTone }) {
  const { pick, locale } = useUiCopy();
  return <FeedCard title={opening.name} to={`/openings/${opening.id}`} titleLang={HAN.test(opening.name) ? undefined : 'en'}
    cover={<OpeningCover opening={opening} cover={cover} today={today} tone={tone} decorative />}
    meta={<>{translateText(opening.city, locale)} · {pick(openingChip(opening, today))}</>}
    trust={<TrustLine day={opening.verifiedAt} />} />;
}

