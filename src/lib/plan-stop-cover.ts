import { createCoverPage, getCover, type CoverContext, type CoverItem, type ResolvedCover } from './cover';
import { readerMonthDay } from './event-facts';
import { eventFor, placeFor, type SavedPlan, type Stop } from './planner-core';
import { PLAN_COVER_IMAGES, PLAN_COVER_KEYS } from './planner-source';
import { SCENE3D_POSTCARD_FOR, SCENE3D_POSTCARD_IMAGES } from '../data/scene3d-postcards';

/**
 * Covers for plan stops (行程, plan T13): one ladder for the planner's list and its saved days (UI9-IMAGES DECISIONS 22).
 * An event offers its build-time candidates (own → venue → ③ stock → approved AI); a place its listing image, else its
 * guide's cover, else (San Francisco places only) its 3D-world postcard, and — with no picture and no postcard — the ③
 * stock pictures of its kind of place from the plan extras (`place:<id>`, scripts/generate-plan-catalog.ts). getCover()
 * refuses unapproved AI art and theme photos on every rung; no stop shows an information card.
 */
export function stopCoverItem(stop: Stop): CoverItem {
  if (stop.kind === 'event') {
    const keys = Object.hasOwn(PLAN_COVER_KEYS, stop.id) ? PLAN_COVER_KEYS[stop.id] : undefined;
    return { kind: 'event', id: stop.id, imageKey: eventFor(stop.id)?.imageKey, ...(keys ? { imageKeys: keys } : {}) };
  }
  const place = placeFor(stop.id);
  const postcardKey = SCENE3D_POSTCARD_FOR[stop.id] ?? (place?.guideSlug ? SCENE3D_POSTCARD_FOR[place.guideSlug] : undefined);
  const imageKey = place?.imageKey ?? (place?.guideSlug ? `guide-cover:${place.guideSlug}` : undefined);
  // UI9-IMG-A1b: a place with no picture and no postcard carries ③ candidates from the plan extras (never an information card).
  const keys = Object.hasOwn(PLAN_COVER_KEYS, `place:${stop.id}`) ? PLAN_COVER_KEYS[`place:${stop.id}`] : undefined;
  return { kind: 'place', id: stop.id, imageKey, postcardKey, ...(keys ? { imageKeys: [...(imageKey ? [imageKey] : []), ...keys] } : {}) };
}

/**
 * The image registry for stop covers: listing images, guide covers (`guide-cover:` keys, as on My Week's saved list) and
 * the 3D postcards. Kept apart from saved-items.ts so the planner does not load the offer and new-shop catalogs for it.
 * The listing images and guide covers a stop can ask for come with 行程's generated catalog (planner-source.ts,
 * scripts/generate-plan-catalog.ts: data/guide-media.ts GUIDE_IMAGES and getGuideMedia(guide).cover), not with the whole
 * image registry and every guide.
 */
export function stopCoverImage(key: string) {
  if (Object.hasOwn(PLAN_COVER_IMAGES, key)) return PLAN_COVER_IMAGES[key];
  return Object.hasOwn(SCENE3D_POSTCARD_IMAGES, key) ? SCENE3D_POSTCARD_IMAGES[key] : undefined;
}

/** "10/17 周六" / "Sat, Oct 17" (US English, WEB-FIX6) for a Pacific calendar day (zh-Hant converts the weekday at render). */
export function planDayLabel(date: string, english: boolean) {
  const weekday = new Intl.DateTimeFormat(english ? 'en-US' : 'zh-CN', { weekday: 'short', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));
  return english ? `${weekday}, ${readerMonthDay(date, true)}` : `${readerMonthDay(date)} ${weekday}`;
}

/** 已排的日子 in display order: upcoming plans by day, the most recently changed first within a day. */
export const upcomingPlans = (plans: readonly SavedPlan[], today: string) =>
  plans.filter(plan => plan.date >= today).sort((a, b) => a.date.localeCompare(b.date) || b.updatedAt.localeCompare(a.updatedAt));

/** How many upcoming days 行程 lists; the rest are one link away in My Week, so many plans never push the tools down. */
export const PLAN_DAYS_SHOWN = 5;

/** The plans of the first `days` upcoming days (in upcomingPlans order) and how many later days are left out. */
export function firstPlanDays(plans: readonly SavedPlan[], days = PLAN_DAYS_SHOWN) {
  const dates = [...new Set(plans.map(plan => plan.date))];
  const shown = new Set(dates.slice(0, days));
  return { plans: plans.filter(plan => shown.has(plan.date)), moreDays: dates.length - shown.size };
}

/**
 * Every stop cover on 行程's page in display order (已排的日子, the suggestions, the list), one page so de-duplication is
 * deterministic (UI9-IMAGES DECISIONS 21/22). A stop listed more than once (in two saved days, a suggestion and the list)
 * keeps its ①② file for the first listing only: a repeat moves on to its next candidate (a ③ stock picture of its kind),
 * and when it has none it shows the same picture again — never an information card.
 */
export function resolveStopCovers(stops: readonly Stop[], ctx: CoverContext): ResolvedCover[] {
  const ctxPage = { ...ctx, page: ctx.page ?? createCoverPage() };
  const first = new Map<string, ResolvedCover>();
  const seen = new Map<string, number>();
  return stops.map(stop => {
    const item = stopCoverItem(stop);
    const key = `${item.kind}:${item.id}`;
    const repeat = seen.get(key) ?? 0;
    seen.set(key, repeat + 1);
    if (!repeat) {
      const cover = getCover(item, ctxPage);
      first.set(key, cover);
      return cover;
    }
    const again = getCover({ ...item, id: `${item.id}#${repeat}` }, ctxPage);
    return again.tier === 'type' ? first.get(key)! : again;
  });
}
