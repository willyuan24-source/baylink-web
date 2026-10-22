import { guides, GUIDE_CATEGORY_TABS, type Guide } from '../../data/guides';
import { GUIDE_IMAGES, getGuideMedia, type GuideImage } from '../../data/guide-media';
import { getCover } from '../../lib/cover';
import { coverCandidates } from '../../lib/cover-candidates';
import { getLocale, translateText } from '../../i18n/locale';
import { getBayAreaToday } from '../../lib/monthly';
import { ATTRACTIONS } from '../../data/attractions';
import { getGuideEditorial } from '../../data/guide-editorial';
import { guideSlugsForTopic, guideTopicOf } from '../../data/guide-topics';
import { rankRelatedGuides } from '../../lib/guide-discovery';
import { getGuideMetadata } from '../../lib/guide-metadata';
import { getOfferImage } from '../../lib/offer-media';
import { guideCallOf, guideReadMinutes, guideSourceCount, type GuideRegionId } from './guide-facts';
import { GUIDE_BAND_SIZE, telOf, type GuideCard, type GuideCovers, type GuideIndexCard, type GuideInlineImage, type GuideOpusEntry, type GuideRecord, type GuidesIndex } from './guide-records';
import { OPUS_BAY_ATTRACTION_ENTRIES } from '../../lib/opus-bay-attraction-entry';
import { SCENE3D_POSTCARD_FOR, SCENE3D_POSTCARD_IMAGES } from '../../data/scene3d-postcards';
import { GUIDE_DIAGRAMS } from './guide-diagrams';

/**
 * Build side of the guide routes' data split (WEB-DATA-SPLIT): the functions that need the whole guide corpus, the media
 * registry or the attraction registry. scripts/generate-guide-data.ts runs them once per build; the pages read the result
 * (src/data/generated/guides-index.json and guides/<slug>.json) and never import this module.
 */

// Place words in slugs; a guide may belong to two regions ("peninsula-south-bay-…"). Everything else is Bay-wide.
const REGION_WORDS: readonly [GuideRegionId, RegExp][] = [
  ['sf', /(?:^|-)(?:sf|san-francisco|presidio|golden-gate|alcatraz|chinatown|fishermans|lands-end|mission-dolores|palace-fine|sunset-dunes)(?:-|$)/],
  ['east-bay', /(?:^|-)(?:east-bay|oakland|berkeley|alameda|fremont|richmond|martinez|pleasanton|tilden|reinhardt|ardenwood|coyote-hills)(?:-|$)/],
  ['peninsula', /(?:^|-)(?:peninsula|san-mateo|palo-alto|stanford|san-carlos|filoli|half-moon-bay|coyote-point)(?:-|$)/],
  ['south-bay', /(?:^|-)(?:south-bay|san-jose|alviso|saratoga|hakone|sccld|santa-clara)(?:-|$)/],
  ['north-bay', /(?:^|-)(?:north-bay|marin|sausalito|muir|point-reyes|napa|sonoma|china-camp|angel-island)(?:-|$)/],
];
const ATTRACTION_REGION = new Map<string, GuideRegionId>(ATTRACTIONS.map(item => [item.slug, item.region as GuideRegionId]));

/** The regions a guide is about; an empty list means it serves the whole Bay Area. */
export function guideRegionsOf(guide: Pick<Guide, 'slug'>): GuideRegionId[] {
  const listed = ATTRACTION_REGION.get(guide.slug);
  if (listed) return [listed];
  return REGION_WORDS.filter(([, words]) => words.test(guide.slug)).map(([id]) => id);
}

// Inline images that several guides share are generic theme pictures, not this guide's subject (GUIDE-05).
let sharedInline: Map<string, number> | undefined;
function sharedInlineCount(all: readonly Guide[], src: string): number {
  if (!sharedInline) {
    sharedInline = new Map();
    for (const guide of all) for (const { image } of getGuideMedia(guide).inline) sharedInline.set(image.src, (sharedInline.get(image.src) || 0) + 1);
  }
  return sharedInline.get(src) || 0;
}
/** The stock laptop photo whose caption says it is not the event or service shown (Medicare, Social Security …). */
const OFF_TOPIC_SOURCES = new Set(['/guides/coverage-2026/coverage-laptop.webp']);

/**
 * Whether an inline picture stays in the article. 办事 pages stay quiet (D9): no AI mood illustrations outside 周末出游;
 * an AI illustration several guides share is generic everywhere; the stock laptop photo is off-topic everywhere.
 */
export function keepInlineImage(image: GuideImage, guide: Guide, all: readonly Guide[]): boolean {
  if (OFF_TOPIC_SOURCES.has(image.src)) return false;
  if (image.kind !== 'illustration' || image.scene3d) return true;
  if (guideTopicOf(guide) !== 'outings') return false;
  return sharedInlineCount(all, image.src) < 2;
}

/**
 * getGuideMedia's cover in the current language. Only public-service pictures have 繁體 / English variants (guide-media.ts
 * localizedServiceImage reads the current language), so the generator calls this once per language.
 */
/**
 * A guide's listing cover in the current language (UI9-IMG-A1b, DECISIONS 21/22): its own cover when that is a ① or kept
 * photo; else the first ③ stock picture of its photo category (coverCandidates, rotated by slug, labelled 示意图), never an
 * information card and, ahead of ④, never its own AI illustration. `offTopic` names own covers a listing must not use.
 */
export function guideListingCover(guide: Guide, today: string, offTopic: ReadonlySet<string> = new Set()): GuideImage {
  const own = getGuideMedia(guide).cover;
  const judged = (image: GuideImage) => getCover({ kind: 'guide', id: guide.slug, imageKey: image.src }, { images: () => image, today }).tier;
  const ownTier = offTopic.has(own.src) ? 'type' : judged(own);
  if (ownTier !== 'type' && ownTier !== 'ai') return own;
  return guideStockCover(guide, today) ?? own;
}

/** A guide's ③ stock pictures (its photo category's pool, rotated by slug), in the current language. */
export function guideStockPool(guide: Guide, today: string): GuideImage[] {
  const own = getGuideMedia(guide).cover;
  const locale = getLocale();
  return coverCandidates('guide', { id: guide.slug, title: guide.title, category: guide.category })
    .map(key => GUIDE_IMAGES[key]).filter((image): image is GuideImage => !!image && image.src !== own.src
      && getCover({ kind: 'guide', id: guide.slug, imageKey: image.src }, { images: () => image, today }).tier === 'stock')
    .map(stock => locale === 'zh-Hans' ? stock : { ...stock, alt: translateText(stock.alt, locale), caption: translateText(stock.caption, locale), credit: translateText(stock.credit, locale) });
}

/** A guide's first ③ stock picture, in the current language. */
export const guideStockCover = (guide: Guide, today: string): GuideImage | undefined => guideStockPool(guide, today)[0];

export const coverInCurrentLanguage = (guide: Guide): GuideImage => guideListingCover(guide, getBayAreaToday());

/** Same pictures in 简体 drop out of the per-language covers. */
export function mergeCovers(zhHans: GuideImage, zhHant: GuideImage, en: GuideImage): GuideCovers {
  const same = (a: GuideImage, b: GuideImage) => JSON.stringify(a) === JSON.stringify(b);
  return { 'zh-Hans': zhHans, ...(same(zhHant, zhHans) ? {} : { 'zh-Hant': zhHant }), ...(same(en, zhHans) ? {} : { en }) };
}

export function guideCardOf(guide: Guide, covers: GuideCovers): GuideCard {
  return {
    slug: guide.slug, title: guide.title, category: guide.category, sourceCount: guideSourceCount(guide), readMinutes: guideReadMinutes(guide), covers,
    ...(guide.editionMonth ? { editionMonth: guide.editionMonth } : {}),
    ...(guide.editionMonth && guide.editionStartDate ? { editionStartDate: guide.editionStartDate } : {}),
    ...(guide.editionMonth && guide.editionThroughDate ? { editionThroughDate: guide.editionThroughDate } : {}),
  };
}

/**
 * "Read next" before the reader's date (discoverRelatedGuides(guide, count, today) = relatedForToday(this, today, count)): the
 * full ranking is kept up to the `count`-th guide without an edition month, which always passes the date filter.
 */
export function rankedRelatedGuides(guide: Guide, count = 4): Guide[] {
  const ranked = rankRelatedGuides(guide, count);
  let evergreen = 0;
  const end = ranked.findIndex(candidate => !candidate.editionMonth && ++evergreen === count);
  return end < 0 ? ranked : ranked.slice(0, end + 1);
}

/** The article's inline pictures as GuideDetail used to filter them with keepInlineImage. */
export const guideInlineImages = (guide: Guide): GuideInlineImage[] =>
  getGuideMedia(guide).inline.filter(item => keepInlineImage(item.image, guide, guides));

const ATTRACTION_BY_SLUG = new Map<string, string>(ATTRACTIONS.map(item => [item.slug, item.id]));
/**
 * H36 (FCC-11): a San Francisco outing guide links into BAYLINK's 3D San Francisco. A guide about a place the game has an
 * arrival for (OPUS_BAY_ATTRACTION_ENTRIES) opens there; the others open the city. The place's 3D postcard (RC-16) goes with
 * it when one exists. Only guides about San Francisco alone; 办事 guides never.
 */
export function guideOpusEntryOf(guide: Pick<Guide, 'slug' | 'category'>): GuideOpusEntry | undefined {
  const regions = guideRegionsOf(guide);
  if (regions.length !== 1 || regions[0] !== 'sf' || guideTopicOf(guide) !== 'outings') return undefined;
  const id = ATTRACTION_BY_SLUG.get(guide.slug);
  const attraction = id && Object.hasOwn(OPUS_BAY_ATTRACTION_ENTRIES, id) ? id : undefined;
  const key = SCENE3D_POSTCARD_FOR[guide.slug] ?? (id ? SCENE3D_POSTCARD_FOR[id] : undefined);
  const postcard = key ? SCENE3D_POSTCARD_IMAGES[key] : undefined;
  return { ...(attraction ? { attraction } : {}), ...(postcard ? { postcard } : {}) };
}

export function guideRecordOf(guide: Guide, coversOf: (guide: Guide) => GuideCovers): GuideRecord {
  const editorial = getGuideEditorial(guide.slug);
  const boardImages = guide.blocks.flatMap(block => block.type === 'freebies' ? block.offers : []).flatMap(offer => getOfferImage(offer)?.src ?? []);
  const opus = guideOpusEntryOf(guide);
  const diagrams = Object.hasOwn(GUIDE_DIAGRAMS, guide.slug) ? [...GUIDE_DIAGRAMS[guide.slug]] : undefined;
  return {
    guide,
    covers: coversOf(guide),
    inline: guideInlineImages(guide),
    related: rankedRelatedGuides(guide).map(item => guideCardOf(item, coversOf(item))),
    ...(editorial ? { editorial } : {}),
    ...(boardImages.length ? { boardImages } : {}),
    ...(diagrams ? { diagrams } : {}),
    ...(opus ? { opus } : {}),
    metadata: getGuideMetadata(guide),
  };
}

export function guidesIndexOf(coversOf: (guide: Guide) => GuideCovers): GuidesIndex {
  // The 拨打 number rides only on the guides the 长辈与家属 band can show (G16; the band is the first GUIDE_BAND_SIZE hub guides
  // that are not past editions, so every hub guide up to the GUIDE_BAND_SIZE-th one without an edition), and only when its
  // printed form dials the same tel: as the reader's bar (a 211-style or extension number is left out, never a throw).
  const elders = new Set<string>();
  let evergreen = 0;
  for (const slug of guideSlugsForTopic('elders', guides)) {
    if (evergreen >= GUIDE_BAND_SIZE) break;
    elders.add(slug);
    if (!guides.find(guide => guide.slug === slug)?.editionMonth) evergreen++;
  }
  return {
    guides: guides.map((guide): GuideIndexCard => {
      const regions = guideRegionsOf(guide);
      const call = elders.has(guide.slug) ? guideCallOf(getGuideEditorial(guide.slug)) : undefined;
      const dials = !!call && telOf(call.number) === call.tel;
      return { ...guideCardOf(guide, coversOf(guide)), ...(regions.length ? { regions } : {}), ...(dials ? { call: { number: call!.number } } : {}) };
    }),
    categoryTabs: GUIDE_CATEGORY_TABS,
  };
}
