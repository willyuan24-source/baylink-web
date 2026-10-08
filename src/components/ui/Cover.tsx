import type { ReactNode } from 'react';
import './ui.css';
import { Sticker, StickerRow } from './Badges';
import { CoverImage, type CoverRatio } from './CoverImage';
import { COVER_SIZES } from './cover-sizes';
import { EventTypeCover, OfferTypeCover, OpeningTypeCover } from './TypeCover';
import { useUiCopy } from './ui-copy';
import type { ResolvedCover } from '../../lib/cover';
import { eventDateChip, eventPriceChip, formatDateChip, offerDeadline, type CoverTone, type EventFactsInput, type OfferFactsInput } from '../../lib/event-facts';
import type { SeptemberOpening } from '../../data/september-openings';

type CoverSlot = {
  /** From `getCover` / `resolveCovers`; a `type` result renders the item's TypeCover. */
  cover: ResolvedCover;
  ratio?: CoverRatio;
  ratioLock?: boolean;
  sizes?: string;
  priority?: boolean;
  /** Palette for a TypeCover from `distinctNeighbourTones`. */
  tone?: CoverTone;
  /** The card around the cover already reads the title and facts. */
  decorative?: boolean;
};

/** A resolved photo cover, or `fallback` (the item's TypeCover). Labels come from the resolver, i.e. from getImageProvenance. */
export function Cover({ cover, fallback, ratio, ratioLock, sizes = COVER_SIZES.feed, priority, decorative, ended, children }: Omit<CoverSlot, 'tone'> & { fallback: ReactNode; ended?: boolean; children?: ReactNode }) {
  const { pick } = useUiCopy();
  if (cover.tier === 'type') return <>{fallback}</>;
  return <CoverImage image={cover.image} label={pick(cover.label)} fit={cover.fit} focal={cover.focal} ratio={ratio} ratioLock={ratioLock}
    sizes={sizes} priority={priority} decorative={decorative} ended={ended}>{children}</CoverImage>;
}

/** An event cover: photo with date and price stickers, or the A2 TypeCover. */
export function EventCover({ event, today, days, tone, ...slot }: CoverSlot & { event: EventFactsInput; today: string; days?: readonly string[] }) {
  const { english, pick } = useUiCopy();
  const chip = eventDateChip(event, today, days);
  const date = formatDateChip(chip, english);
  const price = eventPriceChip(event);
  return <Cover {...slot} ended={chip.kind === 'day' && chip.ended}
    fallback={<EventTypeCover event={event} today={today} days={days} tone={tone} ratio={slot.ratio} ratioLock={slot.ratioLock} ariaHidden={slot.decorative} />}>
    <StickerRow>
      <Sticker tone="date" slot="start">{date.label}</Sticker>
      {price && <Sticker tone={price.tone} slot="end">{pick(price.text)}</Sticker>}
    </StickerRow>
  </Cover>;
}

/** An offer cover (1:1): the brand's own image with a deadline sticker, or the B TypeCover. */
export function OfferCover({ offer, today, tone, ...slot }: CoverSlot & { offer: OfferFactsInput; today: string }) {
  const { pick } = useUiCopy();
  const deadline = offerDeadline(offer, today);
  const ratio = slot.ratio ?? '1:1';
  return <Cover {...slot} ratio={ratio} fallback={<OfferTypeCover offer={offer} today={today} tone={tone} ratio={ratio} ratioLock={slot.ratioLock} ariaHidden={slot.decorative} />}>
    {deadline && <StickerRow><Sticker tone={deadline.tone} slot="start">{pick(deadline.text)}</Sticker></StickerRow>}
  </Cover>;
}

/** A new-shop cover: the shop's own image, or the opening TypeCover. */
export function OpeningCover({ opening, today, tone, ...slot }: CoverSlot & { opening: Pick<SeptemberOpening, 'name' | 'city' | 'status' | 'openedOn' | 'openingType'>; today: string }) {
  return <Cover {...slot} fallback={<OpeningTypeCover opening={opening} today={today} tone={tone} ratio={slot.ratio} ratioLock={slot.ratioLock} ariaHidden={slot.decorative} />} />;
}
