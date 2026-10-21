import { PLANNER_EVENTS } from '../../data/planner-catalog';
import type { PlannerEvent } from '../../lib/planner';
import { getLocalDiscovery } from '../../data/local-discoveries';
import { guides, type Guide } from '../../data/guides';
import { GUIDE_IMAGES, getGuideMedia } from '../../data/guide-media';
import { canonicalEventId } from '../../lib/event-id';
import { coverItemFor, createCoverPage, getCover, type CoverPage, type ResolvedCover } from '../../lib/cover';
import type { FreebieOffer } from '../../components/FreebieBoard';
import type { SeptemberOpening } from '../../data/september-openings';
import type { BayBayQuickCard } from '../../lib/baybay-stream';
import { bayBaySitePath } from './site-path';

/**
 * BayBay answer cards (design.md §4.7.7, 1007 §5.7): the server names the cards (`localMatches`, `kind:id`), the
 * client finds the listing and its cover through the one cover resolver, so a card never shows a raw `imageKey`
 * (450/452 events carry one, 74% of them unusable) and never needs an API change.
 */
type Base = { key: string; id: string; url: string; title: string; cover: ResolvedCover; temporalStatus?: string; ended: boolean };
export type BayBayCardModel =
  | Base & { kind: 'event'; event: PlannerEvent; day?: string }
  | Base & { kind: 'offer'; offer: FreebieOffer }
  | Base & { kind: 'opening'; shop: SeptemberOpening }
  | Base & { kind: 'guide'; guide: Guide };

export const BAYBAY_MAX_CARDS = 5;
const ENDED = new Set(['past', 'inactive', 'ended']);

/** The listing behind one card, with its cover resolved on the shared page (no image twice in one answer). */
function cardModel(card: BayBayQuickCard, today: string, page: CoverPage): BayBayCardModel | null {
  const base = { key: `${card.kind}:${card.id}`, id: card.id, url: card.url, title: card.title, temporalStatus: card.temporalStatus, ended: ENDED.has(card.temporalStatus || '') };
  const ctx = { images: GUIDE_IMAGES, today, page };
  if (card.kind === 'event') {
    const event = PLANNER_EVENTS.find(item => item.id === canonicalEventId(card.id));
    if (!event) return null;
    return { ...base, kind: 'event', event, day: card.date, cover: getCover(coverItemFor('event', event), ctx) };
  }
  if (card.kind === 'offer' || card.kind === 'opening') {
    const item = getLocalDiscovery(card.kind, card.id);
    if (item?.kind === 'offer') return { ...base, kind: 'offer', offer: item.offer, cover: getCover(coverItemFor('offer', item.offer), ctx) };
    if (item?.kind === 'opening') return { ...base, kind: 'opening', shop: item.shop, cover: getCover(coverItemFor('opening', item.shop), ctx) };
    return null;
  }
  const guide = guides.find(item => item.slug === card.id);
  if (!guide) return null;
  const image = getGuideMedia(guide).cover;
  return { ...base, kind: 'guide', guide, cover: getCover({ kind: 'guide', id: guide.slug, imageKey: 'cover' }, { ...ctx, images: key => key === 'cover' ? image : undefined }) };
}

/** Cards in the server's order (chosen first, then cited), at most five, each listing once. Unknown ids are skipped. */
export function bayBayCardModels(cards: readonly BayBayQuickCard[], today: string): BayBayCardModel[] {
  const page = createCoverPage(), seen = new Set<string>();
  return cards.flatMap(card => {
    const key = `${card.kind}:${card.id}`;
    if (seen.has(key)) return [];
    seen.add(key);
    const model = cardModel(card, today, page);
    return model ? [model] : [];
  }).slice(0, BAYBAY_MAX_CARDS);
}

/** The citation number of each card: the answer's source `[n]` that is the card's own page. */
export function bayBayCardCitations(models: readonly Pick<BayBayCardModel, 'key' | 'url'>[], sources: readonly { number: number; url: string }[]): Map<string, number> {
  const byPath = new Map<string, number>();
  for (const source of sources) {
    const path = bayBaySitePath(source.url);
    if (path && !byPath.has(path)) byPath.set(path, source.number);
  }
  const result = new Map<string, number>();
  for (const model of models) {
    const number = byPath.get(model.url);
    if (number !== undefined) result.set(model.key, number);
  }
  return result;
}
