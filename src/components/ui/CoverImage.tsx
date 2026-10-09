import type { CSSProperties, ReactNode } from 'react';
import './ui.css';
import { ProvenanceBadge } from './Badges';
import { cx } from './ui-copy';
import { COVER_SIZES } from './cover-sizes';
import type { CoverAsset } from '../../lib/cover';

export type CoverRatio = '3:4' | '4:5' | '1:1' | '16:9' | '3:2';

export type CoverImageProps = {
  image: Pick<CoverAsset, 'src' | 'alt' | 'width' | 'height'> & Partial<Pick<CoverAsset, 'srcSet' | 'lqip'>>;
  /** Provenance badge text from getImageProvenance(); omit only where the badge is shown elsewhere. */
  label?: string;
  /** `contain` letterboxes posters and full-frame artwork on a blurred copy of themselves (never cropped). */
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
  /** Stickers (<StickerRow>) and other overlays. */
  children?: ReactNode;
  className?: string;
};

/**
 * One photo cover: srcset/sizes, a dominant-colour placeholder, focal-point cropping, the provenance badge,
 * and blur-fill for posters. Render through `getCover()`; never pick images here.
 */
export function CoverImage({ image, label, fit = 'cover', focal = [50, 40], ratio, ratioLock, sizes = COVER_SIZES.feed, priority, ended, decorative, children, className }: CoverImageProps) {
  const style = { ...(image.lqip ? { '--ui-lqip': image.lqip } : {}) } as CSSProperties;
  const imgStyle: CSSProperties | undefined = fit === 'cover' ? { objectPosition: `${focal[0]}% ${focal[1]}%` } : undefined;
  const loading = priority ? { loading: 'eager' as const, fetchpriority: 'high' } : { loading: 'lazy' as const };
  return <div className={cx('ui-cover', className)} data-cover="image" data-fit={fit} data-ratio={ratio} data-ratio-lock={ratioLock ? '' : undefined} data-ended={ended ? '' : undefined} style={style}>
    {fit === 'contain' && <img className="ui-cover__backdrop" src={image.src} srcSet={image.srcSet} sizes={sizes} alt="" aria-hidden="true" width={image.width} height={image.height} decoding="async" {...loading} />}
    <img className="ui-cover__img" src={image.src} srcSet={image.srcSet} sizes={sizes} alt={decorative ? '' : image.alt} width={image.width} height={image.height} decoding="async" style={imgStyle} {...loading} />
    {label && <ProvenanceBadge label={label} />}
    {children}
  </div>;
}
