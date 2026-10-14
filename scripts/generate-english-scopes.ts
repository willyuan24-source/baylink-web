import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import ts from 'typescript';
import { guides, GUIDE_CATEGORY_TABS } from '../src/data/guides';
import { getGuideMedia, GUIDE_IMAGES } from '../src/data/guide-media';
import { MONTHLY_EDITION, MONTHLY_EVENTS, MONTHLY_PLACES } from '../src/data/monthly-edition';
import { EVENT_SCHEDULE_NOTES } from '../src/data/event-schedule-notes';
import { currentFreebies } from '../src/data/october-offers';
import { currentOpenings } from '../src/data/local-discoveries';
import { currentRegionalBulletins } from '../src/data/october-2026-bulletins';
import { PLANNER_CATALOG } from '../src/data/planner-catalog';
import { ATTRACTIONS, ATTRACTION_COSTS, ATTRACTION_REGIONS, ATTRACTION_THEMES } from '../src/data/attractions';
import { ATTRACTION_REGION_INTROS } from '../src/data/attraction-region-intros';
import { READER_PATHS } from '../src/data/reader-paths';
import { perksPosterCaption, perksPosters } from '../src/data/perks-posters';
import { LIFE_TOOLS, TOOLS_METADATA } from '../src/data/tool-catalog';
import { DETAIL_BUCKET_COUNT, detailBucket, type EnglishDictionary } from '../src/lib/english-loading';
import { allDetailRecords } from '../src/features/detail/build-detail';
import eventIdAliases from '../src/data/event-id-aliases.json';
import { buildGuideData, writeGuideData } from './generate-guide-data';
import { buildPlanCatalog, writePlanCatalog } from './generate-plan-catalog';
import { SCENE3D_POSTCARD_IMAGES } from '../src/data/scene3d-postcards';
import { getOfferImage } from '../src/lib/offer-media';
import { generateTraditionalPhrases } from './generate-traditional-phrases';
import officialEventMedia from '../src/data/official-event-media.json';
import { CALENDAR_CITY_LOCATIONS } from '../src/data/calendar-city-locations';
import { OFFICIAL_EVENT_IMAGE_UPDATES, VERIFIED_EVENT_CONTEXT_PHOTOS, VERIFIED_EVENT_PLACE_MEDIA_UPDATES, VERIFIED_OFFER_PLACE_MEDIA_UPDATES, VERIFIED_PLACE_PHOTO_ALIASES } from '../src/data/verified-place-media-updates';
import { OCTNOV_EVENT_CONTEXT_PHOTOS, OCTNOV_EVENT_MEDIA_UPDATES, OCTNOV_EVENT_PHOTO_ALIASES } from '../src/data/octnov-2026-event-photo-aliases';
import { EVENT_CONTEXT_PHOTOS } from '../src/data/event-image-usage';
import { englishTimes } from '../src/lib/english-times';

const normalize = (text: string) => text.trim().replace(/\s+/gu, ' ');
const chinese = /[\u3400-\u9fff]/u;
/** Language-neutral text with a time or a numeric date ("10/18 · 14:00–16:00") can have an English entry (H41). */
const timeOrDate = /\d[:/-]\d/u;
const FRAGMENTS = /\n| · | \/ |｜|：/u;

/** Select from the reviewed complete dictionary; never manufacture translations. */
export function englishDictionaryForValues(dictionary: EnglishDictionary, values: unknown): EnglishDictionary {
  const selected: EnglishDictionary = {};
  const visit = (value: unknown) => {
    if (typeof value === 'string') {
      if (!chinese.test(value) && !timeOrDate.test(value)) return;
      const key = normalize(value);
      if (Object.hasOwn(dictionary, key)) selected[key] = dictionary[key];
      for (const part of value.split(FRAGMENTS)) {
        const fragment = normalize(part);
        if (fragment !== key && Object.hasOwn(dictionary, fragment)) selected[fragment] = dictionary[fragment];
      }
    } else if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === 'object') Object.values(value).forEach(visit);
  };
  visit(values);
  return selected;
}

/** Catalog fields rendered as UI are controlled labels, not editorial bodies or user drafts. */
export function englishDictionaryForUiValues(dictionary: EnglishDictionary, sourceStrings: unknown): EnglishDictionary {
  return englishDictionaryForValues(dictionary, [sourceStrings, LIFE_TOOLS, TOOLS_METADATA]);
}

/** Historical UI source files also contain editorial prose; its owning content packs supply it. */
export function englishDictionaryForUiScope(dictionary: EnglishDictionary, sourceStrings: unknown, supplementalDictionaries: EnglishDictionary[], editorialValues: unknown): EnglishDictionary {
  const requiredUi = englishDictionaryForUiValues(dictionary, sourceStrings);
  const editorial = englishDictionaryForValues(dictionary, editorialValues);
  const ui = { ...requiredUi };
  for (const supplemental of supplementalDictionaries) {
    for (const [key, value] of Object.entries(supplemental)) {
      // Actual UI references take priority even when they share an editorial string.
      // Keep supplemental dynamic labels that cannot be found as complete AST literals.
      if (Object.hasOwn(requiredUi, key) || !Object.hasOwn(editorial, key)) ui[key] = value;
    }
  }
  // Keep final source precedence identical across full and scoped loads.
  for (const key of Object.keys(ui)) if (Object.hasOwn(dictionary, key)) ui[key] = dictionary[key];
  return ui;
}

/**
 * H41 (I13-04): US-style times and dates in English (lib/english-times.ts). The site converts the English values as they
 * load (i18n/locale.ts enableUsEnglishTimes; the dictionary keeps the reviewed text, which the Opus Bay game shows as it
 * is). Here every language-neutral display string of the content ("10/18 · 14:00–16:00", a date line with no Chinese,
 * shown as it is on /en until now) gets an English entry of its own, which the site's translateText looks up. A bare token
 * (an ISO date, a session's "14:00") is data, never an entry: JSON-LD dates and catalog fields keep their format.
 */
const BARE_TOKEN = /^[\d:/\-–—~ T+.]+$/u;
export function addNeutralEntries(dictionary: EnglishDictionary, values: unknown): number {
  let added = 0;
  const add = (text: string) => {
    const key = normalize(text);
    if (!key || chinese.test(key) || !timeOrDate.test(key) || BARE_TOKEN.test(key) || Object.hasOwn(dictionary, key) || /^https?:|@/.test(key)) return;
    const english = englishTimes(key);
    if (english !== key) { dictionary[key] = english; added++; }
  };
  const visit = (value: unknown) => {
    if (typeof value === 'string') {
      if (chinese.test(value) || !timeOrDate.test(value)) return;
      add(value);
      for (const part of value.split(FRAGMENTS)) if (part !== value) add(part);
    } else if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === 'object') Object.values(value).forEach(visit);
  };
  visit(values);
  return added;
}

async function uiStrings(directories = ['app', 'components', 'features', 'lib', 'pages', 'i18n', 'utils']): Promise<string[]> {
  const strings: string[] = [];
  const scan = async (directory: string) => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await scan(path);
      // the API's messages carry their own English table, loaded only when an English page shows an API error (H48)
      else if (/\.tsx?$/u.test(entry.name) && entry.name !== 'api-errors-en.ts') {
        const source = ts.createSourceFile(path, await readFile(path, 'utf8'), ts.ScriptTarget.Latest, true, path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
        const visit = (node: ts.Node) => {
          if (ts.isStringLiteralLike(node) || ts.isJsxText(node) || node.kind === ts.SyntaxKind.TemplateHead || node.kind === ts.SyntaxKind.TemplateMiddle || node.kind === ts.SyntaxKind.TemplateTail) {
            const text = (node as ts.StringLiteral).text;
            if (chinese.test(text)) strings.push(text);
          }
          ts.forEachChild(node, visit);
        };
        visit(source);
      }
    }
  };
  // The 3D world and editorial data have independent content packs.
  await Promise.all(directories.map(directory => scan(`src/${directory}`)));
  // Parallel file reads must not change dictionary order or asset hashes.
  return strings.sort();
}

export async function generateEnglishScopes(dictionary: EnglishDictionary, dictionarySources: string[]) {
  const directory = 'src/data/generated/english-scopes';
  await mkdir(directory, { recursive: true });
  const uiDictionaries = await Promise.all(dictionarySources.filter(path => /(?:-ui-en|audit-runtime-en|public-service-media-en)\.json$/u.test(path)).map(async path => JSON.parse(await readFile(path, 'utf8')) as EnglishDictionary));
  // These fields are already covered by the guide, discovery, planning and explore packs below.
  // Home selects any of them it actually displays from its own materialized catalog.
  const editorialProse = [
    guides.map(guide => [guide.summary, guide.sourceNote, guide.blocks.flatMap(block => block.type === 'paragraph' ? [block.text] : [])]),
    currentRegionalBulletins.map(bulletin => bulletin.summary),
    Object.values(ATTRACTION_REGION_INTROS).map(intro => [intro.text, intro.planning]),
  ];
  const ui = englishDictionaryForUiScope(dictionary, await uiStrings(), uiDictionaries, editorialProse);
  // The guide routes' generated index and per-guide records (WEB-DATA-SPLIT): /guides translates what its cards show
  // ('guide-list'), and an article's own scope covers everything its record renders, "Read next" cards included.
  const guideData = await buildGuideData();
  await writeGuideData(guideData);
  const records = new Map(guideData.records.map(record => [record.guide.slug, record]));
  // 行程's generated catalog (WEB-PLAN-DATA): its workspace translates what the catalog carries ('plan-catalog') and the 3D
  // postcards' credits, loaded with the catalog instead of the whole planning, discovery and guide-index packs.
  const planCatalog = buildPlanCatalog();
  await writePlanCatalog(planCatalog);
  const remaining = (values: unknown) => Object.fromEntries(Object.entries(englishDictionaryForValues(dictionary, values)).filter(([key]) => !Object.hasOwn(ui, key)));
  const guideIndex = [guides.map(guide => ({ ...Object.fromEntries(Object.entries(guide).filter(([key]) => key !== 'blocks')), media: getGuideMedia(guide).cover })), GUIDE_CATEGORY_TABS, READER_PATHS];
  // The events column (/events, /calendar) renders the slim events index and the media tables its covers read: its own pack
  // ('events-list', WEB-DATA-SPLIT) instead of the whole discovery catalog and every guide. The index is generated here,
  // first: importing the generator runs it once (generate:home's own import of it afterwards is the same, cached module).
  await import('./generate-events-index');
  const eventsList = [JSON.parse(await readFile('src/data/generated/events-index.json', 'utf8')), officialEventMedia, CALENDAR_CITY_LOCATIONS,
    VERIFIED_PLACE_PHOTO_ALIASES, VERIFIED_EVENT_PLACE_MEDIA_UPDATES, OFFICIAL_EVENT_IMAGE_UPDATES, VERIFIED_EVENT_CONTEXT_PHOTOS, VERIFIED_OFFER_PLACE_MEDIA_UPDATES,
    OCTNOV_EVENT_PHOTO_ALIASES, OCTNOV_EVENT_MEDIA_UPDATES, OCTNOV_EVENT_CONTEXT_PHOTOS, EVENT_CONTEXT_PHOTOS,
    // every compact schedule note: the calendar can show any of them (tests/octnov-metadata-i18n.test.tsx)
    EVENT_SCHEDULE_NOTES];
  const scopeValues: Record<string, unknown> = {
    game: await uiStrings(['opus-bay']),
    home: JSON.parse(await readFile('src/data/generated/home-catalog.json', 'utf8')),
    'guide-index': guideIndex,
    // the cards, and what the saved shelf (/guides?view=saved, ReaderLibrary) adds to them: each guide's category label
    'guide-list': [guideData.index, guides.map(guide => guide.categoryLabel)],
    'events-list': eventsList,
    'guide-search': [guides, guides.map(getGuideMedia), perksPosters],
    discovery: [MONTHLY_EDITION, MONTHLY_EVENTS, MONTHLY_PLACES, EVENT_SCHEDULE_NOTES, currentFreebies, currentOpenings, currentRegionalBulletins, GUIDE_IMAGES, perksPosters],
    planning: [PLANNER_CATALOG, ATTRACTION_REGION_INTROS],
    'plan-catalog': [planCatalog, SCENE3D_POSTCARD_IMAGES],
    explore: [ATTRACTIONS, ATTRACTION_COSTS, ATTRACTION_REGIONS, ATTRACTION_THEMES, ATTRACTION_REGION_INTROS, ATTRACTIONS.map(place => { const guide = guides.find(item => item.slug === place.slug); return guide ? getGuideMedia(guide) : undefined; })],
  };
  // the detail records and the article records are the other places the pages read neutral date lines from
  const neutral = addNeutralEntries(dictionary, [Object.entries(scopeValues).filter(([scope]) => scope !== 'game').map(([, values]) => values), [...allDetailRecords().values()], guideData.records]);
  // the full dictionary (loaded by exports and by /en pages without a scope) carries them too
  await writeFile('src/data/generated/english.json', JSON.stringify(dictionary));
  const registry: Record<string, string> = { ui: 'ui.json' };
  const sizes: Record<string, number> = { ui: gzipSync(JSON.stringify(ui)).length };
  await writeFile(`${directory}/ui.json`, JSON.stringify(ui));
  for (const [scope, values] of Object.entries(scopeValues)) {
    registry[scope] = `${scope}.json`;
    const serialized = JSON.stringify(remaining(values));
    sizes[scope] = gzipSync(serialized).length;
    await writeFile(`${directory}/${scope}.json`, serialized);
  }
  // The posters' share captions (PerksGallery) pass their fixed lines through translate() at render time.
  const posterCaptionLines: string[] = [];
  for (const poster of perksPosters) perksPosterCaption(poster, text => { posterCaptionLines.push(text); return text; });
  for (const guide of guides) {
    if (!/^[a-z0-9][a-z0-9-]*$/u.test(guide.slug)) throw new Error(`Unsafe guide scope slug: ${guide.slug}`);
    // The deals board resolves each offer's picture at runtime (getOfferImage): its alt text, caption and credit too.
    const offers = guide.blocks.flatMap(block => block.type === 'freebies' ? block.offers : []);
    const values = [records.get(guide.slug), offers.length ? [perksPosters, posterCaptionLines, offers.map(getOfferImage)] : undefined];
    const file = `guide-${guide.slug}.json`;
    registry[`guide:${guide.slug}`] = file;
    await writeFile(`${directory}/${file}`, JSON.stringify(remaining(values)));
  }
  // Event, offer and opening details: one pack per detail bucket (the listing, its rails and its head), so a detail page
  // loads ~10 listings' English instead of the whole discovery pack (ENGSEC-01; lib/english-loading.ts detailBucket).
  const detailValues: unknown[][] = Array.from({ length: DETAIL_BUCKET_COUNT }, () => []);
  const detailRecords = allDetailRecords();
  const keyed = [...detailRecords].map(([key, record]) => [key, record] as const);
  for (const [alias, canonical] of Object.entries(eventIdAliases as Record<string, string>)) { const record = detailRecords.get(`event:${canonical}`); if (record) keyed.push([`event:${alias}`, record]); }
  for (const [key, record] of keyed) {
    const [kind, id] = key.split(':') as ['event' | 'offer' | 'opening', string];
    detailValues[Number(detailBucket(kind, id))].push(record);
  }
  for (const [index, values] of detailValues.entries()) {
    const bucket = String(index).padStart(2, '0');
    registry[`detail-${bucket}`] = `detail-${bucket}.json`;
    await writeFile(`${directory}/detail-${bucket}.json`, JSON.stringify(remaining(values)));
  }
  const lines = Object.entries(registry).map(([scope, file]) => `  ${JSON.stringify(scope)}: () => import(${JSON.stringify(`./english-scopes/${file}`)}),`);
  await writeFile('src/data/generated/english-scope-loaders.ts', `// Generated by scripts/generate-english-scopes.ts; imports run only for requested content.\nexport const englishScopeLoaders = {\n${lines.join('\n')}\n};\n`);
  console.log(`English scopes gzip bytes: ${JSON.stringify(sizes)}; ${guides.length} separate article packs; ${neutral} neutral date lines in US style added.`);
  // 繁體's pruned phrase table reads every source file, the guide data written above included.
  await generateTraditionalPhrases();
}
