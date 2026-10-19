import { lazy, Suspense, type ComponentProps } from 'react';
import type { CoverLayout } from './CoverImage';
import { cx, useUiCopy } from './ui-copy';
import { OfferTypeCover } from './cover-ticket';
import { GuideTypeCover } from './cover-guide';
import { translateText, type Locale } from '../../i18n/locale';
import { brandCase, offerDeadline, type OfferFactsInput } from '../../lib/event-facts';
import type { CoverFamily } from '../../lib/cover-family';

/**
 * Cover families that load after the page (UI9-C; captain decision 9: route JS ≤ base): the ticket and the headline / number
 * families where a route draws them below its first screen (home's guide rail and offer tickets, a guide's 接下来 rail).
 * Until the family is in, the cover shows its empty frame (same box, same ground) inside its own boundary; a failed load
 * keeps that frame. A route that draws a family on its first screen imports it directly (cover-ticket, cover-guide) and
 * passes it in, so nothing there waits. The detail route's offer and shop heroes load theirs with the record (DetailHero).
 *
 * Node (the prerender and the tests) and the dev server use the families as they are (`import.meta.env?.PROD`, the
 * editorial overlay's test), so a prerendered page carries the covers the browser draws; a production build keeps only the
 * loaders, and the static imports above drop out of it. The offer card's brand, line 1 and meta line live here too, so a
 * page whose tickets load after it prints them at once.
 */
/** The empty frame a deferred cover shows until its family is in (same box and ground as the family's own frame). */
export function PendingCover({ family, ratio, ratioLock, size, className }: CoverLayout & { family: CoverFamily }) {
  return <div className={cx('ui-type-cover', className)} data-cover="type" data-family={family} data-ratio={ratio} data-ratio-lock={ratioLock ? '' : undefined} data-size={size} aria-hidden="true" />;
}
const TicketFrame = (props: CoverLayout) => <PendingCover {...props} family="ticket" ratio={props.ratio ?? '1:1'} />;
const GuideFrame = (props: CoverLayout) => <PendingCover {...props} family="headline" />;
// A failed load keeps the empty frame.
const Ticket = import.meta.env?.PROD ? /* @__PURE__ */ lazy(() => import('./cover-ticket').then(module => ({ default: module.OfferTypeCover }), () => ({ default: TicketFrame }))) : OfferTypeCover;
const Guide = import.meta.env?.PROD ? /* @__PURE__ */ lazy(() => import('./cover-guide').then(module => ({ default: module.GuideTypeCover }), () => ({ default: GuideFrame }))) : GuideTypeCover;

/** The ticket family, loaded after the page (home's 免费与优惠). */
export const DeferredOfferTypeCover = (props: ComponentProps<typeof OfferTypeCover>) => <Suspense fallback={<TicketFrame {...props} />}><Ticket {...props} /></Suspense>;
/** The headline / number family, loaded after the page (home's guide rail, a guide's 接下来 rail). */
export const DeferredGuideTypeCover = (props: ComponentProps<typeof GuideTypeCover>) => <Suspense fallback={<GuideFrame {...props} />}><Guide {...props} /></Suspense>;

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
