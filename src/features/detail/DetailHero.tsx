import { Cover, CoverImage, COVER_SIZES, useTierLabel } from '../../components/ui';
import { creditAfterLabel } from '../../components/ui/CoverImage';
import { useUiCopy } from '../../components/ui/ui-copy';
import { translateText } from '../../i18n/locale';
import type { ImageCover, ResolvedCover } from '../../lib/cover';
import type { DetailRecord } from './detail-record';

/**
 * The detail hero (EVT11-03, SV-05; design.md §4.9): the first thing on the page, 16:9 full-bleed on a phone and the main
 * column's eight grid columns on a desktop (local-discovery-detail.css), for events, offers and openings alike (R2-01 / R2-13:
 * one frame, a brand image whole on FOUNDATION's blurred copy of itself). It is always a picture (UI9-IMAGES DECISIONS 21:
 * the record's next candidate, build-detail.ts → hero-cover.ts) with its one label at the bottom-left and, at the
 * bottom-right, the photographer or source as quiet text on the picture (C P08: off the reading line; N25: not a link, the
 * links are in 本页图片来源). It is the page's largest image, so it loads eagerly; ended events are desaturated.
 */
export function DetailHero({ record, cover, ended }: { record: DetailRecord; cover: ResolvedCover; today?: string; ended: boolean }) {
  const { item } = record;
  const slot = { ratio: '16:9' as const, ratioLock: true };
  return <figure className="detail-hero" data-tier={cover.tier}>
    <Cover cover={cover} {...slot} kind={item.kind} sizes={COVER_SIZES.detail} priority ended={ended}><HeroCredit cover={cover} /></Cover>
  </figure>;
}

/** The venue's archive photo below the summary (hero-cover.ts placePhoto), with its badge and the same credit on the picture. */
export function DetailPlacePhoto({ photo }: { photo: ImageCover }) {
  const { pick } = useUiCopy();
  // Not a cover: a venue photo past the 8-year cover rule keeps its archive words (资料图 · 年份, DECISIONS 23 kept labels).
  return <figure className="detail-photo">
    <CoverImage image={photo.image} label={pick(photo.label)} fit={photo.fit} focal={photo.focal} ratio="3:2" sizes={COVER_SIZES.detail}><HeroCredit cover={photo} archive /></CoverImage>
  </figure>;
}

/**
 * The credit on a photo (G13, C P08): the photographer or source after the label's words, as plain 13 px text on a dark chip
 * at the picture's bottom-right (white on --color-badge-bg reads ≥6.25:1 over any pixel), at most two lines, never cut. Not
 * a link (N25: an 18–21 px link in the elder modes): the credit and licence links are in 本页图片来源 (PageCredits), which
 * lists every photo on the page. The provenance words are the picture's own label (DECISIONS 23: one label per picture),
 * so the credit neither repeats them nor a credit that starts with them. The long caption stays in the source section
 * (HeroCaption).
 */
export function HeroCredit({ cover, archive }: { cover: ResolvedCover; archive?: boolean }) {
  const { locale, pick } = useUiCopy();
  const tierLabel = useTierLabel();
  if (cover.tier === 'type') return null;
  const credit = creditAfterLabel(archive ? pick(cover.label) : tierLabel(cover), translateText(cover.image.credit, locale));
  return credit ? <span className="detail-photo-credit">{credit}</span> : null;
}
