import { useMemo, useState } from 'react';
import { CalendarPlus, Heart } from 'lucide-react';
import { EventCover, OfferCover, OpeningCover, Cover } from '../../components/ui/Cover';
import { TypeCover } from '../../components/ui/TypeCover';
import { useBayBayCopy } from './copy';
import { SmartLink } from './SmartLink';
import { brandCase, eventDateChip, eventPlace, eventPriceChip, eventTimeLabel, formatDateChip, offerDeadline, openingChip } from '../../lib/event-facts';
import { bayBayCardCitations, bayBayCardModels, type BayBayCardModel } from './answer-cards';
import { useBayBayOwner } from './save-context';
import { SAVE_ERROR_COPY, useSave, type ServerSaveKind } from '../../lib/saves';
import { saveButtonName } from '../saves/save-name';
import type { PlannerWebResult } from '../../lib/planner-web-search';
import type { BayBayQuickCard } from '../../lib/baybay-stream';

type Navigate = (path: string) => void;
type Sources = PlannerWebResult['sources'];

/** One 13px meta line: 日期 · 时段 · 费用 · 城市 (events), deadline · brand (offers), opening chip · city (openings). */
function cardMeta(model: BayBayCardModel, today: string, english: boolean, pick: (copy: { zh: string; en: string }) => string): string {
  if (model.kind === 'event') {
    const chip = eventDateChip(model.event, today, model.day ? [model.day] : []);
    const time = chip.kind === 'day' ? eventTimeLabel(model.event, chip.date, english) : undefined;
    const price = eventPriceChip(model.event);
    return [formatDateChip(chip, english).label, time, price ? pick(price.text) : undefined, eventPlace(model.event)].filter(Boolean).join(' · ');
  }
  if (model.kind === 'offer') {
    const deadline = offerDeadline(model.offer, today);
    return [deadline ? pick(deadline.text) : undefined, brandCase(model.offer.brand)].filter(Boolean).join(' · ');
  }
  if (model.kind === 'opening') return [pick(openingChip(model.shop, today)), model.shop.city].filter(Boolean).join(' · ');
  return pick({ zh: '办事指南', en: 'Guide' });
}

function CardCover({ model, today }: { model: BayBayCardModel; today: string }) {
  const { pick } = useBayBayCopy();
  const slot = { cover: model.cover, ratio: '16:10' as const, ratioLock: true, decorative: true, sizes: '264px' };
  if (model.kind === 'event') return <EventCover {...slot} event={model.event} today={today} days={model.day ? [model.day] : []} />;
  if (model.kind === 'offer') return <OfferCover {...slot} offer={model.offer} today={today} />;
  if (model.kind === 'opening') return <OpeningCover {...slot} opening={model.shop} today={today} />;
  return <Cover {...slot} fallback={<TypeCover tone="culture" label={pick({ zh: '办事指南', en: 'Guide' })} title={model.title} ratio="16:10" ratioLock ariaHidden />} />;
}

/** The listing a card saves, in the one save model's kinds (D19): events, offers, openings and guides. */
const saveRef = (model: BayBayCardModel): { kind: ServerSaveKind; id: string } =>
  model.kind === 'event' ? { kind: 'event', id: model.event.id } : model.kind === 'offer' ? { kind: 'offer', id: model.offer.id }
    : model.kind === 'opening' ? { kind: 'opening', id: model.shop.id } : { kind: 'guide', id: model.guide.slug };

/**
 * ♡ 收藏 through SAVES' `useSave` (src/lib/saves.ts): the same heart, store and names as every card on the site, so a
 * save here is the row My Week shows. Disabled while a signed-in list is still unknown; a failed write says so here.
 */
function CardSave({ model }: { model: BayBayCardModel }) {
  const { t, locale } = useBayBayCopy();
  const owner = useBayBayOwner();
  const ref = saveRef(model);
  const save = useSave(ref.kind, ref.id, { userId: owner ?? null });
  const [tapped, setTapped] = useState(false);
  const saved = !!save.saved, unknown = save.saved === null;
  const error = tapped ? save.error : null;
  return <>
    <button type="button" className="bb-card__save" aria-pressed={unknown ? undefined : saved} disabled={unknown || save.busy} onClick={() => { setTapped(true); void save.toggle(); }}
      aria-label={saveButtonName(saved, model.title, locale)}>
      <Heart aria-hidden="true" size={18} fill={saved ? 'currentColor' : 'none'} />{saved ? t('已收藏', 'Saved') : t('收藏', 'Save')}
    </button>
    {error && <p className="bb-card__error" role="alert">{t(SAVE_ERROR_COPY[error].zh, SAVE_ERROR_COPY[error].en)}</p>}
  </>;
}

function CardActions({ model, onNavigate }: { model: BayBayCardModel; onNavigate: Navigate }) {
  const { t } = useBayBayCopy();
  if (model.ended) return <p className="bb-card__ended">{t('已结束 · 仅供参考', 'Ended · reference only')}</p>;
  const plan = model.kind === 'event' ? `/plan?${model.day ? `date=${model.day}&` : ''}stops=${encodeURIComponent(`event:${model.event.id}`)}` : null;
  return <div className="bb-card__actions">
    <CardSave model={model} />
    {plan && <button type="button" onClick={() => onNavigate(plan)} aria-label={t(`加入行程：${model.title}`, `Add to a plan: ${model.title}`)}><CalendarPlus aria-hidden="true" size={18} />{t('加入行程', 'Add to plan')}</button>}
  </div>;
}

/** Horizontal image cards (264 wide, 16:10, provenance badge, title 16/600, one meta line, ♡ 收藏 / 加入行程). */
export function BayBayCardRailView({ cards, sources = [], today, onNavigate, label }: { cards: readonly BayBayQuickCard[]; sources?: Sources; today: string; onNavigate: Navigate; label?: string }) {
  const { t, english, pick } = useBayBayCopy();
  const models = useMemo(() => bayBayCardModels(cards, today), [cards, today]);
  const citations = useMemo(() => bayBayCardCitations(models, sources), [models, sources]);
  if (!models.length) return null;
  return <ul className="bb-cards" data-count={models.length} aria-label={label || t('相关活动与去处', 'Related events and places')}>
    {models.map(model => {
      const cited = citations.get(model.key);
      return <li key={model.key} className="bb-card" data-kind={model.kind} data-card-key={model.key}>
        <h4 className="bb-card__title"><SmartLink className="bb-card__link" href={model.url} onNavigate={onNavigate}>{cited !== undefined && <span className="bb-card__n" aria-hidden="true">[{cited}]</span>}{cited !== undefined && <span className="sr-only">{t(`来源 ${cited}：`, `Source ${cited}: `)}</span>}{model.title}</SmartLink></h4>
        <div className="bb-card__media"><CardCover model={model} today={today} /></div>
        <p className="bb-card__meta">{cardMeta(model, today, english, pick)}</p>
        <CardActions model={model} onNavigate={onNavigate} />
      </li>;
    })}
  </ul>;
}
