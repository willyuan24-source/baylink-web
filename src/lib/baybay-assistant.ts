import { plannerWebCheckedDate, safePlannerWebUrl, validPlannerWebDate, type PlannerWebResult } from './planner-web-search';
import { cleanStops, eventFor, sharePlanUrl } from './planner';
import { eventOccursOn } from './event-calendar';
import { guides } from '../data/guides';

export type BayBayTaskState = {
  version: 1; revision: number; goal?: string | null; city?: string | null; region?: string | null; date?: string | null;
  origin?: string | null; travelMode?: 'any' | 'drive' | 'transit' | 'walk' | null; partySize?: number | null;
  childAges?: number[]; budget?: number | null; budgetScope?: 'person' | 'total' | null; freeOnly?: boolean;
  setting?: 'any' | 'indoor' | 'outdoor' | 'mixed' | null; startTime?: string | null; finishBy?: string | null; excludedCities?: string[];
  returnToOrigin?: boolean; maxStops?: number;
};
export type BayBayEvidence = { id: string; title: string; url: string; kind: 'guide' | 'event' | 'place' | 'web'; checkedAt?: string; verification?: 'catalog' | 'page-read' | 'api' | 'search-result'; text?: string };
export type BayBayPlanStop = {
  id: string; kind: string; entityId?: string; title: string; city?: string; date?: string; startTime?: string; endTime?: string;
  durationMinutes?: number; travelMinutes?: number; timeStatus?: string; admissionUsd?: number; sourceIds: string[]; notes: string[];
  admissionFacts?: BayBayAdmissionFacts;
};
export type BayBayAdmissionFacts = {
  status: 'complete' | 'partial' | 'unknown'; basis: 'catalog-snapshot' | 'page-read' | 'catalog'; knownTotalUsd?: number;
  breakdown: { category: 'adult' | 'child' | 'all-ages' | 'group'; quantity: number; unitUsd: number; subtotalUsd: number; age?: number }[];
  sourceUrl?: string; sourceIds: string[]; checkedAt?: string;
  applicability: { date?: string; dateStatus: 'date-specific' | 'regular-unconfirmed' | 'out-of-range' | 'unconfirmed'; feesIncluded?: boolean };
  unknowns: string[];
};
export type BayBayAnswerCoverage = { status: 'complete' | 'partial' | 'unassessed'; items: { id: string; label: string; status: 'answered' | 'unknown' | 'needs_user_input'; summary?: string; sourceIds: string[] }[] };
export type BayBayPlanTravelLeg = { from: string; to: string; durationMinutes: number; provider: 'google-maps'; status: 'estimate' };
export type BayBayAssistantPlan = {
  id: string; date?: string; title: string; status: 'ready' | 'needs_verification' | 'needs_details'; stops: BayBayPlanStop[];
  budget: { knownTotalUsd?: number; unknownItems: string[]; limitUsd?: number; scope?: 'person' | 'total' };
  checks: { code: string; status: 'pass' | 'unknown' | 'fail'; message: string }[]; unknowns: string[]; summary?: string;
  travelLegs?: BayBayPlanTravelLeg[]; returnTime?: string;
};
export type BayBayAssistantFields = {
  assistantSessionToken?: string; taskState?: BayBayTaskState; assistantPlan?: BayBayAssistantPlan; evidence?: BayBayEvidence[];
  followups?: string[];
  answerCoverage?: BayBayAnswerCoverage;
  research?: { steps: { tool: string; status: string; label: string; code?: string }[]; warnings: string[]; timings?: Partial<Record<'siteMs' | 'searchMs' | 'readMs' | 'modelMs' | 'finalMs' | 'routeMs' | 'stateMs' | 'monitorMs' | 'quotaMs' | 'weatherMs' | 'planMs' | 'otherMs' | 'totalMs', number>> };
};
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const guidePaths = new Set(guides.map(guide => `/guides/${guide.slug}`));
const text = (v: unknown, max = 500): string | undefined => typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined;
const number = (v: unknown, max = 1_000_000): number | undefined => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max ? v : undefined;
const travelMinutes = (v: unknown): number | undefined => Number.isInteger(v) ? number(v, 720) : undefined;
const clock = (v: unknown): string | undefined => typeof v === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : undefined;
const strings = (v: unknown, max = 20, length = 600): string[] => Array.isArray(v) ? v.slice(0, max).flatMap(item => text(item, length) || []) : [];
const option = <const T extends string>(v: unknown, options: readonly T[]): T | undefined => options.includes(v as T) ? v as T : undefined;

/** Keep eligibility qualifications intact; oversized summaries end at a full sentence, never mid-condition. */
function coverageSummary(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return;
  const summary = value.trim();
  if (summary.length <= 1600) return summary;
  let boundary = 0;
  // Match against the original text so cutting at a decimal point cannot manufacture a sentence end.
  for (const match of summary.matchAll(/[。！？](?:[”’」』）)\]]*)|[.!?](?:["'”’)\]]*)(?=\s|$)/g)) {
    const end = match.index + match[0].length;
    if (end > 1599) break;
    boundary = end;
  }
  return boundary ? `${summary.slice(0, boundary).trim()}…` : undefined;
}

/** Opaque server state stays in memory. Do not decode it or accept whitespace/control characters. */
export const safeAssistantSessionToken = (value: unknown): string | undefined => typeof value === 'string' && value.length > 0 && value.length <= 16384 && /^[A-Za-z0-9._~-]+$/.test(value) ? value : undefined;
const safeEvidenceUrl = (value: unknown) => typeof value === 'string' && guidePaths.has(value) ? value : safePlannerWebUrl(value);
// Keep the offset so display can use Bay Area time instead of slicing the UTC day.
const evidenceCheckedAt = (value: unknown): string | undefined => typeof value === 'string' &&
  (validPlannerWebDate(value) || /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(value) && plannerWebCheckedDate(value)) ? value : undefined;

function admissionFacts(input: unknown, ids: Set<string>): BayBayAdmissionFacts | undefined {
  if (!record(input)) return;
  const status = option(input.status, ['complete', 'partial', 'unknown']), basis = option(input.basis, ['catalog-snapshot', 'page-read', 'catalog']);
  const sourceIds = strings(input.sourceIds, 10, 160).filter(id => ids.has(id));
  if (!status || !basis || !sourceIds.length || !record(input.applicability)) return;
  const breakdown: BayBayAdmissionFacts['breakdown'] = [];
  if (Array.isArray(input.breakdown)) for (const row of input.breakdown.slice(0, 20)) {
    if (!record(row)) return;
    const category = option(row.category, ['adult', 'child', 'all-ages', 'group']), quantity = number(row.quantity, 100), unitUsd = number(row.unitUsd), subtotalUsd = number(row.subtotalUsd);
    if (!category || !quantity || !Number.isInteger(quantity) || unitUsd === undefined || subtotalUsd === undefined || Math.abs(Math.round(quantity * unitUsd * 100) / 100 - subtotalUsd) > .011) return;
    breakdown.push({ category, quantity, unitUsd, subtotalUsd, ...(Number.isInteger(row.age) && number(row.age, 17) !== undefined ? { age: Number(row.age) } : {}) });
  }
  const knownTotalUsd = number(input.knownTotalUsd);
  if (knownTotalUsd !== undefined && breakdown.length && Math.abs(breakdown.reduce((sum, row) => sum + row.subtotalUsd, 0) - knownTotalUsd) > .011) return;
  return { status, basis, knownTotalUsd, breakdown, sourceIds, sourceUrl: safePlannerWebUrl(input.sourceUrl) || undefined, checkedAt: evidenceCheckedAt(input.checkedAt),
    applicability: { date: validPlannerWebDate(input.applicability.date) || undefined, dateStatus: option(input.applicability.dateStatus, ['date-specific', 'regular-unconfirmed', 'out-of-range', 'unconfirmed']) || 'unconfirmed', feesIncluded: typeof input.applicability.feesIncluded === 'boolean' ? input.applicability.feesIncluded : undefined }, unknowns: strings(input.unknowns) };
}

/** Citation ordinals belong to response.sources, not the larger evidence collection. */
export function bayBayAssistantResult(input: unknown): PlannerWebResult | null {
  if (!record(input) || input.responseMode !== 'assistant' || !text(input.answer, 30_000) || !Array.isArray(input.sources) || !Array.isArray(input.evidence)) return null;
  const evidence = new Set(input.evidence.flatMap(item => record(item) ? safeEvidenceUrl(item.url) || [] : []));
  const sources = input.sources.slice(0, 60).flatMap((item, index) => {
    if (!record(item)) return [];
    const url = safeEvidenceUrl(item.url), title = text(item.title);
    return url && title && evidence.has(url) ? [{ number: index + 1, title, url }] : [];
  });
  return sources.length ? { answer: text(input.answer, 30_000)!, sources, candidates: [], checkedAt: null, cached: false } : null;
}

/** Optional v2 payloads cannot bypass existing response, URL or bounded-render checks. */
export function parseBayBayAssistantFields(input: unknown): BayBayAssistantFields {
  if (!record(input)) return {};
  const result: BayBayAssistantFields = { assistantSessionToken: safeAssistantSessionToken(input.assistantSessionToken) };
  if (Array.isArray(input.followups)) result.followups = [...new Set(input.followups.filter((item): item is string =>
    typeof item === 'string' && item.trim().length >= 4 && item.trim().length <= 160 && [...item].every(char => char.charCodeAt(0) >= 32 && char.charCodeAt(0) !== 127)).map(item => item.trim()))].slice(0, 3);
  const value = input.taskState;
  if (record(value) && value.version === 1 && Number.isSafeInteger(value.revision) && Number(value.revision) >= 0) {
    const state: BayBayTaskState = { version: 1, revision: Number(value.revision) };
    for (const key of ['city', 'region', 'origin'] as const) if (value[key] === null || text(value[key], 120)) state[key] = value[key] === null ? null : text(value[key], 120);
    const goal = option(value.goal, ['day-plan', 'discover', 'transit', 'newcomer', 'shopping', 'information']);
    if (value.goal === null || goal) state.goal = goal || null;
    if (value.date === null || validPlannerWebDate(value.date)) state.date = validPlannerWebDate(value.date);
    for (const key of ['startTime', 'finishBy'] as const) if (value[key] === null || clock(value[key])) state[key] = clock(value[key]) || null;
    if (value.partySize === null || Number.isInteger(value.partySize) && Number(value.partySize) >= 1 && Number(value.partySize) <= 100) state.partySize = value.partySize === null ? null : Number(value.partySize);
    if (value.budget === null || number(value.budget) !== undefined) state.budget = value.budget === null ? null : number(value.budget);
    if (Array.isArray(value.childAges)) state.childAges = value.childAges.slice(0, 20).filter((age): age is number => Number.isInteger(age) && Number(age) >= 0 && Number(age) <= 17);
    if (Array.isArray(value.excludedCities)) state.excludedCities = strings(value.excludedCities, 101, 120);
    if (typeof value.freeOnly === 'boolean') state.freeOnly = value.freeOnly;
    if (typeof value.returnToOrigin === 'boolean') state.returnToOrigin = value.returnToOrigin;
    if (Number.isInteger(value.maxStops) && Number(value.maxStops) >= 1 && Number(value.maxStops) <= 6) state.maxStops = Number(value.maxStops);
    if (value.travelMode === null || option(value.travelMode, ['any', 'drive', 'transit', 'walk'])) state.travelMode = option(value.travelMode, ['any', 'drive', 'transit', 'walk']) || null;
    if (value.setting === null || option(value.setting, ['any', 'indoor', 'outdoor', 'mixed'])) state.setting = option(value.setting, ['any', 'indoor', 'outdoor', 'mixed']) || null;
    if (value.budgetScope === null || option(value.budgetScope, ['person', 'total'])) state.budgetScope = option(value.budgetScope, ['person', 'total']) || null;
    result.taskState = state;
  }
  const ids = new Set<string>();
  result.evidence = Array.isArray(input.evidence) ? input.evidence.slice(0, 60).flatMap(item => {
    if (!record(item)) return [];
    const id = text(item.id, 160), title = text(item.title), url = safeEvidenceUrl(item.url), kind = option(item.kind, ['guide', 'event', 'place', 'web']);
    if (!id || !title || !url || !kind || ids.has(id)) return [];
    ids.add(id);
    return [{ id, title, url, kind, checkedAt: evidenceCheckedAt(item.checkedAt), verification: option(item.verification, ['catalog', 'page-read', 'api', 'search-result']), text: text(item.text, 1500) }];
  }) : [];
  const coverage = input.answerCoverage;
  if (record(coverage) && option(coverage.status, ['complete', 'partial', 'unassessed']) && Array.isArray(coverage.items)) {
    const seen = new Set<string>();
    const items: BayBayAnswerCoverage['items'] = coverage.items.slice(0, 8).flatMap(item => {
      if (!record(item)) return [];
      const id = text(item.id, 80), label = text(item.label, 160), status = option(item.status, ['answered', 'unknown', 'needs_user_input']);
      if (!id || !label || !status || seen.has(id)) return [];
      seen.add(id); return [{ id, label, status, summary: coverageSummary(item.summary), sourceIds: strings(item.sourceIds, 4, 160).filter(id => ids.has(id)) }];
    });
    result.answerCoverage = { status: !items.length ? 'unassessed' : items.some(item => item.status !== 'answered') ? 'partial' : option(coverage.status, ['complete', 'partial', 'unassessed'])!, items };
  }
  const plan = input.assistantPlan;
  if (record(plan) && text(plan.id, 160) && text(plan.title) && option(plan.status, ['ready', 'needs_verification', 'needs_details']) && Array.isArray(plan.stops) && plan.stops.length <= 12 && record(plan.budget)) {
    const stops: BayBayPlanStop[] = [];
    for (const stop of plan.stops) {
      if (!record(stop) || !text(stop.id, 160) || !text(stop.title) || !text(stop.kind, 40) || stops.some(item => item.id === text(stop.id, 160))) return result;
      stops.push({ id: text(stop.id, 160)!, title: text(stop.title)!, kind: text(stop.kind, 40)!, entityId: text(stop.entityId, 160), city: text(stop.city, 120), date: validPlannerWebDate(stop.date) || undefined,
        startTime: clock(stop.startTime), endTime: clock(stop.endTime), durationMinutes: number(stop.durationMinutes, 1440), travelMinutes: travelMinutes(stop.travelMinutes), timeStatus: option(stop.timeStatus, ['verified', 'suggested', 'unknown']) || 'unknown', admissionUsd: number(stop.admissionUsd),
        sourceIds: [...new Set(strings(stop.sourceIds, 30, 160))].filter(id => ids.has(id)), notes: strings(stop.notes), admissionFacts: admissionFacts(stop.admissionFacts, ids) });
    }
    const stopIds = stops.map(stop => stop.entityId || stop.id.replace(/^(?:event|place):/, ''));
    const pairs = new Set(stopIds.map((id, index) => `${index ? stopIds[index - 1] : 'origin'}:${id}`));
    if (stopIds.length) pairs.add(`${stopIds[stopIds.length - 1]}:origin`);
    const travelLegs: BayBayPlanTravelLeg[] = Array.isArray(plan.travelLegs) ? plan.travelLegs.slice(0, 13).flatMap(leg => {
      if (!record(leg) || leg.provider !== 'google-maps' || leg.status !== 'estimate') return [];
      const from = text(record(leg.from) ? leg.from.id : leg.from, 160), to = text(record(leg.to) ? leg.to.id : leg.to, 160), minutes = travelMinutes(leg.durationMinutes);
      return from && to && from !== to && minutes !== undefined && pairs.has(`${from}:${to}`) ? [{ from, to, durationMinutes: minutes, provider: 'google-maps' as const, status: 'estimate' as const }] : [];
    }) : [];
    result.assistantPlan = { id: text(plan.id, 160)!, title: text(plan.title)!, date: validPlannerWebDate(plan.date) || undefined, status: option(plan.status, ['ready', 'needs_verification', 'needs_details'])!, stops, travelLegs, returnTime: clock(plan.returnTime),
      budget: { knownTotalUsd: number(plan.budget.knownTotalUsd), unknownItems: strings(plan.budget.unknownItems), limitUsd: number(plan.budget.limitUsd), scope: option(plan.budget.scope, ['person', 'total']) },
      checks: Array.isArray(plan.checks) ? plan.checks.slice(0, 30).flatMap(check => record(check) && text(check.code, 100) && text(check.message, 1000) && option(check.status, ['pass', 'unknown', 'fail']) ? [{ code: text(check.code, 100)!, status: option(check.status, ['pass', 'unknown', 'fail'])!, message: text(check.message, 1000)! }] : []) : [],
      unknowns: strings(plan.unknowns), summary: text(plan.summary, 2500) };
  }
  if (record(input.research)) result.research = { warnings: strings(input.research.warnings), steps: Array.isArray(input.research.steps) ? input.research.steps.slice(0, 15).flatMap(step => record(step) && text(step.tool, 80) && text(step.status, 40) && text(step.label) ? [{ tool: text(step.tool, 80)!, status: text(step.status, 40)!, label: text(step.label)!, ...(text(step.code, 80) ? { code: text(step.code, 80) } : {}) }] : []) : [] };
  if (result.research && record(input.research) && record(input.research.timings)) {
    const timings: NonNullable<BayBayAssistantFields['research']>['timings'] = {};
    for (const key of ['siteMs', 'searchMs', 'readMs', 'modelMs', 'finalMs', 'routeMs', 'stateMs', 'monitorMs', 'quotaMs', 'weatherMs', 'planMs', 'otherMs', 'totalMs'] as const) if (Number.isInteger(input.research.timings[key]) && number(input.research.timings[key], 600_000) !== undefined) timings[key] = Number(input.research.timings[key]);
    result.research.timings = timings;
  }
  return result;
}

/** This public URL supports catalog IDs and a date, not model times, quotes or web-only places. */
export function bayBayAssistantPlanImport(plan: BayBayAssistantPlan) {
  const stops = cleanStops(plan.stops.filter(stop => (!stop.date || stop.date === plan.date) && (stop.kind === 'event' || stop.kind === 'place') && (stop.kind !== 'event' || !!stop.entityId && !!plan.date && !!eventFor(stop.entityId) && eventOccursOn(eventFor(stop.entityId)!, plan.date))).map(stop => ({ kind: stop.kind, id: stop.entityId })));
  if (!plan.date || !stops.length) return null;
  const url = new URL(sharePlanUrl({ date: plan.date, stops }));
  return { path: url.pathname + url.search, count: stops.length, omitted: plan.stops.length - stops.length };
}
