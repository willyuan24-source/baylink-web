import catalog from '../data/generated/home-catalog.json';
import type { GuideImage } from '../data/guide-media';
import type { GuideTopicId } from '../data/guide-topics';
import type { MonthlyEvent } from '../data/monthly-types';
import type { Copy, CoverTone } from './event-facts';
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
  /** UI9-IMG-A1b: [own cover, ③ stock picture] when another home guide shares the cover file (①② once per page). */
  imageKeys?: readonly string[];
};
/** A weekend event with the facts a home card prints (editorial overlay fields and planning facts when present). */
export type HomeEvent = MonthlyEvent & { planning?: Pick<PlanningFacts, 'admissionUsd' | 'schedule'>; press?: true; imageKeys?: readonly string[] };

/** 长辈常用电话 (UI9-HOME): the elder intent's guides with a cover phone (scripts/generate-home-catalog.ts elderCalls). */
export type ElderCall = { slug: string; title: Copy; label: Copy; number: string; tel: string };

export const guides = catalog.guides as HomeGuide[];
export const ELDER_CALLS = ((catalog as { elderCalls?: ElderCall[] }).elderCalls ?? []) as readonly ElderCall[];
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
/** The weekend feed's 3D strip (H36): another postcard of the same world, so the page never shows one image twice. */
export const HOME_SCENE3D_STRIP = catalog.scene3dStrip as GuideImage;
/** The eight entry tiles' photos (DECISIONS 27; home-tile-photos.json): the 480 w file, its alt, credit and LQIP colour. */
export type HomeTilePhoto = Pick<GuideImage, 'src' | 'width' | 'height' | 'alt' | 'credit'> & Partial<Pick<GuideImage, 'creditUrl' | 'licenseUrl' | 'focal'>> & { lqip?: string };
export const HOME_TILES = ((catalog as { tiles?: Record<string, HomeTilePhoto> }).tiles ?? {}) as Readonly<Record<string, HomeTilePhoto>>;
