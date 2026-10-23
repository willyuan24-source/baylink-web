import { EVENTS_INDEX, coverContext, type WeekendPick } from './events-model';
import type { IndexEvent } from './events-index-types';
import { CLOSE_UP_FACE_IMAGES, NOT_FOR_LEAD, leadImageKey } from '../../lib/close-up-faces';
import { leadsWithPicture } from '../../lib/lead-rule';
import { nextOccurrence } from '../../lib/monthly';

/**
 * Photos that never lead (DECISIONS 15/32: close-ups and posed groups): one list for /events, /calendar and the home lead
 * (lib/close-up-faces.ts). A lead that has no other candidate shows its next one (`leadImageKey`; never an information
 * card, UI9-IMAGES DECISIONS 21).
 */
export { CLOSE_UP_FACE_IMAGES, NOT_FOR_LEAD, leadImageKey };

/**
 * Whether an event can lead a page (DECISIONS 26/32, lib/lead-rule.ts): its card's picture is a photograph, ① its own or ②
 * its venue's; never a poster or flyer, a close-up face, a posed group, an AI picture or an information card.
 */
export const canLead = (event: Pick<IndexEvent, 'id' | 'imageKey' | 'imageKeys'>, today: string, excluded: ReadonlySet<string> = NOT_FOR_LEAD) =>
  leadsWithPicture(event, coverContext(today), excluded);

/**
 * Home's lead for a day (the first of home.weekends[day].ids, written into the index by generate-events-index.ts), else
 * the first weekend pick, which is the rule home itself uses.
 */
export const homeLeadFor = (today: string, picks: readonly WeekendPick[], leads: Readonly<Record<string, string>> | undefined = EVENTS_INDEX.homeLeads) =>
  leads?.[today] ?? picks[0]?.event.id;

/**
 * The /events editor's block (G15, content arrangement §2 A + the cross-page critic): home's lead is never the lead or a
 * pick row here (it returns to the feed), so /events never opens on what home just showed. The lead is the first remaining
 * pick that can lead (DECISIONS 26/32: a ① or ② photograph); when none can, the first of `more` (the weekend in its
 * ranking) that can, as 本周末先看, with every remaining pick as a row (a flyer pick stays a row); only a weekend with no
 * such picture at all leads with its first pick, whose lead slot then draws its next candidate (WeekendView: leadImageKey).
 */
export function arrangePicks(picks: readonly WeekendPick[], today: string, homeLead: string | undefined, more: readonly IndexEvent[] = []): { lead?: WeekendPick; rows: WeekendPick[] } {
  const rest = picks.filter(pick => pick.event.id !== homeLead);
  // No picks block (a narrowed list, a share-card landing): no lead either.
  if (!rest.length) return { rows: [] };
  const lead = rest.find(pick => canLead(pick.event, today));
  if (lead) return { lead, rows: rest.filter(pick => pick !== lead) };
  const event = more.find(item => item.id !== homeLead && !rest.some(pick => pick.event.id === item.id) && canLead(item, today));
  if (event) return { lead: { event, date: nextOccurrence(event, today) ?? today }, rows: rest };
  return { lead: rest[0], rows: rest.slice(1) };
}
