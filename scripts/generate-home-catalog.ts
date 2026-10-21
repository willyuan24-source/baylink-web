import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { guides } from '../src/data/guides';
import { getGuideMedia, GUIDE_IMAGES, type GuideImage } from '../src/data/guide-media';
import { MONTHLY_EDITION, MONTHLY_EVENTS } from '../src/data/monthly-edition';
import { PLANNER_EVENTS } from '../src/data/planner-catalog';
import { currentFreebies } from '../src/data/october-offers';
import { HOME_INTENTS } from '../src/data/home-pathways';
import { guideTopicOf } from '../src/data/guide-topics';
import { SCENE3D_POSTCARD_IMAGES } from '../src/data/scene3d-postcards';
import { EVENT_CONTEXT_PHOTOS } from '../src/data/event-image-usage';
import { guideReadMinutes, guideSourceCount } from '../src/features/guides/guide-facts';
import { GUIDE_EDITORIAL } from '../src/data/guide-editorial';
import { getCover, rightsBasisOf, type CoverAsset } from '../src/lib/cover';
import { getBuildWeekend } from '../src/lib/home-weekend-build';
import { listingImageKeys } from '../src/lib/cover-candidates';
import { offerHasPhoto, offerLeadsRail, selectHomeOffers, type HomeOffer } from '../src/lib/home-offers';
import { getBayAreaToday } from '../src/lib/monthly';
import { addCalendarDays } from '../src/lib/event-calendar';
import { isSeniorFriendly } from '../src/lib/senior-friendly';
import { checkSummary } from '../src/lib/check-dates';
import { isPressSource } from '../src/lib/event-facts';
import type { HomeWeekendSnapshot } from '../src/lib/home-weekend';
import { WEEKEND_PICKS } from '../src/data/weekend-picks';

// The first page needs summaries, not 141 articles, image galleries or planning instructions (plan WEB-HOME).
// Generate from the same catalogs as detail pages so titles, dates and source checks cannot drift:
// - weekends: for each day of the four weekends from the build day, the three picks (the weekly share card's)
//   and the eight feed cards after them, with the weekend's event count, its 长辈友好 count (the home circle, H06) and
//   when its events were checked (most of them, and the latest: the home subtitle, H02);
// - events: only the events some day shows, with the overlay fields and planning facts a card prints (date, time, price);
// - guides: the intent rail's guides (topic, palette, source count, cover key), never their bodies;
// - offers: only the offers some day's ticket rail selects (src/lib/home-offers.ts), with their image keys (HOME+3);
// - images: every image those use, with the ladder's srcset and placeholder colour (the home renders CoverImage);
// - scene3d, scene3dStrip: the 3D tile's and the feed strip's postcards (labelled 3D 场景插图 through getImageProvenance).
const homeSlugs = new Set<string>(HOME_INTENTS.flatMap(intent => [...intent.slugs]));
// The stock laptop photo is off-topic on every guide (features/guides keepInlineImage); its guides show their information card.
const OFF_TOPIC_COVERS = new Set(['/guides/coverage-2026/coverage-laptop.webp']);
const today = getBayAreaToday();
// Four weekends from the build day: the site redeploys far more often than that (and daily once the owner adds the
// deploy hook, WEB-FRESH2). A day outside the snapshots is computed from the shipped events, so it degrades, never breaks:
// its picks come from the compact pool and its count is unknown (getHomeWeekend's total is null; the home prints no number).
const lastDay = [MONTHLY_EDITION.throughDate, addCalendarDays(today, 27)].sort()[0];
const imageKeys = new Set<string>();
const guideImages: Record<string, GuideImage> = {};
const homeGuides = guides.filter(guide => homeSlugs.has(guide.slug)).map(guide => {
  const topic = guideTopicOf(guide);
  const cover = getGuideMedia(guide).cover;
  // Guides have no image key: the cover is stored under its own path. A cover the ladder refuses (an AI illustration,
  // the off-topic photo) is not shipped at all; the card is the topic's information card.
  const usable = !OFF_TOPIC_COVERS.has(cover.src) && getCover({ kind: 'guide', id: guide.slug, imageKey: cover.src }, { images: () => cover, today }).tier !== 'type';
  if (usable) guideImages[cover.src] = cover;
  return {
    // UI9-C: no palette or texture icon any more (the cover family follows the topic and the hook).
    slug: guide.slug, title: guide.title, topic,
    // The home rail's covers print the title after its colon (GuideRail): the answered hooks stay off the home's JS (route JS
    // ≤ base, captain decision 9); /guides and a guide's 接下来 rail print them (generate-guide-data.ts).
    sources: guideSourceCount(guide), readMinutes: guideReadMinutes(guide), ...(usable ? { imageKey: cover.src } : {}),
  };
});
// UI9-HOME: 长辈常用电话 — the 长辈与家属 intent's guides that carry a cover phone (the number the guide's own call button
// dials), in the intent's order: the guide's slug and cover question, the phone's label, the number as written and its tel.
const elderCalls = (HOME_INTENTS.find(intent => intent.id === 'elders')?.slugs ?? []).flatMap(slug => {
  const cover = GUIDE_EDITORIAL[slug]?.cover;
  return cover?.phone ? [{ slug, title: cover.question, label: cover.phone.label, number: cover.phone.number, tel: cover.phone.tel }] : [];
});
const missing = [...homeSlugs].filter(slug => !homeGuides.some(guide => guide.slug === slug));
if (missing.length) throw new Error(`Home intent guides not in the catalog: ${missing.join(', ')}`);

const selectedIds = new Set<string>();
const offerIds = new Set<string>();
const weekends: Record<string, HomeWeekendSnapshot> = {};
const planning = new Map(PLANNER_EVENTS.map(event => [event.id, event.planning]));
// H26: /events and the home call the automatic ranking 本周末先看; only an editor list is 编辑精选. The list is due Thursday 18:00
// (src/data/weekend-picks.ts), so a build from Thursday on says when the coming weekend still has none.
{
  const saturday = getBuildWeekend(today, MONTHLY_EVENTS).start;
  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
  if ((weekday >= 4 || weekday === 0) && !WEEKEND_PICKS[saturday]?.length) console.warn(`Warning: no editor picks for the weekend of ${saturday} in src/data/weekend-picks.ts; /events and the home show the automatic ranking as 本周末先看.`);
}
// With their cover candidates (venue photos), so the rail's photo steps see what the page will show.
const liveOffers = currentFreebies.filter(offer => offer.verificationStatus !== 'needs-confirmation').map(offer => ({ ...offer, ...listingImageKeys('offer', offer) }));


const weekendDays = new Set<string>();
for (let day = today; day <= lastDay; day = addCalendarDays(day, 1)) {
  const weekend = getBuildWeekend(day, MONTHLY_EVENTS);
  for (const { event } of [...weekend.picks, ...weekend.feed]) selectedIds.add(event.id);
  weekendDays.add(weekend.start).add(weekend.end);
  const seniors = weekend.events.filter(({ event }) => isSeniorFriendly({ ...event, planning: planning.get(event.id) ?? undefined })).length;
  weekends[day] = { ids: weekend.picks.map(({ event }) => event.id), feed: weekend.feed.map(({ event }) => event.id), total: weekend.events.length, seniors,
    ...(() => { const checked = checkSummary(weekend.events.map(({ event }) => event.verifiedAt), day); return checked ? { checked } : {}; })() };
  selectHomeOffers(liveOffers, day, 6, offerHasPhoto(GUIDE_IMAGES, day), offerLeadsRail(GUIDE_IMAGES, day)).forEach(offer => offerIds.add(offer.id));
}

// The pictures a card may show (its own, then its candidates: venue photos from UI9-IMG-A1a), each written and shipped only
// when the cover ladder accepts it for that item: a key no card can show (an AI illustration, a theme photo, an old photo)
// stays out of the catalog with its image.
const cardImages = (kind: 'event' | 'offer', record: Parameters<typeof listingImageKeys>[1]) => {
  const fields = listingImageKeys(kind, record, key => getCover({ kind, id: record.id, imageKey: key }, { images: GUIDE_IMAGES, today, contextPhotos: EVENT_CONTEXT_PHOTOS }).tier !== 'type');
  for (const key of [fields.imageKey, ...fields.imageKeys ?? []]) if (key) imageKeys.add(key);
  return fields;
};
const present = <T extends object>(source: T, keys: readonly string[]) => Object.fromEntries(keys.flatMap(key => {
  const value = (source as Record<string, unknown>)[key];
  return value === undefined || value === null || value === '' || (Array.isArray(value) && !value.length) ? [] : [[key, value]];
}));
// A card prints one weekend day's time: the schedule keeps its weekly hours and only the weekend days' dated entries.
const weekendSchedule = (schedule: NonNullable<NonNullable<(typeof PLANNER_EVENTS)[number]['planning']>['schedule']>) => {
  const dates = schedule.dates && Object.fromEntries(Object.entries(schedule.dates).filter(([day]) => weekendDays.has(day)));
  const sessions = schedule.sessions?.filter(session => weekendDays.has(session.date));
  const slim = present({ ...schedule, dates: dates && Object.keys(dates).length ? dates : undefined, sessions }, ['validFrom', 'validThrough', 'weekly', 'dates', 'sessions']);
  return Object.keys(slim).length ? slim : undefined;
};
// What a home card and the weekend selection read (src/lib/home-weekend.ts, src/lib/event-facts.ts): no venue line, long date
// label, cost sentence, summary or official URL — the detail page has them.
// DECISIONS 15: a close-up face photo still ships; only the home's lead slot draws the type cover instead (HomeDiscovery,
// lib/close-up-faces.ts leadImageKey), so the feed and /plan's 本周末精选, which read this snapshot, keep the photo.
const events = MONTHLY_EVENTS.filter(event => selectedIds.has(event.id)).map(event => {
  const facts = planning.get(event.id);
  const schedule = facts?.schedule && weekendSchedule(facts.schedule);
  const plan = facts ? present({ admissionUsd: facts.admissionUsd, schedule }, ['admissionUsd', 'schedule']) : {};
  const sessions = event.sessions?.filter(session => weekendDays.has(session.date));
  const { id, title, aliases, startDate, endDate, occurrenceDates, region, city, category, cost, verifiedAt, audience } = event;
  return {
    id, title, ...(aliases?.length ? { aliases } : {}), startDate, endDate, ...(occurrenceDates !== undefined ? { occurrenceDates } : {}), region, city, category, cost,
    verifiedAt, ...cardImages('event', event), audience, ...present({ ...event, sessions }, ['shortTitle', 'sessions', 'price', 'venueShort', 'iconKey', 'status']),
    // DECISIONS 17: a press-sourced card says 媒体报道 · M/D 核对 (the one prefix rule); only such an event carries the flag.
    ...(isPressSource(event.sourceLabel) ? { press: true } : {}),
    ...(Object.keys(plan).length ? { planning: plan } : {}),
  };
});
const offers: HomeOffer[] = liveOffers.filter(offer => offerIds.has(offer.id)).map(offer => {
  return {
    id: offer.id, title: offer.title, brand: offer.brand, availability: offer.availability, kind: offer.kind, ...cardImages('offer', offer),
    ...present(offer, ['region', 'startDate', 'endDate', 'verifiedAt', 'valueText', 'publicBenefit']),
    ...(isPressSource(offer.sourceLabel) ? { press: true } : {}),
  } as HomeOffer;
});
// Only images the cover ladder accepts for their item are shipped (an AI illustration, a theme photo, an undated or old
// photo would be an information card anyway), with the fields getCover, the badge and the credits read; the rights
// prose becomes its basis, which is all the ladder and the badge use from it.
const IMAGE_FIELDS = ['src', 'srcSet', 'width', 'height', 'alt', 'kind', 'fullFrame', 'caption', 'credit', 'creditUrl', 'licenseUrl', 'lqip', 'shotAt', 'photoDate', 'ownShot', 'coverOk', 'focal', 'scene3d', 'subject', 'aiCoverApproved'];
const slimImage = (image: GuideImage) => ({ ...present(image, IMAGE_FIELDS), rights: { basis: rightsBasisOf(image as CoverAsset) } });
const images = Object.fromEntries([...[...imageKeys].sort().map(key => [key, slimImage(GUIDE_IMAGES[key])] as const),
  ...Object.entries(guideImages).sort(([a], [b]) => a.localeCompare(b)).map(([key, image]) => [key, slimImage(image)] as const)]);
const scene3d = slimImage(SCENE3D_POSTCARD_IMAGES['scene3d-sf-golden-gate-fog']);
// H36: the weekend feed's 3D strip, a different postcard from the tile's.
const scene3dStrip = slimImage(SCENE3D_POSTCARD_IMAGES['scene3d-sf-chinatown-lanterns']);

await mkdir('src/data/generated', { recursive: true });
await writeFile('src/data/generated/home-catalog.json', JSON.stringify({
  guides: homeGuides, guideCount: guides.length, elderCalls, events, weekends, generatedAt: today, throughDate: MONTHLY_EDITION.throughDate,
  edition: { checkedAt: MONTHLY_EDITION.checkedAt, throughDate: MONTHLY_EDITION.throughDate }, offers, images, scene3d, scene3dStrip,
}));
console.log(`Home catalog: ${homeGuides.length} guide summaries, ${events.length} event facts, ${offers.length} offers; no article bodies.`);
// The cover resolver's venue/theme approvals (src/lib/cover.ts) as plain data, without the media registry they are built from.
await writeFile('src/data/generated/event-context-photos.json', JSON.stringify(Object.fromEntries(Object.entries(EVENT_CONTEXT_PHOTOS).sort(([a], [b]) => a.localeCompare(b)))));

const dictionarySources = JSON.parse(await readFile('scripts/english-sources.json', 'utf8')) as string[];
// Keys are looked up whitespace-normalized (locale.ts normalizeText): a multi-line source key (a guide's copyable template)
// is stored the same way, or it never matches and /en shows the Chinese lines (I18N-SEO-02). Values keep their newlines.
const english = Object.fromEntries(Object.entries(Object.assign({}, ...await Promise.all(dictionarySources.map(async file => JSON.parse(await readFile(file, 'utf8'))))) as Record<string, string>)
  .map(([key, value]) => [key.trim().replace(/\s+/g, ' '), value]));
await writeFile('src/data/generated/english.json', JSON.stringify(english));
const { generateEnglishScopes } = await import('./generate-english-scopes');
await generateEnglishScopes(english, dictionarySources);
// The events column's slim index (RC-33) is generated with the home catalog: same inputs, same prebuild/pretest step.
await import('./generate-events-index');
