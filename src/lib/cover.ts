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
 *   type       no picture at all: the page shows the empty frame in its LQIP colour (<Cover>). UI9-IMAGES DECISIONS 21: no
 *              listed record may end here — tests/report-cover-coverage.test.ts (report:covers --fail-on-info) keeps it at 0.
 * Never: an unapproved AI illustration or a theme photo; on a lead, anything but a photograph (UI-9 DECISIONS 32: no poster,
 * flyer, full-frame artwork or AI picture; lib/lead-rule.ts adds close-ups and posed groups); a ①② file twice on one page,
 * or a ③④ picture twice on one page while the item has a candidate the page has not shown (else the pool picture shown
 * farthest away; resolveCovers deals a list's ③ pictures first, so as many cards as possible get one of their own); a
 * cropped poster (`fit: 'contain'`). A picture carries `fallback`, its next ③ candidate, for <CoverImage>'s onError.
 * `label` is getImageProvenance's words (image credits); the pages print cover-labels.ts tierLabelOf(cover) (DECISIONS 23).
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
  /**
   * A lead (home, /events, /calendar, /plan's first pick): a photograph only (DECISIONS 32: never a poster, flyer,
   * full-frame artwork or AI picture, DECISIONS 24), so it moves on to its next candidate.
   */
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
  | 'too-old' | 'undated' | 'cover-not-ok' | 'not-allowed-for-kind' | 'duplicate' | 'not-a-photo';
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
  /** The item's next ③ stock picture (another file): what the page shows when this file fails to load (DECISIONS 21). */
  fallback?: Pick<CoverAsset, 'src' | 'srcSet'>;
};
/**
 * No picture the page may still show. `repeat` is the item's first picture that lost only to page de-duplication: <Cover>
 * shows it again rather than an empty frame (captain 10-22 02:50: an LQIP frame never stands in for a picture), while
 * report:covers and the CI tests still count the slot as unresolved.
 */
export type TypeCoverResolution = { tier: 'type'; label: Copy; reason: TypeCoverReason; rejectedKey?: string; repeat?: ImageCover };
export type ResolvedCover = ImageCover | TypeCoverResolution;

/**
 * Which image src each item on the page has claimed (①②: once per page). A re-render of the same item keeps its claim.
 * `order` numbers the items in display order and `shared` records where each ③④ pool picture is shown: an item takes a
 * pool picture the page has not shown yet whenever it has one (UI9-R2: no stock picture twice in one list or page, the
 * calendar day, the date lists, /perks and /openings as much as the home and /events); only when every candidate is on
 * the page already does it repeat, with the one shown farthest away.
 */
export type CoverPage = {
  claims: Map<string, string>;
  order?: Map<string, number>;
  shared?: Map<string, Map<string, number>>;
  /**
   * Kept for the pages that still pass it: every page prefers ③④ pictures it has not shown since UI9-R2 (the home and
   * /events did before, UI9-IMG-A1b round 2; the boards now too, as their first screens are what a reader sees).
   */
  fresh?: boolean;
  /** The ③ picture resolveCovers dealt each item (planPool), by item, with the item's place in display order. */
  plan?: Map<string, { key: string; src: string; at: number }>;
};
export const createCoverPage = ({ fresh = false }: { fresh?: boolean } = {}): CoverPage => ({ claims: new Map(), ...(fresh ? { fresh } : {}) });
/**
 * How far apart a repeated ③④ pool picture should be when the page has shown every candidate an item has (UI9-IMAGES §4
 * 同页去重: not within 6 adjacent cards, and not on one screen, which is at most 8 cards on desktop): a ③ shown this far
 * away still beats a ④ after it, and a pool picture this far away beats a ①② candidate listed after it. When every pool
 * picture is nearer, the item still takes the one shown farthest away: ③④ never fall back to an info card.
 */
export const ADJACENT_CARDS = 8;
/**
 * The cards a list shows before its first 再看 (/perks on a desktop: 8 + 4 + 4; a /calendar day 13): on a board they take
 * a ③④ picture the page has not shown whenever they have one, so a list as it opens never repeats a stock picture (UI9-R2).
 */
export const FIRST_LIST_CARDS = 16;

export const MAX_PHOTO_AGE_YEARS = 8;
const OFFICIAL: ReadonlySet<RightsBasis> = new Set(['official', 'permission', 'press-kit', 'promo-editorial']);
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
const typeCover = (reason: TypeCoverReason, rejectedKey?: string, repeat?: ImageCover): TypeCoverResolution => ({
  tier: 'type', reason, label: { zh: typeCoverProvenance(false), en: typeCoverProvenance(true) }, ...(rejectedKey ? { rejectedKey } : {}), ...(repeat ? { repeat } : {}),
});

/**
 * Photo tiers each listing kind may use (content.md §4.1 table). Official images, own shots and ③④ pictures are allowed
 * for all; a venue photo (subject 'venue', approved once per venue, UI9-IMAGES) is 'dated' for every kind that refuses or
 * dates third-party photos; a place or guide ('any') keeps it as an ordinary photo.
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
  // DECISIONS 32: a lead slot shows a photograph, never a poster, a flyer or full-frame artwork (it is still the item's
  // own cover everywhere else); the lead moves on to the item's next candidate.
  if (item.lead && (image.kind !== 'photo' || image.fullFrame)) return { rejected: 'not-a-photo' };
  if (basis === 'stock') return make('stock');
  const use = item.kind === 'event' ? (ctx.contextPhotos ?? eventContextPhotos as ContextPhotos)[key] : undefined;
  if (use?.purpose === 'theme') return { rejected: 'theme-photo' };
  // A venue photo is approved once per venue (venue-photos.json, subject 'venue'): any record there may use it. A place or
  // guide (third-party photos 'any') shows the same picture as an ordinary photo, so it never ages out there (UI9-IMG-A1a).
  const venue = !!use || (image.subject === 'venue' && THIRD_PARTY_PHOTOS[item.kind] !== 'any');
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

/**
 * Resolve one item's cover. With `ctx.page`, a ①② image already claimed by another item on the page, or a ③④ picture
 * shown fewer than ADJACENT_CARDS cards away, moves the item to its next candidate (VISUAL-10); the same item resolving
 * again keeps its claim.
 */
export function getCover(item: CoverItem, ctx: CoverContext): ResolvedCover {
  const { page } = ctx;
  const attempts: { key: string; tier: 'image' | 'scene3d' }[] = [];
  for (const key of item.imageKeys ?? (item.imageKey ? [item.imageKey] : [])) attempts.push({ key, tier: 'image' });
  if (item.postcardKey) attempts.push({ key: item.postcardKey, tier: 'scene3d' });
  const me = itemKey(item);
  // Every item takes its place in display order (first resolve wins), a TypeCover included: it is still a card between two
  // pictures (the ③④ adjacency rule).
  const order = page && (page.order ??= new Map<string, number>());
  const at = order ? order.get(me) ?? order.set(me, order.size).size - 1 : 0;
  // The ③ picture resolveCovers dealt this item (planPool): it is new on the page, and no other item takes it.
  const planned = page?.plan?.get(me);
  const dealt = planned && lookup(ctx.images, planned.key);
  const outcome = dealt && judge(item, planned.key, dealt, ctx, 'image');
  if (outcome && 'cover' in outcome) {
    const shared = page!.shared ??= new Map<string, Map<string, number>>();
    (shared.get(planned!.src) ?? shared.set(planned!.src, new Map()).get(planned!.src)!).set(me, at);
    return withFallback(outcome.cover, attempts, ctx.images);
  }
  let reason: TypeCoverReason = 'no-image';
  let rejectedKey: string | undefined;
  let repeat: ImageCover | undefined;
  // The pool picture shown farthest away (the first at ADJACENT_CARDS or more ends the search): when every ③④ candidate
  // is nearer, the item still takes the farthest one.
  let pool: { cover: ImageCover; shown: Map<string, number>; gap: number } | undefined;
  for (const { key, tier } of attempts) {
    const image = lookup(ctx.images, key);
    const outcome: Candidate = image ? judge(item, key, image, ctx, tier) : { rejected: 'missing-image' };
    if ('rejected' in outcome) {
      if (!rejectedKey) { reason = outcome.rejected; rejectedKey = key; }
      continue;
    }
    const { cover } = outcome;
    const src = cover.image.src;
    if (cover.tier === 'stock' || cover.tier === 'ai') {
      if (!page) return withFallback(cover, attempts, ctx.images);
      // A ③ that may show beats any ④ after it (DECISIONS 22 order).
      if (pool && pool.gap >= ADJACENT_CARDS && pool.cover.tier !== cover.tier) break;
      const shared = page.shared ??= new Map<string, Map<string, number>>();
      const shown = shared.get(src) ?? shared.set(src, new Map()).get(src)!;
      let gap = Infinity;
      shown.forEach((position, other) => { if (other !== me) gap = Math.min(gap, Math.abs(position - at)); });
      // A picture dealt to another item counts as shown where that item sits.
      page.plan?.forEach((held, other) => { if (other !== me && held.src === src) gap = Math.min(gap, Math.abs(held.at - at)); });
      if (!pool || gap > pool.gap) pool = { cover, shown, gap };
      // A picture not yet on the page ends the search. One the page shows already keeps it looking on a `fresh` page and
      // within a list's first FIRST_LIST_CARDS cards (UI9-R2); further down a long board, one shown ADJACENT_CARDS or more
      // cards away ends it too, which keeps the pictures the page has not shown for the cards after it.
      if (gap === Infinity || (!page.fresh && at >= FIRST_LIST_CARDS && gap >= ADJACENT_CARDS)) break;
      continue;
    }
    // A pool picture that may show beats a ①② candidate listed after it (the candidates' order).
    if (pool && pool.gap >= ADJACENT_CARDS) break;
    const claimant = page?.claims.get(src);
    if (claimant && claimant !== me) {
      if (!rejectedKey) { reason = 'duplicate'; rejectedKey = key; }
      repeat ??= cover;
      continue;
    }
    page?.claims.set(src, me);
    return withFallback(cover, attempts, ctx.images);
  }
  if (!pool) return typeCover(reason, rejectedKey, repeat && withFallback(repeat, attempts, ctx.images));
  pool.shown.set(me, at);
  return withFallback(pool.cover, attempts, ctx.images);
}

/** The cover with its onError picture: the item's first ③ stock candidate in another file, if it has one. */
function withFallback(cover: ImageCover, attempts: readonly { key: string; tier: 'image' | 'scene3d' }[], images: CoverContext['images']): ImageCover {
  for (const { key, tier } of attempts) {
    if (tier !== 'image' || key === cover.key) continue;
    const image = lookup(images, key);
    if (image && image.coverOk !== false && image.src !== cover.image.src && rightsBasisOf(image) === 'stock') return { ...cover, fallback: { src: image.src, ...(image.srcSet ? { srcSet: image.srcSet } : {}) } };
  }
  return cover;
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
  // The candidates keep coverCandidates()' order (an own AI image comes after the stock pictures, DECISIONS 22); an
  // override that drops the own image leaves it out, one that names another image puts that image first.
  const rest = record.imageKeys?.filter(key => key !== record.imageKey);
  const keys = !record.imageKeys ? undefined : imageKey === record.imageKey ? record.imageKeys : imageKey ? [imageKey, ...rest!] : rest;
  return { kind, id: record.id, imageKey, ...(keys && { imageKeys: keys }), ...(override?.lead && { lead: true }) };
}

/**
 * Resolve a list in display order on one page, so de-duplication is deterministic. Its ③ pictures are dealt first (planPool).
 */
export function resolveCovers(items: readonly CoverItem[], ctx: CoverContext): ResolvedCover[] {
  const context = { ...ctx, page: ctx.page ?? createCoverPage() };
  planPool(items, context);
  return items.map(item => getCover(item, context));
}

/**
 * Deal a list's ③ pictures before it resolves (UI9-R2, R2-05): one card after another, a card that takes its first new
 * picture can leave a later card none (the 10/24 calendar: five Halloween cards, five pictures between them, one repeated).
 * A dry run on a copy of the page finds the cards that show a ③ picture; a matching over their candidates (augmenting paths
 * in display order, a free candidate first) gives as many of them as possible a picture the page has not shown, each on
 * one card. A lead keeps the picture it takes (its first, the hero-size one); an item dealt one before keeps it; a card left
 * without one repeats the picture shown farthest away (getCover).
 */
function planPool(items: readonly CoverItem[], ctx: CoverContext & { page: CoverPage }) {
  const { page } = ctx;
  const plan = page.plan ??= new Map();
  const copy: CoverPage = { ...page, claims: new Map(page.claims), order: new Map(page.order), plan: new Map(plan),
    shared: new Map([...page.shared ?? []].map(([src, shown]) => [src, new Map(shown)])) };
  const cards: { me: string; at: number; options: { key: string; src: string }[] }[] = [];
  for (const item of items) {
    const me = itemKey(item);
    const cover = getCover(item, { ...ctx, page: copy });
    if (cover.tier !== 'stock' || plan.has(me) || cards.some(card => card.me === me)) continue;
    const taken = (src: string) => [...page.shared?.get(src)?.keys() ?? []].some(other => other !== me)
      || [...plan].some(([other, held]) => other !== me && held.src === src);
    const options: { key: string; src: string }[] = [];
    for (const key of item.lead ? [cover.key] : item.imageKeys ?? (item.imageKey ? [item.imageKey] : [])) {
      const image = lookup(ctx.images, key);
      const outcome = image && judge(item, key, image, ctx, 'image');
      const src = image?.src;
      if (src && outcome && 'cover' in outcome && outcome.cover.tier === 'stock' && !taken(src) && !options.some(option => option.src === src)) options.push({ key, src });
    }
    cards.push({ me, at: copy.order!.get(me)!, options });
  }
  const owner = new Map<string, number>();
  const pick: { key: string; src: string }[] = [];
  const place = (card: number, tried: Set<string>): boolean => {
    const { options } = cards[card];
    const free = options.find(option => !owner.has(option.src));
    const take = (option: { key: string; src: string }) => { owner.set(option.src, card); pick[card] = option; return true; };
    if (free) return take(free);
    return options.some(option => !tried.has(option.src) && !!tried.add(option.src) && place(owner.get(option.src)!, tried) && take(option));
  };
  cards.forEach((_, index) => place(index, new Set()));
  cards.forEach((card, index) => { if (pick[index]) plan.set(card.me, { ...pick[index], at: card.at }); });
}
