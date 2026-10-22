import type { Guide } from '../../data/guides';
import { GUIDE_TOPICS, type GuideTopicId } from '../../data/guide-topics';
import { createCoverPage, getCover, type CoverPage, type ResolvedCover } from '../../lib/cover';
import type { Copy, CoverTone } from '../../lib/event-facts';
import { getLocale } from '../../i18n/locale';
import { coverFor, relatedForToday, type GuideCall, type GuideCard, type GuideRecord } from './guide-records';

/**
 * Guide facts for the index (T2) and the article template (T7), computed from the published guide only: topics come from
 * src/data/guide-topics.ts (D22), covers from the honesty ladder (getCover). No React and no guide corpus here (WEB-DATA-SPLIT):
 * the facts that need the corpus, the media registry or the attraction registry (regions, card covers, shared inline pictures)
 * are computed at build time by guide-data.ts into the generated guide index and records.
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

/** Each topic's tone and icon key (the UI9-C type covers' palette; kept for the topic chips' data, UI9-IMAGES draws pictures only). */
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
export function guideCardMeta(card: Pick<GuideCard, 'sourceCount' | 'readMinutes'>): Copy {
  const sources = card.sourceCount, minutes = card.readMinutes;
  return sources
    ? { zh: `${sources} 个官方来源 · 约 ${minutes} 分钟`, en: `${sources} official source${sources === 1 ? '' : 's'} · ${minutes} min read` }
    : { zh: `约 ${minutes} 分钟`, en: `${minutes} min read` };
}

/**
 * The one number a guide's 拨打 calls (UI9-GUIDES): the cover slide's phone, else the first contact card's. The reader's bar
 * (from the record's editorial) and the index's 简洁 elder rows (the generated card's `call`, guide-data.ts) read the same
 * fields through this function, so both print the same number.
 */
export function guideCallOf(editorial: { cover: { phone?: { number: string; tel: string; label: Copy } }; contacts?: readonly { number: string; tel: string; name: Copy }[] } | undefined): GuideCall | undefined {
  const phone = editorial?.cover.phone;
  if (phone) return { number: phone.number, tel: phone.tel, label: { zh: phone.label.zh, en: phone.label.en } };
  const contact = editorial?.contacts?.[0];
  return contact ? { number: contact.number, tel: contact.tel, label: { zh: contact.name.zh, en: contact.name.en } } : undefined;
}

/** A monthly edition's dates: its month, and the first / last day it covers when the guide names them. */
export type GuideEdition = { editionMonth?: string; editionStartDate?: string; editionThroughDate?: string };

/**
 * Where a monthly edition stands on a Bay Area day (UI9-GUIDES; one answer for the head, the 往期 notice, the index rows, the
 * previews and "Read next"): `past` after its last day (editionThroughDate, else the end of its month), `upcoming` before its
 * first day (editionStartDate, else the start of its month), `current` in between; undefined for a guide without an edition.
 */
export function editionState(edition: GuideEdition, today: string): 'current' | 'upcoming' | 'past' | undefined {
  const month = edition.editionMonth;
  if (!month) return undefined;
  if (edition.editionThroughDate ? today > edition.editionThroughDate : today.slice(0, 7) > month) return 'past';
  if (edition.editionStartDate ? today < edition.editionStartDate : today.slice(0, 7) < month) return 'upcoming';
  return 'current';
}

const monthShort = (month: number) => new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(2000, month - 1, 15)));

/** A current edition's card label: "10 月本期" for a whole month, else its days, "10/7–11/30 本期" / "Oct 7–Nov 30 edition". */
function editionCardLabel(edition: GuideEdition): Copy {
  const month = edition.editionMonth!;
  const [year, monthNumber] = [Number(month.slice(0, 4)), Number(month.slice(5, 7))];
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).toISOString().slice(0, 10);
  const first = edition.editionStartDate ?? `${month}-01`, last = edition.editionThroughDate ?? lastDay;
  if (first === `${month}-01` && last === lastDay) return { zh: `${monthNumber} 月本期`, en: `${monthShort(monthNumber)} edition` };
  const day = (date: string) => ({ month: Number(date.slice(5, 7)), day: Number(date.slice(8, 10)) });
  const [a, b] = [day(first), day(last)];
  return { zh: `${a.month}/${a.day}–${b.month}/${b.day} 本期`, en: `${monthShort(a.month)} ${a.day}–${monthShort(b.month)} ${b.day} edition` };
}

/**
 * The 2-line guide card meta (UI9-GUIDES, the index rows and "Read next"): line 1 the time, "[10 月本期 · ]约 4 分钟" (a current
 * monthly edition says so first, editionState); line 2 the sources, "10 个官方来源[ · 东湾]" (the region only when the guide
 * names one). `guideCardMeta` (one line) stays for the cards that still print one (home's GuideRail, C).
 *
 * The 本期 label follows the edition's actual coverage, not its file month (lib/edition-label): "10 月本期" only for an edition
 * that covers its whole month; one with its own first / last day says those days, "10/7–11/30 本期" ("Oct 7–Nov 30 edition").
 */
export function guideCardLines(card: Pick<GuideCard, 'sourceCount' | 'readMinutes'> & GuideEdition & { regions?: readonly GuideRegionId[] }, today: string): { when: Copy; meta?: Copy } {
  const minutes = card.readMinutes;
  const label = editionState(card, today) === 'current' ? editionCardLabel(card) : undefined;
  const when: Copy = label ? { zh: `${label.zh} · 约 ${minutes} 分钟`, en: `${label.en} · ${minutes} min read` } : { zh: `约 ${minutes} 分钟`, en: `${minutes} min read` };
  const sources = card.sourceCount;
  const regions = (card.regions ?? []).map(id => GUIDE_REGIONS.find(region => region.id === id)!).filter(Boolean);
  const place = regions.length ? { zh: regions.map(region => region.zh).join('、'), en: regions.map(region => region.en).join(', ') } : undefined;
  if (!sources && !place) return { when };
  const count: Copy | undefined = sources ? { zh: `${sources} 个官方来源`, en: `${sources} official source${sources === 1 ? '' : 's'}` } : undefined;
  const meta: Copy = count && place ? { zh: `${count.zh} · ${place.zh}`, en: `${count.en} · ${place.en}` } : (count ?? place)!;
  return { when, meta };
}

/**
 * Index previews in season (UI9-GUIDES): current editions come first, a past edition never shows in a preview (it stays in
 * its topic's full list), the rest keep their order.
 */
export function inSeason<T extends GuideEdition>(cards: readonly T[], today: string): T[] {
  const live = cards.filter(card => editionState(card, today) !== 'past');
  return [...live.filter(card => editionState(card, today) === 'current'), ...live.filter(card => editionState(card, today) !== 'current')];
}

/** A guide date for English readers: '2026-10-06' → 'Oct 6, 2026' (the head meta line and the carousel cover). */
export const guideEnglishDate = (iso: string): string => {
  const [year, month, day] = iso.split('-').map(Number);
  if (!year || !month || !day) return iso;
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, day, 12)));
};

/** One cover per guide through the honesty ladder (DECISIONS 22): its own photo or official image, else its ③ stock picture. */
export function guideCover(card: Pick<GuideCard, 'slug' | 'covers'>, today: string, page?: CoverPage): ResolvedCover {
  const image = coverFor(card.covers, getLocale());
  // A cover another guide on the page already shows gives way to the guide's ③ stock picture (UI9-IMG-A1b): never a card.
  const stock = card.covers.stock && coverFor(card.covers.stock, getLocale());
  const keys = stock && stock.src !== image.src ? { imageKeys: [image.src, stock.src] } : {};
  return getCover({ kind: 'guide', id: card.slug, imageKey: image.src, ...keys }, { images: key => key === stock?.src ? stock : image, today, page });
}

/**
 * A guide page's pictures in the order the page claims them (rule 6, one picture once per page): the hero; the inline
 * pictures the deals board does not already show (the board shows each offer's own picture); the legacy poster only when it
 * is not the cover; the 3D link's postcard (H36) only when the page does not already show it; then the "Read next" cards
 * (never an edition past its last day), each resolved after every picture above, so a card whose cover the page shows takes
 * its next picture (scripts/generate-guide-data.ts distinctRelated mirrors these claims). GuideDetail and the tests read it.
 */
export function guidePageCovers(record: GuideRecord, today: string) {
  const { guide } = record;
  const coverPage = createCoverPage();
  const cover = guideCover({ slug: guide.slug, covers: record.covers }, today, coverPage);
  const boardImages = record.boardImages ?? [];
  const sectionCount = guide.blocks.filter(block => block.type === 'heading').length;
  const inline = record.inline.filter(item => Number.isInteger(item.afterHeading) && item.afterHeading >= 1 && item.afterHeading <= sectionCount
    && !boardImages.includes(item.image.src));
  const poster = guide.cover && !coverPage.claims.has(guide.cover) && !inline.some(item => item.image.src === guide.cover) ? guide.cover : undefined;
  for (const src of [...inline.map(item => item.image.src), ...boardImages, ...(poster ? [poster] : [])]) if (!coverPage.claims.has(src)) coverPage.claims.set(src, `page:${guide.slug}`);
  const opusArt = !!record.opus?.postcard && !coverPage.claims.has(record.opus.postcard.src);
  if (opusArt) coverPage.claims.set(record.opus!.postcard!.src, `page:${guide.slug}`);
  const related = relatedForToday(record.related.filter(card => editionState(card, today) !== 'past'), today);
  return { coverPage, cover, inline, poster, opusArt, related, relatedCovers: related.map(card => guideCover(card, today, coverPage)) };
}
