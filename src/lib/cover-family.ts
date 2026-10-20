import type { ResolvedCover } from './cover';

/**
 * The cover chooser (UI9-C, N20 / G3): one pure function from what a listing is, how its cover resolved (src/lib/cover.ts,
 * the honesty ladder, unchanged) and the facts its record already has, to the family that draws it, the one key fact the
 * family prints and the mark (motif) it draws. A real photo or poster always wins; the five type families are the fallback.
 *
 *   photo     an official / own / venue photo, cropped at its focal point                     mark: focal
 *   poster    a flyer or full-frame artwork, whole, on a solid board with a white mat          mark: mat
 *   date      an event: the day and weekday, the time and, for one day with a window, a 6–24 h bar   mark: calendar
 *   ticket    an offer: the value + condition, the brand and a stub with the deadline day     mark: ticket
 *   headline  a guide: its hook with one lime phrase, on the deep-green slide                 mark: the topic's Lucide mark
 *   number    a guide or service whose hook is a phone number: the number on one line        mark: plate
 *   shop      a new shop: what it sells and the opening day, on one shopfront sign           mark: shopfront
 *
 * Nothing depends on the list around the item: no index, no neighbour (distinctNeighbourTones is gone). G3 leaves one motif per
 * family and one mark per guide topic, so no family has a variant to pick: the same item looks the same on every page, in
 * every language and in any list order.
 */
export type CoverFamily = 'photo' | 'poster' | 'date' | 'ticket' | 'headline' | 'number' | 'shop';
export type CoverListingKind = 'event' | 'offer' | 'opening' | 'guide' | 'service' | 'place' | 'bulletin';
/** The facts a family may print, already in the reader's language. Only what the record states; never a guess. */
export type CoverFacts = {
  /** Item id (the hash seed). */
  id: string;
  /** date: "10/17 周六" / "Sat, Oct 17"; the time text "11:00–16:00". */
  date?: string;
  time?: string;
  /** ticket: the value, its condition and the deadline. */
  value?: string;
  condition?: string;
  deadline?: string;
  /** headline / number: the hook, and whether it is a phone number (coverPhoneKeep). */
  hook?: string;
  phone?: boolean;
  /** headline: the guide topic's mark (cover-guide.tsx topicMark), else the slide alone. */
  mark?: string;
  /** shop: what it sells and the opening day. */
  sells?: string;
  opened?: string;
  /** Last resort for a type cover with none of the above (never the category alone): the place. */
  place?: string;
};
export type CoverChoice = { family: CoverFamily; keyFact: string; mark: string };

export function chooseCover(kind: CoverListingKind, cover: Pick<ResolvedCover, 'tier'> & { fit?: 'cover' | 'contain' }, facts: CoverFacts): CoverChoice {
  if (cover.tier !== 'type') return cover.fit === 'contain' ? { family: 'poster', keyFact: '', mark: 'mat' } : { family: 'photo', keyFact: '', mark: 'focal' };
  const [family, mark, ...printed]: [CoverFamily, string, ...(string | undefined)[]] = kind === 'event' || kind === 'bulletin' ? ['date', 'calendar', facts.date, facts.time]
    : kind === 'offer' ? ['ticket', 'ticket', facts.value || facts.condition || facts.deadline]
    : kind === 'opening' ? ['shop', 'shopfront', facts.sells, facts.opened]
    : facts.phone && facts.hook ? ['number', 'plate', facts.hook] : ['headline', facts.mark || 'slide', facts.hook];
  // The key fact as the cover prints it ("10/17 周六 · 11:00–16:00"); with none of its own facts, the place (never the category).
  return { family, mark, keyFact: printed.map(part => part?.trim()).filter(Boolean).join(' · ') || facts.place?.trim() || '' };
}
