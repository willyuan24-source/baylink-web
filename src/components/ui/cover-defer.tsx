import type { ComponentProps, ReactNode } from 'react';
import { PendingCover, type CoverLayout } from './CoverImage';
import { useUiCopy } from './ui-copy';
import { OfferTypeCover } from './cover-ticket';
import { GuideTypeCover } from './cover-guide';
import { OpeningTypeCover } from './cover-shop';
import { deferredFamily } from './deferred-family';
import { translateText, type Locale } from '../../i18n/locale';
import { brandCase, offerDeadline, type OfferFactsInput } from '../../lib/event-facts';

/**
 * Cover families that load after the page (UI9-C; captain decision 9: route JS ≤ base): the ticket and the headline / number
 * families where a route draws them below its first screen (home's guide rail and offer tickets, a guide's 接下来 rail), and
 * since UI9-IMG-A0 everywhere a listing draws them (/guides, the /events 免费与优惠 and 新店 boards; the date family in
 * cover-date.tsx): the info cards leave cards in A1 (UI9-IMAGES DECISIONS 21), and their JS makes room for the pictures.
 * Until the family is in, the cover shows its empty frame (same box, same ground) inside its own boundary; a failed load
 * keeps that frame. A listing that draws a family on its first screen has it before its first render: /events `prepare`
 * awaits preloadCoverFamilies for the 免费与优惠 and 新店 boards, /guides starts it as it loads, and the prerendered pages
 * preload the chunks they draw (scripts/prerender.tsx). A detail rail imports the family directly and passes it in. The detail route's offer and shop heroes load theirs with the record (DetailHero).
 *
 * Node (the prerender and the tests) and the dev server use the families as they are (`import.meta.env?.PROD`, the
 * editorial overlay's test), so a prerendered page carries the covers the browser draws; a production build keeps only the
 * loaders, and the static imports above drop out of it. The offer card's brand, line 1 and meta line live here too, so a
 * page whose tickets load after it prints them at once.
 */
// The empty frame lives with the frames (CoverImage.tsx) so the date family can use it too; still importable from here.
export { PendingCover };
const TicketFrame = (props: CoverLayout) => <PendingCover {...props} family="ticket" ratio={props.ratio ?? '1:1'} />;
const GuideFrame = (props: CoverLayout) => <PendingCover {...props} family="headline" />;
const ShopFrame = (props: CoverLayout) => <PendingCover {...props} family="shop" />;
// deferred-family.tsx: once a chunk is in, its family renders directly; a failed load keeps the empty frame. Both branches
// name the family, so the production build folds the condition and drops the static imports above.
const ticket = import.meta.env?.PROD ? deferredFamily(() => import('./cover-ticket').then(module => module.OfferTypeCover), TicketFrame) : { Family: OfferTypeCover, preload: () => Promise.resolve() };
const guide = import.meta.env?.PROD ? deferredFamily(() => import('./cover-guide').then(module => module.GuideTypeCover), GuideFrame) : { Family: GuideTypeCover, preload: () => Promise.resolve() };
const shop = import.meta.env?.PROD ? deferredFamily(() => import('./cover-shop').then(module => module.OpeningTypeCover), ShopFrame) : { Family: OpeningTypeCover, preload: () => Promise.resolve() };

/** The ticket family, loaded after the page (home's 免费与优惠, the /events 免费与优惠 board: UI9-IMG-A0). */
export const DeferredOfferTypeCover = (props: ComponentProps<typeof OfferTypeCover>) => <TicketFamily {...props} />;
const TicketFamily: (props: ComponentProps<typeof OfferTypeCover>) => ReactNode = ticket.Family;
/** The headline / number family, loaded after the page (home's guide rail, a guide's 接下来 rail, /guides: UI9-IMG-A0). */
export const DeferredGuideTypeCover = (props: ComponentProps<typeof GuideTypeCover>) => <GuideFamily {...props} />;
const GuideFamily: (props: ComponentProps<typeof GuideTypeCover>) => ReactNode = guide.Family;
/** The shop family, loaded after the page (the /events 新店 board: UI9-IMG-A0). */
export const DeferredOpeningTypeCover = (props: ComponentProps<typeof OpeningTypeCover>) => <ShopFamily {...props} />;
const ShopFamily: (props: ComponentProps<typeof OpeningTypeCover>) => ReactNode = shop.Family;
/** Loads these families' chunks before a page draws them on its first screen (/events `prepare`, /guides). */
// eslint-disable-next-line react-refresh/only-export-components
export const preloadCoverFamilies = (families: readonly ('ticket' | 'guide' | 'shop')[]): Promise<unknown> =>
  Promise.all(families.map(family => ({ ticket, guide, shop })[family].preload()));

const HAN = /[㐀-鿿]/;
/**
 * An offer's brand line as readers see it: a store name in display case and never translated ("Dunkin’"); a described brand
 * ("参与 Taco Trail 的本地餐厅") in the page's language, like the title. An English page with no translation for it gets ''
 * (the line is left out) rather than Chinese (PROD-W3: the Concord Taco Trail card read Simplified on /en and zh-Hant).
 */
export function offerBrandLine(brand: string, locale: Locale): string {
  if (!HAN.test(brand)) return brandCase(brand);
  const shown = translateText(brand, locale).trim();
  return locale === 'en' && HAN.test(shown) ? '' : shown;
}

/**
 * Line 1 of an offer card: how long it runs, in the status map's look (至 10/26 · 还剩 3 天 · 今天截止 · 长期有效; the
 * deadline's tone as Status.tsx maps it: warning → soon, danger → urgent). It lives here, not with the ticket family, so a
 * page whose tickets load after it (home) prints its cards' lines at once.
 */
export function OfferWhen({ offer, today }: { offer: Pick<OfferFactsInput, 'endDate' | 'availability'>; today: string }) {
  const { pick } = useUiCopy();
  const deadline = offerDeadline(offer, today);
  return deadline ? <span className="ui-status" data-tone={deadline.tone === 'warning' ? 'soon' : deadline.tone === 'danger' ? 'urgent' : deadline.text.en === 'Ended' ? 'ended' : 'neutral'}>{pick(deadline.text)}</span> : null;
}

/**
 * The meta line under an offer card: "brand · kind". When the card's cover is the ticket (`onCover`), the ticket already
 * prints the brand, so the line shows the kind only and keeps the brand for screen readers (the cover is decorative there).
 */
export function OfferCardMeta({ brand, kind, onCover }: { brand: string; kind: string; onCover: boolean }) {
  if (!brand) return <>{kind}</>;
  return onCover ? <><span className="sr-only" translate="no">{brand} · </span>{kind}</> : <><span translate="no">{brand}</span> · {kind}</>;
}
