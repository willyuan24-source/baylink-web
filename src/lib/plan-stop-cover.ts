import type { CoverItem, ResolvedCover } from './cover';
import { readerMonthDay } from './event-facts';
import { typeCoverProvenance } from './image-provenance';
import { eventFor, placeFor, type SavedPlan, type Stop } from './planner-core';
import { PLAN_COVER_IMAGES, PLAN_COVER_KEYS } from './planner-source';
import { SCENE3D_POSTCARD_FOR, SCENE3D_POSTCARD_IMAGES } from '../data/scene3d-postcards';

/**
 * Covers for plan stops (行程, plan T13): one honesty ladder for the planner's list and its saved days. An event offers
 * its own listing image; a place its listing image, else its guide's cover, else (San Francisco places only) its
 * 3D-world postcard. getCover() refuses AI art and theme photos on every rung, so a place whose guide cover is an
 * illustration falls through to the postcard (labelled 3D 场景插图) or to a TypeCover.
 */
export function stopCoverItem(stop: Stop): CoverItem {
  if (stop.kind === 'event') {
    const keys = Object.hasOwn(PLAN_COVER_KEYS, stop.id) ? PLAN_COVER_KEYS[stop.id] : undefined;
    return { kind: 'event', id: stop.id, imageKey: eventFor(stop.id)?.imageKey, ...(keys ? { imageKeys: keys } : {}) };
  }
  const place = placeFor(stop.id);
  const postcardKey = SCENE3D_POSTCARD_FOR[stop.id] ?? (place?.guideSlug ? SCENE3D_POSTCARD_FOR[place.guideSlug] : undefined);
  return { kind: 'place', id: stop.id, imageKey: place?.imageKey ?? (place?.guideSlug ? `guide-cover:${place.guideSlug}` : undefined), postcardKey };
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
 * One photo once per page (rule 6) when the same stop is listed more than once — in two saved days, a suggestion and
 * the list. getCover lets an item keep its claim when it resolves again, so each repeat would show the same file; given
 * the page's covers in display order, the first occurrence keeps the photo and every later one shows its information card.
 */
export function onePhotoEach(covers: readonly ResolvedCover[]): ResolvedCover[] {
  const shown = new Set<string>();
  return covers.map(cover => {
    if (cover.tier === 'type') return cover;
    if (!shown.has(cover.image.src)) { shown.add(cover.image.src); return cover; }
    return { tier: 'type', reason: 'duplicate', rejectedKey: cover.key, label: { zh: typeCoverProvenance(false), en: typeCoverProvenance(true) } };
  });
}
