/**
 * Events the site lists that the two public event catalogs hold back for now: public/event-catalog.json
 * (scripts/export-event-catalog.ts) and public/planner-catalog.json (scripts/export-planner-catalog.ts). The API copies
 * both and refuses a sync unless they cover identical event ids (its scripts/sync-editorial-catalogs.js), so one list
 * feeds both exports (tests/public-catalog-holdout.test.ts).
 *
 * Why: /opus-bay reads public/planner-catalog.json, and every San Francisco event in it needs the Opus session's own
 * placement decision (tests/opus-bay-w6-s-venues.test.ts, W6-S1: a venue row, or a stated reason to stay out). The
 * 2026-10-12 supply batch's nine SF programmes wait for that decision. Until then the site's event pages, /events,
 * /calendar and the in-app planner (all built from MONTHLY_EVENTS / PLANNER_EVENTS) list them, but the API does not know
 * them: BayBay cannot recommend them, and a save or 想去 on them stays on the reader's device until the API catalog has
 * them (src/lib/saves.ts keeps an ITEM_NOT_IN_CATALOG save on the device and retries).
 *
 * When the Opus session has recorded its decision for these ids, empty this list and re-export both catalogs
 * (`npm run export:events && npm run export:planner`).
 */
export const WORLD_IMPORT_PENDING: readonly string[] = [
  'chsa-lily-qi-book-talk-nov8-2026',
  'sfpl-bernal-dia-de-los-muertos-2026',
  'sfpl-chinatown-creative-saturdays-fall-2026',
  'sfpl-chinese-book-club-nov14-2026',
  'sfpl-excelsior-multilingual-tech-help-2026',
  'sfpl-marina-wild-goose-qigong-oct-2026',
  'sfpl-north-beach-open-house-oct31-2026',
  'sfpl-richmond-hk-film-hard-boiled-2026',
  'sfpl-richmond-hk-film-the-killer-2026',
];

const pending = new Set(WORLD_IMPORT_PENDING);
/** Whether an event goes into the public event and planner catalogs the API and /opus-bay read. */
export const inPublicEventCatalogs = (id: string) => !pending.has(id);
