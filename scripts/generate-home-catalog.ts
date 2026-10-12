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
import { guideReadMinutes, guideSourceCount, TOPIC_COVER } from '../src/features/guides/guide-facts';
import { getCover, rightsBasisOf, type CoverAsset } from '../src/lib/cover';
import { getBuildWeekend } from '../src/lib/home-weekend-build';
import { selectHomeOffers, type HomeOffer } from '../src/lib/home-offers';
import { getBayAreaToday } from '../src/lib/monthly';
import { addCalendarDays } from '../src/lib/event-calendar';

// The first page needs summaries, not 141 articles, image galleries or planning instructions (plan WEB-HOME).
// Generate from the same catalogs as detail pages so titles, dates and source checks cannot drift:
// - weekends: for each day of the four weekends from the build day, the three picks (the weekly share card's)
//   and the eight feed cards after them, with the weekend's event count;
// - events: only the events some day shows, with the overlay fields and planning facts a card prints (date, time, price);
// - guides: the intent rail's guides (topic, palette, source count, cover key), never their bodies;
// - offers: only the offers some day's ticket rail selects (src/lib/home-offers.ts), with their image keys (HOME+3);
// - images: every image those use, with the ladder's srcset and placeholder colour (the home renders CoverImage);
// - scene3d: the 3D tile's postcard (labelled 3D 场景插图 through getImageProvenance).
const homeSlugs = new Set<string>(HOME_INTENTS.flatMap(intent => [...intent.slugs]));
// The stock laptop photo is off-topic on every guide (features/guides keepInlineImage); its guides show their information card.
const OFF_TOPIC_COVERS = new Set(['/guides/coverage-2026/coverage-laptop.webp']);
const today = getBayAreaToday();
// Four weekends from the build day: the site redeploys far more often than that (and daily once the owner adds the
// deploy hook, WEB-FRESH2). A day outside the snapshots is computed from the shipped events, so it degrades, never breaks.
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
    slug: guide.slug, title: guide.title, topic, tone: TOPIC_COVER[topic].tone, icon: TOPIC_COVER[topic].icon,
    sources: guideSourceCount(guide), readMinutes: guideReadMinutes(guide), ...(usable ? { imageKey: cover.src } : {}),
  };
});
const missing = [...homeSlugs].filter(slug => !homeGuides.some(guide => guide.slug === slug));
if (missing.length) throw new Error(`Home intent guides not in the catalog: ${missing.join(', ')}`);

const selectedIds = new Set<string>();
const offerIds = new Set<string>();
const weekends: Record<string, { ids: string[]; feed: string[]; total: number }> = {};
const liveOffers = currentFreebies.filter(offer => offer.verificationStatus !== 'needs-confirmation');
const weekendDays = new Set<string>();
for (let day = today; day <= lastDay; day = addCalendarDays(day, 1)) {
  const weekend = getBuildWeekend(day, MONTHLY_EVENTS);
  for (const { event } of [...weekend.picks, ...weekend.feed]) selectedIds.add(event.id);
  weekendDays.add(weekend.start).add(weekend.end);
  weekends[day] = { ids: weekend.picks.map(({ event }) => event.id), feed: weekend.feed.map(({ event }) => event.id), total: weekend.events.length };
  selectHomeOffers(liveOffers, day).forEach(offer => offerIds.add(offer.id));
}

const planning = new Map(PLANNER_EVENTS.map(event => [event.id, event.planning]));
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
const events = MONTHLY_EVENTS.filter(event => selectedIds.has(event.id)).map(event => {
  const facts = planning.get(event.id);
  const schedule = facts?.schedule && weekendSchedule(facts.schedule);
  const plan = facts ? present({ admissionUsd: facts.admissionUsd, schedule }, ['admissionUsd', 'schedule']) : {};
  const sessions = event.sessions?.filter(session => weekendDays.has(session.date));
  const { id, title, aliases, startDate, endDate, occurrenceDates, region, city, category, cost, verifiedAt, imageKey, audience } = event;
  if (getCover({ kind: 'event', id, imageKey }, { images: GUIDE_IMAGES, today, contextPhotos: EVENT_CONTEXT_PHOTOS }).tier !== 'type') imageKeys.add(imageKey);
  return {
    id, title, ...(aliases?.length ? { aliases } : {}), startDate, endDate, ...(occurrenceDates !== undefined ? { occurrenceDates } : {}), region, city, category, cost,
    verifiedAt, imageKey, audience, ...present({ ...event, sessions }, ['shortTitle', 'sessions', 'price', 'venueShort', 'iconKey', 'status']),
    ...(Object.keys(plan).length ? { planning: plan } : {}),
  };
});
const offers: HomeOffer[] = liveOffers.filter(offer => offerIds.has(offer.id)).map(offer => {
  if (getCover({ kind: 'offer', id: offer.id, imageKey: offer.imageKey }, { images: GUIDE_IMAGES, today, contextPhotos: EVENT_CONTEXT_PHOTOS }).tier !== 'type') imageKeys.add(offer.imageKey);
  return {
    id: offer.id, title: offer.title, brand: offer.brand, availability: offer.availability, kind: offer.kind, imageKey: offer.imageKey,
    ...present(offer, ['region', 'startDate', 'endDate', 'verifiedAt', 'valueText', 'publicBenefit']),
  } as HomeOffer;
});
// Only images the cover ladder accepts for their item are shipped (an AI illustration, a theme photo, an undated or old
// photo would be an information card anyway), with the fields getCover, the badge and the credits read; the rights
// prose becomes its basis, which is all the ladder and the badge use from it.
const IMAGE_FIELDS = ['src', 'srcSet', 'width', 'height', 'alt', 'kind', 'fullFrame', 'caption', 'credit', 'creditUrl', 'licenseUrl', 'lqip', 'shotAt', 'photoDate', 'ownShot', 'coverOk', 'focal', 'scene3d'];
const slimImage = (image: GuideImage) => ({ ...present(image, IMAGE_FIELDS), rights: { basis: rightsBasisOf(image as CoverAsset) } });
const images = Object.fromEntries([...[...imageKeys].sort().map(key => [key, slimImage(GUIDE_IMAGES[key])] as const),
  ...Object.entries(guideImages).sort(([a], [b]) => a.localeCompare(b)).map(([key, image]) => [key, slimImage(image)] as const)]);
const scene3d = slimImage(SCENE3D_POSTCARD_IMAGES['scene3d-sf-golden-gate-fog']);

await mkdir('src/data/generated', { recursive: true });
await writeFile('src/data/generated/home-catalog.json', JSON.stringify({
  guides: homeGuides, guideCount: guides.length, events, weekends, generatedAt: today, throughDate: MONTHLY_EDITION.throughDate,
  edition: { checkedAt: MONTHLY_EDITION.checkedAt, throughDate: MONTHLY_EDITION.throughDate }, offers, images, scene3d,
}));
console.log(`Home catalog: ${homeGuides.length} guide summaries, ${events.length} event facts, ${offers.length} offers; no article bodies.`);
// The cover resolver's venue/theme approvals (src/lib/cover.ts) as plain data, without the media registry they are built from.
await writeFile('src/data/generated/event-context-photos.json', JSON.stringify(Object.fromEntries(Object.entries(EVENT_CONTEXT_PHOTOS).sort(([a], [b]) => a.localeCompare(b)))));

const dictionarySources = JSON.parse(await readFile('scripts/english-sources.json', 'utf8')) as string[];
const english = Object.assign({}, ...await Promise.all(dictionarySources.map(async file => JSON.parse(await readFile(file, 'utf8')))));
await writeFile('src/data/generated/english.json', JSON.stringify(english));
const { generateEnglishScopes } = await import('./generate-english-scopes');
await generateEnglishScopes(english, dictionarySources);
// The events column's slim index (RC-33) is generated with the home catalog: same inputs, same prebuild/pretest step.
await import('./generate-events-index');
