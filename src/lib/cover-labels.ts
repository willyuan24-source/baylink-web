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
/** 繁體 for the label words (the vocabulary is closed: 官方图 · 场馆照 · 示意图 · 往届 · 产品图 · 资料图 · 实拍 · 3D 场景插图). */
const HANT: Readonly<Record<string, string>> = { 图: '圖', 场: '場', 馆: '館', 届: '屆', 产: '產', 资: '資', 实: '實' };
const hant = (zh: string) => zh.replace(/[图场馆届产资实]/g, char => HANT[char]);
const label = (zh: string, en: string, enShort = en, zhShort = zh): TierLabel => ({ zh, zhHant: hant(zh), en, zhShort, zhHantShort: hant(zhShort), enShort });

/** DECISIONS 23: the label per tier. The short words fit one line on an 88 px thumbnail (tests/cover-tier-labels.test.ts). */
export const TIER_LABELS = {
  official: label('官方图', 'Official image', 'Official'),
  officialEdition: (year: string) => label(`官方图 · ${year} 往届`, `Official image · ${year} edition`, `${year} edition`, `${year} 往届`),
  officialProduct: label('官方图 · 产品图', 'Official product image', 'Product', '官方产品图'),
  venue: (year?: number) => year ? label(`场馆照 · ${year}`, `Venue photo · ${year}`, 'Venue', '场馆照') : label('场馆照', 'Venue photo', 'Venue'),
  stock: label('示意图', 'Illustrative photo', 'Stock photo'),
  ai: label('AI 示意图', 'AI illustration', 'AI image'),
  scene3d: label('3D 场景插图', '3D scene illustration', '3D scene'),
} as const satisfies Record<string, TierLabel | ((...args: never[]) => TierLabel)>;

/** A kept label's short words (照片 · 2019 → 照片, BAYLINK 实拍 · … → 实拍, Archive photo · 2019 → Archive): the date leaves. */
const keptShort = (words: string) => words.split(' · ')[0].replace(/BAYLINK (?=[实實])| photo$/, '');
/** A kept label in the page's language, with its short words. */
export const keptLabel = (words: string): TierLabel => label(words, words, keptShort(words), keptShort(words));

/** A product image's caption says so (official-opening-media artwork 'product'; captionSignal keeps the word). */
const PRODUCT_CAPTION = /产品图|商品陈列/;

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
  const zh = getImageProvenance(image, false, today), en = getImageProvenance(image, true, today);
  return label(zh, en, keptShort(en), keptShort(zh));
}
