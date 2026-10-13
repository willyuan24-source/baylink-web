import { getCover, type ImageCover, type ResolvedCover } from '../../lib/cover';
import { getImageProvenance } from '../../lib/image-provenance';
import type { DetailRecord } from './detail-record';

/** The listing's cover: its own image through the honesty ladder (lib/cover.ts), or a TypeCover. */
export function heroCover({ item, image }: DetailRecord, today: string): ResolvedCover {
  const id = item.kind === 'event' ? item.event.id : item.kind === 'offer' ? item.offer.id : item.shop.id;
  const imageKey = item.kind === 'event' ? item.event.imageKey : item.kind === 'offer' ? item.offer.imageKey : item.shop.imageKey;
  return getCover({ kind: item.kind, id, imageKey }, { images: key => key === imageKey ? image : undefined, today });
}

const DEFAULT_FOCAL = [50, 40] as const;

/**
 * An event's own venue or series photo that the ladder turned down only for its age (older than MAX_PHOTO_AGE_YEARS):
 * it may not be the cover, which reads as "this is how it looks now", but it still shows readers the building or the
 * park, lower on the page, labelled 资料图 · 年份 with its caption and credit (the page before T6 showed it under the
 * header). Theme photos, unapproved reuse, vetoed and AI images never come back this way, and offers and openings keep
 * their brand-image rule: getCover rejects those for other reasons.
 */
export function placePhoto({ item, image }: DetailRecord, cover: ResolvedCover, today: string): ImageCover | null {
  if (item.kind !== 'event' || !image || image.kind !== 'photo' || cover.tier !== 'type' || cover.reason !== 'too-old') return null;
  return {
    tier: 'venue', key: item.event.imageKey, image,
    label: { zh: getImageProvenance(image, false, today), en: getImageProvenance(image, true, today) },
    fit: image.fullFrame ? 'contain' : 'cover',
    focal: image.focal ?? DEFAULT_FOCAL,
  };
}
