import { factsForStop } from './planner-itinerary';
import { stopTitle, type PlanDetails, type Stop } from './planner';
import { canonicalEventId } from './event-id';

export type PlannerTravelEstimate = { ok: true; provider: 'google-maps'; from: Stop; to: Stop; travelMode: PlanDetails['travelMode']; durationMinutes: number; distanceMeters: number; warnings: string[]; departureAt: string; checkedAt: string };
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const matchesStop = (value: unknown, expected: Stop) => record(value) && value.kind === expected.kind && typeof value.id === 'string'
  && (expected.kind === 'event' ? canonicalEventId(value.id) === canonicalEventId(expected.id) : value.id === expected.id);
const pacific = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
export function isPlannerTravelEstimate(value: unknown, expected: { from: Stop; to: Stop; date: string; time: string; mode: PlanDetails['travelMode'] }): value is PlannerTravelEstimate {
  if (!record(value) || value.ok !== true || value.provider !== 'google-maps' || value.travelMode !== expected.mode
    || !matchesStop(value.from, expected.from)
    || !matchesStop(value.to, expected.to)
    || !Number.isInteger(value.durationMinutes) || Number(value.durationMinutes) < 1 || Number(value.durationMinutes) > 1440
    || typeof value.distanceMeters !== 'number' || !Number.isFinite(value.distanceMeters) || value.distanceMeters < 0 || value.distanceMeters > 1000000
    || !Array.isArray(value.warnings) || value.warnings.length > 5 || value.warnings.some(warning => typeof warning !== 'string' || warning.length > 1500)
    || typeof value.departureAt !== 'string' || !Number.isFinite(Date.parse(value.departureAt)) || typeof value.checkedAt !== 'string' || !Number.isFinite(Date.parse(value.checkedAt))) return false;
  const instant = new Date(value.departureAt);
  if (instant.toISOString() !== value.departureAt || instant.getUTCSeconds() !== 0 || instant.getUTCMilliseconds() !== 0) return false;
  const parts = Object.fromEntries(pacific.formatToParts(instant).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}` === expected.date && `${parts.hour}:${parts.minute}` === expected.time;
}
export function plannerLegMapUrl(from: Stop, to: Stop, mode: PlanDetails['travelMode']) {
  const point = (stop: Stop) => {
    const row = factsForStop(stop), location = row?.location;
    return location?.precision === 'venue' ? `${location.lat},${location.lng}` : `${row?.title || stopTitle(stop)}, ${row?.city || 'Bay Area'}, California`;
  };
  const url = new URL('https://www.google.com/maps/dir/');
  url.search = new URLSearchParams({ api: '1', origin: point(from), destination: point(to), ...(mode !== 'any' ? { travelmode: { drive: 'driving', walk: 'walking', transit: 'transit' }[mode] } : {}) }).toString();
  return url.href;
}
