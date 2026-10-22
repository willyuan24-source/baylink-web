// npm run report:covers — which card slots show a picture, page by page, day by day (UI9-IMAGES A0; the 10-20 probe made
// repeatable). It runs the pages' own selection and cover code (coverItemFor → getCover / resolveCovers, the same page
// de-duplication), so its numbers are the pages' numbers:
//   - home: lead, 本周末 picks and feed, the offer rail and the guide rail of every home intent;
//   - /events 本周末: lead, 编辑精选 rows, the feed (first page of 12, then the rest);
//   - /perks and /openings: each section's first screen on a phone and on a desktop, then the rest;
//   - /guides: the elder band and the topic previews;
//   - first screen: a page's first 4 cards on a phone, 8 on a desktop (PHONE_SCREEN / DESKTOP_SCREEN); /perks and
//     /openings count their sections' own first rows;
//   - inventory: every live record (events-index + events-later, all offers, openings, guides), no page de-duplication.
// Options: --from YYYY-MM-DD (default: the Bay Area today), --days N (21), --mode current | projected (projected: every
// record gets its coverCandidates() — venue photos, category stock, approved AI — resolved against the full registry,
// i.e. what A1 will show), --out file.json (the per-slot detail), --fail-on-info (exit 1 when any slot is an info card:
// the A1b merge gate and the UI9-IMAGES §7 CI check).
// Settings: standard reading size, all regions, no filters (as the pages open).
import { readFileSync, writeFileSync } from 'node:fs';
import { ADJACENT_CARDS, createCoverPage, coverItemFor, getCover, resolveCovers, type CoverContext, type CoverItem, type CoverKind, type ResolvedCover } from '../src/lib/cover';
import { coverCandidates, type CandidateRecord } from '../src/lib/cover-candidates';
import { EVENTS_INDEX, INDEX_EVENTS, INDEX_OFFERS, INDEX_OPENINGS, hasRealCover, liveOffers, filterOpenings, weekendPicks, weekendRanked } from '../src/features/events/events-model';
import { homeLeadFor, arrangePicks, canLead, leadImageKey } from '../src/features/events/weekend-lead';
import { featurePhotos, getBayAreaToday, getMonthlyDateRange, nextOccurrence, orderByNextDay } from '../src/lib/monthly';
import { getHomeWeekend } from '../src/lib/home-weekend';
import { GUIDE_IMAGES as HOME_IMAGES, HOME_OFFERS, getGuideBySlug, type HomeEvent } from '../src/lib/home-catalog';
import { selectHomeOffers, offerHasPhoto, offerLeadsRail, homeOfferCount } from '../src/lib/home-offers';
import { HOME_INTENTS } from '../src/data/home-pathways';
import { GUIDE_IMAGES } from '../src/data/guide-media';
import { offerSections, openingSections } from '../src/features/events/board-status';
import { guideCover, inSeason, editionState } from '../src/features/guides/guide-facts';
import { GUIDE_TOPICS, guideSlugsForTopic, guideTopicOf } from '../src/data/guide-topics';
import { GUIDE_BAND_SIZE, expandGuidesIndex, type GuideIndexCard, type GuidesIndexFile } from '../src/features/guides/guide-records';
import { addCalendarDays } from '../src/lib/calendar-days';

const arg = (name: string) => { const at = process.argv.indexOf(`--${name}`); return at > 0 ? process.argv[at + 1] : undefined; };
const FROM = arg('from') ?? getBayAreaToday();
const DAYS = Number(arg('days') ?? 21);
const MODE = arg('mode') === 'projected' ? 'projected' : 'current';
const OUT = arg('out');
const FAIL_ON_INFO = process.argv.includes('--fail-on-info');

const read = <T,>(path: string) => JSON.parse(readFileSync(new URL(`../src/data/generated/${path}`, import.meta.url), 'utf8')) as T;
// The cards with their second picture back on covers.stock, as GuidesHome reads them.
const GUIDES = expandGuidesIndex(read<GuidesIndexFile>('guides-index.json')).guides;
/** The whole catalog in its own order: in Node, events-model installs events-later.json at once (installLaterEvents). */
const EVENTS = INDEX_EVENTS;

// projected: every record carries its candidates and is judged against the full registry, as A1's catalogs will be.
const projected = MODE === 'projected';
const withKeys = <T extends CandidateRecord>(kind: CoverKind, record: T): T & { imageKeys?: string[] } =>
  projected ? { ...record, imageKeys: coverCandidates(kind, record) } : record;
const item = (kind: CoverKind, record: CandidateRecord, override?: { imageKey: string | undefined; lead?: boolean }): CoverItem =>
  coverItemFor(kind, withKeys(kind, record), override);
// The home and /events prefer pictures new to the page (HomeDiscovery, WeekendView: CoverPage.fresh); the boards do not.
const pageContext = (today: string, images: CoverContext['images'], fresh = false): CoverContext =>
  ({ images: projected ? GUIDE_IMAGES : images, today, page: createCoverPage({ fresh }) });
const guideItem = (card: GuideIndexCard, today: string, page: CoverContext['page']) => {
  const current = guideCover(card, today, page);
  if (!projected || current.tier !== 'type') return current;
  return getCover(coverItemFor('guide', { id: card.slug, imageKeys: coverCandidates('guide', { id: card.slug, title: card.title, category: card.category }) }), { images: GUIDE_IMAGES, today, page });
};

type Slot = { day: string; page: string; section: string; kind: CoverKind; id: string; tier: ResolvedCover['tier']; reason?: string; phone: boolean; desktop: boolean;
  /** The ③④ picture's file and the slot's place in display order: a pool picture shown again within ADJACENT_CARDS is a repeat. */
  pool?: string; at?: number };
const slots: Slot[] = [];
// A first screen holds the page's first 4 cards on a phone and 8 on a desktop (390 / 1440 px, standard size: the 10-20
// probe and CATEGORIES.json's screens), counted in display order; /perks and /openings pass their sections' own counts.
const PHONE_SCREEN = 4, DESKTOP_SCREEN = 8, CALENDAR_PAGE = 12;
const shownSoFar = new Map<string, number>();
const push = (day: string, page: string, section: string, kind: CoverKind, id: string, cover: ResolvedCover, screen?: { phone: boolean; desktop: boolean }) => {
  const at = shownSoFar.get(`${day} ${page}`) ?? 0;
  shownSoFar.set(`${day} ${page}`, at + 1);
  slots.push({ day, page, section, kind, id, tier: cover.tier, ...(cover.tier === 'type' ? { reason: cover.reason } : {}),
    ...(cover.tier === 'stock' || cover.tier === 'ai' ? { pool: cover.image.src, at } : {}),
    ...(screen ?? { phone: at < PHONE_SCREEN, desktop: at < DESKTOP_SCREEN }) });
};

for (let n = 0; n < DAYS; n++) {
  const day = addCalendarDays(FROM, n);

  // Home (HomeDiscovery.tsx): one page per intent; the weekend block and the offer rail are the same in each.
  const weekend = getHomeWeekend(day);
  const offers = selectHomeOffers(HOME_OFFERS, day, 6, offerHasPhoto(HOME_IMAGES, day), offerLeadsRail(HOME_IMAGES, day));
  for (const intent of HOME_INTENTS) {
    const context = pageContext(day, HOME_IMAGES, true);
    const page = `home:${intent.id}`;
    weekend.picks.forEach(({ event }, i) => push(day, page, i ? 'picks' : 'lead', 'event', event.id,
      getCover(i ? item('event', event as HomeEvent) : item('event', event as HomeEvent, { imageKey: leadImageKey(event.imageKey), lead: true }), context)));
    weekend.feed.forEach(({ event }) => push(day, page, 'feed', 'event', event.id, getCover(item('event', event as HomeEvent), context)));
    const offerCovers = offers.map(offer => getCover(item('offer', offer), context));
    const shown = offers.length ? homeOfferCount(offers, offerCovers, day) : 0;
    offers.slice(0, shown).forEach((offer, i) => push(day, page, 'offers', 'offer', offer.id, offerCovers[i]));
    for (const slug of intent.slugs) {
      const guide = getGuideBySlug(slug);
      if (guide) push(day, page, 'guides', 'guide', guide.slug, getCover(projected ? item('guide', { id: guide.slug, imageKey: guide.imageKey, title: guide.title }) : coverItemFor('guide', guide.imageKeys ? { id: guide.slug, imageKey: guide.imageKey, imageKeys: guide.imageKeys } : { id: guide.slug, imageKey: guide.imageKey }), context));
    }
  }

  // /events 本周末 (WeekendView.tsx): the lead, up to three pick rows, then the feed 12 a page.
  const range = getMonthlyDateRange('weekend', day)!;
  const weekendDays = [range.start, range.end].filter(d => d >= day);
  const base = EVENTS.filter(event => weekendDays.some(d => nextOccurrence(event, d) === d));
  const picks = weekendPicks(base, day, { limit: 5 });
  const homeLead = homeLeadFor(day, picks);
  // As the page: no pick with a ① or ② picture → the weekend's first in the ranking that has one leads (DECISIONS 26).
  const order = weekendRanked(base, day);
  const arranged = arrangePicks(picks, day, homeLead, order);
  const ranked = featurePhotos(order, event => hasRealCover('event', event, day));
  const pickEvents = arranged.rows.slice(0, 3).map(pick => pick.event);
  const fill = Math.max(0, (arranged.lead ? 3 : 0) - pickEvents.length);
  const taken = new Set([...(arranged.lead ? [arranged.lead.event.id] : []), ...pickEvents.map(event => event.id)]);
  const fillers = fill ? ranked.filter(event => !taken.has(event.id) && event.id !== homeLead).slice(0, fill) : [];
  const rows = [...pickEvents, ...fillers].slice(0, 3);
  const listed = ranked.filter(event => !taken.has(event.id) && !fillers.includes(event));
  const events = pageContext(day, EVENTS_INDEX.images, true);
  if (arranged.lead) {
    const lead = arranged.lead.event;
    push(day, '/events', 'lead', 'event', lead.id, resolveCovers([item('event', lead, { imageKey: leadImageKey(lead.imageKey), lead: true })], events)[0]);
  }
  resolveCovers(rows.map(event => item('event', event)), events).forEach((cover, i) => push(day, '/events', 'picks', 'event', rows[i].id, cover));
  resolveCovers(listed.map(event => item('event', event)), events)
    .forEach((cover, i) => push(day, '/events', i < 12 ? 'feed' : 'feed-more', 'event', listed[i].id, cover));

  // /calendar?date=<day> (CalendarView.tsx), all regions, its first page: one-offs first, a real photo first within them, the
  // first event that may lead on top (DECISIONS 15/26).
  const dayEvents = orderByNextDay(EVENTS.filter(event => nextOccurrence(event, day) === day), day, event => hasRealCover('event', event, day));
  const leadAt = Math.max(0, dayEvents.findIndex(event => canLead(event, day)));
  const dayRows = (dayEvents.length ? [dayEvents[leadAt], ...dayEvents.filter((_, i) => i !== leadAt)] : []).slice(0, CALENDAR_PAGE + 1);
  resolveCovers(dayRows.map((event, i) => item('event', event, i ? undefined : { imageKey: leadImageKey(event.imageKey), lead: true })), pageContext(day, EVENTS_INDEX.images))
    .forEach((cover, i) => push(day, '/calendar', i ? 'rows' : 'lead', 'event', dayRows[i].id, cover));

  // /perks (PerksView.tsx): first screen phone 4 / 4 / 4, desktop 8 / 4 / 4; then the rest.
  const perks = pageContext(day, EVENTS_INDEX.images);
  const perkRows = offerSections(liveOffers(INDEX_OFFERS, day, 'all', 'all'), day)
    .flatMap(section => section.offers.map((offer, i) => ({ offer, section: section.id, i })));
  resolveCovers(perkRows.map(({ offer }) => item('offer', offer)), perks).forEach((cover, n) => {
    const { offer, section, i } = perkRows[n];
    push(day, '/perks', section, 'offer', offer.id, cover, { phone: i < 4, desktop: i < (section === 'week' ? 8 : 4) });
  });

  // /openings (OpeningsView.tsx): 已开业 phone 6, desktop 8; 即将开业 4; then the rest.
  const openings = pageContext(day, EVENTS_INDEX.images);
  const shopRows = openingSections(filterOpenings(INDEX_OPENINGS, 'all', 'all'), day)
    .flatMap(section => section.openings.map((shop, i) => ({ shop, section: section.id, i })));
  resolveCovers(shopRows.map(({ shop }) => item('opening', shop)), openings).forEach((cover, n) => {
    const { shop, section, i } = shopRows[n];
    push(day, '/openings', section, 'opening', shop.id, cover, { phone: i < (section === 'open' ? 6 : 4), desktop: i < (section === 'open' ? 8 : 4) });
  });

  // /guides (GuidesHome.tsx): the elder band, then four previews per topic.
  const bySlug = new Map(GUIDES.map(guide => [guide.slug, guide]));
  const elders = guideSlugsForTopic('elders', GUIDES).map(slug => bySlug.get(slug)).filter((guide): guide is GuideIndexCard => !!guide)
    .filter(guide => editionState(guide, day) !== 'past').slice(0, GUIDE_BAND_SIZE);
  const inBand = new Set(elders.map(guide => guide.slug));
  const previews = GUIDE_TOPICS.filter(topic => topic.id !== 'elders').flatMap(topic => {
    const all = GUIDES.filter(guide => guideTopicOf(guide) === topic.id);
    const others = all.filter(guide => !inBand.has(guide.slug));
    return inSeason(others.length >= 2 ? others : all, day).slice(0, 4);
  });
  const guidePage = createCoverPage();
  elders.forEach(guide => push(day, '/guides', 'elders', 'guide', guide.slug, guideItem(guide, day, guidePage)));
  previews.forEach(guide => push(day, '/guides', 'topics', 'guide', guide.slug, guideItem(guide, day, guidePage)));
}

// Inventory: every live record on its own (no page), on the first day.
const inventory: Slot[] = [];
const one = (kind: CoverKind, record: CandidateRecord, images: CoverContext['images']) =>
  getCover(item(kind, record), { images: projected ? GUIDE_IMAGES : images, today: FROM });
for (const event of EVENTS) inventory.push({ day: FROM, page: 'inventory', section: 'events', kind: 'event', id: event.id, tier: one('event', event, EVENTS_INDEX.images).tier, phone: false, desktop: false });
for (const offer of INDEX_OFFERS) inventory.push({ day: FROM, page: 'inventory', section: 'offers', kind: 'offer', id: offer.id, tier: one('offer', offer, EVENTS_INDEX.images).tier, phone: false, desktop: false });
for (const shop of INDEX_OPENINGS) inventory.push({ day: FROM, page: 'inventory', section: 'openings', kind: 'opening', id: shop.id, tier: one('opening', shop, EVENTS_INDEX.images).tier, phone: false, desktop: false });
for (const guide of GUIDES) inventory.push({ day: FROM, page: 'inventory', section: 'guides', kind: 'guide', id: guide.slug, tier: guideItem(guide, FROM, undefined).tier, phone: false, desktop: false });

const TIERS = ['official', 'photo', 'venue', 'stock', 'ai', 'scene3d', 'type'] as const;
const share = (list: readonly Slot[]) => {
  const count = Object.fromEntries(TIERS.map(tier => [tier, list.filter(slot => slot.tier === tier).length]));
  const pct = (n: number) => list.length ? Math.round(1000 * n / list.length) / 10 : 0;
  return { slots: list.length, withImage: list.length - count.type, infoCards: count.type, imagePct: pct(list.length - count.type), tiers: count };
};
/** ③④ pictures shown again within ADJACENT_CARDS cards of themselves on one page and day (DECISIONS 22 同页去重). */
const poolRepeats = (list: readonly Slot[]) => {
  const seen = new Map<string, Slot>();
  const repeats: string[] = [];
  for (const slot of list) {
    if (!slot.pool) continue;
    const key = `${slot.day} ${slot.page} ${slot.pool}`;
    const before = seen.get(key);
    if (before && slot.at! - before.at! < ADJACENT_CARDS) repeats.push(`${slot.day} ${slot.page} ${slot.pool.split('/').pop()} (${before.id} → ${slot.id})`);
    seen.set(key, slot);
  }
  return repeats;
};
const pages = [...new Set(slots.map(slot => slot.page))];
const summary = {
  from: FROM, days: DAYS, mode: MODE,
  pages: Object.fromEntries(pages.map(page => {
    const mine = slots.filter(slot => slot.page === page);
    const sections = [...new Set(mine.map(slot => slot.section))];
    return [page, {
      poolRepeats: poolRepeats(mine),
      all: share(mine), phoneFirstScreen: share(mine.filter(slot => slot.phone)), desktopFirstScreen: share(mine.filter(slot => slot.desktop)),
      sections: Object.fromEntries(sections.map(section => [section, share(mine.filter(slot => slot.section === section))])),
    }];
  })),
  inventory: Object.fromEntries(['events', 'offers', 'openings', 'guides'].map(section => [section, share(inventory.filter(slot => slot.section === section))])),
  infoCardsOnPages: slots.filter(slot => slot.tier === 'type').length,
};

if (OUT) writeFileSync(OUT, JSON.stringify({ summary, slots, inventory }, null, 1));
console.log(`Cover coverage (${MODE}) ${FROM} + ${DAYS} days`);
for (const [page, data] of Object.entries(summary.pages)) {
  const { all, phoneFirstScreen: phone, desktopFirstScreen: desktop } = data;
  console.log(`${page.padEnd(18)} ${String(all.imagePct).padStart(5)}% with a picture (${all.infoCards} info cards of ${all.slots}); first screen phone ${phone.imagePct}% · desktop ${desktop.imagePct}%; tiers ${TIERS.map(tier => `${tier} ${all.tiers[tier]}`).join(' · ')}; ③④ repeats within ${ADJACENT_CARDS} cards: ${data.poolRepeats.length}`);
}
for (const [section, data] of Object.entries(summary.inventory)) console.log(`inventory ${section.padEnd(9)} ${data.imagePct}% of ${data.slots} (${data.infoCards} info cards)`);
if (FAIL_ON_INFO && summary.infoCardsOnPages > 0) {
  console.error(`${summary.infoCardsOnPages} card slots are info cards (UI9-IMAGES §7: 0).`);
  process.exit(1);
}
