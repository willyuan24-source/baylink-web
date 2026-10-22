import { coverItemFor, getCover, type CoverContext, type CoverItem } from './cover';
import { CLOSE_UP_FACE_IMAGES, leadImageKeyFor } from './close-up-faces';

/**
 * UI9-IMAGES DECISIONS 26 (with 15 and 24): a lead slot (the home lead, the /events lead, each /calendar day's lead) shows a
 * ① picture of its own (official image, poster or photo) or a ② venue photo: never a close-up of faces (close-up-faces.ts),
 * never an AI picture (cover.ts refuses ④ on a lead), never an information card. One rule for the build (home-weekend.ts:
 * the home lead = homeLeads[day] = the weekly card's first) and the pages.
 */
export const leadItem = (record: { id: string; imageKey?: string; imageKeys?: readonly string[] }, closeUps: ReadonlySet<string> = CLOSE_UP_FACE_IMAGES): CoverItem =>
  coverItemFor('event', record, { imageKey: leadImageKeyFor(record.imageKey, closeUps), lead: true });

/**
 * Whether this event's lead picture is ① or ② (what its lead slot would draw on `context`'s images). `closeUps` is the
 * list of close-ups that never lead (close-up-faces.ts); a test passes its own.
 */
export function leadsWithPicture(record: { id: string; imageKey?: string; imageKeys?: readonly string[] }, context: CoverContext, closeUps: ReadonlySet<string> = CLOSE_UP_FACE_IMAGES): boolean {
  const { tier } = getCover(leadItem(record, closeUps), context);
  return tier === 'official' || tier === 'photo' || tier === 'venue';
}
