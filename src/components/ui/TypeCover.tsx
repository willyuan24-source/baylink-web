import { createElement } from 'react';
import { Bike, BookOpen, Dog, Film, Gift, HeartHandshake, Landmark, Music, Palette, Plane, Store, Trees, Users, UtensilsCrossed, type LucideIcon } from 'lucide-react';
import './ui.css';
import { ProvenanceBadge, Sticker, type StickerTone } from './Badges';
import { cx, useUiCopy } from './ui-copy';
import type { CoverRatio } from './CoverImage';
import { translateText } from '../../i18n/locale';
import { typeCoverProvenance } from '../../lib/image-provenance';
import {
  brandCase, eventDateChip, eventPlace, eventPriceChip, eventShortTitle, eventTone, formatDateChip, offerDeadline, offerKindLabel,
  offerTone, offerValue, openingChip, toneLabel, type Copy, type CoverTone, type DateChipText, type EventFactsInput, type OfferFactsInput,
} from '../../lib/event-facts';
import type { SeptemberOpening } from '../../data/september-openings';

const TONE_ICONS: Record<CoverTone, LucideIcon> = { family: Users, culture: Palette, outdoors: Trees, food: UtensilsCrossed, seniors: HeartHandshake, free: Gift };
/** Optional per-item texture icons (e.g. `plane` for Fleet Week). A closed list keeps the bundle small. */
const COVER_ICONS: Record<string, LucideIcon> = { plane: Plane, music: Music, book: BookOpen, film: Film, store: Store, landmark: Landmark, dog: Dog, bike: Bike };
const iconFor = (tone: CoverTone, key?: string): LucideIcon => key && Object.hasOwn(COVER_ICONS, key) ? COVER_ICONS[key] : TONE_ICONS[tone];
const HAN = /[\u3400-\u9fff]/;

export type TypeCoverProps = {
  tone: CoverTone;
  family?: 'event' | 'offer' | 'opening';
  /** The truthful category label, already localized ("亲子活动"). */
  label: string;
  date?: DateChipText;
  title?: string;
  /** Offer value ("免费", "7 折"), brand and condition line. */
  value?: string;
  brand?: string;
  note?: string;
  place?: string;
  sticker?: { tone: StickerTone; text: string };
  icon?: string;
  ratio?: CoverRatio;
  ratioLock?: boolean;
  /** 88px row thumbnail: palette and date only. */
  size?: 'mini';
  /** Hide from assistive tech when the surrounding card already reads the same facts. */
  ariaHidden?: boolean;
  className?: string;
};

/**
 * A coded cover for an item without a qualifying photo (1007 §5.3: A2 events, B offers; openings).
 * Real DOM text on a ≥4.5:1 pastel pair, so it translates, scales with Aa and never pretends to be a picture.
 * The root carries `data-cover="type"`, which the image-area probe counts as cover area, not photo area (RC-31).
 */
export function TypeCover({ tone, family = 'event', label, date, title, value, brand, note, place, sticker, icon, ratio, ratioLock, size, ariaHidden, className }: TypeCoverProps) {
  const { english } = useUiCopy();
  const dateParts = date?.big ? <p className="ui-type-cover__date">
    {date.smallFirst && <span className="ui-type-cover__date-small">{date.small}</span>}
    <span>{date.big}</span>
    {!date.smallFirst && date.small && <span className="ui-type-cover__date-small">{date.small}</span>}
  </p> : null;
  const common = {
    className: cx('ui-type-cover', className), 'data-cover': 'type', 'data-family': family, 'data-tone': tone,
    'data-ratio': ratio, 'data-ratio-lock': ratioLock ? '' : undefined, 'aria-hidden': ariaHidden || undefined,
  };
  if (size === 'mini') return <div {...common} data-size="mini">{dateParts ?? <p className="ui-type-cover__label">{label}</p>}</div>;
  return <div {...common}>
    {createElement(iconFor(tone, icon), { className: 'ui-type-cover__icon', 'aria-hidden': true, strokeWidth: 1.5 })}
    <ProvenanceBadge label={typeCoverProvenance(english)} />
    <p className="ui-type-cover__label">{label}</p>
    {dateParts}
    {value && <p className="ui-type-cover__value">{value}</p>}
    {brand && <p className="ui-type-cover__brand" lang={HAN.test(brand) ? undefined : 'en'} translate="no">{brand}</p>}
    {title && <p className="ui-type-cover__title" lang={HAN.test(title) ? undefined : 'en'}>{title}</p>}
    {note && <p className="ui-type-cover__note">{note}</p>}
    {(place || sticker) && <div className="ui-type-cover__footer">
      <span className="ui-type-cover__place">{place}</span>
      {sticker && <Sticker tone={sticker.tone}>{sticker.text}</Sticker>}
    </div>}
  </div>;
}

type CoverLayout = Pick<TypeCoverProps, 'ratio' | 'ratioLock' | 'size' | 'ariaHidden' | 'className'> & {
  /** Palette override from `distinctNeighbourTones`; the label stays the item's own category. */
  tone?: CoverTone;
};

/** The localized short title: the overlay `shortTitle`, else the dictionary's English title, else the zh short title. */
function shortTitleFor(event: EventFactsInput, english: boolean): string {
  if (!english) return eventShortTitle(event);
  const fromOverlay = event.shortTitle ? translateText(event.shortTitle, 'en') : '';
  if (fromOverlay && !HAN.test(fromOverlay)) return fromOverlay;
  return eventShortTitle({ title: translateText(event.title, 'en') });
}

/** Family A2: category, big date, short title, city and a price sticker (never 免费 unless `cost` is free). */
export function EventTypeCover({ event, today, days, tone, ...layout }: CoverLayout & { event: EventFactsInput; today: string; days?: readonly string[] }) {
  const { english, pick } = useUiCopy();
  const ownTone = eventTone(event);
  const price = eventPriceChip(event);
  return <TypeCover {...layout} family="event" tone={tone ?? ownTone} label={pick(toneLabel(ownTone))}
    date={formatDateChip(eventDateChip(event, today, days), english)} title={shortTitleFor(event, english)}
    place={eventPlace(event)} sticker={price ? { tone: price.tone, text: pick(price.text) } : undefined} icon={event.iconKey} />;
}

/** Family B: the value large, the brand in normal case, the condition line and a deadline sticker. */
export function OfferTypeCover({ offer, today, tone, ...layout }: CoverLayout & { offer: OfferFactsInput; today: string }) {
  const { english, pick } = useUiCopy();
  const value = offerValue(offer);
  const deadline = offerDeadline(offer, today);
  const title = english ? translateText(offer.title, 'en') : offer.title;
  return <TypeCover {...layout} family="offer" tone={tone ?? offerTone(offer)} label={pick(offerKindLabel(offer))}
    value={value ? pick(value) : undefined} brand={brandCase(offer.brand)} title={value ? undefined : title} note={value ? title : undefined}
    sticker={deadline ? { tone: deadline.tone, text: pick(deadline.text) } : undefined} ratio={layout.ratio ?? '1:1'} />;
}

const OPENING_LABELS: Record<SeptemberOpening['openingType'], Copy> = {
  'new-restaurant': { zh: '新开餐厅', en: 'New restaurant' },
  'new-store': { zh: '新店', en: 'New shop' },
  relocation: { zh: '搬新址', en: 'New location' },
  reopening: { zh: '重新开业', en: 'Reopened' },
  'extended-pop-up': { zh: '快闪店', en: 'Pop-up' },
  'opening-celebration': { zh: '开业活动', en: 'Opening celebration' },
};
/** Openings: type, name, city and an honest opening chip ("10 月开业" / "即将开业"). Never AI food. */
export function OpeningTypeCover({ opening, today, tone, ...layout }: CoverLayout & { opening: Pick<SeptemberOpening, 'name' | 'city' | 'status' | 'openedOn' | 'openingType'>; today: string }) {
  const { pick } = useUiCopy();
  const restaurant = opening.openingType === 'new-restaurant';
  return <TypeCover {...layout} family="opening" tone={tone ?? (restaurant ? 'food' : 'family')}
    label={pick(OPENING_LABELS[opening.openingType])} title={opening.name} place={opening.city}
    sticker={{ tone: opening.status === 'open' ? 'success' : 'neutral', text: pick(openingChip(opening, today)) }} icon={restaurant ? undefined : 'store'} />;
}
