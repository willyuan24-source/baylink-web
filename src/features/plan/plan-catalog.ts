import { createElement, type ComponentType } from 'react';
import { chunkLoader } from '../../lib/chunk-recovery';
import { arePlanExtrasInstalled, installPlanCatalog, installPlanExtras, isPlannerCatalogInstalled, type PlanCatalog, type PlanExtras } from '../../lib/planner-source';
import { isLocaleReadyForFeature, isLocaleReadyForPath, loadLocaleForFeature, type Locale } from '../../i18n/locale';
import { pathLanguage } from '../../lib/language-path';
import { routePathname } from '../../app/route-table';
import type { PlannerWorkspaceProps } from './PlannerWorkspace';
import { nodeWorkspace } from './plan-workspace-node';

/**
 * 行程's catalog after the first paint (WEB-PLAN-DATA). The page's header renders at once; its workspace (saved days, the
 * matcher, the list and the editor) reads the planner catalog synchronously, so it waits here for the generated catalog
 * (scripts/generate-plan-catalog.ts: events and places, and 行程's extras) and, in English, for that catalog's own text
 * pack ('plan-catalog'), instead of the route carrying every event record, every guide and three English packs before it
 * can render.
 *
 * Arriving from a page that already holds the full catalog (My Week, 加入这天计划 on the calendar, BayBay), only the extras
 * load; arriving from a page that holds the planning, discovery and guide-index packs (My Week, /together, /me), the English
 * pack is not loaded again: it is a subset of theirs (tests/plan-catalog-split.test.ts).
 * Node installs the generated files when lib/planner-source.ts is evaluated, so the prerender and tests render in one pass.
 *
 * H20 (WEB-PERF-3): the workspace's own code is a chunk too (PlannerWorkspace.tsx), loaded with the catalog, and a plain
 * visit no longer starts either at boot: 已排的日子 renders first from this device's saved plans (PlanDaysPreview) and the
 * rest loads at idle after the page's load, sooner on the reader's first interaction, or at once for a link that opens a
 * plan (`planWantedAtOnce`). The route itself is the header, the saved days and the prerendered workspace's styles.
 */
const loadCatalog = chunkLoader(() => import('../../data/generated/plan-catalog.json'), module => module.default as unknown as PlanCatalog);
const loadExtras = chunkLoader(() => import('../../data/generated/plan-extras.json'), module => module.default as unknown as PlanExtras);
const loadWorkspace = chunkLoader(() => import('./PlannerWorkspace'), module => module.PlannerWorkspace);
let Workspace: ComponentType<PlannerWorkspaceProps> | undefined = nodeWorkspace;
const installWorkspace = (component: ComponentType<PlannerWorkspaceProps>) => { Workspace = component; };

/** The English the workspace shows: its own pack, or the packs My Week, /together and /me load (a superset of it). */
const englishReady = () => isLocaleReadyForFeature('en', 'plan') || isLocaleReadyForPath('en', '/my-week');

/** Whether the workspace can render in this language. The route's own gate has loaded the language and its search tables. */
export const isPlanReady = (locale: Locale): boolean => isPlannerCatalogInstalled() && arePlanExtrasInstalled() && !!Workspace && (locale !== 'en' || englishReady());

let wanted = false;
const wantListeners = new Set<() => void>();
/** Whether this page load has asked for the workspace (an interaction, a saved day, a link that opens a plan, 问 BayBay). */
export const isPlanWanted = (): boolean => wanted;
/** Ask for the workspace: the slot stops waiting for the reader and loads it (listeners hear it after the current render). */
export function wantPlan(): void {
  if (wanted) return;
  wanted = true;
  queueMicrotask(() => { for (const listener of [...wantListeners]) listener(); });
}
export const subscribePlanWanted = (listener: () => void): (() => void) => { wantListeners.add(listener); return () => { wantListeners.delete(listener); }; };

const pending = new Map<Locale, Promise<void>>();
/** Load what is missing of the catalog, the extras, the workspace and the language's text for them. A failed load rejects; the next call tries again. */
export function loadPlan(locale: Locale): Promise<void> {
  wantPlan();
  if (isPlanReady(locale)) return Promise.resolve();
  let promise = pending.get(locale);
  if (!promise) {
    promise = Promise.all([
      isPlannerCatalogInstalled() ? undefined : loadCatalog().then(installPlanCatalog),
      arePlanExtrasInstalled() ? undefined : loadExtras().then(installPlanExtras),
      Workspace ? undefined : loadWorkspace().then(installWorkspace),
      locale === 'en' && !englishReady() ? loadLocaleForFeature('en', 'plan') : undefined,
    ]).then(() => undefined).finally(() => { pending.delete(locale); });
    pending.set(locale, promise);
  }
  return promise;
}

const failures = new Set<Locale>();
/**
 * The workspace's read: nothing when it can render; while the catalog loads, the thrown promise suspends the workspace
 * (the page keeps its header and shows the slot's fallback). A failed load is returned as `failed`, never thrown in a loop.
 */
export function readPlan(locale: Locale): { failed?: true } {
  if (isPlanReady(locale)) return {};
  if (failures.has(locale)) return { failed: true };
  throw loadPlan(locale).catch(() => { failures.add(locale); });
}

/** Whether the last load in this language failed (the workspace shows its error state). */
export const planLoadFailed = (locale: Locale): boolean => failures.has(locale);

/** Forget a failed load so the next read tries again. */
export const retryPlan = (locale: Locale): void => { failures.delete(locale); };

/** The workspace, once loadPlan has brought it in (PlanWorkspaceSlot renders it only then). */
export function PlanWorkspace(props: PlannerWorkspaceProps) {
  return Workspace ? createElement(Workspace, props) : null;
}

const has = (search: string, keys: readonly string[]) => { const query = new URLSearchParams(search); return keys.some(key => query.has(key)); };
/** A link that opens a plan (?edit=, ?stops=, ?places=, a BayBay plan): 这一天的安排 comes first, without this weekend's picks. */
export const opensPlan = (search: string): boolean => has(search, ['edit', 'stops', 'places', 'baybayDraft']);
/** A link that opens a plan or a draft (those, a BayBay brief, a question) shows the workspace first. */
export const planWantedAtOnce = (search: string): boolean => opensPlan(search) || has(search, ['baybayBrief', 'q']);

// Such a link starts the workspace as soon as the route chunk runs on /plan, in the URL's language: at boot, while the
// language and the app are still loading (bootApp waits for both), instead of after the header's first render.
if (typeof window !== 'undefined' && routePathname(window.location.pathname) === '/plan' && planWantedAtOnce(window.location.search)) void loadPlan(pathLanguage(window.location.pathname)).catch(() => undefined);
