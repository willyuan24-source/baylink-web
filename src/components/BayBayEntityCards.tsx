import { CalendarDays, ArrowUpRight } from 'lucide-react';
import { useLocale } from '../i18n/locale';
import type { BayBayQuickCard } from '../lib/baybay-stream';

export function BayBayEntityCards({ cards, onNavigate }: { cards: BayBayQuickCard[]; onNavigate: (path: string) => void }) {
  const english = useLocale() === 'en';
  if (!cards.length) return null;
  return <div className="baybay-entity-cards" aria-label={english ? 'Related site information' : '相关站内资料'}>{cards.map(card => {
    const ended = ['past', 'inactive', 'ended'].includes(card.temporalStatus || '');
    return <article key={`${card.kind}:${card.id}`}>
    <h3><button type="button" onClick={() => onNavigate(card.url)}>{card.title}<ArrowUpRight size={16} aria-hidden="true" /></button></h3>
    <p>{card.summary}</p>
    {(card.date || ended) && <p>{card.date && <><CalendarDays size={16} aria-hidden="true" /><time dateTime={card.date}>{card.date}</time></>}{ended && <strong>{english ? 'Ended · reference only' : '已结束 · 仅供参考'}</strong>}</p>}
    {card.kind === 'event' && !ended && <div className="baybay-entity-actions"><button type="button" onClick={() => onNavigate(`/plan?${card.date ? `date=${card.date}&` : ''}stops=${encodeURIComponent(`event:${card.id}`)}`)}>{english ? 'Add to plan' : '加入计划'}</button><button type="button" onClick={() => onNavigate(`${card.url}#event-participation`)}>{english ? 'Save / calendar / find company' : '想去、存日历或找同行'}</button></div>}
  </article>;
  })}</div>;
}
