import { EVENTS_INDEX, hasRealCover, type WeekendPick } from './events-model';
import type { IndexEvent } from './events-index-types';
import { CLOSE_UP_FACE_IMAGES } from '../../lib/close-up-faces';

/** Photos that never lead (DECISIONS 15): one list for /events, /calendar and the home lead (lib/close-up-faces.ts). */
export { CLOSE_UP_FACE_IMAGES };

/** Whether an event's own picture can lead a page: a real photo or poster, not a close-up of faces. */
export const canLead = (event: Pick<IndexEvent, 'id' | 'imageKey'>, today: string) =>
  hasRealCover('event', event, today) && !CLOSE_UP_FACE_IMAGES.has(event.imageKey);

/**
 * Home's lead for a day (the first of home.weekends[day].ids, written into the index by generate-events-index.ts), else
 * the first weekend pick, which is the rule home itself uses.
 */
export const homeLeadFor = (today: string, picks: readonly WeekendPick[], leads: Readonly<Record<string, string>> | undefined = EVENTS_INDEX.homeLeads) =>
  leads?.[today] ?? picks[0]?.event.id;

/**
 * The /events editor's block (G15, content arrangement §2 A + the cross-page critic): home's lead is never the lead or a
 * pick row here (it returns to the feed), so /events never opens on what home just showed. The lead is the first remaining
 * pick that can lead (a real picture, no close-up face), else the first remaining pick; the other picks follow as rows.
 */
export function arrangePicks(picks: readonly WeekendPick[], today: string, homeLead: string | undefined): { lead?: WeekendPick; rows: WeekendPick[] } {
  const rest = picks.filter(pick => pick.event.id !== homeLead);
  const lead = rest.find(pick => canLead(pick.event, today)) ?? rest[0];
  return { lead, rows: rest.filter(pick => pick !== lead) };
}
