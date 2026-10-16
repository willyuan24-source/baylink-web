import { Cover, CoverImage, COVER_SIZES, EventTypeCover, OfferTypeCover, OpeningTypeCover, TypeCover } from '../../components/ui';
import { eventDateChip, eventTone, formatDateChip, offerTone, offerValue } from '../../lib/event-facts';
import { useUiCopy } from '../../components/ui/ui-copy';
import { translateText } from '../../i18n/locale';
import type { ImageCover, ResolvedCover } from '../../lib/cover';
import type { EventFactsInput } from '../../lib/event-facts';
import type { DetailRecord } from './detail-record';
import { offerBrand } from './reader-text';

const webLink = (value: string | undefined): value is string => !!value && /^https:\/\//.test(value);

/**
 * The detail hero (EVT11-03, SV-05; design.md §4.9): the first thing on the page, 16:9 full-bleed on a phone and 800×450 on
 * a desktop. A photo shows its provenance badge top-left (posters letterboxed on their blur, never cropped); with no
 * qualifying image the listing's TypeCover stands in. It is the page's largest image, so it loads eagerly. Ended events
 * are desaturated. The credit line is in the source section (HeroCredit), so the facts stay on the first screen.
 */
export function DetailHero({ record, cover, today, ended }: { record: DetailRecord; cover: ResolvedCover; today: string; ended: boolean }) {
  const { item } = record;
  const { locale, pick, english } = useUiCopy();
  // An offer or an opening without a qualifying image: the chips, the H1 and the brand line right below already say its
  // kind, title, brand and validity, so the coded cover shrinks to a band with what they do not (the value large, or the
  // kind of shop) instead of a 16:9 card that repeats the header (PROD-W3 review). The offer's kind is its first chip, so
  // its band shows only the value; an offer with no stated value keeps a slim band (tone and icon, no words) so every
  // detail still opens on its hero (EVT11-03, SV-05).
  if (cover.tier === 'type' && item.kind === 'offer') {
    const value = offerValue(item.offer);
    return <figure className="detail-hero" data-tier="type" data-compact="" data-slim={value ? undefined : ''}>
      <TypeCover family="offer" tone={offerTone(item.offer)} label="" value={value ? pick(value) : undefined}
        valueSmall={value?.condition ? pick(value.condition) || undefined : undefined} icon={offerTone(item.offer) === 'free' ? 'free' : 'store'} />
    </figure>;
  }
  if (cover.tier === 'type' && item.kind === 'opening') return <figure className="detail-hero" data-tier="type" data-compact=""><OpeningTypeCover opening={item.shop} today={today} compact /></figure>;
  // An event without a qualifying image (H28 / SV13-09): the same band. The chips, the H1 and 一眼看懂 right below already give
  // its kind, title, place and price, so the band carries only the big date (and the tone's art), not a 16:9 card that
  // repeated four of the first screen's six facts. A photo, a poster or a venue photo within 8 years keeps the 16:9 hero.
  if (cover.tier === 'type' && item.kind === 'event') {
    const event = item.event as EventFactsInput;
    const date = formatDateChip(eventDateChip(event, today), english);
    return <figure className="detail-hero" data-tier="type" data-compact="" data-kind="event" data-slim={date.big ? undefined : ''}>
      <TypeCover family="event" tone={eventTone(event)} label="" date={date} icon={event.iconKey ?? eventTone(event)} seed={event.id} />
    </figure>;
  }
  const slot = { ratio: '16:9' as const, ratioLock: true };
  const fallback = item.kind === 'event' ? <EventTypeCover event={item.event as EventFactsInput} today={today} {...slot} />
    : item.kind === 'offer' ? <OfferTypeCover offer={{ ...item.offer, brand: offerBrand(item.offer.brand, locale) }} today={today} {...slot} />
    : <OpeningTypeCover opening={item.shop} today={today} {...slot} />;
  return <figure className="detail-hero" data-tier={cover.tier}>
    <Cover cover={cover} {...slot} sizes={COVER_SIZES.detail} priority ended={ended} fallback={fallback} />
  </figure>;
}

/** The venue's archive photo below the summary (hero-cover.ts placePhoto), with its badge, caption and credit. */
export function DetailPlacePhoto({ photo }: { photo: ImageCover }) {
  const { pick } = useUiCopy();
  return <figure className="detail-photo">
    <CoverImage image={photo.image} label={pick(photo.label)} fit={photo.fit} focal={photo.focal} ratio="3:2" sizes={COVER_SIZES.detail} />
    <figcaption><HeroCredit cover={photo} label={false} /></figcaption>
  </figure>;
}

/** "图片：caption · credit · 图片授权" for the hero photo; nothing for a TypeCover. Under a figure the badge already says the label. */
export function HeroCredit({ cover, label = true }: { cover: ResolvedCover; label?: boolean }) {
  const { t, pick, locale } = useUiCopy();
  if (cover.tier === 'type') return null;
  const { image } = cover;
  return <p className="detail-credit">
    {label && <span className="detail-credit__label">{pick(cover.label)}</span>}
    {image.caption && <span>{translateText(image.caption, locale)}</span>}
    {webLink(image.creditUrl) ? <a href={image.creditUrl} target="_blank" rel="noopener noreferrer">{translateText(image.credit, locale)}</a> : <span>{translateText(image.credit, locale)}</span>}
    {webLink(image.licenseUrl) && <a href={image.licenseUrl} target="_blank" rel="noopener noreferrer">{t('图片授权', 'License')}</a>}
  </p>;
}
