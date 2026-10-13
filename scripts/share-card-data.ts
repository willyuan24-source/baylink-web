import { guides } from '../src/data/guides';
import { MONTHLY_EVENTS } from '../src/data/monthly-edition';
import { LIFE_TOOLS } from '../src/data/tool-catalog';
import { getMonthlyDateRange } from '../src/lib/monthly';
import { getBuildWeekend } from '../src/lib/home-weekend-build';
import { formatDateChip } from '../src/lib/event-facts';
import type { CardLocale, Translate } from '../src/lib/share-card-model';

/**
 * What the hub cards list (I18N-SEO-03), in the card's language: this weekend's picks (the home page's and the weekly
 * card's), the weekend's date span, the tools and the guide count. Shared by scripts/generate-share-cards.ts, which draws
 * the cards, and scripts/verify-share-cards.ts, which checks their language.
 */
export function hubCardData(locale: CardLocale, t: Translate, today: string) {
  const english = locale === 'en';
  const range = getMonthlyDateRange('weekend', today);
  const weekend = getBuildWeekend(today, MONTHLY_EVENTS).picks.map(({ event, date }) => ({
    date: t(formatDateChip({ kind: 'day', date, ended: false }, english).label), title: t(event.shortTitle || event.title), city: event.city,
  }));
  const span = range ? `${Number(range.start.slice(5, 7))}/${Number(range.start.slice(8, 10))}–${range.end.slice(5, 7) === range.start.slice(5, 7) ? Number(range.end.slice(8, 10)) : `${Number(range.end.slice(5, 7))}/${Number(range.end.slice(8, 10))}`}` : '';
  return { weekend, range: span, tools: LIFE_TOOLS.map(tool => tool.title), guideCount: guides.length };
}
