import { Link } from 'react-router-dom';
import { useLocale } from '../i18n/locale';
import { PLANNER_PLACES } from '../lib/planner-source';
import { stopPath, type PlaceSuggestion, type PlanFilters, type Stop } from '../lib/planner-core';
import type { CompleteOuting } from '../lib/planner-outings';
import { recordProductEvent } from '../lib/product-events';
import { PlannerPlaceOutingOptions } from './PlannerOutingOptions';
import { plannerNoticeText } from '../lib/planner-copy';
import type { ResolvedCover } from '../lib/cover';
import { PlannerOptionCover } from './PlannerStopCover';
import { Button } from './ui/Button';

/** `covers`: one per suggestion, in order (the page resolves every cover once, in display order). */
export function PlannerPlaceRecommendations({ suggestions, filters, message, onChoose, onStart, covers }: {
  suggestions: PlaceSuggestion[]; filters: PlanFilters; message: string; covers: readonly ResolvedCover[];
  onChoose: (outing: CompleteOuting) => void;
  onStart: (stops: Stop[], date: string, title: string, filters: PlanFilters) => void;
}) {
  const locale = useLocale();
  const text = (zh: string, en: string) => locale === 'en' ? en : zh;
  if (!suggestions.length) return null;
  return <div className="planner-options planner-place-options">{suggestions.map((suggestion, index) => {
    const place = PLANNER_PLACES.find(item => item.id === suggestion.placeId);
    if (!place) return null;
    const stop: Stop = { kind: 'place', id: place.id };
    const admission = place.planning?.admissionUsd;
    const costLabel = typeof admission === 'number' ? text(`已知入场起价 $${admission.toFixed(2)}；餐饮、购物另计`, `Recorded admission from $${admission.toFixed(2)}; meals and purchases are extra`)
      : ['unknown', 'free', 'paid', 'mixed'].includes(place.cost) ? text('具体费用待确认', 'Exact costs are unconfirmed') : place.cost;
    return <article className="planner-option" key={suggestion.id}>
      <PlannerOptionCover cover={covers[index]} />
      <span className="planner-option-kind">{place.category === 'restaurant' ? text('餐厅', 'Dining') : place.category === 'cafe' ? text('咖啡与小食', 'Coffee') : place.category === 'shop' ? text('商店', 'Shop') : text('景点', 'Place')}</span>
      {suggestion.budgetStatus === 'unknown' && <span className="planner-unverified-price">{text('费用待核实 · 备选', 'Price unverified · alternative')}</span>}
      <h3><Link to={stopPath(stop)}>{place.title}</Link></h3>
      <p className="planner-meta">{suggestion.date} · {place.city}{place.openingStatus === 'soft_open' ? text(' · 试营业', ' · Soft opening') : ''}</p>
      <p>{suggestion.reasons?.length ? suggestion.reasons.join(' ') : suggestion.reason}</p>
      <strong className="planner-cost">{costLabel}</strong>
      {suggestion.unknowns.length > 0 && <ul>{suggestion.unknowns.map((unknown, index) => <li key={index}>{plannerNoticeText(unknown, locale === 'en')}</li>)}</ul>}
      <a onClick={() => recordProductEvent('official_source_click')} href={place.officialUrl} target="_blank" rel="noopener noreferrer">{text('查看地点来源与最新安排 ↗', 'Check the place source and latest details ↗')}</a>
      {place.planning?.schedule && <small>{text('时段资料核查：', 'Hours checked: ')}{place.planning.schedule.verifiedAt}</small>}
      <PlannerPlaceOutingOptions placeId={place.id} date={suggestion.date} filters={filters} message={message} onChoose={onChoose} />
      <Button block onClick={() => onStart([stop], suggestion.date, place.title, filters)}>{text('以这里为起点', 'Start with this place')}</Button>
    </article>;
  })}</div>;
}
