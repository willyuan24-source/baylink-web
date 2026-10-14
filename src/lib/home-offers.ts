import type { FreebieOffer } from '../components/FreebieBoard';
import { isPublicBenefit } from './event-facts';
import { getCover, type CoverContext, type ResolvedCover } from './cover';

/** An offer as the home ticket rail needs it (scripts/generate-home-catalog.ts): no requirement text, no source URL. */
export type HomeOffer = Pick<FreebieOffer, 'id' | 'title' | 'brand' | 'startDate' | 'endDate' | 'availability' | 'kind' | 'imageKey' | 'verifiedAt' | 'region'>
  & { valueText?: string; publicBenefit?: boolean };

const addDays = (day: string, amount: number) => new Date(Date.parse(`${day}T12:00:00Z`) + amount * 86_400_000).toISOString().slice(0, 10);

/**
 * The home 免费与优惠 tickets (1007 §4.2 ⑦, HOME-13): up to `limit` offers a reader can use within the week, mixed as
 * the plan asks — ending today or tomorrow first, then one public benefit (museum free days, library and park programs) in
 * the next two weeks, then (H19) up to three with the brand's own image, then ending this week, then a second public
 * benefit, then the rest by end date; inside each step an offer with its own image comes first. The rail keeps that order,
 * with everything that ends today or tomorrow in front (a narrow rail hides its last tickets), except that the first chosen offer
 * whose image can be the wide ticket (`canLead`, a landscape image: `canLeadOfferRail`) leads it. Only
 * reviewed, dated offers: ongoing retail promotions and "check your local store" offers stay on /events?view=perks. Pure,
 * so the generator (which ships only the offers some day selects) and the page agree for every day; both pass the same
 * `offerHasPhoto` / `offerLeadsRail` predicates.
 */
export function selectHomeOffers<T extends Pick<HomeOffer, 'id' | 'brand' | 'startDate' | 'endDate' | 'availability' | 'publicBenefit'> & { verificationStatus?: string }>(offers: readonly T[], today: string, limit = 6, hasPhoto: (offer: T) => boolean = () => false, canLead: (offer: T) => boolean = () => false): T[] {
  const week = addDays(today, 6);
  const fortnight = addDays(today, 13);
  const dated = offers.filter(offer => offer.availability === 'dated' && offer.verificationStatus !== 'needs-confirmation' && !!offer.endDate && offer.endDate >= today)
    .sort((a, b) => a.endDate!.localeCompare(b.endDate!) || a.id.localeCompare(b.id));
  const usable = dated.filter(offer => (offer.startDate ?? today) <= week);
  const chosen: T[] = [];
  // One ticket per brand while others are left ("IKEA · Emeryville" and "IKEA · Bay Area" are one brand), so the rail varies.
  const brandOf = (offer: T) => offer.brand.split(/\s+[·・|]\s+/u)[0].trim().toLowerCase();
  const take = (list: readonly T[], count: number, anyBrand = false) => {
    for (const offer of list) {
      if (count <= 0 || chosen.length >= limit || chosen.includes(offer)) continue;
      if (!anyBrand && chosen.some(item => brandOf(item) === brandOf(offer))) continue;
      chosen.push(offer); count--;
    }
  };
  // A stable sort: the end-date order stays inside each group.
  const photoFirst = (list: readonly T[]) => [...list].sort((a, b) => Number(hasPhoto(b)) - Number(hasPhoto(a)));
  take(photoFirst(usable.filter(offer => offer.endDate! <= addDays(today, 1))), 2);
  const benefits = photoFirst(dated.filter(offer => isPublicBenefit(offer) && (offer.startDate ?? today) <= fortnight));
  take(benefits, 1);
  take(usable.filter(hasPhoto), 3);
  take(photoFirst(usable.filter(offer => offer.endDate! <= week)), 2);
  take(benefits, 1);
  take(photoFirst(usable), limit);
  const varied = chosen.length;
  take(usable, limit, true);
  // What ends today or tomorrow first (a third one can join in a later step), then the steps' order; a stable sort. A
  // second ticket of a brand (the last step) stays last.
  const urgent = (offer: T) => Number(offer.endDate! > addDays(today, 1) || chosen.indexOf(offer) >= varied);
  const lead = chosen.find(canLead);
  return [...(lead ? [lead] : []), ...chosen.filter(offer => offer !== lead).sort((a, b) => urgent(a) - urgent(b))];
}

/** The offer's cover on the home rail, from the images the page ships (the generator passes the full registry). */
const offerCover = (offer: Pick<HomeOffer, 'id' | 'imageKey'>, images: CoverContext['images'], today: string) =>
  getCover({ kind: 'offer', id: offer.id, imageKey: offer.imageKey }, { images, today });

/**
 * H19: the wide first ticket (3:2 on a phone, about 2:1 on a desktop) only takes a landscape image: a photo the cover crops
 * from 1.3:1, a brand image shown whole (`fit: 'contain'`) from 1.5:1, so it fills a phone's ticket and leaves at most a
 * quarter of a desktop's to its blurred copy. A square image or a banner stays a 1:1 ticket (it would sit letterboxed).
 */
export function canLeadOfferRail(cover: ResolvedCover | undefined): boolean {
  if (!cover || cover.tier === 'type') return false;
  const { width, height } = cover.image;
  if (!width || !height) return false;
  const aspect = width / height;
  return aspect >= (cover.fit === 'cover' ? 1.3 : 1.5) && aspect <= 2.4;
}

/** Whether the ladder accepts the offer's own image (the rail's photo-first steps); one test for the generator and the page. */
export const offerHasPhoto = (images: CoverContext['images'], today: string) =>
  (offer: Pick<HomeOffer, 'id' | 'imageKey'>) => offerCover(offer, images, today).tier !== 'type';

/** Whether the offer's photo can be the wide first ticket (`canLeadOfferRail`). */
export const offerLeadsRail = (images: CoverContext['images'], today: string) =>
  (offer: Pick<HomeOffer, 'id' | 'imageKey'>) => canLeadOfferRail(offerCover(offer, images, today));
