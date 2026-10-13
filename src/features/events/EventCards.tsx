import type { ReactNode } from 'react';
import { translateText } from '../../i18n/locale';
import { EventCover, FeedCard, HeroCard, OfferCover, OpeningCover, RowCard, TypeCover, Cover, COVER_SIZES, offerBrandLine } from '../../components/ui';
import { useUiCopy } from '../../components/ui/ui-copy';
import type { ResolvedCover } from '../../lib/cover';
import { eventDateChip, eventPlace, eventPriceChip, eventTimeLabel, formatDateChip, offerKindLabel, openingChip, type CoverTone, type EventFactsInput } from '../../lib/event-facts';
import type { IndexEvent, IndexOffer, IndexOpening } from './events-index-types';
import { monthDay, regionLabel } from './events-model';
import { SaveToWeek } from '../../components/SaveToWeek';

const facts = (event: IndexEvent) => event as unknown as EventFactsInput;

/**
 * A phone-wide cover (a 4:5 pick, the calendar's lead) takes the 800w rung at most: 266px × DPR 3 = 798. At DPR 3 the
 * 1200w rung is about twice the bytes (autumn-ardenwood: 135 KB vs 72 KB) for a 358px slot, and on the cold profile
 * (1.6 Mbps) those bytes delay the page's largest image (RC-33); 800w is still 2.2 device pixels per CSS pixel there.
 */
export const PHONE_COVER_CAP = '(max-width: 767px) 266px';
const HERO_SIZES = `${PHONE_COVER_CAP}, 380px`;
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

/**
 * Two-column feed card (3:4): the cover from `resolveCovers`, title, place · price, and the source check. `day` (the
 * calendar's chosen day) goes into the link, so the detail page opens on it. `action` (the calendar's 加入这天计划,
 * WEB-SAVES) is a sibling of the card link under the meta lines; the weekend feed passes none (one link per card).
 */
export function EventFeedCard({ event, cover, tone, today, days, day, priority, sizes, heading = 'h3', action }: { event: IndexEvent; cover: ResolvedCover; tone?: CoverTone; today: string; days?: readonly string[]; day?: string; priority?: boolean; sizes?: string; heading?: 'h2' | 'h3'; action?: ReactNode }) {
  return <FeedCard title={event.title} to={day ? `/events/${event.id}?date=${day}` : `/events/${event.id}`} heading={heading} className={action ? 'ev-card--action' : undefined}
    cover={<EventCover event={facts(event)} cover={cover} tone={tone} today={today} days={days} priority={priority} sizes={sizes} decorative />}
    meta={<EventMeta event={event} />} trust={<TrustLine day={event.verifiedAt} />} save={action} />;
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
    cover={<EventCover event={facts(event)} cover={cover} today={today} days={[date]} ratio="4:5" ratioLock priority={priority} sizes={HERO_SIZES} decorative />}
    kicker={city === region || (event.city === 'San Francisco' && event.region === 'sf') ? region : `${city} · ${region}`}
    facts={[[chip.label, time].filter(Boolean).join(' · '), ...(price ? [pick(price.text)] : [])]}
    reason={reason ? { label: t('编辑推荐', 'Editor’s pick'), text: pick(reason) } : undefined}
    trust={<TrustLine day={event.verifiedAt} />} />;
}

/**
 * Calendar and share-strip row (88×88 thumbnail): "周六 10/10 · 10:00–18:00", the title, "Fremont · $8–12". `action`
 * (the calendar's 加入这天计划, WEB-SAVES) is the row's one trailing control, under the text.
 */
export function EventRowCard({ event, cover, today, day, action }: { event: IndexEvent; cover: ResolvedCover; today: string; day: string; action?: ReactNode }) {
  const { english } = useUiCopy();
  const chip = formatDateChip(eventDateChip(facts(event), today, [day]), english);
  const time = eventTimeLabel(facts(event), day, english);
  const thumb = <Cover cover={cover} ratio="1:1" sizes={COVER_SIZES.thumb} decorative
    fallback={<TypeCover size="mini" tone={event.category} label="" date={chip} ariaHidden />} />;
  return <RowCard title={event.title} to={`/events/${event.id}?date=${day}`} thumb={thumb} className={action ? 'ev-card--action' : undefined}
    date={[chip.label, time].filter(Boolean).join(' · ')} meta={<EventMeta event={event} />} trailing={action} />;
}

/**
 * Offer card (1:1): the brand's own image with a deadline sticker, or the B TypeCover with the value large. Its ♡ saves
 * the offer (the one save model, WEB-SAVES; the lazy `SaveToWeek` keeps the store off the route graph).
 */
export function OfferFeedCard({ offer, cover, today, tone }: { offer: IndexOffer; cover: ResolvedCover; today: string; tone?: CoverTone }) {
  const { pick, locale } = useUiCopy();
  const brand = offerBrandLine(offer.brand, locale);
  return <FeedCard title={offer.title} to={`/offers/${offer.id}`} className="ev-card--action"
    cover={<OfferCover offer={offer} cover={cover} today={today} tone={tone} decorative />}
    meta={<>{brand && <><span translate="no">{brand}</span> · </>}{pick(offerKindLabel(offer))}</>}
    trust={<TrustLine day={offer.verifiedAt} />} save={<SaveToWeek favorite={{ kind: 'offer', id: offer.id }} compact title={offer.title} />} />;
}

/** New shop card: the shop's own image, or the opening TypeCover ("10 月开业" / "即将开业"). Its ♡ saves the opening (WEB-SAVES). */
export function OpeningFeedCard({ opening, cover, today, tone }: { opening: IndexOpening; cover: ResolvedCover; today: string; tone?: CoverTone }) {
  const { pick, locale } = useUiCopy();
  return <FeedCard title={opening.name} to={`/openings/${opening.id}`} titleLang={HAN.test(opening.name) ? undefined : 'en'} className="ev-card--action"
    cover={<OpeningCover opening={opening} cover={cover} today={today} tone={tone} decorative />}
    meta={<>{translateText(opening.city, locale)} · {pick(openingChip(opening, today))}</>}
    trust={<TrustLine day={opening.verifiedAt} />} save={<SaveToWeek favorite={{ kind: 'opening', id: opening.id }} compact title={opening.name} />} />;
}

