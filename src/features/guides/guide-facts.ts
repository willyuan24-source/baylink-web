import type { Guide } from '../../data/guides';
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
export function splitGuideTitle(title: string): { head: string; separator: string; rest: string } {
  const match = /^(.{4,}?)(\s*[：:｜|]\s*)(.+)$/su.exec(title.trim());
  return match ? { head: match[1], separator: match[2], rest: match[3] } : { head: title.trim(), separator: '', rest: '' };
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

/** A guide card's meta line (index feed, rails, "Read next"): one source in the singular, the reading time alone without sources. */
export function guideCardMeta(guide: Pick<Guide, 'sources' | 'title' | 'summary' | 'blocks'>): Copy {
  const sources = guideSourceCount(guide), minutes = guideReadMinutes(guide);
  return sources
    ? { zh: `${sources} 个官方来源 · 约 ${minutes} 分钟`, en: `${sources} official source${sources === 1 ? '' : 's'} · ${minutes} min read` }
    : { zh: `约 ${minutes} 分钟`, en: `${minutes} min read` };
}

/** A guide date for English readers: '2026-10-06' → 'Oct 6, 2026' (the head meta line and the carousel cover). */
export const guideEnglishDate = (iso: string): string => {
  const [year, month, day] = iso.split('-').map(Number);
  if (!year || !month || !day) return iso;
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, day, 12)));
};

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

/**
 * The question BayBay starts with: what to do first for this guide, never a generic "出发前" prompt (GUIDE-10). School and
 * district guides keep the enrollment-steps prompt that asks only for area and grade, never a child's details (the same
 * wording and rule as bayBayPageQuestions' "整理入学步骤" in src/lib/baybay-conversation.ts, copied so the guide route
 * does not load the assistant module; the title goes in front so a /plan?q= link still names the guide).
 */
export function guideBayBayQuestion(guide: Pick<Guide, 'slug' | 'category' | 'tags'>, t: (zh: string, en: string) => string, title: string): string {
  if (guide.category === 'education' || guide.tags.includes('学校与学区') || /(?:^|-)schools?(?:-|$)/.test(guide.slug)) {
    return t(`我正在读《${title}》。根据这篇学校与学区指南，帮我整理入学步骤、要到官网核实的时间和材料类别。只需了解地区与年级，不要让我在聊天中提交孩子个人资料或证件。`,
      `I'm reading "${title}". Using this school and district guide, outline enrollment steps, dates to check on official websites and categories of required documents. Ask only for my area and grade, and do not ask me to submit a child's personal details or documents in chat.`);
  }
  return guideTopicOf(guide) === 'outings'
    ? t(`我正在读《${title}》。请根据这篇指南，帮我把半天怎么走排一下，并告诉我先要确认什么。`, `I'm reading "${title}". Using this guide, how should I plan the half day, and what should I confirm first?`)
    : t(`我正在读《${title}》。请根据这篇指南，告诉我第一步做什么、该联系谁、要准备什么。`, `I'm reading "${title}". Using this guide, what is my first step, who do I contact, and what should I prepare?`);
}
