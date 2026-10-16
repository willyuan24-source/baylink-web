/**
 * The public catalog files, which events each one carries and who reads it (H07; Option B, chosen 2026-10-13):
 *
 * | File (export script)                                          | Events                          | Read by |
 * |---------------------------------------------------------------|---------------------------------|---------|
 * | public/event-catalog.json (scripts/export-event-catalog.ts)    | every site event                | the API, copied as its data/event-catalog.json (公开想去 / 一起去 counts, outings) |
 * | public/planner-catalog.full.json (export-planner-catalog.ts)   | every site event, places, guides| the API, copied as its data/planner-catalog.json (saves, plans, BayBay) |
 * | public/planner-catalog.json (export-planner-catalog.ts)        | all but WORLD_IMPORT_PENDING    | /opus-bay at runtime (src/opus-bay/data/catalog.ts), scripts/opus-sf/*, tests/opus-bay-* |
 * | (same file)                                                    | WORLD_HELD_FIELDS kept as pinned | the 3D world's label-based hours for an event whose newer hours an opus test does not know yet |
 *
 * Why /opus-bay gets its own copy: every San Francisco event in the file it reads needs the Opus session's own placement
 * decision (tests/opus-bay-w6-s-venues.test.ts, W6-S1: a venue row, or a stated reason to stay out). The 2026-10-12 supply
 * batch's nine SF programmes, the 2026-10-13 batch's three for 11/21-11/28 and the 2026-10-15 batch's four seasonal SF items
 * that open before 12/1 (ZooLights, the Union Square rink, Glow, Lightscape) wait for that decision, so they stay out of
 * public/planner-catalog.json, and only that file.
 * The two files the API copies are complete, so every event page's participation line, a member's saves and plans, and
 * BayBay know every event the site lists.
 *
 * The API refuses a sync unless its two copies cover identical event ids with the same dates (its
 * scripts/sync-editorial-catalogs.js, which copies planner-catalog.full.json from API-SYNC-3b on); tests/public-catalog-holdout.test.ts
 * holds the same rule here, and tests/api-catalog-coverage.test.ts checks that every detail page is in both. Apart from
 * /opus-bay nothing on the site fetches these files: the site's pages are built from MONTHLY_EVENTS and PLANNER_CATALOG.
 *
 * When the Opus session has recorded its decision for these ids, empty this list and re-export (`npm run export:planner`):
 * public/planner-catalog.json is then the full catalog again.
 */
export const WORLD_IMPORT_PENDING: readonly string[] = [
  'chsa-lily-qi-book-talk-nov8-2026',
  'exploratorium-glow-2026',
  'sf-botanical-lightscape-2026',
  'sfpl-bernal-dia-de-los-muertos-2026',
  'sfpl-bernal-family-game-night-nov28-2026',
  'sfpl-chinatown-creative-saturdays-fall-2026',
  'sfpl-chinatown-creative-saturdays-late-nov-2026',
  'sfpl-chinese-book-club-nov14-2026',
  'sfpl-excelsior-multilingual-tech-help-2026',
  'sfpl-main-california-xiangqi-invitational-nov28-2026',
  'sfpl-marina-wild-goose-qigong-oct-2026',
  'sfpl-north-beach-open-house-oct31-2026',
  'sfpl-richmond-hk-film-hard-boiled-2026',
  'sfpl-richmond-hk-film-the-killer-2026',
  'sfzoo-zoolights-2026',
  'union-square-holiday-ice-rink-2026',
];

/** Paths relative to the repository root (the export scripts and tests run there). */
export const PUBLIC_CATALOG_FILES = {
  /** Every site event: the API's data/event-catalog.json. */
  apiEvents: 'public/event-catalog.json',
  /** Every site event, place and guide: the API's data/planner-catalog.json. */
  apiPlanner: 'public/planner-catalog.full.json',
  /** The planner catalog /opus-bay reads: apiPlanner without WORLD_IMPORT_PENDING. */
  worldPlanner: 'public/planner-catalog.json',
} as const;

const pending = new Set(WORLD_IMPORT_PENDING);
/** Whether an event goes into public/planner-catalog.json, the planner catalog /opus-bay reads. */
export const inWorldPlannerCatalog = (id: string) => !pending.has(id);

/**
 * Fields /opus-bay's copy keeps at the value an opus test pins, while the site and both API files carry the newer,
 * source-read value; this repository may not edit tests/opus-bay-* (MASTER-PLAN D26). Only the fields named here are
 * held. For the Marina open house that is `dateLabel`, which the world's venue window, activeEventsAt and BAYBAY's lines
 * read (src/opus-bay/realsf/events.ts, eventHours), so they close it at 15:00. `sessions` and `planning.schedule` stay
 * current, and FreeWeekStrip, HowToGo and the .ics export read the schedule first (realsf/freeWeek.ts, eventDayHours), so
 * those say 11:00–16:00. Until the entry goes, the two disagree inside /opus-bay. Drop an entry once the Opus session
 * has moved its test to the new value, then re-export (`npm run export:planner`).
 */
export const WORLD_HELD_FIELDS: Readonly<Record<string, { readonly dateLabel: string }>> = {
  // SFPL's event page, read 2026-10-15 (CNT-WEEKEND-1015): "11:00 - 4:00", with the SF Opera brass quintet at 3 p.m.
  // tests/opus-bay-w7-s-venues.test.ts (W7-S1) pins the earlier 11:00–15:00.
  'sf-marina-library-open-house-oct17-2026': { dateLabel: '10/17（六）11:00–15:00' },
};
/** An event row as public/planner-catalog.json carries it: the API's row with any held fields put back. */
export const worldPlannerEvent = <T extends { id: string }>(event: T): T =>
  Object.hasOwn(WORLD_HELD_FIELDS, event.id) ? { ...event, ...WORLD_HELD_FIELDS[event.id] } : event;
