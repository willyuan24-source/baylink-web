import { EVENTS_INDEX, hasRealCover, type WeekendPick } from './events-model';
import type { IndexEvent } from './events-index-types';

/**
 * Photos whose subject is a close-up of identifiable faces (owner rule, UI-9 DECISIONS 15: such a photo never leads a page).
 * Checked by eye on the weekend picks' images; an image here can still be a feed or row cover, it only never takes a lead
 * slot (the /events lead, the calendar day's lead).
 */
export const CLOSE_UP_FACE_IMAGES: ReadonlySet<string> = new Set([
  'official-r2-petaluma-lumafest-20261024', // LumaFest 10/24: four volunteers posing at a booth
]);

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
