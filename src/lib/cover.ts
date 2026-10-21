import type { GuideImage, MediaRightsBasis } from '../data/guide-media';
// The reviewed approvals of src/data/event-image-usage.ts, written by `npm run generate:home` (WEB-HOME): that module builds
// them from the official-event media registry, which would otherwise ride along with every page that resolves a cover
// (about 18 KiB gzip on the home page). tests/home-catalog.test.ts keeps the two equal.
import eventContextPhotos from '../data/generated/event-context-photos.json';
import { getImageProvenance, typeCoverProvenance, type ProvenanceInput } from './image-provenance';
import type { Copy } from './event-facts';

/**
 * One cover resolver for every surface (plan D7, content.md §4.1, 1007 §5.3): home, feeds, calendar,
 * detail heroes, share cards and BayBay answer cards ask `getCover` instead of reading `imageKey`.
 *
 * The owner's order (UI9-IMAGES, DECISIONS 22), first usable candidate wins. An item's candidates are `imageKeys` when the
 * build wrote them (coverCandidates(), src/lib/cover-candidates.ts: ① its own → ② its venue's → ③ its category's stock
 * pictures → ④ approved AI), else its one `imageKey`; then a 3D postcard for San Francisco places:
 *   official   ① the organiser's or brand's own image (poster, press kit, recorded permission) → 官方图
 *   photo      a public-domain / CC / own photo of this item, within 8 years → 照片 · 年份 (BAYLINK 实拍, 资料图 kept)
 *   venue      ② a venue photo (subject 'venue', or EVENT_CONTEXT_PHOTOS purpose venue), within 8 years → 场馆照 · 年份
 *   stock      ③ a licensed stock picture of the item's category (rights basis 'stock'), any age → 示意图
 *   ai         ④ an AI illustration the owner approved (src/data/ai-cover-approvals.json → aiCoverApproved) → AI 示意图
 *   scene3d    a 3D-world postcard, for San Francisco places only → 3D 场景插图
 *   type       `<TypeCover>`, set from the listing's own facts → BAYLINK 信息卡 (A1 removes it from cards, DECISIONS 21)
 * Never: an unapproved AI illustration or a theme photo; AI on a lead; a ①② file twice on one page, or a ③④ picture
 * twice within ADJACENT_CARDS cards (the item tries its next candidate, else the pool picture shown farthest away); a
 * cropped poster (`fit: 'contain'`).
 * `label` is today's badge (getImageProvenance); cover-labels.ts tierLabelOf(cover) gives the DECISIONS 23 badge A1 prints.
 * Which family draws a cover is src/lib/cover-family.ts (chooseCover), fixed by the item id, never by its neighbours.
 */

export type CoverKind = 'event' | 'offer' | 'opening' | 'place' | 'guide' | 'bulletin';
export type RightsBasis = MediaRightsBasis | 'unknown';

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
export type CoverItem = {
  kind: CoverKind;
  id: string;
  imageKey?: string;
  postcardKey?: string;
  /**
   * The item's candidates in the owner's order (① own → ② venue → ③ category stock → ④ approved AI), written at build time
   * by coverCandidates(); when present they replace `imageKey`. No catalog carries them before A1 (UI9-IMAGES).
   */
  imageKeys?: readonly string[];
  /** A lead (home, /events, /calendar): never an AI picture (DECISIONS 24), so it moves on to its next candidate. */
  lead?: boolean;
};
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
export type CoverTier = 'official' | 'photo' | 'venue' | 'stock' | 'ai' | 'scene3d' | 'type';
export type TypeCoverReason = 'no-image' | 'missing-image' | 'ai-illustration' | 'theme-photo' | 'unapproved-reuse'
  | 'too-old' | 'undated' | 'cover-not-ok' | 'not-allowed-for-kind' | 'duplicate';
export type ImageCover = {
  tier: Exclude<CoverTier, 'type'>;
  key: string;
  image: CoverAsset;
  /** Provenance badge text, from `getImageProvenance` only (what the pages print until A1). */
  label: Copy;
  /** Posters and full-frame artwork are shown whole on a solid board with a white mat (the poster family), never cropped. */
  fit: 'cover' | 'contain';
  focal: readonly [number, number];
  year?: number;
};
export type TypeCoverResolution = { tier: 'type'; label: Copy; reason: TypeCoverReason; rejectedKey?: string };
export type ResolvedCover = ImageCover | TypeCoverResolution;

/**
 * Which image src each item on the page has claimed (①②: once per page). A re-render of the same item keeps its claim.
 * `order` numbers the items in display order and `shared` records where each ③④ pool picture is shown, so the same stock
 * or AI picture can come back on the page, but never within ADJACENT_CARDS cards of itself.
 */
export type CoverPage = {
  claims: Map<string, string>;
  order?: Map<string, number>;
  shared?: Map<string, { item: string; at: number }[]>;
};
export const createCoverPage = (): CoverPage => ({ claims: new Map() });
/**
 * A ③④ pool picture repeats only this many cards apart or more (UI9-IMAGES §4 同页去重: not within 6 adjacent cards, and
 * not on one screen, which is at most 8 cards on desktop). When every pool picture is nearer, the item still takes the
 * one shown farthest away: ③④ never fall back to an info card.
 */
export const ADJACENT_CARDS = 8;

export const MAX_PHOTO_AGE_YEARS = 8;
const OFFICIAL: ReadonlySet<RightsBasis> = new Set(['official', 'permission', 'press-kit', 'promo-editorial']);
const POOL_TIERS: ReadonlySet<CoverTier> = new Set(['stock', 'ai']);
const DEFAULT_FOCAL = [50, 40] as const;

/**
 * An AI illustration is what the image is, not a rights question: BAYLINK may own it (`rights.basis: 'owner'`) or
 * record it as official, and it is still no cover unless the owner approved that key (④, `aiCoverApproved`, set from
 * src/data/ai-cover-approvals.json only). 3D-world scenes are the one exception.
 */
export const isAiIllustration = (image: CoverAsset) => image.kind === 'illustration' && !image.scene3d;
/** An AI illustration the owner approved in chat as a ④ cover (DECISIONS 22/25). */
export const isApprovedAiCover = (image: CoverAsset) => isAiIllustration(image) && image.aiCoverApproved === true;


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

/**
 * Photo tiers each listing kind may use (content.md §4.1 table). Official images, own shots and ③④ pictures are allowed
 * for all; a venue photo (subject 'venue', approved once per venue, UI9-IMAGES) is 'dated' for every kind.
 */
const THIRD_PARTY_PHOTOS: Record<CoverKind, 'dated' | 'any' | 'none'> = {
  event: 'dated', bulletin: 'dated', place: 'any', guide: 'any',
  // Offers and new shops need the brand's own image, a BAYLINK photo or their venue's; a CC street photo is not the offer.
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
  // Checked before any recorded basis, so an owner/official/permission record cannot promote AI art to a cover: only the
  // owner's approval of that key does (④).
  if (isAiIllustration(image) || basis === 'ai') return isApprovedAiCover(image) && !item.lead ? make('ai') : { rejected: 'ai-illustration' };
  if (basis === 'stock') return make('stock');
  const use = item.kind === 'event' ? (ctx.contextPhotos ?? eventContextPhotos as ContextPhotos)[key] : undefined;
  if (use?.purpose === 'theme') return { rejected: 'theme-photo' };
  // A venue photo is approved once per venue (venue-photos.json, subject 'venue'): any record there may use it.
  const venue = !!use || image.subject === 'venue';
  if (use && !use.eventIds.includes(item.id) && image.subject !== 'venue') return { rejected: 'unapproved-reuse' };
  if (!venue && OFFICIAL.has(basis)) return make('official');
  if (basis === 'owner') return make('photo');
  const rule = venue ? 'dated' : THIRD_PARTY_PHOTOS[item.kind];
  if (rule === 'none') return { rejected: 'not-allowed-for-kind' };
  if (rule === 'dated') {
    const year = captureYear(image);
    if (year === undefined) return { rejected: 'undated' };
    if (year < Number(ctx.today.slice(0, 4)) - MAX_PHOTO_AGE_YEARS) return { rejected: 'too-old' };
  }
  return make(venue ? 'venue' : 'photo');
}

/** The item's place in the page's display order (first resolve wins), for the ③④ adjacency rule. */
function positionOf(page: CoverPage, item: string): number {
  page.order ??= new Map();
  if (!page.order.has(item)) page.order.set(item, page.order.size);
  return page.order.get(item)!;
}

/**
 * Resolve one item's cover. With `ctx.page`, a ①② image already claimed by another item on the page, or a ③④ picture
 * shown fewer than ADJACENT_CARDS cards away, moves the item to its next candidate (VISUAL-10); the same item resolving
 * again keeps its claim.
 */
export function getCover(item: CoverItem, ctx: CoverContext): ResolvedCover {
  const attempts: { key: string; tier: 'image' | 'scene3d' }[] = [];
  for (const key of item.imageKeys ?? (item.imageKey ? [item.imageKey] : [])) attempts.push({ key, tier: 'image' });
  const me = itemKey(item);
  // Every item takes its place in display order, a TypeCover included: it is still a card between two pictures.
  const at = ctx.page ? positionOf(ctx.page, me) : 0;
  if (item.postcardKey) attempts.push({ key: item.postcardKey, tier: 'scene3d' });
  let reason: TypeCoverReason = 'no-image';
  let rejectedKey: string | undefined;
  // The pool picture shown farthest away, for when every ③④ candidate is nearer than ADJACENT_CARDS.
  let farthest: { cover: ImageCover; gap: number } | undefined;
  const show = (cover: ImageCover, shown: { item: string; at: number }[]) => {
    if (!shown.some(other => other.item === me)) ctx.page!.shared!.set(cover.image.src, [...shown, { item: me, at }]);
    return cover;
  };
  for (const { key, tier } of attempts) {
    const image = lookup(ctx.images, key);
    const outcome: Candidate = image ? judge(item, key, image, ctx, tier) : { rejected: 'missing-image' };
    if ('rejected' in outcome) {
      if (!rejectedKey) { reason = outcome.rejected; rejectedKey = key; }
      continue;
    }
    const src = outcome.cover.image.src;
    if (POOL_TIERS.has(outcome.cover.tier)) {
      if (!ctx.page) return outcome.cover;
      ctx.page.shared ??= new Map();
      const shown = ctx.page.shared.get(src) ?? [];
      const gap = Math.min(Infinity, ...shown.filter(other => other.item !== me).map(other => Math.abs(other.at - at)));
      if (gap >= ADJACENT_CARDS) return show(outcome.cover, shown);
      if (!farthest || gap > farthest.gap) farthest = { cover: outcome.cover, gap };
      continue;
    }
    const claimant = ctx.page?.claims.get(src);
    if (claimant && claimant !== me) {
      if (!rejectedKey) { reason = 'duplicate'; rejectedKey = key; }
      continue;
    }
    ctx.page?.claims.set(src, me);
    return outcome.cover;
  }
  return farthest ? show(farthest.cover, ctx.page!.shared!.get(farthest.cover.image.src) ?? []) : typeCover(reason, rejectedKey);
}

/**
 * A listing record as a CoverItem: the one place pages, generators and report:covers build it (UI9-IMAGES A0), so the
 * page and the coverage report always judge the same candidates. The record's `imageKeys` (written by the build from
 * coverCandidates(), from A1) come along; `override.imageKey` replaces the record's own image, `undefined` included (the
 * home lead's close-up-face rule, weekend-lead.ts leadImageKey), and then also leaves it out of `imageKeys`. `override.lead`
 * marks a lead: it skips approved AI pictures (DECISIONS 24).
 */
export function coverItemFor(kind: CoverKind, record: { id: string; imageKey?: string; imageKeys?: readonly string[] }, override?: { imageKey: string | undefined; lead?: boolean }): CoverItem {
  const imageKey = override ? override.imageKey : record.imageKey;
  const item: CoverItem = { kind, id: record.id, imageKey, ...(override?.lead ? { lead: true } : {}) };
  if (record.imageKeys) item.imageKeys = imageKey === record.imageKey ? record.imageKeys
    : [...(imageKey ? [imageKey] : []), ...record.imageKeys.filter(key => key !== record.imageKey)];
  return item;
}

/** Resolve a list in display order on one page, so de-duplication is deterministic. */
export function resolveCovers(items: readonly CoverItem[], ctx: CoverContext): ResolvedCover[] {
  const page = ctx.page ?? createCoverPage();
  return items.map(item => getCover(item, { ...ctx, page }));
}
