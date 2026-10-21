import { Check } from 'lucide-react';
import { COVER_SIZES, Cover, FeedCard, RowCard, StatusChip, offerBrandLine } from '../../components/ui';
import { DeferredOfferTypeCover, DeferredOpeningTypeCover } from '../../components/ui/cover-defer';
import { useUiCopy } from '../../components/ui/ui-copy';
import { translateText, type Locale } from '../../i18n/locale';
import type { ResolvedCover } from '../../lib/cover';
import { readerMonthDay } from '../../lib/event-facts';
import type { Favorite } from '../../lib/planner';
import { SaveToWeek } from '../../components/SaveToWeek';
import { TrustLine } from './EventCards';
import { OPENING_TYPES, SEP, glueSeparators, offerChip, offerCondition, offerWhen, openingSells, openingStatus, pressSourced } from './board-status';
import type { IndexOffer, IndexOpening } from './events-index-types';

/**
 * The 免费与优惠 and 新店 boards' cards (PerksView, OpeningsView; UI9-FREE). One anatomy (G18, DECISIONS 20) through C's
 * 2-line meta: the title, line 1 `when` (offer: "周日 10/25" / "至 11/11" / "长期有效"; opening: the openingChip status),
 * line 2 `meta` (offer: [status] · condition · brand; opening: city · what it sells), then the source line. On a phone at
 * 大 / 特大 and in 简洁显示 the boards list the same cards as rows (`*RowCard`).
 */
const HAN = /[\u3400-\u9fff]/;
/**
 * A record's words as a card prints them: translated first, then its own " \u00b7 " glued (SEP). The JSX layer translates a
 * Chinese string child again and would print the dictionary's ordinary-space " \u00b7 ", so the glue goes on last (N06).
 */
const shown = (text: string, locale: Locale) => glueSeparators(translateText(text, locale));

/** ♡: the one save control, the same heart as the event cards, named after the card's own title ("收藏：<title>"). */
const CoverSave = ({ favorite, title }: { favorite: Favorite; title: string }) => <SaveToWeek favorite={favorite} compact title={title} />;

/**
 * The card's source line. "官网核对 10/7" (EVENTS' TrustLine) for an official source; an item reported by the press, not
 * by the shop or organiser itself, reads "媒体报道 · 10/7 核对" (DECISIONS 17), never 官网核对.
 */
export function BoardTrust({ day, sourceLabel }: { day?: string; sourceLabel?: string }) {
  const { t } = useUiCopy();
  if (!day) return null;
  if (!pressSourced(sourceLabel)) return <TrustLine day={day} />;
  return <>{t('媒体报道', 'News report')}{SEP}{t(`${readerMonthDay(day)} 核对`, `checked ${readerMonthDay(day, true)}`)}</>;
}
/** A row has no trust slot: its source line goes in the 13 px line under the meta, after the photo's provenance words. */
function RowSource({ provenance, day, sourceLabel }: { provenance?: string; day?: string; sourceLabel?: string }) {
  if (!day && !provenance) return null;
  return <>{provenance && <>{glueSeparators(provenance)}{day && SEP}</>}{day && <span className="fb-row-trust"><Check aria-hidden="true" strokeWidth={1.75} /><BoardTrust day={day} sourceLabel={sourceLabel} /></span>}</>;
}

/**
 * Line 2 of an offer card: the one status chip (已售罄 / 今天截止 / 还剩 N 天, board-status.ts), what the offer asks of you
 * and the brand. One brand per card (OfferCardMeta's rule): when the ticket cover prints the brand, this line keeps it for
 * screen readers only.
 */
function OfferMeta({ offer, today, brandOnCover }: { offer: IndexOffer; today: string; brandOnCover: boolean }) {
  const { pick, locale } = useUiCopy();
  // The brand's own " · " ("Muir Woods · Marin") is glued too, so no wrapped line starts with "·" (N06).
  const brand = glueSeparators(offerBrandLine(offer.brand, locale));
  const chip = offerChip(offer, today);
  return <>
    {chip && <><StatusChip tone={chip.tone}>{pick(chip.text)}</StatusChip>{SEP}</>}
    {pick(offerCondition(offer))}
    {brand && (brandOnCover ? <span className="sr-only" translate="no">{SEP}{brand}</span> : <>{SEP}<span translate="no">{brand}</span></>)}
  </>;
}

/**
 * Offer card (1:1): the brand's own image, or C's ticket with the value large. ♡ on the cover saves the offer. `row` lists
 * it as a row instead (phone at 大 / 特大, 简洁显示); `simple` (简洁) drops ♡ and the provenance words there.
 */
export function OfferFeedCard({ offer, cover, today, save = true, row, simple }: { offer: IndexOffer; cover: ResolvedCover; today: string; save?: boolean; row?: boolean; simple?: boolean }) {
  const { pick, locale } = useUiCopy();
  if (row) return <OfferRowCard offer={offer} cover={cover} today={today} simple={simple} />;
  return <FeedCard title={shown(offer.title, locale)} to={`/offers/${offer.id}`}
    cover={<Cover cover={cover} kind="offer" ratio="1:1" decorative fallback={<DeferredOfferTypeCover offer={offer} today={today} ratio="1:1" ariaHidden />} />}
    when={pick(offerWhen(offer, today))} meta={<OfferMeta offer={offer} today={today} brandOnCover={cover.tier === 'type'} />}
    trust={<BoardTrust day={offer.verifiedAt} sourceLabel={offer.sourceLabel} />}
    save={save ? <CoverSave favorite={{ kind: 'offer', id: offer.id }} title={shown(offer.title, locale)} /> : undefined} />;
}

/**
 * The offer as a row (phone at 大 / 特大, 简洁显示): a 1:1 thumbnail with the key fact only, the same two lines and the
 * source line. 简洁 (`simple`) drops ♡ and the photo's provenance words: saving happens on the detail page (DECISIONS 16).
 */
export function OfferRowCard({ offer, cover, today, simple }: { offer: IndexOffer; cover: ResolvedCover; today: string; simple?: boolean }) {
  const { pick, locale } = useUiCopy();
  const thumb = <Cover cover={cover} ratio="1:1" sizes={COVER_SIZES.thumb} decorative kind="offer"
    fallback={<DeferredOfferTypeCover offer={offer} today={today} size="mini" ratio="1:1" ariaHidden />} />;
  return <RowCard title={shown(offer.title, locale)} to={`/offers/${offer.id}`} thumb={thumb}
    when={pick(offerWhen(offer, today))} meta={<OfferMeta offer={offer} today={today} brandOnCover={false} />}
    credit={<RowSource provenance={!simple && cover.tier !== 'type' ? pick(cover.label) : undefined} day={offer.verifiedAt} sourceLabel={offer.sourceLabel} />}
    trailing={simple ? undefined : <CoverSave favorite={{ kind: 'offer', id: offer.id }} title={shown(offer.title, locale)} />} />;
}

/** "Burlingame · 拉面": where the shop is and what it sells (`category` without a leading status word), else its type. */
function OpeningMeta({ opening }: { opening: IndexOpening }) {
  const { pick, locale, english } = useUiCopy();
  // English drops the leading word after translation, so "新餐厅 · 日式晚餐" reads "Japanese dinner", not the opening type.
  const sells = english ? openingSells(translateText(opening.category, locale)) : translateText(openingSells(opening.category), locale);
  const what = sells && !(english && HAN.test(sells)) ? sells : pick(OPENING_TYPES[opening.openingType]);
  return <>{shown(opening.city, locale)}{SEP}{glueSeparators(what)}</>;
}
/** Line 1 of an opening card: openingChip unchanged ("10/11 已开业", "9/4 起试营业", "即将开业"), as the one status chip. */
function OpeningWhen({ opening, today }: { opening: IndexOpening; today: string }) {
  const { pick } = useUiCopy();
  const status = openingStatus(opening, today);
  return <StatusChip tone={status.tone}>{pick(status.text)}</StatusChip>;
}

/**
 * New shop card (1:1): the shop's own image, or C's shopfront (what it sells and the opening day, never the name). `row` and
 * `simple` as on the offer card.
 */
export function OpeningFeedCard({ opening, cover, today, save = true, row, simple }: { opening: IndexOpening; cover: ResolvedCover; today: string; save?: boolean; row?: boolean; simple?: boolean }) {
  const { locale } = useUiCopy();
  if (row) return <OpeningRowCard opening={opening} cover={cover} today={today} simple={simple} />;
  return <FeedCard title={shown(opening.name, locale)} to={`/openings/${opening.id}`} titleLang={HAN.test(opening.name) ? undefined : 'en'}
    cover={<Cover cover={cover} kind="opening" ratio="1:1" decorative fallback={<DeferredOpeningTypeCover opening={opening} today={today} ratio="1:1" ariaHidden />} />}
    when={<OpeningWhen opening={opening} today={today} />} meta={<OpeningMeta opening={opening} />}
    trust={<BoardTrust day={opening.verifiedAt} sourceLabel={opening.sourceLabel} />}
    save={save ? <CoverSave favorite={{ kind: 'opening', id: opening.id }} title={shown(opening.name, locale)} /> : undefined} />;
}

/** The new shop as a row (phone at 大 / 特大, 简洁显示); 简洁 drops ♡ and the provenance words. */
export function OpeningRowCard({ opening, cover, today, simple }: { opening: IndexOpening; cover: ResolvedCover; today: string; simple?: boolean }) {
  const { pick, locale } = useUiCopy();
  const thumb = <Cover cover={cover} ratio="1:1" sizes={COVER_SIZES.thumb} decorative kind="opening"
    fallback={<DeferredOpeningTypeCover opening={opening} today={today} size="mini" ratio="1:1" ariaHidden />} />;
  return <RowCard title={shown(opening.name, locale)} to={`/openings/${opening.id}`} titleLang={HAN.test(opening.name) ? undefined : 'en'} thumb={thumb}
    when={<OpeningWhen opening={opening} today={today} />} meta={<OpeningMeta opening={opening} />}
    credit={<RowSource provenance={!simple && cover.tier !== 'type' ? pick(cover.label) : undefined} day={opening.verifiedAt} sourceLabel={opening.sourceLabel} />}
    trailing={simple ? undefined : <CoverSave favorite={{ kind: 'opening', id: opening.id }} title={shown(opening.name, locale)} />} />;
}
