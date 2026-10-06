import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { guides } from '../src/data/guides';
import { getGuideMedia, GUIDE_IMAGES } from '../src/data/guide-media';
import { MONTHLY_EDITION, MONTHLY_EVENTS } from '../src/data/monthly-edition';
import { currentFreebies } from '../src/data/october-offers';
import { HOME_PATHWAYS } from '../src/data/home-pathways';
import { getHomeWeekend } from '../src/lib/home-weekend';
import { getBayAreaToday } from '../src/lib/monthly';
import { addCalendarDays } from '../src/lib/event-calendar';

// The first page needs summaries, not 128 articles, image galleries or planning instructions.
// Generate from the same catalog as detail pages so titles, dates and source checks cannot drift.
const homeSlugs = new Set<string>(HOME_PATHWAYS.flatMap(path => [...path.slugs]));
const homeGuides = guides.filter(guide => homeSlugs.has(guide.slug)).map(guide => ({
  slug: guide.slug, title: guide.title, summary: guide.summary, categoryLabel: guide.categoryLabel,
  readMinutes: guide.readMinutes, media: { cover: getGuideMedia(guide).cover },
}));
const today = getBayAreaToday();
const selectedIds = new Set<string>();
const offerIds = new Set<string>();
const weekends: Record<string, { ids: string[]; total: number }> = {};
for (let day = MONTHLY_EDITION.checkedAt <= today ? MONTHLY_EDITION.checkedAt : today; day <= MONTHLY_EDITION.throughDate; day = addCalendarDays(day, 1)) {
  const weekend = getHomeWeekend(day, MONTHLY_EVENTS);
  weekend.picks.forEach(({event}) => selectedIds.add(event.id));
  weekends[day] = { ids: weekend.picks.map(({event}) => event.id), total: weekend.events.length };
  currentFreebies.filter(offer => offer.availability === 'dated' && offer.verificationStatus !== 'needs-confirmation' && !!offer.startDate && (offer.endDate || offer.startDate) >= day)
    .sort((a,b) => (a.endDate || a.startDate!).localeCompare(b.endDate || b.startDate!)).slice(0,3).forEach(offer => offerIds.add(offer.id));
}
const events = MONTHLY_EVENTS.filter(event => selectedIds.has(event.id)).map(({ id,title,startDate,endDate,occurrenceDates,dateLabel,region,city,venue,category,cost,costLabel,officialUrl,sourceLabel,verifiedAt,imageKey }) => ({
  id,title,startDate,endDate,occurrenceDates,dateLabel,region,city,venue,category,cost,costLabel,officialUrl,sourceLabel,verifiedAt,imageKey,summary:'',plan:[],audience:[],
}));
await mkdir('src/data/generated', { recursive: true });
await writeFile('src/data/generated/home-catalog.json', JSON.stringify({
  guides: homeGuides, guideCount: guides.length, events, weekends, generatedAt: today, throughDate: MONTHLY_EDITION.throughDate, edition: MONTHLY_EDITION,
  offers: currentFreebies.filter(offer => offerIds.has(offer.id)).map(({ id,title,brand,startDate,endDate,dateLabel,availability,verificationStatus,requirement,sourceLabel,sourceUrl,verifiedAt }) => ({id,title,brand,startDate,endDate,dateLabel,availability,verificationStatus,requirement,sourceLabel,sourceUrl,verifiedAt})),
  images: { culture: GUIDE_IMAGES.culture, everyday: GUIDE_IMAGES.everyday },
}));
console.log(`Home catalog: ${homeGuides.length} summaries, ${events.length} event facts; no article bodies.`);

const dictionarySources = JSON.parse(await readFile('scripts/english-sources.json', 'utf8')) as string[];
const english = Object.assign({}, ...await Promise.all(dictionarySources.map(async file => JSON.parse(await readFile(file, 'utf8')))));
await writeFile('src/data/generated/english.json', JSON.stringify(english));
const { generateEnglishScopes } = await import('./generate-english-scopes');
await generateEnglishScopes(english, dictionarySources);
