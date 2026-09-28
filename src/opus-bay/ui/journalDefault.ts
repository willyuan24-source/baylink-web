import { JOURNAL_BUILTIN_ORDER, type JournalTabSlot } from './slots';

/**
 * The tab ui/Journal.tsx opens on when none was asked (J, the 旅行本 button). Wave-5 review of lane C (plan MF6 and §3.3
 * item 5 "今天 · SF Today … the pill opens the Journal on it; desktop J"; lane R's request): in the city, a registered
 * tab that sorts before the built-ins — lane R's 今天 (order 5), whose first row is the next goal; otherwise, and always
 * in the district, as before: the wishlist when it has items and no card was found yet, else the postcards.
 */
export function journalDefaultTab(city: boolean, slots: readonly Pick<JournalTabSlot, 'id' | 'order'>[], wishFirst: boolean): string {
  const builtin = Object.keys(JOURNAL_BUILTIN_ORDER);
  const first = city ? slots.filter(s => !builtin.includes(s.id)).sort((a, b) => a.order - b.order)[0] : undefined;
  if (first && first.order < JOURNAL_BUILTIN_ORDER.cards) return first.id;
  return wishFirst ? 'wish' : 'cards';
}
