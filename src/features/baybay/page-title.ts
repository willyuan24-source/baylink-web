import { PLANNER_EVENTS } from '../../data/planner-catalog';
import { getLocalDiscovery } from '../../data/local-discoveries';
import { guides } from '../../data/guides';
import { canonicalEventId } from '../../lib/event-id';

/** The title of the page the reader is on, for the "正在看：xx" capsule; null when the listing is unknown. */
export function bayBayPageTitle(ref: { kind: 'event' | 'offer' | 'opening' | 'guide'; id: string }): string | null {
  if (ref.kind === 'guide') return guides.find(guide => guide.slug === ref.id)?.title ?? null;
  if (ref.kind === 'event') return PLANNER_EVENTS.find(item => item.id === canonicalEventId(ref.id))?.title ?? null;
  const item = getLocalDiscovery(ref.kind, ref.id);
  return item?.kind === 'offer' ? item.offer.title : item?.kind === 'opening' ? item.shop.name : null;
}
