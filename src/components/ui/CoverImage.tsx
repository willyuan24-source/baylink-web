import type { CSSProperties, ReactNode } from 'react';
import './ui.css';
import './covers.css';
import './cards.css';
import { ProvenanceBadge } from './Badges';
import { cx, useUiCopy } from './ui-copy';
import { COVER_SIZES } from './cover-sizes';
import { chooseCover, type CoverFamily, type CoverListingKind } from '../../lib/cover-family';
import { typeCoverProvenance } from '../../lib/image-provenance';
import type { CoverAsset, ResolvedCover } from '../../lib/cover';
import type { CoverTone } from '../../lib/event-facts';

/** The feed default is 3:2 (UI9-C, captain decision 20; `5:4` is accepted from older callers and draws that default); `16:10` is the BayBay answer card (264 wide, design.md §4.7.7). */
export type CoverRatio = '3:4' | '4:5' | '5:4' | '1:1' | '16:9' | '16:10' | '3:2';

export type CoverImageProps = {
  image: Pick<CoverAsset, 'src' | 'alt' | 'width' | 'height'> & Partial<Pick<CoverAsset, 'srcSet' | 'lqip' | 'scene3d'>>;
  /** Provenance chip text from getImageProvenance(); omit only where the chip is shown elsewhere. */
  label?: string;
  /** `contain`: a poster or full-frame artwork, shown whole on a solid board with a white mat (the poster family; never blurred or cropped). */
  fit?: 'cover' | 'contain';
  focal?: readonly [number, number];
  ratio?: CoverRatio;
  /** Keep this ratio inside a single-column feed (hero cards). */
  ratioLock?: boolean;
  sizes?: string;
  /** The first cover on the page (LCP): eager with fetchpriority=high. Everything else is lazy. */
  priority?: boolean;
  /** Ended events desaturate. */
  ended?: boolean;
  /** Empty alt when the surrounding card already names the item. */
  decorative?: boolean;
  /** The listing kind (data-kind), from <Cover>. */
  kind?: CoverListingKind;
  /** Overlays other than the provenance chip (none on listing covers since UI9-C: ♡ is the card's). */
  children?: ReactNode;
  className?: string;
};

/**
 * One photo or poster cover: srcset/sizes, a dominant-colour placeholder, the focal-point crop (photo family) or the whole
 * flyer on its board (poster family), and the provenance chip. Render through `getCover()`; never pick images here.
 * A listing cover (`kind`, set by EventCover, OfferCover, OpeningCover and the guide covers) is the photo or poster family
 * with the chip; the AI 3D postcards (`image.scene3d`) and the pictures without a kind (/explore, guide and detail photos) keep
 * their frame and badge exactly as before: no family attributes, no chip look. A thumbnail without a kind (plan stops, saved
 * items, My Week) takes the chip look too: the plain badge keeps 56 px for a ♡ and would cut its words to two characters on an
 * 88 px thumb (N22: 0 truncated badges).
 */
export function CoverImage({ image, label, fit = 'cover', focal = [50, 40], ratio, ratioLock, sizes = COVER_SIZES.feed, priority, ended, decorative, kind, children, className }: CoverImageProps) {
  const style = { '--ui-lqip': image.lqip } as CSSProperties;
  // A poster's own shape (--ui-img-ratio, covers.css) lets the flyer fill its board however narrow `sizes` says the slot is.
  const imgStyle = (fit === 'cover' ? { objectPosition: `${focal[0]}% ${focal[1]}%` } : { '--ui-img-ratio': image.width / image.height }) as CSSProperties;
  const loading = priority ? { loading: 'eager' as const, fetchpriority: 'high' } : { loading: 'lazy' as const };
  const choice = kind && !image.scene3d ? chooseCover(kind, { tier: 'photo', fit }, { id: '' }) : undefined;
  return <div className={cx('ui-cover', className)} data-cover="image" data-fit={fit} data-ratio={ratio} data-ratio-lock={ratioLock ? '' : undefined} data-ended={ended ? '' : undefined}
    data-family={choice?.family} data-kind={choice && kind} data-mark={choice?.mark} style={style}>
    <img className="ui-cover__img" src={image.src} srcSet={image.srcSet} sizes={sizes} alt={decorative ? '' : image.alt} width={image.width} height={image.height} decoding="async" style={imgStyle} {...loading} />
    {label && <ProvenanceBadge label={label} plain={!choice && (!!image.scene3d || sizes !== COVER_SIZES.thumb)} />}
    {children}
  </div>;
}

export type CoverSlot = {
  /** From `getCover` / `resolveCovers`; a `type` result renders the item's type cover (src/lib/cover-family.ts). */
  cover: ResolvedCover;
  ratio?: CoverRatio;
  ratioLock?: boolean;
  sizes?: string;
  priority?: boolean;
  /** The card around the cover already reads the title and facts. */
  decorative?: boolean;
};

/**
 * A resolved photo or poster cover, or `fallback` (the item's type cover). Labels come from the resolver, i.e. from
 * getImageProvenance. A listing photo carries the provenance chip and nothing else (N22): the ♡ is the card's, and the date,
 * price and deadline live in the caption (Card.tsx `when` and meta lines).
 */
export function Cover({ cover, fallback, ratio, ratioLock, sizes = COVER_SIZES.feed, priority, decorative, ended, kind, children }: CoverSlot & { fallback: ReactNode; ended?: boolean; kind?: CoverListingKind; children?: ReactNode }) {
  const { pick } = useUiCopy();
  if (cover.tier === 'type') return <>{fallback}</>;
  return <CoverImage image={cover.image} label={pick(cover.label)} fit={cover.fit} focal={cover.focal} ratio={ratio} ratioLock={ratioLock}
    sizes={sizes} priority={priority} decorative={decorative} ended={ended} kind={kind}>{children}</CoverImage>;
}

/** A type cover's frame props (the five type families: cover-date, cover-ticket, cover-guide, cover-shop). */
export type CoverLayout = {
  ratio?: CoverRatio;
  ratioLock?: boolean;
  /** Row thumbnail (≤ 140 px): the key fact only. */
  size?: 'mini';
  /** Hide from assistive tech when the surrounding card already reads the same facts. */
  ariaHidden?: boolean;
  className?: string;
  /** Accepted for older callers and ignored: a cover keeps its own category colour (UI9-C removed the neighbour rotation). */
  tone?: CoverTone;
};

const HAN = /[㐀-鿿]/;
/** `lang="en"` for a Latin line on a Chinese page. */
export const latinLang = (text: string) => HAN.test(text) ? undefined : 'en';

/**
 * The type-cover frame (UI9-C), shared by the five type families. It lives with the photo frame (one module, one chunk:
 * every page that can draw a cover loads both). It carries `data-cover="type"` (the image-area probe counts it as cover
 * area, not photo area; RC-31), the family, kind, mark and key fact, the category tone and the BAYLINK 信息卡 chip
 * (typeCoverProvenance; a list that names the info card once hides it visually, cards.css).
 */
export function TypeFrame({ family, kind, mark, keyFact, tone, ratio, ratioLock, size, ariaHidden, className, children }: Omit<CoverLayout, 'tone'> & { family: CoverFamily; kind: string; mark: string; keyFact: string; tone?: CoverTone; children: ReactNode }) {
  const { english } = useUiCopy();
  return <div className={cx('ui-type-cover', className)} data-cover="type" data-family={family} data-kind={kind} data-mark={mark} data-key={keyFact} data-tone={tone}
    data-ratio={ratio} data-ratio-lock={ratioLock ? '' : undefined} data-size={size} aria-hidden={ariaHidden || undefined}>
    {size !== 'mini' && <ProvenanceBadge label={typeCoverProvenance(english)} />}
    {children}
  </div>;
}
