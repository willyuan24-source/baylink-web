import { useState, type CSSProperties, type ReactNode } from 'react';
import './ui.css';
import './covers.css';
import './cards.css';
import { ProvenanceBadge } from './Badges';
import { cx, useUiCopy } from './ui-copy';
import { COVER_SIZES } from './cover-sizes';
import type { CoverAsset, CoverTier, ResolvedCover } from '../../lib/cover';
import { tierLabelOf } from '../../lib/cover-labels';

/** The feed default is 3:2 (UI9-C, captain decision 20; `5:4` is accepted from older callers and draws that default); `16:10` is the BayBay answer card (264 wide, design.md §4.7.7). */
export type CoverRatio = '3:4' | '4:5' | '5:4' | '1:1' | '16:9' | '16:10' | '3:2';
/** The listing a cover belongs to (data-kind): events, offers, new shops, guides, services, places, bulletins. */
export type CoverListingKind = 'event' | 'offer' | 'opening' | 'guide' | 'service' | 'place' | 'bulletin';
type Src = Pick<CoverAsset, 'src'> & Partial<Pick<CoverAsset, 'srcSet'>>;

export type CoverImageProps = {
  image: Pick<CoverAsset, 'src' | 'alt' | 'width' | 'height'> & Partial<Pick<CoverAsset, 'srcSet' | 'lqip' | 'scene3d'>>;
  /** The badge words (DECISIONS 23: tierLabelOf through <Cover>; getImageProvenance for a 3D postcard); omit only where shown elsewhere. */
  label?: string;
  /** The tier the badge names (data-tier): a ③ 示意图 or ④ AI 示意图 badge stays on the picture in every size and mode. */
  tier?: Exclude<CoverTier, 'type'>;
  /** `contain`: a poster or full-frame artwork, shown whole on a solid board with a white mat (never blurred or cropped). */
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
  /** What the picture becomes when its file fails to load (UI9-IMAGES DECISIONS 21): a ③ stock picture of the same kind. */
  fallback?: Src;
  /** Overlays other than the badge (none on listing covers since UI9-C: ♡ is the card's). */
  children?: ReactNode;
  className?: string;
};

/**
 * Whether an image the browser already gave up on before React attached its handlers (a prerendered page) failed: complete,
 * no pixels, and a source it chose. A lazy image not yet fetched is not complete, and a test DOM never chooses a source.
 */
const failedBeforeHydration = (img: HTMLImageElement | null) => !!img && img.complete && !img.naturalWidth && !!img.currentSrc;

/**
 * One picture cover: srcset/sizes, a dominant-colour ground (LQIP), the focal-point crop (photo) or the whole flyer on its
 * board (poster), and one badge at its bottom-left (DECISIONS 23). Render through `getCover()` and <Cover>; never pick
 * images here. A file that fails to load (onError, DECISIONS 21) becomes the cover's `fallback` (a same-category ③
 * picture), and when that fails too the frame keeps its LQIP colour: never an information card. The AI 3D postcards
 * (`image.scene3d`) keep their frame and top-left ink badge exactly as before (DECISIONS 1).
 */
export function CoverImage({ image, label, tier, fit = 'cover', focal = [50, 40], ratio, ratioLock, sizes = COVER_SIZES.feed, priority, ended, decorative, kind, fallback, children, className }: CoverImageProps) {
  // 0: the cover's own file; 1: its fallback; 2: neither loaded (the LQIP colour shows).
  const [failed, setFailed] = useState(0);
  const fail = () => setFailed(step => step === 0 && fallback && fallback.src !== image.src ? 1 : 2);
  const shown: Src = failed === 1 && fallback ? fallback : image;
  const style = { '--ui-lqip': image.lqip } as CSSProperties;
  // A poster's own shape (--ui-img-ratio, covers.css) lets the flyer fill its board however narrow `sizes` says the slot is.
  const imgStyle = (fit === 'cover' ? { objectPosition: `${focal[0]}% ${focal[1]}%` } : { '--ui-img-ratio': image.width / image.height }) as CSSProperties;
  const loading = priority ? { loading: 'eager' as const, fetchpriority: 'high' } : { loading: 'lazy' as const };
  const listing = kind && !image.scene3d;
  return <div className={cx('ui-cover', className)} data-cover="image" data-fit={fit} data-ratio={ratio} data-ratio-lock={ratioLock ? '' : undefined} data-ended={ended ? '' : undefined}
    data-family={listing ? fit === 'contain' ? 'poster' : 'photo' : undefined} data-kind={listing ? kind : undefined} data-tier={tier} style={style}>
    {failed < 2 && <img key={shown.src} className="ui-cover__img" src={shown.src} srcSet={shown.srcSet} sizes={sizes} alt={decorative ? '' : image.alt} width={image.width} height={image.height} decoding="async" style={imgStyle} {...loading}
      onError={fail} ref={img => { if (failedBeforeHydration(img)) fail(); }} />}
    {label && <ProvenanceBadge label={label} tier={tier} plain={!!image.scene3d} />}
    {children}
  </div>;
}

export type CoverSlot = {
  /** From `getCover` / `resolveCovers`. */
  cover: ResolvedCover;
  ratio?: CoverRatio;
  ratioLock?: boolean;
  sizes?: string;
  priority?: boolean;
  /** The card around the cover already reads the title and facts. */
  decorative?: boolean;
};

/** The DECISIONS 23 badge words for a resolved picture, in the page's language; the short English on an 88 px thumbnail. */
// eslint-disable-next-line react-refresh/only-export-components
export function useTierLabel() {
  const { locale, pick } = useUiCopy();
  return (cover: Parameters<typeof tierLabelOf>[0] & { label?: { zh: string; en: string } }, thumb = false) => {
    // A kept label (照片 · 年份, 资料图 · 年份, BAYLINK 实拍) is the resolver's own words, dated on the page's day.
    if (cover.tier === 'photo' && cover.label) return pick(cover.label);
    const label = tierLabelOf(cover);
    return locale === 'en' ? thumb ? label.enShort : label.en : locale === 'zh-Hant' ? label.zhHant : label.zh;
  };
}

/**
 * A resolved cover: its picture with one badge (DECISIONS 23, tierLabelOf), or — only if the resolver found no picture at
 * all, which tests/report-cover-coverage.test.ts keeps at zero for every listed record — the frame in its LQIP colour.
 * UI9-IMAGES DECISIONS 21: no date board, ticket, shop sign or title plate. The ♡ is the card's; the date, price and
 * deadline live in the caption (Card.tsx `when` and meta lines).
 */
export function Cover({ cover, ratio, ratioLock, sizes = COVER_SIZES.feed, priority, decorative, ended, kind, children }: CoverSlot & { ended?: boolean; kind?: CoverListingKind; children?: ReactNode }) {
  const label = useTierLabel();
  if (cover.tier === 'type') return <LqipCover ratio={ratio} ratioLock={ratioLock} />;
  return <CoverImage image={cover.image} label={label(cover, sizes === COVER_SIZES.thumb)} tier={cover.tier} fit={cover.fit} focal={cover.focal} ratio={ratio} ratioLock={ratioLock}
    sizes={sizes} priority={priority} decorative={decorative} ended={ended} kind={kind} fallback={cover.fallback}>{children}</CoverImage>;
}

/** The empty picture frame (LQIP ground, same box): what a cover shows while it has no picture to show. */
export function LqipCover({ ratio, ratioLock, lqip, className }: { ratio?: CoverRatio; ratioLock?: boolean; lqip?: string; className?: string }) {
  return <div className={cx('ui-cover', className)} data-cover="lqip" data-ratio={ratio} data-ratio-lock={ratioLock ? '' : undefined} style={{ '--ui-lqip': lqip } as CSSProperties} aria-hidden="true" />;
}

/**
 * A row's 13 px provenance line (RowCard `credit`): the badge words of a ①② picture, which leave the 88 px thumbnail for the
 * line; a ③ 示意图 / ④ AI 示意图 badge stays on the thumbnail in every mode (DECISIONS 23), so the line leaves it out.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useRowCredit() {
  const label = useTierLabel();
  return (cover: ResolvedCover) => cover.tier === 'type' || cover.tier === 'stock' || cover.tier === 'ai' ? undefined : label(cover);
}

/** A credit after its badge words: a ③ credit that repeats them ("示意图 · 摄影 … / Unsplash") drops the repeat. */
// eslint-disable-next-line react-refresh/only-export-components
export const creditAfterLabel = (label: string, credit: string) => credit.startsWith(`${label} · `) ? credit.slice(label.length + 3) : credit;
