import catalog from '../data/generated/home-catalog.json';
import type { Guide } from '../data/guides';
import type { GuideImage } from '../data/guide-media';
import type { MonthlyEvent } from '../data/monthly-types';
import type { FreebieOffer } from '../components/FreebieBoard';

export type HomeGuide = Pick<Guide, 'slug' | 'title' | 'summary' | 'categoryLabel' | 'readMinutes'> & { media: { cover: GuideImage } };
export const guides = catalog.guides as HomeGuide[];
export const guideCount = catalog.guideCount;
export const getGuideBySlug = (slug: string) => guides.find(guide => guide.slug === slug);
export const getGuideMedia = (guide: HomeGuide) => guide.media;
export const MONTHLY_EVENTS = catalog.events as MonthlyEvent[];
export const MONTHLY_EDITION = catalog.edition;
export const HOME_WEEKENDS = catalog.weekends;
export const HOME_GENERATED_AT = catalog.generatedAt;
export const currentFreebies = catalog.offers as FreebieOffer[];
export const GUIDE_IMAGES = catalog.images as Record<string, GuideImage>;
