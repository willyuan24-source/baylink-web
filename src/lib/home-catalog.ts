import catalog from '../data/generated/home-catalog.json';
import type { GuideImage } from '../data/guide-media';
import type { GuideTopicId } from '../data/guide-topics';
import type { MonthlyEvent } from '../data/monthly-types';
import type { CoverTone } from './event-facts';
import type { HomeOffer } from './home-offers';
import type { PlanningFacts } from './planner';

/**
 * The home page's slim catalog (scripts/generate-home-catalog.ts): the weekend snapshots, the events they name, the
 * intent rail's guide summaries, the offers the ticket rail can show and the images all of them use. No article bodies,
 * plan steps or long date lines.
 */
export type HomeGuide = {
  slug: string;
  title: string;
  topic: GuideTopicId;
  /** The family C information-card palette and texture icon for this guide's topic (features/guides TOPIC_COVER). */
  tone: CoverTone;
  icon: string;
  /** Distinct official source URLs. */
  sources: number;
  readMinutes: number;
  /** The guide's cover image key in `images` (absent: the information card). */
  imageKey?: string;
};
/** A weekend event with the facts a home card prints (editorial overlay fields and planning facts when present). */
export type HomeEvent = MonthlyEvent & { planning?: Pick<PlanningFacts, 'admissionUsd' | 'schedule'> };

export const guides = catalog.guides as HomeGuide[];
export const guideCount = catalog.guideCount;
export const getGuideBySlug = (slug: string) => guides.find(guide => guide.slug === slug);
export const MONTHLY_EVENTS = catalog.events as unknown as HomeEvent[];
export const MONTHLY_EDITION = catalog.edition as { checkedAt: string; throughDate: string };
export const HOME_WEEKENDS = catalog.weekends;
export const HOME_GENERATED_AT = catalog.generatedAt;
export const HOME_OFFERS = catalog.offers as HomeOffer[];
export const GUIDE_IMAGES = catalog.images as Record<string, GuideImage>;
/** The 3D tile's key art: a postcard of BAYLINK's own 3D San Francisco (scene3d-postcards.ts), labelled 3D 场景插图. */
export const HOME_SCENE3D = catalog.scene3d as GuideImage;
