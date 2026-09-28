import type { Bilingual, Vec2 } from '../core/types';

/**
 * Wave 5 · lane C · W5-C1 (plan sf-w5-plan.md §3.1 "Finding without pins", §4.3): 听说… — the rumour hook.
 *
 * Other lanes (lane D's `eggs/rumourSource.ts` first) register a SOURCE; lane C decides when a rumour is told and puts
 * the words around it. A source answers "anything worth hinting at, here and now?" — typically an unfound egg in the
 * player's zone — and never says it itself.
 *
 *   registerRumourSource(fn)   → unregister. `fn(ctx)` returns a Rumour or null; it is asked only when lane C is about
 *                              to tell one (≤ once per RUMOUR_GAP_MS), in registration order, the first answer wins.
 *                              A throwing source is skipped.
 *   Rumour                     { id, text, at? }: `id` is told at most once per visit (e.g. `egg:telegraph-hill-parrots`);
 *                              `text` is the rumour itself. Without a frame, lane C adds one (frameRumour: 听说，… /
 *                              悄悄说：… / 据说…; "I heard something: …"), so keep that zh ≤ RUMOUR_TEXT_ZH_MAX (40);
 *                              a text that already starts with its own frame (听说 / 据说 / 悄悄 in zh — lane D's egg
 *                              rumours do — and They say / Word is / I heard in en) is said as it is, zh ≤ 45;
 *                              `at` (optional) is where it points (a later 带我去 / the compass can use it).
 *
 * Who tells it (game/cityMoments.ts, city mode, lazy): BAYBAY, through her line pacer, while you wander on foot in free
 * roam with her beside you — never during a tour, a trip, a dialogue, a panel or a cinematic, never in the first
 * RUMOUR_FIRST_MS of play, at most one per RUMOUR_GAP_MS (5 min). Residents' chats may tell them later (part b).
 * Dependency-free (types only): a lane's lazy chunk imports it without pulling game code.
 */

export interface RumourContext {
  /** the player's position (world u) */
  x: number;
  z: number;
  /** store.area: the neighbourhood / landmark area id the player is in (null: none known) */
  zone: string | null;
  /** Bay time now (game/bayNow bayNow(): `?date=` moves it in DEV / QA builds) */
  now: Date;
  /** rumour ids already told this visit (lane C skips them too) */
  told: ReadonlySet<string>;
}

export interface Rumour {
  /** unique id, told at most once per visit (`egg:<id>` for an egg) */
  id: string;
  /** the rumour itself, without "听说…" (zh ≤ RUMOUR_TEXT_ZH_MAX characters; en a short clause or sentence) */
  text: Bilingual;
  /** where it points, when it points somewhere */
  at?: Vec2;
}

export type RumourSource = (ctx: RumourContext) => Rumour | null | undefined;

/** At most one rumour per this long (ms): plan §3.1 "at most one per 5 minutes". */
export const RUMOUR_GAP_MS = 5 * 60_000;
/** None in the first minute and a half of play (the welcome, the goals, the first steps are BAYBAY's own). */
export const RUMOUR_FIRST_MS = 90_000;
/** A source's zh text fits a 45-character bubble with lane C's longest frame (4 characters). */
export const RUMOUR_TEXT_ZH_MAX = 40;

const sources: RumourSource[] = [];

/** Register a rumour source (lane D's eggs, later others); returns the unregister. */
export function registerRumourSource(fn: RumourSource): () => void {
  sources.push(fn);
  return () => { const i = sources.indexOf(fn); if (i >= 0) sources.splice(i, 1); };
}

/** How many sources are registered (tests, QA). */
export const rumourSourceCount = () => sources.length;

/** A text that brings its own frame (lane D's 听说… rumours): said as it is. */
const FRAMED_ZH = /^\s*(听说|据说|悄悄)/;
const FRAMED_EN = /^\s*(they say|word is|i heard|psst|rumou?r has it)\b/i;
/** A bubble's limit for a text that brings its own frame. */
export const RUMOUR_FRAMED_ZH_MAX = 45;
const framedZh = (zh: string) => FRAMED_ZH.test(zh);

const validRumour = (r: Rumour | null | undefined): r is Rumour =>
  !!r && typeof r.id === 'string' && r.id.length > 0 && !!r.text && typeof r.text.zh === 'string' && typeof r.text.en === 'string'
  && r.text.zh.trim().length > 0 && r.text.en.trim().length > 0 && [...r.text.zh].length <= (framedZh(r.text.zh) ? RUMOUR_FRAMED_ZH_MAX : RUMOUR_TEXT_ZH_MAX);

/** The first source's answer that was not told yet (sources in registration order; a throwing source is skipped). */
export function pickRumour(ctx: RumourContext): Rumour | null {
  for (const fn of [...sources]) {
    let r: Rumour | null | undefined;
    try { r = fn(ctx); } catch (error) { if (import.meta.env?.DEV) console.warn('[opus-bay rumours] a source threw', error); continue; }
    if (!validRumour(r) || ctx.told.has(r.id)) continue;
    return r;
  }
  return null;
}

/** Is a rumour allowed now? `startedAt` = when play began, `lastAt` = the last rumour told (null: none yet); all ms. */
export function rumourDue(o: { startedAt: number; lastAt: number | null; now: number }): boolean {
  if (o.now - o.startedAt < RUMOUR_FIRST_MS) return false;
  return o.lastAt === null || o.now - o.lastAt >= RUMOUR_GAP_MS;
}

/** Lane C's frames (zh ≤ 4 characters + the text: a bubble of ≤ 45). `n` picks one (the count of rumours told). */
// (English frames end in a colon or a dash, so a source's sentence keeps its own capital: names stay names)
const FRAMES: readonly { zh: (t: string) => string; en: (t: string) => string }[] = [
  { zh: t => `听说，${t}`, en: t => `I heard something: ${t}` },
  { zh: t => `悄悄说：${t}`, en: t => `Psst — ${t}` },
  { zh: t => `据说${t}`, en: t => `Word is: ${t}` },
];

/** The words BAYBAY says: the rumour inside one of lane C's frames (a text with its own frame keeps it). */
export function frameRumour(r: Pick<Rumour, 'text'>, n = 0): Bilingual {
  const f = FRAMES[((n % FRAMES.length) + FRAMES.length) % FRAMES.length];
  const zh = r.text.zh.trim(), en = r.text.en.trim();
  return { zh: framedZh(zh) ? zh : f.zh(zh), en: FRAMED_EN.test(en) ? en : f.en(en) };
}
