import type { Guide } from '../../data/guides';
import { translateText, type Locale } from '../../i18n/locale';

export type SfGuidePreview = {
  title: string;
  summary: string;
  updatedAt: string;
  readMinutes: number;
  href: string;
  highlights: { title?: string; text: string }[];
};

/** Excerpts stay attached to the existing editorial article, never generated facts. */
export function createSfGuidePreview(guide: Guide, locale: Locale): SfGuidePreview {
  const route = guide.blocks.find(block => block.type === 'route');
  const checklist = guide.blocks.find(block => block.type === 'checklist' || block.type === 'list');
  const highlights: SfGuidePreview['highlights'] = route?.type === 'route'
    ? route.stops.slice(0, 3).map(stop => ({ title: stop.title, text: stop.text }))
    : checklist && (checklist.type === 'checklist' || checklist.type === 'list')
      ? checklist.items.slice(0, 3).map(text => ({ text }))
      : guide.blocks.filter(block => block.type === 'paragraph').slice(0, 2).map(block => ({ text: block.text }));
  const query = locale === 'zh-Hans' ? '' : `?lang=${locale}`;
  return {
    title: translateText(guide.title, locale),
    summary: translateText(guide.summary, locale),
    updatedAt: guide.updatedAt,
    readMinutes: guide.readMinutes,
    href: `/guides/${encodeURIComponent(guide.slug)}${query}`,
    highlights: highlights.map(item => ({
      ...(item.title ? { title: translateText(item.title, locale) } : {}),
      text: translateText(item.text, locale),
    })),
  };
}

/** Loading an attraction's reader never initiates a translation or content API call. */
export async function loadSfGuidePreview(slug: string, locale: Locale): Promise<SfGuidePreview | undefined> {
  const { getGuideBySlug } = await import('../../data/guides');
  const guide = getGuideBySlug(slug);
  return guide ? createSfGuidePreview(guide, locale) : undefined;
}
