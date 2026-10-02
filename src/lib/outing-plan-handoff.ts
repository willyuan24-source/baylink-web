import { cleanStops, eventFor, placeFor, todayInBay, validDay, type PlanDetails, type Stop } from './planner';
import { eventOccursOn } from './event-calendar';
import { buildItinerary, clockLabel } from './planner-itinerary';
import type { OutingDraft } from './outings';

const TTL = 30 * 60 * 1000;
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const clock = (value: unknown): value is string => typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
const safeText = (value: unknown, max: number): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= max && !/\p{Cc}/u.test(value);
type PlanHandoff = { source: 'baylink-plan-outing'; version: 1; ownerId: string; createdAt: number; title: string; date: string; stops: Stop[]; startTime: string; partySize: number; travelMode: string };

/** Keep only reviewed catalog references in this tab's navigation state. No tokens,
 * personal constraints, budget breakdowns or external search summaries are copied. */
export function createOutingPlanHandoff(input: { ownerId: string; title: string; date: string; stops: Stop[]; details?: PlanDetails }, now = Date.now()): PlanHandoff | null {
  if (!safeText(input.ownerId, 140) || !safeText(input.title, 100) || !validDay(input.date) || !Array.isArray(input.stops) || input.stops.length < 1 || input.stops.length > 6) return null;
  const stops = cleanStops(input.stops);
  if (stops.length !== input.stops.length || stops.some(stop => stop.kind === 'event' && !eventOccursOn(eventFor(stop.id)!, input.date))) return null;
  // The group meets at its first stop, after travel and any wait for opening.
  // A conflicted or invalid schedule needs an explicit time in the outing form.
  const first = input.details ? buildItinerary(stops, input.details, input.date, todayInBay(new Date(now))).rows[0] : undefined;
  const meetingTime = first && !first.conflicts.length && Number.isInteger(first.start) && first.start >= 0 && first.start < 1440 ? clockLabel(first.start) : '';
  return { source: 'baylink-plan-outing', version: 1, ownerId: input.ownerId, createdAt: now, title: input.title.trim(), date: input.date, stops,
    startTime: meetingTime, partySize: Number.isInteger(input.details?.partySize) ? Math.min(8, Math.max(2, input.details!.partySize)) : 4,
    travelMode: ['drive', 'walk', 'transit', 'any'].includes(input.details?.travelMode || '') ? input.details!.travelMode : 'any' };
}

export function readOutingPlanHandoff(value: unknown, ownerId: string | undefined, now = Date.now()): OutingDraft | null {
  if (!ownerId || !record(value) || value.source !== 'baylink-plan-outing' || value.version !== 1 || value.ownerId !== ownerId
    || Object.keys(value).some(key => !['source', 'version', 'ownerId', 'createdAt', 'title', 'date', 'stops', 'startTime', 'partySize', 'travelMode'].includes(key))
    || typeof value.createdAt !== 'number' || !Number.isFinite(value.createdAt) || value.createdAt > now || now - value.createdAt > TTL
    || !safeText(value.title, 100) || typeof value.date !== 'string' || !validDay(value.date) || !(value.startTime === '' || clock(value.startTime))
    || !Number.isInteger(value.partySize) || Number(value.partySize) < 2 || Number(value.partySize) > 8 || !['drive', 'walk', 'transit', 'any'].includes(String(value.travelMode))
    || !Array.isArray(value.stops) || value.stops.length < 1 || value.stops.length > 6
    || value.stops.some(stop => !record(stop) || Object.keys(stop).length !== 2 || !['event', 'place'].includes(String(stop.kind)) || !safeText(stop.id, 140))) return null;
  const stops = cleanStops(value.stops);
  if (stops.length !== value.stops.length || stops.some(stop => stop.kind === 'event' && !eventOccursOn(eventFor(stop.id)!, value.date as string))) return null;
  const first = stops[0], fact = first.kind === 'event' ? eventFor(first.id)! : placeFor(first.id)!;
  const title = stops.map(stop => (stop.kind === 'event' ? eventFor(stop.id) : placeFor(stop.id))!.title);
  return { title: value.title, description: `计划草稿：${title.join(' → ')}。具体路线、开放时间与报名要求请在出发前共同核对。`, eventId: first.kind === 'event' ? first.id : null,
    date: value.date, startTime: value.startTime as string, endTime: '', city: fact.city, venue: first.kind === 'event' ? eventFor(first.id)!.venue : placeFor(first.id)!.address || fact.title,
    capacity: Number(value.partySize), costNote: '交通、餐饮和门票各自支付；费用及报名要求待核实，加入小队不等于购票或预约。',
    transport: value.travelMode === 'walk' || value.travelMode === 'transit' ? value.travelMode : 'own', language: 'any',
    cover: first.kind === 'event' ? { kind: 'event', id: first.id } : { kind: 'guide', id: placeFor(first.id)!.guideSlug } };
}
