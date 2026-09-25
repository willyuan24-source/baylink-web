import assets from '../../data/regional-landmark-photo-assets.json';
import type { GuideImage } from '../../data/guide-media';
import { translateText, type Locale } from '../../i18n/locale';

/** Region-scoped venue photographs; never substitute a nearby place or shared guide cover. */
export function getRegionalLandmarkPhoto(region: string, id: string, locale: Locale): GuideImage | undefined {
  const asset = assets.find(photo => photo.key === `${region}:${id}`);
  if (!asset) return undefined;
  return {
    ...asset,
    kind: 'photo',
    alt: locale === 'en' ? asset.altEn : translateText(asset.alt, locale),
    caption: locale === 'en' ? asset.captionEn : translateText(asset.caption, locale),
    credit: locale === 'en' ? asset.creditEn : translateText(asset.credit, locale),
  };
}
