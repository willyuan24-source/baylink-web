import './ui.css';
import { ProvenanceBadge, Sticker, type StickerTone } from './Badges';
import { cx, useUiCopy } from './ui-copy';
import { offerBrandLine } from './offer-brand';
import { SegmentedTitle } from '../SegmentedTitle';
import type { CoverRatio } from './CoverImage';
import { translateText } from '../../i18n/locale';
import { typeCoverProvenance } from '../../lib/image-provenance';
import {
  eventDateChip, eventPlace, eventPriceChip, eventShortTitle, eventTone, formatDateChip, offerDeadline, offerKindLabel,
  offerTone, offerValue, openingChip, toneLabel, type Copy, type CoverTone, type DateChipText, type EventFactsInput, type OfferFactsInput,
} from '../../lib/event-facts';
import type { SeptemberOpening } from '../../data/september-openings';

/**
 * H12 / SV13-02: each tone has its own small set of drawn spot illustrations (public/default-covers/art/*.svg, drawn for BAYLINK as
 * vector shapes, no AI and no real venue), shown as an alpha mask in the tone's ink, instead of one faded UI icon on every
 * card. A tone has two or three drawings; the item picks one by a stable hash of its id, so neighbours of one tone rarely
 * match. A few item keys have their own drawings (a shop front, a shopping bag or a coffee punch card for offers and shops,
 * a clipboard for health, an ID card for documents, a bicycle for getting around, a house for housing guides).
 */
const TONE_ART: Record<CoverTone, readonly string[]> = {
  family: ['family-1', 'family-2', 'family-3'], culture: ['culture-1', 'culture-2', 'culture-3'], outdoors: ['outdoors-1', 'outdoors-2'],
  food: ['food-1', 'food-2'], seniors: ['seniors-1', 'seniors-2'], free: ['free-1', 'free-2'],
};
const KEY_ART: Readonly<Record<string, readonly string[]>> = {
  store: ['store', 'store-2', 'store-3'], book: ['clipboard'], landmark: ['idcard'], bike: ['bike'], music: ['culture-2'], film: ['culture-2'], dog: ['outdoors-1'],
};
/** FNV-1a: a stable number per item (its drawing), the same on the server and in the browser. */
const variantOf = (seed: string) => { let hash = 0x811c9dc5; for (let index = 0; index < seed.length; index++) hash = Math.imul(hash ^ seed.charCodeAt(index), 0x01000193) >>> 0; return hash; };
/** The drawing belongs to the item (its `iconKey` or its own category), not to a rotated neighbour palette. */
function artFor(tone: CoverTone, family: TypeCoverProps['family'], key: string | undefined, seed: string): string {
  if (key === 'store' && family === 'guide') return 'home';
  const set = key && Object.hasOwn(KEY_ART, key) ? KEY_ART[key] : key && Object.hasOwn(TONE_ART, key) ? TONE_ART[key as CoverTone] : TONE_ART[tone];
  return set[variantOf(seed) % set.length];
}
const HAN = /[\u3400-\u9fff]/;

export type TypeCoverProps = {
  tone: CoverTone;
  /** `guide`: family C, a guide without a qualifying photo (topic palette, short title, source count). */
  family?: 'event' | 'offer' | 'opening' | 'guide';
  /** The truthful category label, already localized ("亲子活动"); '' when the page header already names it (a detail band). */
  label: string;
  date?: DateChipText;
  title?: string;
  /** Offer value ("免费", "7 折"), brand and condition line. */
  value?: string;
  /** A short condition set small after the value ("with purchase"), so a long English value stays one big word. */
  valueSmall?: string;
  brand?: string;
  note?: string;
  place?: string;
  sticker?: { tone: StickerTone; text: string };
  icon?: string;
  /** Picks the tone's drawing (the item id); defaults to the title, then the label. */
  seed?: string;
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
export function TypeCover({ tone, family = 'event', label, date, title, value, valueSmall, brand, note, place, sticker, icon, seed, ratio, ratioLock, size, ariaHidden, className }: TypeCoverProps) {
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
  if (size === 'mini') return <div {...common} data-size="mini"><div className="ui-type-cover__body">{dateParts ?? <p className="ui-type-cover__label">{label}</p>}</div></div>;
  return <div {...common}>
    <span className="ui-type-cover__art" data-art={artFor(tone, family, icon, seed || title || label || tone)} aria-hidden="true" />
    <ProvenanceBadge label={typeCoverProvenance(english)} />
    <div className="ui-type-cover__body">
      {label && <p className="ui-type-cover__label">{label}</p>}
      {dateParts}
      {value && <p className="ui-type-cover__value"><span>{value}</span>{valueSmall && <span className="ui-type-cover__value-small">{valueSmall}</span>}</p>}
      {brand && <p className="ui-type-cover__brand" lang={HAN.test(brand) ? undefined : 'en'} translate="no">{brand}</p>}
      {title && <p className="ui-type-cover__title" lang={HAN.test(title) ? undefined : 'en'}><SegmentedTitle text={title} /></p>}
      {note && <p className="ui-type-cover__note">{note}</p>}
      {(place || sticker) && <div className="ui-type-cover__footer">
        <span className="ui-type-cover__place">{place}</span>
        {sticker && <Sticker tone={sticker.tone}>{sticker.text}</Sticker>}
      </div>}
    </div>
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
    place={eventPlace(event)} sticker={price ? { tone: price.tone, text: pick(price.text) } : undefined} icon={event.iconKey ?? ownTone} seed={event.id} />;
}

/**
 * Family B: the value large, the brand in normal case and a deadline sticker. Every offer cover sits on a card whose caption
 * carries the full title, so the cover does not repeat it (cut short inside a 1:1 cover it read "Concord Taco Tra…", PROD-W3).
 */
export function OfferTypeCover({ offer, today, tone, ...layout }: CoverLayout & { offer: OfferFactsInput; today: string }) {
  const { pick, locale } = useUiCopy();
  const value = offerValue(offer);
  const deadline = offerDeadline(offer, today);
  return <TypeCover {...layout} family="offer" tone={tone ?? offerTone(offer)} label={pick(offerKindLabel(offer))}
    value={value ? pick(value) : undefined} valueSmall={value?.condition ? pick(value.condition) || undefined : undefined} brand={offerBrandLine(offer.brand, locale) || undefined}
    sticker={deadline ? { tone: deadline.tone, text: pick(deadline.text) } : undefined} icon={offerTone(offer) === 'free' ? 'free' : 'store'} seed={(offer as { id?: string }).id ?? offer.title} ratio={layout.ratio ?? '1:1'} />;
}

const OPENING_LABELS: Record<SeptemberOpening['openingType'], Copy> = {
  'new-restaurant': { zh: '新开餐厅', en: 'New restaurant' },
  'new-store': { zh: '新店', en: 'New shop' },
  relocation: { zh: '搬新址', en: 'New location' },
  reopening: { zh: '重新开业', en: 'Reopened' },
  'extended-pop-up': { zh: '快闪店', en: 'Pop-up' },
  'opening-celebration': { zh: '开业活动', en: 'Opening celebration' },
};
/**
 * Openings: type, name, city and an honest opening chip ("10 月开业" / "即将开业"). Never AI food. `compact`: the type only,
 * for a detail page whose header already shows the name, the city and the chip.
 */
export function OpeningTypeCover({ opening, today, tone, compact, ...layout }: CoverLayout & { opening: Pick<SeptemberOpening, 'name' | 'city' | 'status' | 'openedOn' | 'openingType'>; today: string; compact?: boolean }) {
  const { pick } = useUiCopy();
  const restaurant = opening.openingType === 'new-restaurant';
  return <TypeCover {...layout} family="opening" tone={tone ?? (restaurant ? 'food' : 'family')}
    label={pick(OPENING_LABELS[opening.openingType])} title={compact ? undefined : opening.name} place={compact ? undefined : opening.city}
    sticker={compact ? undefined : { tone: opening.status === 'open' ? 'success' : 'neutral', text: pick(openingChip(opening, today)) }} icon={restaurant ? 'food' : 'store'} seed={opening.name} />;
}
