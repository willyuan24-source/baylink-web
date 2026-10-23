import { useState, type CSSProperties, type ReactNode } from 'react';
import './ui.css';
import './covers.css';
import './cards.css';
import { ProvenanceBadge } from './Badges';
import { cx, useUiCopy } from './ui-copy';
import { COVER_SIZES } from './cover-sizes';
import type { CoverAsset, CoverTier, ResolvedCover } from '../../lib/cover';
import { keptLabel, tierLabelOf } from '../../lib/cover-labels';

/** The feed default is 3:2 (UI9-C, captain decision 20; `5:4` is accepted from older callers and draws that default); `16:10` is the BayBay answer card (264 wide, design.md §4.7.7). */
export type CoverRatio = '3:4' | '4:5' | '5:4' | '1:1' | '16:9' | '16:10' | '3:2';
/** The listing a cover belongs to (data-kind): events, offers, new shops, guides, services, places, bulletins. */
export type CoverListingKind = 'event' | 'offer' | 'opening' | 'guide' | 'service' | 'place' | 'bulletin';
type Src = Pick<CoverAsset, 'src'> & Partial<Pick<CoverAsset, 'srcSet'>>;

export type CoverImageProps = {
  image: Pick<CoverAsset, 'src' | 'alt' | 'width' | 'height'> & Partial<Pick<CoverAsset, 'srcSet' | 'lqip' | 'scene3d'>>;
  /** The badge words (DECISIONS 23: tierLabelOf through <Cover>; getImageProvenance for a 3D postcard); omit only where shown elsewhere. */
  label?: string;
  /** The label's one-line short words (DECISIONS 23's 88 px words: Official, 2025 往届, Stock photo, Venue 2021) for a
   *  picture ≤ 120 px wide, or ≤ 200 px when `label` is long; covers.css shows them there, so a label never wraps or is cut. */
  shortLabel?: string;
  /** The tier the badge names (data-tier): a ③ 示意图 or ④ AI 示意图 badge stays on the picture in every size and mode. */
  tier?: Exclude<CoverTier, 'type'>;
  /** `contain`: a poster or full-frame artwork, shown whole and centred on a blurred, colour-sampled copy of itself that fills
   *  the frame (DECISIONS 32 OD1: one full-bleed frame, no mat, border or shadow); the poster itself is never blurred or cropped. */
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
  /** The ③ badge words the fallback shows, full and short (示意图 / Illustrative photo, Stock photo): a stand-in never keeps
   *  the failed picture's ① or ② words. */
  fallbackLabel?: readonly [string, string];
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
 * N21: a picture asks for the width it is drawn at, not its frame's. A cover crop of a wider file is drawn frame height ×
 * the file's aspect wide (a 3:2 file in a 173 px square: 260 px), and a slot's own `sizes` can miss its frame (a row
 * thumbnail's 88px in a 358 px 特大 card). Before the browser has picked a file (every lazy picture the page has not
 * reached) the drawn width replaces `sizes`, so the first pick is the right one. A file already picked is replaced only
 * when its slot was over 1.3× too narrow (a w-descriptor picture's naturalWidth is the slot it was picked for): a second
 * download is worth it only for a visibly soft picture. The browser still picks from the same srcset: no new file sizes.
 */
const fitSizes = (img: HTMLImageElement, contain: boolean, aspect: number) => {
  const { width, height } = img.getBoundingClientRect(), drawn = Math.ceil((contain ? Math.min : Math.max)(width, height * aspect)), sizes = `${drawn}px`;
  if (drawn > 0 && img.srcset && img.sizes !== sizes && (!img.currentSrc || img.complete && drawn > img.naturalWidth * 1.3)) img.sizes = sizes;
};

/**
 * One picture cover: srcset/sizes, a dominant-colour ground (LQIP), the focal-point crop (photo) or the whole flyer centred
 * on a blurred copy of itself (poster, DECISIONS 32 OD1), and one label at its bottom-left (DECISIONS 23, R2-03). A picture the
 * client finds still decoding is marked [data-pending] and its label fades in once it shows (R2-18: no label on a flat LQIP
 * block); prerendered HTML carries no mark, so before the script runs, or without it, every label is on its picture. Render through `getCover()` and <Cover>; never
 * pick images here. A file that fails to load (onError, DECISIONS 21) becomes the cover's `fallback` (a same-category ③
 * picture), and when that fails too the frame keeps its LQIP colour: never an information card. The AI 3D postcards
 * (`image.scene3d`) keep their frame and top-left ink badge exactly (DECISIONS 1).
 */
export function CoverImage({ image, label: ownLabel, shortLabel: ownShort, tier: ownTier, fit: ownFit = 'cover', focal: ownFocal = [50, 40], ratio, ratioLock, sizes = COVER_SIZES.feed, priority, ended, decorative, kind, fallback, fallbackLabel, children, className }: CoverImageProps) {
  // 1: the cover's own file failed and its fallback shows; 2: neither loaded (the LQIP colour shows). Tied to the file: the
  // same mounted card given another picture (a filter, a list change) starts again from that picture.
  const [failure, setFailure] = useState<{ src: string; step: 1 | 2 }>();
  const failed = failure?.src === image.src ? failure.step : 0;
  const fail = () => setFailure({ src: image.src, step: failed === 0 && fallback && fallback.src !== image.src ? 1 : 2 });
  // The file that has decoded (the label shows, and a poster's backdrop is that same file: its currentSrc, so 0 requests more).
  const [shownFile, setShownFile] = useState<{ src: string; url: string }>();
  const standIn = failed === 1 && !!fallback;
  const shown: Src = standIn ? fallback : image;
  // The stand-in is a ③ stock photo: its own badge words and tier, cropped like any photo (never a poster's board).
  const [label, shortLabel] = standIn ? fallbackLabel ?? [] : [ownLabel, ownShort];
  const tier = standIn ? 'stock' : ownTier;
  const fit = standIn ? 'cover' : ownFit;
  const focal = standIn ? [50, 50] as const : ownFocal;
  const loaded = failed < 2 && shownFile?.src === shown.src;
  // Laid out or loaded: fit `sizes`, and mark [data-pending] until the picture shows (on the DOM, never rendered, so prerendered
  // HTML keeps its labels); the AI 3D postcards keep theirs as they are (DECISIONS 1: frozen pixel for pixel).
  const decoded = (img: HTMLImageElement, load?: boolean) => {
    const done = load || img.complete && !!img.naturalWidth;
    if (!image.scene3d) {
      fitSizes(img, fit === 'contain', image.width / image.height);
      img.parentElement?.toggleAttribute('data-pending', !done && !loaded);
    }
    if (!loaded && done) setShownFile({ src: shown.src, url: img.currentSrc || img.src });
  };
  const style = { '--ui-lqip': image.lqip, '--ui-backdrop': loaded && fit === 'contain' ? `url("${shownFile.url}")` : undefined } as CSSProperties;
  const loading = priority ? { loading: 'eager' as const, fetchpriority: 'high' } : { loading: 'lazy' as const };
  const listing = kind && !image.scene3d;
  return <div className={cx('ui-cover', className)} data-cover="image" data-fit={fit} data-ratio={ratio} data-ratio-lock={ratioLock ? '' : undefined} data-ended={ended ? '' : undefined}
    data-family={listing ? fit === 'contain' ? 'poster' : 'photo' : undefined} data-kind={listing ? kind : undefined} data-tier={tier} data-loaded={loaded ? '' : undefined} style={style}>
    {failed < 2 && <img key={shown.src} className="ui-cover__img" src={shown.src} srcSet={shown.srcSet} sizes={sizes} alt={decorative ? '' : image.alt} width={image.width} height={image.height} decoding="async"
      style={fit === 'cover' ? { objectPosition: `${focal[0]}% ${focal[1]}%` } : undefined} {...loading} onError={fail} onLoad={event => decoded(event.currentTarget, true)}
      ref={img => { if (failedBeforeHydration(img)) fail(); else if (img) decoded(img); }} />}
    {/* Every picture's label is the one chip at its bottom-left (DECISIONS 23, R2-03: listing covers, a guide's or a detail
        page's title picture, /explore's cards); only the 3D postcards keep their top-left ink badge (DECISIONS 1). */}
    {label && <ProvenanceBadge label={label} short={shortLabel} tier={tier} plain={!!image.scene3d} />}
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
  /** Older callers' "this slot is a thumbnail" flag. The label now carries its full and short words and the picture's own
   *  width picks one (covers.css), so a slot that is a thumbnail on phones and a large card on desktops (the
   *  /guides band) needs no flag; it is accepted and ignored. */
  short?: boolean;
};

type LabelledCover = Parameters<typeof tierLabelOf>[0] & { label?: { zh: string; en: string } };
/** The DECISIONS 23 label of a resolved picture in the page's language: [full words, short words (CoverImage `shortLabel`)]. */
function useTierWords() {
  const { locale, pick } = useUiCopy();
  return (cover: LabelledCover): readonly [string, string] => {
    // A kept label (照片 · 年份, 资料图 · 年份, BAYLINK 实拍) is the resolver's own words, dated on the page's day.
    const label = cover.tier === 'photo' && cover.label ? keptLabel(pick(cover.label)) : tierLabelOf(cover);
    return locale === 'en' ? [label.en, label.enShort] : locale === 'zh-Hant' ? [label.zhHant, label.zhHantShort] : [label.zh, label.zhShort];
  };
}

/** The DECISIONS 23 badge words for a resolved picture, in the page's language; `thumb`: its short words. */
// eslint-disable-next-line react-refresh/only-export-components
export function useTierLabel() {
  const words = useTierWords();
  return (cover: LabelledCover, thumb = false) => words(cover)[thumb ? 1 : 0];
}

/**
 * A resolved cover: its picture with one badge (DECISIONS 23, tierLabelOf). A slot whose every picture lost to the page's
 * de-duplication shows its first picture again (`repeat`); only an item with no picture at all — which
 * tests/report-cover-coverage.test.ts and tests/ui9-img-a1b.test.ts keep at zero for every listed record — keeps the frame
 * in its LQIP colour. UI9-IMAGES DECISIONS 21: no date board, ticket, shop sign or title plate. The ♡ is the card's; the
 * date, price and deadline live in the caption (Card.tsx `when` and meta lines).
 */
export function Cover({ cover: resolved, ratio, ratioLock, sizes = COVER_SIZES.feed, priority, decorative, ended, kind, children }: CoverSlot & { ended?: boolean; kind?: CoverListingKind; children?: ReactNode }) {
  const words = useTierWords();
  const cover = resolved.tier === 'type' ? resolved.repeat : resolved;
  if (!cover) return <LqipCover ratio={ratio} ratioLock={ratioLock} />;
  const [label, short] = words(cover);
  return <CoverImage image={cover.image} label={label} shortLabel={short} tier={cover.tier} fit={cover.fit} focal={cover.focal} ratio={ratio} ratioLock={ratioLock}
    sizes={sizes} priority={priority} decorative={decorative} ended={ended} kind={kind} fallback={cover.fallback}
    fallbackLabel={cover.fallback && words({ tier: 'stock', image: cover.image })}>{children}</CoverImage>;
}

/** The empty picture frame (LQIP ground, same box): what a cover shows while it has no picture to show. */
export function LqipCover({ ratio, ratioLock, lqip, className }: { ratio?: CoverRatio; ratioLock?: boolean; lqip?: string; className?: string }) {
  return <div className={cx('ui-cover', className)} data-cover="lqip" data-ratio={ratio} data-ratio-lock={ratioLock ? '' : undefined} style={{ '--ui-lqip': lqip } as CSSProperties} aria-hidden="true" />;
}

/**
 * A row's provenance line (RowCard `credit`): none since R2-03. Every tier's label sits on the thumbnail itself, bottom-left
 * in its short one-line words (DECISIONS 23), so a row prints no second copy of it; the callers keep their `credit` slot.
 */
// eslint-disable-next-line react-refresh/only-export-components
export const useRowCredit = (): ((cover: ResolvedCover) => string | undefined) => () => undefined;

/** A credit after its badge words: a ③ credit that repeats them ("示意图 · 摄影 … / Unsplash") drops the repeat. */
// eslint-disable-next-line react-refresh/only-export-components
export const creditAfterLabel = (label: string, credit: string) => credit.startsWith(`${label} · `) ? credit.slice(label.length + 3) : credit;
