import type { Outing } from '../../lib/outings';
import { getBayAreaToday, getMonthlyDateRange } from '../../lib/monthly';

export function selectMyWeekOutings(items: Outing[], userId: string, now: number) {
  const today = getBayAreaToday(new Date(now)), end = getMonthlyDateRange('next7', today)!.end;
  const current = items.filter(item => item.status === 'open' && item.endAt > now
    && (!item.me || item.me.userId === userId)).sort((a, b) => a.startAt - b.startAt || a.id.localeCompare(b.id));
  return {
    arrangements: current.filter(item => item.date >= today && item.date <= end
      && (item.host.id === userId || item.me?.status === 'confirmed')),
    requests: current.filter(item => item.host.id !== userId && item.me?.status === 'requested'),
  };
}
