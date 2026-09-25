import assets from '../../data/sf-landmark-photo-assets.json';
import type { GuideImage } from '../../data/guide-media';
import { translateText, type Locale } from '../../i18n/locale';

/** An explicit photograph per map anchor. Shared park guides never select this image. */
export function getSfLandmarkPhoto(id: string, locale: Locale): GuideImage | undefined {
  const asset = assets.find(photo => photo.id === id);
  if (!asset) return undefined;
  return {
    ...asset,
    kind: 'photo',
    alt: locale === 'en' ? asset.altEn : translateText(asset.alt, locale),
    caption: locale === 'en' ? asset.captionEn : translateText(asset.caption, locale),
    credit: locale === 'en' ? asset.creditEn : translateText(asset.credit, locale),
  };
}
