import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { guides, type Guide } from '../src/data/guides';
import { getLocale, setLocale, type Locale } from '../src/i18n/locale';
import { coverInCurrentLanguage, guideRecordOf, guideStockPool, guidesIndexOf, mergeCovers } from '../src/features/guides/guide-data';
import { getBayAreaToday } from '../src/lib/monthly';
import type { GuideCard, GuideCovers, GuideRecord, GuidesIndex } from '../src/features/guides/guide-records';
import type { GuideImage } from '../src/data/guide-media';
import { GUIDE_COVER_ANSWERS } from '../src/data/guide-editorial/answers';
import { answeredHookFields } from '../src/lib/guide-hook-highlight';

/**
 * The guide routes' data split (WEB-DATA-SPLIT, ENGSEC-01, FA-01): a slim index for /guides (cards: title, topic inputs,
 * source count, reading time, cover, regions) and one record per guide for /guides/:slug (the article, its pictures, its
 * "Read next" cards, its editorial aids and its metadata), plus the loader registry the browser imports them through.
 * Generated from the published catalogs with the functions the pages used to run at runtime, so nothing reader-visible
 * changes; deterministic for a given catalog. Run with the English scopes (generate-english-scopes.ts, from generate:home in
 * prebuild and pretest), which read the same index and records.
 */
export type GuideData = { index: GuidesIndex; records: GuideRecord[] };

export async function buildGuideData(): Promise<GuideData> {
  const previous = getLocale();
  const perLanguage = new Map<string, Partial<Record<Locale, GuideImage>>>(guides.map(guide => [guide.slug, {}]));
  const stockPerLanguage = new Map<string, Partial<Record<Locale, GuideImage>>>(guides.map(guide => [guide.slug, {}]));
  const poolPerLanguage = new Map<string, Partial<Record<Locale, GuideImage[]>>>(guides.map(guide => [guide.slug, {}]));
  const today = getBayAreaToday();
  try {
    for (const locale of ['zh-Hans', 'zh-Hant', 'en'] as const) {
      await setLocale(locale, false);
      for (const guide of guides) {
        perLanguage.get(guide.slug)![locale] = coverInCurrentLanguage(guide);
        const pool = guideStockPool(guide, today);
        poolPerLanguage.get(guide.slug)![locale] = pool;
        if (pool[0]) stockPerLanguage.get(guide.slug)![locale] = pool[0];
      }
    }
  } finally {
    await setLocale(previous, false);
  }
  // UI9-IMG-A1b: a cover file two guides share is shown once per page (①②), so those guides also carry their ③ stock picture.
  const uses = new Map<string, number>();
  for (const images of perLanguage.values()) uses.set(images['zh-Hans']!.src, (uses.get(images['zh-Hans']!.src) ?? 0) + 1);
  const covers = new Map<string, GuideCovers>([...perLanguage].map(([slug, images]) => {
    const own = mergeCovers(images['zh-Hans']!, images['zh-Hant']!, images.en!);
    const stock = stockPerLanguage.get(slug)!;
    const shared = (uses.get(images['zh-Hans']!.src) ?? 0) > 1 && stock['zh-Hans'] && stock['zh-Hans'].src !== images['zh-Hans']!.src;
    return [slug, shared ? { ...own, stock: mergeCovers(stock['zh-Hans']!, stock['zh-Hant']!, stock.en!) } : own];
  }));
  const coversOf = (guide: Guide) => covers.get(guide.slug)!;
  // UI9-C (G19): an answered guide's card carries its cover hook and lime phrase, so /guides and "Read next" print them
  // without loading answers.ts.
  const withHook = <T extends { slug: string }>(card: T): T => ({ ...card, ...answeredHookFields(card.slug, GUIDE_COVER_ANSWERS) });
  const index = guidesIndexOf(coversOf);
  // UI9-IMG-A1b: a guide page shows its hero and its 接下来 cards together (ADJACENT_CARDS): a card that would repeat a stock
  // picture already on the page, or whose ①② cover the page already shows, takes the next picture of its category's pool.
  const isStock = (image: GuideImage) => typeof image.rights === 'object' && image.rights?.basis === 'stock';
  const distinctRelated = (record: GuideRecord): GuideRecord => {
    // The page's own pictures come first: the hero and the article's inline pictures.
    const claimed = new Set([record.covers['zh-Hans'].src, ...record.inline.map(({ image }) => image.src)]);
    const repeats: GuideCard[] = [];
    const distinct = record.related.flatMap(card => {
      const own = card.covers['zh-Hans'];
      if (!isStock(own) && !claimed.has(own.src)) { claimed.add(own.src); return [card]; }
      const pool = poolPerLanguage.get(card.slug)!;
      const at = (pool['zh-Hans'] ?? []).findIndex(image => !claimed.has(image.src));
      // Its category has no picture left that the page does not show: the card moves behind the others ("Read next" shows
      // the first four that are still current, relatedForToday).
      if (at < 0) { repeats.push(card); return []; }
      claimed.add(pool['zh-Hans']![at].src);
      const pick = mergeCovers(pool['zh-Hans']![at], pool['zh-Hant']![at], pool.en![at]);
      return [isStock(own) ? { ...card, covers: pick } : { ...card, covers: { ...card.covers, stock: pick } }];
    });
    return { ...record, related: [...distinct, ...repeats] };
  };
  return { index: { ...index, guides: index.guides.map(withHook) }, records: guides.map(guide => distinctRelated(guideRecordOf(guide, coversOf))).map(record => ({ ...record, related: record.related.map(withHook) })) };
}

const SAFE_SLUG = /^[a-z0-9][a-z0-9-]*$/u;

export async function writeGuideData({ index, records }: GuideData): Promise<void> {
  const directory = 'src/data/generated/guides';
  await mkdir(directory, { recursive: true });
  // A guide that left the catalog leaves no stale record behind.
  const keep = new Set(records.map(record => `${record.guide.slug}.json`));
  for (const file of await readdir(directory)) if (!keep.has(file)) await rm(`${directory}/${file}`);
  let largest = { slug: '', bytes: 0 };
  for (const record of records) {
    if (!SAFE_SLUG.test(record.guide.slug)) throw new Error(`Unsafe guide slug: ${record.guide.slug}`);
    const json = JSON.stringify(record);
    const bytes = gzipSync(json).length;
    if (bytes > largest.bytes) largest = { slug: record.guide.slug, bytes };
    await writeFile(`${directory}/${record.guide.slug}.json`, json);
  }
  const indexJson = JSON.stringify(index);
  await writeFile('src/data/generated/guides-index.json', indexJson);
  const lines = records.map(record => `  ${JSON.stringify(record.guide.slug)}: () => import(${JSON.stringify(`./guides/${record.guide.slug}.json`)}),`);
  await writeFile('src/data/generated/guide-loaders.ts', `// Generated by scripts/generate-guide-data.ts; one chunk per guide, imported only when its page opens.\nexport const guideLoaders: Record<string, () => Promise<{ default: unknown }>> = {\n${lines.join('\n')}\n};\n`);
  console.log(`Guide data: index ${(gzipSync(indexJson).length / 1024).toFixed(1)} KiB gzip for ${index.guides.length} guides; ${records.length} records, largest ${largest.slug} ${(largest.bytes / 1024).toFixed(1)} KiB gzip.`);
}
