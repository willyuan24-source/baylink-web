import { Cover, CoverImage, COVER_SIZES, EventTypeCover, OfferTypeCover, OpeningTypeCover } from '../../components/ui';
import { useUiCopy } from '../../components/ui/ui-copy';
import { translateText } from '../../i18n/locale';
import type { ImageCover, ResolvedCover } from '../../lib/cover';
import type { EventFactsInput } from '../../lib/event-facts';
import type { DetailRecord } from './detail-record';

const webLink = (value: string | undefined): value is string => !!value && /^https:\/\//.test(value);

/**
 * The detail hero (EVT11-03, SV-05; design.md §4.9): the first thing on the page, 16:9 full-bleed on a phone and 800×450 on
 * a desktop. A photo shows its provenance badge top-left (posters letterboxed on their blur, never cropped); with no
 * qualifying image the listing's TypeCover stands in. It is the page's largest image, so it loads eagerly. Ended events
 * are desaturated. The credit line is in the source section (HeroCredit), so the facts stay on the first screen.
 */
export function DetailHero({ record, cover, today, ended }: { record: DetailRecord; cover: ResolvedCover; today: string; ended: boolean }) {
  const { item } = record;
  const slot = { ratio: '16:9' as const, ratioLock: true };
  const fallback = item.kind === 'event' ? <EventTypeCover event={item.event as EventFactsInput} today={today} {...slot} />
    : item.kind === 'offer' ? <OfferTypeCover offer={item.offer} today={today} {...slot} />
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
    <figcaption><HeroCredit cover={photo} /></figcaption>
  </figure>;
}

/** "图片：caption · credit · 图片授权" for the hero photo; nothing for a TypeCover. */
export function HeroCredit({ cover }: { cover: ResolvedCover }) {
  const { t, pick, locale } = useUiCopy();
  if (cover.tier === 'type') return null;
  const { image } = cover;
  return <p className="detail-credit">
    <span className="detail-credit__label">{pick(cover.label)}</span>
    {image.caption && <span>{translateText(image.caption, locale)}</span>}
    {webLink(image.creditUrl) ? <a href={image.creditUrl} target="_blank" rel="noopener noreferrer">{translateText(image.credit, locale)}</a> : <span>{translateText(image.credit, locale)}</span>}
    {webLink(image.licenseUrl) && <a href={image.licenseUrl} target="_blank" rel="noopener noreferrer">{t('图片授权', 'Licence')}</a>}
  </p>;
}
