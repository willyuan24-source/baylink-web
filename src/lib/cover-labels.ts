import { captureYear, type ImageCover } from './cover';
import { getImageProvenance } from './image-provenance';

/**
 * The badge vocabulary of the owner's four tiers (UI9-IMAGES DECISIONS 23), for every cover getCover resolves:
 * `tierLabelOf(cover)`. It sits beside cover.ts rather than inside its make() so no route pays for the words before A1
 * prints them (route JS budgets only go down); the tier it reads is the one make() decided.
 *   ①  官方图 · 官方图 · YYYY 往届 · 官方图 · 产品图      ②  场馆照 · YYYY      ③  示意图      ④  AI 示意图
 * The kept labels (照片 · 年份, 资料图 · 年份, BAYLINK 实拍) keep their words; 3D postcards stay 3D 场景插图.
 */

/** A badge in both scripts, with the full English for a hero and the short one for an 88 px thumbnail. */
export type TierLabel = { zh: string; zhHant: string; en: string; enShort: string };

/** DECISIONS 23: the badge per tier. Short English fits an 88 px thumbnail (tests/cover-tier-labels.test.ts). */
export const TIER_LABELS = {
  official: { zh: '官方图', zhHant: '官方圖', en: 'Official image', enShort: 'Official' },
  officialEdition: (year: string): TierLabel => ({ zh: `官方图 · ${year} 往届`, zhHant: `官方圖 · ${year} 往屆`, en: `Official image · ${year} edition`, enShort: `Official · ${year}` }),
  officialProduct: { zh: '官方图 · 产品图', zhHant: '官方圖 · 產品圖', en: 'Official product image', enShort: 'Product' },
  venue: (year?: number): TierLabel => year
    ? { zh: `场馆照 · ${year}`, zhHant: `場館照 · ${year}`, en: `Venue photo · ${year}`, enShort: `Venue · ${year}` }
    : { zh: '场馆照', zhHant: '場館照', en: 'Venue photo', enShort: 'Venue' },
  stock: { zh: '示意图', zhHant: '示意圖', en: 'Illustrative photo', enShort: 'Stock photo' },
  ai: { zh: 'AI 示意图', zhHant: 'AI 示意圖', en: 'AI illustration', enShort: 'AI image' },
  scene3d: { zh: '3D 场景插图', zhHant: '3D 場景插圖', en: '3D scene illustration', enShort: '3D scene' },
} as const satisfies Record<string, TierLabel | ((...args: never[]) => TierLabel)>;

/** A product image's caption says so (official-opening-media artwork 'product'; captionSignal keeps the word). */
const PRODUCT_CAPTION = /产品图|商品陈列/;
const HANT: readonly [RegExp, string][] = [[/资料图/g, '資料圖'], [/实拍/g, '實拍']];

/** The DECISIONS 23 badge for a resolved cover. Kept labels (照片 · 年份, 资料图, BAYLINK 实拍) keep their words. */
export function tierLabelOf({ tier, image }: Pick<ImageCover, 'tier' | 'image'>, today?: string): TierLabel {
  if (tier === 'scene3d') return TIER_LABELS.scene3d;
  if (tier === 'stock') return TIER_LABELS.stock;
  if (tier === 'ai') return TIER_LABELS.ai;
  if (tier === 'venue') return TIER_LABELS.venue(captureYear(image));
  if (tier === 'official') {
    if (PRODUCT_CAPTION.test(image.caption)) return TIER_LABELS.officialProduct;
    const edition = image.caption.match(/((?:19|20)\d{2}) ?年?往[届屆]/)?.[1];
    return edition ? TIER_LABELS.officialEdition(edition) : TIER_LABELS.official;
  }
  const zh = getImageProvenance(image, false, today);
  const en = getImageProvenance(image, true, today);
  return { zh, zhHant: HANT.reduce((text, [from, to]) => text.replace(from, to), zh), en, enShort: en.replace('Archive photo', 'Archive').replace('BAYLINK photo', 'BAYLINK') };
}
