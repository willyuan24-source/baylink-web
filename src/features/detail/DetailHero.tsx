import { lazy } from 'react';
import { Cover, CoverImage, COVER_SIZES, EventTypeCover } from '../../components/ui';
import { OfferTypeCover } from '../../components/ui/cover-ticket';
import { OpeningTypeCover } from '../../components/ui/cover-shop';
import { useUiCopy } from '../../components/ui/ui-copy';
import { routePathname } from '../../app/route-table';
import { translateText } from '../../i18n/locale';
import type { ImageCover, ResolvedCover } from '../../lib/cover';
import type { EventFactsInput } from '../../lib/event-facts';
import type { DetailRecord } from './detail-record';
import { offerBrand } from './reader-text';

export const webLink = (value: string | undefined): value is string => !!value && /^https:\/\//.test(value);

// This route also serves offers and new shops: their families load with the record (the page module asks for the record
// before React renders, and this module asks for the family of the page it boots on beside it), not in the route's own JS,
// so an event page carries only the calendar page it draws. The hero has no boundary of its own: the page waits for the
// family as it waits for the record. A failed load leaves the empty frame. Node (the prerender, the tests) and the dev
// server use the families as they are (cover-defer.tsx).
const loadTicket = () => import('../../components/ui/cover-ticket'), loadShop = () => import('../../components/ui/cover-shop');
const emptyHero = () => ({ default: () => <div className="ui-type-cover" data-cover="type" data-ratio="16:9" data-ratio-lock="" aria-hidden="true" /> });
const Ticket = import.meta.env?.PROD ? /* @__PURE__ */ lazy(() => loadTicket().then(module => ({ default: module.OfferTypeCover }), emptyHero)) : OfferTypeCover;
const Shop = import.meta.env?.PROD ? /* @__PURE__ */ lazy(() => loadShop().then(module => ({ default: module.OpeningTypeCover }), emptyHero)) : OpeningTypeCover;
if (typeof window !== 'undefined') {
  const boot = /^\/(offers|openings)\//.exec(routePathname(window.location.pathname))?.[1];
  if (boot) (boot === 'offers' ? loadTicket : loadShop)().catch(() => { /* the hero shows its empty frame */ });
}

/**
 * The detail hero (EVT11-03, SV-05; design.md §4.9): the first thing on the page, 16:9 full-bleed on a phone and the main
 * column's eight grid columns on a desktop (local-discovery-detail.css). A photo shows its provenance chip (posters whole on
 * their board, never cropped or blurred) and, under it, the 13 px credit line (G13). With no qualifying image the listing's
 * family cover (UI9-C) fills the same frame and prints what the H1 and the chips do not; a type cover has no credit line.
 * It is the page's largest image, so it loads eagerly; ended events are desaturated.
 */
export function DetailHero({ record, cover, today, ended }: { record: DetailRecord; cover: ResolvedCover; today: string; ended: boolean }) {
  const { item } = record;
  const { locale } = useUiCopy();
  const slot = { ratio: '16:9' as const, ratioLock: true };
  const fallback = item.kind === 'event' ? <EventTypeCover event={item.event as EventFactsInput} today={today} {...slot} />
    : item.kind === 'offer' ? <Ticket offer={{ ...item.offer, brand: offerBrand(item.offer.brand, locale) }} today={today} {...slot} />
    : <Shop opening={item.shop} today={today} {...slot} />;
  return <figure className="detail-hero" data-tier={cover.tier}>
    <Cover cover={cover} {...slot} kind={item.kind} sizes={COVER_SIZES.detail} priority ended={ended} fallback={fallback} />
    {cover.tier !== 'type' && <figcaption><HeroCredit cover={cover} /></figcaption>}
  </figure>;
}

/** The venue's archive photo below the summary (hero-cover.ts placePhoto), with its badge and the same credit line. */
export function DetailPlacePhoto({ photo }: { photo: ImageCover }) {
  const { pick } = useUiCopy();
  return <figure className="detail-photo">
    <CoverImage image={photo.image} label={pick(photo.label)} fit={photo.fit} focal={photo.focal} ratio="3:2" sizes={COVER_SIZES.detail} />
    <figcaption><HeroCredit cover={photo} /></figcaption>
  </figure>;
}

/**
 * The credit line under a photo (G13): its provenance label first (ink-2), then the linked credit, then 图片授权; 13 px, ink-3,
 * at most two lines on a phone. The long caption stays in the source section (HeroCaption). Nothing for a type cover.
 */
export function HeroCredit({ cover }: { cover: ResolvedCover }) {
  const { t, pick, locale } = useUiCopy();
  if (cover.tier === 'type') return null;
  const { image } = cover;
  const credit = translateText(image.credit, locale);
  return <span className="detail-credit">
    <span className="detail-credit__label">{pick(cover.label)}</span>
    {credit && (webLink(image.creditUrl) ? <a href={image.creditUrl} target="_blank" rel="noopener noreferrer">{credit}</a> : <span>{credit}</span>)}
    {webLink(image.licenseUrl) && <a href={image.licenseUrl} target="_blank" rel="noopener noreferrer" data-simple="hide">{t('图片授权', 'License')}</a>}
  </span>;
}
