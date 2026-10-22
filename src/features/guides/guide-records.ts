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
export type GuideCovers = {
  'zh-Hans': GuideImage; 'zh-Hant'?: GuideImage; en?: GuideImage;
  /**
   * UI9-IMG-A1b (DECISIONS 21/22): the guide's next ③ stock picture, so a page that already shows its cover (①② once per
   * page; a ③ not within ADJACENT_CARDS cards) gives the card this picture instead of a repeat. A guide
   * page's "Read next" cards carry it only when the page shows their cover (scripts/generate-guide-data.ts distinctRelated).
   */
  stock?: Omit<GuideCovers, 'stock'>;
};

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
  /** Set on editions that name their first / last day (editionState): the previews and their 本期 label follow them. */
  editionStartDate?: string;
  editionThroughDate?: string;
};

/** The number a guide's 拨打 button calls (UI9-GUIDES): its cover slide's phone, else its first contact (guideCallOf). */
export type GuideCall = { number: string; tel: string; label: { zh: string; en: string } };

/** An index card: the card plus what the index filters on. */
export type GuideIndexCard = GuideCard & {
  /** The file of the card's second (③) picture in the index's `stockImages` (UI9-IMG-A1b: shipped once per file). */
  stockSrc?: string;
  /** The regions a guide is about (guideRegionsOf); absent = the whole Bay Area. */
  regions?: GuideRegionId[];
  /** The number the reader's bar calls, on the band's guides that have one: 简洁 prints it as a 48 px 拨打 button (G16). */
  call?: Pick<GuideCall, 'number'>;
};

/** The 长辈与家属先看 band on /guides: three rows on every screen (GuidesHome; the index carries 拨打 numbers for them). */
export const GUIDE_BAND_SIZE = 3;

/** A US number's tel: target from its printed form ("1-800-772-1213" / "800-510-2020" → "+18007721213" / "+18005102020"). */
export const telOf = (number: string) => { const digits = number.replace(/\D/g, ''); return `+${digits.length === 10 ? '1' : ''}${digits}`; };

export type GuidesIndex = {
  /** Every published guide, in the corpus order the index lists them. */
  guides: GuideIndexCard[];
  /** The cards' second (③) pictures, once each, by file: a card names its own with `stockSrc` (withIndexStock). */
  stockImages?: Record<string, Omit<GuideCovers, 'stock'>>;
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

/** The index's cards with their second picture back on `covers.stock` (the index ships each ③ picture once). */
export function withIndexStock(index: GuidesIndex): GuidesIndex {
  const table = index.stockImages ?? {};
  return { ...index, guides: index.guides.map(card => card.stockSrc && table[card.stockSrc] ? { ...card, covers: { ...card.covers, stock: table[card.stockSrc] } } : card) };
}
