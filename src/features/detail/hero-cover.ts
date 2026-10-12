import { getCover, type ResolvedCover } from '../../lib/cover';
import type { DetailRecord } from './detail-record';

/** The listing's cover: its own image through the honesty ladder (lib/cover.ts), or a TypeCover. */
export function heroCover({ item, image }: DetailRecord, today: string): ResolvedCover {
  const id = item.kind === 'event' ? item.event.id : item.kind === 'offer' ? item.offer.id : item.shop.id;
  const imageKey = item.kind === 'event' ? item.event.imageKey : item.kind === 'offer' ? item.offer.imageKey : item.shop.imageKey;
  return getCover({ kind: item.kind, id, imageKey }, { images: key => key === imageKey ? image : undefined, today });
}
