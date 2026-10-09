import type { Guide, GuideCategory } from '../data/guides';
import { guideBlockText } from './guide-content';
import { getLocale, translateEditorial, type Locale } from '../i18n/locale';
import { normalizeSearchText } from './search-synonyms';

/** Synonyms live in search-synonyms.ts (G17); this name stays for the callers that import it. */
export const normalizeGuideQuery = (text: string): string => normalizeSearchText(text);

/**
 * The text cut after each 。！？； or line break, the mark kept at the end of its piece; a mark at the very end makes no
 * empty piece; '' → ['']. W9-E (review 2026-10-01 R§5 #2): this was a split on a regex look-behind, which Safari before
 * 16.4 (iOS 15, iOS 16.0–16.3) cannot parse; the same pieces (tests/opus-bay-w9-e-lookbehind.test.ts).
 */
export function splitAfterSentenceEnds(text: string): string[] {
  const parts: string[] = [];
  let start = 0;
  for (let i = 0; i < text.length - 1; i++) {
    if ('。！？；\n'.includes(text[i])) { parts.push(text.slice(start, i + 1)); start = i + 1; }
  }
  parts.push(text.slice(start));
  return parts;
}

export type GuideSearchResult = { guide: Guide; snippet?: string; section?: string };
type Passage = { text: string; section?: string; weight: number };

const passagesFor = (guide: Guide): Passage[] => {
  const passages: Passage[] = [
    { text: guide.title, weight: 12 },
    { text: guide.subtitle, weight: 7 },
    { text: guide.summary, weight: 6 },
    { text: [...guide.tags, ...guide.audience, guide.categoryLabel].join(' '), weight: 5 },
  ];
  let section: string | undefined;
  for (const block of guide.blocks) {
    if (block.type === 'heading') section = block.text;
    const text = guideBlockText(block);
    passages.push({ text, section, weight: block.type === 'heading' ? 8 : 2 });
  }
  return passages;
};

type Indexed = { passages: Passage[]; keys: string[]; full: string };
const index = (passages: Passage[]): Indexed => {
  const keys = passages.map((passage) => normalizeGuideQuery(passage.text));
  return { passages, keys, full: keys.join(' ') };
};
// The published (zh-Hans) passages never change at runtime, so their normalized text is kept per guide. Translations
// are rebuilt per search: an English dictionary scope may arrive after the first search.
const publishedIndex = new WeakMap<Guide, Indexed>();
const indexed = (guide: Guide): Indexed => {
  let value = publishedIndex.get(guide);
  if (!value) publishedIndex.set(guide, value = index(passagesFor(guide)));
  return value;
};

/** Search every published passage locally; query tokens use AND, aliases share a canonical form. */
export const searchGuides = (
  guides: Guide[],
  { query = '', category = 'all', locale = getLocale() }: { query?: string; category?: 'all' | GuideCategory; locale?: Locale } = {},
): GuideSearchResult[] => {
  const tokens = [...new Set(normalizeGuideQuery(query).split(/\s+/).filter(Boolean))];
  const scored = guides.filter((guide) => category === 'all' || guide.category === category).flatMap((guide) => {
    const published = indexed(guide);
    const translated = locale === 'zh-Hans' ? undefined : index(passagesFor(translateEditorial(guide, locale)));
    const fullText = translated ? `${translated.full} ${published.full}` : published.full;
    if (!tokens.every((token) => fullText.includes(token))) return [];
    const passages = translated ? [...translated.passages, ...published.passages] : published.passages;
    const keys = translated ? [...translated.keys, ...published.keys] : published.keys;
    const matches = passages.map((passage, at) => ({
      ...passage,
      score: tokens.filter((token) => keys[at].includes(token)).length * passage.weight,
    })).filter((passage) => passage.score > 0).sort((a, b) => b.score - a.score);
    const best = matches.find((passage) => passage.section && passage.weight === 2) || matches[0];
    const sentence = best && splitAfterSentenceEnds(best.text).find((part) => tokens.some((token) => normalizeGuideQuery(part).includes(token))) || best?.text;
    const snippet = sentence ? sentence.trim().slice(0, 150) + (sentence.trim().length > 150 ? '…' : '') : undefined;
    return [{ guide, score: matches.reduce((sum, passage) => sum + passage.score, 0), snippet, section: best?.section }];
  });
  scored.sort((a, b) => b.score - a.score ||
    ({ P0: 0, P1: 1, P2: 2 })[a.guide.priority] - ({ P0: 0, P1: 1, P2: 2 })[b.guide.priority] ||
    b.guide.updatedAt.localeCompare(a.guide.updatedAt));
  return scored.map(({ guide, snippet, section }) => ({ guide, snippet, section }));
};
