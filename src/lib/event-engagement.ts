import { api } from './api';

export type EventInterest = { interested: boolean; lookingForBuddy: boolean };
export type EventEngagement = { eventId: string; interestedCount: number; buddyCount: number; me: EventInterest | null };
export type EventBuddy = { id: string; nickname: string; avatar: string; city: string };
export function parseEventEngagement(value: unknown): EventEngagement {
  const item = value as EventEngagement;
  if (!item || typeof item.eventId !== 'string' || !Number.isSafeInteger(item.interestedCount) || item.interestedCount < 0 || !Number.isSafeInteger(item.buddyCount) || item.buddyCount < 0 || item.buddyCount > item.interestedCount || (item.me !== null && (!item.me || typeof item.me.interested !== 'boolean' || typeof item.me.lookingForBuddy !== 'boolean' || (item.me.lookingForBuddy && !item.me.interested)))) throw new Error('Invalid event participation response');
  return item;
}
export const getEventEngagement = async (ids: string[], signal?: AbortSignal): Promise<EventEngagement[]> => {
  const response = await api.request(`/events/engagement?ids=${encodeURIComponent(ids.join(','))}`, { signal });
  if (!Array.isArray(response.events)) throw new Error('Invalid event participation response');
  const entries = response.events.map(parseEventEngagement);
  if (entries.length !== ids.length || new Set(entries.map((entry: EventEngagement) => entry.eventId)).size !== ids.length || entries.some((entry: EventEngagement) => !ids.includes(entry.eventId))) throw new Error('Incomplete event participation response');
  return entries;
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
