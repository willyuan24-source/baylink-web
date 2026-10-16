import { guides } from '../src/data/guides';
import { MONTHLY_EVENTS } from '../src/data/monthly-edition';
import { LIFE_TOOLS } from '../src/data/tool-catalog';
import { getMonthlyDateRange } from '../src/lib/monthly';
import { getBuildWeekend } from '../src/lib/home-weekend-build';
import { formatDateChip, readerDayRange } from '../src/lib/event-facts';
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
  // "10/17–18" in Chinese, "Oct 17–18" on the English cards, like their date rows (WEB-FIX6).
  const span = range ? readerDayRange(range.start, range.end, english) : '';
  return { weekend, range: span, tools: LIFE_TOOLS.map(tool => tool.title), guideCount: guides.length };
}
