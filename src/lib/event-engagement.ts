import { api } from './api';

export type EventInterest = { interested: boolean; lookingForBuddy: boolean };
export type EventEngagement = { eventId: string; interestedCount: number; buddyCount: number; me: EventInterest | null };
export type EventBuddy = { id: string; nickname: string; avatar: string; city: string };
export function parseEventEngagement(value: unknown): EventEngagement {
  const item = value as EventEngagement;
  if (!item || typeof item.eventId !== 'string' || !Number.isSafeInteger(item.interestedCount) || item.interestedCount < 0 || !Number.isSafeInteger(item.buddyCount) || item.buddyCount < 0 || item.buddyCount > item.interestedCount || (item.me !== null && (!item.me || typeof item.me.interested !== 'boolean' || typeof item.me.lookingForBuddy !== 'boolean' || (item.me.lookingForBuddy && !item.me.interested)))) throw new Error('Invalid event participation response');
  return item;
}
/** Counts for the events the API knows, and the requested ids it does not know (yet). */
export type EventEngagementRead = { entries: EventEngagement[]; unknown: string[] };
// api.request's error for a body that is not JSON (src/lib/api.ts): an HTML 404 from a proxy or a missing route is an
// outage, not the API saying it does not know the event, so it stays a failure (重试).
const NOT_JSON_ERROR = '服务返回了无效数据，请稍后重试。';
/** The API's own 404 for an event it does not know: a JSON body with its error message ('活动不存在。'). */
const unknownEventError = (error: unknown) => {
  const { status, error: message } = (error ?? {}) as { status?: unknown; error?: unknown };
  return status === 404 && typeof message === 'string' && message !== NOT_JSON_ERROR;
};
/**
 * The API knows the events it copied from the web's catalogs; until the API-SYNC that follows a content merge, a new event
 * is unknown to it (H07). It lists those ids in `unknown` (from API-SYNC-3b); before that it answered the whole batch with
 * a JSON 404, which names the id only for a one-id batch (a detail page asks for one). Every requested id must come back exactly
 * once, as counts or as unknown; anything else rejects the read, so a partial answer never shows as complete.
 */
export const getEventEngagement = async (ids: string[], signal?: AbortSignal): Promise<EventEngagementRead> => {
  if (new Set(ids).size !== ids.length) throw new Error('Duplicate event participation IDs');
  // Stay below the API's 200-ID cap and keep encoded URLs manageable as the catalog grows.
  const batches: string[][] = [];
  for (let index = 0; index < ids.length; index += 100) batches.push(ids.slice(index, index + 100));
  const results = await Promise.all(batches.map(async (batch): Promise<EventEngagementRead> => {
    let response;
    try {
      response = await api.request(`/events/engagement?ids=${encodeURIComponent(batch.join(','))}`, { signal });
    } catch (error) {
      if (batch.length === 1 && unknownEventError(error)) return { entries: [], unknown: [...batch] };
      throw error;
    }
    if (!Array.isArray(response.events) || (response.unknown !== undefined && (!Array.isArray(response.unknown) || response.unknown.some((id: unknown) => typeof id !== 'string')))) throw new Error('Invalid event participation response');
    const entries: EventEngagement[] = response.events.map(parseEventEngagement);
    const unknown: string[] = response.unknown ?? [];
    const answered = [...entries.map(entry => entry.eventId), ...unknown];
    if (answered.length !== batch.length || new Set(answered).size !== batch.length || answered.some(id => !batch.includes(id))) throw new Error('Incomplete event participation response');
    return { entries, unknown };
  }));
  return { entries: results.flatMap(result => result.entries), unknown: results.flatMap(result => result.unknown) };
};
export const setEventInterest = async (id: string, interest: EventInterest) => {
  const entry = parseEventEngagement(await api.request(`/events/${encodeURIComponent(id)}/interest`, { method: 'PUT', body: JSON.stringify(interest) }));
  if (entry.eventId !== id || !entry.me || entry.me.interested !== interest.interested || entry.me.lookingForBuddy !== interest.lookingForBuddy) throw new Error('Unconfirmed event participation update');
  return entry;
};
export const getEventBuddies = async (id: string, cursor?: string, signal?: AbortSignal): Promise<{ buddies: EventBuddy[]; nextCursor: string | null }> => {
  const response = await api.request(`/events/${encodeURIComponent(id)}/buddies?limit=20${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`, { signal });
  if (!response || response.eventId !== id || !Array.isArray(response.buddies)
    || response.buddies.some((buddy: EventBuddy) => !buddy || typeof buddy.id !== 'string' || !buddy.id.trim() || typeof buddy.nickname !== 'string' || typeof buddy.avatar !== 'string' || typeof buddy.city !== 'string')
    || (response.nextCursor !== null && (typeof response.nextCursor !== 'string' || !response.nextCursor || response.nextCursor === cursor))) throw new Error('Invalid buddy response');
  return { buddies: [...new Map<string, EventBuddy>(response.buddies.map((buddy: EventBuddy) => [buddy.id, { id: buddy.id, nickname: buddy.nickname, avatar: buddy.avatar, city: buddy.city }])).values()], nextCursor: response.nextCursor };
};
