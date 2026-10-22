import { useMemo, useState, type MouseEvent } from 'react';
import { Check, Heart } from 'lucide-react';
import { EventCover, OfferCover, OpeningCover, Cover, EventWhen, OfferWhen } from '../../components/ui/Cover';
import { useRowCredit } from '../../components/ui/CoverImage';
import { FeedCard, RowCard } from '../../components/ui/Card';
import { StatusChip } from '../../components/ui/Status';
import { COVER_SIZES } from '../../components/ui/cover-sizes';
import { useBayBayCopy } from './copy';
import { translateText } from '../../i18n/locale';
import { brandCase, eventPlace, eventPriceChip, openingChip } from '../../lib/event-facts';
import { useSimpleDisplay } from '../../lib/reading-preferences';
import { bayBayCardCitations, bayBayCardModels, type BayBayCardModel } from './answer-cards';
import { cardCheck } from './card-check';
import { useBayBayOwner } from './save-context';
import { SAVE_ERROR_COPY, useSave, type ServerSaveKind } from '../../lib/saves';
import type { PlannerWebResult } from '../../lib/planner-web-search';
import type { BayBayQuickCard } from '../../lib/baybay-stream';
import { GUIDE_CATEGORY_TABS, type GuideCategory } from '../../data/guides';

type Navigate = (path: string) => void;
type Sources = PlannerWebResult['sources'];
type Copy = { zh: string; en: string };

/**
 * A guide card's type is the guide's own category as the /guides tabs name it (api-bb-8 handoff): a walk or city guide
 * reads 城市指南, never 办事指南 (API-BB-7 live check: Coyote Hills and Chinatown read 办事指南). The api's card
 * `typeLabel` covers only place-guide cards; the site's own category covers every guide card. Chinese is the tab label
 * itself; English is the site dictionary's entry for that label, written here so the card never waits for a guide
 * scope (tests/baybay-plan-stops keeps both equal to /guides). Practical categories stay 办事指南.
 */
const GUIDE_TYPE_EN: Partial<Record<GuideCategory, string>> = {
  city: 'City guides', events: 'Local activities', commute: 'Commuting', education: 'Schools & districts', safety: 'Safety and scam prevention',
};
function guideTypeLabel(category: GuideCategory): Copy {
  const tab = GUIDE_CATEGORY_TABS.find(item => item.id === category), en = GUIDE_TYPE_EN[category];
  return tab && en ? { zh: tab.label, en } : { zh: '办事指南', en: 'How-to guide' };
}

/**
 * The card's two meta lines (G18, one card anatomy site-wide): line 1 is C's `eventWhenLine` (the date and the whole
 * start–end time) or an offer's deadline; line 2 is the status · the place (an event's 免费 / 部分免费 from C's status
 * table, its venue or city), an offer's brand, an opening's chip · city, a guide's type. Neither line is cut.
 */
function CardWhen({ model, today }: { model: BayBayCardModel; today: string }) {
  if (model.kind === 'event') return <EventWhen event={model.event} today={today} days={model.day ? [model.day] : []} />;
  if (model.kind === 'offer') return <OfferWhen offer={model.offer} today={today} />;
  return null;
}
function CardMeta({ model, today }: { model: BayBayCardModel; today: string }) {
  const { pick, locale } = useBayBayCopy();
  if (model.kind === 'event') {
    const price = eventPriceChip(model.event), place = translateText(eventPlace(model.event), locale);
    const status = price && (price.tone === 'free' || price.tone === 'mixed') ? pick(price.text) : null;
    return <span className="bb-card__meta">{status && <StatusChip>{status}</StatusChip>}{status && place && ' · '}{place}</span>;
  }
  if (model.kind === 'offer') return <span className="bb-card__meta" translate="no">{brandCase(model.offer.brand)}</span>;
  if (model.kind === 'opening') return <span className="bb-card__meta">{[pick(openingChip(model.shop, today)), translateText(model.shop.city, locale)].filter(Boolean).join(' · ')}</span>;
  return <span className="bb-card__meta">{pick(guideTypeLabel(model.guide.category))}</span>;
}

/** A card's 3:2 picture (UI9-IMAGES DECISIONS 21: answer-cards.ts resolves every card to one of the four tiers). */
function CardCover({ model, today }: { model: BayBayCardModel; today: string }) {
  const slot = { cover: model.cover, ratio: '3:2' as const, ratioLock: true, decorative: true, sizes: '264px' };
  if (model.kind === 'event') return <EventCover {...slot} event={model.event} today={today} days={model.day ? [model.day] : []} />;
  if (model.kind === 'offer') return <OfferCover {...slot} offer={model.offer} today={today} />;
  if (model.kind === 'opening') return <OpeningCover {...slot} opening={model.shop} today={today} />;
  return <Cover {...slot} kind="guide" />;
}

/** A row card's thumbnail, as EVENTS' EventRowCard builds it: the picture (a ①② badge moves to the row's credit line). */
function RowThumb({ model }: { model: BayBayCardModel; today?: string }) {
  const slot = { cover: model.cover, ratio: '1:1' as const, sizes: COVER_SIZES.thumb, decorative: true };
  return <Cover {...slot} kind={model.kind === 'event' || model.kind === 'offer' || model.kind === 'opening' ? model.kind : 'guide'} />;
}

/** The listing a card saves, in the one save model's kinds (D19): events, offers, openings and guides. */
const saveRef = (model: BayBayCardModel): { kind: ServerSaveKind; id: string } =>
  model.kind === 'event' ? { kind: 'event', id: model.event.id } : model.kind === 'offer' ? { kind: 'offer', id: model.offer.id }
    : model.kind === 'opening' ? { kind: 'opening', id: model.shop.id } : { kind: 'guide', id: model.guide.slug };

/**
 * ♡ on the card's cover through SAVES' `useSave` (src/lib/saves.ts): the same heart (F's .ui-save), store and names as
 * every card on the site ("收藏：…" / "已收藏：…"), so a save here is the row My Week shows. Disabled while a signed-in list
 * is still unknown; a failed write says so under the card.
 */
function CardSave({ model }: { model: BayBayCardModel }) {
  const { t, english, locale } = useBayBayCopy();
  const owner = useBayBayOwner();
  const ref = saveRef(model);
  const save = useSave(ref.kind, ref.id, { userId: owner ?? null });
  const [tapped, setTapped] = useState(false);
  const saved = !!save.saved, unknown = save.saved === null;
  const error = tapped ? save.error : null;
  return <>
    <button type="button" className="ui-save bb-card__save" aria-pressed={unknown ? undefined : saved} disabled={unknown || save.busy} onClick={() => { setTapped(true); void save.toggle(); }}
      aria-label={`${saved ? t('已收藏', 'Saved') : t('收藏', 'Save')}${english ? ': ' : '：'}${translateText(model.title, locale)}`}>
      <Heart aria-hidden="true" strokeWidth={1.75} />
    </button>
    {error && <p className="bb-card__error" role="alert">{t(SAVE_ERROR_COPY[error].zh, SAVE_ERROR_COPY[error].en)}</p>}
  </>;
}

/**
 * The answer's cards on the shared Card (one card anatomy, captain decision 20): a 3:2 cover with C's provenance label and
 * ♡ on it, the title (card size, 600, never cut), line 1 · line 2 and the ✓ line. A rail on a phone at 标准 / 大; the cards
 * stack at 特大 (no sideways scroller); in 简洁显示 they are row cards (a 1:1 thumbnail, no ♡: saving is on the detail page),
 * at most 2. BayBay cards carry no 加入这天计划 (captain decision 16): it stays on the detail bar and the calendar rows.
 */
export function BayBayCardRailView({ cards, sources = [], today, onNavigate, label }: { cards: readonly BayBayQuickCard[]; sources?: Sources; today: string; onNavigate: Navigate; label?: string }) {
  const { t, english, locale } = useBayBayCopy();
  const rowCredit = useRowCredit();
  const simple = useSimpleDisplay();
  const models = useMemo(() => bayBayCardModels(cards, today), [cards, today]);
  const citations = useMemo(() => bayBayCardCitations(models, sources), [models, sources]);
  if (!models.length) return null;
  const shown = simple ? models.slice(0, 2) : models;
  return <ul className="bb-cards" data-count={shown.length} data-layout={simple ? 'rows' : 'rail'} aria-label={label || t('相关活动与去处', 'Related events and places')}>
    {shown.map(model => {
      const cited = citations.get(model.key);
      const href = `${locale === 'zh-Hans' ? '' : `/${locale}`}${model.url}`;
      // The shared Card hands its click event to `onOpen` (CardTitleLink's onClick): BayBay keeps the reader in the app and
      // closes the panel through onNavigate instead of a full page load; a modified click opens a new tab as usual
      // (tests/ui9-bb-panel pins it). Without an event (a future Card that drops it) the link simply loads.
      const open = (event?: MouseEvent<HTMLAnchorElement>) => {
        if (!event || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
        event.preventDefault();
        onNavigate(model.url);
      };
      const title = translateText(model.title, locale);
      // The [n] of the source that is this card's own page, on C's number plate at the start of line 1 (the cover's corner
      // carries its provenance label).
      const plate = cited !== undefined && [<span key="n" className="ui-plate bb-card__n" aria-hidden="true">{cited}</span>, <span key="sr" className="sr-only">{t(`来源 ${cited}：`, `Source ${cited}: `)}</span>];
      const when = model.kind === 'event' || model.kind === 'offer' ? <span className="bb-card__when">{plate}<CardWhen model={model} today={today} /></span> : undefined;
      const meta = <span className="bb-card__line">{!when && plate}<CardMeta model={model} today={today} /></span>;
      const check = cardCheck(model, t, english);
      const ended = model.ended && <p className="bb-card__ended">{t('已结束 · 仅供参考', 'Ended · reference only')}</p>;
      // 简洁显示's row card has no trust slot (C's RowCard): the ✓ line closes the meta paragraph as its own line, and the
      // photo's provenance is the row's credit line, as on every row card (covers.css hides the thumbnail's chip there).
      const rowMeta = <>{meta}{check && <span className="bb-card__check"><Check aria-hidden="true" strokeWidth={1.75} />{check}</span>}</>;
      return <li key={model.key} className="bb-card" data-kind={model.kind} data-card-key={model.key}>
        {simple ? <RowCard title={title} href={href} onOpen={open} heading="h4" titleLang={english ? 'en' : undefined}
          thumb={<RowThumb model={model} today={today} />} when={when} meta={rowMeta} credit={rowCredit(model.cover)} />
          : <FeedCard title={title} href={href} onOpen={open} heading="h4" titleLang={english ? 'en' : undefined}
            cover={<CardCover model={model} today={today} />} when={when} meta={meta}
            trust={check || undefined} save={model.ended ? undefined : <CardSave model={model} />} />}
        {ended}
      </li>;
    })}
  </ul>;
}
