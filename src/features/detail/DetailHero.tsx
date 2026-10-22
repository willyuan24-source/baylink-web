import { Cover, CoverImage, COVER_SIZES, useTierLabel } from '../../components/ui';
import { creditAfterLabel } from '../../components/ui/CoverImage';
import { useUiCopy } from '../../components/ui/ui-copy';
import { translateText } from '../../i18n/locale';
import type { ImageCover, ResolvedCover } from '../../lib/cover';
import type { DetailRecord } from './detail-record';
import { webLink } from './hero-cover';

/**
 * The detail hero (EVT11-03, SV-05; design.md §4.9): the first thing on the page, 16:9 full-bleed on a phone and the main
 * column's eight grid columns on a desktop (local-discovery-detail.css). It is always a picture (UI9-IMAGES DECISIONS 21:
 * the record's next candidate, build-detail.ts → hero-cover.ts) with its badge (posters whole on their board, never cropped
 * or blurred) and, under it, the 13 px credit line (G13). It is the page's largest image, so it loads eagerly; ended events
 * are desaturated.
 */
export function DetailHero({ record, cover, ended }: { record: DetailRecord; cover: ResolvedCover; today?: string; ended: boolean }) {
  const { item } = record;
  const slot = { ratio: '16:9' as const, ratioLock: true };
  return <figure className="detail-hero" data-tier={cover.tier}>
    <Cover cover={cover} {...slot} kind={item.kind} sizes={COVER_SIZES.detail} priority ended={ended} />
    {cover.tier !== 'type' && <figcaption><HeroCredit cover={cover} /></figcaption>}
  </figure>;
}

/** The venue's archive photo below the summary (hero-cover.ts placePhoto), with its badge and the same credit line. */
export function DetailPlacePhoto({ photo }: { photo: ImageCover }) {
  const { pick } = useUiCopy();
  // Not a cover: a venue photo past the 8-year cover rule keeps its archive words (资料图 · 年份, DECISIONS 23 kept labels).
  return <figure className="detail-photo">
    <CoverImage image={photo.image} label={pick(photo.label)} fit={photo.fit} focal={photo.focal} ratio="3:2" sizes={COVER_SIZES.detail} />
    <figcaption><HeroCredit cover={photo} archive /></figcaption>
  </figure>;
}

/**
 * The credit line under a photo (G13): its provenance label first (ink-2), then the linked credit, then 图片授权; 13 px, ink-3,
 * at most two lines on a phone. The long caption stays in the source section (HeroCaption).
 */
export function HeroCredit({ cover, archive }: { cover: ResolvedCover; archive?: boolean }) {
  const { t, locale, pick } = useUiCopy();
  const tierLabel = useTierLabel();
  const label = (shown: ImageCover) => archive ? pick(shown.label) : tierLabel(shown);
  if (cover.tier === 'type') return null;
  const { image } = cover;
  const words = label(cover);
  const credit = creditAfterLabel(words, translateText(image.credit, locale));
  return <span className="detail-credit">
    <span className="detail-credit__label">{words}</span>
    {credit && (webLink(image.creditUrl) ? <a href={image.creditUrl} target="_blank" rel="noopener noreferrer">{credit}</a> : <span>{credit}</span>)}
    {webLink(image.licenseUrl) && <a href={image.licenseUrl} target="_blank" rel="noopener noreferrer" data-simple="hide">{t('图片授权', 'License')}</a>}
  </span>;
}
