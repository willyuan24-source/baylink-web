import type { GuideImage } from '../data/guide-media';

/** Provenance describes the asset, never whether the depicted event is current. */
export function getImageProvenance(image: Pick<GuideImage, 'kind' | 'credit' | 'caption'>, english = false): string {
  if (image.kind === 'illustration') return english ? 'AI illustration' : 'AI 插图';
  if (image.kind === 'poster' || /官方|official/i.test(image.credit)) return english ? 'Official image' : '官方图';
  if (/资料|往届|archive|historical/i.test(image.caption)) {
    const year = image.caption.match(/(?:19|20)\d{2}/)?.[0];
    return `${english ? 'Archive photo' : '资料图'}${year ? ` · ${year}` : ''}`;
  }
  return english ? 'Photo' : '实拍';
}
