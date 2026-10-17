import type { ImageCover, ResolvedCover } from '../lib/cover';
import { translateText } from '../i18n/locale';
import { eventFor, placeFor, type Stop } from '../lib/planner-core';
import { Cover } from './ui/Cover';
import { COVER_SIZES } from './ui/cover-sizes';
import { EventTypeCover, TypeCover } from './ui/TypeCover';
import { useUiCopy } from './ui/ui-copy';

const PLACE_LABELS = {
  attraction: { zh: '景点', en: 'Place' }, restaurant: { zh: '餐饮', en: 'Dining' }, cafe: { zh: '咖啡与小食', en: 'Coffee' }, shop: { zh: '商店', en: 'Shop' },
} as const;

/** The 88px thumbnail: the stop's own photo when the ladder allows one, else its TypeCover (decorative; the row reads the title). */
/** `day`: the plan's day, so an event's information card shows the day it is planned for, not its first date. */
export function PlannerStopThumb({ stop, cover, today, day }: { stop: Stop; cover: ResolvedCover; today: string; day?: string }) {
  const { pick } = useUiCopy();
  const event = stop.kind === 'event' ? eventFor(stop.id) : undefined;
  const place = stop.kind === 'place' ? placeFor(stop.id) : undefined;
  const fallback = event ? <EventTypeCover event={event} today={today} days={day ? [day] : undefined} size="mini" ariaHidden />
    : <TypeCover tone={place?.category === 'restaurant' || place?.category === 'cafe' ? 'food' : 'outdoors'} label={pick(PLACE_LABELS[place?.category ?? 'attraction'])} size="mini" ariaHidden />;
  return <Cover cover={cover} fallback={fallback} sizes={COVER_SIZES.thumb} decorative />;
}

/**
 * The photo on a suggestion card (按条件挑选 results): the stop's own photo when the ladder (and the page's one-photo-once
 * pass) allows one, else nothing — the card's title, date and cost already say what the stop is, so a suggestion never
 * shows a stand-in picture.
 */
export function PlannerOptionCover({ cover }: { cover?: ResolvedCover }) {
  if (!cover || cover.tier === 'type') return null;
  return <div className="planner-option-media"><Cover cover={cover} fallback={null} ratio="16:9" sizes={COVER_SIZES.single} decorative /></div>;
}

/**
 * 本页图片来源: who made each photo on the page and under which licence (the badge on a cover says what it is; credit and
 * licence sit here, as on the events column). Information cards and the 3D postcards' own captions need no credit line.
 */
export function PlannerImageCredits({ covers }: { covers: readonly ResolvedCover[] }) {
  const { t, pick, locale } = useUiCopy();
  const seen = new Set<string>();
  const images = covers.filter((cover): cover is ImageCover => cover.tier !== 'type' && !seen.has(cover.image.src) && !!seen.add(cover.image.src));
  if (!images.length) return null;
  return <details className="planner-credits">
    <summary>{t(`本页图片来源（${images.length}）`, `Image credits (${images.length})`)}</summary>
    <ul>{images.map(cover => <li key={cover.image.src}>
      <span>{pick(cover.label)}</span>
      {cover.image.creditUrl ? <a href={cover.image.creditUrl} target="_blank" rel="noopener noreferrer">{translateText(cover.image.credit, locale)}</a> : <span>{translateText(cover.image.credit, locale)}</span>}
      {cover.image.licenseUrl && <a href={cover.image.licenseUrl} target="_blank" rel="noopener noreferrer">{t('许可', 'License')}</a>}
    </li>)}</ul>
  </details>;
}
