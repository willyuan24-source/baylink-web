import { todayInBay, validDay, validStop, type SavedPlan, type Stop } from '../../lib/planner-core';
import { isPlannerCatalogInstalled } from '../../lib/planner-source';
import { MAX_PLAN_STOPS } from '../../lib/plan-limits';
import { GUEST_PLANNER_KEY } from '../../lib/planner-storage-key';
import { firstPlanDays, upcomingPlans } from '../../lib/plan-stop-cover';

// 已排的日子 before the catalog (H20): a guest's saved plans as this browser stores them (PlanDaysPreview.tsx).

const isStop = (value: unknown): value is Stop => !!value && typeof value === 'object' && ((value as Stop).kind === 'event' || (value as Stop).kind === 'place') && typeof (value as Stop).id === 'string';

/**
 * A guest's saved plans as stored. Before the catalog is in, without the catalog check the planner library adds
 * (planner-library.ts loadGuestLibrary); once it is in, with it, so the preview's rows are the list's rows.
 */
export function readGuestPlans(): SavedPlan[] {
  const known = isPlannerCatalogInstalled() ? validStop : () => true;
  try {
    if (typeof localStorage === 'undefined') return [];
    const data = JSON.parse(localStorage.getItem(GUEST_PLANNER_KEY) || 'null');
    if (!data || !Array.isArray(data.plans)) return [];
    return (data.plans as unknown[]).flatMap((plan): SavedPlan[] => {
      const item = plan as Partial<SavedPlan> | null;
      if (!item || typeof item.id !== 'string' || typeof item.title !== 'string' || typeof item.date !== 'string' || !validDay(item.date) || !Array.isArray(item.stops)) return [];
      const stops = item.stops.filter(isStop).filter(known).slice(0, MAX_PLAN_STOPS).map(({ kind, id }) => ({ kind, id }));
      return stops.length ? [{ id: item.id, title: item.title.slice(0, 80), date: item.date, stops, version: Number(item.version) || 1, createdAt: String(item.createdAt || ''), updatedAt: String(item.updatedAt || '') }] : [];
    }).slice(0, 30);
  } catch { return []; }
}

/** The guest's upcoming saved days as 行程 lists them (the next few days; the rest are in My Week). */
export const guestPlanDays = (today = todayInBay()) => firstPlanDays(upcomingPlans(readGuestPlans(), today)).plans;
