import type { Guide, GuideCategory } from '../../data/guides';
import { getGuideMedia, type GuideImage } from '../../data/guide-media';
import { ATTRACTIONS } from '../../data/attractions';
import { GUIDE_TOPICS, guideTopicOf, type GuideTopicId } from '../../data/guide-topics';
import { getCover, type CoverPage, type ResolvedCover } from '../../lib/cover';
import type { Copy, CoverTone } from '../../lib/event-facts';

/**
 * Guide facts for the index (T2) and the article template (T7), computed from the published guide only: topics come from
 * src/data/guide-topics.ts (D22), covers from the honesty ladder (getCover), regions from the slug and the attraction
 * registry. No React here, so tests and scripts can use it.
 */

export type GuideRegionId = 'sf' | 'east-bay' | 'peninsula' | 'south-bay' | 'north-bay';
export const GUIDE_REGIONS: readonly { id: GuideRegionId; zh: string; en: string }[] = [
  { id: 'sf', zh: '旧金山', en: 'San Francisco' },
  { id: 'east-bay', zh: '东湾', en: 'East Bay' },
  { id: 'peninsula', zh: '半岛', en: 'Peninsula' },
  { id: 'south-bay', zh: '南湾', en: 'South Bay' },
  { id: 'north-bay', zh: '北湾', en: 'North Bay' },
];
export const isGuideRegion = (value: unknown): value is GuideRegionId => GUIDE_REGIONS.some(region => region.id === value);
export const isGuideTopic = (value: unknown): value is GuideTopicId => GUIDE_TOPICS.some(topic => topic.id === value);

// Place words in slugs; a guide may belong to two regions ("peninsula-south-bay-…"). Everything else is Bay-wide.
const REGION_WORDS: readonly [GuideRegionId, RegExp][] = [
  ['sf', /(?:^|-)(?:sf|san-francisco|presidio|golden-gate|alcatraz|chinatown|fishermans|lands-end|mission-dolores|palace-fine|sunset-dunes)(?:-|$)/],
  ['east-bay', /(?:^|-)(?:east-bay|oakland|berkeley|alameda|fremont|richmond|martinez|pleasanton|tilden|reinhardt|ardenwood|coyote-hills)(?:-|$)/],
  ['peninsula', /(?:^|-)(?:peninsula|san-mateo|palo-alto|stanford|san-carlos|filoli|half-moon-bay|coyote-point)(?:-|$)/],
  ['south-bay', /(?:^|-)(?:south-bay|san-jose|alviso|saratoga|hakone|sccld|santa-clara)(?:-|$)/],
  ['north-bay', /(?:^|-)(?:north-bay|marin|sausalito|muir|point-reyes|napa|sonoma|china-camp|angel-island)(?:-|$)/],
];
const ATTRACTION_REGION = new Map<string, GuideRegionId>(ATTRACTIONS.map(item => [item.slug, item.region as GuideRegionId]));

/** The regions a guide is about; an empty list means it serves the whole Bay Area. */
export function guideRegionsOf(guide: Pick<Guide, 'slug'>): GuideRegionId[] {
  const listed = ATTRACTION_REGION.get(guide.slug);
  if (listed) return [listed];
  return REGION_WORDS.filter(([, words]) => words.test(guide.slug)).map(([id]) => id);
}

/** Old `/guides?category=` links (school strips, shared links) keep working: the category narrows the list. */
export const LEGACY_CATEGORY_TOPIC: Readonly<Record<GuideCategory, GuideTopicId>> = {
  rent: 'housing', roommate: 'housing', used: 'housing', service: 'housing', safety: 'housing',
  newcomer: 'documents', education: 'documents', commute: 'transport', city: 'outings', events: 'outings',
};

/** Each topic's TypeCover palette and texture icon (keys of TypeCover's closed icon list). */
export const TOPIC_COVER: Readonly<Record<GuideTopicId, { tone: CoverTone; icon: string }>> = {
  elders: { tone: 'seniors', icon: 'seniors' },
  health: { tone: 'culture', icon: 'book' },
  documents: { tone: 'family', icon: 'landmark' },
  housing: { tone: 'food', icon: 'store' },
  transport: { tone: 'outdoors', icon: 'bike' },
  savings: { tone: 'free', icon: 'free' },
  outings: { tone: 'outdoors', icon: 'outdoors' },
};

export const topicCopy = (topic: GuideTopicId): Copy => {
  const entry = GUIDE_TOPICS.find(item => item.id === topic)!;
  return { zh: entry.zh, en: entry.en };
};

/**
 * A display title split at its first colon: "湾区中文长者服务：餐食、日间照护…" → head + rest. Takes the already-translated
 * title (RC-11 i: the dictionary keys whole sentences, so split after translating). A head shorter than 4 characters stays whole.
 */
export function splitGuideTitle(title: string): { head: string; rest: string } {
  const match = /^(.{4,}?)\s*[：:｜|]\s*(.+)$/su.exec(title.trim());
  return match ? { head: match[1].trim(), rest: match[2].trim() } : { head: title.trim(), rest: '' };
}

/** Reading time from the article's own words (GUIDE-16): about 400 Chinese characters or 220 English words a minute. */
export function guideReadMinutes(guide: Pick<Guide, 'title' | 'summary' | 'blocks'>): number {
  const texts: string[] = [guide.title, guide.summary];
  for (const block of guide.blocks) {
    if ('text' in block && typeof block.text === 'string') texts.push(block.text);
    if ('title' in block && typeof block.title === 'string') texts.push(block.title);
    if ('items' in block && Array.isArray(block.items)) texts.push(...block.items);
    if (block.type === 'route') texts.push(...block.stops.flatMap(stop => [stop.title, stop.text]));
  }
  const text = texts.join(' ');
  const han = (text.match(/[㐀-鿿]/g) || []).length;
  const words = (text.replace(/[㐀-鿿]/g, ' ').match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g) || []).length;
  return Math.max(1, Math.ceil(han / 400 + words / 220));
}

export const guideSourceCount = (guide: Pick<Guide, 'sources'>) => new Set(guide.sources.map(source => source.url)).size;

/** One cover per guide through the honesty ladder: a photo or official image, never an AI illustration (→ TypeCover). */
export function guideCover(guide: Guide, today: string, page?: CoverPage): ResolvedCover {
  const image = getGuideMedia(guide).cover;
  return getCover({ kind: 'guide', id: guide.slug, imageKey: image.src }, { images: () => image, today, page });
}

// Inline images that several guides share are generic theme pictures, not this guide's subject (GUIDE-05).
let sharedInline: Map<string, number> | undefined;
function sharedInlineCount(guides: readonly Guide[], src: string): number {
  if (!sharedInline) {
    sharedInline = new Map();
    for (const guide of guides) for (const { image } of getGuideMedia(guide).inline) sharedInline.set(image.src, (sharedInline.get(image.src) || 0) + 1);
  }
  return sharedInline.get(src) || 0;
}
/** The stock laptop photo whose caption says it is not the event or service shown (Medicare, Social Security …). */
const OFF_TOPIC_SOURCES = new Set(['/guides/coverage-2026/coverage-laptop.webp']);

/**
 * Whether an inline picture stays in the article. 办事 pages stay quiet (D9): no AI mood illustrations outside 周末出游;
 * an AI illustration several guides share is generic everywhere; the stock laptop photo is off-topic everywhere.
 */
export function keepInlineImage(image: GuideImage, guide: Guide, guides: readonly Guide[]): boolean {
  if (OFF_TOPIC_SOURCES.has(image.src)) return false;
  if (image.kind !== 'illustration' || image.scene3d) return true;
  if (guideTopicOf(guide) !== 'outings') return false;
  return sharedInlineCount(guides, image.src) < 2;
}

/** The question BayBay starts with: what to do first for this guide, never a generic "出发前" prompt (GUIDE-10). */
export function guideBayBayQuestion(guide: Pick<Guide, 'slug' | 'category'>, english: boolean, title: string): string {
  const outing = guideTopicOf(guide) === 'outings';
  if (english) return outing
    ? `I'm reading "${title}". Using this guide, how should I plan the half day, and what should I confirm first?`
    : `I'm reading "${title}". Using this guide, what is my first step, who do I contact, and what should I prepare?`;
  return outing
    ? `我正在读《${title}》。请根据这篇指南，帮我把半天怎么走排一下，并告诉我先要确认什么。`
    : `我正在读《${title}》。请根据这篇指南，告诉我第一步做什么、该联系谁、要准备什么。`;
}
