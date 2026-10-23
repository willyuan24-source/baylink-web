import { coverItemFor, getCover, type CoverContext, type CoverItem, type ImageCover, type ResolvedCover } from './cover';
import { NOT_FOR_LEAD, leadImageKeyFor } from './close-up-faces';

/**
 * UI-9 DECISIONS 32 (with UI9-IMAGES DECISIONS 26, 15 and 24): a lead slot (the home lead, the /events lead, each /calendar
 * day's lead, /plan's first pick) shows a photograph: the item's own ① picture or its ② venue photo, never a poster, a
 * flyer or full-frame artwork (cover.ts refuses them on a lead), never a close-up of faces or a posed group portrait
 * (close-up-faces.ts NOT_FOR_LEAD), never an AI picture or an information card. Those pictures stay on the item's card,
 * row and detail page. One rule for the build (home-weekend-build.ts: the home lead = homeLeads[day] = the weekly card's
 * first; /plan's first pick) and the pages (features/events/weekend-lead.ts).
 */

/** The lead slot's item: without its own picture when that is a close-up or a posed group (it draws its next candidate). */
export const leadItem = (record: { id: string; imageKey?: string; imageKeys?: readonly string[] }, excluded: ReadonlySet<string> = NOT_FOR_LEAD): CoverItem =>
  coverItemFor('event', record, { imageKey: leadImageKeyFor(record.imageKey, excluded), lead: true });

/** Whether a resolved cover may fill a lead slot: a ① or ② photograph that is not on the `excluded` list. */
export const isLeadPicture = (cover: ResolvedCover, excluded: ReadonlySet<string> = NOT_FOR_LEAD): cover is ImageCover =>
  (cover.tier === 'official' || cover.tier === 'photo' || cover.tier === 'venue')
  && cover.image.kind === 'photo' && !cover.image.fullFrame && !excluded.has(cover.key);

/**
 * Whether this event can lead a page: what its lead slot draws (no page) is a lead picture, and it is the event's own ①
 * picture whenever that is one its card shows. A pick whose own picture is a flyer, a close-up or a posed group stays a
 * normal card and the next pick with a photograph leads (round-2 OD2), rather than leading with its venue photo; one with
 * no usable picture of its own (none, refused, or a ④ AI picture) may lead with its ② venue photo. `excluded` is the list
 * of pictures that never lead (close-up-faces.ts); a test passes its own.
 */
export function leadsWithPicture(record: { id: string; imageKey?: string; imageKeys?: readonly string[] }, context: CoverContext, excluded: ReadonlySet<string> = NOT_FOR_LEAD): boolean {
  const { images, today, contextPhotos } = context;
  const ctx = { images, today, ...(contextPhotos ? { contextPhotos } : {}) };
  const slot = getCover(leadItem(record, excluded), ctx);
  if (!isLeadPicture(slot, excluded)) return false;
  const own = record.imageKey ? getCover(coverItemFor('event', { id: record.id, imageKey: record.imageKey }), ctx) : undefined;
  return !own || own.tier === 'type' || own.tier === 'ai' || own.key === slot.key;
}
