import { api } from './api';

export type BookingMode = 'request' | 'instant';
export type BookingStatus = 'pending' | 'confirmed' | 'declined' | 'cancelled' | 'expired' | 'completed';
export type BookingAction = 'confirm' | 'decline' | 'cancel' | 'complete';
export type ServiceSlot = { id: string; date: string; startTime: string; endTime: string; startAt: number; endAt: number; available: boolean; reason?: string };
export type ServiceAvailability = { eligible: boolean; enabled: boolean; mode: BookingMode; timezone: string; providerVerified: boolean; reason?: string; minNoticeMinutes: number; bufferMinutes: number; slots: ServiceSlot[] };
export type ServiceBooking = {
  id: string; postId: string; providerId: string; customerId: string; providerName: string; customerName: string; postTitle: string;
  date: string; startTime: string; endTime: string; startAt: number; endAt: number; timezone: string; status: BookingStatus; note: string;
  createdAt: number; updatedAt: number; expiresAt?: number; conversationId?: string; bufferMinutes: number;
};
export type BookingNotifications = { inApp: 'sent' | 'failed' | 'skipped' | 'pending'; sms: 'sent' | 'failed' | 'disabled' | 'unconfigured' | 'not_eligible' | 'pending' | 'unknown' };
export type BookingSmsSettings = { enabled: boolean; configured: boolean; eligible: boolean };
export type ServiceBookingInbox = { asCustomer: ServiceBooking[]; asProvider: ServiceBooking[]; sms: BookingSmsSettings };
export type BookingSettings = Pick<ServiceAvailability, 'enabled' | 'mode' | 'minNoticeMinutes' | 'bufferMinutes'>;
const base = '/service-bookings';
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const fail = (): never => { throw new Error('Invalid booking response'); };
const statuses = new Set(['pending', 'confirmed', 'declined', 'cancelled', 'expired', 'completed']);
const validDate = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
const validTime = (value: unknown): value is string => typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
function validSlot(value: unknown): value is ServiceSlot {
  return record(value) && typeof value.id === 'string' && !!value.id && validDate(value.date) && validTime(value.startTime) && validTime(value.endTime)
    && typeof value.startAt === 'number' && Number.isFinite(value.startAt) && typeof value.endAt === 'number' && value.endAt > value.startAt && typeof value.available === 'boolean';
}
export function parseAvailability(value: unknown): ServiceAvailability {
  if (!record(value) || typeof value.eligible !== 'boolean' || typeof value.enabled !== 'boolean' || !['request', 'instant'].includes(String(value.mode))
    || value.timezone !== 'America/Los_Angeles' || typeof value.providerVerified !== 'boolean' || !Number.isFinite(value.minNoticeMinutes) || !Number.isFinite(value.bufferMinutes)
    || !Array.isArray(value.slots) || !value.slots.every(validSlot) || new Set(value.slots.map(slot => slot.id)).size !== value.slots.length) return fail();
  return value as unknown as ServiceAvailability;
}
export function parseBooking(value: unknown): ServiceBooking {
  if (!record(value) || !['id', 'postId', 'providerId', 'customerId', 'postTitle'].every(key => typeof value[key] === 'string' && !!value[key])
    || !validDate(value.date) || !validTime(value.startTime) || !validTime(value.endTime) || value.timezone !== 'America/Los_Angeles'
    || !statuses.has(String(value.status)) || typeof value.note !== 'string' || !['startAt', 'endAt', 'createdAt', 'updatedAt'].every(key => typeof value[key] === 'number' && Number.isFinite(value[key]))
    || Number(value.endAt) <= Number(value.startAt) || (value.expiresAt !== undefined && (typeof value.expiresAt !== 'number' || !Number.isFinite(value.expiresAt)))
    || (value.conversationId !== undefined && typeof value.conversationId !== 'string')
    || ['providerName', 'customerName'].some(key => value[key] !== undefined && typeof value[key] !== 'string')) return fail();
  return value as unknown as ServiceBooking;
}
function parseSms(value: unknown): BookingSmsSettings {
  if (!record(value) || !['enabled', 'configured', 'eligible'].every(key => typeof value[key] === 'boolean')) return fail();
  return value as BookingSmsSettings;
}
function parseResult(value: unknown): { booking: ServiceBooking; notifications: BookingNotifications } {
  if (!record(value) || !record(value.notifications) || !['sent', 'failed', 'skipped', 'pending'].includes(String(value.notifications.inApp))
    || !['sent', 'failed', 'disabled', 'unconfigured', 'not_eligible', 'pending', 'unknown'].includes(String(value.notifications.sms))) return fail();
  return { booking: parseBooking(value.booking), notifications: value.notifications as BookingNotifications };
}
const postPath = (id: string) => `${base}/posts/${encodeURIComponent(id)}`;
const body = (value: unknown, signal?: AbortSignal): RequestInit => ({ method: 'POST', body: JSON.stringify(value), signal });
export const serviceBookings = {
  availability: async (postId: string, signal?: AbortSignal) => parseAvailability(await api.request(postPath(postId), { signal })),
  settings: async (postId: string, settings: BookingSettings, signal?: AbortSignal) => parseAvailability(await api.request(`${postPath(postId)}/settings`, { ...body(settings, signal), method: 'PATCH' })),
  addSlots: async (postId: string, slots: Pick<ServiceSlot, 'date' | 'startTime' | 'endTime'>[], idempotencyKey: string, signal?: AbortSignal) => parseAvailability(await api.request(`${postPath(postId)}/slots`, body({ slots, idempotencyKey }, signal))),
  removeSlot: async (postId: string, slotId: string, signal?: AbortSignal) => parseAvailability(await api.request(`${postPath(postId)}/slots/${encodeURIComponent(slotId)}`, { method: 'DELETE', signal })),
  book: async (postId: string, slotId: string, note: string, idempotencyKey: string, signal?: AbortSignal) => {
    const result = parseResult(await api.request(`${postPath(postId)}/book`, body({ slotId, note, idempotencyKey }, signal)));
    if (result.booking.postId !== postId) return fail();
    return result;
  },
  inbox: async (signal?: AbortSignal): Promise<ServiceBookingInbox> => {
    const value = await api.request(`${base}/me`, { signal });
    if (!record(value) || !Array.isArray(value.asCustomer) || !Array.isArray(value.asProvider)) return fail();
    return { asCustomer: value.asCustomer.map(parseBooking), asProvider: value.asProvider.map(parseBooking), sms: parseSms(value.sms) };
  },
  sms: async (enabled: boolean, signal?: AbortSignal) => parseSms((await api.request(`${base}/sms-settings`, { ...body({ enabled }, signal), method: 'PATCH' })).sms),
  action: async (booking: ServiceBooking, action: BookingAction, idempotencyKey: string, signal?: AbortSignal) => {
    const result = parseResult(await api.request(`${base}/${encodeURIComponent(booking.providerId)}/${encodeURIComponent(booking.id)}/actions`, body({ action, idempotencyKey }, signal)));
    if (result.booking.id !== booking.id || result.booking.providerId !== booking.providerId || result.booking.customerId !== booking.customerId) return fail();
    return result;
  },
};
export const bookingRequestKey = () => globalThis.crypto?.randomUUID?.() || `booking-${Date.now()}-${Math.random().toString(36).slice(2)}`;
export const bookingDisplayStatus = (booking: ServiceBooking, now = Date.now()): BookingStatus => booking.status === 'pending' && Math.min(booking.expiresAt ?? booking.startAt, booking.startAt) <= now ? 'expired' : booking.status;
export function bayAreaBookingDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type)?.value).join('-');
}
