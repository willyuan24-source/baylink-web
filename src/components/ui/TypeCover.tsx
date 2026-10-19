import { TypeFrame, type CoverLayout } from './cover-frame';
import { DateFace } from './cover-date';
import { TicketFace } from './cover-ticket';
import { HeadlineFace, NumberFace, hookPhone, topicMark } from './cover-guide';
import { ShopFace } from './cover-shop';
import { chooseCover } from '../../lib/cover-family';
import type { CoverTone, DateChipText } from '../../lib/event-facts';

// The listing covers live with their family (UI9-C): a route loads only the families it draws.
export { EventTypeCover } from './cover-date';
export { OfferTypeCover } from './cover-ticket';
export { GuideTypeCover } from './cover-guide';
export { OpeningTypeCover } from './cover-shop';

export type TypeCoverProps = Omit<CoverLayout, 'tone'> & {
  tone: CoverTone;
  /** The listing kind; `guide` prints a hook (headline) or a phone number (number), `offer` a ticket, `opening` a shop sign. */
  family?: 'event' | 'offer' | 'opening' | 'guide';
  /** The truthful category label, already localized ("亲子活动"); the eyebrow when nothing better is known. */
  label: string;
  date?: DateChipText;
  /** A guide's hook (or, for the older callers, the title the cover prints). */
  title?: string;
  /** Offer value ("免费", "7 折") and its condition. */
  value?: string;
  valueSmall?: string;
  brand?: string;
  note?: string;
  place?: string;
  /** Accepted for older callers; a cover prints no stickers (UI9-C, N22). */
  sticker?: { tone: string; text: string };
  /** A guide topic (its mark). */
  icon?: string;
  /** The item id (the variant seed). */
  seed?: string;
};

/**
 * A coded cover from a caller's own props (AttractionExplorer, PlannerStopCover, UnifiedSavedItems, BayBayCards). It picks
 * its family as chooseCover does: a value → ticket, a date → date, an opening → shop, a guide or a title → headline (number
 * when it is a phone number). The listing covers (EventTypeCover, OfferTypeCover, OpeningTypeCover, GuideTypeCover) build
 * the same faces from the record.
 */
export function TypeCover({ tone, family = 'event', label, date, title, value, valueSmall, brand, place, icon, seed, ...layout }: TypeCoverProps) {
  const mini = layout.size === 'mini';
  const id = seed || title || label || tone;
  if (family === 'offer' || value) {
    const choice = chooseCover('offer', { tier: 'type' }, { id, value, condition: valueSmall, place: brand || label });
    return <TypeFrame {...layout} {...choice} kind="offer" tone={tone}><TicketFace value={value} condition={valueSmall} brand={brand} mini={mini} /></TypeFrame>;
  }
  if (family !== 'opening' && date?.big) {
    const choice = chooseCover('event', { tier: 'type' }, { id, date: date.label, place });
    return <TypeFrame {...layout} {...choice} kind="event" tone={tone}><DateFace day={date} eyebrow={place} thumb={date.label} mini={mini} /></TypeFrame>;
  }
  if (family === 'opening') {
    const choice = chooseCover('opening', { tier: 'type' }, { id, sells: label, place: title });
    return <TypeFrame {...layout} {...choice} kind="opening" tone={tone}><ShopFace sells={label} mini={mini} /></TypeFrame>;
  }
  const hook = title || label;
  const phone = !!hookPhone(hook);
  const kind = family === 'guide' ? 'guide' : 'place';
  const choice = chooseCover(kind, { tier: 'type' }, { id, hook, phone, mark: topicMark(icon) });
  return <TypeFrame {...layout} {...choice} kind={kind} tone={tone}>
    {phone ? <NumberFace hook={hook} eyebrow={title ? label : undefined} mark={topicMark(icon)} mini={mini} />
      : <HeadlineFace hook={hook} eyebrow={title && label !== hook ? label : undefined} mark={choice.mark} mini={mini} />}
  </TypeFrame>;
}
