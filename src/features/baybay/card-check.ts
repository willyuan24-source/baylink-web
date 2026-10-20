import { isPressSource, readerMonthDay } from '../../lib/event-facts';
import type { BayBayCardModel } from './answer-cards';

/**
 * A record whose source is a press report ("媒体报道 · visitmarin.org"): the site's one prefix rule (lib/event-facts.ts
 * isPressSource), the same for every card kind that carries a `sourceLabel` and for the events, boards and detail cards.
 */
export const pressSource = (label: string | null | undefined): boolean => isPressSource(label);

/**
 * The ✓ line every event, offer and opening card carries (captain decisions 3 and 17): 官网核对 M/D, or 媒体报道 · M/D 核对
 * when the record's own source label names a press report (pressSource, one rule for events, offers and openings; e.g.
 * Ross Street Sundays' 媒体报道 · thesocomarket.com), never 人工核对. Guides: none.
 */
export function cardCheck(model: BayBayCardModel, t: (zh: string, en: string) => string, english: boolean): string | null {
  const record = model.kind === 'event' ? model.event : model.kind === 'offer' ? model.offer : model.kind === 'opening' ? model.shop : undefined;
  const day = record?.verifiedAt;
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const date = readerMonthDay(day, english);
  return pressSource(record.sourceLabel) ? t(`媒体报道 · ${date} 核对`, `News report · checked ${date}`) : t(`官网核对 ${date}`, `Source checked ${date}`);
}
