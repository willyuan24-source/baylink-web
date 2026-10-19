import { Cover, TypeFrame, latinLang, type CoverLayout, type CoverSlot } from './CoverImage';
import { offerBrandLine } from './cover-defer';
import { useUiCopy } from './ui-copy';
import { chooseCover } from '../../lib/cover-family';
import { offerDeadline, offerTone, offerValue, readerMonthDay, type Copy, type OfferFactsInput } from '../../lib/event-facts';

export type TicketFaceProps = { value?: string; condition?: string; brand?: string; stub?: { big: string; small?: string; first?: boolean }; mini: boolean };
/** Family ticket: one perforated ticket, the value (and its condition), the brand as written, the stub on the right. */
export function TicketFace({ value, condition, brand, stub, mini }: TicketFaceProps) {
  const main = value || condition || stub?.big || brand || '';
  if (mini) return <p className="tc-thumb">{main}</p>;
  return <>
    {brand && <p className="tc-eyebrow" lang={latinLang(brand)} translate="no">{brand}</p>}
    <div className="tc-ticket">
      <p className="tc-ticket__main"><span className="tc-ticket__value tc-num">{main}</span>{value && condition && <span className="tc-ticket__cond">{condition}</span>}</p>
      {stub && <p className="tc-ticket__stub">{stub.first && stub.small && <span>{stub.small}</span>}<span className="tc-ticket__day tc-num">{stub.big}</span>{!stub.first && stub.small && <span>{stub.small}</span>}</p>}
    </div>
  </>;
}

/** What an offer asks of you (the record's `kind`; the detail page's facts print the same words). */
const OFFER_TERMS: Readonly<Record<string, Copy>> = {
  'no-purchase': { zh: '无需消费', en: 'No purchase needed' },
  reservation: { zh: '需预约或登记', en: 'Sign-up needed' },
  purchase: { zh: '需消费', en: 'Purchase required' },
  'check-terms': { zh: '条件见官方说明', en: 'See the terms' },
};

/**
 * Family ticket (offers, G9): the value and its condition, the brand as written and a stub with the deadline day. No value:
 * what the offer asks of you leads ("需消费" / "Purchase required") with the deadline on the stub; with neither, the deadline
 * day ("10/26 截止"). The caption carries the title, so the cover never repeats it.
 */
export function OfferTypeCover({ offer, today, ...layout }: CoverLayout & { offer: OfferFactsInput & { id?: string }; today: string }) {
  const { pick, locale, t, english } = useUiCopy();
  const value = offerValue(offer);
  const deadline = offerDeadline(offer, today);
  const ends = /^\d{4}-\d{2}-\d{2}$/.test(offer.endDate ?? '') ? offer.endDate! : undefined;
  // "10/26 截止" in Chinese, "Ends Oct 26" in English (the stub reads "Ends" above the day).
  const stub = ends ? { big: readerMonthDay(ends, english), small: t('截止', 'Ends'), first: english } : deadline ? { big: pick(deadline.text) } : undefined;
  const stubText = stub && (stub.first ? [stub.small, stub.big] : [stub.big, stub.small]).filter(Boolean).join(' ');
  const terms = offer.kind && Object.hasOwn(OFFER_TERMS, offer.kind) ? pick(OFFER_TERMS[offer.kind]) : undefined;
  const shown = value ? pick(value) : undefined;
  const condition = value?.condition ? pick(value.condition) || undefined : shown ? terms : undefined;
  // No value: what the offer asks of you leads and the stub keeps the deadline day; with neither, the deadline day leads.
  const lead = shown ?? terms ?? stubText;
  const brand = offerBrandLine(offer.brand, locale) || undefined;
  // The key fact is what the ticket prints: the brand, the value and the stub ("Dunkin’ · 免费 · 10/21 截止").
  const printed = [brand, lead, shown || terms ? stubText : undefined].filter(Boolean).join(' · ');
  const choice = chooseCover('offer', { tier: 'type' }, { id: offer.id ?? offer.title, value: printed || undefined, condition, place: brand });
  return <TypeFrame {...layout} ratio={layout.ratio ?? '1:1'} {...choice} kind="offer" tone={offerTone(offer)}>
    <TicketFace value={lead} condition={condition} brand={brand} stub={shown || terms ? stub : undefined} mini={layout.size === 'mini'} />
  </TypeFrame>;
}

/** An offer cover (1:1): the brand's own image, or the ticket family. */
export function OfferCover({ offer, today, ...slot }: CoverSlot & { offer: OfferFactsInput; today: string }) {
  const ratio = slot.ratio ?? '1:1';
  return <Cover {...slot} kind="offer" ratio={ratio} fallback={<OfferTypeCover offer={offer} today={today} ratio={ratio} ratioLock={slot.ratioLock} ariaHidden={slot.decorative} />} />;
}

// Line 1 and the meta line of an offer card live with the brand line in cover-defer.tsx, so a page whose tickets load after
// it prints them at once; their names stay importable from here.
export { OfferCardMeta, OfferWhen } from './cover-defer';
