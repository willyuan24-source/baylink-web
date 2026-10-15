import { EVENTS_INDEX } from '../features/events/events-model';
import { getBayAreaToday, nextOccurrence } from './monthly';
import { SITE_URL, localCopy, type PageMetadata } from './seo';
import { HUB_CARDS } from './hub-cards';

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
// The description names the edition's last day from the data, so extending the edition (CNT-SUPPLY-2: 12/31) keeps it true.
// The season words (秋冬 / fall and winter) are written by hand below and in the English dictionary rows of the batch that
// extended the edition (supply-2026-10-13-en.json): change them together with MONTHLY_EDITION.label (src/data/monthly-settings.ts).
const throughZh = `${Number(edition.throughDate.slice(5, 7))} 月 ${Number(edition.throughDate.slice(8, 10))} 日`;
const throughEn = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${edition.throughDate}T12:00:00Z`));
const collection = (path: string, today?: string) => [{
  '@context': 'https://schema.org', '@type': 'CollectionPage',
  name: localCopy(`${edition.label} · 湾区生活精选`, `BAYLINK Bay Area picks, fall and winter 2026 (through ${through})`), url: `${SITE_URL}${path}`, dateModified: edition.checkedAt,
  mainEntity: { '@type': 'ItemList', itemListElement: upcomingEventList(today) },
}];


// I18N-SEO-15: the edition label ("2026 年秋冬 · 收录至 12/31") is set apart from the title, not glued to it (the
// separator CNT-HOTFIX gave it on main; its English is the dictionary's).
export const monthlyMetadata = (today?: string): PageMetadata => ({
  title: `${edition.label} · 湾区活动、优惠与新店消息｜BAYLINK`,
  description: `BAYLINK 2026 秋冬湾区精选：收录至 ${throughZh}已公布的文化、户外、美食、亲子活动与本地优惠，附日期、预约条件、资格限制和官方来源。`,
  english: {
    title: `Bay Area events, deals and new openings · fall and winter 2026, through ${through} | BAYLINK`,
    description: `BAYLINK’s fall and winter 2026 Bay Area picks: culture, outdoors, food and family events and local deals announced through ${throughEn}, with dates, booking rules, eligibility and official sources.`,
    imageAlt: 'BAYLINK: this weekend in the Bay Area',
  },
  path: '/this-month',
  image: HUB_CARDS.events,
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

/** The /events views a title names (H35 / HOMEIA13-07): the browser tab and a shared link say which view it is. */
export type EventsTitleView = 'weekend' | 'today' | 'next7' | 'october' | 'november' | 'december' | 'all' | 'perks' | 'openings';
const VIEW_TITLES: Record<Exclude<EventsTitleView, 'weekend'>, { zh: string; en: string }> = {
  today: { zh: '今天湾区活动与官方来源｜BAYLINK', en: 'Bay Area events today, with official sources | BAYLINK' },
  next7: { zh: '未来 7 天湾区活动与官方来源｜BAYLINK', en: 'Bay Area events in the next 7 days, with official sources | BAYLINK' },
  october: { zh: '十月湾区活动与官方来源｜BAYLINK', en: 'Bay Area events in October, with official sources | BAYLINK' },
  november: { zh: '十一月湾区活动与官方来源｜BAYLINK', en: 'Bay Area events in November, with official sources | BAYLINK' },
  december: { zh: '十二月湾区活动与官方来源｜BAYLINK', en: 'Bay Area events in December, with official sources | BAYLINK' },
  all: { zh: `湾区全部活动（收录至 ${through}）｜BAYLINK`, en: `All Bay Area events through ${through} | BAYLINK` },
  perks: { zh: '湾区免费与优惠｜BAYLINK', en: 'Free days and deals in the Bay Area | BAYLINK' },
  openings: { zh: '湾区新店与开业消息｜BAYLINK', en: 'New shops and openings in the Bay Area | BAYLINK' },
};
/** /events with the view's own title; the canonical stays /events (the views are filters of one page). */
export const eventsViewMetadata = (view: EventsTitleView, today?: string): PageMetadata => {
  const base = eventsMetadata(today);
  if (view === 'weekend') return base;
  const title = VIEW_TITLES[view];
  return { ...base, title: title.zh, english: { ...base.english!, title: title.en } };
};
