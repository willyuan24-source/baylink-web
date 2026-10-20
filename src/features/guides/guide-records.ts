import type { Guide, GuideCategory } from '../../data/guides';
import type { GuideImage } from '../../data/guide-media';
import type { GuideEditorial } from '../../data/guide-editorial';
import type { PlacedDiagram } from './guide-diagrams';
import type { PageMetadata } from '../../lib/seo';
import type { GuideRegionId } from './guide-facts';

/**
 * The guide routes' data, generated at build time (scripts/generate-guide-data.ts, WEB-DATA-SPLIT, ENGSEC-01): /guides reads a
 * slim index of cards and /guides/:slug loads one guide's record, so neither route ships the whole guide corpus. Everything here
 * is computed from the published guide by the same functions the pages used to call at runtime (getGuideMedia, getCover's
 * inputs, discoverRelatedGuides, getGuideEditorial, getGuideMetadata), so the rendered text and pictures stay the same.
 */

/** The covers a guide card shows: 简体's, and the 繁體 / English variants of a localized service picture when they differ. */
export type GuideCovers = { 'zh-Hans': GuideImage; 'zh-Hant'?: GuideImage; en?: GuideImage };

/** What a guide card renders (index feed, rails, "Read next"): no article body. */
export type GuideCard = {
  slug: string;
  title: string;
  category: GuideCategory;
  /** Distinct official source URLs (guideSourceCount). */
  sourceCount: number;
  /** Reading time from the article's own words (guideReadMinutes). */
  readMinutes: number;
  covers: GuideCovers;
  /** Set on monthly editions: "Read next" hides an edition whose month has passed. */
  editionMonth?: string;
};

/** The number a guide's 拨打 button calls (UI9-GUIDES): its cover slide's phone, else its first contact (guideCallOf). */
export type GuideCall = { number: string; tel: string; label: { zh: string; en: string } };

/** An index card: the card plus what the index filters on. */
export type GuideIndexCard = GuideCard & {
  /** The regions a guide is about (guideRegionsOf); absent = the whole Bay Area. */
  regions?: GuideRegionId[];
  /** The number the reader's bar calls, on guides that have one: the 简洁 elder rows print it as a 48 px 拨打 button (G16). */
  call?: GuideCall;
};

export type GuidesIndex = {
  /** Every published guide, in the corpus order the index lists them. */
  guides: GuideIndexCard[];
  categoryTabs: { id: 'all' | GuideCategory; label: string }[];
};

/** One inline picture of the article and where it goes (getGuideMedia's `inline`), already filtered by keepInlineImage. */
export type GuideInlineImage = { afterHeading: number; image: GuideImage };

/**
 * A San Francisco outing guide's way into the 3D city (H36): the game's arrival point for this place when it has one
 * (OPUS_BAY_ATTRACTION_ENTRIES), and the place's 3D postcard (labelled 3D 场景插图) when one exists.
 */
export type GuideOpusEntry = { attraction?: string; postcard?: GuideImage & { en?: { alt: string; caption: string; credit: string } } };

/** Everything /guides/:slug renders for one guide. */
export type GuideRecord = {
  guide: Guide;
  covers: GuideCovers;
  inline: GuideInlineImage[];
  /** Related guides in "Read next" order before the reader's date is applied (see relatedForToday). */
  related: GuideCard[];
  editorial?: GuideEditorial;
  /** Pictures the article's deals boards show (getOfferImage per offer): the article does not repeat them inline. */
  boardImages?: string[];
  /** The pilot guides' coded diagrams (H22, guide-diagrams.ts) and where each goes. */
  diagrams?: PlacedDiagram[];
  /** Set on San Francisco outing guides: the 在 3D 里先看看 link (guideOpusEntryOf). */
  opus?: GuideOpusEntry;
  /** getGuideMetadata(guide), for the document head after client navigation. */
  metadata: PageMetadata;
};

/** The cover for the reader's language (a localized service picture), else 简体's. */
export const coverFor = (covers: GuideCovers, locale: 'zh-Hans' | 'zh-Hant' | 'en'): GuideImage => covers[locale] ?? covers['zh-Hans'];

/**
 * discoverRelatedGuides(guide, count, today): the generator stores the ranked list up to the point where `count` guides without
 * an edition month are in it; editions whose month has passed drop out here, as they did at runtime.
 */
export function relatedForToday(related: readonly GuideCard[], today: string, count = 4): GuideCard[] {
  const month = today.slice(0, 7);
  return related.filter(card => !card.editionMonth || card.editionMonth >= month).slice(0, count);
}
