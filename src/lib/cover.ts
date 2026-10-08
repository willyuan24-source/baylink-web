import type { GuideImage } from '../data/guide-media';
import { EVENT_CONTEXT_PHOTOS } from '../data/event-image-usage';
import { getImageProvenance, typeCoverProvenance, type ProvenanceInput } from './image-provenance';
import { COVER_TONES, type Copy, type CoverTone } from './event-facts';

/**
 * One cover resolver for every surface (plan D7, content.md §4.1, 1007 §5.3): home, feeds, calendar,
 * detail heroes, share cards and BayBay answer cards ask `getCover` instead of reading `imageKey`.
 *
 * Honesty ladder, first match wins:
 *   1. official   the organiser's or brand's own image (poster, press kit, recorded permission) → 官方图
 *   2. photo      public-domain / CC / own photo of this item, taken within 8 years, not vetoed → 照片 · 年份
 *   3. venue      an approved venue photo (EVENT_CONTEXT_PHOTOS purpose venue), within 8 years → 资料图 · 年份
 *   4. scene3d    a 3D-world postcard, for San Francisco places only → 3D 场景插图
 *   5. type       `<TypeCover>`, set from the listing's own facts → BAYLINK 信息卡
 * Never: an AI illustration or a theme photo on a factual item; the same file twice on one page (the
 * second item falls back to a TypeCover); a cropped poster (`fit: 'contain'` = blur-fill letterbox).
 */

export type CoverKind = 'event' | 'offer' | 'opening' | 'place' | 'guide' | 'bulletin';
export type RightsBasis = 'official' | 'permission' | 'press-kit' | 'promo-editorial' | 'public-domain' | 'cc' | 'owner' | 'ai' | 'unknown';

/** A registry image plus the optional fields the image pipeline adds (WEB-IMAGES); all are read when present. */
export type CoverAsset = GuideImage & Omit<ProvenanceInput, 'kind' | 'credit' | 'caption'> & {
  /** Editor veto (false) or approval (true) for use as a cover; absent means "not vetoed". */
  coverOk?: boolean;
  /** Capture date already recorded by today's rights records (YYYY-MM-DD). */
  photoDate?: string;
  /** Crop focus in percent, [x, y]; default [50, 40]. */
  focal?: readonly [number, number];
  /** Dominant colour for the placeholder (LQIP manifest). */
  lqip?: string;
};
export type CoverItem = { kind: CoverKind; id: string; imageKey?: string; postcardKey?: string };
type ContextPhotos = Readonly<Record<string, { purpose: 'venue' | 'theme'; eventIds: readonly string[] }>>;
export type CoverContext = {
  /** The image registry: the full `GUIDE_IMAGES`, the slim home catalog's images, or a lookup function. */
  images: Readonly<Record<string, GuideImage | CoverAsset>> | ((key: string) => GuideImage | CoverAsset | undefined);
  /** Pacific calendar day (YYYY-MM-DD); the 8-year photo rule counts from its year. */
  today: string;
  /** Page-level de-duplication. One per rendered page; `resolveCovers` makes one when absent. */
  page?: CoverPage;
  /** Venue/theme approvals for reused photos; defaults to the reviewed `EVENT_CONTEXT_PHOTOS`. */
  contextPhotos?: ContextPhotos;
};
export type CoverTier = 'official' | 'photo' | 'venue' | 'scene3d' | 'type';
export type TypeCoverReason = 'no-image' | 'missing-image' | 'ai-illustration' | 'theme-photo' | 'unapproved-reuse'
  | 'too-old' | 'undated' | 'cover-not-ok' | 'not-allowed-for-kind' | 'duplicate';
export type ImageCover = {
  tier: Exclude<CoverTier, 'type'>;
  key: string;
  image: CoverAsset;
  /** Provenance badge text, from `getImageProvenance` only. */
  label: Copy;
  /** Posters and full-frame artwork are letterboxed on a blurred copy of themselves, never cropped. */
  fit: 'cover' | 'contain';
  focal: readonly [number, number];
  year?: number;
};
export type TypeCoverResolution = { tier: 'type'; label: Copy; reason: TypeCoverReason; rejectedKey?: string };
export type ResolvedCover = ImageCover | TypeCoverResolution;

/** Which image src each item on the page has claimed. A re-render of the same item keeps its claim. */
export type CoverPage = { claims: Map<string, string> };
export const createCoverPage = (): CoverPage => ({ claims: new Map() });

export const MAX_PHOTO_AGE_YEARS = 8;
const OFFICIAL: ReadonlySet<RightsBasis> = new Set(['official', 'permission', 'press-kit', 'promo-editorial']);
const DEFAULT_FOCAL = [50, 40] as const;

/**
 * An AI illustration is what the image is, not a rights question: BAYLINK may own it (`rights.basis: 'owner'`) or
 * record it as official, and it is still never the cover of a factual item. 3D-world scenes are the one exception.
 */
export const isAiIllustration = (image: CoverAsset) => image.kind === 'illustration' && !image.scene3d;

/** The rights basis: the structured record when present, else what today's registry fields state. */
export function rightsBasisOf(image: CoverAsset): RightsBasis {
  const recorded = typeof image.rights === 'object' && image.rights ? image.rights.basis : undefined;
  if (recorded) return recorded as RightsBasis;
  if (image.kind === 'illustration' && !image.scene3d) return 'ai';
  if (image.ownShot || image.scene3d) return 'owner';
  if (image.kind === 'poster' || /官方|official/i.test(image.credit)) return 'official';
  const prose = `${image.credit} ${typeof image.rights === 'string' ? image.rights : ''}`;
  if (/public domain|公有领域|公共领域/i.test(prose)) return 'public-domain';
  if (/creativecommons\.org/i.test(image.licenseUrl || '') || /\bCC(?:0|[- ]BY)\b/i.test(prose)) return 'cc';
  return 'unknown';
}

/** Capture year: `shotAt`, then the recorded `photoDate`, then the caption (the provenance label's own rule). */
export function captureYear(image: CoverAsset): number | undefined {
  const dated = /^(\d{4})/.exec(image.shotAt || image.photoDate || '')?.[1] ?? image.caption.match(/(?:19|20)\d{2}/)?.[0];
  return dated ? Number(dated) : undefined;
}

const lookup = (images: CoverContext['images'], key: string): CoverAsset | undefined => {
  if (typeof images === 'function') return images(key) as CoverAsset | undefined;
  return Object.hasOwn(images, key) ? images[key] as CoverAsset : undefined;
};
const itemKey = (item: CoverItem) => `${item.kind}:${item.id}`;
const typeCover = (reason: TypeCoverReason, rejectedKey?: string): TypeCoverResolution => ({
  tier: 'type', reason, label: { zh: typeCoverProvenance(false), en: typeCoverProvenance(true) }, ...(rejectedKey ? { rejectedKey } : {}),
});

/** Photo tiers each listing kind may use (content.md §4.1 table). Official images and own shots are allowed for all. */
const THIRD_PARTY_PHOTOS: Record<CoverKind, 'dated' | 'any' | 'none'> = {
  event: 'dated', bulletin: 'dated', place: 'any', guide: 'any',
  // Offers and new shops need the brand's own image or a BAYLINK photo; a CC street photo is not the offer.
  offer: 'none', opening: 'none',
};

type Candidate = { cover: ImageCover } | { rejected: TypeCoverReason };
function judge(item: CoverItem, key: string, image: CoverAsset, ctx: CoverContext, tier: 'image' | 'scene3d'): Candidate {
  if (image.coverOk === false) return { rejected: 'cover-not-ok' };
  const basis = rightsBasisOf(image);
  const make = (coverTier: ImageCover['tier'], provenanceImage: CoverAsset = image): Candidate => ({ cover: {
    tier: coverTier, key, image,
    label: { zh: getImageProvenance(provenanceImage, false, ctx.today), en: getImageProvenance(provenanceImage, true, ctx.today) },
    fit: image.kind === 'poster' || image.fullFrame ? 'contain' : 'cover',
    focal: image.focal ?? DEFAULT_FOCAL,
    year: captureYear(image),
  } });
  if (tier === 'scene3d') return item.kind === 'place' ? make('scene3d', { ...image, scene3d: true }) : { rejected: 'not-allowed-for-kind' };
  // Checked before any recorded basis, so an owner/official/permission record cannot promote AI art to a cover.
  if (isAiIllustration(image) || basis === 'ai') return { rejected: 'ai-illustration' };
  const use = item.kind === 'event' ? (ctx.contextPhotos ?? EVENT_CONTEXT_PHOTOS)[key] : undefined;
  if (use?.purpose === 'theme') return { rejected: 'theme-photo' };
  if (use && !use.eventIds.includes(item.id)) return { rejected: 'unapproved-reuse' };
  if (!use && OFFICIAL.has(basis)) return make('official');
  if (basis === 'owner') return make('photo');
  const rule = use ? 'dated' : THIRD_PARTY_PHOTOS[item.kind];
  if (rule === 'none') return { rejected: 'not-allowed-for-kind' };
  if (rule === 'dated') {
    const year = captureYear(image);
    if (year === undefined) return { rejected: 'undated' };
    if (year < Number(ctx.today.slice(0, 4)) - MAX_PHOTO_AGE_YEARS) return { rejected: 'too-old' };
  }
  return make(use ? 'venue' : 'photo');
}

/**
 * Resolve one item's cover. With `ctx.page`, an image already claimed by another item on the page
 * falls back to a TypeCover (VISUAL-10); the same item resolving again keeps its claim.
 */
export function getCover(item: CoverItem, ctx: CoverContext): ResolvedCover {
  const attempts: { key: string; tier: 'image' | 'scene3d' }[] = [];
  if (item.imageKey) attempts.push({ key: item.imageKey, tier: 'image' });
  if (item.postcardKey) attempts.push({ key: item.postcardKey, tier: 'scene3d' });
  let reason: TypeCoverReason = 'no-image';
  let rejectedKey: string | undefined;
  for (const { key, tier } of attempts) {
    const image = lookup(ctx.images, key);
    const outcome: Candidate = image ? judge(item, key, image, ctx, tier) : { rejected: 'missing-image' };
    if ('rejected' in outcome) {
      if (!rejectedKey) { reason = outcome.rejected; rejectedKey = key; }
      continue;
    }
    const claimant = ctx.page?.claims.get(outcome.cover.image.src);
    if (claimant && claimant !== itemKey(item)) {
      if (!rejectedKey) { reason = 'duplicate'; rejectedKey = key; }
      continue;
    }
    ctx.page?.claims.set(outcome.cover.image.src, itemKey(item));
    return outcome.cover;
  }
  return typeCover(reason, rejectedKey);
}

/** Resolve a list in display order on one page, so de-duplication is deterministic. */
export function resolveCovers(items: readonly CoverItem[], ctx: CoverContext): ResolvedCover[] {
  const page = ctx.page ?? createCoverPage();
  return items.map(item => getCover(item, { ...ctx, page }));
}

/** A different palette for each tone, used when two TypeCovers would sit side by side in the same colour. */
const NEIGHBOUR_TONE: Record<CoverTone, CoverTone> = {
  family: 'food', food: 'family', culture: 'seniors', seniors: 'culture', outdoors: 'free', free: 'outdoors',
};
/**
 * Two adjacent TypeCovers never share a colour (design.md §4.8): the second one takes its neighbour palette.
 * Only the colour rotates; each card keeps its truthful category label. `null` marks a photo cover.
 */
export function distinctNeighbourTones(tones: readonly (CoverTone | null)[]): (CoverTone | null)[] {
  const shown: (CoverTone | null)[] = [];
  tones.forEach((tone, index) => {
    const previous = index > 0 ? shown[index - 1] : null;
    if (tone === null || tone !== previous) { shown.push(tone); return; }
    const alternative = NEIGHBOUR_TONE[tone];
    shown.push(alternative !== previous ? alternative : COVER_TONES.find(candidate => candidate !== previous) ?? tone);
  });
  return shown;
}
