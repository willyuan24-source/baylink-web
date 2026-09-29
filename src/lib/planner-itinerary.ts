import { PLANNER_EVENTS, PLANNER_PLACES } from '../data/planner-catalog';
import { distanceKm, stopTitle, validDay, type GeoPoint, type PlanDetails, type PlanFilters, type PlannerPlace, type Stop, type StopSetting } from './planner';
import { eventOccursOn } from './event-calendar';

export const stopKey = (stop: Stop) => `${stop.kind}:${stop.id}`;
export const defaultPlanDetails = (): PlanDetails => ({ startTime: '10:00', finishBy: '18:00', partySize: 1, totalBudgetUsd: null, extraCostUsd: 0, travelMode: 'any', stopSettings: [] });
export const validClock = (value: unknown): value is string => typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
const minutes = (clock: string) => Number(clock.slice(0, 2)) * 60 + Number(clock.slice(3));
export const clockLabel = (value: number) => `${value >= 1440 ? '+1天 ' : ''}${String(Math.floor(value / 60) % 24).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
const bounded = (value: unknown, min: number, max: number, fallback: number, integer = false) => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max && (!integer || Number.isInteger(value)) ? value : fallback;

export function planDetailsError(details: PlanDetails): string | null {
  if (!validClock(details.startTime) || !validClock(details.finishBy) || details.finishBy <= details.startTime) return '结束时间必须晚于开始时间；目前只支持当天行程。';
  if (!Number.isInteger(details.partySize) || details.partySize < 1 || details.partySize > 50) return '同行人数需要是 1–50 人。';
  if (![details.extraCostUsd, ...(details.totalBudgetUsd == null ? [] : [details.totalBudgetUsd])].every(value => Number.isFinite(value) && value >= 0 && value <= 100000)) return '预算与费用需要是 0–100000 美元。';
  if (details.stopSettings.some(item => !Number.isInteger(item.durationMinutes) || item.durationMinutes < 5 || item.durationMinutes > 720 || !Number.isInteger(item.travelMinutes) || item.travelMinutes < 0 || item.travelMinutes > 360 || (item.fixedStartTime != null && !validClock(item.fixedStartTime)))) return '每站停留需为 5–720 整数分钟，交通预留需为 0–360 整数分钟。';
  return null;
}
export function cleanPlanFilters(input: unknown): PlanFilters {
  const raw = input && typeof input === 'object' ? input as PlanFilters : {};
  const result: PlanFilters = {};
  if (typeof raw.date === 'string' && validDay(raw.date)) result.date = raw.date;
  if (['all', 'sf', 'east-bay', 'south-bay', 'peninsula', 'north-bay'].includes(raw.region || '')) result.region = raw.region;
  if (typeof raw.city === 'string' && raw.city.trim().length > 0 && raw.city.length <= 80) result.city = raw.city.trim();
  if (raw.budget === null || (typeof raw.budget === 'number' && Number.isFinite(raw.budget) && raw.budget >= 0 && raw.budget <= 10000)) result.budget = raw.budget;
  if (raw.childAge === null || (Number.isInteger(raw.childAge) && raw.childAge! >= 0 && raw.childAge! <= 17)) result.childAge = raw.childAge;
  if (Array.isArray(raw.childAges) && raw.childAges.length <= 10 && raw.childAges.every(value => Number.isInteger(value) && value >= 0 && value <= 17)) result.childAges = raw.childAges;
  if (Number.isInteger(raw.partySize) && raw.partySize! >= 1 && raw.partySize! <= 50) result.partySize = raw.partySize;
  if (['person', 'total'].includes(raw.budgetScope || '')) result.budgetScope = raw.budgetScope;
  if (typeof raw.freeOnly === 'boolean') result.freeOnly = raw.freeOnly;
  if (['any', 'comedy', 'music', 'sports', 'arts', 'food', 'community', 'technology'].includes(raw.topic || '')) result.topic = raw.topic;
  if (['any', 'indoor', 'outdoor', 'mixed'].includes(raw.setting || '')) result.setting = raw.setting;
  if (['any', 'drive', 'transit', 'walk'].includes(raw.travelMode || '')) result.travelMode = raw.travelMode;
  return result;
}

/** Treat browser data as untrusted; remove stale stop settings without changing public references. */
export function normalizePlanDetails(input: unknown, stops: Stop[]): PlanDetails {
  const raw = input && typeof input === 'object' ? input as Partial<PlanDetails> : {};
  const defaults = defaultPlanDetails();
  const startTime = validClock(raw.startTime) ? raw.startTime : defaults.startTime;
  const finishBy = validClock(raw.finishBy) ? raw.finishBy : defaults.finishBy;
  const stopSettings: StopSetting[] = stops.flatMap(stop => {
    const entry = Array.isArray(raw.stopSettings) ? raw.stopSettings.find(s => s && stopKey(s) === stopKey(stop)) : undefined;
    return entry ? [{ ...stop, durationMinutes: bounded(entry.durationMinutes, 5, 720, 90, true), travelMinutes: bounded(entry.travelMinutes, 0, 360, 30, true), ...(validClock(entry.fixedStartTime) ? { fixedStartTime: entry.fixedStartTime } : {}) }] : [];
  });
  return { startTime, finishBy, partySize: bounded(raw.partySize, 1, 50, 1, true), totalBudgetUsd: raw.totalBudgetUsd == null ? null : bounded(raw.totalBudgetUsd, 0, 100000, 0), extraCostUsd: bounded(raw.extraCostUsd, 0, 100000, 0), travelMode: ['any', 'drive', 'transit', 'walk'].includes(raw.travelMode || '') ? raw.travelMode! : 'any', stopSettings, ...(raw.constraints && typeof raw.constraints === 'object' ? { constraints: cleanPlanFilters(raw.constraints) } : {}) };
}
export const settingForStop = (details: PlanDetails, stop: Stop, index: number): StopSetting => details.stopSettings.find(item => stopKey(item) === stopKey(stop)) || { ...stop, durationMinutes: 90, travelMinutes: index === 0 ? 0 : 30 };
export const factsForStop = (stop: Stop) => stop.kind === 'event' ? PLANNER_EVENTS.find(item => item.id === stop.id) : PLANNER_PLACES.find(item => item.id === stop.id);

export function buildItinerary(stops: Stop[], details: PlanDetails, date: string) {
  const invalid = planDetailsError(details);
  if (invalid) return { rows: stops.map((stop, index) => ({ stop, settings: settingForStop(details, stop, index), arrival: NaN, start: NaN, end: NaN, wait: 0, late: false })), issues: [invalid], end: 0, duration: 0 };
  let cursor = minutes(details.startTime);
  const issues: string[] = [];
  if (minutes(details.finishBy) <= cursor) issues.push('结束时间必须晚于开始时间；目前只支持当天行程。');
  const rows = stops.map((stop, index) => {
    const settings = settingForStop(details, stop, index);
    const arrival = cursor + settings.travelMinutes;
    const fixed = settings.fixedStartTime ? minutes(settings.fixedStartTime) : null;
    const late = fixed != null && arrival > fixed;
    const start = Math.max(arrival, fixed ?? arrival);
    const end = start + settings.durationMinutes;
    const event = stop.kind === 'event' ? PLANNER_EVENTS.find(item => item.id === stop.id) : undefined;
    if (late) issues.push(`${stopTitle(stop)}：按当前预留时间，晚于你设置的开始时间 ${settings.fixedStartTime}。`);
    if (event && validDay(date) && !eventOccursOn(event, date)) issues.push(`${stopTitle(stop)}：所选日期没有收录的活动场次。`);
    cursor = end;
    return { stop, settings, arrival, start, end, wait: start - arrival, late };
  });
  if (stops.length && cursor > minutes(details.finishBy)) issues.push(`计划超过结束时间 ${cursor - minutes(details.finishBy)} 分钟，请缩短停留、减少站点或延后结束。`);
  if (cursor >= 1440) issues.push('计划跨到第二天，请调整后再导出日历。');
  return { rows, issues, end: cursor, duration: cursor - minutes(details.startTime) };
}

/** Published admission is a starting price, never a quote or an all-in total. */
export function planBudget(stops: Stop[], details: PlanDetails) {
  let admissionFloor = 0;
  const unknown: Stop[] = [];
  for (const stop of stops) {
    const price = factsForStop(stop)?.planning?.admissionUsd;
    if (typeof price === 'number' && Number.isFinite(price) && price >= 0) admissionFloor += price * details.partySize;
    else unknown.push(stop);
  }
  const subtotal = Math.round((admissionFloor + details.extraCostUsd) * 100) / 100;
  return { admissionFloor, subtotal, unknown, overBy: details.totalBudgetUsd == null ? 0 : Math.max(0, Math.round((subtotal - details.totalBudgetUsd) * 100) / 100) };
}

export function placeMatchesFilters(place: PlannerPlace, filters: PlanFilters): boolean {
  if (filters.region && filters.region !== 'all' && place.region !== filters.region) return false;
  if (filters.city && place.city.toLowerCase() !== filters.city.toLowerCase()) return false;
  if (filters.setting && filters.setting !== 'any' && place.planning?.setting !== filters.setting) return false;
  const price = place.planning?.admissionUsd;
  if (filters.freeOnly && price !== 0) return false;
  if (filters.budget != null) {
    const cap = filters.budgetScope === 'total' ? (filters.partySize ? filters.budget / filters.partySize : null) : filters.budget;
    if (cap != null && (typeof price !== 'number' || price > cap)) return false;
  }
  const ages = filters.childAges || (filters.childAge != null ? [filters.childAge] : []);
  if (ages.some(age => (place.planning?.minAge != null && age < place.planning.minAge) || (place.planning?.maxAge != null && age > place.planning.maxAge))) return false;
  return true;
}
export function nearbyPlaces(anchor: { location?: GeoPoint; city: string; id: string }, places: PlannerPlace[], filters: PlanFilters) {
  if (anchor.location?.precision !== 'venue') return [];
  const point = anchor.location;
  return places.filter(place => place.id !== anchor.id && place.city === anchor.city && place.location?.precision === 'venue' && placeMatchesFilters(place, filters))
    .map(place => ({ place, km: distanceKm(point, place.location!) }))
    .filter(item => Number.isFinite(item.km) && item.km <= (filters.travelMode === 'walk' ? 2 : 5)).sort((a, b) => a.km - b.km).slice(0, 3);
}

const escapeIcs = (value: string) => value.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');
const foldIcs = (line: string) => {
  const chunks: string[] = []; let chunk = ''; let size = 0;
  for (const char of line) { const bytes = new TextEncoder().encode(char).length; if (size + bytes > 73) { chunks.push(chunk); chunk = ' '; size = 1; } chunk += char; size += bytes; }
  chunks.push(chunk); return chunks.join('\r\n');
};
export function itineraryIcs(title: string, date: string, stops: Stop[], details: PlanDetails, now = new Date()): string {
  const itinerary = buildItinerary(stops, details, date);
  if (!validDay(date) || !stops.length || itinerary.issues.length) throw new Error('请先解决时间与日期冲突，再导出日历。');
  const stamp = now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const local = (minute: number) => `${date.replace(/-/g, '')}T${clockLabel(minute).replace(':', '')}00`;
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//BAYLINK//Outing plan//ZH', 'CALSCALE:GREGORIAN', 'BEGIN:VTIMEZONE', 'TZID:America/Los_Angeles', 'BEGIN:DAYLIGHT', 'DTSTART:20070311T020000', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU', 'TZOFFSETFROM:-0800', 'TZOFFSETTO:-0700', 'END:DAYLIGHT', 'BEGIN:STANDARD', 'DTSTART:20071104T020000', 'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU', 'TZOFFSETFROM:-0700', 'TZOFFSETTO:-0800', 'END:STANDARD', 'END:VTIMEZONE'];
  for (const { stop, start, end } of itinerary.rows) {
    const fact = factsForStop(stop);
    lines.push('BEGIN:VEVENT', `UID:${date}-${stop.kind}-${stop.id}@baylink.us`, `DTSTAMP:${stamp}`, `DTSTART;TZID=America/Los_Angeles:${local(start)}`, `DTEND;TZID=America/Los_Angeles:${local(end)}`, `SUMMARY:${escapeIcs(`计划 · ${stopTitle(stop)}`)}`, `DESCRIPTION:${escapeIcs(`${title}\n时间由你安排，未核实官方场次、营业时间或路程。出发前请确认。\n${fact?.officialUrl || ''}`)}`, `LOCATION:${escapeIcs(fact?.city || '')}`, 'STATUS:TENTATIVE', 'END:VEVENT');
  }
  lines.push('END:VCALENDAR'); return lines.map(foldIcs).join('\r\n') + '\r\n';
}
