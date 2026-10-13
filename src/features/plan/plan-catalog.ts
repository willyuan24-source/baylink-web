import { chunkLoader } from '../../lib/chunk-recovery';
import { installPlanCatalog, isPlanCatalogInstalled, type PlanCatalog } from '../../lib/planner-source';
import { isLocaleReadyForFeature, loadLocaleForFeature, type Locale } from '../../i18n/locale';
import { pathLanguage } from '../../lib/language-path';
import { routePathname } from '../../app/route-table';

/**
 * 行程's catalog after the first paint (WEB-PLAN-DATA). The page's header renders at once; its workspace (saved days, the
 * matcher, the list and the editor) reads the planner catalog synchronously, so it waits here for the generated catalog
 * (scripts/generate-plan-catalog.ts, one chunk) and, in English, for that catalog's own text pack ('plan-catalog'), instead
 * of the route carrying every event record, every guide and three English packs before it can render.
 * Node installs the catalog when lib/planner-source.ts is evaluated, so the prerender and tests render in one pass.
 */
const loadCatalog = chunkLoader(() => import('../../data/generated/plan-catalog.json'), module => module.default as unknown as PlanCatalog);

/** Whether the workspace can render in this language. The route's own gate has loaded the language and its search tables. */
export const isPlanReady = (locale: Locale): boolean => isPlanCatalogInstalled() && (locale !== 'en' || isLocaleReadyForFeature('en', 'plan'));

const pending = new Map<Locale, Promise<void>>();
/** Load the catalog and the language's text for it. A failed load rejects; the next call tries again. */
export function loadPlan(locale: Locale): Promise<void> {
  if (isPlanReady(locale)) return Promise.resolve();
  let promise = pending.get(locale);
  if (!promise) {
    promise = Promise.all([
      isPlanCatalogInstalled() ? undefined : loadCatalog().then(installPlanCatalog),
      locale === 'en' ? loadLocaleForFeature('en', 'plan') : undefined,
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

// The catalog starts as soon as the route chunk runs on /plan, in the URL's language: at boot, while the language and the
// app are still loading (bootApp waits for both), instead of after the header's first render.
if (typeof window !== 'undefined' && routePathname(window.location.pathname) === '/plan') void loadPlan(pathLanguage(window.location.pathname)).catch(() => undefined);
