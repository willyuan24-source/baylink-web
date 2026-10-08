import type { GuideImage } from '../data/guide-media';

/** Provenance describes the asset, never whether the depicted event is current. */
export function getImageProvenance(image: Pick<GuideImage, 'kind' | 'credit' | 'caption'>, english = false): string {
  if (image.kind === 'illustration') return english ? 'AI illustration' : 'AI 插图';
  if (image.kind === 'poster' || /官方|official/i.test(image.credit)) return english ? 'Official image' : '官方图';
  // The capture year comes from the caption only: credits carry usernames and licences ("Runner1928 · CC BY-SA 3.0").
  const year = image.caption.match(/(?:19|20)\d{2}/)?.[0];
  const withYear = (label: string) => `${label}${year ? ` · ${year}` : ''}`;
  if (/资料|往届|archive|historical/i.test(image.caption)) return withYear(english ? 'Archive photo' : '资料图');
  // Third-party and press photos: "实拍" would claim BAYLINK took them (VISUAL+5).
  return withYear(english ? 'Photo' : '照片');
}
