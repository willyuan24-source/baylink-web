import { captureYear, type ImageCover } from './cover';
import { getImageProvenance } from './image-provenance';

/**
 * The badge vocabulary of the owner's four tiers (UI9-IMAGES DECISIONS 23), for every cover getCover resolves:
 * `tierLabelOf(cover)`. It sits beside cover.ts rather than inside its make() so no route pays for the words before A1
 * prints them (route JS budgets only go down); the tier it reads is the one make() decided.
 *   ①  官方图 · 官方图 · YYYY 往届 · 官方图 · 产品图      ②  场馆照 · YYYY      ③  示意图      ④  AI 示意图
 * The kept labels (照片 · 年份, 资料图 · 年份, BAYLINK 实拍) keep their words; 3D postcards stay 3D 场景插图.
 */

/**
 * A label in both scripts: the full words for a picture wider than 200 px, and the one-line short words (…Short) for a
 * picture ≤ 200 px — a phone's 2-up card and an 88 px row thumbnail (R2-03; covers.css picks by the picture's own width).
 * The short words keep the tier word and a past edition's 往届 (DECISIONS 23; critic-r2 §3); a venue's year stays in the
 * full words and the page's image credits.
 */
export type TierLabel = { zh: string; zhHant: string; en: string; zhShort: string; zhHantShort: string; enShort: string };
const label = (zh: string, zhHant: string, en: string, zhShort = zh, zhHantShort = zhHant, enShort = en): TierLabel => ({ zh, zhHant, en, zhShort, zhHantShort, enShort });

/** DECISIONS 23: the label per tier. The short words fit one line on an 88 px thumbnail (tests/cover-tier-labels.test.ts). */
export const TIER_LABELS = {
  official: label('官方图', '官方圖', 'Official image', undefined, undefined, 'Official'),
  officialEdition: (year: string) => label(`官方图 · ${year} 往届`, `官方圖 · ${year} 往屆`, `Official image · ${year} edition`, `${year} 往届`, `${year} 往屆`, `${year} edition`),
  officialProduct: label('官方图 · 产品图', '官方圖 · 產品圖', 'Official product image', '官方产品图', '官方產品圖', 'Product'),
  venue: (year?: number) => year
    ? label(`场馆照 · ${year}`, `場館照 · ${year}`, `Venue photo · ${year}`, '场馆照', '場館照', 'Venue')
    : label('场馆照', '場館照', 'Venue photo', undefined, undefined, 'Venue'),
  stock: label('示意图', '示意圖', 'Illustrative photo', undefined, undefined, 'Stock photo'),
  ai: label('AI 示意图', 'AI 示意圖', 'AI illustration', undefined, undefined, 'AI image'),
  scene3d: label('3D 场景插图', '3D 場景插圖', '3D scene illustration', undefined, undefined, '3D scene'),
} as const satisfies Record<string, TierLabel | ((...args: never[]) => TierLabel)>;

/** A kept label in the page's language (照片 · 2019, 资料图 · 2019, BAYLINK 实拍 · …) with its short words: the date leaves. */
export function keptLabel(words: string): TierLabel {
  const short = words.split(' · ')[0].replace('BAYLINK 实拍', '实拍').replace('BAYLINK 實拍', '實拍').replace(' photo', '');
  return label(words, words, words, short, short, short);
}

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
  const zhHant = HANT.reduce((text, [from, to]) => text.replace(from, to), zh);
  return { ...keptLabel(zh), zhHant, en, zhHantShort: keptLabel(zhHant).zhShort, enShort: keptLabel(en).enShort };
}
