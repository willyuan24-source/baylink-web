import { PLANNER_EVENTS, PLANNER_PLACES } from '../data/planner-catalog';
import { distanceKm, favoriteKey, stopTitle, validDay, type GeoPoint, type PlanDetails, type PlanFilters, type PlannerPlace, type PlanningFacts, type Stop, type StopSetting } from './planner';
import { canonicalEventId } from './event-id';
import { eventOccursOn } from './event-calendar';
import { getBayAreaToday } from './monthly';
import { resolveStopTiming, resolveTimeEvidence, timeEvidenceLabel, timeNotice, type TimeEvidence, type TimeNotice } from './planner-hours';

// Compare merged references without rewriting stored stop IDs or their settings.
export const stopKey = (stop: Stop) => favoriteKey(stop);
export const defaultPlanDetails = (): PlanDetails => ({ startTime: '10:00', finishBy: '18:00', partySize: 1, totalBudgetUsd: null, extraCostUsd: 0, travelMode: 'any', stopSettings: [] });
export const validClock = (value: unknown): value is string => typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
const minutes = (clock: string) => Number(clock.slice(0, 2)) * 60 + Number(clock.slice(3));
export const clockLabel = (value: number) => `${value >= 1440 ? '+1天 ' : ''}${String(Math.floor(value / 60) % 24).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
const bounded = (value: unknown, min: number, max: number, fallback: number, integer = false) => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max && (!integer || Number.isInteger(value)) ? value : fallback;
/** Round each allowance before summing; a rounded total must match the saved components. */
export const roundPlanMoney = (value: number) => Math.round((value + Number.EPSILON * Math.max(1, Math.abs(value))) * 100) / 100;

export function planDetailsError(details: PlanDetails): string | null {
  if (!validClock(details.startTime) || !validClock(details.finishBy) || details.finishBy <= details.startTime) return '结束时间必须晚于开始时间；目前只支持当天行程。';
  if (!Number.isInteger(details.partySize) || details.partySize < 1 || details.partySize > 50) return '同行人数需要是 1–50 人。';
  if (![details.extraCostUsd, ...(details.totalBudgetUsd == null ? [] : [details.totalBudgetUsd])].every(value => Number.isFinite(value) && value >= 0 && value <= 100000)) return '预算与费用需要是 0–100000 美元。';
  if (details.costBreakdown && (![details.costBreakdown.foodUsd, details.costBreakdown.transportUsd, details.costBreakdown.otherUsd].every(value => Number.isFinite(value) && value >= 0 && value <= 100000) || Math.abs(details.costBreakdown.foodUsd + details.costBreakdown.transportUsd + details.costBreakdown.otherUsd - details.extraCostUsd) > 0.0000001)) return '餐饮、交通与其他费用需为非负金额，合计须与额外费用一致。';
  if (details.stopSettings.some(item => !Number.isInteger(item.durationMinutes) || item.durationMinutes < 5 || item.durationMinutes > 720 || !Number.isInteger(item.travelMinutes) || item.travelMinutes < 0 || item.travelMinutes > 360 || (item.fixedStartTime != null && !validClock(item.fixedStartTime)) || (item.breakBeforeMinutes !== undefined && (!Number.isInteger(item.breakBeforeMinutes) || item.breakBeforeMinutes < 0 || item.breakBeforeMinutes > 180)) || (item.breakLabel !== undefined && !['meal', 'rest'].includes(item.breakLabel)))) return '每站停留需为 5–720 整数分钟，交通预留需为 0–360 整数分钟，餐休预留需为 0–180 整数分钟。';
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
    return entry ? [{ ...stop, durationMinutes: bounded(entry.durationMinutes, 5, 720, 90, true), travelMinutes: bounded(entry.travelMinutes, 0, 360, 30, true), ...(validClock(entry.fixedStartTime) ? { fixedStartTime: entry.fixedStartTime } : {}), ...(entry.breakBeforeMinutes !== undefined ? { breakBeforeMinutes: bounded(entry.breakBeforeMinutes, 0, 180, 0, true) } : {}), ...(['meal', 'rest'].includes(entry.breakLabel || '') ? { breakLabel: entry.breakLabel } : {}) }] : [];
  });
  const legacyExtra = bounded(raw.extraCostUsd, 0, 100000, 0);
  let costBreakdown: PlanDetails['costBreakdown'];
  if (raw.costBreakdown && typeof raw.costBreakdown === 'object') {
    costBreakdown = { foodUsd: roundPlanMoney(bounded(raw.costBreakdown.foodUsd, 0, 100000, 0)), transportUsd: roundPlanMoney(bounded(raw.costBreakdown.transportUsd, 0, 100000, 0)), otherUsd: roundPlanMoney(bounded(raw.costBreakdown.otherUsd, 0, 100000, 0)) };
    if (costBreakdown.foodUsd + costBreakdown.transportUsd + costBreakdown.otherUsd > 100000) costBreakdown = { foodUsd: 0, transportUsd: 0, otherUsd: roundPlanMoney(legacyExtra) };
  }
  return { startTime, finishBy, partySize: bounded(raw.partySize, 1, 50, 1, true), totalBudgetUsd: raw.totalBudgetUsd == null ? null : bounded(raw.totalBudgetUsd, 0, 100000, 0), extraCostUsd: costBreakdown ? Math.round((costBreakdown.foodUsd + costBreakdown.transportUsd + costBreakdown.otherUsd) * 100) / 100 : legacyExtra, ...(costBreakdown ? { costBreakdown } : {}), travelMode: ['any', 'drive', 'transit', 'walk'].includes(raw.travelMode || '') ? raw.travelMode! : 'any', stopSettings, ...(raw.constraints && typeof raw.constraints === 'object' ? { constraints: cleanPlanFilters(raw.constraints) } : {}) };
}
export const settingForStop = (details: PlanDetails, stop: Stop, index: number): StopSetting => details.stopSettings.find(item => stopKey(item) === stopKey(stop)) || { ...stop, durationMinutes: 90, travelMinutes: index === 0 ? 0 : 30 };
export const factsForStop = (stop: Stop) => stop.kind === 'event' ? PLANNER_EVENTS.find(item => item.id === canonicalEventId(stop.id)) : PLANNER_PLACES.find(item => item.id === stop.id);
export const timeEvidence = (stop: Stop, date: string, asOf?: string) => resolveTimeEvidence(factsForStop(stop)?.planning?.schedule, date, asOf);
export const planCostBreakdown = (details: PlanDetails) => details.costBreakdown || { foodUsd: 0, transportUsd: 0, otherUsd: details.extraCostUsd };
/** Only an explicit finite admission amount can establish a known price or free entry. */
export const knownAdmissionUsd = (fact: { planning?: PlanningFacts } | undefined): number | null => {
  const price = fact?.planning?.admissionUsd;
  return typeof price === 'number' && Number.isFinite(price) && price >= 0 ? price : null;
};

export type ItineraryRow = {
  stop: Stop; settings: StopSetting; arrival: number; start: number; end: number; wait: number; late: boolean; lateByMinutes: number;
  breakMinutes: number; breakStart: number; evidence: TimeEvidence; notices: TimeNotice[]; conflicts: TimeNotice[];
};

export function buildItinerary(stops: Stop[], details: PlanDetails, date: string, asOf?: string) {
  const invalid = planDetailsError(details);
  if (invalid) {
    const issue = timeNotice('invalid-plan-input', invalid, 'Check the start/end times, numeric allowances and cost breakdown before continuing.');
    const rows: ItineraryRow[] = stops.map((stop, index) => ({ stop, settings: settingForStop(details, stop, index), arrival: NaN, start: NaN, end: NaN, wait: 0, late: false, lateByMinutes: 0, breakStart: NaN, breakMinutes: 0, evidence: timeEvidence(stop, date, asOf), notices: [], conflicts: [issue] }));
    return { rows, issues: [invalid], issueDetails: [issue], notices: [] as string[], end: 0, duration: 0 };
  }
  let cursor = minutes(details.startTime);
  const issueDetails: TimeNotice[] = [];
  if (stops.length && !validDay(date)) issueDetails.push(timeNotice('invalid-date', '请选择有效行程日期。', 'Choose a valid outing date.'));
  const rows: ItineraryRow[] = stops.map((stop, index) => {
    const settings = settingForStop(details, stop, index);
    const breakStart = cursor;
    const breakMinutes = settings.breakBeforeMinutes || 0;
    const arrival = cursor + breakMinutes + settings.travelMinutes;
    const evidence = timeEvidence(stop, date, asOf);
    const timing = resolveStopTiming(evidence, arrival, settings.durationMinutes, settings.fixedStartTime);
    const event = stop.kind === 'event' ? PLANNER_EVENTS.find(item => item.id === canonicalEventId(stop.id)) : undefined;
    if (event && validDay(date) && !eventOccursOn(event, date)) timing.conflicts.push(timeNotice('event-date-mismatch', '所选日期没有收录的活动场次。', 'No recorded event session falls on the selected date.'));
    if (factsForStop(stop)?.planning?.reservation === 'required') timing.notices.push(timeNotice('reservation-required', '此站需预约或购票，尚未确认你的预约与余票。', 'This stop requires a reservation or ticket; your booking and availability are not confirmed.'));
    issueDetails.push(...timing.conflicts.map(issue => ({ ...issue, zh: `${stopTitle(stop)}：${issue.zh}`, en: `${stopTitle(stop)}: ${issue.en}` })));
    // A missed official session stays at its published time, but must not move later stops backwards.
    cursor = Math.max(arrival, timing.start) + settings.durationMinutes;
    return { stop, settings, arrival, ...timing, breakStart, breakMinutes, evidence };
  });
  if (stops.length && cursor > minutes(details.finishBy)) issueDetails.push(timeNotice('finish-overrun', `计划超过结束时间 ${cursor - minutes(details.finishBy)} 分钟，请缩短停留、减少站点或延后结束。`, `The plan exceeds your finish time by ${cursor - minutes(details.finishBy)} minutes; shorten a stay, remove a stop or finish later.`));
  if (cursor >= 1440) issueDetails.push(timeNotice('next-day', '计划跨到第二天，请调整后再导出日历。', 'The plan crosses into the next day; adjust it before calendar export.'));
  return { rows, issues: issueDetails.map(issue => issue.zh), issueDetails, notices: rows.flatMap(row => row.notices.map(notice => `${stopTitle(row.stop)}：${notice.zh}`)), end: cursor, duration: cursor - minutes(details.startTime) };
}

/** Published admission is a starting price, never a quote or an all-in total. */
export function planBudget(stops: Stop[], details: PlanDetails, lookup: (stop: Stop) => { planning?: PlanningFacts } | undefined = factsForStop) {
  let admissionPerPerson = 0;
  const unknown: Stop[] = [];
  for (const stop of stops) {
    const price = knownAdmissionUsd(lookup(stop));
    if (price !== null) admissionPerPerson += price;
    else unknown.push(stop);
  }
  admissionPerPerson = roundPlanMoney(admissionPerPerson);
  const admissionFloor = roundPlanMoney(admissionPerPerson * details.partySize);
  const breakdown = planCostBreakdown(details);
  const extraCostUsd = roundPlanMoney(breakdown.foodUsd + breakdown.transportUsd + breakdown.otherUsd);
  const subtotal = roundPlanMoney(admissionFloor + extraCostUsd);
  // Search constraints cap admission only. The editor's trip budget separately
  // includes food, transport and other allowances, without pricing unknown stops.
  const filters = details.constraints;
  const admissionCost = filters?.budgetScope === 'total' ? admissionFloor : admissionPerPerson;
  const admissionOverBy = filters?.budget == null ? 0 : Math.max(0, roundPlanMoney(admissionCost - filters.budget));
  return { admissionFloor, admissionPerPerson, admissionOverBy, subtotal, unknown, breakdown, extraCostUsd, overBy: details.totalBudgetUsd == null ? 0 : Math.max(0, roundPlanMoney(subtotal - details.totalBudgetUsd)) };
}

export function placeMatchesFilters(place: PlannerPlace, filters: PlanFilters): boolean {
  if (filters.region && filters.region !== 'all' && place.region !== filters.region) return false;
  if (filters.city && place.city.toLowerCase() !== filters.city.toLowerCase()) return false;
  if (filters.setting && filters.setting !== 'any' && place.planning?.setting !== filters.setting) return false;
  const price = knownAdmissionUsd(place);
  if (filters.freeOnly && price !== 0) return false;
  if (filters.budget != null) {
    const minimumPartySize = filters.partySize || Math.max(1, filters.childAges?.length || 0);
    const cap = filters.budgetScope === 'total' ? filters.budget / minimumPartySize : filters.budget;
    // Missing prices remain explicitly unpriced candidates, not proof of a fit.
    if (price !== null && price > cap) return false;
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
  const itinerary = buildItinerary(stops, details, date, getBayAreaToday(now));
  if (!validDay(date) || !stops.length || itinerary.issues.length) throw new Error('请先解决时间与日期冲突，再导出日历。');
  const stamp = now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const local = (minute: number) => `${date.replace(/-/g, '')}T${clockLabel(minute).replace(':', '')}00`;
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//BAYLINK//Outing plan//ZH', 'CALSCALE:GREGORIAN', 'BEGIN:VTIMEZONE', 'TZID:America/Los_Angeles', 'BEGIN:DAYLIGHT', 'DTSTART:20070311T020000', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU', 'TZOFFSETFROM:-0800', 'TZOFFSETTO:-0700', 'END:DAYLIGHT', 'BEGIN:STANDARD', 'DTSTART:20071104T020000', 'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU', 'TZOFFSETFROM:-0700', 'TZOFFSETTO:-0800', 'END:STANDARD', 'END:VTIMEZONE'];
  for (const { stop, start, end, breakStart, breakMinutes, settings, evidence, notices } of itinerary.rows) {
    const fact = factsForStop(stop);
    if (breakMinutes > 0) lines.push('BEGIN:VEVENT', `UID:${date}-${stop.kind}-${stop.id}-break@baylink.us`, `DTSTAMP:${stamp}`, `DTSTART;TZID=America/Los_Angeles:${local(breakStart)}`, `DTEND;TZID=America/Los_Angeles:${local(breakStart + breakMinutes)}`, `SUMMARY:${escapeIcs(settings.breakLabel === 'meal' ? '预留餐饮时间' : '预留休息时间')}`, 'DESCRIPTION:用户自行预留；不代表餐厅预订。', 'STATUS:TENTATIVE', 'END:VEVENT');
    const evidenceText = `${timeEvidenceLabel(evidence)}${fact?.planning?.programTimeUnconfirmed ? '\n主节目场次未确认；这里只核对场地开放时段。' : ''}${evidence.note ? `\n官方时间说明：${evidence.note}` : ''}${evidence.verifiedAt ? `\n时间资料核对日期：${evidence.verifiedAt}` : ''}\n${notices.map(notice => notice.zh).join('\n')}`;
    lines.push('BEGIN:VEVENT', `UID:${date}-${stop.kind}-${stop.id}@baylink.us`, `DTSTAMP:${stamp}`, `DTSTART;TZID=America/Los_Angeles:${local(start)}`, `DTEND;TZID=America/Los_Angeles:${local(end)}`, `SUMMARY:${escapeIcs(`计划 · ${stopTitle(stop)}`)}`, `DESCRIPTION:${escapeIcs(`${title}\n这是计划，不代表预约或营业保证。交通时间为自行预留，未查询实际路程。\n${evidenceText}\n${evidence.sourceUrl || fact?.officialUrl || ''}`)}`, `LOCATION:${escapeIcs(fact?.city || '')}`, 'STATUS:TENTATIVE', 'END:VEVENT');
  }
  lines.push('END:VCALENDAR'); return lines.map(foldIcs).join('\r\n') + '\r\n';
}
