import type { CSSProperties, ReactNode } from 'react';
import './ui.css';
import './covers.css';
import './cards.css';
import { ProvenanceBadge } from './Badges';
import { cx, useUiCopy } from './ui-copy';
import { COVER_SIZES } from './cover-sizes';
import type { CoverAsset, ResolvedCover } from '../../lib/cover';

/** `5:4` is the feed default (UI9-C, D2); `16:10` is the BayBay answer card (264 wide, design.md §4.7.7). */
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
  kind?: string;
  /** Overlays other than the provenance chip (none on listing covers since UI9-C: ♡ is the card's). */
  children?: ReactNode;
  className?: string;
};

/**
 * One photo or poster cover: srcset/sizes, a dominant-colour placeholder, the focal-point crop (photo family) or the whole
 * flyer on its board (poster family), and the provenance chip. Render through `getCover()`; never pick images here.
 * A listing cover (`kind`, set by EventCover, OfferCover, OpeningCover and the guide covers) is the photo or poster family
 * with the chip; the AI 3D postcards (`image.scene3d`) and the pictures without a kind (/explore, plan stops, saved items) keep
 * their frame and badge exactly as before: no family attributes, no chip look.
 */
export function CoverImage({ image, label, fit = 'cover', focal = [50, 40], ratio, ratioLock, sizes = COVER_SIZES.feed, priority, ended, decorative, kind, children, className }: CoverImageProps) {
  const style = { ...(image.lqip ? { '--ui-lqip': image.lqip } : {}) } as CSSProperties;
  const imgStyle: CSSProperties | undefined = fit === 'cover' ? { objectPosition: `${focal[0]}% ${focal[1]}%` } : undefined;
  const loading = priority ? { loading: 'eager' as const, fetchpriority: 'high' } : { loading: 'lazy' as const };
  const family = !kind || image.scene3d ? undefined : fit === 'contain' ? 'poster' : 'photo';
  return <div className={cx('ui-cover', className)} data-cover="image" data-fit={fit} data-ratio={ratio} data-ratio-lock={ratioLock ? '' : undefined} data-ended={ended ? '' : undefined}
    data-family={family} data-kind={family && kind} data-mark={family && (family === 'poster' ? 'mat' : 'focal')} style={style}>
    <img className="ui-cover__img" src={image.src} srcSet={image.srcSet} sizes={sizes} alt={decorative ? '' : image.alt} width={image.width} height={image.height} decoding="async" style={imgStyle} {...loading} />
    {label && <ProvenanceBadge label={label} plain={!family} />}
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
export function Cover({ cover, fallback, ratio, ratioLock, sizes = COVER_SIZES.feed, priority, decorative, ended, kind, children }: CoverSlot & { fallback: ReactNode; ended?: boolean; kind?: string; children?: ReactNode }) {
  const { pick } = useUiCopy();
  if (cover.tier === 'type') return <>{fallback}</>;
  return <CoverImage image={cover.image} label={pick(cover.label)} fit={cover.fit} focal={cover.focal} ratio={ratio} ratioLock={ratioLock}
    sizes={sizes} priority={priority} decorative={decorative} ended={ended} kind={kind}>{children}</CoverImage>;
}
