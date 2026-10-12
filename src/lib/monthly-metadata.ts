import { EVENTS_INDEX } from '../features/events/events-model';
import { getBayAreaToday, nextOccurrence } from './monthly';
import { SITE_URL, localCopy, type PageMetadata } from './seo';

// Read from the slim events index (RC-33), not the full catalog: the events column's pages load this module.
const { edition, events } = EVENTS_INDEX;

/**
 * The hub's ItemList: what is still on, by the next day each event happens (I18N-SEO-10) — an event that ended since the
 * edition's check never leads it. The day is the build's in the prerender and the reader's in the app.
 */
export const upcomingEventList = (today = getBayAreaToday()) => events
  .map(event => ({ event, next: nextOccurrence(event, today) }))
  .filter((entry): entry is { event: typeof entry.event; next: string } => !!entry.next)
  .sort((a, b) => a.next.localeCompare(b.next) || a.event.startDate.localeCompare(b.event.startDate) || a.event.id.localeCompare(b.event.id))
  .map(({ event }, index) => ({ '@type': 'ListItem', position: index + 1, name: event.title, url: `${SITE_URL}/events/${event.id}` }));

const through = `${Number(edition.throughDate.slice(5, 7))}/${Number(edition.throughDate.slice(8, 10))}`;
const collection = (path: string, today?: string) => [{
  '@context': 'https://schema.org', '@type': 'CollectionPage',
  name: localCopy(`${edition.label} · 湾区生活精选`, `BAYLINK Bay Area picks, fall 2026 (through ${through})`), url: `${SITE_URL}${path}`, dateModified: edition.checkedAt,
  mainEntity: { '@type': 'ItemList', itemListElement: upcomingEventList(today) },
}];

/** The hubs' 1200 × 630 share card, one per language (scripts/generate-share-cards.ts). */
export const EVENTS_HUB_CARD = '/share-cards/hub-events.png';

// I18N-SEO-15: the edition label ("2026 年秋季 · 收录至 11/30") is set apart from the title, not glued to it (the
// separator CNT-HOTFIX gave it on main; its English is the dictionary's).
export const monthlyMetadata = (today?: string): PageMetadata => ({
  title: `${edition.label} · 湾区活动、优惠与新店消息｜BAYLINK`,
  description: 'BAYLINK 2026 秋季湾区精选：收录至 11 月 30 日已公布的文化、户外、美食、亲子活动与本地优惠，附日期、预约条件、资格限制和官方来源。',
  english: {
    title: `Bay Area events, deals and new openings · fall 2026, through ${through} | BAYLINK`,
    description: 'BAYLINK’s fall 2026 Bay Area picks: culture, outdoors, food and family events and local deals announced through November 30, with dates, booking rules, eligibility and official sources.',
    imageAlt: 'BAYLINK: this weekend in the Bay Area',
  },
  path: '/this-month',
  image: EVENTS_HUB_CARD,
  imageAlt: 'BAYLINK：这个周末湾区去哪',
  structuredData: collection('/this-month', today),
});
export const MONTHLY_METADATA: PageMetadata = monthlyMetadata();

/** /events (活动, 本周末 by default). /this-week is a 301 to it. */
export const eventsMetadata = (today?: string): PageMetadata => ({
  ...monthlyMetadata(today),
  path: '/events',
  title: '本周末湾区活动与官方来源｜BAYLINK',
  description: '按湾区当地日期查看本周末的真实活动，附日期、费用、主办方来源与出游入口。',
  english: {
    title: 'Bay Area events this weekend, with official sources | BAYLINK',
    description: 'This weekend’s Bay Area events by local date, with times, costs, organizer sources and ways to plan the outing.',
    imageAlt: 'BAYLINK: this weekend in the Bay Area',
  },
  structuredData: collection('/events', today),
});
export const EVENTS_METADATA: PageMetadata = eventsMetadata();
