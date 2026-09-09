import type { Guide, GuideCategory } from '../data/guides';
import { guideBlockText } from './guide-content';
import { getLocale, simplifySearch, translateEditorial, type Locale } from '../i18n/locale';

const synonyms = [
  ['租房', '租屋', '租賃', '租赁'], ['二手', '闲置', '閒置'],
  ['驾照', '驾驶证', '駕照'], ['宽带', '寬帶', '网络', '網路'],
  ['打印', '列印'], ['公证', '公證'], ['维修', '維修', '修理'],
  ['图书馆', '圖書館'], ['兼职', '兼職'], ['机场', '機場'],
  ['旧金山', '舊金山', 'san francisco'], ['圣何塞', '聖荷西', '圣荷西', 'san jose'],
  ['净滩', '淨灘', '海岸清理', 'coastal cleanup'],
];

export const normalizeGuideQuery = (text: string): string => {
  let value = simplifySearch(text).normalize('NFKC').toLowerCase();
  for (const [canonical, ...aliases] of synonyms) {
    for (const alias of aliases) value = value.replaceAll(alias, canonical);
  }
  return value.trim();
};

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

/** Search every published passage locally; query tokens use AND, aliases share a canonical form. */
export const searchGuides = (
  guides: Guide[],
  { query = '', category = 'all', locale = getLocale() }: { query?: string; category?: 'all' | GuideCategory; locale?: Locale } = {},
): GuideSearchResult[] => {
  const tokens = [...new Set(normalizeGuideQuery(query).split(/\s+/).filter(Boolean))];
  const scored = guides.filter((guide) => category === 'all' || guide.category === category).flatMap((guide) => {
    const passages = locale === 'zh-Hans' ? passagesFor(guide) : [...passagesFor(translateEditorial(guide, locale)), ...passagesFor(guide)];
    const fullText = normalizeGuideQuery(passages.map((passage) => passage.text).join(' '));
    if (!tokens.every((token) => fullText.includes(token))) return [];
    const matches = passages.map((passage) => ({
      ...passage,
      score: tokens.filter((token) => normalizeGuideQuery(passage.text).includes(token)).length * passage.weight,
    })).filter((passage) => passage.score > 0).sort((a, b) => b.score - a.score);
    const best = matches.find((passage) => passage.section && passage.weight === 2) || matches[0];
    const sentence = best?.text.split(/(?<=[。！？；\n])/).find((part) => tokens.some((token) => normalizeGuideQuery(part).includes(token))) || best?.text;
    const snippet = sentence ? sentence.trim().slice(0, 150) + (sentence.trim().length > 150 ? '…' : '') : undefined;
    return [{ guide, score: matches.reduce((sum, passage) => sum + passage.score, 0), snippet, section: best?.section }];
  });
  scored.sort((a, b) => b.score - a.score ||
    ({ P0: 0, P1: 1, P2: 2 })[a.guide.priority] - ({ P0: 0, P1: 1, P2: 2 })[b.guide.priority] ||
    b.guide.updatedAt.localeCompare(a.guide.updatedAt));
  return scored.map(({ guide, snippet, section }) => ({ guide, snippet, section }));
};
