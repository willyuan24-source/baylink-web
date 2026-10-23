import { guides } from '../src/data/guides';
import { GUIDE_IMAGES, type GuideImage } from '../src/data/guide-media';
import { MONTHLY_EVENTS } from '../src/data/monthly-edition';
import { LIFE_TOOLS } from '../src/data/tool-catalog';
import { getMonthlyDateRange } from '../src/lib/monthly';
import { getBuildWeekend } from '../src/lib/home-weekend-build';
import { formatDateChip, readerDayRange } from '../src/lib/event-facts';
import { HUB_CARD_NAMES, shareable, type CardLocale, type HubCardName, type Translate } from '../src/lib/share-card-model';

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

/**
 * UI9-R2 N20 (DECISIONS 21, OD12): the picture each hub card fronts, best first. A hub card promotes BAYLINK itself, so
 * its picture is one promotion allows (share-card-model.ts shareable: `rights.promoAllowed`, never AI art — DECISIONS 24
 * keeps ④ and the 3D postcards off share cards — never CC BY-SA): today only the approved ③ category stock pictures
 * (category-stock-photos.json, Unsplash, owner-approved 10-21) are, until a ① or ② picture with promotion rights exists.
 * Chosen by eye for the hub's subject: evergreen (no season), no faces (backs and silhouettes only), no text or logos,
 * and each reads under the band's shade, its 示意图 label and the brand pill (lanes/UI9-R2-SHARE-HUB/pick). `focal`
 * ([x, y] %) places the 1200 × 346 band where the stock record has none:
 *   home     the Golden Gate Bridge from the beach — "this weekend, where to in the Bay Area"
 *   events   a fairground's Ferris wheels against a sunset sky
 *   guides   a library aisle of books — guides with official sources
 *   explore  a trail along a rocky coast
 *   plan     a walker with a backpack on a forest trail, from behind — a day out
 *   tools    an open laptop on a desk — work it out in the browser
 *   brand    the San Francisco skyline across the bay at golden hour (about, archive and the other pages without a card)
 * The later pictures stand in when one loses its clearance; no two hubs share one.
 */
export type HubPicture = { key: string; focal?: readonly [number, number] };
export const HUB_PICTURES: Readonly<Record<HubCardName, readonly HubPicture[]>> = {
  home: [{ key: 'stock-city-sights-1' }, { key: 'stock-nature-walk-6' }],
  events: [{ key: 'stock-community-festival-2', focal: [50, 45] }, { key: 'stock-community-festival-4' }],
  guides: [{ key: 'stock-library-7' }, { key: 'stock-library-8' }],
  explore: [{ key: 'stock-nature-walk-5' }, { key: 'stock-nature-walk-1' }],
  plan: [{ key: 'stock-family-outdoor-1', focal: [50, 28] }, { key: 'stock-family-outdoor-4', focal: [50, 60] }],
  tools: [{ key: 'stock-tech-help-4' }, { key: 'stock-guide-documents-3' }],
  brand: [{ key: 'stock-city-sights-2', focal: [50, 62] }, { key: 'stock-city-sights-3', focal: [50, 55] }],
};
/** Each hub's picture (with the band's focal): the first of its pictures the card may front (shareable) that no earlier hub took. */
export function hubPictures(images: Readonly<Record<string, GuideImage>> = GUIDE_IMAGES, table: Readonly<Record<HubCardName, readonly HubPicture[]>> = HUB_PICTURES): Record<HubCardName, GuideImage | undefined> {
  const used = new Set<string>();
  return Object.fromEntries(HUB_CARD_NAMES.map(name => {
    for (const { key, focal } of table[name]) {
      const image = Object.hasOwn(images, key) ? images[key] : undefined;
      if (!shareable(image) || used.has(image.src)) continue;
      used.add(image.src);
      return [name, focal ? { ...image, focal } : image];
    }
    return [name, undefined];
  })) as Record<HubCardName, GuideImage | undefined>;
}
