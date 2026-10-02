import { guides } from '../../data/guides';
import { GUIDE_IMAGES, getGuideMedia, type GuideImage } from '../../data/guide-media';
import { discoveryShare, localDiscoveries } from '../../data/local-discoveries';
import { getLocale, simplifySearch, translateText, type Locale } from '../../i18n/locale';
import type { OutingCoverSelection, OutingDraft } from '../../lib/outings';

export type OutingCoverInput = Pick<OutingDraft, 'title' | 'eventId' | 'date' | 'city' | 'startTime'> & { cover?: OutingCoverSelection };
export type OutingCoverChoice = {
  kind: 'guide' | 'event' | 'offer' | 'opening'; id: string; title: string; summary: string; area: string;
  path: string; image: GuideImage;
};

let catalog: OutingCoverChoice[] | undefined;
function choices(): OutingCoverChoice[] {
  return catalog ||= [
    ...localDiscoveries.flatMap(item => {
      const content = item.kind === 'event' ? item.event : item.kind === 'offer' ? item.offer : item.shop;
      const image = GUIDE_IMAGES[content.imageKey];
      if (!image) return [];
      const source = discoveryShare(item);
      return [{ kind: item.kind, id: source.id, title: source.title, summary: source.summary, area: source.area, path: source.path, image }];
    }),
    ...guides.map(guide => ({ kind: 'guide' as const, id: guide.slug, title: guide.title, summary: guide.summary, area: guide.categoryLabel, path: `/guides/${encodeURIComponent(guide.slug)}`, image: getGuideMedia(guide).cover })),
  ];
}

/** Catalog references only: a cover never changes the outing's event or schedule. */
export function resolveOutingCover(outing: Pick<OutingCoverInput, 'eventId' | 'cover'>): OutingCoverChoice | null {
  const selection = outing.cover;
  if (selection?.kind === 'card') return null;
  if (!selection || selection.kind === 'auto') {
    return outing.eventId ? choices().find(item => item.kind === 'event' && item.id === outing.eventId) || null : null;
  }
  if (!('id' in selection)) return null;
  return choices().find(item => item.kind === selection.kind && item.id === selection.id) || null;
}

export function getOutingCoverChoices(query = '', limit = 6, locale: Locale = getLocale()): OutingCoverChoice[] {
  const terms = simplifySearch(query).toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  const found = terms.length ? choices().filter(item => {
    const text = simplifySearch(`${item.title} ${item.area} ${item.summary} ${translateText(item.title, locale)} ${translateText(item.area, locale)} ${translateText(item.summary, locale)}`).toLocaleLowerCase();
    return terms.every(term => text.includes(term));
  }) : choices();
  return found.slice(0, Math.max(0, Math.min(12, Math.floor(limit) || 0)));
}

export function coverFromSearchParams(params: URLSearchParams): OutingCoverSelection | undefined {
  const kind = params.get('coverKind'), id = params.get('coverId');
  if (!id || !['guide', 'event', 'offer', 'opening'].includes(kind || '')) return undefined;
  const match = choices().find(item => item.kind === kind && item.id === id);
  return match ? { kind: match.kind, id: match.id } : undefined;
}

export function outingCoverHref(selection: OutingCoverSelection): string | undefined {
  return resolveOutingCover({ eventId: null, cover: selection })?.path;
}
