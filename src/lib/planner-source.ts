import type { MonthlyEvent } from '../data/monthly-types';
import type { GuideImage } from '../data/guide-media';
import type { FreebieOffer } from '../components/FreebieBoard';
import type { PlannerEvent, PlannerPlace } from './planner-core';

/**
 * Where the planner reads its catalog (WEB-PLAN-DATA). Two sources fill it:
 * - the full catalog: data/planner-catalog.ts installs it when it is evaluated, and `lib/planner.ts` imports that module,
 *   so every page and feature that imports `./planner` reads the same arrays as before, synchronously;
 * - 行程 (/plan): its modules import `./planner-core` and read the generated catalog (src/data/generated/plan-catalog.json,
 *   scripts/generate-plan-catalog.ts), which the page loads after its first paint (features/plan/plan-catalog.ts). It also
 *   carries what 行程 alone shows: the covers' image records, the offers linked to its places and the region list.
 * The bindings are live (`export let`): a module that imported them reads whatever is installed when it runs. The full
 * catalog always wins (the same records; installing the generated one afterwards only adds 行程's extras), so a page that
 * loads it while 行程 is open keeps showing the same stops.
 *
 * Node (tests, the prerender, scripts) installs the generated catalog when this module is evaluated, as the guide store
 * reads its records, so 行程 renders in one pass there; BAYLINK_LAZY_PLAN=1 makes Node take the browser's path.
 */
export type PlanRegion = { readonly id: string; readonly label: string };
export type PlanCatalog = {
  events: PlannerEvent[];
  places: PlannerPlace[];
  /** Cover image records by key: every listing image and guide cover a planner stop can ask for (plan-stop-cover.ts). */
  images: Record<string, GuideImage>;
  /** The live offers linked to a planner place (planner-offers.ts), in catalog order. */
  offers: FreebieOffer[];
  /** 按条件挑选's region list (data/attractions.ts ATTRACTION_REGIONS). */
  regions: PlanRegion[];
};

export let PLANNER_EVENTS: PlannerEvent[] = [];
export let PLANNER_PLACES: PlannerPlace[] = [];
/** The edition's events as `eventFor` returns them: data/monthly-edition.ts MONTHLY_EVENTS, or the planner's events on 行程. */
export let CATALOG_EVENTS: MonthlyEvent[] = [];
export let PLAN_COVER_IMAGES: Readonly<Record<string, GuideImage>> = {};
export let PLAN_OFFERS: FreebieOffer[] = [];
export let PLAN_REGIONS: readonly PlanRegion[] = [];

let fullCatalog = false;
let planCatalog = false;

/** data/planner-catalog.ts, once evaluated: the full catalog, replacing a generated one. */
export function installFullPlannerCatalog(catalog: { events: PlannerEvent[]; places: PlannerPlace[]; catalogEvents: MonthlyEvent[] }): void {
  PLANNER_EVENTS = catalog.events;
  PLANNER_PLACES = catalog.places;
  CATALOG_EVENTS = catalog.catalogEvents;
  fullCatalog = true;
}

/** The generated catalog (行程): its events and places unless the full catalog is in, and always 行程's extras. */
export function installPlanCatalog(catalog: PlanCatalog): void {
  if (!fullCatalog) {
    PLANNER_EVENTS = catalog.events;
    PLANNER_PLACES = catalog.places;
    CATALOG_EVENTS = catalog.events;
  }
  PLAN_COVER_IMAGES = catalog.images;
  PLAN_OFFERS = catalog.offers;
  PLAN_REGIONS = catalog.regions;
  planCatalog = true;
}

/** Whether 行程 can render: the generated catalog (and with it the extras) is installed. */
export const isPlanCatalogInstalled = (): boolean => planCatalog;

type NodeProcess = { env?: Record<string, string | undefined>; getBuiltinModule?: (id: string) => unknown };
const nodeProcess = (globalThis as { process?: NodeProcess }).process;
if (nodeProcess?.getBuiltinModule && nodeProcess.env?.BAYLINK_LAZY_PLAN !== '1') {
  const { createRequire } = nodeProcess.getBuiltinModule('node:module') as { createRequire: (from: string) => (id: string) => unknown };
  const file = '../data/generated/plan-catalog.json';
  // Before `npm run generate:home` has written it, only the generators run, and they import the full catalog.
  try { installPlanCatalog(createRequire(import.meta.url)(file) as PlanCatalog); } catch (error) { if ((error as { code?: string }).code !== 'MODULE_NOT_FOUND') throw error; }
}
