import { api } from './api';

export type OutingMemberStatus = 'requested' | 'confirmed' | 'declined' | 'left' | 'removed';
export type OutingAction = 'request' | 'withdraw' | 'accept' | 'decline' | 'remove' | 'cancel' | 'reconfirm';
export type OutingDraft = {
  title: string; description: string; eventId: string | null; date: string; startTime: string; endTime: string;
  city: string; venue: string; capacity: number; costNote: string;
  transport: 'own' | 'transit' | 'walk'; language: 'any' | 'zh' | 'en';
};
export type OutingCreate = OutingDraft & { adultConsent: boolean; publicPlaceConsent: boolean };
export type OutingMember = { userId: string; nickname: string; role: 'host' | 'member'; status: OutingMemberStatus; confirmedVersion: number; note?: string };
export type Outing = OutingDraft & {
  id: string; eventTitle?: string; officialUrl?: string; startAt: number; endAt: number; timezone: 'America/Los_Angeles';
  status: 'open' | 'cancelled' | 'completed'; revision: number; planVersion: number;
  host: { id: string; nickname: string; verified: boolean }; confirmedCount: number; requestCount?: number;
  me: null | Pick<OutingMember, 'userId' | 'role' | 'status' | 'confirmedVersion'>;
  members?: OutingMember[]; createdAt: number; updatedAt: number;
};
export type OutingMessage = { id: string; outingId: string; senderId: string; senderName: string; text: string; createdAt: number };
export type OutingResult = { outing: Outing; notificationWarning?: string };
export type OutingAiDraft = { answer: string; questions: string[]; draft: Partial<OutingDraft>; missing: string[]; source: 'ai' };
export type OutingFilters = { eventId?: string; date?: string; city?: string; cursor?: string };
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown, max = 2000): v is string => typeof v === 'string' && v.length <= max;
const integer = (v: unknown, min = 0) => Number.isSafeInteger(v) && Number(v) >= min;
const finite = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
const date = (v: unknown): v is string => str(v, 10) && /^20\d{2}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v;
const time = (v: unknown): v is string => str(v, 5) && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(v);
const localClock = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
function sameLocalTime(instant: unknown, day: unknown, clock: unknown): boolean {
  if (!finite(instant) || Math.abs(Number(instant)) > 8.64e15) return false;
  const parts = Object.fromEntries(localClock.formatToParts(new Date(Number(instant))).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}` === day && `${parts.hour}:${parts.minute}` === clock;
}
const memberStatuses = new Set(['requested', 'confirmed', 'declined', 'left', 'removed']);
const invalid = (): never => { throw new Error('Invalid outing response'); };
function member(v: unknown, named: boolean): boolean {
  return record(v) && str(v.userId, 140) && !!v.userId && ['host', 'member'].includes(String(v.role)) && memberStatuses.has(String(v.status))
    && integer(v.confirmedVersion) && (!named || str(v.nickname, 200)) && (v.note === undefined || str(v.note));
}
export function parseOuting(v: unknown): Outing {
  if (!record(v) || !str(v.id, 140) || !v.id || !str(v.title, 160) || !v.title
    || !str(v.description) || !(v.eventId === null || (str(v.eventId, 140) && !!v.eventId))
    || !date(v.date) || !time(v.startTime) || !time(v.endTime) || v.endTime <= v.startTime
    || !['city', 'venue', 'costNote'].every(key => str(v[key])) || !integer(v.capacity, 2) || Number(v.capacity) > 8
    || !['own', 'transit', 'walk'].includes(String(v.transport)) || !['any', 'zh', 'en'].includes(String(v.language))
    || !['open', 'cancelled', 'completed'].includes(String(v.status)) || v.timezone !== 'America/Los_Angeles'
    || !['startAt', 'endAt', 'createdAt', 'updatedAt'].every(key => finite(v[key])) || Number(v.endAt) <= Number(v.startAt)
    || !sameLocalTime(v.startAt, v.date, v.startTime) || !sameLocalTime(v.endAt, v.date, v.endTime)
    || !integer(v.revision) || !integer(v.planVersion, 1) || !integer(v.confirmedCount) || Number(v.confirmedCount) > Number(v.capacity)
    || !record(v.host) || !str(v.host.id, 140) || !v.host.id || !str(v.host.nickname, 200) || typeof v.host.verified !== 'boolean'
    || !(v.me === null || member(v.me, false)) || (v.requestCount !== undefined && !integer(v.requestCount))
    || (v.members !== undefined && (!Array.isArray(v.members) || !v.members.every(item => member(item, true)) || new Set(v.members.map(item => item.userId)).size !== v.members.length))
    || (v.eventTitle !== undefined && !str(v.eventTitle, 300))
    || (v.officialUrl !== undefined && (!str(v.officialUrl, 2000) || (v.officialUrl && !safeOutingUrl(v.officialUrl))))) return invalid();
  return v as unknown as Outing;
}
export function safeOutingUrl(value: string): boolean {
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password; } catch { return false; }
}
export function parseOutingMessage(v: unknown): OutingMessage {
  if (!record(v) || !['id', 'outingId', 'senderId'].every(key => str(v[key], 140) && !!v[key]) || !str(v.senderName, 200) || !str(v.text) || !v.text || !finite(v.createdAt)) return invalid();
  return v as OutingMessage;
}
const base = '/outings';
const path = (id: string) => `${base}/${encodeURIComponent(id)}`;
const body = (value: unknown, signal?: AbortSignal): RequestInit => ({ method: 'POST', body: JSON.stringify(value), signal });
const result = (value: unknown, id?: string): OutingResult => {
  if (!record(value) || (value.notificationWarning !== undefined && !str(value.notificationWarning))) return invalid();
  const outing = parseOuting(value.outing); if (id && outing.id !== id) return invalid();
  return { outing, ...(value.notificationWarning ? { notificationWarning: String(value.notificationWarning) } : {}) };
};
const list = (value: unknown): Outing[] => {
  if (!Array.isArray(value) || value.length > 200) return invalid();
  const items = value.map(parseOuting); if (new Set(items.map(item => item.id)).size !== items.length) return invalid(); return items;
};
export const outingRequestKey = () => globalThis.crypto?.randomUUID?.() || `outing-${Date.now()}-${Math.random().toString(36).slice(2)}`;
export const outingUrl = (id: string) => `/together?outing=${encodeURIComponent(id)}`;
export const outings = {
  list: async (filters: OutingFilters = {}, signal?: AbortSignal) => {
    const query = new URLSearchParams(); for (const [key, value] of Object.entries(filters)) if (value) query.set(key, value);
    const value: unknown = await api.request(`${base}?${query}`, { signal });
    if (!record(value) || !(value.nextCursor === null || (str(value.nextCursor, 1000) && !!value.nextCursor.trim() && value.nextCursor !== filters.cursor))) return invalid();
    return { outings: list(value.outings), nextCursor: value.nextCursor as string | null };
  },
  mine: async (signal?: AbortSignal) => { const value: unknown = await api.request(`${base}/me`, { signal }); if (!record(value)) return invalid(); return { outings: list(value.outings) }; },
  get: async (id: string, signal?: AbortSignal) => result(await api.request(path(id), { signal }), id),
  create: async (draft: OutingCreate, idempotencyKey: string, signal?: AbortSignal) => result(await api.request(base, body({ ...draft, idempotencyKey }, signal))),
  update: async (outing: Outing, draft: OutingDraft & { publicPlaceConsent?: boolean }, idempotencyKey: string, signal?: AbortSignal) => result(await api.request(path(outing.id), { ...body({ ...draft, revision: outing.revision, idempotencyKey }, signal), method: 'PATCH' }), outing.id),
  action: async (outing: Outing, action: OutingAction, options: { userId?: string; note?: string; adultConsent?: boolean }, idempotencyKey: string, signal?: AbortSignal) => result(await api.request(`${path(outing.id)}/actions`, body({ ...options, action, revision: outing.revision, idempotencyKey }, signal)), outing.id),
  messages: async (id: string, signal?: AbortSignal) => {
    const value: unknown = await api.request(`${path(id)}/messages`, { signal }); if (!record(value) || !Array.isArray(value.messages)) return invalid();
    const messages = value.messages.map(parseOutingMessage); if (messages.some(item => item.outingId !== id) || new Set(messages.map(item => item.id)).size !== messages.length) return invalid(); return { messages };
  },
  sendMessage: async (outing: Outing, text: string, idempotencyKey: string, signal?: AbortSignal) => {
    const value: unknown = await api.request(`${path(outing.id)}/messages`, body({ text, revision: outing.revision, idempotencyKey }, signal));
    if (!record(value)) return invalid(); const message = parseOutingMessage(value.message); if (message.outingId !== outing.id) return invalid(); return { message };
  },
  report: async (id: string, reason: string, details: string, messageId?: string, signal?: AbortSignal) => {
    const value: unknown = await api.request(`${path(id)}/reports`, body({ reason, details, ...(messageId ? { messageId } : {}) }, signal));
    if (!record(value) || !str(value.reportId, 140) || !value.reportId) return invalid(); return { reportId: value.reportId };
  },
  draft: async (input: { intent: string; eventId?: string | null; locale: string }, signal?: AbortSignal): Promise<OutingAiDraft> => {
    const value: unknown = await api.request('/ai/outing-draft', body(input, signal));
    if (!record(value) || value.source !== 'ai' || !str(value.answer, 1200) || !Array.isArray(value.questions) || value.questions.length > 2 || !value.questions.every(q => str(q, 300))
      || !Array.isArray(value.missing) || !value.missing.every(q => str(q, 100)) || !record(value.draft)) return invalid();
    const allowed = new Set(['title', 'description', 'eventId', 'date', 'startTime', 'endTime', 'city', 'venue', 'capacity', 'costNote', 'transport', 'language']);
    if (Object.keys(value.draft).some(key => !allowed.has(key))) return invalid();
    for (const [key, field] of Object.entries(value.draft)) {
      if (key === 'capacity') { if (!integer(field, 2) || Number(field) > 8) return invalid(); }
      else if (key === 'eventId') { if (field !== null && !str(field, 140)) return invalid(); }
      else if (!str(field)) return invalid();
    }
    if ((value.draft.date && !date(value.draft.date)) || (value.draft.startTime && !time(value.draft.startTime)) || (value.draft.endTime && !time(value.draft.endTime))
      || (value.draft.transport && !['own','transit','walk'].includes(String(value.draft.transport))) || (value.draft.language && !['any','zh','en'].includes(String(value.draft.language)))) return invalid();
    return value as unknown as OutingAiDraft;
  },
  adminGet: async (id: string) => result(await api.request(`/admin/outings/${encodeURIComponent(id)}`), id),
  adminCancel: async (id: string, revision: number, reason: string, idempotencyKey: string) => result(await api.request(`/admin/outings/${encodeURIComponent(id)}/cancel`, body({ revision, reason, idempotencyKey })), id),
};
