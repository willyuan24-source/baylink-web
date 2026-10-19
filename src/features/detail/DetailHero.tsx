import { Cover, CoverImage, COVER_SIZES, EventTypeCover, OfferTypeCover, OpeningTypeCover } from '../../components/ui';
import { useUiCopy } from '../../components/ui/ui-copy';
import { translateText } from '../../i18n/locale';
import type { ImageCover, ResolvedCover } from '../../lib/cover';
import type { EventFactsInput } from '../../lib/event-facts';
import type { DetailRecord } from './detail-record';
import { offerBrand } from './reader-text';

const webLink = (value: string | undefined): value is string => !!value && /^https:\/\//.test(value);

/**
 * The detail hero (EVT11-03, SV-05; design.md §4.9): the first thing on the page, 16:9 full-bleed on a phone and 800×450 on
 * a desktop. A photo shows its provenance chip (posters whole on their board, never cropped or blurred). With no qualifying
 * image the listing's family cover (UI9-C) fills the same frame and prints what the H1 and the chips do not: the day, the
 * time and the 6–24 h bar (date), the value and the deadline stub (ticket), what the shop sells and its opening day (shop).
 * It is the page's largest image, so it loads eagerly; ended events are desaturated. The credit line is in the source
 * section (HeroCredit), so the facts stay on the first screen.
 */
export function DetailHero({ record, cover, today, ended }: { record: DetailRecord; cover: ResolvedCover; today: string; ended: boolean }) {
  const { item } = record;
  const { locale } = useUiCopy();
  const slot = { ratio: '16:9' as const, ratioLock: true };
  const fallback = item.kind === 'event' ? <EventTypeCover event={item.event as EventFactsInput} today={today} {...slot} />
    : item.kind === 'offer' ? <OfferTypeCover offer={{ ...item.offer, brand: offerBrand(item.offer.brand, locale) }} today={today} {...slot} />
    : <OpeningTypeCover opening={item.shop} today={today} {...slot} />;
  return <figure className="detail-hero" data-tier={cover.tier}>
    <Cover cover={cover} {...slot} kind={item.kind} sizes={COVER_SIZES.detail} priority ended={ended} fallback={fallback} />
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
