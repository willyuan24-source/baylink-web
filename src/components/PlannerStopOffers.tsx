import { Link } from 'react-router-dom';
import { Tag } from 'lucide-react';
import { useLocale } from '../i18n/locale';
import { offersForStop } from '../lib/planner-offers';
import type { Stop } from '../lib/planner';

export function PlannerStopOffers({ stop, date }: { stop: Stop; date: string }) {
  const locale = useLocale();
  const offers = offersForStop(stop, date);
  if (!offers.length) return null;
  return <details className="planner-stop-offers"><summary><Tag size={13} />{locale === 'en' ? 'Offers at this stop' : '这一站的优惠'} ({offers.length})</summary>
    <p>{locale === 'en' ? 'Check dates and eligibility. Savings are not deducted from your budget.' : '使用日期与资格请逐条确认；尚未从预算中扣除优惠。'}</p>
    {offers.map(offer => <div key={offer.id}><Link to={`/offers/${offer.id}`}>{offer.title}</Link><small>{offer.dateLabel}</small><p>{offer.requirement}</p>{offer.availability !== 'dated' && <small>{locale === 'en' ? 'Confirm this venue and date with the provider.' : '长期或门店规则，请再确认当天是否适用。'}</small>}<a href={offer.sourceUrl} target="_blank" rel="noreferrer">{locale === 'en' ? 'Official terms ↗' : '查看官方条件 ↗'}</a></div>)}
  </details>;
}
