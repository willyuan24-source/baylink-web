import { bayBayAssistantPlanImport, parseBayBayAssistantFields, type BayBayAdmissionFacts, type BayBayAssistantPlan, type BayBayTaskState } from './baybay-assistant';
import { parseSharedPlan, type PlanDetails, type PlanFilters, type Stop } from './planner';
import { cleanPlanFilters, defaultPlanDetails, normalizePlanDetails } from './planner-itinerary';
import { sourcedAdmissionSubtotal } from './baybay-admission-reference';

export type BayBayPlanDraft = { version: 1; createdAt: number; ownerId?: string; title: string; date: string; stops: Stop[]; details: PlanDetails; requirements: BayBayTaskState; costReference: { knownTotalUsd?: number; unknownItems: string[] }; admissions: { stop: Stop; facts: BayBayAdmissionFacts }[] };
export type BayBayRequirementsDraft = { version: 1; createdAt: number; ownerId?: string; message: string };
export type BayBayAdmissionOverride = { active: boolean; knownTotalUsd: number; allAdmissionAmountsKnown?: boolean; unknownStops: Stop[]; unknowns: string[] };
const drafts = new Map<string, BayBayPlanDraft>();
const requirementsDrafts = new Map<string, BayBayRequirementsDraft>();
const TTL = 30 * 60 * 1000;
const MAX_DRAFTS = 4;

export const validBayBayDraftId = (id: string | null): id is string =>
  typeof id === 'string' && /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(id);

function pruneDrafts(ownerId: string | undefined, now: number) {
  for (const store of [drafts, requirementsDrafts]) {
    for (const [id, draft] of store) {
      if (draft.ownerId !== ownerId || draft.createdAt > now || now - draft.createdAt >= TTL) store.delete(id);
    }
  }
}

function reserveDraftSlot(ownerId: string | undefined, now: number) {
  pruneDrafts(ownerId, now);
  while (drafts.size + requirementsDrafts.size >= MAX_DRAFTS) {
    const oldest = [...drafts.entries(), ...requirementsDrafts.entries()].sort((a, b) => a[1].createdAt - b[1].createdAt)[0];
    drafts.delete(oldest[0]); requirementsDrafts.delete(oldest[0]);
  }
}

/** An unstructured requirement draft is private too: no URL text, persistence or automatic paid lookup. */
export function stageBayBayRequirementsDraft(message: string, ownerId?: string, now = Date.now()): string | null {
  if (typeof message !== 'string' || !Number.isFinite(now) || now < 0) return null;
  const text = message.trim().slice(0, 800);
  if (text.length < 2) return null;
  reserveDraftSlot(ownerId, now);
  const id = crypto.randomUUID();
  requirementsDrafts.set(id, { version: 1, createdAt: now, ownerId, message: text });
  return `/plan?${new URLSearchParams({ baybayBrief: id })}`;
}

export function readBayBayRequirementsDraft(id: string | null, ownerId?: string, now = Date.now()): BayBayRequirementsDraft | null {
  if (!Number.isFinite(now) || now < 0) return null;
  pruneDrafts(ownerId, now);
  if (!validBayBayDraftId(id)) return null;
  const draft = requirementsDrafts.get(id);
  return draft?.version === 1 ? structuredClone(draft) : null;
}

/** Same-tab, bounded, expiring memory only. Private requirements never enter a URL or storage. */
export function stageBayBayPlanDraft(plan: BayBayAssistantPlan, state: BayBayTaskState | undefined, ownerId?: string, now = Date.now()): string | null {
  const imported = bayBayAssistantPlanImport(plan);
  if (!imported) return null;
  const requirements = parseBayBayAssistantFields({ taskState: state }).taskState || { version: 1 as const, revision: 0 };
  const stops = parseSharedPlan(new URL(imported.path, 'https://www.baylink.us').search).stops;
  const defaults = defaultPlanDetails();
  const wholeBudget = requirements.budgetScope === 'total' ? requirements.budget : requirements.budgetScope === 'person' && requirements.partySize ? (requirements.budget ?? NaN) * requirements.partySize : undefined;
  const details = normalizePlanDetails({ ...defaults,
    ...(requirements.startTime ? { startTime: requirements.startTime } : {}), ...(requirements.finishBy ? { finishBy: requirements.finishBy } : {}),
    ...(requirements.partySize && requirements.partySize <= 50 ? { partySize: requirements.partySize } : {}),
    totalBudgetUsd: wholeBudget != null && Number.isFinite(wholeBudget) && wholeBudget <= 100000 ? wholeBudget : null,
    travelMode: requirements.travelMode || 'any',
    // Planner filters interpret budget as admission-only, so do not copy a whole-trip budget there.
    constraints: cleanPlanFilters({ date: plan.date, city: requirements.city, region: requirements.region, childAges: requirements.childAges,
      childAge: requirements.childAges?.length === 1 ? requirements.childAges[0] : undefined, partySize: requirements.partySize,
      travelMode: requirements.travelMode, freeOnly: requirements.freeOnly, setting: requirements.setting }),
  }, stops);
  reserveDraftSlot(ownerId, now);
  const id = crypto.randomUUID();
  const costReference = { knownTotalUsd: typeof plan.budget.knownTotalUsd === 'number' && Number.isFinite(plan.budget.knownTotalUsd) && plan.budget.knownTotalUsd >= 0 && plan.budget.knownTotalUsd <= 1_000_000 ? plan.budget.knownTotalUsd : undefined, unknownItems: plan.budget.unknownItems.slice(0, 8).map(item => item.slice(0, 600)) };
  const admissions = stops.flatMap(stop => { const source = plan.stops.find(item => item.kind === stop.kind && item.entityId === stop.id); return source?.admissionFacts ? [{ stop, facts: structuredClone(source.admissionFacts) }] : []; });
  drafts.set(id, { version: 1, createdAt: now, ownerId, title: plan.title.slice(0, 80), date: plan.date!, stops, details, requirements, costReference, admissions });
  const url = new URL(imported.path, 'https://www.baylink.us'); url.searchParams.set('baybayDraft', id);
  return url.pathname + url.search;
}

export function readBayBayPlanDraft(id: string | null, ownerId?: string, now = Date.now()): BayBayPlanDraft | null {
  if (!Number.isFinite(now) || now < 0) return null;
  if (!validBayBayDraftId(id)) return null;
  const draft = drafts.get(id);
  if (!draft || draft.version !== 1 || draft.ownerId !== ownerId || draft.createdAt > now || now - draft.createdAt >= TTL) return null;
  return structuredClone(draft);
}

/** Original group prices apply only to the exact imported party, ages, date and ordered stops. Never persisted. */
export function bayBayAdmissionOverride(draft: BayBayPlanDraft | null, date: string, stops: Stop[], details: PlanDetails, filters: PlanFilters = details.constraints || {}): BayBayAdmissionOverride | undefined {
  if (!draft?.admissions.length) return;
  const active = date === draft.date && !!draft.requirements.partySize && details.partySize === draft.requirements.partySize
    && JSON.stringify(stops) === JSON.stringify(draft.stops)
    && JSON.stringify(filters.childAges || []) === JSON.stringify(draft.requirements.childAges || [])
    && filters.childAge === draft.details.constraints?.childAge;
  const unknownStops: Stop[] = [];
  let knownTotalUsd = 0;
  const unknowns = [...draft.costReference.unknownItems];
  for (const stop of draft.stops) {
    const facts = draft.admissions.find(item => item.stop.kind === stop.kind && item.stop.id === stop.id)?.facts;
    if (facts?.knownTotalUsd !== undefined && facts.status !== 'unknown') knownTotalUsd += facts.knownTotalUsd;
    if (!facts || facts.status !== 'complete' || facts.knownTotalUsd === undefined) unknownStops.push(stop);
    unknowns.push(...(facts?.unknowns || []));
  }
  const allAdmissionAmountsKnown = sourcedAdmissionSubtotal(draft.stops.map(stop => draft.admissions.find(item => item.stop.kind === stop.kind && item.stop.id === stop.id)?.facts), draft.requirements.partySize) !== undefined;
  return { active, knownTotalUsd: Math.round(knownTotalUsd * 100) / 100, allAdmissionAmountsKnown, unknownStops, unknowns: [...new Set(unknowns)] };
}
