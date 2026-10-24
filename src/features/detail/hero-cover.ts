import { coverItemFor, getCover, type CoverPage, type ImageCover, type ResolvedCover } from '../../lib/cover';
import { getImageProvenance } from '../../lib/image-provenance';
import type { DetailRecord, RailCard } from './detail-record';

/** A credit or licence URL the page may link: https only (DetailHero's credit line and PageCredits). */
export const webLink = (value: string | undefined): value is string => !!value && /^https:\/\//.test(value);

/**
 * DECISIONS 43(b) (captain 10-23): venue photos the B2 approval cleared for "cards and rows only" (items 31–33: small or
 * lettering-led) never become a detail page's hero, the listing's own image included; the hero falls to the next candidate
 * (build-detail.ts nextCandidate), else the type cover. Rail cards may still show them.
 * The same keys are close-up-faces.ts WEAK_LEAD_SCENES on main (UI9-IMG-B2-REGISTER); R2-INT may read that set instead.
 */
export const CARDS_ONLY_PHOTOS: ReadonlySet<string> = new Set([
  'venue-smcl-brisbane-library', // Brisbane Library: 1250 × 598, too small for a hero
  'venue-smcl-atherton-library', // Atherton Library: the entrance lettering is the subject
  'venue-sjpl-calabazas-library', // Calabazas Branch: a wall of cast names fills a third of it
]);

/** The listing's own image through the honesty ladder (lib/cover.ts); a cards-only photo is not the hero's (DECISIONS 43(b)). */
function ownCover({ item, image }: DetailRecord, today: string): ResolvedCover {
  const id = item.kind === 'event' ? item.event.id : item.kind === 'offer' ? item.offer.id : item.shop.id;
  const own = item.kind === 'event' ? item.event.imageKey : item.kind === 'offer' ? item.offer.imageKey : item.shop.imageKey;
  const imageKey = own && CARDS_ONLY_PHOTOS.has(own) ? undefined : own;
  return getCover({ kind: item.kind, id, imageKey }, { images: key => key === imageKey ? image : undefined, today });
}

/**
 * The listing's cover: its own image through the honesty ladder, else the next candidate the build chose (`record.hero`:
 * ② venue → ③ stock → ④ approved AI; UI9-IMG-A1b, DECISIONS 21/22).
 */
export function heroCover(record: DetailRecord, today: string): ResolvedCover {
  const own = ownCover(record, today);
  if (own.tier !== 'type' || !record.hero) return own;
  const { key, image } = record.hero;
  const { item } = record;
  const id = item.kind === 'event' ? item.event.id : item.kind === 'offer' ? item.offer.id : item.shop.id;
  const cover = getCover({ kind: item.kind, id, imageKey: key }, { images: candidate => candidate === key ? image : undefined, today });
  return cover.tier === 'type' ? own : cover;
}

const DEFAULT_FOCAL = [50, 40] as const;

/**
 * An event's own venue or series photo that the ladder turned down only for its age (older than MAX_PHOTO_AGE_YEARS):
 * it may not be the cover, which reads as "this is how it looks now", but it still shows readers the building or the
 * park, lower on the page, labelled 资料图 · 年份 with its caption and credit (the page before T6 showed it under the
 * header). Theme photos, unapproved reuse, vetoed and AI images never come back this way, and offers and openings keep
 * their brand-image rule: getCover rejects those for other reasons.
 */
export function placePhoto(record: DetailRecord, today: string): ImageCover | null {
  const { item, image } = record;
  // Judged on the listing's own image: the hero may show another candidate (UI9-IMG-A1b) while this one is too old.
  const own = ownCover(record, today);
  if (item.kind !== 'event' || !image || image.kind !== 'photo' || own.tier !== 'type' || own.reason !== 'too-old') return null;
  return {
    tier: 'venue', key: item.event.imageKey, image,
    label: { zh: getImageProvenance(image, false, today), en: getImageProvenance(image, true, today) },
    fit: image.fullFrame ? 'contain' : 'cover',
    focal: image.focal ?? DEFAULT_FOCAL,
  };
}

/** Each rail card's cover, claimed on the page (the hero's photo is never repeated, VISUAL-10); the page credits list them too. */
export function railCovers(cards: readonly RailCard[], today: string, page: CoverPage): ResolvedCover[] {
  return cards.map(({ event }) => {
    const key = event.coverKey ?? event.imageKey;
    return getCover(coverItemFor('event', { id: event.id, imageKey: key }), { images: candidate => candidate === key ? event.image : undefined, today, page });
  });
}
