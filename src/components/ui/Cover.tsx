import { Cover, type CoverSlot } from './CoverImage';
import { useUiCopy } from './ui-copy';
import { WhenPieces } from './Card';
import { translateText, type Locale } from '../../i18n/locale';
import { brandCase, eventDateChip, eventWhenLine, offerDeadline, type EventFactsInput, type OfferFactsInput } from '../../lib/event-facts';

/**
 * The listing covers (UI9-IMAGES DECISIONS 21): an event's, an offer's and a new shop's picture through <Cover>, and the
 * card lines that go with them. Every cover is a picture (①–④, cover.ts getCover); the date, the value and the deadline are
 * the caption's lines below it, never drawn on a board, ticket or shop sign.
 */
export { Cover, type CoverSlot } from './CoverImage';

/** An event cover: its picture (an ended event desaturates). */
export function EventCover({ event, today, days, ...slot }: CoverSlot & { event: EventFactsInput; today: string; days?: readonly string[] }) {
  const chip = eventDateChip(event, today, days);
  return <Cover {...slot} kind="event" ended={chip.kind === 'day' && chip.ended} />;
}

/** An offer cover (1:1 unless the slot says otherwise). */
export function OfferCover({ cover, ratio = '1:1', ratioLock, sizes, priority, decorative }: CoverSlot & { offer?: OfferFactsInput; today?: string }) {
  return <Cover cover={cover} kind="offer" ratio={ratio} ratioLock={ratioLock} sizes={sizes} priority={priority} decorative={decorative} />;
}

/** A new shop's cover. */
export function OpeningCover({ cover, ratio, ratioLock, sizes, priority, decorative }: CoverSlot & { opening?: unknown; today?: string }) {
  return <Cover cover={cover} kind="opening" ratio={ratio} ratioLock={ratioLock} sizes={sizes} priority={priority} decorative={decorative} />;
}

/** Line 1 of an event card (G18): "周六 10/17 · 11:00–16:00" / "Sat, Oct 17 · 11am–4pm" (eventWhenLine). */
export function EventWhen({ event, today, days }: { event: Parameters<typeof eventWhenLine>[0]; today: string; days?: readonly string[] }) {
  const { pick } = useUiCopy();
  return <WhenPieces text={pick(eventWhenLine(event, today, days))} />;
}

const HAN = /[㐀-鿿]/;
/**
 * An offer's brand line as readers see it: a store name in display case and never translated ("Dunkin’"); a described brand
 * ("参与 Taco Trail 的本地餐厅") in the page's language, like the title. An English page with no translation for it gets ''
 * (the line is left out) rather than Chinese (PROD-W3: the Concord Taco Trail card read Simplified on /en and zh-Hant).
 */
// eslint-disable-next-line react-refresh/only-export-components
export function offerBrandLine(brand: string, locale: Locale): string {
  if (!HAN.test(brand)) return brandCase(brand);
  const shown = translateText(brand, locale).trim();
  return locale === 'en' && HAN.test(shown) ? '' : shown;
}

/**
 * Line 1 of an offer card: how long it runs, in the status map's look (至 10/26 · 还剩 3 天 · 今天截止 · 长期有效; the
 * deadline's tone as Status.tsx maps it: warning → soon, danger → urgent).
 */
export function OfferWhen({ offer, today }: { offer: Pick<OfferFactsInput, 'endDate' | 'availability'>; today: string }) {
  const { pick } = useUiCopy();
  const deadline = offerDeadline(offer, today);
  return deadline ? <span className="ui-status" data-tone={deadline.tone === 'warning' ? 'soon' : deadline.tone === 'danger' ? 'urgent' : deadline.text.en === 'Ended' ? 'ended' : 'neutral'}>{pick(deadline.text)}</span> : null;
}

/** The meta line under an offer card: "brand · kind" (a picture never prints the brand, so the line always does). */
export function OfferCardMeta({ brand, kind }: { brand: string; kind: string; onCover?: boolean }) {
  if (!brand) return <>{kind}</>;
  return <><span translate="no">{brand}</span> · {kind}</>;
}
