import { useEffect, useMemo, useRef } from 'react';
import { CalendarPlus, Heart } from 'lucide-react';
import { EventCover, OfferCover, OpeningCover, Cover } from '../../components/ui/Cover';
import { TypeCover } from '../../components/ui/TypeCover';
import { useBayBayCopy } from './copy';
import { SmartLink } from './SmartLink';
import { brandCase, eventDateChip, eventPlace, eventPriceChip, eventTimeLabel, formatDateChip, offerDeadline, openingChip } from '../../lib/event-facts';
import { bayBayCardCitations, bayBayCardModels, type BayBayCardModel } from './answer-cards';
import { useBayBaySaves, type BayBaySaves } from './save-context';
import { usePlannerLibrary } from '../../lib/planner-library';
import { favoriteKey } from '../../lib/planner';
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

function CardActions({ model, onNavigate }: { model: BayBayCardModel; onNavigate: Navigate }) {
  const { t } = useBayBayCopy();
  const saves = useBayBaySaves();
  if (model.ended) return <p className="bb-card__ended">{t('已结束 · 仅供参考', 'Ended · reference only')}</p>;
  if (model.kind !== 'event') return null;
  const favorite = { kind: 'event' as const, id: model.event.id };
  const saved = !!saves?.ready && saves.saved(favorite);
  const plan = `/plan?${model.day ? `date=${model.day}&` : ''}stops=${encodeURIComponent(`event:${model.event.id}`)}`;
  return <div className="bb-card__actions">
    {/* Planner favorites = 我的这周, as SaveToWeek labels them. The event page's 我想去 is a different store (sign-in
        interest), so this says 收藏 until WEB-SAVES' useSave unifies the two and it can become ♡ 想去. */}
    <button type="button" aria-pressed={saves?.ready ? saved : undefined} disabled={!saves?.ready || saves.busy} onClick={() => saves?.toggle(favorite)}
      title={t('收藏到我的这周', 'Save to My Week')}
      aria-label={saved ? t(`已收藏到我的这周：${model.title}`, `Saved to My Week: ${model.title}`) : t(`收藏到我的这周：${model.title}`, `Save to My Week: ${model.title}`)}>
      <Heart aria-hidden="true" size={18} fill={saved ? 'currentColor' : 'none'} />{saved ? t('已收藏', 'Saved') : t('收藏', 'Save')}
    </button>
    <button type="button" onClick={() => onNavigate(plan)} aria-label={t(`加入行程：${model.title}`, `Add to a plan: ${model.title}`)}><CalendarPlus aria-hidden="true" size={18} />{t('加入行程', 'Add to plan')}</button>
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
        <h4 className="bb-card__title"><SmartLink className="bb-card__link" href={model.url} onNavigate={onNavigate}>{cited !== undefined && <span className="bb-card__n" aria-label={t(`来源 ${cited}`, `Source ${cited}`)}>[{cited}]</span>}{model.title}</SmartLink></h4>
        <div className="bb-card__media"><CardCover model={model} today={today} /></div>
        <p className="bb-card__meta">{cardMeta(model, today, english, pick)}</p>
        <CardActions model={model} onNavigate={onNavigate} />
      </li>;
    })}
  </ul>;
}

/** The planner library behind ♡ 想去 (see BayBaySaveScope), loaded with the cards. */
export function BayBaySaveLibrary({ ownerId, onChange }: { ownerId?: string; onChange: (saves: BayBaySaves) => void }) {
  const library = usePlannerLibrary(ownerId);
  const latest = useRef(library);
  useEffect(() => { latest.current = library; });
  const keys = library.data.favorites.map(favoriteKey).join('\n');
  const busy = library.loading || library.busy;
  useEffect(() => {
    const saved = new Set(keys ? keys.split('\n') : []);
    onChange({ ready: library.ready, busy, error: library.error, saved: favorite => saved.has(favoriteKey(favorite)), toggle: favorite => { void latest.current.toggleFavorite(favorite); } });
  }, [library.ready, busy, library.error, keys, onChange]);
  return null;
}
