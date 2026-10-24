import { homeImageSrcSet } from '../../lib/home-image-rungs';
import type { GuideCovers, GuideIndexFileCovers, GuideIndexFileImage, GuidesIndex, GuidesIndexFile } from './guide-records';

// Its own module, imported by /guides only (GuidesHome): a guide page shares guide-records' chunk and never expands the index.

/** The index's cards with their pictures back on `covers` (own) and `covers.stock` (second): the file ships each shared one once. */
export function expandGuidesIndex(file: GuidesIndexFile): GuidesIndex {
  const { images, guides, ...rest } = file;
  const expanded = new Map<GuideIndexFileCovers, Omit<GuideCovers, 'stock'>>();
  const full = (covers: GuideIndexFileCovers) => {
    if (!expanded.has(covers)) expanded.set(covers, Object.fromEntries(Object.entries(covers).map(([key, image]) => {
      const { rungs, ...picture } = image as GuideIndexFileImage;
      return [key, rungs === undefined ? picture : { ...picture, srcSet: homeImageSrcSet(picture, rungs) }];
    })) as Omit<GuideCovers, 'stock'>);
    return expanded.get(covers)!;
  };
  const picture = (slug: string, src: string) => {
    const covers = images[src];
    if (!covers) throw new Error(`guides-index.json: ${slug} names ${src}, which its images do not ship`);
    return full(covers);
  };
  return { ...rest, guides: guides.map(({ covers, coverSrc, stockSrc, ...card }) => {
    const own = covers ? full(covers) : picture(card.slug, coverSrc ?? '');
    return { ...card, covers: stockSrc ? { ...own, stock: picture(card.slug, stockSrc) } : own };
  }) };
}
