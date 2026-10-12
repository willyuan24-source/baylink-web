import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { MONTHLY_EDITION } from '../src/data/monthly-edition';
import { PLANNER_EVENTS } from '../src/data/planner-catalog';
import { currentFreebies } from '../src/data/october-offers';
import { currentOpenings } from '../src/data/local-discoveries';
import { currentRegionalBulletins } from '../src/data/october-2026-bulletins';
import { GUIDE_IMAGES } from '../src/data/guide-media';
import cityAliases from '../src/data/city-search-aliases.json';
import { EVENT_DATE_OVERRIDES, EVENT_SCHEDULE_NOTES } from './data/event-calendar-schedule';
import { getWeeklyCardDays } from '../src/lib/home-weekend';
import type { EventsIndex, IndexEvent, IndexImage, IndexOffer, IndexOpening, IndexSchedule } from '../src/features/events/events-index-types';
import type { PlanningSchedule } from '../src/lib/planner';

/**
 * The slim events index (RC-33): what /events, /this-month and /calendar render, without guide articles, the full
 * local-discoveries catalog, plan steps or summaries. Generated from the same catalogs as the detail pages, so titles,
 * dates, prices and source checks cannot drift. The CNT editorial overlay fields a listing shows or searches (shortTitle, dek,
 * sessions, price, venueShort, iconKey) are copied when an event carries them; address, ageChip, tips and dateNote stay
 * on the detail page, so the overlay adds as little as possible to /events. Fields no listing reads stay out too: the
 * sourceLabel (a card's trust line reads verifiedAt), the free-text costLabel except on mixed-cost events (the 免费 filter's
 * isFreeToAttend reads it only there; a card's price comes from cost / price / admission) and the schedule's own
 * sourceUrl / verifiedAt (listSchedule below), so each new batch of events costs the list routes as few bytes as possible
 * (CNT-SUPPLY, verify-release route budgets).
 *
 * Deterministic for a given catalog apart from `weeklyCardDays`: it keeps everything that had not ended by the edition's
 * check date; pages filter by the reader's own day. `weeklyCardDays` are the days this build writes a dated Bay Area share
 * card for (/weekly/all-{day}.png, generate-weekly.ts), read from the home catalog written just before, so the page-end
 * "存成一张图" link opens the same card as the home page (RC-12). Run by `npm run generate:home` (prebuild and pretest).
 */
const cutoff = MONTHLY_EDITION.checkedAt;

const OVERLAY_KEYS = ['shortTitle', 'dek', 'sessions', 'price', 'venueShort', 'iconKey'] as const;
const pick = <T extends object, K extends string>(source: T, keys: readonly K[]) => Object.fromEntries(keys.flatMap(key => {
  const value = (source as Record<string, unknown>)[key];
  return value === undefined || value === null || value === '' || (Array.isArray(value) && !value.length) ? [] : [[key, value]];
}));

/**
 * The planner schedule as a listing reads it (src/lib/event-facts.ts eventTimeLabel): the time windows and their validity
 * only. Its sourceUrl / verifiedAt stay with the detail page, and sessions that repeat the overlay's own `sessions` are
 * dropped (the overlay's are read first, so the label is the same). A schedule left with no time window is dropped.
 */
const sessionKey = (sessions: readonly { date: string; start?: string; end?: string }[] | undefined) =>
  JSON.stringify((sessions ?? []).map(({ date, start, end }) => [date, start ?? '', end ?? '']));
function listSchedule(schedule: PlanningSchedule, overlaySessions: IndexEvent['sessions']): IndexSchedule | undefined {
  const list: IndexSchedule = pick(schedule, ['validFrom', 'validThrough', 'weekly', 'dates', 'sessions'] as const);
  if (list.sessions && overlaySessions?.length && sessionKey(list.sessions) === sessionKey(overlaySessions)) delete list.sessions;
  return list.weekly || list.dates || list.sessions ? list : undefined;
}

const events: IndexEvent[] = PLANNER_EVENTS.filter(event => event.endDate >= cutoff).map(event => {
  const dates = Object.hasOwn(EVENT_DATE_OVERRIDES, event.id) ? EVENT_DATE_OVERRIDES[event.id] : event.occurrenceDates;
  const overlay = event as typeof event & Pick<IndexEvent, 'sessions'>;
  const schedule = event.planning?.schedule && listSchedule(event.planning.schedule, overlay.sessions);
  const planning = event.planning ? {
    ...pick(event.planning, ['setting', 'admissionUsd', 'minAge', 'maxAge'] as const),
    ...(schedule ? { schedule } : {}),
  } : undefined;
  const aliases = (event.aliases ?? []).filter(alias => alias !== event.title);
  return {
    id: event.id, title: event.title,
    ...(aliases.length ? { aliases } : {}),
    ...(event.kind && event.kind !== 'event' ? { kind: event.kind } : {}),
    startDate: event.startDate, endDate: event.endDate, ...(dates !== undefined ? { occurrenceDates: dates } : {}),
    region: event.region, city: event.city, venue: event.venue, category: event.category,
    cost: event.cost, ...(event.cost === 'mixed' ? { costLabel: event.costLabel } : {}),
    audience: event.audience, verifiedAt: event.verifiedAt, imageKey: event.imageKey,
    ...(planning && Object.keys(planning).length ? { planning } : {}),
    ...(event.location ? { location: { lat: event.location.lat, lng: event.location.lng, precision: event.location.precision, sourceUrl: event.location.sourceUrl } } : {}),
    ...(EVENT_SCHEDULE_NOTES[event.id] ? { note: EVENT_SCHEDULE_NOTES[event.id] } : {}),
    ...pick(event, OVERLAY_KEYS),
  } as IndexEvent;
});

const offers: IndexOffer[] = currentFreebies
  .filter(offer => offer.verificationStatus !== 'needs-confirmation' && (!offer.endDate || offer.endDate >= cutoff))
  .map(offer => ({
    id: offer.id, brand: offer.brand, title: offer.title, ...pick(offer, ['region', 'startDate', 'endDate', 'weekdays'] as const),
    availability: offer.availability, kind: offer.kind, imageKey: offer.imageKey,
    sourceLabel: offer.sourceLabel, ...(offer.verifiedAt ? { verifiedAt: offer.verifiedAt } : {}),
  }));

const openings: IndexOpening[] = currentOpenings.map(shop => ({
  id: shop.id, name: shop.name, city: shop.city, region: shop.region, category: shop.category, status: shop.status,
  openingType: shop.openingType, ...(shop.openedOn ? { openedOn: shop.openedOn } : {}), imageKey: shop.imageKey,
  sourceLabel: shop.sourceLabel, verifiedAt: shop.verifiedAt,
}));

const bulletins = currentRegionalBulletins.filter(item => item.expiresAt >= cutoff).map(item => ({
  id: item.id, region: item.region, label: item.label, title: item.title, dateLabel: item.dateLabel,
  sourceLabel: item.sourceLabel, sourceUrl: item.sourceUrl, verifiedAt: item.verifiedAt, expiresAt: item.expiresAt,
}));

// Only images a listing can show: AI illustrations are never an event, offer or opening cover (cover.ts), so they stay out.
const keys = new Set([...events.map(event => event.imageKey), ...offers.map(offer => offer.imageKey), ...openings.map(shop => shop.imageKey)]);
const images: Record<string, IndexImage> = Object.fromEntries([...keys].sort()
  .filter(key => Object.hasOwn(GUIDE_IMAGES, key) && GUIDE_IMAGES[key].kind !== 'illustration')
  .map(key => [key, GUIDE_IMAGES[key] as IndexImage]));

// Chinese city names for the calendar's bilingual chips (圣何塞 San Jose): the first Han alias the search uses.
const HAN = /[\u3400-\u9fff]/;
const cityNames: Record<string, string> = Object.fromEntries([...new Set(events.map(event => event.city))].sort().flatMap(city => {
  const zh = (cityAliases as Record<string, string[]>)[city]?.find(alias => HAN.test(alias));
  return zh ? [[city, zh]] : [];
}));

// The same days generate-weekly.ts writes all-{day}.png for (the home catalog's snapshot days in the week after the build).
const home = JSON.parse(await readFile('src/data/generated/home-catalog.json', 'utf8')) as { generatedAt: string; weekends: Record<string, unknown> };
const weeklyCardDays = getWeeklyCardDays(home.generatedAt, home.weekends);

const index: EventsIndex = {
  edition: { label: MONTHLY_EDITION.label, checkedAt: MONTHLY_EDITION.checkedAt, throughDate: MONTHLY_EDITION.throughDate, startMonth: MONTHLY_EDITION.startMonth },
  events, offers, openings, bulletins, images, cityNames, weeklyCardDays,
};
await mkdir('src/data/generated', { recursive: true });
await writeFile('src/data/generated/events-index.json', JSON.stringify(index));
console.log(`Events index: ${events.length} events, ${offers.length} offers, ${openings.length} openings, ${bulletins.length} bulletins, ${Object.keys(images).length} images; no articles or plan steps.`);

// The event, offer and opening detail records (WEB-DETAIL, ENGSEC-01) come from the same catalogs, in the same step.
await import('./generate-detail-records');
